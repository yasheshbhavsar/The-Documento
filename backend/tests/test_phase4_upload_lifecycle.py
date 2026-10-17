"""Phase 4 Test Suite — Upload intake, temporary lifecycle, boundary splitting, and retention rules."""

import io
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from backend.app.documents.inactivity_service import DocumentInactivityService
from backend.app.documents.retention import apply_legal_hold
from backend.app.domain.case_lifecycle import CaseLifecycleService
from backend.app.domain.models import (
    AuditEvent,
    CaseAIFinding,
    CaseInterimReport,
    ClientDependant,
    ClientProfile,
    Document,
    DocumentRequest,
    FilingPackage,
    ImmigrationCase,
    Notification,
    Organization,
    OrganizationMembership,
    PackageDownloadEvent,
    User,
    now_utc,
)
from backend.app.main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def phase4_test_data(db):
    """Sets up an organization, staff officer, client user, case, and dependants."""
    org_id = uuid.uuid4()
    org = Organization(
        id=org_id,
        name="Phase 4 Legal Advocates LLC",
        slug=f"p4-legal-{org_id.hex[:6]}",
        status="active",
    )
    db.add(org)

    # Lead attorney / officer
    officer_id = uuid.uuid4()
    officer = User(
        id=officer_id,
        email="officer.p4@documento.io",
        full_name="Sarah Jenkins Esq",
        password_hash="hash",
        status="active",
    )
    officer.organization_id = org_id
    officer.role = "senior_reviewer"
    db.add(officer)
    db.flush()

    officer_mem = OrganizationMembership(
        id=uuid.uuid4(),
        organization_id=org_id,
        user_id=officer_id,
        status="active",
    )
    db.add(officer_mem)

    # Client user
    client_user_id = uuid.uuid4()
    client_user = User(
        id=client_user_id,
        email="client.p4@family.com",
        full_name="Raj Patel",
        password_hash="hash",
        status="active",
    )
    client_user.organization_id = org_id
    client_user.role = "client"
    db.add(client_user)
    db.flush()

    client_mem = OrganizationMembership(
        id=uuid.uuid4(),
        organization_id=org_id,
        user_id=client_user_id,
        status="active",
    )
    db.add(client_mem)

    # Client profile
    client_prof_id = uuid.uuid4()
    client_prof = ClientProfile(
        id=client_prof_id,
        organization_id=org_id,
        user_id=client_user_id,
        first_name="Raj",
        last_name="Patel",
        email="client.p4@family.com",
        nationality="IND",
    )
    db.add(client_prof)

    # Dependant (Spouse)
    dep_id = uuid.uuid4()
    dep = ClientDependant(
        id=dep_id,
        organization_id=org_id,
        primary_client_id=client_prof_id,
        first_name="Priya",
        last_name="Patel",
        relationship_type="spouse",
        nationality="IND",
    )
    db.add(dep)

    # Immigration case
    case_id = uuid.uuid4()
    case = ImmigrationCase(
        id=case_id,
        organization_id=org_id,
        client_id=client_prof_id,
        case_number="P4-EB1A-2026",
        title="Raj Patel EB-1A Extraordinary Ability",
        jurisdiction="US",
        visa_category="EB-1A",
        status="in_progress",
        operational_state="ACTIVE",
        post_download_retention_policy="seven_days",
        inactivity_warning_level=0,
        last_client_activity_at=now_utc(),
    )
    db.add(case)
    db.commit()

    return {
        "org_id": org_id,
        "officer": officer,
        "client_user": client_user,
        "client_prof": client_prof,
        "dep": dep,
        "case": case,
    }


