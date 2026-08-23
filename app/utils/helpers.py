"""
Helper functions for string transformation, slugification, and formatting.
"""

from __future__ import annotations

import re
import unicodedata


def slugify(text: str) -> str:
    """
    Convert text to a URL-friendly slug.
    Example: "Acme Corp Inc." -> "acme-corp-inc"
    """
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("utf-8")
    text = re.sub(r"[^\w\s-]", "", text).lower().strip()
    text = re.sub(r"[-\s]+", "-", text)
    return text or "org"
