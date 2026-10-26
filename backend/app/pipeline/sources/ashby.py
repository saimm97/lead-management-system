"""Ashby public job-board API: GET /posting-api/job-board/{client}?includeCompensation=true."""

from __future__ import annotations

from app.pipeline.sources.base import BoardResult, JsonFetch, NormalizedJob, http_json, iso_to_date

ATS = "ashby"


def url_for(client: str) -> str:
    return f"https://api.ashbyhq.com/posting-api/job-board/{client}?includeCompensation=true"


def parse(client: str, payload: dict, company: str | None = None) -> list[NormalizedJob]:
    jobs: list[NormalizedJob] = []
    for item in (payload or {}).get("jobs") or []:
        if not isinstance(item, dict) or not item.get("jobUrl") or not item.get("title"):
            continue
        if item.get("isListed") is False:
            continue
        address = ((item.get("address") or {}).get("postalAddress") or {})
        country = address.get("addressCountry")
        comp = item.get("compensation") or {}
        remote = item.get("isRemote")
        jobs.append(
            NormalizedJob(
                ats=ATS,
                external_id=str(item.get("id")),
                company=company or client,
                title=str(item["title"]).strip(),
                url=str(item["jobUrl"]),
                location=str(item.get("location") or "").strip(),
                workplace_type=str(item.get("workplaceType") or "").lower() or None,
                is_remote=remote if isinstance(remote, bool) else None,
                posted_at=iso_to_date(item.get("publishedAt")),
                description=str(item.get("descriptionPlain") or ""),
                secondary_locations=[
                    str(s.get("location")) for s in (item.get("secondaryLocations") or []) if isinstance(s, dict) and s.get("location")
                ],
                country_codes=[str(country)] if country else [],
                compensation=comp.get("compensationTierSummary") or comp.get("scrapeableCompensationSalarySummary"),
            )
        )
    return jobs


async def fetch(client: str, company: str | None = None, get: JsonFetch = http_json) -> BoardResult:
    payload = await get(url_for(client))
    if not isinstance(payload, dict) or "jobs" not in payload:
        return BoardResult([], complete=False, error="unexpected payload")
    return BoardResult(parse(client, payload, company))
