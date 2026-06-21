from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.user import utcnow


class LeadStatusConfig(Base):
    __tablename__ = "lead_status_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    phase: Mapped[str] = mapped_column(String(100), index=True)
    type: Mapped[str] = mapped_column(String(100), index=True)
    status: Mapped[str] = mapped_column(String(100), index=True)
    is_terminal: Mapped[bool] = mapped_column(Boolean, default=False)
    report_bucket: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class LeadDropdownOption(Base):
    __tablename__ = "lead_dropdown_options"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category: Mapped[str] = mapped_column(String(50), index=True)
    label: Mapped[str] = mapped_column(String(100))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tenant_id: Mapped[int | None] = mapped_column(ForeignKey("tenants.id"), nullable=True, index=True)
    company: Mapped[str] = mapped_column(String(255))
    job_title: Mapped[str] = mapped_column(String(500))
    job_source: Mapped[str] = mapped_column(String(100))
    technologies: Mapped[list] = mapped_column(JSON, default=list)
    primary_tech: Mapped[str | None] = mapped_column(String(100), nullable=True)
    jd_invite_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    jd_invite_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    achieved_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    assigned_engineer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    cluster_head_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    assigned_by_bd_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    profile_id: Mapped[int | None] = mapped_column(ForeignKey("profiles.id"), nullable=True)
    bd_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    phase: Mapped[str] = mapped_column(String(100), default="Applied")
    type: Mapped[str] = mapped_column(String(100), default="JD Sent")
    status: Mapped[str] = mapped_column(String(100), default="JD Invite Pending")
    interview_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    interview_round: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    profile = relationship("Profile", back_populates="leads")
    history = relationship("LeadStatusHistory", back_populates="lead", order_by="LeadStatusHistory.created_at.desc()")


class LeadStatusHistory(Base):
    __tablename__ = "lead_status_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id"), index=True)
    changed_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    old_phase: Mapped[str | None] = mapped_column(String(100), nullable=True)
    old_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    old_status: Mapped[str | None] = mapped_column(String(100), nullable=True)
    new_phase: Mapped[str] = mapped_column(String(100))
    new_type: Mapped[str] = mapped_column(String(100))
    new_status: Mapped[str] = mapped_column(String(100))
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    lead = relationship("Lead", back_populates="history")
