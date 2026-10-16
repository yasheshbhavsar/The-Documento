import io
import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError
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
    reconcile_divergent_documents,
    StorageRetentionManager,
    LegalHoldError,
    UnresolvedAnomalyError,
    PurgeIneligibleError,
    DatabaseReconciliationError,
    PROVISIONAL_RETENTION_POLICIES_DAYS,
)
from backend.app.documents.storage import (
    LocalDocumentStorage,
    S3DocumentStorage,
    StorageError,
)
from backend.app.domain.models import (
    Document,
    DocumentExtractedField,
    CaseAIFinding,
    AuditEvent,
    OutboxEvent,
    Organization,
    ImmigrationCase,
    ClientProfile,
    User,
)


@pytest.fixture
def setup_org_and_user(db):
    org = Organization(
        id=uuid.uuid4(),
        name="Global Immigration Law LLP",
        slug=f"org-{uuid.uuid4().hex[:6]}",
        status="active",
    )
    db.add(org)

    user = User(
        id=uuid.uuid4(),
        email=f"attorney-{uuid.uuid4().hex[:6]}@law.com",
        full_name="Attorney Jane Doe",
        status="active",
    )
    db.add(user)
    db.commit()
    return org, user


@pytest.fixture
def local_storage(tmp_path):
    return LocalDocumentStorage(base_dir=tmp_path)


