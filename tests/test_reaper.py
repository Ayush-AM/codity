"""
Reaper Stale Worker Sweeper & Job Recovery Tests.
"""

from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from app.models.job import Job, JobStatus
from app.models.queue import Queue
from app.models.worker import Worker
from app.services import reaper_service


def test_reaper_sweeps_dead_workers_and_recovers_jobs(db: Session, sample_queue: Queue):
    """Test that dead workers are marked 'dead' and their in-flight jobs re-enqueued."""
    # 1. Create a simulated crashed worker with expired heartbeat (1 hour ago)
    stale_time = datetime.now(timezone.utc) - timedelta(hours=1)
    dead_worker = Worker(
        queue_id=sample_queue.id,
        hostname="worker-node-crashed-01",
        pid=9999,
        status="active",
        last_heartbeat_at=stale_time,
    )
    db.add(dead_worker)
    db.commit()
    db.refresh(dead_worker)

    # 2. Assign claimed job to this dead worker
    job = Job(
        queue_id=sample_queue.id,
        status=JobStatus.claimed,
        worker_id=dead_worker.id,
        payload={"task": "critical_reaper_test"},
        retry_count=0,
        max_retries=3,
        claimed_at=stale_time,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # 3. Run Reaper cycle
    summary = reaper_service.run_reaper_cycle(db=db, threshold_seconds=15)

    assert summary["dead_workers"] >= 1
    assert summary["recovered_jobs"] >= 1

    # 4. Verify worker status is now 'dead'
    db.refresh(dead_worker)
    assert dead_worker.status == "dead"

    # 5. Verify job is reset to 'queued' with incremented retry_count
    db.refresh(job)
    assert job.status == JobStatus.queued
    assert job.retry_count == 1
    assert job.worker_id is None
