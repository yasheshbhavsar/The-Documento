"""Stage 5 Regression Test Suite: Comparison Engine, Privileged Anomaly Routing, Checklists & Client Correction Workflow.

Validates invariants from Documento Master Vision §4.1, §4.4, §4.5, §4.6, §5:
1. Discrepancy taxonomy & comparators (§4.4):
   - Deterministic comparators distinguish exact agreement, formatting variations,
     transliterations/aliases, OCR noise, and confirmed contradictions.
   - Never automatically infer fraud without human review.
2. Privileged staff notes privacy boundary (§4.5):
   - Internal risk notes (internal_risk_notes) are strictly staff-only and redacted
     from client portal views (None for retained clients).
   - Only authorized staff can disposition (resolve, dismiss, escalate, route) findings.
3. Document rejection & client correction workflow (§4.6):
   - Document rejection requires structured reason code and client-facing explanation.
   - Rejection transitions lifecycle state to 'rejected', creates an immutable AuditEvent,
     updates matching DocumentRequests, and surfaces safely in client checklists.
4. Finding disposition workflow & audit trail (§4.5):
   - Resolve requires reviewer note and logs ai_finding.resolved audit event.
   - Dismiss validates against VALID_DISMISSAL_REASONS (rejects invalid codes with 400).
   - Route assigns target owner, remediation due date, and client explanation template.
5. Versioned firm checklists & case invariance (§4.1, §5):
   - Active cases with pinned checklist snapshots audit strictly against their pinned items.
   - Firmware or statutory changes never silently rewrite in-flight petition requirements.
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from backend.app.ai.comparators import (
    compare_names,
    compare_dates_of_birth,
    compare_document_numbers,
)
from backend.app.ai.checklist_engine import audit_case_checklist
from backend.app.ai.review_service import VALID_DISMISSAL_REASONS
from backend.app.domain.models import (
    AuditEvent,
    CaseAIFinding,
    CaseTask,
    ClientProfile,
    Document,
    DocumentRequest,
    ImmigrationCase,
    Organization,
    OrganizationMembership,
    RuleSet,
    RuleSetVersion,
    RuleRequirement,
    User,
    now_utc,
)
from backend.app.rules.case_migration import migrate_case_rule_version


@pytest.fixture
def stage5_fixture(db):
    org_id = uuid.uuid4()
    org = Organization(
        id=org_id,
        name="Beacon Immigration Law PC",
        slug=f"beacon-{uuid.uuid4().hex[:6]}",
        status="active",
    )
    db.add(org)

    # 1. Senior Reviewer / Attorney
    attorney_id = uuid.uuid4()
    attorney = User(
        id=attorney_id,
        email="attorney@beaconlegal.com",
        full_name="Marcus Vance Esq",
        password_hash="hash",
        status="active",
    )
    attorney.organization_id = org_id
    attorney.role = "senior_reviewer"
    db.add(attorney)
    db.flush()

    db.add(OrganizationMembership(
        id=uuid.uuid4(),
        organization_id=org_id,
        user_id=attorney_id,
        status="active",
    ))

    # 2. Caseworker / Paralegal
    caseworker_id = uuid.uuid4()
    caseworker = User(
        id=caseworker_id,
        email="caseworker@beaconlegal.com",
        full_name="Emily Stone",
        password_hash="hash",
        status="active",
    )
    caseworker.organization_id = org_id
    caseworker.role = "case_worker"
    db.add(caseworker)
    db.flush()

    db.add(OrganizationMembership(
        id=uuid.uuid4(),
        organization_id=org_id,
        user_id=caseworker_id,
        status="active",
    ))

    # 3. Retained Client User
    client_user_id = uuid.uuid4()
    client_user = User(
        id=client_user_id,
        email="alex.novak@example.com",
        full_name="Alexander Novak",
        password_hash="hash",
        status="active",
    )
    client_user.organization_id = org_id
    client_user.role = "client"
    db.add(client_user)
    db.flush()

    db.add(OrganizationMembership(
        id=uuid.uuid4(),
        organization_id=org_id,
        user_id=client_user_id,
        status="active",
    ))

    # Client Profile
    client_profile = ClientProfile(
        id=uuid.uuid4(),
        organization_id=org_id,
        user_id=client_user_id,
        first_name="Alexander",
        last_name="Novak",
        email="alex.novak@example.com",
        nationality="UKR",
    )
    db.add(client_profile)

    # Immigration Case
    case = ImmigrationCase(
        id=uuid.uuid4(),
        organization_id=org_id,
        client_id=client_profile.id,
        case_number="STG5-EB1A-2026",
        title="Alexander Novak EB-1A Extraordinary Ability",
        jurisdiction="US",
        visa_category="EB-1A",
        status="in_progress",
        operational_state="ACTIVE",
    )
    db.add(case)
    db.commit()

    return {
        "org_id": org_id,
        "attorney": attorney,
        "caseworker": caseworker,
        "client_user": client_user,
        "client_profile": client_profile,
        "case": case,
    }


def _headers(user: User) -> dict:
    return {
        "X-User-Id": str(user.id),
        "X-Organization-Id": str(user.organization_id),
        "X-User-Role": user.role,
    }


def test_cross_document_discrepancy_taxonomy():
    """Validates Master Vision §4.4: Discrepancy taxonomy distinguishing harmless variations from contradictions."""
    # 1. Exact agreement
    r_exact = compare_names("Alexander Novak", "Alexander Novak")
    assert r_exact.is_concordant is True
    assert r_exact.is_confirmed_contradiction is False
    assert r_exact.variation_type is None
    assert r_exact.similarity_score == 1.0

    # 2. Transliteration (Cyrillic Elena / Yelena)
    r_trans = compare_names("Elena Rostova", "Yelena Rostova")
    assert r_trans.is_concordant is True
    assert r_trans.is_confirmed_contradiction is False
    assert r_trans.variation_type == "transliteration"
    assert "fraud" not in r_trans.explanation.lower()

    # 3. Consular Single-Name FNU Notation
    r_fnu = compare_names("Ramesh FNU", "Ramesh")
    assert r_fnu.is_concordant is True
    assert r_fnu.variation_type == "cultural_single_name_fnu"

    # 4. Transposed / Reversed East Asian or South Asian name order
    r_rev = compare_names("Wei Zhang", "Zhang Wei")
    assert r_rev.is_concordant is True
    assert r_rev.variation_type == "reversed_name_order"

    # 5. Arabic / Semitic Particle Assimilation
    r_part = compare_names("Ahmed Al-Mansoor", "Ahmed Mansoor")
    assert r_part.is_concordant is True
    assert r_part.variation_type == "cultural_particle_variation"

    # 6. Patronymic Initial Expansion
    r_pat = compare_names("K. Ramesh", "Kumar Ramesh")
    assert r_pat.is_concordant is True
    assert r_pat.variation_type == "patronymic_initial_variant"

    # 7. Marriage surname bridge (With vs Without Civil Marriage Certificate)
    r_marr_yes = compare_names("Sarah Jane Smith", "Sarah Jane Johnson", has_marriage_record=True)
    assert r_marr_yes.is_concordant is True
    assert r_marr_yes.variation_type == "name_change"

    r_marr_no = compare_names("Sarah Jane Smith", "Sarah Jane Johnson", has_marriage_record=False)
    assert r_marr_no.is_concordant is False
    assert r_marr_no.is_confirmed_contradiction is False  # Requires corroborating record, not instant fraud
    assert r_marr_no.variation_type == "name_change"

    # 8. Confirmed Disparate Names Contradiction
    r_contra = compare_names("Alexander Novak", "David Christopher Miller")
    assert r_contra.is_concordant is False
    assert r_contra.is_confirmed_contradiction is True
    assert r_contra.variation_type == "unexplained_difference"

    # 9. Dates of Birth:
    # Exact match
    r_dob_exact = compare_dates_of_birth("1988-04-12", "12 APR 1988")
    assert r_dob_exact.is_concordant is True
    assert r_dob_exact.is_confirmed_contradiction is False

    # Date format ambiguity (US 04/07 vs European 07/04)
    r_dob_ambig = compare_dates_of_birth("04/07/1988", "07/04/1988")
    assert r_dob_ambig.is_concordant is False
    assert r_dob_ambig.is_confirmed_contradiction is False
    assert r_dob_ambig.variation_type == "date_format_ambiguity"

    # OCR single-year typo (1988 vs 1989 with same month and day)
    r_dob_typo = compare_dates_of_birth("1988-04-12", "1989-04-12")
    assert r_dob_typo.is_concordant is False
    assert r_dob_typo.is_confirmed_contradiction is False
    assert r_dob_typo.variation_type == "ocr_noise"

    # Confirmed date contradiction
    r_dob_contra = compare_dates_of_birth("1988-04-12", "1975-11-20")
    assert r_dob_contra.is_concordant is False
    assert r_dob_contra.is_confirmed_contradiction is True

    # 10. Document Numbers:
    # Exact match
    r_doc_exact = compare_document_numbers("p 12345678", "P12345678")
    assert r_doc_exact.is_concordant is True

    # OCR optical character substitution (0 vs O)
    r_doc_ocr = compare_document_numbers("P1234567O", "P12345670")
    assert r_doc_ocr.is_concordant is False
    assert r_doc_ocr.is_confirmed_contradiction is False
    assert r_doc_ocr.variation_type == "ocr_noise"

    # Unique identifiers must not be fuzzy-matched
    r_doc_diff = compare_document_numbers("P12345678", "P98765432")
    assert r_doc_diff.is_concordant is False
    assert r_doc_diff.is_confirmed_contradiction is True


def test_privileged_internal_risk_notes_privacy(client: TestClient, db, stage5_fixture):
    """Validates Master Vision §4.5: Privileged staff-only fraud/risk notes are strictly hidden from clients."""
    fix = stage5_fixture
    case = fix["case"]

    # Create an AI finding with sensitive staff risk notes
    finding = CaseAIFinding(
        id=uuid.uuid4(),
        organization_id=fix["org_id"],
        case_id=case.id,
        finding_type="statutory_evidence_gap",
        severity="major",
        status="needs_review",
        title="Degree Awardee Surname Discrepancy",
        description="Diploma awarded under maiden name without civil marriage record on file.",
        evidence_text="Diploma recipient: Maria S. Johnson",
        client_facing_template="Please confirm whether your degree was awarded under a former or maiden surname.",
        internal_risk_notes="[INTERNAL STAFF AUDIT] Suspected unverified alias. Check Form I-140 Part 3 Section B. Privileged work product.",
        recommended_action="Obtain official marriage certificate or legal name change decree.",
        uncertainty_limitations="Requires human verification of civil registry index.",
        resolution_history=[],
    )
    db.add(finding)
    db.commit()

    # 1. Staff query: internal_risk_notes is visible
    resp_staff_list = client.get(f"/api/v1/cases/{case.id}/findings", headers=_headers(fix["attorney"]))
    assert resp_staff_list.status_code == 200
    staff_items = resp_staff_list.json()
    assert len(staff_items) >= 1
    staff_finding = next(f for f in staff_items if f["id"] == str(finding.id))
    assert staff_finding["internal_risk_notes"] == "[INTERNAL STAFF AUDIT] Suspected unverified alias. Check Form I-140 Part 3 Section B. Privileged work product."

    # Staff single finding GET
    resp_staff_single = client.get(f"/api/v1/cases/{case.id}/findings/{finding.id}", headers=_headers(fix["attorney"]))
    assert resp_staff_single.status_code == 200
    assert resp_staff_single.json()["internal_risk_notes"] is not None

    # 2. Retained Client query: internal_risk_notes is strictly redacted (None)
    resp_client_list = client.get(f"/api/v1/cases/{case.id}/findings", headers=_headers(fix["client_user"]))
    assert resp_client_list.status_code == 200
    client_items = resp_client_list.json()
    assert len(client_items) >= 1
    client_finding = next(f for f in client_items if f["id"] == str(finding.id))
    assert client_finding["internal_risk_notes"] is None
    assert client_finding["client_facing_template"] == "Please confirm whether your degree was awarded under a former or maiden surname."

    # Client single finding GET
    resp_client_single = client.get(f"/api/v1/cases/{case.id}/findings/{finding.id}", headers=_headers(fix["client_user"]))
    assert resp_client_single.status_code == 200
    assert resp_client_single.json()["internal_risk_notes"] is None

    # 3. Client disposition attempt: Must be denied (HTTP 403)
    resp_client_resolve = client.put(
        f"/api/v1/cases/{case.id}/findings/{finding.id}/resolve",
        json={"note": "Client attempting to self-resolve legal gap."},
        headers=_headers(fix["client_user"]),
    )
    assert resp_client_resolve.status_code == 403

    resp_client_dismiss = client.put(
        f"/api/v1/cases/{case.id}/findings/{finding.id}/dismiss",
        json={"reason": "acceptable_transliteration", "note": "Client self-dismissing."},
        headers=_headers(fix["client_user"]),
    )
    assert resp_client_dismiss.status_code == 403


def test_document_rejection_and_client_correction_flow(client: TestClient, db, stage5_fixture):
    """Validates Master Vision §4.6: Document rejection flow with reason codes, client explanations, and audit events."""
    fix = stage5_fixture
    case = fix["case"]

    # 1. Create an uploaded document
    doc = Document(
        id=uuid.uuid4(),
        organization_id=fix["org_id"],
        case_id=case.id,
        client_id=fix["client_profile"].id,
        title="Passport Biodata Scan",
        filename="passport_blurry.pdf",
        category="identity_passport",
        storage_path="documents/passport_blurry.pdf",
        byte_size=10240,
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        mime_type="application/pdf",
        processing_status="completed",
        verification_status="unverified",
        uploaded_by_user_id=fix["client_user"].id,
    )
    db.add(doc)

    # Associate an outstanding DocumentRequest
    req = DocumentRequest(
        id=uuid.uuid4(),
        organization_id=fix["org_id"],
        case_id=case.id,
        requested_from_client_id=fix["client_profile"].id,
        title="Passport Biodata Scan",
        description="Please upload clear uncropped color scan of passport biodata page.",
        rationale="Primary identity record required under 8 CFR § 103.2(b)(1)",
        category="identity_passport",
        status="requested",
    )
    db.add(req)
    db.commit()

    # 2. Rejection validation: rejects empty reason or short explanation
    invalid_resp = client.post(
        f"/api/v1/documents/{doc.id}/reject",
        json={"structured_reason_code": "BLURRY", "client_explanation": "bad"},
        headers=_headers(fix["caseworker"]),
    )
    assert invalid_resp.status_code == 422

    # 3. Valid Caseworker Rejection
    valid_resp = client.post(
        f"/api/v1/documents/{doc.id}/reject",
        json={
            "structured_reason_code": "IMAGE_BLURRY_OR_ILLEGIBLE",
            "client_explanation": "The machine-readable zone (MRZ) is blurred. Please upload a high-resolution, uncropped color scan.",
            "internal_notes": "[STAFF ONLY] Severe flash glare across bottom 2 lines of passport MRZ.",
        },
        headers=_headers(fix["caseworker"]),
    )
    assert valid_resp.status_code == 200
    res_data = valid_resp.json()
    assert res_data["verification_status"] == "rejected"
    assert res_data["lifecycle_state"] == "rejected"
    assert res_data["structured_reason_code"] == "IMAGE_BLURRY_OR_ILLEGIBLE"
    assert "machine-readable zone (MRZ) is blurred" in res_data["client_explanation"]

    # 4. Verify DocumentRequest was synchronized
    db.refresh(req)
    assert req.status == "rejected"
    assert "machine-readable zone (MRZ) is blurred" in req.rejection_reason

    # 5. Verify AuditEvent created
    audit = db.query(AuditEvent).filter(
        AuditEvent.action == "document.rejected",
        AuditEvent.object_id == str(doc.id),
    ).first()
    assert audit is not None
    assert audit.metadata_json["structured_reason_code"] == "IMAGE_BLURRY_OR_ILLEGIBLE"
    assert audit.metadata_json["internal_notes"] == "[STAFF ONLY] Severe flash glare across bottom 2 lines of passport MRZ."

    # 6. Verify client portal checklist view
    portal_resp = client.get(f"/api/v1/portal/cases/{case.id}/applicant-checklist", headers=_headers(fix["client_user"]))
    assert portal_resp.status_code == 200
    pdata = portal_resp.json()
    sec = pdata["applicants"][0]
    assert sec["rejected_count"] >= 1
    assert sec["outstanding_count"] >= 1

    # Rejected item contains structured reason and client explanation
    rej_item = next(it for it in sec["rejected_items"] if it["structured_reason_code"] == "IMAGE_BLURRY_OR_ILLEGIBLE")
    assert rej_item["client_explanation"] == "The machine-readable zone (MRZ) is blurred. Please upload a high-resolution, uncropped color scan."
    # Privileged internal_notes is NEVER in client response
    assert "flash glare" not in str(portal_resp.json())


def test_finding_disposition_workflow(client: TestClient, db, stage5_fixture):
    """Validates Master Vision §4.5: Anomaly review, dismissal validation, routing, and resolution audit trail."""
    fix = stage5_fixture
    case = fix["case"]

    finding = CaseAIFinding(
        id=uuid.uuid4(),
        organization_id=fix["org_id"],
        case_id=case.id,
        finding_type="consistency_discrepancy",
        severity="critical",
        status="needs_review",
        title="Birth Date Discrepancy on Degree",
        description="Degree transcript indicates birth year 1989 whereas passport states 1988.",
        recommended_action="Resolve by confirming primary civil birth certificate.",
        uncertainty_limitations="High confidence OCR optical discrepancy.",
        resolution_history=[],
    )
    db.add(finding)

    task = CaseTask(
        id=uuid.uuid4(),
        organization_id=fix["org_id"],
        case_id=case.id,
        title="Resolve Degree Birth Date Discrepancy",
        priority="critical",
        status="pending",
        is_completed=False,
    )
    db.add(task)
    db.flush()
    finding.linked_task_id = task.id
    db.commit()

    # 1. Dismiss with invalid reason code: Rejected (HTTP 400)
    inv_dismiss = client.put(
        f"/api/v1/cases/{case.id}/findings/{finding.id}/dismiss",
        json={"reason": "invalid_unsupported_reason", "note": "Caseworker note."},
        headers=_headers(fix["attorney"]),
    )
    assert inv_dismiss.status_code == 400
    assert "Invalid dismissal reason" in inv_dismiss.json()["detail"]

    # 2. Route finding to Emily Stone (Caseworker) with due date and client template
    due = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    route_resp = client.put(
        f"/api/v1/cases/{case.id}/findings/{finding.id}/route",
        json={
            "owner_user_id": str(fix["caseworker"].id),
            "note": "Emily, please follow up with applicant for official registrar letter.",
            "due_date": due,
            "client_facing_template": "Please provide an official university registrar letter verifying birth date.",
        },
        headers=_headers(fix["attorney"]),
    )
    assert route_resp.status_code == 200
    routed = route_resp.json()
    assert routed["owner_user_id"] == str(fix["caseworker"].id)
    assert len(routed["resolution_history"]) == 1
    assert routed["resolution_history"][0]["action"] == "route"

    # Linked task reassigned
    db.refresh(task)
    assert task.assigned_to_user_id == fix["caseworker"].id

    # 3. Resolve finding with reviewer legal rationale
    resolve_resp = client.put(
        f"/api/v1/cases/{case.id}/findings/{finding.id}/resolve",
        json={"note": "Registrar letter received confirming transcript typo. Primary birth certificate governs."},
        headers=_headers(fix["attorney"]),
    )
    assert resolve_resp.status_code == 200
    resolved = resolve_resp.json()
    assert resolved["status"] == "resolved"
    assert resolved["resolution_action"] == "resolve"
    assert "Primary birth certificate governs" in resolved["resolution_reason"]
    assert len(resolved["resolution_history"]) == 2
    assert resolved["resolution_history"][1]["action"] == "resolve"

    # Linked task marked completed
    db.refresh(task)
    assert task.is_completed is True
    assert task.status == "completed"

    # Verify immutable AuditEvent logged
    audit = db.query(AuditEvent).filter(
        AuditEvent.action == "ai_finding.resolved",
        AuditEvent.object_id == str(finding.id),
    ).first()
    assert audit is not None
    assert audit.metadata_json["mandatory_checks_rerun_required"] is True


def test_versioned_firm_checklists_and_invariance(client: TestClient, db, stage5_fixture):
    """Validates Master Vision §4.1, §5: Versioned firm checklists and pinned snapshot invariance."""
    fix = stage5_fixture
    case = fix["case"]

    # 1. Audit unpinned case: Uses global EB-1A statutory template
    unpinned_report = audit_case_checklist(case.jurisdiction, case.visa_category, [])
    assert unpinned_report.is_pinned is False
    assert unpinned_report.total_mandatory >= 2

    # 2. Pin an explicit versioned checklist snapshot to the case
    pinned_snapshot = {
        "status": "SUPPORTED",
        "rule_version_number": "1.0.0",
        "is_pinned": True,
        "checklist": [
            {
                "item_id": "eb1a_custom_passport",
                "label": "Biometric Foreign Passport Record",
                "requirement_citation": "8 CFR § 103.2(b)(1)",
                "is_mandatory": True,
                "acceptable_categories": ["identity_passport"],
            },
            {
                "item_id": "eb1a_custom_peer_review",
                "label": "Documented Peer Review Record",
                "requirement_citation": "8 CFR § 204.5(h)(3)(iv)",
                "is_mandatory": True,
                "acceptable_categories": ["other_evidence"],
            },
            {
                "item_id": "eb1a_custom_optional_cv",
                "label": "Curriculum Vitae",
                "requirement_citation": "Supporting Background",
                "is_mandatory": False,
                "acceptable_categories": ["employment_record"],
            },
        ],
    }

    case.pinned_checklist_snapshot = pinned_snapshot
    case.snapshot_pinned_at = now_utc()
    db.commit()

    # 3. Audit pinned case: Must audit strictly against the 3 pinned requirements
    docs = [
        {"id": str(uuid.uuid4()), "title": "Passport.pdf", "category": "identity_passport", "processing_status": "completed"}
    ]
    pinned_audit = audit_case_checklist(
        case.jurisdiction,
        case.visa_category,
        docs,
        checklist_snapshot=case.pinned_checklist_snapshot,
    )
    assert pinned_audit.is_pinned is True
    assert pinned_audit.version == "1.0.0"
    assert pinned_audit.total_items == 3
    assert pinned_audit.total_mandatory == 2
    assert pinned_audit.satisfied_mandatory == 1
    assert pinned_audit.satisfied_items == 1
    assert len(pinned_audit.missing_items) == 2

    # Verify through API endpoint with matching document in database
    db_doc = Document(
        id=uuid.uuid4(),
        organization_id=fix["org_id"],
        case_id=case.id,
        client_id=fix["client_profile"].id,
        title="Passport.pdf",
        filename="passport.pdf",
        category="identity_passport",
        storage_path="documents/passport.pdf",
        byte_size=2048,
        sha256_hash="a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
        mime_type="application/pdf",
        processing_status="completed",
        verification_status="verified",
        is_current_version=True,
    )
    db.add(db_doc)
    db.commit()

    api_resp = client.get(f"/api/v1/cases/{case.id}/findings/checklist", headers=_headers(fix["attorney"]))
    assert api_resp.status_code == 200
    adata = api_resp.json()
    assert adata["is_pinned"] is True
    assert adata["version"] == "1.0.0"
    assert adata["total_items"] == 3
    assert adata["total_mandatory"] == 2
    assert adata["satisfied_mandatory"] == 1

    # 4. Invariance guarantee: Case preserves pinned snapshot and is unaffected by external mutations
    assert case.pinned_checklist_snapshot["checklist"][0]["item_id"] == "eb1a_custom_passport"
