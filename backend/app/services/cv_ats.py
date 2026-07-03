"""CV / ATS optimization using an OpenAI-compatible LLM (e.g. Zhipu GLM).

Set LLM_API_KEY (and optionally LLM_BASE_URL / LLM_MODEL) to enable.
File parsing libs (pypdf, python-docx) are imported lazily.
"""
from __future__ import annotations

import asyncio
import io
import json
import re

import httpx

from app.core.config import settings


class CvAtsError(Exception):
    pass


def is_configured() -> bool:
    return bool(settings.llm_api_key)


def extract_text(filename: str, content: bytes) -> str:
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        return _extract_pdf(content)
    if name.endswith(".docx"):
        return _extract_docx(content)
    if name.endswith((".txt", ".md")):
        return content.decode("utf-8", errors="ignore")
    # Fall back to best-effort decode (covers pasted plain text uploads).
    try:
        return content.decode("utf-8")
    except UnicodeDecodeError:
        raise CvAtsError(f"Unsupported file type: {filename}. Upload PDF, DOCX, or TXT.")


def _extract_pdf(content: bytes) -> str:
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise CvAtsError("PDF support requires: pip install pypdf") from exc
    reader = PdfReader(io.BytesIO(content))
    return "\n".join((page.extract_text() or "") for page in reader.pages).strip()


def _extract_docx(content: bytes) -> str:
    try:
        import docx  # python-docx
    except ImportError as exc:
        raise CvAtsError("DOCX support requires: pip install python-docx") from exc
    document = docx.Document(io.BytesIO(content))
    return "\n".join(p.text for p in document.paragraphs).strip()


SYSTEM_PROMPT = (
    "You are an expert technical recruiter and ATS (Applicant Tracking System) optimization "
    "specialist. You analyze a candidate CV against a specific job description and produce a "
    "structured assessment plus an ATS-optimized rewrite. Respond with ONLY valid JSON, no prose."
)

USER_TEMPLATE = """Analyze the following CV against the job description.

Return a JSON object with EXACTLY these keys:
- "ats_score": integer 0-100 (how well the CV matches the JD for ATS)
- "summary": 2-3 sentence overall assessment
- "matched_keywords": array of important JD keywords/skills found in the CV
- "missing_keywords": array of important JD keywords/skills missing from the CV
- "issues": array of concrete problems (formatting, gaps, weak phrasing, missing metrics, etc.)
- "strengths": array of the CV's strong points relative to the JD
- "recommendations": array of specific, actionable improvements
- "optimized_cv": a full ATS-optimized rewrite of the CV as plain text/markdown, tailored to the
  JD, incorporating missing keywords truthfully and using strong action verbs and quantified impact.

=== JOB DESCRIPTION ===
{jd}

=== CANDIDATE CV ===
{cv}
"""


async def analyze(jd_text: str, cv_text: str) -> dict:
    if not is_configured():
        raise CvAtsError("LLM is not configured. Set LLM_API_KEY (and optionally LLM_BASE_URL / LLM_MODEL).")
    if not jd_text.strip() or not cv_text.strip():
        raise CvAtsError("Both the job description and CV must contain readable text.")

    payload: dict = {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": USER_TEMPLATE.format(jd=jd_text[:20000], cv=cv_text[:20000])},
        ],
        "temperature": 0.3,
    }
    url = f"{settings.llm_base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.llm_api_key}",
        "Content-Type": "application/json",
        # Optional attribution headers recommended by OpenRouter (ignored by other providers).
        "HTTP-Referer": settings.frontend_url,
        "X-Title": "LeadPro CV Optimizer",
    }

    # LLM_MODEL may be a comma-separated fallback chain (e.g. "gemini-2.0-flash,gemini-2.5-flash-lite").
    # An empty value means "omit the model" (lets OpenRouter use the account default).
    models = [m.strip() for m in (settings.llm_model or "").split(",") if m.strip()] or [None]
    # Statuses worth retrying / falling through on: rate limit & transient overload.
    RETRY_STATUSES = {408, 429, 500, 502, 503, 529}

    content = None
    last_error = "No model produced a response."
    async with httpx.AsyncClient(timeout=120) as client:
        for model in models:
            body = dict(payload)
            if model:
                body["model"] = model
            for attempt in range(3):
                try:
                    resp = await client.post(url, json=body, headers=headers)
                except httpx.HTTPError as exc:
                    last_error = f"Could not reach the LLM endpoint: {exc}"
                    break  # network problem — try the next model
                if resp.status_code < 400:
                    try:
                        content = resp.json()["choices"][0]["message"]["content"]
                    except (KeyError, IndexError, TypeError, ValueError):
                        last_error = "Unexpected LLM response shape."
                        content = None
                    break
                last_error = f"LLM request failed ({resp.status_code}): {resp.text[:300]}"
                if resp.status_code in RETRY_STATUSES and attempt < 2:
                    await asyncio.sleep(1.5 * (attempt + 1))
                    continue  # retry same model
                break  # non-retryable (e.g. 401/404) — move to next model
            if content is not None:
                break

    if content is None:
        raise CvAtsError(last_error)

    parsed = _parse_json(content)
    if parsed is None:
        # Model didn't return clean JSON — surface the raw text so the user still gets value.
        return {
            "ats_score": None,
            "summary": "The model returned an unstructured response.",
            "matched_keywords": [],
            "missing_keywords": [],
            "issues": [],
            "strengths": [],
            "recommendations": [],
            "optimized_cv": content,
        }
    return parsed


def _parse_json(text: str) -> dict | None:
    text = text.strip()
    # Strip ```json ... ``` fences if present.
    fence = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.DOTALL)
    if fence:
        text = fence.group(1)
    else:
        brace = re.search(r"\{.*\}", text, re.DOTALL)
        if brace:
            text = brace.group(0)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None
