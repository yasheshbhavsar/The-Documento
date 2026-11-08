import uuid
import pytest
from backend.app.domain.case_service import CaseStage


def test_f01_blackbox_extractor_and_ai_endpoints(client, two_tenants):
    """
    Feature 1: AI/OCR/Extractor Lab Strict Boundary Isolation.
    Verify public extractor endpoints function strictly as a black box without mutation.
    """
    headers = two_tenants["tenant_a"]["headers"]

    # 1. Samples retrieval
    samples_resp = client.get("/api/v1/extractor/samples")
    assert samples_resp.status_code == 200
    samples = samples_resp.json()
    assert isinstance(samples, list)
    assert len(samples) > 0
    assert "name" in samples[0] or "title" in samples[0] or "filename" in samples[0]

    # 2. Standalone text extraction
    passport_text = (
        "PASSPORT / PASSEPORT\n"
        "Country: Canada / CAN\n"
        "Type: P  Code: CAN  Passport No: ZE123456\n"
        "Surname: TREMBLAY\n"
        "Given Names: GUILLAUME\n"
        "Nationality: CANADIAN\n"
        "Date of Birth: 14 NOV 1988\n"
        "Sex: M\n"
        "Date of Expiry: 14 NOV 2030\n"
    )
    analyze_resp = client.post(
        "/api/v1/extractor/analyze-text",
        json={
            "text": passport_text,
            "filename": "canadian_passport.txt",
            "declared_category": "PASSPORT",
        },
    )
    assert analyze_resp.status_code == 200
    res_data = analyze_resp.json()
    assert res_data.get("status") == "success"
    assert "recognition" in res_data
    assert "extracted_fields" in res_data

    # 3. AI Evaluation Report
    eval_resp = client.get("/api/v1/ai/evaluation/report", headers=headers)
    assert eval_resp.status_code == 200
    eval_data = eval_resp.json()
    assert "overall_status" in eval_data and "production_ready" in eval_data


def test_f02_backend_multitenancy_scoping(client, two_tenants):
    """
    Feature 2: Backend Multi-Tenancy & Tenant Scoping Hardening.
    Ensure cases and clients are strictly isolated to the requesting organization.
    Specification: PROJECT.md § Interface Contracts 1 - Every agency query MUST be filtered by organization_id.
    """
    headers_a = two_tenants["tenant_a"]["headers"]
    headers_b = two_tenants["tenant_b"]["headers"]

    # Tenant A lists clients -> must see Client A, never Client B
    clients_resp_a = client.get("/api/v1/clients", headers=headers_a)
    assert clients_resp_a.status_code == 200
    clients_a = clients_resp_a.json()
    client_ids_a = [c["id"] for c in clients_a]
    assert str(two_tenants["client_a"].id) in client_ids_a
    assert str(two_tenants["client_b"].id) not in client_ids_a

    # Tenant B lists clients -> must see Client B, never Client A
    clients_resp_b = client.get("/api/v1/clients", headers=headers_b)
    assert clients_resp_b.status_code == 200
    clients_b = clients_resp_b.json()
    client_ids_b = [c["id"] for c in clients_b]
    assert str(two_tenants["client_b"].id) in client_ids_b
    assert str(two_tenants["client_a"].id) not in client_ids_b

    # Staff caseworkers list cases -> must see assigned/tenant cases only
    worker_headers_a = two_tenants["worker_a"]["headers"]
    worker_resp_a = client.get("/api/v1/cases", headers=worker_headers_a)
    assert worker_resp_a.status_code == 200


