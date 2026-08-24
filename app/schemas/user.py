"""
Pydantic schemas for user registration, login, and responses.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------
class UserCreate(BaseModel):
    """Registration payload — creates an Organization + admin User."""

    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=1, max_length=255)
    organization_name: str = Field(..., min_length=1, max_length=255)


class UserLogin(BaseModel):
    """Login payload."""

    email: EmailStr
    password: str


class UserAddMember(BaseModel):
    """Add a member to the current organization."""

    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=1, max_length=255)
    role: str = Field(default="member", pattern="^(admin|member)$")


class OAuthLoginRequest(BaseModel):
    """Payload for OAuth login / token verification."""

    provider: str = Field(..., description="OAuth provider: google, github, etc.")
    code: str | None = Field(default=None, description="Authorization code from provider redirect")
    access_token: str | None = Field(default=None, description="OAuth access token")
    id_token: str | None = Field(default=None, description="OAuth ID token")
    email: EmailStr | None = Field(default=None, description="Optional user email for mock/testing mode")
    full_name: str | None = Field(default=None, description="Optional user full name for mock/testing mode")


class OAuthAuthorizeUrlResponse(BaseModel):
    """Response containing authorization URL for specified provider."""

    provider: str
    authorize_url: str


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------
class UserResponse(BaseModel):
    """Public user representation (never exposes hashed_password)."""

    id: uuid.UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    organization_id: uuid.UUID
    oauth_provider: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    """Returned after successful registration or login."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse
