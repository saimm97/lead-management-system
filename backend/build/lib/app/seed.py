from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.enums import UserRole
from app.core.security import hash_password
from app.models.lead import Lead, LeadStatusConfig
from app.models.profile import Profile
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


async def seed_database():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == settings.admin_email))
        if not result.scalar_one_or_none():
            admin = User(
                email=settings.admin_email,
                password_hash=hash_password(settings.admin_password),
                full_name=settings.admin_name,
                employee_id="1",
                role=UserRole.ADMIN,
            )
            db.add(admin)
            await db.flush()

            manager = User(
                email="manager@leadpro.com",
                password_hash=hash_password("manager123"),
                full_name="Alex Manager",
                employee_id="100",
                role=UserRole.MANAGER,
            )
            db.add(manager)
            await db.flush()

            bd = User(
                email="bd@leadpro.com",
                password_hash=hash_password("bd123456"),
                full_name="Shehryar Shahid",
                employee_id="2106",
                role=UserRole.BD,
                manager_id=manager.id,
            )
            engineer = User(
                email="engineer@leadpro.com",
                password_hash=hash_password("engineer123"),
                full_name="Muhammad Saim Malik",
                employee_id="411",
                devsinc_id="411",
                role=UserRole.ENGINEER,
                manager_id=manager.id,
            )
            db.add_all([bd, engineer])
            await db.flush()

            config_result = await db.execute(select(LeadStatusConfig).limit(1))
            if not config_result.scalar_one_or_none():
                for phase, type_, status, terminal, bucket, order in STATUS_SEED:
                    db.add(
                        LeadStatusConfig(
                            phase=phase,
                            type=type_,
                            status=status,
                            is_terminal=terminal,
                            report_bucket=bucket,
                            sort_order=order,
                        )
                    )

            profile_result = await db.execute(select(Profile).limit(1))
            if not profile_result.scalar_one_or_none():
                profiles = [
                    Profile(full_name="Harry Ahmad", linkedin_url="https://linkedin.com/in/harry", linkedin_verified=True, github_url="https://github.com/harry", github_present=True, primary_tech_stack="MERN", assigned_engineer_id=engineer.id),
                    Profile(full_name="Sherris Aiden", linkedin_url="https://linkedin.com/in/sherris", linkedin_verified=False, github_present=False, primary_tech_stack="Python", assigned_engineer_id=engineer.id),
                    Profile(full_name="John Doe", linkedin_url=None, linkedin_verified=False, github_url="https://github.com/johndoe", github_present=True, primary_tech_stack="Ruby on Rails"),
                ]
                db.add_all(profiles)
                await db.flush()

                leads = [
                    Lead(company="BrightWave Tech", job_title="Technical Lead - Node.js", job_source="Jobright", technologies=["Node.js", "React", "MongoDB"], primary_tech="MERN", assigned_engineer_id=engineer.id, assigned_by_bd_id=bd.id, bd_id=bd.id, profile_id=profiles[0].id, phase="Interview", type="HR Interview", status="Introductory HR"),
                    Lead(company="DataFlow Inc", job_title="Senior Backend Engineer (Django)", job_source="sforcejobs", technologies=["Python", "Django"], primary_tech="Python", assigned_engineer_id=engineer.id, assigned_by_bd_id=bd.id, bd_id=bd.id, profile_id=profiles[1].id, phase="Interview", type="Technical Interview", status="Technical Q&A"),
                    Lead(company="CloudScale", job_title="Back-End Python Engineer", job_source="Upwork", technologies=["Python"], primary_tech="Python", assigned_engineer_id=engineer.id, bd_id=bd.id, phase="Applied", type="JD Sent", status="JD Invite Pending"),
                ]
                db.add_all(leads)

        await db.commit()

    async with AsyncSessionLocal() as db:
        engineers = await db.execute(select(User).where(User.role == UserRole.ENGINEER))
        for eng in engineers.scalars().all():
            if not eng.devsinc_id:
                eng.devsinc_id = eng.employee_id
        await db.commit()
