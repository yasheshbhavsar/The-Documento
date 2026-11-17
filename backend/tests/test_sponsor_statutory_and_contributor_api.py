"""Comprehensive verification suite for Workstream B:
1. Statutory Sponsor, Sibling & Cross-Border Financial Rules Engine (`sponsor_intelligence.py`)
2. Statutory Pathway Checklists (`checklist_engine.py`)
3. Role-Aware Cross-Document Discrepancy Suppression (`comparators.py` & `document_intelligence.py`)
4. Fast Lazy `/page-preview`, optimized `/analyze`, and Unified `/smart-intake` (`extractor.py`)
5. Passwordless Sponsor Upload Link & Privacy Shield API (`portal.py`)
"""
from __future__ import annotations

import json
import time
import uuid
from datetime import datetime, timezone

import fitz
import pytest
from fastapi.testclient import TestClient

from backend.app.ai.checklist_engine import PATHWAY_CHECKLISTS, audit_case_checklist
from backend.app.ai.comparators import are_roles_distinct_persons
from backend.app.ai.document_intelligence import (
    CONTRIBUTOR_ASSOCIATION_NOTE,
    evaluate_document_six_dimensions,
    evaluate_role_aware_consistency,
)
from backend.app.ai.sponsor_intelligence import SponsorIntelligenceEngine
from backend.app.domain.models import (
    CaseAIFinding,
    ClientProfile,
    Document,
    DocumentExtractedField,
    ImmigrationCase,
    Organization,
    User,
)
from backend.app.main import app
from backend.app.security.passwords import hash_password


api_client = TestClient(app)


def _make_pdf_bytes(pages_text: list[str]) -> bytes:
    """Builds an in-memory multi-page PDF with distinct page text."""
    doc = fitz.open()
    for txt in pages_text:
        page = doc.new_page(width=595, height=842)
        y = 64
        for line in txt.splitlines():
            page.insert_text((48, y), line, fontsize=11)
            y += 18
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


# ===========================================================================
# 1. Super Visa LICO Calculator & Medical Insurance Tests
# ===========================================================================


def test_super_visa_lico_official_table_across_family_sizes():
    """Verifies exact IRCC LICO thresholds from 1..9 persons (+7,916 per additional person)."""
    expected = {
        1: 29380.0,
        2: 36576.0,
        3: 44966.0,
        4: 54594.0,
        5: 61920.0,
        6: 69834.0,
        7: 77750.0,
        8: 85666.0,
        9: 93582.0,
    }
    for fam_size, req_cad in expected.items():
        assert SponsorIntelligenceEngine.get_required_lico_cad(fam_size) == req_cad


def test_super_visa_lico_surplus_cosigner_and_insurance_compliance():
    """Verifies Sponsor CRA NOA Line 15000 + Co-signer summation, non-double-counting, and $100k/365-day insurance."""
    docs = [
        {
            "title": "Rohan_CRA_NOA_2025.pdf",
            "category": "financial_evidence",
            "extracted_text": (
                "Canada Revenue Agency — Notice of Assessment\n"
                "Taxpayer Name: Rohan Sharma\n"
                "Line 15000 - Total income: $52,000.00\n"
                "Address: 88 Bay Street, Toronto, ON M5J 2T3"
            ),
        },
        # Same sponsor's T4 for $50,500 MUST NOT double-count on top of his $52,000 CRA NOA!
        {
            "title": "Rohan_T4_2025.pdf",
            "category": "employment_records",
            "extracted_text": (
                "Statement of Remuneration Paid (T4)\n"
                "Employee Name: Rohan Sharma\n"
                "Box 14 Employment income: $50,500.00"
            ),
        },
        # Co-signing spouse's CRA NOA SHOULD sum with Sponsor's NOA ($52,000 + $31,000 = $83,000 CAD)
        {
            "title": "Ananya_CoSigner_CRA_NOA_2025.pdf",
            "category": "financial_evidence",
            "extracted_text": (
                "Canada Revenue Agency — Notice of Assessment\n"
                "Taxpayer Name: Ananya Sharma\n"
                "Line 15000 - Total income: $31,000.00"
            ),
        },
        # Visiting parent's Indian ITR-V in INR MUST NOT pollute Canadian LICO sum
        {
            "title": "Parent_Indian_ITR_V.pdf",
            "category": "financial_evidence",
            "extracted_text": (
                "INCOME TAX DEPARTMENT - GOVT. OF INDIA\n"
                "Indian Income Tax Return Verification Form (ITR-V)\n"
                "Gross Total Income: 850,000"
            ),
        },
        # Compliant Super Visa Medical Insurance ($100,000 CAD for 365 days)
        {
            "title": "Manulife_Super_Visa_Policy.pdf",
            "category": "insurance_accommodation",
            "extracted_text": (
                "Manulife Super Visa Emergency Medical Insurance\n"
                "Coverage Amount: CAD $100,000\n"
                "Policy Duration: 365 days (Full Year)"
            ),
        },
    ]

    # Family size 5 (Host + Spouse + 1 Child in Canada + 2 Visiting Parents) -> Required LICO = $61,920 CAD
    res = SponsorIntelligenceEngine.evaluate_super_visa_lico(docs, family_size=5)
    assert res["is_met"] is True
    assert res["family_size"] == 5
    assert res["required_lico_cad"] == 61920.0
    assert res["documented_income_cad"] == 83000.0
    assert res["surplus_or_shortfall_cad"] == 21080.0
    assert res["insurance_compliant"] is True
    assert res["citation"] == "IRPA s. 11(1) / IRPR Super Visa Ministerial Instructions"


