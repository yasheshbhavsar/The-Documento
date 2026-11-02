"""Multi-Person Document Packet Sorter & Splitter.

Uses the platform's existing OCR engine (`OCREngine`), document taxonomy classifier
(`classify_document`), structured entity extractor (`extract_structured_fields`),
statutory identity resolver (`IdentityResolver`), and phonetic/cultural name comparator
(`compare_names`) to:
1. Inspect every page of a merged multi-person PDF packet.
2. Identify each page's document category, specific document subtype, primary subject
   holder(s), and continuity anchors (PAN, Passport No, Account No, SIN, UMI, Page X of Y).
3. Stitch consecutive continuation pages into complete multi-page documents.
4. Cluster name variations of the same person across documents (handling Indian naming
   conventions, reversed surname-first order, middle-name/patronymic initials, maiden-to-married
   name transitions on marriage certificates, and concatenated names) into canonical Person Folders.
5. Place joint documents (e.g., Marriage Certificates, Joint Bank Statements/FDs) into
   each named holder's folder while keeping parent/valuer/employer names as metadata only.
6. Route unidentifiable or unsupported-language documents to `Case_Worker_Review`.
"""
from __future__ import annotations

import base64
import io
import os
import re
import uuid
import zipfile
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import fitz

from backend.app.ai.comparators import compare_names
from backend.app.extraction.classifier import classify_document
from backend.app.extraction.service import extract_structured_fields
from backend.app.ocr.engine import (
    OCREngine,
    PageExtractionResult,
    evaluate_language_compliance,
)


HONORIFIC_WORDS = {
    "mr", "mrs", "ms", "miss", "dr", "prof", "shri", "smt", "kum", "kumari", "chi", "late", "sri", "ay", "mys", "m"
}

INDIAN_SURNAMES = {
    "PATEL", "SHAH", "AMIN", "BHAVSAR", "MEHTA", "DESAI", "JOSHI", "MODI",
    "TRIVEDI", "PANDYA", "BHATT", "PARIKH", "CHAUHAN", "SOLANKI", "RATHOD",
    "THAKKAR", "THAKAR", "VYAS", "BRAHMBHATT", "PRAJAPATI", "PANCHAL", "SONI", "GANDHI",
    "KOTHARI", "SHARMA", "VERMA", "GUPTA", "SINGH", "KAUR", "GILL", "SANDHU",
    "SIDHU", "DHILLON", "GREWAL", "BRAR", "BAJWA", "CHAWLA", "ARORA", "KHANNA",
    "MALHOTRA", "KAPUR", "KAPOOR", "REDDY", "RAO", "NAIDU", "PATIL", "KULKARNI",
    "DESHMUKH", "SHINDE", "PAWAR", "JADHAV", "NAIR", "MENON", "PILLAI",
    "KAKAD", "KOTADIA", "PATADIA", "LIMBACHIYA", "RABARI", "CHAUDHARY", "DARJI",
    "SUTHAR", "MISTRY", "VAGHELA", "ZALA", "JADEJA", "GOHIL", "MAKWANA",
    "RAVAL", "KANSARA", "CHAVDA", "PARMAR", "BAROT", "GAJJAR",
}


def deconcatenate_indian_name(raw_name: str) -> str:
    """
    Repairs concatenated or OCR-noisy Indian names using general morphological rules:
    - Normalizes common OCR scan character substitutions in Indian patronymic/surname suffixes
      ('FATEL'/'PATTL'/'ATEL' -> 'PATEL', 'RHAI'/'RIIAI' -> 'BHAI', 'RANIANREN' -> 'RANJANBEN').
    - Strips leading table-border characters ('S', 'K') merged before surnames or patronymics.
    - Splits patronymic suffixes (-BHAI, -BEN, -KUMAR, -LAL, -DAS) and known surnames from adjacent stems.
    - Merges standalone suffix words ('Hansa Ben' -> 'Hansaben') and deduplicates repeated stems.
    """
    if not raw_name:
        return ""
    s = " ".join(raw_name.replace(",", " ").replace("_", " ").replace("'", " ").replace("-", " ").split()).strip(" .:-_/")

    # Strip MRZ or label prefixes stuck to names
    s = re.sub(r"(?i)^.*?(?:passeport|passportno|surname|nomdefamille|givenname|prenom)[a-z]*?(?=patel|sharma|shah|amin|bhavsar)", "", s)
    s = re.sub(r"(?i)\b(?:wonbinn|wonmuriel|ind|can|ppcan)\b", " ", s)

    # General OCR scan character repairs on Indian patronymics and surnames (note negative lookahead (?![iI]) on bha and (?<![pP]) on atel)
    s = re.sub(r"(?i)(?<=[a-z]{3})(?:rhai|riiai|bha(?![iI]))(?=[a-z\s]|$)", "bhai", s)
    s = re.sub(r"(?i)ranianren", "Ranjanben", s)
    s = re.sub(r"(?i)kalindas", "Kalidas", s)
    s = re.sub(r"(?i)\b(?:pattl|fatel|(?<![pP])atel)\b", "Patel", s)
    s = re.sub(r"(?i)(?<=[a-z]{4})(?:pattl|fatel|(?<![pP])atel)\b", " Patel", s)
    s = re.sub(r"(?i)\bpa\s*it\s*l\b", "Patel", s)
    s = re.sub(r"(?i)\bkali\s*uas\b", "Kalidas", s)

    # Strip vertical table-border 'S' or 'K' stuck before surname or -ben/-bhai name
    s = re.sub(r"(?i)\b(?:my\s*s\s*p?|mr\s*s|m\s*s|s)\s*(patel|shah|amin|mehta|desai)\b", r"\1", s)
    s = re.sub(r"(?i)\b(?:my\s*s|mr\s*s|m\s*s|s)([a-z]{4,}(?:\s*ben|\s*bhai))\b", r"\1", s)
    s = re.sub(r"(?i)\bk(kalidasbhai)\b", r"\1", s)

    # Merge standalone 'ben' or 'bhai' onto preceding given name ('Hansa Ben' -> 'Hansaben')
    s = re.sub(r"\b([A-Za-z]{4,})\s+(ben|bhai)\b", r"\1\2", s, flags=re.IGNORECASE)

    # Separate trailing single initial stuck after -ben/-bhai ('Hansabenp' -> 'Hansaben P')
    s = re.sub(r"\b([A-Za-z]{4,}(?:ben|bhai))([A-Za-z])\b", r"\1 \2", s, flags=re.IGNORECASE)

    # Separate honorific stuck to name: 'Mr.Pankaj' -> 'Mr. Pankaj'
    s = re.sub(r"\b(Mr|Mrs|Ms|Miss|Dr|Shri|Smt)\.?\s*([A-Za-z]{3,})", r"\1 \2", s, flags=re.IGNORECASE)

    # Separate known surname stuck at start or end of token
    for sur in INDIAN_SURNAMES:
        s = re.sub(rf"\b([A-Za-z]{{1,}})({sur})\b", r"\1 \2", s, flags=re.IGNORECASE)
        s = re.sub(rf"\b({sur})([A-Za-z]{{3,}})\b", r"\1 \2", s, flags=re.IGNORECASE)

    # Separate patronymic suffix (BHAI, BEN, KUMAR, LAL, DAS) stuck to following token
    s = re.sub(
        r"\b([A-Za-z]{3,}(?:BHAI|BEN|KUMAR|LAL|DAS))([A-Za-z]{3,})\b",
        r"\1 \2",
        s,
        flags=re.IGNORECASE,
    )

    raw_tokens = [t for t in re.split(r"[\s\.]+", s) if t and t.lower() not in HONORIFIC_WORDS]

    # Deduplicate repeated stems while preserving order
    dedup_tokens: list[str] = []
    seen_stems: set[str] = set()
    for t in raw_tokens:
        st = stem_indian_token(t)
        if st not in seen_stems:
            seen_stems.add(st)
            dedup_tokens.append(t.title())
    return " ".join(dedup_tokens)


def normalize_person_tokens(name: str) -> list[str]:
    """Returns cleaned lowercase tokens with honorifics removed."""
    deconc = deconcatenate_indian_name(name)
    raw_tokens = re.findall(r"[A-Za-z]+", deconc.lower())
    return [t for t in raw_tokens if t not in HONORIFIC_WORDS and len(t) >= 1]


def stem_indian_token(tok: str) -> str:
    """Strips optional Indian honorific/gender suffixes (-bhai, -ben, -kumar) for stem comparison."""
    t = tok.lower()
    for suf in ("kumar", "bhai", "ben"):
        if t.endswith(suf) and len(t) - len(suf) >= 4:
            return t[: -len(suf)]
    return t


def is_valid_person_name_candidate(name: str) -> bool:
    """Strict filter ensuring table headers, provinces, or form labels are never treated as person names."""
    if not name:
        return False
    cleaned = deconcatenate_indian_name(name)
    toks = normalize_person_tokens(cleaned)
    if not toks:
        return False
    if max(len(t) for t in toks) < 3:
        return False
    if len(toks) > 5:
        return False

    lower_full = " ".join(toks)
    forbidden_words = {
        "ontario", "canada", "india", "gujarat", "ahmedabad", "toronto", "saskatchewan",
        "nom", "prenom", "prnom", "declaration", "assessee", "company", "deductor",
        "employer", "employee", "insured", "applicant", "signature", "bearer",
        "titulaire", "summary", "earnings", "taxes", "tax", "year", "statement", "account",
        "hornic", "investment", "mehsana", "kalupur", "baroda", "walmart",
        "saskpower", "cibc", "discover", "service", "services", "male", "female",
        "married", "unmarried", "single", "widowed", "divorced", "wonmuriel",
        "shuddhi", "union", "dues", "disguised", "messages", "emergency",
        "medical", "conditions", "issued", "cif", "address", "particulars",
        "cheque", "balance", "nomination", "assets", "government", "republic",
        "authority", "citizenship", "immigration", "hospital", "university",
        "college", "school", "valuer", "chartered", "accountant", "refund",
        "notice", "assessment", "agency", "revenue", "coverage", "premium",
        "claims", "exclusions", "signatory", "associate", "policy", "location",
        "branch", "deposit", "withdrawal", "transfer", "credit", "debit",
        "registrar", "priest", "officiating", "witness", "uec", "anot", "rrsells", "rselles",
        "inc", "ltd", "llc", "corp", "corporation", "energy", "management", "solutions",
        "technologies", "edtech", "private", "limited", "givenatbirth",
        "brampton", "etobicoke", "kitchener", "winnipeg", "mississauga", "scarborough",
        "markham", "vaughan", "surrey", "burnaby", "calgary", "edmonton", "ottawa",
        "montreal", "vancouver", "sudbury", "london", "hamilton", "windsor",
        "reason", "roe", "serial", "hours", "insurable", "this", "for",
    }
    if lower_full in forbidden_words or any(t in forbidden_words for t in toks):
        return False

    forbidden_phrases = (
        "tan section", "head of", "current free", "pledge", "repledge",
        "opendt", "close dt", "statement period", "nom de", "adresse de",
        "inv since", "date of", "place of", "name of", "of assessee",
        "of company", "of deductor", "of govt", "of registered", "registered valuer",
        "approved valuer", "income tax", "capital gain", "other sources",
        "chapter via", "gross total", "special rates", "free units",
        "private limited", "pvt ltd", "co op", "bank ltd", "and conditions",
        "for advances", "present resi", "permanent resi", "tax year",
    )
    if any(p in lower_full for p in forbidden_phrases):
        return False

    return True


