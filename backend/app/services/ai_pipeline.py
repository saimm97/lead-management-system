"""Daily job store and hybrid ranking for the AI Pipeline.

Hard filters (source, tech, recency, expiry) run first. A search phrase then
orders the survivors by 0.45 keyword overlap + 0.55 cosine similarity.
"""

from __future__ import annotations

import asyncio
import html
import json
import logging
import math
import re
from collections.abc import Awaitable, Callable, Sequence
from urllib.parse import urlsplit
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

import httpx
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.enums import UserRole
from app.models.ai_pipeline import STATUS_ACCEPTED, STATUS_DISMISSED, STATUS_NEW, AiPipelineJob
from app.models.lead import Lead
from app.models.profile import MonthlyTarget, Profile
from app.models.user import User
from app.services.audit import log_audit
from app.services.tenant import get_default_cluster_head_id

logger = logging.getLogger(__name__)

KEYWORD_WEIGHT = 0.45
SEMANTIC_WEIGHT = 0.55
DEFAULT_EXPIRY_DAYS = 30
DAILY_INSERT_CAP = 2000
CANDIDATE_CAP = 2000
EMBED_BATCH = 64

EmbedFn = Callable[[list[str]], Awaitable[list[list[float] | None]]]
FetchFn = Callable[[str], Awaitable[bytes]]


class JobNotFound(Exception):
    pass


class JobNotAcceptable(Exception):
    pass


@dataclass
class ListFilters:
    source: str | None = None
    tech: str | None = None
    country: str | None = None
    posted_within_days: int | None = None
    include_expired: bool = False
    q: str | None = None
    page: int = 1
    page_size: int = 20


@dataclass
class AcceptResult:
    job_id: int
    lead_id: int
    created: bool


@dataclass(frozen=True)
class TechShare:
    name: str
    mentions: int
    percent: float


@dataclass(frozen=True)
class EngineerSuggestion:
    id: int
    name: str
    devsinc_id: str | None
    match_percent: float
    technologies: list[str]


@dataclass
class JobMatch:
    job: AiPipelineJob
    tech_stack: list[TechShare]
    suggested_engineers: list[EngineerSuggestion]


def embeddings_enabled() -> bool:
    return bool(settings.llm_embedding_model and settings.llm_api_key)


def _feed_source(url: str) -> str:
    host = (urlsplit(url).hostname or "feed").removeprefix("www.")
    return host[:100] or "feed"


def normalize_url(value: object) -> str:
    text = str(value or "").strip()
    return text.rstrip("/") if text else ""


def parse_date(value: object) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def clean_technologies(value: object) -> list[str]:
    if isinstance(value, str):
        parts = value.split(",")
    elif isinstance(value, list):
        parts = value
    else:
        return []
    seen: list[str] = []
    for part in parts:
        label = str(part).strip()
        if label and label not in seen:
            seen.append(label)
    return seen[:30]


# Sales and recruiting titles are rejected even when they contain "engineer".
_NON_ENGINEERING = re.compile(
    r"\b(sales|recruiter|recruiting|talent acquisition|marketing|account executive|"
    r"customer success|business development|legal|counsel|attorney|finance|accountant|"
    r"human resources|copywriter|content reviewer|kundenservice)\b",
    re.IGNORECASE,
)
_ENGINEERING = re.compile(
    r"\b(engineers?|developers?|programmers?|software|devops|sre|site reliability|"
    r"data scientists?|data engineers?|machine learning|ml engineer|ai engineer|"
    r"back-?end|front-?end|full-?stack|fullstack|sdet|qa|ios|android|embedded|firmware|"
    r"architects?|kubernetes|technical lead|tech lead|engineering|scientist|dba|"
    r"database|infrastructure|platform)\b",
    re.IGNORECASE,
)


def is_technical_job(title: str) -> bool:
    """Keep engineering roles. Drop everything else, including sales engineers."""
    if _NON_ENGINEERING.search(title):
        return False
    return _ENGINEERING.search(title) is not None


WORLDWIDE = "Worldwide"

