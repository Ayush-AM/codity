"""
Unified Graceful Shutdown Handler for Background Engines.

Catches SIGINT and SIGTERM across Worker, Scheduler, and Reaper processes,
ensuring clean database connection closing, lock releases, and task drainage.
"""

from __future__ import annotations

import logging
import signal
from typing import Callable, List

logger = logging.getLogger("shutdown")

_SHUTDOWN_REQUESTED = False
_SHUTDOWN_HOOKS: List[Callable[[], None]] = []


def is_shutting_down() -> bool:
    """Check if a shutdown signal has been received."""
    return _SHUTDOWN_REQUESTED


def trigger_shutdown() -> None:
    """Programmatically trigger shutdown."""
    global _SHUTDOWN_REQUESTED
    _SHUTDOWN_REQUESTED = True


def register_shutdown_hook(hook: Callable[[], None]) -> None:
    """Register a callback to run upon shutdown."""
    _SHUTDOWN_HOOKS.append(hook)


def _handle_signal(signum, frame):
    global _SHUTDOWN_REQUESTED
    if not _SHUTDOWN_REQUESTED:
        print(f"\n[Shutdown] Received termination signal {signum}. Initiating graceful shutdown...")
        _SHUTDOWN_REQUESTED = True
        for hook in _SHUTDOWN_HOOKS:
            try:
                hook()
            except Exception as e:
                print(f"[Shutdown Hook Error] {e}")


def setup_graceful_shutdown(extra_hook: Callable[[], None] | None = None) -> None:
    """Install signal handlers for SIGINT and SIGTERM."""
    if extra_hook:
        register_shutdown_hook(extra_hook)
    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)