def test_super_visa_lico_shortfall_and_deficient_insurance():
    """Verifies LICO shortfall calculation and non-compliant (<$100k or <365 days) insurance detection."""
    docs = [
        {
            "title": "Host_CRA_NOA_Low.pdf",
            "category": "financial_evidence",
            "extracted_text": (
                "Canada Revenue Agency — Notice of Assessment\n"
                "Taxpayer Name: Kabir Patel\n"
                "Total income (Line 15000): $41,000.00"
            ),
        },
        {
            "title": "Short_Insurance_Policy.pdf",
            "category": "insurance_accommodation",
            "extracted_text": (
                "Visitors to Canada Medical Insurance\n"
                "Sum Insured: $50,000 CAD\n"
                "Duration: 180 days"
            ),
        },
    ]
    # Family size 4 -> Required LICO = $54,594 CAD -> Shortfall = -$13,594.00 CAD
    res = SponsorIntelligenceEngine.evaluate_super_visa_lico(docs, family_size=4)
    assert res["is_met"] is False
    assert res["required_lico_cad"] == 54594.0
    assert res["documented_income_cad"] == 41000.0
    assert res["surplus_or_shortfall_cad"] == -13594.0
    assert res["insurance_compliant"] is False


# ===========================================================================
# 2. Express Entry +15 CRS Canadian Sibling 3-Prong Verifier Tests
# ===========================================================================


def test_express_entry_crs_sibling_all_three_prongs_verified():
    """Passes +15 CRS points when Status + Canadian Residency + Shared Parent on Birth Certs all match."""
    docs = [
        {
            "title": "Applicant_Birth_Certificate.pdf",
            "category": "civil_status_family",
            "person_role": "principal_applicant",
            "extracted_text": (
                "BIRTH CERTIFICATE\n"
                "Child Name: Aarav Sharma\n"
                "Name of Father: Rajeshkumar Sharma\n"
                "Name of Mother: Meenaben Sharma"
            ),
        },
        {
            "title": "Sibling_PR_Card.pdf",
            "category": "government_correspondence",
            "person_role": "canadian_crs_sibling",
            "extracted_text": (
                "GOVERNMENT OF CANADA\n"
                "PERMANENT RESIDENT CARD / CARTE DE RÉSIDENT PERMANENT\n"
                "Holder Name: Priya Sharma\n"
                "ID No: 8492-3019"
            ),
        },
        {
            "title": "Sibling_Hydro_One_Bill.pdf",
            "category": "financial_evidence",
            "person_role": "canadian_crs_sibling",
            "extracted_text": (
                "Hydro One Ontario Electricity Utility Bill\n"
                "Account Holder: Priya Sharma\n"
                "Service Address: 240 King Street West, Toronto, Ontario M5H 3S6"
            ),
        },
        {
            "title": "Sibling_Birth_Certificate.pdf",
            "category": "civil_status_family",
            "person_role": "canadian_crs_sibling",
            "extracted_text": (
                "BIRTH CERTIFICATE\n"
                "Child Name: Priya Sharma\n"
                "Name of Father: Rajesh Sharma\n"
                "Name of Mother: Meena Sharma"
            ),
        },
    ]

    res = SponsorIntelligenceEngine.evaluate_crs_sibling_points(
        docs, principal_applicant_name="Aarav Sharma"
    )
    assert res["eligible_for_15_crs_points"] is True
    assert res["crs_points_awarded"] == 15
    assert res["prongs"]["status_verified"] is True
    assert res["prongs"]["residency_verified"] is True
    assert res["prongs"]["shared_parent_verified"] is True
    assert len(res["prongs"]["matched_parent_names"]) >= 1
    assert res["missing_evidence"] == []
    assert "29(2)" in res["citation"]


