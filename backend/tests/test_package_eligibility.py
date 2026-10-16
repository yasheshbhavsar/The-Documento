"""
backend/tests/test_package_eligibility.py

Acceptance tests for Phase 1B:
- Backend independently enforces document and package eligibility.
- Builder rejects unresolved anomalies even when explicit document IDs are supplied.
- Cross-tenant and wrong-case documents are rejected.
- Pathway readiness is pathway-aware (US-only forms like G-28 not universally required).
- Warnings and blockers are distinct; neither is converted into legal advice.
- Manifest is reproducible for the same selected versions and policy/template versions.
- Package generation never changes case status to SUBMITTED.
- Preview endpoint reports all 6 distinct dimensions and exact exclusion reasons.
- Manual include/exclude actions require authorization and cannot bypass hard blockers.
- Illustrative eligibility policy interface compatibility.
"""

import uuid
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from types import SimpleNamespace

from backend.app.domain.models import (
    Organization,
    User,
    ClientProfile,
    ImmigrationCase,
    Document,
    CaseAIFinding,
    now_utc,
)
from backend.app.packages.eligibility import (
    PackageEligibilityPolicy,
    Eligibility,
    evaluate_document_for_package,
    preview_package_eligibility,
)
from backend.app.packages.builder import PackageBuilderService, PackageBuilder
from backend.app.packages.readiness import ReadinessService
from backend.app.security.auth import AuthContext, get_auth_context
from backend.app.security.passwords import hash_password
from backend.app.security.rbac import RoleCode
from backend.app.core.errors import (
    TenantIsolationError,
    ValidationError,
    PermissionDeniedError,
)


@pytest.fixture(autouse=True)
def cleanup_dependency_overrides():
    yield
    from backend.app.main import app
    app.dependency_overrides.pop(get_auth_context, None)


def create_test_user(db: Session, email: str, full_name: str) -> User:
    user = User(
        email=email,
        full_name=full_name,
        password_hash=hash_password("secure_pass_123"),
        status="active",
    )
    db.add(user)
    db.flush()
    return user