def _auth_headers(user: User) -> dict:
    return {
        "X-User-Id": str(user.id),
        "X-Organization-Id": str(user.organization_id),
        "X-User-Role": user.role,
    }


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_upload_guidance_endpoint():
    """Verifies camera scanning checklist rules, file limits, and legal non-acceptance disclaimer."""
    resp = client.get("/api/v1/documents/upload-guidance")
    assert resp.status_code == 200
    data = resp.json()

    assert "focus_guidance" in data
    assert "lighting_guidance" in data
    assert "glare_guidance" in data
    assert "orientation_guidance" in data
    assert "corners_guidance" in data
    assert "legibility_guidance" in data
    assert "application/pdf" in data["supported_mime_types"]
    assert data["max_file_size_bytes"] == 52428800

    # Statutory disclaimer requirement
    disclaimer = data["non_acceptance_disclaimer"]
    assert "Upload receipt is not acceptance or readiness" in disclaimer
    assert "evaluated separately" in disclaimer


def test_batch_upload_with_safe_duplicate_handling(phase4_test_data, db):
    """Verifies batch upload, non-acceptance disclaimer receipt, and non-crashing duplicate handling."""
    data = phase4_test_data
    officer = data["officer"]
    case = data["case"]

    pdf_content1 = b"%PDF-1.4 test document 1"
    pdf_content2 = b"%PDF-1.4 test document 2"

    files = [
        ("files", ("passport_scan.pdf", pdf_content1, "application/pdf")),
        ("files", ("degree_certificate.pdf", pdf_content2, "application/pdf")),
    ]

    resp = client.post(
        "/api/v1/documents/upload-batch",
        data={"case_id": str(case.id)},
        files=files,
        headers=_auth_headers(officer),
    )
    assert resp.status_code == 201
    receipt = resp.json()

    assert receipt["total_files"] == 2
    assert receipt["uploaded_count"] == 2
    assert receipt["duplicate_count"] == 0
    assert "Upload receipt is not acceptance or readiness" in receipt["non_acceptance_disclaimer"]

    # Re-upload second batch containing 1 duplicate and 1 brand-new file
    pdf_content3 = b"%PDF-1.4 test document 3"
    files2 = [
        ("files", ("duplicate_passport.pdf", pdf_content1, "application/pdf")),  # Same hash as doc 1
        ("files", ("employment_letter.pdf", pdf_content3, "application/pdf")),
    ]

    resp2 = client.post(
        "/api/v1/documents/upload-batch",
        data={"case_id": str(case.id)},
        files=files2,
        headers=_auth_headers(officer),
    )
    assert resp2.status_code == 201
    receipt2 = resp2.json()

    # Crucial requirement: Duplicate handled safely without 409 or 500 error!
    assert receipt2["total_files"] == 2
    assert receipt2["uploaded_count"] == 1
    assert receipt2["duplicate_count"] == 1

    dup_item = next(i for i in receipt2["items"] if i["is_duplicate"])
    assert dup_item["status"] == "duplicate_existing"
    assert dup_item["existing_document_id"] is not None


def test_unassigned_applicant_proposal_and_officer_confirmation(phase4_test_data, db):
    """
    Verifies that when applicant selection is omitted:
    - System proposes classification / applicant association
    - Leaves assignment unassigned until an officer confirms
    """
    data = phase4_test_data
    client_user = data["client_user"]
    officer = data["officer"]
    case = data["case"]
    dep = data["dep"]

    # Client uploads a document named with dependant's name without selecting applicant
    pdf_content = b"%PDF-1.4 test Priya Patel Marriage Certificate"
    files = [
        ("files", ("priya_patel_marriage_cert.pdf", pdf_content, "application/pdf")),
    ]

    resp = client.post(
        "/api/v1/documents/upload-batch",
        data={"case_id": str(case.id)},
        files=files,
        headers=_auth_headers(client_user),
    )
    assert resp.status_code == 201
    receipt = resp.json()
    item = receipt["items"][0]

    assert item["is_assignment_confirmed"] is False
    assert "Priya Patel" in item["proposed_applicant_name"]
    doc_id = item["document_id"]

    # Client tries to confirm assignment (should be rejected; officer only)
    resp_client_confirm = client.post(
        f"/api/v1/documents/{doc_id}/confirm-assignment",
        json={"applicant_dependant_id": str(dep.id), "confirmed_category": "vital_records"},
        headers=_auth_headers(client_user),
    )
    assert resp_client_confirm.status_code == 403

    # Officer confirms assignment
    resp_officer_confirm = client.post(
        f"/api/v1/documents/{doc_id}/confirm-assignment",
        json={"applicant_dependant_id": str(dep.id), "confirmed_category": "vital_records"},
        headers=_auth_headers(officer),
    )
    assert resp_officer_confirm.status_code == 200
    confirmed_data = resp_officer_confirm.json()
    assert confirmed_data["is_assignment_confirmed"] is True
    assert confirmed_data["category"] == "vital_records"


