"""
Observability & Telemetry Metrics Endpoints.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.metrics import QueueStatsResponse, SystemMetricsResponse
from app.services import metrics_service

router = APIRouter(prefix="/metrics", tags=["Metrics"])


@router.get(
    "/queues/{queue_id}",
    response_model=QueueStatsResponse,
    summary="Get queue-specific stats and throughput",
)
def get_queue_statistics(
    queue_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QueueStatsResponse:
    """
    Returns real-time statistical breakdown for a queue:
    - Pending (queued) jobs
    - Currently running jobs
    - Completed jobs (last 24h)
    - Failed jobs (last 24h)
    - Dead letter jobs
    - Estimated throughput per hour
    """
    return metrics_service.get_queue_stats(
        queue_id=queue_id,
        current_user=current_user,
        db=db,
    )


@router.get(
    "/system",
    response_model=SystemMetricsResponse,
    summary="Get system-wide health and job metrics",
)
def get_system_metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SystemMetricsResponse:
    """
    Returns organization-wide aggregate metrics:
    - Total jobs count
    - Active workers count
    - Total queues count
    - 24h completed & failed volume
    - 24h overall failure rate percentage
    """
    return metrics_service.get_system_metrics(
        current_user=current_user,
        db=db,
    )
