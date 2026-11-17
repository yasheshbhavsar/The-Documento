"""Pathway-specific evidentiary checklist engine.

Evaluates uploaded and verified case documents against configurable jurisdiction
and visa category statutory requirements. Identifies evidentiary gaps without making
unsupported legal determinations.
"""
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional


@dataclass
class ChecklistItem:
    item_id: str
    label: str
    requirement_citation: str
    is_mandatory: bool
    acceptable_categories: List[str]
    is_satisfied: bool = False
    matching_document_id: Optional[str] = None
    matching_document_title: Optional[str] = None
    notes: Optional[str] = None


@dataclass
class ChecklistAuditReport:
    jurisdiction: str
    visa_category: str
    items: List[ChecklistItem]
    total_mandatory: int
    satisfied_mandatory: int
    total_items: int
    satisfied_items: int
    fulfillment_percentage: float
    missing_items: List[ChecklistItem] = field(default_factory=list)
    is_pinned: bool = False
    version: Optional[str] = None


PATHWAY_CHECKLISTS: Dict[str, List[Dict[str, Any]]] = {
    "EB-1A": [
        {
            "item_id": "eb1a_passport",
            "label": "Primary Passport & Identity Record",
            "requirement_citation": "8 CFR § 103.2(b)(1) - Primary Identification",
            "is_mandatory": True,
            "acceptable_categories": ["identity_passport"],
        },
        {
            "item_id": "eb1a_cv",
            "label": "Comprehensive Curriculum Vitae / Resume",
            "requirement_citation": "Evidentiary Foundation - Professional Background",
            "is_mandatory": True,
            "acceptable_categories": ["employment_record", "other_evidence"],
        },
        {
            "item_id": "eb1a_degree",
            "label": "Highest Academic Degree or Diploma",
            "requirement_citation": "Educational Background & Credentials",
            "is_mandatory": False,
            "acceptable_categories": ["educational_record"],
        },
        {
            "item_id": "eb1a_peer_review",
            "label": "Judging of the Work of Others (Peer Review)",
            "requirement_citation": "8 CFR § 204.5(h)(3)(iv) - Participation as a Judge",
            "is_mandatory": False,
            "acceptable_categories": ["other_evidence", "employment_record"],
        },
        {
            "item_id": "eb1a_scholarly_articles",
            "label": "Authorship of Scholarly Articles / Publications",
            "requirement_citation": "8 CFR § 204.5(h)(3)(vi) - Authorship of Articles",
            "is_mandatory": False,
            "acceptable_categories": ["other_evidence"],
        },
        {
            "item_id": "eb1a_critical_role",
            "label": "Leading or Critical Role for Distinguished Organizations",
            "requirement_citation": "8 CFR § 204.5(h)(3)(viii) - Critical Role",
            "is_mandatory": False,
            "acceptable_categories": ["employment_record", "other_evidence"],
        },
        {
            "item_id": "eb1a_original_contribution",
            "label": "Original Contributions of Major Significance",
            "requirement_citation": "8 CFR § 204.5(h)(3)(v) - Major Contributions",
            "is_mandatory": False,
            "acceptable_categories": ["other_evidence", "employment_record"],
        },
    ],
    "O-1A": [
        {
            "item_id": "o1a_passport",
            "label": "Valid Passport Biodata Page",
            "requirement_citation": "8 CFR § 214.2(o)(2) - Alien Identity",
            "is_mandatory": True,
            "acceptable_categories": ["identity_passport"],
        },
        {
            "item_id": "o1a_contract",
            "label": "Written Employment Contract / Deal Memo / Itinerary",
            "requirement_citation": "8 CFR § 214.2(o)(2)(ii)(B) - Agreement Terms",
            "is_mandatory": True,
            "acceptable_categories": ["employment_record", "government_correspondence"],
        },
        {
            "item_id": "o1a_consultation",
            "label": "Peer Group / Labor Union Advisory Consultation",
            "requirement_citation": "8 CFR § 214.2(o)(5) - Consultation Requirement",
            "is_mandatory": True,
            "acceptable_categories": ["other_evidence", "government_correspondence"],
        },
        {
            "item_id": "o1a_high_remuneration",
            "label": "High Salary or Significant Remuneration Evidence",
            "requirement_citation": "8 CFR § 214.2(o)(3)(iii)(B)(8) - High Salary",
            "is_mandatory": False,
            "acceptable_categories": ["financial_evidence", "employment_record"],
        },
    ],
    "EB-2": [
        {
            "item_id": "eb2_passport",
            "label": "Valid Passport Record",
            "requirement_citation": "8 CFR § 204.5(k)(1)",
            "is_mandatory": True,
            "acceptable_categories": ["identity_passport"],
        },
        {
            "item_id": "eb2_advanced_degree",
            "label": "Advanced Degree (Master's or Foreign Equivalent)",
            "requirement_citation": "8 CFR § 204.5(k)(2) - Advanced Degree",
            "is_mandatory": True,
            "acceptable_categories": ["educational_record"],
        },
        {
            "item_id": "eb2_niw_statement",
            "label": "National Interest Waiver Matter of Dhanasar Statement",
            "requirement_citation": "Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016)",
            "is_mandatory": True,
            "acceptable_categories": ["other_evidence", "government_correspondence"],
        },
        {
            "item_id": "eb2_expert_letters",
            "label": "Independent Expert Recommendation Letters",
            "requirement_citation": "Matter of Dhanasar Prong II (Well-Positioned)",
            "is_mandatory": False,
            "acceptable_categories": ["other_evidence", "employment_record"],
        },
    ],
    "H-1B": [
        {
            "item_id": "h1b_passport",
            "label": "Beneficiary Passport Biodata",
            "requirement_citation": "8 CFR § 214.2(h)(2)(i)(A)",
            "is_mandatory": True,
            "acceptable_categories": ["identity_passport"],
        },
        {
            "item_id": "h1b_degree",
            "label": "Bachelor's Degree or Equivalent in Specialty Field",
            "requirement_citation": "INA § 214(i)(1) - Specialty Degree",
            "is_mandatory": True,
            "acceptable_categories": ["educational_record"],
        },
        {
            "item_id": "h1b_lca",
            "label": "Certified Labor Condition Application (Form ETA-9035)",
            "requirement_citation": "20 CFR § 655.700 - DOL Certification",
            "is_mandatory": True,
            "acceptable_categories": ["government_correspondence", "other_evidence"],
        },
        {
            "item_id": "h1b_job_offer",
            "label": "Employer Support & Detailed Job Offer Letter",
            "requirement_citation": "8 CFR § 214.2(h)(4)(iii)(A) - Specialty Criteria",
            "is_mandatory": True,
            "acceptable_categories": ["employment_record"],
        },
    ],
    "US-B1B2-VISITOR": [
        {
            "item_id": "usb1b2_passport",
            "label": "Valid Passport (Min 6 Months Post-Stay Validity)",
            "requirement_citation": "INA § 221; 8 CFR § 214.1 - Travel Document",
            "is_mandatory": True,
            "acceptable_categories": ["identity_passport"],
        },
        {
            "item_id": "usb1b2_ds160",
            "label": "Form DS-160 Nonimmigrant Visa Confirmation Page",
            "requirement_citation": "22 CFR § 41.103 - Online Application Form",
            "is_mandatory": True,
            "acceptable_categories": ["government_correspondence", "other_evidence"],
        },
        {
            "item_id": "usb1b2_financials",
            "label": "6 Months Liquid Bank Statements & Proof of Funds",
            "requirement_citation": "9 FAM 402.2 - Financial Sufficiency",
            "is_mandatory": True,
            "acceptable_categories": ["financial_evidence"],
        },
        {
            "item_id": "usb1b2_tax_returns",
            "label": "3 Consecutive Years Income Tax Returns (ITR-V / Form 16)",
            "requirement_citation": "INA § 214(b) - Economic Ties to India",
            "is_mandatory": True,
            "acceptable_categories": ["financial_evidence", "employment_record"],
        },
        {
            "item_id": "usb1b2_employment_leave",
            "label": "Employer Leave Sanction & No-Objection Letter (NOC)",
            "requirement_citation": "INA § 214(b) - Employment Ties to India",
            "is_mandatory": True,
            "acceptable_categories": ["employment_record"],
        },
        {
            "item_id": "usb1b2_invitation_itinerary",
            "label": "Host Invitation Letter / Travel Itinerary & Form I-134",
            "requirement_citation": "9 FAM 402.2 - Purpose of Travel",
            "is_mandatory": False,
            "acceptable_categories": ["other_evidence", "government_correspondence"],
        },
    ],
    "US-F1-STUDENT": [
        {
            "item_id": "usf1_passport",
            "label": "Valid Student Passport Biodata",
            "requirement_citation": "INA § 221 - Primary Identity",
            "is_mandatory": True,
            "acceptable_categories": ["identity_passport"],
        },
        {
            "item_id": "usf1_i20",
            "label": "Form I-20 Certificate of Eligibility (SEVP Certified)",
            "requirement_citation": "8 CFR § 214.2(f)(1)(i) - SEVP Form I-20",
            "is_mandatory": True,
            "acceptable_categories": ["government_correspondence", "educational_record"],
        },
        {
            "item_id": "usf1_sevis_fee",
            "label": "SEVIS I-901 Fee Payment Receipt ($350)",
            "requirement_citation": "8 CFR § 214.13 - SEVIS Fee",
            "is_mandatory": True,
            "acceptable_categories": ["financial_evidence", "government_correspondence"],
        },
        {
            "item_id": "usf1_liquid_funds",
            "label": "Liquid Financial Proof (Year 1 Tuition + Living Costs)",
            "requirement_citation": "8 CFR § 214.2(f)(1)(i)(B) - Financial Capability",
            "is_mandatory": True,
            "acceptable_categories": ["financial_evidence"],
        },
        {
            "item_id": "usf1_sponsor_affidavit",
            "label": "Parent/Sponsor Affidavit of Support & 3-Year ITRs",
            "requirement_citation": "INA § 214(b) - Financial Sponsorship Source",
            "is_mandatory": True,
            "acceptable_categories": ["financial_evidence", "other_evidence"],
        },
        {
            "item_id": "usf1_academic_transcripts",
            "label": "Academic Transcripts, Marksheets & Degree Certificates",
            "requirement_citation": "Academic Foundation & Preparation",
            "is_mandatory": True,
            "acceptable_categories": ["educational_record"],
        },
        {
            "item_id": "usf1_test_scores",
            "label": "Standardized Test Scores (GRE/GMAT, TOEFL/IELTS/Duolingo)",
            "requirement_citation": "University Admission Verification",
            "is_mandatory": False,
            "acceptable_categories": ["educational_record", "other_evidence"],
        },
    ],
    "US-H4-DEPENDENT": [
        {
            "item_id": "ush4_passport",
            "label": "Valid Beneficiary Passport",
            "requirement_citation": "8 CFR § 214.2(h)(9)(iv) - Dependent Travel Document",
            "is_mandatory": True,
            "acceptable_categories": ["identity_passport"],
        },
        {
            "item_id": "ush4_principal_i797",
            "label": "Principal H-1B Holder Form I-797 Approval Notice",
            "requirement_citation": "8 CFR § 214.2(h)(9)(iv) - Principal Status Linkage",
            "is_mandatory": True,
            "acceptable_categories": ["government_correspondence"],
        },
        {
            "item_id": "ush4_marriage_birth_cert",
            "label": "Registered Marriage Certificate / Child Birth Certificate",
            "requirement_citation": "INA § 101(a)(15)(H) - Qualifying Family Relationship",
            "is_mandatory": True,
            "acceptable_categories": ["civil_status"],
        },
        {
            "item_id": "ush4_principal_paystubs",
            "label": "Principal Worker Recent 3 Paystubs & Form W-2",
            "requirement_citation": "Status Maintenance & Financial Support",
            "is_mandatory": True,
            "acceptable_categories": ["employment_record", "financial_evidence"],
        },
    ],
    "CA-STUDY-PERMIT": [
        {
            "item_id": "castudy_passport",
            "label": "Valid Passport (Min 6 Months Validity)",
            "requirement_citation": "IRPR § 52 - Valid Travel Document",
            "is_mandatory": True,
            "acceptable_categories": ["identity_passport"],
        },
        {
            "item_id": "castudy_loa",
            "label": "Letter of Acceptance (LOA) from Designated Learning Inst. (DLI)",
            "requirement_citation": "IRPR § 219 - Acceptance by DLI",
            "is_mandatory": True,
            "acceptable_categories": ["educational_record", "government_correspondence"],
        },
        {
            "item_id": "castudy_pal",
            "label": "Provincial Attestation Letter (PAL) from Province/Territory",
            "requirement_citation": "IRCC 2024 Ministerial Instructions - PAL Mandate",
            "is_mandatory": True,
            "acceptable_categories": ["government_correspondence", "educational_record"],
        },
        {
            "item_id": "castudy_gic_funds",
            "label": "Guaranteed Investment Certificate (GIC $20,635 CAD) / Bank Proof",
            "requirement_citation": "IRPR § 220 - Financial Sufficiency",
            "is_mandatory": True,
            "acceptable_categories": ["financial_evidence"],
        },
        {
            "item_id": "castudy_tuition_receipt",
            "label": "First-Year Tuition Fee Payment Official Receipt",
            "requirement_citation": "IRPR § 220 - Tuition Clearance",
            "is_mandatory": True,
            "acceptable_categories": ["financial_evidence", "educational_record"],
        },
        {
            "item_id": "castudy_language_test",
            "label": "Language Test Score Card (IELTS Academic / PTE)",
            "requirement_citation": "IRCC Student Direct Stream Standards",
            "is_mandatory": True,
            "acceptable_categories": ["educational_record", "other_evidence"],
        },
        {
            "item_id": "castudy_sop",
            "label": "Statement of Purpose (SOP) & Intent to Depart Canada",
            "requirement_citation": "IRPR § 216(1) - Temporary Resident Intent",
            "is_mandatory": True,
            "acceptable_categories": ["other_evidence"],
        },
        {
            "item_id": "castudy_transcripts",
            "label": "10th, 12th Board Marksheets & Post-Secondary Degrees",
            "requirement_citation": "Academic Credential Record",
            "is_mandatory": True,
            "acceptable_categories": ["educational_record"],
        },
        {
            "item_id": "castudy_emedical",
            "label": "Upfront eMedical Examination Sheet from Panel Physician",
            "requirement_citation": "IRPR § 30 - Medical Inadmissibility Clearance",
            "is_mandatory": True,
            "acceptable_categories": ["other_evidence", "government_correspondence"],
        },
    ],
    "CA-VISITOR-TRV": [
        {
            "item_id": "catrv_passport",
            "label": "Valid Indian Passport",
            "requirement_citation": "IRPR § 52 - Travel Document",
            "is_mandatory": True,
            "acceptable_categories": ["identity_passport"],
        },
        {
            "item_id": "catrv_itinerary",
            "label": "Purpose of Travel & Detailed Day-by-Day Itinerary",
            "requirement_citation": "IRPR § 179 - Purpose of Stay",
            "is_mandatory": True,
            "acceptable_categories": ["other_evidence"],
        },
        {
            "item_id": "catrv_invitation",
            "label": "Host Invitation Letter & Status Proof in Canada (PR/Citizen/NOA)",
            "requirement_citation": "IRPR § 179(b) - Host Verification",
            "is_mandatory": True,
            "acceptable_categories": ["other_evidence", "government_correspondence"],
        },
        {
            "item_id": "catrv_bank_proof",
            "label": "6 Months Liquid Bank Statements with Bank Seal",
            "requirement_citation": "IRPR § 179(c) - Financial Resources",
            "is_mandatory": True,
            "acceptable_categories": ["financial_evidence"],
        },
        {
            "item_id": "catrv_itr_tax",
            "label": "3 Consecutive Years Income Tax Returns (ITR-V) & Form 16",
            "requirement_citation": "Financial Sufficiency & Verification",
            "is_mandatory": True,
            "acceptable_categories": ["financial_evidence", "employment_record"],
        },
        {
            "item_id": "catrv_ca_networth",
            "label": "Chartered Accountant Net Worth Certificate & Property Valuations",
            "requirement_citation": "IRPR § 179(b) - Economic Ties to India",
            "is_mandatory": False,
            "acceptable_categories": ["financial_evidence", "other_evidence"],
        },
        {
            "item_id": "catrv_employment_noc",
            "label": "Employer Leave Approval & No Objection Certificate (NOC)",
            "requirement_citation": "IRPR § 179(b) - Employment Ties to India",
            "is_mandatory": True,
            "acceptable_categories": ["employment_record"],
        },
        {
            "item_id": "catrv_host_residency_noa",
            "label": "Canadian Host PR/Citizen Proof, Residency Utility/Lease & CRA NOA (If Hosted)",
            "requirement_citation": "IRPR § 179(b) - Canadian Host Residency & Financial Support",
            "is_mandatory": False,
            "acceptable_categories": ["identity_passport", "financial_evidence", "government_correspondence", "other_evidence"],
        },
    ],
    "CA-SUPER-VISA": [
        {
            "item_id": "casuper_passport",
            "label": "Parent / Grandparent Valid Passport (Min 6 Months Validity)",
            "requirement_citation": "IRPR § 52 - Primary Travel Document",
            "is_mandatory": True,
            "acceptable_categories": ["identity_passport"],
        },
        {
            "item_id": "casuper_host_status",
            "label": "Host Child / Grandchild Canadian PR Card, CoPR, or Citizenship Proof",
            "requirement_citation": "IRPA s. 11(1) / Super Visa Ministerial Instructions - Host Status in Canada",
            "is_mandatory": True,
            "acceptable_categories": ["identity_passport", "visas_residence_permits", "government_correspondence"],
        },
        {
            "item_id": "casuper_cra_noa_lico",
            "label": "Host CRA Notice of Assessment (NOA Line 15000) Meeting IRCC LICO Threshold",
            "requirement_citation": "IRPA s. 11(1) / IRPR Super Visa Ministerial Instructions - Minimum Necessary Income (LICO)",
            "is_mandatory": True,
            "acceptable_categories": ["financial_evidence", "government_correspondence"],
        },
        {
            "item_id": "casuper_host_employment_t4",
            "label": "Host T4 Slips & Canadian Employment Verification Letter",
            "requirement_citation": "Super Visa Ministerial Instructions - Income & Employment Corroboration",
            "is_mandatory": True,
            "acceptable_categories": ["employment_record", "financial_evidence"],
        },
        {
            "item_id": "casuper_medical_insurance",
            "label": "Super Visa Medical Insurance Policy ($100,000+ CAD Coverage for 365 Days)",
            "requirement_citation": "Super Visa Ministerial Instructions - Mandatory Emergency Health Coverage ($100k CAD / 1 Year)",
            "is_mandatory": True,
            "acceptable_categories": ["insurance_accommodation", "financial_evidence", "other_evidence"],
        },
        {
            "item_id": "casuper_relationship_birth_cert",
            "label": "Proof of Parent-Child Relationship (Child's Birth Certificate Naming Parent)",
            "requirement_citation": "Super Visa Ministerial Instructions - Qualifying Lineage Verification",
            "is_mandatory": True,
            "acceptable_categories": ["civil_status"],
        },
        {
            "item_id": "casuper_invitation_undertaking",
            "label": "Signed Host Invitation & Financial Undertaking Letter",
            "requirement_citation": "Super Visa Ministerial Instructions - Written Financial Support Undertaking",
            "is_mandatory": True,
            "acceptable_categories": ["other_evidence", "government_correspondence"],
        },
        {
            "item_id": "casuper_upfront_medical",
            "label": "Upfront Medical Exam Confirmation from IRCC Panel Physician",
            "requirement_citation": "IRPR § 30 - Medical Admissibility Clearance",
            "is_mandatory": True,
            "acceptable_categories": ["police_medical", "other_evidence", "government_correspondence"],
        },
    ],
    "CA-SOWP": [
        {
            "item_id": "casowp_passport",
            "label": "Applicant Valid Indian Passport",
            "requirement_citation": "IRPR § 52",
            "is_mandatory": True,
            "acceptable_categories": ["identity_passport"],
        },
        {
            "item_id": "casowp_principal_status",
            "label": "Spouse Valid Study Permit (Master's/PhD) or Work Permit (TEER 0-3)",
            "requirement_citation": "IRPR § 205(c)(ii) - Public Policy C41/C42",
            "is_mandatory": True,
            "acceptable_categories": ["government_correspondence", "employment_record"],
        },
        {
            "item_id": "casowp_marriage_cert",
            "label": "Marriage Certificate Registered under Hindu or Special Marriage Act",
            "requirement_citation": "IRPR § 2 - Legal Marriage Validity",
            "is_mandatory": True,
            "acceptable_categories": ["civil_status"],
        },
        {
            "item_id": "casowp_wedding_album",
            "label": "Wedding Photographs Album & Wedding Invitation Card",
            "requirement_citation": "IRPR § 4 - Genuine & Subsisting Relationship",
            "is_mandatory": True,
            "acceptable_categories": ["civil_status", "other_evidence"],
        },
        {
            "item_id": "casowp_joint_finances",
            "label": "Joint Bank Accounts / Remittance Records / Financial Interdependence",
            "requirement_citation": "Financial Cohabitation Proof",
            "is_mandatory": True,
            "acceptable_categories": ["financial_evidence"],
        },
        {
            "item_id": "casowp_pcc",
            "label": "Indian Police Clearance Certificate (PCC) from RPO/PSK",
            "requirement_citation": "IRPA § 36 - Criminality Admissibility",
            "is_mandatory": True,
            "acceptable_categories": ["other_evidence", "government_correspondence"],
        },
    ],
    "EXPRESS_ENTRY": [
        {
            "item_id": "caee_passport",
            "label": "Primary Passport Biodata Record",
            "requirement_citation": "IRPR § 52 - Travel Document",
            "is_mandatory": True,
            "acceptable_categories": ["identity_passport"],
        },
        {
            "item_id": "caee_eca",
            "label": "Educational Credential Assessment (ECA) Report (WES/IQAS/CES)",
            "requirement_citation": "IRPR § 75 - Foreign Degree Equivalence",
            "is_mandatory": True,
            "acceptable_categories": ["educational_record"],
        },
        {
            "item_id": "caee_language_test",
            "label": "Official Language Results (IELTS General / CELPIP-G CLB 7+)",
            "requirement_citation": "IRPR § 74 - Official Language Proficiency",
            "is_mandatory": True,
            "acceptable_categories": ["educational_record", "other_evidence"],
        },
        {
            "item_id": "caee_work_reference",
            "label": "Work Experience Reference Letters with Detailed Duties (NOC/TEER)",
            "requirement_citation": "IRPR § 75 - Skilled Work Experience",
            "is_mandatory": True,
            "acceptable_categories": ["employment_record"],
        },
        {
            "item_id": "caee_settlement_funds",
            "label": "Proof of Settlement Funds (LICO Compliant Bank Certificate)",
            "requirement_citation": "IRPR § 76 - Settlement Funds Requirement",
            "is_mandatory": True,
            "acceptable_categories": ["financial_evidence"],
        },
        {
            "item_id": "caee_pcc",
            "label": "Police Clearance Certificate (PCC) from Regional Passport Office",
            "requirement_citation": "IRPR § 10 - Security Admissibility",
            "is_mandatory": True,
            "acceptable_categories": ["other_evidence", "government_correspondence"],
        },
        {
            "item_id": "caee_medical",
            "label": "Upfront eMedical Examination Confirmation Sheet",
            "requirement_citation": "IRPR § 30 - Medical Admissibility",
            "is_mandatory": True,
            "acceptable_categories": ["other_evidence", "government_correspondence"],
        },
        {
            "item_id": "ca_ee_crs_sibling_proof",
            "label": "+15 CRS Points: Sibling PR/Citizenship + Canadian Utility/Lease + Shared-Parent Birth Certificates",
            "requirement_citation": "Express Entry Ministerial Instructions s. 29(2) — Sibling in Canada (+15 CRS)",
            "is_mandatory": False,
            "acceptable_categories": ["civil_status", "identity_passport", "government_correspondence", "other_evidence"],
        },
    ],
    "UK-VISITOR-SPONSOR": [
        {
            "item_id": "uksp_passport",
            "label": "Valid Applicant Passport (Min 1 Blank Page)",
            "requirement_citation": "Immigration Rules Appendix V: V 4.2",
            "is_mandatory": True,
            "acceptable_categories": ["identity_passport"],
        },
        {
            "item_id": "uksp_applicant_financials_ties",
            "label": "Applicant 6-Month Bank Statements, ITRs & Home-Country Ties / Leave NOC",
            "requirement_citation": "Appendix V: V 4.2–4.3 - Genuine Visitor & Home Ties",
            "is_mandatory": True,
            "acceptable_categories": ["financial_evidence", "employment_record"],
        },
        {
            "item_id": "uksp_sponsor_status",
            "label": "UK Sponsor Status — British Passport, ILR, or UKVI eVisa Share Code",
            "requirement_citation": "Appendix V: V 4.3 - Qualifying UK Sponsor Immigration Status",
            "is_mandatory": True,
            "acceptable_categories": ["identity_passport", "visas_residence_permits", "government_correspondence"],
        },
        {
            "item_id": "uksp_sponsor_hmrc_income",
            "label": "UK Sponsor HMRC P60 / SA302 Tax Calculation & Payslips / 28-Day Bank Proof",
            "requirement_citation": "Appendix V: V 4.3 & Appendix Finance - Sponsor Financial Maintenance",
            "is_mandatory": True,
            "acceptable_categories": ["financial_evidence", "employment_record"],
        },
        {
            "item_id": "uksp_accommodation_proof",
            "label": "UK Council Tax Bill / Tenancy Agreement Accommodation Proof",
            "requirement_citation": "Appendix V: V 4.2 - Adequate UK Accommodation",
            "is_mandatory": True,
            "acceptable_categories": ["insurance_accommodation", "financial_evidence", "other_evidence"],
        },
        {
            "item_id": "uksp_undertaking_letter",
            "label": "Signed UK Sponsor Invitation & Maintenance Undertaking Letter",
            "requirement_citation": "Appendix V: V 4.3 - Third-Party Undertaking",
            "is_mandatory": True,
            "acceptable_categories": ["other_evidence", "government_correspondence"],
        },
    ],
    "UK-STANDARD-VISITOR": [
        {
            "item_id": "ukvis_passport",
            "label": "Valid Indian Passport (Min 1 Blank Page)",
            "requirement_citation": "Immigration Rules Appendix V: V 4.2",
            "is_mandatory": True,
            "acceptable_categories": ["identity_passport"],
        },
        {
            "item_id": "ukvis_bank_statements",
            "label": "6 Months Continuous Bank Statements (No Unexplained Lump Sums)",
            "requirement_citation": "Appendix V: V 4.3 - Genuine Financial Resources",
            "is_mandatory": True,
            "acceptable_categories": ["financial_evidence"],
        },
        {
            "item_id": "ukvis_income_proof",
            "label": "Payslips (Last 6 Months) & 3 Years ITR / Form 16",
            "requirement_citation": "Income Verifiability & Origin",
            "is_mandatory": True,
            "acceptable_categories": ["financial_evidence", "employment_record"],
        },
        {
            "item_id": "ukvis_employment_leave",
            "label": "Employer Leave Sanction & Confirmation of Employment",
            "requirement_citation": "Appendix V: V 4.2 - Ties to Country of Residence",
            "is_mandatory": True,
            "acceptable_categories": ["employment_record"],
        },
        {
            "item_id": "ukvis_itinerary",
            "label": "UK Travel Itinerary, Accommodation Booking / Host Details",
            "requirement_citation": "Appendix V: V 4.2 - Realistic Plans & Accommodation",
            "is_mandatory": True,
            "acceptable_categories": ["other_evidence"],
        },
    ],
    "UK-STUDENT-VISA": [
        {
            "item_id": "ukstu_passport",
            "label": "Valid Indian Passport Biodata",
            "requirement_citation": "Immigration Rules Appendix Student: ST 1.1",
            "is_mandatory": True,
            "acceptable_categories": ["identity_passport"],
        },
        {
            "item_id": "ukstu_cas",
            "label": "Confirmation of Acceptance for Studies (CAS) from Sponsor",
            "requirement_citation": "Appendix Student: ST 8.1 - Valid CAS",
            "is_mandatory": True,
            "acceptable_categories": ["educational_record", "government_correspondence"],
        },
        {
            "item_id": "ukstu_maintenance_funds",
            "label": "Financial Proof Held Continuously for 28 Consecutive Days",
            "requirement_citation": "Appendix Student: ST 12.1 - 28-Day Maintenance Rule",
            "is_mandatory": True,
            "acceptable_categories": ["financial_evidence"],
        },
        {
            "item_id": "ukstu_tb_cert",
            "label": "Tuberculosis (TB) Test Certificate from UKVI Approved Clinic",
            "requirement_citation": "Appendix Student: ST 3.1 - Medical Requirement",
            "is_mandatory": True,
            "acceptable_categories": ["other_evidence", "government_correspondence"],
        },
        {
            "item_id": "ukstu_qualifications",
            "label": "Academic Qualifications & Certificates Listed on CAS",
            "requirement_citation": "Appendix Student: ST 14.1 - Educational History",
            "is_mandatory": True,
            "acceptable_categories": ["educational_record"],
        },
        {
            "item_id": "ukstu_atas",
            "label": "Academic Technology Approval Scheme (ATAS) Certificate",
            "requirement_citation": "Appendix Student: ST 13.1 - ATAS Clearance (STEM)",
            "is_mandatory": False,
            "acceptable_categories": ["government_correspondence", "other_evidence"],
        },
    ],
    "UK-SKILLED-WORKER": [
        {
            "item_id": "uksk_passport",
            "label": "Valid Indian Passport",
            "requirement_citation": "Immigration Rules Appendix Skilled Worker: SW 1.1",
            "is_mandatory": True,
            "acceptable_categories": ["identity_passport"],
        },
        {
            "item_id": "uksk_cos",
            "label": "Assigned Certificate of Sponsorship (CoS) Reference Number",
            "requirement_citation": "Appendix Skilled Worker: SW 5.1 - Valid CoS",
            "is_mandatory": True,
            "acceptable_categories": ["government_correspondence", "employment_record"],
        },
        {
            "item_id": "uksk_salary_job_offer",
            "label": "Employment Contract Meeting Salary Threshold (£38,700/yr)",
            "requirement_citation": "Appendix Skilled Worker: SW 8.1 - Salary Level",
            "is_mandatory": True,
            "acceptable_categories": ["employment_record"],
        },
        {
            "item_id": "uksk_english_proof",
            "label": "English Language Proficiency (CEFR Level B1 / Ecctis Evaluation)",
            "requirement_citation": "Appendix Skilled Worker: SW 7.1 - English Mandate",
            "is_mandatory": True,
            "acceptable_categories": ["educational_record", "other_evidence"],
        },
        {
            "item_id": "uksk_tb_cert",
            "label": "Tuberculosis (TB) Test Certificate from Approved Indian Clinic",
            "requirement_citation": "Appendix Skilled Worker: SW 1.5 - TB Screening",
            "is_mandatory": True,
            "acceptable_categories": ["other_evidence", "government_correspondence"],
        },
        {
            "item_id": "uksk_pcc",
            "label": "Criminal Record Certificate (PCC) from Regional Passport Office",
            "requirement_citation": "Appendix Skilled Worker: SW 16.1 - Character Requirement",
            "is_mandatory": True,
            "acceptable_categories": ["other_evidence", "government_correspondence"],
        },
    ],
    "AU-SUBCLASS-600": [
        {
            "item_id": "au600_passport",
            "label": "Valid Indian Passport",
            "requirement_citation": "Migration Regulations 1994, Subclass 600",
            "is_mandatory": True,
            "acceptable_categories": ["identity_passport"],
        },
        {
            "item_id": "au600_financials",
            "label": "6 Months Bank Statements & Liquid Funds Proof",
            "requirement_citation": "Subclass 600.211 - Genuine Access to Funds",
            "is_mandatory": True,
            "acceptable_categories": ["financial_evidence"],
        },
        {
            "item_id": "au600_gte_employment",
            "label": "Employer Leave Letter, Payslips & 3-Year ITRs",
            "requirement_citation": "Subclass 600.211 - Employment Ties to India",
            "is_mandatory": True,
            "acceptable_categories": ["employment_record", "financial_evidence"],
        },
        {
            "item_id": "au600_form54",
            "label": "Form 54 Family Composition Declaration",
            "requirement_citation": "DHA Identity & Family Audit",
            "is_mandatory": True,
            "acceptable_categories": ["civil_status", "other_evidence"],
        },
    ],
    "AU-SUBCLASS-600-SPONSOR": [
        {
            "item_id": "au600sp_passport",
            "label": "Valid Applicant Passport",
            "requirement_citation": "Migration Regulations 1994, Subclass 600",
            "is_mandatory": True,
            "acceptable_categories": ["identity_passport"],
        },
        {
            "item_id": "au600sp_financials_ties",
            "label": "Applicant Financial & Home-Ties Proof (Bank Statements, ITRs, Leave Letter)",
            "requirement_citation": "Subclass 600.211 - Genuine Visitor & Home-Country Incentives",
            "is_mandatory": True,
            "acceptable_categories": ["financial_evidence", "employment_record"],
        },
        {
            "item_id": "au600sp_sponsor_status_vevo",
            "label": "Australian Sponsor Passport / Citizenship Certificate or VEVO Active Visa Check",
            "requirement_citation": "Subclass 600 Sponsored Family Stream - Sponsor Australian Status",
            "is_mandatory": True,
            "acceptable_categories": ["identity_passport", "visas_residence_permits", "government_correspondence"],
        },
        {
            "item_id": "au600sp_ato_noa",
            "label": "Sponsor ATO Notice of Assessment / PAYG Income Proof",
            "requirement_citation": "Subclass 600.211 - Sponsor Financial Capacity",
            "is_mandatory": True,
            "acceptable_categories": ["financial_evidence", "employment_record", "government_correspondence"],
        },
        {
            "item_id": "au600sp_residency_proof",
            "label": "Sponsor Council Rates / Utility Bill Australian Residency Proof",
            "requirement_citation": "Subclass 600 Sponsored Family Stream - Settled Australian Residence",
            "is_mandatory": True,
            "acceptable_categories": ["insurance_accommodation", "other_evidence", "financial_evidence"],
        },
        {
            "item_id": "au600sp_invitation_form1149",
            "label": "Sponsor Invitation Letter / Form 1149 Sponsorship Statutory Declaration",
            "requirement_citation": "Migration Regulations 1994 - Form 1149 Sponsorship Undertaking",
            "is_mandatory": True,
            "acceptable_categories": ["other_evidence", "government_correspondence", "civil_status"],
        },
    ],
    "AU-SUBCLASS-500": [
        {
            "item_id": "au500_passport",
            "label": "Valid Indian Passport Biodata",
            "requirement_citation": "Subclass 500.211 - Travel Document",
            "is_mandatory": True,
            "acceptable_categories": ["identity_passport"],
        },
        {
            "item_id": "au500_coe",
            "label": "Confirmation of Enrolment (CoE) in CRICOS-Registered Course",
            "requirement_citation": "Subclass 500.211 - Enrolment in Full-Time Course",
            "is_mandatory": True,
            "acceptable_categories": ["educational_record", "government_correspondence"],
        },
        {
            "item_id": "au500_gs_statement",
            "label": "Genuine Student (GS) Narrative Assessment",
            "requirement_citation": "Subclass 500.212 - Genuine Student Criteria (2024)",
            "is_mandatory": True,
            "acceptable_categories": ["other_evidence"],
        },
        {
            "item_id": "au500_funds_proof",
            "label": "Financial Capacity (1 Year Tuition + AUD $29,710 Living Costs)",
            "requirement_citation": "Subclass 500.214 - Financial Capacity Benchmark",
            "is_mandatory": True,
            "acceptable_categories": ["financial_evidence"],
        },
        {
            "item_id": "au500_oshc",
            "label": "Overseas Student Health Cover (OSHC) Policy Certificate",
            "requirement_citation": "Subclass 500.215 - Mandatory Health Cover",
            "is_mandatory": True,
            "acceptable_categories": ["other_evidence", "financial_evidence"],
        },
        {
            "item_id": "au500_english_test",
            "label": "English Language Test (IELTS / PTE Academic)",
            "requirement_citation": "Subclass 500.213 - English Competency",
            "is_mandatory": True,
            "acceptable_categories": ["educational_record", "other_evidence"],
        },
    ],
    "DE-CHANCENKARTE": [
        {
            "item_id": "dech_passport",
            "label": "Valid Indian Passport",
            "requirement_citation": "AufenthG § 20a - Opportunity Card Identity",
            "is_mandatory": True,
            "acceptable_categories": ["identity_passport"],
        },
        {
            "item_id": "dech_qualifications",
            "label": "Recognized Foreign Degree / Vocational Training (ANABIN)",
            "requirement_citation": "AufenthG § 20a(2) - Minimum 2-Year Training Equivalence",
            "is_mandatory": True,
            "acceptable_categories": ["educational_record"],
        },
        {
            "item_id": "dech_language",
            "label": "Language Proof (German A1/A2/B1/B2 or English B2/C1)",
            "requirement_citation": "AufenthG § 20a(3) - Language Points",
            "is_mandatory": True,
            "acceptable_categories": ["educational_record", "other_evidence"],
        },
        {
            "item_id": "dech_blocked_account",
            "label": "Blocked Account (Sperrkonto €11,904/yr) or Employment Contract",
            "requirement_citation": "AufenthG § 20a(4) - Subsistence Security",
            "is_mandatory": True,
            "acceptable_categories": ["financial_evidence"],
        },
        {
            "item_id": "dech_work_experience",
            "label": "Documented Professional Experience in Qualifying Sector",
            "requirement_citation": "AufenthG § 20a - Professional Experience Points",
            "is_mandatory": True,
            "acceptable_categories": ["employment_record"],
        },
    ],
    "GENERIC_BASELINE": [
        {
            "item_id": "gen_passport",
            "label": "Valid Passport & Travel Document",
            "requirement_citation": "Universal Immigration Mandate - Primary Identity",
            "is_mandatory": True,
            "acceptable_categories": ["identity_passport"],
        },
        {
            "item_id": "gen_cv",
            "label": "Curriculum Vitae / Professional Background Resume",
            "requirement_citation": "Evidentiary Background & Historical Profile",
            "is_mandatory": True,
            "acceptable_categories": ["employment_record", "other_evidence"],
        },
        {
            "item_id": "gen_finances",
            "label": "Proof of Financial Sufficiency & Bank Verification",
            "requirement_citation": "Financial Inadmissibility Safeguard",
            "is_mandatory": True,
            "acceptable_categories": ["financial_evidence"],
        },
        {
            "item_id": "gen_purpose",
            "label": "Statement of Purpose / Qualifying Grounds for Stay",
            "requirement_citation": "Statutory Justification of Requested Status",
            "is_mandatory": False,
            "acceptable_categories": ["other_evidence", "government_correspondence"],
        },
    ],
}

