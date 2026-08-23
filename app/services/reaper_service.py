"""
Reaper Service – Stale Worker Detection and Orphaned Job Recovery.

Guarantees high reliability and fault tolerance:
1. Detects crashed/unresponsive workers whose heartbeats have expired.
2. Reclaims any 'claimed' or 'running' jobs assigned to dead workers.
3. Increments job `retry_count`, logs warning audit trails, and resets status to 'queued'.
4. Marks the dead worker as status='dead'.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.job import Job, JobStatus
from app.models.job_log import JobLog, LogLevel
from app.models.worker import Worker, WorkerStatus


def find_dead_workers(db: Session, threshold_seconds: int = 15) -> List[Worker]:
    """
    Find active workers whose last heartbeat exceeds the threshold.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=threshold_seconds)
    dead_workers: List[Worker] = (
        db.query(Worker)
        .filter(
            Worker.status == WorkerStatus.active,
            Worker.last_heartbeat_at < cutoff,
        )
        .all()
    )
    return dead_workers


def recover_jobs_for_worker(worker_id: UUID, db: Session) -> int:
    """
    Recover all orphaned jobs currently claimed or running by a dead worker.
    Resets them to 'queued' with incremented retry_count.
    """
    orphaned_jobs: List[Job] = (
        db.query(Job)
        .filter(
            Job.worker_id == worker_id,
            Job.status.in_([JobStatus.claimed, JobStatus.running]),
        )
        .all()
    )

    if not orphaned_jobs:
        return 0

    for job in orphaned_jobs:
        job.status = JobStatus.queued
        job.retry_count += 1
        job.last_error = f"Recovered by Reaper: worker {worker_id} missed heartbeat"
        job.claimed_at = None
        job.started_at = None
        job.worker_id = None
        job.updated_at = func.now()

        log = JobLog(
            job_id=job.id,
            level=LogLevel.warning,
            message=f"Job recovered by Reaper from dead worker {worker_id}",
            metadata_={
                "previous_worker_id": str(worker_id),
                "retry_count": job.retry_count,
                "recovery_reason": "stale_heartbeat",
            },
        )
        db.add(log)

    db.commit()
    return len(orphaned_jobs)


def mark_worker_as_dead(worker_id: UUID, db: Session) -> None:
    """Mark a worker as dead and clear its task count."""
    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if worker:
        worker.status = WorkerStatus.dead
        worker.concurrent_tasks = 0
        worker.updated_at = func.now()
        db.commit()


def run_reaper_cycle(db: Session, threshold_seconds: int = 15) -> Dict[str, Any]:
    """
    Execute a full reaper sweep:
    1. Identify all dead workers.
    2. Re-enqueue their orphaned jobs.
    3. Transition workers to 'dead' status.
    """
    dead_workers = find_dead_workers(db, threshold_seconds=threshold_seconds)
    total_recovered = 0

    for worker in dead_workers:
        recovered = recover_jobs_for_worker(worker.id, db)
        mark_worker_as_dead(worker.id, db)
        total_recovered += recovered

    return {
        "dead_workers": len(dead_workers),
        "recovered_jobs": total_recovered,
    }
