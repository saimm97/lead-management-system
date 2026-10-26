"""Shared types for ATS board adapters."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Any, Awaitable, Callable

import httpx

JsonFetch = Callable[[str], Awaitable[Any]]
USER_AGENT = "LeadPro-JobPipeline/1.0 (+public job boards only)"


@dataclass
class NormalizedJob:
    ats: str
    external_id: str
    company: str
    title: str
    url: str
    location: str = ""
    workplace_type: str | None = None  # remote | hybrid | onsite | None when the board does not say
    is_remote: bool | None = None
    posted_at: date | None = None
    posted_is_proxy: bool = False  # True when only an "updated" date is available
    description: str = ""
    secondary_locations: list[str] = field(default_factory=list)
    country_codes: list[str] = field(default_factory=list)
    compensation: str | None = None


@dataclass
class BoardResult:
    """`complete` is True only when the whole board was read. Partial reads never close jobs."""

    jobs: list[NormalizedJob]
    complete: bool = True
    error: str | None = None


class BoardNotFound(Exception):
    """The board slug does not exist (HTTP 404). Used by the probe to drop stale company names."""


async def http_json(url: str, timeout: float = 30) -> Any:
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, headers={"User-Agent": USER_AGENT}) as client:
        response = await client.get(url)
    if response.status_code == 404:
        raise BoardNotFound(url)
    response.raise_for_status()
    return response.json()


def ms_to_date(value: object) -> date | None:
    try:
        return datetime.fromtimestamp(int(value) / 1000, tz=timezone.utc).date()  # type: ignore[arg-type]
    except (TypeError, ValueError, OSError, OverflowError):
        return None


def iso_to_date(value: object) -> date | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).date()
    except ValueError:
        return None
