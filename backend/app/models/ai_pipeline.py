from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, ForeignKey, Integer, String, Text, TypeDecorator, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

STATUS_NEW = "new"
STATUS_ACCEPTED = "accepted"
STATUS_DISMISSED = "dismissed"


class Embedding(TypeDecorator):
    """pgvector column on Postgres, JSON on other dialects (tests)."""

    impl = JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from pgvector.sqlalchemy import Vector

            from app.core.config import settings

            return dialect.type_descriptor(Vector(settings.llm_embedding_dim))
        return dialect.type_descriptor(JSON())


class AiPipelineJob(Base):
    __tablename__ = "ai_pipeline_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company: Mapped[str] = mapped_column(String(255))
    title: Mapped[str] = mapped_column(String(500))
    source: Mapped[str] = mapped_column(String(100), index=True)
    url: Mapped[str] = mapped_column(String(1000), unique=True, index=True)
    posted_at: Mapped[date] = mapped_column(Date, index=True)
    expires_at: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    technologies: Mapped[list] = mapped_column(JSON, default=list)
    location: Mapped[str] = mapped_column(String(500), default="")
    countries: Mapped[list] = mapped_column(JSON, default=list)
    excerpt: Mapped[str] = mapped_column(Text, default="")
    embedding: Mapped[list | None] = mapped_column(Embedding(), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=STATUS_NEW, index=True)
    lead_id: Mapped[int | None] = mapped_column(ForeignKey("leads.id"), nullable=True)
    # Board-sourced jobs. Feed-sourced rows leave these empty.
    ats: Mapped[str | None] = mapped_column(String(30), nullable=True, index=True)
    external_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    board_id: Mapped[int | None] = mapped_column(ForeignKey("pipeline_boards.id"), nullable=True, index=True)
    scope: Mapped[str | None] = mapped_column(String(20), nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    missed_fetches: Mapped[int] = mapped_column(Integer, default=0)
    closed_at: Mapped[date | None] = mapped_column(Date, nullable=True)


class PipelineBoard(Base):
    """One company job board on a public ATS. Seeded from lead company names, then probed."""

    __tablename__ = "pipeline_boards"
    __table_args__ = (UniqueConstraint("ats", "slug", name="uq_pipeline_board_ats_slug"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ats: Mapped[str] = mapped_column(String(30), index=True)
    slug: Mapped[str] = mapped_column(String(150))
    company: Mapped[str] = mapped_column(String(255))
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_complete_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_error: Mapped[str | None] = mapped_column(String(300), nullable=True)
    consecutive_failures: Mapped[int] = mapped_column(Integer, default=0)
    job_count: Mapped[int] = mapped_column(Integer, default=0)


class PipelineRun(Base):
    """One ingest run, manual (Refresh button) or scheduled. Used for the lock, cooldown and history."""

    __tablename__ = "pipeline_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    trigger: Mapped[str] = mapped_column(String(20), default="manual")  # manual | scheduled
    status: Mapped[str] = mapped_column(String(20), default="running", index=True)  # running | success | failed
    triggered_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    stats: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error: Mapped[str | None] = mapped_column(String(500), nullable=True)