def setup_eligibility_fixtures(db: Session):
    org = Organization(name="Veritas Immigration Law", slug=f"veritas-{uuid.uuid4().hex[:6]}")
    other_org = Organization(name="Other Law Group", slug=f"other-{uuid.uuid4().hex[:6]}")
    db.add_all([org, other_org])
    db.flush()

    staff_user = create_test_user(db, f"attorney-{uuid.uuid4().hex[:6]}@veritas.com", "Marcus Vance, Esq.")
    client_user = create_test_user(db, f"applicant-{uuid.uuid4().hex[:6]}@domain.com", "Amina Chen")

    client_profile = ClientProfile(
        organization_id=org.id,
        user_id=client_user.id,
        first_name="Amina",
        last_name="Chen",
        email=client_user.email,
        nationality="CAN",
        date_of_birth=datetime(1992, 6, 15, tzinfo=timezone.utc),
    )
    db.add(client_profile)
    db.flush()

    # Case 1: Primary US Case
    case_us = ImmigrationCase(
        organization_id=org.id,
        client_id=client_profile.id,
        case_number=f"CASE-US-{uuid.uuid4().hex[:4].upper()}",
        title="Amina Chen - EB-1A Extraordinary Ability",
        jurisdiction="US",
        visa_category="EB-1A",
        status="intake",
    )
    # Case 2: Canada Case
    case_ca = ImmigrationCase(
        organization_id=org.id,
        client_id=client_profile.id,
        case_number=f"CASE-CA-{uuid.uuid4().hex[:4].upper()}",
        title="Amina Chen - IRCC Express Entry",
        jurisdiction="CA",
        visa_category="Express Entry",
        status="review",
    )
    # Case 3: Other Case in Same Org
    case_other = ImmigrationCase(
        organization_id=org.id,
        client_id=client_profile.id,
        case_number=f"CASE-OTHER-{uuid.uuid4().hex[:4].upper()}",
        title="Amina Chen - Other Matter",
        jurisdiction="US",
        visa_category="O-1A",
        status="intake",
    )
    # Case 4: Cross-tenant Case
    case_cross_tenant = ImmigrationCase(
        organization_id=other_org.id,
        client_id=client_profile.id,
        case_number=f"CASE-CROSS-{uuid.uuid4().hex[:4].upper()}",
        title="Cross Tenant Matter",
        jurisdiction="US",
        visa_category="EB-2",
        status="intake",
    )
    db.add_all([case_us, case_ca, case_other, case_cross_tenant])
    db.flush()

    # Clean eligible passport document
    doc_passport = Document(
        organization_id=org.id,
        case_id=case_us.id,
        client_id=client_profile.id,
        title="Amina_Chen_Passport.pdf",
        filename="Amina_Chen_Passport.pdf",
        category="identity_document",
        storage_path="/storage/Amina_Chen_Passport.pdf",
        byte_size=1500000,
        mime_type="application/pdf",
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        verification_status="verified",
        processing_status="completed",
        malware_scan_status="clean",
        created_at=now_utc(),
    )
    # Clean Form G-28 for US case
    doc_g28 = Document(
        organization_id=org.id,
        case_id=case_us.id,
        client_id=client_profile.id,
        title="Form_G-28_Signed.pdf",
        filename="Form_G-28_Signed.pdf",
        category="application_forms",
        storage_path="/storage/Form_G-28_Signed.pdf",
        byte_size=800000,
        mime_type="application/pdf",
        sha256_hash="1122334455667788990011223344556677889900112233445566778899001122",
        verification_status="verified",
        processing_status="completed",
        malware_scan_status="clean",
        created_at=now_utc(),
    )
    # Document with unresolved anomaly (AI finding)
    doc_anomaly = Document(
        organization_id=org.id,
        case_id=case_us.id,
        client_id=client_profile.id,
        title="Conflicting_Birth_Certificate.pdf",
        filename="Conflicting_Birth_Certificate.pdf",
        category="civil_status",
        storage_path="/storage/Conflicting_Birth_Certificate.pdf",
        byte_size=1200000,
        mime_type="application/pdf",
        sha256_hash="abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        verification_status="verified",
        processing_status="completed",
        malware_scan_status="clean",
        created_at=now_utc(),
    )
    # Document with unconfirmed classification
    doc_unclassified = Document(
        organization_id=org.id,
        case_id=case_us.id,
        client_id=client_profile.id,
        title="Random_Scanned_Letter.pdf",
        filename="Random_Scanned_Letter.pdf",
        category="unclassified",
        storage_path="/storage/Random_Scanned_Letter.pdf",
        byte_size=900000,
        mime_type="application/pdf",
        sha256_hash="ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        verification_status="verified",
        processing_status="completed",
        malware_scan_status="clean",
        created_at=now_utc(),
    )
    # Document without applicant assignment
    doc_unassigned = Document(
        organization_id=org.id,
        case_id=case_us.id,
        client_id=None,
        title="Generic_Third_Party_Doc.pdf",
        filename="Generic_Third_Party_Doc.pdf",
        category="supporting_evidence",
        storage_path="/storage/Generic_Third_Party_Doc.pdf",
        byte_size=500000,
        mime_type="application/pdf",
        sha256_hash="7777777777777777777777777777777777777777777777777777777777777777",
        verification_status="verified",
        processing_status="completed",
        malware_scan_status="clean",
        created_at=now_utc(),
    )
    # Document without human verification (under_review)
    doc_unverified = Document(
        organization_id=org.id,
        case_id=case_us.id,
        client_id=client_profile.id,
        title="Pending_Diploma_Eval.pdf",
        filename="Pending_Diploma_Eval.pdf",
        category="educational_credential",
        storage_path="/storage/Pending_Diploma_Eval.pdf",
        byte_size=1100000,
        mime_type="application/pdf",
        sha256_hash="8888888888888888888888888888888888888888888888888888888888888888",
        verification_status="unverified",
        processing_status="completed",
        malware_scan_status="clean",
        created_at=now_utc(),
    )
    # Document belonging to other case
    doc_wrong_case = Document(
        organization_id=org.id,
        case_id=case_other.id,
        client_id=client_profile.id,
        title="Other_Case_Document.pdf",
        filename="Other_Case_Document.pdf",
        category="identity_document",
        storage_path="/storage/Other_Case_Document.pdf",
        byte_size=600000,
        mime_type="application/pdf",
        sha256_hash="9999999999999999999999999999999999999999999999999999999999999999",
        verification_status="verified",
        processing_status="completed",
        malware_scan_status="clean",
        created_at=now_utc(),
    )
    # Document belonging to other organization
    doc_cross_tenant = Document(
        organization_id=other_org.id,
        case_id=case_cross_tenant.id,
        client_id=client_profile.id,
        title="Cross_Tenant_Financials.pdf",
        filename="Cross_Tenant_Financials.pdf",
        category="financial_evidence",
        storage_path="/storage/Cross_Tenant_Financials.pdf",
        byte_size=700000,
        mime_type="application/pdf",
        sha256_hash="aaaa1111bbbb2222cccc3333dddd4444aaaa1111bbbb2222cccc3333dddd4444",
        verification_status="verified",
        processing_status="completed",
        malware_scan_status="clean",
        created_at=now_utc(),
    )
    db.add_all([
        doc_passport,
        doc_g28,
        doc_anomaly,
        doc_unclassified,
        doc_unassigned,
        doc_unverified,
        doc_wrong_case,
        doc_cross_tenant,
    ])
    db.flush()

    # Unresolved AI finding linked to doc_anomaly
    finding = CaseAIFinding(
        organization_id=org.id,
        case_id=case_us.id,
        document_id=doc_anomaly.id,
        finding_type="consistency_discrepancy",
        severity="critical",
        status="open",
        title="DOB Discrepancy between Passport and Birth Certificate",
        description="Birth certificate date of birth differs by one month from passport biographical page.",
        recommended_action="Request official corrected extract from civil registry.",
        uncertainty_limitations="High confidence match.",
    )
    db.add(finding)
    db.commit()

    return {
        "org": org,
        "other_org": other_org,
        "staff_user": staff_user,
        "client_user": client_user,
        "client_profile": client_profile,
        "case_us": case_us,
        "case_ca": case_ca,
        "case_other": case_other,
        "case_cross_tenant": case_cross_tenant,
        "doc_passport": doc_passport,
        "doc_g28": doc_g28,
        "doc_anomaly": doc_anomaly,
        "doc_unclassified": doc_unclassified,
        "doc_unassigned": doc_unassigned,
        "doc_unverified": doc_unverified,
        "doc_wrong_case": doc_wrong_case,
        "doc_cross_tenant": doc_cross_tenant,
        "finding": finding,
    }


