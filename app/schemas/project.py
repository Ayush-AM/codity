"""
Pydantic schemas for project request/response.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    """Create a new project within the current organization."""

    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class ProjectResponse(BaseModel):
    """Public project representation."""

    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    description: Optional[str]
    api_key: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}
