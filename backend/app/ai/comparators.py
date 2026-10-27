"""Deterministic comparators and phonetic/transliteration matchers for immigration evidence.

Distinguishes harmless variations (transliterations, maiden/married names, OCR typos,
date format conventions) from confirmed contradictions.
"""
from dataclasses import dataclass
from typing import Optional, Tuple
import re
from datetime import date, datetime


@dataclass
class FieldComparisonResult:
    is_concordant: bool
    is_confirmed_contradiction: bool
    similarity_score: float
    variation_type: Optional[str]  # None, "transliteration", "name_change", "ocr_noise", "date_format_ambiguity", "unexplained_difference"
    explanation: str
    suggested_clarification: Optional[str] = None


# Common transliteration mappings (Cyrillic, Arabic, Asian common variants)
TRANSLITERATION_MAP = {
    "elena": "yelena",
    "yelena": "elena",
    "dmitri": "dmitry",
    "dmitriy": "dmitry",
    "dmitry": "dmitri",
    "aleksandr": "alexander",
    "alexander": "aleksandr",
    "sergei": "sergey",
    "sergey": "sergei",
    "mikhail": "michael",
    "michael": "mikhail",
    "nikolai": "nikolay",
    "nikolay": "nikolai",
    "muhammad": "mohammed",
    "mohammed": "mohamed",
    "mohamed": "muhammad",
    "ahmad": "ahmed",
    "ahmed": "ahmad",
    "wei": "way",
    "liu": "lew",
}

FNU_TOKENS = {"fnu", "lnu", "nosurname", "nogivenname", "unknown", "none", "na"}
ARABIC_PARTICLES = {"al", "el", "bin", "bint", "ibn", "abu", "abd"}


def _levenshtein_distance(s1: str, s2: str) -> int:
    if len(s1) < len(s2):
        return _levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)

    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row

    return previous_row[-1]


def clean_name_token(token: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z]", "", token.lower())
    # Russian/Slavic gender suffix normalization (Rostova -> Rostov, Ivanova -> Ivanov)
    if cleaned.endswith("ova") and len(cleaned) > 4:
        return cleaned[:-1]
    if cleaned.endswith("eva") and len(cleaned) > 4:
        return cleaned[:-1]
    if cleaned.endswith("ina") and len(cleaned) > 4:
        return cleaned[:-1]
    return cleaned


