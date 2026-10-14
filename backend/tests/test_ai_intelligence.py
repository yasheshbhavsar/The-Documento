import uuid
from unittest.mock import MagicMock, patch
from uuid import UUID

import pytest

from backend.app.ai.financial_parser import (
    FinancialIntelligenceEngine,
    StatutoryLiquidityAudit,
)
from backend.app.ai.identity_resolver import (
    IdentityResolver,
    SingleNameResolution,
)
from backend.app.ai.llm_client import (
    MockLocalVisionClient,
    get_ai_client,
)
from backend.app.documents.storage import (
    ImmutableFileError,
    IntegrityVerificationError,
    S3DocumentStorage,
)
from backend.app.extraction.service import extract_structured_fields
from backend.app.ocr.engine import PageBlock, PageExtractionResult


class TestIdentityResolver:
    def test_single_name_resolution_for_global_visas(self):
        # Case 1: Indian passport with single legal name "Gurpreet"
        res = IdentityResolver.resolve_single_name(first_name="Gurpreet", last_name=None)
        assert res.is_single_name is True
        assert res.original_single_name == "Gurpreet"
        assert res.uscis_first_name == "FNU"
        assert res.uscis_surname == "Gurpreet"
        assert res.ircc_given_name == ""
        assert res.ircc_surname == "Gurpreet"
        assert res.ukvi_given_name == "."
        assert res.ukvi_family_name == "Gurpreet"

        # Case 2: Only surname provided
        res2 = IdentityResolver.resolve_single_name(first_name=None, last_name="Kavita")
        assert res2.is_single_name is True
        assert res2.uscis_first_name == "FNU"
        assert res2.uscis_surname == "Kavita"

        # Case 3: Standard multipart legal name
        std = IdentityResolver.resolve_single_name(first_name="Aarav", last_name="Patel")
        assert std.is_single_name is False
        assert std.uscis_first_name == "Aarav"
        assert std.uscis_surname == "Patel"
        assert std.ircc_given_name == "Aarav"
        assert std.ukvi_given_name == "Aarav"

    def test_aadhaar_mandatory_uidai_masking(self):
        # Text containing raw 12-digit Aadhaar number
        raw_text = """
        GOVERNMENT OF INDIA
        Mera Aadhaar, Meri Pehchan
        Name: Rajesh Kumar
        DOB: 14/08/1990
        Gender: MALE
        S/O: Ramesh Kumar
        Aadhaar: 5432 8765 4321
        """
        parsed = IdentityResolver.parse_aadhaar(raw_text)
        assert parsed is not None
        assert parsed.is_valid is True
        # Critical UIDAI legal requirement: first 8 digits MUST be masked!
        assert parsed.masked_aadhaar_number == "XXXX-XXXX-4321"
        assert parsed.raw_detected is True
        assert parsed.gender == "Male"
        assert parsed.date_of_birth == "14/08/1990"
        assert parsed.father_or_spouse_name == "Ramesh Kumar"

    def test_already_masked_aadhaar_support(self):
        masked_text = "UIDAI Card Details: XXXX-XXXX-9876, DOB: 01/01/1985"
        parsed = IdentityResolver.parse_aadhaar(masked_text)
        assert parsed is not None
        assert parsed.masked_aadhaar_number == "XXXX-XXXX-9876"
        assert parsed.raw_detected is False

    def test_pan_card_entity_classification(self):
        # Individual PAN (4th char 'P', 5th char 'S' matches Sharma)
        indiv_text = "INCOME TAX DEPARTMENT\nName: Rajesh Sharma\nPAN: ABCPS1234F\nDate of Birth: 12/05/1988"
        p1 = IdentityResolver.parse_pan(indiv_text)
        assert p1 is not None
        assert p1.pan_number == "ABCPS1234F"
        assert "Individual" in p1.entity_type
        assert p1.fifth_char_surname_match is True
        assert p1.holder_name == "Rajesh Sharma"

        # Company PAN (4th char 'C')
        corp_text = "PAN: AAACB9876K\nName: Infosys Limited"
        p2 = IdentityResolver.parse_pan(corp_text)
        assert p2 is not None
        assert p2.pan_number == "AAACB9876K"
        assert p2.entity_type == "Company"

        # Trust PAN (4th char 'T')
        trust_text = "Permanent Account Number: AAATT4321Q"
        p3 = IdentityResolver.parse_pan(trust_text)
        assert p3 is not None
        assert p3.entity_type == "Trust"

    def test_indian_passport_ecr_and_endorsements(self):
        passport_text = """
        PASSPORT / PASSEPORT
        REPUBLIC OF INDIA
        Passport No: K8765432
        Surname: SHARMA
        Given Names: SUNIL
        Nationality: INDIAN
        Date of Birth: 22/07/1992
        File No: DEL1098234524
        Father's Legal Name: SURESH SHARMA
        Mother's Legal Name: SUNITA SHARMA
        Spouse's Legal Name: PRIYA SHARMA
        Booklet: 60 Pages Jumbo
        Emigration Check Not Required (ECNR)
        """
        p = IdentityResolver.parse_indian_passport(passport_text)
        assert p is not None
        assert p.passport_number == "K8765432"
        assert p.emigration_check == "ECNR"
        assert p.file_number == "DEL1098234524"
        assert p.booklet_type == "60-page Jumbo"
        assert p.father_name == "Suresh Sharma"
        assert p.mother_name == "Sunita Sharma"
        assert p.spouse_name == "Priya Sharma"

    def test_indian_passport_ecr_required_detection(self):
        passport_text = "Passport No: P1234567\nEmigration Check Required"
        p = IdentityResolver.parse_indian_passport(passport_text)
        assert p is not None
        assert p.emigration_check == "ECR"


