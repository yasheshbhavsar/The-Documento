# Phase 5 — AI Document Analysis and Discrepancy Detection

## Overview

Phase 5 implements the AI intelligence layer on top of the document processing pipeline established in Phase 4. It assists authorized immigration professionals with document quality evaluation, case consistency checks, and statutory evidence auditing.

### Strict Ethical and Legal Guardrails
The intelligence layer strictly complies with professional responsibility rules:
- **No Unsupported Conclusions**: Never declares an applicant "fraudulent" or "deceptive" based on an AI finding.
- **No Hallucinated Evidence**: Never invents missing evidence or synthesizes unverified credentials.
- **No Confidence Equated to Proof**: Model confidence scores are treated as extraction heuristics, not proof of legal accuracy.
- **No Approval Predictions**: Never predicts visa approval or adjudication success as a factual outcome.
- **No Automated Record Mutation**: Verified applicant records are never altered automatically by model inferences.
- **No Auto-Resolution of High-Impact Issues**: Critical and major findings unconditionally require authorized human attorney/caseworker disposition.
- **Explicit Uncertainty Disclosures**: Every analysis output explicitly states data provenance, linguistic assumptions, and analytical limitations.

---

## Architecture & Capabilities

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PHASE 5 INTELLIGENCE ENGINE                           │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
      ┌────────────────────────────────┼────────────────────────────────┐
      ▼                                ▼                                ▼
┌────────────────────┐   ┌───────────────────────────┐   ┌────────────────────┐
│ Deterministic      │   │ Quality & Expiration      │   │ Pathway Checklist  │
│ Comparators        │   │ Detector                  │   │ Audit Engine       │
│ • Names & Aliases  │   │ • Pagination Parser       │   │ • EB-1A / O-1A     │
│ • Transliteration  │   │ • Low OCR Confidence      │   │ • EB-2 NIW         │
│ • DOB & Formats    │   │ • Expiration within 6mo   │   │ • H-1B Specialty   │
│ • Doc Numbers      │   │ • Incomplete Date Ranges  │   │ • Family I-130     │
└─────────┬──────────┘   └─────────────┬─────────────┘   └─────────┬──────────┘
          │                            │                           │
          └────────────────────────────┼───────────────────────────┘
                                       │
                                       ▼
                     ┌───────────────────────────────────┐
                     │ Form & Evidence Discrepancy       │
                     │ Analyzer                          │
                     │ • Cross-document matching         │
                     │ • Degree vs Employment overlap    │
                     │ • Contradiction vs Variation      │
                     └─────────────────┬─────────────────┘
                                       │
                                       ▼
                     ┌───────────────────────────────────┐
                     │ AI Review Service & Findings DB   │
                     │ • CaseAIFinding persistence       │
                     │ • Auto CaseTask creation (Major+) │
                     │ • Disposition & Resolution Audit  │
                     │ • Evidence-Backed Case Briefs     │
                     └───────────────────────────────────┘
