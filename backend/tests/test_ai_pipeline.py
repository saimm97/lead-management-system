from datetime import date, timedelta
from types import SimpleNamespace

import app.models  # noqa: F401 — register every table before create_all
import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user, get_db
from app.api.routes.ai_pipeline import router
from app.core.config import settings
from app.core.database import Base
from app.core.enums import ApprovalStatus, UserRole
from app.models.ai_pipeline import AiPipelineJob
from app.models.lead import Lead
from app.models.profile import Profile
from app.models.user import User
from app.services import ai_pipeline
from app.services.ai_pipeline import (
    clean_job,
    cosine_similarity,
    country_options,
    filter_and_rank,
    hybrid_score,
    ingest_feed,
    job_countries,
    keyword_overlap,
    list_jobs,
    passes_filters,
    prepare_jobs,
    rank_jobs,
    suggest_engineers,
    tech_requirements,
)
from app.services.ai_pipeline import ListFilters
from app.tasks.celery_app import celery_app

TODAY = date(2026, 10, 2)


@pytest.fixture
async def db():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with sessions() as session:
        yield session
    await engine.dispose()


def _job(**overrides):
    data = {
        "title": "Django engineer",
        "excerpt": "Build APIs",
        "technologies": ["Django"],
        "source": "LinkedIn",
        "posted_at": TODAY,
        "expires_at": TODAY + timedelta(days=30),
        "embedding": None,
        "id": 1,
    }
    data.update(overrides)
    return SimpleNamespace(**data)


def test_clean_job_drops_rows_without_company_or_url():
    assert clean_job({"url": "https://jobs.test/1"}, today=TODAY) is None
    assert clean_job({"company": "Acme"}, today=TODAY) is None
    assert clean_job("not-a-job", today=TODAY) is None


def test_public_feed_fields_are_accepted():
    cleaned = clean_job(
        {
            "company_name": "Lemon.io",
            "url": "https://remotive.com/remote-jobs/role",
            "title": "Senior back-end Engineer",
            "publication_date": "2026-09-30T13:15:26",
            "tags": ["python", "django"],
            "description": "<p>Build APIs</p>",
        },
        today=TODAY,
        default_source="remotive.com",
    )
    assert cleaned is not None
    assert cleaned["company"] == "Lemon.io"
    assert cleaned["posted_at"] == date(2026, 9, 30)
    assert cleaned["technologies"] == ["python", "django"]
    assert cleaned["excerpt"] == "Build APIs"
    assert cleaned["source"] == "remotive.com"


def test_greenhouse_fields_are_accepted():
    cleaned = clean_job(
        {
            "company_name": "Stripe",
            "absolute_url": "https://stripe.com/jobs/search?gh_jid=1",
            "title": "Engineer",
            "first_published": "2026-09-25T16:45:00-04:00",
            "location": {"name": "Seattle"},
        },
        today=TODAY,
        default_source="Greenhouse",
    )
    assert cleaned is not None
    assert cleaned["company"] == "Stripe"
    assert cleaned["url"] == "https://stripe.com/jobs/search?gh_jid=1"
    assert cleaned["posted_at"] == date(2026, 9, 25)
    assert cleaned["excerpt"] == "Seattle"
    assert cleaned["location"] == "Seattle"
    assert cleaned["countries"] == ["United States"]
    assert cleaned["source"] == "Greenhouse"


def test_missing_expiry_is_posted_plus_30_days():
    cleaned = clean_job(
        {"company": "Acme", "url": "https://jobs.test/1", "title": "Backend Engineer", "posted_at": "2026-01-01"},
        today=TODAY,
    )
    assert cleaned is not None
    assert cleaned["posted_at"] == date(2026, 1, 1)
    assert cleaned["expires_at"] == date(2026, 1, 31)


