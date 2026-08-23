"""
DeadLetterEntry model – tombstone for permanently failed jobs.

When a job exhausts all retries, it transitions to ``dead`` status and a
corresponding ``DeadLetterEntry`` is created to preserve the failure context.
The entry stores the final payload snapshot so it remains available even if
the original job payload is later modified by a retry/replay mechanism.

The ``job_id`` column is unique – one dead-letter entry per job.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any, Dict
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BaseModel

if TYPE_CHECKING:
    from app.models.job import Job


class DeadLetterEntry(BaseModel, Base):
    __tablename__ = "dead_letter_entries"

    job_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    failed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    reason: Mapped[str] = mapped_column(Text, nullable=False)

    final_payload: Mapped[Dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------
    job: Mapped["Job"] = relationship(
        "Job",
        back_populates="dead_letter_entry",
    )

    def __repr__(self) -> str:
        return f"<DeadLetterEntry(id={self.id!r}, job_id={self.job_id!r})>"
