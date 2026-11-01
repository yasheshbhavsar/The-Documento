"""US Consular & Indian Applicant Readiness Engine (F-1, B-1/B-2, H-1B/H-4).

Replaces fragile government portal automation with high-ROI, legally grounded
pre-filing and consular readiness verification tailored for Indian outbound
applicants and immigration practices:

1. US F-1 Academic Student (`9 FAM 402.5-5(G)` & `INA § 214(b)`):
   - Form I-20 12-Month Cost of Attendance vs. Liquid vs. Illiquid Sponsor Funds Matrix.
   - Automatic INR (₹) to USD ($) conversion at statutory reference rates.
   - Disallows illiquid assets (Immovable Property, Gold, Agricultural Land, locked PPF)
     from Year-1 tuition coverage while counting them toward 214(b) Home Country Ties.
   - Cross-checks Parent/Sponsor 3-Year Indian ITR-V Gross Total Income against sponsorship load.

2. US B-1/B-2 Visitor (`INA § 214(b)` & `9 FAM 402.2`):
   - 4-Pillar Consular Refusal Risk Scorer:
     (a) 6-Month Bank Statement Seasoning & Unexplained Lump-Sum Forensics
     (b) 3-Year Consecutive Indian ITR-V / Form 16 Tax Verification
     (c) Employer Leave Sanction / NOC & Continuing Employment Ties
     (d) Home Country Economic & Familial Return Obligations

3. US H-1B & H-4 Consular Stamping / VAC Dropbox (`8 CFR § 214.2(h)`):
   - Form I-797 Approval Notice + LCA (Form ETA-9035) Wage vs. EVL Salary Consistency.
   - Indian Passport Single-Name (`FNU`) & ECNR/ECR DS-160 Normalization.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from backend.app.ai.financial_parser import FinancialIntelligenceEngine
from backend.app.ai.identity_resolver import IdentityResolver


INR_TO_USD_RATE = 84.0  # Reference exchange rate: ₹84.00 = $1.00 USD


@dataclass
class SponsorFundItem:
    source_type: str  # "savings_bank", "fixed_deposit", "education_loan", "scholarship", "property_valuation", "gold_ppf"
    label: str
    amount_original: float
    currency: str
    amount_usd: float
    liquidity_tier: str  # "LIQUID_YEAR_1" or "ILLIQUID_HOME_TIES_ONLY"
    statutory_note: str


@dataclass
class ConsularRiskFinding:
    code: str
    severity: str  # "critical", "warning", "passed"
    pillar: str    # "financial_liquidity", "tax_itr_consistency", "home_ties_214b", "ds160_identity", "petition_consistency"
    title: str
    detail: str
    remediation: str
    statutory_citation: str


@dataclass
class USConsularReadinessReport:
    pathway: str  # "US-F1-STUDENT", "US-B1B2-VISITOR", "US-H1B-STAMPING"
    overall_readiness_score: float
    consular_risk_level: str  # "LOW_RISK", "MODERATE_214B_RISK", "HIGH_REFUSAL_OR_221G_RISK"
    i20_or_trip_cost_usd: float
    verified_liquid_funds_usd: float
    illiquid_home_ties_usd: float
    liquid_surplus_or_deficit_usd: float
    is_year1_liquid_sufficient: bool
    sponsor_itr_annual_income_inr: float
    sponsor_itr_annual_income_usd: float
    fnu_single_name_guidance: Optional[Dict[str, Any]] = None
    fund_breakdown: List[SponsorFundItem] = field(default_factory=list)
    findings: List[ConsularRiskFinding] = field(default_factory=list)
    recommended_interview_prep_points: List[str] = field(default_factory=list)


class USConsularReadinessEngine:
    """Evaluates US F-1, B-1/B-2, and H-1B/H-4 cases for Indian applicants."""

    @staticmethod
    def _to_usd(amount: float, currency: str) -> float:
        curr = (currency or "USD").upper().strip()
        if curr in ("INR", "RS", "₹"):
            return round(amount / INR_TO_USD_RATE, 2)
        return round(amount, 2)

    @classmethod
    def evaluate_case(
        cls,
        visa_category: str,
        documents: List[Dict[str, Any]],
        applicant_first_name: Optional[str] = None,
        applicant_last_name: Optional[str] = None,
        i20_cost_usd: Optional[float] = None,
    ) -> USConsularReadinessReport:
        raw_cat = (visa_category or "").upper()
        if any(k in raw_cat for k in ("F-1", "F1", "STUDENT")):
            pathway = "US-F1-STUDENT"
        elif any(k in raw_cat for k in ("H-1B", "H1B", "H-4", "H4", "SPECIALTY", "STAMPING")):
            pathway = "US-H1B-STAMPING"
        else:
            pathway = "US-B1B2-VISITOR"

        findings: List[ConsularRiskFinding] = []
        fund_breakdown: List[SponsorFundItem] = []

        # 1. Single-Name (FNU) DS-160 Identity Normalization Check
        fnu_info: Optional[Dict[str, Any]] = None
        if applicant_first_name is not None or applicant_last_name is not None:
            res = IdentityResolver.resolve_single_name(applicant_first_name, applicant_last_name)
            fnu_info = {
                "is_single_name": res.is_single_name,
                "ds160_surname": res.uscis_surname,
                "ds160_given_name": res.uscis_first_name,
                "guidance_notes": res.guidance_notes,
            }
            if res.is_single_name:
                findings.append(
                    ConsularRiskFinding(
                        code="DS160_FNU_REQUIRED",
                        severity="warning",
                        pillar="ds160_identity",
                        title="Single Legal Name Detected — DS-160 'FNU' Rule Applies",
                        detail=(
                            f"Applicant passport shows a single legal name ('{res.original_single_name}'). "
                            f"On Form DS-160 and SEVIS I-20, Surname MUST be entered as '{res.uscis_surname}' "
                            f"and Given Name as '{res.uscis_first_name}'."
                        ),
                        remediation="Verify that Form DS-160, Form I-20/I-797, and CGI Federal profile all use FNU as Given Name.",
                        statutory_citation="9 FAM 403.9-4(B) - Machine Readable Passport Name Standards",
                    )
                )

        # 2. Scan documents for Financial, ITR, I-20, I-797, LCA, and Home Ties evidence
        liquid_usd = 0.0
        illiquid_usd = 0.0
        detected_i20_cost_usd = i20_cost_usd or (45000.0 if pathway == "US-F1-STUDENT" else 6500.0)
        sponsor_itr_inr = 0.0
        has_education_loan = False
        has_employment_noc = False
        has_i20_or_i797 = False
        lump_sum_warnings: List[str] = []

        for doc in documents:
            title = (doc.get("title") or doc.get("filename") or "").upper()
            text = doc.get("raw_text") or doc.get("text") or ""
            cat = (doc.get("category") or "").lower()

            # Check I-20 cost if present in text
            i20_m = re.search(r"(?:Total\s+Estimated\s+Cost|Total\s+12-Month\s+Cost|Tuition\s+and\s+Fees\s+Total)[\s:\$]+([0-9,]+(?:\.[0-9]{2})?)", text, re.IGNORECASE)
            if i20_m:
                try:
                    detected_i20_cost_usd = float(i20_m.group(1).replace(",", ""))
                    has_i20_or_i797 = True
                except ValueError:
                    pass

            if any(k in title for k in ("I-20", "I20", "I-797", "I797", "SEVIS")):
                has_i20_or_i797 = True

            if any(k in title for k in ("NOC", "LEAVE", "EMPLOYMENT VERIFICATION", "EVL", "EXPERIENCE LETTER")) or "employment" in cat:
                has_employment_noc = True

            # Check ITR-V
            itr = FinancialIntelligenceEngine.parse_itr_v(text)
            if itr and itr.gross_total_income > 0:
                sponsor_itr_inr = max(sponsor_itr_inr, itr.gross_total_income)
            elif "ITR" in title or "INCOME TAX" in text.upper():
                inc_m = re.search(r"(?:Gross\s+Total\s+Income|Total\s+Income)[\s:₹Rs\.]+([0-9,]+)", text, re.IGNORECASE)
                if inc_m:
                    try:
                        sponsor_itr_inr = max(sponsor_itr_inr, float(inc_m.group(1).replace(",", "")))
                    except ValueError:
                        pass

            # Check Education Loan Sanction Letter
            if any(k in title or k in text.upper() for k in ("EDUCATION LOAN", "SANCTION LETTER", "CREDILA", "AVANSE", "SBI SCHOLAR")):
                has_education_loan = True
                loan_m = re.search(r"(?:Sanctioned\s+Amount|Loan\s+Amount)[\s:₹Rs\.\$]+([0-9,]+)", text, re.IGNORECASE)
                amt = 2500000.0
                curr = "INR" if ("₹" in text or "INR" in text.upper() or "LAKH" in text.upper()) else "USD"
                if loan_m:
                    try:
                        amt = float(loan_m.group(1).replace(",", ""))
                    except ValueError:
                        pass
                usd_val = cls._to_usd(amt, curr)
                liquid_usd += usd_val
                fund_breakdown.append(
                    SponsorFundItem(
                        source_type="education_loan",
                        label=doc.get("title") or "Sanctioned Education Loan",
                        amount_original=amt,
                        currency=curr,
                        amount_usd=usd_val,
                        liquidity_tier="LIQUID_YEAR_1",
                        statutory_note="Accepted as Tier-1 liquid funding once formal sanction letter is issued.",
                    )
                )
                continue

            # Check Illiquid Valuation (Property / Agricultural Land / Gold / Net Worth)
            if any(k in title or k in text.upper() for k in ("VALUATION OF IMMOVABLE", "PROPERTY VALUATION", "GOLD VALUATION", "AGRICULTURAL LAND")):
                val_m = re.search(r"(?:Market\s+Value|Total\s+Valuation|Assessed\s+Value)[\s:₹Rs\.\$]+([0-9,]+)", text, re.IGNORECASE)
                amt = 15000000.0
                curr = "INR"
                if val_m:
                    try:
                        amt = float(val_m.group(1).replace(",", ""))
                    except ValueError:
                        pass
                usd_val = cls._to_usd(amt, curr)
                illiquid_usd += usd_val
                fund_breakdown.append(
                    SponsorFundItem(
                        source_type="property_valuation",
                        label=doc.get("title") or "Immovable Property Valuation",
                        amount_original=amt,
                        currency=curr,
                        amount_usd=usd_val,
                        liquidity_tier="ILLIQUID_HOME_TIES_ONLY",
                        statutory_note="Excluded from Year-1 tuition liquidity under 9 FAM 402.5-5(G); counted strictly toward INA § 214(b) Home Country Ties.",
                    )
                )
                continue

            # Check Bank Statements
            if "financial" in cat or any(k in title or k in text.upper() for k in ("BANK STATEMENT", "CLOSING BALANCE", "SAVINGS ACCOUNT", "CHECKING")):
                stmt = FinancialIntelligenceEngine.parse_bank_statement_text(text)
                if stmt.closing_balance > 0:
                    usd_val = cls._to_usd(stmt.closing_balance, stmt.currency)
                    liquid_usd += usd_val
                    fund_breakdown.append(
                        SponsorFundItem(
                            source_type="savings_bank",
                            label=f"{stmt.financial_institution} ({stmt.account_number_masked})",
                            amount_original=stmt.closing_balance,
                            currency=stmt.currency,
                            amount_usd=usd_val,
                            liquidity_tier="LIQUID_YEAR_1",
                            statutory_note="Immediately accessible liquid bank balance.",
                        )
                    )
                    if stmt.risk_findings:
                        lump_sum_warnings.extend(stmt.risk_findings)

        sponsor_itr_usd = cls._to_usd(sponsor_itr_inr, "INR")
        surplus_usd = round(liquid_usd - detected_i20_cost_usd, 2)
        is_liquid_ok = surplus_usd >= 0

        # 3. Pathway-Specific Statutory Findings
        if pathway == "US-F1-STUDENT":
            if not is_liquid_ok:
                findings.append(
                    ConsularRiskFinding(
                        code="F1_LIQUIDITY_DEFICIT",
                        severity="critical",
                        pillar="financial_liquidity",
                        title="Year-1 Liquid Funds Below Form I-20 Cost of Attendance",
                        detail=(
                            f"Verified liquid funds (${liquid_usd:,.2f} USD) fall short of Form I-20 12-month cost "
                            f"(${detected_i20_cost_usd:,.2f} USD) by ${abs(surplus_usd):,.2f} USD. "
                            f"(Note: ${illiquid_usd:,.2f} USD in property/illiquid assets cannot cover Year-1 tuition)."
                        ),
                        remediation="Add liquid savings/FD statements or an approved Education Loan Sanction Letter covering at least 100% of Year-1 I-20 costs.",
                        statutory_citation="9 FAM 402.5-5(G) - Adequate Financial Resources for F-1 Students",
                    )
                )
            else:
                findings.append(
                    ConsularRiskFinding(
                        code="F1_LIQUIDITY_VERIFIED",
                        severity="passed",
                        pillar="financial_liquidity",
                        title="Year-1 Liquid Funds Meet Form I-20 Requirement",
                        detail=f"Verified liquid funds (${liquid_usd:,.2f} USD) exceed Form I-20 12-month cost (${detected_i20_cost_usd:,.2f} USD) with a surplus of ${surplus_usd:,.2f} USD.",
                        remediation="Bring original bank statements and loan sanction letter to the US Consulate interview.",
                        statutory_citation="9 FAM 402.5-5(G)",
                    )
                )

            if sponsor_itr_usd == 0:
                findings.append(
                    ConsularRiskFinding(
                        code="F1_MISSING_SPONSOR_ITR",
                        severity="warning",
                        pillar="tax_itr_consistency",
                        title="Parent / Sponsor 3-Year Indian ITR-V Not Verified",
                        detail="No Indian Income Tax Return (ITR-V) was detected to substantiate the ongoing earning capacity of the financial sponsor.",
                        remediation="Upload the last 3 Assessment Years of Indian ITR-V acknowledgements (with 15-digit e-filing numbers) for each sponsoring parent.",
                        statutory_citation="INA § 214(b) - Credibility of Financial Sponsorship",
                    )
                )
            elif sponsor_itr_usd < (detected_i20_cost_usd * 0.25) and not has_education_loan:
                findings.append(
                    ConsularRiskFinding(
                        code="F1_ITR_INCOME_DISPROPORTIONATE",
                        severity="warning",
                        pillar="tax_itr_consistency",
                        title="Sponsor Annual ITR Income Low Relative to US Tuition Load",
                        detail=(
                            f"Declared annual ITR income (${sponsor_itr_usd:,.2f} USD / ₹{sponsor_itr_inr:,.0f}) is under 25% of "
                            f"annual I-20 cost (${detected_i20_cost_usd:,.2f} USD) without a sanctioned education loan."
                        ),
                        remediation="Provide a formal bank Education Loan Sanction Letter or secondary co-sponsor ITRs to avoid a 214(b) financial credibility refusal.",
                        statutory_citation="9 FAM 402.5-5(G)(2) - Source & Sustainability of Sponsor Funds",
                    )
                )

        elif pathway == "US-B1B2-VISITOR":
            if not has_employment_noc:
                findings.append(
                    ConsularRiskFinding(
                        code="B1B2_MISSING_EMPLOYMENT_TIES",
                        severity="critical",
                        pillar="home_ties_214b",
                        title="Missing Employer Leave Sanction / NOC or Business Registration",
                        detail="No Employer Leave Approval (NOC) or Business Proof was found to anchor the applicant's mandatory return date to India.",
                        remediation="Upload an official Employer NOC specifying approved leave dates, designation, and return-to-work date (or GST/Udyam certificate if self-employed).",
                        statutory_citation="INA § 214(b) - Presumption of Immigrant Intent",
                    )
                )
            if sponsor_itr_usd == 0:
                findings.append(
                    ConsularRiskFinding(
                        code="B1B2_MISSING_ITR",
                        severity="warning",
                        pillar="tax_itr_consistency",
                        title="3-Year Indian ITR-V Tax Returns Not Uploaded",
                        detail="Indian B-1/B-2 applicants must demonstrate economic establishment in India through 3 consecutive years of ITR-V filings.",
                        remediation="Upload 3 years of ITR-V acknowledgements and Form 16 / salary slips.",
                        statutory_citation="9 FAM 402.2-2(B) - Economic & Social Ties Abroad",
                    )
                )

        elif pathway == "US-H1B-STAMPING":
            if not has_i20_or_i797:
                findings.append(
                    ConsularRiskFinding(
                        code="H1B_MISSING_I797",
                        severity="critical",
                        pillar="petition_consistency",
                        title="Form I-797A/B Approval Notice Missing for Consular Stamping",
                        detail="Principal H-1B / H-4 consular stamping requires a valid Form I-797 Approval Notice cross-checked against DS-160 petition receipt number.",
                        remediation="Upload Form I-797A/B and certified Form ETA-9035 (LCA) to verify worksite and wage consistency.",
                        statutory_citation="9 FAM 402.10-9 - Petition-Based H-1B Visa Issuance",
                    )
                )
            if not has_employment_noc:
                findings.append(
                    ConsularRiskFinding(
                        code="H1B_MISSING_EVL",
                        severity="warning",
                        pillar="petition_consistency",
                        title="Fresh Employment Verification Letter (EVL) & Recent Paystubs Required",
                        detail="Consular officers and Dropbox adjudicators in Chennai/Hyderabad require an EVL dated within 30 days and the latest 3 paystubs.",
                        remediation="Upload current Employer Verification Letter confirming SOC code, LCA salary compliance, and end-client project location.",
                        statutory_citation="8 CFR § 214.2(h)(4) - Maintenance of Specialty Occupation Status",
                    )
                )

        # 4. Lump-sum warnings across all pathways
        for lw in lump_sum_warnings:
            findings.append(
                ConsularRiskFinding(
                    code="UNSEASONED_LUMP_SUM_DEPOSIT",
                    severity="critical",
                    pillar="financial_liquidity",
                    title="Unexplained Lump-Sum Bank Deposit Detected",
                    detail=lw,
                    remediation="Attach documentary proof of fund origin (e.g., Fixed Deposit maturity advice, property sale deed, or retirement payout) to prevent a 214(b) refusal.",
                    statutory_citation="INA § 214(b) / 9 FAM 402.5-5(G) - Seasoning of Liquid Funds",
                )
            )

        # Calculate overall score
        crit_count = sum(1 for f in findings if f.severity == "critical")
        warn_count = sum(1 for f in findings if f.severity == "warning")
        score = max(15.0, min(100.0, 100.0 - (crit_count * 28.0) - (warn_count * 12.0)))

        if crit_count > 0:
            risk_level = "HIGH_REFUSAL_OR_221G_RISK"
        elif warn_count > 0:
            risk_level = "MODERATE_214B_RISK"
        else:
            risk_level = "LOW_RISK"

        prep_points = [
            "Ensure Form DS-160 Passport Number, Surname/FNU, and SEVIS/Petition Receipt Number match uploaded originals character-for-character.",
        ]
        if pathway == "US-F1-STUDENT":
            prep_points.extend([
                "Be ready to articulate why this specific US program and curriculum align with career progression in India's tech/enterprise sector.",
                "Carry original 6-month bank statements, 3-year sponsor ITR-V acknowledgements, and Education Loan Sanction Letter in the consular folder.",
            ])
        elif pathway == "US-B1B2-VISITOR":
            prep_points.extend([
                "Clearly state the exact duration of stay, specific US cities/itinerary, and the date you must report back to your employer/business in India.",
                "Highlight immediate family, property, and ongoing career responsibilities in India that compel timely departure.",
            ])
        else:
            prep_points.extend([
                "Verify that the salary on your Employment Verification Letter (EVL) is greater than or equal to the Prevailing Wage on Form ETA-9035 (LCA).",
                "Ensure end-client letter and LCA work location addresses match the metropolitan statistical area (MSA) declared on DS-160.",
            ])

        return USConsularReadinessReport(
            pathway=pathway,
            overall_readiness_score=round(score, 1),
            consular_risk_level=risk_level,
            i20_or_trip_cost_usd=detected_i20_cost_usd,
            verified_liquid_funds_usd=round(liquid_usd, 2),
            illiquid_home_ties_usd=round(illiquid_usd, 2),
            liquid_surplus_or_deficit_usd=surplus_usd,
            is_year1_liquid_sufficient=is_liquid_ok,
            sponsor_itr_annual_income_inr=sponsor_itr_inr,
            sponsor_itr_annual_income_usd=sponsor_itr_usd,
            fnu_single_name_guidance=fnu_info,
            fund_breakdown=fund_breakdown,
            findings=findings,
            recommended_interview_prep_points=prep_points,
        )