def test_combined_multi_document_boundary_splitting(phase4_test_data, db):
    """Verifies multi-document combined file section splitting into individual child documents."""
    data = phase4_test_data
    officer = data["officer"]
    case = data["case"]

    # Create parent combined document
    doc_id = uuid.uuid4()
    parent_doc = Document(
        id=doc_id,
        organization_id=data["org_id"],
        case_id=case.id,
        client_id=case.client_id,
        uploaded_by_user_id=officer.id,
        title="Combined_Application_Scan.pdf",
        filename="Combined_Application_Scan.pdf",
        category="supporting_evidence",
        storage_path="tenants/p4/combined.pdf",
        sha256_hash="sha256_combined_test_hash",
        byte_size=10240,
        mime_type="application/pdf",
        version=1,
        page_count=6,
        layout_metadata={
            "pages": [
                {"page_number": 1, "text": "Republic of India Passport Nationality P<IND"},
                {"page_number": 2, "text": "Passport Endorsements and Visa Stamps"},
                {"page_number": 3, "text": "University of Mumbai Degree of Bachelor of Engineering"},
                {"page_number": 4, "text": "Transcript of Academic Records GPA 3.9"},
                {"page_number": 5, "text": "Employment Verification Letter To Whom It May Concern Employed as Lead Engineer"},
                {"page_number": 6, "text": "Salary and Duties and Responsibilities"},
            ]
        },
    )
    db.add(parent_doc)
    db.commit()

    # Split combined document
    split_payload = {
        "sections": [
            {"title": "Indian Passport", "category": "identity", "start_page": 1, "end_page": 2},
            {"title": "Bachelor Degree & Transcript", "category": "education", "start_page": 3, "end_page": 4},
            {"title": "Engineering Employment Letter", "category": "experience", "start_page": 5, "end_page": 6},
        ]
    }

    resp = client.post(
        f"/api/v1/documents/{doc_id}/split-sections",
        json=split_payload,
        headers=_auth_headers(officer),
    )
    assert resp.status_code == 200
    res_data = resp.json()

    assert res_data["parent_document_id"] == str(doc_id)
    assert res_data["sections_count"] == 3
    assert len(res_data["created_documents"]) == 3

    categories = [c["category"] for c in res_data["created_documents"]]
    assert "identity" in categories
    assert "education" in categories
    assert "experience" in categories


