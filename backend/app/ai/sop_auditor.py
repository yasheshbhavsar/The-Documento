"""Academic and Immigration Statement of Purpose (SOP) Evaluator

Evaluates student and visitor visa SOPs against statutory immigration standards:
- IRPA s.22(2) Dual Intent (Canada) / INA § 214(b) Nonimmigrant Intent (USA)
- Genuine Student Test (GST) / Study Rationale Progression
- Economic and Social Ties to Home Country
- Temporal Gaps Justification
- Financial Capability and Sponsor Alignment
"""
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
import re


@dataclass
class SOPFinding:
    dimension: str
    severity: str  # "critical", "warning", "info"
    issue_code: str
    title: str
    description: str
    remediation: str
    statutory_reference: Optional[str] = None


@dataclass
class SOPAuditResult:
    overall_score: float
    is_statutorily_sound: bool
    verdict: str  # "HIGH_APPROVAL_POTENTIAL", "NEEDS_REVISION", "CRITICAL_STATUTORY_DEFICIENCY"
    jurisdiction: str
    dimension_scores: Dict[str, float]
    strengths: List[str]
    findings: List[SOPFinding]
    remediation_summary: List[str]


class SOPAuditor:
    """Analyzes personal statements, study plans, and statements of purpose for visa petitions."""

    TIES_KEYWORDS = [
        "family", "parents", "father", "mother", "property", "land", "agricultural",
        "home country", "return to india", "return home", "india", "estate", "business",
        "ancestral", "commitments", "elderly", "ties", "permanent residence in india"
    ]

    PROGRESSION_KEYWORDS = [
        "bachelor", "master", "degree", "curriculum", "modules", "career", "skills",
        "research", "specialization", "industry", "advancement", "promotion", "knowledge"
    ]

    DUAL_INTENT_CA_KEYWORDS = [
        "temporary", "return upon completion", "authorized stay", "comply with irpa",
        "irpa", "leave canada", "duration of study", "temporary resident"
    ]

    GAP_KEYWORDS = [
        "gap", "during this period", "experience", "worked as", "employment",
        "upskilling", "certification", "preparation", "family responsibilities", "health"
    ]

    FINANCIAL_KEYWORDS = [
        "fund", "sponsor", "loan", "bank", "gic", "savings", "tuition",
        "living expenses", "financial support", "affidavit", "sanction"
    ]

    @classmethod
    def audit_statement(
        cls,
        sop_text: str,
        applicant_profile: Optional[Dict[str, Any]] = None,
        jurisdiction: str = "CA",
    ) -> SOPAuditResult:
        """Audits an applicant's SOP against statutory standards and produces actionable findings."""
        if not sop_text or len(sop_text.strip()) < 100:
            return SOPAuditResult(
                overall_score=0.0,
                is_statutorily_sound=False,
                verdict="CRITICAL_STATUTORY_DEFICIENCY",
                jurisdiction=jurisdiction,
                dimension_scores={
                    "academic_progression": 0.0,
                    "economic_home_ties": 0.0,
                    "dual_intent_compliance": 0.0,
                    "gap_justification": 0.0,
                    "financial_clarity": 0.0,
                },
                strengths=[],
                findings=[
                    SOPFinding(
                        dimension="completeness",
                        severity="critical",
                        issue_code="SOP_TEXT_INSUFFICIENT",
                        title="Statement of Purpose Insufficient or Missing",
                        description="The provided SOP text is absent or under the minimum analytical length (100 characters).",
                        remediation="Submit a complete statement of purpose detailing academic progression, rationale, ties, and finance.",
                    )
                ],
                remediation_summary=["Provide a comprehensive Statement of Purpose of at least 500-1000 words."],
            )

        text_lower = sop_text.lower()
        findings: List[SOPFinding] = []
        strengths: List[str] = []

        # 1. Academic Progression & Study Rationale
        prog_score = 100.0
        prog_hits = sum(1 for kw in cls.PROGRESSION_KEYWORDS if kw in text_lower)
        if prog_hits < 2:
            prog_score = 40.0
            findings.append(
                SOPFinding(
                    dimension="academic_progression",
                    severity="critical",
                    issue_code="WEAK_ACADEMIC_PROGRESSION",
                    title="Vague Academic Rationale & Curriculum Linkage",
                    description="The SOP does not articulate how the chosen program builds upon prior academic credentials or why local domestic alternatives are inadequate.",
                    remediation="Explicitly name specific course modules, labs, and faculty at the target institution, contrasting them with domestic options in home country.",
                    statutory_reference="IRCC OP 12 / INA § 101(a)(15)(F)",
                )
            )
        elif prog_hits >= 5:
            strengths.append("Clear articulation of academic curriculum progression and targeted skill acquisition.")

        # 2. Economic and Family Ties to Home Country
        ties_score = 100.0
        ties_hits = sum(1 for kw in cls.TIES_KEYWORDS if kw in text_lower)
        if ties_hits == 0:
            ties_score = 25.0
            findings.append(
                SOPFinding(
                    dimension="economic_home_ties",
                    severity="critical",
                    issue_code="INSUFFICIENT_HOME_TIES",
                    title="Absence of Corroborated Home Country Ties",
                    description="The statement does not provide affirmative evidence of continuing familial, economic, or property ties requiring departure at the end of authorized stay.",
                    remediation="Detail ancestral property, living immediate family, caregiving duties, and prospective job roles in home country upon return.",
                    statutory_reference="IRPA s. 220 / INA § 214(b)",
                )
            )
        elif ties_hits < 2:
            ties_score = 60.0
            findings.append(
                SOPFinding(
                    dimension="economic_home_ties",
                    severity="warning",
                    issue_code="MARGINAL_HOME_TIES",
                    title="Home Country Ties Lack Specificity",
                    description="References to returning home are generic without concrete employment projections or familial assets.",
                    remediation="Add market salary projections for the target role in your home city and reference property valuation certificates.",
                )
            )
        else:
            strengths.append("Strong references to home country family, property, and career opportunities.")

        # 3. Dual-Intent Compliance (IRPA s. 22(2) for Canada; INA § 214(b) for US)
        dual_score = 100.0
        if jurisdiction.upper() == "CA":
            # Canada allows dual intent under IRPA 22(2), but must respect temporary obligation
            has_leave_commitment = any(term in text_lower for term in ["leave canada", "temporary", "return to", "authorized stay"])
            if not has_leave_commitment:
                dual_score = 50.0
                findings.append(
                    SOPFinding(
                        dimension="dual_intent_compliance",
                        severity="warning",
                        issue_code="IRPA_22_2_COMPLIANCE_GAP",
                        title="Missing Affirmative Commitment to Respect Temporary Stay",
                        description="While IRPA s.22(2) permits dual intent, the visa officer must be satisfied the applicant will leave Canada if status expires.",
                        remediation="Insert an explicit closing covenant confirming intention to abide by temporary permit conditions and depart upon completion.",
                        statutory_reference="Immigration and Refugee Protection Act (IRPA) s. 22(2)",
                    )
                )
            else:
                strengths.append("Affirmative compliance with IRPA s.22(2) temporary stay conditions.")
        elif jurisdiction.upper() == "US":
            # Strict nonimmigrant intent required under INA 214(b)
            if "permanent residence" in text_lower or "green card" in text_lower or "immigrate" in text_lower:
                dual_score = 20.0
                findings.append(
                    SOPFinding(
                        dimension="dual_intent_compliance",
                        severity="critical",
                        issue_code="INA_214B_IMMIGRANT_INTENT",
                        title="Immigrant Intent Contradiction on Nonimmigrant F-1 Visa",
                        description="Explicit mention of permanent residency or long-term settlement directly triggers mandatory refusal under INA § 214(b).",
                        remediation="Remove all references to permanent residency. Reframe career goals around employment in home country.",
                        statutory_reference="Immigration and Nationality Act (INA) § 214(b)",
                    )
                )

        # 4. Study & Career Gap Justification
        gap_score = 100.0
        has_gap_declared = applicant_profile and bool(applicant_profile.get("has_study_gap", False))
        gap_hits = sum(1 for kw in cls.GAP_KEYWORDS if kw in text_lower)
        if has_gap_declared and gap_hits == 0:
            gap_score = 35.0
            findings.append(
                SOPFinding(
                    dimension="gap_justification",
                    severity="critical",
                    issue_code="UNEXPLAINED_STUDY_GAP",
                    title="Unexplained Temporal Gap in Academic/Employment History",
                    description="Applicant profile indicates a gap in studies/work exceeding 6 months that is unaddressed in the SOP narrative.",
                    remediation="Add a chronological paragraph accounting for every month of the gap (e.g., professional employment, exams, freelance projects).",
                    statutory_reference="IRCC Program Delivery Instructions / Visa Assessment Manual",
                )
            )
        elif gap_hits > 0:
            strengths.append("Chronological explanation provided for employment trajectory and study periods.")

        # 5. Financial Clarity & Sponsor Alignment
        fin_score = 100.0
        fin_hits = sum(1 for kw in cls.FINANCIAL_KEYWORDS if kw in text_lower)
        if fin_hits == 0:
            fin_score = 40.0
            findings.append(
                SOPFinding(
                    dimension="financial_clarity",
                    severity="warning",
                    issue_code="FINANCIAL_CAPABILITY_UNMENTIONED",
                    title="Absence of Financial Capability & Sponsor Details",
                    description="SOP does not mention how tuition and living costs will be funded (e.g., GIC, parent sponsor, education loan).",
                    remediation="State exact sponsorship arrangements: father/mother annual income, GIC certificate amount, and approved bank loan sanction.",
                    statutory_reference="IRPA Regulations s. 220",
                )
            )
        else:
            strengths.append("Sponsor funding mechanisms, GIC, and liquid asset references clearly stated.")

        # Calculate weighted overall score
        weights = {
            "academic_progression": 0.25,
            "economic_home_ties": 0.25,
            "dual_intent_compliance": 0.20,
            "gap_justification": 0.15,
            "financial_clarity": 0.15,
        }
        dim_scores = {
            "academic_progression": round(prog_score, 1),
            "economic_home_ties": round(ties_score, 1),
            "dual_intent_compliance": round(dual_score, 1),
            "gap_justification": round(gap_score, 1),
            "financial_clarity": round(fin_score, 1),
        }
        overall = sum(dim_scores[k] * weights[k] for k in weights)
        overall = round(max(0.0, min(100.0, overall)), 1)

        critical_count = sum(1 for f in findings if f.severity == "critical")
        if critical_count > 0 or overall < 60.0:
            verdict = "CRITICAL_STATUTORY_DEFICIENCY" if critical_count > 0 else "NEEDS_REVISION"
            is_sound = False
        elif overall >= 80.0:
            verdict = "HIGH_APPROVAL_POTENTIAL"
            is_sound = True
        else:
            verdict = "NEEDS_REVISION"
            is_sound = False

        remediation_summary = [f.remediation for f in findings]

        return SOPAuditResult(
            overall_score=overall,
            is_statutorily_sound=is_sound,
            verdict=verdict,
            jurisdiction=jurisdiction.upper(),
            dimension_scores=dim_scores,
            strengths=strengths,
            findings=findings,
            remediation_summary=remediation_summary,
        )
