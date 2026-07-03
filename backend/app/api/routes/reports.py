import json
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.core.database import get_db
from app.core.enums import IssueStatus, UserRole
from app.models.issue import Issue, ReportSnapshot
from app.models.lead import Lead, LeadStatusHistory
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


@router.get("/daily")
async def daily_report(
    date: str | None = Query(None, description="YYYY-MM-DD; defaults to today"),
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
):
    """Per-BD daily activity: leads applied that day, the platforms used, and each
    lead with the engineer it's assigned to."""
    from datetime import date as date_cls

    try:
        day = date_cls.fromisoformat(date) if date else date_cls.today()
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid date — use YYYY-MM-DD")

    leads = (await db.execute(
        select(Lead).where(func.date(Lead.created_at) == day).order_by(Lead.created_at.desc())
    )).scalars().all()

    # Resolve all referenced BDs and engineers in one query.
    user_ids: set[int] = set()
    for l in leads:
        for uid in (l.bd_id, l.assigned_by_bd_id, l.assigned_engineer_id):
            if uid:
                user_ids.add(uid)
    users_by_id: dict[int, User] = {}
    if user_ids:
        rows = (await db.execute(select(User).where(User.id.in_(user_ids)))).scalars().all()
        users_by_id = {u.id: u for u in rows}

    def _name(uid: int | None) -> str | None:
        u = users_by_id.get(uid) if uid else None
        return u.full_name if u else None

    # Group leads by their owning BD.
    groups: dict[int, list[Lead]] = {}
    for l in leads:
        bd_id = l.bd_id or l.assigned_by_bd_id
        if not bd_id:
            continue
        groups.setdefault(bd_id, []).append(l)

    report = []
    for bd_id, bd_leads in groups.items():
        platform_counts: dict[str, int] = {}
        lead_items = []
        for l in bd_leads:
            platform_counts[l.job_source] = platform_counts.get(l.job_source, 0) + 1
            lead_items.append({
                "id": l.id,
                "company": l.company,
                "job_title": l.job_title,
                "job_source": l.job_source,
                "status": l.status,
                "engineer_name": _name(l.assigned_engineer_id),
            })
        bd = users_by_id.get(bd_id)
        report.append({
            "bd_id": bd_id,
            "bd_name": bd.full_name if bd else f"BD #{bd_id}",
            "bd_employee_id": bd.employee_id if bd else None,
            "total_leads": len(bd_leads),
            "platforms": [
                {"source": s, "count": c}
                for s, c in sorted(platform_counts.items(), key=lambda kv: -kv[1])
            ],
            "leads": lead_items,
        })
    report.sort(key=lambda r: r["total_leads"], reverse=True)

    return {
        "date": day.isoformat(),
        "total_leads": len(leads),
        "active_bds": len(report),
        "bds": report,
    }


# Ordered progression phases (Closed is terminal, not a rank).
_PHASE_ORDER = ["Applied", "Screening", "Interview", "Offer"]
_LANDED_STATUSES = {"offer accepted", "landed", "hired"}
_SECOND_ROUND = {"2nd", "3rd", "4th", "5th", "final"}


def _lead_reached(lead: Lead, history: list[LeadStatusHistory]) -> tuple[set[str], bool]:
    """Returns (phases the lead provably reached, whether it hit a technical interview),
    combining status history with the current phase."""
    phases: set[str] = set()
    technical = False
    for h in history:
        for ph in (h.old_phase, h.new_phase):
            if ph:
                phases.add(ph)
        for ty in (h.old_type, h.new_type):
            if ty and "technical" in ty.lower():
                technical = True
    if lead.phase in _PHASE_ORDER:
        for ph in _PHASE_ORDER[: _PHASE_ORDER.index(lead.phase) + 1]:
            phases.add(ph)
    else:
        phases.add(lead.phase)
    if lead.type and "technical" in lead.type.lower():
        technical = True
    return phases, technical


def _is_landed(lead: Lead) -> bool:
    return (lead.status or "").strip().lower() in _LANDED_STATUSES


