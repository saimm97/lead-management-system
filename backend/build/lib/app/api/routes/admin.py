from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.core.database import get_db
from app.core.enums import UserRole
from app.models.lead import LeadStatusConfig
from app.models.user import AuditLog, User
from app.schemas.lead import StatusConfigCreate, StatusConfigResponse
from app.services.audit import log_audit

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/status-config", response_model=list[StatusConfigResponse])
async def get_status_config(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(LeadStatusConfig).order_by(LeadStatusConfig.sort_order))
    return result.scalars().all()


@router.post("/status-config", response_model=StatusConfigResponse, status_code=201)
async def create_status_config(
    data: StatusConfigCreate,
    user: User = Depends(require_roles(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    config = LeadStatusConfig(**data.model_dump())
    db.add(config)
    await log_audit(db, user.id, "create", "status_config")
    await db.commit()
    await db.refresh(config)
    return config


@router.get("/audit-log")
async def get_audit_log(
    user: User = Depends(require_roles(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(200))
    logs = result.scalars().all()
    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "details": log.details,
            "created_at": log.created_at,
        }
        for log in logs
    ]