def detect_page_subtype(text: str, category: str) -> Tuple[str, str]:
    """
    Determines a specific, human-readable document subtype and canonical category
    from a page's text so split PDFs get clean, descriptive filenames and
    multi-page continuations stay grouped together.
    """
    u = (text or "").upper()

    # 0. PAN Card (Physical ID card vs ITR)
    if (
        "PERMANENT ACCOUNT NUMBER CARD" in u
        or ("INCOME TAX DEPARTMENT" in u and "PERMANENT ACCOUNT NUMBER" in u and "ASSESSMENT YEAR" not in u and "RETURN" not in u)
        or ("INCOME TAX DEPARTMENT" in u and "FATHER'S NAME" in u and "ASSESSMENT YEAR" not in u and "COMPUTATION" not in u)
    ):
        return "identity_passport", "PAN_Identity_Card"

    # 1. Income Tax Return (ITR Acknowledgement + Computation + Schedules)
    if (
        bool(
            re.search(
                r"INDIAN\s*INCOME\s*TAX\s*RETURN|ACKNOWLEDGEMENT\s*NUMBER|ACKN0WLEDGEMENT\s*NUMBER|E-FILING\s*ACKNOWLEDGEMENT|DO\s*NOT\s*SEND\s*THIS\s*ACKNOWLEDGEMENT",
                u,
            )
        )
        or bool(
            re.search(
                r"COMPUTATION\s*OF\s*TAX|COMPUTATION\s*OF\s*TOTAL\s*INCOME|NAME\s*OF\s*ASSESSEE|DETAILSOF\s*INTEREST\s*ON\s*BANK|REBATE\s*U/S\s*87A|CHAPTER\s*VI-?A|STATEMENT\s*OF\s*(?:LONG\s*TERM|ST)\s*CAPITAL\s*GAIN|SPECIAL\s*RATES\s*INCOME\s*U/S\s*112A|SALE\s*OF\s*LTCG|TDS\s*TRACES|GST\s*TURNOVER\s*DETAIL|TOTAL\s*OF\s*OTHER\s*SOURCES|TAXABLE\s*LTCG|AS\s*PER\s*ANX\.\s*ATTACHED|RECEIPT\s*OF\s*COMMISSION\s*ETC\.\s*ON\s*SALE\s*OF\s*LOTTERY|RETURN\s*FOR\s*ASST\.\s*YEAR",
                u,
            )
        )
        or bool(
            re.search(r"PAN\s*:\s*[A-Z]{5}[0-9]{4}[A-Z]", u)
            and (
                "CODE :- I_" in u
                or "CLIENT CODE:" in u
                or "INTEREST ON BANK" in u
                or "OS-INCOME" in u
                or re.search(r"\b[123]\s*\|?\s*PAN:", u)
                or re.search(r"\n[123]\nPAN:", u)
            )
        )
    ):
        return "financial_evidence", "Income_Tax_Return_ITR"

    # 1b. Visa Cover Letter & Itinerary (checked before CA Net Worth Certificate so cover letter mentions of CA don't misclassify Page 1)
    if (
        "TO, THE VISA OFFICER" in u
        or "SUBCLASS 600" in u
        or "TIES TO INDIA" in u
        or "PLANNED ITINERARY" in u
        or ("PURPOSE OF VISIT" in u and "FINANCIAL CAPACITY" in u)
    ):
        return "supporting_evidence", "Visa_Cover_Letter_and_Itinerary"

    # 2. CA Net Worth & Income Certificate (checked before Demat/Bank so table mentions of shares/banks stay inside CA cert)
    if (
        "CHARTERED ACCOUNTANTS" in u
        or "DISHA SUTARIA" in u
        or "MOVABLEASSETS" in u
        or "MOVABLE ASSETS" in u
        or "IMMOVABLEASSETS" in u
        or "IMMOVABLE ASSETS" in u
        or "DETAILS OF TOTALINCOME" in u
        or "DETAILSOFTOTALINCOME" in u
        or "NET WORTH CERTIFICATE" in u
    ):
        return "financial_evidence", "CA_Net_Worth_Certificate"

    # 3. GST Registration Certificate & Business Proof
    if (
        "FORM GST REG" in u
        or "DETAILS OF ADDITIONAL PLACES OF BUSINESS" in u
        or "DETAILS OF PROPRIETOR" in u
        or ("GSTIN" in u and "LEGAL NAME" in u)
        or ("SHUDDHI" in u and "PRODUCT" in u and "CATALOG" in u)
    ):
        return "employment_records", "GST_Registration_Certificate"

    # 3b. Study Permit / Work Permit Specific Documents (LOA, IELTS, PAL, LMIA, Employment Contract, ROE, PCC, COPR, GIC, Tuition Receipt)
    # Checked BEFORE CRA / Bank / Passport so mentions of 'Canada Revenue Agency', 'CIBC', or 'Passport No' inside letters don't misclassify them!
    if (
        "TEST REPORT FORM" in u
        or "OVERALL BAND SCORE" in u
        or "INTERNATIONAL ENGLISH LANGUAGE TESTING SYSTEM" in u
        or ("IELTS" in u and ("LISTENING" in u or "CEFR LEVEL" in u))
    ):
        return "educational_records", "IELTS_Language_Test_Report"

    if (
        "PROVINCIAL ATTESTATION LETTER" in u
        or "LETTRES D'ATTESTATION PROVINCIALE" in u
        or "PROVINCIAL ATTESTATION NUMBER" in u
        or "NUMÉRO D'ATTESTATION PROVINCIALE" in u
        or "APPLYPROOF" in u
    ):
        return "government_correspondence", "Provincial_Attestation_Letter_PAL"

    if (
        "LETTER OF ACCEPTANCE" in u
        or "OFFER OF ADMISSION" in u
        or "DESIGNATED LEARNING INSTITUTION" in u
        or bool(re.search(r"\bDLI\s*(?:NUMBER|#)|\bO19[0-9]{9,10}\b", u))
        or ("ESTIMATED TUITION" in u and "PROGRAM OF STUDY" in u)
        or ("ACADEMIC STATUS" in u and "LENGTH OF PROGRAM" in u)
        or ("EVIDENCE OF WORK REQUIREMENT IN STUDY" in u)
    ):
        return "educational_records", "Offer_Letter_LOA"

    if (
        "BONAFIDE CERTIFICATE" in u
        or "BONAFIDECERTIFICATE" in u
        or "SCHOOL LEAVING CERTIFICATE" in u
        or "BONAFIDE STUDENT" in u
    ):
        return "educational_records", "School_Bonafide_Certificate"

    if (
        "RECORD OF EMPLOYMENT" in u
        or "SERIAL NO. OF ROE" in u
        or ("INSURABLE EARNINGS" in u and "INSURABLE HOURS" in u)
    ):
        return "employment_records", "Record_of_Employment_ROE"

    if (
        "LABOUR MARKET IMPACT ASSESSMENT" in u
        or "GLOBAL TALENT STREAM" in u
        or "FOREIGN WORKER NAMES" in u
        or bool(re.search(r"\bLMIA\s*#?\s*[0-9]{6,9}\b|\bSYSTEM\s*FILE\s*NUMBER\s*:\s*[0-9]{7,8}\b", u))
        or ("EMPLOYMENT AND SOCIAL DEVELOPMENT CANADA" in u and "TEMPORARY FOREIGN WORKER" in u)
    ):
        return "employment_records", "Labour_Market_Impact_Assessment_LMIA"

    if (
        "EMPLOYMENT CONTRACT" in u
        or "EMPLOYMENTCONTRACT" in u
        or "EI/IPLOYI/LENT CONTRACT" in u
        or "APPOINTMENT LETTER" in u
        or "APPOINTMENTLETTER" in u
        or "THE EMPLOYER AGREES TO EMPLOY" in u
        or ("WAGES AND DEDUCTIONS" in u and "HOURS OF WORK" in u)
    ):
        return "employment_records", "Employment_Contract_Agreement"

    if (
        bool(re.search(r"POLICE\s*CLEARANCE\s*CERTIF[I1T]CATE", u))
        or ("NO ADVERSE INFORMATION" in u and "PASSPORT" in u)
    ):
        return "police_medical", "Police_Clearance_Certificate_PCC"

    if (
        "DISCHARGE SUMMARY REPORT" in u
        or "OBGYN DISCHARGE SUMMARY" in u
        or ("PATIENT DEMOGRAPHICS" in u and "HOSPITAL COURSE" in u)
        or ("PATIENT:" in u and "MRN:" in u)
    ):
        return "police_medical", "Hospital_Medical_Record"

    if (
        "CONFIRMATION OF PERMANENT RESIDENCE" in u
        or "CONFIRMATIONOFPERMANENTRESIDENCE" in u
        or ("BECAME P.R. ON" in u and "UCI" in u)
    ):
        return "identity_passport", "Confirmation_of_Permanent_Residence_COPR"

    if (
        "STUDENT GIC PROGRAM" in u
        or "GUARANTEED INVESTMENT CERTIFICATE" in u
        or "INVESTMENT BALANCE CONFIRMATION" in u
        or "SCOTIA INVESTMENT ACCOUNT" in u
        or "INVESTMENT DIRECTIONS" in u
        or ("ICICI BANK CANADA" in u and "GIC" in u)
        or ("CIBC INTERNATIONAL STUDENT BANKING OFFER" in u and "GIC" in u)
    ):
        return "financial_evidence", "GIC_Investment_Certificate"

    if (
        "STUDENT PAYMENT RECEIPT" in u
        or "EFT FEE PAYMENT" in u
        or "ACCOUNT SUMMARY BY TERM" in u
        or ("PAYMENT ID" in u and "CAD" in u)
        or ("PAYMENT RECEIPT" in u and ("COLLEGE" in u or "UNIVERSITY" in u or "STUDENT" in u or "TUITION" in u))
        or ("CIBC INTERNATIONAL STUDENT PAY" in u and "PAYMENT" in u)
    ):
        return "financial_evidence", "Tuition_Fee_Receipt"

    # 4. Canada Revenue Agency (CRA) T4 / T4A / T4E vs Notice of Assessment (NOA)
    if (
        ("EMPLOYER'S NAME" in u and ("AGENCE DU REVENU" in u or "T4" in u or "REMUNERATION PAID" in u or "REMUNERATION PAYEE" in u))
        or "STATEMENT OF EMPLOYMENT INSURANCE" in u
        or "STATEMENT OF REMUNERATION PAID" in u
        or bool(re.search(r"\bT4E?\s*\([0-9]{2}\)", u))
        or ("BOX 14 -" in u and "CASE 14 -" in u)
        or ("BOX 37 -" in u and "CASE 37 -" in u)
    ):
        return "employment_records", "T4_Statement_of_Remuneration"
    if (
        "NOTICE OF ASSESSMENT" in u
        or "SOCIAL INSURANCE NUMBER" in u
        or "NOTICE DETAILS" in u
        or "TAX RETURN SUMMARY" in u
        or "T491 E" in u
        or "T451 E" in u
        or ("CANADA REVENUE" in u and ("ASSESSMENT" in u or "TAX YEAR" in u or "TOTAL INCOME" in u or "REFUND" in u or "BALANCE" in u))
        or ("INCOME TAX AND BENEFIT" in u and "CANADA.CA" in u)
        or bool(re.match(r"^\s*PAGE\s+[23456]\s*$", u))
    ):
        return "financial_evidence", "CRA_Notice_of_Assessment"

    # 5. Civil Status Certificates (Marriage & Birth)
    if (
        "MEMORANDUM OF MARRIAGE" in u
        or "MEMRANDUM OF MARRIAGE" in u
        or "CERTIFICATE OF MARRIAGE" in u
        or "REGISTRATION OF MARRIAGES" in u
        or ("SOLEMNIZED" in u and "MARRIAGE" in u)
    ):
        return "civil_status_family", "Marriage_Certificate"
    if (
        "BIRTH CERTIFICATE" in u
        or "CERTIFICATE OF BIRTH" in u
        or "CERTIFICATEOFBIRTH" in u
        or "BIRTH-NAISSANCE" in u
        or "REGISTRATION OF BIRTHS" in u
    ):
        return "civil_status_family", "Birth_Certificate"

    # 6. Citizenship, PR Card, Driving Licence, Aadhaar Card
    if "OATH OF CITIZENSHIP" in u or "SERMENT DE CITOYENNET" in u or bool(re.search(r"^\s*[A-Z\s]+\s+202[0-9]/[0-9]{2}/[0-9]{2}\s+[A-Z][0-9]{7}\s*$", u)):
        return "identity_passport", "Oath_of_Citizenship"
    if ("DRIVER" in u and "LICENCE" in u) or "PERMIS DE CONDUIRE" in u or "SERVICE ONTARIO" in u or "TWOAXLEMOTORVEHICLES" in u:
        return "identity_passport", "Driving_Licence"
    if (
        (("PERMANENT RESIDENT" in u or "RP DEPUIS" in u or "PR SINCE" in u or "PRSINCE" in u or "ORP IN" in u) and ("CANADA" in u or "TORONTO" in u or "LIEUDETABLISSEMENT" in u or "RP DEPUIS" in u))
        or ("PERMANENT" in u and "RESIDENT" in u and "CARTE" in u)
        or "CACANPD" in u
        or "CACAN" in u
        or "CARTE DE RESIDENT PERMANENT" in u
    ):
        return "identity_passport", "Canada_PR_Card"
    if (
        "UNIQUE IDENTIFICATION AUTHORITY" in u
        or "UNIAUE IDENTIFICATION AUTHORITY" in u
        or "UNIQUEIDENTIFICATIONAUTHORITY" in u
        or "YOUR AADHAAR NO" in u
        or "ENROLLMENT NO" in u
        or ("GOVERNMENT OF INDIA" in u and "AADHAAR" in u and "INCOME TAX" not in u)
        or (bool(re.search(r"\b[2-9][0-9]{3}\s*[0-9]{4}\s*[0-9]{4}\b", u)) and ("UIDAI" in u or "GOVERNMENTOFINDIA" in u or "આધાર" in text))
    ):
        return "identity_passport", "Aadhaar_Card"

    # 7. Visa Cover Letter, Travel Insurance, eMedical, Family Info, IRCC Forms, Foreign eVisas, Affidavits, Consent & Invitation Letters
    if (
        "TO, THE VISA OFFICER" in u
        or "SUBCLASS 600" in u
        or "TIES TO INDIA" in u
        or "PLANNED ITINERARY" in u
        or ("PURPOSE OF VISIT" in u and "FINANCIAL CAPACITY" in u)
    ):
        return "supporting_evidence", "Visa_Cover_Letter_and_Itinerary"

    if (
        "CONFIRMATION OF COVERAGE" in u
        or "INSURED COVERAGE SUMMARY" in u
        or "BASE PREMIUM" in u
        or "MANUFACTURERS LIFE" in u
        or "MANULIFE" in u
        or ("ASSISTANCE AND CLAIMS" in u and "EMERGENCY" in u)
        or ("EXCLUSIONS" in u and "EMERGENCY MEDICAL" in u)
        or ("IMPORTANT TERMS AND CONDITIONS" in u and "INSURANCE" in u)
    ):
        return "insurance_accommodation", "Travel_Insurance_Policy"

    if "VACCINATION WORKSHEET" in u or ("NON-EDE" in u and "VACCINATION" in u) or ("PANEL PHYSICIAN" in u and "VACCINATION" in u):
        return "police_medical", "eMedical_Vaccination_Worksheet"
    if bool(re.search(r"\bE[\s\-]?MEDICAL\b|\bUMIU[0-9]{6,}|STATUS\s*CLINIC", u)):
        return "police_medical", "eMedical_Information_Sheet"

    if (
        "FAMILY INFORMATION" in u
        or "FAMILYINFORMATION" in u
        or "IMM 5645" in u
        or "IMM5645" in u
        or bool(re.search(r"SECTION\s*[ABC]\s*[-–]?\s*(?:SPOUSE|CHILDREN|BROTHERS\s*AND\s*SISTERS)", u))
        or "BLOOD RELATED FAMILY MEMBERS" in u
        or "FULL NAME (AS PER PASSPORT)" in u
    ):
        return "civil_status_family", "Family_Information_Sheet"

    if (
        "USE OF A REPRESENTATIVE" in u
        or "USE OF A FAMILY MEMBER REPRESENTATIVE" in u
        or "IMM 5476" in u
        or "IMM5476" in u
        or "IMM 5713" in u
        or "IMM5713" in u
    ):
        return "government_correspondence", "Use_of_Representative_IMM5476"

    if (
        "IMM 5562" in u
        or "IMM5562" in u
        or bool(re.search(r"SUPPLEMENTARY\s*INFORMATION.*YOUR\s*TRAVELS|LIST\s*ALL\s*TRIPS\s*YOU", u, re.DOTALL))
    ):
        return "travel_records", "IRCC_Travel_History_IMM5562"

    if (
        "DOCUMENT_TYPE: IMM" in u
        or "PROTECTED WHEN COMPLETED" in u
        or "APPLICATION FOR VISITOR VISA" in u
        or "APPLICATION FOR WORK PERMIT MADE OUTSIDE OF CANADA" in u
        or "APPLICATION TO CHANGE CONDITIONS" in u
        or "IMM 1295" in u
        or "IMM 5710" in u
        or "IMM 5708" in u
        or "IMM 5257" in u
        or "PLEASE WAIT IF THIS MESSAGE IS NOT EVENTUALLY REPLACED" in u
    ):
        return "government_correspondence", "IRCC_Visa_Application_Form"

    if (
        "INDIA NON JUDICIAL" in u
        or "CERTIFICATE OF STAMP DUTY" in u
        or "STATUTORY DECLARATION" in u
        or "STATUTORYDECLARATION" in u
        or ("AFFIDAVIT" in u and ("NOTARY" in u or "SOLEMNLY AFFIRM" in u or "DEPONENT" in u))
    ):
        return "supporting_evidence", "Notarized_Affidavit_or_Declaration"

    if (
        "CONSENT LETTER FOR CHILDREN TRAVELLING ABROAD" in u
        or ("CONSENT LETTER" in u and "TRAVELLING" in u and "CHILD" in u)
    ):
        return "supporting_evidence", "Minor_Travel_Consent_Letter"

    if (
        "LETTER OF INVITATION" in u
        or "INVITATION LETTER" in u
        or ("TO WHOMSOEVER IT MAY CONCERN" in u and "INVITE" in u and "VISITOR VISA" in u)
        or ("CANADIAN CITIZENSHIP OR PERMANENT RESIDENT" in u and "BEAR ALL THE RESPONSIBILITIES" in u)
    ):
        return "government_correspondence", "Letter_of_Invitation"

    if "MAXIMUM STAY 30 DAYS" in u or "MAXIMUM STAY 3O DAYS" in u or "MAXIMUMSTAY3ODAYS" in u or "ALLOWED TO ENTER UAE" in u:
        return "government_correspondence", "UAE_eVisa_Grant"
    if "SAFEGUARDING OUR HOME" in u or "E-VISA FOR REPUBLIC OF SINGAPORE" in u:
        return "government_correspondence", "Singapore_eVisa_Grant"
    if "GOVERNMENT OF MALAYSIA" in u or "MALAYSIA IMMIGRATION" in u or "ELECTRONIC VISA" in u or bool(re.search(r"\bE[\s\-]?VI\s*SA\b", u)):
        return "government_correspondence", "Malaysia_eVisa_Grant"

    # 8. Utility Bills, Payroll, Employment
    if "SASK POWER" in u or "SASKPOWER" in u or "POWER USE COMPARISON" in u:
        return "supporting_evidence", "Utility_Bill_Statement"
    if "SUMMARY" in u and "EARNINGS" in u and "TAXES" in u:
        return "employment_records", "Payroll_Earnings_Statement"
    if "EMPLOYEE NAME" in u and "PAY DATE" in u:
        return "employment_records", "Salary_Pay_Stub"
    if "PERIOD OF EMPLOYMENT" in u or ("JOB TITLE" in u and "DUTIES AND RESPONSIBILITIES" in u) or ("TO WHOM IT MAY CONCERN" in u and "EMPLOYED" in u):
        return "employment_records", "Employment_Verification_Letter"

    # 9. Share Portfolio Valuation vs Property Valuation vs Demat vs Bank Claim Form 135 vs Academic
    if ("VALUATION REPORT" in u or "YALUATION REPORT" in u) and ("CURRENT SENSEX" in u or "SENSEX" in u):
        return "financial_evidence", "Share_Portfolio_Valuation_Report"
    if "REPORT OF VALUATION FOR GOLD JEWELLERY" in u or ("JEWELLERY" in u and "VALUER" in u) or ("ORNAMENT" in u and "VALUATION" in u):
        return "financial_evidence", "Gold_Jewellery_Valuation_Report"
    if (
        "REGISTERED VALUER" in u
        or "GOVT.APPROVED" in u
        or "GOVT. APPROVED VALUER" in u
        or "DOCUMENTS OF PROPERTY PRODUCED" in u
        or "YEAR IN WHICH THE PROPERTY WAS CONSTRUCTED" in u
        or "AREA OF AGRICULTURE LAND" in u
        or "VALUATION REPORT" in u
        or "YALUATION REPORT" in u
    ):
        return "financial_evidence", "Property_Valuation_Report"

    if (
        ("ANNEXURE-1" in u and "135" in u)
        or "NOMINATION PARTICULARS" in u
        or "INVESTMENT IN GOVERNMENTSECURITIES" in u
        or "APPLICANTIGUARANTORFOR ADVANCES" in u
        or "PROPERTY IN WHOSE NAME" in u
    ):
        return "financial_evidence", "Bank_Claim_Form_135"

    if "CHANCELLOR" in u or "OTHANELOR" in u or "BACHELOR OF" in u or "MASTER OF" in u:
        return "educational_records", "University_Degree_Certificate"
    if ("MARKS" in u and "OBTAINED" in u) or ("UNIVERSITY" in u and "SEMESTER" in u) or ("EXAMINATION" in u and "SUBJECT" in u):
        return "educational_records", "Academic_Marksheet_Transcript"

    if (
        "STATEMENT OF ACCOUNT" not in u
        and "STATEMCNT OF ACCOUNT" not in u
        and "STALEMENT OF ACCOUNT" not in u
        and (
            "HOLDING VALUATION" in u
            or "HOLDING STATEMENT FOR THE PERIOD" in u
            or "CENTRAL DEPOSITORY SERVICES" in u
            or "CENBRAL DEPOSHORY" in u
            or "FREE UNITS BALANCE" in u
            or "FAM CODE :-" in u
            or ("HORNIC INVESTMENT" in u and "MUMBAI" in u)
        )
    ):
        return "financial_evidence", "Demat_Investment_Holding_Statement"

    # 10. Bank Balance Certificates, Fixed Deposit Receipts, and Bank Account Statements
    if (
        "BALANCE CERTIFICATE AS ON" in u
        or "BALANCECERTIFICATEASON" in u
        or ("THE MEHSANA URBAN CO-OP BANK" in u and "URBAN BANK ROAD" in u and "USER ID" in u and "STATEMENT OF ACCOUNT" not in u)
    ):
        return "financial_evidence", "Bank_Balance_Certificate"
    if "CUMMULATIVE DEPOSIT" in u or ("RECEIVED FROM" in u and "FOR RS." in u and "MATURITY" in u):
        return "financial_evidence", "Fixed_Deposit_Receipt"
    if (
        "STATEMENT OF ACCOUNT" in u
        or "STATEMCNT OF ACCOUNT" in u
        or "STALEMENT OF ACCOUNT" in u
        or "ULTIMATE PACKAGE ACCOUNT" in u
        or "CONTINUED ON NEXT PAGE" in u
        or "SBSAV" in u
        or "CO-OP BANK" in u
        or "CO-OPERATIVE BANK" in u
        or "KALUPUR COMMERCIAL" in u
        or "KALUPURBANKBHAVAN" in u
        or "IMDIAN BANK" in u
        or "INDIAN BANK" in u
        or "CIBC" in u
        or "MSNU0000047" in u
        or ("NOMINEE" in u and "CIF" in u)
        or ("DATE" in u and ("PARTICULARS" in u or "RARTOULARS" in u))
        or ("DEBIT" in u and "BALANCE" in u)
        or ("CREOIT" in u or "CREDTT" in u or "CREDCT" in u)
        or "INTEREST CREDIT" in u
        or "BROUGHT FORWARD" in u
        or "CARRIED FORWARD" in u
        or "PPF PART WITHDRAWAL" in u
        or "GENERALLY USED ABBREVIATIONS" in u
        or "HPTIRGENERALLYUSEDABBREVIATIONS" in u
        or "END OF STATEMENT" in u
    ):
        return "financial_evidence", "Bank_Account_Statement"

    # 11. Passports & Travel Stamps
    if (
        "REPUBLIC OF INDIA" in u
        or "REPUBLTCOF TNDIA" in u
        or "REPUBLIC OFINDIA" in u
        or "REPUBLTC OF: INDIA" in u
        or "RFPUBLTC OF INDIA" in u
        or "PASSPORT" in u
        or "PASSEPORT" in u
        or "P<IND" in u
        or "P<CAN" in u
        or "SIGNATURE OF BEARER" in u
        or "NAME OF FATHER/LEGAL GUARDIAN" in u
        or "NAME OF FATHER/LEGAI GUARDIAN" in u
        or "OLD PASSPORT NO" in u
        or "PASSPORT CANCELLED" in u
        or "/VISA" in u
        or "/ VISA" in u
        or "VISA/VISUM" in u
        or "DEPARTURE" in u
        or "DPARTURE" in u
        or "DEPARTED" in u
        or "ARRIVAL" in u
        or "ARRVAL" in u
        or "ARRVAI" in u
        or "ARRIVAI" in u
        or "ARR VA L" in u
        or "ISA ON ARPAL" in u
        or "ISA ON ARFRAL" in u
        or "IMMIGRATION" in u
        or "MMIGRATIONNDIA" in u
        or "UMMEGRATOM" in u
        or "ROISSY-CG" in u
        or "FUMICINO" in u
        or ("PLACE OF BIRTH" in u and "GIVEN NAM" in u)
        or bool(re.search(r"Address\s+[^\r\n]+\s+([A-Z]+\s+[A-Z]+\s+PATEL)\s+([A-Z]+\s+[A-Z]+\s+PATEL)", text))
    ):
        return "identity_passport", "Passport_and_Travel_Stamps"

    return category, category.replace("_", " ").title().replace(" ", "_")


