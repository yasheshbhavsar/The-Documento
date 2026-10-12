import uuid
import pytest
from datetime import datetime, timezone
from sqlalchemy.exc import IntegrityError

from backend.app.domain.models import (
    Organization,
    Branch,
    Team,
    User,
    ClientProfile,
    ImmigrationCase,
    OrganizationMembership,
    Role,
)
from backend.app.security.rbac import RoleCode


def test_cross_tenant_organization_isolation(client, db):
    org_a = Organization(name="Firm Alpha", slug="firm-alpha")
    org_b = Organization(name="Firm Beta", slug="firm-beta")
    db.add_all([org_a, org_b])
    db.flush()

    branch_b = Branch(organization_id=org_b.id, name="London Office", code="LDN", country="GB", city="London")
    db.add(branch_b)
    db.commit()

    headers_a = {
        "X-Organization-Id": str(org_a.id),
        "X-User-Id": str(uuid.uuid4()),
        "X-User-Role": RoleCode.MASTER_ADMIN.value,
    }

    # Org A lists branches -> London Office from Org B MUST NOT appear
    resp = client.get("/api/v1/organizations/branches", headers=headers_a)
    assert resp.status_code == 200
    assert len(resp.json()) == 0

    # Org A tries to create team in Org B's branch -> Must fail with 404 Not Found
    team_resp = client.post(
        "/api/v1/organizations/teams",
        headers=headers_a,
        json={"name": "Cross Tenant Team", "branch_id": str(branch_b.id)},
    )
    assert team_resp.status_code == 404


def test_object_level_case_authorization_for_retained_clients(client, db):
    org = Organization(name="Immigration Legal Group", slug="imm-legal")
    db.add(org)
    db.flush()

    user_elena = User(email="elena@rostova.com", full_name="Dr. Elena Rostova", status="active")
    user_marcus = User(email="marcus@thorne.com", full_name="Marcus Thorne", status="active")
    db.add_all([user_elena, user_marcus])
    db.flush()

    client_elena = ClientProfile(
        organization_id=org.id,
        user_id=user_elena.id,
        first_name="Elena",
        last_name="Rostova",
        email=user_elena.email,
        nationality="RUS",
    )
    client_marcus = ClientProfile(
        organization_id=org.id,
        user_id=user_marcus.id,
        first_name="Marcus",
        last_name="Thorne",
        email=user_marcus.email,
        nationality="GBR",
    )
    db.add_all([client_elena, client_marcus])
    db.flush()

    case_elena = ImmigrationCase(
        organization_id=org.id,
        client_id=client_elena.id,
        case_number="CASE-US-8841",
        title="EB-1A Petition: Elena Rostova",
        jurisdiction="US",
        visa_category="EB-1A",
        status="gathering",
    )
    case_marcus = ImmigrationCase(
        organization_id=org.id,
        client_id=client_marcus.id,
        case_number="CASE-US-8842",
        title="O-1A Petition: Marcus Thorne",
        jurisdiction="US",
        visa_category="O-1A",
        status="review",
    )
    db.add_all([case_elena, case_marcus])
    db.commit()

    headers_elena = {
        "X-Organization-Id": str(org.id),
        "X-User-Id": str(user_elena.id),
        "X-User-Role": RoleCode.RETAINED_CLIENT.value,
    }

    # 1. Elena can list her cases -> sees only CASE-US-8841
    list_resp = client.get("/api/v1/cases", headers=headers_elena)
    assert list_resp.status_code == 200
    cases_returned = list_resp.json()
    assert len(cases_returned) == 1
    assert cases_returned[0]["case_number"] == "CASE-US-8841"

    # 2. Elena gets her own case details -> 200 OK
    get_own_resp = client.get(f"/api/v1/cases/{case_elena.id}", headers=headers_elena)
    assert get_own_resp.status_code == 200
    assert get_own_resp.json()["case_number"] == "CASE-US-8841"

    # 3. Elena attempts to access Marcus's case directly -> 403 Forbidden!
    forbidden_resp = client.get(f"/api/v1/cases/{case_marcus.id}", headers=headers_elena)
    assert forbidden_resp.status_code == 403
    assert "designated applicant" in forbidden_resp.json()["message"]

    # 4. Elena attempts to view firm client directory -> 403 Forbidden!
    clients_resp = client.get("/api/v1/clients", headers=headers_elena)
    assert clients_resp.status_code == 403


