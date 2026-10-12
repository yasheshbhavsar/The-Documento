# Phase 6 — Immigration Rules, Official Sources, and Requirement Engine

## Overview

Phase 6 delivers a configurable, versioned immigration rules and statutory requirements subsystem. It establishes an authoritative legal provenance framework, a safe declarative requirement evaluation engine, a strict lifecycle governance workflow, and an official source registry.

Crucially, **no immigration rules are hardcoded into frontend components**, and **no arbitrary Python code is ever executed from database fields**. All statutory logic is expressed in constrained, declarative AST syntax evaluated in a secure sandbox.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PHASE 6 RULES & REQUIREMENTS SYSTEM                    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
       ┌───────────────────────────────┼───────────────────────────────┐
       ▼                               ▼                               ▼
┌────────────────────────────┐   ┌───────────────────────────┐   ┌────────────────────────────┐
│ Official Source Registry   │   │ Rule Version Lifecycle    │   │ Safe Declarative Evaluator │
│ • USCIS, DOS, IRCC, UKVI   │   │ • State Machine: Draft to │   │ • Bounded Python AST       │
│ • DHA, INZ, BAMF, EU, MVD  │   │   Published / Suspended   │   │ • Zero Arbitrary Exec      │
│ • Snapshots & SHA-256 Hash │   │ • Separation of Duties    │   │ • Whitelisted Safe Ops     │
│ • Visual Side-by-Side Diff │   │ • Regression Suites       │   │ • 7 Distinct Statuses      │
└──────────────┬─────────────┘   └─────────────┬─────────────┘   └─────────────┬──────────────┘
               │                               │                               │
               └───────────────────────────────┼───────────────────────────────┘
                                               │
                                               ▼
                              ┌───────────────────────────────────┐
                              │ Requirement Engine                │
                              │ • Evidence Type Matching          │
                              │ • Expiration & Quality Checks     │
                              │ • Prerequisite Tree & Blocking    │
                              │ • Human Review Adjudication       │
                              └─────────────────┬─────────────────┘
                                                │
                                                ▼
                              ┌───────────────────────────────────┐
                              │ Case Evaluation & Impact Queue    │
                              │ • Version-Stamped Evaluations     │
                              │ • Historical Immutability         │
                              │ • Affected Open Cases Detector    │
                              │ • Automated CaseTask Queuing      │
                              └───────────────────────────────────┘