class TestFinancialIntelligenceEngine:
    def test_bank_statement_unseasoned_lump_sum_detection(self):
        statement_text = """
        STATE BANK OF INDIA - ACCOUNT STATEMENT
        Account Number: 30982187654
        Statement Period: 01/01/2025 to 31/03/2025
        Closing Balance: $ 32,500.00

        DATE        DESCRIPTION             AMOUNT
        05/01/2025  PAYROLL SALARY CREDIT   3,200.00
        15/01/2025  GROCERY STORE DEBIT       150.00
        02/02/2025  SALARY ACH DIRECT DEP   3,200.00
        18/02/2025  TRANSFER FROM THIRD PARTY UNKNOWN  22,000.00
        01/03/2025  SALARY DIRECT DEPOSIT   3,200.00
        """
        summary = FinancialIntelligenceEngine.parse_bank_statement_text(statement_text, default_currency="USD")
        assert summary.closing_balance == 32500.0
        assert summary.financial_institution == "State Bank Of India"
        # The $22,000 transfer is >35% of closing balance without payroll provenance
        assert len(summary.suspicious_lump_sums) == 1
        lump = summary.suspicious_lump_sums[0]
        assert lump.amount == 22000.0
        assert lump.is_suspicious_lump_sum is True
        assert len(summary.risk_findings) == 1
        assert "Unexplained large deposit" in summary.risk_findings[0]

    def test_statutory_student_visa_liquidity_calculator(self):
        # Canada IRCC Study Permit: $20,635 CAD living cost standard
        # Sufficient funds scenario: Tuition $18,000 + Living $20,635 = $38,635 required
        audit_pass = FinancialIntelligenceEngine.evaluate_study_permit_liquidity(
            jurisdiction="CA",
            first_year_tuition=18000.0,
            available_funds=45000.0,
            currency="CAD",
        )
        assert audit_pass.is_sufficient is True
        assert audit_pass.total_statutory_threshold == 38635.0
        assert audit_pass.surplus_or_deficit == 6365.0
        assert "Surplus: CAD 6,365.00" in audit_pass.rationale

        # Deficit scenario
        audit_fail = FinancialIntelligenceEngine.evaluate_study_permit_liquidity(
            jurisdiction="CA",
            first_year_tuition=25000.0,
            available_funds=30000.0,
            currency="CAD",
        )
        assert audit_fail.is_sufficient is False
        assert audit_fail.surplus_or_deficit == -15635.0
        assert "DEFICIT OF CAD 15,635.00" in audit_fail.rationale

        # US F-1 scenario: $18,000 USD living cost benchmark
        us_audit = FinancialIntelligenceEngine.evaluate_study_permit_liquidity(
            jurisdiction="US",
            first_year_tuition=22000.0,
            available_funds=40000.0,
            currency="USD",
        )
        assert us_audit.total_statutory_threshold == 40000.0
        assert us_audit.is_sufficient is True

    def test_itr_v_schedule_parsing(self):
        itr_text = """
        INDIAN INCOME TAX RETURN VERIFICATION FORM
        [ITR-V]
        Assessment Year: 2024-25
        PAN: ABCPS1234F
        Acknowledgement No: 123456789012345
        Gross Total Income: 1,850,000
        Total Tax Payable: 210,000
        """
        itr = FinancialIntelligenceEngine.parse_itr_v(itr_text)
        assert itr is not None
        assert itr.assessment_year == "2024-25"
        assert itr.pan == "ABCPS1234F"
        assert itr.acknowledgement_number == "123456789012345"
        assert itr.gross_total_income == 1850000.0
        assert itr.total_tax_payable == 210000.0
        assert itr.is_verified_acknowledgement is True


