import io
import uuid
import pytest
from datetime import datetime, timezone


def test_pairwise_onboarding_to_package_workflow(client, two_tenants):
    """
    Tier 3 Pairwise Workflow A:
    Client Creation -> Case Creation -> Document Ingestion -> AI Text Extraction ->
    Case Lifecycle Status Transition -> Package Assembly Readiness Check.
    """
    headers = two_tenants["tenant_a"]["headers"]

    # 1. Onboard / create client
    client_payload = {
        "first_name": "Maya",
        "last_name": "Lin",
        "email": f"maya.lin.{uuid.uuid4().hex[:6]}@example.com",
        "phone": "+1-416-555-0143",
        "nationality": "CAN",
    }
    client_resp = client.post("/api/v1/clients", headers=headers, json=client_payload)
    assert client_resp.status_code == 201
    client_data = client_resp.json()
    client_id = client_data["id"]

    # 2. Create immigration case
    case_number = f"CASE-ICT-{uuid.uuid4().hex[:6].upper()}"
    case_payload = {
        "client_id": client_id,
        "case_number": case_number,
        "title": "Maya Lin Intra-Company Transfer Petition",
        "jurisdiction": "CA",
        "visa_category": "Intra-Company Transfer",
        "status": "intake",
    }
    case_resp = client.post("/api/v1/cases", headers=headers, json=case_payload)
    assert case_resp.status_code == 201
    case_data = case_resp.json()
    case_id = case_data["id"]

    # 3. Document ingestion via upload
    pdf_content = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
    upload_resp = client.post(
        "/api/v1/documents/upload",
        headers=headers,
        data={
            "case_id": case_id,
            "client_id": client_id,
            "category": "employment_records",
            "title": "Employment Verification Letter",
        },
        files={"file": ("employment_verification.pdf", io.BytesIO(pdf_content), "application/pdf")},
    )
    assert upload_resp.status_code == 201
    doc_data = upload_resp.json()
    doc_id = doc_data["id"]
    assert doc_data["case_id"] == case_id

    # 4. Black box text extraction
    employment_text = (
        "EMPLOYMENT VERIFICATION LETTER\n"
        "Company: Acme Global Technologies Canada Inc.\n"
        "Employee: Maya Lin\n"
        "Job Title: Senior Software Architect\n"
        "NOC Code: 21231\n"
        "Annual Salary: CAD $145,000\n"
        "Start Date: 2021-04-01\n"
    )
    analyze_resp = client.post(
        "/api/v1/extractor/analyze-text",
        json={"text": employment_text, "filename": "employment_verification.txt"},
    )
    assert analyze_resp.status_code == 200
    assert analyze_resp.json()["status"] == "success"

    # 5. Advance case status to awaiting_documents
    status_resp = client.put(
        f"/api/v1/cases/{case_id}/status",
        headers=headers,
        json={
            "status": "awaiting_documents",
            "reason": "Initial corporate sponsorship verified",
            "notes": "Awaiting remaining civil identity records",
        },
    )
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] == "awaiting_documents"

    # 6. Check package readiness
    readiness_resp = client.get(f"/api/v1/packages/cases/{case_id}/readiness", headers=headers)
    assert readiness_resp.status_code == 200


