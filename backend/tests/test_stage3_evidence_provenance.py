"""Stage 3 Regression Suite: Evidence Provenance Hardening & Confidence Calibration.

Validates invariants from Documento Master Vision §2, §4.3, §4.4, and §4.5:
1. Multi-page physical boundary & page-specific provenance:
   - Fields extracted from Page 2 strictly retain Page 2's source_page, bounding box,
     per-page OCR confidence, and page-specific extraction method (not inheriting Page 1).
2. Prohibition on phantom/placeholder fabrication:
   - Never fabricate or store placeholder strings ("null", "none", "n/a", "unknown") as legal fields.
3. Confidence calibration:
   - Sub-threshold OCR (< 0.75) or extraction confidence (< 0.75) forces validation_status
     to "needs_review" or "flagged".
   - In format_field_extraction_provenance, sub-threshold OCR (< 0.70) strictly prevents
     automated "VERIFIED" status without manual human sign-off.
4. Six-dimension review calibration:
   - Dimension 1 (Readability) detects page-level sub-threshold OCR on individual pages/fields
     rather than masking degraded scans behind a high overall average.
5. Decoupling of automated OCR from legal verification:
   - High OCR confidence (e.g. 0.99) reflects typographical fidelity only and does not constitute
     evidentiary or statutory legal sufficiency; Dimension 6 (Human Verification) remains unverified.
6. Three-tier evidentiary separation:
   - Tier 1 (Extracted Fact), Tier 2 (Model Inference), and Tier 3 (Professional Decision)
     remain strictly partitioned with explicit statutory guardrail disclaimers.
"""

import uuid
from datetime import datetime, timezone
import pytest

from backend.app.ai.document_intelligence import (
    evaluate_document_six_dimensions,
    OCR_LEGAL_SUFFICIENCY_DISCLAIMER,
)
from backend.app.ai.provenance import (
    format_three_tier_entity,
    EvidenceTier,
    HIGH_CONFIDENCE_NOT_LEGAL_SUFFICIENCY_NOTICE,
    LEGAL_SUFFICIENCY_GUARDRAIL,
)
from backend.app.domain.models import (
    Document,
    DocumentExtractedField,
    ImmigrationCase,
    Organization,
    User,
)
from backend.app.extraction.service import (
    extract_structured_fields,
    format_field_extraction_provenance,
)
from backend.app.ocr.engine import PageBlock, PageExtractionResult


