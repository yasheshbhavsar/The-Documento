import re
from typing import Tuple

CATEGORY_RULES: list[dict] = [
    {
        "category": "identity_passport",
        "label": "Passports and Identity Documents",
        "weight": 2.0,
        "patterns": [
            r"\bPASSPORT\b",
            r"\bPASAPORTE\b",
            r"\bPASSEPORT\b",
            r"\bP<[A-Z0-9<]{39,}\b",  # ICAO Doc 9303 MRZ Type 3
            r"\bSURNAME\b",
            r"\bGIVEN NAMES?\b",
            r"\bNATIONALITY\b",
            r"\bDATE OF BIRTH\b",
            r"\bDATE OF EXPIR(?:Y|ATION)\b",
            r"\bPASSPORT NO\b",
            r"\bTRAVEL DOCUMENT\b",
            r"\bNATIONAL IDENTIT(?:Y| CARD)\b",
        ],
    },
    {
        "category": "civil_status_family",
        "label": "Civil-Status and Family Documents",
        "weight": 1.8,
        "patterns": [
            r"\bBIRTH CERTIFICATE\b",
            r"\bCERTIFICATE OF BIRTH\b",
            r"\bACTA DE NACIMIENTO\b",
            r"\bMARRIAGE CERTIFICATE\b",
            r"\bCERTIFICATE OF MARRIAGE\b",
            r"\bDIVORCE DECREE\b",
            r"\bREGISTRATION OF (?:BIRTH|MARRIAGE)\b",
            r"\bFATHER(?:'S)? NAME\b",
            r"\bMOTHER(?:'S)? NAME\b",
            r"\bSPOUSE\b",
            r"\bMAIDEN NAME\b",
        ],
    },
    {
        "category": "visas_residence_permits",
        "label": "Existing Visas and Residence Permits",
        "weight": 1.8,
        "patterns": [
            r"\bVISA\b",
            r"\bRESIDENCE PERMIT\b",
            r"\bPERMIT TO ENTER\b",
            r"\bCONTROL NO\b",
            r"\bENTRIES: [MS1-9]\b",
            r"\bVISA TYPE/CLASS\b",
            r"\bWORK AUTHORIZATION\b",
            r"\bBIOMETRIC RESIDENCE PERMIT\b",
            r"\bVALID UNTIL\b",
        ],
    },
    {
        "category": "educational_records",
        "label": "Educational Records",
        "weight": 1.8,
        "patterns": [
            r"\bDEGREE\b",
            r"\bDIPLOMA\b",
            r"\bBACHELOR(?: OF [A-Z]+)?\b",
            r"\bMASTER(?: OF [A-Z]+)?\b",
            r"\bDOCTOR OF PHILOSOPHY\b",
            r"\bPH\.?D\.?\b",
            r"\bTRANSCRIPT OF RECORDS?\b",
            r"\bACADEMIC TRANSCRIPT\b",
            r"\bUNIVERSITY\b",
            r"\bFACULTY OF\b",
            r"\bCUMULATIVE GPA\b",
            r"\bCONFERRED ON\b",
        ],
    },
    {
        "category": "employment_records",
        "label": "Employment Records",
        "weight": 1.8,
        "patterns": [
            r"\bEMPLOYMENT VERIFICATION\b",
            r"\bVERIFICATION OF EMPLOYMENT\b",
            r"\bJOB TITLE\b",
            r"\bANNUAL SALARY\b",
            r"\bCOMPENSATION\b",
            r"\bHOURS PER WEEK\b",
            r"\bOFFER OF EMPLOYMENT\b",
            r"\bEMPLOYER NAME\b",
            r"\bDUTIES AND RESPONSIBILITIES\b",
            r"\bFORM W-2\b",
            r"\bPAYSTUB\b",
            r"\bPAYSLIP\b",
        ],
    },
    {
        "category": "financial_evidence",
        "label": "Financial Evidence",
        "weight": 1.7,
        "patterns": [
            r"\bBANK STATEMENT\b",
            r"\bACCOUNT STATEMENT\b",
            r"\bCLOSING BALANCE\b",
            r"\bOPENING BALANCE\b",
            r"\bCHECKING ACCOUNT\b",
            r"\bSAVINGS ACCOUNT\b",
            r"\bFINANCIAL HOLDINGS\b",
            r"\bTOTAL ASSETS\b",
            r"\bAVAILABLE BALANCE\b",
            r"\bDEPOSITS AND WITHDRAWALS\b",
        ],
    },
    {
        "category": "travel_records",
        "label": "Travel Records",
        "weight": 1.6,
        "patterns": [
            r"\bBOARDING PASS\b",
            r"\bFLIGHT ITINERARY\b",
            r"\bTRAVEL HISTORY\b",
            r"\bFLIGHT NUMBER\b",
            r"\bDEPARTURE DATE\b",
            r"\bARRIVAL DATE\b",
            r"\bELECTRONIC TICKET\b",
            r"\bPORT OF ENTRY\b",
        ],
    },
    {
        "category": "insurance_accommodation",
        "label": "Insurance and Accommodation Evidence",
        "weight": 1.6,
        "patterns": [
            r"\bHEALTH INSURANCE\b",
            r"\bINSURANCE POLICY\b",
            r"\bPOLICY NUMBER\b",
            r"\bLEASE AGREEMENT\b",
            r"\bRESIDENTIAL LEASE\b",
            r"\bTENANCY AGREEMENT\b",
            r"\bLANDLORD\b",
            r"\bMONTHLY RENT\b",
            r"\bACCOMMODATION CONFIRMATION\b",
        ],
    },
    {
        "category": "police_medical",
        "label": "Police and Medical Documents",
        "weight": 1.7,
        "patterns": [
            r"\bPOLICE CLEARANCE\b",
            r"\bPOLICE CERTIFICATE\b",
            r"\bCRIMINAL RECORD CHECK\b",
            r"\bNO CRIMINAL RECORD\b",
            r"\bGOOD CONDUCT CERTIFICATE\b",
            r"\bMEDICAL EXAMINATION\b",
            r"\bVACCINATION RECORD\b",
            r"\bCIVIL SURGEON\b",
            r"\bREPORT OF MEDICAL EXAMINATION\b",
            r"\bFORM I-693\b",
        ],
    },
    {
        "category": "government_correspondence",
        "label": "Government Forms and Correspondence",
        "weight": 1.8,
        "patterns": [
            r"\bUSCIS\b",
            r"\bNOTICE OF ACTION\b",
            r"\bFORM I-797\b",
            r"\bRECEIPT NOTICE\b",
            r"\bAPPROVAL NOTICE\b",
            r"\bDEPARTMENT OF HOMELAND SECURITY\b",
            r"\bHOME OFFICE\b",
            r"\bUK VISAS AND IMMIGRATION\b",
            r"\bIMMIGRATION, REFUGEES AND CITIZENSHIP CANADA\b",
            r"\bRECEIPT NUMBER\b",
        ],
    },
    {
        "category": "translations_certifications",
        "label": "Translations and Certifications",
        "weight": 1.8,
        "patterns": [
            r"\bCERTIFICATION OF TRANSLATION\b",
            r"\bCERTIFICATE OF ACCURACY\b",
            r"\bSWORN TRANSLATOR\b",
            r"\bTRANSLATED FROM [A-Z]+ INTO [A-Z]+\b",
            r"\bTRUE AND ACCURATE TRANSLATION\b",
            r"\bCOMPETENT TO TRANSLATE\b",
            r"\bAFFIDAVIT OF TRANSLATION\b",
        ],
    },
]


def classify_document(
    text: str,
    filename: str = "",
    declared_category: str | None = None,
) -> Tuple[str, float]:
    """
    Classifies a document into one of the 12 core immigration categories
    using weighted pattern matching and lexical heuristics.
    Returns: (category, confidence_score)
    """
    if not text and not filename:
        return declared_category or "supporting_evidence", 0.5

    combined = f"{filename}\n\n{text}".upper()

    scores: dict[str, float] = {}

    for rule in CATEGORY_RULES:
        category = rule["category"]
        weight = rule["weight"]
        hits = 0
        for pattern in rule["patterns"]:
            if re.search(pattern, combined, re.IGNORECASE):
                hits += 1

        if hits > 0:
            # Score proportional to matched patterns capped at 0.99
            score = min(0.99, (hits * 0.25 + 0.3) * (weight / 2.0))
            scores[category] = score

    if declared_category and declared_category in scores:
        # Boost confidence when document contents validate user's declared category
        scores[declared_category] = min(0.99, scores[declared_category] + 0.15)

    if scores:
        best_category = max(scores, key=scores.get) # type: ignore
        best_score = scores[best_category]
        if best_score >= 0.55:
            return best_category, round(best_score, 2)

    return declared_category or "supporting_evidence", 0.50
