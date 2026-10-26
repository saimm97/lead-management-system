"""Lever public postings API: GET /v0/postings/{site}?mode=json (published postings only)."""

from __future__ import annotations

from app.pipeline.sources.base import BoardResult, JsonFetch, NormalizedJob, http_json, ms_to_date

ATS = "lever"


def url_for(site: str) -> str:
    return f"https://api.lever.co/v0/postings/{site}?mode=json"


def _salary(item: dict) -> str | None:
    pay = item.get("salaryRange")
    if isinstance(pay, dict) and pay.get("min") and pay.get("max"):
        return f"{pay.get('currency', '')} {pay['min']}-{pay['max']} {pay.get('interval', '')}".strip()
    return None


def parse(site: str, payload: list, company: str | None = None) -> list[NormalizedJob]:
    jobs: list[NormalizedJob] = []
    for item in payload or []:
        if not isinstance(item, dict) or not item.get("hostedUrl") or not item.get("text"):
            continue
        cats = item.get("categories") or {}
        workplace = str(item.get("workplaceType") or "").lower() or None
        if workplace == "on-site":
            workplace = "onsite"
        country = item.get("country")
        jobs.append(
            NormalizedJob(
                ats=ATS,
                external_id=str(item.get("id")),
                company=company or site,
                title=str(item["text"]).strip(),
                url=str(item["hostedUrl"]),
                location=str(cats.get("location") or "").strip(),
                workplace_type=workplace if workplace in {"remote", "hybrid", "onsite"} else None,
                posted_at=ms_to_date(item.get("createdAt")),
                description=str(item.get("descriptionPlain") or ""),
                secondary_locations=[str(x) for x in (cats.get("allLocations") or []) if x],
                country_codes=[str(country)] if country else [],
                compensation=_salary(item),
            )
        )
    return jobs


async def fetch(site: str, company: str | None = None, get: JsonFetch = http_json) -> BoardResult:
    payload = await get(url_for(site))
    if not isinstance(payload, list):
        return BoardResult([], complete=False, error="unexpected payload")
    return BoardResult(parse(site, payload, company))
