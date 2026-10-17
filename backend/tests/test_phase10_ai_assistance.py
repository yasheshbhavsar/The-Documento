"""Comprehensive tests for Phase 10 — AI Assistance, Evidence Traceability, and Guardrails."""
import uuid
import pytest
from datetime import datetime, timezone, timedelta
from uuid import UUID

from sqlalchemy.orm import Session

from backend.app.domain.models import (
    User,
    Organization,
    ImmigrationCase,
    Document,
    ClientProfile,
    ClientConsent,
    DocumentRequest,
    CaseAIFinding,
    AuditEvent,
)

from backend.app.ai.privacy_guard import AIExternalPrivacyGate, PrivacyEvaluationResult
from backend.app.ai.provenance import (
    EvidenceTier,
    format_three_tier_entity,
    LEGAL_SUFFICIENCY_GUARDRAIL,
    HIGH_CONFIDENCE_NOT_LEGAL_SUFFICIENCY_NOTICE,
)
from backend.app.ai.summarizer import (
    summarize_authority_request,
    AuthorityRequestSummary,
    AuthorityRequestItem,
)
from backend.app.ai.client_request_drafter import (
    APPROVED_REQUEST_TEMPLATES,
    draft_client_request_from_template,
    review_and_send_client_request,
)
from backend.app.packages.blocker_explainer import (
    explain_package_blockers,
    PackageBlockerReport,
    BlockerExplanation,
)
from backend.app.documents.boundaries import detect_document_boundaries, split_combined_document
from backend.app.extraction.service import suggest_applicant_association
from backend.app.domain.models import DocumentExtractedField


# ==============================================================================
# 1. AI EXTERNAL PRIVACY GATE & PII MASKING TESTS
# ==============================================================================

def test_privacy_gate_masking_pii():
    """Verify pre-flight PII masking for SSN, Aadhaar, PAN, and payment cards."""
    raw_sample = (
        "Applicant SSN is 123-45-6789. "
        "Indian Aadhaar number is 9876 5432 1098. "
        "Income Tax PAN is ABCDE1234F. "
        "Card payment on file 4111-2222-3333-4444."
    )
    masked = AIExternalPrivacyGate.mask_sensitive_pii(raw_sample)

    assert "123-45-6789" not in masked
    assert "XXX-XX-6789" in masked

    assert "9876 5432 1098" not in masked
    assert "XXXX-XXXX-1098" in masked

    assert "ABCDE1234F" not in masked
    assert "ABCDEXXXXF" in masked

    assert "4111-2222-3333-4444" not in masked
    assert "XXXX-XXXX-XXXX-XXXX" in masked


def test_privacy_gate_consent_enforcement_fail_close(db: Session):
    """Verify that absent or false client consent immediately blocks egress and fails closed."""
    org_id = uuid.uuid4()
    org = Organization(id=org_id, name="Privacy Test Firm", slug=f"priv-{uuid.uuid4().hex[:6]}")
    db.add(org)
    db.commit()

    client_user = User(
        id=uuid.uuid4(),
        email=f"client-{uuid.uuid4().hex[:6]}@example.com",
        full_name="Alice Doe",
        password_hash="fakehash",
    )
    db.add(client_user)
    db.commit()

    client_profile = ClientProfile(
        id=uuid.uuid4(),
        organization_id=org_id,
        user_id=client_user.id,
        first_name="Alice",
        last_name="Doe",
        email=client_user.email,
        nationality="IND",
    )
    db.add(client_profile)
    db.commit()

    # Case 1: No consent record exists -> Must fail closed
    gate_res = AIExternalPrivacyGate.evaluate_external_egress(
        db=db,
        organization_id=org_id,
        client_id=client_profile.id,
        provider="gemini",
        destination_region="US",
    )
    assert gate_res.is_allowed is False
    assert gate_res.fail_closed_to_local is True
    assert any("ai_cloud_processing" in reason for reason in gate_res.block_reasons)

    # Case 2: Only ai_cloud_processing consent without cross-border -> Must still fail closed for cross border
    consent1 = ClientConsent(
        id=uuid.uuid4(),
        organization_id=org_id,
        client_id=client_profile.id,
        consent_type="ai_cloud_processing",
        granted=True,
    )
    db.add(consent1)
    db.commit()

    gate_res2 = AIExternalPrivacyGate.evaluate_external_egress(
        db=db,
        organization_id=org_id,
        client_id=client_profile.id,
        provider="gemini",
        destination_region="US",
    )
    assert gate_res2.is_allowed is False
    assert gate_res2.fail_closed_to_local is True
    assert any("cross-border" in reason.lower() for reason in gate_res2.block_reasons)

    # Case 3: Both consents granted -> Approved for egress
    consent2 = ClientConsent(
        id=uuid.uuid4(),
        organization_id=org_id,
        client_id=client_profile.id,
        consent_type="cross_border_data_transfer",
        granted=True,
    )
    db.add(consent2)
    db.commit()

    gate_res3 = AIExternalPrivacyGate.evaluate_external_egress(
        db=db,
        organization_id=org_id,
        client_id=client_profile.id,
        provider="gemini",
        destination_region="US",
    )
    assert gate_res3.is_allowed is True
    assert gate_res3.fail_closed_to_local is False
    assert len(gate_res3.block_reasons) == 0


