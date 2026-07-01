"""Best-effort transactional email helper.

Uses the configured SMTP server. If SMTP isn't configured (no SMTP_HOST), it
becomes a no-op and returns False so callers can fall back to surfacing the link
directly (useful in development).
"""
import asyncio
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings


def _send_sync(to: str, subject: str, html: str) -> bool:
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


async def send_email(to: str, subject: str, html: str) -> bool:
    """Send an email without blocking the event loop. Returns True if dispatched."""
    return await asyncio.to_thread(_send_sync, to, subject, html)


def link_email(heading: str, body: str, button_label: str, url: str) -> str:
    return f"""
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:auto;color:#0f172a">
      <h2 style="margin-bottom:8px">{heading}</h2>
      <p style="color:#475569;line-height:1.5">{body}</p>
      <p style="margin:24px 0">
        <a href="{url}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;display:inline-block;font-weight:600">{button_label}</a>
      </p>
      <p style="color:#94a3b8;font-size:12px">If the button doesn't work, copy and paste this link:<br>{url}</p>
    </div>
    """
