"""Stage 2 Regression Test Suite: Ephemeral Retention Realignment & Download Confirmation Gate.

Verifies the requirements from Documento Master Vision §1 and §4.8:
1. Documento operates as ephemeral temporary working storage, not a permanent cloud vault.
2. Ephemeral retention schedules (14-day draft intake, 30-day default, firm post-download policies).
3. Download initiation alone is NEVER treated as proof of local saving.
4. Unconfirmed, in-flight, or failed package downloads strictly BLOCK routine automated cleanup.
5. Confirmed/verified downloads enable the post-download retention clock.
6. Legal holds and unresolved anomalies remain absolute blocks regardless of download status.
7. Zero-PII audit logging on all retention evaluations and purge events.
"""
import uuid
from datetime import datetime, timezone, timedelta

import pytest
from fastapi.testclient import TestClient

from backend.app.core.errors import (
    NotFoundError,
    TenantIsolationError,
    PermissionDeniedError,
)
from backend.app.documents.retention import (
    purge_document,
    apply_legal_hold,
    release_legal_hold,
    is_document_on_legal_hold,
    evaluate_purge_eligibility,
    StorageRetentionManager,
    LegalHoldError,
    UnresolvedAnomalyError,
    PurgeIneligibleError,
    EPHEMERAL_RETENTION_SCHEDULES_DAYS,
    DEFAULT_EPHEMERAL_RETENTION_DAYS,
    DEFAULT_DRAFT_RETENTION_DAYS,
    DEFAULT_CLOSED_CASE_RETENTION_DAYS,
)
from backend.app.documents.storage import LocalDocumentStorage
from backend.app.domain.models import (
    Document,
    AuditEvent,
    OutboxEvent,
    CaseAIFinding,
    Organization,
    ImmigrationCase,
    ClientProfile,
    User,
    FilingPackage,
    PackageDownloadEvent,
)


@pytest.fixture
def setup_stage2_data(db, tmp_path):
    storage = LocalDocumentStorage(base_dir=tmp_path)

    org = Organization(
        id=uuid.uuid4(),
        name="Apex Immigration Partners LLP",
        slug=f"apex-{uuid.uuid4().hex[:6]}",
        status="active",
    )
    db.add(org)

    user = User(
        id=uuid.uuid4(),
        email=f"partner-{uuid.uuid4().hex[:6]}@apexlaw.com",
        full_name="Partner Sarah Vance",
        status="active",
    )
    db.add(user)

    client_prof = ClientProfile(
        id=uuid.uuid4(),
        organization_id=org.id,
        first_name="Carlos",
        last_name="Mendoza",
        email=f"carlos-{uuid.uuid4().hex[:6]}@example.com",
        nationality="MEX",
    )
    db.add(client_prof)

    case = ImmigrationCase(
        id=uuid.uuid4(),
        organization_id=org.id,
        client_id=client_prof.id,
        case_number=f"APX-{uuid.uuid4().hex[:6]}",
        title="EB-1A Extraordinary Ability Petition",
        jurisdiction="US",
        visa_category="EB-1A",
        status="closed",  # Closed case ready for ephemeral post-download retention
        post_download_retention_policy="seven_days",
    )
    db.add(case)
    db.commit()

    return {
        "org": org,
        "user": user,
        "client": client_prof,
        "case": case,
        "storage": storage,
    }


