"""
Models package – imports every model so that Alembic and
``Base.metadata`` can discover all tables.

Import this package (``from app.models import *``) in ``alembic/env.py``
to ensure autogenerate picks up every table.
"""

from app.models.base import Base, BaseModel  # noqa: F401
from app.models.dead_letter_entry import DeadLetterEntry  # noqa: F401
from app.models.job import Job, JobStatus  # noqa: F401
from app.models.job_execution import ExecutionStatus, JobExecution  # noqa: F401
from app.models.job_log import JobLog, LogLevel  # noqa: F401
from app.models.organization import Organization  # noqa: F401
from app.models.project import Project  # noqa: F401
from app.models.queue import Queue  # noqa: F401
from app.models.user import User, UserRole  # noqa: F401
from app.models.worker import Worker, WorkerStatus  # noqa: F401

__all__ = [
    "Base",
    "BaseModel",
    "Organization",
    "User",
    "UserRole",
    "Project",
    "Queue",
    "Job",
    "JobStatus",
    "JobExecution",
    "ExecutionStatus",
    "Worker",
    "WorkerStatus",
    "JobLog",
    "LogLevel",
    "DeadLetterEntry",
]