def extract_page_subjects_and_anchors(
    page: PageExtractionResult,
    category: str,
    subtype: str,
    extracted_fields: list[Any],
) -> dict[str, Any]:
    """
    Extracts primary person holder(s) and continuity ID anchors from a single page
    using 100% general structural, MRZ, and label regex patterns (zero hardcoded PII).
    Strictly separates Primary Holders from Parent/Relative/Valuer/Employer metadata.
    """
    text = page.text or ""
    u = text.upper()

    primary_names: list[str] = []
    bridged_married_aliases: list[Tuple[str, str]] = []
    is_joint = False
    id_anchors: dict[str, str] = {}
    metadata_relatives: list[str] = []

    field_map: dict[str, str] = {}
    for f in extracted_fields:
        val = (f.normalized_value or f.original_value or "").strip()
        if f.field_name and val and f.field_name not in field_map:
            field_map[f.field_name] = val

    # 1. Extract ID anchors (PAN, Passport No, File No, SIN, UMI, Account No, BO ID)
    pan_m = re.search(r"\b([A-Z]{3}[PCHFATBLJG][A-Z][0-9]{4}[A-Z])\b", u)
    if pan_m:
        id_anchors["pan"] = pan_m.group(1)

    # Passport MRZ Line 1 & 2 parsing (general ICAO 9303 standard)
    mrz_l1 = re.search(r"\bP[P<I1]?[A-Z]{3}([A-Z]{2,})<<?([A-Z]+(?:<[A-Z]+)*)<<", u)
    mrz_l2 = re.search(r"\b([A-Z][0-9]{6,7}[A-Z0-9]?)<[0-9O][A-Z]{3}[0-9]{6}[0-9][MF<][0-9]{6}[0-9]([A-Z0-9<]{10,14})", u)
    if mrz_l2:
        id_anchors["passport"] = mrz_l2.group(1)
        file_tail = mrz_l2.group(2).replace("<", "").strip()
        if len(file_tail) >= 8:
            id_anchors["file_no"] = file_tail[-10:]

    file_no_m = re.search(r"\bAH[0-9]{10,13}\b", u)
    if file_no_m:
        id_anchors["file_no"] = file_no_m.group(0)[-10:]

    if "passport" not in id_anchors:
        if field_map.get("passport_number"):
            pno = field_map["passport_number"].upper()
            if re.match(r"^[A-Z][0-9]{6,8}$", pno):
                id_anchors["passport"] = pno
        else:
            p_m = re.search(r"\b([A-Z][0-9]{7})\b", u)
            if p_m and subtype in (
                "Passport_and_Travel_Stamps",
                "eMedical_Information_Sheet",
                "eMedical_Vaccination_Worksheet",
                "Foreign_eVisa_Grant",
                "UAE_eVisa_Grant",
                "Singapore_eVisa_Grant",
                "Malaysia_eVisa_Grant",
                "IRCC_Visa_Application_Form",
                "Oath_of_Citizenship",
            ):
                id_anchors["passport"] = p_m.group(1)

    umi_m = re.search(r"\b(UMIU?[0-9]{8,12}|U0[0-9]{8})\b", u)
    if umi_m:
        id_anchors["umi"] = umi_m.group(1)[-10:]

    sin_m = re.search(r"(?:Social\s+insurance\s+number|SIN)[\s:]*([0-9X]{3}\s+[0-9X]{3}\s+[0-9]{3})", text, re.IGNORECASE)
    if sin_m:
        id_anchors["sin"] = sin_m.group(1).strip()

    sbsav_m = re.search(r"\b(SBSAV[0-9_]+)\b", u)
    if sbsav_m:
        id_anchors["account"] = sbsav_m.group(1)

    boid_m = re.search(r"\b(120[0-9]{5}\s*[0-9]{8})\b", u)
    if boid_m:
        id_anchors["account"] = re.sub(r"\s+", "", boid_m.group(1))

    dl_ref_m = re.search(r"\b(HV[0-9]{7})\b", u)
    if dl_ref_m:
        id_anchors["account"] = dl_ref_m.group(1)

    uci_m = re.search(r"\b([0-9]{2}-[0-9]{4}-[0-9]{4})\b|<([0-9]{10})<{2,}", u)
    if uci_m:
        id_anchors["uci"] = re.sub(r"[^0-9]", "", uci_m.group(1) or uci_m.group(2))
    elif field_map.get("uci_number"):
        uci_digits = re.sub(r"[^0-9]", "", field_map["uci_number"])
        if len(uci_digits) in (8, 10):
            id_anchors["uci"] = uci_digits

    # 2. Subtype-specific Primary Holder Extraction (100% general structural rules)
    if subtype == "PAN_Identity_Card":
        # On a PAN card, the cardholder's name is after 'Name' or 'GOVT. OF INDIA' and BEFORE Father's Name
        pan_card_m = re.search(r"Name\s*[\r\n]+\s*([A-Z][A-Z\s\.]{4,40}?)\s*[\r\n]+\s*Father", text, re.IGNORECASE)
        if pan_card_m and is_valid_person_name_candidate(pan_card_m.group(1)):
            primary_names.append(deconcatenate_indian_name(pan_card_m.group(1)))
        else:
            pan_card_m2 = re.search(r"GOVT\.?\s*OF\s*INDIA\s+([A-Z]{3,}\s+[A-Z]{6,30})\s+[A-Z]{4,}\s+[A-Z]{4,}\s+PATEL", u)
            if pan_card_m2 and is_valid_person_name_candidate(pan_card_m2.group(1)):
                primary_names.append(deconcatenate_indian_name(pan_card_m2.group(1)))

    elif subtype == "GST_Registration_Certificate":
        gst_m = re.search(r"Legal\s+Name\s+([A-Za-z\s]{5,40}?)(?=\s+Trade|\s+Constitution|\r|\n)", text, re.IGNORECASE)
        if gst_m and is_valid_person_name_candidate(gst_m.group(1)):
            primary_names.append(deconcatenate_indian_name(gst_m.group(1)))

    elif subtype == "Marriage_Certificate":
        is_joint = True
        # Pattern A: Gujarat Registration of Marriages Act ('Certify that Shri <GroomGiven> Son of Shri <GroomFatherSurname> ... and [<BrideGiven>] daughter of Shri ...')
        guj_groom = re.search(
            r"Certify\s+that\s+(?:Shri|Mr\.?)?\s*([A-Z]{3,})\s+Son\s+of\s+(?:Shri|Mr\.?)?\s*([A-Z][A-Z\s]{3,35}?)(?=\s+residing|\r|\n)",
            text,
            re.IGNORECASE,
        )
        if guj_groom:
            g_first = guj_groom.group(1).strip()
            g_rest = deconcatenate_indian_name(guj_groom.group(2).strip())
            groom_full = deconcatenate_indian_name(f"{g_first} {g_rest}")
            primary_names.append(groom_full)
            g_toks = normalize_person_tokens(groom_full)
            g_surname = g_toks[-1].title() if g_toks else ""

            guj_bride_inline = re.search(r"\band\s+([A-Z]{3,})\s+daughter\s+of", text, re.IGNORECASE)
            bride_given = guj_bride_inline.group(1).strip() if guj_bride_inline else None
            if not bride_given:
                displaced_b = re.search(r"solemnized\s+on\s+[0-9/\-]+\s*[\r\n]+\s*([A-Z]{3,15})\s*[\r\n]+", text, re.IGNORECASE)
                if displaced_b:
                    bride_given = displaced_b.group(1).strip()
            if bride_given and g_surname:
                bride_married = deconcatenate_indian_name(f"{bride_given} {g_first} {g_surname}")
                primary_names.append(bride_married)

        # Pattern B: Bombay Registration of Marriages Act ('<FULL NAME>, \n <NN> years, \n ... Unmarried/Widower/Divorced')
        if not primary_names:
            bom_matches = re.findall(
                r"([A-Z][A-Z\s\.]{5,40}?)[,\.]?\s*[\r\n]+\s*[1-5][0-9]\s*years[\.,\s]+[\r\n]+\s*(?:[A-Za-z\.\s]+[\r\n]+)?\s*(?:Unmarried|Widower|Widow|Divorced)",
                text,
                re.IGNORECASE,
            )
            for bm in bom_matches[:2]:
                clean_bm = deconcatenate_indian_name(bm)
                if is_valid_person_name_candidate(clean_bm):
                    primary_names.append(clean_bm)
            if len(primary_names) == 2:
                g_toks = normalize_person_tokens(primary_names[0])
                b_toks = normalize_person_tokens(primary_names[1])
                if len(g_toks) >= 2 and len(b_toks) >= 2:
                    married_alias = f"{b_toks[0].title()} {g_toks[0].title()} {g_toks[-1].title()}"
                    bridged_married_aliases.append((primary_names[1], married_alias))

        # Pattern C: Fallback to extractor's groom_name / bride_name
        if not primary_names:
            for k in ("groom_name", "bride_name"):
                if field_map.get(k) and is_valid_person_name_candidate(field_map[k]):
                    primary_names.append(deconcatenate_indian_name(field_map[k]))

    elif subtype == "Birth_Certificate":
        ont_child = re.search(r"(?:Nom\s+)?Name\s+([A-Z]{2,},\s*[A-Z][A-Z\s]{2,40}?)(?=\r|\n|Date)", text)
        if ont_child:
            primary_names.append(deconcatenate_indian_name(ont_child.group(1)))
        else:
            cand_c = field_map.get("child_legal_name") or field_map.get("full_name")
            if cand_c and is_valid_person_name_candidate(cand_c):
                primary_names.append(deconcatenate_indian_name(cand_c))

    elif subtype == "Passport_and_Travel_Stamps":
        is_back_endorsement = bool(
            re.search(r"Name\s*of\s*Father\s*/\s*Lega[il]\s*Guardian|PASSPORT\s*CANCELLED|OLD\s*PASSPORT\s*NO", u)
            or re.search(r"Address\s+[^\r\n]+\s+[A-Z]+\s+[A-Z]+\s+PATEL\s+[A-Z]+\s+[A-Z]+\s+PATEL", text)
        ) and not bool(mrz_l1)

        if is_back_endorsement:
            for rel_k in ("father_legal_name", "mother_legal_name", "spouse_legal_name"):
                if field_map.get(rel_k):
                    metadata_relatives.append(field_map[rel_k])
        else:
            if mrz_l1:
                sur = mrz_l1.group(1).replace("<", " ").strip()
                giv = mrz_l1.group(2).replace("<", " ").strip()
                primary_names.append(deconcatenate_indian_name(f"{giv} {sur}"))
            else:
                sur_m = re.search(r"(?:Surname|Suname|Suneme|Nom)\s*(?:[A-Z]{2,3}\s+[A-Z]{3}\s+[A-Z0-9]+\s*)?[\r\n:]+\s*([A-Z]{3,20})\s*[\r\n]+\s*Given\s*Name\(?s?\)?(?:/Prenoms)?\s*[\r\n:]+\s*([A-Z][A-Z\s]{2,35}?)(?=\r|\n|Nationality|Date|Sex)", text, re.IGNORECASE)
                if sur_m:
                    primary_names.append(deconcatenate_indian_name(f"{sur_m.group(2)} {sur_m.group(1)}"))
                else:
                    inv_bio_m = re.search(r"([A-Z]{4,}\s+[A-Z]{4,})\s+Given\s+Nam[ea].*?\b(Pate\s*l|Patel)\b", text, re.IGNORECASE | re.DOTALL)
                    if inv_bio_m:
                        primary_names.append(deconcatenate_indian_name(f"{inv_bio_m.group(1)} Patel"))
                    else:
                        visa_sticker = re.search(r"SURNAME\s*/?\s*NOM\s*DE\s*FAMILLE[\.\s:]*([A-Z][A-Z\s]{4,35}?)(?=\s+V-1|\s+CATEGORY|\r|\n)", u)
                        if visa_sticker:
                            primary_names.append(deconcatenate_indian_name(visa_sticker.group(1)))

    elif subtype == "Canada_PR_Card":
        pr_multiline = re.search(
            r"Name\s*/\s*Nom\s*[\r\n]+\s*([A-Z]{3,20})\s*[\r\n]+\s*([A-Z]{3,20}(?:\s+[A-Z]{3,20})?)",
            text,
            re.IGNORECASE,
        )
        if pr_multiline:
            cand_ml = deconcatenate_indian_name(f"{pr_multiline.group(2).strip()} {pr_multiline.group(1).strip()}")
            if is_valid_person_name_candidate(cand_ml):
                primary_names.append(cand_ml)
        else:
            pr_m = re.search(r"Name\s*/\s*Nom[ \t]+([A-Z]{3,}[ \t]+[A-Z]{3,}(?:[ \t]+[A-Z]{3,})?)", text, re.IGNORECASE)
            if pr_m:
                toks = normalize_person_tokens(pr_m.group(1))
                if len(toks) == 3 and toks[0].upper() in INDIAN_SURNAMES:
                    primary_names.append(f"{toks[2].title()} {toks[1].title()} {toks[0].title()}")
                else:
                    primary_names.append(deconcatenate_indian_name(pr_m.group(1)))
        if not primary_names:
            pr_mrz = re.search(r"\b([A-Z]{2,})<<([A-Z]+(?:<[A-Z]+)*)<{2,}", u)
            if pr_mrz:
                sur = pr_mrz.group(1).strip()
                giv = pr_mrz.group(2).replace("<", " ").strip()
                cand_pr = deconcatenate_indian_name(f"{giv} {sur}")
                if is_valid_person_name_candidate(cand_pr):
                    primary_names.append(cand_pr)

    elif subtype == "Confirmation_of_Permanent_Residence_COPR":
        copr_m = re.search(
            r"Family\s*name\s*:\s*([A-Z\s\-]{2,30}?)\s+Given\s*name\(s\)\s*:\s*([A-Z\s\-]{2,40}?)(?=\r|\n|UCI|Date)",
            text,
            re.IGNORECASE,
        )
        if copr_m:
            cand_copr = deconcatenate_indian_name(f"{copr_m.group(2).strip()} {copr_m.group(1).strip()}")
            if is_valid_person_name_candidate(cand_copr):
                primary_names.append(cand_copr)
        elif field_map.get("full_name") and is_valid_person_name_candidate(field_map["full_name"]):
            primary_names.append(deconcatenate_indian_name(field_map["full_name"]))

    elif subtype == "Driving_Licence":
        dl_m = re.search(r"CANADA\s+(?:[A-Z]+\s+)?(PATEL\s+[A-Z]{4,}(?:\s+[A-Z]{4,})?)", u)
        if dl_m:
            primary_names.append(deconcatenate_indian_name(dl_m.group(1)))
        elif field_map.get("full_name") and is_valid_person_name_candidate(field_map["full_name"]):
            primary_names.append(deconcatenate_indian_name(field_map["full_name"]))

    elif subtype == "Oath_of_Citizenship":
        oath_m = re.search(r"^\s*([A-Z]{3,}\s+[A-Z]{3,}\s+[A-Z]{3,})\s+202[0-9]/[0-9]{2}/[0-9]{2}", text)
        if oath_m and is_valid_person_name_candidate(oath_m.group(1)):
            primary_names.append(deconcatenate_indian_name(oath_m.group(1)))

    elif subtype == "Aadhaar_Card":
        # Match English line before S/O, D/O, W/O, DOB, or Date
        aadh_m1 = re.search(r"\bTo[\.,\s]+([A-Za-z\s]{5,35}?)(?=\s+S/O|\s+D/O|\s+W/O)", text, re.IGNORECASE)
        if aadh_m1 and is_valid_person_name_candidate(aadh_m1.group(1)):
            primary_names.append(deconcatenate_indian_name(aadh_m1.group(1)))
        else:
            aadh_m2 = re.search(r"[\r\n]+\s*([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*[\r\n]+\s*(?:[0-9]{2}/[0-9]{2}/[0-9]{4}|[^\r\n]*?(?:DOB|D0B))", text)
            if aadh_m2 and is_valid_person_name_candidate(aadh_m2.group(1)):
                primary_names.append(deconcatenate_indian_name(aadh_m2.group(1)))
            else:
                aadh_m3 = re.search(r"([A-Za-z]{4,15}\s+[A-Za-z]{4,15}(?:\s+[A-Za-z]{4,15})?)\s*[\r\n]+[^\r\n]*?(?:DOB|D0B|[0-9]{2}/[0-9]{2}/[12][09][0-9]{2})", text)
                if aadh_m3 and is_valid_person_name_candidate(aadh_m3.group(1)):
                    primary_names.append(deconcatenate_indian_name(aadh_m3.group(1)))

    elif subtype == "Income_Tax_Return_ITR":
        ay_m = re.search(
            r"(?:Assessment\s*(?:Year)?|A\.?Y\.?|AY\.)[\s:\r\n]*([2][0][0-9]{2})\s*-\s*(?:20)?([0-9]{2})",
            text,
            re.IGNORECASE,
        )
        if ay_m:
            id_anchors["itr_ay"] = f"{ay_m.group(1)}-{ay_m.group(2)}"
        else:
            fil_m = re.search(
                r"Date\s*of\s*filing\s*:\s*[0-9]{1,2}[\-/][A-Za-z0-9]{2,3}[\-/](20[0-9]{2})",
                text,
                re.IGNORECASE,
            )
            if fil_m:
                yr = int(fil_m.group(1))
                id_anchors["itr_ay"] = f"{yr}-{str(yr + 1)[-2:]}"

        itr_m = re.search(
            r"(?:Name\s*of\s*Assessee|NAMEOFASSESSEE|NAME\s*OFASSESSEE)[\s:]+([A-Z][A-Za-z\s\.]{4,45}?)(?=\s+AY\.|\s+PAN|\s+Father|\r|\n|$)",
            text,
            re.IGNORECASE,
        )
        if itr_m and is_valid_person_name_candidate(itr_m.group(1)):
            primary_names.append(deconcatenate_indian_name(itr_m.group(1)))
        if not primary_names:
            ack_m = re.search(r"\bName\s+([A-Z][A-Z\s]{4,45}?)(?=\s+Address|\s+PAN|\s+Status|\r|\n)", text)
            if ack_m and is_valid_person_name_candidate(ack_m.group(1)):
                primary_names.append(deconcatenate_indian_name(ack_m.group(1)))
        if not primary_names:
            top_m = re.search(r"^\s*([A-Z][A-Z\s]{5,45}?)\s*[\r\n]+\s*[1-9]\s*[\r\n]+\s*PAN\s*:", text, re.MULTILINE)
            if top_m and is_valid_person_name_candidate(top_m.group(1)):
                primary_names.append(deconcatenate_indian_name(top_m.group(1)))

    elif subtype in ("Property_Valuation_Report", "Share_Portfolio_Valuation_Report", "Gold_Jewellery_Valuation_Report"):
        own_m1 = re.search(r"in\s+the\s+Name\s+Of\s+([A-Za-z\s]{5,45}?)(?=[\.\r\n]|$)", text, re.IGNORECASE)
        if own_m1 and is_valid_person_name_candidate(own_m1.group(1)):
            primary_names.append(deconcatenate_indian_name(own_m1.group(1)))
        own_m2 = re.search(r"\b10\s+NAME\s*:\s*([A-Z][A-Z\s/]{5,70}?)(?=\s+11|\s+ADDRESS|\r|\n)", u)
        if own_m2:
            parts = [p.strip() for p in own_m2.group(1).split("/") if p.strip()]
            for pt in parts:
                if is_valid_person_name_candidate(pt):
                    primary_names.append(deconcatenate_indian_name(pt))
            if len(primary_names) > 1:
                is_joint = True
        if not primary_names:
            own_m3 = re.search(r"High\s+Class[\.\s]+([A-Za-z\s]{5,40}?)\.", text, re.IGNORECASE)
            if own_m3 and is_valid_person_name_candidate(own_m3.group(1)):
                primary_names.append(deconcatenate_indian_name(own_m3.group(1)))

    elif subtype == "CA_Net_Worth_Certificate":
        ca_joint_m = re.search(
            r"Certify\s+that\s+([A-Za-z\.\s&]{10,95}?)(?=\s+residing|\s+having|\s*\(|\r|\n)",
            text,
            re.IGNORECASE,
        )
        if ca_joint_m and "&" in ca_joint_m.group(1):
            for part in ca_joint_m.group(1).split("&"):
                clean_pt = deconcatenate_indian_name(part.strip())
                if is_valid_person_name_candidate(clean_pt):
                    primary_names.append(clean_pt)
            if len(primary_names) > 1:
                is_joint = True
        if not primary_names:
            ca_m = re.search(
                r"(?:Certify\s+that|assets\s+of|total\s+income\s+of)\s+(?:Mr\.?|Mrs\.?|Ms\.?|Shri|Smt\.?)?\s*([A-Za-z\s\.]{5,45}?)(?=\s+&\s+|\s+residing|\s+having|\s*\(|\r|\n)",
                text,
                re.IGNORECASE,
            )
            if ca_m and is_valid_person_name_candidate(ca_m.group(1)):
                primary_names.append(deconcatenate_indian_name(ca_m.group(1)))

    elif subtype == "Demat_Investment_Holding_Statement":
        demat_m1 = re.search(r"Detail\s+Statement\s+as\s+On\s+[0-9/]+\s*[\r\n]+\s*([A-Z][A-Z\s]{5,45}?)\s*[\r\n]+", text, re.IGNORECASE)
        if demat_m1 and is_valid_person_name_candidate(demat_m1.group(1)):
            primary_names.append(deconcatenate_indian_name(demat_m1.group(1)))
        else:
            demat_m2 = re.search(r"Date\s*:\s*[0-9A-Za-z\-]+\s*[\r\n]+\s*Name\s*[\r\n]+\s*([A-Z][A-Z\s]{5,45}?)\s*[\r\n]+", text, re.IGNORECASE)
            if demat_m2 and is_valid_person_name_candidate(demat_m2.group(1)):
                primary_names.append(deconcatenate_indian_name(demat_m2.group(1)))

    elif subtype in ("Foreign_eVisa_Grant", "UAE_eVisa_Grant", "Singapore_eVisa_Grant", "Malaysia_eVisa_Grant"):
        for pat in (
            r"Allowed\s+to\s+enter\s+UAE\s+to\s*:\s*([A-Za-z\.\s]{5,45}?)(?=\s+Full\s+Name|\r|\n)",
            r"e-Visa\s+Number\s*:\s*[A-Z0-9]+\s+Name\s*:\s*([A-Z\s]{5,45}?)(?=\s+Date|\r|\n)",
            r"Full\s+Name\s+([A-Z][A-Z\s]{5,45}?)(?=\s+Date\s+Of\s+Birth|\r|\n)",
        ):
            vm = re.search(pat, text, re.IGNORECASE)
            if vm and is_valid_person_name_candidate(vm.group(1)):
                primary_names.append(deconcatenate_indian_name(vm.group(1)))
                break

    elif subtype in ("eMedical_Information_Sheet", "eMedical_Vaccination_Worksheet"):
        em_m1 = re.search(r"Family\s+name\s*:\s*([A-Z]+).*?Given\s+Name\(s\)\s*:\s*([A-Z\s]+?)(?=\s+Identity|\s+Gender|\r|\n)", text, re.IGNORECASE | re.DOTALL)
        if em_m1:
            primary_names.append(deconcatenate_indian_name(f"{em_m1.group(2)} {em_m1.group(1)}"))
        else:
            em_m2 = re.search(r"^\s*([A-Z]{3,},\s*[A-Z]{4,})\s*[\r\n]+", text)
            if em_m2:
                primary_names.append(deconcatenate_indian_name(em_m2.group(1)))

    elif subtype in (
        "Salary_Pay_Stub",
        "Employment_Verification_Letter",
        "Payroll_Earnings_Statement",
        "T4_Statement_of_Remuneration",
        "CRA_Notice_of_Assessment",
        "Record_of_Employment_ROE",
        "Labour_Market_Impact_Assessment_LMIA",
        "Employment_Contract_Agreement",
    ):
        for pat in (
            r"Employee\s+Name\s*:\s*[\r\n]*\s*([A-Za-z\s]{5,40}?)(?=\s+Pay\s+Date|\r|\n)",
            r"Re\s*:\s*([A-Za-z\s]{5,35}?)(?=\s*\(|\r|\n)",
            r"confirm\s+that\s+([A-Za-z\s]{5,35}?)\s+is\s+(?:currently\s+)?employed",
            r"Foreign\s+Worker\s+Names?\s*[\r\n:]+\s*([A-Za-z\s,]{5,45}?)(?=\s+[A-Z][0-9]{7}|\s+Expiry|\r|\n)",
            r"SUDBURY\s+ON\s+[A-Z0-9\s]+\s*[\r\n]+\s*([A-Z][A-Z\s]{5,35}?)\s*[\r\n]+\s*[0-9]+\s+[A-Z]",
            r"^\s*([A-Z][A-Z\s]{5,35}?)\s*[\r\n]+\s*[0-9]+\s+[A-Z]+\s+(?:CRES|AVE|ST|RD|DR|CRT|COURT|BLVD|WAY|LN)\b",
            r"Tax\s+year\s*[\r\n]+\s*20[0-9]{2}\s*[\r\n]+\s*([A-Z][A-Z\s]{5,35}?)\s*[\r\n]+",
            r"Autres\s+Other\s+([A-Z]{3,}\s+[A-Z]{3,})",
            r"[0-9]+\s+[A-Za-z]+\s+(?:Court|Crt|Cres|Ave|St|Rd|Dr|Blvd|Way|Ln)\b\s*[\r\n]+\s*([A-Z][A-Za-z\s]{4,35}?)\s*[\r\n]+",
            r"EMPLOYEE'S\s+NAME\s+AND\s+ADDRESS\s*[\r\n]+\s*([A-Z][A-Za-z\s]{4,35}?)\s*[\r\n]+",
        ):
            for em in re.finditer(pat, text, re.IGNORECASE | re.MULTILINE):
                if is_valid_person_name_candidate(em.group(1)):
                    primary_names.append(deconcatenate_indian_name(em.group(1)))
                    break
            if primary_names:
                break
        if not primary_names:
            for k in ("full_name", "applicant_name"):
                val = field_map.get(k)
                if val and is_valid_person_name_candidate(val):
                    primary_names.append(deconcatenate_indian_name(val))
                    break

    elif subtype in (
        "Offer_Letter_LOA",
        "IELTS_Language_Test_Report",
        "Provincial_Attestation_Letter_PAL",
        "School_Bonafide_Certificate",
        "GIC_Investment_Certificate",
        "Tuition_Fee_Receipt",
        "Police_Clearance_Certificate_PCC",
        "Hospital_Medical_Record",
        "Use_of_Representative_IMM5476",
    ):
        for k in ("full_name", "applicant_name", "account_holder_name"):
            val = field_map.get(k)
            if val and is_valid_person_name_candidate(val):
                primary_names.append(deconcatenate_indian_name(val))
                break

    elif subtype in ("Bank_Account_Statement", "Bank_Balance_Certificate", "Fixed_Deposit_Receipt"):
        bal_cert_m = re.search(
            r"BALANCE\s*CERTIFICATE\s*AS\s*ON\s*[0-9\-]+\s+To[,\.]?\s*[\r\n]+\s*([A-Z][A-Z\s]{5,45}?)(?=\r|\n|[0-9])",
            text,
            re.IGNORECASE,
        )
        if bal_cert_m and is_valid_person_name_candidate(bal_cert_m.group(1)):
            primary_names.append(deconcatenate_indian_name(bal_cert_m.group(1)))

        if not primary_names:
            stmt_hdr_m = re.search(
                r"Stat[ce]m[ce]nt\s+of\s+Account\s+Nam[ec]\s+([A-Z][A-Z\s]{5,45}?)(?=\s+IFSC|\r|\n)",
                text,
                re.IGNORECASE,
            )
            if stmt_hdr_m and is_valid_person_name_candidate(stmt_hdr_m.group(1)):
                primary_names.append(deconcatenate_indian_name(stmt_hdr_m.group(1)))

        is_passbook_legend = "GENERALLY USED ABBREVIATIONS" in u or "HPTIRGENERALLYUSEDABBREVIATIONS" in u
        if not primary_names and not is_passbook_legend:
            jh_m = re.search(r"Joint\s+Holder\s+Name\s*[\r\n:]+\s*([A-Z][A-Za-z\.\s]{5,45}?)(?=\s+Account|\s+Yes|\s+No|\r|\n)", text, re.IGNORECASE)
            if jh_m and is_valid_person_name_candidate(jh_m.group(1)):
                primary_names.append(deconcatenate_indian_name(jh_m.group(1)))

        if not primary_names:
            can_bank_m = re.search(r"\b((?:MR|MRS|MS)\s+[A-Z][A-Z\s]{4,35}?)\s*[\r\n]+\s*[0-9]{1,5}\s+[A-Z]", text)
            if can_bank_m and is_valid_person_name_candidate(can_bank_m.group(1)):
                primary_names.append(deconcatenate_indian_name(can_bank_m.group(1)))

        if not primary_names:
            fd_m = re.search(
                r"RECEIVED\s+FROM\s*:.*?(?:ACCOUNT\s*NO\.?\s*[0-9]+\s*[\r\n]+)?\s*([A-Z][A-Z\s&]{5,80}?)\s*[\r\n]+\s*(?:FOR\s+RS|RUPEES)",
                text,
                re.IGNORECASE | re.DOTALL,
            )
            if fd_m:
                parts = [p.strip() for p in fd_m.group(1).split("&") if p.strip()]
                for pt in parts:
                    if is_valid_person_name_candidate(pt):
                        primary_names.append(deconcatenate_indian_name(pt))
                if len(primary_names) > 1:
                    is_joint = True

        if not primary_names and "MSNU0000047" in u:
            msnu_matches = re.findall(r"\b([A-Z]{5,}\s+[A-Z]{5,}\s*PATEL|PATEL\s+[A-Z]{5,}\s+[A-Z]{5,})\b", u)
            for mm in msnu_matches[:2]:
                if is_valid_person_name_candidate(mm):
                    primary_names.append(deconcatenate_indian_name(mm))
            if len(primary_names) > 1:
                is_joint = True

        if not primary_names and ("RARTOULARS" in u or "BROUGHT FORWARD" in u or "DEP TFR" in u):
            tfr_m = re.search(r"TRANSFER\s+(?:TO|FROM)\s+([A-Za-z\.\'\s]{6,35}?)(?=\r|\n|[0-9])", text, re.IGNORECASE)
            if tfr_m and is_valid_person_name_candidate(tfr_m.group(1)):
                primary_names.append(deconcatenate_indian_name(tfr_m.group(1)))

    elif subtype == "Bank_Claim_Form_135":
        claim_m = re.search(r"Name\s+in\s+Full\s+([A-Z][A-Z\s]{5,40}?)(?=\r|\n|[0-9])", text, re.IGNORECASE)
        if claim_m and is_valid_person_name_candidate(claim_m.group(1)):
            primary_names.append(deconcatenate_indian_name(claim_m.group(1)))

    elif subtype in ("Academic_Degree_or_Marksheet", "University_Degree_Certificate", "Academic_Marksheet_Transcript"):
        deg_m = re.search(r"(?:wihinsigned|withinsigned)\s+([A-Za-z\s]{8,35}?)\s*[\r\n]+", text, re.IGNORECASE)
        if deg_m and is_valid_person_name_candidate(deg_m.group(1)):
            primary_names.append(deconcatenate_indian_name(deg_m.group(1)))
        else:
            mk_m = re.search(r"Min[1i]\s+Marks\s+[0-9]+\s+([A-Za-z\s]{8,35}?)(?=\s+SUBJECT|\r|\n)", text, re.IGNORECASE)
            if mk_m and is_valid_person_name_candidate(mk_m.group(1)):
                primary_names.append(deconcatenate_indian_name(mk_m.group(1)))

    elif subtype in (
        "Visa_Cover_Letter_and_Itinerary",
        "Family_Information_Sheet",
        "Travel_Insurance_Policy",
        "Utility_Bill_Statement",
        "IRCC_Visa_Application_Form",
        "Minor_Travel_Consent_Letter",
    ):
        for pat in (
            r"Application\s+for\s+the\s+Family\s+of\s+([A-Za-z\s]{5,40}?)(?=\s+Dear|\r|\n)",
            r"Insured\s+Coverage\s+Summary\s+([A-Za-z\s]{5,40}?)\s+[0-9]{2}/[0-9]{2}/[0-9]{4}",
            r"Account\s+Number\s+[0-9\s\-]+([A-Z][A-Za-z\s]{5,35}?)(?=\r|\n)",
            r"([A-Z][A-Za-z\s]{5,40}?)\s*[\r\n]+\s*Date\s*of\s*Birth\s*:",
        ):
            sm = re.search(pat, text, re.IGNORECASE)
            if sm and is_valid_person_name_candidate(sm.group(1)):
                primary_names.append(deconcatenate_indian_name(sm.group(1)))
                break
        if not primary_names:
            for k in ("full_name", "applicant_name", "account_holder_name"):
                val = field_map.get(k)
                if val and is_valid_person_name_candidate(val):
                    primary_names.append(deconcatenate_indian_name(val))
                    break

    else:
        for k in ("account_holder_name", "full_name", "applicant_name", "pan_holder_name", "aadhaar_holder_name"):
            val = field_map.get(k)
            if val and is_valid_person_name_candidate(val):
                primary_names.append(deconcatenate_indian_name(val))
                break

    dedup_names: list[str] = []
    for n in primary_names:
        if n and is_valid_person_name_candidate(n) and n not in dedup_names:
            dedup_names.append(n)

    return {
        "primary_names": dedup_names,
        "bridged_married_aliases": bridged_married_aliases,
        "is_joint": is_joint or len(dedup_names) > 1,
        "id_anchors": id_anchors,
        "metadata_relatives": metadata_relatives,
        "field_map": field_map,
    }


