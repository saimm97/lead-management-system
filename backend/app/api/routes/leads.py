from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.core.enums import UserRole
from app.models.lead import Lead, LeadStatusHistory, LeadStatusConfig, LeadDropdownOption
from app.models.profile import Profile
from app.models.user import User
from app.schemas.bulk import BulkUpdateRequest, BulkUpdateResult
from app.schemas.lead import (
    LeadAssign,
    LeadCreate,
    LeadResponse,
    LeadStatusHistoryResponse,
    LeadStatusUpdate,
    LeadUpdate,
    DropdownOptionCreate,
    DropdownOptionResponse,
    StatusConfigCreate,
    StatusConfigResponse,
)
from app.schemas.user import PaginatedResponse
from app.services.audit import log_audit
from app.services.bulk_update import bulk_update_leads
from app.services.tenant import get_default_cluster_head_id
from app.services.users import engineer_devsinc_id, engineer_name, get_user, staff_display_name

router = APIRouter(prefix="/leads", tags=["leads"])


def _can_modify_lead(user: User, lead: Lead) -> bool:
    if user.role in (UserRole.ADMIN, UserRole.MANAGER):
        return True
    if user.role == UserRole.BD:
        return lead.bd_id == user.id or lead.assigned_by_bd_id == user.id
    if user.role == UserRole.ENGINEER:
        return lead.assigned_engineer_id == user.id
    return False


async def _lead_to_response(db: AsyncSession, lead: Lead) -> LeadResponse:
    profile_name = None
    if lead.profile_id:
        result = await db.execute(select(Profile).where(Profile.id == lead.profile_id))
        p = result.scalar_one_or_none()
        profile_name = p.full_name if p else None
    engineer = await get_user(db, lead.assigned_engineer_id)
    cluster_head = await get_user(db, lead.cluster_head_id)
    return LeadResponse(
        id=lead.id,
        company=lead.company,
        job_title=lead.job_title,
        job_source=lead.job_source,
        technologies=lead.technologies or [],
        primary_tech=lead.primary_tech,
        jd_invite_sent=lead.jd_invite_sent,
        jd_invite_sent_at=lead.jd_invite_sent_at,
        achieved_at=lead.achieved_at,
        assigned_engineer_id=lead.assigned_engineer_id,
        assigned_engineer_name=engineer_name(engineer),
        assigned_engineer_devsinc_id=engineer_devsinc_id(engineer),
        cluster_head_id=lead.cluster_head_id,
        cluster_head_name=staff_display_name(cluster_head) if cluster_head else None,
        assigned_by_bd_id=lead.assigned_by_bd_id,
        assigned_by_bd_name=staff_display_name(await get_user(db, lead.assigned_by_bd_id)),
        profile_id=lead.profile_id,
        profile_name=profile_name,
        bd_id=lead.bd_id,
        bd_name=staff_display_name(await get_user(db, lead.bd_id)),
        phase=lead.phase,
        type=lead.type,
        status=lead.status,
        interview_number=lead.interview_number,
        interview_round=lead.interview_round,
        notes=lead.notes,
        created_at=lead.created_at,
        updated_at=lead.updated_at,
    )


async def _get_subordinate_ids(db: AsyncSession, manager_id: int) -> list[int]:
    result = await db.execute(select(User.id).where(User.manager_id == manager_id))
    return [row[0] for row in result.all()]


@router.get("/status-config", response_model=list[StatusConfigResponse])
async def list_status_config(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(LeadStatusConfig).order_by(LeadStatusConfig.sort_order))
    return result.scalars().all()


