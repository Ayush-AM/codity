"""
Base model mixin and DeclarativeBase for all ORM models.

Provides:
- ``Base``: The SQLAlchemy 2.0 DeclarativeBase every model inherits from.
- ``BaseModel``: A mixin that injects ``id``, ``created_at``, and ``updated_at``
  columns so every table gets them automatically.

Usage::

    class User(BaseModel, Base):
        __tablename__ = "users"
        email: Mapped[str] = mapped_column(String(320), unique=True)
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Root DeclarativeBase – all models inherit from this."""

    pass


class BaseModel:
    """
    Mixin that adds surrogate UUID primary key and audit timestamps.

    Columns
    -------
    id : UUID
        Primary key defaulting to ``uuid4()``.
    created_at : datetime
        Row-creation timestamp (server-side ``now()``).
    updated_at : datetime
        Last-modification timestamp (server-side ``now()`` with ``onupdate``).
    """

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