def test_family_documents_summary(phase4_test_data, db):
    """Verifies per-applicant outstanding/received/correction-required lists and family summary."""
    data = phase4_test_data
    officer = data["officer"]
    case = data["case"]
    dep = data["dep"]

    # Document for Primary
    doc_primary = Document(
        id=uuid.uuid4(),
        organization_id=data["org_id"],
        case_id=case.id,
        client_id=case.client_id,
        applicant_dependant_id=None,
        title="Raj Passport",
        filename="raj_pass.pdf",
        category="identity",
        storage_path="tenants/p4/raj.pdf",
        sha256_hash="hash_primary",
        byte_size=1000,
        mime_type="application/pdf",
        is_assignment_confirmed=True,
        verification_status="verified",
    )
    # Document for Dependant
    doc_dep = Document(
        id=uuid.uuid4(),
        organization_id=data["org_id"],
        case_id=case.id,
        client_id=case.client_id,
        applicant_dependant_id=dep.id,
        title="Priya Passport",
        filename="priya_pass.pdf",
        category="identity",
        storage_path="tenants/p4/priya.pdf",
        sha256_hash="hash_dep",
        byte_size=1000,
        mime_type="application/pdf",
        is_assignment_confirmed=True,
        verification_status="rejected",  # Will show under correction_required
    )
    # Unassigned Document
    doc_unassigned = Document(
        id=uuid.uuid4(),
        organization_id=data["org_id"],
        case_id=case.id,
        client_id=case.client_id,
        title="Unassigned W2",
        filename="w2.pdf",
        category="financial",
        storage_path="tenants/p4/w2.pdf",
        sha256_hash="hash_unassigned",
        byte_size=1000,
        mime_type="application/pdf",
        is_assignment_confirmed=False,
    )
    # Outstanding Request for Dependant
    req_dep = DocumentRequest(
        id=uuid.uuid4(),
        organization_id=data["org_id"],
        case_id=case.id,
        requested_from_client_id=case.client_id,
        dependant_id=dep.id,
        title="Priya Medical Examination Report",
        description="Medical examination report signed by civil surgeon",
        rationale="Required for adjustment of status",
        category="vital_records",
        status="requested",
    )
    db.add_all([doc_primary, doc_dep, doc_unassigned, req_dep])
    db.commit()

    resp = client.get(
        f"/api/v1/documents/cases/{case.id}/family-documents-summary",
        headers=_auth_headers(officer),
    )
    assert resp.status_code == 200
    summary = resp.json()

    assert summary["case_number"] == "P4-EB1A-2026"
    assert summary["total_unassigned"] == 1
    assert "Family checklist completion indicates intake progress only" in summary["non_readiness_disclaimer"]

    # Check primary applicant
    primary_app = next(a for a in summary["applicants"] if a["relationship"] == "primary_applicant")
    assert len(primary_app["received"]) == 1

    # Check dependant applicant
    dep_app = next(a for a in summary["applicants"] if a["relationship"] == "spouse")
    assert len(dep_app["correction_required"]) == 1
    assert len(dep_app["outstanding"]) == 1


def test_verified_download_flow_and_post_download_retention(phase4_test_data, db):
    """
    Verifies that starting a download is not proof the file was saved,
    requires client verification, and schedules post-download retention (immediate or 7 days).
    """
    data = phase4_test_data
    officer = data["officer"]
    case = data["case"]

    # Setup FilingPackage
    pkg_id = uuid.uuid4()
    pkg = FilingPackage(
        id=pkg_id,
        organization_id=data["org_id"],
        case_id=case.id,
        name="Official Filing Package v1",
        version_number="v1.0.0",
        status="approved",
        package_hash="pkg_hash_abc123",
        manifest_json={"documents": ["doc1", "doc2"]},
    )
    db.add(pkg)
    db.commit()

    # Step 1: Initial download event recorded
    CaseLifecycleService.record_download_event(db, pkg, officer)

    # Step 2: Client/browser executes verified download confirmation
    verify_payload = {
        "client_received_bytes": 1048576,
        "browser_storage_acknowledged": True,
        "client_sha256_hash": "pkg_hash_abc123",
    }
    resp = client.post(
        f"/api/v1/packages/{pkg_id}/verify-download",
        json=verify_payload,
        headers=_auth_headers(officer),
    )
    assert resp.status_code == 200
    res_data = resp.json()

    assert res_data["is_verified"] is True
    assert res_data["post_download_retention_policy"] == "seven_days"
    assert res_data["post_download_purge_scheduled_at"] is not None

    # Critical requirement: Honest disclosure of verification limits and local copy rights
    assert "Verification confirms client-side receipt in the active browser session" in res_data["verification_limits_notice"]
    assert "Documento cannot and does not claim to delete any local copies once downloaded" in res_data["local_copy_notice"]