def test_location_becomes_a_country_and_remote_without_a_country_is_worldwide():
    assert job_countries("Seattle") == ["United States"]
    assert job_countries("Remote, United States") == ["United States"]
    assert job_countries("Remote - USA") == ["United States"]
    assert job_countries("San Francisco, CA • New York, NY • United States") == ["United States"]
    assert job_countries("Bengaluru, India") == ["India"]
    assert job_countries("London, United Kingdom") == ["United Kingdom"]
    assert job_countries("Remote, Canada; Remote, United States") == ["United States", "Canada"]
    assert job_countries("USA, Canada, Argentina") == ["United States", "Canada", "Argentina"]
    assert job_countries("Australia") == ["Australia"]
    assert job_countries("Worldwide") == ["Worldwide"]
    assert job_countries("Remote") == ["Worldwide"]
    assert job_countries("Distributed") == ["Worldwide"]
    assert job_countries("Northern America, LATAM, Europe, APAC") == ["Worldwide"]
    assert job_countries("Remote - Texas") == ["United States"]
    assert job_countries("USCA") == ["United States", "Canada"]
    assert job_countries("Distributed", "Partner Engineer, Spain") == ["Spain"]
    assert job_countries("Remote", "Site Reliability Engineer — UK") == ["United Kingdom"]
    assert job_countries("Distributed", "Customer Engineer - Pittsburgh, PA") == ["United States"]
    assert job_countries("Seattle", "Engineer in London") == ["United States"]
    assert job_countries("Remote", "Senior AI Engineer") == ["Worldwide"]
    assert job_countries("Hybrid or Remote") == ["Worldwide"]
    assert job_countries("Ljubljana, Slovenia") == ["Slovenia"]
    assert job_countries("Hybrid") == []
    assert job_countries("In-Office") == []
    assert job_countries("N/A") == []
    assert job_countries("na") == []
    assert job_countries("") == []
    assert "Worldwide" in country_options()
    assert "United States" in country_options()

    remote = clean_job(
        {
            "company_name": "Lemon.io",
            "url": "https://remotive.com/remote-jobs/role-2",
            "title": "Backend Engineer",
            "candidate_required_location": "Worldwide",
            "description": "Python APIs",
        },
        today=TODAY,
    )
    assert remote is not None
    assert remote["location"] == "Worldwide"
    assert remote["countries"] == ["Worldwide"]
    assert remote["excerpt"] == "Python APIs"
    united = _job(countries=["United States"])
    everywhere = _job(countries=["Worldwide"], id=2)
    assert passes_filters(united, country="United States", today=TODAY)
    assert not passes_filters(united, country="Worldwide", today=TODAY)
    assert passes_filters(everywhere, country="Worldwide", today=TODAY)
    assert not passes_filters(everywhere, country="Canada", today=TODAY)


def test_tech_share_follows_mentions_and_does_not_double_count_overlaps():
    shares = tech_requirements("Python Python Python Django. We build React Native apps in JavaScript.")
    by_name = {item.name: item for item in shares}
    assert by_name["Python"].mentions == 3
    assert by_name["Django"].mentions == 1
    assert by_name["Python"].percent > by_name["Django"].percent
    assert "React Native" in by_name
    assert "React" not in by_name
    assert "JavaScript" in by_name
    assert "Java" not in by_name
    assert round(sum(item.percent for item in shares), 1) == 100.0
    suggestions = suggest_engineers(
        shares,
        [
            (1, "Ada", "DV1", ["Python"]),
            (2, "Bea", None, ["MERN"]),
        ],
    )
    assert [item.name for item in suggestions] == ["Ada"]
    assert suggestions[0].technologies == ["Python"]
    assert suggestions[0].match_percent == by_name["Python"].percent


def test_non_technical_titles_are_dropped():
    assert clean_job({"company": "Acme", "url": "https://jobs.test/1", "title": "Backend Engineer"}, today=TODAY)
    assert clean_job({"company": "Acme", "url": "https://jobs.test/2", "title": "Sales Engineer"}, today=TODAY) is None
    assert clean_job({"company": "Acme", "url": "https://jobs.test/3", "title": "Content Reviewer"}, today=TODAY) is None
    assert clean_job({"company": "Acme", "url": "https://jobs.test/4", "title": "Abuse Investigator"}, today=TODAY) is None
    assert clean_job({"company": "Acme", "url": "https://jobs.test/5", "title": "Technical Recruiter"}, today=TODAY) is None


def test_prepare_jobs_skips_duplicates_and_respects_cap(monkeypatch):
    monkeypatch.setattr(ai_pipeline, "DAILY_INSERT_CAP", 1)
    raw = [
        {"company": "Acme", "title": "Backend Engineer", "url": "https://jobs.test/1"},
        {"company": "Acme", "title": "Backend Engineer", "url": "https://jobs.test/1/"},
        {"company": "Beta", "title": "Backend Engineer", "url": "https://jobs.test/2"},
    ]
    fresh = prepare_jobs(raw, set(), TODAY)
    assert [job["url"] for job in fresh] == ["https://jobs.test/1"]


