from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.core.database import get_db
from app.core.enums import UserRole
from app.models.lead import LeadStatusConfig
from app.models.user import AuditLog, User
from app.schemas.lead import StatusConfigCreate, StatusConfigResponse
from app.services.audit import log_audit
from app.services.import_excel import (
    build_template,
    import_leads_from_excel,
    import_profiles_from_excel,
    import_users_from_excel,
)

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


@router.get("/import/template/{entity}")
async def download_import_template(
    entity: str,
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    if entity not in {"leads", "profiles", "users"}:
        raise HTTPException(status_code=400, detail="Entity must be leads, profiles, or users")
    content = build_template(entity)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{entity}_template.xlsx"'},
    )


@router.post("/import/{entity}")
async def import_from_excel(
    entity: str,
    file: UploadFile = File(...),
    user: User = Depends(require_roles(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    if entity not in {"leads", "profiles", "users"}:
        raise HTTPException(status_code=400, detail="Entity must be leads, profiles, or users")

    filename = (file.filename or "").lower()
    if not filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Upload an Excel file (.xlsx)")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="File is empty")

    if entity == "leads":
        result = await import_leads_from_excel(content, db, user.id, user.tenant_id)
    elif entity == "profiles":
        result = await import_profiles_from_excel(content, db, user.tenant_id)
    else:
        result = await import_users_from_excel(content, db, user.tenant_id, user)

    await log_audit(db, user.id, "import", entity, details=f"created={result['created']}, skipped={result['skipped']}")
    await db.commit()
    return result
