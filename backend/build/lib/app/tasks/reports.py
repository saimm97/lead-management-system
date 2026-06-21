import json
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.issue import ReportSnapshot
from app.models.user import User
from app.tasks.celery_app import celery_app

sync_engine = create_engine(settings.database_url.replace("+asyncpg", ""))


def send_email(to: str, subject: str, html: str) -> bool:
    if not settings.smtp_host:
        return False
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.from_email
    msg["To"] = to
    msg.attach(MIMEText(html, "html"))
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_pass)
            server.sendmail(settings.from_email, to, msg.as_string())
        return True
    except Exception:
        return False


@celery_app.task(name="app.tasks.reports.generate_weekly_reports")
def generate_weekly_reports():
    with Session(sync_engine) as db:
        managers = db.execute(select(User).where(User.role.in_(["admin", "manager"]))).scalars().all()
        for manager in managers:
            payload = {"manager": manager.full_name, "week": datetime.now(timezone.utc).isoformat(), "type": "weekly"}
            snapshot = ReportSnapshot(
                report_type="weekly",
                period_start=datetime.now(timezone.utc) - timedelta(days=7),
                period_end=datetime.now(timezone.utc),
                generated_for_manager_id=manager.id,
                payload_json=json.dumps(payload),
            )
            db.add(snapshot)
            html = f"<h2>Weekly Lead Report</h2><p>Hello {manager.full_name},</p><p>Your weekly report is ready.</p>"
            if send_email(manager.email, "LeadPro Weekly Report", html):
                snapshot.emailed_at = datetime.now(timezone.utc)
        db.commit()


@celery_app.task(name="app.tasks.reports.generate_monthly_reports")
def generate_monthly_reports():
    with Session(sync_engine) as db:
        managers = db.execute(select(User).where(User.role.in_(["admin", "manager"]))).scalars().all()
        for manager in managers:
            payload = {"manager": manager.full_name, "month": datetime.now(timezone.utc).isoformat(), "type": "monthly"}
            snapshot = ReportSnapshot(
                report_type="monthly",
                period_start=datetime.now(timezone.utc) - timedelta(days=30),
                period_end=datetime.now(timezone.utc),
                generated_for_manager_id=manager.id,
                payload_json=json.dumps(payload),
            )
            db.add(snapshot)
            html = f"<h2>Monthly Lead Report</h2><p>Hello {manager.full_name},</p><p>Your monthly report is ready.</p>"
            if send_email(manager.email, "LeadPro Monthly Report", html):
                snapshot.emailed_at = datetime.now(timezone.utc)
        db.commit()