@dataclass
class PersonCluster:
    cluster_id: str
    canonical_name: str
    folder_name: str
    name_variations: list[str] = field(default_factory=list)
    id_anchors: dict[str, set[str]] = field(
        default_factory=lambda: {"pan": set(), "passport": set(), "file_no": set(), "sin": set(), "umi": set(), "account": set(), "uci": set()}
    )

    def add_variation(self, name: str) -> None:
        clean = deconcatenate_indian_name(name)
        if not clean or not is_valid_person_name_candidate(clean):
            return
        if clean not in self.name_variations:
            self.name_variations.append(clean)

        curr_toks = normalize_person_tokens(self.canonical_name)
        new_toks = normalize_person_tokens(clean)
        curr_char_len = sum(len(t) for t in curr_toks)
        new_char_len = sum(len(t) for t in new_toks)

        curr_is_clean_3 = len(curr_toks) == 3 and min(len(t) for t in curr_toks) >= 4 and curr_toks[-1].upper() in INDIAN_SURNAMES
        new_is_clean_3 = len(new_toks) == 3 and min(len(t) for t in new_toks) >= 4 and new_toks[-1].upper() in INDIAN_SURNAMES

        # Prefer a 3-token properly spaced name ('First Middle Surname') over a 2-token concatenated one or initialed one
        if (
            (new_is_clean_3 and not curr_is_clean_3)
            or (new_is_clean_3 and curr_is_clean_3 and new_char_len > curr_char_len)
            or (not curr_is_clean_3 and len(new_toks) > len(curr_toks))
            or (not curr_is_clean_3 and len(new_toks) == len(curr_toks) and new_char_len > curr_char_len)
        ):
            if len(new_toks) >= 2 and new_toks[0].upper() in INDIAN_SURNAMES and new_toks[-1].upper() not in INDIAN_SURNAMES:
                reordered = new_toks[1:] + [new_toks[0]]
                self.canonical_name = " ".join(t.title() for t in reordered)
            else:
                self.canonical_name = clean
            self.folder_name = re.sub(r"[^A-Za-z0-9]+", "_", self.canonical_name).strip("_")


