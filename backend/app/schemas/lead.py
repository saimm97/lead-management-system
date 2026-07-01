from datetime import date, datetime

from pydantic import BaseModel, Field


class LeadCreate(BaseModel):
    company: str
    job_title: str
    job_source: str
    technologies: list[str] = Field(default_factory=list)
    primary_tech: str | None = None
    achieved_at: date | None = None
    assigned_engineer_id: int | None = None
    cluster_head_id: int | None = None
    profile_id: int | None = None
    bd_id: int | None = None
    phase: str = "Applied"
    type: str = "JD Sent"
    status: str = "JD Invite Pending"
    interview_number: str | None = None
    interview_round: str | None = None
    notes: str | None = None


class LeadUpdate(BaseModel):
    company: str | None = None
    job_title: str | None = None
    job_source: str | None = None
    technologies: list[str] | None = None
    primary_tech: str | None = None
    achieved_at: date | None = None
    notes: str | None = None
    jd_invite_sent: bool | None = None


class LeadAssign(BaseModel):
    assigned_engineer_id: int | None = None
    cluster_head_id: int | None = None
    assigned_by_bd_id: int | None = None
    bd_id: int | None = None
    profile_id: int | None = None


class LeadStatusUpdate(BaseModel):
    phase: str
    type: str
    status: str
    interview_number: str | None = None
    interview_round: str | None = None
    note: str | None = None


class LeadStatusHistoryResponse(BaseModel):
    id: int
    changed_by_id: int
    changed_by_name: str | None = None
    old_phase: str | None
    old_type: str | None
    old_status: str | None
    new_phase: str
    new_type: str
    new_status: str
    note: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class LeadResponse(BaseModel):
    id: int
    company: str
    job_title: str
    job_source: str
    technologies: list[str]
    primary_tech: str | None
    jd_invite_sent: bool
    jd_invite_sent_at: datetime | None
    achieved_at: date | None
    assigned_engineer_id: int | None
    assigned_engineer_name: str | None = None
    assigned_engineer_devsinc_id: str | None = None
    cluster_head_id: int | None = None
    cluster_head_name: str | None = None
    assigned_by_bd_id: int | None
    assigned_by_bd_name: str | None = None
    profile_id: int | None
    profile_name: str | None = None
    bd_id: int | None
    bd_name: str | None = None
    phase: str
    type: str
    status: str
    interview_number: str | None = None
    interview_round: str | None = None
    notes: str | None
    issue_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StatusConfigCreate(BaseModel):
    phase: str
    type: str
    status: str
    is_terminal: bool = False
    report_bucket: str | None = None
    sort_order: int = 0


class StatusConfigResponse(BaseModel):
    id: int
    phase: str
    type: str
    status: str
    is_terminal: bool
    report_bucket: str | None
    sort_order: int

    model_config = {"from_attributes": True}


class DropdownOptionCreate(BaseModel):
    category: str = Field(pattern="^(interview_number|interview_round|lead_issue_type)$")
    label: str = Field(min_length=1, max_length=100)


class DropdownOptionResponse(BaseModel):
    id: int
    category: str
    label: str
    sort_order: int

    model_config = {"from_attributes": True}
