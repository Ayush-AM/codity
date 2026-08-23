"""
JobLog model – structured log entries emitted during job execution.

Provides queryable, per-job logging with severity levels and optional
JSONB metadata (e.g., stack traces, context variables).
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Any, Dict, Optional
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BaseModel

if TYPE_CHECKING:
    from app.models.job import Job


class LogLevel(str, enum.Enum):
    """Log severity levels."""

    info = "info"
    warning = "warning"
    error = "error"


class JobLog(BaseModel, Base):
    __tablename__ = "job_logs"

    job_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    level: Mapped[LogLevel] = mapped_column(
        Enum(LogLevel, name="log_level", create_constraint=True),
        default=LogLevel.info,
        nullable=False,
    )

    message: Mapped[str] = mapped_column(Text, nullable=False)

    metadata_: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        "metadata",
        JSONB,
        nullable=True,
        default=None,
    )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------
    job: Mapped["Job"] = relationship(
        "Job",
        back_populates="logs",
    )

    # ------------------------------------------------------------------
    # Performance indexes
    # ------------------------------------------------------------------
    __table_args__ = (
        Index("ix_job_logs_job_timestamp", "job_id", "timestamp"),
    )

    def __repr__(self) -> str:
        return f"<JobLog(id={self.id!r}, level={self.level!r})>"
