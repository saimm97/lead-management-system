from datetime import datetime
from typing import Generic, TypeVar

from pydantic import BaseModel, EmailStr, Field


class RefreshRequest(BaseModel):
    refresh_token: str

from app.core.enums import ApprovalStatus, IssueCategory, IssuePriority, IssueStatus, UserRole

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class BDRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str
    employee_id: str


class AcceptInviteRequest(BaseModel):
    password: str = Field(min_length=6)
    full_name: str
    employee_id: str


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str
    employee_id: str
    devsinc_id: str | None = None
    role: UserRole
    manager_id: int | None = None


class UserUpdate(BaseModel):
    full_name: str | None = None
    role: UserRole | None = None
    manager_id: int | None = None
    is_active: bool | None = None
    devsinc_id: str | None = None


class UserInviteCreate(BaseModel):
    email: EmailStr
    role: UserRole
    manager_id: int | None = None


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    employee_id: str
    devsinc_id: str | None = None
    role: UserRole
    manager_id: int | None
    is_active: bool
    approval_status: ApprovalStatus
    created_at: datetime

    model_config = {"from_attributes": True}


class UserBrief(BaseModel):
    id: int
    full_name: str
    employee_id: str
    devsinc_id: str | None = None
    role: UserRole

    model_config = {"from_attributes": True}

    @property
    def display_name(self) -> str:
        return f"{self.full_name} (ID - {self.employee_id})"
