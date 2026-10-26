"""Ingest company boards: fetch, filter, upsert, and close jobs that left the board.

Closing rules:
  * A job is seen when it appears in a complete fetch of its board.
  * An open job missing from a complete fetch gets missed_fetches += 1; at the limit it is closed.
  * A failed or partial fetch never closes anything.
  * Jobs older than the age cap are never stored. Closing sets expires_at to yesterday so existing list filters hide it.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.ai_pipeline import STATUS_NEW, AiPipelineJob, PipelineBoard
from app.pipeline.sources import ADAPTERS
from app.pipeline.sources.base import BoardNotFound, BoardResult, NormalizedJob
from app.pipeline.tech import detect_technologies, is_technical_job
from app.pipeline.us_eligibility import classify
from app.services.ai_pipeline import EmbedFn, embed_texts, embeddings_enabled, job_embed_text

logger = logging.getLogger(__name__)


@dataclass
class IngestStats:
    boards: int = 0
    failed_boards: int = 0
    seen: int = 0
    inserted: int = 0
    updated: int = 0
    closed: int = 0
    rejected: int = 0
    too_old: int = 0

    def add(self, other: "IngestStats") -> None:
        for name in self.__dataclass_fields__:
            setattr(self, name, getattr(self, name) + getattr(other, name))


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _excerpt(text: str) -> str:
    return " ".join(text.split())[:500]


def accept_job(job: NormalizedJob, today: date, max_age_days: int) -> tuple[dict | None, str]:
    """Return (row fields, "") for a job worth storing, or (None, reason)."""
    if not is_technical_job(job.title):
        return None, "not technical"
    if job.posted_at is None:
        return None, "no date"
    if (today - job.posted_at).days > max_age_days:
        return None, "too old"
    verdict = classify(
        job.location,
        workplace_type=job.workplace_type,
        is_remote=job.is_remote,
        title=job.title,
        description=job.description,
        secondary_locations=job.secondary_locations,
        country_codes=job.country_codes,
    )
    if not verdict.eligible:
        return None, verdict.reason
    return {
        "company": job.company,
        "title": job.title,
        "source": job.ats.capitalize(),
        "url": job.url,
        "posted_at": job.posted_at,
        "expires_at": job.posted_at + timedelta(days=max_age_days),
        "technologies": detect_technologies(job.title, job.description),
        "location": job.location or "Remote",
        "countries": list(verdict.countries),
        "excerpt": _excerpt(job.description),
        "scope": verdict.scope,
        "ats": job.ats,
        "external_id": job.external_id,
    }, ""


async def ingest_board(
    db: AsyncSession,
    board: PipelineBoard,
    result: BoardResult,
    *,
    embed: EmbedFn,
    today: date,
    max_age_days: int,
    close_after: int,
) -> IngestStats:
    stats = IngestStats(boards=1)
    now = _now()
    board.last_checked_at = now
    if result.error:
        board.last_error = result.error[:300]
        board.consecutive_failures += 1
        stats.failed_boards = 1
        return stats
    board.last_error = None
    board.consecutive_failures = 0

    rows: dict[str, dict] = {}
    for job in result.jobs:
        fields, reason = accept_job(job, today, max_age_days)
        if fields is None:
            if reason == "too old":
                stats.too_old += 1
            else:
                stats.rejected += 1
            continue
        rows[fields["url"]] = fields
    stats.seen = len(rows)

    existing_rows = (await db.execute(select(AiPipelineJob).where(AiPipelineJob.board_id == board.id))).scalars().all()
    existing = {job.url: job for job in existing_rows}

    fresh = [fields for url, fields in rows.items() if url not in existing]
    if fresh and embeddings_enabled():
        vectors = await embed([job_embed_text(fields) for fields in fresh])
        for fields, vector in zip(fresh, vectors):
            fields["embedding"] = vector

    for url, fields in rows.items():
        job = existing.get(url)
        if job is None:
            try:
                async with db.begin_nested():
                    db.add(
                        AiPipelineJob(
                            **{k: v for k, v in fields.items()},
                            board_id=board.id,
                            status=STATUS_NEW,
                            last_seen_at=now,
                            missed_fetches=0,
                        )
                    )
                stats.inserted += 1
            except IntegrityError:
                continue
        else:
            job.last_seen_at = now
            job.missed_fetches = 0
            job.expires_at = fields["expires_at"]
            job.closed_at = None
            job.location = fields["location"]
            job.countries = fields["countries"]
            stats.updated += 1

    if result.complete:
        board.last_complete_at = now
        board.job_count = len(rows)
        for url, job in existing.items():
            if url in rows or job.closed_at is not None:
                continue
            job.missed_fetches += 1
            if job.missed_fetches >= close_after:
                job.closed_at = today
                job.expires_at = today - timedelta(days=1)
                stats.closed += 1
    await db.flush()
    return stats


async def ingest_boards(
    db: AsyncSession,
    *,
    adapters: dict | None = None,
    embed: EmbedFn = embed_texts,
    today: date | None = None,
    ats: str | None = None,
) -> IngestStats:
    adapters = adapters or ADAPTERS
    today = today or date.today()
    total = IngestStats()
    query = select(PipelineBoard).where(PipelineBoard.active.is_(True))
    if ats:
        query = query.where(PipelineBoard.ats == ats)
    boards = (await db.execute(query.order_by(PipelineBoard.id))).scalars().all()
    for board in boards:
        adapter = adapters.get(board.ats)
        if adapter is None:
            continue
        try:
            result = await adapter(board.slug, board.company)
        except BoardNotFound:
            board.active = False
            result = BoardResult([], complete=False, error="board not found")
        except Exception as exc:  # network, bad JSON: skip the board, never close its jobs
            logger.warning("Board %s/%s failed: %s", board.ats, board.slug, exc)
            result = BoardResult([], complete=False, error=f"{type(exc).__name__}: {exc}")
        total.add(
            await ingest_board(
                db,
                board,
                result,
                embed=embed,
                today=today,
                max_age_days=settings.pipeline_max_age_days,
                close_after=settings.pipeline_close_after_misses,
            )
        )
        await db.commit()
    return total
