import enum


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    BD = "bd"
    ENGINEER = "engineer"


class ApprovalStatus(str, enum.Enum):
    APPROVED = "approved"
    PENDING = "pending"
    REJECTED = "rejected"


class IssuePriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class IssueStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class IssueCategory(str, enum.Enum):
    LEAD_QUALITY = "lead_quality"
    ASSIGNMENT = "assignment"
    PROFILE = "profile"
    CLIENT = "client"
    TECHNICAL = "technical"
    OTHER = "other"


class ReportType(str, enum.Enum):
    WEEKLY = "weekly"
    MONTHLY = "monthly"
