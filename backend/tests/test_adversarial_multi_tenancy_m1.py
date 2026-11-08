import io
import uuid
from datetime import datetime, timezone
import pytest
from fastapi import status

from backend.app.domain.models import (
    Organization,
    User,
    ClientProfile,
    ImmigrationCase,
    VisaAppointment,
    DocumentRequest,
    Document,
)
from backend.app.security.rbac import RoleCode
from backend.app.security.tokens import create_access_token


@pytest.fixture
def multi_tenant_fixture(db):
    """Sets up two isolated tenants (Firm Alpha and Firm Beta) with users, clients, cases, appointments, requests, and documents."""
    now = datetime.now(timezone.utc)

    # 1. Organizations
    org_a = Organization(
        id=uuid.uuid4(),
        name="Firm Alpha Immigration Law",
        slug="firm-alpha",
        status="active",
        created_at=now,
        updated_at=now,
    )
    org_b = Organization(
        id=uuid.uuid4(),
        name="Firm Beta Global Mobility",
        slug="firm-beta",
        status="active",
        created_at=now,
        updated_at=now,
    )
    db.add_all([org_a, org_b])
    db.flush()

    # 2. Users (Master Admins)
    admin_a = User(
        id=uuid.uuid4(),
        organization_id=org_a.id,
        email="admin@firm-alpha.com",
        full_name="Alpha Managing Partner",
        status="active",
        created_at=now,
        updated_at=now,
    )
    admin_b = User(
        id=uuid.uuid4(),
        organization_id=org_b.id,
        email="admin@firm-beta.com",
        full_name="Beta Managing Partner",
        status="active",
        created_at=now,
        updated_at=now,
    )
    db.add_all([admin_a, admin_b])
    db.flush()

    # 3. Clients
    client_a = ClientProfile(
        id=uuid.uuid4(),
        organization_id=org_a.id,
        user_id=uuid.uuid4(),
        first_name="Alice",
        last_name="Alpha",
        email="alice@alpha-client.com",
        phone="+12025550101",
        nationality="USA",
        created_at=now,
    )
    client_b = ClientProfile(
        id=uuid.uuid4(),
        organization_id=org_b.id,
        user_id=uuid.uuid4(),
        first_name="Bob",
        last_name="Beta",
        email="bob@beta-client.com",
        phone="+442071838787",
        nationality="GBR",
        created_at=now,
    )
    db.add_all([client_a, client_b])
    db.flush()

    # 4. Cases
    case_a = ImmigrationCase(
        id=uuid.uuid4(),
        organization_id=org_a.id,
        client_id=client_a.id,
        case_number="CASE-ALPHA-001",
        title="EB-1A Extraordinary Ability: Alice Alpha",
        jurisdiction="US",
        visa_category="EB-1A",
        status="intake",
        created_at=now,
        updated_at=now,
    )
    case_b = ImmigrationCase(
        id=uuid.uuid4(),
        organization_id=org_b.id,
        client_id=client_b.id,
        case_number="CASE-BETA-001",
        title="O-1A Extraordinary Achievement: Bob Beta",
        jurisdiction="US",
        visa_category="O-1A",
        status="intake",
        created_at=now,
        updated_at=now,
    )
    db.add_all([case_a, case_b])
    db.flush()

    # 5. Appointments
    appt_a = VisaAppointment(
        id=uuid.uuid4(),
        organization_id=org_a.id,
        case_id=case_a.id,
        client_id=client_a.id,
        vac_center="Alpha VAC",
        consular_post="London",
        ofc_biometrics_slot=now,
        consular_interview_slot=now,
        appointment_status="scheduled",
        created_at=now,
        updated_at=now,
    )
    appt_b = VisaAppointment(
        id=uuid.uuid4(),
        organization_id=org_b.id,
        case_id=case_b.id,
        client_id=client_b.id,
        vac_center="Beta VAC",
        consular_post="Paris",
        ofc_biometrics_slot=now,
        consular_interview_slot=now,
        appointment_status="scheduled",
        created_at=now,
        updated_at=now,
    )
    db.add_all([appt_a, appt_b])
    db.flush()

    # 6. Document Requests
    req_a = DocumentRequest(
        id=uuid.uuid4(),
        organization_id=org_a.id,
        case_id=case_a.id,
        requested_by_user_id=admin_a.id,
        requested_from_client_id=client_a.id,
        title="Alpha Tax Transcripts Request",
        description="Please provide 3 years of IRS tax transcripts",
        rationale="Statutory public charge and financial ability review",
        category="supporting_evidence",
        status="requested",
        created_at=now,
        updated_at=now,
    )
    req_b = DocumentRequest(
        id=uuid.uuid4(),
        organization_id=org_b.id,
        case_id=case_b.id,
        requested_by_user_id=admin_b.id,
        requested_from_client_id=client_b.id,
        title="Beta Employment Verification Request",
        description="Please provide employer verification letter",
        rationale="Proof of qualifying specialty occupation employment",
        category="supporting_evidence",
        status="requested",
        created_at=now,
        updated_at=now,
    )
    db.add_all([req_a, req_b])
    db.flush()

    # 7. Documents
    doc_a = Document(
        id=uuid.uuid4(),
        organization_id=org_a.id,
        case_id=case_a.id,
        client_id=client_a.id,
        uploaded_by_user_id=admin_a.id,
        title="Alpha Passport Scan",
        filename="passport_alpha.pdf",
        category="identity",
        storage_path="tenants/alpha/passport.pdf",
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        byte_size=1024,
        mime_type="application/pdf",
        created_at=now,
    )
    doc_b = Document(
        id=uuid.uuid4(),
        organization_id=org_b.id,
        case_id=case_b.id,
        client_id=client_b.id,
        uploaded_by_user_id=admin_b.id,
        title="Beta Passport Scan",
        filename="passport_beta.pdf",
        category="identity",
        storage_path="tenants/beta/passport.pdf",
        sha256_hash="f4c0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b856",
        byte_size=2048,
        mime_type="application/pdf",
        created_at=now,
    )
    db.add_all([doc_a, doc_b])
    db.commit()

    # Cryptographic JWT Tokens
    token_a = create_access_token({
        "sub": str(admin_a.id),
        "org_id": str(org_a.id),
        "email": admin_a.email,
        "roles": [RoleCode.MASTER_ADMIN.value],
    })
    token_b = create_access_token({
        "sub": str(admin_b.id),
        "org_id": str(org_b.id),
        "email": admin_b.email,
        "roles": [RoleCode.MASTER_ADMIN.value],
    })

    return {
        "org_a": org_a,
        "org_b": org_b,
        "admin_a": admin_a,
        "admin_b": admin_b,
        "client_a": client_a,
        "client_b": client_b,
        "case_a": case_a,
        "case_b": case_b,
        "appt_a": appt_a,
        "appt_b": appt_b,
        "req_a": req_a,
        "req_b": req_b,
        "doc_a": doc_a,
        "doc_b": doc_b,
        "token_a": token_a,
        "token_b": token_b,
        "headers_a_sim": {
            "X-Organization-Id": str(org_a.id),
            "X-User-Id": str(admin_a.id),
            "X-User-Role": RoleCode.MASTER_ADMIN.value,
        },
        "headers_b_sim": {
            "X-Organization-Id": str(org_b.id),
            "X-User-Id": str(admin_b.id),
            "X-User-Role": RoleCode.MASTER_ADMIN.value,
        },
        "headers_a_jwt": {
            "Authorization": f"Bearer {token_a}",
        },
        "headers_b_jwt": {
            "Authorization": f"Bearer {token_b}",
        },
    }


