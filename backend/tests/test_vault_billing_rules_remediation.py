"""Comprehensive remediation verification suite for Workstream 2:
1. AES-256-GCM / S3 SSE-KMS encryption at rest, fail-closed security, upload hardening & worker locking.
2. Real uploaded PDFs in filing package ZIP exports, valid PyMuPDF form PDFs & HTML XSS escaping.
3. Billing ClientProfile crash fix, hardened Stripe webhook, real Stripe vs honest manual ledger,
   Decimal & multi-jurisdiction tax, multi-currency financial reporting & real SMTP/Resend email transport.
4. Compliance honesty (release gates, privacy reviews, dry-run backup drills, GDPR tar.gz exports & scenario fixes).
5. 2026 statutory immigration rule packs, rule context exemption flags & rules API IDOR closures.
"""

from __future__ import annotations

import hashlib
import hmac
import io
import json
import os
import tarfile
import time
import uuid
import zipfile
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import fitz
import pytest

from backend.app.billing.service import BillingService
from backend.app.core.errors import PermissionDeniedError
from backend.app.documents.processor import process_document_pipeline
from backend.app.documents.security import MalwareScanner, inspect_pdf_malware_indicators
from backend.app.documents.storage import (
    DOC_ENC_MAGIC,
    IntegrityVerificationError,
    LocalDocumentStorage,
    S3DocumentStorage,
    StorageError,
    StorageUnavailableError,
    get_storage_backend,
)
from backend.app.documents.upload_service import verify_download_token
from backend.app.domain.models import (
    AuditEvent,
    ClientProfile,
    Document,
    DocumentExtractedField,
    DocumentProcessingRun,
    FilingPackage,
    FormSchema,
    FormSchemaVersion,
    FormSubmission,
    ImmigrationCase,
    Invoice,
    OfficialSource,
    Organization,
    OrganizationMembership,
    OutboxEvent,
    PaymentRecord,
    PrivacyLegalReview,
    RuleRequirement,
    RuleSet,
    RuleSetVersion,
    SourceSnapshot,
    User,
)
from backend.app.notifications.service import NotificationService
from backend.app.operations.backup_service import BackupAndDrillService
from backend.app.operations.data_flow_register import get_data_flow_register
from backend.app.operations.governance_service import ReleaseGateService
from backend.app.operations.privacy_reviews import (
    ensure_privacy_reviews_seeded,
    get_all_privacy_reviews,
)
from backend.app.operations.scenario_service import ScenarioService
from backend.app.packages.builder import PackageBuilderService
from backend.app.packages.local_archive import (
    build_package_local_zip_archive,
    generate_word_compatible_html_report,
)
from backend.app.rules.rule_engine import build_case_context
from backend.app.rules.seed_production_packs import seed_production_rule_packs
from backend.workers.runner import process_outbox_batch


def _make_valid_pdf(text: str = "Documento Immigration Sample PDF") -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=612, height=792)
    page.insert_text(fitz.Point(72, 72), text, fontsize=12)
    raw = doc.tobytes()
    doc.close()
    return raw


def _seed_org_and_users(db):
    org = Organization(
        id=uuid.uuid4(),
        name="Meridian Immigration LLP",
        slug=f"meridian-{uuid.uuid4().hex[:6]}",
        status="active",
    )
    admin = User(
        id=uuid.uuid4(),
        email=f"admin-{uuid.uuid4().hex[:6]}@meridian.legal",
        full_name="Managing Attorney",
        status="active",
    )
    reviewer = User(
        id=uuid.uuid4(),
        email=f"reviewer-{uuid.uuid4().hex[:6]}@meridian.legal",
        full_name="Document Reviewer",
        status="active",
    )
    finance = User(
        id=uuid.uuid4(),
        email=f"finance-{uuid.uuid4().hex[:6]}@meridian.legal",
        full_name="Finance Staff",
        status="active",
    )
    client_user = User(
        id=uuid.uuid4(),
        email=f"client-{uuid.uuid4().hex[:6]}@example.com",
        full_name="Aarav Client",
        status="active",
    )
    db.add_all([org, admin, reviewer, finance, client_user])
    db.flush()

    db.add_all(
        [
            OrganizationMembership(organization_id=org.id, user_id=admin.id, status="active"),
            OrganizationMembership(organization_id=org.id, user_id=reviewer.id, status="active"),
            OrganizationMembership(organization_id=org.id, user_id=finance.id, status="active"),
            OrganizationMembership(organization_id=org.id, user_id=client_user.id, status="active"),
        ]
    )
    db.commit()
    return org, admin, reviewer, finance, client_user


def _headers(org_id, user_id, role: str) -> dict[str, str]:
    return {
        "X-Organization-Id": str(org_id),
        "X-User-Id": str(user_id),
        "X-User-Role": role,
    }


# ==============================================================================
# AREA 1: VAULT ENCRYPTION AT REST, FAIL-CLOSED SECURITY, UPLOAD & WORKER
# ==============================================================================


def test_local_storage_aes256_gcm_encryption_decryption_legacy_and_tamper(tmp_path):
    storage = LocalDocumentStorage(base_dir=tmp_path)
    org_id = uuid.uuid4()
    file_id = uuid.uuid4()
    plaintext = b"%PDF-1.4\nTOP SECRET PASSPORT NUMBER P99887766\n%%EOF"

    artifact = storage.store_file(
        organization_id=org_id,
        file_id=file_id,
        filename="passport.pdf",
        content=plaintext,
        content_type="application/pdf",
    )

    on_disk = Path(artifact.storage_path).read_bytes()
    assert on_disk.startswith(DOC_ENC_MAGIC), "Stored file on disk must have DOCENC1 AES-GCM envelope header"
    assert b"P99887766" not in on_disk, "Plaintext bytes must never appear unencrypted on disk"
    assert artifact.sha256_hash == hashlib.sha256(plaintext).hexdigest()

    # 3-arg read_file decrypts and validates hash
    decrypted, actual_hash = storage.read_file(org_id, file_id, "passport.pdf", expected_hash=artifact.sha256_hash)
    assert decrypted == plaintext
    assert actual_hash == artifact.sha256_hash

    # 1-arg read_file(storage_path) transparently decrypts
    decrypted_path, path_hash = storage.read_file(artifact.storage_path, expected_hash=artifact.sha256_hash)
    assert decrypted_path == plaintext
    assert path_hash == artifact.sha256_hash

    # Tampering ciphertext triggers IntegrityVerificationError
    tampered = bytearray(on_disk)
    tampered[-1] ^= 0xFF
    Path(artifact.storage_path).write_bytes(bytes(tampered))
    with pytest.raises(IntegrityVerificationError):
        storage.read_file(org_id, file_id, "passport.pdf")

    # Legacy unencrypted file is still readable gracefully
    legacy_id = uuid.uuid4()
    legacy_path = tmp_path / str(org_id) / str(legacy_id) / "legacy.pdf"
    legacy_path.parent.mkdir(parents=True, exist_ok=True)
    legacy_bytes = b"%PDF-1.4\nLegacy Unencrypted Bytes\n%%EOF"
    legacy_path.write_bytes(legacy_bytes)
    read_legacy, read_hash = storage.read_file(org_id, legacy_id, "legacy.pdf")
    assert read_legacy == legacy_bytes
    assert read_hash == hashlib.sha256(legacy_bytes).hexdigest()


