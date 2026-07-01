"""Google Calendar integration service.

Google client libraries are imported lazily inside functions so the application
boots even when they are not installed. Install with:

    pip install google-api-python-client google-auth google-auth-oauthlib

and set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in the environment.
"""
from __future__ import annotations

from datetime import datetime

from app.core.config import settings

SCOPES = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/userinfo.email",
    "openid",
]


class CalendarError(Exception):
    """Raised when the calendar integration is misconfigured or a call fails."""


def is_configured() -> bool:
    return bool(settings.google_client_id and settings.google_client_secret)


def _client_config() -> dict:
    return {
        "web": {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.google_redirect_uri],
        }
    }


def _build_flow(state: str | None = None):
    try:
        from google_auth_oauthlib.flow import Flow
    except ImportError as exc:  # pragma: no cover - depends on optional libs
        raise CalendarError(
            "Google client libraries are not installed. Run: "
            "pip install google-api-python-client google-auth google-auth-oauthlib"
        ) from exc
    return Flow.from_client_config(
        _client_config(),
        scopes=SCOPES,
        redirect_uri=settings.google_redirect_uri,
        state=state,
    )


def authorization_url(state: str) -> str:
    if not is_configured():
        raise CalendarError("Google Calendar is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.")
    flow = _build_flow(state=state)
    url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    return url


def exchange_code(code: str) -> dict:
    """Exchange an authorization code for tokens; returns a serialisable dict."""
    if not is_configured():
        raise CalendarError("Google Calendar is not configured.")
    flow = _build_flow()
    flow.fetch_token(code=code)
    creds = flow.credentials
    email = _fetch_email(creds)
    return {
        "access_token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "scopes": ",".join(creds.scopes or SCOPES),
        "expiry": creds.expiry,
        "google_email": email,
    }


def _fetch_email(creds) -> str | None:
    try:
        from googleapiclient.discovery import build
        service = build("oauth2", "v2", credentials=creds, cache_discovery=False)
        info = service.userinfo().get().execute()
        return info.get("email")
    except Exception:  # pragma: no cover - non-fatal
        return None


def _credentials_from_record(record):
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request

    creds = Credentials(
        token=record.access_token,
        refresh_token=record.refresh_token,
        token_uri=record.token_uri or "https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=(record.scopes or "").split(",") if record.scopes else SCOPES,
    )
    refreshed = False
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        refreshed = True
    return creds, refreshed


def create_event(
    record,
    *,
    summary: str,
    description: str | None,
    start: datetime,
    end: datetime,
    attendee_emails: list[str],
    timezone: str = "UTC",
    location: str | None = None,
    add_meet_link: bool = False,
) -> dict:
    """Create a calendar event on the organizer's primary calendar.

    With ``sendUpdates="all"`` Google emails every attendee an invite which is
    automatically added to their Google Calendar. Returns the new credentials
    state (for persistence) and the created event metadata.
    """
    if not is_configured():
        raise CalendarError("Google Calendar is not configured.")
    from googleapiclient.discovery import build

    creds, refreshed = _credentials_from_record(record)
    service = build("calendar", "v3", credentials=creds, cache_discovery=False)

    event_body: dict = {
        "summary": summary,
        "description": description or "",
        "start": {"dateTime": start.isoformat(), "timeZone": timezone},
        "end": {"dateTime": end.isoformat(), "timeZone": timezone},
        "attendees": [{"email": e} for e in attendee_emails],
        "reminders": {"useDefault": True},
    }
    if location:
        event_body["location"] = location

    insert_kwargs = {"calendarId": "primary", "body": event_body, "sendUpdates": "all"}
    if add_meet_link:
        import uuid
        event_body["conferenceData"] = {
            "createRequest": {
                "requestId": str(uuid.uuid4()),
                "conferenceSolutionKey": {"type": "hangoutsMeet"},
            }
        }
        insert_kwargs["conferenceDataVersion"] = 1

    created = service.events().insert(**insert_kwargs).execute()

    return {
        "event_id": created.get("id"),
        "html_link": created.get("htmlLink"),
        "hangout_link": created.get("hangoutLink"),
        "refreshed": refreshed,
        "access_token": creds.token,
        "expiry": creds.expiry,
    }
