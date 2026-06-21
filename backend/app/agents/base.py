from abc import ABC, abstractmethod

from pydantic import BaseModel


class EnrichLeadRequest(BaseModel):
    job_title: str
    job_description: str | None = None


class EnrichLeadResponse(BaseModel):
    suggested_technologies: list[str]
    primary_tech: str | None
    confidence: float


class SuggestStatusRequest(BaseModel):
    current_phase: str
    current_type: str
    current_status: str
    notes: str | None = None


class SuggestStatusResponse(BaseModel):
    suggested_phase: str
    suggested_type: str
    suggested_status: str
    reasoning: str


class BaseAgent(ABC):
    @abstractmethod
    async def run(self, *args, **kwargs):
        pass


class LeadEnrichmentAgent(BaseAgent):
    async def run(self, job_title: str, job_description: str | None = None) -> EnrichLeadResponse:
        tech_map = {
            "node": ("MERN", ["Node.js", "React", "MongoDB"]),
            "python": ("Python", ["Python", "Django"]),
            "django": ("Python/Django", ["Python", "Django"]),
            "ruby": ("Ruby on Rails", ["Ruby", "Rails"]),
            "java": ("Java", ["Java", "Spring"]),
        }
        title_lower = job_title.lower()
        for key, (primary, techs) in tech_map.items():
            if key in title_lower:
                return EnrichLeadResponse(suggested_technologies=techs, primary_tech=primary, confidence=0.7)
        return EnrichLeadResponse(suggested_technologies=[], primary_tech=None, confidence=0.0)


class StatusSuggestionAgent(BaseAgent):
    async def run(self, phase: str, type_: str, status: str, notes: str | None = None) -> SuggestStatusResponse:
        return SuggestStatusResponse(
            suggested_phase=phase,
            suggested_type=type_,
            suggested_status=status,
            reasoning="LLM integration pending. Configure LLM_API_KEY to enable AI suggestions.",
        )


class ReportNarrativeAgent(BaseAgent):
    async def run(self, report_data: dict) -> str:
        return "Weekly summary: Lead activity continues across the team. Configure LLM for AI-generated narratives."


class AssignmentAgent(BaseAgent):
    async def run(self, tech_stack: str, engineers: list[dict]) -> dict | None:
        if not engineers:
            return None
        return engineers[0]