def test_express_entry_crs_sibling_fails_when_any_prong_missing():
    """Fails with 0 CRS points and explicit missing_evidence whenever any of the 3 prongs is absent."""
    pa_birth = {
        "title": "PA_Birth.pdf",
        "category": "civil_status_family",
        "person_role": "principal_applicant",
        "extracted_text": "Child Name: Aarav Sharma\nName of Father: Rajesh Sharma\nName of Mother: Meena Sharma",
    }
    sib_pr = {
        "title": "Sibling_PR.pdf",
        "category": "government_correspondence",
        "person_role": "canadian_crs_sibling",
        "extracted_text": "PERMANENT RESIDENT CARD\nHolder Name: Priya Sharma",
    }
    sib_hydro = {
        "title": "Sibling_Hydro.pdf",
        "category": "financial_evidence",
        "person_role": "canadian_crs_sibling",
        "extracted_text": "Hydro One Utility Bill\nHolder Name: Priya Sharma\nToronto, ON M5V 2H1",
    }
    cousin_birth_unrelated_parents = {
        "title": "Cousin_Birth.pdf",
        "category": "civil_status_family",
        "person_role": "canadian_crs_sibling",
        "extracted_text": "Child Name: Priya Sharma\nName of Father: Suresh Verma\nName of Mother: Kavita Verma",
    }

    # Case A: Missing Canadian residency utility/lease proof
    res_no_res = SponsorIntelligenceEngine.evaluate_crs_sibling_points(
        [
            pa_birth,
            sib_pr,
            {
                "title": "Sibling_Birth.pdf",
                "category": "civil_status_family",
                "person_role": "canadian_crs_sibling",
                "extracted_text": "Child Name: Priya Sharma\nName of Father: Rajesh Sharma",
            },
        ]
    )
    assert res_no_res["eligible_for_15_crs_points"] is False
    assert res_no_res["crs_points_awarded"] == 0
    assert res_no_res["prongs"]["status_verified"] is True
    assert res_no_res["prongs"]["residency_verified"] is False
    assert res_no_res["prongs"]["shared_parent_verified"] is True
    assert any("residential address" in m.lower() for m in res_no_res["missing_evidence"])

    # Case B: Cousin (parents do NOT match) -> shared_parent_verified is False
    res_cousin = SponsorIntelligenceEngine.evaluate_crs_sibling_points(
        [pa_birth, sib_pr, sib_hydro, cousin_birth_unrelated_parents]
    )
    assert res_cousin["eligible_for_15_crs_points"] is False
    assert res_cousin["crs_points_awarded"] == 0
    assert res_cousin["prongs"]["shared_parent_verified"] is False
    assert any("common parent" in m.lower() for m in res_cousin["missing_evidence"])


# ===========================================================================
# 3. UK 28-Day & Sponsor Check, AU VEVO/ATO Check & Universal Guardrails
# ===========================================================================


def test_uk_28_day_funds_share_code_p60_and_council_tax():
    """Verifies UKVI 28-day consecutive balance, 31-day statement recency, Share Code, HMRC P60, and Council Tax."""
    as_of = datetime(2026, 11, 10, tzinfo=timezone.utc)
    uk_docs = [
        {
            "title": "Barclays_28Day_Statement.pdf",
            "category": "financial_evidence",
            "extracted_fields": {
                "minimum_balance_observed": "8450.00",
                "statement_period_start": "2026-10-01",
                "statement_period_end": "2026-11-02",
            },
            "extracted_text": (
                "Barclays Bank UK PLC Account Statement\n"
                "Statement Period: 2026-10-01 to 2026-11-02 (33 consecutive days)\n"
                "Opening Balance: £8,450.00\n"
                "Closing Balance: £9,200.00"
            ),
        },
        {
            "title": "UK_Sponsor_eVisa_ShareCode.pdf",
            "category": "government_correspondence",
            "extracted_text": (
                "UK Visas and Immigration — eVisa Indefinite Leave to Remain\n"
                "Sponsor Name: Vikram Mehta\n"
                "Share Code: W8K-492-71M"
            ),
        },
        {
            "title": "UK_Sponsor_HMRC_P60.pdf",
            "category": "financial_evidence",
            "extracted_text": (
                "HM Revenue & Customs — P60 End of Year Certificate\n"
                "Employee: Vikram Mehta\n"
                "Total pay in this employment: £64,500.00"
            ),
        },
        {
            "title": "Camden_Council_Tax_2026.pdf",
            "category": "other_evidence",
            "extracted_text": (
                "London Borough of Camden — Council Tax Bill 2026/27\n"
                "Property: 14 Baker Street, London NW1 6XE"
            ),
        },
    ]

    res = SponsorIntelligenceEngine.evaluate_uk_sponsor_and_funds(
        uk_docs, required_floor_gbp=5000.0, as_of_date=as_of
    )
    assert res["is_compliant"] is True
    assert res["twenty_eight_day_rule_met"] is True
    assert res["days_covered"] >= 28
    assert res["statement_within_31_days"] is True
    assert res["sponsor_status_verified"] is True
    assert res["share_code_detected"] == "W8K-492-71M"
    assert res["hmrc_income_verified"] is True
    assert res["documented_income_gbp"] == 64500.0
    assert res["accommodation_verified"] is True
    assert res["missing_evidence"] == []