def test_cross_tenant_case_listing_leak_prevention_master_admin(client, multi_tenant_fixture):
    """Adversarial Test 1:
    Tenant A Master Admin requests GET /api/v1/cases.
    Must return ONLY Tenant A cases. Tenant B cases must NEVER be returned under any condition.
    Verified with both simulation headers and signed JWT Bearer tokens.
    """
    tf = multi_tenant_fixture

    for auth_headers, desc in [
        (tf["headers_a_sim"], "Simulation Headers"),
        (tf["headers_a_jwt"], "Signed Bearer JWT"),
    ]:
        resp = client.get("/api/v1/cases", headers=auth_headers)
        assert resp.status_code == status.HTTP_200_OK, f"Failed under {desc}: {resp.text}"
        cases = resp.json()

        assert len(cases) == 1, f"Expected exactly 1 case for Tenant A under {desc}, got {len(cases)}"
        assert cases[0]["case_number"] == tf["case_a"].case_number
        assert cases[0]["id"] == str(tf["case_a"].id)
        assert cases[0]["organization_id"] == str(tf["org_a"].id)

        # Explicitly verify Tenant B's case is absent
        returned_ids = {c["id"] for c in cases}
        returned_numbers = {c["case_number"] for c in cases}
        assert str(tf["case_b"].id) not in returned_ids, f"CRITICAL LEAK: Tenant B case ID leaked under {desc}"
        assert tf["case_b"].case_number not in returned_numbers, f"CRITICAL LEAK: Tenant B case number leaked under {desc}"

    # Symmetrical verification for Tenant B
    for auth_headers, desc in [
        (tf["headers_b_sim"], "Simulation Headers"),
        (tf["headers_b_jwt"], "Signed Bearer JWT"),
    ]:
        resp_b = client.get("/api/v1/cases", headers=auth_headers)
        assert resp_b.status_code == status.HTTP_200_OK
        cases_b = resp_b.json()
        assert len(cases_b) == 1
        assert cases_b[0]["id"] == str(tf["case_b"].id)
        assert str(tf["case_a"].id) not in {c["id"] for c in cases_b}


