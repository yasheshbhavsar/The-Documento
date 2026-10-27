"""Regression test suite for Stage 1 Critical Safety & Verification Hardening.

Covers:
1. Physical artifact slicing in split_combined_document (distinct SHA-256 and byte sizes).
2. Strict non-fuzzy passport and unique ID matching in compare_document_numbers.
3. Family applicant association ambiguity resolution and abstention in suggest_applicant_association.
4. Authentication simulation header guard in production/staging environments.
"""
import uuid
import pytest
from unittest.mock import MagicMock

try:
    import pymupdf
except ImportError:
    pymupdf = None

from backend.app.ai.comparators import compare_document_numbers
from backend.app.core.config import Settings
from backend.app.core.errors import AuthenticationError
from backend.app.documents.boundaries import split_combined_document
from backend.app.documents.storage import get_storage_backend
from backend.app.domain.models import Document, DocumentExtractedField
from backend.app.extraction.service import suggest_applicant_association
from backend.app.security.auth import get_auth_context


def test_unique_document_number_no_fuzzy_matching():
    """Verify that sequential passport numbers differing by 1 character are flagged as confirmed contradictions."""
    # Sequential passports belonging to family members issued together
    res = compare_document_numbers("Z1234567", "Z1234568")
    assert res.is_concordant is False
    assert res.is_confirmed_contradiction is True
    assert res.variation_type == "unexplained_difference"
    assert "Unique identifiers must not be fuzzy-matched" in res.explanation


def test_unique_document_number_exact_ocr_substitution_preserved():
    """Verify that exact character-for-character optical substitutions (0/O, 1/I) remain recognized as OCR noise."""
    res = compare_document_numbers("C09812491", "CO98I249I")
    assert res.is_concordant is False
    assert res.is_confirmed_contradiction is False
    assert res.variation_type == "ocr_noise"
    assert res.similarity_score >= 0.85


def test_applicant_matching_abstains_on_shared_family_surname():
    """Verify that an extracted field containing only a shared family surname abstains from auto-matching."""
    org_id = uuid.uuid4()
    family_roster = [
        {"id": "member-1", "name": "Rajesh Patel", "first_name": "Rajesh", "last_name": "Patel", "is_dependant": False},
        {"id": "member-2", "name": "Pooja Patel", "first_name": "Pooja", "last_name": "Patel", "is_dependant": True},
        {"id": "member-3", "name": "Aarav Patel", "first_name": "Aarav", "last_name": "Patel", "is_dependant": True},
    ]

    # Document only contains surname "Patel"
    fields_surname_only = [
        DocumentExtractedField(
            id=uuid.uuid4(),
            organization_id=org_id,
            document_id=uuid.uuid4(),
            field_name="surname",
            field_label="Surname",
            original_value="Patel",
            normalized_value="Patel",
            extraction_confidence=0.95,
        )
    ]

    matched, score = suggest_applicant_association(fields_surname_only, family_roster)
    # Must abstain because "Patel" is shared across all family members
    assert matched is None
    assert score == 0.0


def test_applicant_matching_succeeds_on_full_name_or_passport():
    """Verify that an exact full name or unique passport number matches with high confidence."""
    org_id = uuid.uuid4()
    family_roster = [
        {
            "id": "member-1",
            "name": "Rajesh Patel",
            "first_name": "Rajesh",
            "last_name": "Patel",
            "passport_number": "J1234567",
            "is_dependant": False,
        },
        {
            "id": "member-2",
            "name": "Pooja Patel",
            "first_name": "Pooja",
            "last_name": "Patel",
            "passport_number": "K7654321",
            "is_dependant": True,
        },
    ]

    # Case A: Full name match
    fields_full_name = [
        DocumentExtractedField(
            id=uuid.uuid4(),
            organization_id=org_id,
            document_id=uuid.uuid4(),
            field_name="full_name",
            field_label="Full Name",
            original_value="Pooja Patel",
            normalized_value="Pooja Patel",
            extraction_confidence=0.96,
        )
    ]
    matched, score = suggest_applicant_association(fields_full_name, family_roster)
    assert matched is not None
    assert matched["id"] == "member-2"
    assert score >= 0.90

    # Case B: Passport number match
    fields_passport = [
        DocumentExtractedField(
            id=uuid.uuid4(),
            organization_id=org_id,
            document_id=uuid.uuid4(),
            field_name="passport_number",
            field_label="Passport Number",
            original_value="J1234567",
            normalized_value="J1234567",
            extraction_confidence=0.99,
        )
    ]
    matched_p, score_p = suggest_applicant_association(fields_passport, family_roster)
    assert matched_p is not None
    assert matched_p["id"] == "member-1"
    assert score_p >= 0.98