def test_au_subclass_600_vevo_ato_noa_and_form_1149():
    """Verifies Australia Subclass 600 VEVO active visa check, ATO Notice of Assessment, and Form 1149."""
    au_docs = [
        {
            "title": "Sponsor_VEVO_Check.pdf",
            "category": "government_correspondence",
            "extracted_text": (
                "Australian Government — Visa Entitlement Verification Online (VEVO)\n"
                "Family Name: DESAI  Given Name: NEHA\n"
                "VisaGrantNumber: 0084920193847\n"
                "Visa Status: In Effect (Permanent Resident)"
            ),
        },
        {
            "title": "Sponsor_ATO_NOA_2025.pdf",
            "category": "financial_evidence",
            "extracted_text": (
                "Australian Taxation Office — Notice of Assessment\n"
                "Resident of New South Wales, Sydney\n"
                "Your taxable income is $118,400.00 AUD"
            ),
        },
        {
            "title": "Sponsor_Form_1149_and_Rates.pdf",
            "category": "other_evidence",
            "extracted_text": (
                "Form 1149 — Application for sponsorship for Sponsored Family Visitors\n"
                "City of Parramatta Council Rates Notice — New South Wales"
            ),
        },
    ]

    res = SponsorIntelligenceEngine.evaluate_au_sponsor_evidence(au_docs)
    assert res["is_compliant"] is True
    assert res["vevo_or_status_verified"] is True
    assert res["ato_noa_verified"] is True
    assert res["taxable_income_aud"] == 118400.0
    assert res["has_form_1149"] is True
    assert res["has_au_address_proof"] is True
    assert res["missing_evidence"] == []


def test_universal_guardrails_six_month_passport_and_lump_sum_spike():
    """Verifies <6-month passport expiry warning and sharp closing-balance lump-sum spike warning."""
    ref_dt = datetime(2026, 11, 1, tzinfo=timezone.utc)
    docs = [
        {
            "title": "Near_Expiry_Passport.pdf",
            "category": "identity_passport",
            "extracted_fields": {"passport_number": "Z9988776", "date_of_expiry": "2027-02-15"},
            "extracted_text": "REPUBLIC OF INDIA PASSPORT\nDate of Expiry: 2027-02-15",
        },
        {
            "title": "Spiked_Bank_Statement.pdf",
            "category": "financial_evidence",
            "extracted_fields": {"opening_balance": "2200.00", "closing_balance": "48500.00"},
            "extracted_text": (
                "HDFC Bank Account Statement\n"
                "Opening Balance: 2,200.00\n"
                "Closing Balance: 48,500.00"
            ),
        },
    ]

    guard = SponsorIntelligenceEngine.evaluate_universal_guardrails(docs, as_of_date=ref_dt)
    assert guard["passport_six_month_warning"] is True
    assert guard["passport_warnings"][0]["days_remaining"] < 180
    assert guard["unexplained_lump_sum_warning"] is True
    assert len(guard["lump_sum_warnings"]) >= 1


# ===========================================================================
# 4. Statutory Pathway Checklists (`checklist_engine.py`)
# ===========================================================================


def test_new_sponsor_checklists_and_express_entry_optional_sibling_item():
    """Verifies CA-SUPER-VISA, CA-VISITOR-TRV, UK-VISITOR-SPONSOR, AU-SUBCLASS-600-SPONSOR, and optional +15 CRS item."""
    for key in (
        "CA-SUPER-VISA",
        "CA-VISITOR-TRV",
        "UK-VISITOR-SPONSOR",
        "AU-SUBCLASS-600-SPONSOR",
        "EXPRESS_ENTRY",
        "CA-EXPRESS-ENTRY",
    ):
        assert key in PATHWAY_CHECKLISTS

    sv_report = audit_case_checklist("CA", "CA-SUPER-VISA", [])
    assert sv_report.total_mandatory >= 7
    sv_ids = {it.item_id for it in sv_report.items}
    assert "casuper_cra_noa_lico" in sv_ids
    assert "casuper_medical_insurance" in sv_ids

    ee_report = audit_case_checklist("CA", "CA-EXPRESS-ENTRY", [])
    sib_items = [it for it in ee_report.items if it.item_id == "ca_ee_crs_sibling_proof"]
    assert len(sib_items) == 1
    assert sib_items[0].is_mandatory is False
    assert "+15 CRS" in sib_items[0].label

    uk_sp_report = audit_case_checklist("UK", "UK-VISITOR-SPONSOR", [])
    assert any("Share Code" in it.label for it in uk_sp_report.items)

    au_sp_report = audit_case_checklist("AU", "AU-SUBCLASS-600-SPONSOR", [])
    assert any("VEVO" in it.label for it in au_sp_report.items)


# ===========================================================================
# 5. Role-Aware Cross-Document Discrepancy Suppression
# ===========================================================================