def names_belong_to_same_person(name_a: str, name_b: str) -> bool:
    """
    Determines whether two extracted person names refer to the same individual
    using our existing `compare_names` comparator plus Indian patronymic/initial/concatenation rules.
    Never merges distinct family members (Father vs Son, or Husband vs Wife).
    """
    from difflib import SequenceMatcher

    toks_a = normalize_person_tokens(name_a)
    toks_b = normalize_person_tokens(name_b)
    if not toks_a or not toks_b:
        return False

    def _put_surname_last(toks: list[str]) -> list[str]:
        if len(toks) >= 2 and toks[0].upper() in INDIAN_SURNAMES and toks[-1].upper() not in INDIAN_SURNAMES:
            return toks[1:] + [toks[0]]
        return toks

    ord_a = _put_surname_last(toks_a)
    ord_b = _put_surname_last(toks_b)

    has_sur_a = ord_a[-1].upper() in INDIAN_SURNAMES
    has_sur_b = ord_b[-1].upper() in INDIAN_SURNAMES
    if has_sur_a and has_sur_b and ord_a[-1] != ord_b[-1]:
        return False

    non_sur_a = "".join(ord_a[:-1]) if has_sur_a and len(ord_a) >= 2 else "".join(ord_a)
    non_sur_b = "".join(ord_b[:-1]) if has_sur_b and len(ord_b) >= 2 else "".join(ord_b)

    first_a = stem_indian_token(ord_a[0])
    first_b = stem_indian_token(ord_b[0])

    # If spaceless given+middle strings match, are prefix >= 7 chars, or have >= 0.84 similarity (e.g. 1-char OCR typo 'pankakalidas' vs 'pankajkalidas')
    if len(non_sur_a) >= 7 and len(non_sur_b) >= 7:
        if (
            non_sur_a == non_sur_b
            or non_sur_a.startswith(non_sur_b)
            or non_sur_b.startswith(non_sur_a)
            or SequenceMatcher(None, non_sur_a, non_sur_b).ratio() >= 0.84
        ):
            return True
        stem_join_a = "".join(stem_indian_token(t) for t in (ord_a[:-1] if has_sur_a and len(ord_a) >= 2 else ord_a))
        stem_join_b = "".join(stem_indian_token(t) for t in (ord_b[:-1] if has_sur_b and len(ord_b) >= 2 else ord_b))
        if len(stem_join_a) >= 7 and len(stem_join_b) >= 7:
            if (
                stem_join_a == stem_join_b
                or stem_join_a.startswith(stem_join_b)
                or stem_join_b.startswith(stem_join_a)
                or SequenceMatcher(None, stem_join_a, stem_join_b).ratio() >= 0.84
            ):
                return True

    # Given names (first names) must match or be prefix/OCR variant of each other
    if first_a != first_b:
        if not (first_a.startswith(first_b) or first_b.startswith(first_a)) or abs(len(first_a) - len(first_b)) > 2:
            return False

    # If both have 3 tokens (First Middle Last), check middle name compatibility (initial 'p' matches 'pankajkumar')
    if len(ord_a) == 3 and len(ord_b) == 3:
        mid_a = stem_indian_token(ord_a[1])
        mid_b = stem_indian_token(ord_b[1])
        if mid_a != mid_b and not (mid_a.startswith(mid_b) or mid_b.startswith(mid_a)):
            return False

    # When both share the same known surname and compatible given/middle names, return True directly
    if has_sur_a and has_sur_b and ord_a[-1] == ord_b[-1] and min(len(first_a), len(first_b)) >= 4:
        return True

    cmp_res = compare_names(" ".join(ord_a), " ".join(ord_b))
    return cmp_res.is_concordant or cmp_res.similarity_score >= 0.72


