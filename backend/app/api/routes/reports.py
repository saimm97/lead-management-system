import json
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.core.database import get_db
from app.core.enums import IssueStatus, UserRole
from app.models.issue import Issue, ReportSnapshot
from app.models.lead import Lead
from app.models.profile import MonthlyTarget, Profile
from app.models.user import User
from app.schemas.report import DashboardKPIs, FunnelStage, MonthlyReportData, PipelineStage, RepPerformance, SourcePerformance, WeeklyReportData

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/dashboard/kpis", response_model=DashboardKPIs)
async def dashboard_kpis(
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.BD, UserRole.ENGINEER)),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    total = (await db.execute(select(func.count()).select_from(Lead))).scalar() or 0
    new_today = (
        await db.execute(select(func.count()).where(func.date(Lead.created_at) == today))
    ).scalar() or 0
    qualified = (
        await db.execute(select(func.count()).where(Lead.phase == "Interview"))
    ).scalar() or 0
    followups_due = (
        await db.execute(
            select(func.count()).where(and_(Lead.achieved_at.isnot(None), Lead.achieved_at <= today))
        )
    ).scalar() or 0
    followups_overdue = (
        await db.execute(
            select(func.count()).where(and_(Lead.achieved_at.isnot(None), Lead.achieved_at < today))
        )
    ).scalar() or 0
    landed = (
        await db.execute(select(func.count()).where(Lead.status.in_(["Offer Accepted", "Landed"])))
    ).scalar() or 0
    conversion = (landed / total * 100) if total else 0
    return DashboardKPIs(
        total_leads=total,
        new_today=new_today,
        qualified=qualified,
        followups_due=followups_due,
        followups_overdue=followups_overdue,
        conversion_rate=round(conversion, 1),
        revenue_pipeline=landed * 25000,
    )


@router.get("/dashboard/pipeline", response_model=list[PipelineStage])
async def dashboard_pipeline(db: AsyncSession = Depends(get_db)):
    phases = ["Applied", "Screening", "Interview", "Offer", "Closed"]
    stages = []
    for phase in phases:
        count = (await db.execute(select(func.count()).where(Lead.phase == phase))).scalar() or 0
        stages.append(PipelineStage(stage=phase, count=count))
    return stages


@router.get("/dashboard/sources", response_model=list[SourcePerformance])
async def dashboard_sources(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Lead.job_source, func.count()).group_by(Lead.job_source).order_by(func.count().desc())
    )
    return [SourcePerformance(source=row[0], count=row[1]) for row in result.all()]


@router.get("/dashboard/rep-performance", response_model=list[RepPerformance])
async def rep_performance(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User.full_name, User.devsinc_id, User.employee_id, func.count(Lead.id))
        .join(Lead, Lead.assigned_engineer_id == User.id)
        .group_by(User.full_name, User.devsinc_id, User.employee_id)
        .order_by(func.count(Lead.id).desc())
        .limit(10)
    )
    return [
        RepPerformance(name=row[0], devsinc_id=row[1] or row[2], count=row[3])
        for row in result.all()
    ]


@router.get("/dashboard/funnel", response_model=list[FunnelStage])
async def dashboard_funnel(db: AsyncSession = Depends(get_db)):
    stages = ["Applied", "Screening", "Interview", "Offer", "Landed"]
    funnel = []
    for stage in stages:
        if stage == "Landed":
            count = (await db.execute(select(func.count()).where(Lead.status == "Offer Accepted"))).scalar() or 0
        else:
            count = (await db.execute(select(func.count()).where(Lead.phase == stage))).scalar() or 0
        funnel.append(FunnelStage(stage=stage, count=count))
    return funnel


@router.get("/weekly", response_model=WeeklyReportData)
async def weekly_report(
    week: str | None = None,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
):
    end = date.today()
    start = end - timedelta(days=7)
    new_leads = (
        await db.execute(
            select(func.count()).where(and_(func.date(Lead.created_at) >= start, func.date(Lead.created_at) <= end))
        )
    ).scalar() or 0
    overdue = (
        await db.execute(select(func.count()).where(and_(Lead.achieved_at.isnot(None), Lead.achieved_at < date.today())))
    ).scalar() or 0
    open_issues = {}
    for priority in ["low", "medium", "high", "critical"]:
        count = (
            await db.execute(
                select(func.count()).where(and_(Issue.priority == priority, Issue.status == IssueStatus.OPEN))
            )
        ).scalar() or 0
        open_issues[priority] = count
    targets_result = await db.execute(select(MonthlyTarget))
    target_progress = []
    for t in targets_result.scalars().all():
        resp_engineer = await db.execute(select(User).where(User.id == t.engineer_id))
        eng = resp_engineer.scalar_one_or_none()
        target_progress.append({
            "engineer": eng.full_name if eng else "Unknown",
            "devsinc_id": (eng.devsinc_id or eng.employee_id) if eng else None,
            "target": t.lead_target,
            "tech": t.tech_stack_focus,
        })
    return WeeklyReportData(
        new_leads=new_leads,
        status_changes=[],
        overdue_followups=overdue,
        target_progress=target_progress,
        open_issues=open_issues,
    )


