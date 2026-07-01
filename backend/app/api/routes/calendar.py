from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.core.config import settings
from app.core.database import get_db
from app.core.enums import UserRole
from app.core.security import create_access_token, decode_token
from app.models.calendar import CalendarInvite, GoogleCredential
from app.models.user import User
from app.schemas.calendar import AuthUrlResponse, CalendarStatus, InviteCreate, InviteResponse
from app.services import google_calendar as gcal
from app.services.audit import log_audit

router = APIRouter(prefix="/calendar", tags=["calendar"])

# Roles that may connect a calendar and send invites
INVITE_ROLES = (UserRole.BD, UserRole.ADMIN, UserRole.MANAGER)


async def _get_credential(db: AsyncSession, user_id: int) -> GoogleCredential | None:
    result = await db.execute(select(GoogleCredential).where(GoogleCredential.user_id == user_id))
    return result.scalar_one_or_none()


@router.get("/status", response_model=CalendarStatus)
async def calendar_status(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    cred = await _get_credential(db, user.id)
    return CalendarStatus(
        configured=gcal.is_configured(),
        connected=cred is not None,
        google_email=cred.google_email if cred else None,
    )


@router.get("/engineers")
async def invite_engineers(
    user: User = Depends(require_roles(*INVITE_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    """Active engineers an invite can be sent to (id, name, email)."""
    result = await db.execute(
        select(User).where(User.role == UserRole.ENGINEER, User.is_active.is_(True)).order_by(User.full_name)
    )
    return [
        {"id": e.id, "full_name": e.full_name, "email": e.email, "devsinc_id": e.devsinc_id}
        for e in result.scalars().all()
    ]


@router.get("/auth-url", response_model=AuthUrlResponse)
async def auth_url(user: User = Depends(require_roles(*INVITE_ROLES)), db: AsyncSession = Depends(get_db)):
    if not gcal.is_configured():
        raise HTTPException(status_code=503, detail="Google Calendar is not configured on the server.")
    # Encode the user id in a signed state token so the callback can identify them.
    state = create_access_token({"sub": str(user.id), "purpose": "gcal_oauth"})
    try:
        return AuthUrlResponse(url=gcal.authorization_url(state))
    except gcal.CalendarError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.get("/callback")
async def oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    payload = decode_token(state)
    if not payload or payload.get("purpose") != "gcal_oauth" or not payload.get("sub"):
        raise HTTPException(status_code=400, detail="Invalid OAuth state")
    user_id = int(payload["sub"])
    try:
        tokens = gcal.exchange_code(code)
    except gcal.CalendarError as exc:
        return RedirectResponse(url=f"{settings.frontend_url}/calendar?error={exc}")

    cred = await _get_credential(db, user_id)
    if cred is None:
        cred = GoogleCredential(user_id=user_id)
        db.add(cred)
    cred.access_token = tokens["access_token"]
    if tokens.get("refresh_token"):
        cred.refresh_token = tokens["refresh_token"]
    cred.token_uri = tokens["token_uri"]
    cred.scopes = tokens["scopes"]
    cred.expiry = tokens["expiry"]
    cred.google_email = tokens.get("google_email")
    cred.updated_at = datetime.now(timezone.utc)
    await log_audit(db, user_id, "connect", "google_calendar")
    await db.commit()
    return RedirectResponse(url=f"{settings.frontend_url}/calendar?connected=1")


@router.delete("/disconnect", status_code=204)
async def disconnect(user: User = Depends(require_roles(*INVITE_ROLES)), db: AsyncSession = Depends(get_db)):
    cred = await _get_credential(db, user.id)
    if cred:
        await db.delete(cred)
        await log_audit(db, user.id, "disconnect", "google_calendar")
        await db.commit()
    return None


@router.post("/invite", response_model=InviteResponse, status_code=201)
async def send_invite(
    data: InviteCreate,
    user: User = Depends(require_roles(*INVITE_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    cred = await _get_credential(db, user.id)
    if cred is None:
        raise HTTPException(status_code=400, detail="Connect your Google Calendar first.")

    # Resolve the attendee — either an engineer by id or a raw email.
    attendee_email = data.attendee_email
    attendee_id = None
    if data.engineer_id is not None:
        result = await db.execute(select(User).where(User.id == data.engineer_id))
        engineer = result.scalar_one_or_none()
        if not engineer:
            raise HTTPException(status_code=404, detail="Engineer not found")
        attendee_email = engineer.email
        attendee_id = engineer.id
    if not attendee_email:
        raise HTTPException(status_code=400, detail="Provide an engineer or an attendee email")

    if data.end <= data.start:
        raise HTTPException(status_code=400, detail="End time must be after start time")

    try:
        result = gcal.create_event(
            cred,
            summary=data.title,
            description=data.description,
            start=data.start,
            end=data.end,
            attendee_emails=[attendee_email],
            timezone=data.timezone,
            location=data.location,
            add_meet_link=data.add_meet_link,
        )
    except gcal.CalendarError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:  # surface Google API errors cleanly
        raise HTTPException(status_code=502, detail=f"Failed to create calendar event: {exc}")

    # Persist any refreshed access token.
    if result.get("refreshed"):
        cred.access_token = result["access_token"]
        cred.expiry = result.get("expiry")

    invite = CalendarInvite(
        organizer_id=user.id,
        attendee_id=attendee_id,
        attendee_email=attendee_email,
        related_lead_id=data.related_lead_id,
        google_event_id=result.get("event_id"),
        html_link=result.get("html_link"),
        title=data.title,
        start_time=data.start,
        end_time=data.end,
    )
    db.add(invite)
    await log_audit(db, user.id, "send_invite", "calendar_invite", details=attendee_email)
    await db.commit()
    await db.refresh(invite)

    return InviteResponse(
        id=invite.id,
        google_event_id=invite.google_event_id,
        html_link=invite.html_link,
        hangout_link=result.get("hangout_link"),
        attendee_email=attendee_email,
        title=invite.title,
        start=invite.start_time,
        end=invite.end_time,
    )
