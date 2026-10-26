"""Greenhouse public job-board API: GET /v1/boards/{token}/jobs?content=true."""

from __future__ import annotations

from app.pipeline.sources.base import BoardResult, JsonFetch, NormalizedJob, http_json, iso_to_date
from app.pipeline.tech import html_to_text

ATS = "greenhouse"


def url_for(token: str) -> str:
    return f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true"


def parse(token: str, payload: dict, company: str | None = None) -> list[NormalizedJob]:
    jobs: list[NormalizedJob] = []
    for item in (payload or {}).get("jobs") or []:
        if not isinstance(item, dict) or not item.get("absolute_url") or not item.get("title"):
            continue
        location = ((item.get("location") or {}).get("name") or "").strip()
        jobs.append(
            NormalizedJob(
                ats=ATS,
                external_id=str(item.get("id")),
                company=company or item.get("company_name") or token,
                title=str(item["title"]).strip(),
                url=str(item["absolute_url"]),
                location=location,
                posted_at=iso_to_date(item.get("first_published") or item.get("updated_at")),
                posted_is_proxy=not item.get("first_published"),
                description=html_to_text(item.get("content")),
            )
        )
    return jobs


async def fetch(token: str, company: str | None = None, get: JsonFetch = http_json) -> BoardResult:
    payload = await get(url_for(token))
    if not isinstance(payload, dict) or "jobs" not in payload:
        return BoardResult([], complete=False, error="unexpected payload")
    return BoardResult(parse(token, payload, company))
