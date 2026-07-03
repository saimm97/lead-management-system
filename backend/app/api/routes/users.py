import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.core.config import settings
from app.core.database import get_db
from app.core.enums import ApprovalStatus, ManagerType, UserRole
from app.core.security import hash_password
from app.models.auth_token import AuthToken, PasswordResetRequest
from app.models.user import User, UserInvitation
from app.schemas.bulk import BulkUpdateRequest, BulkUpdateResult
from app.schemas.user import (
    AdminPasswordReset,
    ApprovalActionRequest,
    PasswordResetRequestResponse,
    UserCreate,
    UserInviteCreate,
    UserResponse,
    UserUpdate,
)
from app.services.audit import log_audit
from app.services.bulk_update import bulk_update_users
from app.services.email import link_email, send_email

router = APIRouter(prefix="/users", tags=["users"])


async def _count_active_admins(db: AsyncSession, exclude_id: int | None = None) -> int:
    q = select(func.count()).select_from(User).where(
        User.role == UserRole.ADMIN, User.is_active.is_(True)
    )
    if exclude_id:
        q = q.where(User.id != exclude_id)
    result = await db.execute(q)
    return result.scalar_one()


@router.get("/engineers", response_model=list[UserResponse])
async def list_engineers(
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.BD, UserRole.ENGINEER)),
    db: AsyncSession = Depends(get_db),
):
    """Active engineers — accessible to BD/engineers for assignment & issue forms."""
    result = await db.execute(
        select(User).where(User.role == UserRole.ENGINEER, User.is_active.is_(True)).order_by(User.full_name)
    )
    return result.scalars().all()


@router.get("", response_model=list[UserResponse])
async def list_users(
    role: str | None = None,
    search: str | None = None,
    is_active: bool | None = None,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
):
    query = select(User)
    if role:
        query = query.where(User.role == role)
    if is_active is not None:
        query = query.where(User.is_active == is_active)
    if search and search.strip():
        # Token-based multi-field search: every token must match some field.
        for token in search.split():
            p = f"%{token}%"
            query = query.where(
                or_(
                    User.full_name.ilike(p),
                    User.email.ilike(p),
                    User.employee_id.ilike(p),
                    User.devsinc_id.ilike(p),
                    User.team_lead_name.ilike(p),
                    cast(User.role, String).ilike(p),
                )
            )
    result = await db.execute(query.order_by(User.full_name))
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
        manager_type=data.manager_type if data.role == UserRole.MANAGER else None,
        tenant_id=user.tenant_id,
        must_reset_password=True,
    )
    db.add(new_user)
    await log_audit(db, user.id, "create", "user", details=data.email)
    await db.commit()
    await db.refresh(new_user)
    return new_user