def create_test_document(
    db,
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    storage: LocalDocumentStorage,
    filename: str = "passport.pdf",
    content: bytes = b"RAW_CONFIDENTIAL_CONTENT_PASSPORT_987654321",
    created_at: datetime | None = None,
    category: str = "identity",
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
        uploaded_by_user_id=user_id,
        title=filename,
        filename=filename,
        category=category,
        storage_path=artifact.storage_path,
        sha256_hash=artifact.sha256_hash,
        byte_size=len(content),
        mime_type="application/pdf",
        version=version,
        is_current_version=True,
        malware_scan_status="clean",
        processing_status="completed",
        verification_status="verified",
        extracted_text="CONFIDENTIAL PASSPORT 987654321 JOHN DOE",
        layout_metadata={},
        created_at=created_at or datetime.now(timezone.utc),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


# =====================================================================
# 1. Eligible document reaches intended storage & database state
# =====================================================================

def test_eligible_document_reaches_intended_storage_and_database_state(db, setup_org_and_user, local_storage):
    org, user = setup_org_and_user
    old_date = datetime.now(timezone.utc) - timedelta(days=8 * 365)
    doc = create_test_document(db, org.id, user.id, local_storage, created_at=old_date)
    doc_id = doc.id

    # Add child extracted field to verify cascading deletion
    field = DocumentExtractedField(
        organization_id=org.id,
        document_id=doc.id,
        field_name="passport_number",
        field_label="Passport Number",
        original_value="987654321",
        extraction_method="ocr_tesseract",
    )
    db.add(field)
    db.commit()

    # Pre-condition: file exists in storage
    assert local_storage.exists(org.id, doc_id, f"v1_passport.pdf")

    # Execute purge
    result = purge_document(
        db=db,
        document_id=doc_id,
        organization_id=org.id,
        actor_id=user.id,
        reason="statutory_retention_expiry",
        storage_backend=local_storage,
    )

    assert result["status"] == "permanently_purged"
    assert result["storage_deleted"] is True
    assert result["storage_already_missing"] is False

    # Storage state: file deleted
    assert not local_storage.exists(org.id, doc_id, f"v1_passport.pdf")

    # DB state: document removed
    purged_doc = db.query(Document).filter(Document.id == doc_id).first()
    assert purged_doc is None

    # Child fields removed
    remaining_fields = db.query(DocumentExtractedField).filter(DocumentExtractedField.document_id == doc_id).all()
    assert len(remaining_fields) == 0

    # Audit event logged with zero PII
    audit = (
        db.query(AuditEvent)
        .filter(AuditEvent.object_id == str(doc_id), AuditEvent.action == "retention.document_purged")
        .first()
    )
    assert audit is not None
    assert audit.metadata_json["storage_deleted"] is True
    assert "987654321" not in str(audit.metadata_json)
    assert "CONFIDENTIAL" not in str(audit.metadata_json)

    # Outbox event logged
    outbox = (
        db.query(OutboxEvent)
        .filter(OutboxEvent.aggregate_id == doc_id, OutboxEvent.event_type == "retention.document_purged")
        .first()
    )
    assert outbox is not None


# =====================================================================
# 2. Wrong tenant denied without touching storage
# =====================================================================

def test_wrong_tenant_unauthorized_actor_denied_without_touching_storage(db, setup_org_and_user, local_storage):
    org_a, user_a = setup_org_and_user
    org_b = Organization(
        id=uuid.uuid4(),
        name="Rival Immigration Firm",
        slug=f"rival-firm-{uuid.uuid4().hex[:6]}",
        status="active",
    )
    user_b = User(
        id=uuid.uuid4(),
        email=f"intruder-{uuid.uuid4().hex[:6]}@rival.com",
        full_name="Intruder Bob",
        status="active",
    )
    db.add(org_b)
    db.add(user_b)
    db.commit()

    doc_a = create_test_document(db, org_a.id, user_a.id, local_storage)
    doc_id = doc_a.id

    # Org B actor attempts to purge Org A's document
    with pytest.raises(TenantIsolationError):
        purge_document(
            db=db,
            document_id=doc_id,
            organization_id=org_b.id,
            actor_id=user_b.id,
            bypass_retention_window=True,
            storage_backend=local_storage,
        )

    # Storage and DB records MUST remain untouched
    assert local_storage.exists(org_a.id, doc_id, "v1_passport.pdf")
    doc_still_there = db.query(Document).filter(Document.id == doc_id).first()
    assert doc_still_there is not None


# =====================================================================
# 3. Unresolved anomaly blocks purge until resolved
# =====================================================================

def test_unresolved_anomaly_blocks_purge(db, setup_org_and_user, local_storage):
    org, user = setup_org_and_user
    client_prof = ClientProfile(
        id=uuid.uuid4(),
        organization_id=org.id,
        first_name="Elena",
        last_name="Rostova",
        email=f"elena-{uuid.uuid4().hex[:6]}@example.com",
        nationality="USA",
    )
    db.add(client_prof)
    case = ImmigrationCase(
        id=uuid.uuid4(),
        organization_id=org.id,
        client_id=client_prof.id,
        case_number=f"CAS-{uuid.uuid4().hex[:6]}",
        title="O-1A Extraordinary Ability",
        jurisdiction="US",
        visa_category="O-1A",
    )
    db.add(case)
    db.commit()

    doc = create_test_document(db, org.id, user.id, local_storage)
    doc_id = doc.id

    # Create unresolved AI finding / compliance anomaly
    finding = CaseAIFinding(
        id=uuid.uuid4(),
        organization_id=org.id,
        case_id=case.id,
        document_id=doc.id,
        finding_type="statutory_evidence_gap",
        severity="critical",
        status="needs_review",  # Unresolved!
        title="Critical Evidence Gap",
        description="Missing clear proof of sustained national acclaim.",
        recommended_action="Request peer review proof.",
        uncertainty_limitations="Model confidence moderate.",
    )
    db.add(finding)
    db.commit()

    # Attempt purge: MUST be blocked by unresolved anomaly
    with pytest.raises(UnresolvedAnomalyError) as exc_info:
        purge_document(
            db=db,
            document_id=doc_id,
            organization_id=org.id,
            actor_id=user.id,
            bypass_retention_window=True,
            storage_backend=local_storage,
        )
    assert "unresolved compliance findings/anomalies" in str(exc_info.value)
    assert local_storage.exists(org.id, doc_id, "v1_passport.pdf")

    # Resolve anomaly
    finding.status = "resolved"
    finding.resolution_action = "resolve"
    finding.resolution_reason = "Counsel verified secondary evidence."
    db.commit()

    # Now purge succeeds
    result = purge_document(
        db=db,
        document_id=doc_id,
        organization_id=org.id,
        actor_id=user.id,
        bypass_retention_window=True,
        storage_backend=local_storage,
    )
    assert result["status"] == "permanently_purged"
    assert not local_storage.exists(org.id, doc_id, "v1_passport.pdf")


# =====================================================================
# 4. Legal hold blocks purge until released
# =====================================================================

def test_legal_hold_blocks_purge(db, setup_org_and_user, local_storage):
    org, user = setup_org_and_user
    doc = create_test_document(db, org.id, user.id, local_storage)
    doc_id = doc.id

    # Apply legal hold
    apply_legal_hold(
        db=db,
        document_id=doc_id,
        organization_id=org.id,
        actor_id=user.id,
        reason="DOJ subpoena investigation",
    )

    db.refresh(doc)
    assert is_document_on_legal_hold(doc) is True

    # Purge attempt MUST fail
    with pytest.raises(LegalHoldError) as exc_info:
        purge_document(
            db=db,
            document_id=doc_id,
            organization_id=org.id,
            actor_id=user.id,
            bypass_retention_window=True,
            storage_backend=local_storage,
        )
    assert "active legal hold" in str(exc_info.value)
    assert local_storage.exists(org.id, doc_id, "v1_passport.pdf")

    # Release legal hold
    release_legal_hold(
        db=db,
        document_id=doc_id,
        organization_id=org.id,
        actor_id=user.id,
        reason="Subpoena matter closed",
    )
    db.refresh(doc)
    assert is_document_on_legal_hold(doc) is False

    # Purge now succeeds
    result = purge_document(
        db=db,
        document_id=doc_id,
        organization_id=org.id,
        actor_id=user.id,
        bypass_retention_window=True,
        storage_backend=local_storage,
    )
    assert result["status"] == "permanently_purged"


# =====================================================================
# 5. Ineligible document under retention schedule
# =====================================================================

def test_ineligible_document_retention_schedule(db, setup_org_and_user, local_storage):
    org, user = setup_org_and_user
    recent_date = datetime.now(timezone.utc) - timedelta(days=10)
    doc = create_test_document(db, org.id, user.id, local_storage, created_at=recent_date)

    # Without bypass: blocked by retention policy
    with pytest.raises(PurgeIneligibleError) as exc_info:
        purge_document(
            db=db,
            document_id=doc.id,
            organization_id=org.id,
            actor_id=user.id,
            bypass_retention_window=False,
            storage_backend=local_storage,
        )
    assert "retention threshold" in str(exc_info.value)
    assert local_storage.exists(org.id, doc.id, "v1_passport.pdf")

    # With explicit bypass (e.g. approved GDPR right-to-be-forgotten): succeeds
    result = purge_document(
        db=db,
        document_id=doc.id,
        organization_id=org.id,
        actor_id=user.id,
        bypass_retention_window=True,
        storage_backend=local_storage,
    )
    assert result["status"] == "permanently_purged"


# =====================================================================
# 6. Transient storage failure is not reported as success & retryable
# =====================================================================

def test_transient_storage_failure_not_reported_as_success_and_retryable(db, setup_org_and_user):
    org, user = setup_org_and_user
    # Mock storage backend that fails transiently
    mock_backend = MagicMock(spec=LocalDocumentStorage)
    mock_backend.delete_file.side_effect = StorageError("S3 503 Service Unavailable / Connection Timeout")

    doc = Document(
        id=uuid.uuid4(),
        organization_id=org.id,
        uploaded_by_user_id=user.id,
        title="statement.pdf",
        filename="statement.pdf",
        category="financial",
        storage_path="s3://documents/tenants/.../statement.pdf",
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        byte_size=1024,
        mime_type="application/pdf",
        version=1,
        is_current_version=True,
        malware_scan_status="clean",
        processing_status="completed",
        verification_status="verified",
        layout_metadata={},
        created_at=datetime.now(timezone.utc) - timedelta(days=3000),
    )
    db.add(doc)
    db.commit()
    doc_id = doc.id

    # Call purge -> must fail with StorageError
    with pytest.raises(StorageError):
        purge_document(
            db=db,
            document_id=doc_id,
            organization_id=org.id,
            actor_id=user.id,
            storage_backend=mock_backend,
        )

    # Document in DB MUST NOT be deleted
    db_doc = db.query(Document).filter(Document.id == doc_id).first()
    assert db_doc is not None

    # No "document_purged" audit event created
    audit = db.query(AuditEvent).filter(AuditEvent.object_id == str(doc_id), AuditEvent.action == "retention.document_purged").first()
    assert audit is None

    # Once storage recovers, retry succeeds
    mock_backend.delete_file.side_effect = None
    mock_backend.delete_file.return_value = True

    retry_result = purge_document(
        db=db,
        document_id=doc_id,
        organization_id=org.id,
        actor_id=user.id,
        storage_backend=mock_backend,
    )
    assert retry_result["status"] == "permanently_purged"
    assert db.query(Document).filter(Document.id == doc_id).first() is None


# =====================================================================
# 7. Already-missing object follows explicit idempotent reconciliation
# =====================================================================

def test_already_missing_object_idempotent_reconciliation(db, setup_org_and_user):
    org, user = setup_org_and_user
    mock_backend = MagicMock(spec=LocalDocumentStorage)
    # Storage returns False (already missing from bucket/disk)
    mock_backend.delete_file.return_value = False
    mock_backend.delete_by_storage_path.return_value = False

    doc = Document(
        id=uuid.uuid4(),
        organization_id=org.id,
        uploaded_by_user_id=user.id,
        title="missing_obj.pdf",
        filename="missing_obj.pdf",
        category="supporting",
        storage_path="s3://documents/missing.pdf",
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        byte_size=512,
        mime_type="application/pdf",
        version=1,
        is_current_version=True,
        malware_scan_status="clean",
        processing_status="completed",
        verification_status="verified",
        layout_metadata={},
        created_at=datetime.now(timezone.utc) - timedelta(days=3000),
    )
    db.add(doc)
    db.commit()
    doc_id = doc.id

    result = purge_document(
        db=db,
        document_id=doc_id,
        organization_id=org.id,
        actor_id=user.id,
        storage_backend=mock_backend,
    )

    assert result["status"] == "permanently_purged"
    assert result["storage_deleted"] is False
    assert result["storage_already_missing"] is True

    # DB record is cleaned up
    assert db.query(Document).filter(Document.id == doc_id).first() is None

    # Repeated purge request is idempotent and does not fail
    repeat_result = purge_document(
        db=db,
        document_id=doc_id,
        organization_id=org.id,
        actor_id=user.id,
        storage_backend=mock_backend,
    )
    assert repeat_result["status"] == "already_purged"
    assert repeat_result["storage_already_missing"] is True


# =====================================================================
# 8. Database failure after storage deletion records compensation
# =====================================================================

def test_database_failure_after_storage_deletion_records_compensation(db, setup_org_and_user, local_storage):
    org, user = setup_org_and_user
    doc = create_test_document(db, org.id, user.id, local_storage, created_at=datetime.now(timezone.utc) - timedelta(days=3000))
    doc_id = doc.id

    # Simulate database commit error when deleting DB record
    orig_commit = db.commit
    commit_call_count = 0

    def fail_on_delete_commit():
        nonlocal commit_call_count
        commit_call_count += 1
        # The first commit is for audit initiation; the second commit is for DB purge
        if commit_call_count == 2:
            raise RuntimeError("Simulated DB connection drop during purge commit")
        return orig_commit()

    with patch.object(db, "commit", side_effect=fail_on_delete_commit):
        with pytest.raises(DatabaseReconciliationError) as exc_info:
            purge_document(
                db=db,
                document_id=doc_id,
                organization_id=org.id,
                actor_id=user.id,
                storage_backend=local_storage,
            )
        assert "Reconciliation needed event logged" in str(exc_info.value)

    # Storage was deleted
    assert not local_storage.exists(org.id, doc_id, "v1_passport.pdf")

    # Reconciliation audit event was recorded!
    reconciliation_audit = (
        db.query(AuditEvent)
        .filter(
            AuditEvent.object_id == str(doc_id),
            AuditEvent.action == "retention.reconciliation_needed",
        )
        .first()
    )
    assert reconciliation_audit is not None
    assert reconciliation_audit.metadata_json["severity"] == "CRITICAL"
    assert "reconciliation required" in reconciliation_audit.metadata_json["message"].lower()

    # Outbox compensation event was recorded
    reconciliation_outbox = (
        db.query(OutboxEvent)
        .filter(
            OutboxEvent.aggregate_id == doc_id,
            OutboxEvent.event_type == "retention.reconciliation_needed",
        )
        .first()
    )
    assert reconciliation_outbox is not None


# =====================================================================
# 9. Local & S3 Storage adapters satisfy the same deletion contract
# =====================================================================

def test_local_storage_deletion_contract(tmp_path):
    storage = LocalDocumentStorage(base_dir=tmp_path)
    org_id = uuid.uuid4()
    file_id = uuid.uuid4()
    filename = "contract.pdf"

    storage.store_file(org_id, file_id, filename, b"LEGAL_CONTRACT")
    assert storage.exists(org_id, file_id, filename)

    # First delete -> True
    deleted = storage.delete_file(org_id, file_id, filename)
    assert deleted is True
    assert not storage.exists(org_id, file_id, filename)

    # Second delete (already missing) -> False (idempotent)
    deleted_again = storage.delete_file(org_id, file_id, filename)
    assert deleted_again is False


def test_s3_storage_deletion_contract():
    # Test S3 storage adapter behavior with mocked boto3
    with patch("boto3.client") as mock_boto:
        mock_s3 = MagicMock()
        mock_boto.return_value = mock_s3

        s3_storage = S3DocumentStorage(
            endpoint_url="http://localhost:9000",
            bucket_name="test-bucket",
        )

        org_id = uuid.uuid4()
        file_id = uuid.uuid4()
        filename = "s3_contract.pdf"

        # Case A: Object exists -> deletes and returns True
        mock_s3.head_object.return_value = {"ContentLength": 100}
        assert s3_storage.delete_file(org_id, file_id, filename) is True
        mock_s3.delete_object.assert_called_once()

        # Case B: Object does not exist (404/NoSuchKey) -> returns False
        mock_s3.reset_mock()
        mock_s3.head_object.side_effect = ClientError(
            {"Error": {"Code": "NoSuchKey", "Message": "Not found"}}, "HeadObject"
        )
        assert s3_storage.delete_file(org_id, file_id, filename) is False
        mock_s3.delete_object.assert_not_called()

        # Case C: Network/Auth error (500) -> raises StorageError
        mock_s3.reset_mock()
        mock_s3.head_object.side_effect = ClientError(
            {"Error": {"Code": "500", "Message": "Internal Error"}}, "HeadObject"
        )
        with pytest.raises(StorageError):
            s3_storage.delete_file(org_id, file_id, filename)


# =====================================================================
# 10. Audit metadata does NOT contain PII, OCR text, or bytes
# =====================================================================

def test_audit_logs_contain_zero_pii_or_ocr_text(db, setup_org_and_user, local_storage):
    org, user = setup_org_and_user
    secret_text = "SECRET_PASSPORT_NUMBER_A12345678"
    secret_content = f"CONFIDENTIAL DATA FOR {secret_text}".encode()

    doc = create_test_document(
        db,
        org.id,
        user.id,
        local_storage,
        content=secret_content,
        created_at=datetime.now(timezone.utc) - timedelta(days=3000),
    )
    doc_id = doc.id

    purge_document(
        db=db,
        document_id=doc_id,
        organization_id=org.id,
        actor_id=user.id,
        storage_backend=local_storage,
    )

    audit_events = (
        db.query(AuditEvent)
        .filter(AuditEvent.object_id == str(doc_id))
        .all()
    )
    assert len(audit_events) >= 2  # initiated and purged

    for evt in audit_events:
        metadata_str = str(evt.metadata_json)
        assert secret_text not in metadata_str
        assert "CONFIDENTIAL" not in metadata_str
        assert "JOHN DOE" not in metadata_str
        assert "RAW_CONFIDENTIAL" not in metadata_str


# =====================================================================
# 11. API Endpoints: Purge, Legal Hold, Evaluations, Retained Clients
# =====================================================================

def test_api_purge_and_legal_hold_lifecycle(client, db, setup_org_and_user, local_storage):
    org, user = setup_org_and_user

    # Setup staff headers
    staff_headers = {
        "X-Organization-Id": str(org.id),
        "X-User-Id": str(user.id),
        "X-User-Role": "case_manager",
    }
    # Setup client headers
    client_user_id = str(uuid.uuid4())
    client_headers = {
        "X-Organization-Id": str(org.id),
        "X-User-Id": client_user_id,
        "X-User-Role": "client",
    }

    doc = create_test_document(
        db,
        org.id,
        user.id,
        local_storage,
        created_at=datetime.now(timezone.utc) - timedelta(days=3000),
    )
    doc_id = str(doc.id)

    # 1. Retained client CANNOT purge documents (403 Forbidden)
    res_client_purge = client.post(
        f"/api/v1/documents/{doc_id}/purge",
        headers=client_headers,
        json={"reason": "client_attempted_purge"},
    )
    assert res_client_purge.status_code == 403

    # 2. Staff applies legal hold
    res_hold = client.post(
        f"/api/v1/documents/{doc_id}/legal-hold",
        headers=staff_headers,
        json={"reason": "Statutory immigration audit"},
    )
    assert res_hold.status_code == 200

    # 3. Staff attempts purge while under legal hold -> 409 Conflict
    res_purge_blocked = client.post(
        f"/api/v1/documents/{doc_id}/purge",
        headers=staff_headers,
        json={"reason": "statutory_retention_expiry"},
    )
    assert res_purge_blocked.status_code == 409
    assert "legal hold" in res_purge_blocked.text

    # 4. Staff releases legal hold
    res_release = client.delete(
        f"/api/v1/documents/{doc_id}/legal-hold?reason=Audit_complete",
        headers=staff_headers,
    )
    assert res_release.status_code == 200

    # 5. Check retention evaluations endpoint
    res_eval = client.get(
        "/api/v1/documents/retention/evaluations?jurisdiction=US",
        headers=staff_headers,
    )
    assert res_eval.status_code == 200
    evals = res_eval.json()
    assert len(evals) >= 1
    target_eval = next((e for e in evals if e["document_id"] == doc_id), None)
    assert target_eval is not None
    assert target_eval["is_eligible"] is True

    # 6. Staff purges eligible document -> 200 OK
    res_purge = client.post(
        f"/api/v1/documents/{doc_id}/purge",
        headers=staff_headers,
        json={"reason": "statutory_retention_expiry"},
    )
    assert res_purge.status_code == 200
    purge_data = res_purge.json()
    assert purge_data["status"] == "permanently_purged"
    assert purge_data["purged_document_id"] == doc_id


# =====================================================================
# 12. Active Casework Protection
# =====================================================================

def test_active_casework_protection(db, setup_org_and_user, local_storage):
    org, user = setup_org_and_user
    client_prof = ClientProfile(
        id=uuid.uuid4(),
        organization_id=org.id,
        first_name="Active",
        last_name="Petitioner",
        email=f"petitioner-{uuid.uuid4().hex[:6]}@example.com",
        nationality="IND",
    )
    db.add(client_prof)
    case = ImmigrationCase(
        id=uuid.uuid4(),
        organization_id=org.id,
        client_id=client_prof.id,
        case_number=f"ACT-{uuid.uuid4().hex[:6]}",
        title="H-1B Specialty Occupation",
        jurisdiction="US",
        visa_category="H-1B",
        status="filed",  # Active case!
    )
    db.add(case)
    db.commit()

    old_date = datetime.now(timezone.utc) - timedelta(days=3000)
    doc = create_test_document(db, org.id, user.id, local_storage, created_at=old_date)
    doc.case_id = case.id
    db.commit()

    # Routine purge without bypass: BLOCKED because case is active
    with pytest.raises(PurgeIneligibleError) as exc_info:
        purge_document(
            db=db,
            document_id=doc.id,
            organization_id=org.id,
            actor_id=user.id,
            bypass_retention_window=False,
            storage_backend=local_storage,
        )
    assert "active petition" in str(exc_info.value).lower()
    assert local_storage.exists(org.id, doc.id, "v1_passport.pdf")

    # Once case is closed or archived: eligible for routine purge!
    case.status = "closed"
    db.commit()

    result = purge_document(
        db=db,
        document_id=doc.id,
        organization_id=org.id,
        actor_id=user.id,
        bypass_retention_window=False,
        storage_backend=local_storage,
    )
    assert result["status"] == "permanently_purged"


# =====================================================================
# 13. Download / Export Evidence Requirement
# =====================================================================

def test_download_evidence_requirement(db, setup_org_and_user, local_storage):
    org, user = setup_org_and_user
    old_date = datetime.now(timezone.utc) - timedelta(days=3000)
    doc = create_test_document(db, org.id, user.id, local_storage, created_at=old_date)
    doc.layout_metadata = {"require_download_evidence": True}
    db.commit()

    # Attempt purge without download evidence: BLOCKED
    with pytest.raises(PurgeIneligibleError) as exc_info:
        purge_document(
            db=db,
            document_id=doc.id,
            organization_id=org.id,
            actor_id=user.id,
            bypass_retention_window=False,
            storage_backend=local_storage,
        )
    assert "download" in str(exc_info.value).lower()
    assert local_storage.exists(org.id, doc.id, "v1_passport.pdf")

    # Record evidentiary export audit event
    download_audit = AuditEvent(
        organization_id=org.id,
        actor_id=user.id,
        action="package.exported",
        object_type="document",
        object_id=str(doc.id),
        metadata_json={"export_format": "pdf_bundle"},
        occurred_at=datetime.now(timezone.utc),
    )
    db.add(download_audit)
    db.commit()

    # Now purge succeeds
    result = purge_document(
        db=db,
        document_id=doc.id,
        organization_id=org.id,
        actor_id=user.id,
        bypass_retention_window=False,
        storage_backend=local_storage,
    )
    assert result["status"] == "permanently_purged"


# =====================================================================
# 14. Operator Reconciliation Workflow & API Endpoint
# =====================================================================

def test_operator_reconciliation_workflow(client, db, setup_org_and_user, local_storage):
    org, user = setup_org_and_user
    staff_headers = {
        "X-Organization-Id": str(org.id),
        "X-User-Id": str(user.id),
        "X-User-Role": "case_manager",
    }

    # Create a document that has divergence (storage already purged, DB record remained)
    doc = create_test_document(db, org.id, user.id, local_storage)
    doc_id = str(doc.id)

    # Delete storage manually to simulate storage-succeeded-first divergence
    local_storage.delete_file(org.id, doc.id, "v1_passport.pdf")
    assert not local_storage.exists(org.id, doc.id, "v1_passport.pdf")

    # Flag document with divergence in DB and audit event
    meta = dict(doc.layout_metadata or {})
    meta["storage_purged_divergence"] = True
    meta["reconciliation_needed"] = True
    doc.layout_metadata = meta
    doc.processing_status = "failed"

    reconcile_audit = AuditEvent(
        organization_id=org.id,
        actor_id=user.id,
        action="retention.reconciliation_needed",
        object_type="document",
        object_id=doc_id,
        metadata_json={"severity": "CRITICAL", "message": "Storage purged, DB failed"},
        occurred_at=datetime.now(timezone.utc),
    )
    db.add(reconcile_audit)
    db.commit()

    # Retention evaluations lists this as reconciliation_needed
    eval_res = client.get("/api/v1/documents/retention/evaluations", headers=staff_headers)
    assert eval_res.status_code == 200
    target_eval = next((e for e in eval_res.json() if e["document_id"] == doc_id), None)
    assert target_eval is not None
    assert target_eval["status"] == "reconciliation_needed"

    # Operator triggers reconciliation endpoint
    recon_res = client.post("/api/v1/documents/retention/reconcile", headers=staff_headers)
    assert recon_res.status_code == 200
    recon_list = recon_res.json()
    assert len(recon_list) >= 1
    reconciled_item = next((r for r in recon_list if r["purged_document_id"] == doc_id), None)
    assert reconciled_item is not None
    assert reconciled_item["status"] == "permanently_purged"
    assert reconciled_item["storage_already_missing"] is True

    # Document row is now completely removed from DB
    assert db.query(Document).filter(Document.id == doc.id).first() is None

