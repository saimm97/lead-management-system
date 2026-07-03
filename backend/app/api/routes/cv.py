from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.api.deps import get_current_user
from app.core.config import settings
from app.models.user import User
from app.services import cv_ats

router = APIRouter(prefix="/cv", tags=["cv"])

MAX_BYTES = 5 * 1024 * 1024  # 5 MB per file


@router.get("/status")
async def cv_status(user: User = Depends(get_current_user)):
    return {"configured": cv_ats.is_configured(), "model": settings.llm_model or "OpenRouter account default"}


@router.post("/analyze")
async def analyze_cv(
    jd_text: str = Form(...),
    cv_file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    if not cv_ats.is_configured():
        raise HTTPException(status_code=503, detail="CV analysis is not configured. Set LLM_API_KEY on the server.")

    if not jd_text.strip():
        raise HTTPException(status_code=400, detail="Please paste the job description.")
    cv_bytes = await cv_file.read()
    if not cv_bytes:
        raise HTTPException(status_code=400, detail="The CV file is required and must be non-empty.")
    if len(cv_bytes) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="The CV file must be under 5 MB.")

    try:
        cv_text = cv_ats.extract_text(cv_file.filename or "cv", cv_bytes)
        result = await cv_ats.analyze(jd_text, cv_text)
    except cv_ats.CvAtsError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return result
