from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import ManagerType, UserRole
from app.models.tenant import Tenant
from app.models.user import User

DEFAULT_TENANT_SLUG = "devsinc"
DEFAULT_CLUSTER_HEAD_NAME = "Mahroz Khan"


async def get_default_tenant(db: AsyncSession) -> Tenant | None:
    result = await db.execute(select(Tenant).where(Tenant.slug == DEFAULT_TENANT_SLUG))
    return result.scalar_one_or_none()


async def get_default_cluster_head_id(db: AsyncSession, tenant_id: int | None = None) -> int | None:
    q = select(User).where(User.full_name == DEFAULT_CLUSTER_HEAD_NAME)
    if tenant_id:
        q = q.where(User.tenant_id == tenant_id)
    result = await db.execute(q)
    user = result.scalar_one_or_none()
    return user.id if user else None


def is_bd_manager(user: User) -> bool:
    return user.role == UserRole.MANAGER and user.manager_type == ManagerType.BD_MANAGER


def is_engineering_manager(user: User) -> bool:
    return user.role == UserRole.MANAGER and user.manager_type == ManagerType.ENGINEERING_MANAGER


def can_manage_team(user: User, member: User) -> bool:
    if user.role == UserRole.ADMIN:
        return True
    if member.manager_id != user.id:
        return False
    if is_bd_manager(user):
        return member.role == UserRole.BD
    if is_engineering_manager(user):
        return member.role == UserRole.ENGINEER
    return user.role == UserRole.MANAGER