def test_pairwise_client_portal_fulfillment_flow(client, two_tenants, auth_factory):
    """
    Tier 3 Pairwise Workflow B:
    Caseworker creates Document Request -> Issues Portal Invite ->
    Client responds to Request -> Caseworker reviews and approves.
    """
    headers = two_tenants["tenant_a"]["headers"]
    case_id = str(two_tenants["case_a"].id)
    client_id = str(two_tenants["client_a"].id)

    # 1. Caseworker creates a document request
    req_resp = client.post(
        "/api/v1/requests",
        headers=headers,
        json={
            "case_id": case_id,
            "requested_from_client_id": client_id,
            "title": "Certified Police Clearance Certificate",
            "description": "Please submit national police check covering the last 10 years",
            "rationale": "Mandatory statutory admissibility requirement",
            "category": "police_certificate",
        },
    )
    assert req_resp.status_code == 201
    request_data = req_resp.json()
    request_id = request_data["id"]

    # 2. Caseworker sends portal invitation
    invite_resp = client.post(
        "/api/v1/portal/invite",
        headers=headers,
        json={
            "case_id": case_id,
            "email": "retained-client-flow@example.com",
            "full_name": "Flow Applicant",
            "relationship_type": "primary_applicant",
            "is_authorized_to_view_case": True,
        },
    )
    assert invite_resp.status_code == 201
    invite_data = invite_resp.json()
    invitation_token = invite_data["invitation_token"]

    # 3. Client activates portal account
    activate_resp = client.post(
        "/api/v1/portal/activate",
        json={
            "invitation_token": invitation_token,
            "password": "SecureClientPassword2026!",
            "agreed_to_privacy": True,
        },
    )
    assert activate_resp.status_code == 200

    # 4. Upload fulfilling document
    pdf_content = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
    upload_resp = client.post(
        "/api/v1/documents/upload",
        headers=headers,
        data={
            "case_id": case_id,
            "client_id": client_id,
            "category": "police_certificate",
            "title": "RCMP National Police Clearance",
        },
        files={"file": ("police_check.pdf", io.BytesIO(pdf_content), "application/pdf")},
    )
    assert upload_resp.status_code == 201
    fulfilling_doc_id = upload_resp.json()["id"]

    # 5. Client responds to document request
    respond_resp = client.post(
        f"/api/v1/requests/{request_id}/respond",
        headers=headers,
        json={
            "document_id": fulfilling_doc_id,
            "response_notes": "Official RCMP fingerprint clearance certificate attached",
        },
    )
    assert respond_resp.status_code == 200

    # 6. Caseworker reviews and approves request
    review_resp = client.patch(
        f"/api/v1/requests/{request_id}/review",
        headers=headers,
        json={
            "decision": "approved",
            "review_notes": "Document verified with clean record and valid seal",
        },
    )
    assert review_resp.status_code == 200
    assert review_resp.json()["status"].lower() == "approved"


def test_pairwise_visa_appointments_and_sponsors(client, two_tenants):
    """
    Tier 3 Pairwise Workflow C:
    Add Financial Sponsor -> Schedule Visa Appointment -> Update Appointment -> Calendar Invite.
    """
    headers = two_tenants["tenant_a"]["headers"]
    case_id = str(two_tenants["case_a"].id)

    # 1. Add financial sponsor to case
    sponsor_resp = client.post(
        f"/api/v1/cases/{case_id}/sponsors",
        headers=headers,
        json={
            "name": "Acme Global Tech Holdings",
            "sponsor_type": "employer",
            "relationship": "Direct Employer",
            "liquid_funds": 150000.0,
            "currency": "CAD",
        },
    )
    assert sponsor_resp.status_code == 201
    sponsor_data = sponsor_resp.json()
    assert sponsor_data["name"] == "Acme Global Tech Holdings"

    # 2. Schedule visa appointment
    appointment_payload = {
        "vac_center": "USCIS ASC Buffalo",
        "consular_post": "US Consulate General Toronto",
        "ofc_biometrics_slot": "2026-12-01T10:00:00Z",
        "consular_interview_slot": "2026-12-05T14:30:00Z",
        "appointment_status": "scheduled",
        "notes": "Bring I-797C appointment notice and unexpired passport",
    }
    apt_resp = client.post(
        f"/api/v1/cases/{case_id}/appointments",
        headers=headers,
        json=appointment_payload,
    )
    assert apt_resp.status_code == 201
    apt_data = apt_resp.json()
    apt_id = apt_data["id"]

    # 3. Update appointment status
    patch_resp = client.patch(
        f"/api/v1/cases/{case_id}/appointments/{apt_id}",
        headers=headers,
        json={"appointment_status": "completed"},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["appointment_status"] == "completed"
