from datetime import date, timedelta

import app.models  # noqa: F401
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.models.ai_pipeline import AiPipelineJob, PipelineBoard
from app.pipeline.ingest import ingest_boards
from app.pipeline.sources.base import BoardNotFound, BoardResult, NormalizedJob

TODAY = date(2026, 10, 24)


@pytest.fixture
async def db():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with async_sessionmaker(engine, expire_on_commit=False)() as session:
        yield session
    await engine.dispose()


def job(n, title="Backend Engineer", location="Remote - United States", age=3, **kw):
    return NormalizedJob(
        ats="greenhouse",
        external_id=str(n),
        company="Acme",
        title=title,
        url=f"https://boards.greenhouse.io/acme/jobs/{n}",
        location=location,
        posted_at=TODAY - timedelta(days=age),
        description="Python and Django services",
        **kw,
    )


def adapters(result):
    async def adapter(slug, company):
        if isinstance(result, Exception):
            raise result
        return result

    return {"greenhouse": adapter}


async def no_embed(texts):
    return [None] * len(texts)


async def board(db):
    b = PipelineBoard(ats="greenhouse", slug="acme", company="Acme")
    db.add(b)
    await db.commit()
    return b


async def run(db, result):
    return await ingest_boards(db, adapters=adapters(result), embed=no_embed, today=TODAY)


async def test_inserts_only_eligible_fresh_technical_jobs(db):
    await board(db)
    stats = await run(
        db,
        BoardResult(
            [
                job(1),
                job(2, location="Remote - India"),
                job(3, title="Sales Engineer"),
                job(4, age=61),
                job(5, location="Remote - United States", workplace_type="hybrid"),
                job(6, age=60),
            ]
        ),
    )
    assert (stats.inserted, stats.too_old) == (2, 1)
    urls = {j.url.rsplit("/", 1)[1] for j in (await db.execute(select(AiPipelineJob))).scalars()}
    assert urls == {"1", "6"}


async def test_second_run_updates_instead_of_duplicating(db):
    await board(db)
    await run(db, BoardResult([job(1)]))
    stats = await run(db, BoardResult([job(1)]))
    assert (stats.inserted, stats.updated) == (0, 1)


async def test_closes_after_two_missed_complete_fetches(db):
    await board(db)
    await run(db, BoardResult([job(1), job(2)]))
    first = await run(db, BoardResult([job(1)]))
    assert first.closed == 0
    second = await run(db, BoardResult([job(1)]))
    assert second.closed == 1
    gone = (await db.execute(select(AiPipelineJob).where(AiPipelineJob.external_id == "2"))).scalar_one()
    assert gone.closed_at == TODAY and gone.expires_at < TODAY


async def test_reappearing_job_resets_misses_and_reopens(db):
    await board(db)
    await run(db, BoardResult([job(1), job(2)]))
    await run(db, BoardResult([job(1)]))
    await run(db, BoardResult([job(1), job(2)]))
    await run(db, BoardResult([job(1)]))
    row = (await db.execute(select(AiPipelineJob).where(AiPipelineJob.external_id == "2"))).scalar_one()
    assert row.missed_fetches == 1 and row.closed_at is None


async def test_partial_or_failed_fetch_never_closes(db):
    await board(db)
    await run(db, BoardResult([job(1)]))
    for _ in range(3):
        await run(db, BoardResult([], complete=False))
        await run(db, RuntimeError("boom"))
    row = (await db.execute(select(AiPipelineJob))).scalar_one()
    assert row.closed_at is None and row.missed_fetches == 0
    b = (await db.execute(select(PipelineBoard))).scalar_one()
    assert b.consecutive_failures > 0 and b.last_error


async def test_missing_board_is_deactivated(db):
    await board(db)
    await run(db, BoardNotFound("x"))
    b = (await db.execute(select(PipelineBoard))).scalar_one()
    assert b.active is False


def test_slug_candidates():
    from app.pipeline.probe import slug_candidates

    assert slug_candidates("Acme Corp, Inc.") == ["acme"]
    assert slug_candidates("Black Rock Labs") == ["blackrocklabs", "black-rock-labs", "black"]
    assert slug_candidates("!!!") == []


async def test_probe_finds_board_and_skips_404(db):
    from app.pipeline.probe import probe_company, save_boards

    async def hit(slug, company):
        return BoardResult([])

    async def miss(slug, company):
        raise BoardNotFound(slug)

    hits = await probe_company("Acme Inc", {"greenhouse": hit, "lever": miss})
    assert hits == [("greenhouse", "acme")]
    assert await save_boards(db, "Acme Inc", hits) == 1
    assert await save_boards(db, "Acme Inc", hits) == 0
