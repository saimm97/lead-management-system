"""Title and technology helpers shared by the board adapters."""

from __future__ import annotations

import html
import re

from app.services.ai_pipeline import is_technical_job, tech_requirements

__all__ = ["is_technical_job", "detect_technologies", "html_to_text"]

_TAGS = re.compile(r"<[^>]+>")
_BREAKS = re.compile(r"</?(p|br|li|ul|ol|div|h[1-6])\b[^>]*>", re.I)
_SPACE = re.compile(r"[ \t\r\f\v]+")
_BLANKS = re.compile(r"\n\s*\n+")


def html_to_text(value: object) -> str:
    """Plain text from a posting body. Greenhouse sends it HTML-escaped, so unescape first."""
    text = html.unescape(str(value or ""))
    text = _BREAKS.sub("\n", text)
    text = _TAGS.sub(" ", html.unescape(text))
    text = _SPACE.sub(" ", text)
    return _BLANKS.sub("\n", text).strip()


def detect_technologies(title: str, description: str = "", limit: int = 12) -> list[str]:
    """Technology names found in the title and description, most-mentioned first."""
    shares = tech_requirements(f"{title}\n{description}", limit=limit)
    return [share.name for share in shares if share.name != "Other"]
