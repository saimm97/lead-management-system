from datetime import date, datetime

from pydantic import BaseModel, Field


class ProfileCreate(BaseModel):
    full_name: str
    linkedin_url: str | None = None
    github_url: str | None = None
    primary_tech_stack: str | None = None
    assigned_engineer_id: int | None = None


class ProfileUpdate(BaseModel):
    full_name: str | None = None
    linkedin_url: str | None = None
    github_url: str | None = None
    primary_tech_stack: str | None = None
    assigned_engineer_id: int | None = None
    is_active: bool | None = None


class ProfileResponse(BaseModel):
    id: int
    full_name: str
    linkedin_url: str | None
    linkedin_verified: bool
    github_url: str | None
    github_present: bool
    primary_tech_stack: str | None
    assigned_engineer_id: int | None
    assigned_engineer_name: str | None = None
    assigned_engineer_devsinc_id: str | None = None
    is_active: bool
    linked_leads_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProfileSummary(BaseModel):
    total: int
    active: int
    in_use: int
    linkedin_verified: int
    linkedin_unverified: int
    linkedin_missing: int
    github_present: int
    github_missing: int


class MonthlyTargetCreate(BaseModel):
    target_start_date: date
    target_end_date: date | None = None
    engineer_id: int
    lead_target: int = Field(gt=0)
    tech_stack_focus: str
    notes: str | None = None


class MonthlyTargetUpdate(BaseModel):
    target_start_date: date | None = None
    target_end_date: date | None = None
    lead_target: int | None = Field(default=None, gt=0)
    tech_stack_focus: str | None = None
    notes: str | None = None


class MonthlyTargetResponse(BaseModel):
    id: int
    target_start_date: date
    target_end_date: date | None
    engineer_id: int
    engineer_name: str
    engineer_devsinc_id: str | None = None
    lead_target: int
    tech_stack_focus: str
    notes: str | None
    leads_assigned_count: int = 0
    progress_pct: float = 0.0
    created_by_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class MonthlyTargetSummary(BaseModel):
    total_targets: int
    avg_completion_pct: float
    engineers_below_quota: int