# ==============================================================================
# 2. DOCUMENT BOUNDARIES, SECTIONS & APPLICANT ASSOCIATION
# ==============================================================================

def test_detect_document_boundaries_and_split():
    """Verify document boundary detection over multi-page PDF inputs."""
    pages = [
        {"page_number": 1, "text": "PASSPORT Republic of India Personal Particulars Surname Doe"},
        {"page_number": 2, "text": "PASSPORT Observations and Address Page"},
        {"page_number": 3, "text": "OFFICIAL TRANSCRIPT University of Oxford Master of Science"},
        {"page_number": 4, "text": "ACADEMIC TRANSCRIPT CONTINUED Courses and Grades"},
        {"page_number": 5, "text": "BANK OF AMERICA MONTHLY STATEMENT Account Balance $50,000"},
    ]
    sections = detect_document_boundaries(pages)
    assert len(sections) == 3

    assert sections[0]["category"] == "identity"
    assert sections[0]["start_page"] == 1
    assert sections[0]["end_page"] == 2

    assert sections[1]["category"] == "education"
    assert sections[1]["start_page"] == 3
    assert sections[1]["end_page"] == 4

    assert sections[2]["category"] == "financial"
    assert sections[2]["start_page"] == 5
    assert sections[2]["end_page"] == 5


def test_applicant_association_uncertain_remains_unassigned(db: Session):
    """Verify that matching score below threshold (< 0.70) leaves applicant assignment unassigned."""
    org_id = uuid.uuid4()
    org = Organization(id=org_id, name="Association Test Firm", slug=f"assoc-{uuid.uuid4().hex[:6]}")
    db.add(org)
    db.commit()

    client_user = User(
        id=uuid.uuid4(),
        email=f"client-{uuid.uuid4().hex[:6]}@example.com",
        full_name="Alexander Hamilton",
        password_hash="fakehash",
    )
    db.add(client_user)
    db.commit()

    client_profile = ClientProfile(
        id=uuid.uuid4(),
        organization_id=org_id,
        user_id=client_user.id,
        first_name="Alexander",
        last_name="Hamilton",
        email=client_user.email,
        nationality="USA",
    )
    db.add(client_profile)
    db.commit()

    case = ImmigrationCase(
        id=uuid.uuid4(),
        organization_id=org_id,
        case_number="CASE-TEST-001",
        title="O-1A Case: Alexander Hamilton",
        client_id=client_profile.id,
        visa_category="O-1A",
        jurisdiction="US",
    )
    db.add(case)
    db.commit()

    family_candidates = [
        {
            "id": str(client_profile.id),
            "name": "Alexander Hamilton",
            "first_name": "Alexander",
            "last_name": "Hamilton",
            "is_dependant": False,
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Elizabeth Schuyler",
            "first_name": "Elizabeth",
            "last_name": "Schuyler",
            "is_dependant": True,
            "dependant_id": uuid.uuid4(),
        },
    ]

    # Case A: Extracted field matches Alexander Hamilton -> Score >= 0.70 -> Assigned
    fields_high = [
        DocumentExtractedField(
            id=uuid.uuid4(),
            organization_id=org_id,
            document_id=uuid.uuid4(),
            field_name="applicant_name",
            field_label="Applicant Name",
            original_value="Alexander Hamilton",
            normalized_value="Alexander Hamilton",
            extraction_confidence=0.98,
        )
    ]
    matched_high, score_high = suggest_applicant_association(fields_high, family_candidates)
    assert matched_high is not None
    assert score_high >= 0.70
    assert matched_high["name"] == "Alexander Hamilton"

    # Case B: Extracted field is completely unrelated or uncertain -> Score < 0.70 (or None) -> Uncertain assignment remains unassigned
    fields_low = [
        DocumentExtractedField(
            id=uuid.uuid4(),
            organization_id=org_id,
            document_id=uuid.uuid4(),
            field_name="applicant_name",
            field_label="Applicant Name",
            original_value="Maria Reynolds",
            normalized_value="Maria Reynolds",
            extraction_confidence=0.90,
        )
    ]
    matched_low, score_low = suggest_applicant_association(fields_low, family_candidates)
    assert (matched_low is None) or (score_low < 0.70)


