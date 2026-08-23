"""
Pydantic schemas for structured JobLog audit trails.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.models.job_log import LogLevel


class LogResponse(BaseModel):
    """Public representation of a structured job log entry."""

    id: uuid.UUID
    job_id: uuid.UUID
    timestamp: datetime
    level: LogLevel
    message: str
    metadata_: Optional[Dict[str, Any]] = Field(default=None, serialization_alias="metadata")
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True,
        "populate_by_name": True,
    }


class LogListResponse(BaseModel):
    """Paginated list of job logs."""

    items: List[LogResponse]
    total: int
    skip: int
    limit: int
