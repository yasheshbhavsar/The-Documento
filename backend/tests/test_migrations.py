import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect
import os

def test_alembic_upgrade_and_downgrade(tmp_path):
    db_file = tmp_path / "test_migration.db"
    db_url = f"sqlite:///{db_file.as_posix()}"
    
    # Path to alembic.ini
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    ini_path = os.path.join(backend_dir, "alembic.ini")
    
    alembic_cfg = Config(ini_path)
    alembic_cfg.set_main_option("sqlalchemy.url", db_url)
    alembic_cfg.set_main_option("script_location", os.path.join(backend_dir, "alembic"))
    
    # Test upgrade head
    command.upgrade(alembic_cfg, "head")
    
    engine = create_engine(db_url)
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    expected_tables = {
        "organizations", "branches", "teams", "users", "organization_memberships",
        "roles", "permissions", "role_permissions", "membership_roles",
        "invitations", "sessions", "password_reset_tokens",
        "client_profiles", "immigration_cases", "case_assignments",
        "client_dependants", "client_consents", "case_milestones", "case_notes", "case_tasks",
        "documents", "document_upload_sessions", "document_extracted_fields",
        "document_processing_runs", "outbox_events",
        "audit_events", "notifications", "alembic_version"
    }
    assert expected_tables.issubset(set(tables)), f"Missing tables: {expected_tables - set(tables)}"
    
    # Test downgrade base
    command.downgrade(alembic_cfg, "base")
    inspector = inspect(engine)
    downgraded_tables = set(inspector.get_table_names()) - {"alembic_version"}
    assert len(downgraded_tables) == 0, f"Remaining tables after downgrade: {downgraded_tables}"
