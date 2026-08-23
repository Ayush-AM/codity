"""
Authentication & Multi-Tenant Authorization Tests.
"""

import uuid
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.user import User


def test_register_new_tenant(client: TestClient):
    """Test registering a brand new organization and root admin user."""
    email = f"lead_{uuid.uuid4().hex[:6]}@enterprise.com"
    payload = {
        "email": email,
        "password": "SecurePassword123!",
        "full_name": "Lead Architect",
        "organization_name": f"Acme Global {uuid.uuid4().hex[:4]}",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == email
    assert data["user"]["role"] == "admin"


def test_login_success(client: TestClient, sample_user: User):
    """Test login with valid email and password."""
    payload = {
        "email": sample_user.email,
        "password": "TestPass123!",
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_invalid_password(client: TestClient, sample_user: User):
    """Test login with incorrect password returns 401."""
    payload = {
        "email": sample_user.email,
        "password": "WrongPassword!",
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401
    assert "Incorrect email or password" in response.json()["detail"]


def test_protected_route_with_and_without_token(client: TestClient, auth_headers: dict):
    """Test access control on protected routes."""
    # Unauthenticated -> 401
    res_unauth = client.get("/api/v1/protected")
    assert res_unauth.status_code == 401

    # Authenticated -> 200
    res_auth = client.get("/api/v1/protected", headers=auth_headers)
    assert res_auth.status_code == 200
    assert "email" in res_auth.json()
