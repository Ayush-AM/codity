"""
Worker Monitoring Endpoints.

Allows inspecting registered worker nodes, heartbeats, and current concurrency.
"""

from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.worker import Worker, WorkerStatus
from app.schemas.worker import WorkerResponse

router = APIRouter(prefix="/workers", tags=["Workers"])


@router.get(
    "/",
    response_model=List[WorkerResponse],
    summary="List all registered workers and heartbeats",
)
def list_workers(
    status: Optional[WorkerStatus] = Query(None, description="Filter by status ('active' or 'dead')"),
    queue_id: Optional[UUID] = Query(None, description="Filter by queue ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[WorkerResponse]:
    """Retrieve all workers and their current heartbeat status with optional filters."""
    query = db.query(Worker)
    if status is not None:
        query = query.filter(Worker.status == status)
    if queue_id is not None:
        query = query.filter(Worker.queue_id == queue_id)

    workers = query.order_by(Worker.last_heartbeat_at.desc()).all()
    return [WorkerResponse.model_validate(w) for w in workers]


@router.delete(
    "/dead",
    summary="Prune dead workers",
    response_model=dict,
)
def prune_dead_workers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete all workers currently marked as dead."""
    dead_workers = db.query(Worker).filter(Worker.status == WorkerStatus.dead).all()
    count = len(dead_workers)
    for worker in dead_workers:
        db.delete(worker)
    db.commit()
    return {"message": f"Successfully pruned {count} dead workers.", "count": count}


@router.delete(
    "/{worker_id}",
    summary="Delete / Deregister worker by ID",
    response_model=dict,
)
def delete_worker(
    worker_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a specific worker record as dead / decommissioned."""
    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    worker.status = WorkerStatus.dead
    db.commit()
    return {"message": f"Worker {worker_id} decommissioned successfully."}