def test_physical_pdf_slicing_creates_independent_artifacts(db):
    """Verify that split_combined_document physically slices child PDF pages into distinct files."""
    if pymupdf is None:
        pytest.skip("PyMuPDF is not installed")

    from backend.app.domain.models import Organization

    storage = get_storage_backend()
    org_id = uuid.uuid4()
    actor_id = uuid.uuid4()

    org = Organization(id=org_id, name="Test Org", slug=f"test-{uuid.uuid4().hex[:6]}")
    db.add(org)
    db.commit()

    # Create a 3-page synthetic test PDF
    parent_pdf = pymupdf.open()
    for i in range(3):
        page = parent_pdf.new_page()
        page.insert_text((50, 50), f"Test Page Content {i + 1}")
    parent_bytes = parent_pdf.tobytes()
    parent_pdf.close()

    # Store parent in storage
    parent_doc_id = uuid.uuid4()
    parent_filename = "multi_family_bundle.pdf"
    stored_parent = storage.store_file(
        organization_id=org_id,
        file_id=parent_doc_id,
        filename=parent_filename,
        content=parent_bytes,
        content_type="application/pdf",
    )

    parent_doc = Document(
        id=parent_doc_id,
        organization_id=org_id,
        uploaded_by_user_id=actor_id,
        title="Multi-Document Bundle",
        filename=parent_filename,
        category="batch_upload",
        storage_path=stored_parent.storage_path,
        sha256_hash=stored_parent.sha256_hash,
        byte_size=stored_parent.byte_size,
        mime_type="application/pdf",
        version=1,
        page_count=3,
        ocr_applied=True,
        extracted_text="Test Page Content 1\nTest Page Content 2\nTest Page Content 3",
        layout_metadata={
            "pages": [
                {"page_number": 1, "text": "Test Page Content 1"},
                {"page_number": 2, "text": "Test Page Content 2"},
                {"page_number": 3, "text": "Test Page Content 3"},
            ]
        },
    )
    db.add(parent_doc)
    db.commit()

    # Split into 2 sections: Section 1 = Page 1, Section 2 = Pages 2-3
    sections = [
        {"title": "Section 1", "category": "identity_passport", "start_page": 1, "end_page": 1},
        {"title": "Section 2", "category": "financial_records", "start_page": 2, "end_page": 3},
    ]

    children = split_combined_document(
        db=db,
        parent_document=parent_doc,
        sections=sections,
        actor_id=actor_id,
    )

    assert len(children) == 2
    child1, child2 = children[0], children[1]

    # Verify physical separation
    assert child1.layout_metadata["is_physically_sliced"] is True
    assert child2.layout_metadata["is_physically_sliced"] is True

    # Hashes must differ from parent and from each other!
    assert child1.sha256_hash != parent_doc.sha256_hash
    assert child2.sha256_hash != parent_doc.sha256_hash
    assert child1.sha256_hash != child2.sha256_hash

    # Sliced texts must only contain the relevant pages
    assert "Test Page Content 1" in child1.extracted_text
    assert "Test Page Content 2" not in child1.extracted_text
    assert "Test Page Content 2" in child2.extracted_text
    assert "Test Page Content 3" in child2.extracted_text

    # Sliced files must physically exist in storage
    child1_bytes, _ = storage.read_file(org_id, child1.id, child1.filename)
    child1_pdf = pymupdf.open(stream=child1_bytes, filetype="pdf")
    assert len(child1_pdf) == 1
    child1_pdf.close()

    child2_bytes, _ = storage.read_file(org_id, child2.id, child2.filename)
    child2_pdf = pymupdf.open(stream=child2_bytes, filetype="pdf")
    assert len(child2_pdf) == 2
    child2_pdf.close()


@pytest.mark.anyio
async def test_auth_simulation_headers_blocked_in_staging_or_production(monkeypatch):
    """Verify that X-User-Role / X-User-Id simulation headers are rejected when ENVIRONMENT != 'development'."""
    from backend.app.security import auth

    mock_settings = Settings(
        environment="staging",
        auth_required=True,
        jwt_secret_key="secure_staging_secret_key_exceeding_32_characters",
        database_url="postgresql+psycopg://valid_user:strong_password@localhost:5432/valid_db",
    )
    monkeypatch.setattr(auth, "get_settings", lambda: mock_settings)

    request = MagicMock()
    request.cookies = {}

    # In staging, simulation headers must be rejected
    with pytest.raises(AuthenticationError, match="Authentication required"):
        await get_auth_context(
            request=request,
            authorization=None,
            x_organization_id=str(uuid.uuid4()),
            x_user_id=str(uuid.uuid4()),
            x_user_role="master_admin",
            db=MagicMock(),
        )
