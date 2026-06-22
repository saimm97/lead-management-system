"""Populate the database with dummy data:

* 84 engineers (from the uploaded team file) — emails @leadspro.com, password "leadpro"
* 60 BD accounts — bd1@leadspro.com .. bd60@leadspro.com, password "leadpro"
* 25,000 leads, each assigned to one engineer + one BD (round-robin, evenly spread)

Run standalone:   python -m app.seed_dummy
Idempotent: re-running won't duplicate users or pile on more than 25k seeded leads.
"""
import asyncio
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, insert, select

from app.core.database import AsyncSessionLocal
from app.core.enums import ManagerType, UserRole
from app.core.security import hash_password
from app.models.lead import Lead
from app.models.tenant import Tenant
from app.models.user import User
from app.seed_engineers import ENGINEERS

DUMMY_PASSWORD = "leadpro"
EMAIL_DOMAIN = "leadspro.com"
BD_COUNT = 60
LEAD_COUNT = 25_000
BATCH = 2_000

COMPANIES = [
    "BrightWave Tech", "DataFlow Inc", "CloudScale", "NimbusSoft", "QuantumLeap Labs",
    "Apex Systems", "Vertex Digital", "PixelForge", "CoreStack", "NorthBridge AI",
    "HelioWorks", "Stratus Cloud", "BluePeak Solutions", "Ironclad Software", "Lumen Analytics",
    "Meridian Labs", "Catalyst Tech", "Northstar Devs", "Orbit Systems", "Polaris Digital",
    "Riverstone Soft", "Summit Code", "Tidal Wave Tech", "Vantage AI", "Wavelength Labs",
    "Zenith Cloud", "Beacon Software", "Cedar Analytics", "Drift Digital", "Echo Systems",
]
TITLES = [
    "Senior Backend Engineer", "Full-Stack Developer", "React Front-End Engineer",
    "Python/Django Engineer", "Node.js Technical Lead", "AI/ML Engineer", "DevOps Engineer",
    "Ruby on Rails Developer", "Golang Backend Engineer", "Data Engineer",
    "MERN Stack Developer", "Platform Engineer", "Mobile Engineer (React Native)",
    "Cloud Engineer (AWS)", "Software Engineer II", "Staff Engineer",
]
SOURCES = ["Jobright", "Upwork", "sforcejobs", "LinkedIn", "Referral", "Cold Call"]
PRIMARY_TECH = ["MERN", "Python", "Ruby on Rails", "AI/ML", "Golang", "Java", "DevOps", ".NET"]
TECH_POOL = ["Node.js", "React", "MongoDB", "Python", "Django", "FastAPI", "AWS", "Docker",
             "Kubernetes", "PostgreSQL", "Ruby", "Rails", "Go", "TypeScript", "Next.js", "PyTorch"]
STATUS_COMBOS = [
    ("Applied", "JD Sent", "JD Invite Pending"),
    ("Applied", "JD Sent", "JD Invite Sent"),
    ("Screening", "BD Review", "1st Round"),
    ("Interview", "HR Interview", "Introductory HR"),
    ("Interview", "Technical Interview", "Technical Q&A"),
    ("Interview", "Client Interview", "1st Client Round"),
    ("Offer", "Offer Stage", "Offer Extended"),
    ("Offer", "Offer Stage", "Offer Accepted"),
    ("Closed", "Rejection", "Rejected by Client"),
    ("Closed", "Lost", "No Response"),
]


def _slugify_email(full_name: str, taken: set[str]) -> str:
    base = "".join(c if c.isalnum() or c == " " else "" for c in full_name).strip().lower()
    base = ".".join(part for part in base.split() if part) or "user"
    email = f"{base}@{EMAIL_DOMAIN}"
    n = 1
    while email in taken:
        n += 1
        email = f"{base}{n}@{EMAIL_DOMAIN}"
    taken.add(email)
    return email


async def _get_or_create_tenant(db) -> Tenant:
    tenant = (await db.execute(select(Tenant).where(Tenant.slug == "devsinc"))).scalar_one_or_none()
    if not tenant:
        tenant = Tenant(name="Devsinc", slug="devsinc")
        db.add(tenant)
        await db.flush()
    return tenant


async def _find_manager(db, mtype: ManagerType) -> User | None:
    """Find an existing manager by type in Python (the manager_type column is VARCHAR
    in some DBs, so filtering it in SQL would emit an invalid enum cast on Postgres)."""
    managers = (await db.execute(select(User).where(User.role == UserRole.MANAGER))).scalars().all()
    return next((m for m in managers if m.manager_type == mtype), None)


async def _get_or_create_manager(db, tenant_id, mtype: ManagerType, email: str, name: str, emp_id: str, pw_hash: str) -> User:
    mgr = await _find_manager(db, mtype)
    if mgr:
        return mgr
    mgr = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if mgr:
        return mgr
    mgr = User(
        email=email, password_hash=pw_hash, full_name=name,
        employee_id=emp_id, role=UserRole.MANAGER, manager_type=mtype, tenant_id=tenant_id,
    )
    db.add(mgr)
    await db.flush()
    return mgr