def test_local_storage_delete_by_storage_path_blocks_traversal(tmp_path):
    vault_dir = tmp_path / "vault"
    storage = LocalDocumentStorage(base_dir=vault_dir)

    outside_file = tmp_path / "sensitive_host_file.txt"
    outside_file.write_text("do not delete me", encoding="utf-8")

    # Absolute path outside base_dir must be blocked
    with pytest.raises(StorageError, match="Path traversal blocked"):
        storage.delete_by_storage_path(str(outside_file))
    assert outside_file.exists()

    # Relative traversal path must be blocked
    with pytest.raises(StorageError, match="Path traversal blocked"):
        storage.delete_by_storage_path("../sensitive_host_file.txt")
    assert outside_file.exists()

    # Valid path inside base_dir deletes cleanly
    artifact = storage.store_file(uuid.uuid4(), uuid.uuid4(), "safe.pdf", b"ok", "application/pdf")
    assert Path(artifact.storage_path).exists()
    assert storage.delete_by_storage_path(artifact.storage_path) is True
    assert not Path(artifact.storage_path).exists()


def test_s3_storage_sse_kms_aes256_and_safe_timeouts():
    from botocore.exceptions import ClientError

    captured_configs = []
    mock_client = MagicMock()
    mock_client.head_bucket.return_value = {}
    mock_client.head_object.side_effect = ClientError({"Error": {"Code": "404"}}, "HeadObject")
    mock_client.put_object.return_value = {}

    def _fake_boto3_client(service_name, **kwargs):
        captured_configs.append(kwargs.get("config"))
        return mock_client

    with patch("boto3.client", side_effect=_fake_boto3_client):
        # 1. With KMS key -> ServerSideEncryption="aws:kms" + SSEKMSKeyId
        s3_kms = S3DocumentStorage(
            endpoint_url="https://s3.amazonaws.com",
            bucket_name="documento-prod-vault",
            kms_key_id="arn:aws:kms:us-east-1:111122223333:key/vault-key-1",
        )
        s3_kms.save_file(uuid.uuid4(), uuid.uuid4(), "id.pdf", b"%PDF-1.4\n%%EOF", "application/pdf")
        put_kwargs = mock_client.put_object.call_args.kwargs
        assert put_kwargs["ServerSideEncryption"] == "aws:kms"
        assert put_kwargs["SSEKMSKeyId"] == "arn:aws:kms:us-east-1:111122223333:key/vault-key-1"

        # 2. Without KMS key -> ServerSideEncryption="AES256"
        mock_client.put_object.reset_mock()
        s3_aes = S3DocumentStorage(
            endpoint_url="https://s3.amazonaws.com",
            bucket_name="documento-prod-vault",
            kms_key_id="",
        )
        s3_aes.store_file(uuid.uuid4(), uuid.uuid4(), "id.pdf", b"%PDF-1.4\n%%EOF", "application/pdf")
        put_kwargs_aes = mock_client.put_object.call_args.kwargs
        assert put_kwargs_aes["ServerSideEncryption"] == "AES256"
        assert "SSEKMSKeyId" not in put_kwargs_aes

    assert captured_configs[0].connect_timeout == 5
    assert captured_configs[0].read_timeout == 30


def test_get_storage_backend_fail_closed_in_production():
    prod_settings = SimpleNamespace(
        environment="production",
        use_local_storage=False,
        document_storage_dir="/tmp/ephemeral",
        s3_endpoint_url="https://s3.internal.invalid",
        s3_bucket_name="prod-vault",
        s3_access_key="key",
        s3_secret_key="secret",
        s3_region="us-east-1",
        s3_kms_key_id="arn:aws:kms:us-east-1:123:key/test",
    )
    with patch("backend.app.documents.storage.get_settings", return_value=prod_settings), patch(
        "backend.app.documents.storage.S3DocumentStorage", side_effect=ConnectionError("S3 down")
    ):
        with pytest.raises(StorageUnavailableError) as exc_info:
            get_storage_backend()
        assert isinstance(exc_info.value, RuntimeError)
        assert exc_info.value.status_code == 503

    staging_local_settings = SimpleNamespace(
        environment="staging",
        use_local_storage=True,
        document_storage_dir="/tmp/ephemeral",
    )
    with patch("backend.app.documents.storage.get_settings", return_value=staging_local_settings):
        with pytest.raises(StorageUnavailableError) as exc_info2:
            get_storage_backend()
        assert isinstance(exc_info2.value, RuntimeError)
        assert exc_info2.value.status_code == 503


def test_malware_scanner_fail_closed_in_production_and_pdf_heuristics():
    prod_settings = SimpleNamespace(
        environment="production",
        clamav_enabled=True,
        clamav_host="127.0.0.1",
        clamav_port=3310,
        clamav_timeout=5.0,
    )
    mock_sock = MagicMock()
    mock_sock.__enter__.return_value.connect.side_effect = TimeoutError("ClamAV timed out")
    with patch("backend.app.documents.security.get_settings", return_value=prod_settings), patch(
        "backend.app.documents.security.socket.socket", return_value=mock_sock
    ):
        is_clean, detail = MalwareScanner.scan_content(_make_valid_pdf(), "passport.pdf")
        assert is_clean is False
        assert "Upload blocked: malware scanner unavailable" in detail

    # Active PDF exploit scripts must be blocked
    js_pdf = b"%PDF-1.7\n1 0 obj << /Type /Action /S /JavaScript /JS (app.alert(1)) >> endobj\n%%EOF"
    ok_js, reason_js = inspect_pdf_malware_indicators(js_pdf)
    assert ok_js is False
    assert "JavaScript" in reason_js or "/JS" in reason_js

    launch_pdf = b"%PDF-1.7\n1 0 obj << /Type /Action /S /Launch /F (cmd.exe) >> endobj\n%%EOF"
    ok_launch, reason_launch = inspect_pdf_malware_indicators(launch_pdf)
    assert ok_launch is False
    assert "Launch" in reason_launch

    embedded_exe_pdf = b"%PDF-1.7\n1 0 obj << /Type /Filespec /F (payload.exe) /EF << /F 2 0 R >> /EmbeddedFile >> endobj\n%%EOF"
    ok_ef, _ = inspect_pdf_malware_indicators(embedded_exe_pdf)
    assert ok_ef is False

    # Benign XFA / AcroForm immigration PDF must remain allowed
    benign_acroform_pdf = b"%PDF-1.7\n1 0 obj << /Type /Catalog /AcroForm << /XFA 2 0 R /Fields [] >> >> endobj\n%%EOF"
    ok_benign, detail_benign = inspect_pdf_malware_indicators(benign_acroform_pdf)
    assert ok_benign is True, f"Benign AcroForm/XFA PDF should be allowed, got: {detail_benign}"