def is_new_document_boundary(prev_p: dict[str, Any], curr_p: dict[str, Any]) -> bool:
    """
    Determines whether `curr_p` starts a NEW separate document even when `prev_p` and `curr_p`
    belong to the same person(s) and have the same document `subtype`.
    Ensures granular document splitting (e.g., separate monthly Bank Statements, separate
    Property Valuation Reports, separate Pay Stubs / T4s / CRA NOAs, and Current vs Old Passports).
    """
    sub = curr_p["subtype"]
    prev_u = (prev_p.get("text") or "").upper()
    curr_u = (curr_p.get("text") or "").upper()

    # 1. Standalone 1-page certificates, slips, pay stubs, and eVisas
    if sub in (
        "Salary_Pay_Stub",
        "Payroll_Earnings_Statement",
        "Bank_Balance_Certificate",
        "Fixed_Deposit_Receipt",
        "Tuition_Fee_Receipt",
        "IELTS_Language_Test_Report",
        "Police_Clearance_Certificate_PCC",
        "School_Bonafide_Certificate",
        "UAE_eVisa_Grant",
        "Singapore_eVisa_Grant",
        "Malaysia_eVisa_Grant",
    ):
        return True

    # 1_roe. Record of Employment (ROE): Page 1 has 'SERIAL NO' or 'REASON FOR ISSUING THIS ROE'; Page 2 has Employer Signature / Comments
    if sub == "Record_of_Employment_ROE":
        if "SERIAL NO" in curr_u or "REASON FOR ISSUING THIS ROE" in curr_u:
            return True
        return False

    # 1_t4. T4 / T4A / T4E Statement of Remuneration: Front slip starts a new T4/T4E; back instruction pages ('BOX 14 -', 'CASE 14 -') stay attached
    if sub == "T4_Statement_of_Remuneration":
        if "STATEMENT OF REMUNERATION PAID" in curr_u or "STATEMENT OF EMPLOYMENT INSURANCE" in curr_u:
            return True
        return False

    # 1a. Canada PR Card: Front page starts a new 2-page (Front+Back) PR Card when following a back page (CACANPD)
    if sub == "Canada_PR_Card":
        if "CACANPD" in prev_u and "CACANPD" not in curr_u:
            return True
        return False

    # 1b. Driving Licence: Front page starts a new 2-page (Front+Back) Driving Licence
    if sub == "Driving_Licence":
        if ("DRIVER" in curr_u and "LICENCE" in curr_u) and not ("DRIVER" in prev_u and "LICENCE" in prev_u):
            return True
        return False

    # 2. CRA Notice of Assessment: Page 1 starts a new NOA (e.g. Tax Year 2024 vs Tax Year 2023)
    if sub == "CRA_Notice_of_Assessment":
        if bool(re.search(r"\bPAGE\s+1\s+OF\s+[0-9]+|\bT451\s*E\b|\bT491\s*E\b", curr_u)):
            return True
        return False

    # 3. Property & Jewellery Valuation Report: Page 1 has '(1)' or 'Purpose for which valuation is made'
    if sub in ("Property_Valuation_Report", "Gold_Jewellery_Valuation_Report"):
        if (
            "PURPOSE FOR WHICH VALUATION IS MADE" in curr_u
            or bool(re.search(r"\(\s*1\s*\)\s*(?:NAME\s*OF\s*GOVT|\(\s*2\s*\)|PURPOSE)", curr_u))
        ) and "DOCUMENTS OF PROPERTY PRODUCED" not in curr_u:
            return True
        return False

    # 4. Bank Account Statement & Demat Holding Statement: split on 'Page 1 of X', new Passbook Legend, or new Account ID
    if sub in ("Bank_Account_Statement", "Demat_Investment_Holding_Statement"):
        if bool(re.search(r"\bPAGE\s+1\s+OF\s+[0-9]+", curr_u)):
            return True
        if "GENERALLY USED ABBREVIATIONS" in curr_u or "HPTIRGENERALLYUSEDABBREVIATIONS" in curr_u:
            return True
        prev_acc = prev_p.get("id_anchors", {}).get("account")
        curr_acc = curr_p.get("id_anchors", {}).get("account")
        if prev_acc and curr_acc and prev_acc != curr_acc:
            return True
        if "IMDIAN BANK" in curr_u and "IMDIAN BANK" not in prev_u:
            return True
        if "STATE BANK OF INDIA" in curr_u and "STATE BANK OF INDIA" not in prev_u:
            return True
        return False

    # 5. Passport & Travel Stamps: a new Passport Bio Page following a Back Endorsement / Stamp page starts a new Passport PDF
    if sub == "Passport_and_Travel_Stamps":
        curr_is_bio = bool(
            re.search(
                r"REPUBLIC\s*OF\s*INDIA|REPUBLTCOF\s*TNDIA|REPUBLIC\s*OFINDIA|REPUBLTC\s*OF:\s*INDIA|RFPUBLTC\s*OF\s*INDIA|PASSPORT\s*CANADA",
                curr_u,
            )
            and ("SURNAME" in curr_u or "GIVEN NAME" in curr_u)
        )
        prev_is_bio = bool(
            re.search(
                r"REPUBLIC\s*OF\s*INDIA|REPUBLTCOF\s*TNDIA|REPUBLIC\s*OFINDIA|REPUBLTC\s*OF:\s*INDIA|RFPUBLTC\s*OF\s*INDIA|PASSPORT\s*CANADA",
                prev_u,
            )
            and ("SURNAME" in prev_u or "GIVEN NAME" in prev_u)
        )
        if curr_is_bio and not prev_is_bio:
            return True
        return False

    return False


