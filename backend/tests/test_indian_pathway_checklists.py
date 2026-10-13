import pytest
from backend.app.ai.checklist_engine import audit_case_checklist


def test_canada_study_permit_statutory_checklist():
    """Validates Canada Study Permit checklist contains 2024 PAL mandate, GIC, and LOA."""
    report = audit_case_checklist("CA", "Canada Study Permit", [])
    assert report.total_mandatory >= 5
    assert report.satisfied_mandatory == 0
    assert report.fulfillment_percentage == 0.0

    labels = [it.label for it in report.items]
    citations = [it.requirement_citation for it in report.items]

    # Verify PAL, LOA, GIC
    assert any("Letter of Acceptance" in l for l in labels)
    assert any("Provincial Attestation Letter" in l for l in labels)
    assert any("Guaranteed Investment Certificate" in l for l in labels)
    assert any("IRPR § 219" in c for c in citations)


def test_canada_visitor_visa_statutory_checklist():
    """Validates Canada TRV / Visitor Visa checklist contains ITR, bank proof, and ties to India."""
    report = audit_case_checklist("CA", "Canada Visitor Visa (TRV & Super Visa)", [])
    labels = [it.label for it in report.items]
    assert any("Liquid Bank Statements" in l for l in labels)
    assert any("Income Tax Returns (ITR-V)" in l for l in labels)
    assert any("Employer Leave Approval" in l for l in labels)


def test_canada_sowp_statutory_checklist():
    """Validates Canada SOWP checklist contains genuine marriage proof and principal status."""
    report = audit_case_checklist("CA", "Canada Spousal Open Work Permit (SOWP)", [])
    labels = [it.label for it in report.items]
    assert any("Marriage Certificate" in l for l in labels)
    assert any("Wedding Photographs Album" in l for l in labels)
    assert any("Spouse Valid Study Permit" in l for l in labels)


def test_us_b1_b2_visitor_checklist():
    """Validates US B-1/B-2 visitor checklist reflects INA § 214(b) ties and DS-160."""
    report = audit_case_checklist("US", "US B-1/B-2 Visitor Visa", [])
    labels = [it.label for it in report.items]
    citations = [it.requirement_citation for it in report.items]
    assert any("DS-160" in l for l in labels)
    assert any("Income Tax Returns (ITR-V" in l for l in labels)
    assert any("INA § 214(b)" in c for c in citations)


def test_us_f1_student_checklist():
    """Validates US F-1 student checklist contains Form I-20, SEVIS, and funding proof."""
    report = audit_case_checklist("US", "US F-1 Academic Student Visa", [])
    labels = [it.label for it in report.items]
    citations = [it.requirement_citation for it in report.items]
    assert any("Form I-20" in l for l in labels)
    assert any("SEVIS I-901" in l for l in labels)
    assert any("Affidavit of Support" in l for l in labels)
    assert any("8 CFR § 214.2(f)" in c for c in citations)


def test_uk_visitor_and_student_checklists():
    """Validates UK Visitor and Student checklists contain Appendix V and CAS."""
    visitor_report = audit_case_checklist("GB", "UK Standard Visitor Visa", [])
    v_labels = [it.label for it in visitor_report.items]
    assert any("Bank Statements" in l for l in v_labels)
    assert any("Payslips" in l for l in v_labels)

    student_report = audit_case_checklist("GB", "UK Student Visa & Graduate Route", [])
    s_labels = [it.label for it in student_report.items]
    s_citations = [it.requirement_citation for it in student_report.items]
    assert any("Confirmation of Acceptance for Studies" in l for l in s_labels)
    assert any("28 Consecutive Days" in l for l in s_labels)
    assert any("Tuberculosis" in l for l in s_labels)
    assert any("Appendix Student" in c for c in s_citations)


def test_document_satisfaction_on_indian_pathways():
    """Validates document category mapping satisfies items on a Canada Study Permit."""
    docs = [
        {"id": "d1", "title": "Indian_Passport.pdf", "category": "identity_passport", "processing_status": "completed"},
        {"id": "d2", "title": "University_Toronto_LOA.pdf", "category": "educational_record", "processing_status": "completed"},
        {"id": "d3", "title": "Ontario_PAL_Letter.pdf", "category": "government_correspondence", "processing_status": "completed"},
        {"id": "d4", "title": "Scotiabank_GIC_Certificate.pdf", "category": "financial_evidence", "processing_status": "completed"},
    ]
    report = audit_case_checklist("CA", "Canada Study Permit", docs)
    assert report.satisfied_mandatory >= 3
    assert report.fulfillment_percentage > 30.0
