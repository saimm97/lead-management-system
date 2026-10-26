from datetime import datetime, timedelta

import app.models  # noqa: F401
import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user, get_db
from app.api.routes.ai_pipeline import router
from app.core.config import settings
from app.core.database import Base
from app.core.enums import ApprovalStatus, ManagerType, UserRole
from app.models.ai_pipeline import PipelineRun
from app.models.user import User
from app.pipeline import refresh


@pytest.fixture
async def db(monkeypatch):
    monkeypatch.setattr(settings, "job_feed_url", "")
    monkeypatch.setattr(settings, "greenhouse_boards", "")
    monkeypatch.setattr(settings, "pipeline_refresh_backend", "background")
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with async_sessionmaker(engine, expire_on_commit=False)() as session:
        yield session
    await engine.dispose()


async def make_user(db, role, n, manager_type=None):
    user = User(
        email=f"{n}@test.com",
        password_hash="x",
        full_name=n,
        employee_id=n,
        role=role,
        manager_type=manager_type,
        approval_status=ApprovalStatus.APPROVED,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


def client(db, user):
    app = FastAPI()
    app.include_router(router, prefix="/api")

    async def override_db():
        yield db

    async def override_user():
        return user

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = override_user
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.parametrize(
    "role, manager_type, allowed",
    [
        (UserRole.ADMIN, None, True),
        (UserRole.BD, None, True),
        (UserRole.MANAGER, ManagerType.BD_MANAGER, True),
        (UserRole.MANAGER, ManagerType.ENGINEERING_MANAGER, False),
        (UserRole.ENGINEER, None, False),
    ],
)
async def test_only_admin_bd_and_bd_manager_can_refresh(db, role, manager_type, allowed):
    user = await make_user(db, role, "u1", manager_type)
    async with client(db, user) as c:
        response = await c.post("/api/ai-pipeline/refresh")
    assert response.status_code == (202 if allowed else 403)
    assert refresh.can_refresh(user) is allowed


async def test_refresh_runs_to_success_and_records_stats(db):
    admin = await make_user(db, UserRole.ADMIN, "a1")
    async with client(db, admin) as c:
        started = await c.post("/api/ai-pipeline/refresh")
        status = await c.get("/api/ai-pipeline/refresh/status")
        history = await c.get("/api/ai-pipeline/refresh/runs")
    assert started.status_code == 202 and started.json()["triggered_by"] == "a1"
    run = (await db.execute(select(PipelineRun))).scalar_one()
    await db.refresh(run)
    assert run.status == "success" and run.finished_at and "inserted" in run.stats
    body = status.json()
    assert body["can_refresh"] is True and body["running"] is None
    assert body["last_run"]["status"] == "success" and body["cooldown_seconds"] > 0
    assert len(history.json()) == 1


async def test_second_refresh_is_rate_limited_then_blocked_while_running(db):
    admin = await make_user(db, UserRole.ADMIN, "a2")
    async with client(db, admin) as c:
        assert (await c.post("/api/ai-pipeline/refresh")).status_code == 202
        limited = await c.post("/api/ai-pipeline/refresh")
        assert limited.status_code == 429 and "Retry-After" in limited.headers

        run = (await db.execute(select(PipelineRun))).scalar_one()
        run.status, run.finished_at = "running", None
        await db.commit()
        assert (await c.post("/api/ai-pipeline/refresh")).status_code == 409


async def test_stale_running_run_is_failed_and_does_not_block(db):
    old = datetime.utcnow() - timedelta(seconds=settings.pipeline_run_stale_seconds + 600)
    db.add(PipelineRun(trigger="manual", status="running", started_at=old))
    await db.commit()
    run = await refresh.start_run(db, None, refresh.MANUAL)
    stale = (await db.execute(select(PipelineRun).where(PipelineRun.id != run.id))).scalar_one()
    assert stale.status == "failed" and stale.error == "timed out"


async def test_scheduled_run_ignores_cooldown_but_not_a_running_run(db):
    await refresh.start_run(db, None, refresh.SCHEDULED)
    with pytest.raises(refresh.RefreshBlocked) as running:
        await refresh.start_run(db, None, refresh.SCHEDULED)
    assert running.value.run is not None
    run = (await db.execute(select(PipelineRun))).scalar_one()
    run.status = "success"
    await db.commit()
    assert (await refresh.start_run(db, None, refresh.SCHEDULED)).id != run.id  # no cooldown
    with pytest.raises(refresh.RefreshBlocked):
        await refresh.start_run(db, 1, refresh.MANUAL)


async def test_failed_ingest_marks_run_failed(db, monkeypatch):
    async def boom(*args, **kwargs):
        raise RuntimeError("upstream down")

    monkeypatch.setattr("app.services.ai_pipeline.ingest_feed", boom)
    run = await refresh.start_run(db, None, refresh.MANUAL)
    factory = async_sessionmaker(db.bind, expire_on_commit=False)
    assert await refresh.execute_run(run.id, factory) == 0
    await db.refresh(run)
    assert run.status == "failed" and "upstream down" in run.error


async def test_celery_backend_is_used_and_falls_back_when_broker_is_down(db, monkeypatch):
    from app.tasks.celery_app import celery_app

    monkeypatch.setattr(settings, "pipeline_refresh_backend", "celery")
    sent = []
    monkeypatch.setattr(celery_app, "send_task", lambda name, args: sent.append((name, args)))
    admin = await make_user(db, UserRole.ADMIN, "a3")
    async with client(db, admin) as c:
        await c.post("/api/ai-pipeline/refresh")
    run = (await db.execute(select(PipelineRun))).scalar_one()
    await db.refresh(run)
    assert sent == [("app.pipeline.refresh_run", [run.id])] and run.status == "running"

    run.status, run.finished_at = "success", datetime.utcnow() - timedelta(hours=1)
    run.started_at = datetime.utcnow() - timedelta(hours=1)
    await db.commit()

    def broken(name, args):
        raise ConnectionError("no broker")

    monkeypatch.setattr(celery_app, "send_task", broken)
    async with client(db, admin) as c:
        assert (await c.post("/api/ai-pipeline/refresh")).status_code == 202
    latest = await refresh.latest_run(db)
    await db.refresh(latest)
    assert latest.id != run.id and latest.status == "success"
