from datetime import datetime

from pydantic import BaseModel, EmailStr


class CalendarStatus(BaseModel):
    configured: bool
    connected: bool
    google_email: str | None = None


class AuthUrlResponse(BaseModel):
    url: str


class InviteCreate(BaseModel):
    engineer_id: int | None = None
    attendee_email: EmailStr | None = None
    title: str
    description: str | None = None
    start: datetime
    end: datetime
    timezone: str = "UTC"
    location: str | None = None
    related_lead_id: int | None = None
    add_meet_link: bool = False


class InviteResponse(BaseModel):
    id: int
    google_event_id: str | None = None
    html_link: str | None = None
    hangout_link: str | None = None
    attendee_email: str
    title: str
    start: datetime
    end: datetime
