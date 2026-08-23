"""
Worker Job Execution Service.

Handles payload execution, timeout protection, status transitions,
retry scheduling, DLQ routing, and detailed audit logging.
"""

from __future__ import annotations

import concurrent.futures
import time
from typing import Any, Dict
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.job import Job, JobStatus
from app.models.job_execution import ExecutionStatus, JobExecution
from app.models.job_log import JobLog, LogLevel
from app.services import retry_service


def execute_job_payload(payload: Any) -> Dict[str, Any]:
    """
    Executes or simulates the background job payload.

    Control fields supported in payload for testing/simulation:
    - `fail: true` -> Raises exception to test failure & retry handling.
    - `sleep: N`   -> Sleeps for N seconds to test concurrency and timeouts.
    - Custom tasks -> Standard simulation with return value.
    """
    if isinstance(payload, dict):
        if payload.get("fail") is True:
            err_msg = payload.get("error_message", "Simulated job failure from payload")
            raise RuntimeError(err_msg)

        sleep_duration = payload.get("sleep", 0.5)
        if isinstance(sleep_duration, (int, float)) and sleep_duration > 0:
            time.sleep(sleep_duration)

        task_name = payload.get("task", "generic_task")
    else:
        time.sleep(0.5)
        task_name = "raw_payload_task"

    return {
        "status": "success",
        "processed_at": time.time(),
        "task": task_name,
    }


def run_job(
    job_id: UUID,
    worker_id: UUID,
    session_factory,
    timeout_seconds: int = 300,
) -> None:
    """
    Executes a single claimed job in a dedicated worker thread with timeout enforcement.
    On success: marks status='completed'.
    On failure: records attempt and delegates to retry_service (retry or DLQ).
    """
    db: Session = session_factory()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return

        # 1. Transition to 'running' and create execution record
        now_dt = func.now()
        job.status = JobStatus.running
        job.started_at = now_dt

        execution = JobExecution(
            job_id=job.id,
            worker_id=worker_id,
            status=ExecutionStatus.running,
            started_at=now_dt,
        )
        db.add(execution)

        start_log = JobLog(
            job_id=job.id,
            level=LogLevel.info,
            message="Job execution started",
        )
        db.add(start_log)
        db.commit()
        db.refresh(execution)

        # 2. Run payload with timeout guard
        error_msg: str | None = None
        result_data: Dict[str, Any] | None = None

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(execute_job_payload, job.payload)
            try:
                result_data = future.result(timeout=timeout_seconds)
            except concurrent.futures.TimeoutError:
                error_msg = f"Job execution timed out after {timeout_seconds} seconds"
            except Exception as exc:
                error_msg = str(exc)

        # 3. Finalize outcome
        finish_dt = func.now()
        if error_msg is None:
            job.status = JobStatus.completed
            job.finished_at = finish_dt

            execution.status = ExecutionStatus.completed
            execution.finished_at = finish_dt

            complete_log = JobLog(
                job_id=job.id,
                level=LogLevel.info,
                message="Job completed successfully",
                metadata_=result_data,
            )
            db.add(complete_log)
            db.commit()
        else:
            # Failure handling
            job.retry_count = (job.retry_count or 0) + 1
            execution.status = ExecutionStatus.failed
            execution.finished_at = finish_dt
            execution.error_message = error_msg

            fail_log = JobLog(
                job_id=job.id,
                level=LogLevel.error,
                message=f"Job attempt failed: {error_msg}",
            )
            db.add(fail_log)
            db.commit()

            # 4. Trigger Retry Engine / DLQ Escalation
            retry_service.schedule_retry(job=job, db=db, error_message=error_msg)

    except Exception as e:
        db.rollback()
        print(f"[Executor Error] Job {job_id} unhandled failure: {e}")
    finally:
        db.close()