# ==============================================================================
# 3. THREE-TIER PROVENANCE ARCHITECTURE
# ==============================================================================

def test_three_tier_provenance_formatting_and_disclaimer():
    """Verify separation of extracted fact, model inference, and professional decision."""
    # Model inference state (unvalidated)
    t_model = format_three_tier_entity(
        field_id="fld-1",
        field_name="passport_number",
        field_label="Passport Number",
        raw_value="Z1234567",
        normalized_value="Z1234567",
        source_page=1,
        source_location={"ymin": 0.1, "xmin": 0.2, "ymax": 0.15, "xmax": 0.4},
        ocr_confidence=0.98,
        extraction_confidence=0.95,
        model_version="mock-vision-neural-v2",
        validation_status="unvalidated",
    )
    assert t_model["current_tier"] == EvidenceTier.MODEL_INFERENCE.value
    assert t_model["tiers"]["tier1_extracted_fact"]["verbatim_text"] == "Z1234567"
    assert t_model["tiers"]["tier1_extracted_fact"]["source_page"] == 1
    assert "optical character recognition" in t_model["tiers"]["tier1_extracted_fact"]["optical_fidelity_disclaimer"].lower()

    assert t_model["tiers"]["tier2_model_inference"]["extraction_confidence"] == 0.95
    assert t_model["tiers"]["tier2_model_inference"]["provenance"]["do_not_train"] is True
    assert "do not decide legal eligibility" in t_model["tiers"]["tier2_model_inference"]["legal_scope_guardrail"].lower()

    # Professional decision state (verified / corrected)
    t_prof = format_three_tier_entity(
        field_id="fld-1",
        field_name="passport_number",
        field_label="Passport Number",
        raw_value="Z1234567",
        normalized_value="Z1234567",
        validation_status="verified",
        corrected_by_user_id="usr-atty-1",
        corrected_at="2026-10-17T12:00:00Z",
        correction_reason="Verified against original passport booklet.",
    )
    assert t_prof["current_tier"] == EvidenceTier.PROFESSIONAL_DECISION.value
    assert t_prof["tiers"]["tier3_professional_decision"]["status"] == "verified"
    assert t_prof["tiers"]["tier3_professional_decision"]["decision_maker_user_id"] == "usr-atty-1"
    assert t_prof["tiers"]["tier3_professional_decision"]["rationale"] == "Verified against original passport booklet."


# ==============================================================================
# 4. AUTHORITY REQUEST SUMMARIZATION (RFE / NOID / 221(g))
# ==============================================================================

