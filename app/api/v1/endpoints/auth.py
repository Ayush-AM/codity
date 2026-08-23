"""
Authentication endpoints: Registration and Login.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Union

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.organization import Organization
from app.models.project import Project
from app.models.queue import Queue
from app.models.user import User, UserRole
from app.schemas.token import Token
from app.schemas.user import AuthResponse, UserCreate, UserLogin, UserResponse
from app.utils.helpers import slugify

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user and organization",
)
def register(
    user_in: UserCreate,
    db: Session = Depends(get_db),
) -> AuthResponse:
    """
    Register a new user:
    1. Check if email already exists -> 400 Bad Request.
    2. Automatically create a new Organization with given name and unique slug.
    3. Create the User with hashed password and role='admin'.
    4. Automatically seed default Project and Queue for immediate usage.
    5. Issue JWT access token and return token + user details.
    """
    existing_user = db.query(User).filter(User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists.",
        )

    # Generate unique slug for organization
    base_slug = slugify(user_in.organization_name)
    slug = base_slug
    counter = 1
    while db.query(Organization).filter(Organization.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    # Create Organization
    organization = Organization(
        name=user_in.organization_name,
        slug=slug,
    )
    db.add(organization)
    db.flush()  # Populates organization.id

    # Create User as admin
    user = User(
        organization_id=organization.id,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=UserRole.admin,
        is_active=True,
    )
    db.add(user)

    # Seed Default Project
    project = Project(
        organization_id=organization.id,
        name="Default Project",
        description="Default project partition for background workloads",
    )
    db.add(project)
    db.flush()  # Populates project.id

    # Seed Default Queue
    queue = Queue(
        project_id=project.id,
        name="default",
        description="Default high-throughput background queue",
        priority=0,
        concurrency_limit=5,
        retry_policy={
            "strategy": "exponential",
            "base_delay": 10,
            "max_retries": 3,
            "multiplier": 2.0,
            "jitter": True,
        },
        is_paused=False,
    )
    db.add(queue)

    db.commit()
    db.refresh(user)

    # Issue JWT Token
    expires_in_seconds = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
    access_token = create_access_token(
        data={"sub": str(user.id), "org": str(user.organization_id)},
        expires_delta=timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    return AuthResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=expires_in_seconds,
        user=UserResponse.model_validate(user),
    )


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Authenticate user and return JWT access token and profile",
)
def login(
    user_in: UserLogin,
    db: Session = Depends(get_db),
) -> AuthResponse:
    """
    Authenticate user via JSON body (email + password).
    Returns JWT access token along with user profile metadata.
    """
    user = db.query(User).filter(User.email == user_in.email).first()
    if not user or not verify_password(user_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account",
        )

    expires_in_seconds = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
    access_token = create_access_token(
        data={"sub": str(user.id), "org": str(user.organization_id)},
        expires_delta=timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    return AuthResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=expires_in_seconds,
        user=UserResponse.model_validate(user),
    )