# Alias CA-EXPRESS-ENTRY to EXPRESS_ENTRY for direct key lookups
PATHWAY_CHECKLISTS["CA-EXPRESS-ENTRY"] = PATHWAY_CHECKLISTS["EXPRESS_ENTRY"]


def _match_pathway_checklist_template(category_str: str) -> List[Dict[str, Any]]:
    """Smartly resolves a case's visa category string into the appropriate statutory checklist."""
    exact_key = (category_str or "").strip().upper()
    if exact_key in PATHWAY_CHECKLISTS:
        return PATHWAY_CHECKLISTS[exact_key]

    raw = exact_key.replace("-", " ").replace("_", " ")

    # Canada Matchers
    if any(k in raw for k in ["STUDY PERMIT", "STUDENT VISA CANADA", "CA STUDY", "SDS"]):
        return PATHWAY_CHECKLISTS["CA-STUDY-PERMIT"]
    if any(k in raw for k in ["EXPRESS ENTRY", "FSWP", "PNP", "EE PNP"]):
        return PATHWAY_CHECKLISTS["EXPRESS_ENTRY"]
    if any(k in raw for k in ["SOWP", "SPOUSAL OPEN WORK", "SPOUSAL WORK"]):
        return PATHWAY_CHECKLISTS["CA-SOWP"]
    if "SUPER VISA" in raw and "TRV" not in raw and "VISITOR VISA" not in raw:
        return PATHWAY_CHECKLISTS["CA-SUPER-VISA"]
    if any(k in raw for k in ["CANADA VISITOR", "CA VISITOR", "TRV", "SUPER VISA"]):
        return PATHWAY_CHECKLISTS["CA-VISITOR-TRV"]

    # US Matchers
    if any(k in raw for k in ["EB 1A", "EB1A", "EXTRAORDINARY ABILITY"]):
        return PATHWAY_CHECKLISTS["EB-1A"]
    if any(k in raw for k in ["O 1A", "O1A"]):
        return PATHWAY_CHECKLISTS["O-1A"]
    if any(k in raw for k in ["EB 2", "EB2", "NIW"]):
        return PATHWAY_CHECKLISTS["EB-2"]
    if any(k in raw for k in ["H 1B", "H1B", "SPECIALTY OCCUPATION"]):
        return PATHWAY_CHECKLISTS["H-1B"]
    if any(k in raw for k in ["H 4", "H4", "H 4 EAD"]):
        return PATHWAY_CHECKLISTS["US-H4-DEPENDENT"]
    if any(k in raw for k in ["B 1/B 2", "B1/B2", "B 1", "B 2", "US B1", "US B2", "US VISITOR"]):
        return PATHWAY_CHECKLISTS["US-B1B2-VISITOR"]
    if any(k in raw for k in ["F 1", "F1", "US STUDENT"]):
        return PATHWAY_CHECKLISTS["US-F1-STUDENT"]

    # UK Matchers
    if any(k in raw for k in ["UK STUDENT", "TIER 4"]):
        return PATHWAY_CHECKLISTS["UK-STUDENT-VISA"]
    if any(k in raw for k in ["UK SKILLED", "SKILLED WORKER", "TIER 2"]):
        return PATHWAY_CHECKLISTS["UK-SKILLED-WORKER"]
    if ("UK" in raw or "VISITOR" in raw) and "SPONSOR" in raw and "600" not in raw and "AU" not in raw and "AUSTRALIA" not in raw:
        return PATHWAY_CHECKLISTS["UK-VISITOR-SPONSOR"]
    if any(k in raw for k in ["UK VISITOR", "STANDARD VISITOR", "UK TOURIST"]):
        return PATHWAY_CHECKLISTS["UK-STANDARD-VISITOR"]

    # Australia Matchers
    if any(k in raw for k in ["600", "AU VISITOR", "AUSTRALIA VISITOR"]) and "SPONSOR" in raw:
        return PATHWAY_CHECKLISTS["AU-SUBCLASS-600-SPONSOR"]
    if any(k in raw for k in ["600", "AU VISITOR", "AUSTRALIA VISITOR"]):
        return PATHWAY_CHECKLISTS["AU-SUBCLASS-600"]
    if any(k in raw for k in ["500", "AU STUDENT", "AUSTRALIA STUDENT"]):
        return PATHWAY_CHECKLISTS["AU-SUBCLASS-500"]

    # Germany Matchers
    if any(k in raw for k in ["CHANCENKARTE", "OPPORTUNITY CARD"]):
        return PATHWAY_CHECKLISTS["DE-CHANCENKARTE"]

    # General Substring fallback across defined dictionary keys
    norm_key = category_str.upper().replace("-", "").replace(" ", "")
    for k, v in PATHWAY_CHECKLISTS.items():
        if k.replace("-", "").replace("_", "") in norm_key or norm_key in k.replace("-", "").replace("_", ""):
            return v

    return PATHWAY_CHECKLISTS["GENERIC_BASELINE"]