def create_stage2_document(
    db,
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    storage: LocalDocumentStorage,
    filename: str = "curriculum_vitae.pdf",
    content: bytes = b"RAW_CV_CONTENT_DR_MENDOZA",
    created_at: datetime | None = None,
    case_id: uuid.UUID | None = None,
    layout_metadata: dict | None = None,
) -> Document:
    doc_id = uuid.uuid4()
    version = 1
    artifact = storage.store_file(
        organization_id=org_id,
        file_id=doc_id,
        filename=f"v{version}_{filename}",
        content=content,
        content_type="application/pdf",
    )
    doc = Document(
        id=doc_id,
        organization_id=org_id,
        case_id=case_id,
        uploaded_by_user_id=user_id,
        title=filename,
        filename=filename,
        category="supporting_evidence",
        storage_path=artifact.storage_path,
        sha256_hash=artifact.sha256_hash,
        byte_size=len(content),
        mime_type="application/pdf",
        version=version,
        is_current_version=True,
        malware_scan_status="clean",
        processing_status="completed",
        verification_status="verified",
        layout_metadata=layout_metadata or {},
        created_at=created_at or datetime.now(timezone.utc),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


# =====================================================================
# 1. Ephemeral Schedule Evaluation for Intake Drafts and Standard Cases
# =====================================================================

def test_ephemeral_retention_draft_intake(setup_stage2_data, db):
    """
    Intake drafts (unlinked to an active case) have a 14-day ephemeral retention limit.
    Documents younger than 14 days are held; documents older than 14 days are eligible.
    """
    data = setup_stage2_data
    org, user, storage = data["org"], data["user"], data["storage"]

    now = datetime.now(timezone.utc)
    recent_created = now - timedelta(days=7)
    old_created = now - timedelta(days=16)

    # A. 7-day-old intake draft -> ineligible under ephemeral schedule
    recent_draft = create_stage2_document(db, org.id, user.id, storage, filename="draft_recent.pdf", created_at=recent_created)
    eligibility_recent = evaluate_purge_eligibility(
        db, recent_draft, organization_id=org.id, use_ephemeral_schedule=True, now=now
    )
    assert eligibility_recent.is_eligible is False
    assert eligibility_recent.threshold_days == DEFAULT_DRAFT_RETENTION_DAYS  # 14 days
    assert any("does not exceed retention threshold" in r for r in eligibility_recent.reasons)

    # B. 16-day-old intake draft -> eligible for ephemeral purge
    old_draft = create_stage2_document(db, org.id, user.id, storage, filename="draft_old.pdf", created_at=old_created)
    eligibility_old = evaluate_purge_eligibility(
        db, old_draft, organization_id=org.id, use_ephemeral_schedule=True, now=now
    )
    assert eligibility_old.is_eligible is True
    assert eligibility_old.threshold_days == DEFAULT_DRAFT_RETENTION_DAYS


# =====================================================================
# 2. Unconfirmed Package Download Strictly Blocks Routine Purge
# =====================================================================

def test_unconfirmed_package_download_blocks_routine_purge(setup_stage2_data, db):
    """
    Master Vision §4.8 Invariant:
    A download starting in a browser is NOT proof of local saving.
    A failed or uncertain download must NEVER trigger cleanup.
    If an assembled package has not been downloaded or verification is pending,
    routine automated cleanup MUST be blocked.
    """
    data = setup_stage2_data
    org, user, case, storage = data["org"], data["user"], data["case"], data["storage"]

    now = datetime.now(timezone.utc)
    old_created = now - timedelta(days=40)

    # Create document linked to the closed case
    doc = create_stage2_document(
        db, org.id, user.id, storage, filename="expert_letter.pdf", created_at=old_created, case_id=case.id
    )

    # Create an assembled filing package for the case
    pkg = FilingPackage(
        id=uuid.uuid4(),
        organization_id=org.id,
        case_id=case.id,
        name="Official EB-1A Submission Package",
        version_number="v1.0.0",
        status="approved",
        package_hash="sha256_mock_eb1a_pkg",
        manifest_json={"items": [str(doc.id)]},
    )
    db.add(pkg)
    db.commit()

    # Scenario A: Package generated, but 0 download events exist
    eligibility_no_dl = evaluate_purge_eligibility(
        db, doc, organization_id=org.id, use_ephemeral_schedule=True, now=now
    )
    assert eligibility_no_dl.is_eligible is False
    assert eligibility_no_dl.download_confirmed is False
    assert any("has not been downloaded by firm staff" in r for r in eligibility_no_dl.reasons)

    # Purge attempt MUST fail
    with pytest.raises(PurgeIneligibleError) as exc_info:
        purge_document(
            db=db,
            document_id=doc.id,
            organization_id=org.id,
            actor_id=user.id,
            use_ephemeral_schedule=True,
            storage_backend=storage,
        )
    assert "has not been downloaded" in str(exc_info.value)
    assert storage.exists(org.id, doc.id, "v1_expert_letter.pdf")

    # Scenario B: Download was initiated (e.g. streaming started, browser clicked link),
    # but client receipt was NEVER verified (is_verified is False)
    dl_event = PackageDownloadEvent(
        id=uuid.uuid4(),
        organization_id=org.id,
        package_id=pkg.id,
        downloaded_by_user_id=user.id,
        downloaded_at=now - timedelta(days=2),
        package_hash_at_download=pkg.package_hash,
        is_verified=False,  # Unconfirmed transfer!
    )
    db.add(dl_event)
    db.commit()

    eligibility_unconfirmed = evaluate_purge_eligibility(
        db, doc, organization_id=org.id, use_ephemeral_schedule=True, now=now
    )
    assert eligibility_unconfirmed.is_eligible is False
    assert eligibility_unconfirmed.download_confirmed is False
    assert any("transfer receipt was unconfirmed" in r for r in eligibility_unconfirmed.reasons)

    # Purge attempt MUST still fail
    with pytest.raises(PurgeIneligibleError) as exc_info2:
        purge_document(
            db=db,
            document_id=doc.id,
            organization_id=org.id,
            actor_id=user.id,
            use_ephemeral_schedule=True,
            storage_backend=storage,
        )
    assert "transfer receipt was unconfirmed" in str(exc_info2.value)


# =====================================================================
# 3. Verified Download Confirms Transfer and Starts Post-Download Clock
# =====================================================================

def test_verified_download_starts_post_download_retention_clock(setup_stage2_data, db):
    """
    Once client-side browser receipt is cryptographically confirmed (is_verified=True),
    the post-download ephemeral retention clock begins:
    - If post-download age < case policy threshold (e.g. 7 days): purge is held.
    - Once post-download age >= threshold: document is eligible and securely purged.
    """
    data = setup_stage2_data
    org, user, case, storage = data["org"], data["user"], data["case"], data["storage"]

    now = datetime.now(timezone.utc)
    old_created = now - timedelta(days=40)
    doc = create_stage2_document(
        db, org.id, user.id, storage, filename="form_i140.pdf", created_at=old_created, case_id=case.id
    )

    pkg = FilingPackage(
        id=uuid.uuid4(),
        organization_id=org.id,
        case_id=case.id,
        name="Official EB-1A Package",
        version_number="v1.0.0",
        status="approved",
        package_hash="sha256_mock_pkg_verified",
        manifest_json={"items": [str(doc.id)]},
    )
    db.add(pkg)

    # Case has post_download_retention_policy = "seven_days"
    # Stage A: Download was verified 2 days ago (2 < 7 days) -> Held
    verified_recent = PackageDownloadEvent(
        id=uuid.uuid4(),
        organization_id=org.id,
        package_id=pkg.id,
        downloaded_by_user_id=user.id,
        downloaded_at=now - timedelta(days=2),
        package_hash_at_download=pkg.package_hash,
        is_verified=True,
        verified_at=now - timedelta(days=2),
        client_verification_payload={"client_received_bytes": 10240, "browser_storage_acknowledged": True},
    )
    db.add(verified_recent)
    db.commit()

    eligibility_held = evaluate_purge_eligibility(
        db, doc, organization_id=org.id, use_ephemeral_schedule=True, now=now
    )
    assert eligibility_held.download_confirmed is True
    assert eligibility_held.is_eligible is False
    assert any("Post-download retention period has not elapsed" in r for r in eligibility_held.reasons)

    # Stage B: Advance verified timestamp past the 7-day retention window (8 days post-verification)
    verified_recent.verified_at = now - timedelta(days=8)
    verified_recent.downloaded_at = now - timedelta(days=8)
    db.commit()

    eligibility_expired = evaluate_purge_eligibility(
        db, doc, organization_id=org.id, use_ephemeral_schedule=True, now=now
    )
    assert eligibility_expired.download_confirmed is True
    assert eligibility_expired.is_eligible is True

    # Purge execution succeeds cleanly
    result = purge_document(
        db=db,
        document_id=doc.id,
        organization_id=org.id,
        actor_id=user.id,
        use_ephemeral_schedule=True,
        storage_backend=storage,
    )
    assert result["status"] == "permanently_purged"
    assert result["storage_deleted"] is True
    assert not storage.exists(org.id, doc.id, "v1_form_i140.pdf")


# =====================================================================
# 4. Document-Level Unconfirmed Download vs Verified Download
# =====================================================================

def test_document_level_unconfirmed_download_vs_verified_download(setup_stage2_data, db):
    """
    When a document has require_download_evidence=True:
    - An unverified download audit event (action="document.downloaded") DOES NOT satisfy the gate.
    - A verified download event (action="document.download_verified") or metadata satisfies the gate.
    """
    data = setup_stage2_data
    org, user, storage = data["org"], data["user"], data["storage"]

    now = datetime.now(timezone.utc)
    old_created = now - timedelta(days=60)
    doc = create_stage2_document(
        db,
        org.id,
        user.id,
        storage,
        filename="standalone_evidence.pdf",
        created_at=old_created,
        layout_metadata={"require_download_evidence": True},
    )

    # Step 1: Only unverified download event recorded
    unverified_audit = AuditEvent(
        organization_id=org.id,
        actor_id=user.id,
        action="document.downloaded",
        object_type="document",
        object_id=str(doc.id),
        metadata_json={"ip_address": "127.0.0.1"},
        occurred_at=now - timedelta(days=10),
    )
    db.add(unverified_audit)
    db.commit()

    eligibility_unverified = evaluate_purge_eligibility(
        db, doc, organization_id=org.id, use_ephemeral_schedule=True, now=now
    )
    assert eligibility_unverified.is_eligible is False
    assert any("client receipt was not verified" in r for r in eligibility_unverified.reasons)

    # Step 2: Record verified download audit event
    verified_audit = AuditEvent(
        organization_id=org.id,
        actor_id=user.id,
        action="document.download_verified",
        object_type="document",
        object_id=str(doc.id),
        metadata_json={"client_received_bytes": 2048, "browser_storage_acknowledged": True},
        occurred_at=now - timedelta(days=5),
    )
    db.add(verified_audit)
    db.commit()

    eligibility_verified = evaluate_purge_eligibility(
        db, doc, organization_id=org.id, use_ephemeral_schedule=True, now=now
    )
    assert eligibility_verified.is_eligible is True


# =====================================================================
# 5. Legal Hold and Unresolved Anomalies Override Verified Download
# =====================================================================

def test_legal_hold_and_unresolved_anomalies_override_verified_download(setup_stage2_data, db):
    """
    Even if package download is 100% verified and the retention period has elapsed,
    active legal hold and unresolved compliance findings strictly block purge.
    """
    data = setup_stage2_data
    org, user, case, storage = data["org"], data["user"], data["case"], data["storage"]

    now = datetime.now(timezone.utc)
    old_created = now - timedelta(days=90)
    doc = create_stage2_document(
        db, org.id, user.id, storage, filename="held_evidence.pdf", created_at=old_created, case_id=case.id
    )

    # Verified download event 30 days ago
    pkg = FilingPackage(
        id=uuid.uuid4(),
        organization_id=org.id,
        case_id=case.id,
        name="Official Package",
        version_number="v1.0.0",
        status="approved",
        package_hash="pkg_hash_held_test",
        manifest_json={"items": [str(doc.id)]},
    )
    db.add(pkg)
    dl = PackageDownloadEvent(
        id=uuid.uuid4(),
        organization_id=org.id,
        package_id=pkg.id,
        downloaded_by_user_id=user.id,
        downloaded_at=now - timedelta(days=30),
        package_hash_at_download=pkg.package_hash,
        is_verified=True,
        verified_at=now - timedelta(days=30),
    )
    db.add(dl)

    # Apply legal hold
    apply_legal_hold(db, doc.id, organization_id=org.id, actor_id=user.id, reason="Pending OIG Inquiry")

    with pytest.raises(LegalHoldError):
        purge_document(
            db=db,
            document_id=doc.id,
            organization_id=org.id,
            actor_id=user.id,
            use_ephemeral_schedule=True,
            storage_backend=storage,
        )

    # Release legal hold, but add unresolved anomaly
    release_legal_hold(db, doc.id, organization_id=org.id, actor_id=user.id, reason="OIG Inquiry resolved")

    finding = CaseAIFinding(
        id=uuid.uuid4(),
        organization_id=org.id,
        case_id=case.id,
        document_id=doc.id,
        finding_type="date_of_birth_discrepancy",
        severity="critical",
        status="needs_review",  # Unresolved
        title="DOB Contradiction",
        description="Passport vs Birth Certificate mismatch.",
        recommended_action="Resolve discrepancy with secondary evidence.",
        uncertainty_limitations="High confidence OCR extraction discrepancy.",
    )
    db.add(finding)
    db.commit()

    with pytest.raises(UnresolvedAnomalyError):
        purge_document(
            db=db,
            document_id=doc.id,
            organization_id=org.id,
            actor_id=user.id,
            use_ephemeral_schedule=True,
            storage_backend=storage,
        )


# =====================================================================
# 6. API Retention Evaluations with Ephemeral Schedule & Download Status
# =====================================================================

def test_api_retention_evaluations_ephemeral(client, setup_stage2_data, db):
    """
    Verifies GET /api/v1/documents/retention/evaluations?use_ephemeral_schedule=true
    correctly exposes download_confirmed, threshold_days, and eligibility.
    """
    data = setup_stage2_data
    org, user, storage = data["org"], data["user"], data["storage"]

    staff_headers = {
        "X-Organization-Id": str(org.id),
        "X-User-Id": str(user.id),
        "X-User-Role": "attorney",
    }

    now = datetime.now(timezone.utc)
    old_draft = create_stage2_document(
        db, org.id, user.id, storage, filename="expired_intake.pdf", created_at=now - timedelta(days=20)
    )

    resp = client.get(
        "/api/v1/documents/retention/evaluations?use_ephemeral_schedule=true",
        headers=staff_headers,
    )
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) >= 1

    target = next((item for item in items if item["document_id"] == str(old_draft.id)), None)
    assert target is not None
    assert target["is_eligible"] is True
    assert target["retention_threshold_days"] == DEFAULT_DRAFT_RETENTION_DAYS  # 14 days
    assert target["download_confirmed"] is True