def test_cross_tenant_client_listing_leak_prevention_master_admin(client, multi_tenant_fixture):
    """Adversarial Test 2:
    Tenant A Master Admin requests GET /api/v1/clients.
    Must return ONLY Tenant A clients. Tenant B client PII must NEVER be returned.
    """
    tf = multi_tenant_fixture

    for auth_headers, desc in [
        (tf["headers_a_sim"], "Simulation Headers"),
        (tf["headers_a_jwt"], "Signed Bearer JWT"),
    ]:
        resp = client.get("/api/v1/clients", headers=auth_headers)
        assert resp.status_code == status.HTTP_200_OK, f"Failed under {desc}: {resp.text}"
        clients = resp.json()

        assert len(clients) == 1, f"Expected 1 client for Tenant A under {desc}, got {len(clients)}"
        assert clients[0]["id"] == str(tf["client_a"].id)
        assert clients[0]["email"] == tf["client_a"].email
        assert clients[0]["organization_id"] == str(tf["org_a"].id)

        # Assert Tenant B client PII is never present
        returned_emails = {c["email"] for c in clients}
        returned_ids = {c["id"] for c in clients}
        assert str(tf["client_b"].id) not in returned_ids, f"CRITICAL LEAK: Tenant B client ID leaked under {desc}"
        assert tf["client_b"].email not in returned_emails, f"CRITICAL LEAK: Tenant B email leaked under {desc}"


def test_cross_tenant_case_creation_foreign_client_id_rejected(client, multi_tenant_fixture, db):
    """Adversarial Test 3:
    Tenant A Master Admin attempts POST /api/v1/cases specifying Tenant B's client_id.
    Must fail with 404 (EntityNotFoundError), never create a case, and never link across tenants.
    """
    tf = multi_tenant_fixture

    payload = {
        "client_id": str(tf["client_b"].id),  # Foreign client from Tenant B
        "case_number": "CASE-INTRUDER-999",
        "title": "Adversarial Cross-Tenant Case Injection",
        "jurisdiction": "US",
        "visa_category": "EB-1A",
        "status": "intake",
    }

    for auth_headers, desc in [
        (tf["headers_a_sim"], "Simulation Headers"),
        (tf["headers_a_jwt"], "Signed Bearer JWT"),
    ]:
        resp = client.post("/api/v1/cases", headers=auth_headers, json=payload)
        assert resp.status_code == status.HTTP_404_NOT_FOUND, f"Expected 404 under {desc}, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data["error"] == "EntityNotFoundError"
        assert str(tf["client_b"].id) in data["message"]

    # Verify no case was inserted into the database
    case_in_db = db.query(ImmigrationCase).filter(ImmigrationCase.case_number == "CASE-INTRUDER-999").first()
    assert case_in_db is None, "CRITICAL: Foreign case was erroneously inserted into database"


