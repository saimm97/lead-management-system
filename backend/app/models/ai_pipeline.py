from datetime import date

from sqlalchemy import JSON, Date, ForeignKey, Integer, String, Text, TypeDecorator
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
