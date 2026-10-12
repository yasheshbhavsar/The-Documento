import uuid
import pytest
from backend.app.security.rbac import RoleCode


def test_health_check(client):
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "environment" in data


def test_roles_endpoint(client):
    resp = client.get("/api/v1/foundation/roles")
    assert resp.status_code == 200
    roles = resp.json()
    assert "applicant" in roles
    assert "case_worker" in roles
    assert "organization_admin" in roles
    assert "rule_editor" in roles
    assert "rule_approver" in roles


def test_me_endpoint_distinct_experiences(client):
    org_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())

    # 1. Master Admin / Company Owner
    admin_resp = client.get(
        "/api/v1/foundation/me",
        headers={
            "X-Organization-Id": org_id,
            "X-User-Id": user_id,
            "X-User-Role": "organization_admin",
        },
    )
    assert admin_resp.status_code == 200
    data = admin_resp.json()
    assert data["experience"] == "master_admin"
    assert "org:manage" in data["permissions"]
    assert "case:read" in data["permissions"]

    # 2. Case Worker / Case Manager
    worker_resp = client.get(
        "/api/v1/foundation/me",
        headers={
            "X-Organization-Id": org_id,
            "X-User-Id": user_id,
            "X-User-Role": "case_worker",
        },
    )
    assert worker_resp.status_code == 200
    w_data = worker_resp.json()
    assert w_data["experience"] == "case_manager"
    assert "case:read" in w_data["permissions"]
    assert "case:write" in w_data["permissions"]
    assert "org:manage" not in w_data["permissions"]

    # 3. Retained Client / Applicant
    applicant_resp = client.get(
        "/api/v1/foundation/me",
        headers={
            "X-Organization-Id": org_id,
            "X-User-Id": user_id,
            "X-User-Role": "applicant",
        },
    )
    assert applicant_resp.status_code == 200
    a_data = applicant_resp.json()
    assert a_data["experience"] == "client_applicant"
    assert "case:read:own" in a_data["permissions"]
    assert "case:write" not in a_data["permissions"]


def test_audit_events_tenant_isolation_and_rbac(client):
    org_a = str(uuid.uuid4())
    org_b = str(uuid.uuid4())
    user_a = str(uuid.uuid4())
    user_b = str(uuid.uuid4())

    # Org A creates an audit event
    create_resp = client.post(
        "/api/v1/foundation/audit-events",
        headers={
            "X-Organization-Id": org_a,
            "X-User-Id": user_a,
            "X-User-Role": "organization_admin",
        },
        json={
            "action": "case.created",
            "object_type": "case",
            "object_id": "CASE-101",
            "metadata": {"visa_type": "EB-1A"},
        },
    )
    assert create_resp.status_code == 201

    # Org A reads audit events -> sees the event
    read_a = client.get(
        "/api/v1/foundation/audit-events",
        headers={
            "X-Organization-Id": org_a,
            "X-User-Id": user_a,
            "X-User-Role": "organization_admin",
        },
    )
    assert read_a.status_code == 200
    assert len(read_a.json()) == 1
    assert read_a.json()[0]["object_id"] == "CASE-101"

    # Org B reads audit events -> isolated, sees 0 events
    read_b = client.get(
        "/api/v1/foundation/audit-events",
        headers={
            "X-Organization-Id": org_b,
            "X-User-Id": user_b,
            "X-User-Role": "organization_admin",
        },
    )
    assert read_b.status_code == 200
    assert len(read_b.json()) == 0

    # Applicant role attempting to read audit log receives 403 Forbidden
    applicant_read = client.get(
        "/api/v1/foundation/audit-events",
        headers={
            "X-Organization-Id": org_a,
            "X-User-Id": user_a,
            "X-User-Role": "applicant",
        },
    )
    assert applicant_read.status_code == 403


def test_openapi_specification(client):
    resp = client.get("/openapi.json")
    assert resp.status_code == 200
    spec = resp.json()
    assert spec["openapi"].startswith("3.")
    assert spec["info"]["title"] == "AI Immigration SaaS API"
    assert spec["info"]["version"] == "1.0.0"
    paths = spec["paths"]
    assert "/api/v1/auth/login" in paths
    assert "/api/v1/auth/logout" in paths
    assert "/api/v1/cases" in paths
    assert "/api/v1/cases/{case_id}" in paths
    assert "/api/v1/organizations/branches" in paths
    assert "/api/v1/organizations/teams" in paths
    assert "/api/v1/roles" in paths


def test_security_headers_middleware(client):
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    headers = resp.headers
    assert headers.get("x-content-type-options") == "nosniff"
    assert headers.get("x-frame-options") == "DENY"
    assert headers.get("x-xss-protection") == "1; mode=block"
    assert "max-age" in headers.get("strict-transport-security", "")
    assert headers.get("referrer-policy") == "strict-origin-when-cross-origin"


def test_centralized_error_handling(client):
    # Route with invalid payload triggers standard 422 JSON
    resp = client.post("/api/v1/auth/login", json={})
    assert resp.status_code == 422
    data = resp.json()
    assert "detail" in data

