"""
Standalone Reaper Process (Stale Worker & Orphaned Job Recovery Engine).

Usage:
    python -m app.workers.reaper [--interval 30] [--threshold 15]

Guarantees:
- Zero stranded jobs when worker nodes or processes crash unexpectedly.
- Automatic recovery into 'queued' state with audit log tracking.
"""

from __future__ import annotations

import argparse
import signal
import time

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.shutdown import is_shutting_down, setup_graceful_shutdown
from app.services import reaper_service


def run_reaper(interval_seconds: int = 30, threshold_seconds: int = 15) -> None:
    """Main reaper loop."""
    setup_graceful_shutdown()

    print("============================================================")
    print(f"[*] Stale Worker & Job Reaper Starting")
    print(f"[*] Scan Interval: {interval_seconds}s")
    print(f"[*] Stale Heartbeat Threshold: {threshold_seconds}s")
    print("============================================================")

    while not is_shutting_down():
        db = SessionLocal()
        try:
            summary = reaper_service.run_reaper_cycle(
                db=db,
                threshold_seconds=threshold_seconds,
            )
            dead_count = summary["dead_workers"]
            rec_count = summary["recovered_jobs"]

            if dead_count > 0 or rec_count > 0:
                print(f"[Reaper Sweep] Found {dead_count} dead worker(s) | Recovered {rec_count} orphaned job(s)")
            else:
                print(f"[Reaper Sweep] Found 0 dead workers. System healthy.")
        except Exception as e:
            print(f"[Reaper Error] {e}")
        finally:
            db.close()

        # Sleep with responsive exit
        for _ in range(int(interval_seconds * 10)):
            if is_shutting_down():
                break
            time.sleep(0.1)

    print("[*] Reaper process exited cleanly.")


def main():
    parser = argparse.ArgumentParser(description="Distributed Job Reaper Engine")
    parser.add_argument(
        "--interval",
        type=int,
        default=settings.REAPER_INTERVAL_SECONDS,
        help="Reaper sweep interval in seconds (default: 30)",
    )
    parser.add_argument(
        "--threshold",
        type=int,
        default=settings.STALE_WORKER_THRESHOLD_SECONDS,
        help="Heartbeat stale threshold in seconds (default: 15)",
    )
    args = parser.parse_args()
    run_reaper(interval_seconds=args.interval, threshold_seconds=args.threshold)


if __name__ == "__main__":
    main()