@router.post("/bulk-update", response_model=BulkUpdateResult)
async def bulk_update_users_endpoint(
    data: BulkUpdateRequest,
    user: User = Depends(require_roles(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    result = await bulk_update_users(db, data.ids, data.updates)
    await log_audit(db, user.id, "bulk_update", "user", details=f"ids={data.ids}")
    await db.commit()
    return result


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

    updates = data.model_dump(exclude_unset=True)

    if user_id == user.id:
        if updates.get("is_active") is False:
            raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
        if updates.get("role") and updates["role"] != UserRole.ADMIN:
            raise HTTPException(status_code=400, detail="You cannot change your own admin role")

    new_role = updates.get("role", target.role)
    if target.role == UserRole.ADMIN and new_role != UserRole.ADMIN:
        if await _count_active_admins(db, exclude_id=target.id) < 1:
            raise HTTPException(status_code=400, detail="Cannot remove the last active admin")

    if updates.get("is_active") is False and target.role == UserRole.ADMIN:
        if await _count_active_admins(db, exclude_id=target.id) < 1:
            raise HTTPException(status_code=400, detail="Cannot deactivate the last active admin")

    if "email" in updates and updates["email"] != target.email:
        existing = await db.execute(select(User).where(User.email == updates["email"]))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already exists")

    if "employee_id" in updates and updates["employee_id"] != target.employee_id:
        existing = await db.execute(select(User).where(User.employee_id == updates["employee_id"]))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Employee ID already exists")

    if new_role != UserRole.ENGINEER:
        updates["devsinc_id"] = None
    elif "devsinc_id" in updates and updates["devsinc_id"] is None and new_role == UserRole.ENGINEER:
        pass

    for field, value in updates.items():
        setattr(target, field, value)

    await log_audit(db, user.id, "update", "user", user_id, details=str(list(updates.keys())))
    await db.commit()
    await db.refresh(target)
    return target


@router.post("/{user_id}/reset-password", response_model=UserResponse)
async def reset_user_password(
    user_id: int,
    data: AdminPasswordReset,
    user: User = Depends(require_roles(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    target.password_hash = hash_password(data.new_password)
    target.must_reset_password = data.must_reset_password
    await log_audit(db, user.id, "reset_password", "user", user_id)
    await db.commit()
    await db.refresh(target)
    return target


@router.delete("/{user_id}", response_model=UserResponse)
async def deactivate_user(
    user_id: int,
    user: User = Depends(require_roles(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    if user_id == user.id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")

    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if target.role == UserRole.ADMIN and target.is_active:
        if await _count_active_admins(db, exclude_id=target.id) < 1:
            raise HTTPException(status_code=400, detail="Cannot deactivate the last active admin")

    target.is_active = False
    await log_audit(db, user.id, "deactivate", "user", user_id)
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
    data: ApprovalActionRequest | None = None,
    user: User = Depends(require_roles(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    target.approval_status = ApprovalStatus.APPROVED
    if data and data.comment is not None:
        target.approval_comment = data.comment
    await log_audit(db, user.id, "approve", "user", user_id, details=(data.comment if data else None))
    await db.commit()
    await db.refresh(target)
    return target


@router.post("/{user_id}/reject", response_model=UserResponse)
async def reject_user(
    user_id: int,
    data: ApprovalActionRequest | None = None,
    user: User = Depends(require_roles(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    target.approval_status = ApprovalStatus.REJECTED
    if data and data.comment is not None:
        target.approval_comment = data.comment
    await log_audit(db, user.id, "reject", "user", user_id, details=(data.comment if data else None))
    await db.commit()
    await db.refresh(target)
    return target


@router.get("/password-reset-requests", response_model=list[PasswordResetRequestResponse])
async def list_password_reset_requests(
    user: User = Depends(require_roles(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PasswordResetRequest)
        .where(PasswordResetRequest.status == ApprovalStatus.PENDING)
        .order_by(PasswordResetRequest.created_at.desc())
    )
    requests = result.scalars().all()
    out: list[PasswordResetRequestResponse] = []
    for req in requests:
        target = (await db.execute(select(User).where(User.id == req.user_id))).scalar_one_or_none()
        out.append(PasswordResetRequestResponse(
            id=req.id,
            user_id=req.user_id,
            email=req.email,
            full_name=target.full_name if target else None,
            role=target.role.value if target else None,
            status=req.status,
            admin_comment=req.admin_comment,
            created_at=req.created_at,
        ))
    return out


@router.post("/password-reset-requests/{request_id}/approve")
async def approve_password_reset(
    request_id: int,
    data: ApprovalActionRequest | None = None,
    user: User = Depends(require_roles(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    req = (await db.execute(select(PasswordResetRequest).where(PasswordResetRequest.id == request_id))).scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Reset request not found")
    if req.status != ApprovalStatus.PENDING:
        raise HTTPException(status_code=400, detail="Request already resolved")
    target = (await db.execute(select(User).where(User.id == req.user_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    token = secrets.token_urlsafe(32)
    db.add(AuthToken(
        user_id=target.id,
        purpose="password_reset",
        token=token,
        expires_at=datetime.now(timezone.utc) + timedelta(days=1),
    ))
    req.status = ApprovalStatus.APPROVED
    req.resolved_by_id = user.id
    req.resolved_at = datetime.now(timezone.utc)
    if data and data.comment is not None:
        req.admin_comment = data.comment
    await log_audit(db, user.id, "approve_reset", "password_reset_request", request_id)
    await db.commit()

    reset_url = f"{settings.frontend_url}/reset-password/{token}"
    sent = await send_email(
        target.email,
        "Your LeadPro password reset was approved",
        link_email(
            "Reset your password",
            f"Hi {target.full_name}, your password reset request was approved. "
            "Click below to choose a new password. This link expires in 24 hours.",
            "Set a new password",
            reset_url,
        ),
    )
    return {"message": "Reset request approved.", "reset_url": None if sent else reset_url}


@router.post("/password-reset-requests/{request_id}/reject")
async def reject_password_reset(
    request_id: int,
    data: ApprovalActionRequest | None = None,
    user: User = Depends(require_roles(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    req = (await db.execute(select(PasswordResetRequest).where(PasswordResetRequest.id == request_id))).scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Reset request not found")
    if req.status != ApprovalStatus.PENDING:
        raise HTTPException(status_code=400, detail="Request already resolved")
    target = (await db.execute(select(User).where(User.id == req.user_id))).scalar_one_or_none()
    req.status = ApprovalStatus.REJECTED
    req.resolved_by_id = user.id
    req.resolved_at = datetime.now(timezone.utc)
    if data and data.comment is not None:
        req.admin_comment = data.comment
    await log_audit(db, user.id, "reject_reset", "password_reset_request", request_id)
    await db.commit()
    if target:
        note = f" Note: {data.comment}" if data and data.comment else ""
        await send_email(
            target.email,
            "Your LeadPro password reset request",
            f"<p>Hi {target.full_name}, your password reset request was not approved.{note} "
            "Please contact your administrator if you need help.</p>",
        )
    return {"message": "Reset request rejected."}


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


@router.delete("/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_invitation(
    invitation_id: int,
    user: User = Depends(require_roles(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(UserInvitation).where(UserInvitation.id == invitation_id))
    invitation = result.scalar_one_or_none()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")
    await db.delete(invitation)
    await log_audit(db, user.id, "revoke_invite", "user_invitation", invitation_id)
    await db.commit()
