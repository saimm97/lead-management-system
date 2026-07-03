from datetime import datetime

from pydantic import BaseModel, Field

from app.core.enums import IssueCategory, IssuePriority, IssueStatus


class IssueCreate(BaseModel):
    title: str = Field(max_length=255)
    description: str
    category: IssueCategory
    priority: IssuePriority = IssuePriority.MEDIUM
    related_lead_id: int | None = None
    related_profile_id: int | None = None
    related_engineer_id: int | None = None


class IssueUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    category: IssueCategory | None = None
    priority: IssuePriority | None = None
    status: IssueStatus | None = None
    assigned_manager_id: int | None = None
    resolution_note: str | None = None


class IssueCommentCreate(BaseModel):
    body: str


class IssueCommentResponse(BaseModel):
    id: int
    issue_id: int
    author_id: int
    author_name: str | None = None
    body: str
    created_at: datetime

    model_config = {"from_attributes": True}


class IssueResponse(BaseModel):
    id: int
    title: str
    description: str
    category: IssueCategory
    priority: IssuePriority
    status: IssueStatus
    reported_by_id: int
    reported_by_name: str | None = None
    reported_by_role: str
    assigned_manager_id: int | None
    assigned_manager_name: str | None = None
    related_lead_id: int | None
    related_profile_id: int | None
    related_engineer_id: int | None = None
    related_engineer_name: str | None = None
    resolution_note: str | None
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None
    comments: list[IssueCommentResponse] = []

    model_config = {"from_attributes": True}