def test_upload_streaming_cap_batch_cap_raw_only_visibility_and_no_duplicate_outbox(client, db):
    org, admin, _reviewer, _finance, client_user = _seed_org_and_users(db)
    cp = ClientProfile(
        id=uuid.uuid4(),
        organization_id=org.id,
        user_id=client_user.id,
        first_name="Aarav",
        last_name="Patel",
        email=client_user.email,
        nationality="India",
    )
    db.add(cp)
    db.commit()

    admin_hdrs = _headers(org.id, admin.id, "company_admin")
    client_hdrs = _headers(org.id, client_user.id, "retained_client")
    valid_pdf = _make_valid_pdf("Employment Letter")

    # 1. Streaming size cap enforcement (patch MAX_ALLOWED_FILE_SIZE to 100 bytes to test streaming 413 cleanly)
    with patch("backend.app.api.v1.documents.MAX_ALLOWED_FILE_SIZE", 100):
        oversized_resp = client.post(
            "/api/v1/documents/upload",
            headers=admin_hdrs,
            files={"file": ("oversized.pdf", valid_pdf, "application/pdf")},
        )
        assert oversized_resp.status_code == 413

    # 2. Batch cap (>25 files rejected)
    too_many_files = [("files", (f"doc_{i}.pdf", valid_pdf, "application/pdf")) for i in range(26)]
    batch_resp = client.post("/api/v1/documents/upload-batch", headers=admin_hdrs, files=too_many_files)
    assert batch_resp.status_code == 400
    assert "25" in batch_resp.text

    # 3. raw_only=True + visibility=private_to_firm skips OCR & outbox, hides doc from retained client
    raw_resp = client.post(
        "/api/v1/documents/upload",
        headers=admin_hdrs,
        data={
            "client_id": str(cp.id),
            "raw_only": "true",
            "visibility": "private_to_firm",
            "is_private_to_firm": "true",
        },
        files={"file": ("strategy_memo.pdf", valid_pdf, "application/pdf")},
    )
    assert raw_resp.status_code == 201, raw_resp.text
    raw_doc_id = uuid.UUID(raw_resp.json()["id"])
    raw_doc = db.query(Document).filter(Document.id == raw_doc_id).first()
    assert raw_doc.layout_metadata.get("raw_only") is True
    assert raw_doc.layout_metadata.get("visibility") == "private_to_firm"
    assert raw_doc.layout_metadata.get("is_private_to_firm") is True
    assert raw_doc.processing_status == "raw_stored"
    assert db.query(DocumentProcessingRun).filter(DocumentProcessingRun.document_id == raw_doc_id).count() == 0
    assert (
        db.query(OutboxEvent)
        .filter(OutboxEvent.aggregate_id == raw_doc_id, OutboxEvent.event_type == "document.processing.requested")
        .count()
        == 0
    )

    # Retained client cannot list or fetch private_to_firm document
    list_res = client.get("/api/v1/documents", headers=client_hdrs)
    assert list_res.status_code == 200
    assert str(raw_doc_id) not in [item["id"] for item in list_res.json()]
    detail_res = client.get(f"/api/v1/documents/{raw_doc_id}", headers=client_hdrs)
    assert detail_res.status_code == 403

    # 4. Synchronous upload (run_async=false) MUST NOT emit duplicate document.processing.requested outbox event
    sync_resp = client.post(
        "/api/v1/documents/upload",
        headers=admin_hdrs,
        data={"client_id": str(cp.id), "run_async": "false", "raw_only": "false"},
        files={"file": ("sync_letter.pdf", valid_pdf, "application/pdf")},
    )
    assert sync_resp.status_code == 201, sync_resp.text
    sync_doc_id = uuid.UUID(sync_resp.json()["id"])
    assert (
        db.query(OutboxEvent)
        .filter(OutboxEvent.aggregate_id == sync_doc_id, OutboxEvent.event_type == "document.processing.requested")
        .count()
        == 0
    )

    # 5. Async upload (run_async=true) emits exactly ONE document.processing.requested outbox event
    async_resp = client.post(
        "/api/v1/documents/upload",
        headers=admin_hdrs,
        data={"client_id": str(cp.id), "run_async": "true", "raw_only": "false"},
        files={"file": ("async_letter.pdf", valid_pdf, "application/pdf")},
    )
    assert async_resp.status_code in (201, 202), async_resp.text
    async_doc_id = uuid.UUID(async_resp.json()["id"])
    assert (
        db.query(OutboxEvent)
        .filter(OutboxEvent.aggregate_id == async_doc_id, OutboxEvent.event_type == "document.processing.requested")
        .count()
        == 1
    )


def test_null_profile_client_leak_rbac_parent_idor_and_download_audit(client, db):
    org, admin, reviewer, finance, client_user = _seed_org_and_users(db)
    admin_hdrs = _headers(org.id, admin.id, "company_admin")
    reviewer_hdrs = _headers(org.id, reviewer.id, "document_reviewer")
    finance_hdrs = _headers(org.id, finance.id, "finance_staff")
    unlinked_client_hdrs = _headers(org.id, client_user.id, "retained_client")

    # Upload an unassigned org document (client_id=None)
    valid_pdf = _make_valid_pdf("Unassigned Internal Document")
    upload_res = client.post(
        "/api/v1/documents/upload",
        headers=admin_hdrs,
        data={"raw_only": "true"},
        files={"file": ("org_unassigned.pdf", valid_pdf, "application/pdf")},
    )
    assert upload_res.status_code == 201
    doc_id = uuid.UUID(upload_res.json()["id"])

    # Null-profile retained client MUST get [] instead of seeing unassigned org documents!
    res_null_list = client.get("/api/v1/documents", headers=unlinked_client_hdrs)
    assert res_null_list.status_code == 200
    assert res_null_list.json() == []

    # Add an extracted field to test field-edit RBAC
    field = DocumentExtractedField(
        document_id=doc_id,
        organization_id=org.id,
        field_name="passport_number",
        field_label="Passport Number",
        original_value="P123456",
        normalized_value="P123456",
        ocr_confidence=0.95,
        extraction_confidence=0.95,
    )
    db.add(field)
    db.commit()

    # RBAC checks: finance_staff blocked from purge, legal-hold, verify, and field edit
    assert client.post(f"/api/v1/documents/{doc_id}/purge", headers=finance_hdrs, json={"reason": "unauthorized_purge"}).status_code == 403
    assert client.post(f"/api/v1/documents/{doc_id}/legal-hold", headers=finance_hdrs, json={"reason": "unauthorized_hold"}).status_code == 403
    assert client.put(f"/api/v1/documents/{doc_id}/verify", headers=finance_hdrs, json={"status": "verified", "notes": "ok"}).status_code == 403
    assert client.put(
        f"/api/v1/documents/{doc_id}/fields/{field.id}",
        headers=finance_hdrs,
        json={"corrected_value": "P999999", "reason": "test"},
    ).status_code == 403

    # document_reviewer can verify, but CANNOT edit extracted fields or purge
    assert client.put(f"/api/v1/documents/{doc_id}/verify", headers=reviewer_hdrs, json={"status": "verified", "notes": "verified"}).status_code == 200
    assert client.put(
        f"/api/v1/documents/{doc_id}/fields/{field.id}",
        headers=reviewer_hdrs,
        json={"corrected_value": "P999999", "reason": "test"},
    ).status_code == 403
    assert client.post(f"/api/v1/documents/{doc_id}/purge", headers=reviewer_hdrs, json={"reason": "unauthorized_purge"}).status_code == 403

    # Cross-client parent_document_id IDOR blocked
    client_a = User(id=uuid.uuid4(), email=f"ca-{uuid.uuid4().hex[:6]}@ex.com", full_name="Client A", status="active")
    client_b = User(id=uuid.uuid4(), email=f"cb-{uuid.uuid4().hex[:6]}@ex.com", full_name="Client B", status="active")
    db.add_all([client_a, client_b])
    db.flush()
    cp_a = ClientProfile(id=uuid.uuid4(), organization_id=org.id, user_id=client_a.id, first_name="A", last_name="One", email=client_a.email, nationality="India")
    cp_b = ClientProfile(id=uuid.uuid4(), organization_id=org.id, user_id=client_b.id, first_name="B", last_name="Two", email=client_b.email, nationality="India")
    db.add_all([cp_a, cp_b])
    db.commit()

    res_a_doc = client.post(
        "/api/v1/documents/upload",
        headers=_headers(org.id, client_a.id, "retained_client"),
        data={"client_id": str(cp_a.id), "raw_only": "true"},
        files={"file": ("a_passport.pdf", valid_pdf, "application/pdf")},
    )
    assert res_a_doc.status_code == 201
    doc_a_id = res_a_doc.json()["id"]

    res_idor_version = client.post(
        "/api/v1/documents/upload",
        headers=_headers(org.id, client_b.id, "retained_client"),
        data={"client_id": str(cp_b.id), "parent_document_id": doc_a_id, "raw_only": "true"},
        files={"file": ("hijack.pdf", valid_pdf, "application/pdf")},
    )
    assert res_idor_version.status_code == 403

    # Download logs AuditEvent(action="document.downloaded") and verify_download_token enforces org_id
    dl_res = client.get(f"/api/v1/documents/{doc_id}/download", headers=admin_hdrs)
    assert dl_res.status_code == 200
    assert dl_res.content == valid_pdf
    dl_audit = (
        db.query(AuditEvent)
        .filter(
            AuditEvent.organization_id == org.id,
            AuditEvent.object_id == str(doc_id),
            AuditEvent.action == "document.downloaded",
        )
        .first()
    )
    assert dl_audit is not None

    tok_res = client.post(f"/api/v1/documents/{doc_id}/download-token", headers=admin_hdrs)
    assert tok_res.status_code == 200
    token = tok_res.json()["download_token"]
    assert verify_download_token(token, doc_id, expected_org_id=org.id) is not None
    with pytest.raises(PermissionDeniedError):
        verify_download_token(token, doc_id, expected_org_id=uuid.uuid4())