def test_role_aware_discrepancy_suppression_toronto_sponsor_vs_ahmedabad_applicant(db):
    """
    Ensures a Sponsor's CRA NOA in Toronto does NOT trigger false Name Mismatch or
    Address Contradiction anomalies against a Principal Applicant in Ahmedabad,
    recording 'Attributed to Overseas Sponsor / Family Contributor' instead.
    """
    assert are_roles_distinct_persons("principal_applicant", "overseas_sponsor_host") is True
    assert are_roles_distinct_persons("principal_applicant", "canadian_crs_sibling") is True
    assert are_roles_distinct_persons("principal_applicant", "spouse_partner") is True
    assert are_roles_distinct_persons("principal_applicant", "principal_applicant") is False

    principal_profile = {
        "full_name": "Rameshbhai Sharma",
        "date_of_birth": "1962-05-14",
        "address": "14 Navrangpura Society, Ahmedabad, Gujarat 380009, India",
    }

    packet_docs = [
        {
            "id": "doc-pa-passport",
            "title": "Applicant_Indian_Passport.pdf",
            "category": "identity_passport",
            "extracted_fields": [
                {"field_name": "full_name", "normalized_value": "Rameshbhai Sharma"},
                {"field_name": "date_of_birth", "normalized_value": "1962-05-14"},
                {"field_name": "address", "normalized_value": "14 Navrangpura Society, Ahmedabad, Gujarat 380009, India"},
            ],
            "extracted_text": "REPUBLIC OF INDIA PASSPORT\nHolder: Rameshbhai Sharma\nAhmedabad 380009",
        },
        {
            "id": "doc-sponsor-noa",
            "title": "Sponsor_Toronto_CRA_NOA.pdf",
            "category": "financial_evidence",
            "extracted_fields": [
                {"field_name": "taxpayer_name", "normalized_value": "Rohan Sharma"},
                {"field_name": "address", "normalized_value": "88 Bay Street, Suite 1402, Toronto, ON M5J 2T3, Canada"},
                {"field_name": "cra_line_15000_income", "normalized_value": "92400.00"},
            ],
            "extracted_text": (
                "Canada Revenue Agency — Notice of Assessment\n"
                "Taxpayer Name: Rohan Sharma\n"
                "Address: 88 Bay Street, Suite 1402, Toronto, ON M5J 2T3\n"
                "Line 15000 - Total income: $92,400.00"
            ),
        },
    ]

    audit = evaluate_role_aware_consistency(principal_profile, packet_docs, pathway="CA-SUPER-VISA")
    assert audit["anomalies_count"] == 0
    assert audit["anomalies"] == []
    assert audit["contributor_attributions_count"] == 1
    assert audit["contributor_attributions"][0]["person_role"] == "overseas_sponsor_host"
    assert audit["contributor_attributions"][0]["association_note"] == CONTRIBUTOR_ASSOCIATION_NOTE

    # Also verify `evaluate_document_six_dimensions` suppresses pre-existing false cross-role findings
    org = Organization(name="SuperVisa Law LLP", slug=f"svlaw-{uuid.uuid4().hex[:6]}")
    db.add(org)
    db.flush()

    user = User(
        email=f"ramesh-{uuid.uuid4().hex[:6]}@example.com",
        full_name="Rameshbhai Sharma",
        password_hash=hash_password("Pass1234!"),
        status="active",
    )
    db.add(user)
    db.flush()

    cp = ClientProfile(
        organization_id=org.id,
        user_id=user.id,
        first_name="Rameshbhai",
        last_name="Sharma",
        email=user.email,
        nationality="IND",
    )
    db.add(cp)
    db.flush()

    case = ImmigrationCase(
        organization_id=org.id,
        client_id=cp.id,
        case_number=f"CA-SV-{uuid.uuid4().hex[:4].upper()}",
        title="Rameshbhai Sharma Super Visa",
        jurisdiction="CA",
        visa_category="CA-SUPER-VISA",
        status="processing",
    )
    db.add(case)
    db.flush()

    sponsor_doc = Document(
        organization_id=org.id,
        case_id=case.id,
        client_id=cp.id,
        title="Sponsor_Toronto_CRA_NOA.pdf",
        filename="Sponsor_Toronto_CRA_NOA.pdf",
        category="financial_evidence",
        storage_path="mock/sponsor_noa.pdf",
        sha256_hash="a" * 64,
        byte_size=4096,
        mime_type="application/pdf",
        page_count=1,
        version=1,
        is_current_version=True,
        processing_status="completed",
        verification_status="verified",
        extracted_text=(
            "Canada Revenue Agency — Notice of Assessment\n"
            "Taxpayer Name: Rohan Sharma\n"
            "88 Bay Street, Toronto, ON M5J 2T3\n"
            "Line 15000 - Total income: $92,400.00"
        ),
    )
    db.add(sponsor_doc)
    db.flush()

    false_cross_finding = CaseAIFinding(
        organization_id=org.id,
        case_id=case.id,
        document_id=sponsor_doc.id,
        finding_type="consistency_discrepancy",
        severity="critical",
        status="needs_review",
        title="Name Mismatch against Principal Applicant",
        description="Address Contradiction between Toronto ON and Ahmedabad client record",
        recommended_action="Verify identity",
        uncertainty_limitations="Automated check",
    )
    db.add(false_cross_finding)
    db.commit()

    six_dim = evaluate_document_six_dimensions(
        sponsor_doc,
        case=case,
        case_docs=[sponsor_doc],
        unresolved_findings=[false_cross_finding],
    )
    assert six_dim.consistency.status == "passed"
    assert six_dim.consistency.details["discrepancies_count"] == 0
    assert six_dim.consistency.details["suppressed_cross_role_findings_count"] == 1
    assert six_dim.consistency.details["association_note"] == CONTRIBUTOR_ASSOCIATION_NOTE
    assert six_dim.applicant_association.details["association_note"] == CONTRIBUTOR_ASSOCIATION_NOTE


