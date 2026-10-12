"""Tests for Phase 10 Disaster Recovery, Database Backup, and Checksum Restoration."""
import os
import uuid
from datetime import datetime, timezone
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.domain.models import Base, Organization, User, ImmigrationCase, ClientProfile
from backend.app.security.passwords import hash_password
from backend.scripts.backup_restore import BackupManager


def test_backup_and_restore_lifecycle(tmp_path):
    """Verifies that database snapshots can be created, checksummed, validated, and restored."""
    source_db_file = tmp_path / "source.db"
    target_db_file = tmp_path / "target.db"
    backup_file = str(tmp_path / "backup_snapshot.json")

    source_url = f"sqlite:///{source_db_file}"
    target_url = f"sqlite:///{target_db_file}"

    # 1. Initialize source database and populate with test entities
    source_engine = create_engine(source_url)
    Base.metadata.create_all(source_engine)

    now = datetime.now(timezone.utc)
    org_id = uuid.uuid4()
    with Session(source_engine) as session:
        org = Organization(id=org_id, name="Disaster Recovery Firm", slug=f"dr-{uuid.uuid4().hex[:6]}", created_at=now)
        session.add(org)

        user = User(
            id=uuid.uuid4(),
            email="dr_admin@firm.com",
            password_hash=hash_password("SecurePass123!"),
            full_name="DR Administrator",
            created_at=now,
        )
        session.add(user)
        session.flush()

        client = ClientProfile(
            id=uuid.uuid4(),
            organization_id=org_id,
            first_name="John",
            last_name="Beneficiary",
            email="john@dr.com",
            nationality="CAN",
            created_at=now,
        )
        session.add(client)
        session.flush()

        case = ImmigrationCase(
            id=uuid.uuid4(),
            organization_id=org_id,
            client_id=client.id,
            case_number="CASE-DR-999",
            title="O-1A Disaster Recovery Canary",
            jurisdiction="US",
            visa_category="O-1A",
            created_at=now,
        )
        session.add(case)
        session.commit()

    # 2. Execute Backup
    backup_meta = BackupManager.create_backup(source_url, backup_file)
    assert os.path.exists(backup_file)
    assert os.path.exists(backup_meta["checksum_file"])
    assert backup_meta["total_records"] >= 4

    # 3. Verify Cryptographic Integrity
    is_valid = BackupManager.verify_integrity(backup_file)
    assert is_valid is True

    # 4. Tamper / Corrupt Test
    corrupt_file = str(tmp_path / "corrupt_snapshot.json")
    with open(backup_file, "r") as f:
        content = f.read()
    # Write corrupted payload with same checksum file
    with open(corrupt_file, "w") as f:
        f.write(content + "\n{\"tampered\": true}")
    with open(f"{corrupt_file}.sha256", "w") as f:
        f.write(backup_meta["sha256"]) # Old checksum does not match new content

    is_corrupt_detected = BackupManager.verify_integrity(corrupt_file)
    assert is_corrupt_detected is False, "Tampered backup must fail integrity check!"

    # 5. Restore into clean target database
    target_engine = create_engine(target_url)
    Base.metadata.create_all(target_engine)

    restore_meta = BackupManager.restore_backup(target_url, backup_file)
    assert restore_meta["status"] == "success"
    assert restore_meta["total_records_restored"] >= 4

    # 6. Verify restored data
    with Session(target_engine) as session:
        restored_case = session.query(ImmigrationCase).filter_by(case_number="CASE-DR-999").first()
        assert restored_case is not None
        assert restored_case.title == "O-1A Disaster Recovery Canary"
        assert restored_case.organization_id == org_id

    source_engine.dispose()
    target_engine.dispose()
