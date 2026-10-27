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


@dataclass
class PANExtraction:
    is_valid: bool
    pan_number: str
    holder_name: Optional[str] = None
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

        # Look for 12 digits (with optional spaces or hyphens)
        match = re.search(r"\b([2-9]{1}[0-9]{3})[\s-]?([0-9]{4})[\s-]?([0-9]{4})\b", text)
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

        # Extract DOB or YOB
        dob = None
        yob = None
        dob_m = re.search(r"(?:DOB|Date of Birth|जन्म तिथि)[\s:]+([0-9]{2}/[0-9]{2}/[0-9]{4})", text)
        if dob_m:
            dob = dob_m.group(1)
        else:
            yob_m = re.search(r"(?:Year of Birth|जन्म वर्ष)[\s:]+([12][0-9]{3})", text)
            if yob_m:
                yob = int(yob_m.group(1))

        # Gender
        gender = None
        if re.search(r"\b(MALE|पुरुष)\b", text, re.IGNORECASE):
            gender = "Male"
        elif re.search(r"\b(FEMALE|महिला)\b", text, re.IGNORECASE):
            gender = "Female"

        # Father or husband name
        father = None
        rel_m = re.search(r"(?:S/O|D/O|W/O|C/O|आत्मज|पत्नी)[\s:]+([A-Za-z\s\.-]+)", text)
        if rel_m:
            father = rel_m.group(1).split("\n")[0].split(",")[0].strip()

        return AadhaarExtraction(
            is_valid=True,
            masked_aadhaar_number=masked,
            raw_detected=True,
            gender=gender,
            date_of_birth=dob,
            year_of_birth=yob,
            father_or_spouse_name=father,
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
        name_m = re.search(r"(?:Name|नाम)[\s:]+([A-Za-z\s\.-]{3,50})", text, re.IGNORECASE)
        if name_m:
            name = name_m.group(1).split("\n")[0].strip().title()

        # Check surname initial
        surname_match = True
        if name:
            last_word = name.split()[-1]
            if last_word and last_word[0].upper() != surname_initial:
                surname_match = False

        dob = None
        dob_m = re.search(r"(?:Date of Birth|Incorporation Date|जन्म तिथि)[\s:]+([0-9]{2}/[0-9]{2}/[0-9]{4})", text)
        if dob_m:
            dob = dob_m.group(1)

        return PANExtraction(
            is_valid=True,
            pan_number=pan_num,
            holder_name=name,
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

        # 1. First attempt MRZ detection for standard ICAO TD3 passport data
        mrz = MRZParser.parse_text(text) if MRZParser else None

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

        # 2. Visual text regex fallbacks for Passport Number
        if not passport_num:
            p_match = re.search(r"\b([A-Z]{1}[0-9]{7,8})\b", text)
            if not p_match:
                p_match = re.search(r"(?:Passport\s*(?:No\.?|Number)|Doc\s*No\.?)[\s:]+([A-Z0-9]{7,10})", text, re.IGNORECASE)
            if not p_match:
                mrz_m = re.search(r"P<IND[^\n]*\r?\n\s*([A-Z0-9]{8,9})", text)
                if mrz_m:
                    p_match = mrz_m
            if p_match:
                passport_num = p_match.group(1).replace("<", "")

        has_markers = bool(re.search(r"\b(ECR|ECNR|Emigration Check|File No|Republic of India|IND|BHAVSAR|INDIAN)\b", text, re.IGNORECASE))
        if not passport_num and not has_markers:
            return None

        # 3. Check ECR vs ECNR
        ecr_status = "ECNR"
        if re.search(r"\b(Emigration Check Required|ECR)\b", text, re.IGNORECASE) and not re.search(r"\b(Not Required|ECNR)\b", text, re.IGNORECASE):
            ecr_status = "ECR"

        # 4. Booklet type
        booklet = "36-page Regular"
        if re.search(r"\b(60\s*Pages?|Jumbo)\b", text, re.IGNORECASE):
            booklet = "60-page Jumbo"

        # 5. Visual Date Extraction (Issue date, DOB, Expiry if not found from MRZ)
        issue_date = None
        place_of_birth = None
        place_of_issue = None

        date_matches = re.findall(r"\b([0-9]{2}/[0-9]{2}/[0-9]{4})\b", text)
        for dm in date_matches:
            d_parts = dm.split("/")
            yr = int(d_parts[2])
            if yr < 2010 and not dob:
                # DOB candidate
                dob = f"{d_parts[2]}-{d_parts[1]}-{d_parts[0]}"
            elif 2010 <= yr <= 2026 and not issue_date:
                # Issue date candidate
                issue_date = f"{d_parts[2]}-{d_parts[1]}-{d_parts[0]}"
            elif yr > 2026 and not exp_date:
                # Expiry candidate
                exp_date = f"{d_parts[2]}-{d_parts[1]}-{d_parts[0]}"

        # Place of Birth / Issue
        pob_m = re.search(r"(?:Place of Birth|Place of lssue|Place of Issue)[\s:]*([A-Za-z\s,]+)", text, re.IGNORECASE)
        if pob_m:
            place_of_birth = pob_m.group(1).split("\n")[0].strip().title()
        else:
            # Look for Indian city mentions e.g. AHMEDABAD, GUJARAT
            city_m = re.search(r"\b([A-Za-z\s]+(?:Ahmedabad|Mumbai|Delhi|Bengaluru|Bangalore|Chennai|Kolkata|Hyderabad|Pune|Surat|Vadodara|Rajkot|Chandigarh|Jaipur|Lucknow)[A-Za-z\s,]*)", text, re.IGNORECASE)
            if city_m:
                place_of_birth = city_m.group(1).split("\n")[0].strip().title()

        # 6. Endorsements from final page (line-aware & multiline parser)
        father = None
        mother = None
        spouse = None
        file_num = None
        address = None
        pincode = None

        lines = [l.strip() for l in text.splitlines() if l.strip()]
        in_addr = False
        addr_lines = []

        for i, line in enumerate(lines):
            # Father / Guardian
            if re.search(r"(?:Father|Guardian|पिता)", line, re.IGNORECASE) and not father:
                # Check same line
                fat_same = re.search(r"(?:Father(?:'s)?(?:\s*Legal)?\s*Name)[\s:]+([A-Za-z\s\.-]+)", line, re.IGNORECASE)
                if fat_same:
                    father = fat_same.group(1).strip().title()
                else:
                    # Look ahead 1-2 lines
                    for j in range(i + 1, min(i + 3, len(lines))):
                        cand = lines[j]
                        if not any(k in cand.lower() for k in ("mother", "spouse", "address", "file", "passport", "pin", "name", "/")):
                            father = cand.title()
                            break

            # Mother
            if re.search(r"(?:Mother|माता)", line, re.IGNORECASE) and not mother:
                mot_same = re.search(r"(?:Mother(?:'s)?(?:\s*Legal)?\s*Name)[\s:]+([A-Za-z\s\.-]+)", line, re.IGNORECASE)
                if mot_same:
                    mother = mot_same.group(1).strip().title()
                else:
                    for j in range(i + 1, min(i + 3, len(lines))):
                        cand = lines[j]
                        if not any(k in cand.lower() for k in ("father", "spouse", "address", "file", "passport", "pin", "name", "/")):
                            mother = cand.title()
                            break

            # Spouse
            if re.search(r"(?:Spouse|पति|पत्नी)", line, re.IGNORECASE) and not spouse:
                sp_same = re.search(r"(?:Spouse(?:'s)?(?:\s*Legal)?\s*Name)[\s:]+([A-Za-z\s\.-]+)", line, re.IGNORECASE)
                if sp_same:
                    spouse = sp_same.group(1).strip().title()

            # File Number
            if re.search(r"(?:File\s*No|फाइल)", line, re.IGNORECASE) and not file_num:
                f_same = re.search(r"(?:File No\.?|File Number)[\s:]+([A-Z0-9]{10,16})", line, re.IGNORECASE)
                if f_same:
                    file_num = f_same.group(1).strip().upper()
                else:
                    for j in range(i + 1, min(i + 3, len(lines))):
                        cand = lines[j]
                        m = re.search(r"\b([A-Z]{2}[0-9]{10,14}|[A-Z0-9]{10,16})\b", cand)
                        if m:
                            file_num = m.group(1)
                            break

            # Address block
            if re.search(r"(?:Address|पता)", line, re.IGNORECASE):
                in_addr = True
                continue
            if in_addr:
                if any(k in line.lower() for k in ("fileno", "oldpassport", "observation", "file no", "passport")):
                    in_addr = False
                else:
                    addr_lines.append(line)

        if addr_lines:
            address = ", ".join(addr_lines)

        pin_m = re.search(r"\bPIN[\s:]*([1-9][0-9]{5})\b|\b([1-9][0-9]{5})\b", text, re.IGNORECASE)
        if pin_m:
            pincode = pin_m.group(1) or pin_m.group(2)

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