def test_illustrative_eligibility_policy_compatibility():
    """
    Verifies exact compatibility with illustrative eligibility policy:
    - has_unresolved_anomaly -> UNRESOLVED_ANOMALY
    - not classification_confirmed -> CLASSIFICATION_UNCONFIRMED
    - not applicant_assignment_confirmed -> APPLICANT_UNASSIGNED
    - policy.requires_human_verification and not human_verified -> HUMAN_VERIFICATION_REQUIRED
    """
    case = SimpleNamespace(id=uuid.uuid4(), organization_id=uuid.uuid4())
    policy = PackageEligibilityPolicy(version="2026.1", requires_human_verification=True)

    # Document with unresolved anomaly
    doc_anom = SimpleNamespace(
        id=uuid.uuid4(),
        organization_id=case.organization_id,
        case_id=case.id,
        has_unresolved_anomaly=True,
        classification_confirmed=True,
        applicant_assignment_confirmed=True,
        human_verified=True,
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        byte_size=1000,
        malware_scan_status="clean",
        processing_status="completed",
        verification_status="verified",
    )
    el_anom = evaluate_document_for_package(doc_anom, case, policy)
    assert el_anom.eligible is False
    assert "UNRESOLVED_ANOMALY" in el_anom.blockers
    assert el_anom.policy_version == "2026.1"

    # Document with unconfirmed classification
    doc_class = SimpleNamespace(
        id=uuid.uuid4(),
        organization_id=case.organization_id,
        case_id=case.id,
        has_unresolved_anomaly=False,
        classification_confirmed=False,
        applicant_assignment_confirmed=True,
        human_verified=True,
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        byte_size=1000,
        malware_scan_status="clean",
        processing_status="completed",
        verification_status="verified",
    )
    el_class = evaluate_document_for_package(doc_class, case, policy)
    assert el_class.eligible is False
    assert "CLASSIFICATION_UNCONFIRMED" in el_class.blockers

    # Document with unassigned applicant
    doc_app = SimpleNamespace(
        id=uuid.uuid4(),
        organization_id=case.organization_id,
        case_id=case.id,
        has_unresolved_anomaly=False,
        classification_confirmed=True,
        applicant_assignment_confirmed=False,
        human_verified=True,
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        byte_size=1000,
        malware_scan_status="clean",
        processing_status="completed",
        verification_status="verified",
    )
    el_app = evaluate_document_for_package(doc_app, case, policy)
    assert el_app.eligible is False
    assert "APPLICANT_UNASSIGNED" in el_app.blockers

    # Document requiring human verification
    doc_human = SimpleNamespace(
        id=uuid.uuid4(),
        organization_id=case.organization_id,
        case_id=case.id,
        has_unresolved_anomaly=False,
        classification_confirmed=True,
        applicant_assignment_confirmed=True,
        human_verified=False,
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        byte_size=1000,
        malware_scan_status="clean",
        processing_status="completed",
        verification_status="unverified",
    )
    el_human = evaluate_document_for_package(doc_human, case, policy)
    assert el_human.eligible is False
    assert "HUMAN_VERIFICATION_REQUIRED" in el_human.blockers