def test_processor_updates_corrected_field_in_place_and_propagates_errors(db):
    org, admin, *_ = _seed_org_and_users(db)
    storage = get_storage_backend()
    pdf_bytes = _make_valid_pdf("PASSPORT NUMBER: Z1122334\nSURNAME: PATEL\nGIVEN NAMES: AARAV")
    doc_id = uuid.uuid4()
    artifact = storage.store_file(org.id, doc_id, "v1_passport.pdf", pdf_bytes, "application/pdf")

    doc = Document(
        id=doc_id,
        organization_id=org.id,
        uploaded_by_user_id=admin.id,
        title="passport.pdf",
        filename="passport.pdf",
        category="identity_document",
        storage_path=artifact.storage_path,
        sha256_hash=artifact.sha256_hash,
        byte_size=len(pdf_bytes),
        mime_type="application/pdf",
        version=1,
        is_current_version=True,
        processing_status="uploaded",
        layout_metadata={"visibility": "private_to_firm", "is_private_to_firm": True},
    )
    db.add(doc)
    db.flush()

    # Seed a manually-corrected extracted field that matches what extractor produces
    manual_field = DocumentExtractedField(
        document_id=doc.id,
        organization_id=org.id,
        field_name="passport_number",
        field_label="Passport Number",
        original_value="OLD123",
        normalized_value="OLD123",
        corrected_value="ATTORNEY_VERIFIED_999",
        is_manually_corrected=True,
        ocr_confidence=0.9,
        extraction_confidence=0.9,
    )
    db.add(manual_field)
    db.commit()

    fake_extracted = [
        SimpleNamespace(
            field_name="passport_number",
            original_value="Z1122334",
            normalized_value="Z1122334",
            ocr_confidence=0.98,
            extraction_confidence=0.98,
            source_page=1,
            source_location={"page": 1},
            model_version="test-v1",
        )
    ]
    with patch("backend.app.documents.processor.extract_structured_fields", return_value=fake_extracted):
        process_document_pipeline(db, doc.id)

    db.refresh(doc)
    passport_fields = (
        db.query(DocumentExtractedField)
        .filter(DocumentExtractedField.document_id == doc.id, DocumentExtractedField.field_name == "passport_number")
        .all()
    )
    assert len(passport_fields) == 1, "Reprocessing must update manually-corrected field in-place without inserting duplicates"
    assert passport_fields[0].corrected_value == "ATTORNEY_VERIFIED_999"
    assert passport_fields[0].is_manually_corrected is True
    assert doc.layout_metadata.get("visibility") == "private_to_firm"

    # Unexpected failure must propagate so worker retry/DLQ can handle it
    with patch("backend.app.documents.processor.get_storage_backend") as mock_get_storage:
        mock_get_storage.return_value.read_file.side_effect = RuntimeError("Simulated storage outage")
        with pytest.raises(RuntimeError, match="Simulated storage outage"):
            process_document_pipeline(db, doc.id)
    db.refresh(doc)
    assert doc.processing_status == "failed"


def test_worker_pg_skip_locked_and_unknown_event_dead_letter(db):
    org, *_ = _seed_org_and_users(db)

    # Unrecognized event type must go to dead_letter, NEVER silently published
    unknown_evt = OutboxEvent(
        organization_id=org.id,
        event_type="unknown.unregistered.event",
        aggregate_type="document",
        aggregate_id=uuid.uuid4(),
        payload={"foo": "bar"},
        status="pending",
    )
    db.add(unknown_evt)
    db.commit()

    processed = process_outbox_batch(db, batch_size=10)
    assert processed == 0
    db.refresh(unknown_evt)
    assert unknown_evt.status == "dead_letter"
    assert "Unrecognized outbox event type" in (unknown_evt.error_message or "")

    # Verify PostgreSQL dialect enables FOR UPDATE SKIP LOCKED
    mock_pg_db = MagicMock()
    mock_pg_db.bind.dialect.name = "postgresql"
    mock_query = mock_pg_db.query.return_value.filter.return_value.order_by.return_value.limit.return_value
    mock_query.with_for_update.return_value.all.return_value = []
    process_outbox_batch(mock_pg_db, batch_size=5)
    mock_query.with_for_update.assert_called_once_with(skip_locked=True)


# ==============================================================================
# AREA 2: REAL UPLOADED PDFs IN FILING PACKAGE ZIP EXPORTS & HTML XSS ESCAPING
# ==============================================================================