# Office-mode labels are not a place. They stay unmatched so "All locations" is the only view.
_OFFICE_ONLY = {"n/a", "na", "hybrid", "in-office", "in office", "on-site", "onsite", "office"}
_WORLDWIDE_WORD = re.compile(r"\b(worldwide|anywhere|global)\b", re.IGNORECASE)
_WORLDWIDE_ONLY = {"remote", "distributed", "work from anywhere"}
# Two or more macro-regions, with no country named, are treated as worldwide.
_REGION = re.compile(
    r"\b(europe|apac|latam|emea|americas|northern america|north america|asia|africa|middle east)\b",
    re.IGNORECASE,
)
_COUNTRY_RULES: tuple[tuple[str, str], ...] = (
    ("United States", r"\bunited states\b|\bu\.?s\.?a\.?\b|\bu\.s\.?\b|\bus\b|\bcalifornia\b|\bca\b|\bnew york\b|\bnyc\b|\bny\b|\bsan francisco\b|\bmountain view\b|\bseattle\b|\bbellevue\b|\bmenlo park\b|\bchicago\b|\bwashington\b|\bbay area\b|\bwest coast\b|\bsouthwest\b|\bboston\b|\baustin\b|\bdenver\b|\batlanta\b|\blos angeles\b|\bsunnyvale\b|\bpalo alto\b|\bcupertino\b|\bsan jose\b|\bportland\b|\bmiami\b|\bdallas\b|\bhouston\b|\balabama\b|\bcharlotte\b|\bnorth carolina\b|\braleigh\b|\billinois\b|\bmichigan\b|\bminnesota\b|\bvirginia\b|\bmclean\b|\bnew jersey\b|\bphiladelphia\b|\bpennsylvania\b|\bpittsburgh\b|\bplano\b|\btexas\b|\bgeorgia\b|\bbentonville\b|\bbentoville\b|,\s*ar\b"),
    ("Canada", r"\bcanada\b|\btoronto\b|\bvancouver\b|\bmontreal\b|\bottawa\b|\bwaterloo\b"),
    ("United Kingdom", r"\bunited kingdom\b|\bu\.k\.\b|\buk\b|\blondon\b|\bmanchester\b|\bedinburgh\b"),
    ("India", r"\bindia\b|\bbengaluru\b|\bbangalore\b|\bhyderabad\b|\bpune\b|\bmumbai\b|\bdelhi\b|\bgurgaon\b|\bnoida\b|\bchennai\b"),
    ("Germany", r"\bgermany\b|\bmunich\b|\bberlin\b|\bfrankfurt\b|\bhamburg\b"),
    ("France", r"\bfrance\b|\bparis\b|\blyon\b"),
    ("Netherlands", r"\bnetherlands\b|\bholland\b|\bamsterdam\b"),
    ("Ireland", r"\bireland\b|\bdublin\b"),
    ("Singapore", r"\bsingapore\b"),
    ("Australia", r"\baustralia\b|\bsydney\b|\bmelbourne\b"),
    ("Japan", r"\bjapan\b|\btokyo\b"),
    ("South Korea", r"\bsouth korea\b|\bseoul\b|\bkorea\b"),
    ("Spain", r"\bspain\b|\bmadrid\b|\bbarcelona\b"),
    ("Brazil", r"\bbrazil\b|\bs[aã]o paulo\b"),
    ("Mexico", r"\bmexico\b"),
    ("Poland", r"\bpoland\b|\bwarsaw\b|\bkrak[oó]w\b"),
    ("Sweden", r"\bsweden\b|\bstockholm\b"),
    ("Israel", r"\bisrael\b|\btel aviv\b"),
    ("Serbia", r"\bserbia\b|\bbelgrade\b"),
    ("Switzerland", r"\bswitzerland\b|\bzurich\b|\bz[uü]rich\b"),
    ("Norway", r"\bnorway\b|\boslo\b"),
    ("Iceland", r"\biceland\b"),
    ("Argentina", r"\bargentina\b|\bbuenos aires\b"),
    ("Peru", r"\bperu\b|\blima\b"),
    ("Turkey", r"\bturkey\b|\bt[uü]rkiye\b|\bistanbul\b"),
    ("Vietnam", r"\bvietnam\b"),
    ("Taiwan", r"\btaiwan\b|\btaipei\b"),
    ("Italy", r"\bitaly\b|\bmilan\b|\brome\b"),
    ("Portugal", r"\bportugal\b|\blisbon\b"),
    ("Belgium", r"\bbelgium\b|\bbrussels\b"),
    ("Austria", r"\baustria\b|\bvienna\b"),
    ("Denmark", r"\bdenmark\b|\bcopenhagen\b"),
    ("Finland", r"\bfinland\b|\bhelsinki\b"),
    ("Czech Republic", r"\bczech\b|\bprague\b"),
    ("Romania", r"\bromania\b|\bbucharest\b"),
    ("Ukraine", r"\bukraine\b|\bkyiv\b|\bkiev\b"),
    ("China", r"\bchina\b|\bbeijing\b|\bshanghai\b|\bshenzhen\b"),
    ("Hong Kong", r"\bhong kong\b"),
    ("United Arab Emirates", r"\bunited arab emirates\b|\bdubai\b|\babu dhabi\b"),
    ("New Zealand", r"\bnew zealand\b|\bauckland\b"),
    ("Indonesia", r"\bindonesia\b|\bjakarta\b"),
    ("Philippines", r"\bphilippines\b|\bmanila\b"),
    ("Thailand", r"\bthailand\b|\bbangkok\b"),
    ("Colombia", r"\bcolombia\b|\bbogot[aá]\b"),
    ("Chile", r"\bchile\b|\bsantiago\b"),
    ("Costa Rica", r"\bcosta rica\b"),
    ("Slovenia", r"\bslovenia\b|\bljubljana\b"),
)
_COMPILED_COUNTRIES = tuple((name, re.compile(pattern, re.IGNORECASE)) for name, pattern in _COUNTRY_RULES)