def compare_names(
    name_a: str,
    name_b: str,
    has_marriage_record: bool = False,
    is_client_dependant_relationship: bool = False,
) -> FieldComparisonResult:
    """Compares two person names, accounting for transliteration, cultural gendered suffixes,
    middle name omission, and potential maiden/married surname changes.
    """
    if not name_a or not name_b:
        return FieldComparisonResult(
            is_concordant=False,
            is_confirmed_contradiction=False,
            similarity_score=0.0,
            variation_type="missing_data",
            explanation="One or both names are missing or empty.",
            suggested_clarification="Please provide identification documents verifying full legal name.",
        )

    # Clean and split into normalized tokens (hyphens, dots, underscores split into separate tokens)
    norm_a = re.sub(r"[-_/.]", " ", name_a)
    norm_b = re.sub(r"[-_/.]", " ", name_b)
    tokens_a = [clean_name_token(t) for t in norm_a.split() if clean_name_token(t)]
    tokens_b = [clean_name_token(t) for t in norm_b.split() if clean_name_token(t)]

    str_a = " ".join(tokens_a)
    str_b = " ".join(tokens_b)

    # 1. Exact match
    if str_a == str_b:
        return FieldComparisonResult(
            is_concordant=True,
            is_confirmed_contradiction=False,
            similarity_score=1.0,
            variation_type=None,
            explanation=f"Names '{name_a}' and '{name_b}' match with complete concordance.",
        )

    # 2. Check Single Name / FNU (First Name Unknown) consular conventions
    fnu_filtered_a = [t for t in tokens_a if t not in FNU_TOKENS]
    fnu_filtered_b = [t for t in tokens_b if t not in FNU_TOKENS]
    has_fnu = (len(fnu_filtered_a) < len(tokens_a)) or (len(fnu_filtered_b) < len(tokens_b))
    if has_fnu and fnu_filtered_a and fnu_filtered_b:
        if fnu_filtered_a == fnu_filtered_b or set(fnu_filtered_a) == set(fnu_filtered_b):
            return FieldComparisonResult(
                is_concordant=True,
                is_confirmed_contradiction=False,
                similarity_score=0.98,
                variation_type="cultural_single_name_fnu",
                explanation=f"Name variance between '{name_a}' and '{name_b}' matches standard consular FNU/LNU notation for single-name applicants.",
                suggested_clarification="Ensure consistency across DS-160 / IMM 5257 by entering single name in Surname and 'FNU' in Given Name as required.",
            )

    # 3. Check Transposed / Reversed name order (e.g., East Asian or South Asian surname-first conventions)
    if len(tokens_a) >= 2 and sorted(tokens_a) == sorted(tokens_b):
        return FieldComparisonResult(
            is_concordant=True,
            is_confirmed_contradiction=False,
            similarity_score=0.95,
            variation_type="reversed_name_order",
            explanation=f"Names '{name_a}' and '{name_b}' contain identical components in transposed or reversed order (common in East Asian / South Asian records).",
            suggested_clarification="Verify Given Name vs Surname fields on passport biodata MRZ to ensure correct order on official government filings.",
        )

    # 4. Check Arabic / Middle Eastern particle assimilation (Al/El/Bin/Bint/Ibn/Abu)
    def _strip_particles(toks: list) -> list:
        res = []
        for t in toks:
            if t in ARABIC_PARTICLES:
                continue
            for p in ("al", "el"):
                if t.startswith(p) and len(t) > 4:
                    t = t[len(p):]
                    break
            res.append(t)
        return res

    particle_stripped_a = _strip_particles(tokens_a)
    particle_stripped_b = _strip_particles(tokens_b)
    if particle_stripped_a and particle_stripped_b and particle_stripped_a == particle_stripped_b and (tokens_a != tokens_b):
        return FieldComparisonResult(
            is_concordant=True,
            is_confirmed_contradiction=False,
            similarity_score=0.93,
            variation_type="cultural_particle_variation",
            explanation=f"Names '{name_a}' and '{name_b}' match with standard Arabic/Semitic particle assimilation (Al/El/Bin/Bint).",
            suggested_clarification="Confirm exact particle spelling as printed on passport machine-readable zone.",
        )

    # 5. Check Patronymic / Initial contraction or expansion (e.g. K. Ramesh vs Kumar Ramesh)
    if len(tokens_a) >= 2 and len(tokens_b) >= 2:
        initial_match = False
        if len(tokens_a) == len(tokens_b):
            for i in range(len(tokens_a)):
                ta, tb = tokens_a[i], tokens_b[i]
                if (len(ta) == 1 and tb.startswith(ta)) or (len(tb) == 1 and ta.startswith(tb)):
                    other_a = [tokens_a[j] for j in range(len(tokens_a)) if j != i]
                    other_b = [tokens_b[j] for j in range(len(tokens_b)) if j != i]
                    if other_a == other_b:
                        initial_match = True
                        break
        if not initial_match and len(tokens_a) == 2 and len(tokens_b) == 2:
            if (len(tokens_a[1]) == 1 and tokens_b[0].startswith(tokens_a[1]) and tokens_a[0] == tokens_b[1]) or \
               (len(tokens_b[1]) == 1 and tokens_a[0].startswith(tokens_b[1]) and tokens_b[0] == tokens_a[1]):
                initial_match = True

        if initial_match:
            return FieldComparisonResult(
                is_concordant=True,
                is_confirmed_contradiction=False,
                similarity_score=0.90,
                variation_type="patronymic_initial_variant",
                explanation=f"Names '{name_a}' and '{name_b}' represent a recognized patronymic initial contraction or expansion.",
                suggested_clarification="Provide secondary identity document (e.g., Aadhaar, voter ID, birth certificate) confirming initial expansion.",
            )

    # 2. Check transliteration equivalence
    set_a = set(tokens_a)
    set_b = set(tokens_b)

    # Check if differences are known transliterations
    diff_a = set_a - set_b
    diff_b = set_b - set_a

    is_transliteration = False
    if diff_a and diff_b:
        all_transliterations = True
        for ta in diff_a:
            mapped = TRANSLITERATION_MAP.get(ta)
            if not mapped or (mapped not in diff_b and clean_name_token(mapped) not in diff_b):
                all_transliterations = False
                break
        if all_transliterations:
            is_transliteration = True

    if is_transliteration:
        return FieldComparisonResult(
            is_concordant=True,
            is_confirmed_contradiction=False,
            similarity_score=0.92,
            variation_type="transliteration",
            explanation=f"Names '{name_a}' and '{name_b}' represent standard Romanization / transliteration variants.",
            suggested_clarification="Ensure consistency on Form I-140/DS-160 petition by listing transliterated name under 'Other Names Used'.",
        )

    # 3. Check for subset / middle name omission (e.g. Elena Rostova vs Elena Maria Rostova)
    if set_a.issubset(set_b) or set_b.issubset(set_a):
        return FieldComparisonResult(
            is_concordant=True,
            is_confirmed_contradiction=False,
            similarity_score=0.90,
            variation_type="name_change",
            explanation=f"Name variation between '{name_a}' and '{name_b}' is attributable to middle name inclusion or omission.",
            suggested_clarification=None,
        )

    # 4. Check for Marriage / Maiden surname variation
    # If first names match but surnames differ, and a marriage certificate exists
    if len(tokens_a) >= 2 and len(tokens_b) >= 2:
        first_a, last_a = tokens_a[0], tokens_a[-1]
        first_b, last_b = tokens_b[0], tokens_b[-1]

        if first_a == first_b and last_a != last_b:
            if has_marriage_record:
                return FieldComparisonResult(
                    is_concordant=True,
                    is_confirmed_contradiction=False,
                    similarity_score=0.85,
                    variation_type="name_change",
                    explanation=f"Surname variance between '{name_a}' and '{name_b}' matches marital status change verified by marriage certificate.",
                    suggested_clarification="Verify maiden name is formally disclosed in petition 'Other Names Used' section.",
                )
            else:
                return FieldComparisonResult(
                    is_concordant=False,
                    is_confirmed_contradiction=False,
                    similarity_score=0.65,
                    variation_type="name_change",
                    explanation=f"Given name matches ('{tokens_a[0]}'), but surname differs between '{last_a}' and '{last_b}'. Potential maiden/married name change requires corroborating civil record.",
                    suggested_clarification="Please provide official marriage certificate or legal name change decree explaining the surname discrepancy.",
                )

    # 5. Levenshtein edit distance check (typos / OCR confusion)
    max_len = max(len(str_a), len(str_b), 1)
    dist = _levenshtein_distance(str_a, str_b)
    sim = max(0.0, 1.0 - (dist / max_len))

    if dist <= 2 and sim >= 0.85:
        return FieldComparisonResult(
            is_concordant=True,
            is_confirmed_contradiction=False,
            similarity_score=sim,
            variation_type="ocr_noise",
            explanation=f"Minor character variance between '{name_a}' and '{name_b}' consistent with harmless typographical or OCR character ambiguity.",
            suggested_clarification="Confirm spelling matches primary passport biodata page.",
        )

    # 6. Completely disparate names -> Confirmed contradiction
    return FieldComparisonResult(
        is_concordant=False,
        is_confirmed_contradiction=True,
        similarity_score=sim,
        variation_type="unexplained_difference",
        explanation=f"Substantial name mismatch between '{name_a}' and '{name_b}' without evident transliteration or civil record bridge.",
        suggested_clarification="Please verify whether '{name_b}' belongs to the primary applicant or an authorized family dependant.",
    )