def test_authority_request_summarization_with_citations(db: Session):
    """Verify structured parsing and evidence citations for government authority notices."""
    org_id = uuid.uuid4()
    org = Organization(id=org_id, name="Adjudication Firm", slug=f"adj-{uuid.uuid4().hex[:6]}")
    db.add(org)
    db.commit()

    client_user = User(
        id=uuid.uuid4(),
        email=f"client-{uuid.uuid4().hex[:6]}@example.com",
        full_name="Jane Doe",
        password_hash="fakehash",
    )
    db.add(client_user)
    db.commit()

    client_profile = ClientProfile(
        id=uuid.uuid4(),
        organization_id=org_id,
        user_id=client_user.id,
        first_name="Jane",
        last_name="Doe",
        email=client_user.email,
        nationality="USA",
    )
    db.add(client_profile)
    db.commit()

    case = ImmigrationCase(
        id=uuid.uuid4(),
        organization_id=org_id,
        client_id=client_profile.id,
        case_number="CASE-US-9911",
        title="EB-1A Petition: Dr. Jane Doe",
        visa_category="EB-1A",
        jurisdiction="US",
    )
    db.add(case)
    db.commit()

    rfe_notice_text = (
        "UNITED STATES CITIZENSHIP AND IMMIGRATION SERVICES\n"
        "REQUEST FOR EVIDENCE (RFE) — Form I-140 Immigrant Petition\n"
        "Date of Issuance: September 15, 2026. Response Due Date: December 08, 2026.\n"
        "Statutory Authority: 8 CFR § 204.5(h)(3).\n\n"
        "1. Critical Role / Employment Experience: The petitioner submitted letters of recommendation; "
        "however, they do not establish that the beneficiary performed in a leading or critical role "
        "for organizations or establishments that have a distinguished reputation.\n\n"
        "2. Scholarly Articles & Citations: While 12 publications were documented, evidence that these articles "
        "have provoked widespread commentary or major citations across the field is missing.\n\n"
        "3. High Remuneration: The salary documentation lacks comparative wage data under 8 CFR 204.5(h)(3)(ix)."
    )

    summary: AuthorityRequestSummary = summarize_authority_request(
        case_data={"case_number": case.case_number, "jurisdiction": case.jurisdiction},
        authority_request_text=rfe_notice_text,
        case_documents=[],
        extracted_fields=[],
        document_title="Form I-797 Request for Evidence",
    )

    assert "RFE" in summary.request_type
    assert "USCIS" in summary.authority_name
    assert summary.response_deadline is not None
    assert len(summary.items_analyzed) >= 1
    assert summary.unaddressed_count >= 1

    # Guardrail notice must be present
    assert "do not decide legal eligibility" in summary.legal_sufficiency_disclaimer


# ==============================================================================
# 5. CLIENT REQUEST DRAFTING & STAFF REVIEW WORKFLOW
# ==============================================================================

def test_draft_client_request_requires_staff_review(db: Session):
    """Verify that AI drafts from approved templates create draft-status requests private from clients."""
    org_id = uuid.uuid4()
    org = Organization(id=org_id, name="Template Test Firm", slug=f"tmpl-{uuid.uuid4().hex[:6]}")
    db.add(org)
    db.commit()

    staff_user = User(
        id=uuid.uuid4(),
        email="case_mgr@example.com",
        full_name="Marcus Reviewer",
        password_hash="fakehash",
    )
    db.add(staff_user)
    db.commit()

    client_profile = ClientProfile(
        id=uuid.uuid4(),
        organization_id=org_id,
        user_id=staff_user.id,
        first_name="Jane",
        last_name="Doe",
        email="jane.doe@example.com",
        nationality="USA",
    )
    db.add(client_profile)
    db.commit()

    case = ImmigrationCase(
        id=uuid.uuid4(),
        organization_id=org_id,
        client_id=client_profile.id,
        case_number="CASE-US-5544",
        title="O-1 Case",
        jurisdiction="US",
        visa_category="O-1A",
    )
    db.add(case)
    db.commit()

    finding = CaseAIFinding(
        id=uuid.uuid4(),
        organization_id=org_id,
        case_id=case.id,
        finding_type="identity_discrepancy",
        severity="major",
        status="needs_review",
        title="Name variation observed across passport and academic degree",
        description="Passport has 'Jane Elizabeth Doe', degree says 'Jane E. Doe'.",
        recommended_action="Request name affidavit",
        uncertainty_limitations="Requires client confirmation",
        client_facing_template="Dear Client, please provide an official affidavit regarding your middle name.",
    )
    db.add(finding)
    db.commit()

    # 1. Staff drafts request from approved template
    draft_req = draft_client_request_from_template(
        db=db,
        case_id=case.id,
        template_code="NAME_DISCREPANCY_CLARIFICATION",
        finding_id=finding.id,
        custom_instructions="Please also upload certified translation if applicable.",
        actor_id=staff_user.id,
        organization_id=org_id,
    )

    assert draft_req.status == "draft"
    assert draft_req.status_history[0]["requires_staff_review"] is True
    assert "Name Affidavit" in draft_req.title
    assert "certified translation" in draft_req.instructions

    # 2. Staff reviews, edits, and authorizes dispatch
    approved_req = review_and_send_client_request(
        db=db,
        request_id=draft_req.id,
        reviewer_id=staff_user.id,
        organization_id=org_id,
        title_override="Clarification of Legal Name for USCIS Filing",
        instructions_override="Please upload a certified name affidavit before Friday.",
        due_date_override=datetime.now(timezone.utc) + timedelta(days=7),
        review_notes="Authorized by Case Manager Marcus Reviewer after finding check.",
    )

    assert approved_req.status == "requested"
    assert approved_req.status_history[-1]["staff_review_completed"] is True
    assert approved_req.title == "Clarification of Legal Name for USCIS Filing"