def country_options() -> list[str]:
    names = sorted({name for name, _ in _COUNTRY_RULES})
    return [WORLDWIDE, *names]


def _named_countries(text: str) -> list[str]:
    plain = _plain(text)
    key = plain.lower().strip(" .")
    if not key or key in _OFFICE_ONLY:
        return []
    if key == "usca":
        return ["United States", "Canada"]
    found: list[str] = []
    for name, pattern in _COMPILED_COUNTRIES:
        if pattern.search(plain) and name not in found:
            found.append(name)
    return found


def job_countries(location: str, title: str = "") -> list[str]:
    """Countries named by the location. A generic Remote/Distributed row uses the title instead.

    Remote with no country at all is Worldwide. Hybrid and N/A stay unmatched.
    """
    found = _named_countries(location)
    if not found and title:
        found = _named_countries(title)
    if found:
        return found
    text = _plain(location)
    key = text.lower().strip(" .")
    if not key or key in _OFFICE_ONLY:
        return []
    regions = {match.group(0).lower() for match in _REGION.finditer(text)}
    if _WORLDWIDE_WORD.search(text) or key in _WORLDWIDE_ONLY or len(regions) >= 2 or re.search(r"\b(remote|distributed)\b", text, re.IGNORECASE):
        return [WORLDWIDE]
    return []


def _plain(value: object) -> str:
    text = re.sub(r"<[^>]+>", " ", str(value or ""))
    return re.sub(r"\s+", " ", text).strip()


def clean_job(raw: object, today: date | None = None, default_source: str = "feed") -> dict | None:
    """Return a normalized job, or None when company or url is missing."""
    if not isinstance(raw, dict):
        return None
    company = _plain(raw.get("company") or raw.get("company_name") or raw.get("companyName"))[:255]
    url = normalize_url(raw.get("url") or raw.get("link") or raw.get("absolute_url"))[:1000]
    if not company or not url:
        return None
    posted = parse_date(
        raw.get("posted_at") or raw.get("publication_date") or raw.get("first_published") or raw.get("created_at") or raw.get("updated_at")
    ) or (today or date.today())
    expires = parse_date(raw.get("expires_at"))
    if expires is None:
        expires = posted + timedelta(days=DEFAULT_EXPIRY_DAYS)
    title = _plain(raw.get("title") or raw.get("job_title"))[:500] or "Untitled"
    if not is_technical_job(title):
        return None
    source = _plain(raw.get("source") or raw.get("job_source") or default_source)[:100] or default_source
    location = raw.get("candidate_required_location") or raw.get("location") or raw.get("country")
    if isinstance(location, dict):
        location = location.get("name")
    location_text = _plain(location)[:500]
    excerpt = _plain(raw.get("excerpt") or raw.get("description") or raw.get("content") or location_text)[:2000]
    if "technologies" in raw:
        technologies = raw.get("technologies")
    elif "tags" in raw:
        technologies = raw.get("tags")
    else:
        technologies = raw.get("tech")
    return {
        "company": company,
        "title": title,
        "source": source,
        "url": url,
        "posted_at": posted,
        "expires_at": expires,
        "technologies": clean_technologies(technologies),
        "location": location_text,
        "countries": job_countries(location_text, title),
        "excerpt": excerpt,
    }


def parse_feed(content: bytes) -> list:
    try:
        data = json.loads(content)
    except json.JSONDecodeError as exc:
        raise ValueError("Feed is not valid JSON") from exc
    if isinstance(data, dict):
        data = data.get("jobs", data.get("data", []))
    if not isinstance(data, list):
        raise ValueError("Feed must be a list of jobs")
    return data


def prepare_jobs(raw_items: list, existing_urls: set[str], today: date, default_source: str = "feed") -> list[dict]:
    seen = set(existing_urls)
    fresh: list[dict] = []
    for raw in raw_items:
        cleaned = clean_job(raw, today=today, default_source=default_source)
        if cleaned is None or cleaned["url"] in seen:
            continue
        seen.add(cleaned["url"])
        fresh.append(cleaned)
        if len(fresh) >= DAILY_INSERT_CAP:
            break
    return fresh


def _blob(job: Any) -> str:
    technologies = getattr(job, "technologies", None)
    if technologies is None and isinstance(job, dict):
        technologies = job.get("technologies")
    tech_text = " ".join(technologies or [])
    title = _field(job, "title")
    excerpt = _field(job, "excerpt")
    return f"{title} {excerpt} {tech_text}".lower()