def test_two_step_deletion_confirmation(phase4_test_data, db):
    """
    Verifies two-step deletion confirmation with cryptographic challenge token,
    local copy acknowledgment requirement, and legal hold / anomaly blocking.
    """
    data = phase4_test_data
    officer = data["officer"]
    case = data["case"]

    doc_id = uuid.uuid4()
    doc = Document(
        id=doc_id,
        organization_id=data["org_id"],
        case_id=case.id,
        client_id=case.client_id,
        uploaded_by_user_id=officer.id,
        title="Draft_Evidence_To_Purge.pdf",
        filename="Draft_Evidence_To_Purge.pdf",
        category="supporting_evidence",
        storage_path="tenants/p4/draft.pdf",
        sha256_hash="hash_draft_123",
        byte_size=5000,
        mime_type="application/pdf",
        version=1,
    )
    db.add(doc)
    db.commit()

    # Step 1: Request purge
    resp_step1 = client.post(
        f"/api/v1/documents/{doc_id}/purge-request",
        headers=_auth_headers(officer),
    )
    assert resp_step1.status_code == 200
    step1_data = resp_step1.json()

    assert "confirmation_token" in step1_data
    assert "Documento cannot and does not claim to delete any local copies" in step1_data["local_copy_notice"]
    token = step1_data["confirmation_token"]

    # Step 2: Confirm purge WITHOUT acknowledging local copy notice (MUST FAIL)
    resp_step2_unack = client.post(
        f"/api/v1/documents/{doc_id}/purge-confirm",
        json={"confirmation_token": token, "acknowledged_local_copy_notice": False},
        headers=_auth_headers(officer),
    )
    assert resp_step2_unack.status_code in (400, 422)

    # Step 2: Confirm purge WITH acknowledgment (SUCCEEDS)
    resp_step2_ack = client.post(
        f"/api/v1/documents/{doc_id}/purge-confirm",
        json={"confirmation_token": token, "acknowledged_local_copy_notice": True},
        headers=_auth_headers(officer),
    )
    assert resp_step2_ack.status_code == 200
    assert resp_step2_ack.json()["purged"] is True


def test_legal_hold_and_anomaly_block_purge(phase4_test_data, db):
    """Verifies that documents on legal hold or with unresolved anomalies strictly cannot be purged."""
    data = phase4_test_data
    officer = data["officer"]
    case = data["case"]

    # 1. Document on legal hold
    doc_hold = Document(
        id=uuid.uuid4(),
        organization_id=data["org_id"],
        case_id=case.id,
        title="Legal Hold Doc",
        filename="hold.pdf",
        category="supporting_evidence",
        storage_path="tenants/p4/hold.pdf",
        sha256_hash="hash_hold",
        byte_size=1000,
        mime_type="application/pdf",
        layout_metadata={"legal_hold": True, "legal_hold_reason": "Pending Federal Court Subpoena"},
    )
    db.add(doc_hold)

    # 2. Document with unresolved anomaly
    doc_anomaly = Document(
        id=uuid.uuid4(),
        organization_id=data["org_id"],
        case_id=case.id,
        title="Anomaly Doc",
        filename="anomaly.pdf",
        category="supporting_evidence",
        storage_path="tenants/p4/anomaly.pdf",
        sha256_hash="hash_anomaly",
        byte_size=1000,
        mime_type="application/pdf",
        has_unresolved_anomaly=True,
        anomaly_notes="Detected date-of-birth discrepancy against passport",
    )
    db.add(doc_anomaly)
    db.commit()

    # Step 1 on hold doc must return 409 Conflict
    resp_hold = client.post(
        f"/api/v1/documents/{doc_hold.id}/purge-request",
        headers=_auth_headers(officer),
    )
    assert resp_hold.status_code == 409
    assert "active legal hold" in resp_hold.json()["detail"]

    # Step 1 on anomaly doc must return 409 Conflict
    resp_anomaly = client.post(
        f"/api/v1/documents/{doc_anomaly.id}/purge-request",
        headers=_auth_headers(officer),
    )
    assert resp_anomaly.status_code == 409
    assert "unresolved compliance anomalies" in resp_anomaly.json()["detail"]