def test_filters_exclude_source_tech_age_and_expiry():
    linkedin = _job(source="LinkedIn", technologies=["Django"], title="Django engineer")
    upwork = _job(source="Upwork", technologies=["Django"], title="Django engineer", id=2)
    java = _job(source="LinkedIn", technologies=["Java"], title="Java engineer", excerpt="spring", id=3)
    old = _job(posted_at=TODAY - timedelta(days=40), id=4)
    expired = _job(expires_at=TODAY - timedelta(days=1), id=5)

    assert passes_filters(linkedin, source="linkedin", today=TODAY)
    assert not passes_filters(upwork, source="LinkedIn", today=TODAY)
    assert passes_filters(linkedin, tech="django", today=TODAY)
    assert not passes_filters(java, tech="Django", today=TODAY)
    assert not passes_filters(old, posted_within_days=7, today=TODAY)
    assert passes_filters(linkedin, posted_within_days=7, today=TODAY)
    assert not passes_filters(expired, today=TODAY)
    assert passes_filters(expired, include_expired=True, today=TODAY)


def test_hybrid_score_prefers_exact_tech_over_a_closer_vector():
    query = "django"
    query_vector = [1.0, 0.0]
    exact = _job(title="Django engineer", technologies=["Django"], embedding=[0.6, 0.8], id=1)
    neighbor = _job(
        title="Office coordinator",
        excerpt="calendar and meetings",
        technologies=["Excel"],
        embedding=[1.0, 0.0],
        id=2,
    )
    exact_score = hybrid_score(keyword_overlap(query, exact), cosine_similarity(query_vector, exact.embedding))
    neighbor_score = hybrid_score(keyword_overlap(query, neighbor), cosine_similarity(query_vector, neighbor.embedding))
    assert exact_score == pytest.approx(0.45 * 1 + 0.55 * 0.6)
    assert neighbor_score == pytest.approx(0.55)
    assert exact_score > neighbor_score
    ranked = rank_jobs([neighbor, exact], query, query_vector)
    assert ranked[0][1] is exact


def test_search_ranks_only_jobs_that_pass_filters():
    today = TODAY
    expired = _job(
        title="Django engineer",
        technologies=["Django"],
        embedding=[1.0, 0.0],
        expires_at=today - timedelta(days=1),
        source="Upwork",
        id=1,
    )
    kept = _job(
        title="Django engineer",
        technologies=["Django"],
        embedding=[0.6, 0.8],
        source="LinkedIn",
        id=2,
    )
    ranked = filter_and_rank(
        [expired, kept],
        query="django",
        query_vector=[1.0, 0.0],
        source="LinkedIn",
        today=today,
    )
    assert ranked == [kept]


def test_without_a_search_phrase_newest_is_first():
    older = _job(posted_at=date(2026, 1, 1), id=1)
    newer = _job(posted_at=date(2026, 9, 1), id=2)
    assert filter_and_rank([older, newer], query="", today=TODAY) == [newer, older]


def test_daily_task_is_scheduled():
    names = [entry["task"] for entry in celery_app.conf.beat_schedule.values()]
    assert "app.services.ai_pipeline.ingest_daily" in names


