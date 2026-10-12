# Pilot Source Note: United States EB-1A Extraordinary Ability

## Statutory & Regulatory Authority
- **Primary Statute**: Immigration and Nationality Act (INA) § 203(b)(1)(A), 8 U.S.C. § 1153(b)(1)(A).
- **Federal Regulations**: 8 Code of Federal Regulations (CFR) § 204.5(h) - *Aliens of extraordinary ability*.
- **Administrative Guidance**: USCIS Policy Manual, Volume 6 (Immigrants), Part F (Employment-Based Classifications), Chapter 2 (Extraordinary Ability).
- **Adjudicative Standard**: *Kazarian v. USCIS*, 596 F.3d 1115 (9th Cir. 2010) (Two-part adjudicative framework: regulatory threshold criteria + final merits determination).

---

## Official Government Sources

| Source Entity | Official URL | Scope & Limitations | Retrieved Timestamp | Baseline Hash (SHA-256) |
|---|---|---|---|---|
| **USCIS Policy Manual** | `https://www.uscis.gov/policy-manual/volume-6-part-f-chapter-2` | Covers employment-based first preference extraordinary ability adjudication criteria and evidence standards. Does not cover O-1A nonimmigrant standards. | 2026-10-11T12:00:00Z | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855...` |
| **Electronic Code of Federal Regulations (eCFR)** | `https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-204/subpart-A/section-204.5` | Title 8 § 204.5(h) evidentiary requirements for extraordinary ability petition. Authoritative regulatory text. | 2026-10-11T12:00:00Z | Verified |
| **USCIS Form I-140 Instructions** | `https://www.uscis.gov/i-140` | Filing fee, jurisdiction, required forms, and procedural instructions for Immigrant Petition for Alien Workers. | 2026-10-11T12:00:00Z | Verified |

---

## Evidence Mapping & Validation Expressions

| Requirement Code | Statutory Basis | Accepted Evidence Types | Declarative Validation Expression | Human Review Required |
|---|---|---|---|---|
| `EB1A-MAND-ID` | 8 CFR § 204.5(a) | `identity_document`, `passport` | `doc.is_expired == False and doc.is_biographical_verified == True` | No |
| `EB1A-MAND-INTENT` | INA § 203(b)(1)(A)(ii); 8 CFR § 204.5(h)(5) | `statement_of_intent`, `employment_offer`, `business_plan` | `doc.pages_count >= 1 and doc.is_signed == True` | Yes |
| `EB1A-MAND-BENEFIT` | INA § 203(b)(1)(A)(iii) | `expert_opinion_letter`, `impact_statement` | `doc.pages_count >= 2` | Yes |
| `EB1A-CRIT-AWARDS` | 8 CFR § 204.5(h)(3)(i) | `award_certificate`, `prize_documentation`, `judging_criteria` | `doc.award_scope in ["national", "international"]` | Yes |
| `EB1A-CRIT-MEMBERSHIP` | 8 CFR § 204.5(h)(3)(ii) | `membership_certificate`, `association_bylaws` | `doc.requires_outstanding_achievement == True` | Yes |
| `EB1A-CRIT-MEDIA` | 8 CFR § 204.5(h)(3)(iii) | `news_article`, `media_report`, `circulation_evidence` | `doc.is_major_media == True and doc.published_date is not None` | Yes |
| `EB1A-CRIT-JUDGING` | 8 CFR § 204.5(h)(3)(iv) | `peer_review_record`, `editorial_board_letter`, `grant_review_invitation` | `doc.reviews_completed_count >= 1` | Yes |
| `EB1A-CRIT-ORIGINAL` | 8 CFR § 204.5(h)(3)(v) | `expert_testimonial`, `patent_citation_analysis`, `commercial_license` | `doc.significance_level in ["major", "groundbreaking"]` | Yes |
| `EB1A-CRIT-SCHOLARLY` | 8 CFR § 204.5(h)(3)(vi) | `journal_article`, `citation_report`, `conference_proceedings` | `doc.citation_count >= 10 or doc.is_peer_reviewed == True` | Yes |
| `EB1A-CRIT-EXHIBITION` | 8 CFR § 204.5(h)(3)(vii) | `exhibition_catalog`, `gallery_contract`, `venue_receipt` | `doc.venue_reputation in ["distinguished", "international"]` | Yes |
| `EB1A-CRIT-CRITICAL-ROLE` | 8 CFR § 204.5(h)(3)(viii) | `organization_chart`, `executive_letter`, `reputation_documentation` | `doc.organization_reputation in ["distinguished", "major"]` | Yes |
| `EB1A-CRIT-HIGH-SALARY` | 8 CFR § 204.5(h)(3)(ix) | `w2_form`, `tax_return`, `compensation_survey` | `doc.salary_percentile >= 90 or doc.annual_compensation >= 200000` | Yes |

---

## Review Cadence & Regression Protocol
1. **Quarterly Review**: Review USCIS Policy Alerts and Federal Register updates every 90 days.
2. **Snapshot Ingestion**: Fetch URL content, generate SHA-256 digest, and run side-by-side snapshot diff against current baseline.
3. **Regression Test Suite**: Run `test_eb1a_pilot_full_evaluation` before transitioning any new rule set version from `under_review` to `validated`.
4. **Approval Gate**: Attorney with license verification must approve publication (`approved_by != author_id`).
5. **Open Case Queuing**: Automatic scanning identifies active EB-1A cases and queues review tasks without silent re-adjudication.