@router.post("/status-config", response_model=StatusConfigResponse, status_code=201)
async def create_status_config_entry(
    data: StatusConfigCreate,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.BD)),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(LeadStatusConfig).where(
            LeadStatusConfig.phase == data.phase,
            LeadStatusConfig.type == data.type,
            LeadStatusConfig.status == data.status,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Status combination already exists")
    config = LeadStatusConfig(**data.model_dump())
    db.add(config)
    await log_audit(db, user.id, "create", "status_config")
    await db.commit()
    await db.refresh(config)
    return config


@router.get("/dropdown-options", response_model=list[DropdownOptionResponse])
async def list_dropdown_options(
    category: str = Query(..., pattern="^(interview_number|interview_round)$"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LeadDropdownOption)
        .where(LeadDropdownOption.category == category)
        .order_by(LeadDropdownOption.sort_order)
    )
    return result.scalars().all()


@router.post("/dropdown-options", response_model=DropdownOptionResponse, status_code=201)
async def create_dropdown_option(
    data: DropdownOptionCreate,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.BD)),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(LeadDropdownOption).where(
            LeadDropdownOption.category == data.category,
            LeadDropdownOption.label == data.label,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Option already exists")
    max_order = (
        await db.execute(
            select(func.max(LeadDropdownOption.sort_order)).where(LeadDropdownOption.category == data.category)
        )
    ).scalar() or 0
    option = LeadDropdownOption(category=data.category, label=data.label, sort_order=max_order + 1)
    db.add(option)
    await log_audit(db, user.id, "create", "dropdown_option", details=data.label)
    await db.commit()
    await db.refresh(option)
    return option


@router.get("", response_model=PaginatedResponse[LeadResponse])
async def list_leads(
    scope: str = Query("my", pattern="^(my|subordinate|all)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    job_source: str | None = None,
    phase: str | None = None,
    type: str | None = None,
    status: str | None = None,
    primary_tech: str | None = None,
    interview_number: str | None = None,
    interview_round: str | None = None,
    company: str | None = None,
    assigned_engineer_id: int | None = None,
    bd_id: int | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Lead)
    if scope == "my":
        if user.role == UserRole.ENGINEER:
            query = query.where(Lead.assigned_engineer_id == user.id)
        elif user.role == UserRole.BD:
            query = query.where(or_(Lead.bd_id == user.id, Lead.assigned_by_bd_id == user.id))
        elif user.role in (UserRole.ADMIN, UserRole.MANAGER):
            pass
    elif scope == "subordinate":
        if user.role not in (UserRole.ADMIN, UserRole.MANAGER):
            raise HTTPException(status_code=403, detail="Not authorized")
        sub_ids = await _get_subordinate_ids(db, user.id)
        if user.role == UserRole.ADMIN:
            query = query.where(
                or_(Lead.assigned_engineer_id.in_(sub_ids), Lead.bd_id.in_(sub_ids))
            ) if sub_ids else query
        else:
            query = query.where(
                or_(Lead.assigned_engineer_id.in_(sub_ids), Lead.bd_id.in_(sub_ids))
            )
    if job_source:
        query = query.where(Lead.job_source == job_source)
    if phase:
        query = query.where(Lead.phase == phase)
    if type:
        query = query.where(Lead.type == type)
    if status:
        query = query.where(Lead.status.ilike(f"%{status}%"))
    if primary_tech:
        query = query.where(Lead.primary_tech.ilike(f"%{primary_tech}%"))
    if interview_number:
        query = query.where(Lead.interview_number == interview_number)
    if interview_round:
        query = query.where(Lead.interview_round == interview_round)
    if company:
        query = query.where(or_(Lead.company.ilike(f"%{company}%"), Lead.job_title.ilike(f"%{company}%")))
    if assigned_engineer_id:
        query = query.where(Lead.assigned_engineer_id == assigned_engineer_id)
    if bd_id:
        query = query.where(or_(Lead.bd_id == bd_id, Lead.assigned_by_bd_id == bd_id))

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    query = query.order_by(Lead.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    leads = result.scalars().all()
    items = [await _lead_to_response(db, lead) for lead in leads]
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size)


@router.post("/bulk-update", response_model=BulkUpdateResult)
async def bulk_update_leads_endpoint(
    data: BulkUpdateRequest,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.BD)),
    db: AsyncSession = Depends(get_db),
):
    result = await bulk_update_leads(db, data.ids, data.updates)
    await log_audit(db, user.id, "bulk_update", "lead", details=f"ids={data.ids}")
    await db.commit()
    return result


