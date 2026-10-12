"""Database Backup, Integrity Checksumming, and Disaster Restoration Utility.

Supports:
- Point-in-time table snapshot generation with SHA-256 integrity hashing
- Checksum validation to detect backup corruption or tampering
- Safe restoration into a target database with foreign key ordering
- Automated disaster recovery verification
"""
import os
import sys
import json
import hashlib
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List
from sqlalchemy import create_engine, inspect, MetaData, Table, text


def compute_file_sha256(filepath: str) -> str:
    """Computes SHA-256 checksum of a file."""
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


class BackupManager:
    @classmethod
    def create_backup(cls, db_url: Any, output_file: str) -> Dict[str, Any]:
        """Creates a snapshot of all tables with data and checksum."""
        if hasattr(db_url, "connect"):
            engine = db_url
            should_dispose = False
        else:
            engine = create_engine(str(db_url))
            should_dispose = True

        inspector = inspect(engine)
        table_names = inspector.get_table_names()

        backup_payload: Dict[str, Any] = {
            "version": "1.0.0",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "source_db_type": engine.dialect.name,
            "tables": {},
            "record_counts": {},
        }

        with engine.connect() as conn:
            for table in table_names:
                if table.startswith("alembic_"):
                    continue
                result = conn.execute(text(f"SELECT * FROM {table}")).fetchall()
                # Get column names
                columns = [col["name"] for col in inspector.get_columns(table)]
                records = []
                for row in result:
                    row_dict = {}
                    for col_name, val in zip(columns, row):
                        if isinstance(val, (datetime, uuid.UUID)):
                            row_dict[col_name] = str(val)
                        elif isinstance(val, bytes):
                            row_dict[col_name] = val.hex()
                        else:
                            row_dict[col_name] = val
                    records.append(row_dict)

                backup_payload["tables"][table] = records
                backup_payload["record_counts"][table] = len(records)

        # Write data file
        os.makedirs(os.path.dirname(os.path.abspath(output_file)), exist_ok=True)
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(backup_payload, f, indent=2)

        # Compute SHA-256 checksum
        checksum = compute_file_sha256(output_file)
        checksum_file = f"{output_file}.sha256"
        with open(checksum_file, "w", encoding="utf-8") as f:
            f.write(checksum)

        if should_dispose:
            engine.dispose()
        return {
            "output_file": output_file,
            "checksum_file": checksum_file,
            "sha256": checksum,
            "tables_backed_up": len(backup_payload["tables"]),
            "total_records": sum(backup_payload["record_counts"].values()),
        }

    @classmethod
    def verify_integrity(cls, backup_file: str) -> bool:
        """Verifies that the backup file matches its companion SHA-256 checksum file."""
        checksum_file = f"{backup_file}.sha256"
        if not os.path.exists(backup_file) or not os.path.exists(checksum_file):
            return False

        with open(checksum_file, "r", encoding="utf-8") as f:
            expected_checksum = f.read().strip()

        actual_checksum = compute_file_sha256(backup_file)
        return expected_checksum == actual_checksum

    @classmethod
    def restore_backup(cls, db_url: Any, backup_file: str) -> Dict[str, Any]:
        """Restores a validated backup snapshot into a target database."""
        if not cls.verify_integrity(backup_file):
            raise ValueError(f"Integrity check failed: Backup file {backup_file} is corrupt or untrusted!")

        with open(backup_file, "r", encoding="utf-8") as f:
            payload = json.load(f)

        if hasattr(db_url, "connect"):
            engine = db_url
            should_dispose = False
        else:
            engine = create_engine(str(db_url))
            should_dispose = True

        tables_data = payload.get("tables", {})
        restored_counts: Dict[str, int] = {}

        from backend.app.domain.models import Base
        sorted_tables = Base.metadata.sorted_tables

        with engine.begin() as conn:
            for table in sorted_tables:
                name = table.name
                if name in tables_data and tables_data[name]:
                    records = tables_data[name]
                    col_map = {col.name: col for col in table.columns}
                    parsed_records = []
                    for rec in records:
                        parsed_rec = {}
                        for k, v in rec.items():
                            if k not in col_map or v is None:
                                parsed_rec[k] = v
                                continue
                            col_type = str(col_map[k].type).lower()
                            if "uuid" in col_type:
                                parsed_rec[k] = uuid.UUID(v)
                            elif "datetime" in col_type:
                                parsed_rec[k] = datetime.fromisoformat(v)
                            else:
                                parsed_rec[k] = v
                        parsed_records.append(parsed_rec)

                    conn.execute(table.insert(), parsed_records)
                    restored_counts[name] = len(parsed_records)

        if should_dispose:
            engine.dispose()
        return {
            "restored_tables": len(restored_counts),
            "restored_record_counts": restored_counts,
            "total_records_restored": sum(restored_counts.values()),
            "status": "success",
        }


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python backup_restore.py [backup|restore|verify] [database_url] [filepath]")
        sys.exit(1)

    action = sys.argv[1]
    if action == "backup":
        res = BackupManager.create_backup(sys.argv[2], sys.argv[3])
        print(f"Backup created: {res}")
    elif action == "restore":
        res = BackupManager.restore_backup(sys.argv[2], sys.argv[3])
        print(f"Restoration complete: {res}")
    elif action == "verify":
        valid = BackupManager.verify_integrity(sys.argv[2])
        print(f"Integrity verified: {valid}")
