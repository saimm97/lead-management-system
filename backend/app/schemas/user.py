from datetime import datetime
from typing import Generic, TypeVar

from pydantic import BaseModel, EmailStr, Field

from app.core.enums import ApprovalStatus, ManagerType, UserRole

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


class RefreshRequest(BaseModel):
    refresh_token: str


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
    devsinc_id: str | None = None


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str
    employee_id: str
    devsinc_id: str | None = None
    role: UserRole
    manager_id: int | None = None
    manager_type: ManagerType | None = None


class UserUpdate(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None
    employee_id: str | None = None
    role: UserRole | None = None
    manager_id: int | None = None
    manager_type: ManagerType | None = None
    is_active: bool | None = None
    devsinc_id: str | None = None


class AdminPasswordReset(BaseModel):
    new_password: str = Field(min_length=6)
    must_reset_password: bool = True


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


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
    manager_type: ManagerType | None = None
    tenant_id: int | None = None
    is_active: bool
    approval_status: ApprovalStatus
    must_reset_password: bool = False
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
