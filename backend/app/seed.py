from sqlalchemy import func, select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.enums import ManagerType, UserRole
from app.core.security import hash_password
from app.models.lead import Lead, LeadStatusConfig, LeadDropdownOption
from app.models.profile import Profile
from app.models.tenant import Tenant
from app.models.user import User

STATUS_SEED = [
    ("Applied", "JD Sent", "JD Invite Sent", False, None, 1),
    ("Applied", "JD Sent", "JD Invite Pending", False, None, 2),
    ("Screening", "BD Review", "1st Round", False, "first_round", 3),
    ("Screening", "BD Review", "Wrong Lead", True, "wrong_lead", 4),
    ("Screening", "BD Review", "Fake Company", True, "fake_company", 5),
    ("Interview", "HR Interview", "Introductory HR", False, None, 6),
    ("Interview", "HR Interview", "HR Round Scheduled", False, None, 7),
    ("Interview", "Technical Interview", "Technical Q&A", False, None, 8),
    ("Interview", "Technical Interview", "Technical Assessment", False, None, 9),
    ("Interview", "Client Interview", "1st Client Round", False, None, 10),
    ("Interview", "Client Interview", "Final Round", False, None, 11),
    ("Offer", "Offer Stage", "Offer Extended", False, None, 12),
    ("Offer", "Offer Stage", "Offer Accepted", True, "landed", 13),
    ("Closed", "Rejection", "Rejected by Client", True, "rejection", 14),
    ("Closed", "Rejection", "Rejected by Candidate", True, "rejection", 15),
    ("Closed", "Lost", "Client Ghosted", True, "client_ghosted", 16),
    ("Closed", "Lost", "No Response", True, "client_ghosted", 17),
    ("Closed", "Lost", "Wrong Lead", True, "wrong_lead", 18),
    ("Closed", "Lost", "Fake Company", True, "fake_company", 19),
]


DROPDOWN_SEED = {
    "interview_number": ["1st", "2nd", "3rd", "4th", "5th", "Final"],
    "interview_round": [
        "HR Round",
        "Technical Round",
        "Test Project",
        "Offer",
        "Culture Fit",
        "CTO Meeting",
        "Pair Programming",
        "Client Round",
        "Manager Round",
        "System Design",
    ],
    "lead_issue_type": [
        "No Show",
        "Onsite Lead",
        "JD Mismatch",
        "Fake Company",
        "Drugs Lead",
        "Betting App Lead",
    ],
    "job_source": [
        "Jobright",
        "Upwork",
        "sforcejobs",
        "LinkedIn",
        "Referral",
        "Cold Call",
    ],
}