def test_officer_resolve_anomaly_and_purge_erroneous(phase4_test_data, db):
    """
    Verifies that when appropriate, officer can resolve an anomaly
    or confirm an erroneous file and delete it.
    """
    data = phase4_test_data
    officer = data["officer"]
    case = data["case"]

    doc_erroneous = Document(
        id=uuid.uuid4(),
        organization_id=data["org_id"],
        case_id=case.id,
        title="Wrong Client Tax Return",
        filename="wrong_tax.pdf",
        category="financial",
        storage_path="tenants/p4/wrong_tax.pdf",
        sha256_hash="hash_wrong_tax",
        byte_size=2000,
        mime_type="application/pdf",
        has_unresolved_anomaly=True,
        anomaly_notes="Client accidentally uploaded third-party tax return",
    )
    db.add(doc_erroneous)
    db.commit()

    # Officer uses confirm_erroneous_and_purge
    resp = client.post(
        f"/api/v1/documents/{doc_erroneous.id}/resolve-anomaly",
        json={
            "resolution_action": "confirm_erroneous_and_purge",
            "notes": "Verified third-party document uploaded in error; securely destroying.",
        },
        headers=_auth_headers(officer),
    )
    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["status"] == "purged_erroneous"
    assert "Documento cannot and does not claim to delete any local copies" in res_data["local_copy_notice"]


def test_inactivity_service_lifecycle_warnings_and_day_15_cleanup(phase4_test_data, db):
    """
    Verifies:
    - Warnings on days 7, 10, 14
    - Agreed day-15 cleanup to eligible files even if checklist is complete/incomplete
    - Internal-only staff activity strictly NEVER resets inactivity
    - Client activity DOES reset inactivity
    """
    data = phase4_test_data
    case = data["case"]
    officer = data["officer"]
    org_id = data["org_id"]

    # Add a normal document eligible for cleanup
    doc_eligible = Document(
        id=uuid.uuid4(),
        organization_id=org_id,
        case_id=case.id,
        title="Temporary Rough Draft",
        filename="rough_draft.pdf",
        category="supporting_evidence",
        storage_path="tenants/p4/draft.pdf",
        sha256_hash="hash_eligible",
        byte_size=500,
        mime_type="application/pdf",
    )
    # Add a document on legal hold (MUST BE EXCLUDED)
    doc_hold = Document(
        id=uuid.uuid4(),
        organization_id=org_id,
        case_id=case.id,
        title="Litigation Evidence",
        filename="litigation.pdf",
        category="supporting_evidence",
        storage_path="tenants/p4/litigation.pdf",
        sha256_hash="hash_hold_excl",
        byte_size=500,
        mime_type="application/pdf",
        layout_metadata={"legal_hold": True},
    )
    db.add_all([doc_eligible, doc_hold])
    db.commit()

    start_time = datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone.utc)
    case.last_client_activity_at = start_time
    case.inactivity_warning_level = 0
    db.commit()

    # 1. Day 7 check
    res_d7 = DocumentInactivityService.evaluate_case_inactivity(
        db, case, now=start_time + timedelta(days=7, hours=1), system_actor_id=officer.id
    )
    assert res_d7["action_taken"] == "day_7_warning"
    assert case.inactivity_warning_level == 1

    # Verify notification created
    notif7 = db.query(Notification).filter(Notification.title.contains("Day 7")).first()
    assert notif7 is not None

    # 2. Staff writes internal note (DOES NOT RESET INACTIVITY!)
    db.add(AuditEvent(
        organization_id=org_id,
        actor_id=officer.id,
        action="case.internal_note_added",
        object_type="immigration_case",
        object_id=str(case.id),
        metadata_json={"internal": True},
    ))
    db.commit()
    # Ensure last_client_activity_at is unchanged!
    assert case.last_client_activity_at.replace(tzinfo=timezone.utc) == start_time
    assert case.inactivity_warning_level == 1

    # 3. Day 10 check
    res_d10 = DocumentInactivityService.evaluate_case_inactivity(
        db, case, now=start_time + timedelta(days=10, hours=1), system_actor_id=officer.id
    )
    assert res_d10["action_taken"] == "day_10_warning"
    assert case.inactivity_warning_level == 2

    # 4. Day 14 check
    res_d14 = DocumentInactivityService.evaluate_case_inactivity(
        db, case, now=start_time + timedelta(days=14, hours=1), system_actor_id=officer.id
    )
    assert res_d14["action_taken"] == "day_14_urgent_warning"
    assert case.inactivity_warning_level == 3

    # 5. Day 15 Cleanup
    res_d15 = DocumentInactivityService.evaluate_case_inactivity(
        db, case, now=start_time + timedelta(days=15, hours=1), system_actor_id=officer.id
    )
    assert res_d15["action_taken"] == "day_15_cleanup_applied"
    assert case.inactivity_warning_level == 4
    assert res_d15["purged_documents_count"] >= 1
    assert res_d15["excluded_holds_count"] >= 1

    # Verify legal hold doc is still intact!
    hold_doc_check = db.query(Document).filter(Document.id == doc_hold.id).first()
    assert hold_doc_check is not None

    # 6. Meaningful client activity resets inactivity back to 0
    DocumentInactivityService.record_client_activity(db, case, "client_upload", data["client_user"].id)
    assert case.inactivity_warning_level == 0
    last_act = case.last_client_activity_at
    if last_act.tzinfo is None:
        last_act = last_act.replace(tzinfo=timezone.utc)
    assert last_act > start_time


