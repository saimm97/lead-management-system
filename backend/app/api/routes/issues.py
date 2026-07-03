from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.core.enums import IssueCategory, IssuePriority, IssueStatus, UserRole
from app.models.issue import Issue, IssueComment
from app.models.user import User
from app.schemas.bulk import BulkUpdateRequest, BulkUpdateResult
from app.schemas.issue import IssueCommentCreate, IssueCommentResponse, IssueCreate, IssueResponse, IssueUpdate
from app.services.audit import log_audit
from app.services.bulk_update import bulk_update_issues

router = APIRouter(prefix="/issues", tags=["issues"])


async def _user_name(db: AsyncSession, user_id: int | None) -> str | None:
    if not user_id:
        return None
    result = await db.execute(select(User).where(User.id == user_id))
    u = result.scalar_one_or_none()
    return f"{u.full_name} (ID - {u.employee_id})" if u else None


async def _issue_response(db: AsyncSession, issue: Issue) -> IssueResponse:
    comments = []
    for c in issue.comments or []:
        comments.append(
            IssueCommentResponse(
                id=c.id,
                issue_id=c.issue_id,
                author_id=c.author_id,
                author_name=await _user_name(db, c.author_id),
                body=c.body,
                created_at=c.created_at,
            )
        )
    return IssueResponse(
        id=issue.id,
        title=issue.title,
        description=issue.description,
        category=issue.category,
        priority=issue.priority,
        status=issue.status,
        reported_by_id=issue.reported_by_id,
        reported_by_name=await _user_name(db, issue.reported_by_id),
        reported_by_role=issue.reported_by_role,
        assigned_manager_id=issue.assigned_manager_id,
        assigned_manager_name=await _user_name(db, issue.assigned_manager_id),
        related_lead_id=issue.related_lead_id,
        related_profile_id=issue.related_profile_id,
        related_engineer_id=issue.related_engineer_id,
        related_engineer_name=await _user_name(db, issue.related_engineer_id),
        resolution_note=issue.resolution_note,
        created_at=issue.created_at,
        updated_at=issue.updated_at,
        resolved_at=issue.resolved_at,
        comments=comments,
    )


async def _get_subordinate_ids(db: AsyncSession, manager_id: int) -> list[int]:
    result = await db.execute(select(User.id).where(User.manager_id == manager_id))
    return [row[0] for row in result.all()]


@router.get("", response_model=list[IssueResponse])
async def list_issues(
    scope: str = Query("my", pattern="^(my|team|all)$"),
    status: str | None = None,
    priority: str | None = None,
    category: str | None = None,
    related_lead_id: int | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Issue).options(selectinload(Issue.comments))
    if related_lead_id is not None:
        query = query.where(Issue.related_lead_id == related_lead_id)
    elif scope == "my":
        query = query.where(Issue.reported_by_id == user.id)
    elif scope == "team":
        if user.role not in (UserRole.ADMIN, UserRole.MANAGER):
            raise HTTPException(status_code=403, detail="Not authorized")
        sub_ids = await _get_subordinate_ids(db, user.id)
        sub_ids.append(user.id)
        query = query.where(or_(Issue.reported_by_id.in_(sub_ids), Issue.assigned_manager_id == user.id))
    elif scope == "all" and user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    # Coerce the incoming value strings to enum members so the comparison works on
    # Postgres native enums (which are stored by NAME, not the lowercase value).
    if status:
        try:
            query = query.where(Issue.status == IssueStatus(status))
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid status: {status}")
    if priority:
        try:
            query = query.where(Issue.priority == IssuePriority(priority))
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid priority: {priority}")
    if category:
        try:
            query = query.where(Issue.category == IssueCategory(category))
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid category: {category}")
    result = await db.execute(query.order_by(Issue.created_at.desc()))
    issues = result.scalars().unique().all()
    return [await _issue_response(db, issue) for issue in issues]


@router.post("", response_model=IssueResponse, status_code=201)
async def create_issue(
    data: IssueCreate,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.BD, UserRole.ENGINEER)),
    db: AsyncSession = Depends(get_db),
):
    issue = Issue(
        **data.model_dump(),
        reported_by_id=user.id,
        reported_by_role=user.role.value,
    )
    db.add(issue)
    await log_audit(db, user.id, "create", "issue")
    await db.commit()
    result = await db.execute(
        select(Issue).options(selectinload(Issue.comments)).where(Issue.id == issue.id)
    )
    issue = result.scalar_one()
    return await _issue_response(db, issue)


@router.post("/bulk-update", response_model=BulkUpdateResult)
async def bulk_update_issues_endpoint(
    data: BulkUpdateRequest,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
):
    result = await bulk_update_issues(db, data.ids, data.updates)
    await log_audit(db, user.id, "bulk_update", "issue", details=f"ids={data.ids}")
    await db.commit()
    return result


@router.get("/{issue_id}", response_model=IssueResponse)
async def get_issue(issue_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Issue).options(selectinload(Issue.comments)).where(Issue.id == issue_id)
    )
    issue = result.scalar_one_or_none()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    return await _issue_response(db, issue)


@router.patch("/{issue_id}", response_model=IssueResponse)
async def update_issue(
    issue_id: int,
    data: IssueUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Issue).options(selectinload(Issue.comments)).where(Issue.id == issue_id)
    )
    issue = result.scalar_one_or_none()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    if user.role not in (UserRole.ADMIN, UserRole.MANAGER) and issue.reported_by_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(issue, field, value)
    if data.status in (IssueStatus.RESOLVED, IssueStatus.CLOSED):
        issue.resolved_at = datetime.now(timezone.utc)
    issue.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(issue)
    return await _issue_response(db, issue)


@router.post("/{issue_id}/comments", response_model=IssueCommentResponse, status_code=201)
async def add_comment(
    issue_id: int,
    data: IssueCommentCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Issue).where(Issue.id == issue_id))
    issue = result.scalar_one_or_none()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    comment = IssueComment(issue_id=issue_id, author_id=user.id, body=data.body)
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return IssueCommentResponse(
        id=comment.id,
        issue_id=comment.issue_id,
        author_id=comment.author_id,
        author_name=await _user_name(db, comment.author_id),
        body=comment.body,
        created_at=comment.created_at,
    )
