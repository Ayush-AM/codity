"""
Standalone Distributed Worker Process.

Usage:
    python -m app.workers.main_worker --queue-id <QUEUE_UUID>

Architecture:
- Atomic batch job claiming via PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED`.
- Concurrent task execution using `ThreadPoolExecutor`.
- Heartbeat loop updating `workers` table every 5s.
- Graceful shutdown handling on SIGINT/SIGTERM (drains in-flight tasks before exit).
"""

from __future__ import annotations

import argparse
import signal
import sys
import time
from concurrent.futures import Future, ThreadPoolExecutor
from typing import Dict
from uuid import UUID

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.shutdown import is_shutting_down, setup_graceful_shutdown
from app.services import claim_service, executor_service, heartbeat_service


def ensure_queue(queue_id: UUID, db: SessionLocal) -> UUID:
    from app.models.queue import Queue
    from app.models.project import Project
    from app.models.organization import Organization

    q = db.query(Queue).filter(Queue.id == queue_id).first()
    if q:
        return q.id

    first_q = db.query(Queue).first()
    if first_q:
        return first_q.id

    org = db.query(Organization).first()
    if not org:
        org = Organization(name="Default Organization", slug="default-org")
        db.add(org)
        db.commit()
        db.refresh(org)

    proj = db.query(Project).filter(Project.organization_id == org.id).first()
    if not proj:
        proj = Project(organization_id=org.id, name="Default Project", api_key="sk_live_default_key")
        db.add(proj)
        db.commit()
        db.refresh(proj)

    new_q = Queue(id=queue_id, project_id=proj.id, name="default", description="Default processing queue")
    db.add(new_q)
    try:
        db.commit()
        db.refresh(new_q)
        return new_q.id
    except Exception:
        db.rollback()
        first_q = db.query(Queue).first()
        if first_q:
            return first_q.id
        raise


def run_worker(queue_id: UUID | None) -> None:
    """Main worker loop."""
    setup_graceful_shutdown()

    # 1. Startup: Register worker in database
    db = SessionLocal()
    try:
        if queue_id and str(queue_id) == "00000000-0000-0000-0000-000000000000":
            queue_id = None

        worker = heartbeat_service.register_worker(queue_id=queue_id, db=db)
        print(f"============================================================")
        print(f"[*] Worker Registered | ID: {worker.id}")
        print(f"[*] Hostname: {worker.hostname} | PID: {worker.pid}")
        print(f"[*] Polling Queue: {'ALL QUEUES' if not queue_id else queue_id}")
        print(f"[*] Poll Interval: {settings.POLL_INTERVAL_SECONDS}s | Heartbeat: {settings.HEARTBEAT_INTERVAL_SECONDS}s")
        print(f"============================================================")
    finally:
        db.close()

    max_concurrency = 10
    if queue_id:
        db = SessionLocal()
        try:
            max_concurrency = claim_service.get_queue_concurrency(queue_id, db)
        finally:
            db.close()

    thread_pool = ThreadPoolExecutor(max_workers=max(max_concurrency, 10))
    active_futures: Dict[Future, UUID] = {}
    last_heartbeat_time = time.time()

    try:
        while not is_shutting_down():
            loop_db = SessionLocal()
            try:
                # A. Clean completed tasks
                finished = [f for f in active_futures if f.done()]
                for f in finished:
                    job_id = active_futures.pop(f)
                    try:
                        f.result()
                    except Exception as e:
                        print(f"[Worker] In-flight job {job_id} raised: {e}")

                # B. Check pause status if queue-specific
                is_paused = False
                current_concurrency = max_concurrency
                if queue_id:
                    is_paused = claim_service.is_queue_paused(queue_id, loop_db)
                    current_concurrency = claim_service.get_queue_concurrency(queue_id, loop_db)

                if is_paused:
                    print(f"[-] Queue {queue_id} is paused. Skipping claim loop.")
                else:
                    # C. Calculate available slots
                    running_count = len(active_futures)
                    available_slots = current_concurrency - running_count

                    if available_slots > 0:
                        claimed_jobs = claim_service.claim_jobs(
                            queue_id=queue_id,
                            limit=available_slots,
                            db=loop_db,
                            worker_id=worker.id,
                        )
                        if claimed_jobs:
                            print(f"[+] Atomically claimed {len(claimed_jobs)} job(s)")
                            for job in claimed_jobs:
                                print(f"  -> Dispatched Job {job.id} (priority={job.priority})")
                                fut = thread_pool.submit(
                                    executor_service.run_job,
                                    job.id,
                                    worker.id,
                                    SessionLocal,
                                    settings.JOB_TIMEOUT_SECONDS,
                                )
                                active_futures[fut] = job.id

                # D. Heartbeat loop (every HEARTBEAT_INTERVAL_SECONDS)
                now = time.time()
                if now - last_heartbeat_time >= settings.HEARTBEAT_INTERVAL_SECONDS:
                    heartbeat_service.update_heartbeat(
                        worker_id=worker.id,
                        db=loop_db,
                        concurrent_tasks=len(active_futures),
                        queue_id=queue_id,
                    )
                    last_heartbeat_time = now

            except heartbeat_service.WorkerDecommissionedException as e:
                print(f"[*] {e} Exiting worker loop...")
                break
            except Exception as loop_err:
                print(f"[Worker Loop Error] {loop_err}")
            finally:
                loop_db.close()

            # Sleep poll interval with short checks for shutdown
            for _ in range(int(settings.POLL_INTERVAL_SECONDS * 10)):
                if is_shutting_down():
                    break
                time.sleep(0.1)

    finally:
        # 3. Shutdown cleanup
        print(f"[Worker] Draining {len(active_futures)} running task(s)...")
        thread_pool.shutdown(wait=True)

        shutdown_db = SessionLocal()
        try:
            heartbeat_service.deregister_worker(worker_id=worker.id, db=shutdown_db)
            print(f"[*] Worker {worker.id} deregistered cleanly. Status set to 'dead'.")
        finally:
            shutdown_db.close()


def main():
    parser = argparse.ArgumentParser(description="Distributed Job Scheduler Worker")
    parser.add_argument(
        "--queue-id",
        type=str,
        required=True,
        help="UUID of the Queue to poll and process",
    )
    args = parser.parse_args()

    try:
        queue_uuid = UUID(args.queue_id)
    except ValueError:
        print(f"Error: Invalid UUID format '{args.queue_id}'")
        sys.exit(1)

    run_worker(queue_uuid)


if __name__ == "__main__":
    main()