def test_package_zip_embeds_real_decrypted_pdfs_valid_fitz_form_pdfs_and_escapes_xss(db):
    org, admin, *_ = _seed_org_and_users(db)
    cp = ClientProfile(
        id=uuid.uuid4(),
        organization_id=org.id,
        first_name="Priya",
        last_name="Sharma",
        email="priya@example.com",
        nationality="India",
    )
    xss_title = '<script>alert("xss")</script> Canada Study Permit'
    case = ImmigrationCase(
        id=uuid.uuid4(),
        organization_id=org.id,
        client_id=cp.id,
        case_number="CA-2026-XSS-001",
        title=xss_title,
        jurisdiction="CA",
        visa_category="CA_STUDY_PERMIT",
        status="review",
    )
    db.add_all([cp, case])
    db.flush()

    # Store real PDF encrypted on disk via LocalDocumentStorage
    storage = get_storage_backend()
    uploaded_pdf_bytes = _make_valid_pdf("Official University Letter of Acceptance - Toronto")
    doc_id = uuid.uuid4()
    artifact = storage.store_file(org.id, doc_id, "v1_loa.pdf", uploaded_pdf_bytes, "application/pdf")

    doc = Document(
        id=doc_id,
        organization_id=org.id,
        case_id=case.id,
        client_id=cp.id,
        uploaded_by_user_id=admin.id,
        title="University LOA",
        filename="university_loa.pdf",
        category="educational_credential",
        storage_path=artifact.storage_path,
        sha256_hash=artifact.sha256_hash,
        byte_size=len(uploaded_pdf_bytes),
        mime_type="application/pdf",
        page_count=1,
        version=1,
        is_current_version=True,
        malware_scan_status="clean",
        processing_status="completed",
        verification_status="verified",
    )

    schema = FormSchema(
        id=uuid.uuid4(),
        organization_id=org.id,
        form_code="IMM1294",
        name="Application for Study Permit Made Outside of Canada",
        jurisdiction="CA",
        pathway="CA_STUDY_PERMIT",
        status="active",
    )
    schema_ver = FormSchemaVersion(
        id=uuid.uuid4(),
        schema_id=schema.id,
        version_number="2026-01",
        is_active=True,
        schema_json={"fields": []},
    )
    form_sub = FormSubmission(
        id=uuid.uuid4(),
        organization_id=org.id,
        case_id=case.id,
        form_schema_version_id=schema_ver.id,
        revision_number=1,
        status="approved",
        answers_json={"applicant_surname": "Sharma", "dli_number": "O19332746152"},
    )
    db.add_all([doc, schema, schema_ver, form_sub])
    db.commit()

    pkg = PackageBuilderService.build_filing_package(
        db=db,
        organization_id=org.id,
        case_id=case.id,
        name="Canada Study Permit v1",
        user_id=admin.id,
        override_notes='<img src=x onerror="alert(2)">',
    )
    manifest = pkg.manifest_json
    items = manifest["items"]

    doc_item = next(i for i in items if i.get("document_id") == str(doc.id))
    assert doc_item["storage_path"] == artifact.storage_path

    form_item = next(i for i in items if i.get("form_submission_id") == str(form_sub.id))
    assert form_item["page_count"] is None, "Must NOT fabricate page_count=8 on form stub"
    assert form_item["file_size"] is None, "Must NOT fabricate '2.4 MB' on form stub"
    assert form_item["form_answers"]["dli_number"] == "O19332746152"

    # Build ZIP archive (without passing binary_content directly -> must resolve from encrypted storage + fitz)
    zip_bytes, archive_manifest = build_package_local_zip_archive(
        case_reference=case.case_number,
        package_name=pkg.name,
        package_template_version="v1",
        checklist_rule_version="2026.1",
        folder_structure=manifest["folders"],
        document_entries=items,
        excluded_entries=[],
        generated_by=str(admin.id),
        case_title=case.title,
        jurisdiction=case.jurisdiction,
        notes='<script>evil()</script>',
    )

    with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as zf:
        pdf_names = [n for n in zf.namelist() if n.lower().endswith(".pdf")]
        assert len(pdf_names) >= 2
        found_uploaded = False
        for pdf_name in pdf_names:
            raw = zf.read(pdf_name)
            assert raw.startswith(b"%PDF-"), f"ZIP entry {pdf_name} is not a valid PDF!"
            opened = fitz.open(stream=raw, filetype="pdf")
            assert opened.page_count >= 1
            opened.close()
            if "university_loa" in pdf_name.lower():
                assert raw == uploaded_pdf_bytes
                found_uploaded = True
        assert found_uploaded, "Real uploaded PDF must be embedded verbatim after decrypting from storage"

    # Verify HTML report escapes XSS vectors
    html_report_bytes = generate_word_compatible_html_report(
        manifest={
            "case_reference": case.case_number,
            "package_name": '<b>Study</b><script>bad()</script>',
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "generated_by": str(admin.id),
            "package_template_version": "v1",
            "checklist_rule_version": "2026.1",
            "documents": [
                {
                    "relative_path": "<script>p()</script>.pdf",
                    "document_version_id": "v1",
                    "sha256": "abc",
                    "review_status": "HUMAN_VERIFIED",
                }
            ],
            "exclusions": [],
        },
        case_title=xss_title,
        jurisdiction="CA",
        notes='<script>note_xss()</script>',
    )
    html_report = html_report_bytes.decode("utf-8")
    assert "<script>" not in html_report
    assert "&lt;script&gt;" in html_report


# ==============================================================================
# AREA 3: BILLING CRASH FIX, STRIPE WEBHOOK, DECIMAL/TAX/MULTI-CURRENCY & EMAIL
# ==============================================================================


def test_billing_client_invoices_no_nameerror_and_stripe_webhook_hardening(client, db):
    org, admin, _rev, _fin, client_user = _seed_org_and_users(db)
    cp = ClientProfile(
        id=uuid.uuid4(),
        organization_id=org.id,
        user_id=client_user.id,
        first_name="Aarav",
        last_name="Patel",
        email=client_user.email,
        nationality="India",
    )
    db.add(cp)
    db.commit()

    inv = BillingService.create_invoice(
        db=db,
        organization_id=org.id,
        client_id=cp.id,
        data={
            "currency": "USD",
            "jurisdiction": "US",
            "line_items": [{"description": "H-1B Legal Retainer", "quantity": 1, "unit_price": 2500.00}],
        },
        actor_id=admin.id,
    )

    # 1. GET /api/v1/billing/client-invoices must return 200 (no 500 NameError for ClientProfile!)
    res_client_invs = client.get(
        "/api/v1/billing/client-invoices",
        headers=_headers(org.id, client_user.id, "retained_client"),
    )
    assert res_client_invs.status_code == 200, res_client_invs.text
    assert any(row["id"] == str(inv.id) for row in res_client_invs.json())

    # 2. Hardened Stripe webhook verification
    secret = "whsec_test_strict_secret_987654321"
    now_ts = int(time.time())
    event_payload = {
        "id": "evt_test_001",
        "type": "payment_intent.succeeded",
        "data": {
            "object": {
                "id": "pi_live_real_001",
                "amount_received": 250000,
                "currency": "usd",
                "metadata": {"invoice_id": str(inv.id), "organization_id": str(org.id)},
            }
        },
    }
    raw_body = json.dumps(event_payload).encode("utf-8")

    def _sign(ts: int, body: bytes) -> str:
        return hmac.new(secret.encode("utf-8"), f"{ts}.".encode("utf-8") + body, hashlib.sha256).hexdigest()

    fake_settings = SimpleNamespace(environment="production", stripe_webhook_secret=secret)
    with patch("backend.app.api.v1.billing.get_settings", return_value=fake_settings):
        # Missing signature -> 400
        res_missing = client.post("/api/v1/billing/webhooks/stripe", content=raw_body)
        assert res_missing.status_code == 400

        # Invalid signature -> 400
        res_bad = client.post(
            "/api/v1/billing/webhooks/stripe",
            content=raw_body,
            headers={"Stripe-Signature": f"t={now_ts},v1=deadbeef"},
        )
        assert res_bad.status_code == 400

        # Stale timestamp (>300s old) with valid HMAC -> 400 replay protection
        old_ts = now_ts - 600
        res_stale = client.post(
            "/api/v1/billing/webhooks/stripe",
            content=raw_body,
            headers={"Stripe-Signature": f"t={old_ts},v1={_sign(old_ts, raw_body)}"},
        )
        assert res_stale.status_code == 400
        assert "tolerance" in res_stale.text.lower() or "timestamp" in res_stale.text.lower()

        # Multiple v1= signatures where second is valid -> 200
        good_sig = _sign(now_ts, raw_body)
        multi_header = f"t={now_ts},v1=0000000000000000,v1={good_sig}"
        res_ok = client.post(
            "/api/v1/billing/webhooks/stripe",
            content=raw_body,
            headers={"Stripe-Signature": multi_header},
        )
        assert res_ok.status_code == 200, res_ok.text
        db.refresh(inv)
        assert inv.paid_amount == 2500.0
        assert inv.status == "paid"

        # Replay of identical event/charge -> idempotent duplicate_ignored, NO double credit!
        res_dup = client.post(
            "/api/v1/billing/webhooks/stripe",
            content=raw_body,
            headers={"Stripe-Signature": f"t={now_ts},v1={good_sig}"},
        )
        assert res_dup.status_code == 200
        assert res_dup.json()["status"] == "duplicate_ignored"
        db.refresh(inv)
        assert inv.paid_amount == 2500.0

        # charge.refunded -> calls BillingService.process_refund and updates payment/invoice
        refund_payload = {
            "id": "evt_refund_001",
            "type": "charge.refunded",
            "data": {
                "object": {
                    "id": "ch_ref_001",
                    "payment_intent": "pi_live_real_001",
                    "amount_refunded": 250000,
                    "metadata": {"invoice_id": str(inv.id), "organization_id": str(org.id)},
                }
            },
        }
        refund_body = json.dumps(refund_payload).encode("utf-8")
        res_ref = client.post(
            "/api/v1/billing/webhooks/stripe",
            content=refund_body,
            headers={"Stripe-Signature": f"t={now_ts},v1={_sign(now_ts, refund_body)}"},
        )
        assert res_ref.status_code == 200, res_ref.text
        assert res_ref.json()["status"] in ("processed", "refund_reconciled")
        db.refresh(inv)
        assert inv.paid_amount == 0.0
        assert inv.status == "refunded"


