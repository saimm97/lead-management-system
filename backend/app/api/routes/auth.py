import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.enums import ApprovalStatus, UserRole
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import User, UserInvitation
from app.schemas.user import (
    AcceptInviteRequest,
    BDRegisterRequest,
    ChangePasswordRequest,
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    UserResponse,
)
from app.services.audit import log_audit

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register/bd", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_bd(data: BDRegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    existing_id = await db.execute(select(User).where(User.employee_id == data.employee_id))
    if existing_id.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Employee ID already in use")
    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        employee_id=data.employee_id,
        role=UserRole.BD,
        approval_status=ApprovalStatus.PENDING,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account deactivated")
    if user.approval_status == ApprovalStatus.REJECTED:
        raise HTTPException(status_code=403, detail="Account rejected")
    token_data = {"sub": str(user.id), "role": user.role.value}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    result = await db.execute(select(User).where(User.id == int(payload["sub"])))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")
    token_data = {"sub": str(user.id), "role": user.role.value}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return user


@router.post("/change-password", response_model=UserResponse)
async def change_password(
    data: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.password_hash = hash_password(data.new_password)
    user.must_reset_password = False
    await log_audit(db, user.id, "change_password", "user", user.id)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/accept-invite/{token}", response_model=TokenResponse)
async def accept_invite(token: str, data: AcceptInviteRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserInvitation).where(UserInvitation.token == token))
    invitation = result.scalar_one_or_none()
    if not invitation or invitation.accepted_at:
        raise HTTPException(status_code=400, detail="Invalid or used invitation")
    if invitation.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invitation expired")
    existing = await db.execute(select(User).where(User.email == invitation.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=invitation.email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        employee_id=data.employee_id,
        devsinc_id=data.devsinc_id or (data.employee_id if invitation.role == UserRole.ENGINEER else None),
        role=invitation.role,
        manager_id=invitation.manager_id,
        approval_status=ApprovalStatus.APPROVED,
    )
    db.add(user)
    invitation.accepted_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)
    token_data = {"sub": str(user.id), "role": user.role.value}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )
