from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery("leadpro", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "weekly-report": {
            "task": "app.tasks.reports.generate_weekly_reports",
            "schedule": crontab(hour=8, minute=0, day_of_week=1),
        },
        "monthly-report": {
            "task": "app.tasks.reports.generate_monthly_reports",
            "schedule": crontab(hour=8, minute=0, day_of_month=1),
        },
        "ai-pipeline-ingest": {
            "task": "app.services.ai_pipeline.ingest_daily",
            "schedule": crontab(hour=6, minute=0),
        },
    },
)


@celery_app.task(name="app.services.ai_pipeline.ingest_daily")
def ingest_ai_pipeline_daily():
    from app.services.ai_pipeline import run_daily_ingest

    return run_daily_ingest()


@celery_app.task(name="app.pipeline.refresh_run")
def refresh_pipeline_run(run_id: int):
    import asyncio

    from app.core.database import AsyncSessionLocal, engine
    from app.pipeline.refresh import execute_run

    async def go() -> int:
        try:
            return await execute_run(run_id, AsyncSessionLocal)
        finally:
            await engine.dispose()

    return asyncio.run(go())


celery_app.autodiscover_tasks(["app.tasks"])