def test_billing_decimal_tax_jurisdictions_stripe_vs_manual_no_sds_and_multicurrency(db):
    org, admin, *_ = _seed_org_and_users(db)
    cp = ClientProfile(
        id=uuid.uuid4(),
        organization_id=org.id,
        first_name="Liam",
        last_name="Chen",
        email="liam@example.com",
        nationality="Canada",
    )
    db.add(cp)
    db.commit()

    # 1. Seeded services have NO abolished "SDS" and NO Indian SAC 998311 on CA/US/UK/AU services
    services = BillingService.seed_default_services(db, org.id)
    ca_student = next(s for s in services if s.code == "CA_STUDENT_PERMIT")
    assert "sds" not in (ca_student.description or "").lower()
    assert "pal" in (ca_student.description or "").lower()
    for svc in services:
        if svc.jurisdiction != "IN":
            assert svc.sac_code == "", f"Non-Indian service {svc.code} must not carry Indian SAC code"

    # 2. Jurisdiction-aware tax with Decimal accuracy (no Indian 18% GST on non-IN currencies)
    ca_on = BillingService.calculate_tax(Decimal("1000.00"), jurisdiction="CA", currency="CAD", place_of_supply="ON")
    assert ca_on["tax_amount"] == 130.0
    assert ca_on["sac_code"] == ""

    uk_vat = BillingService.calculate_tax(Decimal("1000.00"), jurisdiction="GB", currency="GBP")
    assert uk_vat["tax_amount"] == 200.0
    assert uk_vat["sac_code"] == ""

    au_gst = BillingService.calculate_tax(Decimal("1000.00"), jurisdiction="AU", currency="AUD")
    assert au_gst["tax_amount"] == 100.0
    assert au_gst["sac_code"] == ""

    us_tax = BillingService.calculate_tax(Decimal("1000.00"), jurisdiction="US", currency="USD")
    assert us_tax["tax_amount"] == 0.0
    assert us_tax["sac_code"] == ""

    in_gst = BillingService.calculate_tax(Decimal("1000.00"), jurisdiction="IN", currency="INR", is_interstate=False)
    assert in_gst["cgst_amount"] == 90.0
    assert in_gst["sgst_amount"] == 90.0
    assert in_gst["tax_amount"] == 180.0
    assert in_gst["sac_code"] == "998311"

    # 3. Create multi-currency invoices & verify collision-free numbers + manual ledger vs Stripe API
    inv_usd = BillingService.create_invoice(
        db, org.id, cp.id,
        {"currency": "USD", "jurisdiction": "US", "line_items": [{"description": "US Legal", "quantity": 1, "unit_price": 100.00}]},
        actor_id=admin.id,
    )
    inv_cad = BillingService.create_invoice(
        db, org.id, cp.id,
        {"currency": "CAD", "jurisdiction": "CA", "place_of_supply": "ON", "line_items": [{"description": "CA Legal", "quantity": 1, "unit_price": 200.00}]},
        actor_id=admin.id,
    )
    assert inv_usd.invoice_number != inv_cad.invoice_number
    assert inv_usd.sac_code == ""
    assert inv_cad.tax_amount == 26.0

    # Without STRIPE_SECRET_KEY -> honest manual_ledger with NO fake 4242 or tok_visa
    with patch.dict(os.environ, {"STRIPE_SECRET_KEY": ""}, clear=False):
        pay_manual = BillingService.record_payment(
            db, org.id, inv_usd.id, {"amount": 100.00, "payment_method": "card"}, actor_id=admin.id
        )
        assert pay_manual.payment_method == "manual_ledger"
        assert pay_manual.card_last4 is None
        assert pay_manual.card_brand is None
        assert pay_manual.provider_charge_id is None

    # With STRIPE_SECRET_KEY -> executes real Stripe API call via httpx.post
    fake_stripe_resp = MagicMock(status_code=200)
    fake_stripe_resp.json.return_value = {"id": "pi_real_live_999", "latest_charge": "ch_real_live_999"}
    with patch.dict(os.environ, {"STRIPE_SECRET_KEY": "sk_test_real_key"}, clear=False), patch(
        "backend.app.billing.service.httpx.post", return_value=fake_stripe_resp
    ) as mock_post:
        pay_stripe = BillingService.record_payment(
            db, org.id, inv_cad.id, {"amount": 226.00, "payment_method": "card"}, actor_id=admin.id
        )
        assert mock_post.called
        assert pay_stripe.payment_method in ("card", "stripe")
        assert pay_stripe.provider_charge_id == "ch_real_live_999"

    # 4. Financial report breaks down multi-currency cleanly instead of summing CAD+USD into "USD"
    report = BillingService.get_financial_reports(db, org.id)
    assert report["summary"]["currency"] == "MULTI"
    assert report["summary"]["is_multi_currency"] is True
    assert "USD" in report["totals_by_currency"]
    assert "CAD" in report["totals_by_currency"]
    assert report["totals_by_currency"]["USD"]["total_collected"] == 100.0
    assert report["totals_by_currency"]["CAD"]["total_collected"] == 226.0


def test_notifications_resend_smtp_and_honest_prod_pending_status(db):
    org, admin, *_ = _seed_org_and_users(db)

    # 1. Production with no email provider -> pending_provider_config (NEVER fake "sent"!)
    prod_settings = SimpleNamespace(environment="production")
    with patch("backend.app.notifications.service.get_settings", return_value=prod_settings), patch.dict(
        os.environ, {"RESEND_API_KEY": "", "SMTP_HOST": ""}, clear=False
    ):
        n_prod = NotificationService.create_notification(
            db, org.id, admin.id, "Deadline Reminder", "Your case has an update", "deadline", channel="email"
        )
        assert n_prod.delivery_status == "pending_provider_config"

    # 2. Resend API transport
    fake_resend_resp = MagicMock(status_code=200, content=b'{"id":"re_12345"}')
    fake_resend_resp.json.return_value = {"id": "re_12345"}
    with patch.dict(os.environ, {"RESEND_API_KEY": "re_live_key", "SMTP_HOST": ""}, clear=False), patch(
        "backend.app.notifications.service.httpx.post", return_value=fake_resend_resp
    ) as mock_resend:
        n_resend = NotificationService.create_notification(
            db, org.id, admin.id, "Invoice Ready", "Please review your invoice", "billing", channel="email"
        )
        assert mock_resend.called
        assert n_resend.delivery_status == "sent"
        assert n_resend.metadata_json.get("email_provider") == "resend"
        assert n_resend.metadata_json.get("provider_receipt_id") == "re_12345"

    # 3. SMTP transport
    mock_smtp_ctx = MagicMock()
    with patch.dict(
        os.environ,
        {"RESEND_API_KEY": "", "SMTP_HOST": "smtp.example.com", "SMTP_PORT": "587", "SMTP_USER": "mailer", "SMTP_PASSWORD": "pw"},
        clear=False,
    ), patch("backend.app.notifications.service.smtplib.SMTP", return_value=mock_smtp_ctx) as mock_smtp:
        n_smtp = NotificationService.create_notification(
            db, org.id, admin.id, "Case Update", "Your filing package is ready", "package", channel="email"
        )
        assert mock_smtp.called
        assert mock_smtp_ctx.__enter__.return_value.send_message.called
        assert n_smtp.delivery_status == "sent"
        assert n_smtp.metadata_json.get("email_provider") == "smtp"