def test_cross_tenant_client_creation_foreign_org_id_rejected(client, multi_tenant_fixture, db):
    """Adversarial Test 4:
    Tenant A Master Admin attempts POST /api/v1/clients supplying Tenant B's organization_id in payload.
    Must be blocked with 403 Forbidden (TenantIsolationError).
    """
    tf = multi_tenant_fixture

    payload = {
        "organization_id": str(tf["org_b"].id),  # Malicious foreign org ID injection
        "first_name": "Trojan",
        "last_name": "Applicant",
        "email": "trojan@adversary.com",
        "phone": "+19999999999",
        "nationality": "USA",
    }

    for auth_headers, desc in [
        (tf["headers_a_sim"], "Simulation Headers"),
        (tf["headers_a_jwt"], "Signed Bearer JWT"),
    ]:
        resp = client.post("/api/v1/clients", headers=auth_headers, json=payload)
        assert resp.status_code == status.HTTP_403_FORBIDDEN, f"Expected 403 under {desc}, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data["error"] == "TenantIsolationError"
        assert "Cross-tenant access forbidden" in data["message"]

    # Verify no client was created in Tenant B or under this email
    trojan_client = db.query(ClientProfile).filter(ClientProfile.email == "trojan@adversary.com").first()
    assert trojan_client is None, "CRITICAL: Trojan client was inserted despite cross-tenant attempt"


def test_cross_tenant_direct_case_access_idor_blocked(client, multi_tenant_fixture, db):
    """Adversarial Test 5:
    Tenant A Master Admin attempts direct object access (IDOR) on Tenant B's case.
    - GET /api/v1/cases/{case_b_id} -> 403 TenantIsolationError
    - PUT /api/v1/cases/{case_b_id} -> 403 TenantIsolationError (data unchanged)
    - GET /api/v1/cases/{case_b_id}/history -> 403 TenantIsolationError
    """
    tf = multi_tenant_fixture
    case_b_id = str(tf["case_b"].id)
    original_title = tf["case_b"].title

    for auth_headers, desc in [
        (tf["headers_a_sim"], "Simulation Headers"),
        (tf["headers_a_jwt"], "Signed Bearer JWT"),
    ]:
        # 1. Direct GET
        get_resp = client.get(f"/api/v1/cases/{case_b_id}", headers=auth_headers)
        assert get_resp.status_code == status.HTTP_403_FORBIDDEN, f"IDOR GET succeeded under {desc}: {get_resp.text}"
        assert get_resp.json()["error"] == "TenantIsolationError"

        # 2. Direct PUT (update attempt)
        put_resp = client.put(
            f"/api/v1/cases/{case_b_id}",
            headers=auth_headers,
            json={"title": "Hacked Title by Tenant A"},
        )
        assert put_resp.status_code == status.HTTP_403_FORBIDDEN, f"IDOR PUT succeeded under {desc}: {put_resp.text}"
        assert put_resp.json()["error"] == "TenantIsolationError"

        # 3. Direct GET history
        hist_resp = client.get(f"/api/v1/cases/{case_b_id}/history", headers=auth_headers)
        assert hist_resp.status_code == status.HTTP_403_FORBIDDEN, f"IDOR GET history succeeded under {desc}: {hist_resp.text}"
        assert hist_resp.json()["error"] == "TenantIsolationError"

    # Confirm case_b data was completely untouched in DB
    db.refresh(tf["case_b"])
    assert tf["case_b"].title == original_title, "CRITICAL: Case B title was modified by Tenant A IDOR attack"


def test_cross_tenant_direct_client_access_idor_blocked(client, multi_tenant_fixture, db):
    """Adversarial Test 6:
    Tenant A Master Admin attempts direct object access on Tenant B's client.
    - GET /api/v1/clients/{client_b_id} -> 403 TenantIsolationError
    - DELETE /api/v1/clients/{client_b_id} -> 403 Forbidden
    """
    tf = multi_tenant_fixture
    client_b_id = str(tf["client_b"].id)

    for auth_headers, desc in [
        (tf["headers_a_sim"], "Simulation Headers"),
        (tf["headers_a_jwt"], "Signed Bearer JWT"),
    ]:
        # 1. Direct GET client
        get_resp = client.get(f"/api/v1/clients/{client_b_id}", headers=auth_headers)
        assert get_resp.status_code == status.HTTP_403_FORBIDDEN, f"IDOR GET client succeeded under {desc}: {get_resp.text}"
        assert get_resp.json()["error"] == "TenantIsolationError"

        # 2. Direct DELETE client
        del_resp = client.delete(f"/api/v1/clients/{client_b_id}", headers=auth_headers)
        assert del_resp.status_code == status.HTTP_403_FORBIDDEN, f"IDOR DELETE client succeeded under {desc}: {del_resp.text}"

    # Confirm client_b is still intact in DB
    client_in_db = db.query(ClientProfile).filter(ClientProfile.id == tf["client_b"].id).first()
    assert client_in_db is not None, "CRITICAL: Client B was deleted by Tenant A IDOR attack"


