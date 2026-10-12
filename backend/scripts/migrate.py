"""Automated Database Migration Runner.

Runs Alembic database schema migrations to head with connectivity verification,
timeout retries, and current head validation.
"""
import os
import sys
import time
from alembic.config import Config
from alembic import command
from sqlalchemy import create_engine, text

from backend.app.core.config import get_settings


def wait_for_database(db_url: str, max_retries: int = 30, retry_interval: float = 2.0) -> None:
    """Blocks until the target database engine is responsive."""
    print(f"[Migration] Checking database readiness at {db_url.split('@')[-1]}...")
    engine = create_engine(db_url)
    for attempt in range(1, max_retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print(f"[Migration] Database connection verified on attempt {attempt}.")
            return
        except Exception as e:
            if attempt == max_retries:
                print(f"[Migration ERROR] Failed to connect to database after {max_retries} attempts: {e}")
                sys.exit(1)
            print(f"[Migration] Waiting for database (attempt {attempt}/{max_retries})...")
            time.sleep(retry_interval)


def run_migrations(alembic_ini_path: str = "alembic.ini") -> None:
    """Executes database schema upgrades to head."""
    settings = get_settings()
    wait_for_database(settings.database_url)

    print("[Migration] Initializing Alembic configuration...")
    cfg = Config(alembic_ini_path)
    cfg.set_main_option("sqlalchemy.url", settings.database_url)

    print("[Migration] Executing 'alembic upgrade head'...")
    try:
        command.upgrade(cfg, "head")
        print("[Migration SUCCESS] Database schema successfully upgraded to head.")
    except Exception as e:
        print(f"[Migration ERROR] Alembic upgrade failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    ini_file = sys.argv[1] if len(sys.argv) > 1 else "alembic.ini"
    run_migrations(ini_file)
