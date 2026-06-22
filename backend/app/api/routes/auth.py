import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
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
from app.models.auth_token import AuthToken, PasswordResetRequest
from app.models.user import User, UserInvitation
from app.schemas.user import (
    AcceptInviteRequest,
    BDRegisterRequest,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    RegisterResult,
    ResetPasswordRequest,
    TokenResponse,
    TokenValidation,
    UserResponse,
)
from app.services.audit import log_audit
from app.services.email import link_email, send_email

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


# Roles allowed to self-register (admins are provisioned internally only)
SELF_REGISTER_ROLES = {UserRole.BD, UserRole.ENGINEER, UserRole.MANAGER}


@router.post("/register", response_model=RegisterResult, status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    if data.role not in SELF_REGISTER_ROLES:
        raise HTTPException(status_code=400, detail="This role cannot self-register")
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
        devsinc_id=data.devsinc_id if data.role == UserRole.ENGINEER else None,
        role=data.role,
        approval_status=ApprovalStatus.PENDING,
    )
    db.add(user)
    await db.flush()  # assign user.id

    if data.method == "email":
        token = secrets.token_urlsafe(32)
        db.add(AuthToken(
            user_id=user.id,
            purpose="email_confirm",
            token=token,
            expires_at=datetime.now(timezone.utc) + timedelta(days=2),
        ))
        await db.commit()
        confirm_url = f"{settings.frontend_url}/confirm-email/{token}"
        sent = await send_email(
            user.email,
            "Confirm your LeadPro account",
            link_email(
                "Confirm your account",
                f"Hi {user.full_name}, please confirm your email to activate your LeadPro account.",
                "Confirm & sign in",
                confirm_url,
            ),
        )
        return RegisterResult(
            status="pending_confirmation",
            message="Check your email for a confirmation link to activate your account.",
            confirmation_url=None if sent else confirm_url,
        )

    await db.commit()
    return RegisterResult(
        status="pending_approval",
        message="Your account has been submitted and is awaiting admin approval.",
    )


@router.get("/confirm-email/{token}", response_model=TokenValidation)
async def check_email_token(token: str, db: AsyncSession = Depends(get_db)):
    record = await _valid_token(db, token, "email_confirm")
    if not record:
        return TokenValidation(valid=False)
    user = (await db.execute(select(User).where(User.id == record.user_id))).scalar_one_or_none()
    return TokenValidation(valid=True, email=user.email if user else None)


@router.post("/confirm-email/{token}", response_model=TokenResponse)
async def confirm_email(token: str, db: AsyncSession = Depends(get_db)):
    record = await _valid_token(db, token, "email_confirm")
    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired confirmation link")
    user = (await db.execute(select(User).where(User.id == record.user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Account not found")
    user.approval_status = ApprovalStatus.APPROVED
    record.used_at = datetime.now(timezone.utc)
    await log_audit(db, user.id, "confirm_email", "user", user.id)
    await db.commit()
    token_data = {"sub": str(user.id), "role": user.role.value}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


async def _valid_token(db: AsyncSession, token: str, purpose: str) -> AuthToken | None:
    result = await db.execute(
        select(AuthToken).where(AuthToken.token == token, AuthToken.purpose == purpose)
    )
    record = result.scalar_one_or_none()
    if not record or record.used_at is not None:
        return None
    expires = record.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        return None
    return record


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    generic = {"message": "If an account with that email exists, your reset request has been submitted for admin approval."}
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user:
        return generic
    # Avoid stacking duplicate pending requests.
    existing = await db.execute(
        select(PasswordResetRequest).where(
            PasswordResetRequest.user_id == user.id,
            PasswordResetRequest.status == ApprovalStatus.PENDING,
        )
    )
    if existing.scalar_one_or_none() is None:
        db.add(PasswordResetRequest(user_id=user.id, email=user.email, status=ApprovalStatus.PENDING))
        await log_audit(db, user.id, "forgot_password", "user", user.id)
        await db.commit()
    await send_email(
        user.email,
        "Password reset request received",
        f"<p>Hi {user.full_name}, we received a request to reset your LeadPro password. "
        "An administrator will review it shortly. You'll get another email with a secure link once it's approved.</p>",
    )
    return generic


@router.get("/reset-password/{token}", response_model=TokenValidation)
async def check_reset_token(token: str, db: AsyncSession = Depends(get_db)):
    record = await _valid_token(db, token, "password_reset")
    if not record:
        return TokenValidation(valid=False)
    user = (await db.execute(select(User).where(User.id == record.user_id))).scalar_one_or_none()
    return TokenValidation(valid=True, email=user.email if user else None)


@router.post("/reset-password/{token}")
async def reset_password(token: str, data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    record = await _valid_token(db, token, "password_reset")
    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    user = (await db.execute(select(User).where(User.id == record.user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Account not found")
    user.password_hash = hash_password(data.new_password)
    user.must_reset_password = False
    record.used_at = datetime.now(timezone.utc)
    await log_audit(db, user.id, "reset_password", "user", user.id)
    await db.commit()
    return {"message": "Your password has been updated. You can now sign in."}


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account deactivated")
    if user.approval_status == ApprovalStatus.PENDING:
        raise HTTPException(
            status_code=403,
            detail="Your account is awaiting admin approval. Please contact your administrator.",
        )
    if user.approval_status == ApprovalStatus.REJECTED:
        detail = "Your account request was declined. Please contact your administrator."
        if user.approval_comment:
            detail += f" Note: {user.approval_comment}"
        raise HTTPException(status_code=403, detail=detail)
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
async def get_me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    count = await db.execute(
        select(func.count()).select_from(User).where(User.manager_id == user.id)
    )
    user.has_subordinates = (count.scalar() or 0) > 0
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