async def seed_dummy_data() -> dict:
    rng = random.Random(42)
    summary = {"engineers_created": 0, "bds_created": 0, "leads_created": 0}
    # All dummy accounts share the same password, so hash it once (bcrypt is intentionally slow).
    pw_hash = hash_password(DUMMY_PASSWORD)

    async with AsyncSessionLocal() as db:
        tenant = await _get_or_create_tenant(db)
        eng_manager = await _get_or_create_manager(
            db, tenant.id, ManagerType.ENGINEERING_MANAGER, "eng.manager@leadspro.com", "Engineering Manager", "EM900", pw_hash)
        bd_manager = await _get_or_create_manager(
            db, tenant.id, ManagerType.BD_MANAGER, "bd.manager.lp@leadspro.com", "BD Manager", "BM900", pw_hash)

        taken_emp = set((await db.execute(select(User.employee_id))).scalars().all())
        # Per-run set: guards only against slug collisions *within this run*, so the
        # generated email for each engineer is deterministic across runs (idempotent).
        used_emails: set[str] = set()

        # --- Engineers ---
        engineer_ids: list[int] = []
        emp_seq = 1000
        for full_name, lead_name in ENGINEERS:
            email = _slugify_email(full_name, used_emails)
            existing = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
            if existing:
                existing.team_lead_name = lead_name
                engineer_ids.append(existing.id)
                continue
            emp_seq += 1
            emp_id = f"ENG{emp_seq}"
            while emp_id in taken_emp:
                emp_seq += 1
                emp_id = f"ENG{emp_seq}"
            taken_emp.add(emp_id)
            eng = User(
                email=email, password_hash=pw_hash, full_name=full_name,
                employee_id=emp_id, devsinc_id=emp_id, role=UserRole.ENGINEER,
                manager_id=eng_manager.id, tenant_id=tenant.id, team_lead_name=lead_name,
            )
            db.add(eng)
            await db.flush()
            engineer_ids.append(eng.id)
            summary["engineers_created"] += 1

        # --- BD accounts bd1..bd60 ---
        bd_ids: list[int] = []
        for i in range(1, BD_COUNT + 1):
            email = f"bd{i}@{EMAIL_DOMAIN}"
            existing = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
            if existing:
                existing.team_lead_name = bd_manager.full_name
                bd_ids.append(existing.id)
                continue
            emp_id = f"BD{1000 + i}"
            while emp_id in taken_emp:
                emp_id = f"BD{1000 + i}X"
            taken_emp.add(emp_id)
            bd = User(
                email=email, password_hash=pw_hash, full_name=f"BD Executive {i}",
                employee_id=emp_id, role=UserRole.BD, manager_id=bd_manager.id,
                tenant_id=tenant.id, team_lead_name=bd_manager.full_name,
            )
            db.add(bd)
            await db.flush()
            bd_ids.append(bd.id)
            summary["bds_created"] += 1

        await db.commit()

    # --- 25,000 leads, evenly assigned to one engineer + one BD each ---
    async with AsyncSessionLocal() as db:
        tenant = await _get_or_create_tenant(db)
        eng_manager = await _find_manager(db, ManagerType.ENGINEERING_MANAGER)
        engineer_ids = list((await db.execute(
            select(User.id).where(User.role == UserRole.ENGINEER))).scalars().all())
        bd_ids = list((await db.execute(
            select(User.id).where(User.role == UserRole.BD, User.email.like(f"%@{EMAIL_DOMAIN}")))).scalars().all())

        existing_leads = (await db.execute(select(func.count()).select_from(Lead))).scalar() or 0
        to_create = max(0, LEAD_COUNT - existing_leads) if existing_leads < LEAD_COUNT else 0

        if to_create and engineer_ids and bd_ids:
            now = datetime.now(timezone.utc)
            cluster_head = eng_manager.id if eng_manager else None
            rows: list[dict] = []
            for i in range(to_create):
                eng_id = engineer_ids[i % len(engineer_ids)]
                bd_id = bd_ids[i % len(bd_ids)]
                phase, type_, status = rng.choice(STATUS_COMBOS)
                techs = rng.sample(TECH_POOL, rng.randint(1, 3))
                rows.append({
                    "tenant_id": tenant.id,
                    "company": rng.choice(COMPANIES),
                    "job_title": f"{rng.choice(TITLES)}",
                    "job_source": rng.choice(SOURCES),
                    "technologies": techs,
                    "primary_tech": rng.choice(PRIMARY_TECH),
                    "jd_invite_sent": status != "JD Invite Pending",
                    "assigned_engineer_id": eng_id,
                    "cluster_head_id": cluster_head,
                    "assigned_by_bd_id": bd_id,
                    "bd_id": bd_id,
                    "phase": phase,
                    "type": type_,
                    "status": status,
                    "created_at": now - timedelta(days=rng.randint(0, 180), minutes=rng.randint(0, 1440)),
                    "updated_at": now,
                })
                if len(rows) >= BATCH:
                    await db.execute(insert(Lead), rows)
                    await db.commit()
                    summary["leads_created"] += len(rows)
                    rows = []
            if rows:
                await db.execute(insert(Lead), rows)
                await db.commit()
                summary["leads_created"] += len(rows)

    return summary


async def _ensure_schema() -> None:
    """Create tables / add the team_lead_name column so the seed runs standalone."""
    from sqlalchemy import text
    from app.core.database import Base, engine
    import app.models.auth_token  # noqa: F401  (register all models)
    import app.models.calendar  # noqa: F401
    import app.models.issue  # noqa: F401
    import app.models.profile  # noqa: F401
    import app.models.tenant  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        try:
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS team_lead_name VARCHAR(255)"))
        except Exception:
            pass  # e.g. SQLite < 3.35 — create_all already added it for fresh tables


async def _main() -> None:
    await _ensure_schema()
    result = await seed_dummy_data()
    print("Dummy data seeded:", result)


if __name__ == "__main__":
    asyncio.run(_main())
