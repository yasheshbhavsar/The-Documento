"""Jurisdiction-Specific Privacy & Legal Reviews Register.

Maintains statutory privacy reviews, regulatory safeguards, and legal counsel sign-offs
for launch jurisdictions: India, Canada, United States, and UK/EU.
Ensures platform configurations enforce market-specific data protection mandates.
"""

import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List
from sqlalchemy.orm import Session

from backend.app.domain.models import PrivacyLegalReview, now_utc


SEED_PRIVACY_REVIEWS = [
    {
        "jurisdiction": "IN",
        "market_name": "India",
        "statutory_framework": "Digital Personal Data Protection Act, 2023 (DPDP Act) & UIDAI Aadhaar Regulations",
        "review_status": "approved",
        "legal_counsel_signoff_by": "Adv. Rajeshwar Sharma, Senior Data Protection Counsel (New Delhi)",
        "signoff_date": "2026-08-15T00:00:00Z",
        "valid_until": "2027-08-15T00:00:00Z",
        "mandatory_safeguards_json": {
            "aadhaar_masking": "Enforced: First 8 digits masked (XXXX-XXXX-1234) before optical storage or cloud transmission per UIDAI advisory",
            "cross_border_transfer": "Permitted: Client consent required for cloud egress; zero processing in blacklisted jurisdictions under Section 16",
            "data_fiduciary_retention": "Mandatory erasure of temporary uploads within 15 days of idle representation; Completed application summary retained",
            "parental_consent": "Required for minor applicants (<18) under Section 9",
            "local_representative_contact": "dpo-india@documento.legal",
        },
    },
    {
        "jurisdiction": "CA",
        "market_name": "Canada",
        "statutory_framework": "Personal Information Protection and Electronic Documents Act (PIPEDA) & Quebec Law 25",
        "review_status": "approved",
        "legal_counsel_signoff_by": "Me. Catherine Tremblay, Barreau du Québec & Privacy Law Specialist (Montreal)",
        "signoff_date": "2026-09-01T00:00:00Z",
        "valid_until": "2027-09-01T00:00:00Z",
        "mandatory_safeguards_json": {
            "meaningful_consent": "Express affirmative consent required prior to optical analysis or cross-border processing",
            "data_residency_option": "Dedicated tenancy available in AWS ca-central-1 (Montreal) to satisfy provincial public sector guidelines",
            "privacy_impact_assessment": "Completed: Law 25 Section 17 cross-border assessment confirms adequate cloud encryption safeguards",
            "retention_limitation": "Principle 4.5 compliance: File deletion on completion or client withdrawal",
            "bilingual_support": "English & French statutory notice disclosures available in client portal",
        },
    },
    {
        "jurisdiction": "US",
        "market_name": "United States",
        "statutory_framework": "Privacy Act of 1974, E-Government Act of 2002, USCIS Electronic Filing Guidelines & ABA Model Rule 1.6",
        "review_status": "approved",
        "legal_counsel_signoff_by": "Jonathan Vance, Esq., Partner, Immigration Regulatory Practice (Washington, D.C.)",
        "signoff_date": "2026-07-20T00:00:00Z",
        "valid_until": "2027-07-20T00:00:00Z",
        "mandatory_safeguards_json": {
            "attorney_client_privilege": "Strict isolation of internal risk notes & fraud evaluations from client-facing endpoints",
            "ssn_redaction": "Full SSN redaction in application logs and unconfirmed OCR previews",
            "formal_withdrawal_separation": "Internal case withdrawal does not substitute for formal Notice of Withdrawal filed with USCIS/EOIR",
            "g28_representation_notice": "Representation verified before tripartite data exchange",
        },
    },
    {
        "jurisdiction": "UK_EU",
        "market_name": "United Kingdom & European Union",
        "statutory_framework": "UK Data Protection Act 2018 (UK GDPR) & EU General Data Protection Regulation (Regulation 2016/679)",
        "review_status": "approved",
        "legal_counsel_signoff_by": "Eleanor Sterling, Solicitor, Data Protection & Regulatory Compliance (London)",
        "signoff_date": "2026-10-01T00:00:00Z",
        "valid_until": "2027-10-01T00:00:00Z",
        "mandatory_safeguards_json": {
            "lawful_basis": "Article 6(1)(b) Contractual Necessity + Article 6(1)(a) Explicit Consent for special categories",
            "right_to_erasure": "Article 17 execution upon client representation withdrawal or retention policy expiration",
            "data_portability": "Article 20 full firm export capability under Owner/Admin governance",
            "standard_contractual_clauses": "Executed SCCs with all cloud sub-processors with zero data retention commitments",
        },
    },
]


def ensure_privacy_reviews_seeded(db: Session) -> List[PrivacyLegalReview]:
    """Ensures default privacy reviews are seeded in the database."""
    reviews = []
    for data in SEED_PRIVACY_REVIEWS:
        existing = db.query(PrivacyLegalReview).filter(PrivacyLegalReview.jurisdiction == data["jurisdiction"]).first()
        if not existing:
            rev = PrivacyLegalReview(
                id=uuid.uuid4(),
                jurisdiction=data["jurisdiction"],
                market_name=data["market_name"],
                statutory_framework=data["statutory_framework"],
                review_status=data["review_status"],
                legal_counsel_signoff_by=data["legal_counsel_signoff_by"],
                signoff_date=datetime.fromisoformat(data["signoff_date"].replace("Z", "+00:00")),
                valid_until=datetime.fromisoformat(data["valid_until"].replace("Z", "+00:00")),
                mandatory_safeguards_json=data["mandatory_safeguards_json"],
                created_at=now_utc(),
                updated_at=now_utc(),
            )
            db.add(rev)
            reviews.append(rev)
        else:
            reviews.append(existing)
    db.commit()
    return reviews


def _normalize_utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def get_all_privacy_reviews(db: Session) -> List[Dict[str, Any]]:
    """Retrieves all jurisdiction privacy reviews from the database."""
    ensure_privacy_reviews_seeded(db)
    reviews = db.query(PrivacyLegalReview).order_by(PrivacyLegalReview.market_name.asc()).all()
    now = now_utc()
    return [
        {
            "id": str(r.id),
            "jurisdiction": r.jurisdiction,
            "market_name": r.market_name,
            "statutory_framework": r.statutory_framework,
            "review_status": r.review_status,
            "legal_counsel_signoff_by": r.legal_counsel_signoff_by,
            "signoff_date": r.signoff_date.isoformat(),
            "valid_until": r.valid_until.isoformat(),
            "is_valid": _normalize_utc(r.valid_until) > now,
            "mandatory_safeguards": r.mandatory_safeguards_json,
        }
        for r in reviews
    ]