def test_f03_document_ingestion_and_guidance(client, two_tenants):
    """
    Feature 3: File Ingestion Concurrency & Guidance.
    Verify upload guidance, upload session initialization, and batch upload receipt.
    """
    headers = two_tenants["tenant_a"]["headers"]
    case_id = str(two_tenants["case_a"].id)

    # 1. Upload guidance standards
    guidance_resp = client.get("/api/v1/documents/upload-guidance", headers=headers)
    assert guidance_resp.status_code == 200
    guidance = guidance_resp.json()
    assert "allowed_mime_types" in guidance or "rules" in guidance or "max_file_size_bytes" in guidance

    # 2. Initialize upload session
    session_resp = client.post(
        "/api/v1/documents/upload-sessions",
        headers=headers,
        json={
            "idempotency_key": f"key-{uuid.uuid4().hex[:12]}",
            "filename": "birth_certificate.pdf",
            "mime_type": "application/pdf",
            "byte_size": 1024 * 50,
            "case_id": case_id,
        },
    )
    assert session_resp.status_code == 201
    session_data = session_resp.json()
    assert "session_id" in session_data
    assert "idempotency_key" in session_data


def test_f04_database_integrity_and_findings(client, two_tenants):
    """
    Feature 4: Database Integrity Constraint Remediation.
    Verify findings queries execute without null constraint violations.
    """
    headers = two_tenants["tenant_a"]["headers"]
    case_id = str(two_tenants["case_a"].id)

    # 1. Findings list endpoint on case route
    findings_resp = client.get(f"/api/v1/cases/{case_id}/findings", headers=headers)
    assert findings_resp.status_code == 200
    assert isinstance(findings_resp.json(), list)

    # 2. Findings summary endpoint on case route
    summary_resp = client.get(f"/api/v1/cases/{case_id}/findings/summary", headers=headers)
    assert summary_resp.status_code == 200


def test_f05_modular_schemas_validation(client, two_tenants):
    """
    Feature 5: Backend Modular Schemas Package.
    Verify strict request validation on core resources.
    """
    headers = two_tenants["tenant_a"]["headers"]

    # 1. Create a client with validated schema
    client_payload = {
        "first_name": "Alexander",
        "last_name": "Wright",
        "email": "alex.wright@example.com",
        "phone": "+44-20-7946-0950",
        "nationality": "GBR",
    }
    client_resp = client.post("/api/v1/clients", headers=headers, json=client_payload)
    assert client_resp.status_code == 201
    created_client = client_resp.json()
    assert created_client["email"] == "alex.wright@example.com"
    assert created_client["first_name"] == "Alexander"

    # 2. Create a case for this client with validated schema
    case_payload = {
        "client_id": created_client["id"],
        "case_number": f"CASE-{uuid.uuid4().hex[:6].upper()}",
        "title": "UK Skilled Worker to Canada Intra-Company Transfer",
        "jurisdiction": "CA",
        "visa_category": "Intra-Company Transfer",
        "status": "intake",
    }
    case_resp = client.post("/api/v1/cases", headers=headers, json=case_payload)
    assert case_resp.status_code == 201
    created_case = case_resp.json()
    assert created_case["title"] == case_payload["title"]
    assert created_case["jurisdiction"] == "CA"


def test_f06_eager_loading_and_listing_routes(client, two_tenants):
    """
    Feature 6: Eager Loading & N+1 Query Elimination.
    Verify appointments, documents, and requests listing routes return 200 OK without query errors.
    """
    headers = two_tenants["tenant_a"]["headers"]

    # 1. Appointments listing
    apt_resp = client.get("/api/v1/appointments", headers=headers)
    assert apt_resp.status_code == 200
    assert isinstance(apt_resp.json(), list)

    # 2. Documents listing
    docs_resp = client.get("/api/v1/documents", headers=headers)
    assert docs_resp.status_code == 200
    assert isinstance(docs_resp.json(), list)

    # 3. Requests listing
    req_resp = client.get("/api/v1/requests", headers=headers)
    assert req_resp.status_code == 200
    assert isinstance(req_resp.json(), list)


def test_f07_standardized_error_responses(client, two_tenants):
    """
    Feature 7: Standardized Backend Error Responses.
    Verify non-existent resource returns 404 with normalized contract:
    {error, message, detail} and X-Correlation-ID header.
    """
    headers = two_tenants["tenant_a"]["headers"]
    random_id = str(uuid.uuid4())

    resp = client.get(f"/api/v1/cases/{random_id}", headers=headers)
    assert resp.status_code == 404
    data = resp.json()
    assert "error" in data
    assert "message" in data or "detail" in data
    assert "X-Correlation-ID" in resp.headers