def test_hold_and_reassignment_prompts_interim_report(phase4_test_data, db):
    """
    Verifies that applying a hold or reassigning owner automatically generates
    an interim report snapshot with manifest, OCR summary, and anomaly report
    while deadlines remain active.
    """
    data = phase4_test_data
    case = data["case"]
    officer = data["officer"]
    org_id = data["org_id"]

    # 1. Place case on hold
    CaseLifecycleService.apply_hold(
        db=db,
        case=case,
        hold_type="client_request",
        reason="Client traveling internationally for medical treatment",
        actor_id=officer.id,
    )

    # Verify Interim Report generated
    reports = db.query(CaseInterimReport).filter(CaseInterimReport.case_id == case.id).all()
    assert len(reports) >= 1
    hold_report = next(r for r in reports if r.trigger_action == "hold_applied")
    assert "Hold Applied" in hold_report.report_title
    assert "manifest_snapshot_json" in hold_report.__dict__
    assert "ocr_summary_json" in hold_report.__dict__
    assert "anomaly_report_json" in hold_report.__dict__

    # 2. Create another active attorney
    new_officer = User(
        id=uuid.uuid4(),
        email="new.attorney@documento.io",
        full_name="Marcus Vance Esq",
        password_hash="hash",
        status="active",
    )
    new_officer.organization_id = org_id
    new_officer.role = "case_worker"
    db.add(new_officer)
    db.flush()
    new_officer_mem = OrganizationMembership(
        id=uuid.uuid4(),
        organization_id=org_id,
        user_id=new_officer.id,
        status="active",
    )
    db.add(new_officer_mem)
    db.commit()

    # Reassign owner
    CaseLifecycleService.reassign_owner(
        db=db,
        case=case,
        new_user_id=new_officer.id,
        role_in_case="lead_attorney",
        actor_id=officer.id,
    )

    reports_after = db.query(CaseInterimReport).filter(CaseInterimReport.case_id == case.id).all()
    assert len(reports_after) >= 2
    reassign_report = next(r for r in reports_after if r.trigger_action == "owner_reassigned")
    assert "Marcus Vance" in reassign_report.report_title

    # Test API endpoint
    resp = client.get(
        f"/api/v1/documents/cases/{case.id}/interim-reports",
        headers=_auth_headers(officer),
    )
    assert resp.status_code == 200
    assert len(resp.json()) >= 2