def audit_case_checklist(
    jurisdiction: str,
    visa_category: str,
    documents: List[Dict[str, Any]],
    checklist_snapshot: Optional[Any] = None,
) -> ChecklistAuditReport:
    """Evaluates case documents against configured category checklist requirements or pinned case snapshot."""
    raw_template = None
    is_pinned = False
    version = None

    if checklist_snapshot:
        if isinstance(checklist_snapshot, dict):
            raw_template = (
                checklist_snapshot.get("checklist")
                or checklist_snapshot.get("items")
                or checklist_snapshot.get("requirements")
            )
            version = (
                checklist_snapshot.get("rule_version_number")
                or checklist_snapshot.get("version")
                or str(checklist_snapshot.get("rule_version_id", ""))
                or None
            )
            is_pinned = bool(checklist_snapshot.get("is_pinned", True))
        elif isinstance(checklist_snapshot, list):
            raw_template = checklist_snapshot
            is_pinned = True

    if raw_template and isinstance(raw_template, list) and len(raw_template) > 0:
        matched_template = []
        for raw in raw_template:
            matched_template.append({
                "item_id": raw.get("item_id") or raw.get("code") or raw.get("rule_id") or str(raw.get("id")),
                "label": raw.get("label") or raw.get("title") or raw.get("name") or "Required Evidence",
                "requirement_citation": raw.get("requirement_citation") or raw.get("statutory_citation") or raw.get("citation") or "Configured Case Requirement",
                "is_mandatory": raw.get("is_mandatory", True),
                "acceptable_categories": raw.get("acceptable_categories") or raw.get("accepted_evidence_types") or ([raw.get("category")] if raw.get("category") else ["other_evidence"]),
            })
    else:
        matched_template = _match_pathway_checklist_template(visa_category)

    checklist_items: List[ChecklistItem] = []

    category_equivalents: Dict[str, set[str]] = {
        "educational_record": {"educational_record", "educational_records"},
        "educational_records": {"educational_record", "educational_records"},
        "employment_record": {"employment_record", "employment_records"},
        "employment_records": {"employment_record", "employment_records"},
        "civil_status": {"civil_status", "civil_status_family"},
        "civil_status_family": {"civil_status", "civil_status_family"},
        "other_evidence": {
            "other_evidence",
            "supporting_evidence",
            "police_medical",
            "travel_records",
            "insurance_accommodation",
            "visas_residence_permits",
            "translations_certifications",
        },
    }

    for t in matched_template:
        item = ChecklistItem(
            item_id=t["item_id"],
            label=t["label"],
            requirement_citation=t["requirement_citation"],
            is_mandatory=t["is_mandatory"],
            acceptable_categories=t["acceptable_categories"],
        )

        expanded_acceptable: set[str] = set()
        for acc in item.acceptable_categories:
            expanded_acceptable.add(acc)
            expanded_acceptable.update(category_equivalents.get(acc, set()))

        # Match against uploaded documents
        # Document matches if its category (or canonical equivalent) matches acceptable categories
        for doc in documents:
            doc_cat = doc.get("category", "")
            # Check processing status not failed
            if doc.get("processing_status") != "failed" and doc_cat in expanded_acceptable:
                item.is_satisfied = True
                item.matching_document_id = str(doc.get("id"))
                item.matching_document_title = doc.get("title") or doc.get("filename")
                item.notes = f"Evidenced by '{item.matching_document_title}'"
                break

        checklist_items.append(item)

    total_mandatory = sum(1 for it in checklist_items if it.is_mandatory)
    satisfied_mandatory = sum(1 for it in checklist_items if it.is_mandatory and it.is_satisfied)
    total_items = len(checklist_items)
    satisfied_items = sum(1 for it in checklist_items if it.is_satisfied)
    missing_items = [it for it in checklist_items if not it.is_satisfied]

    fulfillment_pct = (satisfied_items / total_items * 100.0) if total_items > 0 else 0.0

    return ChecklistAuditReport(
        jurisdiction=jurisdiction,
        visa_category=visa_category,
        items=checklist_items,
        total_mandatory=total_mandatory,
        satisfied_mandatory=satisfied_mandatory,
        total_items=total_items,
        satisfied_items=satisfied_items,
        fulfillment_percentage=round(fulfillment_pct, 1),
        missing_items=missing_items,
        is_pinned=is_pinned,
        version=version,
    )