def test_header_spoofing_resistance_with_valid_jwt(client, multi_tenant_fixture):
    """Adversarial Test 7:
    Header Spoofing Attack:
    Attacker presents a valid cryptographic JWT for Tenant A, but adds:
    - `X-Organization-Id: <Tenant B ID>`
    - `X-Org-Id: <Tenant B ID>`
    The backend MUST strictly bind the session to Tenant A (from JWT claims) and ignore spoofed headers.
    """
    tf = multi_tenant_fixture

    spoofed_headers = {
        "Authorization": f"Bearer {tf['token_a']}",
        "X-Organization-Id": str(tf["org_b"].id),  # Spoofing attempt
        "X-Org-Id": str(tf["org_b"].id),
    }

    # 1. Listing cases must return Tenant A's cases, NEVER Tenant B's
    resp_cases = client.get("/api/v1/cases", headers=spoofed_headers)
    assert resp_cases.status_code == status.HTTP_200_OK
    cases = resp_cases.json()
    assert len(cases) == 1
    assert cases[0]["id"] == str(tf["case_a"].id)
    assert str(tf["case_b"].id) not in {c["id"] for c in cases}

    # 2. Listing clients must return Tenant A's clients, NEVER Tenant B's
    resp_clients = client.get("/api/v1/clients", headers=spoofed_headers)
    assert resp_clients.status_code == status.HTTP_200_OK
    clients = resp_clients.json()
    assert len(clients) == 1
    assert clients[0]["id"] == str(tf["client_a"].id)
    assert str(tf["client_b"].id) not in {c["id"] for c in clients}


def test_header_spoofing_arbitrary_dummy_uuids(client, multi_tenant_fixture):
    """Adversarial Test 8:
    Attacker provides an arbitrary or non-existent UUID in X-Organization-Id header.
    Assert zero information disclosure or data bleeding from existing tenants.
    """
    dummy_org_id = str(uuid.uuid4())
    headers = {
        "X-Organization-Id": dummy_org_id,
        "X-User-Id": str(uuid.uuid4()),
        "X-User-Role": RoleCode.MASTER_ADMIN.value,
    }

    # Cases listing returns empty list
    resp_cases = client.get("/api/v1/cases", headers=headers)
    assert resp_cases.status_code == status.HTTP_200_OK
    assert resp_cases.json() == []

    # Clients listing returns empty list
    resp_clients = client.get("/api/v1/clients", headers=headers)
    assert resp_clients.status_code == status.HTTP_200_OK
    assert resp_clients.json() == []

    # Random case ID query returns 404
    random_case_id = str(uuid.uuid4())
    resp_case = client.get(f"/api/v1/cases/{random_case_id}", headers=headers)
    assert resp_case.status_code == status.HTTP_404_NOT_FOUND
    assert resp_case.json()["error"] == "EntityNotFoundError"


def test_cross_tenant_appointments_and_requests_isolation(client, multi_tenant_fixture):
    """Adversarial Test 9:
    Verify that appointments and document requests are impenetrable across tenant boundaries.
    """
    tf = multi_tenant_fixture

    for auth_headers, desc in [
        (tf["headers_a_sim"], "Simulation Headers"),
        (tf["headers_a_jwt"], "Signed Bearer JWT"),
    ]:
        # Appointments
        resp_appts = client.get("/api/v1/appointments", headers=auth_headers)
        assert resp_appts.status_code == status.HTTP_200_OK, f"Appointments failed under {desc}"
        appts = resp_appts.json()
        assert len(appts) == 1
        assert appts[0]["id"] == str(tf["appt_a"].id)
        assert str(tf["appt_b"].id) not in {a["id"] for a in appts}

        # Document Requests
        resp_reqs = client.get("/api/v1/requests", headers=auth_headers)
        assert resp_reqs.status_code == status.HTTP_200_OK, f"Requests failed under {desc}"
        reqs = resp_reqs.json()
        assert len(reqs) == 1
        assert reqs[0]["id"] == str(tf["req_a"].id)
        assert str(tf["req_b"].id) not in {r["id"] for r in reqs}


