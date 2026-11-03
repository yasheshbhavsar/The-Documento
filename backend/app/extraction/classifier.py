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
            r"\bPROOF[_\s-]?OF[_\s-]?STATUS\b",
            r"\bCOPR\b",
            r"\bPR[_\s-]?CARD\b",
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
            r"UNIQUE\s*IDENTIFICATION\s*AUTHORITY\s*OF\s*INDIA",
            r"\bENROLL?MENT\s*NO\b",
            r"\bCONFIRMATION\s*OF\s*PERMANENT\s*RESIDENCE\b",
            r"\bPERMANENT\s*RESIDENT\s*CARD\b",
            r"\bCACANPD[0-9<]+\b",
            r"\bINCOME TAX DEPARTMENT.*GOVT\. OF INDIA\b",
            r"\bE-?PERMANENT ACCOUNT NUMBER\b",
            r"\bE-?PAN\s*CARD\b",
            r"\bDRIV(?:ING|ER)\s*LICEN[CS]E\b",
            r"\bUNION OF INDIA DRIVING LICENCE\b",
            r"\bMOTOR VEHICLES DEPARTMENT\b",
            r"\bELECTION COMMISSION OF INDIA\b",
            r"\bELECTOR'?S PHOTO IDENTITY CARD\b",
            r"\bEPIC NO\b",
            r"\bSTATE OF [A-Z\s]+ DRIVER LICENSE\b",
            r"\bDEPARTMENT OF MOTOR VEHICLES\b",
            r"ભારત\s*સરકાર",
            r"આધાર",
            r"મારું\s*આધાર",
            r"આવકવેરા\s*વિભાગ",
            r"ચૂંટણી\s*પંચ",
            r"ડ્રાઇવિંગ\s*લાઇસન્સ",
            r"પાસપોર્ટ",
            r"भारत\s*सरकार",
            r"भारत\s*गणराज्य",
            r"आधार",
            r"मेरा\s*आधार",
            r"आयकर\s*विभाग",
            r"स्थायी\s*लेखा\s*संख्या",
            r"निर्वाचन\s*आयोग",
            r"मतदाता\s*पहचान\s*पत्र",
            r"ड्राइविंग\s*लाइसेंस",
            r"पासपोर्ट",
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
            r"\bREGISTRATION OF BIRTHS AND DEATHS\b",
            r"જન્મ\s*અને\s*મરણ",
            r"જન્મ\s*પ્રમાણપત્ર",
            r"લગ્ન\s*નોંધણી",
            r"લગ્ન\s*પ્રમાણપત્ર",
            r"માતાનું\s*નામ",
            r"પિતાનું\s*નામ",
            r"જન્મ\s*તારીખ",
            r"જન્મ\s*સ્થળ",
            r"जन्म\s*प्रमाण\s*पत्र",
            r"जन्म\s*और\s*मृत्यु",
            r"विवाह\s*प्रमाण\s*पत्र",
            r"विवाह\s*पंजीकरण",
            r"माता\s*का\s*नाम",
            r"पिता\s*का\s*नाम",
            r"जन्म\s*तिथि",
            r"जन्म\s*स्थान",
            r"\bMARRIAGE CERTIFICATE\b",
            r"\bCERTIFICATE OF MARRIAGE\b",
            r"\bMEM(?:O)?RANDUM OF MARRIAGE\b",
            r"\bREGISTRATION OF MARRIAGES ACT\b",
            r"\bFULL NAME OF THE BRIDEGROOM\b",
            r"\bFULL NAME OF THE BRIDE\b",
            r"\bDIVORCE DECREE\b",
            r"\bREGISTRATION OF (?:BIRTH|MARRIAGE)\b",
            r"\bIMM\s*5645\b",
            r"\bFAMILY\s*INFORMATION\b",
            r"SECTION\s*C\s*[-–]?\s*BROTHERS\s*AND\s*SISTERS",
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
            r"\bWORK[_\s-]?PERMIT\b",
            r"\bSTUDY[_\s-]?PERMIT\b",
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
            r"\bENTRY\s*PERMIT\s*NO\b",
            r"\bALLOWED\s*TO\s*ENTER\s*UAE\b",
            r"\bGENERAL\s*DIRECTORATE\s*OF\s*RESIDENCY\b",
            r"\bESTABLISHMENT\s*CARD\b",
        ],
    },
    {
        "category": "educational_records",
        "label": "Educational Records",
        "weight": 2.0,
        "filename_patterns": [
            r"\bDEGREE\b",
            r"\bDIPLOMA\b",
            r"\bTRANSCRIPT\b",
            r"\bGRADUATION\b",
            r"\bOFFER[_\s-]?LETTER\b",
            r"\bLETTER[_\s-]?OF[_\s-]?ACCEPTANCE\b",
            r"\bLOA\b",
            r"\bIELTS\b",
            r"\bBONAFIDE\b",
            r"\bMARKSHEET\b",
            r"\bEDUCATION\b",
            r"\bWORK[_\s-]?REQUIREMENT[_\s-]?IN[_\s-]?STUDY\b",
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
            r"\bLETTER OF ACCEPTANCE\b",
            r"\bOFFER OF ADMISSION\b",
            r"\bDESIGNATED LEARNING INSTITUTION\b",
            r"\bDLI\s*(?:NUMBER|#)\b",
            r"\bESTIMATED TUITION\b",
            r"\bPROGRAM OF STUDY\b",
            r"\bACADEMIC STATUS\b",
            r"\bTEST REPORT FORM\b",
            r"\bIELTS\b",
            r"\bINTERNATIONAL ENGLISH LANGUAGE TESTING SYSTEM\b",
            r"\bOVERALL BAND SCORE\b",
            r"\bCEFR LEVEL\b",
            r"\bBONAFIDE\s*CERTIFICATE\b",
            r"\bSCHOOL\s*LEAVING\s*CERTIFICATE\b",
            r"\bLEAVING\s*CERTIFICATE\b",
            r"\bNAME\s*OF\s*THE\s*PUPIL\b",
            r"\bCERTIFICATE\s*OF\s*PASSING\b",
            r"\bSTATEMENT OF MARKS\b",
        ],
    },
    {
        "category": "employment_records",
        "label": "Employment Records",
        "weight": 2.0,
        "filename_patterns": [
            r"\bEMPLOYMENT\b",
            r"\bJOB[_\s-]?OFFER\b",
            r"\bPAYSLIP\b",
            r"\bPAYSTUB\b",
            r"\bW-?2\b",
            r"\bRESUME\b",
            r"\bCV\b",
            r"\bCURRICULUM[_\s-]?VITAE\b",
            r"\bLMIA\b",
            r"\bCONTRACT\b",
            r"\bAPPOINTMENT\b",
            r"\bEXPERIENCE\b",
            r"\bSALARY\b",
            r"\bROE\b",
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
            r"\bLABOUR MARKET IMPACT ASSESSMENT\b",
            r"\bEMPLOYMENT AND SOCIAL DEVELOPMENT CANADA\b",
            r"\bGLOBAL TALENT STREAM\b",
            r"\bLMIA\s*#?\s*[0-9]{6,9}\b",
            r"\bFOREIGN WORKER NAMES\b",
            r"\bEMPLOYMENT CONTRACT\b",
            r"\bEI/IPLOYi/lENT CONTRACT\b",
            r"\bAPPOINTMENT\s*LETTER\b",
            r"\bEXPERIENCE\s*CERTIFICATE\b",
            r"\bEXPERIENCE\s*LETTER\b",
            r"\bRESIGNATION\s*LETTER\b",
            r"\bRELIEVING\s*LETTER\b",
            r"\bRECORD OF EMPLOYMENT\b",
            r"\bSERIAL NO\. OF ROE\b",
            r"\bINSURABLE EARNINGS\b",
            r"\bSTATEMENT OF REMUNERATION PAID\b",
            r"\bFORM W-2\b",
            r"\bPAYSTUB\b",
            r"\bPAYSLIP\b",
            r"\bWORKING\s*DAYS\b",
            r"\bNET\s*PAY\b",
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
            r"\bGIC\b",
            r"\bFEES?[_\s-]?RECEIPT\b",
            r"\bTUITION\b",
            r"\bASSESSMENT\b",
        ],
        "patterns": [
            r"\bBANK STATEMENT\b",
            r"\bBUSINESS ACCOUNT STATEMENT\b",
            r"\bACCOUNT STATEMENT\b",
            r"\bBALANCE CONFIRMATION\b",
            r"\bCERTIFY THE BALANCE\b",
            r"\bALLOTMENT OF TAX DEDUCTION ACCOUNT NUMBER\b",
            r"\bPROFESSION TAX DEPARTMENT\b",
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
            r"\bSTUDENT GIC PROGRAM\b",
            r"\bGUARANTEED INVESTMENT CERTIFICATE\b",
            r"\bINVESTMENT BALANCE CONFIRMATION\b",
            r"\bSCOTIA INVESTMENT ACCOUNT\b",
            r"\bINVESTMENT DIRECTIONS\b",
            r"\bSTUDENT PAYMENT RECEIPT\b",
            r"\bPAYMENT RECEIPT\b",
            r"\bPAYMENT ID\b",
            r"\bEFT FEE PAYMENT\b",
            r"\bACCOUNT SUMMARY BY TERM\b",
            r"\bNOTICE OF ASSESSMENT\b",
            r"\bCANADA REVENUE AGENCY\b",
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
            r"\bYOUR\s*TRAVELS\b",
            r"\bSUPPLEMENTARY\s*INFORMATION\s*[-–]?\s*YOUR\s*TRAVELS\b",
            r"\bTRAVEL INFORMATION\b",
            r"\bPURPOSE OF TRAVEL\b",
            r"\bPURPOSE OF VISIT\b",
            r"\bFOREMOST PURPOSE OF OUR INTENDED VISIT\b",
            r"\bBOARDING PASS\b",
            r"\bITINERARY SUMMARY\b",
            r"\bTRAVELPORT\b",
            r"\bVIEWTRIP\b",
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
            r"\bCONFIRMED BOOKING\b",
            r"\bPROPERTY POLICIES\b",
            r"\bSTAR HOTEL\b",
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
            r"\bPCC\b",
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
            r"\bPOLICE\s*CLEARANCE\s*CERTIF[I1T]CATE\b",
            r"\bPOLICE CERTIFICATE\b",
            r"\bCRIMINAL RECORD CHECK\b",
            r"\bNO CRIMINAL RECORD\b",
            r"\bGOOD CONDUCT CERTIFICATE\b",
            r"\bMEDICAL EXAMINATION\b",
            r"\bVACCINATION RECORD\b",
            r"\bVACCINATION DETAILS\b",
            r"\bCOVID-?19 VACCINATION\b",
            r"\bBENE(?:FI)?CIARY DETAILS\b",
            r"\bCIVIL SURGEON\b",
            r"\bREPORT OF MEDICAL EXAMINATION\b",
            r"\bDISCHARGE SUMMARY REPORT\b",
            r"\bOBGYN DISCHARGE SUMMARY\b",
            r"\bFORM I-693\b",
        ],
    },
    {
        "category": "government_correspondence",
        "label": "Government Forms and Correspondence",
        "weight": 2.0,
        "filename_patterns": [
            r"\bIMM\s*5257\b",
            r"\bIMM\s*5713\b",
            r"\bIMM\s*1295\b",
            r"\bIMM\s*5710\b",
            r"\bIMM\s*5708\b",
            r"\bIMM\s*5476\b",
            r"\bPROVINCIAL[_\s-]?ATTESTATION\b",
            r"\bPAL\b",
            r"\bREPRESENTATIVE\b",
            r"\bINVITATION\b",
            r"\bNOTICE[_\s-]?OF[_\s-]?ACTION\b",
            r"\bI-797\b",
            r"\bUSCIS\b",
        ],
        "patterns": [
            r"\bIMM\s*5257\b",
            r"\bIMM\s*1295\b",
            r"\bIMM\s*5710\b",
            r"\bIMM\s*5708\b",
            r"\bIMM\s*5709\b",
            r"\bIMM\s*5476\b",
            r"\bAPPLICATION FOR VISITOR VISA\b",
            r"\bTEMPORARY RESIDENT VISA\b",
            r"\bAPPLICATION FOR WORK PERMIT MADE OUTSIDE OF CANADA\b",
            r"\bAPPLICATION TO CHANGE CONDITIONS\b",
            r"\bPROVINCIAL ATTESTATION LETTER\b",
            r"\bLETTRES D'ATTESTATION PROVINCIALE\b",
            r"\bUSE OF A REPRESENTATIVE\b",
            r"\bIMMIGRATION,\s*REFUGEES\s*AND\s*CITIZENSHIP\s*CANADA\b",
            r"\bIMM\s*5713\b",
            r"\bUSE OF A FAMILY REPRESENTATIVE\b",
            r"\bINVITATION LETTER\b",
            r"\bLETTER OF INVITATION\b",
            r"\bSUBMISSION LETTER\b",
            r"\bREPRESENTATIVE FOR\b",
            r"\bCOLLEGE OF IMMIGRATION AND CITIZENSHIP CONSULTANTS\b",
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
            r"\bINDIA NON JUDICIAL\b",
            r"\bCERTIFICATE OF STAMP DUTY\b",
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

        # IRCC Form boost (IMM 5257, IMM 1295, IMM 5710, IMM 5708, IMM 5476, PAL)
        if category == "government_correspondence" and (
            re.search(r"\bIMM\s*(?:5257|1295|5710|5708|5709|5476)\b", combined)
            or "PROVINCIAL ATTESTATION LETTER" in combined
        ):
            filename_boost = max(filename_boost, 0.45)

        # Educational primary document header boost (prevents LOA / IELTS from losing to identity_passport due to DOB/Nationality labels)
        if (
            category == "educational_records"
            and "PROVINCIAL ATTESTATION LETTER" not in combined
            and "DEAR VISA OFFICER" not in combined
            and "CONSULATE GENERAL" not in combined
            and (
                "TEST REPORT FORM" in combined
                or "OVERALL BAND SCORE" in combined
                or "LETTER OF ACCEPTANCE" in combined
                or "OFFER OF ADMISSION" in combined
                or ("DESIGNATED LEARNING INSTITUTION" in combined and "REPRESENTATIVE FOR" not in combined)
                or "BONAFIDE CERTIFICATE" in combined
                or "BONAFIDECERTIFICATE" in combined
                or "SCHOOL LEAVING CERTIFICATE" in combined
                or "LEAVING CERTIFICATE" in combined
            )
        ):
            filename_boost = max(filename_boost, 0.45)

        # Employment primary document header boost (prevents LMIA / Employment Contract from losing to CRA/Identity)
        if category == "employment_records" and (
            "LABOUR MARKET IMPACT ASSESSMENT" in combined
            or "EMPLOYMENT CONTRACT" in combined
            or "EMPLOYMENTCONTRACT" in combined
            or "EI/IPLOYI/LENT CONTRACT" in combined
            or "RECORD OF EMPLOYMENT" in combined
            or "APPOINTMENT LETTER" in combined
            or "APPOINTMENTLETTER" in combined
        ):
            filename_boost = max(filename_boost, 0.45)

        # Financial GIC / Tuition Receipt primary header boost
        if category == "financial_evidence" and (
            "STUDENT GIC PROGRAM" in combined
            or "GUARANTEED INVESTMENT CERTIFICATE" in combined
            or "INVESTMENT BALANCE CONFIRMATION" in combined
            or "SCOTIA INVESTMENT ACCOUNT" in combined
            or "STUDENT PAYMENT RECEIPT" in combined
            or "PAYMENT RECEIPT" in combined
            or "PAYMENT ID" in combined
            or "ACCOUNT SUMMARY BY TERM" in combined
        ):
            filename_boost = max(filename_boost, 0.45)

        # Police Clearance Certificate primary header boost
        if category == "police_medical" and (
            "POLICE CLEARANCE CERTIFICATE" in combined
            or "POLICE CLEARANCE CERTIFTCATE" in combined
        ):
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