# ==============================================================================
# 6. DETERMINISTIC BLOCKER EXPLAINER
# ==============================================================================

def test_deterministic_blocker_explainer(db: Session):
    """Verify explanation of deterministic package blockers using status/reason codes."""
    org_id = uuid.uuid4()
    org = Organization(id=org_id, name="Blocker Test Firm", slug=f"block-{uuid.uuid4().hex[:6]}")
    db.add(org)
    db.commit()

    staff_user = User(
        id=uuid.uuid4(),
        email="lawyer@example.com",
        full_name="Lawyer Reviewer",
        password_hash="fakehash",
    )
    db.add(staff_user)
    db.commit()

    client_profile = ClientProfile(
        id=uuid.uuid4(),
        organization_id=org_id,
        user_id=staff_user.id,
        first_name="Lawyer",
        last_name="Reviewer",
        email="lawyer@example.com",
        nationality="USA",
    )
    db.add(client_profile)
    db.commit()

    # Create a case with:
    # 1. Accounts hold
    # 2. Critical unaddressed finding
    # 3. Pending senior review
    case = ImmigrationCase(
        id=uuid.uuid4(),
        organization_id=org_id,
        client_id=client_profile.id,
        case_number="CASE-US-7788",
        title="Blocked EB-1A Case",
        jurisdiction="US",
        visa_category="EB-1A",
        submission_authorization_status="HELD_ACCOUNTS",
        review_status="SENIOR_REVIEW",
    )
    db.add(case)
    db.commit()

    finding = CaseAIFinding(
        id=uuid.uuid4(),
        organization_id=org_id,
        case_id=case.id,
        finding_type="direct_contradiction",
        severity="critical",
        status="needs_review",
        title="Direct contradiction between W-2 and employer verification letter dates",
        description="W-2 shows 2021-2023, letter claims 2018-2024.",
        recommended_action="Resolve date conflict",
        uncertainty_limitations="Requires documentary evidence",
    )
    db.add(finding)
    db.commit()

    # Evaluate deterministic blockers
    report: PackageBlockerReport = explain_package_blockers(db=db, case_id=case.id)

    assert report.is_blocked is True
    assert report.total_blockers >= 2

    blocker_codes = [b.code for b in report.blockers]
    assert "BLOCKER_HOLD_ACCOUNTS" in blocker_codes
    assert "BLOCKER_UNRESOLVED_FINDING_CRITICAL" in blocker_codes
    assert "BLOCKER_SENIOR_REVIEW_PENDING" in blocker_codes

    # Check status and reason codes & remediation actions
    accounts_blocker = next(b for b in report.blockers if b.code == "BLOCKER_HOLD_ACCOUNTS")
    assert accounts_blocker.status_code == "HELD_ACCOUNTS"
    assert accounts_blocker.category == "compliance_hold"
    assert accounts_blocker.severity == "BLOCKING"
    assert "accounts balance" in accounts_blocker.remediation_action.lower()

    findings_blocker = next(b for b in report.blockers if b.code == "BLOCKER_UNRESOLVED_FINDING_CRITICAL")
    assert findings_blocker.status_code == "needs_review"
    assert findings_blocker.severity == "BLOCKING"

    assert "do not decide legal eligibility" in report.legal_sufficiency_disclaimer


