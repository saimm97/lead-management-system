from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_roles
from app.core.enums import UserRole
from app.models.user import User
from app.services.ai_pipeline import (
    JobNotAcceptable,
    JobNotFound,
    ListFilters,
    accept_job,
    country_options,
    job_detail,
    job_detail_for_lead,
    list_jobs,
)

router = APIRouter(prefix="/ai-pipeline", tags=["ai-pipeline"])

_ROLES = (UserRole.ADMIN, UserRole.MANAGER, UserRole.BD)


class AiJobOut(BaseModel):
    id: int
    company: str
    title: str
    source: str
    url: str
    posted_at: date
    expires_at: date | None
    technologies: list[str]
    location: str = ""
    countries: list[str] = []
    excerpt: str
    status: str
    lead_id: int | None
    score: float | None = None


class AiJobPage(BaseModel):
    items: list[AiJobOut]
    total: int
    page: int
    page_size: int


class AcceptOut(BaseModel):
    job_id: int
    lead_id: int
    created: bool


class TechShareOut(BaseModel):
    name: str
    mentions: int
    percent: float


class EngineerSuggestionOut(BaseModel):
    id: int
    name: str
    devsinc_id: str | None
    match_percent: float
    technologies: list[str]


class AiJobDetail(AiJobOut):
    tech_stack: list[TechShareOut]
    suggested_engineers: list[EngineerSuggestionOut]


class CountryList(BaseModel):
    countries: list[str]


def _job_out(job, score: float | None) -> AiJobOut:
    return AiJobOut(
        id=job.id,
        company=job.company,
        title=job.title,
        source=job.source,
        url=job.url,
        posted_at=job.posted_at,
        expires_at=job.expires_at,
        technologies=list(job.technologies or []),
        location=job.location or "",
        countries=list(job.countries or []),
        excerpt=job.excerpt or "",
        status=job.status,
        lead_id=job.lead_id,
        score=None if score is None else round(score, 4),
    )


@router.get("/jobs", response_model=AiJobPage)
async def get_jobs(
    source: str | None = None,
    tech: str | None = None,
    country: str | None = Query(None, max_length=80),
    posted_within_days: int | None = Query(None, ge=1, le=365),
    include_expired: bool = False,
    q: str | None = Query(None, max_length=300),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    _: User = Depends(require_roles(*_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    filters = ListFilters(
        source=source,
        tech=tech,
        country=country,
        posted_within_days=posted_within_days,
        include_expired=include_expired,
        q=q,
        page=page,
        page_size=page_size,
    )
    rows, total = await list_jobs(db, filters)
    return AiJobPage(
        items=[_job_out(job, score) for job, score in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


def _detail_out(match) -> AiJobDetail:
    base = _job_out(match.job, None)
    return AiJobDetail(
        **base.model_dump(),
        tech_stack=[
            TechShareOut(name=item.name, mentions=item.mentions, percent=item.percent) for item in match.tech_stack
        ],
        suggested_engineers=[
            EngineerSuggestionOut(
                id=item.id,
                name=item.name,
                devsinc_id=item.devsinc_id,
                match_percent=item.match_percent,
                technologies=item.technologies,
            )
            for item in match.suggested_engineers
        ],
    )


@router.get("/countries", response_model=CountryList)
async def get_countries(_: User = Depends(require_roles(*_ROLES))):
    return CountryList(countries=country_options())


@router.get("/jobs/{job_id}", response_model=AiJobDetail)
async def get_job(
    job_id: int,
    _: User = Depends(require_roles(*_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    try:
        match = await job_detail(db, job_id)
    except JobNotFound:
        raise HTTPException(status_code=404, detail="Job not found") from None
    return _detail_out(match)


@router.get("/leads/{lead_id}", response_model=AiJobDetail)
async def get_job_for_lead(
    lead_id: int,
    _: User = Depends(require_roles(*_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    try:
        match = await job_detail_for_lead(db, lead_id)
    except JobNotFound:
        raise HTTPException(status_code=404, detail="Job not found") from None
    return _detail_out(match)


@router.post("/jobs/{job_id}/accept", response_model=AcceptOut)
async def accept_pipeline_job(
    job_id: int,
    user: User = Depends(require_roles(*_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await accept_job(db, job_id, user)
    except JobNotFound:
        raise HTTPException(status_code=404, detail="Job not found") from None
    except JobNotAcceptable as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from None
    return AcceptOut(job_id=result.job_id, lead_id=result.lead_id, created=result.created)