class TestExtractionServiceIntegration:
    def test_extract_structured_fields_with_ai_and_identity(self):
        doc_id = uuid.uuid4()
        org_id = uuid.uuid4()

        page = PageExtractionResult(
            page_number=1,
            width=612.0,
            height=792.0,
            text="""
            PASSPORT / PASSEPORT
            P<INDGURPREET<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
            Z876543210IND9501015M3001015<<<<<<<<<<<<<<02
            Name: Gurpreet
            Date of Birth: 01/01/1995
            Nationality: INDIAN
            Emigration Check Not Required (ECNR)
            File No: DEL1234567890
            Aadhaar: 9876 5432 1098
            PAN: ABCPG1234M
            """,
            blocks=[
                PageBlock(50, 50, 200, 70, "P<INDGURPREET", 0.99, 0),
                PageBlock(50, 80, 200, 100, "Gurpreet", 0.98, 1),
            ],
            ocr_applied=False,
            ocr_confidence=0.99,
        )

        fields = extract_structured_fields(
            document_id=doc_id,
            organization_id=org_id,
            category="identity_passport",
            pages=[page],
        )

        field_map = {f.field_name: f for f in fields}

        # 1. Verify Passport fields
        assert "passport_number" in field_map
        assert field_map["passport_number"].normalized_value == "Z87654321"

        # 2. Verify Aadhaar statutory 8-digit masking
        assert "aadhaar_number_masked" in field_map
        assert field_map["aadhaar_number_masked"].normalized_value == "XXXX-XXXX-1098"

        # 3. Verify PAN classification
        assert "pan_number" in field_map
        assert field_map["pan_number"].normalized_value == "ABCPG1234M"
        assert "pan_taxpayer_type" in field_map

        # 4. Verify Indian Passport ECNR & File No
        assert "emigration_check_status" in field_map
        assert field_map["emigration_check_status"].normalized_value == "ECNR"
        assert "passport_file_number" in field_map

        # 5. Verify Single-Name / FNU Resolver triggered for "Gurpreet"
        assert "single_name_uscis_given" in field_map
        assert field_map["single_name_uscis_given"].normalized_value == "FNU"
        assert "single_name_ircc_given" in field_map
        assert field_map["single_name_ircc_given"].normalized_value == ""
        assert "single_name_ukvi_given" in field_map
        assert field_map["single_name_ukvi_given"].normalized_value == "."

    def test_extract_structured_fields_bank_statement_forensics(self):
        doc_id = uuid.uuid4()
        org_id = uuid.uuid4()

        page = PageExtractionResult(
            page_number=1,
            width=612.0,
            height=792.0,
            text="""
            ROYAL BANK OF CANADA
            Closing Balance: $ 45,000.00
            Account ending in: 9876
            01/02/2025  UNEXPLAINED CASH DEPOSIT  30,000.00
            05/02/2025  PAYROLL SALARY CREDIT     2,500.00
            """,
            blocks=[],
            ocr_applied=False,
            ocr_confidence=0.99,
        )

        fields = extract_structured_fields(
            document_id=doc_id,
            organization_id=org_id,
            category="financial_evidence",
            pages=[page],
        )

        field_map = {f.field_name: f for f in fields}
        assert "closing_balance" in field_map
        assert "unseasoned_funds_flag" in field_map
        assert "financial_risk_notes" in field_map
        assert "1 unseasoned deposits detected" in field_map["unseasoned_funds_flag"].original_value


class TestStorageAndAIClient:
    def test_mock_local_vision_client(self):
        client = MockLocalVisionClient()
        fake_pdf = b"%PDF-1.4 sample content with Passport Number: Z9988776 and Closing Balance: $12,500.00"
        res = client.extract_document_entities(
            content=fake_pdf,
            filename="sample.pdf",
            category="identity_passport",
            mime_type="application/pdf",
        )
        assert res.model_name == "mock-vision-neural-v2"
        assert res.confidence >= 0.9
        assert len(res.entities) >= 1

    def test_get_ai_client_fallback(self):
        client = get_ai_client()
        assert client is not None
        assert isinstance(client, MockLocalVisionClient)

    def test_s3_storage_backend_mocked(self):
        org_id = uuid.uuid4()
        file_id = uuid.uuid4()
        content = b"Mock legal document test bytes"

        with patch("boto3.client") as mock_boto:
            mock_s3 = MagicMock()
            mock_boto.return_value = mock_s3
            mock_s3.head_object.side_effect = Exception("Not found")

            storage = S3DocumentStorage(
                endpoint_url="http://mock-s3:9000",
                bucket_name="ai-immigration-test",
                access_key="test_key",
                secret_key="test_secret",
            )

            # Store file
            artifact = storage.store_file(
                organization_id=org_id,
                file_id=file_id,
                filename="test_doc.pdf",
                content=content,
                content_type="application/pdf",
            )
            assert artifact.organization_id == org_id
            assert artifact.byte_size == len(content)
            assert "s3://ai-immigration-test/" in artifact.storage_path
            mock_s3.put_object.assert_called_once()

            # Read file
            mock_s3.get_object.return_value = {"Body": MagicMock(read=lambda: content)}
            read_bytes, sha = storage.read_file(
                organization_id=org_id,
                file_id=file_id,
                filename="test_doc.pdf",
                expected_hash=artifact.sha256_hash,
            )
            assert read_bytes == content
            assert sha == artifact.sha256_hash

            # Read file with wrong hash raises IntegrityVerificationError
            with pytest.raises(IntegrityVerificationError):
                storage.read_file(
                    organization_id=org_id,
                    file_id=file_id,
                    filename="test_doc.pdf",
                    expected_hash="incorrect_hash_0000000000000000",
                )
