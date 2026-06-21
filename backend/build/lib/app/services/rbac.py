from app.core.enums import UserRole

ROLE_HIERARCHY = {
    UserRole.ADMIN: 4,
    UserRole.MANAGER: 3,
    UserRole.BD: 2,
    UserRole.ENGINEER: 1,
}


def has_role(user_role: UserRole, allowed: list[UserRole]) -> bool:
    return user_role in allowed


def can_manage_users(role: UserRole) -> bool:
    return role in (UserRole.ADMIN, UserRole.MANAGER)


def can_manage_targets(role: UserRole) -> bool:
    return role in (UserRole.ADMIN, UserRole.MANAGER)


def can_manage_profiles(role: UserRole) -> bool:
    return role in (UserRole.ADMIN, UserRole.MANAGER)


def can_view_all_leads(role: UserRole) -> bool:
    return role in (UserRole.ADMIN, UserRole.MANAGER)


def can_create_leads(role: UserRole) -> bool:
    return role in (UserRole.ADMIN, UserRole.MANAGER, UserRole.BD)


def can_triage_issues(role: UserRole) -> bool:
    return role in (UserRole.ADMIN, UserRole.MANAGER)


def can_log_issues(role: UserRole) -> bool:
    return role in (UserRole.ADMIN, UserRole.MANAGER, UserRole.BD, UserRole.ENGINEER)
