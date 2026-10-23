import os
import shutil
import tempfile
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

TEST_STORAGE_DIR = tempfile.mkdtemp(prefix="documento_test_storage_")
os.environ["DOCUMENT_STORAGE_DIR"] = TEST_STORAGE_DIR
os.environ["USE_LOCAL_STORAGE"] = "true"

from backend.app.core.config import get_settings
get_settings.cache_clear()
settings = get_settings()
settings.document_storage_dir = TEST_STORAGE_DIR
settings.use_local_storage = True

from backend.app.main import app
from backend.app.db.base import Base
from backend.app.db.session import get_db

# Shared in-memory SQLite engine for all tests
TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=TEST_ENGINE)

# Point application SessionLocal to test engine for background tasks and worker tests
import backend.app.db.session as db_session_module
db_session_module.SessionLocal = TestSessionLocal


@pytest.fixture(scope="session", autouse=True)
def initialize_database():
    """Create all tables once for the test session."""
    Base.metadata.create_all(bind=TEST_ENGINE)
    yield
    Base.metadata.drop_all(bind=TEST_ENGINE)
    if os.path.exists(TEST_STORAGE_DIR):
        shutil.rmtree(TEST_STORAGE_DIR, ignore_errors=True)


@pytest.fixture(autouse=True)
def clean_database():
    """Ensure database is empty before every test."""
    from sqlalchemy import text
    with TEST_ENGINE.begin() as conn:
        conn.execute(text("PRAGMA foreign_keys = OFF;"))
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())
        conn.execute(text("PRAGMA foreign_keys = ON;"))
    yield


@pytest.fixture
def db():
    """Provide a clean transactional session for a test."""
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    """Provide a TestClient with get_db overridden to use the test session."""
    def _override_get_db():
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    test_client = TestClient(app)
    yield test_client
    app.dependency_overrides.pop(get_db, None)
