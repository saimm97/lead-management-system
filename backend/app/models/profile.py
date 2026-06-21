from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.user import utcnow


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tenant_id: Mapped[int | None] = mapped_column(ForeignKey("tenants.id"), nullable=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255))
    linkedin_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    linkedin_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    github_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    github_present: Mapped[bool] = mapped_column(Boolean, default=False)
    primary_tech_stack: Mapped[str | None] = mapped_column(String(100), nullable=True)
    assigned_engineer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    verified_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    leads = relationship("Lead", back_populates="profile")


class MonthlyTarget(Base):
    __tablename__ = "monthly_targets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    target_start_date: Mapped[date] = mapped_column(Date, index=True)
    target_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    engineer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    lead_target: Mapped[int] = mapped_column(Integer)
    tech_stack_focus: Mapped[str] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
