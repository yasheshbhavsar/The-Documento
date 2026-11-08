import io
import uuid
import pytest
from datetime import datetime, timezone
from backend.app.domain.case_service import CaseStage
from backend.app.security.rbac import RoleCode


def test_end_to_end_multirole_immigration_workload(client, auth_factory):
    """
    Tier 4: Comprehensive Multi-Role Real-World Workload Scenario.
    Persona Journey:
    1. Firm Owner provisions firm, onboards client, creates case.
    2. Firm Owner assigns Caseworker to case.
    3. Caseworker reviews assigned case, issues evidence request.
    4. Client activates portal, logs in, reviews waiting state, uploads document.
    5. Extractor Lab processes document as black box without data mutation.
    6. Caseworker verifies document, advances case through 6-stage lifecycle.
    7. Attorney signs off on package, verifies audit ledger.
    """
    # -------------------------------------------------------------------------
    # Role 1: Firm Owner Setup
    # -------------------------------------------------------------------------
    owner = auth_factory(
        email="managing-partner@sterling-immigration.law",
        role_code=RoleCode.MASTER_ADMIN,
        org_name="Sterling & Sterling Immigration Counsel",
        org_slug="sterling-immigration",
        full_name="Eleanor Sterling, Esq.",
        password="FirmOwnerSecurePassword2026!",
    )
    owner_headers = owner["headers"]
    org_id = owner["org"].id

    # 1.1 Firm Owner creates retained client profile
    client_resp = client.post(
        "/api/v1/clients",
        headers=owner_headers,
        json={
            "first_name": "Dr. Devanshi",
            "last_name": "Mehta",
            "email": "devanshi.mehta@quantum-ai.ca",
            "phone": "+1-647-555-0182",
            "nationality": "IND",
        },
    )
    assert client_resp.status_code == 201
    client_data = client_resp.json()
    client_id = client_data["id"]

    # 1.2 Firm Owner creates immigration petition case
    case_number = f"CASE-O1A-{uuid.uuid4().hex[:6].upper()}"
    case_resp = client.post(
        "/api/v1/cases",
        headers=owner_headers,
        json={
            "client_id": client_id,
            "case_number": case_number,
            "title": "Dr. Devanshi Mehta O-1A Alien of Extraordinary Ability",
            "jurisdiction": "US",
            "visa_category": "O-1A",
            "status": "intake",
        },
    )
    assert case_resp.status_code == 201
    case_data = case_resp.json()
    case_id = case_data["id"]

    # 1.3 Firm Owner creates Caseworker staff account
    worker = auth_factory(
        email="sam.caseworker@sterling-immigration.law",
        role_code=RoleCode.CASE_WORKER,
        existing_org=owner["org"],
        full_name="Samir Patel, Senior Paralegal",
        password="CaseworkerPassword2026!",
    )
    worker_headers = worker["headers"]
    worker_id = worker["user"].id

    # 1.4 Firm Owner assigns Caseworker to the case
    assign_resp = client.post(
        f"/api/v1/cases/{case_id}/assignments",
        headers=owner_headers,
        json={"user_id": str(worker_id), "role_in_case": "case_manager"},
    )
    assert assign_resp.status_code == 201

    # 1.5 Firm Owner generates Client Portal Invite
    invite_resp = client.post(
        "/api/v1/portal/invite",
        headers=owner_headers,
        json={
            "case_id": case_id,
            "email": "devanshi.mehta@quantum-ai.ca",
            "full_name": "Dr. Devanshi Mehta",
            "relationship_type": "primary_applicant",
            "is_authorized_to_view_case": True,
        },
    )
    assert invite_resp.status_code == 201
    invitation_token = invite_resp.json()["invitation_token"]

    # -------------------------------------------------------------------------
    # Role 2: Caseworker Evidence Intake & Requirements
    # -------------------------------------------------------------------------
    # 2.1 Caseworker retrieves assigned case details
    worker_case_resp = client.get(f"/api/v1/cases/{case_id}", headers=worker_headers)
    assert worker_case_resp.status_code == 200
    assert worker_case_resp.json()["case_number"] == case_number

    # 2.2 Caseworker creates tasks
    task_resp = client.post(
        f"/api/v1/cases/{case_id}/tasks",
        headers=worker_headers,
        json={
            "title": "Collate 10 Citation Count Index Reports",
            "priority": "HIGH",
            "category": "EVIDENCE_GATHERING",
        },
    )
    assert task_resp.status_code == 201

    # 2.3 Caseworker creates Document Request for Applicant
    req_resp = client.post(
        "/api/v1/requests",
        headers=worker_headers,
        json={
            "case_id": case_id,
            "requested_from_client_id": client_id,
            "title": "Doctoral Degree & Peer-Reviewed Scholarly Articles",
            "description": "Evidence of original scientific contributions of major significance",
            "rationale": "8 CFR 204.5(h)(3)(v) Scholarly articles requirement",
            "category": "scholarly_articles",
        },
    )
    assert req_resp.status_code == 201
    request_id = req_resp.json()["id"]

    # -------------------------------------------------------------------------
    # Role 3: Retained Client Portal Journey
    # -------------------------------------------------------------------------
    # 3.1 Client activates portal account
    client_password = "DrDevanshiMehta2026!Secure"
    act_resp = client.post(
        "/api/v1/portal/activate",
        json={
            "invitation_token": invitation_token,
            "password": client_password,
            "agreed_to_privacy": True,
        },
    )
    assert act_resp.status_code == 200

    # 3.2 Client logs in via OAuth/Session
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "devanshi.mehta@quantum-ai.ca", "password": client_password},
    )
    assert login_resp.status_code == 200
    client_token = login_resp.json()["access_token"]
    client_headers = {
        "Authorization": f"Bearer {client_token}",
        "X-Organization-Id": str(org_id),
        "X-User-Role": "retained_client",
    }

    # 3.3 Client inspects waiting state and requirements
    waiting_resp = client.get("/api/v1/portal/waiting-state", headers=client_headers)
    assert waiting_resp.status_code == 200

    # 3.4 Client uploads scholarly evidence document
    pdf_content = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
    doc_upload_resp = client.post(
        "/api/v1/documents/upload",
        headers=client_headers,
        data={
            "case_id": case_id,
            "client_id": client_id,
            "category": "scholarly_articles",
            "title": "Nature Machine Intelligence Publication Proof",
        },
        files={"file": ("nature_article.pdf", io.BytesIO(pdf_content), "application/pdf")},
    )
    assert doc_upload_resp.status_code == 201
    doc_id = doc_upload_resp.json()["id"]

    # 3.5 Client responds to formal document request
    respond_resp = client.post(
        f"/api/v1/requests/{request_id}/respond",
        headers=client_headers,
        json={"document_id": doc_id, "response_notes": "First-author paper attached"},
    )
    assert respond_resp.status_code == 200

    # -------------------------------------------------------------------------
    # Role 4: Extractor Lab Black Box Processing
    # -------------------------------------------------------------------------
    article_text = (
        "NATURE MACHINE INTELLIGENCE\n"
        "Title: Zero-Shot Foundation Models for Molecular Dynamics\n"
        "Lead Author: Dr. Devanshi Mehta, Ph.D.\n"
        "Institutional Affiliation: University of Toronto / Vector Institute\n"
        "Citations: 428 citations indexed in Google Scholar\n"
        "Impact Factor: 25.89\n"
    )
    extractor_resp = client.post(
        "/api/v1/extractor/analyze-text",
        json={"text": article_text, "filename": "nature_article.txt", "declared_category": "SCHOLARLY_ARTICLES"},
    )
    assert extractor_resp.status_code == 200
    ext_data = extractor_resp.json()
    assert ext_data["status"] == "success"
    assert "extracted_fields" in ext_data

    # -------------------------------------------------------------------------
    # Role 5: Caseworker Review & Lifecycle Progression
    # -------------------------------------------------------------------------
    # 5.1 Caseworker approves document request
    review_resp = client.patch(
        f"/api/v1/requests/{request_id}/review",
        headers=worker_headers,
        json={"decision": "approved", "review_notes": "Meets 8 CFR 204.5(h)(3)(v) standard"},
    )
    assert review_resp.status_code == 200
    assert review_resp.json()["status"].lower() == "approved"

    # 5.2 Advance case lifecycle: intake -> awaiting_documents -> processing -> internal_review
    for stage, reason in [
        ("awaiting_documents", "Intake complete, awaiting initial docs"),
        ("processing", "Documents received, running AI evaluation"),
        ("internal_review", "Evidence compiled, senior review needed"),
    ]:
        step_resp = client.put(
            f"/api/v1/cases/{case_id}/status",
            headers=worker_headers,
            json={"status": stage, "reason": reason, "notes": f"Stage: {stage}"},
        )
        assert step_resp.status_code == 200
        assert step_resp.json()["status"] == stage

    # -------------------------------------------------------------------------
    # Role 6: Attorney Review & Final Audit Check
    # -------------------------------------------------------------------------
    # 6.1 Check package assembly readiness
    readiness_resp = client.get(f"/api/v1/packages/cases/{case_id}/readiness", headers=owner_headers)
    assert readiness_resp.status_code == 200

    # 6.2 Advance to ready_for_approval and approved_for_submission
    for final_stage in ["ready_for_approval", "approved_for_submission"]:
        stage_resp = client.put(
            f"/api/v1/cases/{case_id}/status",
            headers=owner_headers,
            json={"status": final_stage, "reason": "Attorney verified petition packet", "notes": final_stage},
        )
        assert stage_resp.status_code == 200
        assert stage_resp.json()["status"] == final_stage

    # 6.3 Verify timeline and audit history
    history_resp = client.get(f"/api/v1/cases/{case_id}/history", headers=owner_headers)
    assert history_resp.status_code == 200
    history_events = history_resp.json()
    assert len(history_events) >= 3