def parse_date_flexibly(date_str: str) -> Optional[Tuple[int, int, int]]:
    """Parses date string into (year, month, day) tuple. Supports ISO, US MM/DD/YYYY, and European DD/MM/YYYY."""
    if not date_str:
        return None

    cleaned = date_str.strip()

    # Try ISO YYYY-MM-DD
    iso_match = re.search(r"(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})", cleaned)
    if iso_match:
        y, m, d = int(iso_match.group(1)), int(iso_match.group(2)), int(iso_match.group(3))
        if 1 <= m <= 12 and 1 <= d <= 31:
            return (y, m, d)

    # Try Day Month Year (e.g., 12 APR 1988)
    text_match = re.search(r"(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})", cleaned)
    if text_match:
        d, mon_str, y = int(text_match.group(1)), text_match.group(2).lower()[:3], int(text_match.group(3))
        months = {"jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6, "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12}
        if mon_str in months and 1 <= d <= 31:
            return (y, months[mon_str], d)

    # Try standard delimited numbers (e.g. 04/12/1988 or 12/04/1988)
    slash_match = re.search(r"(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})", cleaned)
    if slash_match:
        part1, part2, y = int(slash_match.group(1)), int(slash_match.group(2)), int(slash_match.group(3))
        # If part1 > 12, it must be DD/MM/YYYY
        if part1 > 12 and 1 <= part2 <= 12:
            return (y, part2, part1)
        # If part2 > 12, it must be MM/DD/YYYY
        if part2 > 12 and 1 <= part1 <= 12:
            return (y, part1, part2)
        # Otherwise ambiguous (default to MM/DD/YYYY)
        return (y, part1, part2)

    return None


