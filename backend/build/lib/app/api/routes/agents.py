from fastapi import APIRouter, Depends

from app.agents.base import (
    EnrichLeadRequest,
    EnrichLeadResponse,
    LeadEnrichmentAgent,
    StatusSuggestionAgent,
    SuggestStatusRequest,
    SuggestStatusResponse,
)
from app.api.deps import require_roles
from app.core.enums import UserRole
from app.models.user import User

router = APIRouter(prefix="/agents", tags=["agents"])


@router.post("/enrich-lead", response_model=EnrichLeadResponse)
async def enrich_lead(
    data: EnrichLeadRequest,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.BD)),
):
    agent = LeadEnrichmentAgent()
    return await agent.run(data.job_title, data.job_description)


@router.post("/suggest-status", response_model=SuggestStatusResponse)
async def suggest_status(
    data: SuggestStatusRequest,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ENGINEER)),
):
    agent = StatusSuggestionAgent()
    return await agent.run(data.current_phase, data.current_type, data.current_status, data.notes)
