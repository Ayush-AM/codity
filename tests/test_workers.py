"""
Worker Atomic Claiming, Concurrency & Execution Tests.
"""

from sqlalchemy.orm import Session
from app.models.job import Job, JobStatus
from app.models.queue import Queue
from app.models.worker import WorkerStatus
from app.services import claim_service, executor_service, heartbeat_service


def test_atomic_claim_jobs(db: Session, sample_queue: Queue):
    """Test atomic batch claiming using FOR UPDATE SKIP LOCKED."""
    # 1. Create 3 queued jobs
    for i in range(3):
        job = Job(
            queue_id=sample_queue.id,
            status=JobStatus.queued,
            payload={"task_idx": i},
            priority=i + 1,
            retry_count=0,
            max_retries=3,
        )
        db.add(job)
    db.commit()

    # 2. Register worker
    worker = heartbeat_service.register_worker(queue_id=sample_queue.id, db=db)

    # 3. Claim 2 jobs
    claimed = claim_service.claim_jobs(
        queue_id=sample_queue.id,
        limit=2,
        db=db,
        worker_id=worker.id,
    )

    assert len(claimed) == 2
    for job in claimed:
        assert job.status == JobStatus.claimed
        assert job.worker_id == worker.id
        assert job.claimed_at is not None

    # 4. Claim remaining jobs
    claimed_remaining = claim_service.claim_jobs(
        queue_id=sample_queue.id,
        limit=2,
        db=db,
        worker_id=worker.id,
    )
    assert len(claimed_remaining) == 1


def test_worker_heartbeat_lifecycle(db: Session, sample_queue: Queue):
    """Test worker registration, heartbeat updates, and deregistration."""
    worker = heartbeat_service.register_worker(queue_id=sample_queue.id, db=db)
    assert worker.status == WorkerStatus.active

    # Update heartbeat
    heartbeat_service.update_heartbeat(
        worker_id=worker.id,
        db=db,
        concurrent_tasks=3,
    )
    db.refresh(worker)
    assert worker.concurrent_tasks == 3

    # Deregister
    heartbeat_service.deregister_worker(worker_id=worker.id, db=db)
    db.refresh(worker)
    assert worker.status == WorkerStatus.dead
