"""Find which companies have a public board on Greenhouse, Lever or Ashby.

Run on a machine with normal internet access:
    python -m app.pipeline.probe              # company names from existing leads + GREENHOUSE_BOARDS
    python -m app.pipeline.probe --limit 200  # first 200 names only
    python -m app.pipeline.probe --names "Stripe,Figma"

Only public, unauthenticated endpoints are called. A 404 means "no board" and is not an error.
"""

from __future__ import annotations

import argparse
import asyncio
import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.ai_pipeline import PipelineBoard
from app.pipeline.sources import ADAPTERS
from app.pipeline.sources.base import BoardNotFound

_SUFFIX = re.compile(r"\b(inc|llc|ltd|limited|corp|corporation|co|company|gmbh|plc|technologies|technology|group|holdings)\b\.?", re.I)


def slug_candidates(company: str) -> list[str]:
    """Likely board slugs for a company name, most likely first."""
    base = _SUFFIX.sub(" ", company.lower())
    words = re.findall(r"[a-z0-9]+", base)
    if not words:
        return []
    out = ["".join(words), "-".join(words)]
    if len(words) > 1:
        out.append(words[0])
    seen: list[str] = []
    for slug in out:
        if slug not in seen:
            seen.append(slug)
    return seen


async def probe_company(company: str, adapters: dict | None = None) -> list[tuple[str, str]]:
    """Return (ats, slug) pairs that answered with a valid board."""
    adapters = adapters or ADAPTERS
    found: list[tuple[str, str]] = []
    for ats, adapter in adapters.items():
        for slug in slug_candidates(company):
            try:
                result = await adapter(slug, company)
            except BoardNotFound:
                continue
            except Exception:
                continue
            if result.complete:
                found.append((ats, slug))
                break
    return found


async def save_boards(db: AsyncSession, company: str, hits: list[tuple[str, str]]) -> int:
    added = 0
    for ats, slug in hits:
        exists = await db.scalar(select(PipelineBoard.id).where(PipelineBoard.ats == ats, PipelineBoard.slug == slug))
        if exists is None:
            db.add(PipelineBoard(ats=ats, slug=slug, company=company))
            added += 1
    await db.commit()
    return added


async def company_names(db: AsyncSession) -> list[str]:
    from app.models.lead import Lead

    rows = await db.execute(select(Lead.company).where(Lead.company.isnot(None)).distinct())
    names = {r.strip() for r in rows.scalars() if r and r.strip()}
    names.update(b.strip() for b in settings.greenhouse_boards.split(",") if b.strip())
    return sorted(names, key=str.lower)


async def main(limit: int | None, names: list[str] | None, concurrency: int = 6) -> None:
    from app.core.database import AsyncSessionLocal, engine

    try:
        async with AsyncSessionLocal() as db:
            todo = names or await company_names(db)
            if limit:
                todo = todo[:limit]
            gate = asyncio.Semaphore(concurrency)

            async def one(name: str):
                async with gate:
                    return name, await probe_company(name)

            added = 0
            for name, hits in await asyncio.gather(*(one(n) for n in todo)):
                if hits:
                    added += await save_boards(db, name, hits)
                    print(f"  found  {name}: {', '.join(f'{a}/{s}' for a, s in hits)}")
            print(f"Checked {len(todo)} names, added {added} boards.")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--names", help="comma-separated company names instead of reading leads")
    args = parser.parse_args()
    asyncio.run(main(args.limit, [n.strip() for n in args.names.split(",")] if args.names else None))
