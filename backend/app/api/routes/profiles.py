import calendar
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.core.enums import UserRole
from app.models.lead import Lead
from app.models.profile import MonthlyTarget, Profile
from app.models.user import User
from app.schemas.bulk import BulkUpdateRequest, BulkUpdateResult
from app.schemas.profile import (
    MonthlyTargetCreate,
    MonthlyTargetResponse,
    MonthlyTargetSummary,
    MonthlyTargetUpdate,
    ProfileCreate,
    ProfileResponse,
    ProfileSummary,
    ProfileUpdate,
)
from app.services.audit import log_audit
from app.services.bulk_update import bulk_update_profiles, bulk_update_targets
from app.services.users import engineer_devsinc_id, engineer_name, get_user

profiles_router = APIRouter(prefix="/profiles", tags=["profiles"])
targets_router = APIRouter(prefix="/monthly-targets", tags=["monthly-targets"])


async def _profile_response(db: AsyncSession, profile: Profile) -> ProfileResponse:
    count = (
        await db.execute(select(func.count()).where(Lead.profile_id == profile.id))
    ).scalar() or 0
    engineer = await get_user(db, profile.assigned_engineer_id)
    return ProfileResponse(
        id=profile.id,
        full_name=profile.full_name,
        linkedin_url=profile.linkedin_url,
        linkedin_verified=profile.linkedin_verified,
        github_url=profile.github_url,
        github_present=profile.github_present,
        primary_tech_stack=profile.primary_tech_stack,
        assigned_engineer_id=profile.assigned_engineer_id,
        assigned_engineer_name=engineer_name(engineer),
        assigned_engineer_devsinc_id=engineer_devsinc_id(engineer),
        is_active=profile.is_active,
        linked_leads_count=count,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


@profiles_router.get("/summary", response_model=ProfileSummary)
async def profile_summary(
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
):
    total = (await db.execute(select(func.count()).select_from(Profile))).scalar() or 0
    active = (await db.execute(select(func.count()).where(Profile.is_active == True))).scalar() or 0
    in_use = (
        await db.execute(select(func.count(func.distinct(Lead.profile_id))).where(Lead.profile_id.isnot(None)))
    ).scalar() or 0
    linkedin_verified = (
        await db.execute(select(func.count()).where(Profile.linkedin_verified == True))
    ).scalar() or 0
    linkedin_unverified = (
        await db.execute(
            select(func.count()).where(and_(Profile.linkedin_url.isnot(None), Profile.linkedin_verified == False))
        )
    ).scalar() or 0
    linkedin_missing = (
        await db.execute(select(func.count()).where(Profile.linkedin_url.is_(None)))
    ).scalar() or 0
    github_present = (
        await db.execute(select(func.count()).where(Profile.github_present == True))
    ).scalar() or 0
    github_missing = total - github_present
    return ProfileSummary(
        total=total,
        active=active,
        in_use=in_use,
        linkedin_verified=linkedin_verified,
        linkedin_unverified=linkedin_unverified,
        linkedin_missing=linkedin_missing,
        github_present=github_present,
        github_missing=github_missing,
    )


@profiles_router.get("", response_model=list[ProfileResponse])
async def list_profiles(
    linkedin_verified: bool | None = None,
    github_present: bool | None = None,
    tech_stack: str | None = None,
    engineer_id: int | None = None,
    search: str | None = None,
    is_active: bool | None = None,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
):
    query = select(Profile)
    if is_active is None:
        query = query.where(Profile.is_active == True)
    elif is_active is not None:
        query = query.where(Profile.is_active == is_active)
    if linkedin_verified is not None:
        query = query.where(Profile.linkedin_verified == linkedin_verified)
    if github_present is not None:
        query = query.where(Profile.github_present == github_present)
    if tech_stack:
        query = query.where(Profile.primary_tech_stack.ilike(f"%{tech_stack}%"))
    if engineer_id:
        query = query.where(Profile.assigned_engineer_id == engineer_id)
    if search:
        pattern = f"%{search}%"
        query = query.where(Profile.full_name.ilike(pattern))
    result = await db.execute(query.order_by(Profile.full_name))
    profiles = result.scalars().all()
    return [await _profile_response(db, p) for p in profiles]


@profiles_router.post("/bulk-update", response_model=BulkUpdateResult)
async def bulk_update_profiles_endpoint(
    data: BulkUpdateRequest,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
):
    result = await bulk_update_profiles(db, data.ids, data.updates)
    await log_audit(db, user.id, "bulk_update", "profile", details=f"ids={data.ids}")
    await db.commit()
    return result


@profiles_router.post("", response_model=ProfileResponse, status_code=201)
async def create_profile(
    data: ProfileCreate,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
):
    profile = Profile(
        **data.model_dump(),
        github_present=bool(data.github_url),
        tenant_id=user.tenant_id,
    )
    db.add(profile)
    await log_audit(db, user.id, "create", "profile")
    await db.commit()
    await db.refresh(profile)
    return await _profile_response(db, profile)


@profiles_router.get("/{profile_id}", response_model=ProfileResponse)
async def get_profile(
    profile_id: int,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Profile).where(Profile.id == profile_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return await _profile_response(db, profile)


@profiles_router.patch("/{profile_id}", response_model=ProfileResponse)
async def update_profile(
    profile_id: int,
    data: ProfileUpdate,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Profile).where(Profile.id == profile_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    if "github_url" in data.model_dump(exclude_unset=True):
        profile.github_present = bool(profile.github_url)
    profile.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(profile)
    return await _profile_response(db, profile)


@profiles_router.patch("/{profile_id}/verify-linkedin", response_model=ProfileResponse)
async def verify_linkedin(
    profile_id: int,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Profile).where(Profile.id == profile_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    profile.linkedin_verified = not profile.linkedin_verified
    profile.verified_by_id = user.id if profile.linkedin_verified else None
    profile.verified_at = datetime.now(timezone.utc) if profile.linkedin_verified else None
    await db.commit()
    await db.refresh(profile)
    return await _profile_response(db, profile)


@profiles_router.get("/{profile_id}/leads")
async def profile_leads(
    profile_id: int,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Lead).where(Lead.profile_id == profile_id))
    return [{"id": l.id, "company": l.company, "job_title": l.job_title, "status": l.status} for l in result.scalars().all()]


async def _target_response(db: AsyncSession, target: MonthlyTarget) -> MonthlyTargetResponse:
    engineer = await get_user(db, target.engineer_id)
    start = target.target_start_date
    end = target.target_end_date or date(start.year, start.month, calendar.monthrange(start.year, start.month)[1])
    count_q = select(func.count()).where(
        and_(
            Lead.assigned_engineer_id == target.engineer_id,
            func.date(Lead.created_at) >= start,
            func.date(Lead.created_at) <= end,
        )
    )
    if target.tech_stack_focus:
        count_q = count_q.where(Lead.primary_tech == target.tech_stack_focus)
    assigned = (await db.execute(count_q)).scalar() or 0
    progress = (assigned / target.lead_target * 100) if target.lead_target else 0
    return MonthlyTargetResponse(
        id=target.id,
        target_start_date=target.target_start_date,
        target_end_date=target.target_end_date,
        engineer_id=target.engineer_id,
        engineer_name=engineer_name(engineer) or "Unknown",
        engineer_devsinc_id=engineer_devsinc_id(engineer),
        lead_target=target.lead_target,
        tech_stack_focus=target.tech_stack_focus,
        notes=target.notes,
        leads_assigned_count=assigned,
        progress_pct=round(progress, 1),
        created_by_id=target.created_by_id,
        created_at=target.created_at,
    )


@targets_router.get("/summary", response_model=MonthlyTargetSummary)
async def target_summary(
    month: str | None = None,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
):
    query = select(MonthlyTarget)
    if month:
        year, mon = map(int, month.split("-"))
        query = query.where(
            and_(
                MonthlyTarget.target_start_date >= date(year, mon, 1),
                MonthlyTarget.target_start_date <= date(year, mon, calendar.monthrange(year, mon)[1]),
            )
        )
    result = await db.execute(query)
    targets = result.scalars().all()
    responses = [await _target_response(db, t) for t in targets]
    total = len(responses)
    avg = sum(r.progress_pct for r in responses) / total if total else 0
    below = sum(1 for r in responses if r.progress_pct < 100)
    return MonthlyTargetSummary(total_targets=total, avg_completion_pct=round(avg, 1), engineers_below_quota=below)


@targets_router.get("", response_model=list[MonthlyTargetResponse])
async def list_targets(
    month: str | None = None,
    engineer_id: int | None = None,
    tech_stack: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(MonthlyTarget)
    if user.role == UserRole.ENGINEER:
        query = query.where(MonthlyTarget.engineer_id == user.id)
    elif user.role not in (UserRole.ADMIN, UserRole.MANAGER):
        raise HTTPException(status_code=403, detail="Not authorized")
    if month:
        year, mon = map(int, month.split("-"))
        query = query.where(
            and_(
                MonthlyTarget.target_start_date >= date(year, mon, 1),
                MonthlyTarget.target_start_date <= date(year, mon, calendar.monthrange(year, mon)[1]),
            )
        )
    if engineer_id:
        query = query.where(MonthlyTarget.engineer_id == engineer_id)
    if tech_stack:
        query = query.where(MonthlyTarget.tech_stack_focus == tech_stack)
    result = await db.execute(query.order_by(MonthlyTarget.target_start_date.desc()))
    return [await _target_response(db, t) for t in result.scalars().all()]


@targets_router.get("/me", response_model=list[MonthlyTargetResponse])
async def my_targets(user: User = Depends(require_roles(UserRole.ENGINEER)), db: AsyncSession = Depends(get_db)):
    today = date.today()
    result = await db.execute(
        select(MonthlyTarget).where(
            and_(
                MonthlyTarget.engineer_id == user.id,
                MonthlyTarget.target_start_date >= date(today.year, today.month, 1),
            )
        )
    )
    return [await _target_response(db, t) for t in result.scalars().all()]


@targets_router.post("", response_model=MonthlyTargetResponse, status_code=201)
async def create_target(
    data: MonthlyTargetCreate,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
):
    target = MonthlyTarget(**data.model_dump(), created_by_id=user.id)
    db.add(target)
    await log_audit(db, user.id, "create", "monthly_target")
    await db.commit()
    await db.refresh(target)
    return await _target_response(db, target)


@targets_router.patch("/{target_id}", response_model=MonthlyTargetResponse)
async def update_target(
    target_id: int,
    data: MonthlyTargetUpdate,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(MonthlyTarget).where(MonthlyTarget.id == target_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(target, field, value)
    await db.commit()
    await db.refresh(target)
    return await _target_response(db, target)


@targets_router.post("/bulk-update", response_model=BulkUpdateResult)
async def bulk_update_targets_endpoint(
    data: BulkUpdateRequest,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
):
    result = await bulk_update_targets(db, data.ids, data.updates)
    await log_audit(db, user.id, "bulk_update", "monthly_target", details=f"ids={data.ids}")
    await db.commit()
    return result


@targets_router.delete("/{target_id}", status_code=204)
async def delete_target(
    target_id: int,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(MonthlyTarget).where(MonthlyTarget.id == target_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    await db.delete(target)
    await db.commit()
