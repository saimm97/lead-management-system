"""Pipeline runs: the lock, cooldown and execution behind the Refresh button and the daily schedule.

Rules:
  * One run at a time. A run stuck in "running" for longer than the stale limit is marked failed.
  * Manual runs wait out a cooldown after any run, to protect the upstream boards.
  * A scheduled run never waits for the cooldown but skips if a run is already going.
"""

from __future__ import annotations

import logging
from dataclasses import asdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import settings
from app.models.ai_pipeline import PipelineRun
from app.models.user import User
from app.core.enums import ManagerType, UserRole

logger = logging.getLogger(__name__)

MANUAL = "manual"
SCHEDULED = "scheduled"
RUNNING = "running"
SUCCESS = "success"
FAILED = "failed"


class RefreshBlocked(Exception):
    def __init__(self, reason: str, run: PipelineRun | None = None, retry_after: int = 0):
        super().__init__(reason)
        self.reason = reason
        self.run = run
        self.retry_after = retry_after


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def can_refresh(user: User) -> bool:
    """Admin, BD executive and BD manager. Engineers and engineering managers cannot."""
    if user.role in (UserRole.ADMIN, UserRole.BD):
        return True
    return user.role == UserRole.MANAGER and user.manager_type == ManagerType.BD_MANAGER


async def latest_run(db: AsyncSession) -> PipelineRun | None:
    return (await db.execute(select(PipelineRun).order_by(PipelineRun.id.desc()).limit(1))).scalar_one_or_none()


async def current_run(db: AsyncSession, now: datetime | None = None) -> PipelineRun | None:
    """The run in progress, after failing any run that has been going too long."""
    now = now or _now()
    rows = (await db.execute(select(PipelineRun).where(PipelineRun.status == RUNNING))).scalars().all()
    live = None
    for run in rows:
        if (now - run.started_at).total_seconds() > settings.pipeline_run_stale_seconds:
            run.status = FAILED
            run.finished_at = now
            run.error = "timed out"
        else:
            live = run
    await db.flush()
    return live


async def cooldown_remaining(db: AsyncSession, now: datetime | None = None) -> int:
    now = now or _now()
    last = await latest_run(db)
    if last is None:
        return 0
    wait = settings.pipeline_refresh_cooldown_seconds - (now - last.started_at).total_seconds()
    return max(0, int(wait + 0.999))


async def start_run(
    db: AsyncSession, user_id: int | None, trigger: str, now: datetime | None = None
) -> PipelineRun:
    now = now or _now()
    running = await current_run(db, now)
    if running is not None:
        await db.commit()
        raise RefreshBlocked("already running", run=running)
    if trigger == MANUAL:
        wait = await cooldown_remaining(db, now)
        if wait:
            await db.commit()
            raise RefreshBlocked("cooling down", retry_after=wait)
    run = PipelineRun(trigger=trigger, status=RUNNING, triggered_by_id=user_id, started_at=now)
    db.add(run)
    await db.commit()
    return run


async def execute_run(run_id: int, session_factory: async_sessionmaker, embed=None, adapters=None) -> int:
    """Run the full ingest for an existing run row. Returns the number of jobs inserted."""
    from app.pipeline.ingest import ingest_boards
    from app.services.ai_pipeline import embed_texts, ingest_feed

    embed = embed or embed_texts
    async with session_factory() as db:
        run = await db.get(PipelineRun, run_id)
        if run is None:
            return 0
        try:
            feed_inserted = await ingest_feed(db, embed=embed, boards=False)
            stats = await ingest_boards(db, embed=embed, adapters=adapters)
            run.stats = {"feed_inserted": feed_inserted, **asdict(stats)}
            run.status = SUCCESS
            total = feed_inserted + stats.inserted
        except Exception as exc:  # never leave a run stuck in "running"
            logger.exception("Pipeline run %s failed", run_id)
            await db.rollback()
            run = await db.get(PipelineRun, run_id)
            run.status = FAILED
            run.error = f"{type(exc).__name__}: {exc}"[:500]
            total = 0
        run.finished_at = _now()
        await db.commit()
        return total
