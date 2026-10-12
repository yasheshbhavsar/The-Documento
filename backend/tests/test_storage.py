import uuid
import pytest
from backend.app.documents.storage import (
    LocalDocumentStorage,
    ImmutableFileError,
    IntegrityVerificationError,
)

def test_document_storage_and_integrity(tmp_path):
    storage = LocalDocumentStorage(base_dir=tmp_path)
    org_id = uuid.uuid4()
    file_id = uuid.uuid4()
    sample_content = b"IMMIGRATION_EVIDENCE_PASSPORT_SAMPLE"

    # Store file
    artifact = storage.store_file(
        organization_id=org_id,
        file_id=file_id,
        filename="passport.pdf",
        content=sample_content,
        content_type="application/pdf",
    )
    assert artifact.organization_id == org_id
    assert artifact.file_id == file_id
    assert artifact.byte_size == len(sample_content)
    assert len(artifact.sha256_hash) == 64
    assert storage.exists(org_id, file_id, "passport.pdf")

    # Read and verify hash
    content, actual_hash = storage.read_file(org_id, file_id, "passport.pdf", expected_hash=artifact.sha256_hash)
    assert content == sample_content
    assert actual_hash == artifact.sha256_hash

def test_document_immutability(tmp_path):
    storage = LocalDocumentStorage(base_dir=tmp_path)
    org_id = uuid.uuid4()
    file_id = uuid.uuid4()
    
    # Store initial evidence
    storage.store_file(
        organization_id=org_id,
        file_id=file_id,
        filename="evidence.pdf",
        content=b"ORIGINAL_EVIDENCE",
    )

    # Attempting to overwrite with different content must raise ImmutableFileError
    with pytest.raises(ImmutableFileError):
        storage.store_file(
            organization_id=org_id,
            file_id=file_id,
            filename="evidence.pdf",
            content=b"MODIFIED_EVIDENCE",
        )

def test_cross_tenant_isolation(tmp_path):
    storage = LocalDocumentStorage(base_dir=tmp_path)
    org_1 = uuid.uuid4()
    org_2 = uuid.uuid4()
    file_id = uuid.uuid4()

    storage.store_file(
        organization_id=org_1,
        file_id=file_id,
        filename="bank_statement.pdf",
        content=b"CONFIDENTIAL_FINANCIALS",
    )

    # Org 2 attempting to read Org 1's document must fail with FileNotFoundError
    with pytest.raises(FileNotFoundError):
        storage.read_file(org_2, file_id, "bank_statement.pdf")

def test_integrity_hash_mismatch(tmp_path):
    storage = LocalDocumentStorage(base_dir=tmp_path)
    org_id = uuid.uuid4()
    file_id = uuid.uuid4()

    storage.store_file(
        organization_id=org_id,
        file_id=file_id,
        filename="degree.pdf",
        content=b"UNIVERSITY_DIPLOMA",
    )

    # Tampered expected hash raises IntegrityVerificationError
    with pytest.raises(IntegrityVerificationError):
        storage.read_file(org_id, file_id, "degree.pdf", expected_hash="0000000000000000000000000000000000000000000000000000000000000000")