# ===========================================================================
# 6. Lazy `/page-preview`, `/analyze` Optimization & Unified `/smart-intake`
# ===========================================================================


def test_lazy_page_preview_and_lightweight_analyze():
    """Verifies fast lazy `/page-preview` (<80ms render) and `include_page_images=false` on `/analyze`."""
    pdf_bytes = _make_pdf_bytes(
        [
            "PAGE 1: REPUBLIC OF INDIA PASSPORT\nSurname: SHARMA\nGiven Names: AARAV\nPassport No: Z8492014",
            "PAGE 2: CANADA REVENUE AGENCY NOTICE OF ASSESSMENT\nTaxpayer Name: Rohan Sharma\nLine 15000: $88,000.00",
            "PAGE 3: MANULIFE SUPER VISA MEDICAL INSURANCE\nCoverage Amount: $100,000 CAD\nDuration: 365 days",
        ]
    )

    # Warm up FastAPI/TestClient middleware once, then measure lazy single-page preview latency (<80ms)
    warmup_resp = api_client.post(
        "/api/v1/extractor/page-preview",
        files={"file": ("three_page_packet.pdf", pdf_bytes, "application/pdf")},
        data={"page_number": "1", "dpi": "130"},
    )
    assert warmup_resp.status_code == 200

    t0 = time.perf_counter()
    prev_resp = api_client.post(
        "/api/v1/extractor/page-preview",
        files={"file": ("three_page_packet.pdf", pdf_bytes, "application/pdf")},
        data={"page_number": "2", "dpi": "130"},
    )
    elapsed_ms = (time.perf_counter() - t0) * 1000.0
    assert prev_resp.status_code == 200
    prev_json = prev_resp.json()
    assert prev_json["page_number"] == 2
    assert prev_json["page_count"] == 3
    assert prev_json["preview_image_b64"].startswith("data:image/jpeg;base64,")
    assert prev_json["render_ms"] < 250.0
    assert elapsed_ms < 500.0

    # Out-of-bounds page returns 400
    bad_resp = api_client.post(
        "/api/v1/extractor/page-preview",
        files={"file": ("three_page_packet.pdf", pdf_bytes, "application/pdf")},
        data={"page_number": "9", "dpi": "130"},
    )
    assert bad_resp.status_code == 400

    # Lightweight `/analyze` with include_page_images=false
    an_resp = api_client.post(
        "/api/v1/extractor/analyze",
        files={"file": ("Sponsor_NOA.pdf", _make_pdf_bytes(["Canada Revenue Agency\nNotice of Assessment\nTaxpayer Name: Rohan Sharma\nLine 15000 - Total income: $76,500.00"]), "application/pdf")},
        data={"include_page_images": "false"},
    )
    assert an_resp.status_code == 200
    an_json = an_resp.json()
    assert an_json["ocr_summary"]["pages"][0]["page_image_data_url"] is None
    spec = an_json["specialized_intelligence"]
    assert "barcodes" in spec
    assert spec["role_attribution"]["person_role"] == "overseas_sponsor_host"
    assert spec["sponsor_statutory_intelligence"]["super_visa_lico"]["documented_income_cad"] == 76500.0


