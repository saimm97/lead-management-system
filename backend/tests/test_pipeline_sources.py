from datetime import date

import pytest

from app.pipeline.sources import ADAPTERS, ashby, greenhouse, lever
from app.pipeline.sources.base import BoardNotFound

GREENHOUSE = {
    "jobs": [
        {
            "id": 11,
            "title": "Backend Engineer",
            "absolute_url": "https://boards.greenhouse.io/acme/jobs/11",
            "updated_at": "2026-10-20T10:00:00-04:00",
            "location": {"name": "Remote - United States"},
            "content": "&lt;p&gt;Python &amp;amp; Django&lt;/p&gt;",
        },
        {"id": 12, "title": "No URL"},
    ]
}
LEVER = [
    {
        "id": "abc",
        "text": "Platform Engineer",
        "hostedUrl": "https://jobs.lever.co/acme/abc",
        "createdAt": 1760000000000,
        "workplaceType": "remote",
        "country": "US",
        "categories": {"location": "Remote", "allLocations": ["Remote", "Toronto"]},
        "descriptionPlain": "Go and Kubernetes",
        "salaryRange": {"currency": "USD", "interval": "per-year-salary", "min": 150000, "max": 190000},
    },
    {"id": "x", "text": "Broken"},
]
ASHBY = {
    "jobs": [
        {
            "id": "j1",
            "title": "ML Engineer",
            "jobUrl": "https://jobs.ashbyhq.com/acme/j1",
            "location": "Remote",
            "isRemote": True,
            "workplaceType": "Remote",
            "publishedAt": "2026-10-15T12:00:00.000+00:00",
            "descriptionPlain": "PyTorch",
            "secondaryLocations": [{"location": "Canada"}],
            "address": {"postalAddress": {"addressCountry": "United States"}},
        },
        {"id": "j2", "title": "Hidden", "jobUrl": "https://jobs.ashbyhq.com/acme/j2", "isListed": False},
    ]
}


def test_greenhouse_parse():
    [job] = greenhouse.parse("acme", GREENHOUSE, "Acme")
    assert (job.ats, job.external_id, job.company) == ("greenhouse", "11", "Acme")
    assert job.location == "Remote - United States"
    assert job.posted_at == date(2026, 10, 20) and job.posted_is_proxy
    assert "<" not in job.description and "Python & Django" in job.description


def test_lever_parse():
    [job] = lever.parse("acme", LEVER, "Acme")
    assert job.workplace_type == "remote" and job.country_codes == ["US"]
    assert job.secondary_locations == ["Remote", "Toronto"]
    assert job.posted_at == date(2025, 10, 9)
    assert job.compensation and "150000" in job.compensation


def test_ashby_parse_skips_unlisted():
    [job] = ashby.parse("acme", ASHBY, "Acme")
    assert job.is_remote is True and job.workplace_type == "remote"
    assert job.secondary_locations == ["Canada"] and job.country_codes == ["United States"]
    assert job.posted_at == date(2026, 10, 15)


@pytest.mark.parametrize("ats, payload", [("greenhouse", GREENHOUSE), ("lever", LEVER), ("ashby", ASHBY)])
async def test_fetch_complete(ats, payload):
    async def get(url):
        return payload

    result = await ADAPTERS[ats]("acme", "Acme", get=get)
    assert result.complete and len(result.jobs) == 1


@pytest.mark.parametrize("ats", ["greenhouse", "lever", "ashby"])
async def test_unexpected_payload_is_incomplete(ats):
    async def get(url):
        return "oops"

    result = await ADAPTERS[ats]("acme", get=get)
    assert not result.complete and result.jobs == []


async def test_missing_board_raises():
    async def get(url):
        raise BoardNotFound(url)

    with pytest.raises(BoardNotFound):
        await greenhouse.fetch("gone", get=get)