async def _user(db, role: UserRole, employee_id: str, email: str) -> User:
    user = User(
        email=email,
        password_hash="x",
        full_name=employee_id,
        employee_id=employee_id,
        role=role,
        approval_status=ApprovalStatus.APPROVED,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


def _client(db, user: User | None):
    app = FastAPI()
    app.include_router(router, prefix="/api")

    async def override_db():
        yield db

    app.dependency_overrides[get_db] = override_db
    if user is not None:
        async def override_user():
            return user

        app.dependency_overrides[get_current_user] = override_user
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def test_ingest_inserts_once_embeds_only_new_rows_and_keeps_store_on_bad_feed(db, monkeypatch):
    monkeypatch.setattr(settings, "llm_embedding_model", "test-embed")
    monkeypatch.setattr(settings, "llm_api_key", "test-key")
    existing = AiPipelineJob(
        company="Old",
        title="Old role",
        source="LinkedIn",
        url="https://jobs.test/old",
        posted_at=TODAY,
        expires_at=TODAY + timedelta(days=10),
        technologies=["Python"],
        excerpt="",
        status="new",
    )
    db.add(existing)
    await db.commit()

    embedded: list[list[str]] = []

    async def embed(texts: list[str]):
        embedded.append(texts)
        return [[0.1, 0.2] for _ in texts]

    payload = (
        b'[{"company":"Old","url":"https://jobs.test/old","title":"Old role"},'
        b'{"company":"New","url":"https://jobs.test/new","title":"Django engineer","posted_at":"2026-10-01"}]'
    )

    async def fetch(_url: str) -> bytes:
        return payload

    inserted = await ingest_feed(db, url="http://feed.test/jobs", fetch=fetch, embed=embed, today=TODAY)
    assert inserted == 1
    assert embedded == [["Django engineer\n\n"]]
    rows = (await db.execute(select(AiPipelineJob).order_by(AiPipelineJob.id))).scalars().all()
    assert [row.url for row in rows] == ["https://jobs.test/old", "https://jobs.test/new"]
    created = rows[1]
    assert created.expires_at == date(2026, 10, 31)

    async def bad_fetch(_url: str) -> bytes:
        return b"{not-json"

    assert await ingest_feed(db, url="http://feed.test/jobs", fetch=bad_fetch, embed=embed, today=TODAY) == 0
    assert await db.scalar(select(func.count()).select_from(AiPipelineJob)) == 2

    async def empty_fetch(_url: str) -> bytes:
        return b"[]"

    assert await ingest_feed(db, url="http://feed.test/jobs", fetch=empty_fetch, embed=embed, today=TODAY) == 0
    assert await db.scalar(select(func.count()).select_from(AiPipelineJob)) == 2

    async def again(_url: str) -> bytes:
        return payload

    assert await ingest_feed(db, url="http://feed.test/jobs", fetch=again, embed=embed, today=TODAY) == 0
    assert embedded == [["Django engineer\n\n"]]


async def test_list_jobs_applies_sql_filters_and_sorts_newest_without_a_phrase(db):
    db.add_all(
        [
            AiPipelineJob(
                company="A",
                title="Django engineer",
                source="LinkedIn",
                url="https://jobs.test/a",
                posted_at=TODAY - timedelta(days=2),
                expires_at=TODAY + timedelta(days=5),
                technologies=["Django"],
                excerpt="",
                status="new",
            ),
            AiPipelineJob(
                company="B",
                title="Java engineer",
                source="Upwork",
                url="https://jobs.test/b",
                posted_at=TODAY,
                expires_at=TODAY - timedelta(days=1),
                technologies=["Java"],
                excerpt="",
                status="new",
            ),
            AiPipelineJob(
                company="C",
                title="Django lead",
                source="LinkedIn",
                url="https://jobs.test/c",
                posted_at=TODAY,
                expires_at=TODAY + timedelta(days=5),
                technologies=["Django"],
                excerpt="",
                status="new",
            ),
        ]
    )
    await db.commit()
    rows, total = await list_jobs(
        db,
        ListFilters(source="LinkedIn", tech="Django", posted_within_days=7, page=1, page_size=20),
        today=TODAY,
    )
    assert total == 2
    assert [job.title for job, score in rows] == ["Django lead", "Django engineer"]
    assert all(score is None for _, score in rows)


async def test_accept_creates_one_lead_and_a_second_call_reuses_it(db):
    bd = await _user(db, UserRole.BD, "bd1", "bd@test.com")
    job = AiPipelineJob(
        company="Acme",
        title="Django engineer",
        source="LinkedIn",
        url="https://jobs.test/acme",
        posted_at=TODAY,
        expires_at=TODAY + timedelta(days=10),
        technologies=["Django", "Python"],
        excerpt="APIs",
        status="new",
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    async with _client(db, bd) as client:
        first = await client.post(f"/api/ai-pipeline/jobs/{job.id}/accept")
        second = await client.post(f"/api/ai-pipeline/jobs/{job.id}/accept")

    assert first.status_code == 200
    assert second.status_code == 200
    body = first.json()
    assert second.json()["lead_id"] == body["lead_id"]
    assert second.json()["created"] is False
    assert await db.scalar(select(func.count()).select_from(Lead)) == 1
    lead = await db.get(Lead, body["lead_id"])
    assert lead is not None
    assert lead.phase == "Applied"
    assert lead.type == "JD Sent"
    assert lead.status == "JD Invite Pending"
    assert lead.notes == "https://jobs.test/acme"
    assert lead.job_source == "LinkedIn"
    assert lead.bd_id == bd.id
    assert lead.assigned_by_bd_id == bd.id


async def test_dismissed_and_missing_jobs_are_rejected(db):
    admin = await _user(db, UserRole.ADMIN, "a1", "admin@test.com")
    job = AiPipelineJob(
        company="Acme",
        title="Role",
        source="LinkedIn",
        url="https://jobs.test/dismissed",
        posted_at=TODAY,
        expires_at=TODAY + timedelta(days=3),
        technologies=[],
        excerpt="",
        status="dismissed",
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    async with _client(db, admin) as client:
        dismissed = await client.post(f"/api/ai-pipeline/jobs/{job.id}/accept")
        missing = await client.post("/api/ai-pipeline/jobs/99999/accept")

    assert dismissed.status_code == 409
    assert missing.status_code == 404
    assert await db.scalar(select(func.count()).select_from(Lead)) == 0


async def test_engineer_is_forbidden_and_missing_token_is_unauthorized(db):
    engineer = await _user(db, UserRole.ENGINEER, "e1", "eng@test.com")
    async with _client(db, engineer) as client:
        forbidden = await client.get("/api/ai-pipeline/jobs")
    assert forbidden.status_code == 403

    async with _client(db, None) as client:
        anonymous = await client.get("/api/ai-pipeline/jobs")
    assert anonymous.status_code == 401


async def test_page_size_above_50_is_rejected(db):
    admin = await _user(db, UserRole.ADMIN, "a2", "admin2@test.com")
    async with _client(db, admin) as client:
        response = await client.get("/api/ai-pipeline/jobs", params={"page_size": 51})
    assert response.status_code == 422


async def test_country_filter_keeps_worldwide_separate_from_a_named_country(db):
    admin = await _user(db, UserRole.ADMIN, "a3", "admin3@test.com")
    db.add_all(
        [
            AiPipelineJob(
                company="Remote Co",
                title="Backend Engineer",
                source="remotive.com",
                url="https://jobs.test/world",
                posted_at=TODAY,
                expires_at=TODAY + timedelta(days=10),
                technologies=["Python"],
                location="Worldwide",
                countries=["Worldwide"],
                excerpt="Python services",
                status="new",
            ),
            AiPipelineJob(
                company="Local Co",
                title="Backend Engineer",
                source="Greenhouse",
                url="https://jobs.test/seattle",
                posted_at=TODAY,
                expires_at=TODAY + timedelta(days=10),
                technologies=[],
                location="Seattle",
                countries=["United States"],
                excerpt="Seattle",
                status="new",
            ),
        ]
    )
    await db.commit()
    async with _client(db, admin) as client:
        choices = await client.get("/api/ai-pipeline/countries")
        worldwide = await client.get("/api/ai-pipeline/jobs", params={"country": "Worldwide"})
        united = await client.get("/api/ai-pipeline/jobs", params={"country": "United States"})
        missing = await client.get("/api/ai-pipeline/jobs/99999")
    assert choices.status_code == 200
    assert choices.json()["countries"][0] == "Worldwide"
    assert [item["company"] for item in worldwide.json()["items"]] == ["Remote Co"]
    assert [item["company"] for item in united.json()["items"]] == ["Local Co"]
    assert missing.status_code == 404


async def test_job_detail_weights_the_posting_and_suggests_engineers(db):
    admin = await _user(db, UserRole.ADMIN, "a4", "admin4@test.com")
    ada = await _user(db, UserRole.ENGINEER, "ada", "ada@test.com")
    ada.full_name = "Ada Lovelace"
    ada.devsinc_id = "DV1"
    db.add(Profile(full_name="Ada", primary_tech_stack="Python", assigned_engineer_id=ada.id))
    db.add(Profile(full_name="Bea", primary_tech_stack="MERN", assigned_engineer_id=None))
    job = AiPipelineJob(
        company="Acme",
        title="Backend Engineer",
        source="LinkedIn",
        url="https://jobs.test/detail",
        posted_at=TODAY,
        expires_at=TODAY + timedelta(days=10),
        technologies=["shopify", "wordpress"],
        location="London",
        countries=["United Kingdom"],
        excerpt="Build Python Python and Django services.",
        status="new",
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    async with _client(db, admin) as client:
        response = await client.get(f"/api/ai-pipeline/jobs/{job.id}")
    assert response.status_code == 200
    body = response.json()
    shares = {item["name"]: item for item in body["tech_stack"]}
    assert shares["Python"]["mentions"] == 2
    assert shares["Python"]["percent"] > shares["Django"]["percent"]
    assert round(sum(item["percent"] for item in body["tech_stack"]), 1) == 100.0
    assert [item["name"] for item in body["suggested_engineers"]] == ["Ada Lovelace"]
    assert body["suggested_engineers"][0]["technologies"] == ["Python"]
    assert body["suggested_engineers"][0]["devsinc_id"] == "DV1"
    assert "Shopify" not in shares