def test_smart_intake_multi_file_and_merged_multi_person_pdf():
    """
    Verifies `POST /api/v1/extractor/smart-intake` on:
    1) Merged multi-document family + overseas sponsor PDF (Super Visa packet)
    2) Multi-file Express Entry +15 CRS sibling drop
    """
    merged_super_visa_pdf = _make_pdf_bytes(
        [
            (
                "REPUBLIC OF INDIA / PASSPORT\n"
                "Type: P  Country Code: IND  Passport No: Z8492014\n"
                "Surname: SHARMA\n"
                "Given Name(s): RAMESHBHAI\n"
                "Date of Birth: 14/05/1962\n"
                "Date of Expiry: 14/05/2032\n"
                "Address: 14 Navrangpura, Ahmedabad, Gujarat 380009"
            ),
            (
                "CANADA REVENUE AGENCY\n"
                "NOTICE OF ASSESSMENT — TAX YEAR 2025\n"
                "Taxpayer Name: Rohan Sharma\n"
                "Address: 88 Bay Street, Toronto, Ontario M5J 2T3\n"
                "Line 15000 - Total income: $84,500.00"
            ),
            (
                "MANULIFE FINANCIAL — SUPER VISA MEDICAL INSURANCE POLICY\n"
                "Insured Person: Rameshbhai Sharma\n"
                "Emergency Medical Coverage Amount: $100,000 CAD\n"
                "Policy Duration: 365 days"
            ),
        ]
    )

    resp_merged = api_client.post(
        "/api/v1/extractor/smart-intake",
        files=[("files", ("Merged_Family_SuperVisa_Packet.pdf", merged_super_visa_pdf, "application/pdf"))],
        data={"pathway": "CA-SUPER-VISA", "family_size": "4"},
    )
    assert resp_merged.status_code == 200
    body = resp_merged.json()
    assert body["status"] == "success"
    assert body["logical_documents_count"] >= 2
    roles_detected = {d["person_role"] for d in body["documents"]}
    assert "overseas_sponsor_host" in roles_detected
    lico = body["sponsor_statutory_intelligence"]["super_visa_lico"]
    assert lico["is_met"] is True
    assert lico["documented_income_cad"] == 84500.0
    assert lico["required_lico_cad"] == 54594.0
    assert lico["insurance_compliant"] is True
    assert body["role_aware_consistency"]["anomalies_count"] == 0
    assert len(body["prefill_candidates"]) >= 1
    assert all(c["requires_user_confirmation"] is True for c in body["prefill_candidates"])

    # Multi-file Express Entry +15 CRS Sibling drop
    pa_bc_pdf = _make_pdf_bytes(
        ["BIRTH CERTIFICATE\nChild Name: Aarav Sharma\nName of Father: Rajesh Sharma\nName of Mother: Meena Sharma"]
    )
    sib_pr_pdf = _make_pdf_bytes(
        ["GOVERNMENT OF CANADA\nPERMANENT RESIDENT CARD\nHolder Name: Priya Sharma\nID No: 9921-4410"]
    )
    sib_hydro_pdf = _make_pdf_bytes(
        ["Hydro One Electricity Utility Bill\nHolder Name: Priya Sharma\nService Address: 55 Front St W, Toronto, ON M5J 1E6"]
    )
    sib_bc_pdf = _make_pdf_bytes(
        ["BIRTH CERTIFICATE\nChild Name: Priya Sharma\nName of Father: Rajesh Sharma\nName of Mother: Meena Sharma"]
    )

    resp_ee = api_client.post(
        "/api/v1/extractor/smart-intake",
        files=[
            ("files", ("PA_Birth_Cert.pdf", pa_bc_pdf, "application/pdf")),
            ("files", ("Sibling_PR_Card.pdf", sib_pr_pdf, "application/pdf")),
            ("files", ("Sibling_Hydro_Bill.pdf", sib_hydro_pdf, "application/pdf")),
            ("files", ("Sibling_Birth_Cert.pdf", sib_bc_pdf, "application/pdf")),
        ],
        data={"pathway": "CA-EXPRESS-ENTRY", "family_size": "2"},
    )
    assert resp_ee.status_code == 200
    ee_body = resp_ee.json()
    crs = ee_body["sponsor_statutory_intelligence"]["crs_sibling_points"]
    assert crs["eligible_for_15_crs_points"] is True
    assert crs["crs_points_awarded"] == 15


# ===========================================================================
# 7. Passwordless Sponsor Upload Link & Privacy Shield Enforcement Tests
# ===========================================================================