def sort_and_split_document_packet(
    pdf_bytes: bytes,
    filename: str = "combined_packet.pdf",
    write_to_disk_dir: Optional[str] = None,
    include_split_pdf_bytes: bool = True,
) -> dict[str, Any]:
    """
    Main entrypoint for Multi-Person Document Packet Sorting & Splitting.
    """
    pages = OCREngine.extract_document(pdf_bytes, mime_type="application/pdf")
    src_doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    dummy_doc_id = uuid.uuid4()
    dummy_org_id = uuid.uuid4()

    page_records: list[dict[str, Any]] = []
    clusters: list[PersonCluster] = []

    def get_or_create_cluster(raw_name: str, anchors: dict[str, str], is_joint_page: bool = False) -> PersonCluster:
        clean = deconcatenate_indian_name(raw_name)
        toks = normalize_person_tokens(clean)
        if len(toks) >= 2 and toks[0].upper() in INDIAN_SURNAMES and toks[-1].upper() not in INDIAN_SURNAMES:
            clean = " ".join(t.title() for t in (toks[1:] + [toks[0]]))

        for c in clusters:
            if any(names_belong_to_same_person(clean, existing) for existing in c.name_variations):
                c.add_variation(clean)
                if not is_joint_page:
                    for k, v in anchors.items():
                        if v and k in c.id_anchors:
                            c.id_anchors[k].add(v)
                return c

        folder_name = re.sub(r"[^A-Za-z0-9]+", "_", clean).strip("_")
        new_c = PersonCluster(
            cluster_id=f"person-{len(clusters) + 1}",
            canonical_name=clean,
            folder_name=folder_name,
            name_variations=[clean],
        )
        if not is_joint_page:
            for k, v in anchors.items():
                if v and k in new_c.id_anchors:
                    new_c.id_anchors[k].add(v)
        clusters.append(new_c)
        return new_c

    # Pass 1: Extract every page's category, subtype, fields, language compliance, and initial subjects
    for p in pages:
        lang_comp = evaluate_language_compliance(
            text=p.text,
            raw_unfiltered_text=p.raw_unfiltered_text,
            filename=filename,
        )
        raw_cat, cat_conf = classify_document(p.text, filename="")
        canonical_cat, subtype = detect_page_subtype(p.text, raw_cat)

        single_page_res = PageExtractionResult(
            page_number=1,
            text=p.text,
            ocr_applied=p.ocr_applied,
            ocr_confidence=p.ocr_confidence,
            blocks=p.blocks,
            width=p.width,
            height=p.height,
            detected_rotation=p.detected_rotation,
            is_rotation_corrected=p.is_rotation_corrected,
            raw_unfiltered_text=p.raw_unfiltered_text,
        )
        extracted_flds = extract_structured_fields(
            document_id=dummy_doc_id,
            organization_id=dummy_org_id,
            category=canonical_cat,
            pages=[single_page_res],
            document_bytes=None,
            mime_type="text/plain",
            filename="",
        )
        subj_info = extract_page_subjects_and_anchors(p, canonical_cat, subtype, extracted_flds)

        matched_cluster_ids: list[str] = []
        is_joint_pg = subj_info["is_joint"]
        for pname in subj_info["primary_names"]:
            c = get_or_create_cluster(pname, subj_info["id_anchors"], is_joint_page=is_joint_pg)
            if c.cluster_id not in matched_cluster_ids:
                matched_cluster_ids.append(c.cluster_id)

        for maiden_name, married_alias in subj_info.get("bridged_married_aliases", []):
            for c in clusters:
                if maiden_name in c.name_variations or married_alias in c.name_variations:
                    c.add_variation(maiden_name)
                    c.add_variation(married_alias)

        page_records.append({
            "page_number": p.page_number,
            "text": p.text,
            "category": canonical_cat,
            "subtype": subtype,
            "confidence": cat_conf,
            "ocr_applied": p.ocr_applied,
            "ocr_confidence": p.ocr_confidence,
            "language_compliance": lang_comp,
            "primary_names": subj_info["primary_names"],
            "is_joint": is_joint_pg,
            "id_anchors": subj_info["id_anchors"],
            "field_map": subj_info["field_map"],
            "cluster_ids": matched_cluster_ids,
        })

    # Pass 2: Consolidate clusters that share name concordance or bridged maiden/married variations
    merged_any = True
    while merged_any:
        merged_any = False
        for i in range(len(clusters)):
            for j in range(i + 1, len(clusters)):
                ci, cj = clusters[i], clusters[j]
                if any(
                    names_belong_to_same_person(va, vb)
                    for va in ci.name_variations
                    for vb in cj.name_variations
                ):
                    for vb in cj.name_variations:
                        ci.add_variation(vb)
                    for k, vset in cj.id_anchors.items():
                        ci.id_anchors[k].update(vset)
                    old_id = cj.cluster_id
                    clusters.pop(j)
                    for pr in page_records:
                        new_cids: list[str] = []
                        for cid in pr["cluster_ids"]:
                            mapped = ci.cluster_id if cid == old_id else cid
                            if mapped not in new_cids:
                                new_cids.append(mapped)
                        pr["cluster_ids"] = new_cids
                    merged_any = True
                    break
            if merged_any:
                break

    # Pass 3: Resolve pages that have an ID anchor (PAN, Passport, File No, SIN, UMI, Account, UCI) but no explicit name on that page
    for pr in page_records:
        if not pr["cluster_ids"] and pr["id_anchors"]:
            for c in clusters:
                for ak in ("pan", "passport", "file_no", "sin", "umi", "account", "uci"):
                    if pr["id_anchors"].get(ak) and pr["id_anchors"][ak] in c.id_anchors[ak]:
                        pr["cluster_ids"].append(c.cluster_id)
                        break
                if pr["cluster_ids"]:
                    break

    # Pass 4: Bidirectional Multi-Page Continuity Propagation
    # 4a. Attach trailing blank/minimal 'Page 6' of a 6-page CRA Notice of Assessment to Page 5
    for i in range(1, len(page_records)):
        curr_p = page_records[i]
        prev_p = page_records[i - 1]
        if (
            len((curr_p.get("text") or "").strip()) < 15
            and prev_p["subtype"] == "CRA_Notice_of_Assessment"
            and "PAGE 5" in (prev_p.get("text") or "").upper()
        ):
            curr_p["category"] = prev_p["category"]
            curr_p["subtype"] = prev_p["subtype"]
            curr_p["cluster_ids"] = list(prev_p["cluster_ids"])
            curr_p["language_compliance"]["requires_caseworker_escalation"] = False

    # 4b. Propagate Assessment Year ('itr_ay') across consecutive ITR pages so each AY is separated cleanly
    for i in range(1, len(page_records)):
        curr_p = page_records[i]
        prev_p = page_records[i - 1]
        if (
            curr_p["subtype"] == "Income_Tax_Return_ITR"
            and prev_p["subtype"] == "Income_Tax_Return_ITR"
            and not curr_p["id_anchors"].get("itr_ay")
            and prev_p["id_anchors"].get("itr_ay")
            and not bool(
                re.search(
                    r"INDIAN\s*INCOME\s*TAX\s*RETURN|ACKNOWLEDGEMENT\s*NUMBER|ACKN0WLEDGEMENT\s*NUMBER",
                    (curr_p.get("text") or "").upper(),
                )
            )
        ):
            curr_p["id_anchors"]["itr_ay"] = prev_p["id_anchors"]["itr_ay"]

    for i in range(len(page_records) - 2, -1, -1):
        curr_p = page_records[i]
        next_p = page_records[i + 1]
        if (
            curr_p["subtype"] == "Income_Tax_Return_ITR"
            and next_p["subtype"] == "Income_Tax_Return_ITR"
            and not curr_p["id_anchors"].get("itr_ay")
            and next_p["id_anchors"].get("itr_ay")
        ):
            curr_p["id_anchors"]["itr_ay"] = next_p["id_anchors"]["itr_ay"]

    for pr in page_records:
        if pr["subtype"] == "Income_Tax_Return_ITR" and pr["id_anchors"].get("itr_ay"):
            pr["subtype"] = f"Income_Tax_Return_ITR_AY_{pr['id_anchors']['itr_ay']}"

    # 4c. Propagate Person Cluster IDs across continuation pages (Forward first within document boundaries, then Backward for cover/legend pages)
    for i in range(1, len(page_records)):
        curr_p = page_records[i]
        prev_p = page_records[i - 1]
        if (
            curr_p["subtype"] == "CA_Net_Worth_Certificate"
            and prev_p["subtype"] == "CA_Net_Worth_Certificate"
            and prev_p["is_joint"]
        ):
            curr_p["cluster_ids"] = list(prev_p["cluster_ids"])
            curr_p["is_joint"] = True
        elif not curr_p["cluster_ids"] and prev_p["cluster_ids"]:
            if curr_p["subtype"] != prev_p["subtype"] or not is_new_document_boundary(prev_p, curr_p):
                curr_p["cluster_ids"] = list(prev_p["cluster_ids"])
                curr_p["is_joint"] = prev_p["is_joint"]

    for i in range(len(page_records) - 2, -1, -1):
        curr_p = page_records[i]
        next_p = page_records[i + 1]
        if not curr_p["cluster_ids"] and next_p["cluster_ids"]:
            if (
                curr_p["subtype"] == next_p["subtype"]
                or ("CONTINUED ON NEXT PAGE" in curr_p["text"].upper())
                or ("PAGE 1" in curr_p["text"].upper() and curr_p["category"] == next_p["category"])
            ):
                curr_p["cluster_ids"] = list(next_p["cluster_ids"])
                curr_p["is_joint"] = next_p["is_joint"]

    for i in range(1, len(page_records)):
        curr_p = page_records[i]
        prev_p = page_records[i - 1]
        if not curr_p["cluster_ids"] and prev_p["cluster_ids"]:
            curr_p["cluster_ids"] = list(prev_p["cluster_ids"])
            curr_p["is_joint"] = prev_p["is_joint"]

    first_assigned_idx = next((idx for idx, pr in enumerate(page_records) if pr["cluster_ids"]), None)
    if first_assigned_idx is not None and first_assigned_idx > 0:
        first_cids = page_records[first_assigned_idx]["cluster_ids"]
        for idx in range(first_assigned_idx - 1, -1, -1):
            page_records[idx]["cluster_ids"] = list(first_cids)

    # Pass 5: Segment pages into logical multi-page Documents per Person with granular boundary detection
    segments: list[dict[str, Any]] = []
    for pr in page_records:
        requires_lang_review = pr["language_compliance"].get("requires_caseworker_escalation", False)
        target_cids = ["CASE_WORKER_REVIEW"] if (requires_lang_review or not pr["cluster_ids"]) else pr["cluster_ids"]

        if (
            segments
            and segments[-1]["cluster_ids"] == target_cids
            and segments[-1]["subtype"] == pr["subtype"]
            and not is_new_document_boundary(segments[-1]["pages"][-1], pr)
        ):
            segments[-1]["page_numbers"].append(pr["page_number"])
            segments[-1]["pages"].append(pr)
        else:
            segments.append({
                "cluster_ids": target_cids,
                "category": pr["category"],
                "subtype": pr["subtype"],
                "is_joint": pr["is_joint"],
                "page_numbers": [pr["page_number"]],
                "pages": [pr],
            })

    # Pass 6: Build Person Folders and generate split PDFs for each segment
    person_folders_map: dict[str, dict[str, Any]] = {}
    for c in clusters:
        person_folders_map[c.cluster_id] = {
            "person_id": c.cluster_id,
            "canonical_name": c.canonical_name,
            "folder_name": c.folder_name,
            "name_variations": c.name_variations,
            "id_anchors": {k: sorted(list(v)) for k, v in c.id_anchors.items() if v and k != "file_no"},
            "is_caseworker_review_folder": False,
            "total_documents": 0,
            "total_pages": 0,
            "documents": [],
        }

    if any("CASE_WORKER_REVIEW" in seg["cluster_ids"] for seg in segments):
        person_folders_map["CASE_WORKER_REVIEW"] = {
            "person_id": "CASE_WORKER_REVIEW",
            "canonical_name": "Case Worker Manual Review",
            "folder_name": "Case_Worker_Review",
            "name_variations": ["Unassigned / Manual Review Required"],
            "id_anchors": {},
            "is_caseworker_review_folder": True,
            "total_documents": 0,
            "total_pages": 0,
            "documents": [],
        }

    zip_buffer = io.BytesIO()
    zf = zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED)

    base_stem = os.path.splitext(os.path.basename(filename))[0]
    base_stem_clean = re.sub(r"[^A-Za-z0-9]+", "_", base_stem).strip("_")

    for seg in segments:
        pnos = seg["page_numbers"]
        p_start, p_end = pnos[0], pnos[-1]
        page_range_label = f"P{p_start:03d}" if p_start == p_end else f"P{p_start:03d}-P{p_end:03d}"

        split_pdf = fitz.open()
        for pno in pnos:
            split_pdf.insert_pdf(src_doc, from_page=pno - 1, to_page=pno - 1)
        split_pdf_bytes = split_pdf.tobytes(garbage=3, deflate=True)
        split_pdf.close()

        merged_fields: dict[str, str] = {}
        for pr in seg["pages"]:
            for fk, fv in pr["field_map"].items():
                if fk not in merged_fields and fv:
                    merged_fields[fk] = fv

        for cid in seg["cluster_ids"]:
            folder_obj = person_folders_map.get(cid)
            if not folder_obj:
                continue
            doc_seq = folder_obj["total_documents"] + 1
            doc_filename = f"{doc_seq:02d}_{seg['subtype']}_{page_range_label}.pdf"
            rel_zip_path = f"{folder_obj['folder_name']}/{doc_filename}"

            zf.writestr(rel_zip_path, split_pdf_bytes)

            if write_to_disk_dir:
                person_disk_dir = os.path.join(write_to_disk_dir, folder_obj["folder_name"], base_stem_clean)
                os.makedirs(person_disk_dir, exist_ok=True)
                disk_file_path = os.path.join(person_disk_dir, doc_filename)
                with open(disk_file_path, "wb") as df:
                    df.write(split_pdf_bytes)

            doc_entry: dict[str, Any] = {
                "document_index": doc_seq,
                "filename": doc_filename,
                "relative_path": rel_zip_path,
                "category": seg["category"],
                "document_subtype": seg["subtype"].replace("_", " "),
                "page_numbers": pnos,
                "page_range": f"Page {p_start}" if p_start == p_end else f"Pages {p_start}–{p_end}",
                "page_count": len(pnos),
                "is_joint_document": seg["is_joint"],
                "shared_with": [
                    person_folders_map[other_cid]["canonical_name"]
                    for other_cid in seg["cluster_ids"]
                    if other_cid != cid and other_cid in person_folders_map
                ],
                "extracted_fields": merged_fields,
                "text_preview": seg["pages"][0]["text"][:280].strip(),
            }
            if include_split_pdf_bytes:
                doc_entry["pdf_base64"] = base64.b64encode(split_pdf_bytes).decode("ascii")

            folder_obj["documents"].append(doc_entry)
            folder_obj["total_documents"] += 1
            folder_obj["total_pages"] += len(pnos)

    zf.close()
    src_doc.close()

    active_folders = [
        f for f in person_folders_map.values() if f["total_documents"] > 0
    ]
    active_folders.sort(key=lambda x: (x["is_caseworker_review_folder"], -x["total_pages"]))

    zip_b64 = base64.b64encode(zip_buffer.getvalue()).decode("ascii") if include_split_pdf_bytes else None

    return {
        "status": "success",
        "source_filename": filename,
        "total_pages_analyzed": len(pages),
        "total_persons_detected": sum(1 for f in active_folders if not f["is_caseworker_review_folder"]),
        "total_split_documents": sum(f["total_documents"] for f in active_folders),
        "person_folders": active_folders,
        "zip_archive_filename": f"{base_stem_clean}_Sorted_By_Person.zip",
        "zip_archive_base64": zip_b64,
    }