```

---

## A. Rule Data Model & Domain Schema

The database model is defined in `backend/app/domain/models.py` and provisioned via Alembic migration `b2c3d4e5f6a7_phase6_rules_sources_requirements.py`:

### 1. `OfficialSource` (`official_sources` table)
- `id` (UUID PK): Unique identifier.
- `jurisdiction`: ISO-2 country code (`US`, `CA`, `GB`, `AU`, `NZ`, `DE`, `RU`, `EU`).
- `authority`: Responsible agency (e.g., `USCIS`, `Department of State`, `IRCC`, `UKVI`, `DHA`, `BAMF`).
- `name` & `official_url`: Canonical title and verified government URL.
- `scope_limitations`: Explicit statement of source scope (e.g., *"Covers INA § 203(b)(1)(A) EB-1A extraordinary ability only; does not cover O-1A nonimmigrant standard"*).
- `update_cadence`: Anticipated regulatory check frequency (`monthly`, `quarterly`, `ad-hoc`).
- `is_active`: Status flag.

### 2. `SourceSnapshot` (`source_snapshots` table)
- `id` (UUID PK): Snapshot record.
- `source_id` (UUID FK): Parent official source.
- `retrieval_timestamp`: ISO-8601 UTC timestamp of retrieval.
- `publication_date`: Official publication date from government gazette or federal register.
- `effective_date`: Date the statutory or policy change takes effect.
- `content_hash`: SHA-256 digest of source content for cryptographically verifiable tamper-proofing.
- `content_text`: Verbatim regulatory text or policy manual guidance.
- `summary_of_changes`: Caseworker notes on regulatory differences from prior snapshot.
- `retrieved_by`: Identity of the legal specialist who captured the snapshot.

### 3. `RuleSet` (`rule_sets` table)
- `id` (UUID PK): Container entity.
- `country`: Two-letter country code.
- `jurisdiction`: Jurisdiction scope (e.g., `US-Federal`, `CA-Federal`).
- `authority`: Primary governing authority (`USCIS`).
- `program`: Immigration category (`Employment-Based First Preference`).
- `pathway`: Specific visa pathway (`EB-1A Extraordinary Ability`).
- `code`: Unique statutory identifier (e.g., `US-USCIS-EB1A`).

### 4. `RuleSetVersion` (`rule_set_versions` table)
- `id` (UUID PK): Versioned snapshot.
- `rule_set_id` (UUID FK): Parent rule set.
- `version_number`: Semantic version string (`1.0.0`, `1.1.0`).
- `status`: Lifecycle stage (`draft`, `under_review`, `validated`, `published`, `superseded`, `suspended`).
- `publication_date` & `effective_date`: Operational dates.
- `changelog`: Summary of requirement adjustments.
- `author_id`: Legal specialist drafting the version.
- `reviewed_by`: Independent reviewer who validated regression tests.
- `approved_by`: Authorized attorney who authorized publication (**Separation of Duty enforced: `approved_by != author_id`**).

### 5. `RuleRequirement` (`rule_requirements` table)
- `id` (UUID PK): Requirement node.
- `rule_set_version_id` (UUID FK): Linked version.
- `code`: Stable statutory identifier (`EB1A-EVID-AWARDS`, `EB1A-MAND-ID`).
- `title` & `description`: Plain-language explanation of statutory mandate.
- `statutory_citation`: Legal basis (e.g., `INA § 203(b)(1)(A)(i); 8 CFR § 204.5(h)(3)(i)`).
- `is_mandatory`: Whether this is an absolute statutory prerequisite.
- `order_index`: Display and evaluation sequence.
- `applicability_expression`: Declarative condition governing whether requirement applies.
- `accepted_evidence_types` (JSON): Allowed document categories (`["identity_document", "passport"]`).
- `validation_expression`: Declarative condition evaluating document fields and case metadata.
- `requires_human_review`: Boolean indicating whether legal specialist adjudication is mandatory.
- `review_instructions`: Guidance for caseworker review.
- `prerequisite_codes` (JSON): Array of prerequisite requirement codes (e.g., `["EB1A-MAND-ID"]`).

### 6. `CaseRequirementEvaluation` (`case_requirement_evaluations` table)
- `id` (UUID PK): Evaluation audit record.
- `case_id` (UUID FK): Immigration case evaluated.
- `rule_set_version_id` (UUID FK): **Exact version of rules applied**.
- `requirement_id` (UUID FK): Evaluated requirement.
- `status`: One of 7 distinct statuses (`complete`, `missing`, `needs_review`, `unknown`, `not_applicable`, `expired`, `blocked`).
- `evaluation_reason`: Deterministic rationale detailing the status.
- `matched_document_ids` (JSON): IDs of evidence documents associated with evaluation.
- `blocking_reasons` (JSON): Explanations of why the requirement cannot proceed.
- `human_reviewer_id` & `adjudicated_at`: Caseworker override metadata.
- `human_verdict`: Specialist decision (`satisfied`, `deficient`, `waived`).
- `human_notes`: Legal reasoning entered by the reviewer.

---

## B. Official-Source Management & Provenance

### 1. Scope & Authority Registry
Authorized specialists can register government sources specifying:
- **Authority**: USCIS, US Dept of State, IRCC, UKVI, Australia DHA, Immigration New Zealand, BAMF (Germany), Russian MVD/MID.
- **Scope Limitations**: Records the exact operational boundaries of the URL to prevent cross-pathway misapplication.
- **Update Cadence**: Tracks expected regulatory update intervals.

### 2. Snapshot Ingestion & Cryptographic Provenance
- Source snapshots store the retrieval timestamp, publisher date, effective date, and verbatim text.
- Calculates an immutable **SHA-256 hash** of the text payload upon ingestion.
- Detects regulatory tampering or unintended mutation.

### 3. Visual Side-by-Side Diffing
- The administrative interface features a side-by-side snapshot comparison view (`/api/v1/rules/sources/snapshots/{snap_a}/diff/{snap_b}`).
- Computes unified diff metrics: added lines, removed lines, and line-by-line unified change blocks.
- Identifies newly added regulatory requirements or modified statutory definitions before drafting rule changes.

### 4. Zero Silent Overwrites: Affected Case Queuing
When an updated rule version is published:
- The system executes an **Impact Analysis** (`/api/v1/rules/versions/{version_id}/impact-analysis`).
- Scans all active cases matching the rule set's jurisdiction and pathway.
- Instead of silently recalculating or rewriting past case decisions, it creates a priority `CaseTask` for each affected case:
  - Task Type: `rule_update_review`
  - Priority: `high`
  - Title: `Review rule update: [Pathway] v[Version]`
  - Detailed description with change notes and instructions to re-evaluate the case against the newly published standard.

---

## C. Safe Declarative Requirement Engine

### 1. Zero Database-Stored Python Execution
Arbitrary code execution via `eval()`, `exec()`, or runtime compilation is strictly forbidden. The engine uses a bounded Python AST visitor (`backend/app/rules/declarative_evaluator.py`) that permits only safe literal evaluation:

- **Allowed AST Nodes**: `Expression`, `BoolOp`, `BinOp`, `UnaryOp`, `Compare`, `Name`, `Constant`, `List`, `Dict`, `Attribute`, `Call`, `Subscript`.
- **Allowed Safe Operators**:
  - Comparison: `==`, `!=`, `<`, `<=`, `>`, `>=`, `in`, `not in`
  - Boolean: `and`, `or`, `not`
  - Math: `+`, `-`, `*`, `/`, `%`
- **Allowed Built-in Functions**: `len()`, `str()`, `int()`, `float()`, `bool()`, `min()`, `max()`.
- **Forbidden Constructs**: `Import`, `Exec`, `Lambda`, `ClassDef`, `FunctionDef`, `While`, `For`, attribute lookups on dunders (`__class__`, `__subclasses__`). Attempting to evaluate unsafe expressions raises `SecurityException` immediately.

### 2. Seven Distinct Requirement Statuses

A document being present **must not automatically satisfy a requirement**. Completion follows strict criteria:

| Status | Meaning | Conditions |
|---|---|---|
| `complete` | Satisfied | Evidence present, validation expressions evaluate to `True`, not expired, prerequisites met, and human review satisfied (if required). |
| `missing` | Evidence Lacking | Requirement is applicable and unblocked, but zero accepted evidence documents are attached to the case. |
| `needs_review` | Specialist Required | Evidence is present and valid, but statutory criteria mandates professional human adjudication before completion. |
| `unknown` | Insufficient Data | Field values referenced by the validation expression are null or missing from the case metadata. |
| `not_applicable` | Inactive | The requirement's `applicability_expression` evaluated to `False` based on the case profile. |
| `expired` | Outdated Document | Matched evidence document has an expiration date in the past, or is expiring within statutory validity limits. |
| `blocked` | Prerequisite Unmet | A prerequisite requirement (e.g., identity verification) is not yet completed. Prevents evaluation deadlock. |

---

## D. Rule Lifecycle & Governance

The rule version lifecycle state machine enforces separation of duties and regulatory rigor:

```
[Draft]
   │
   ▼  (Submit for Review)