def test_contributor_link_zero_pii_leak_and_privacy_shield_enforcement(db):
    """
    End-to-end verification of:
    1) `POST /api/v1/portal/contributor-links`
    2) `GET /api/v1/portal/contribute/{token}` (zero applicant passport/surname/SIN/DOB/address leaked!)
    3) `POST /api/v1/portal/contribute/{token}/upload` (marks checklist item `received_verified`)
    4) `GET /api/v1/portal/cases/{case_id}/sponsor-contributions`:
       - `retained_client` gets redacted Privacy Shield summary (`Verified (Privacy Shield Active)`)
       - `paralegal` and `master_admin` get full extracted text, fields, statutory details & download bytes!
    """
    org = Organization(name="Maple Immigration Counsel", slug=f"maple-{uuid.uuid4().hex[:6]}")
    db.add(org)
    db.flush()

    applicant_user = User(
        email=f"applicant-{uuid.uuid4().hex[:6]}@client.in",
        full_name="Sureshbhai SecretSurname",
        password_hash=hash_password("ClientPass123!"),
        status="active",
    )
    staff_user = User(
        email=f"paralegal-{uuid.uuid4().hex[:6]}@maplelaw.ca",
        full_name="Claire Paralegal",
        password_hash=hash_password("StaffPass123!"),
        status="active",
    )
    db.add_all([applicant_user, staff_user])
    db.flush()

    client_prof = ClientProfile(
        organization_id=org.id,
        user_id=applicant_user.id,
        first_name="Sureshbhai",
        last_name="SecretSurname",
        email=applicant_user.email,
        passport_number_hash="Z7654321",
        pan_number="ABCDE1234F",
        nationality="IND",
        date_of_birth=datetime(1959, 8, 19, tzinfo=timezone.utc),
    )
    db.add(client_prof)
    db.flush()

    case = ImmigrationCase(
        organization_id=org.id,
        client_id=client_prof.id,
        case_number=f"SV-{uuid.uuid4().hex[:5].upper()}",
        title="Sureshbhai SecretSurname Super Visa",
        jurisdiction="CA",
        visa_category="CA-SUPER-VISA",
        status="intake",
    )
    db.add(case)
    db.commit()

    client_headers = {
        "X-User-Id": str(applicant_user.id),
        "X-User-Role": "retained_client",
        "X-Org-Id": str(org.id),
    }
    paralegal_headers = {
        "X-User-Id": str(staff_user.id),
        "X-User-Role": "paralegal",
        "X-Org-Id": str(org.id),
    }
    admin_headers = {
        "X-User-Id": str(staff_user.id),
        "X-User-Role": "master_admin",
        "X-Org-Id": str(org.id),
    }

    # 1. Applicant creates passwordless contributor link for Canadian host son
    create_resp = api_client.post(
        "/api/v1/portal/contributor-links",
        headers=client_headers,
        json={
            "case_id": str(case.id),
            "sponsor_name": "Karan SecretSurname",
            "relationship": "child_host",
            "jurisdiction": "CA",
            "pathway": "CA-SUPER-VISA",
            "privacy_shield": True,
        },
    )
    assert create_resp.status_code == 201
    link_data = create_resp.json()
    token = link_data["token"]
    assert link_data["privacy_shield"] is True
    assert len(link_data["requested_items"]) >= 3

    # 2. Public GET /api/v1/portal/contribute/{token} — verify strict key whitelist & ZERO applicant PII leaked
    pub_resp = api_client.get(f"/api/v1/portal/contribute/{token}")
    assert pub_resp.status_code == 200
    pub_json = pub_resp.json()
    assert set(pub_json.keys()) == {
        "sponsor_name",
        "applicant_first_name",
        "pathway",
        "jurisdiction",
        "relationship",
        "privacy_shield",
        "requested_items",
        "uploaded_summaries",
    }
    assert pub_json["applicant_first_name"] == "Sureshbhai"
    serialized_pub = json.dumps(pub_json)
    assert "Z7654321" not in serialized_pub  # Applicant passport number NEVER leaked
    assert "1959-08-19" not in serialized_pub  # Applicant DOB NEVER leaked
    assert applicant_user.email not in serialized_pub  # Applicant email NEVER leaked

    # 3. Overseas sponsor uploads sensitive CRA NOA with SIN & exact salary under Privacy Shield
    sensitive_cra_pdf = _make_pdf_bytes(
        [
            "CANADA REVENUE AGENCY — NOTICE OF ASSESSMENT\n"
            "Taxpayer Name: Karan SecretSurname\n"
            "Social Insurance Number (SIN): 458-912-304\n"
            "Account Number: 0019283746\n"
            "Line 15000 - Total income: $96,850.00\n"
            "Address: 120 Adelaide St W, Toronto, ON M5H 1T1"
        ]
    )
    up_resp = api_client.post(
        f"/api/v1/portal/contribute/{token}/upload",
        files={"file": ("Karan_CRA_NOA_2025.pdf", sensitive_cra_pdf, "application/pdf")},
        data={"privacy_shield": "true", "family_size": "3"},
    )
    assert up_resp.status_code == 200
    up_json = up_resp.json()
    assert up_json["status"] == "received_verified"
    assert "LICO Threshold Met" in up_json["statutory_pass_badge"]
    assert any(it["status"] == "received_verified" for it in up_json["requested_items"])

    # 4A. Retained client (Applicant) queries sponsor contributions -> Privacy Shield REDACTS sensitive fields!
    client_view_resp = api_client.get(
        f"/api/v1/portal/cases/{case.id}/sponsor-contributions",
        headers=client_headers,
    )
    assert client_view_resp.status_code == 200
    client_view = client_view_resp.json()
    assert client_view["count"] == 1
    c_item = client_view["contributions"][0]
    assert c_item["status"] == "Verified (Privacy Shield Active)"
    assert c_item["subtype_label"] == "CRA Notice of Assessment (NOA)"
    assert "LICO Threshold Met" in c_item["statutory_pass_badge"]
    assert c_item["raw_text"] is None
    assert c_item["extracted_fields"] == []
    assert c_item["download_bytes_b64"] is None
    assert c_item["download_available"] is False

    serialized_client_view = json.dumps(client_view)
    assert "458-912-304" not in serialized_client_view  # SIN strictly hidden from applicant!
    assert "0019283746" not in serialized_client_view  # Account number strictly hidden from applicant!
    assert "96,850" not in serialized_client_view and "96850" not in serialized_client_view  # Exact salary hidden!

    # 4B. Paralegal & Master Admin query sponsor contributions -> FULL extracted details & download bytes!
    for staff_hdrs in (paralegal_headers, admin_headers):
        staff_view_resp = api_client.get(
            f"/api/v1/portal/cases/{case.id}/sponsor-contributions",
            headers=staff_hdrs,
        )
        assert staff_view_resp.status_code == 200
        staff_view = staff_view_resp.json()
        assert staff_view["is_firm_staff_view"] is True
        s_item = staff_view["contributions"][0]
        assert s_item["redacted"] is False
        assert "458-912-304" in s_item["raw_text"]
        assert s_item["statutory_evaluation"]["super_visa_lico"]["documented_income_cad"] == 96850.0
        assert s_item["download_bytes_b64"] is not None
        assert s_item["download_available"] is True
