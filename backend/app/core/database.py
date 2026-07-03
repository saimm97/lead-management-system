from collections.abc import AsyncGenerator
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


def _normalize_db_url(url: str) -> tuple[str, dict]:
    """Make hosted-Postgres URLs work with the async (asyncpg) engine.

    Vercel Postgres / Neon / Supabase hand out URLs like
    `postgres://user:pass@host/db?sslmode=require`. SQLAlchemy would route the
    bare `postgres[ql]://` scheme to psycopg2 (hence "psycopg2 not found"), and
    asyncpg doesn't understand the `sslmode`/`channel_binding` query params.
    This forces the asyncpg driver and translates SSL correctly.
    """
    connect_args: dict = {}
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://"):]

    if url.startswith("postgresql+asyncpg://"):
        parts = urlsplit(url)
        if parts.query:
            q = dict(parse_qsl(parts.query))
            sslmode = q.pop("sslmode", None)
            q.pop("channel_binding", None)  # not supported by asyncpg
            if sslmode and sslmode not in ("disable", "allow"):
                connect_args["ssl"] = True
            url = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(q), parts.fragment))
    return url, connect_args


_db_url, _connect_args = _normalize_db_url(settings.database_url)
engine = create_async_engine(_db_url, echo=False, pool_pre_ping=True, connect_args=_connect_args)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