def test_builder_rejects_unresolved_anomalies_even_when_explicitly_supplied(db: Session):
    """
    Acceptance test: Builder independently enforces eligibility and rejects
    documents with unresolved anomalies even when explicit IDs are supplied.
    """
    fixtures = setup_eligibility_fixtures(db)
    case = fixtures["case_us"]
    doc_anomaly = fixtures["doc_anomaly"]

    # Explicitly supply the document ID that has an open finding
    with pytest.raises(ValidationError) as exc_info:
        PackageBuilder.build_filing_package(
            db=db,
            organization_id=fixtures["org"].id,
            case_id=case.id,
            name="Unsafe Anomaly Selection Package",
            explicit_document_ids=[doc_anomaly.id],
        )

    assert "UNRESOLVED_ANOMALY" in str(exc_info.value)
    assert "Unsafe document selection rejected" in str(exc_info.value)


def test_cross_tenant_and_wrong_case_documents_are_rejected(db: Session):
    """
    Acceptance test: Cross-tenant and wrong-case documents are rejected by the builder.
    """
    fixtures = setup_eligibility_fixtures(db)
    case_us = fixtures["case_us"]
    doc_wrong_case = fixtures["doc_wrong_case"]
    doc_cross_tenant = fixtures["doc_cross_tenant"]

    # 1. Wrong-case document rejected
    with pytest.raises(ValidationError) as exc_info_wrong_case:
        PackageBuilder.build_filing_package(
            db=db,
            organization_id=fixtures["org"].id,
            case_id=case_us.id,
            name="Wrong Case Package Attempt",
            explicit_document_ids=[doc_wrong_case.id],
        )
    assert "Wrong-case document rejected" in str(exc_info_wrong_case.value)

    # 2. Cross-tenant document rejected
    with pytest.raises(TenantIsolationError) as exc_info_cross_tenant:
        PackageBuilder.build_filing_package(
            db=db,
            organization_id=fixtures["org"].id,
            case_id=case_us.id,
            name="Cross Tenant Package Attempt",
            explicit_document_ids=[doc_cross_tenant.id],
        )
    assert "Cross-tenant document access strictly forbidden" in str(exc_info_cross_tenant.value)