[Under Review]
   │
   ▼  (Run Regression Tests & Validate)
[Validated]
   │
   ▼  (Independent Attorney Approval: author_id != approved_by)
[Published]
   │
   ├──────────────────────────┐
   ▼                          ▼
[Superseded]             [Suspended]
(When next version       (Emergency legal stay
 is published)            or court injunction)
```

### Separation of Duties
A rule cannot be published by its author. If `author_id == approver_id`, the system raises an `HTTP 400 Bad Request` citing separation of duties violation.

### Immutable Version Stamping
Every case evaluation stores the exact `rule_set_version_id`. Historical evaluations remain permanently preserved in `CaseRequirementEvaluation`. When rules are updated, past evaluations are preserved as immutable audit records.

---

## E. Country Rollout Pilot: US EB-1A Extraordinary Ability

The pilot pathway implements the **US EB-1A Extraordinary Ability** category under:
- **Statute**: Immigration and Nationality Act (INA) § 203(b)(1)(A)
- **Regulations**: 8 CFR § 204.5(h)
- **Policy Guidance**: USCIS Policy Manual, Volume 6, Part F, Chapter 2 (Kazarian two-step analysis)

### Configured Statutory Requirements

1. **Mandatory Identity Verification** (`EB1A-MAND-ID`):
   - Citation: 8 CFR § 204.5(a)
   - Accepted Evidence: `identity_document`, `passport`
   - Validation: Unexpired passport with verified biographical page.
2. **Intent to Continue Working in Field of Expertise** (`EB1A-MAND-INTENT`):
   - Citation: INA § 203(b)(1)(A)(ii); 8 CFR § 204.5(h)(5)
   - Accepted Evidence: `statement_of_intent`, `employment_offer`, `business_plan`
   - Prerequisite: `EB1A-MAND-ID`
3. **Substantial Prospective Benefit to the United States** (`EB1A-MAND-BENEFIT`):
   - Citation: INA § 203(b)(1)(A)(iii)
   - Accepted Evidence: `expert_opinion_letter`, `impact_statement`
   - Prerequisite: `EB1A-MAND-INTENT`
4. **Criterion 1: Nationally or Internationally Recognized Prizes/Awards** (`EB1A-CRIT-AWARDS`):
   - Citation: 8 CFR § 204.5(h)(3)(i)
   - Accepted Evidence: `award_certificate`, `prize_documentation`, `judging_criteria`
   - Human Review: Mandatory
5. **Criterion 2: Membership in Associations Requiring Outstanding Achievement** (`EB1A-CRIT-MEMBERSHIP`):
   - Citation: 8 CFR § 204.5(h)(3)(ii)
   - Accepted Evidence: `membership_certificate`, `association_bylaws`
6. **Criterion 3: Published Material About the Alien in Major Media** (`EB1A-CRIT-MEDIA`):
   - Citation: 8 CFR § 204.5(h)(3)(iii)
   - Accepted Evidence: `news_article`, `media_report`, `circulation_evidence`
7. **Criterion 4: Participation as a Judge of the Work of Others** (`EB1A-CRIT-JUDGING`):
   - Citation: 8 CFR § 204.5(h)(3)(iv)
   - Accepted Evidence: `peer_review_record`, `editorial_board_letter`, `grant_review_invitation`
8. **Criterion 5: Original Contributions of Major Significance** (`EB1A-CRIT-ORIGINAL`):
   - Citation: 8 CFR § 204.5(h)(3)(v)
   - Accepted Evidence: `expert_testimonial`, `patent_citation_analysis`, `commercial_license`
   - Human Review: Mandatory
9. **Criterion 6: Authorship of Scholarly Articles in the Field** (`EB1A-CRIT-SCHOLARLY`):
   - Citation: 8 CFR § 204.5(h)(3)(vi)
   - Accepted Evidence: `journal_article`, `citation_report`, `conference_proceedings`
10. **Criterion 7: Display of Work at Artistic Exhibitions or Showcases** (`EB1A-CRIT-EXHIBITION`):
    - Citation: 8 CFR § 204.5(h)(3)(vii)
    - Applicability: `case.field == "arts"`
11. **Criterion 8: Leading or Critical Role for Distinguished Organizations** (`EB1A-CRIT-CRITICAL-ROLE`):
    - Citation: 8 CFR § 204.5(h)(3)(viii)
    - Accepted Evidence: `organization_chart`, `executive_letter`, `reputation_documentation`
12. **Criterion 9: High Salary or Significantly High Remuneration** (`EB1A-CRIT-HIGH-SALARY`):
    - Citation: 8 CFR § 204.5(h)(3)(ix)
    - Accepted Evidence: `w2_form`, `tax_return`, `compensation_survey`

---

## F. Frontend Components

### 1. `RuleAdministrationHub.tsx`
Provides authorized administrators and legal specialists with 4 tabs:
- **Official Sources & Snapshots**: Register URLs, capture snapshots with SHA-256 hashes, and open visual side-by-side diff comparisons.
- **Rule Sets & Lifecycle**: Manage rule versions, view statutory citations, and transition versions through the draft -> under review -> validated -> published pipeline.
- **Requirement Builder**: Browse and inspect requirement trees, statutory citations, accepted evidence types, declarative validation expressions, and prerequisite dependencies.
- **Regression & Impact Analyzer**: Run deterministic test suites against rule versions, simulate case evaluations, and trigger impact scans on open cases.
- **Pilot Seeder**: One-click initialization of the USCIS EB-1A official source, baseline snapshots, and published v1.0.0 rule set.

### 2. `CaseRequirementEvaluationView.tsx`
Client and caseworker checklist view:
- **Statutory Progress Bar**: Live calculation of requirement fulfillment percentage.
- **Status Filter**: Filter requirements by status (`complete`, `missing`, `needs_review`, `blocked`, etc.).
- **Card Breakdown**:
  - Distinct badge tokens for each of the 7 statuses.
  - Statutory citation pill.
  - Matched evidence documents with category badges.
  - Declarative validation checks breakdown.
  - Blocking reason callouts for unmet prerequisites.
- **Specialist Adjudication Modal**: Allows caseworkers to record verdicts (`satisfied`, `deficient`, `waived`) with mandatory legal notes.

---

## G. Testing and Verification

### Backend Pytest Suite (`backend/tests/test_phase6_rule_engine.py`)
- `test_declarative_evaluator_safety`: Verifies AST sandbox blocks code execution (`__import__`, `open()`, os calls).
- `test_evaluator_all_seven_statuses`: Validates deterministic derivation of all 7 statuses.
- `test_source_snapshot_diff`: Verifies side-by-side text diffing and SHA-256 integrity.
- `test_rule_version_lifecycle_and_separation_of_duty`: Validates that authors cannot approve their own rule versions.
- `test_affected_cases_detector_queues_tasks`: Validates that published rule changes queue high-priority review tasks for open cases without rewriting past records.
- `test_eb1a_pilot_full_evaluation`: Evaluates real case data against the 12 EB-1A statutory requirements.

**Results: 69 / 69 backend tests passing.**

### Web Frontend Vitest Suite (`apps/web/tests/phase6_rule_engine.test.tsx`)
- `RuleAdministrationHub renders official sources, rule sets, and snapshot comparison`
- `RuleAdministrationHub shows visual diff modal when comparing snapshots`
- `RuleAdministrationHub allows seeding official EB-1A pilot configuration`
- `RuleAdministrationHub executes regression test suite on rule versions`
- `RuleAdministrationHub runs impact analysis for affected cases`
- `CaseRequirementEvaluationView renders fulfillment progress bar and status filters`
- `CaseRequirementEvaluationView displays matched evidence and blocking reasons`
- `CaseRequirementEvaluationView opens adjudication modal for specialist review`
- `OwnerMasterDashboard renders Rules & Authorities navigation tab`
- `EmployeeWorkspace renders Case Requirements and Rule Registry tabs`
- `Full cycle test: filter requirements by status and submit adjudication`

**Results: 37 / 37 frontend tests passing. Next.js production build succeeds with zero errors.**