@router.get("/engineers")
async def engineer_report(
    start: str | None = Query(None, description="YYYY-MM-DD"),
    end: str | None = Query(None, description="YYYY-MM-DD"),
    search: str | None = None,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
):
    """Per-engineer performance funnel over a date range: leads taken and the share
    that reached each stage (screening, interview, technical, 2nd round, offer, landed)."""
    from datetime import date as date_cls, timedelta

    try:
        end_d = date_cls.fromisoformat(end) if end else date_cls.today()
        start_d = date_cls.fromisoformat(start) if start else (end_d - timedelta(days=30))
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid date — use YYYY-MM-DD")
    if start_d > end_d:
        start_d, end_d = end_d, start_d

    leads = (await db.execute(
        select(Lead).where(
            Lead.assigned_engineer_id.isnot(None),
            func.date(Lead.created_at) >= start_d,
            func.date(Lead.created_at) <= end_d,
        )
    )).scalars().all()

    # Status history for these leads (to know the furthest stage each one reached).
    lead_ids = [l.id for l in leads]
    history_by_lead: dict[int, list[LeadStatusHistory]] = {}
    if lead_ids:
        hrows = (await db.execute(
            select(LeadStatusHistory).where(LeadStatusHistory.lead_id.in_(lead_ids))
        )).scalars().all()
        for h in hrows:
            history_by_lead.setdefault(h.lead_id, []).append(h)

    # Aggregate per engineer.
    agg: dict[int, dict] = {}
    for l in leads:
        eid = l.assigned_engineer_id
        a = agg.setdefault(eid, {"total": 0, "screening": 0, "interview": 0, "technical": 0,
                                 "second_round": 0, "offer": 0, "landed": 0, "rejected": 0, "active": 0})
        phases, technical = _lead_reached(l, history_by_lead.get(l.id, []))
        a["total"] += 1
        if "Screening" in phases:
            a["screening"] += 1
        if "Interview" in phases:
            a["interview"] += 1
        if technical:
            a["technical"] += 1
        if (l.interview_number or "").strip().lower() in _SECOND_ROUND:
            a["second_round"] += 1
        if "Offer" in phases:
            a["offer"] += 1
        landed = _is_landed(l)
        if landed:
            a["landed"] += 1
        if l.phase == "Closed" and not landed:
            a["rejected"] += 1
        elif l.phase in _PHASE_ORDER and not landed:
            a["active"] += 1

    # Resolve engineer info.
    eng_rows = (await db.execute(select(User).where(User.id.in_(list(agg.keys()))))).scalars().all() if agg else []
    eng_by_id = {u.id: u for u in eng_rows}

    def pct(n: int, d: int) -> float:
        return round(n / d * 100, 1) if d else 0.0

    out = []
    for eid, a in agg.items():
        eng = eng_by_id.get(eid)
        if search and eng and search.lower() not in eng.full_name.lower():
            continue
        t = a["total"]
        out.append({
            "engineer_id": eid,
            "engineer_name": eng.full_name if eng else f"Engineer #{eid}",
            "devsinc_id": eng.devsinc_id if eng else None,
            "total_leads": t,
            "funnel": [
                {"stage": "Leads Taken", "count": t, "pct": 100.0},
                {"stage": "Screening", "count": a["screening"], "pct": pct(a["screening"], t)},
                {"stage": "Interview", "count": a["interview"], "pct": pct(a["interview"], t)},
                {"stage": "Technical Interview", "count": a["technical"], "pct": pct(a["technical"], t)},
                {"stage": "2nd Round+", "count": a["second_round"], "pct": pct(a["second_round"], t)},
                {"stage": "Offer", "count": a["offer"], "pct": pct(a["offer"], t)},
                {"stage": "Landed", "count": a["landed"], "pct": pct(a["landed"], t)},
            ],
            "conversion_rate": pct(a["landed"], t),
            "interview_rate": pct(a["interview"], t),
            "active": a["active"],
            "rejected": a["rejected"],
        })
    out.sort(key=lambda r: r["total_leads"], reverse=True)

    return {
        "start": start_d.isoformat(),
        "end": end_d.isoformat(),
        "total_leads": len(leads),
        "engineers": out,
    }


