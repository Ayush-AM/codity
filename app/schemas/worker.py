"""
Pydantic schemas for Worker monitoring and heartbeat inspection.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.worker import WorkerStatus


class WorkerResponse(BaseModel):
    """Public representation of a registered Worker."""

    id: uuid.UUID
    queue_id: Optional[uuid.UUID]
    hostname: str
    pid: int
    status: WorkerStatus
    last_heartbeat_at: datetime
    concurrent_tasks: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
