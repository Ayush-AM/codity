"""
Standalone Distributed Scheduler Process (Cron & Delayed Job Promoter).

Usage:
    python -m app.workers.scheduler

Features:
- Single-leader election using PostgreSQL advisory locks (`pg_try_advisory_lock`).
- Periodically checks for due delayed jobs and promotes them to 'queued'.
- Evaluates recurring cron templates and spawns executable child jobs.
- Graceful shutdown with automatic lock release.
"""

from __future__ import annotations

import argparse
import signal
import time

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.shutdown import is_shutting_down, setup_graceful_shutdown
from app.services import lock_service, scheduler_service


def run_scheduler(interval_seconds: int = 10) -> None:
    """Main scheduler loop."""
    setup_graceful_shutdown()

    print("============================================================")
    print(f"[*] Distributed Scheduler Starting")
    print(f"[*] Advisory Lock ID: {settings.ADVISORY_LOCK_ID}")
    print(f"[*] Tick Interval: {interval_seconds}s")
    print("============================================================")

    # Maintain single DB connection for the session-level advisory lock
    lock_db = SessionLocal()
    has_lock = False

    try:
        while not is_shutting_down():
            try:
                # 1. Attempt / verify leader election lock
                if not has_lock:
                    has_lock = lock_service.acquire_advisory_lock(
                        lock_id=settings.ADVISORY_LOCK_ID,
                        db=lock_db,
                    )
                    if has_lock:
                        print(f"[+] Leader lock acquired (Lock ID: {settings.ADVISORY_LOCK_ID}). Active Leader.")
                    else:
                        print(f"[-] Lock busy (another scheduler is active). Standby mode...")

                # 2. If leader, execute scheduler duties
                if has_lock:
                    work_db = SessionLocal()
                    try:
                        promoted = scheduler_service.promote_due_jobs(db=work_db)
                        cron_spawned = scheduler_service.process_cron_jobs(db=work_db)

                        if promoted > 0 or cron_spawned > 0:
                            print(f"[Scheduler Tick] Promoted {promoted} due job(s) | Spawned {cron_spawned} cron job(s)")
                    finally:
                        work_db.close()

            except Exception as tick_err:
                print(f"[Scheduler Error] {tick_err}")

            # Sleep interval with short checks for shutdown
            for _ in range(int(interval_seconds * 10)):
                if is_shutting_down():
                    break
                time.sleep(0.1)

    finally:
        # 3. Release lock upon exit
        if has_lock:
            print("[Scheduler] Releasing advisory lock...")
            try:
                lock_service.release_advisory_lock(
                    lock_id=settings.ADVISORY_LOCK_ID,
                    db=lock_db,
                )
                print("[*] Advisory lock released successfully.")
            except Exception as rel_err:
                print(f"[Scheduler] Error releasing lock: {rel_err}")

        lock_db.close()
        print("[*] Scheduler process exited cleanly.")


def main():
    parser = argparse.ArgumentParser(description="Distributed Job Scheduler Engine")
    parser.add_argument(
        "--interval",
        type=int,
        default=settings.SCHEDULER_INTERVAL_SECONDS,
        help="Polling tick interval in seconds (default: 10)",
    )
    args = parser.parse_args()
    run_scheduler(interval_seconds=args.interval)


if __name__ == "__main__":
    main()