def test_pathway_readiness_does_not_add_unrelated_forms(db: Session):
    """
    Acceptance test: Readiness is pathway-aware; US-only form (G-28) is NOT universally required.
    """
    fixtures = setup_eligibility_fixtures(db)
    case_ca = fixtures["case_ca"]

    # Evaluate readiness for Canada case (has zero G-28 documents)
    report_ca = ReadinessService.evaluate_case_readiness(db, case_ca.id)
    checklist_ca = report_ca["checklist"]

    unmet_criteria = checklist_ca["unmet_package_validation_criteria"]["items"]
    # Form G-28 must NOT be in unmet criteria for Canadian pathways
    g28_rules = [c for c in unmet_criteria if c.get("rule") == "MANDATORY_G28"]
    assert len(g28_rules) == 0, "G-28 must not be required for Canadian immigration pathways"


def test_warnings_and_blockers_are_distinct_and_no_legal_advice(db: Session):
    """
    Acceptance test: Warnings and blockers are distinct; neither is silently
    converted into legal advice or approval chances.
    """
    fixtures = setup_eligibility_fixtures(db)
    case_us = fixtures["case_us"]

    # Create document that is expiring soon (warning) but valid
    doc_expiring = Document(
        organization_id=fixtures["org"].id,
        case_id=case_us.id,
        client_id=fixtures["client_profile"].id,
        title="Expiring_Travel_Passport.pdf",
        filename="Expiring_Travel_Passport.pdf",
        category="identity_document",
        storage_path="/storage/Expiring_Travel_Passport.pdf",
        byte_size=1200000,
        mime_type="application/pdf",
        sha256_hash="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        verification_status="verified",
        verification_notes="Passport valid but expiring in 90 days (expired notes: pending renewal)",
        processing_status="completed",
        malware_scan_status="clean",
        created_at=now_utc(),
    )
    db.add(doc_expiring)
    db.commit()

    policy = PackageEligibilityPolicy(allow_expired_documents=True)
    el = evaluate_document_for_package(doc_expiring, case_us, policy=policy, db=db)

    # Permitted with warning: eligible is True, warning present, blockers empty
    assert el.eligible is True
    assert "DOCUMENT_EXPIRED" in el.warnings
    assert len(el.blockers) == 0

    # Verify preview service keeps warnings and blockers distinct and enforces legal advice disclaimer
    preview = preview_package_eligibility(db, case_us.id, fixtures["org"].id, policy=policy)
    assert "compliance_notice" in preview
    assert "No legal advice is provided or implied" in preview["compliance_notice"]
    assert "Probability of approval is never generated or displayed" in preview["compliance_notice"]


def test_manifest_reproducibility(db: Session):
    """
    Acceptance test: Manifest root hash is strictly reproducible for the same
    selected versions, policy version, and template.
    """
    fixtures = setup_eligibility_fixtures(db)
    case_us = fixtures["case_us"]
    doc_passport = fixtures["doc_passport"]
    doc_g28 = fixtures["doc_g28"]

    # Build package run 1
    pkg1 = PackageBuilder.build_filing_package(
        db=db,
        organization_id=fixtures["org"].id,
        case_id=case_us.id,
        name="Reproducibility Package Build A",
        explicit_document_ids=[doc_passport.id, doc_g28.id],
    )

    # Build package run 2 with same selected document IDs
    pkg2 = PackageBuilder.build_filing_package(
        db=db,
        organization_id=fixtures["org"].id,
        case_id=case_us.id,
        name="Reproducibility Package Build B",
        explicit_document_ids=[doc_passport.id, doc_g28.id],
    )

    assert pkg1.package_hash is not None
    assert pkg2.package_hash is not None
    assert pkg1.package_hash == pkg2.package_hash
    assert len(pkg1.manifest_json["items"]) == len(pkg2.manifest_json["items"])