def test_resolve_anomaly_lifecycle_and_erroneous_purge(phase4_test_data, db):
    """
    Tests officer anomaly review workflow:
    1. Mark resolved clears anomaly flag and allows normal lifecycle.
    2. Confirm erroneous and purge destroys storage replica and updates DB with local copy notice.
    3. Confirm erroneous is blocked if document is protected under legal hold.
    4. Client is denied access to resolve anomalies.
    """
    data = phase4_test_data
    officer = data["officer"]
    client_user = data["client_user"]
    case = data["case"]
    org_id = data["org_id"]

    # Create document with active anomaly
    doc_id = uuid.uuid4()
    doc = Document(
        id=doc_id,
        organization_id=org_id,
        case_id=case.id,
        uploaded_by_user_id=client_user.id,
        title="Flawed_Passport_Scan.pdf",
        filename="Flawed_Passport_Scan.pdf",
        category="identity",
        storage_path=f"storage/{org_id}/{doc_id}/v1_Flawed_Passport_Scan.pdf",
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        byte_size=1024,
        mime_type="application/pdf",
        version=1,
        is_current_version=True,
        processing_status="completed",
        verification_status="unverified",
        has_unresolved_anomaly=True,
        anomaly_notes="Severe lighting glare obscuring passport machine readable zone (MRZ)",
    )
    db.add(doc)
    db.commit()

    # 1. Client attempt is forbidden
    client_resp = client.post(
        f"/api/v1/documents/{doc_id}/resolve-anomaly",
        headers=_auth_headers(client_user),
        json={"resolution_action": "mark_resolved", "notes": "Client attempting self-resolution"},
    )
    assert client_resp.status_code == 403

    # 2. Officer marks anomaly resolved
    resolve_resp = client.post(
        f"/api/v1/documents/{doc_id}/resolve-anomaly",
        headers=_auth_headers(officer),
        json={"resolution_action": "mark_resolved", "notes": "Reviewed higher-res scan; glare is outside critical text"},
    )
    assert resolve_resp.status_code == 200
    res_data = resolve_resp.json()
    assert res_data["has_unresolved_anomaly"] is False
    assert "RESOLVED" in res_data["anomaly_notes"]

    # 3. Create another document with active anomaly for erroneous purge test
    err_doc_id = uuid.uuid4()
    err_doc = Document(
        id=err_doc_id,
        organization_id=org_id,
        case_id=case.id,
        uploaded_by_user_id=client_user.id,
        title="Accidental_Grocery_Receipt.pdf",
        filename="Accidental_Grocery_Receipt.pdf",
        category="supporting_evidence",
        storage_path=f"storage/{org_id}/{err_doc_id}/v1_Accidental_Grocery_Receipt.pdf",
        sha256_hash="1111c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        byte_size=512,
        mime_type="application/pdf",
        version=1,
        is_current_version=True,
        processing_status="completed",
        verification_status="rejected",
        has_unresolved_anomaly=True,
        anomaly_notes="Completely irrelevant personal receipt uploaded in error",
    )
    db.add(err_doc)
    db.commit()

    # Apply legal hold to test blocker
    apply_legal_hold(
        db,
        err_doc_id,
        organization_id=org_id,
        actor_id=officer.id,
        reason="Pending regulatory audit",
    )
    db.refresh(err_doc)

    hold_purge_resp = client.post(
        f"/api/v1/documents/{err_doc_id}/resolve-anomaly",
        headers=_auth_headers(officer),
        json={"resolution_action": "confirm_erroneous_and_purge", "notes": "Purge accidental grocery receipt"},
    )
    assert hold_purge_resp.status_code == 409
    assert "legal hold" in hold_purge_resp.json()["detail"].lower()

    # Release legal hold
    from backend.app.documents.retention import release_legal_hold
    release_legal_hold(
        db,
        err_doc_id,
        organization_id=org_id,
        actor_id=officer.id,
        reason="Audit concluded",
    )

    # Now confirm erroneous and purge
    purge_resp = client.post(
        f"/api/v1/documents/{err_doc_id}/resolve-anomaly",
        headers=_auth_headers(officer),
        json={"resolution_action": "confirm_erroneous_and_purge", "notes": "Purge accidental receipt permanently"},
    )
    assert purge_resp.status_code == 200
    purge_data = purge_resp.json()
    assert purge_data["status"] == "purged_erroneous"
    assert "local copies" in purge_data["local_copy_notice"].lower()

    purged_check = db.query(Document).filter(Document.id == err_doc_id).first()
    assert purged_check is None

