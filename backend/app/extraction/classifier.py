import re
from typing import Tuple

CATEGORY_RULES: list[dict] = [
    {
        "category": "identity_passport",
        "label": "Passports and Identity Documents",
        "weight": 2.0,
        "filename_patterns": [
            r"\bPASSPORT\b",
            r"\bNATIONAL[_\s-]?ID\b",
            r"\bAADHAAR\b",
            r"\bPAN[_\s-]?CARD\b",
            r"\bDIGITAL[_\s-]?PHOTO\b",
            r"\bDRIV(?:ER|ING)[_\s-]?LICEN[CS]E\b",
            r"\bVOTER[_\s-]?ID\b",
            r"\bEPIC[_\s-]?CARD\b",
        ],
        "patterns": [
            r"\bPASSPORT\b",
            r"\bPASAPORTE\b",
            r"\bPASSEPORT\b",
            r"\bP<[A-Z0-9<]{39,}\b",  # ICAO Doc 9303 MRZ Type 3
            r"\bREPUBLIC OF INDIA\b",
            r"\bSURNAME\b",
            r"\bGIVEN NAMES?\b",
            r"\bNATIONALITY\b",
            r"\bDATE OF BIRTH\b",
            r"\bDATE OF EXPIR(?:Y|ATION)\b",
            r"\bPASSPORT NO\b",
            r"\bTRAVEL DOCUMENT\b",
            r"\bNATIONAL IDENTIT(?:Y| CARD)\b",
            r"\bUNIQUE IDENTIFICATION AUTHORITY OF INDIA\b",
            r"\bINCOME TAX DEPARTMENT.*GOVT\. OF INDIA\b",
            r"\bPERMANENT ACCOUNT NUMBER\b",
            r"\bDRIV(?:ING|ER)\s*LICEN[CS]E\b",
            r"\bUNION OF INDIA DRIVING LICENCE\b",
            r"\bMOTOR VEHICLES DEPARTMENT\b",
            r"\bELECTION COMMISSION OF INDIA\b",
            r"\bELECTOR'?S PHOTO IDENTITY CARD\b",
            r"\bEPIC NO\b",
            r"\bSTATE OF [A-Z\s]+ DRIVER LICENSE\b",
            r"\bDEPARTMENT OF MOTOR VEHICLES\b",
        ],
    },
    {
        "category": "civil_status_family",
        "label": "Civil-Status and Family Documents",
        "weight": 2.0,
        "filename_patterns": [
            r"\bMARRIAGE\b",
            r"\bBIRTH\b",
            r"\bFAMILY\b",
            r"\bRELATIONSHIP\b",
            r"\bIMM5645\b",
            r"\bIMM5713\b",
        ],
        "patterns": [
            r"\bBIRTH CERTIFICATE\b",
            r"\bCERTIFICATE OF BIRTH\b",
            r"\bACTA DE NACIMIENTO\b",
            r"\bMARRIAGE CERTIFICATE\b",
            r"\bCERTIFICATE OF MARRIAGE\b",
            r"\bMEM(?:O)?RANDUM OF MARRIAGE\b",
            r"\bREGISTRATION OF MARRIAGES ACT\b",
            r"\bFULL NAME OF THE BRIDEGROOM\b",
            r"\bFULL NAME OF THE BRIDE\b",
            r"\bDIVORCE DECREE\b",
            r"\bREGISTRATION OF (?:BIRTH|MARRIAGE)\b",
            r"\bIMM\s*5645\b",
            r"\bFAMILY INFORMATION\b",
            r"\bIMM\s*5713\b",
            r"\bUSE OF A FAMILY REPRESENTATIVE\b",
            r"\bPROOF OF RELATIONSHIP\b",
            r"\bSON OF MAIN APPLICANT\b",
            r"\bDAUGHTER IN LAW\b",
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
        "filename_patterns": [
            r"\bVISA[_\s-]?FOIL\b",
            r"\bRESIDENCE[_\s-]?PERMIT\b",
            r"\bBRP\b",
        ],
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
        "filename_patterns": [
            r"\bDEGREE\b",
            r"\bDIPLOMA\b",
            r"\bTRANSCRIPT\b",
            r"\bGRADUATION\b",
        ],
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
        "filename_patterns": [
            r"\bEMPLOYMENT\b",
            r"\bJOB[_\s-]?OFFER\b",
            r"\bPAYSLIP\b",
            r"\bPAYSTUB\b",
            r"\bW-?2\b",
            r"\bRESUME\b",
            r"\bCV\b",
            r"\bCURRICULUM[_\s-]?VITAE\b",
        ],
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
            r"\bCURRICULUM VITAE\b",
            r"\bRESUME\b",
            r"\bPROFESSIONAL EXPERIENCE\b",
            r"\bWORK EXPERIENCE\b",
            r"\bTECHNICAL SKILLS\b",
            r"\bCORE COMPETENCIES\b",
            r"\bSKILLS\s*&?\s*ABILITIES\b",
            r"\bPROFESSIONAL SUMMARY\b",
            r"\bCAREER OBJECTIVE\b",
            r"\bEMPLOYMENT HISTORY\b",
            r"\bLINKEDIN\.COM/IN/\b",
            r"\bGITHUB\.COM/\b",
            r"\b(?:SOFTWARE|FULL\s*STACK|BACKEND|FRONTEND|SYSTEMS|DEVOPS|DATA|AI|CLOUD|LEAD|SENIOR)\s+(?:ENGINEER|DEVELOPER|ARCHITECT|ANALYST|MANAGER|CONSULTANT)\b",
        ],
    },
    {
        "category": "financial_evidence",
        "label": "Financial Evidence",
        "weight": 2.0,
        "filename_patterns": [
            r"\bFINANCIAL\b",
            r"\bBANK\b",
            r"\bNET[_\s-]?WORTH\b",
            r"\bVALUATION\b",
            r"\bITR\b",
            r"\bTAX\b",
        ],
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
            r"\bCHARTERED ACCOUNTANTS?\b",
            r"\bNET WORTH\b",
            r"\bVALUATION OF IMMOVABLE\b",
            r"\bREGISTERED VALUER\b",
            r"\bREPORT OF VALUATION OF IMMOVABLE PROPERTY\b",
            r"\bFIXED DEPOSIT\b",
            r"\bPPF A/C\b",
            r"\bMUTUAL FUND INVESTMENT\b",
            r"\bCANADIAN DOLLAR VALUE IS CAD\b",
            r"\bINDIAN INCOME TAX RETURN ACKNOWLEDGEMENT\b",
        ],
    },
    {
        "category": "travel_records",
        "label": "Travel Records",
        "weight": 1.9,
        "filename_patterns": [
            r"\bTRAVEL\b",
            r"\bITINERARY\b",
            r"\bFLIGHT\b",
            r"\bIMM5562\b",
            r"\bPURPOSE[_\s-]?OF[_\s-]?TRAVEL\b",
        ],
        "patterns": [
            r"\bIMM\s*5562\b",
            r"\bYOUR TRAVELS\b",
            r"\bSUPPLEMENTARY INFORMATION\s*[-–]\s*YOUR TRAVELS\b",
            r"\bTRAVEL INFORMATION\b",
            r"\bPURPOSE OF TRAVEL\b",
            r"\bPURPOSE OF VISIT\b",
            r"\bFOREMOST PURPOSE OF OUR INTENDED VISIT\b",
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
        "weight": 1.9,
        "filename_patterns": [
            r"\bINSURANCE\b",
            r"\bCOVERAGE\b",
            r"\bACCOMMODATION\b",
            r"\bLEASE\b",
            r"\bTENANCY\b",
        ],
        "patterns": [
            r"\bHEALTH INSURANCE\b",
            r"\bINSURANCE POLICY\b",
            r"\bPOLICY NUMBER\b",
            r"\bCONFIRMATION OF COVERAGE\b",
            r"\bINSURED COVERAGE SUMMARY\b",
            r"\bMANULIFE\b",
            r"\bALLIANZ\b",
            r"\bEMERGENCY MEDICAL INSURANCE\b",
            r"\bSUPER VISA INSURANCE\b",
            r"\bDEDUCTIBLE\b",
            r"\bPREMIUM DETAILS\b",
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
        "weight": 2.0,
        "filename_patterns": [
            r"\bMEDICAL\b",
            r"\bEMEDICAL\b",
            r"\bPOLICE\b",
            r"\bCLEARANCE\b",
        ],
        "patterns": [
            r"\bEMEDICAL\b",
            r"\bUPFRONT MEDICAL\b",
            r"\bUMI\s*NO\b",
            r"\bIME\s*NO\b",
            r"\b501\s*MEDICAL EXAMINATION\b",
            r"\bVACCINATION WORKSHEET\b",
            r"\bINFORMATION SHEET.*MEDICAL\b",
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
        "weight": 2.0,
        "filename_patterns": [
            r"\bIMM5257\b",
            r"\bIMM5713\b",
            r"\bINVITATION\b",
            r"\bNOTICE[_\s-]?OF[_\s-]?ACTION\b",
            r"\bI-797\b",
            r"\bUSCIS\b",
        ],
        "patterns": [
            r"\bIMM\s*5257\b",
            r"\bAPPLICATION FOR VISITOR VISA\b",
            r"\bTEMPORARY RESIDENT VISA\b",
            r"\bIMMIGRATION,\s*REFUGEES\s*AND\s*CITIZENSHIP\s*CANADA\b",
            r"\bIMM\s*5713\b",
            r"\bUSE OF A FAMILY REPRESENTATIVE\b",
            r"\bINVITATION LETTER\b",
            r"\bLETTER OF INVITATION\b",
            r"\bSPONSOR(?:'S)? DOCUMENTS\b",
            r"\bUSCIS\b",
            r"\bNOTICE OF ACTION\b",
            r"\bFORM I-797\b",
            r"\bRECEIPT NOTICE\b",
            r"\bAPPROVAL NOTICE\b",
            r"\bDEPARTMENT OF HOMELAND SECURITY\b",
            r"\bHOME OFFICE\b",
            r"\bUK VISAS AND IMMIGRATION\b",
            r"\bRECEIPT NUMBER\b",
        ],
    },
    {
        "category": "translations_certifications",
        "label": "Translations and Certifications",
        "weight": 1.8,
        "filename_patterns": [
            r"\bTRANSLATION\b",
            r"\bCERTIFICATION\b",
            r"\bAFFIDAVIT\b",
        ],
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
    Classifies a document into one of the core immigration categories
    using weighted pattern matching, filename semantics, and lexical heuristics.
    Returns: (category, confidence_score)
    """
    if not text and not filename:
        return declared_category or "supporting_evidence", 0.50

    combined = f"{filename}\n\n{text}".upper()
    upper_fname = (filename or "").upper()

    scores: dict[str, float] = {}
    ranking_scores: dict[str, float] = {}

    for rule in CATEGORY_RULES:
        category = rule["category"]
        weight = rule["weight"]
        hits = 0
        for pattern in rule["patterns"]:
            if re.search(pattern, combined, re.IGNORECASE):
                hits += 1

        # Check filename patterns for strong primary category signals
        filename_boost = 0.0
        for fpat in rule.get("filename_patterns", []):
            if re.search(fpat, upper_fname, re.IGNORECASE):
                filename_boost = 0.40
                break

        # Contextual boost: Client Information with coverage/insurance
        if category == "insurance_accommodation" and "CLIENT INFORMATION" in upper_fname:
            if "CONFIRMATION OF COVERAGE" in combined or "INSURED" in combined or "DEDUCTIBLE" in combined:
                filename_boost = 0.45

        # IRCC Form IMM5257 boost
        if category == "government_correspondence" and ("IMM5257" in upper_fname or "IMM 5257" in combined):
            filename_boost = max(filename_boost, 0.45)

        if hits > 0 or filename_boost > 0:
            base_score = (hits * 0.25 + 0.3) * (weight / 2.0) if hits > 0 else 0.50
            final_conf = min(0.99, base_score + filename_boost)
            scores[category] = final_conf
            # Rank with filename boost having dominant packet taxonomy weight
            ranking_scores[category] = base_score + (10.0 if filename_boost > 0 else 0.0)

    if declared_category and declared_category in scores:
        # Boost confidence when document contents validate user's declared category
        scores[declared_category] = min(0.99, scores[declared_category] + 0.15)
        ranking_scores[declared_category] = ranking_scores.get(declared_category, 0.5) + 0.5

    if ranking_scores:
        best_category = max(ranking_scores, key=ranking_scores.get)  # type: ignore
        best_score = scores[best_category]
        if best_score >= 0.55:
            return best_category, round(best_score, 2)

    return declared_category or "supporting_evidence", 0.50


