from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.issue import Issue
from app.core.enums import IssueStatus
from app.models.issue import Issue
from app.models.lead import Lead
from app.models.profile import MonthlyTarget, Profile
from app.models.user import User
from app.schemas.bulk import BulkUpdateResult

ALLOWED_LEAD_FIELDS = {
    "phase", "type", "status", "interview_number", "interview_round",
    "assigned_engineer_id", "cluster_head_id",
    "bd_id", "primary_tech", "job_source", "notes", "profile_id", "company", "job_title",
}
ALLOWED_PROFILE_FIELDS = {
    "full_name", "linkedin_url", "github_url", "primary_tech_stack",
    "assigned_engineer_id", "is_active", "linkedin_verified",
}
ALLOWED_ISSUE_FIELDS = {"status", "priority", "category", "assigned_manager_id"}
ALLOWED_USER_FIELDS = {"role", "manager_id", "is_active", "devsinc_id", "manager_type", "full_name"}
ALLOWED_TARGET_FIELDS = {"lead_target", "tech_stack_focus", "notes", "engineer_id"}


async def bulk_update_leads(db: AsyncSession, ids: list[int], updates: dict) -> BulkUpdateResult:
    allowed = {k: v for k, v in updates.items() if k in ALLOWED_LEAD_FIELDS}
    updated = failed = 0
    errors: list[str] = []
    for lid in ids:
        result = await db.execute(select(Lead).where(Lead.id == lid))
        lead = result.scalar_one_or_none()
        if not lead:
            failed += 1
            errors.append(f"Lead #{lid} not found")
            continue
        for field, value in allowed.items():
            setattr(lead, field, value)
        lead.updated_at = datetime.now(timezone.utc)
        updated += 1
    await db.flush()
    return BulkUpdateResult(updated=updated, failed=failed, errors=errors)


async def bulk_update_profiles(db: AsyncSession, ids: list[int], updates: dict) -> BulkUpdateResult:
    allowed = {k: v for k, v in updates.items() if k in ALLOWED_PROFILE_FIELDS}
    updated = failed = 0
    errors: list[str] = []
    for pid in ids:
        result = await db.execute(select(Profile).where(Profile.id == pid))
        profile = result.scalar_one_or_none()
        if not profile:
            failed += 1
            errors.append(f"Profile #{pid} not found")
            continue
        for field, value in allowed.items():
            if field == "github_url":
                profile.github_present = bool(value)
            setattr(profile, field, value)
        profile.updated_at = datetime.now(timezone.utc)
        updated += 1
    await db.flush()
    return BulkUpdateResult(updated=updated, failed=failed, errors=errors)


async def bulk_update_users(db: AsyncSession, ids: list[int], updates: dict) -> BulkUpdateResult:
    allowed = {k: v for k, v in updates.items() if k in ALLOWED_USER_FIELDS}
    updated = failed = 0
    errors: list[str] = []
    for uid in ids:
        result = await db.execute(select(User).where(User.id == uid))
        user = result.scalar_one_or_none()
        if not user:
            failed += 1
            errors.append(f"User #{uid} not found")
            continue
        for field, value in allowed.items():
            setattr(user, field, value)
        updated += 1
    await db.flush()
    return BulkUpdateResult(updated=updated, failed=failed, errors=errors)


async def bulk_update_targets(db: AsyncSession, ids: list[int], updates: dict) -> BulkUpdateResult:
    allowed = {k: v for k, v in updates.items() if k in ALLOWED_TARGET_FIELDS}
    updated = failed = 0
    errors: list[str] = []
    for tid in ids:
        result = await db.execute(select(MonthlyTarget).where(MonthlyTarget.id == tid))
        target = result.scalar_one_or_none()
        if not target:
            failed += 1
            errors.append(f"Target #{tid} not found")
            continue
        for field, value in allowed.items():
            setattr(target, field, value)
        updated += 1
    await db.flush()
    return BulkUpdateResult(updated=updated, failed=failed, errors=errors)


async def bulk_update_issues(db: AsyncSession, ids: list[int], updates: dict) -> BulkUpdateResult:
    allowed = {k: v for k, v in updates.items() if k in ALLOWED_ISSUE_FIELDS}
    updated = failed = 0
    errors: list[str] = []
    for iid in ids:
        result = await db.execute(select(Issue).where(Issue.id == iid))
        issue = result.scalar_one_or_none()
        if not issue:
            failed += 1
            errors.append(f"Issue #{iid} not found")
            continue
        for field, value in allowed.items():
            setattr(issue, field, value)
        if "status" in allowed and allowed["status"] in (IssueStatus.RESOLVED.value, IssueStatus.CLOSED.value):
            issue.resolved_at = datetime.now(timezone.utc)
        issue.updated_at = datetime.now(timezone.utc)
        updated += 1
    await db.flush()
    return BulkUpdateResult(updated=updated, failed=failed, errors=errors)