@router.get("/monthly", response_model=MonthlyReportData)
async def monthly_report(
    month: str | None = None,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
):
    outcomes = {
        "first_round": (await db.execute(select(func.count()).where(Lead.status == "1st Round"))).scalar() or 0,
        "landed": (await db.execute(select(func.count()).where(Lead.status == "Offer Accepted"))).scalar() or 0,
        "client_ghosted": (await db.execute(select(func.count()).where(Lead.status == "Client Ghosted"))).scalar() or 0,
        "wrong_lead": (await db.execute(select(func.count()).where(Lead.status == "Wrong Lead"))).scalar() or 0,
        "fake_company": (await db.execute(select(func.count()).where(Lead.status == "Fake Company"))).scalar() or 0,
        "rejection": (await db.execute(select(func.count()).where(Lead.phase == "Closed"))).scalar() or 0,
    }
    funnel_result = await dashboard_funnel(db)
    sources_result = await dashboard_sources(db)
    total_profiles = (await db.execute(select(func.count()).select_from(Profile))).scalar() or 0
    verified = (await db.execute(select(func.count()).where(Profile.linkedin_verified == True))).scalar() or 0
    github = (await db.execute(select(func.count()).where(Profile.github_present == True))).scalar() or 0
    open_issues = (await db.execute(select(func.count()).where(Issue.status == IssueStatus.OPEN))).scalar() or 0
    resolved = (await db.execute(select(func.count()).where(Issue.status == IssueStatus.RESOLVED))).scalar() or 0
    return MonthlyReportData(
        outcomes=outcomes,
        funnel=funnel_result,
        source_performance=sources_result,
        engineer_performance=[],
        profile_health={"total": total_profiles, "linkedin_verified": verified, "github_present": github},
        issues_summary={"open": open_issues, "resolved": resolved},
    )


@router.get("/resource-leads")
async def resource_leads(
    role: str = Query("all", pattern="^(all|engineer|bd)$"),
    search: str | None = None,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
):
    """Every BD and Engineer resource with their team lead and assigned-lead count."""
    eng_counts = dict(
        (await db.execute(
            select(Lead.assigned_engineer_id, func.count())
            .where(Lead.assigned_engineer_id.isnot(None))
            .group_by(Lead.assigned_engineer_id)
        )).all()
    )
    bd_counts = dict(
        (await db.execute(
            select(Lead.bd_id, func.count())
            .where(Lead.bd_id.isnot(None))
            .group_by(Lead.bd_id)
        )).all()
    )

    roles = [UserRole.ENGINEER, UserRole.BD]
    if role == "engineer":
        roles = [UserRole.ENGINEER]
    elif role == "bd":
        roles = [UserRole.BD]
    query = select(User).where(User.role.in_(roles))
    if search:
        pattern = f"%{search}%"
        query = query.where(or_(User.full_name.ilike(pattern), User.email.ilike(pattern)))
    query = query.order_by(User.role, User.full_name)
    users = (await db.execute(query)).scalars().all()

    out = []
    for u in users:
        count = eng_counts.get(u.id, 0) if u.role == UserRole.ENGINEER else bd_counts.get(u.id, 0)
        out.append({
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role.value,
            "devsinc_id": u.devsinc_id,
            "team_lead_name": u.team_lead_name,
            "lead_count": count,
        })
    return out


@router.get("/resource-leads/{user_id}")
async def resource_lead_names(
    user_id: int,
    limit: int = Query(500, ge=1, le=2000),
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
):
    """The lead names (company / job title) assigned to a single resource."""
    target = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not target:
        return {"resource": None, "total": 0, "leads": []}
    if target.role == UserRole.BD:
        condition = Lead.bd_id == user_id
    else:
        condition = Lead.assigned_engineer_id == user_id
    total = (await db.execute(select(func.count()).select_from(Lead).where(condition))).scalar() or 0
    rows = (await db.execute(
        select(Lead).where(condition).order_by(Lead.created_at.desc()).limit(limit)
    )).scalars().all()
    return {
        "resource": {
            "id": target.id,
            "full_name": target.full_name,
            "role": target.role.value,
            "team_lead_name": target.team_lead_name,
        },
        "total": total,
        "leads": [
            {
                "id": l.id,
                "company": l.company,
                "job_title": l.job_title,
                "phase": l.phase,
                "status": l.status,
            }
            for l in rows
        ],
    }


@router.post("/generate")
async def generate_report(
    user: User = Depends(require_roles(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    data = await monthly_report(user=user, db=db)
    snapshot = ReportSnapshot(
        report_type="monthly",
        period_start=datetime.now(timezone.utc) - timedelta(days=30),
        period_end=datetime.now(timezone.utc),
        generated_for_manager_id=user.id,
        payload_json=json.dumps(data.model_dump()),
    )
    db.add(snapshot)
    await db.commit()
    return {"status": "generated", "id": snapshot.id}