@router.post("", response_model=LeadResponse, status_code=201)
async def create_lead(
    data: LeadCreate,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.BD)),
    db: AsyncSession = Depends(get_db),
):
    cluster_head_id = data.cluster_head_id or await get_default_cluster_head_id(db, user.tenant_id)
    lead = Lead(**data.model_dump(exclude={"cluster_head_id"}), cluster_head_id=cluster_head_id, tenant_id=user.tenant_id)
    if user.role == UserRole.BD:
        lead.bd_id = user.id
        lead.assigned_by_bd_id = user.id
    db.add(lead)
    await log_audit(db, user.id, "create", "lead")
    await db.commit()
    await db.refresh(lead)
    return await _lead_to_response(db, lead)


@router.get("/{lead_id}", response_model=LeadResponse)
async def get_lead(lead_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return await _lead_to_response(db, lead)


@router.patch("/{lead_id}", response_model=LeadResponse)
async def update_lead(
    lead_id: int,
    data: LeadUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if not _can_modify_lead(user, lead):
        raise HTTPException(status_code=403, detail="Not authorized to update this lead")
    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "jd_invite_sent" and value:
            lead.jd_invite_sent_at = datetime.now(timezone.utc)
        setattr(lead, field, value)
    lead.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(lead)
    return await _lead_to_response(db, lead)


@router.patch("/{lead_id}/assign", response_model=LeadResponse)
async def assign_lead(
    lead_id: int,
    data: LeadAssign,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.BD)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(lead, field, value)
    if user.role == UserRole.BD and data.assigned_by_bd_id is None:
        lead.assigned_by_bd_id = user.id
    lead.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(lead)
    return await _lead_to_response(db, lead)


@router.patch("/{lead_id}/status", response_model=LeadResponse)
async def update_status(
    lead_id: int,
    data: LeadStatusUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if not _can_modify_lead(user, lead):
        raise HTTPException(status_code=403, detail="Not authorized to update this lead")
    history = LeadStatusHistory(
        lead_id=lead.id,
        changed_by_id=user.id,
        old_phase=lead.phase,
        old_type=lead.type,
        old_status=lead.status,
        new_phase=data.phase,
        new_type=data.type,
        new_status=data.status,
        note=data.note,
    )
    lead.phase = data.phase
    lead.type = data.type
    lead.status = data.status
    lead.interview_number = data.interview_number
    lead.interview_round = data.interview_round
    lead.updated_at = datetime.now(timezone.utc)
    db.add(history)
    await db.commit()
    await db.refresh(lead)
    return await _lead_to_response(db, lead)


@router.get("/{lead_id}/history", response_model=list[LeadStatusHistoryResponse])
async def get_history(lead_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(LeadStatusHistory).where(LeadStatusHistory.lead_id == lead_id).order_by(LeadStatusHistory.created_at.desc())
    )
    history = result.scalars().all()
    responses = []
    for h in history:
        changed_by = await get_user(db, h.changed_by_id)
        name = staff_display_name(changed_by) if changed_by and changed_by.role != UserRole.ENGINEER else engineer_name(changed_by)
        if changed_by and changed_by.role == UserRole.ENGINEER and engineer_devsinc_id(changed_by):
            name = f"{engineer_name(changed_by)} (Devsinc ID - {engineer_devsinc_id(changed_by)})"
        responses.append(
            LeadStatusHistoryResponse(
                id=h.id,
                changed_by_id=h.changed_by_id,
                changed_by_name=name,
                old_phase=h.old_phase,
                old_type=h.old_type,
                old_status=h.old_status,
                new_phase=h.new_phase,
                new_type=h.new_type,
                new_status=h.new_status,
                note=h.note,
                created_at=h.created_at,
            )
        )
    return responses