def test_package_generation_never_changes_case_status_to_submitted(db: Session):
    """
    Acceptance test: Package generation never alters the case status to 'submitted'.
    """
    fixtures = setup_eligibility_fixtures(db)
    case_us = fixtures["case_us"]
    doc_passport = fixtures["doc_passport"]
    doc_g28 = fixtures["doc_g28"]

    assert case_us.status == "intake"

    pkg = PackageBuilder.build_filing_package(
        db=db,
        organization_id=fixtures["org"].id,
        case_id=case_us.id,
        name="Intake Non-Submission Verification Package",
        explicit_document_ids=[doc_passport.id, doc_g28.id],
    )

    db.refresh(case_us)
    # Status remains in intake, NEVER changed to submitted
    assert case_us.status == "intake"
    assert case_us.status != "submitted"
    assert pkg.submission_method == "manual_filing"


def test_preview_endpoint_dimensions_and_exclusions(client: TestClient, db: Session):
    """
    Verifies GET /api/v1/packages/cases/{case_id}/eligibility-preview:
    - Lists included and excluded documents.
    - Demonstrates 6 distinct dimensions.
    - Provides exact exclusion reasons for excluded documents.
    """
    fixtures = setup_eligibility_fixtures(db)
    from backend.app.main import app

    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=fixtures["staff_user"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["staff_user"].email,
        roles=(RoleCode.CASE_MANAGER.value,),
    )

    case_id = fixtures["case_us"].id
    res = client.get(f"/api/v1/packages/cases/{case_id}/eligibility-preview")
    assert res.status_code == 200
    data = res.json()

    assert data["case_id"] == str(case_id)
    assert data["included_documents_count"] >= 2  # Passport and G-28
    assert data["excluded_documents_count"] >= 3  # Anomaly, unclassified, unassigned

    # Inspect excluded documents
    excluded = data["excluded_documents"]
    anomaly_entry = next((d for d in excluded if d["document_id"] == str(fixtures["doc_anomaly"].id)), None)
    assert anomaly_entry is not None
    assert "UNRESOLVED_ANOMALY" in anomaly_entry["blockers"]
    assert len(anomaly_entry["exclusion_reasons"]) > 0

    dimensions = anomaly_entry["dimensions"]
    assert "readability" in dimensions
    assert "classification" in dimensions
    assert "applicant_assignment" in dimensions
    assert "consistency" in dimensions
    assert "evidentiary_sufficiency" in dimensions
    assert "human_verification" in dimensions
    assert dimensions["consistency"]["status"] == "failed"


def test_client_cannot_perform_manual_overrides_and_overrides_cannot_bypass_blockers(
    client: TestClient, db: Session
):
    """
    Verifies that client cannot supply manual inclusions/overrides (403),
    and authorized staff overrides cannot bypass hard blockers (400).
    """
    fixtures = setup_eligibility_fixtures(db)
    from backend.app.main import app
    case_id = fixtures["case_us"].id

    # 1. Client user attempts manual inclusions -> 403 Forbidden
    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=fixtures["client_user"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["client_user"].email,
        roles=(RoleCode.RETAINED_CLIENT.value,),
    )
    res_client = client.post(
        f"/api/v1/packages/cases/{case_id}/build",
        json={
            "name": "Client Override Attempt",
            "manual_inclusions": [str(fixtures["doc_passport"].id)],
        },
    )
    assert res_client.status_code == 403

    # 2. Staff user attempts to override/force-include document with unresolved anomaly -> 400 Bad Request
    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user_id=fixtures["staff_user"].id,
        organization_id=fixtures["org"].id,
        email=fixtures["staff_user"].email,
        roles=(RoleCode.CASE_MANAGER.value,),
    )
    res_staff_override = client.post(
        f"/api/v1/packages/cases/{case_id}/build",
        json={
            "name": "Staff Force Include Attempt",
            "manual_inclusions": [str(fixtures["doc_anomaly"].id)],
            "override_notes": "Attempting to force include document with open anomaly",
        },
    )
    assert res_staff_override.status_code == 400
    assert "UNRESOLVED_ANOMALY" in res_staff_override.json()["message"]
    assert "Hard blockers cannot be bypassed" in res_staff_override.json()["message"]