```

---

## 1. Domain Models & Schema

### `CaseAIFinding` (`case_ai_findings` table)
- `id` (UUID primary key): Non-guessable finding identifier.
- `organization_id` (UUID foreign key): Enforces strict multi-tenant boundary.
- `case_id` (UUID foreign key): Linked immigration case.
- `finding_type`: `consistency_discrepancy`, `document_quality`, `apparent_expiration`, `missing_evidence`, `form_evidence_conflict`.
- `severity`: `critical`, `major`, `minor`, `informational`.
- `status`: `needs_review`, `unable_to_determine`, `resolved`, `dismissed`.
- `title` & `description`: Clear narrative of the observed issue.
- `evidence_text`: Verbatim cited snippet from the source document.
- `source_location` (JSON): `{"document_id": "...", "document_title": "...", "page": 1, "bbox": {...}}`.
- `related_documents` (JSON): Array of referenced document IDs, titles, and categories.
- `related_fields` (JSON): Array of comparison fields with raw original and normalized values.
- `relevant_requirement`: Configured statutory rule (e.g., `8 CFR § 204.5(h)(3)`).
- `recommended_action`: Next action recommended to caseworkers.
- `clarification_question`: Pre-formulated professional question for client or sponsor correspondence.
- `uncertainty_limitations`: Explicit statement of linguistic or data limitations.
- `linked_task_id`: Linked `CaseTask` automatically generated for high-impact findings.
- `is_confirmed_contradiction`: Boolean distinguishing confirmed legal conflicts from harmless variations.
- `reviewer_id` & `resolved_at`: Human reviewer audit stamp.
- `resolution_action`: `resolve`, `dismiss`, or `escalate`.
- `resolution_reason`: Mandatory structured reason code for dismissals.
- `resolution_history` (JSON): Complete immutable audit trail of review actions.

---

## 2. Deterministic Comparators & Discrepancy Heuristics

Located in `backend/app/ai/comparators.py`:

### A. Name Concordance & Transliteration
- **Transliteration Dictionaries**: Maps Cyrillic (BGN/PCGN, Ukrainian, Russian) and Arabic standard romanizations (`Yelena` vs `Elena`, `Alexander` vs `Aleksandr`, `Muhammad` vs `Mohamed`).
- **Slavic Suffix Normalization**: Recognizes gendered Slavic patronymic/surname variations (`Rostova` vs `Rostov`, `Ivanova` vs `Ivanov`).
- **Civil Record Bridges**: Links maiden and married names when a marriage certificate or civil status document is on file.
- **Harmonized Token Comparison**: Distinguishes middle initials, inverted surname orders, and transliterations from true identity contradictions.

### B. Date of Birth & Date Format Ambiguity
- **Ambiguity Detection**: Flags dates where day and month are `<= 12` (e.g., `04/06/1988` could be April 6 or June 4).
- **Format Normalization**: Standardizes `DD/MM/YYYY`, `MM/DD/YYYY`, and textual dates (`12 APR 1988`) into ISO-8601 (`1988-04-12`).
- **Contradiction vs Ambiguity**: Only flags confirmed contradictions when parsed dates are unambiguous and differ.

### C. Document Numbers & OCR Noise
- **OCR Optical Confusion Substitution**: Resolves common OCR character confusions:
  - `0` ↔ `O`
  - `1` ↔ `I` / `l`
  - `8` ↔ `B`
  - `5` ↔ `S`
  - `2` ↔ `Z`
- Distinguishes optical scan artifacts from actual alphanumeric passport mismatches.

---

## 3. Document Quality & Integrity Detector

Located in `backend/app/ai/quality_detector.py`:
- **Missing Pages Detection**: Analyzes document text for pagination markers (e.g., `"Page 1 of 4"`). If the physical file contains fewer pages than the denominator, generates a `critical` finding.
- **Low OCR Quality**: Evaluates average OCR confidence across extracted fields. Scores `< 0.70` generate a `major` quality finding advising 300+ DPI re-scanning.
- **Apparent Expiration**: Inspects expiration dates against current date and petition timelines. Flags expired documents as `critical` and documents expiring within 6 months as `major`.
- **Incomplete Date Ranges**: Inspects employment or residence periods for unclosed or future date ranges.

---

## 4. Statutory Checklist Engine

Located in `backend/app/ai/checklist_engine.py`:
Configured statutory frameworks:
1. **US EB-1A (Extraordinary Ability)**: 8 CFR § 204.5(h)(3) — 10 statutory criteria (prizes, memberships, published media, judging, original contributions, scholarly articles, exhibitions, leading roles, high remuneration, commercial success).
2. **US O-1A (Extraordinary Ability in Science/Business)**: 8 CFR § 214.2(o)(3)(iii).
3. **US EB-2 NIW (National Interest Waiver)**: Matter of Dhanasar, 26 I&N Dec. 884 (substantial merit, well positioned, waiver beneficial).
4. **US H-1B (Specialty Occupation)**: 8 CFR § 214.2(h)(4)(iii)(A).
5. **US Family (I-130 Petition for Alien Relative)**: 8 CFR § 204.1.

Outputs:
- Total mandatory criteria vs. satisfied criteria.
- Overall evidentiary fulfillment percentage.
- List of missing statutory requirements.

---

## 5. Evidence-Backed Summaries & Clarification Questions

Located in `backend/app/ai/summarizer.py`:
- Extracts verified facts directly grounded in primary documents with exact citations: `[Document Title, Page X]`.
- Groups open review items by severity.
- Formulates professional clarification questions for client/sponsor inquiry.
- Includes mandatory non-binding legal disclaimers and explicit uncertainty disclosures.

---

## 6. Reviewer Finding Disposition & Task Workflow

Located in `backend/app/ai/review_service.py` & `backend/app/api/v1/findings.py`:
- **Automated Task Creation**: Critical and major findings automatically instantiate a `CaseTask` linked to the case and assigned caseworker.
- **Resolution**: Reviewer marks finding `resolved` with a mandatory legal rationale note; linked `CaseTask` is automatically completed.
- **Dismissal with Structured Reason**: Requires selecting one of 7 valid reasons:
  1. `acceptable_transliteration`
  2. `verified_name_change`
  3. `ocr_scan_artifact`
  4. `client_clarification_confirmed`
  5. `statutory_exception_applies`
  6. `duplicate_finding`
  7. `other_justified_reason`
  Plus a mandatory detailed justification note.
- **Escalation**: Flags finding as critical and records escalation query for Senior Reviewer / Supervising Counsel.
- **Audit Preservation**: Complete resolution history (`resolution_history`) is immutably appended and preserved.

---

## 7. API Endpoints

- `GET /api/v1/cases/{case_id}/findings` — List findings for a case (filterable by severity & status).
- `POST /api/v1/cases/{case_id}/findings/analyze` — Trigger asynchronous case consistency analysis.
- `GET /api/v1/cases/{case_id}/findings/checklist` — Statutory checklist audit report.
- `GET /api/v1/cases/{case_id}/findings/summary` — Grounded evidence-backed case summary.
- `PUT /api/v1/cases/{case_id}/findings/{finding_id}/resolve` — Resolve finding with rationale note.
- `PUT /api/v1/cases/{case_id}/findings/{finding_id}/dismiss` — Dismiss finding with structured reason & note.
- `PUT /api/v1/cases/{case_id}/findings/{finding_id}/escalate` — Escalate finding to senior counsel.

---

## 8. Frontend Experience (`apps/web`)

1. **AI Findings Workspace Tab (`EmployeeWorkspace.tsx`)**:
   - Statutory checklist banner with fulfillment meter and missing evidence tags.
   - Action controls: "Run Case AI Consistency Analysis" and "View Evidence-Backed Brief".
   - Severity & Status filtering controls.
   - Interactive finding cards showing severity badges, confirmed contradiction vs. discrepancy banners, cited evidence snippets, and inspection triggers.
2. **`AIFindingInspectorModal.tsx`**:
   - Comprehensive multi-tab inspection interface:
     - Evidence & Analysis: raw vs. normalized values, exact source page citation, statutory basis.
     - Reviewer Disposition: Resolve, Dismiss (with 7 structured reason dropdown), or Escalate.
     - Immutable Audit Trail: chronological log of reviewer timestamps, emails, and notes.
     - One-click copy for pre-formulated clarification questions.
3. **`EvidenceSummaryModal.tsx`**:
   - Grounded case brief displaying verified facts with `[Doc, Page]` citations, missing criteria, and copyable formatted markdown.

---

## 9. Verification & Test Suite

### Backend Regression Tests (`backend/tests/test_phase5_ai_analysis.py`):
1. `test_transliteration_matching_prevents_false_positives` (PASSED)
2. `test_confirmed_name_contradiction` (PASSED)
3. `test_name_change_with_civil_record_bridge` (PASSED)
4. `test_dob_format_ambiguity_vs_contradiction` (PASSED)
5. `test_document_number_ocr_substitution` (PASSED)
6. `test_missing_pages_quality_detection` (PASSED)
7. `test_apparent_expiration_detection` (PASSED)
8. `test_poor_ocr_detection` (PASSED)
9. `test_adversarial_document_instructions_are_ignored` (PASSED)
10. `test_pathway_checklist_gap_detection` (PASSED)
11. `test_evidence_summary_generation_and_uncertainty_disclosures` (PASSED)
12. `test_end_to_end_ai_analysis_and_task_creation` (PASSED)
13. `test_finding_resolution_and_audit_history` (PASSED)
14. `test_finding_dismissal_with_structured_reason` (PASSED)
15. `test_cross_tenant_isolation_on_findings` (PASSED)

- **Total Backend Suite**: **63 passed** across all phases.

### Frontend Tests (`apps/web/tests/phase5_ai_findings.test.tsx`):
1. Renders `EmployeeWorkspace` AI findings tab with statutory checklist banner and cards.
2. Filters findings by severity.
3. Renders `AIFindingInspectorModal` with evidence source location, citation, and guardrails.
4. Handles Resolve finding with mandatory note.
5. Handles Dismiss finding with structured reason dropdown and legal justification note.
6. Renders `EvidenceSummaryModal` with verified facts, citations, and uncertainty statements.

- **Total Frontend Suite**: **26 passed** across all 5 test suites.
- **Production Next.js Build**: Successful (441ms, 0 errors).