def test_draft_client_request_isolation_from_portal(db: Session):
    """Verify that AI-drafted client requests remain private until explicitly approved by staff."""
    from backend.app.main import app
    from fastapi.testclient import TestClient
    from backend.app.security.auth import AuthContext, get_auth_context
    from backend.app.security.rbac import RoleCode

    org = Organization(id=uuid.uuid4(), name="Draft Privacy Org", slug=f"dpo-{uuid.uuid4().hex[:6]}")
    db.add(org)
    db.commit()

    client_user = User(
        id=uuid.uuid4(),
        email=f"client-{uuid.uuid4().hex[:6]}@example.com",
        full_name="Alexander Hamilton",
        password_hash="fakehash",
    )
    staff_user = User(
        id=uuid.uuid4(),
        email=f"lawyer-{uuid.uuid4().hex[:6]}@example.com",
        full_name="Staff Attorney",
        password_hash="fakehash",
    )
    db.add_all([client_user, staff_user])
    db.commit()

    client_profile = ClientProfile(
        id=uuid.uuid4(),
        organization_id=org.id,
        user_id=client_user.id,
        first_name="Alexander",
        last_name="Hamilton",
        email=client_user.email,
        nationality="USA",
    )
    db.add(client_profile)
    db.commit()

    case = ImmigrationCase(
        id=uuid.uuid4(),
        organization_id=org.id,
        client_id=client_profile.id,
        case_number="CASE-DRAFT-001",
        title="O-1A Case: Alexander Hamilton",
        visa_category="O-1A",
        jurisdiction="US",
    )
    db.add(case)
    db.commit()

    # 1. Staff drafts request from pre-approved template
    draft_req = draft_client_request_from_template(
        db=db,
        case_id=case.id,
        template_code="NAME_DISCREPANCY_CLARIFICATION",
        actor_id=staff_user.id,
        organization_id=org.id,
        custom_instructions="Please upload one-and-the-same affidavit.",
    )
    assert draft_req.status == "draft"

    # 2. Client queries checklist & requests via portal API
    client_ctx = AuthContext(
        user_id=client_user.id,
        organization_id=org.id,
        email=client_user.email,
        roles=(RoleCode.RETAINED_CLIENT.value,),
    )
    app.dependency_overrides[get_auth_context] = lambda: client_ctx
    tc = TestClient(app)

    try:
        # 2a. List requests endpoint: draft is hidden
        res_reqs = tc.get("/api/v1/requests")
        assert res_reqs.status_code == 200
        req_ids = [r["id"] for r in res_reqs.json()]
        assert str(draft_req.id) not in req_ids

        # 2b. Applicant checklist: draft is hidden
        res_chk = tc.get(f"/api/v1/portal/cases/{case.id}/applicant-checklist")
        assert res_chk.status_code == 200
        chk_data = res_chk.json()
        all_req_ids = [
            item["id"]
            for sec in chk_data["applicants"]
            for item in sec["required_items"]
        ]
        assert str(draft_req.id) not in all_req_ids

        # 3. Staff reviews and sends the draft
        approved_req = review_and_send_client_request(
            db=db,
            request_id=draft_req.id,
            reviewer_id=staff_user.id,
            organization_id=org.id,
        )
        assert approved_req.status == "requested"

        # 4. Now the client CAN see the approved request
        res_reqs_after = tc.get("/api/v1/requests")
        assert res_reqs_after.status_code == 200
        req_ids_after = [r["id"] for r in res_reqs_after.json()]
        assert str(draft_req.id) in req_ids_after

    finally:
        app.dependency_overrides.pop(get_auth_context, None)