def compare_dates_of_birth(date_a_str: str, date_b_str: str) -> FieldComparisonResult:
    """Compares birth dates, accounting for DD/MM/YYYY vs MM/DD/YYYY conventions and single-digit typos."""
    parsed_a = parse_date_flexibly(date_a_str)
    parsed_b = parse_date_flexibly(date_b_str)

    if not parsed_a or not parsed_b:
        return FieldComparisonResult(
            is_concordant=False,
            is_confirmed_contradiction=False,
            similarity_score=0.0,
            variation_type="missing_data",
            explanation=f"Unparseable date of birth provided: '{date_a_str}' or '{date_b_str}'.",
            suggested_clarification="Please re-confirm date of birth in standard YYYY-MM-DD format.",
        )

    y_a, m_a, d_a = parsed_a
    y_b, m_b, d_b = parsed_b

    # Exact match
    if (y_a, m_a, d_a) == (y_b, m_b, d_b):
        return FieldComparisonResult(
            is_concordant=True,
            is_confirmed_contradiction=False,
            similarity_score=1.0,
            variation_type=None,
            explanation=f"Dates of birth '{date_a_str}' and '{date_b_str}' match exactly ({y_a}-{m_a:02d}-{d_a:02d}).",
        )

    # Transposed Month / Day convention (e.g. 04/12/1988 vs 12/04/1988)
    if y_a == y_b and m_a == d_b and d_a == m_b:
        return FieldComparisonResult(
            is_concordant=False,
            is_confirmed_contradiction=False,
            similarity_score=0.88,
            variation_type="date_format_ambiguity",
            explanation=f"Day and month appear transposed between '{date_a_str}' and '{date_b_str}' (Day {d_a}/Month {m_a} vs Day {d_b}/Month {m_b}). Consistent with US (MM/DD) vs European (DD/MM) date formatting.",
            suggested_clarification="Please confirm intended date of birth to eliminate US vs European formatting ambiguity.",
        )

    # Single-year typo (e.g. 1988 vs 1989 with same month and day)
    if m_a == m_b and d_a == d_b and abs(y_a - y_b) == 1:
        return FieldComparisonResult(
            is_concordant=False,
            is_confirmed_contradiction=False,
            similarity_score=0.75,
            variation_type="ocr_noise",
            explanation=f"Dates differ by single birth year ({y_a} vs {y_b}) with identical month and day. Potential typographical or OCR error.",
            suggested_clarification="Please verify birth certificate to confirm correct birth year.",
        )

    # Confirmed contradiction
    return FieldComparisonResult(
        is_concordant=False,
        is_confirmed_contradiction=True,
        similarity_score=0.30,
        variation_type="unexplained_difference",
        explanation=f"Confirmed date of birth contradiction between '{date_a_str}' ({y_a}-{m_a:02d}-{d_a:02d}) and '{date_b_str}' ({y_b}-{m_b:02d}-{d_b:02d}).",
        suggested_clarification="Provide primary government-issued birth certificate to establish conclusive date of birth.",
    )


def compare_document_numbers(doc_num_a: str, doc_num_b: str) -> FieldComparisonResult:
    """Compares alphanumeric passport or national ID numbers, detecting OCR digit/letter substitutions."""
    if not doc_num_a or not doc_num_b:
        return FieldComparisonResult(
            is_concordant=False,
            is_confirmed_contradiction=False,
            similarity_score=0.0,
            variation_type="missing_data",
            explanation="Missing document identification number.",
        )

    clean_a = re.sub(r"\s+", "", doc_num_a.upper())
    clean_b = re.sub(r"\s+", "", doc_num_b.upper())

    if clean_a == clean_b:
        return FieldComparisonResult(
            is_concordant=True,
            is_confirmed_contradiction=False,
            similarity_score=1.0,
            variation_type=None,
            explanation=f"Document numbers match with 100% concordance ({clean_a}).",
        )

    # OCR confusion mapping: 0 <-> O, 1 <-> I, 8 <-> B, 5 <-> S
    def canonical_ocr(s: str) -> str:
        return s.replace("0", "O").replace("1", "I").replace("8", "B").replace("5", "S")

    if len(clean_a) == len(clean_b) and canonical_ocr(clean_a) == canonical_ocr(clean_b):
        return FieldComparisonResult(
            is_concordant=False,
            is_confirmed_contradiction=False,
            similarity_score=0.90,
            variation_type="ocr_noise",
            explanation=f"Document number variance between '{clean_a}' and '{clean_b}' matches known OCR optical substitution (e.g. 0/O or 1/I).",
            suggested_clarification="Confirm document number against machine-readable MRZ line.",
        )

    # Unique identifiers (passports, national IDs) must not be casually fuzzy-matched.
    # A single digit difference indicates a completely distinct document (common among family members).
    return FieldComparisonResult(
        is_concordant=False,
        is_confirmed_contradiction=True,
        similarity_score=0.10,
        variation_type="unexplained_difference",
        explanation=f"Confirmed mismatch between document numbers '{clean_a}' and '{clean_b}'. Unique identifiers must not be fuzzy-matched.",
        suggested_clarification="Upload clear uncropped copy of the relevant passport biodata page or confirm whether a separate document was submitted.",
    )