def test_platform_boundaries_on_configurable_permissions(client):
    org_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())

    headers_admin = {
        "X-Organization-Id": org_id,
        "X-User-Id": user_id,
        "X-User-Role": RoleCode.MASTER_ADMIN.value,
    }

    # 1. Attempting to assign internal staff permission to retained_client role MUST fail
    resp_illegal_client = client.post(
        "/api/v1/roles/retained_client/permissions",
        headers=headers_admin,
        json={"permission": "org:manage"},
    )
    assert resp_illegal_client.status_code == 403
    assert "violates platform security boundaries" in resp_illegal_client.json()["message"]

    resp_illegal_case_all = client.post(
        "/api/v1/roles/retained_client/permissions",
        headers=headers_admin,
        json={"permission": "case:read:all"},
    )
    assert resp_illegal_case_all.status_code == 403

    # 2. Attempting to grant rule:publish by non-approver must fail
    headers_worker = {
        "X-Organization-Id": org_id,
        "X-User-Id": user_id,
        "X-User-Role": RoleCode.CASE_MANAGER.value,
    }
    resp_publish = client.post(
        "/api/v1/roles/case_manager/permissions",
        headers=headers_worker,
        json={"permission": "rule:publish"},
    )
    assert resp_publish.status_code == 403


def test_database_unique_constraints(db):
    org_id = uuid.uuid4()
    org = Organization(id=org_id, name="Test Firm", slug="test-firm-unique-2")
    db.add(org)
    db.commit()

    # Unique constraint on branch code per organization
    b1 = Branch(organization_id=org_id, name="Branch 1", code="NYC", country="USA", city="New York")
    db.add(b1)
    db.commit()

    b2 = Branch(organization_id=org_id, name="Branch 2", code="NYC", country="USA", city="New York")
    db.add(b2)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    # Unique constraint on case number per organization
    client_prof = ClientProfile(organization_id=org_id, first_name="A", last_name="B", email="a2@b.com", nationality="CAN")
    db.add(client_prof)
    db.flush()

    c1 = ImmigrationCase(organization_id=org_id, client_id=client_prof.id, case_number="CASE-001", title="Title 1", jurisdiction="US", visa_category="H-1B")
    db.add(c1)
    db.commit()

    c2 = ImmigrationCase(organization_id=org_id, client_id=client_prof.id, case_number="CASE-001", title="Title 2", jurisdiction="US", visa_category="H-1B")
    db.add(c2)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_cross_tenant_case_isolation_and_idor_prevention(client, db):
    org_1 = Organization(name="Law Office 1", slug="law-1")
    org_2 = Organization(name="Law Office 2", slug="law-2")
    db.add_all([org_1, org_2])
    db.flush()

    client_1 = ClientProfile(organization_id=org_1.id, first_name="Client", last_name="One", email="c1@example.com", nationality="USA")
    client_2 = ClientProfile(organization_id=org_2.id, first_name="Client", last_name="Two", email="c2@example.com", nationality="GBR")
    db.add_all([client_1, client_2])
    db.flush()

    case_1 = ImmigrationCase(
        organization_id=org_1.id,
        client_id=client_1.id,
        case_number="CASE-ORG1-01",
        title="Org 1 Petition",
        jurisdiction="US",
        visa_category="EB-2 NIW",
    )
    case_2 = ImmigrationCase(
        organization_id=org_2.id,
        client_id=client_2.id,
        case_number="CASE-ORG2-01",
        title="Org 2 Petition",
        jurisdiction="US",
        visa_category="EB-1A",
    )
    db.add_all([case_1, case_2])
    db.commit()

    headers_org1_manager = {
        "X-Organization-Id": str(org_1.id),
        "X-User-Id": str(uuid.uuid4()),
        "X-User-Role": RoleCode.CASE_MANAGER.value,
    }

    # 1. Org 1 manager cannot view Org 2's case -> 403 Forbidden with TenantIsolationError
    cross_resp = client.get(f"/api/v1/cases/{case_2.id}", headers=headers_org1_manager)
    assert cross_resp.status_code == 403
    assert "Cross-tenant access forbidden" in cross_resp.json()["message"]

    # 2. Random IDOR probe with non-existent UUID -> 404
    idor_resp = client.get(f"/api/v1/cases/{uuid.uuid4()}", headers=headers_org1_manager)
    assert idor_resp.status_code == 404

    # 3. Org 1 manager listing cases should see exactly 1 case (case_1), never case_2
    list_resp = client.get("/api/v1/cases", headers=headers_org1_manager)
    assert list_resp.status_code == 200
    returned_cases = list_resp.json()
    assert len(returned_cases) == 1
    assert returned_cases[0]["case_number"] == "CASE-ORG1-01"


def test_structured_logging_pii_redaction():
    from backend.app.core.logging import redact_pii

    payload = {
        "email": "user@example.com",
        "password": "SuperSecretPassword123!",
        "token": "jwt.secret.token",
        "passport_number": "A12345678",
        "nested": {
            "api_key": "sk-12345",
            "safe_data": "normal_value",
        },
    }

    sanitized = redact_pii(payload)
    assert sanitized["password"] == "[REDACTED]"
    assert sanitized["token"] == "[REDACTED]"
    assert sanitized["passport_number"] == "[REDACTED]"
    assert sanitized["nested"]["api_key"] == "[REDACTED]"
    assert sanitized["nested"]["safe_data"] == "normal_value"
    assert sanitized["email"] == "user@example.com"

