"""
Pydantic schemas for Queue operations and Retry Policy validation.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, Field, field_validator


class RetryPolicySchema(BaseModel):
    """
    Schema for Queue retry policy stored in JSONB.
    Supported strategies: 'fixed', 'linear', 'exponential'.
    """

    strategy: Literal["fixed", "linear", "exponential"] = "fixed"
    base_delay: int = Field(default=60, description="Base delay in seconds (must be > 0)")
    max_retries: int = Field(default=3, description="Maximum retry attempts (must be >= 0)")

    @field_validator("base_delay")
    @classmethod
    def validate_base_delay(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("base_delay must be strictly greater than 0 seconds")
        return v

    @field_validator("max_retries")
    @classmethod
    def validate_max_retries(cls, v: int) -> int:
        if v < 0:
            raise ValueError("max_retries must be greater than or equal to 0")
        return v


class QueueCreate(BaseModel):
    """Payload to create a new queue in a project."""

    name: str = Field(..., min_length=1, max_length=255, description="Unique queue name within the project")
    description: Optional[str] = Field(None, max_length=1000)
    priority: int = Field(default=0, description="Default priority for jobs (lower integer = higher priority)")
    concurrency_limit: int = Field(default=5, ge=1, description="Max concurrent jobs executing from this queue")
    retry_policy: RetryPolicySchema = Field(
        default_factory=lambda: RetryPolicySchema(strategy="fixed", base_delay=60, max_retries=3)
    )


class QueueUpdate(BaseModel):
    """Payload to update an existing queue (all fields optional)."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    priority: Optional[int] = None
    concurrency_limit: Optional[int] = Field(None, ge=1)
    retry_policy: Optional[RetryPolicySchema] = None
    is_paused: Optional[bool] = None


class QueueResponse(BaseModel):
    """Public representation of a queue."""

    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    description: Optional[str]
    priority: int
    concurrency_limit: int
    retry_policy: RetryPolicySchema
    is_paused: bool
    created_at: datetime
    updated_at: datetime
    job_count: int = 0

    model_config = {"from_attributes": True}