class TestStage3EvidenceProvenance:
    def test_multipage_page_specific_provenance_and_ocr_confidence(self):
        """
        Master Vision §4.3 Invariant:
        When extracting fields across a multi-page document, a field found on Page 2 must:
        - Record source_page == 2
        - Retain Page 2's specific OCR confidence (0.68) instead of Page 1's (0.98)
        - Retain Page 2's specific extraction method ('ocr_pattern_matcher')
        - Have validation_status calibrated to 'needs_review' due to sub-threshold OCR (0.68 < 0.75).
        """
        doc_id = uuid.uuid4()
        org_id = uuid.uuid4()

        # Page 1: High-fidelity digital title page (OCR confidence 0.98, native layout)
        page1 = PageExtractionResult(
            page_number=1,
            width=612.0,
            height=792.0,
            text="OFFICIAL IMMIGRATION DOSSIER COVER SHEET\nCase Reference: IMM-2026-9999\nIssued by Legal Services",
            blocks=[
                PageBlock(50, 50, 300, 75, "OFFICIAL IMMIGRATION DOSSIER", 0.98, 0),
            ],
            ocr_applied=False,
            ocr_confidence=0.98,
        )

        # Page 2: Scanned, slightly degraded passport biodata page (OCR confidence 0.68, OCR applied)
        page2 = PageExtractionResult(
            page_number=2,
            width=600.0,
            height=800.0,
            text="PASSPORT / PASSEPORT\nPassport No: Z98765432\nFull Name: Rajesh Sharma\nDate of Birth: 15/08/1988\nNationality: Indian",
            blocks=[
                PageBlock(60, 100, 250, 120, "Passport No: Z98765432", 0.68, 0),
                PageBlock(60, 140, 300, 160, "Full Name: Rajesh Sharma", 0.68, 1),
                PageBlock(60, 180, 280, 200, "Date of Birth: 15/08/1988", 0.68, 2),
            ],
            ocr_applied=True,
            ocr_confidence=0.68,
        )

        fields = extract_structured_fields(
            document_id=doc_id,
            organization_id=org_id,
            category="identity_passport",
            pages=[page1, page2],
        )

        field_map = {f.field_name: f for f in fields}

        # 1. Passport number was found on Page 2
        assert "passport_number" in field_map
        p_num = field_map["passport_number"]
        assert p_num.original_value == "Z98765432"
        assert p_num.source_page == 2, f"Expected source_page 2, got {p_num.source_page}"
        assert p_num.ocr_confidence == 0.68, f"Expected page 2 OCR confidence 0.68, got {p_num.ocr_confidence}"
        assert p_num.extraction_method == "ocr_pattern_matcher"

        # 2. Confidence Calibration: 0.68 < 0.75 forces validation_status to 'needs_review'
        assert p_num.validation_status == "needs_review", f"Expected needs_review, got {p_num.validation_status}"

        # 3. Full name / applicant name also on Page 2
        assert "full_name" in field_map
        fn = field_map["full_name"]
        assert fn.source_page == 2
        assert fn.ocr_confidence == 0.68
        assert fn.validation_status == "needs_review"

    def test_prohibition_on_phantom_placeholder_fabrication(self):
        """
        Master Vision §4.3 Invariant:
        Unknown and ambiguous are valid outcomes. Never fabricate or store placeholder strings
        like 'None', 'null', 'N/A', or 'UNKNOWN' as extracted candidate legal entities.
        """
        doc_id = uuid.uuid4()
        org_id = uuid.uuid4()

        page = PageExtractionResult(
            page_number=1,
            width=612.0,
            height=792.0,
            text="PASSPORT IDENTIFICATION\nPassport No: None\nFull Name: N/A\nNationality: unknown",
            blocks=[
                PageBlock(50, 50, 200, 70, "Passport No: None", 0.95, 0),
                PageBlock(50, 80, 200, 100, "Full Name: N/A", 0.95, 1),
            ],
            ocr_applied=False,
            ocr_confidence=0.95,
        )

        fields = extract_structured_fields(
            document_id=doc_id,
            organization_id=org_id,
            category="identity_passport",
            pages=[page],
        )

        field_map = {f.field_name: f for f in fields}
        # Neither "None" nor "N/A" should be recorded as valid legal values
        assert "passport_number" not in field_map
        assert "full_name" not in field_map
        assert "applicant_name" not in field_map

    def test_format_field_extraction_provenance_calibration(self):
        """
        Master Vision §4.3 & §4.4 Invariant:
        format_field_extraction_provenance strictly enforces:
        1. Exact Phase 5 JSON schema with bounding box, confidence, extractor_version, review_status.
        2. Even if a field has validation_status='valid', if its ocr_confidence is sub-threshold (< 0.70),
           automated OCR cannot claim 'VERIFIED' status; it remains 'NEEDS_HUMAN_REVIEW'.
        3. A manually corrected field receives 'CORRECTED'.
        """
        doc_id = uuid.uuid4()
        org_id = uuid.uuid4()

        # Field A: Marked 'valid' by an upstream rule, but with noisy OCR confidence (0.65)
        noisy_field = DocumentExtractedField(
            id=uuid.uuid4(),
            organization_id=org_id,
            document_id=doc_id,
            field_name="passport_number",
            field_label="Passport Number",
            original_value="A1234567",
            normalized_value="A1234567",
            source_page=2,
            source_location={"bounding_box": [0.15, 0.20, 0.25, 0.60]},
            ocr_confidence=0.65,
            extraction_confidence=0.95,
            validation_status="valid",  # Even if marked valid, OCR is sub-threshold
            is_manually_corrected=False,
        )

        prov_noisy = format_field_extraction_provenance(noisy_field, version_id="1")
        assert prov_noisy["field"] == "passport_number"
        assert prov_noisy["page_number"] == 2
        assert prov_noisy["bounding_box"] == [0.15, 0.20, 0.25, 0.60]
        assert prov_noisy["confidence"] == 0.65  # Calibrated min(ocr_conf, ext_conf)
        # Invariant: Sub-threshold OCR prevents unreviewed 'VERIFIED' status
        assert prov_noisy["review_status"] == "NEEDS_HUMAN_REVIEW"

        # Field B: Manually corrected by caseworker
        corrected_field = DocumentExtractedField(
            id=uuid.uuid4(),
            organization_id=org_id,
            document_id=doc_id,
            field_name="date_of_birth",
            field_label="Date of Birth",
            original_value="15/08/1988",
            normalized_value="1988-08-15",
            corrected_value="1988-08-15",
            source_page=1,
            source_location={"bounding_box": [0.30, 0.20, 0.35, 0.50]},
            ocr_confidence=0.95,
            extraction_confidence=0.95,
            validation_status="corrected",
            is_manually_corrected=True,
            correction_reason="Audited against physical birth certificate",
        )

        prov_corr = format_field_extraction_provenance(corrected_field, version_id="1")
        assert prov_corr["review_status"] == "CORRECTED"
        assert prov_corr["value"] == "1988-08-15"

    def test_six_dimensions_review_detects_page_level_ocr_degradation(self):
        """
        Master Vision §4.3 Invariant:
        In evaluate_document_six_dimensions, Dimension 1 (Readability) must detect sub-threshold
        OCR on any individual page/field even if the document's overall average is high.
        """
        org_id = uuid.uuid4()
        case_id = uuid.uuid4()
        doc_id = uuid.uuid4()

        doc = Document(
            id=doc_id,
            organization_id=org_id,
            case_id=case_id,
            title="Multi_Page_Passports.pdf",
            filename="Multi_Page_Passports.pdf",
            category="identity_passport",
            storage_path="mock/path/multi.pdf",
            sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            byte_size=2048,
            page_count=3,
            version=1,
            is_current_version=True,
            processing_status="completed",
            verification_status="unverified",
            ocr_applied=True,
            extracted_text="Page 1 Clear. Page 2 Slightly Blurred Bio Data. Page 3 Stamp.",
        )

        # Fields: Field 1 has high confidence (0.95), Field 2 on page 2 has degraded OCR (0.62)
        f1 = DocumentExtractedField(
            id=uuid.uuid4(),
            organization_id=org_id,
            document_id=doc_id,
            field_name="dossier_reference",
            field_label="Dossier Reference",
            original_value="REF-1001",
            source_page=1,
            ocr_confidence=0.95,
            extraction_confidence=0.95,
            validation_status="unvalidated",
        )
        f2 = DocumentExtractedField(
            id=uuid.uuid4(),
            organization_id=org_id,
            document_id=doc_id,
            field_name="passport_number",
            field_label="Passport Number",
            original_value="M12345678",
            source_page=2,
            ocr_confidence=0.62,  # Sub-threshold on page 2!
            extraction_confidence=0.90,
            validation_status="needs_review",
        )
        doc.extracted_fields = [f1, f2]

        review = evaluate_document_six_dimensions(doc)

        # Readability status must be 'needs_review' because of page 2 degradation
        assert review.readability.status == "needs_review"
        assert any("page 2" in flag.lower() or "sub-threshold" in flag.lower() for flag in review.readability.high_priority_flags)

        # Overall review must be 'needs_review'
        assert review.overall_review_status == "needs_review"
        assert review.high_ocr_confidence_notice == OCR_LEGAL_SUFFICIENCY_DISCLAIMER

    def test_decoupling_of_automated_ocr_from_human_verification(self):
        """
        Master Vision §2 & §4.3 Invariant:
        Automated OCR confidence, even at 100%, never equates to legal verification.
        Human Verification (Dimension 6) remains unverified until an authorized caseworker signs off.
        """
        org_id = uuid.uuid4()
        case_id = uuid.uuid4()
        doc_id = uuid.uuid4()

        doc = Document(
            id=doc_id,
            organization_id=org_id,
            case_id=case_id,
            title="Clean_High_Res_Passport.pdf",
            filename="Clean_High_Res_Passport.pdf",
            category="identity_passport",
            storage_path="mock/path/clean.pdf",
            sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            byte_size=1024,
            page_count=1,
            version=1,
            is_current_version=True,
            processing_status="completed",
            verification_status="unverified",
            ocr_applied=False,
            extracted_text="Flawless digital text extraction.",
        )

        f1 = DocumentExtractedField(
            id=uuid.uuid4(),
            organization_id=org_id,
            document_id=doc_id,
            field_name="passport_number",
            field_label="Passport Number",
            original_value="Z9999999",
            source_page=1,
            ocr_confidence=1.0,
            extraction_confidence=1.0,
            validation_status="unvalidated",
        )
        doc.extracted_fields = [f1]

        review = evaluate_document_six_dimensions(doc)

        # Dimension 1 passes with 100% confidence
        assert review.readability.status == "passed"
        # But Dimension 6 strictly remains unverified
        assert review.human_verification.status == "unverified"
        assert review.human_verification.details["is_decoupled_from_ocr"] is True
        # Overall status requires human sign-off
        assert review.overall_review_status == "needs_review"

    def test_three_tier_evidentiary_separation(self):
        """
        Master Vision §2 & §4.3 Invariant:
        Three-tier entity partitioning ensures:
        - Tier 1: Extracted Fact (Verbatim raw text, exact source page, bounding box, ocr confidence)
        - Tier 2: Model Inference (Candidate normalized value, model version, legal scope guardrail)
        - Tier 3: Professional Decision (Human review status, effective value, audit rationale)
        """
        field_id = str(uuid.uuid4())
        entity = format_three_tier_entity(
            field_id=field_id,
            field_name="date_of_birth",
            field_label="Date of Birth",
            raw_value="15/08/1988",
            normalized_value="1988-08-15",
            source_page=2,
            source_location={"bounding_box": [0.20, 0.15, 0.25, 0.45]},
            ocr_confidence=0.92,
            extraction_confidence=0.96,
            model_version="mock-vision-neural-v2",
            validation_status="unvalidated",
        )

        assert entity["id"] == field_id
        assert entity["current_tier"] == EvidenceTier.MODEL_INFERENCE.value

        # Tier 1 Fact assertions
        t1 = entity["tiers"]["tier1_extracted_fact"]
        assert t1["verbatim_text"] == "15/08/1988"
        assert t1["source_page"] == 2
        assert t1["bounding_box"] == {"bounding_box": [0.20, 0.15, 0.25, 0.45]}
        assert t1["ocr_confidence"] == 0.92
        assert HIGH_CONFIDENCE_NOT_LEGAL_SUFFICIENCY_NOTICE in t1["optical_fidelity_disclaimer"]

        # Tier 2 Inference assertions
        t2 = entity["tiers"]["tier2_model_inference"]
        assert t2["candidate_normalized_value"] == "1988-08-15"
        assert t2["extraction_confidence"] == 0.96
        assert t2["provenance"]["model"] == "mock-vision-neural-v2"
        assert LEGAL_SUFFICIENCY_GUARDRAIL in t2["legal_scope_guardrail"]

        # Tier 3 Decision assertions
        t3 = entity["tiers"]["tier3_professional_decision"]
        assert t3["status"] == "unvalidated"
        assert t3["effective_value"] == "1988-08-15"
        assert t3["is_manually_corrected"] is False
