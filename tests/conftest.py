"""
Pytest configuration and shared fixtures for Distributed Job Scheduler.
"""

import uuid
import pytest
from typing import Generator
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.core.database import SessionLocal, engine, get_db
import app.core.deps as core_deps
from app.core.security import create_access_token, get_password_hash
from app.models.base import Base
from app.models.organization import Organization
from app.models.project import Project
from app.models.user import User, UserRole
from app.models.queue import Queue


@pytest.fixture(scope="session")
def db_engine():
    """Ensure database schema exists."""
    Base.metadata.create_all(bind=engine)
    yield engine


@pytest.fixture(scope="session", autouse=True)
def cleanup_test_workers():
    """Auto-clean test worker records after running pytest so live dashboard stays clean."""
    from app.core.config import settings
    settings.WORKER_HOSTNAME = "pytest-runner"
    yield
    session = SessionLocal()
    try:
        from app.models.worker import Worker
        session.query(Worker).filter(Worker.hostname == "pytest-runner").delete()
        session.query(Worker).filter(Worker.status == "dead").delete()
        session.commit()
    except Exception:
        session.rollback()
    finally:
        session.close()


@pytest.fixture(scope="function")
def db() -> Generator[Session, None, None]:
    """Provide a database session for each test."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="function")
def client(db: Session) -> Generator[TestClient, None, None]:
    """TestClient with overridden get_db dependencies."""
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[core_deps.get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def sample_org(db: Session) -> Organization:
    """Create a test organization."""
    org = Organization(name=f"Test Org {uuid.uuid4().hex[:6]}", slug=f"test-org-{uuid.uuid4().hex[:6]}")
    db.add(org)
    db.commit()
    db.refresh(org)
    return org


@pytest.fixture(scope="function")
def sample_user(db: Session, sample_org: Organization) -> User:
    """Create an active admin user."""
    user = User(
        email=f"user_{uuid.uuid4().hex[:6]}@test.com",
        full_name="Admin Test",
        hashed_password=get_password_hash("TestPass123!"),
        organization_id=sample_org.id,
        role=UserRole.admin,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture(scope="function")
def auth_headers(sample_user: User) -> dict:
    """Generate Authorization headers with valid JWT token."""
    token = create_access_token(data={"sub": str(sample_user.id), "org": str(sample_user.organization_id)})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="function")
def sample_project(db: Session, sample_org: Organization) -> Project:
    """Create a test project."""
    project = Project(
        name=f"Telemetry Pipeline {uuid.uuid4().hex[:4]}",
        description="Project for test workloads",
        organization_id=sample_org.id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@pytest.fixture(scope="function")
def sample_queue(db: Session, sample_project: Project) -> Queue:
    """Create a test queue."""
    queue = Queue(
        project_id=sample_project.id,
        name=f"queue-{uuid.uuid4().hex[:4]}",
        concurrency_limit=5,
        priority=1,
        retry_policy={
            "strategy": "exponential",
            "max_retries": 3,
            "initial_delay": 1,
            "max_delay": 60,
            "multiplier": 2.0,
            "jitter": True,
        },
    )
    db.add(queue)
    db.commit()
    db.refresh(queue)
    return queue
