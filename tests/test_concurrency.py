"""
Multi-Threaded Concurrency Tests for Atomic Claiming.

Verifies that parallel threads/workers executing SELECT ... FOR UPDATE SKIP LOCKED
never double-claim the same job under race conditions.
"""

from concurrent.futures import ThreadPoolExecutor
from typing import List, Set
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.job import Job, JobStatus
from app.models.queue import Queue
from app.services import claim_service, heartbeat_service


def test_concurrent_atomic_claims(db: Session, sample_queue: Queue):
    """
    Test that 5 concurrent threads claiming from the same queue with 10 queued jobs
    claim exactly 10 distinct jobs with 0 collisions/duplicates.
    """
    total_jobs = 10
    num_threads = 5

    # 1. Populate 10 queued jobs
    created_job_ids: Set[UUID] = set()
    for i in range(total_jobs):
        job = Job(
            queue_id=sample_queue.id,
            status=JobStatus.queued,
            payload={"batch_item": i},
            priority=(i % 3) + 1,
            retry_count=0,
            max_retries=3,
        )
        db.add(job)
        db.flush()
        created_job_ids.add(job.id)
    db.commit()

    # 2. Worker runner function executed concurrently across threads
    def worker_claim_task(worker_idx: int) -> List[UUID]:
        thread_db = SessionLocal()
        try:
            worker = heartbeat_service.register_worker(queue_id=sample_queue.id, db=thread_db)
            claimed = claim_service.claim_jobs(
                queue_id=sample_queue.id,
                limit=2,
                db=thread_db,
                worker_id=worker.id,
            )
            return [j.id for j in claimed]
        finally:
            thread_db.close()

    # 3. Execute in parallel across 5 threads
    all_claimed_ids: List[UUID] = []
    with ThreadPoolExecutor(max_workers=num_threads) as pool:
        futures = [pool.submit(worker_claim_task, i) for i in range(num_threads)]
        for f in futures:
            claimed_ids = f.result()
            all_claimed_ids.extend(claimed_ids)

    # 4. Concurrency Verification
    # A. Total claimed jobs must equal total created jobs
    assert len(all_claimed_ids) == total_jobs, f"Expected {total_jobs} claimed, got {len(all_claimed_ids)}"

    # B. Set of claimed IDs must have NO duplicates (zero double-claims)
    unique_claimed_ids = set(all_claimed_ids)
    assert len(unique_claimed_ids) == total_jobs, "Collision detected: some jobs were claimed by multiple workers!"

    # C. All claimed IDs must match original created jobs
    assert unique_claimed_ids == created_job_ids
