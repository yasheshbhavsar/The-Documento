"""ICAO Doc 9303 Machine Readable Zone (MRZ) Recognition & Parsing Engine.

Supports:
- TD3 (Passports, 2 lines of 44 characters)
- TD2 (ID Cards / Visas, 2 lines of 36 characters)
- TD1 (ID Cards, 3 lines of 30 characters)

Features:
- Robust line detection across scrambled/reversed OCR text blocks.
- Cleans OCR artifacts (e.g. whitespace, angle brackets, O vs 0).
- ICAO 7-3-1 modulus 10 checksum validation on document number, DOB, expiry, and composite fields.
- Intelligent century resolution for DOB and expiration dates.
- Extraction of standardized ISO country codes, document numbers, names, gender, and dates.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


# ISO 3166-1 alpha-3 code mapping for common immigration jurisdictions
ICAO_COUNTRY_CODES: dict[str, str] = {
    "IND": "India",
    "CAN": "Canada",
    "USA": "United States",
    "GBR": "United Kingdom",
    "AUS": "Australia",
    "NZL": "New Zealand",
    "DEU": "Germany",
    "FRA": "France",
    "ARE": "United Arab Emirates",
    "SGP": "Singapore",
    "PAK": "Pakistan",
    "BGD": "Bangladesh",
    "NPL": "Nepal",
    "LKA": "Sri Lanka",
    "CHN": "China",
    "PHL": "Philippines",
    "NGA": "Nigeria",
    "IRN": "Iran",
    "BRA": "Brazil",
    "MEX": "Mexico",
    "JPN": "Japan",
    "KOR": "South Korea",
    "ITA": "Italy",
    "ESP": "Spain",
    "PRT": "Portugal",
    "IRL": "Ireland",
    "NLD": "Netherlands",
    "SWE": "Sweden",
    "CHE": "Switzerland",
    "ZAF": "South Africa",
    "KEN": "Kenya",
    "EGY": "Egypt",
    "RUS": "Russian Federation",
    "UKR": "Ukraine",
    "VNM": "Vietnam",
}


@dataclass
class MRZResult:
    is_valid: bool
    doc_type: str  # "TD3", "TD2", "TD1"
    document_number: str
    issuing_country_code: str
    issuing_country: str
    nationality_code: str
    nationality: str
    surname: str
    given_names: str
    full_name: str
    date_of_birth: Optional[str]  # ISO YYYY-MM-DD
    gender: str  # "Male", "Female", "Unspecified"
    expiry_date: Optional[str]  # ISO YYYY-MM-DD
    raw_mrz: str
    document_number_checksum_valid: bool = False
    dob_checksum_valid: bool = False
    expiry_checksum_valid: bool = False
    composite_checksum_valid: bool = False
    optional_data: Optional[str] = None


class MRZParser:
    """Production-grade ICAO Doc 9303 MRZ extraction & validation engine."""

    @staticmethod
    def _char_value(c: str) -> int:
        if "0" <= c <= "9":
            return int(c)
        if "A" <= c <= "Z":
            return ord(c) - 55
        return 0

    @classmethod
    def calculate_checksum(cls, data: str) -> int:
        weights = [7, 3, 1]
        total = 0
        for i, ch in enumerate(data):
            total += cls._char_value(ch) * weights[i % 3]
        return total % 10

    @classmethod
    def verify_checksum(cls, data: str, check_digit: str) -> bool:
        if not check_digit or not check_digit.isdigit():
            return False
        return cls.calculate_checksum(data) == int(check_digit)

    @classmethod
    def normalize_mrz_date(cls, yy_mm_dd: str, is_expiry: bool = False) -> Optional[str]:
        """Converts YYMMDD to ISO YYYY-MM-DD with smart century handling."""
        if not re.match(r"^\d{6}$", yy_mm_dd):
            return None
        yy = int(yy_mm_dd[0:2])
        mm = int(yy_mm_dd[2:4])
        dd = int(yy_mm_dd[4:6])

        if mm < 1 or mm > 12 or dd < 1 or dd > 31:
            return None

        current_year = datetime.now().year
        current_yy = current_year % 100

        if is_expiry:
            # Expiry dates are typically current century or next few years
            century = 2000
        else:
            # Date of Birth: if yy > current_yy -> 1900s, else 2000s
            century = 1900 if yy > (current_yy - 1) else 2000

        full_year = century + yy
        return f"{full_year:04d}-{mm:02d}-{dd:02d}"

    @classmethod
    def _clean_line(cls, line: str) -> str:
        """Cleans common OCR noise while preserving ICAO characters."""
        cleaned = line.strip().upper()
        # Replace common OCR misreads of '<'
        cleaned = cleaned.replace("«", "<").replace("‹", "<").replace("(", "<").replace("{", "<")
        # Remove internal spaces or commas
        cleaned = re.sub(r"[\s,;]+", "", cleaned)
        return cleaned

    @classmethod
    def parse_text(cls, text: str) -> Optional[MRZResult]:
        """
        Scans entire text, isolating candidate MRZ lines and parsing
        ICAO TD3, TD2, or TD1 structures regardless of block sequence.
        """
        if not text:
            return None

        raw_lines = text.splitlines()
        candidate_lines = []
        for line in raw_lines:
            c = cls._clean_line(line)
            # MRZ lines have lots of '<' or are around 30, 36, or 44 chars
            if "<" in c and len(c) >= 28:
                candidate_lines.append(c)

        if not candidate_lines:
            return None

        # Try TD3 first (Passport: 2 lines of 44 chars)
        td3_res = cls._try_parse_td3(candidate_lines)
        if td3_res:
            return td3_res

        # Try TD2 (Visa / ID: 2 lines of 36 chars)
        td2_res = cls._try_parse_td2(candidate_lines)
        if td2_res:
            return td2_res

        # Try TD1 (ID Card: 3 lines of 30 chars)
        td1_res = cls._try_parse_td1(candidate_lines)
        if td1_res:
            return td1_res

        return None

    @staticmethod
    def _fix_numeric_slot(s: str) -> str:
        """Normalizes common OCR letter-for-digit confusions in strictly numeric MRZ slots."""
        return (
            s.replace("O", "0")
            .replace("D", "0")
            .replace("Q", "0")
            .replace("I", "1")
            .replace("B", "8")
            .replace("S", "5")
            .replace("Z", "2")
        )

    @staticmethod
    def _fix_alpha_slot(s: str) -> str:
        """Normalizes common OCR digit-for-letter confusions in strictly alphabetic MRZ slots."""
        return (
            s.replace("0", "O")
            .replace("1", "I")
            .replace("8", "B")
            .replace("5", "S")
            .replace("2", "Z")
        )

    @classmethod
    def _normalize_td3_line2_candidate(cls, c: str) -> str:
        """Applies ICAO Doc 9303 positional type constraints to repair OCR glyph confusions on TD3 Line 2."""
        if len(c) < 38 or c.startswith("P<"):
            return c
        padded = c.ljust(44, "<")[:44]
        # Pos 9 (doc check), Pos 10-12 (nat alpha), Pos 13-19 (DOB + check), Pos 21-27 (Exp + check), Pos 43 (comp check)
        repaired = (
            padded[0:9]
            + cls._fix_numeric_slot(padded[9:10])
            + cls._fix_alpha_slot(padded[10:13])
            + cls._fix_numeric_slot(padded[13:20])
            + padded[20:21]
            + cls._fix_numeric_slot(padded[21:28])
            + padded[28:43]
            + cls._fix_numeric_slot(padded[43:44])
        )
        return repaired

    @classmethod
    def _try_parse_td3(cls, candidates: list[str]) -> Optional[MRZResult]:
        """TD3 Passports: Line 1 starts with P<, Line 2 has doc#, DOB, Expiry."""
        line1_cand = None
        line2_cand = None

        for c in candidates:
            # Line 1 in TD3 starts with P<, followed by 3-letter issuer
            if re.match(r"^P[<A-Z0-9][A-Z0-9<]{3}", c) and len(c) >= 38:
                raw_l1 = c.ljust(44, "<")[:44]
                line1_cand = "P<" + cls._fix_alpha_slot(raw_l1[2:44])
            else:
                norm_l2 = cls._normalize_td3_line2_candidate(c)
                if re.search(r"[A-Z0-9<]{9}[0-9][A-Z<]{3}[0-9]{6}[0-9][MF<][0-9]{6}", norm_l2) and len(c) >= 38:
                    line2_cand = norm_l2

        if not line1_cand or not line2_cand:
            return None

        # Parse Line 1:
        # Pos 0-1: Document Type (P<)
        # Pos 2-4: Issuing State (e.g. IND)
        # Pos 5-43: Name (Surname<<Given<Names<<<<)
        issuing_code = line1_cand[2:5].replace("<", "")
        issuing_country = ICAO_COUNTRY_CODES.get(issuing_code, issuing_code)

        name_part = line1_cand[5:44]
        # Strip trailing '<' filler first so we don't accidentally split on trailing '<<<<'
        # when the separator '<<' between surname and given names had an OCR 'K<' or '<K' glitch
        name_trimmed = re.sub(r"<+$", "", name_part)
        # Also strip trailing OCR filler noise like '<K<' at the very end
        name_trimmed = re.sub(r"(?:<+[KL0-9])+$", "", name_trimmed)

        if "<<" not in name_trimmed:
            # Repair common OCR misread of '<<' separator as 'K<', '<K', or 'L<'
            name_trimmed = re.sub(r"^([A-Z]{2,20}?)[KL]<([A-Z])", r"\1<<\2", name_trimmed)
            name_trimmed = re.sub(r"^([A-Z]{2,20}?)<[KL]([A-Z])", r"\1<<\2", name_trimmed)

        surname = ""
        given_names = ""
        if "<<" in name_trimmed:
            parts = name_trimmed.split("<<", 1)
            surname = parts[0].replace("<", " ").strip()
            given_names = parts[1].replace("<", " ").strip()
        else:
            surname = name_trimmed.replace("<", " ").strip()

        full_name = f"{given_names} {surname}".strip() if given_names and surname else surname or given_names

        # Parse Line 2:
        # Pos 0-8: Passport Number
        # Pos 9: Check Digit
        # Pos 10-12: Nationality
        # Pos 13-18: Date of Birth (YYMMDD)
        # Pos 19: Check Digit
        # Pos 20: Sex (M/F/<)
        # Pos 21-26: Expiry Date (YYMMDD)
        # Pos 27: Check Digit
        # Pos 28-42: Optional personal number
        # Pos 43: Composite Check Digit
        raw_doc_num = line2_cand[0:9]
        doc_num_check = line2_cand[9]
        doc_number = raw_doc_num.replace("<", "").strip()

        nat_code = line2_cand[10:13].replace("<", "")
        nationality = ICAO_COUNTRY_CODES.get(nat_code, nat_code)

        raw_dob = line2_cand[13:19]
        dob_check = line2_cand[19]

        raw_sex = line2_cand[20]
        gender = "Male" if raw_sex == "M" else "Female" if raw_sex == "F" else "Unspecified"

        raw_exp = line2_cand[21:27]
        exp_check = line2_cand[27]

        opt_data = line2_cand[28:42].replace("<", "").strip() or None
        comp_check = line2_cand[43]

        doc_num_valid = cls.verify_checksum(raw_doc_num, doc_num_check)
        dob_valid = cls.verify_checksum(raw_dob, dob_check)
        exp_valid = cls.verify_checksum(raw_exp, exp_check)

        # Composite checksum covers doc_num + check + dob + check + exp + check + opt_data
        comp_data = line2_cand[0:10] + line2_cand[13:20] + line2_cand[21:43]
        comp_valid = cls.verify_checksum(comp_data, comp_check)

        iso_dob = cls.normalize_mrz_date(raw_dob, is_expiry=False)
        iso_exp = cls.normalize_mrz_date(raw_exp, is_expiry=True)

        raw_mrz = f"{line1_cand}\n{line2_cand}"

        return MRZResult(
            is_valid=True,
            doc_type="TD3",
            document_number=doc_number,
            issuing_country_code=issuing_code,
            issuing_country=issuing_country,
            nationality_code=nat_code,
            nationality=nationality,
            surname=surname.title(),
            given_names=given_names.title(),
            full_name=full_name.title(),
            date_of_birth=iso_dob,
            gender=gender,
            expiry_date=iso_exp,
            raw_mrz=raw_mrz,
            document_number_checksum_valid=doc_num_valid,
            dob_checksum_valid=dob_valid,
            expiry_checksum_valid=exp_valid,
            composite_checksum_valid=comp_valid,
            optional_data=opt_data,
        )

    @classmethod
    def _try_parse_td2(cls, candidates: list[str]) -> Optional[MRZResult]:
        """TD2 ID/Visa: 2 lines of 36 chars."""
        line1_cand = None
        line2_cand = None

        for c in candidates:
            if re.match(r"^[ACIV][<A-Z][A-Z<]{3}", c) and len(c) >= 30:
                line1_cand = c.ljust(36, "<")[:36]
            elif re.search(r"[A-Z0-9<]{9}[0-9][A-Z<]{3}[0-9]{6}[0-9][MF<][0-9]{6}", c) and len(c) >= 30:
                line2_cand = c.ljust(36, "<")[:36]

        if not line1_cand or not line2_cand:
            return None

        issuing_code = line1_cand[2:5].replace("<", "")
        issuing_country = ICAO_COUNTRY_CODES.get(issuing_code, issuing_code)

        name_part = line1_cand[5:36]
        surname = ""
        given_names = ""
        if "<<" in name_part:
            parts = name_part.split("<<", 1)
            surname = parts[0].replace("<", " ").strip()
            given_names = parts[1].replace("<", " ").strip()
        else:
            surname = name_part.replace("<", " ").strip()
        full_name = f"{given_names} {surname}".strip() if given_names and surname else surname or given_names

        raw_doc_num = line2_cand[0:9]
        doc_num_check = line2_cand[9]
        doc_number = raw_doc_num.replace("<", "").strip()

        nat_code = line2_cand[10:13].replace("<", "")
        nationality = ICAO_COUNTRY_CODES.get(nat_code, nat_code)

        raw_dob = line2_cand[13:19]
        raw_sex = line2_cand[20]
        gender = "Male" if raw_sex == "M" else "Female" if raw_sex == "F" else "Unspecified"

        raw_exp = line2_cand[21:27]

        iso_dob = cls.normalize_mrz_date(raw_dob, is_expiry=False)
        iso_exp = cls.normalize_mrz_date(raw_exp, is_expiry=True)

        return MRZResult(
            is_valid=True,
            doc_type="TD2",
            document_number=doc_number,
            issuing_country_code=issuing_code,
            issuing_country=issuing_country,
            nationality_code=nat_code,
            nationality=nationality,
            surname=surname.title(),
            given_names=given_names.title(),
            full_name=full_name.title(),
            date_of_birth=iso_dob,
            gender=gender,
            expiry_date=iso_exp,
            raw_mrz=f"{line1_cand}\n{line2_cand}",
            document_number_checksum_valid=cls.verify_checksum(raw_doc_num, doc_num_check),
            dob_checksum_valid=cls.verify_checksum(raw_dob, line2_cand[19]),
            expiry_checksum_valid=cls.verify_checksum(raw_exp, line2_cand[27]),
        )

    @classmethod
    def _try_parse_td1(cls, candidates: list[str]) -> Optional[MRZResult]:
        """TD1 ID Cards: 3 lines of 30 chars."""
        line1_cand = None
        line2_cand = None
        line3_cand = None

        for c in candidates:
            if re.match(r"^I[<A-Z][A-Z<]{3}", c) and len(c) >= 28:
                line1_cand = c.ljust(30, "<")[:30]
            elif re.search(r"^[0-9]{6}[0-9][MF<][0-9]{6}[0-9][A-Z<]{3}", c) and len(c) >= 28:
                line2_cand = c.ljust(30, "<")[:30]
            elif "<<" in c and len(c) >= 25:
                line3_cand = c.ljust(30, "<")[:30]

        if not (line1_cand and line2_cand and line3_cand):
            return None

        issuing_code = line1_cand[2:5].replace("<", "")
        doc_number = line1_cand[5:14].replace("<", "").strip()

        raw_dob = line2_cand[0:6]
        raw_sex = line2_cand[7]
        gender = "Male" if raw_sex == "M" else "Female" if raw_sex == "F" else "Unspecified"
        raw_exp = line2_cand[8:14]
        nat_code = line2_cand[15:18].replace("<", "")

        surname = ""
        given_names = ""
        if "<<" in line3_cand:
            parts = line3_cand.split("<<", 1)
            surname = parts[0].replace("<", " ").strip()
            given_names = parts[1].replace("<", " ").strip()

        return MRZResult(
            is_valid=True,
            doc_type="TD1",
            document_number=doc_number,
            issuing_country_code=issuing_code,
            issuing_country=ICAO_COUNTRY_CODES.get(issuing_code, issuing_code),
            nationality_code=nat_code,
            nationality=ICAO_COUNTRY_CODES.get(nat_code, nat_code),
            surname=surname.title(),
            given_names=given_names.title(),
            full_name=f"{given_names} {surname}".strip().title(),
            date_of_birth=cls.normalize_mrz_date(raw_dob, is_expiry=False),
            gender=gender,
            expiry_date=cls.normalize_mrz_date(raw_exp, is_expiry=True),
            raw_mrz=f"{line1_cand}\n{line2_cand}\n{line3_cand}",
        )