def test_standardized_error_envelope_contract_on_adversarial_rejections(client, multi_tenant_fixture):
    """Adversarial Test 10:
    Verify that all adversarial boundary rejections (403, 404, 401) strictly comply
    with PROJECT.md Interface Contract #2:
    {
      "error": str,
      "message": str,
      "detail": str,
      "details": list | dict | None,
      "correlation_id": str (UUID)
    }
    and response header X-Correlation-ID matches correlation_id.
    """
    tf = multi_tenant_fixture

    # 1. 403 TenantIsolationError
    resp_403 = client.get(f"/api/v1/cases/{tf['case_b'].id}", headers=tf["headers_a_jwt"])
    assert resp_403.status_code == status.HTTP_403_FORBIDDEN
    data_403 = resp_403.json()
    assert data_403["error"] == "TenantIsolationError"
    assert "message" in data_403 and len(data_403["message"]) > 0
    assert "detail" in data_403
    assert "correlation_id" in data_403
    uuid.UUID(data_403["correlation_id"])  # Validates UUID format
    assert resp_403.headers.get("x-correlation-id") == data_403["correlation_id"]

    # 2. 404 EntityNotFoundError
    resp_404 = client.get(f"/api/v1/cases/{uuid.uuid4()}", headers=tf["headers_a_jwt"])
    assert resp_404.status_code == status.HTTP_404_NOT_FOUND
    data_404 = resp_404.json()
    assert data_404["error"] == "EntityNotFoundError"
    assert "message" in data_404
    assert "correlation_id" in data_404
    uuid.UUID(data_404["correlation_id"])
    assert resp_404.headers.get("x-correlation-id") == data_404["correlation_id"]

    # 3. 401 AuthenticationError (tampered token)
    tampered_headers = {"Authorization": "Bearer invalid.jwt.signature"}
    resp_401 = client.get("/api/v1/cases", headers=tampered_headers)
    assert resp_401.status_code == status.HTTP_401_UNAUTHORIZED
    data_401 = resp_401.json()
    assert data_401["error"] == "AuthenticationError"
    assert "correlation_id" in data_401
    uuid.UUID(data_401["correlation_id"])
    assert resp_401.headers.get("x-correlation-id") == data_401["correlation_id"]


def test_cross_tenant_document_listing_leak_prevention(client, multi_tenant_fixture):
    """Adversarial Test 11:
    Tenant A Master Admin requests GET /api/v1/documents.
    Must return ONLY Tenant A documents. Tenant B documents must NEVER be returned.
    """
    tf = multi_tenant_fixture

    for auth_headers, desc in [
        (tf["headers_a_sim"], "Simulation Headers"),
        (tf["headers_a_jwt"], "Signed Bearer JWT"),
    ]:
        resp = client.get("/api/v1/documents", headers=auth_headers)
        assert resp.status_code == status.HTTP_200_OK, f"Failed under {desc}: {resp.text}"
        docs = resp.json()
        assert len(docs) == 1
        assert docs[0]["id"] == str(tf["doc_a"].id)
        assert str(tf["doc_b"].id) not in {d["id"] for d in docs}


def test_cross_tenant_document_direct_access_idor_blocked(client, multi_tenant_fixture):
    """Adversarial Test 12:
    Tenant A attempts direct object access (IDOR) on Tenant B's document:
    - GET /api/v1/documents/{doc_b_id} -> 403 TenantIsolationError
    - POST /api/v1/documents/{doc_b_id}/download-token -> 403 TenantIsolationError
    """
    tf = multi_tenant_fixture
    doc_b_id = str(tf["doc_b"].id)

    for auth_headers, desc in [
        (tf["headers_a_sim"], "Simulation Headers"),
        (tf["headers_a_jwt"], "Signed Bearer JWT"),
    ]:
        # 1. View Document Dossier
        resp_get = client.get(f"/api/v1/documents/{doc_b_id}", headers=auth_headers)
        assert resp_get.status_code == status.HTTP_403_FORBIDDEN, f"IDOR GET doc succeeded under {desc}"
        assert resp_get.json()["error"] == "TenantIsolationError"

        # 2. Request Download Token
        resp_tok = client.post(f"/api/v1/documents/{doc_b_id}/download-token", headers=auth_headers)
        assert resp_tok.status_code == status.HTTP_403_FORBIDDEN, f"IDOR download token succeeded under {desc}"
        assert resp_tok.json()["error"] == "TenantIsolationError"


