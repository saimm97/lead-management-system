import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.core.enums import ApprovalStatus, UserRole
from app.core.security import hash_password
from app.models.user import User, UserInvitation
from app.schemas.user import UserCreate, UserInviteCreate, UserResponse, UserUpdate
from app.services.audit import log_audit
from app.services.rbac import can_manage_users

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserResponse])
async def list_users(
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).order_by(User.full_name))
    return result.scalars().all()


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    user: User = Depends(require_roles(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already exists")
    new_user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        employee_id=data.employee_id,
        devsinc_id=data.devsinc_id if data.role == UserRole.ENGINEER else None,
        role=data.role,
        manager_id=data.manager_id,
        must_reset_password=True,
    )
    db.add(new_user)
    await log_audit(db, user.id, "create", "user", details=data.email)
    await db.commit()
    await db.refresh(new_user)
    return new_user


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    data: UserUpdate,
    user: User = Depends(require_roles(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(target, field, value)
    await log_audit(db, user.id, "update", "user", user_id)
    await db.commit()
    await db.refresh(target)
    return target


@router.get("/pending-approvals", response_model=list[UserResponse])
async def pending_approvals(
    user: User = Depends(require_roles(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.approval_status == ApprovalStatus.PENDING).order_by(User.created_at.desc())
    )
    return result.scalars().all()


@router.post("/{user_id}/approve", response_model=UserResponse)
async def approve_user(
    user_id: int,
    user: User = Depends(require_roles(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    target.approval_status = ApprovalStatus.APPROVED
    await log_audit(db, user.id, "approve", "user", user_id)
    await db.commit()
    await db.refresh(target)
    return target


@router.post("/{user_id}/reject", response_model=UserResponse)
async def reject_user(
    user_id: int,
    user: User = Depends(require_roles(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    target.approval_status = ApprovalStatus.REJECTED
    await log_audit(db, user.id, "reject", "user", user_id)
    await db.commit()
    await db.refresh(target)
    return target


@router.post("/invite", status_code=status.HTTP_201_CREATED)
async def invite_user(
    data: UserInviteCreate,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
):
    token = secrets.token_urlsafe(32)
    invitation = UserInvitation(
        email=data.email,
        role=data.role,
        token=token,
        invited_by_id=user.id,
        manager_id=data.manager_id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db.add(invitation)
    await log_audit(db, user.id, "invite", "user", details=data.email)
    await db.commit()
    return {"token": token, "invite_url": f"/invite/{token}", "email": data.email}


@router.get("/invitations")
async def list_invitations(
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserInvitation).where(UserInvitation.accepted_at.is_(None)).order_by(UserInvitation.created_at.desc())
    )
    invitations = result.scalars().all()
    return [
        {
            "id": inv.id,
            "email": inv.email,
            "role": inv.role.value,
            "token": inv.token,
            "expires_at": inv.expires_at,
            "created_at": inv.created_at,
        }
        for inv in invitations
    ]