# ==============================================================================
# AREA 4: COMPLIANCE HONESTY & SCENARIO SERVICE CRASH/EXPORT FIXES
# ==============================================================================


def test_compliance_honesty_release_gates_privacy_backup_scenarios_and_data_flow(db):
    org, admin, *_ = _seed_org_and_users(db)

    # 1. Privacy reviews default to pending_counsel_review (NOT fabricated "approved")
    reviews = ensure_privacy_reviews_seeded(db)
    assert len(reviews) == 4
    assert all(r.review_status == "pending_counsel_review" for r in reviews)
    status_list = get_all_privacy_reviews(db)
    assert all(item["is_valid"] is False for item in status_list)

    # 2. Release gates honestly report PENDING / BLOCKED when prerequisites aren't met
    gate_eval = ReleaseGateService.evaluate_gates(db, org.id, evaluated_by=admin)
    assert gate_eval.overall_status == "BLOCKED"
    gate_map = {g["gate_number"]: g for g in gate_eval.gates_json["gates"]}
    assert gate_map[3]["status"] == "PENDING"
    assert gate_map[6]["status"] == "BLOCKED"
    assert gate_map[7]["status"] == "PENDING"

    # 3. Backup drill and key rotation drill report honest dry_run_verification
    drill = BackupAndDrillService.execute_backup_restore_drill(db, org.id, admin.id)
    assert drill["status"] == "dry_run_verification"
    assert drill["is_dry_run"] is True
    assert drill["live_pitr_restore_executed"] is False
    assert drill["measured_rpo_minutes"] is None
    assert drill["measured_rto_minutes"] is None

    key_drill = BackupAndDrillService.simulate_key_rotation(db, org.id, admin.id)
    assert key_drill["status"] == "dry_run_verification"
    assert key_drill["is_dry_run"] is True
    assert key_drill["kms_key_rotated"] is False

    # 4. ScenarioService: withdrawal uses FilingPackage.version_number/package_hash & ClientProfile.phone without AttributeError
    cp = ClientProfile(
        id=uuid.uuid4(),
        organization_id=org.id,
        first_name="Maya",
        last_name="Rao",
        email="maya@example.com",
        phone="+1-555-0199",
        nationality="India",
    )
    case = ImmigrationCase(
        id=uuid.uuid4(),
        organization_id=org.id,
        client_id=cp.id,
        case_number="US-2026-WDR-01",
        title="H-1B Petition",
        jurisdiction="US",
        visa_category="US_H1B_SPECIALTY",
        status="review",
    )
    pkg = FilingPackage(
        id=uuid.uuid4(),
        organization_id=org.id,
        case_id=case.id,
        name="H-1B Petition Package v2",
        version_number=2,
        status="draft",
        package_hash="a" * 64,
        manifest_json={},
    )
    db.add_all([cp, case, pkg])
    db.commit()

    withdrawal = ScenarioService.execute_case_withdrawal(
        db=db,
        organization_id=org.id,
        case_id=case.id,
        actor_id=admin.id,
        reason="Client withdrew representation",
    )
    assert withdrawal.case_id == case.id
    assert withdrawal.client_contact_phone == "+1-555-0199"
    assert withdrawal.pre_withdrawal_state_snapshot_json["packages_summary"][0]["root_hash"] == "a" * 64

    # 5. GDPR firm export generates real .tar.gz in storage with genuine SHA-256 and exact byte size
    export_req = ScenarioService.request_firm_export(db, org.id, admin.id, export_type="self_service")
    assert export_req.status == "completed"
    storage = get_storage_backend()
    archive_bytes, actual_hash = storage.read_file(export_req.archive_url, expected_hash=export_req.archive_sha256)
    assert len(archive_bytes) == export_req.archive_size_bytes
    assert actual_hash == export_req.archive_sha256

    with tarfile.open(fileobj=io.BytesIO(archive_bytes), mode="r:gz") as tf:
        names = set(tf.getnames())
        assert {"manifest.json", "cases.json", "clients.json", "audit_events.json"}.issubset(names)
        clients_json = json.loads(tf.extractfile("clients.json").read().decode("utf-8"))
        assert clients_json[0]["phone"] == "+1-555-0199"

    # 6. Data flow register reflects real encryption & audit posture
    reg = get_data_flow_register()
    assert "AES-256-GCM" in reg["storage_encryption_standard"]
    assert "SSE-KMS" in reg["storage_encryption_standard"]
    assert "PostgreSQL" in reg["audit_store"]


# ==============================================================================
# AREA 5: 2026 STATUTORY RULE PACKS, CASE CONTEXT FLAGS & RULES API IDOR CLOSURE
# ==============================================================================