def test_cross_tenant_document_upload_to_foreign_case_blocked(client, multi_tenant_fixture):
    """Adversarial Test 13:
    Tenant A attempts to upload a document specifying Tenant B's case_id.
    Must fail with 403 Forbidden (TenantIsolationError).
    """
    tf = multi_tenant_fixture
    dummy_pdf_bytes = b"%PDF-1.4\n%Fake PDF content for test\n%%EOF"

    for auth_headers, desc in [
        (tf["headers_a_sim"], "Simulation Headers"),
        (tf["headers_a_jwt"], "Signed Bearer JWT"),
    ]:
        files = {
            "file": ("trojan.pdf", io.BytesIO(dummy_pdf_bytes), "application/pdf"),
        }
        data = {
            "case_id": str(tf["case_b"].id),  # Belongs to Tenant B
            "category": "supporting_evidence",
            "title": "Cross Tenant Trojan Document",
        }
        resp = client.post("/api/v1/documents/upload", headers=auth_headers, files=files, data=data)
        assert resp.status_code == status.HTTP_403_FORBIDDEN, f"Cross-tenant upload succeeded under {desc}: {resp.text}"
        assert resp.json()["error"] == "TenantIsolationError"


def test_cross_tenant_appointment_creation_blocked(client, multi_tenant_fixture, db):
    """Adversarial Test 14:
    Tenant A attempts to schedule a Visa Appointment referencing Tenant B's case_id.
    Must be blocked with 403 Forbidden (TenantIsolationError).
    """
    tf = multi_tenant_fixture
    now = datetime.now(timezone.utc)

    payload = {
        "case_id": str(tf["case_b"].id),  # Case from Tenant B
        "vac_center": "Alpha Infiltrator VAC",
        "consular_post": "New Delhi",
        "ofc_biometrics_slot": now.isoformat(),
        "consular_interview_slot": now.isoformat(),
    }

    for auth_headers, desc in [
        (tf["headers_a_sim"], "Simulation Headers"),
        (tf["headers_a_jwt"], "Signed Bearer JWT"),
    ]:
        resp = client.post("/api/v1/appointments", headers=auth_headers, json=payload)
        assert resp.status_code == status.HTTP_403_FORBIDDEN, f"Cross-tenant appointment creation succeeded under {desc}"
        assert resp.json()["error"] == "TenantIsolationError"


def test_agency_master_admin_cannot_access_platform_super_admin_control_plane(client, multi_tenant_fixture):
    """Adversarial Test 15:
    Agency Master Admin (Tenant A or B) attempts to access Documento HQ Super-Admin Control Plane routes.
    Must be strictly blocked with 403 Forbidden (PermissionDeniedError) per PROJECT.md Contract #1:
    "ctx.is_master_admin() NEVER bypasses organization filtering. Only ctx.is_platform_super_admin()
     on /api/v1/agency-platform/super-admin/* accesses cross-tenant records."
    """
    tf = multi_tenant_fixture

    super_admin_routes = [
        ("GET", "/api/v1/agency-platform/super-admin/overview"),
        ("GET", "/api/v1/agency-platform/super-admin/agencies"),
        ("GET", "/api/v1/agency-platform/super-admin/applications"),
    ]

    for method, path in super_admin_routes:
        # Test with simulation headers
        resp_sim = client.request(method, path, headers=tf["headers_a_sim"])
        assert resp_sim.status_code == status.HTTP_403_FORBIDDEN, f"Master Admin bypassed super-admin on {path} with sim headers"
        assert resp_sim.json()["error"] == "PermissionDeniedError"

        # Test with signed JWT
        resp_jwt = client.request(method, path, headers=tf["headers_a_jwt"])
        assert resp_jwt.status_code == status.HTTP_403_FORBIDDEN, f"Master Admin bypassed super-admin on {path} with JWT"
        assert resp_jwt.json()["error"] == "PermissionDeniedError"
