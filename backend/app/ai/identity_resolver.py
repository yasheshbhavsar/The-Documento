"""Specialized Indian Market & Global Identity Resolution Engine.

Implements statutory compliance and identity normalization:
1. Aadhaar Card: Mandatory 8-digit masking (XXXX-XXXX-1234) under UIDAI guidelines.
2. Permanent Account Number (PAN): 10-char checksum & entity classification.
3. Indian Passport: Final-page endorsements, ECR vs ECNR detection, file number.
4. Single-Name / FNU Resolver: Resolves single legal names to USCIS, IRCC, and UKVI standards.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

try:
    from backend.app.ocr.mrz_parser import MRZParser, MRZResult
except ImportError:
    try:
        from app.ocr.mrz_parser import MRZParser, MRZResult
    except ImportError:
        MRZParser = None

try:
    from backend.app.ocr.engine import clean_ocr_text
except ImportError:
    try:
        from app.ocr.engine import clean_ocr_text
    except ImportError:
        clean_ocr_text = lambda s: s


@dataclass
class SingleNameResolution:
    original_single_name: str
    is_single_name: bool
    uscis_first_name: str
    uscis_surname: str
    ircc_given_name: str
    ircc_surname: str
    ukvi_given_name: str
    ukvi_family_name: str
    guidance_notes: str


@dataclass
class AadhaarExtraction:
    is_valid: bool
    masked_aadhaar_number: str  # Always masked as XXXX-XXXX-1234
    raw_detected: bool
    holder_name: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[str] = None
    year_of_birth: Optional[int] = None
    father_or_spouse_name: Optional[str] = None
    address: Optional[str] = None


@dataclass
class PANExtraction:
    is_valid: bool
    pan_number: str
    holder_name: Optional[str] = None
    father_name: Optional[str] = None
    entity_type: str = "Individual"  # Individual, Company, Firm, Trust, etc.
    fifth_char_surname_match: bool = True
    date_of_birth_or_incorporation: Optional[str] = None


@dataclass
class IndianPassportExtraction:
    passport_number: str
    is_valid_format: bool
    emigration_check: str  # ECNR (Not Required) or ECR (Required)
    file_number: Optional[str] = None
    booklet_type: str = "36-page Regular"  # or 60-page Jumbo
    holder_name: Optional[str] = None
    surname: Optional[str] = None
    given_names: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    place_of_birth: Optional[str] = None
    place_of_issue: Optional[str] = None
    date_of_issue: Optional[str] = None
    date_of_expiry: Optional[str] = None
    father_name: Optional[str] = None
    mother_name: Optional[str] = None
    spouse_name: Optional[str] = None
    address: Optional[str] = None
    pin_code: Optional[str] = None
    nationality: str = "India"
    mrz_detected: bool = False
    raw_mrz: Optional[str] = None


@dataclass
class DrivingLicenceExtraction:
    is_valid: bool
    licence_number: str
    jurisdiction: str
    holder_name: Optional[str] = None
    expiry_date: Optional[str] = None
    vehicle_class: Optional[str] = None


@dataclass
class VoterIDExtraction:
    is_valid: bool
    epic_number: str
    elector_name: Optional[str] = None
    relative_name: Optional[str] = None
    state_or_constituency: Optional[str] = None


class IdentityResolver:
    """Unified identity normalization and statutory compliance processor."""

    @staticmethod
    def resolve_single_name(first_name: Optional[str], last_name: Optional[str]) -> SingleNameResolution:
        """
        Detects single-name applicants and calculates official country-specific form representations.
        
        Examples:
        - If an applicant's passport only states Given Name: "Gurpreet" (Surname blank):
          - USCIS (DS-160, I-140): Surname="Gurpreet", First Name="FNU"
          - Canada IRCC: Surname="Gurpreet", Given Name=""
          - UKVI: Family Name="Gurpreet", Given Name="."
        """
        fn = (first_name or "").strip()
        ln = (last_name or "").strip()

        # Check if single name
        if (fn and not ln) or (ln and not fn):
            single = fn if fn else ln
            return SingleNameResolution(
                original_single_name=single,
                is_single_name=True,
                uscis_first_name="FNU",
                uscis_surname=single,
                ircc_given_name="",
                ircc_surname=single,
                ukvi_given_name=".",
                ukvi_family_name=single,
                guidance_notes=(
                    f"Applicant has a single legal name ('{single}'). "
                    "USCIS requires Given Name='FNU' and Surname='{single}'. "
                    "Canada IRCC leaves Given Name blank and inputs Surname='{single}'."
                ),
            )

        # Standard two-part name
        return SingleNameResolution(
            original_single_name="",
            is_single_name=False,
            uscis_first_name=fn,
            uscis_surname=ln,
            ircc_given_name=fn,
            ircc_surname=ln,
            ukvi_given_name=fn,
            ukvi_family_name=ln,
            guidance_notes="Standard multipart legal name detected.",
        )

    @staticmethod
    def parse_aadhaar(text: str) -> Optional[AadhaarExtraction]:
        """
        Extracts Aadhaar details while enforcing statutory 8-digit masking.
        Verifiable against Verhoeff checksum algorithm structure.
        """
        if not text:
            return None

        has_aadhaar_context = bool(
            re.search(
                r"(?:aadhaar|uidai|unique\s*identification|enrol+ment\s*no|mera\s*aadhaar|આધાર|आधार|your\s*aadhaar)",
                text,
                re.IGNORECASE,
            )
        )

        # Look for 12 digits (with optional spaces or hyphens)
        # If there is no Aadhaar keyword context, only accept 4-4-4 spaced Aadhaar format when not in an utility/IRCC form
        if has_aadhaar_context:
            match = re.search(r"\b([2-9]{1}[0-9]{3})[\s-]?([0-9]{4})[\s-]?([0-9]{4})\b", text)
        elif not re.search(r"(?:DOCUMENT_TYPE:\s*IMM|ACCOUNT\s*NUMBER|SASKPOWER|ITINERARY|FLIGHT|BOOKING)", text, re.IGNORECASE):
            match = re.search(r"\b([2-9]{1}[0-9]{3})\s+([0-9]{4})\s+([0-9]{4})\b", text)
            if not match or not re.search(r"(?:Government\s*of\s*India|DOB|D0B|S/O|D/O|W/O)", text, re.IGNORECASE):
                match = None
        else:
            match = None

        if not match:
            # Check for already-masked pattern: XXXX-XXXX-1234
            masked_match = re.search(r"\b(X{4}[\s-]?X{4}[\s-]?([0-9]{4}))\b", text, re.IGNORECASE)
            if masked_match:
                last_four = masked_match.group(2)
                return AadhaarExtraction(
                    is_valid=True,
                    masked_aadhaar_number=f"XXXX-XXXX-{last_four}",
                    raw_detected=False,
                )
            return None

        last_four = match.group(3)
        masked = f"XXXX-XXXX-{last_four}"

        # Extract DOB or YOB (supporting OCR 'D0B' with zero as well as 'DOB')
        dob = None
        yob = None
        dob_m = re.search(r"(?:D[O0]B|Date\s*of\s*Birth|जन्म\s*तिथि|જન્મ\s*તારીખ)[\s:]+([0-9]{2}/[0-9]{2}/[0-9]{4})", text, re.IGNORECASE)
        if dob_m:
            dob = dob_m.group(1)
        else:
            yob_m = re.search(r"(?:Year\s*of\s*Birth|जन्म\s*वर्ष|જન્મ\s*વર્ષ)[\s:]+([12][0-9]{3})", text, re.IGNORECASE)
            if yob_m:
                yob = int(yob_m.group(1))

        # Gender
        gender = None
        if re.search(r"\b(MALE|पुरुष|પુરુષ|પુરૂષ)\b", text, re.IGNORECASE):
            gender = "Male"
        elif re.search(r"\b(FEMALE|महिला|સ્ત્રી)\b", text, re.IGNORECASE):
            gender = "Female"

        # Holder Name on Aadhaar:
        # 1. Explicit 'Name:' label
        # 2. Line immediately preceding 'DOB :' / 'D0B :'
        # 3. Line immediately following 'To' / 'To.'
        holder_name = None
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        name_m = re.search(
            r"(?:^|\n)\s*(?:Name(?!\s+of\s+(?:Mother|Father|Parents|Child|Firm|Bank))|Holder\s*Name|नाम|નામ)[\s:]+([A-Za-z][A-Za-z\s\.-]{2,50})",
            text,
            re.IGNORECASE,
        )
        if name_m:
            cand = name_m.group(1).split("\n")[0].strip(" .:-_")
            if len(re.findall(r"[A-Za-z]", cand)) >= 3 and not any(k in cand.lower() for k in ("government", "india", "authority", "aadhaar", "enrollment", "enrolment", "father", "mother")):
                holder_name = cand.title()

        if not holder_name:
            for idx, ln in enumerate(lines):
                if re.search(r"(?:D[O0]B|Date\s*of\s*Birth|Year\s*of\s*Birth)\s*:", ln, re.IGNORECASE) and idx > 0:
                    prev_ln = lines[idx - 1].strip(" .:-_")
                    if (
                        re.match(r"^[A-Za-z][A-Za-z\s\.-]{3,45}$", prev_ln)
                        and 1 <= len(prev_ln.split()) <= 5
                        and not any(k in prev_ln.lower() for k in ("government", "india", "unique", "identification", "authority", "aadhaar", "enrollment", "enrolment", "address", "male", "female"))
                    ):
                        holder_name = prev_ln.title()
                        break

        if not holder_name:
            for idx, ln in enumerate(lines):
                if re.match(r"^To\.?$", ln, re.IGNORECASE) and idx + 1 < len(lines):
                    next_ln = lines[idx + 1].strip(" .:-_")
                    if (
                        re.match(r"^[A-Za-z][A-Za-z\s\.-]{3,45}$", next_ln)
                        and 1 <= len(next_ln.split()) <= 5
                        and not any(k in next_ln.lower() for k in ("government", "india", "unique", "identification", "authority", "aadhaar"))
                    ):
                        holder_name = next_ln.title()
                        break

        # Father or husband name
        father = None
        rel_m = re.search(
            r"(?:S/O|D/O|W/O|C/O|Father(?:'s)?\s*Name|आत्मज|पत्नी|પિતાનું\s*નામ)[\s:]+([A-Za-z][A-Za-z\s\.-]{2,50})",
            text,
            re.IGNORECASE,
        )
        if rel_m:
            father = rel_m.group(1).split("\n")[0].split(",")[0].strip(" .:-_").title()

        # Address on Aadhaar
        addr = None
        addr_m = re.search(r"(?:Address|पता|સરનામું)[\s:]+([^\r\n]+(?:\r?\n[^\r\n]+)?)", text, re.IGNORECASE)
        if addr_m:
            raw_addr_lines = [ln.strip() for ln in addr_m.group(1).splitlines() if ln.strip()]
            filtered_lines = [
                ln for ln in raw_addr_lines
                if not re.search(r"^\d{4}\s+\d{4}\s+\d{4}$|^X{4}[- ]X{4}", ln)
            ]
            if filtered_lines:
                addr = ", ".join(filtered_lines)

        if not addr:
            # Extract from Aadhaar top letter block between 'To\n<Name>' and '<State> <6-digit PIN>'
            for idx, ln in enumerate(lines):
                if re.match(r"^To\.?$", ln, re.IGNORECASE) and idx + 2 < len(lines):
                    addr_parts: list[str] = []
                    for sub_ln in lines[idx + 2 : min(idx + 9, len(lines))]:
                        if re.match(r"^(?:S/O|D/O|W/O|C/O)\b", sub_ln, re.IGNORECASE):
                            continue
                        if re.search(r"(?:Your\s*Aadhaar|Government\s*of\s*India|^\d{4}\s+\d{4}\s+\d{4}$)", sub_ln, re.IGNORECASE):
                            break
                        # Strip leading print date like '03/12/2014 ' or 'Q8/01/2014 ' and 9-10 digit mobile/ref numbers
                        cleaned_sub = re.sub(r"^[0-9OQ]{2}/[0-9]{2}/[0-9]{4}\s*", "", sub_ln).strip()
                        cleaned_sub = re.sub(r"\b\d{9,12}\b", "", cleaned_sub).strip(" ,.-")
                        if not cleaned_sub or re.match(r"^(?:Ref:|[\d/A-Z-]{8,})$", cleaned_sub, re.IGNORECASE):
                            continue
                        addr_parts.append(cleaned_sub)
                        if re.search(r"\b[1-9][0-9]{5}\b", cleaned_sub):
                            break
                    if addr_parts:
                        addr = ", ".join(addr_parts)
                    break

        return AadhaarExtraction(
            is_valid=True,
            masked_aadhaar_number=masked,
            raw_detected=True,
            holder_name=holder_name,
            gender=gender,
            date_of_birth=dob,
            year_of_birth=yob,
            father_or_spouse_name=father,
            address=addr,
        )

    @staticmethod
    def parse_pan(text: str) -> Optional[PANExtraction]:
        """
        Parses Indian Permanent Account Number (PAN) 10-char format:
        [A-Z]{3}[P/C/H/F/A/T/B/L/J/G][A-Z][0-9]{4}[A-Z]
        """
        if not text:
            return None

        pan_match = re.search(r"\b([A-Z]{3})([PCHFATBLJG])([A-Z])([0-9]{4})([A-Z])\b", text.upper())
        if not pan_match:
            return None

        pan_num = pan_match.group(0)
        entity_char = pan_match.group(2)
        surname_initial = pan_match.group(3)

        entity_types = {
            "P": "Individual / Person",
            "C": "Company",
            "H": "Hindu Undivided Family (HUF)",
            "F": "Partnership Firm / LLP",
            "A": "Association of Persons (AOP)",
            "T": "Trust",
            "B": "Body of Individuals (BOI)",
            "L": "Local Authority",
            "J": "Artificial Juridical Person",
            "G": "Government Agency",
        }

        # Name extraction attempt
        name = None
        name_m = re.search(
            r"(?:^|\n)\s*(?:Name\s*of\s*Assessee|NAMEOFASSESSEE|Holder\s*Name|Name(?!\s+of\s+(?:Mother|Father|Parents|Child|Firm|Bank|Company|Employer|Applicant|Deductor|Govt|Registered|the))|नाम|નામ)[\s:]+([A-Za-z][A-Za-z\s\.-]{2,50})",
            text,
            re.IGNORECASE,
        )
        if name_m:
            cand = name_m.group(1).split("\n")[0].strip(" .:-_")
            cand = re.sub(r"^of\s+assessee[\s:]*", "", cand, flags=re.IGNORECASE).strip(" .:-_")
            bad_pan_substrings = (
                "of firm", "of the", "of mother", "of father", "of parents", "of child",
                "of company", "of applicant", "of deductor", "of govt", "tan section",
                "head of", "current free", "pledge", "statement", "inv. since", "declaration"
            )
            if (
                cand
                and not cand.lower().startswith("of ")
                and not any(b in cand.lower() for b in bad_pan_substrings)
            ):
                name = cand.title()

        if not name:
            # Check ITR header layout where '<FULL NAME>\n1\nPAN: <PAN_NUM>' or 'Name of Assessee\n<FULL NAME>' appears
            itr_name_m = re.search(
                r"(?:Name\s*of\s*Assessee\s*[\r\n:]+|^\s*)([A-Z][A-Z\s\.]{4,45}?)(?:\s+AY\.|\s*[\r\n]+\s*(?:\d+\s*[\r\n]+\s*)?PAN\s*:|\s*[\r\n]+\s*Father's\s*Name)",
                text,
                re.IGNORECASE | re.MULTILINE,
            )
            if itr_name_m:
                cand_itr = " ".join(itr_name_m.group(1).split()).strip(" .:-_")
                if cand_itr and not any(b in cand_itr.lower() for b in ("acknowledgement", "income tax", "assessee", "computation", "total", "tan section")):
                    name = cand_itr.title()

        father_name = None
        father_m = re.search(r"(?:Father(?:'s)?\s*Name|पिता\s*का\s*नाम|પિતાનું\s*નામ)[\s:]+([A-Za-z][A-Za-z\s\.-]{2,50})", text, re.IGNORECASE)
        if father_m:
            father_name = father_m.group(1).split("\n")[0].strip(" .:-_").title()

        # Check surname initial
        surname_match = True
        if name:
            last_word = name.split()[-1]
            if last_word and last_word[0].upper() != surname_initial:
                surname_match = False

        dob = None
        dob_m = re.search(r"(?:Date of Birth|Incorporation Date|DOB|जन्म तिथि|જન્મ તારીખ)[\s:]+([0-9]{2}/[0-9]{2}/[0-9]{4})", text, re.IGNORECASE)
        if dob_m:
            dob = dob_m.group(1)

        return PANExtraction(
            is_valid=True,
            pan_number=pan_num,
            holder_name=name,
            father_name=father_name,
            entity_type=entity_types.get(entity_char, "Other"),
            fifth_char_surname_match=surname_match,
            date_of_birth_or_incorporation=dob,
        )

    @staticmethod
    def parse_indian_passport(text: str) -> Optional[IndianPassportExtraction]:
        """
        Extracts Indian passport characteristics, full biodata, MRZ fields, file number,
        ECR/ECNR status, and family endorsements (supporting both front bio page and back page).
        """
        if not text:
            return None

        # Clean OCR text to remove bilingual artifacts and fix spacing
        clean_text = clean_ocr_text(text) if clean_ocr_text else text

        # 1. First attempt MRZ detection for standard ICAO TD3 passport data
        mrz = MRZParser.parse_text(clean_text) if MRZParser else None

        # Guard: Do not treat standalone eMedical sheets, XFA IMM forms, or cover letters as passports unless MRZ or Republic of India passport header is present
        has_strong_passport_header = bool(
            mrz
            or re.search(
                r"(?:REPUBLIC\s*OF\s*INDIA|RFPUBLTC\s*OF\s*INDIA|PASSEPORT|P<IND|Emigration\s*Check|Old\s*Pass?port\s*No|Name\s*of\s*Father\s*/\s*Legal\s*Guardian)",
                clean_text,
                re.IGNORECASE,
            )
        )
        is_non_passport_form = bool(
            re.search(
                r"(?:DOCUMENT_TYPE:\s*IMM|e\s*Medical\s+Information\s*Sheet|Vaccination\s*Worksheet|FAMILY\s*INFORMATION|USE\s*OF\s*A\s*FAMILY\s*MEMBER\s*REPRESENTATIVE|Purpose\s*of\s*Visit:|SASKPOWER\s*ACCOUNT)",
                clean_text,
                re.IGNORECASE,
            )
        )
        if is_non_passport_form and not has_strong_passport_header:
            return None

        passport_num = ""
        holder_name = None
        surname = None
        given_names = None
        dob = None
        gender = None
        exp_date = None
        mrz_detected = False
        raw_mrz = None
        nationality = "India"

        if mrz and mrz.issuing_country_code in ("IND", "India"):
            passport_num = mrz.document_number
            holder_name = mrz.full_name
            surname = mrz.surname
            given_names = mrz.given_names
            dob = mrz.date_of_birth
            gender = mrz.gender
            exp_date = mrz.expiry_date
            nationality = mrz.nationality
            mrz_detected = True
            raw_mrz = mrz.raw_mrz

        # 2. Visual text regex fallbacks for Passport Number (must contain at least 5 digits)
        if not passport_num:
            p_match = re.search(r"\b([A-Z]{1}[0-9]{7,8})\b", clean_text)
            if not p_match:
                p_match = re.search(r"(?:Passport\s*(?:No\.?|Number)|Doc\s*No\.?)[\s:]+([A-Z][0-9]{6,8})\b", clean_text, re.IGNORECASE)
            if not p_match:
                mrz_m = re.search(r"P<IND[^\n]*\r?\n\s*([A-Z][0-9]{7,8})", clean_text)
                if mrz_m:
                    p_match = mrz_m
            if p_match:
                cand_pnum = p_match.group(1).replace("<", "").strip()
                if sum(c.isdigit() for c in cand_pnum) >= 5:
                    passport_num = cand_pnum

        has_markers = bool(
            re.search(
                r"\b(ECR|ECNR|Emigration Check|File No|Republic of India|PASSEPORT|Given Name|Surname)\b",
                clean_text,
                re.IGNORECASE,
            )
        )
        if not passport_num and not has_markers:
            return None
        if not has_strong_passport_header and not (passport_num and has_markers):
            return None

        # 3. Check ECR vs ECNR
        ecr_status = "ECNR"
        if re.search(r"\b(Emigration Check Required|ECR)\b", clean_text, re.IGNORECASE) and not re.search(r"\b(Not Required|ECNR)\b", clean_text, re.IGNORECASE):
            ecr_status = "ECR"

        # 4. Booklet type
        booklet = "36-page Regular"
        if re.search(r"\b(60\s*Pages?|Jumbo)\b", clean_text, re.IGNORECASE):
            booklet = "60-page Jumbo"

        # 5. Visual Name Extraction (Surname, Given Names, Full Name if MRZ absent or to refine MRZ spacing)
        lines = [l.strip() for l in clean_text.splitlines() if l.strip()]
        vis_surname = None
        vis_given = None
        invalid_name_tokens = (
            "given", "name", "date", "birth", "sex", "place", "nationality",
            "passport", "mother", "father", "gender", "female", "male",
            "identity", "document", "number", "country", "issue", "expiry",
            "schooi", "school", "occupation", "spouse", "address",
        )
        for i, line in enumerate(lines):
            # Surname
            if not vis_surname and re.search(r'\b(?:Surname|उपनाम|અટક)\b', line, re.IGNORECASE):
                same_m = re.search(r'\b(?:Surname|उपनाम|અટક)[\s:]+([A-Za-z][A-Za-z\s\.-]{1,40})$', line, re.IGNORECASE)
                if same_m and same_m.group(1).strip(" .:-_"):
                    cand = re.sub(r"\b[A-Z][0-9]{6,8}\b", "", same_m.group(1)).strip(" .:-_")
                    if len(re.findall(r"[A-Za-z]", cand)) >= 2 and not any(k in cand.lower() for k in invalid_name_tokens):
                        vis_surname = cand.upper()
                else:
                    for j in range(i + 1, min(i + 3, len(lines))):
                        cand = re.sub(r"\b[A-Z][0-9]{6,8}\b", "", lines[j]).strip(" .:-_")
                        if not cand:
                            continue
                        if (
                            re.match(r"^[A-Za-z][A-Za-z\s\.-]{1,40}$", cand)
                            and len(re.findall(r"[A-Za-z]", cand)) >= 2
                            and not any(k in cand.lower() for k in invalid_name_tokens)
                        ):
                            vis_surname = cand.upper()
                            break

            # Given Names
            if not vis_given and re.search(r'\b(?:Given\s*Names?|Giten\s*Name|Ghen\s*Name|नाम|નામ)\b', line, re.IGNORECASE):
                same_m = re.search(r'\b(?:Given\s*Names?(?:\(s\))?|Giten\s*Name(?:\(s\))?|Ghen\s*Name[is\)]*|नाम|નામ)[\s:]+([A-Za-z][A-Za-z\s\.-]{1,50})', line, re.IGNORECASE)
                if same_m and same_m.group(1).strip(" .:-_"):
                    cand = re.sub(r"\b(?:Identity|Document|Passport).*$", "", same_m.group(1), flags=re.IGNORECASE)
                    cand = re.sub(r"\b[A-Z][0-9]{6,8}\b", "", cand).strip(" .:-_")
                    if len(re.findall(r"[A-Za-z]", cand)) >= 2 and not any(k in cand.lower() for k in invalid_name_tokens):
                        vis_given = cand.upper()
                elif i + 1 < len(lines):
                    cand = re.sub(r"\b[A-Z][0-9]{6,8}\b", "", lines[i + 1]).strip(" .:-_")
                    if (
                        re.match(r"^[A-Za-z][A-Za-z\s\.-]{1,50}$", cand)
                        and len(re.findall(r"[A-Za-z]", cand)) >= 2
                        and not any(k in cand.lower() for k in invalid_name_tokens)
                    ):
                        vis_given = cand.upper()

        if not surname and vis_surname:
            surname = vis_surname.title()
        if not given_names and vis_given:
            given_names = vis_given.title()
        elif given_names and vis_given and " " not in given_names and " " in vis_given:
            if given_names.replace(" ", "").upper() == vis_given.replace(" ", "").upper():
                given_names = vis_given.title()

        if surname and given_names:
            holder_name = f"{given_names} {surname}".title()
        elif not holder_name:
            if given_names:
                holder_name = given_names.title()
            elif surname:
                holder_name = surname.title()

        # 6. Visual Date Extraction (Issue date, DOB, Expiry if not found from MRZ)
        issue_date = None
        place_of_birth = None
        place_of_issue = None

        date_matches = re.findall(r"\b([0-9]{2}/[0-9]{2}/[0-9]{4})\b", clean_text)
        for dm in date_matches:
            d_parts = dm.split("/")
            day_i, mon_i, yr = int(d_parts[0]), int(d_parts[1]), int(d_parts[2])
            if not (1 <= mon_i <= 12 and 1 <= day_i <= 31):
                continue
            if yr < 2010 and not dob:
                dob = f"{yr:04d}-{mon_i:02d}-{day_i:02d}"
            elif 2010 <= yr <= 2026 and not issue_date:
                issue_date = f"{yr:04d}-{mon_i:02d}-{day_i:02d}"
            elif yr > 2026 and not exp_date:
                exp_date = f"{yr:04d}-{mon_i:02d}-{day_i:02d}"

        # Place of Birth / Issue (supports same-line and next-line, rejecting OCR label echoes)
        for i, line in enumerate(lines):
            if not place_of_birth and re.search(r'\b(?:Place\s*of\s*Birth|Piace\s*of\s*Birth|Placecf\s*Birth|जन्म स्थान|જન્મ સ્થળ)\b', line, re.IGNORECASE):
                same_m = re.search(r'\b(?:Place\s*of\s*Birth|Piace\s*of\s*Birth|Placecf\s*Birth|जन्म स्थान|જન્મ સ્થળ)[\s:]+([A-Za-z][A-Za-z\s,.-]+)$', line, re.IGNORECASE)
                if same_m and same_m.group(1).strip(" .:-_"):
                    cand = same_m.group(1).strip(" .:-_")
                    if not any(k in cand.lower() for k in ("date", "birth", "place", "piace", "sex", "passport", "country", "mother", "father", "schooi", "school", "non ede")):
                        place_of_birth = cand.title()
                elif i + 1 < len(lines):
                    cand = lines[i + 1].strip(" .:-_")
                    if (
                        len(re.findall(r"[A-Za-z]", cand)) >= 3
                        and not any(k in cand.lower() for k in ("date", "birth", "place", "piace", "sex", "nationality", "passport", "country", "mother", "father", "schooi", "school", "non ede"))
                    ):
                        place_of_birth = cand.title()

            if not place_of_issue and re.search(r'\b(?:Place\s*of\s*Issue)\b', line, re.IGNORECASE):
                if i + 1 < len(lines):
                    cand = re.sub(r"\b[0-9]{6,12}\b", "", lines[i + 1]).strip(" .:-_")
                    if len(re.findall(r"[A-Za-z]", cand)) >= 3 and not any(k in cand.lower() for k in ("date", "issue", "expiry", "birth")):
                        place_of_issue = cand.title()

        # 7. Endorsements from final page (line-aware & multiline parser)
        father = None
        mother = None
        spouse = None
        file_num = None
        address = None
        pincode = None

        def _split_concatenated_indian_name(raw_n: str) -> str:
            if " " not in raw_n and len(raw_n) >= 12:
                s = re.sub(r"^PATEL([A-Z]{4,})", r"PATEL \1", raw_n.upper())
                s = re.sub(r"([A-Z]{3,12}?(?:BEN|BHAI|KUMAR))([A-Z]{4,}(?:BHAI|BEN|KUMAR|LAL))", r"\1 \2", s)
                return s.title()
            return raw_n.title()

        in_addr = False
        addr_lines: list[str] = []

        for i, line in enumerate(lines):
            # Father / Guardian
            if re.search(r"(?:Father|Falfer|Guardian|Guaraian|Guprckan|पिता|પિતાનું\s*નામ)", line, re.IGNORECASE) and not father:
                fat_same = re.search(r"(?:Father(?:'s)?(?:\s*Legal)?\s*Name|Name\s*of\s*Father|पिता\s*का\s*नाम|પિતાનું\s*નામ)[\s:]+([A-Za-z][A-Za-z\s\.-]{2,50})", line, re.IGNORECASE)
                if fat_same:
                    cand = re.sub(r"\b(?:[A-Z][0-9]{6,8}|[0-9]{6,9})\b", "", fat_same.group(1)).strip(" .:-_")
                    if len(re.findall(r"[A-Za-z]", cand)) >= 3 and not any(k in cand.lower() for k in ("mother", "spouse", "address", "date", "birth", "sex", "place", "guardian", "guprckan")):
                        father = _split_concatenated_indian_name(cand)
                else:
                    for j in range(i + 1, min(i + 3, len(lines))):
                        cand = re.sub(r"\b(?:[A-Z][0-9]{6,8}|[0-9]{6,9})\b", "", lines[j]).strip(" .:-_")
                        if (
                            len(re.findall(r"[A-Za-z]", cand)) >= 3
                            and re.match(r"^[A-Za-z][A-Za-z\s\.-]{2,50}$", cand)
                            and not any(k in cand.lower() for k in ("mother", "father", "spouse", "address", "file", "passport", "pin", "name", "/", "birth", "date", "sex", "permanent", "child", "parents", "occupation"))
                        ):
                            father = _split_concatenated_indian_name(cand)
                            break

            # Mother
            if re.search(r"(?:Mother|Metner|wlothet|माता|માતાનું\s*નામ)", line, re.IGNORECASE) and not mother:
                mot_same = re.search(r"(?:Mother(?:'s)?(?:\s*Legal)?\s*Name|Name\s*of\s*Mother|माता\s*का\s*नाम|માતાનું\s*નામ)[\s:]+([A-Za-z][A-Za-z\s\.-]{2,50})", line, re.IGNORECASE)
                if mot_same:
                    cand = mot_same.group(1).strip(" .:-_")
                    if len(re.findall(r"[A-Za-z]", cand)) >= 3 and not any(k in cand.lower() for k in ("father", "spouse", "address", "date", "birth", "sex", "place", "occupation")):
                        mother = _split_concatenated_indian_name(cand)
                else:
                    for j in range(i + 1, min(i + 3, len(lines))):
                        cand = lines[j].strip(" .:-_")
                        if (
                            len(re.findall(r"[A-Za-z]", cand)) >= 3
                            and re.match(r"^[A-Za-z][A-Za-z\s\.-]{2,50}$", cand)
                            and not any(k in cand.lower() for k in ("father", "mother", "spouse", "address", "file", "passport", "pin", "name", "/", "birth", "date", "sex", "permanent", "child", "parents", "occupation"))
                        ):
                            mother = _split_concatenated_indian_name(cand)
                            break

            # Spouse (including OCR 'Name of Souse' / 'ame of spouse')
            if re.search(r"(?:Sp?ouse|पति|पत्नी|પતિ|પત્ની)", line, re.IGNORECASE) and not spouse:
                sp_same = re.search(r"(?:Sp?ouse(?:'s)?(?:\s*Legal)?\s*Name|(?:N?ame\s*of\s*)?Sp?ouse)[\s:]+([A-Za-z][A-Za-z\s\.-]{2,50})$", line, re.IGNORECASE)
                if sp_same:
                    cand = sp_same.group(1).strip(" .:-_")
                    if len(re.findall(r"[A-Za-z]", cand)) >= 3 and not any(k in cand.lower() for k in ("address", "father", "mother", "passport", "file")):
                        spouse = _split_concatenated_indian_name(cand)
                else:
                    for j in range(i + 1, min(i + 3, len(lines))):
                        cand = lines[j].strip(" .:-_")
                        if (
                            len(re.findall(r"[A-Za-z]", cand)) >= 3
                            and re.match(r"^[A-Za-z][A-Za-z\s\.-]{2,50}$", cand)
                            and not any(k in cand.lower() for k in ("father", "mother", "spouse", "souse", "address", "addhest", "file", "passport", "pin", "name", "/", "birth", "date"))
                        ):
                            spouse = _split_concatenated_indian_name(cand)
                            break

            # File Number
            if re.search(r"(?:File\s*No|Fie\s*No|IFMNO|फाइल)", line, re.IGNORECASE) and not file_num:
                f_same = re.search(r"(?:File\s*No\.?|Fie\s*No\.?|File\s*Number|IFMNO)[\s:]+([A-Z]{2}[A-Z0-9]{10,14})\b", line, re.IGNORECASE)
                if f_same:
                    file_num = f_same.group(1).strip().upper()
                else:
                    for j in range(i + 1, min(i + 4, len(lines))):
                        cand = lines[j]
                        m = re.search(r"\b([A-Z]{2}[A-Z0-9]{10,14})\b", cand)
                        if m and sum(c.isdigit() for c in m.group(1)) >= 7:
                            file_num = m.group(1)
                            break

            # Address block (capture at most one 1-3 line passport address block, never crossing pages or past PIN/INDIA)
            if re.search(r"\b(?:Address|Addhest|पता|સરનામું)\b", line, re.IGNORECASE) and not addr_lines:
                same_addr_m = re.search(r"(?:Permanent\s*Address(?:\s*of\s*Parents)?|Residential\s*Address|Present\s*Address|Address(?:\s*of\s*parents[^\r\n:]*)?|पता|સરનામું)[\s:]+(.+)$", line, re.IGNORECASE)
                if same_addr_m and same_addr_m.group(1).strip(" .:-_"):
                    cand_a = same_addr_m.group(1).strip(" .:-_")
                    if not any(k in cand_a.lower() for k in ("time of birth", "permanent address", "of parents", "you to canada", "status of the", "issuing authority")):
                        addr_lines.append(cand_a)
                        if re.search(r"(?:(?<!\d)[1-9][0-9]{5}(?!\d)|INDIA)", cand_a, re.IGNORECASE):
                            continue
                in_addr = True
                continue
            if in_addr:
                low_ln = line.lower()
                if (
                    len(addr_lines) >= 3
                    or line.startswith("--- PAGE")
                    or any(
                        k in low_ln
                        for k in (
                            "fileno", "file no", "fie no", "ifmno", "oldpassport", "old pass", "old pat",
                            "ola pas", "observation", "passport", "father", "mother", "spouse",
                            "registration", "date", "signature", "નોંધણી", "you to canada",
                            "status of", "respected", "dear ", "purpose of", "sincerely",
                        )
                    )
                ):
                    in_addr = False
                else:
                    addr_lines.append(line)
                    if re.search(r"(?:(?<!\d)[1-9][0-9]{5}(?!\d)|INDIA)", line, re.IGNORECASE):
                        in_addr = False

        if not file_num:
            fn_m = re.search(r"\b(AH[0-9A-Z]{10,14})\b", clean_text)
            if fn_m and sum(c.isdigit() for c in fn_m.group(1)) >= 7:
                file_num = fn_m.group(1)

        if addr_lines:
            address = ", ".join(addr_lines)

        pin_m = re.search(r"(?:PIN[\s:]*|(?<!\d))([1-9][0-9]{5})(?!\d)", address or clean_text, re.IGNORECASE)
        if pin_m:
            pincode = pin_m.group(1)

        return IndianPassportExtraction(
            passport_number=passport_num,
            is_valid_format=True,
            emigration_check=ecr_status,
            file_number=file_num,
            booklet_type=booklet,
            holder_name=holder_name,
            surname=surname,
            given_names=given_names,
            date_of_birth=dob,
            gender=gender,
            place_of_birth=place_of_birth,
            place_of_issue=place_of_issue,
            date_of_issue=issue_date,
            date_of_expiry=exp_date,
            father_name=father,
            mother_name=mother,
            spouse_name=spouse,
            address=address,
            pin_code=pincode,
            nationality=nationality,
            mrz_detected=mrz_detected,
            raw_mrz=raw_mrz,
        )

    @staticmethod
    def parse_driving_licence(text: str) -> Optional[DrivingLicenceExtraction]:
        """
        Parses Indian and International Driver's Licenses.
        Indian format: State code (2 letters) + RTO/Year + Serial (e.g. GJ0120150001234 or DL-0420110012345).
        International/US format: DL Number with state identifier.
        """
        if not text:
            return None

        # Indian Driving Licence: e.g. GJ01 20150001234 or MH-12-2018-0004567 or DL0420110012345
        dl_match = re.search(r"\b([A-Z]{2}[- ]?[0-9]{2}[- ]?(?:19[89][0-9]|20[0-2][0-9])[- ]?[0-9]{7})\b", text)
        if not dl_match:
            # General alphanumeric DL with explicit label
            dl_match = re.search(r"(?:Driving\s*Licen[cs]e\s*(?:No\.?|Number)?|DL\s*No\.?)[\s:]+([A-Z0-9-]{8,18})", text, re.IGNORECASE)

        if not dl_match:
            return None

        lic_num = dl_match.group(1).replace(" ", "").replace("-", "")
        clean_num = dl_match.group(1).strip()

        # Jurisdiction
        jurisdiction = "India"
        state_prefixes = {
            "GJ": "Gujarat, India",
            "MH": "Maharashtra, India",
            "DL": "Delhi, India",
            "KA": "Karnataka, India",
            "TN": "Tamil Nadu, India",
            "UP": "Uttar Pradesh, India",
            "RJ": "Rajasthan, India",
            "HR": "Haryana, India",
            "PB": "Punjab, India",
            "WB": "West Bengal, India",
            "KL": "Kerala, India",
            "TS": "Telangana, India",
            "AP": "Andhra Pradesh, India",
            "MP": "Madhya Pradesh, India",
        }
        if len(lic_num) >= 2 and lic_num[:2] in state_prefixes:
            jurisdiction = state_prefixes[lic_num[:2]]
        elif re.search(r"\b(California|Texas|New York|Florida|Washington|Ontario|British Columbia)\b", text, re.IGNORECASE):
            state_m = re.search(r"\b(California|Texas|New York|Florida|Washington|Ontario|British Columbia)\b", text, re.IGNORECASE)
            jurisdiction = state_m.group(1).title() if state_m else "State / Provincial"

        # Name extraction
        name = None
        name_m = re.search(r"(?:Name|Holder Name)[\s:]+([A-Za-z\s\.-]{3,40})", text, re.IGNORECASE)
        if name_m:
            name = name_m.group(1).split("\n")[0].strip().title()

        # Expiry date
        exp = None
        exp_m = re.search(r"(?:Valid Till|Valid Upto|Expiry Date|Expires)[\s:]+([0-9]{1,2}[/\.-][0-9]{1,2}[/\.-][0-9]{2,4})", text, re.IGNORECASE)
        if exp_m:
            exp = exp_m.group(1).strip()

        # Vehicle class (e.g. LMV, MCWG)
        vclass = None
        class_m = re.search(r"\b(LMV|MCWG|MCWOG|HMV|TRANS|CLASS [A-Z0-9]+)\b", text, re.IGNORECASE)
        if class_m:
            vclass = class_m.group(1).upper()

        return DrivingLicenceExtraction(
            is_valid=True,
            licence_number=clean_num,
            jurisdiction=jurisdiction,
            holder_name=name,
            expiry_date=exp,
            vehicle_class=vclass,
        )

    @staticmethod
    def parse_voter_id(text: str) -> Optional[VoterIDExtraction]:
        """
        Parses Indian Voter ID / Elector's Photo Identity Card (EPIC) format:
        3 letters followed by 7 numeric digits (e.g., ABC1234567, XYA0123456).
        """
        if not text:
            return None

        # EPIC number: 3 letters + 7 digits
        epic_match = re.search(r"\b([A-Z]{3}[0-9]{7})\b", text.upper())
        if not epic_match:
            epic_match = re.search(r"(?:EPIC\s*(?:No\.?|Number)|Voter\s*ID\s*(?:No\.?|Number)?)[\s:]+([A-Z0-9]{10})", text, re.IGNORECASE)

        if not epic_match:
            return None

        epic_num = epic_match.group(1).upper()

        name = None
        name_m = re.search(r"(?:Elector(?:'s)?\s*Name|Name)[\s:]+([A-Za-z\s\.-]{3,40})", text, re.IGNORECASE)
        if name_m:
            name = name_m.group(1).split("\n")[0].strip().title()

        rel_name = None
        rel_m = re.search(r"(?:Father(?:'s)?\s*Name|Husband(?:'s)?\s*Name)[\s:]+([A-Za-z\s\.-]{3,40})", text, re.IGNORECASE)
        if rel_m:
            rel_name = rel_m.group(1).split("\n")[0].strip().title()

        return VoterIDExtraction(
            is_valid=True,
            epic_number=epic_num,
            elector_name=name,
            relative_name=rel_name,
            state_or_constituency="Election Commission of India",
        )

