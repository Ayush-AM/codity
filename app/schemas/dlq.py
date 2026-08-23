"""
Pydantic schemas for Dead Letter Queue (DLQ) entries and replay.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict

from pydantic import BaseModel


class DeadLetterEntryResponse(BaseModel):
    """Public representation of a Dead Letter Queue entry."""

    id: uuid.UUID
    job_id: uuid.UUID
    failed_at: datetime
    reason: str
    final_payload: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
