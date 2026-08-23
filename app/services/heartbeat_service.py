"""
Worker Heartbeat and Lifecycle Service.

Manages registration, regular heartbeat updates, and graceful deregistration.
"""

from __future__ import annotations

import os
from typing import List, Optional
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.worker import Worker, WorkerStatus


def register_worker(
    queue_id: Optional[UUID],
    db: Session,
) -> Worker:
    """Register a new worker process in the database upon startup."""
    worker = Worker(
        queue_id=queue_id,
        hostname=settings.WORKER_HOSTNAME,
        pid=os.getpid(),
        status=WorkerStatus.active,
        concurrent_tasks=0,
    )
    db.add(worker)
    db.commit()
    db.refresh(worker)
    return worker


class WorkerDecommissionedException(Exception):
    """Raised when a worker node has been decommissioned or marked dead by Admin."""
    pass


def update_heartbeat(
    worker_id: UUID,
    db: Session,
    concurrent_tasks: int = 0,
    queue_id: Optional[UUID] = None,
) -> None:
    """Update worker heartbeat timestamp. Raises WorkerDecommissionedException if worker is dead or deleted."""
    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if not worker or worker.status == WorkerStatus.dead:
        raise WorkerDecommissionedException(f"Worker {worker_id} has been decommissioned by Admin.")

    worker.last_heartbeat_at = func.now()
    worker.concurrent_tasks = concurrent_tasks
    worker.status = WorkerStatus.active
    db.commit()


def deregister_worker(
    worker_id: UUID,
    db: Session,
) -> None:
    """Mark worker status as 'dead' upon shutdown."""
    db.query(Worker).filter(Worker.id == worker_id).update(
        {
            Worker.status: WorkerStatus.dead,
            Worker.concurrent_tasks: 0,
            Worker.last_heartbeat_at: func.now(),
        }
    )
    db.commit()


def get_all_workers(db: Session) -> List[Worker]:
    """Retrieve all workers for monitoring."""
    return db.query(Worker).order_by(Worker.last_heartbeat_at.desc()).all()