async def seed_database():
    async with AsyncSessionLocal() as db:
        tenant_result = await db.execute(select(Tenant).where(Tenant.slug == "devsinc"))
        tenant = tenant_result.scalar_one_or_none()
        if not tenant:
            tenant = Tenant(name="Devsinc", slug="devsinc")
            db.add(tenant)
            await db.flush()

        result = await db.execute(select(User).where(User.email == settings.admin_email))
        if not result.scalar_one_or_none():
            admin = User(
                email=settings.admin_email,
                password_hash=hash_password(settings.admin_password),
                full_name=settings.admin_name,
                employee_id="1",
                role=UserRole.ADMIN,
                tenant_id=tenant.id,
            )
            db.add(admin)
            await db.flush()

            eng_manager = User(
                email="mahroz.khan@devsinc.com",
                password_hash=hash_password("manager123"),
                full_name="Mahroz Khan",
                employee_id="M100",
                role=UserRole.MANAGER,
                manager_type=ManagerType.ENGINEERING_MANAGER,
                tenant_id=tenant.id,
            )
            bd_manager = User(
                email="bd.manager@devsinc.com",
                password_hash=hash_password("manager123"),
                full_name="Sarah BD Manager",
                employee_id="M200",
                role=UserRole.MANAGER,
                manager_type=ManagerType.BD_MANAGER,
                tenant_id=tenant.id,
            )
            db.add_all([eng_manager, bd_manager])
            await db.flush()

            bd = User(
                email="bd@leadpro.com",
                password_hash=hash_password("bd123456"),
                full_name="Shehryar Shahid",
                employee_id="2106",
                role=UserRole.BD,
                manager_id=bd_manager.id,
                tenant_id=tenant.id,
            )
            engineer = User(
                email="engineer@leadpro.com",
                password_hash=hash_password("engineer123"),
                full_name="Muhammad Saim Malik",
                employee_id="411",
                devsinc_id="411",
                role=UserRole.ENGINEER,
                manager_id=eng_manager.id,
                tenant_id=tenant.id,
            )
            db.add_all([bd, engineer])
            await db.flush()

            config_result = await db.execute(select(LeadStatusConfig).limit(1))
            if not config_result.scalar_one_or_none():
                for phase, type_, status, terminal, bucket, order in STATUS_SEED:
                    db.add(
                        LeadStatusConfig(
                            phase=phase, type=type_, status=status,
                            is_terminal=terminal, report_bucket=bucket, sort_order=order,
                        )
                    )

            dropdown_result = await db.execute(select(LeadDropdownOption).limit(1))
            if not dropdown_result.scalar_one_or_none():
                order = 0
                for category, labels in DROPDOWN_SEED.items():
                    for label in labels:
                        order += 1
                        db.add(LeadDropdownOption(category=category, label=label, sort_order=order))

            profile_result = await db.execute(select(Profile).limit(1))
            if not profile_result.scalar_one_or_none():
                profiles = [
                    Profile(tenant_id=tenant.id, full_name="Harry Ahmad", linkedin_url="https://linkedin.com/in/harry", linkedin_verified=True, github_url="https://github.com/harry", github_present=True, primary_tech_stack="MERN", assigned_engineer_id=engineer.id),
                    Profile(tenant_id=tenant.id, full_name="Sherris Aiden", linkedin_url="https://linkedin.com/in/sherris", linkedin_verified=False, github_present=False, primary_tech_stack="Python", assigned_engineer_id=engineer.id),
                    Profile(tenant_id=tenant.id, full_name="John Doe", linkedin_url=None, linkedin_verified=False, github_url="https://github.com/johndoe", github_present=True, primary_tech_stack="Ruby on Rails"),
                ]
                db.add_all(profiles)
                await db.flush()

                leads = [
                    Lead(tenant_id=tenant.id, company="BrightWave Tech", job_title="Technical Lead - Node.js", job_source="Jobright", technologies=["Node.js", "React", "MongoDB"], primary_tech="MERN", assigned_engineer_id=engineer.id, cluster_head_id=eng_manager.id, assigned_by_bd_id=bd.id, bd_id=bd.id, profile_id=profiles[0].id, phase="Interview", type="HR Interview", status="Introductory HR"),
                    Lead(tenant_id=tenant.id, company="DataFlow Inc", job_title="Senior Backend Engineer (Django)", job_source="sforcejobs", technologies=["Python", "Django"], primary_tech="Python", assigned_engineer_id=engineer.id, cluster_head_id=eng_manager.id, assigned_by_bd_id=bd.id, bd_id=bd.id, profile_id=profiles[1].id, phase="Interview", type="Technical Interview", status="Technical Q&A"),
                    Lead(tenant_id=tenant.id, company="CloudScale", job_title="Back-End Python Engineer", job_source="Upwork", technologies=["Python"], primary_tech="Python", assigned_engineer_id=engineer.id, cluster_head_id=eng_manager.id, bd_id=bd.id, phase="Applied", type="JD Sent", status="JD Invite Pending"),
                ]
                db.add_all(leads)

        await db.commit()

    async with AsyncSessionLocal() as db:
        tenant_result = await db.execute(select(Tenant).where(Tenant.slug == "devsinc"))
        tenant = tenant_result.scalar_one_or_none()
        if tenant:
            users = await db.execute(select(User).where(User.tenant_id.is_(None)))
            for u in users.scalars().all():
                u.tenant_id = tenant.id
            leads = await db.execute(select(Lead).where(Lead.tenant_id.is_(None)))
            for l in leads.scalars().all():
                l.tenant_id = tenant.id
            profiles = await db.execute(select(Profile).where(Profile.tenant_id.is_(None)))
            for p in profiles.scalars().all():
                p.tenant_id = tenant.id

            mahroz = await db.execute(select(User).where(User.full_name == "Mahroz Khan"))
            mahroz_user = mahroz.scalar_one_or_none()
            if mahroz_user:
                leads_no_head = await db.execute(select(Lead).where(Lead.cluster_head_id.is_(None)))
                for l in leads_no_head.scalars().all():
                    l.cluster_head_id = mahroz_user.id

        engineers = await db.execute(select(User).where(User.role == UserRole.ENGINEER))
        for eng in engineers.scalars().all():
            if not eng.devsinc_id:
                eng.devsinc_id = eng.employee_id
        await db.commit()

    async with AsyncSessionLocal() as db:
        for category, labels in DROPDOWN_SEED.items():
            existing = await db.execute(
                select(LeadDropdownOption).where(LeadDropdownOption.category == category).limit(1)
            )
            if existing.scalar_one_or_none():
                continue
            max_order = (
                await db.execute(select(func.max(LeadDropdownOption.sort_order)))
            ).scalar() or 0
            for label in labels:
                max_order += 1
                db.add(LeadDropdownOption(category=category, label=label, sort_order=max_order))
        await db.commit()
