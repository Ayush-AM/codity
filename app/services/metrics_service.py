"""
Metrics & Telemetry Service with high-performance SQL aggregations and multi-tenant isolation.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.job import Job, JobStatus
from app.models.project import Project
from app.models.queue import Queue
from app.models.user import User
from app.models.worker import Worker, WorkerStatus
from app.schemas.metrics import QueueStatsResponse, SystemMetricsResponse


def get_queue_stats(queue_id: UUID, current_user: User, db: Session) -> QueueStatsResponse:
    """
    Compute real-time stats and throughput for a specific queue.
    """
    queue = (
        db.query(Queue)
        .join(Project, Queue.project_id == Project.id)
        .filter(Queue.id == queue_id)
        .first()
    )

    if not queue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Queue {queue_id} not found",
        )

    if queue.project.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Queue belongs to another organization",
        )

    cutoff_24h = datetime.now(timezone.utc) - timedelta(hours=24)

    stats = (
        db.query(
            func.count().filter(Job.status == JobStatus.queued).label("pending"),
            func.count().filter(Job.status == JobStatus.running).label("running"),
            func.count().filter(Job.status == JobStatus.completed, Job.finished_at >= cutoff_24h).label("completed_24h"),
            func.count().filter(Job.status == JobStatus.failed, Job.finished_at >= cutoff_24h).label("failed_24h"),
            func.count().filter(Job.status == JobStatus.dead).label("dead"),
        )
        .filter(Job.queue_id == queue_id)
        .one()
    )

    throughput = round(stats.completed_24h / 24.0, 2)

    return QueueStatsResponse(
        queue_id=queue.id,
        name=queue.name,
        pending=stats.pending,
        running=stats.running,
        completed_24h=stats.completed_24h,
        failed_24h=stats.failed_24h,
        dead=stats.dead,
        throughput_per_hour=throughput,
    )


def get_system_metrics(current_user: User, db: Session) -> SystemMetricsResponse:
    """
    Compute organization-wide aggregate metrics across all projects and queues.
    """
    cutoff_24h = datetime.now(timezone.utc) - timedelta(hours=24)

    job_stats = (
        db.query(
            func.count(Job.id).label("total_jobs"),
            func.count().filter(Job.status == JobStatus.completed, Job.finished_at >= cutoff_24h).label("completed_24h"),
            func.count().filter(Job.status == JobStatus.failed, Job.finished_at >= cutoff_24h).label("failed_24h"),
        )
        .join(Queue, Job.queue_id == Queue.id)
        .join(Project, Queue.project_id == Project.id)
        .filter(Project.organization_id == current_user.organization_id)
        .one()
    )

    total_queues = (
        db.query(func.count(Queue.id))
        .join(Project, Queue.project_id == Project.id)
        .filter(Project.organization_id == current_user.organization_id)
        .scalar()
        or 0
    )

    active_workers = (
        db.query(func.count(Worker.id))
        .join(Queue, Worker.queue_id == Queue.id)
        .join(Project, Queue.project_id == Project.id)
        .filter(
            Project.organization_id == current_user.organization_id,
            Worker.status == WorkerStatus.active,
        )
        .scalar()
        or 0
    )

    total_finished_24h = job_stats.completed_24h + job_stats.failed_24h
    failure_rate = (
        round((job_stats.failed_24h / total_finished_24h) * 100.0, 2)
        if total_finished_24h > 0
        else 0.0
    )

    return SystemMetricsResponse(
        total_jobs=job_stats.total_jobs,
        active_workers=active_workers,
        total_queues=total_queues,
        jobs_completed_24h=job_stats.completed_24h,
        jobs_failed_24h=job_stats.failed_24h,
        overall_failure_rate_24h=failure_rate,
    )
