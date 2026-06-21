from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.enums import UserRole
from app.models.user import User


async def get_user(db: AsyncSession, user_id: int | None) -> User | None:
    if not user_id:
        return None
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


def engineer_name(user: User | None) -> str | None:
    return user.full_name if user else None


def engineer_devsinc_id(user: User | None) -> str | None:
    if not user or user.role != UserRole.ENGINEER:
        return None
    return user.devsinc_id or user.employee_id


def staff_display_name(user: User | None) -> str | None:
    """Display name for BD, managers, admins — uses employee ID."""
    if not user:
        return None
    return f"{user.full_name} (ID - {user.employee_id})"
