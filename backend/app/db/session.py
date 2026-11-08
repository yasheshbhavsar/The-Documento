import logging
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker
from backend.app.core.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()
engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
_local_sqlite_SessionLocal = None


def _get_or_init_local_sqlite_sessionmaker():
    global _local_sqlite_SessionLocal
    if _local_sqlite_SessionLocal is None:
        from backend.app.db.base import Base
        import backend.app.domain.models  # noqa: F401

        sqlite_path = Path(__file__).resolve().parents[2] / "documento_local_dev.db"
        sqlite_url = f"sqlite:///{sqlite_path.as_posix()}"
        sqlite_engine = create_engine(
            sqlite_url,
            connect_args={"check_same_thread": False},
        )
        Base.metadata.create_all(bind=sqlite_engine)
        _local_sqlite_SessionLocal = sessionmaker(
            bind=sqlite_engine, autoflush=False, autocommit=False
        )
        logger.warning(
            "Local PostgreSQL unavailable in development; switched automatically to SQLite (%s)",
            sqlite_path,
        )
    return _local_sqlite_SessionLocal


def get_db():
    global SessionLocal
    if _local_sqlite_SessionLocal is not None and SessionLocal is not _local_sqlite_SessionLocal:
        # Preserve explicit test overrides (e.g. conftest.py sets db_session_module.SessionLocal)
        db = SessionLocal()
    elif _local_sqlite_SessionLocal is not None:
        db = _local_sqlite_SessionLocal()
    else:
        candidate = SessionLocal()
        is_default_dev_pg = (
            settings.environment.lower() in ("development", "local")
            and "local_dev_only" in settings.database_url
            and settings.database_url.startswith("postgresql")
        )
        if is_default_dev_pg:
            try:
                candidate.execute(text("SELECT 1"))
                db = candidate
            except OperationalError:
                candidate.close()
                fallback_factory = _get_or_init_local_sqlite_sessionmaker()
                SessionLocal = fallback_factory
                db = fallback_factory()
        else:
            db = candidate

    try:
        yield db
    finally:
        db.close()
