"""
PostgreSQL Distributed Advisory Lock Service.

Provides single-leader election for the Scheduler process using `pg_try_advisory_lock`.
If multiple scheduler instances run, only one acquires the lock; followers remain in standby.
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session


def acquire_advisory_lock(lock_id: int, db: Session) -> bool:
    """
    Attempt to acquire a PostgreSQL session-level advisory lock.

    Returns:
    --------
    bool:
        True if the lock was successfully claimed (this instance is the leader).
        False if another scheduler instance already holds the lock.
    """
    stmt = text("SELECT pg_try_advisory_lock(:lock_id)")
    result = db.execute(stmt, {"lock_id": lock_id}).scalar()
    return bool(result)


def release_advisory_lock(lock_id: int, db: Session) -> bool:
    """
    Release a PostgreSQL advisory lock upon shutdown.

    Returns:
    --------
    bool:
        True if the lock was successfully released.
    """
    stmt = text("SELECT pg_advisory_unlock(:lock_id)")
    result = db.execute(stmt, {"lock_id": lock_id}).scalar()
    return bool(result)