def test_2026_statutory_rule_packs_and_case_context_flags(db):
    org, admin, *_ = _seed_org_and_users(db)
    seed_production_rule_packs(db, org.id, admin.id)

    all_reqs = db.query(RuleRequirement).filter(RuleRequirement.organization_id == org.id).all()
    by_code = {r.code: r for r in all_reqs}

    # 1. Canada Study Permit: $23,448 CAD (NO stale $20,635)
    ca_sp_funds = by_code["CA-STU-FUNDS-003"]
    combined_sp = f"{ca_sp_funds.title} {ca_sp_funds.description} {ca_sp_funds.review_guidance or ''}"
    assert "23,448" in combined_sp
    assert "20,635" not in combined_sp

    # 2. Canada PGWP: Nov 1, 2024 mandatory language (CLB 7 / CLB 5) & CIP field-of-study
    assert "CA-PGWP-LANG-003" in by_code
    pgwp_lang = by_code["CA-PGWP-LANG-003"]
    assert "CLB/NCLC 7" in pgwp_lang.description and "CLB/NCLC 5" in pgwp_lang.description
    assert "CA-PGWP-CIP-004" in by_code
    assert "CIP" in by_code["CA-PGWP-CIP-004"].title or "CIP" in by_code["CA-PGWP-CIP-004"].description

    # 3. Canada FSW: PTE Core recognized
    ca_fsw_lang = by_code["CA-FSW-LANG-002"]
    assert "PTE Core" in f"{ca_fsw_lang.description} {ca_fsw_lang.review_guidance or ''}"

    # 4. UK Skilled Worker: £41,700 + CEFR B2
    uk_cos = by_code["GB-SW-COS-001"]
    assert "41,700" in f"{uk_cos.description} {uk_cos.review_guidance or ''}"
    uk_lang = by_code["GB-SW-LANG-002"]
    assert uk_lang.requirement_key == "language.english_b2_cefr"
    assert "B2" in uk_lang.title

    # 5. Germany EU Blue Card: €50,700 general / €45,934.20 shortage
    de_contract = by_code["DE-BC-CONTRACT-002"]
    de_text = f"{de_contract.description} {de_contract.review_guidance or ''}"
    assert "50,700" in de_text
    assert "45,934.20" in de_text

    # 6. Australia Subclass 482: Skills in Demand (SID) with 1 year work experience
    au_set = (
        db.query(RuleSet)
        .filter(RuleSet.organization_id == org.id, RuleSet.jurisdiction == "AU", RuleSet.program_pathway.contains("482"))
        .first()
    )
    assert au_set is not None
    assert "Skills in Demand" in au_set.name or "SID" in au_set.name or "Skills in Demand" in (au_set.description or "")
    au_exp = by_code["AU-482-EXP-002"]
    assert au_exp.requirement_key == "skills.one_year_work_experience"
    assert "1 year" in au_exp.title.lower() or "1 year" in au_exp.description.lower()

    # 7. US I-485 Medical I-693: June 2025 single pending I-485 validity scope
    us_med = by_code["US-I485-MED-003"]
    us_med_text = f"{us_med.description} {us_med.review_guidance or ''}"
    assert "June 2025" in us_med_text
    assert "single" in us_med_text.lower()

    # 8. rule_engine.build_case_context populates statutory exemption flags
    cp = ClientProfile(id=uuid.uuid4(), organization_id=org.id, first_name="Karan", last_name="Gill", email="k@ex.com", nationality="India")
    case = ImmigrationCase(
        id=uuid.uuid4(),
        organization_id=org.id,
        client_id=cp.id,
        case_number="CA-FSW-CTX-1",
        title="Master of Computer Science Express Entry",
        jurisdiction="CA",
        visa_category="CA_EXPRESS_ENTRY_FSW",
        status="intake",
    )
    doc_edu = Document(
        id=uuid.uuid4(),
        organization_id=org.id,
        case_id=case.id,
        uploaded_by_user_id=admin.id,
        title="University of Toronto Master Degree",
        filename="uoft_degree.pdf",
        category="educational_credential",
        storage_path="/tmp/fake",
        sha256_hash="0" * 64,
        byte_size=10,
        mime_type="application/pdf",
    )
    doc_job = Document(
        id=uuid.uuid4(),
        organization_id=org.id,
        case_id=case.id,
        uploaded_by_user_id=admin.id,
        title="LMIA Job Offer",
        filename="lmia.pdf",
        category="employment_records",
        storage_path="/tmp/fake2",
        sha256_hash="1" * 64,
        byte_size=10,
        mime_type="application/pdf",
    )
    db.add_all([cp, case, doc_edu, doc_job])
    db.flush()
    db.add_all(
        [
            DocumentExtractedField(
                document_id=doc_edu.id,
                organization_id=org.id,
                field_name="institution_country",
                field_label="Institution Country",
                original_value="Canada",
                normalized_value="Canada",
                ocr_confidence=0.99,
                extraction_confidence=0.99,
            ),
            DocumentExtractedField(
                document_id=doc_edu.id,
                organization_id=org.id,
                field_name="degree_title",
                field_label="Degree Title",
                original_value="Master of Science",
                normalized_value="Master of Science",
                ocr_confidence=0.99,
                extraction_confidence=0.99,
            ),
            DocumentExtractedField(
                document_id=doc_job.id,
                organization_id=org.id,
                field_name="lmia_number",
                field_label="LMIA Number",
                original_value="LMIA-8844221",
                normalized_value="LMIA-8844221",
                ocr_confidence=0.99,
                extraction_confidence=0.99,
            ),
        ]
    )
    db.commit()

    ctx = build_case_context(case, documents=[doc_edu, doc_job])
    assert ctx["applicant"]["has_canadian_degree"] is True
    assert ctx["applicant"]["has_valid_canadian_job_offer"] is True
    assert ctx["applicant"]["is_master_or_phd"] is True


def test_rules_api_closes_snapshot_and_case_evaluation_idors(client, db):
    org1, admin1, _r1, _f1, client1 = _seed_org_and_users(db)
    org2, admin2, *_ = _seed_org_and_users(db)
    seed_production_rule_packs(db, org1.id, admin1.id)

    # Create source & snapshot in org1 and org2
    src1 = OfficialSource(
        id=uuid.uuid4(),
        organization_id=org1.id,
        jurisdiction="CA",
        authority="IRCC Org1",
        title="IRCC Org1 Guidance",
        url="https://canada.ca/1",
        scope_limitations="Org1 test scope",
    )
    src2 = OfficialSource(
        id=uuid.uuid4(),
        organization_id=org2.id,
        jurisdiction="CA",
        authority="IRCC Org2",
        title="IRCC Org2 Guidance",
        url="https://canada.ca/2",
        scope_limitations="Org2 test scope",
    )
    db.add_all([src1, src2])
    db.flush()

    snap1 = SourceSnapshot(
        id=uuid.uuid4(),
        organization_id=org1.id,
        source_id=src1.id,
        content_hash="a" * 64,
        raw_content="v1",
        retrieval_timestamp=datetime.now(timezone.utc),
    )
    snap2_other_org = SourceSnapshot(
        id=uuid.uuid4(),
        organization_id=org2.id,
        source_id=src2.id,
        content_hash="b" * 64,
        raw_content="v2 secret org2",
        retrieval_timestamp=datetime.now(timezone.utc),
    )
    db.add_all([snap1, snap2_other_org])

    # Create a case for another client in org1
    other_cp = ClientProfile(
        id=uuid.uuid4(),
        organization_id=org1.id,
        first_name="Other",
        last_name="Applicant",
        email="other@example.com",
        nationality="India",
    )
    other_case = ImmigrationCase(
        id=uuid.uuid4(),
        organization_id=org1.id,
        client_id=other_cp.id,
        case_number="CA-IDOR-999",
        title="Private Case",
        jurisdiction="CA",
        visa_category="CA_STUDY_PERMIT",
        status="intake",
    )
    db.add_all([other_cp, other_case])
    db.commit()

    # 1. Cross-tenant snapshot compare must be blocked (404)
    cmp_res = client.get(
        f"/api/v1/rules/sources/{src1.id}/snapshots/compare?from_id={snap1.id}&to_id={snap2_other_org.id}",
        headers=_headers(org1.id, admin1.id, "company_admin"),
    )
    assert cmp_res.status_code == 404

    # 2. Retained client blocked from evaluating another client's case or pinning checklist
    client1_hdrs = _headers(org1.id, client1.id, "retained_client")
    eval_res = client.post(
        f"/api/v1/rules/cases/{other_case.id}/evaluate",
        headers=client1_hdrs,
        json={},
    )
    assert eval_res.status_code == 403

    gen_res = client.post(
        "/api/v1/rules/generate-checklist",
        headers=client1_hdrs,
        json={
            "jurisdiction": "CA",
            "pathway": "CA_STUDY_PERMIT",
            "case_id": str(other_case.id),
            "pin_to_case": True,
        },
    )
    assert gen_res.status_code == 403

    # 3. Retained client blocked from viewing another client's evaluations or pinned checklist
    list_eval_res = client.get(f"/api/v1/rules/cases/{other_case.id}/evaluations", headers=client1_hdrs)
    assert list_eval_res.status_code == 403

    pin_res = client.get(f"/api/v1/rules/cases/{other_case.id}/pinned-checklist", headers=client1_hdrs)
    assert pin_res.status_code == 403