@router.get("/engineers/{engineer_id}")
async def engineer_report_detail(
    engineer_id: int,
    start: str | None = Query(None),
    end: str | None = Query(None),
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db),
):
    """Deep-dive for one engineer: overall funnel plus per-technology, per-platform,
    per-phase and per-status breakdowns over the date range."""
    from datetime import date as date_cls, timedelta

    try:
        end_d = date_cls.fromisoformat(end) if end else date_cls.today()
        start_d = date_cls.fromisoformat(start) if start else (end_d - timedelta(days=30))
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid date — use YYYY-MM-DD")
    if start_d > end_d:
        start_d, end_d = end_d, start_d

    eng = (await db.execute(select(User).where(User.id == engineer_id))).scalar_one_or_none()
    if not eng:
        raise HTTPException(status_code=404, detail="Engineer not found")

    leads = (await db.execute(
        select(Lead).where(
            Lead.assigned_engineer_id == engineer_id,
            func.date(Lead.created_at) >= start_d,
            func.date(Lead.created_at) <= end_d,
        )
    )).scalars().all()

    lead_ids = [l.id for l in leads]
    history_by_lead: dict[int, list[LeadStatusHistory]] = {}
    if lead_ids:
        for h in (await db.execute(
            select(LeadStatusHistory).where(LeadStatusHistory.lead_id.in_(lead_ids))
        )).scalars().all():
            history_by_lead.setdefault(h.lead_id, []).append(h)

    def pct(n: int, d: int) -> float:
        return round(n / d * 100, 1) if d else 0.0

    total = len(leads)
    tech: dict[str, dict] = {}
    platforms: dict[str, int] = {}
    phases: dict[str, int] = {}
    statuses: dict[str, int] = {}
    f = {"screening": 0, "interview": 0, "technical": 0, "second_round": 0, "offer": 0, "landed": 0, "rejected": 0, "active": 0}

    for l in leads:
        reached, technical = _lead_reached(l, history_by_lead.get(l.id, []))
        landed = _is_landed(l)
        platforms[l.job_source] = platforms.get(l.job_source, 0) + 1
        phases[l.phase] = phases.get(l.phase, 0) + 1
        statuses[l.status] = statuses.get(l.status, 0) + 1
        if "Screening" in reached:
            f["screening"] += 1
        if "Interview" in reached:
            f["interview"] += 1
        if technical:
            f["technical"] += 1
        if (l.interview_number or "").strip().lower() in _SECOND_ROUND:
            f["second_round"] += 1
        if "Offer" in reached:
            f["offer"] += 1
        if landed:
            f["landed"] += 1
        if l.phase == "Closed" and not landed:
            f["rejected"] += 1
        elif l.phase in _PHASE_ORDER and not landed:
            f["active"] += 1

        key = (l.primary_tech or "Unspecified").strip() or "Unspecified"
        t = tech.setdefault(key, {"total": 0, "interview": 0, "offer": 0, "landed": 0})
        t["total"] += 1
        if "Interview" in reached:
            t["interview"] += 1
        if "Offer" in reached:
            t["offer"] += 1
        if landed:
            t["landed"] += 1

    by_technology = sorted(
        (
            {
                "tech": k,
                "total": v["total"],
                "interview": v["interview"],
                "offer": v["offer"],
                "landed": v["landed"],
                "conversion_pct": pct(v["landed"], v["total"]),
            }
            for k, v in tech.items()
        ),
        key=lambda r: -r["total"],
    )

    return {
        "engineer": {"id": eng.id, "name": eng.full_name, "devsinc_id": eng.devsinc_id, "email": eng.email},
        "start": start_d.isoformat(),
        "end": end_d.isoformat(),
        "total_leads": total,
        "funnel": [
            {"stage": "Leads Taken", "count": total, "pct": 100.0},
            {"stage": "Screening", "count": f["screening"], "pct": pct(f["screening"], total)},
            {"stage": "Interview", "count": f["interview"], "pct": pct(f["interview"], total)},
            {"stage": "Technical Interview", "count": f["technical"], "pct": pct(f["technical"], total)},
            {"stage": "2nd Round+", "count": f["second_round"], "pct": pct(f["second_round"], total)},
            {"stage": "Offer", "count": f["offer"], "pct": pct(f["offer"], total)},
            {"stage": "Landed", "count": f["landed"], "pct": pct(f["landed"], total)},
        ],
        "conversion_rate": pct(f["landed"], total),
        "interview_rate": pct(f["interview"], total),
        "active": f["active"],
        "rejected": f["rejected"],
        "by_technology": by_technology,
        "by_platform": [{"source": s, "count": c} for s, c in sorted(platforms.items(), key=lambda kv: -kv[1])],
        "by_phase": [{"phase": p, "count": c} for p, c in sorted(phases.items(), key=lambda kv: -kv[1])],
        "by_status": [{"status": s, "count": c} for s, c in sorted(statuses.items(), key=lambda kv: -kv[1])],
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