def _field(job: Any, name: str) -> str:
    if isinstance(job, dict):
        return str(job.get(name) or "")
    return str(getattr(job, name, "") or "")


def _sequence_field(job: Any, name: str) -> list:
    value = job.get(name) if isinstance(job, dict) else getattr(job, name, None)
    return list(value or [])


def keyword_overlap(query: str, job: Any) -> float:
    tokens = [token for token in re.split(r"[^a-z0-9+#.]+", query.lower()) if len(token) > 1]
    if not tokens:
        return 0.0
    haystack = _blob(job)
    hits = sum(1 for token in tokens if token in haystack)
    return hits / len(tokens)


def _vector(value: object) -> list[float] | None:
    if value is None:
        return None
    try:
        return [float(item) for item in value]  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def cosine_similarity(left: Sequence[float] | None, right: Sequence[float] | None) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(b * b for b in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return dot / (left_norm * right_norm)


def hybrid_score(keyword: float, cosine: float) -> float:
    return KEYWORD_WEIGHT * keyword + SEMANTIC_WEIGHT * cosine


def _posted(job: Any) -> date:
    value = job["posted_at"] if isinstance(job, dict) else job.posted_at
    return value


def rank_jobs(jobs: Sequence[Any], query: str, query_vector: Sequence[float] | None) -> list[tuple[float, Any]]:
    ranked: list[tuple[float, Any]] = []
    for job in jobs:
        embedding = job.get("embedding") if isinstance(job, dict) else getattr(job, "embedding", None)
        score = hybrid_score(keyword_overlap(query, job), cosine_similarity(query_vector, _vector(embedding)))
        ranked.append((score, job))
    ranked.sort(key=lambda item: (-item[0], _posted(item[1]).toordinal() * -1, getattr(item[1], "id", 0)))
    return ranked


def passes_filters(
    job: Any,
    *,
    source: str | None = None,
    tech: str | None = None,
    country: str | None = None,
    posted_within_days: int | None = None,
    include_expired: bool = False,
    today: date | None = None,
) -> bool:
    today = today or date.today()
    job_source = _field(job, "source")
    if source and job_source.lower() != source.strip().lower():
        return False
    if tech and tech.strip().lower() not in _blob(job):
        return False
    if country and country.strip():
        held = {str(item).lower() for item in (_sequence_field(job, "countries"))}
        if country.strip().lower() not in held:
            return False
    posted = _posted(job)
    if posted_within_days is not None and posted < today - timedelta(days=posted_within_days):
        return False
    expires = job["expires_at"] if isinstance(job, dict) else job.expires_at
    if not include_expired and expires is not None and expires < today:
        return False
    return True


def filter_and_rank(
    jobs: Sequence[Any],
    *,
    query: str = "",
    query_vector: Sequence[float] | None = None,
    embed_enabled: bool = True,
    source: str | None = None,
    tech: str | None = None,
    country: str | None = None,
    posted_within_days: int | None = None,
    include_expired: bool = False,
    today: date | None = None,
) -> list[Any]:
    matched = [
        job
        for job in jobs
        if passes_filters(
            job,
            source=source,
            tech=tech,
            country=country,
            posted_within_days=posted_within_days,
            include_expired=include_expired,
            today=today,
        )
    ]
    phrase = query.strip()
    if not phrase or not embed_enabled:
        return sorted(matched, key=lambda job: (_posted(job), getattr(job, "id", 0)), reverse=True)
    return [job for _, job in rank_jobs(matched, phrase, query_vector)]


def job_embed_text(job: dict) -> str:
    technologies = ", ".join(job["technologies"])
    return f"{job['title']}\n{technologies}\n{job['excerpt']}"[:8000]


def _like_needle(value: str) -> str:
    escaped = value.strip().lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def apply_filters(stmt, filters: ListFilters, today: date):
    if filters.source:
        stmt = stmt.where(func.lower(AiPipelineJob.source) == filters.source.strip().lower())
    if filters.tech and filters.tech.strip():
        needle = _like_needle(filters.tech)
        stmt = stmt.where(
            or_(
                func.lower(AiPipelineJob.title).like(needle, escape="\\"),
                func.lower(AiPipelineJob.excerpt).like(needle, escape="\\"),
                func.lower(cast(AiPipelineJob.technologies, String)).like(needle, escape="\\"),
            )
        )
    if filters.country and filters.country.strip():
        needle = _like_needle(f'"{filters.country.strip()}"')
        stmt = stmt.where(func.lower(cast(AiPipelineJob.countries, String)).like(needle, escape="\\"))
    if filters.posted_within_days is not None:
        stmt = stmt.where(AiPipelineJob.posted_at >= today - timedelta(days=filters.posted_within_days))
    if not filters.include_expired:
        stmt = stmt.where(or_(AiPipelineJob.expires_at.is_(None), AiPipelineJob.expires_at >= today))
    return stmt


async def fetch_feed(url: str, timeout: float = 60) -> bytes:
    headers = {"User-Agent": "LeadPro/0.1 (job pipeline)", "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, headers=headers) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.content


async def embed_texts(texts: list[str]) -> list[list[float] | None]:
    if not texts or not embeddings_enabled():
        return [None] * len(texts)
    url = f"{settings.llm_base_url.rstrip('/')}/embeddings"
    headers = {"Authorization": f"Bearer {settings.llm_api_key}", "Content-Type": "application/json"}
    found: list[list[float] | None] = []
    async with httpx.AsyncClient(timeout=60) as client:
        for start in range(0, len(texts), EMBED_BATCH):
            chunk = texts[start : start + EMBED_BATCH]
            body: dict[str, Any] = {"input": chunk, "model": settings.llm_embedding_model}
            try:
                response = await client.post(url, json=body, headers=headers)
                response.raise_for_status()
                data = response.json().get("data") or []
                ordered = sorted(data, key=lambda item: item.get("index", 0))
                vectors = [_fit_vector(item.get("embedding")) for item in ordered]
            except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
                logger.warning("AI pipeline embedding batch failed: %s", exc)
                vectors = []
            if len(vectors) != len(chunk):
                vectors = (vectors + [None] * len(chunk))[: len(chunk)]
            found.extend(vectors)
    return found


def _fit_vector(value: object) -> list[float] | None:
    vector = _vector(value)
    if vector is None or len(vector) != settings.llm_embedding_dim:
        return None
    return vector


async def _existing_urls(db: AsyncSession, urls: list[str]) -> set[str]:
    found: set[str] = set()
    for start in range(0, len(urls), 500):
        chunk = urls[start : start + 500]
        rows = await db.execute(select(AiPipelineJob.url).where(AiPipelineJob.url.in_(chunk)))
        found.update(rows.scalars().all())
    return found


def greenhouse_board_names() -> list[str]:
    return [name.strip() for name in settings.greenhouse_boards.split(",") if name.strip()]


def greenhouse_board_url(board: str) -> str:
    return f"https://boards-api.greenhouse.io/v1/boards/{board}/jobs"


async def _ingest_url(
    db: AsyncSession,
    feed_url: str,
    *,
    fetch: FetchFn,
    embed: EmbedFn,
    today: date,
    default_source: str | None = None,
) -> int:
    source_name = default_source or _feed_source(feed_url)
    try:
        raw_items = parse_feed(await fetch(feed_url))
    except (httpx.HTTPError, ValueError, OSError) as exc:
        logger.warning("AI pipeline feed skipped (%s): %s", feed_url, exc)
        return 0
    if not raw_items:
        return 0
    cleaned_urls = []
    for raw in raw_items:
        cleaned = clean_job(raw, today=today, default_source=source_name)
        if cleaned is not None:
            cleaned_urls.append(cleaned["url"])
    existing = await _existing_urls(db, cleaned_urls)
    fresh = prepare_jobs(raw_items, existing, today, default_source=source_name)
    if not fresh:
        return 0
    if embeddings_enabled():
        vectors = await embed([job_embed_text(job) for job in fresh])
        for job, vector in zip(fresh, vectors):
            job["embedding"] = vector
    inserted = 0
    for job in fresh:
        try:
            async with db.begin_nested():
                db.add(
                    AiPipelineJob(
                        company=job["company"],
                        title=job["title"],
                        source=job["source"],
                        url=job["url"],
                        posted_at=job["posted_at"],
                        expires_at=job["expires_at"],
                        technologies=job["technologies"],
                        location=job.get("location") or "",
                        countries=job.get("countries") or [],
                        excerpt=job["excerpt"],
                        embedding=job.get("embedding"),
                        status=STATUS_NEW,
                    )
                )
            inserted += 1
        except IntegrityError:
            continue
    await db.commit()
    return inserted


async def ingest_feed(
    db: AsyncSession,
    *,
    url: str | None = None,
    fetch: FetchFn = fetch_feed,
    embed: EmbedFn = embed_texts,
    today: date | None = None,
    boards: bool = True,
) -> int:
    today = today or date.today()
    if url is not None:
        return await _ingest_url(db, url, fetch=fetch, embed=embed, today=today) if url else 0

    inserted = 0
    if settings.job_feed_url:
        inserted += await _ingest_url(db, settings.job_feed_url, fetch=fetch, embed=embed, today=today)
    for board in greenhouse_board_names():
        inserted += await _ingest_url(
            db,
            greenhouse_board_url(board),
            fetch=fetch,
            embed=embed,
            today=today,
            default_source="Greenhouse",
        )
    if boards:
        from app.pipeline.ingest import ingest_boards  # local import: pipeline modules import this file

        inserted += (await ingest_boards(db, today=today, embed=embed)).inserted
    return inserted


async def list_jobs(
    db: AsyncSession,
    filters: ListFilters,
    *,
    today: date | None = None,
    embed: EmbedFn = embed_texts,
) -> tuple[list[tuple[AiPipelineJob, float | None]], int]:
    today = today or date.today()
    filtered = apply_filters(select(AiPipelineJob), filters, today)
    total = await db.scalar(select(func.count()).select_from(filtered.subquery())) or 0
    phrase = (filters.q or "").strip()
    offset = (filters.page - 1) * filters.page_size
    if not phrase or not embeddings_enabled():
        rows = await db.execute(
            filtered.order_by(AiPipelineJob.posted_at.desc(), AiPipelineJob.id.desc())
            .offset(offset)
            .limit(filters.page_size)
        )
        return [(job, None) for job in rows.scalars().all()], total

    rows = await db.execute(
        filtered.order_by(AiPipelineJob.posted_at.desc(), AiPipelineJob.id.desc()).limit(CANDIDATE_CAP)
    )
    candidates = rows.scalars().all()
    vectors = await embed([phrase])
    query_vector = vectors[0] if vectors else None
    if query_vector is None:
        page = candidates[offset : offset + filters.page_size]
        return [(job, None) for job in page], total
    ranked = rank_jobs(candidates, phrase, query_vector)
    page = ranked[offset : offset + filters.page_size]
    return [(job, score) for score, job in page], total


async def accept_job(db: AsyncSession, job_id: int, user: User) -> AcceptResult:
    job = await db.get(AiPipelineJob, job_id)
    if job is None:
        raise JobNotFound
    if job.status == STATUS_DISMISSED:
        raise JobNotAcceptable("Dismissed jobs cannot be accepted")
    if job.status == STATUS_ACCEPTED and job.lead_id:
        return AcceptResult(job_id=job.id, lead_id=job.lead_id, created=False)

    technologies = list(job.technologies or [])
    lead = Lead(
        company=job.company,
        job_title=job.title,
        job_source=job.source,
        technologies=technologies,
        primary_tech=technologies[0] if technologies else None,
        tenant_id=user.tenant_id,
        cluster_head_id=await get_default_cluster_head_id(db, user.tenant_id),
        phase="Applied",
        type="JD Sent",
        status="JD Invite Pending",
        notes=job.url,
    )
    if user.role == UserRole.BD:
        lead.bd_id = user.id
        lead.assigned_by_bd_id = user.id
    db.add(lead)
    await db.flush()
    job.status = STATUS_ACCEPTED
    job.lead_id = lead.id
    await log_audit(db, user.id, "accept", "ai_pipeline_job", job.id, job.url)
    await db.commit()
    await db.refresh(lead)
    return AcceptResult(job_id=job.id, lead_id=lead.id, created=True)


# Longer phrases are listed first so "React Native" is not also counted as React.
_TECH_RULES: tuple[tuple[str, str], ...] = (
    ("React Native", r"react[\s.-]?native"),
    ("Ruby on Rails", r"ruby on rails|\brails\b"),
    ("Node.js", r"node\.?\s?js|\bnodejs\b"),
    ("Next.js", r"next\.?\s?js|\bnextjs\b"),
    ("Machine Learning", r"machine learning|\bml\b"),
    ("TypeScript", r"typescript"),
    ("JavaScript", r"javascript"),
    ("PostgreSQL", r"postgresql|\bpostgres\b"),
    ("MongoDB", r"mongodb|\bmongo\b"),
    ("GraphQL", r"graphql"),
    ("Kubernetes", r"kubernetes|\bk8s\b"),
    ("Elasticsearch", r"elasticsearch"),
    ("TensorFlow", r"tensorflow"),
    ("PyTorch", r"pytorch"),
    ("Express.js", r"express\.?\s?js|\bexpressjs\b"),
    ("Spring", r"spring boot|\bspring\b"),
    ("FastAPI", r"fastapi"),
    ("C++", r"c\+\+"),
    ("C#", r"c#"),
    (".NET", r"\.net\b|\bdotnet\b|\basp\.net\b"),
    ("Django", r"\bdjango\b"),
    ("Flask", r"\bflask\b"),
    ("Laravel", r"\blaravel\b"),
    ("Kotlin", r"\bkotlin\b"),
    ("Golang", r"\bgolang\b"),
    ("Python", r"\bpython\b"),
    ("Java", r"\bjava\b"),
    ("Scala", r"\bscala\b"),
    ("Rust", r"\brust\b"),
    ("Swift", r"\bswift\b"),
    ("Ruby", r"\bruby\b"),
    ("React", r"\breact\b"),
    ("Angular", r"\bangular\b"),
    ("Vue.js", r"\bvue(?:\.js)?\b"),
    ("Android", r"\bandroid\b"),
    ("iOS", r"\bios\b"),
    ("Docker", r"\bdocker\b"),
    ("Kafka", r"\bkafka\b"),
    ("Redis", r"\bredis\b"),
    ("MySQL", r"\bmysql\b"),
    ("Terraform", r"\bterraform\b"),
    ("Shopify", r"\bshopify\b"),
    ("Hadoop", r"\bhadoop\b"),
    ("Spark", r"\bspark\b"),
    ("Azure", r"\bazure\b"),
    ("AWS", r"\baws\b|amazon web services"),
    ("GCP", r"\bgcp\b|google cloud"),
    ("PHP", r"\bphp\b"),
    ("SQL", r"\bsql\b"),
    ("HTML", r"\bhtml\b"),
    ("CSS", r"\bcss\b"),
)
_COMPILED_TECHS = tuple((name, re.compile(pattern, re.IGNORECASE)) for name, pattern in _TECH_RULES)
_STACKS: dict[str, set[str]] = {
    "mern": {"React", "Node.js", "MongoDB", "Express.js"},
    "mean": {"Angular", "Node.js", "MongoDB", "Express.js"},
    "python/django": {"Python", "Django"},
    "django": {"Django", "Python"},
    "ror": {"Ruby", "Ruby on Rails"},
    "rails": {"Ruby on Rails"},
    "ruby on rails": {"Ruby", "Ruby on Rails"},
    "golang": {"Golang"},
    "go": {"Golang"},
    "node": {"Node.js"},
    "nodejs": {"Node.js"},
    "react native": {"React Native"},
    "ml": {"Machine Learning"},
    "ai/ml": {"Machine Learning"},
}
_GH_JOB_ID = re.compile(r"(?:gh_jid=|/jobs/)(\d+)")
_GH_BOARD = re.compile(r"greenhouse\.io/([^/?#]+)/jobs/", re.IGNORECASE)
_SHORT_POSTING = 280
_TECH_LIMIT = 12


def greenhouse_ref(url: str, company: str, boards: Sequence[str] | None = None) -> tuple[str, str] | None:
    """Board token and Greenhouse job id, when the posting URL carries one."""
    found = _GH_JOB_ID.search(url or "")
    if not found:
        return None
    job_id = found.group(1)
    board = _GH_BOARD.search(url or "")
    if board:
        return board.group(1), job_id
    names = list(greenhouse_board_names() if boards is None else boards)
    key = re.sub(r"[^a-z0-9]", "", (company or "").lower())
    for name in names:
        if re.sub(r"[^a-z0-9]", "", name.lower()) == key:
            return name, job_id
    return None


def tech_requirements(text: str, limit: int = _TECH_LIMIT) -> list[TechShare]:
    """Weight each technology by how often the posting names it. Shares sum to 100."""
    spans: list[tuple[int, int, str]] = []
    for name, pattern in _COMPILED_TECHS:
        for match in pattern.finditer(text or ""):
            spans.append((match.start(), match.end(), name))
    spans.sort(key=lambda item: (item[0], -(item[1] - item[0])))
    taken: list[tuple[int, int]] = []
    counts: dict[str, int] = {}
    for start, end, name in spans:
        if any(start < stop and end > begin for begin, stop in taken):
            continue
        taken.append((start, end))
        counts[name] = counts.get(name, 0) + 1
    return _shares(counts, limit)


def _shares(counts: dict[str, int], limit: int) -> list[TechShare]:
    ordered = sorted(counts.items(), key=lambda item: (-item[1], item[0].lower()))
    if len(ordered) > limit:
        shown = ordered[: limit - 1]
        rest = sum(count for _, count in ordered[limit - 1 :])
        ordered = shown + [("Other", rest)]
    total = sum(count for _, count in ordered)
    if total == 0:
        return []
    rows: list[list] = []
    assigned = 0
    for name, count in ordered:
        exact = count / total * 1000
        base = int(exact)
        rows.append([name, count, base, exact - base])
        assigned += base
    ranked = sorted(range(len(rows)), key=lambda index: (-rows[index][3], rows[index][0].lower()))
    leftover = 1000 - assigned
    step = 1 if leftover >= 0 else -1
    for index in range(abs(leftover)):
        row = rows[ranked[index % len(rows)]]
        row[2] = max(0, row[2] + step)
    rows.sort(key=lambda item: (-item[2], item[0].lower()))
    return [TechShare(name, count, base / 10) for name, count, base, _ in rows]


def skills_from_labels(labels: list[str]) -> set[str]:
    found: set[str] = set()
    for label in labels:
        text = str(label or "").strip()
        if not text:
            continue
        pieces = [text, *[part.strip() for part in re.split(r"[,|/]", text) if part.strip()]]
        for piece in pieces:
            expanded = _STACKS.get(piece.lower())
            if expanded:
                found.update(expanded)
            found.update(item.name for item in tech_requirements(piece, limit=30) if item.name != "Other")
    return found


def suggest_engineers(
    requirements: list[TechShare],
    people: Sequence[tuple[int, str, str | None, list[str]]],
    limit: int = 8,
) -> list[EngineerSuggestion]:
    """Coverage is the share of the posting's tech weight the engineer already works in."""
    if not requirements:
        return []
    weight = {item.name: item.percent for item in requirements}
    order = [item.name for item in requirements if item.name != "Other"]
    suggestions: list[EngineerSuggestion] = []
    for engineer_id, name, devsinc_id, labels in people:
        skills = skills_from_labels(labels)
        matched = [tech for tech in order if tech in skills]
        if not matched:
            continue
        coverage = round(sum(weight[tech] for tech in matched), 1)
        suggestions.append(EngineerSuggestion(engineer_id, name, devsinc_id, coverage, matched))
    suggestions.sort(key=lambda item: (-item.match_percent, item.name.lower()))
    return suggestions[:limit]


async def posting_text(job: AiPipelineJob, fetch: FetchFn = fetch_feed) -> str:
    """Use the stored description. Greenhouse list rows only keep a location, so load the posting."""
    excerpt = job.excerpt or ""
    ref = greenhouse_ref(job.url, job.company)
    if ref and len(excerpt) < _SHORT_POSTING:
        board, job_id = ref
        url = f"https://boards-api.greenhouse.io/v1/boards/{board}/jobs/{job_id}"
        try:
            payload = json.loads(await fetch(url, timeout=15) if fetch is fetch_feed else await fetch(url))
            content = _plain(html.unescape(str(payload.get("content") or "")))
            if content:
                return f"{job.title}\n{content}"
        except (httpx.HTTPError, ValueError, OSError, TypeError, KeyError) as exc:
            logger.warning("AI pipeline job text skipped (%s): %s", url, exc)
    return f"{job.title}\n{excerpt}"


async def _engineer_rows(db: AsyncSession) -> list[tuple[int, str, str | None, list[str]]]:
    users = (
        await db.execute(select(User).where(User.role == UserRole.ENGINEER, User.is_active.is_(True)))
    ).scalars().all()
    if not users:
        return []
    ids = [user.id for user in users]
    labels: dict[int, list[str]] = {user.id: [] for user in users}
    profiles = await db.execute(
        select(Profile.assigned_engineer_id, Profile.primary_tech_stack).where(Profile.assigned_engineer_id.in_(ids))
    )
    for engineer_id, stack in profiles.all():
        if engineer_id in labels and stack:
            labels[engineer_id].append(stack)
    leads = await db.execute(
        select(Lead.assigned_engineer_id, Lead.primary_tech, Lead.technologies).where(Lead.assigned_engineer_id.in_(ids))
    )
    for engineer_id, primary, technologies in leads.all():
        if engineer_id not in labels:
            continue
        if primary:
            labels[engineer_id].append(primary)
        labels[engineer_id].extend(str(item) for item in (technologies or []) if item)
    targets = await db.execute(
        select(MonthlyTarget.engineer_id, MonthlyTarget.tech_stack_focus).where(MonthlyTarget.engineer_id.in_(ids))
    )
    for engineer_id, focus in targets.all():
        if engineer_id in labels and focus:
            labels[engineer_id].append(focus)
    return [(user.id, user.full_name, user.devsinc_id, labels[user.id]) for user in users]


async def job_match(db: AsyncSession, job: AiPipelineJob, fetch: FetchFn = fetch_feed) -> JobMatch:
    requirements = tech_requirements(await posting_text(job, fetch))
    engineers = suggest_engineers(requirements, await _engineer_rows(db))
    return JobMatch(job=job, tech_stack=requirements, suggested_engineers=engineers)


async def job_detail(db: AsyncSession, job_id: int, fetch: FetchFn = fetch_feed) -> JobMatch:
    job = await db.get(AiPipelineJob, job_id)
    if job is None:
        raise JobNotFound
    return await job_match(db, job, fetch)


async def job_detail_for_lead(db: AsyncSession, lead_id: int, fetch: FetchFn = fetch_feed) -> JobMatch:
    job = await db.scalar(select(AiPipelineJob).where(AiPipelineJob.lead_id == lead_id))
    if job is None:
        raise JobNotFound
    return await job_match(db, job, fetch)


def run_daily_ingest() -> int:
    return asyncio.run(_run_daily())


async def _run_daily() -> int:
    from app.core.database import AsyncSessionLocal, engine

    from app.pipeline.refresh import SCHEDULED, RefreshBlocked, execute_run, start_run

    try:
        async with AsyncSessionLocal() as db:
            try:
                run = await start_run(db, None, SCHEDULED)
            except RefreshBlocked:
                return 0  # a refresh is already running
        return await execute_run(run.id, AsyncSessionLocal)
    finally:
        await engine.dispose()
