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
    },
)

celery_app.autodiscover_tasks(["app.tasks"])
