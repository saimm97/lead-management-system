from pydantic import BaseModel


class DashboardKPIs(BaseModel):
    total_leads: int
    new_today: int
    qualified: int
    followups_due: int
    followups_overdue: int
    conversion_rate: float
    revenue_pipeline: float


class PipelineStage(BaseModel):
    stage: str
    count: int


class SourcePerformance(BaseModel):
    source: str
    count: int


class RepPerformance(BaseModel):
    name: str
    devsinc_id: str | None = None
    count: int


class FunnelStage(BaseModel):
    stage: str
    count: int


class MonthlyReportData(BaseModel):
    outcomes: dict[str, int]
    funnel: list[FunnelStage]
    source_performance: list[SourcePerformance]
    engineer_performance: list[dict]
    profile_health: dict[str, int]
    issues_summary: dict[str, int]


class WeeklyReportData(BaseModel):
    new_leads: int
    status_changes: list[dict]
    overdue_followups: int
    target_progress: list[dict]
    open_issues: dict[str, int]
