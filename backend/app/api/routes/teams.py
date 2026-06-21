from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.core.enums import ManagerType, UserRole
from app.models.user import User
from app.schemas.user import UserResponse
from app.services.import_excel import import_leads_from_excel, import_profiles_from_excel, import_users_from_excel
from app.services.tenant import can_manage_team, is_bd_manager, is_engineering_manager

router = APIRouter(prefix="/teams", tags=["teams"])


def _team_member_response(u: User) -> dict:
    return {
        "id": u.id,
        "full_name": u.full_name,
        "email": u.email,
        "employee_id": u.employee_id,
        "devsinc_id": u.devsinc_id,
        "role": u.role.value,
        "manager_id": u.manager_id,
        "is_active": u.is_active,
    }


@router.get("/engineering", response_model=list[UserResponse])
async def engineering_team(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role not in (UserRole.ADMIN,) and not is_engineering_manager(user):
        raise HTTPException(status_code=403, detail="Engineering managers only")

    q = select(User).where(User.role == UserRole.ENGINEER, User.is_active.is_(True))
    if user.role != UserRole.ADMIN:
        q = q.where(User.manager_id == user.id)
    elif user.tenant_id:
        q = q.where(User.tenant_id == user.tenant_id)

    result = await db.execute(q.order_by(User.full_name))
    return result.scalars().all()


@router.get("/bd", response_model=list[UserResponse])
async def bd_team(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role not in (UserRole.ADMIN,) and not is_bd_manager(user):
        raise HTTPException(status_code=403, detail="BD managers only")

    q = select(User).where(User.role == UserRole.BD, User.is_active.is_(True))
    if user.role != UserRole.ADMIN:
        q = q.where(User.manager_id == user.id)
    elif user.tenant_id:
        q = q.where(User.tenant_id == user.tenant_id)

    result = await db.execute(q.order_by(User.full_name))
    return result.scalars().all()


@router.get("/my")
async def my_team_summary(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role == UserRole.ADMIN:
        eng = await db.execute(select(User).where(User.role == UserRole.ENGINEER, User.is_active.is_(True)))
        bd = await db.execute(select(User).where(User.role == UserRole.BD, User.is_active.is_(True)))
        return {
            "manager_type": "admin",
            "engineering_team": [_team_member_response(u) for u in eng.scalars().all()],
            "bd_team": [_team_member_response(u) for u in bd.scalars().all()],
        }

    if is_engineering_manager(user):
        result = await db.execute(
            select(User).where(User.manager_id == user.id, User.role == UserRole.ENGINEER).order_by(User.full_name)
        )
        return {"manager_type": "engineering_manager", "team": [_team_member_response(u) for u in result.scalars().all()]}

    if is_bd_manager(user):
        result = await db.execute(
            select(User).where(User.manager_id == user.id, User.role == UserRole.BD).order_by(User.full_name)
        )
        return {"manager_type": "bd_manager", "team": [_team_member_response(u) for u in result.scalars().all()]}

    raise HTTPException(status_code=403, detail="Not a team manager")


@router.post("/import/{entity}")
async def team_import(
    entity: str,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role not in (UserRole.ADMIN, UserRole.MANAGER):
        raise HTTPException(status_code=403, detail="Managers only")

    if entity == "users" and is_bd_manager(user):
        pass
    elif entity == "users" and is_engineering_manager(user):
        pass
    elif entity in ("leads", "profiles") and user.role in (UserRole.ADMIN, UserRole.MANAGER):
        pass
    elif user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized for this import")

    content = await file.read()
    if entity == "leads":
        result = await import_leads_from_excel(content, db, user.id, user.tenant_id)
    elif entity == "profiles":
        result = await import_profiles_from_excel(content, db, user.tenant_id)
    elif entity == "users":
        result = await import_users_from_excel(content, db, user.tenant_id, user)
    else:
        raise HTTPException(status_code=400, detail="Entity must be leads, profiles, or users")

    await db.commit()
    return result