def test_f15_client_onboarding_and_magic_links(client, two_tenants):
    """
    Feature 15: Streamlined Client Onboarding & Magic Links.
    Verify generating portal invite links for retained applicants.
    """
    headers = two_tenants["tenant_a"]["headers"]
    case_id = str(two_tenants["case_a"].id)

    resp = client.post(
        "/api/v1/portal/invite",
        headers=headers,
        json={
            "case_id": case_id,
            "email": "applicant-invite@example.com",
            "full_name": "Applicant Invitee",
            "relationship_type": "primary_applicant",
            "is_authorized_to_view_case": True,
        },
    )
    assert resp.status_code == 201
    invite_data = resp.json()
    assert "invitation_token" in invite_data
    assert "invitation_id" in invite_data


def test_f16_case_creation_and_task_lifecycle(client, two_tenants):
    """
    Feature 16: Dedicated Case Creation & Task Setup.
    Verify creating tasks and tracking case milestones.
    """
    headers = two_tenants["tenant_a"]["headers"]
    case_id = str(two_tenants["case_a"].id)

    # 1. Create a task for the case
    task_resp = client.post(
        f"/api/v1/cases/{case_id}/tasks",
        headers=headers,
        json={
            "title": "Review ECA Educational Credential Assessment",
            "priority": "HIGH",
            "category": "EVIDENCE_GATHERING",
        },
    )
    assert task_resp.status_code == 201
    task_data = task_resp.json()
    assert task_data["title"] == "Review ECA Educational Credential Assessment"

    # 2. List tasks for the case
    list_resp = client.get(f"/api/v1/cases/{case_id}/tasks", headers=headers)
    assert list_resp.status_code == 200
    tasks = list_resp.json()
    assert any(t["id"] == task_data["id"] for t in tasks)


def test_f18_jurisdiction_rules_and_statutory_standards(client, two_tenants):
    """
    Feature 18: Jargon Remediation & Jurisdiction Adaptability.
    Verify official rule sources and multi-country pathways.
    """
    headers = two_tenants["tenant_a"]["headers"]

    # 1. Countries endpoint
    countries_resp = client.get("/api/v1/rules/countries", headers=headers)
    assert countries_resp.status_code == 200
    countries = countries_resp.json()
    assert isinstance(countries, (list, dict))

    # 2. Coverage matrix endpoint
    cov_resp = client.get("/api/v1/rules/coverage-matrix", headers=headers)
    assert cov_resp.status_code == 200


def test_f19_standardized_six_stage_case_lifecycle(client, two_tenants):
    """
    Feature 19: Standardized 6-Stage Case Lifecycle.
    Verify progressing a case through validated stages.
    """
    headers = two_tenants["tenant_a"]["headers"]
    case_id = str(two_tenants["case_a"].id)

    # Advance from intake to awaiting_documents / processing
    trans_resp = client.put(
        f"/api/v1/cases/{case_id}/status",
        headers=headers,
        json={
            "status": "awaiting_documents",
            "reason": "Initial intake verified by paralegal",
            "notes": "Requesting passport and police certificate",
        },
    )
    assert trans_resp.status_code == 200
    updated_case = trans_resp.json()
    assert updated_case["status"] == "awaiting_documents"


def test_f20_clean_slate_empty_states(client, auth_factory):
    """
    Feature 20: Guided Empty States & Dead-End Elimination.
    Verify fresh tenant with 0 cases and 0 clients returns clean empty lists.
    """
    fresh_tenant = auth_factory(
        email="fresh-owner@brandnewfirm.com",
        org_name="Brand New Firm",
        org_slug="brand-new-firm",
    )
    headers = fresh_tenant["headers"]

    # 1. Empty cases
    cases_resp = client.get("/api/v1/cases", headers=headers)
    assert cases_resp.status_code == 200
    assert cases_resp.json() == []

    # 2. Empty clients
    clients_resp = client.get("/api/v1/clients", headers=headers)
    assert clients_resp.status_code == 200
    assert clients_resp.json() == []
