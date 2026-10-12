# Phase 8 — Application Forms, Readiness Checks, and Package Builder

## Overview

Phase 8 implements the complete **application-preparation and evidence-package subsystem** for modern immigration casework. It transforms raw client data, verified OCR extractions, and approved evidentiary documents into jurisdiction-compliant, version-locked petition filings ready for attorney sign-off and physical or verified submission.

Key capabilities delivered in Phase 8:
1. **Configurable & Versioned Application Forms**: Dynamic schema-driven petition forms (e.g. USCIS Form I-140, Form I-485, Form G-28; IRCC IMM 0008; UKVI Skilled Worker) with schema versioning, jurisdiction and pathway associations, multi-type field validation, and conditional visibility logic (`depends_on`).
2. **Answer Records with Strict Source Provenance**: Every form field records its explicit data provenance (`client_profile`, `document_ocr`, `user_provided`, `ai_generated`). AI-suggested answers remain unconfirmed drafts until confirmed by authorized personnel. Comprehensive revision history is tracked per field.
3. **Sensitive-Field Attorney Review**: High-risk questions (criminal history, removal/deportation proceedings, inadmissibility grounds) enforce mandatory attorney review (`review_sensitive_fields`). Client self-signoff on sensitive legal questions is strictly prohibited.
4. **Deterministic Readiness Evaluation**: A 10-point deterministic checklist verifying evidentiary completeness, unresolved findings, unverified OCR values, document expirations, form completeness, and pending approvals. **Strict regulatory constraint: Under no circumstances does the system calculate or display a probability of government approval.**
5. **Configurable Package Builder & Folder Hierarchy**: Standardized 11-category folder structures (`00_Case_Summary` through `10_Approved_Package`) with country-specific templates. **Strict separation of internal review materials (`09_Internal_Review`) from submission-ready packages.**
6. **Cryptographic Package Integrity**: SHA-256 document hashing, Merkle root package digest, document version locking, and manifest generation to prevent accidental mixing of old and new document revisions.
7. **7-Stage Auditable Approval Workflow & Manual Filing**: Multi-stage sequential sign-off chain (evidence check, findings disposition, staff review, senior review, client confirmation, final G-28 attorney approval, version lock). **Automatic submission to government portals is prohibited**; verified manual physical filing protocols and courier tracking are enforced.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│            PHASE 8 APPLICATION PREPARATION & PACKAGE SUBSYSTEM             │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        ▼                              ▼                              ▼
┌────────────────────────────┐   ┌───────────────────────────┐   ┌────────────────────────────┐
│ Configurable Form Engine   │   │ Deterministic Readiness   │   │ Package Builder & Folders  │
│ • Versioned Schemas (I-140)│   │ • 10 Statutory Checks     │   │ • 11 Folder Segregations   │
│ • Conditional Logic        │   │ • Missing Evidence Flags  │   │ • 🔒 09_Internal_Review    │
│ • Provenance Tracking      │   │ • Unresolved Findings     │   │   (Strict Isolation)       │
│ • AI Draft Confirmation    │   │ • Expired Document Alert  │   │ • Country Templates        │
│ • Sensitive Attorney Sign  │   │ • 🚫 NO Approval Odds     │   │ • Submission-Ready Filter  │
└──────────────┬─────────────┘   └─────────────┬─────────────┘   └─────────────┬──────────────┘
               │                               │                               │
               └───────────────────────────────┼───────────────────────────────┘
                                               │
                                               ▼
                               ┌───────────────────────────────────┐
                               │ Cryptographic Package Integrity   │
                               │ • SHA-256 Per-File Hashing        │
                               │ • Merkle Root Package Checksum    │
                               │ • Manifest JSON & Table Export    │
                               │ • Rule & Doc Version Locking      │
                               └─────────────────┬─────────────────┘
                                                 │
                                                 ▼
                               ┌───────────────────────────────────┐
                               │ 7-Stage Auditable Approval Chain  │
                               │ 1. Evidence & Forms Check         │
                               │ 2. Findings Disposition           │
                               │ 3. Authorized Staff Review        │
                               │ 4. Senior Reviewer Review         │
                               │ 5. Client Confirmation            │
                               │ 6. Final G-28 Signatory Approval  │
                               │ 7. Package Version Locked         │
                               │ ── No Auto-Submit / Manual Filing │
                               └───────────────────────────────────┘
```

---

## Data Model & Schema

Phase 8 introduces five core models in `backend/app/domain/models.py` migrated cleanly via Alembic:

### 1. `FormSchema` & `FormSchemaVersion`
- `FormSchema`: Top-level registry defining form code (e.g. `USCIS_I140`, `USCIS_I485`, `USCIS_G28`), jurisdiction (`US`, `CA`, `UK`), supported pathways (`EB1A`, `EB2_NIW`, `O1A`), title, description, and active version pointer.
- `FormSchemaVersion`: Versioned schemas (e.g. `1.0.0`, `2026.1`) storing immutable JSON schema definitions (`schema_json`), status (`draft`, `published`, `deprecated`), created by, and activation timestamps.

#### Schema Definition (`schema_json`)
```json
{
  "sections": [
    {
      "id": "part1_petitioner",
      "title": "Part 1. Information About the Person or Organization Filing This Petition",
      "fields": [
        {
          "id": "petitioner_type",
          "label": "Filing Type",
          "field_type": "select",
          "required": true,
          "options": ["self_petitioner", "employer_sponsor"],
          "default_value": "self_petitioner"
        },
        {
          "id": "employer_name",
          "label": "Company or Organization Name",
          "field_type": "text",
          "required": true,
          "depends_on": {
            "field_id": "petitioner_type",
            "value": "employer_sponsor"
          }
        },
        {
          "id": "criminal_history_flag",
          "label": "Have you ever been arrested, cited, or convicted of any law violation?",
          "field_type": "boolean",
          "required": true,
          "is_sensitive": true,
          "help_text": "Requires mandatory attorney review under ethical signoff guidelines."
        }
      ]
    }
  ]
}
```

### 2. `FormSubmission`
Stores applicant responses tied to a specific case, schema version, and status (`draft`, `in_review`, `completed`, `locked`):
- `answers_json`: Key-value map of field answers with detailed provenance metadata.
- `revision_history_json`: Append-only audit log tracking previous values, timestamps, actor IDs, and edit rationales.
- `sensitive_review_status`: Tracks attorney sign-off on sensitive fields (`pending`, `reviewed`, `waived`).
- `reviewed_by_attorney_id`: Foreign key to the attorney who reviewed sensitive answers.

### 3. `PackageTemplate`
Configurable folder hierarchy templates per jurisdiction and pathway:
- Standard USCIS Template: `00_Case_Summary` to `10_Approved_Package`.
- Folder definition includes folder code, folder name, display order, category code, and `is_internal_only` flag.

### 4. `FilingPackage`
The authoritative filing artifact:
- `package_number`: Human-readable identifier (e.g. `PKG-US-EB1A-20261011-001`).
- `status`: `draft` -> `in_review` -> `ready_for_approval` -> `approved` -> `locked`.
- `folder_structure_json`: Configured folder organization with assigned documents.
- `manifest_json`: Immutable record of every document version, filename, SHA-256 hash, category, related requirement, and generation timestamp.
- `merkle_root_hash`: SHA-256 hash computed across the concatenated document hashes.
- `approval_chain_json`: Audit trail of the 7 approval stages.
- `rule_version_applied`: The regulatory rule version used for deterministic validation (e.g. `2026.1-USCIS-EB1A`).

---

## Subsystem A: Configurable Forms & Provenance

### 1. Field Types & Validation
Supported field types include:
- `text`, `textarea`, `email`, `phone`, `date`, `number`, `select`, `multiselect`, `boolean`, `ssn`, `alien_registration_number`.
- Validation properties: `regex_pattern`, `min_value`, `max_value`, `min_length`, `max_length`, `options`.

### 2. Conditional Fields (`depends_on`)
Fields dynamically appear or evaluate based on prior selections. For instance, in Form I-140:
- If `petitioner_type` == `'employer_sponsor'`, the `employer_name` and `employer_fein` fields are required.
- If `petitioner_type` == `'self_petitioner'`, employer fields are automatically hidden and excluded from validation.

### 3. Answer Provenance Engine
Every populated value retains its source provenance:
```json
{
  "value": "Dr. Sarah Chen",
  "source_type": "client_profile",
  "source_document_id": null,
  "source_field_path": "applicant.full_legal_name",
  "confidence_score": 1.0,
  "confirmed_by_user": true,
  "confirmed_at": "2026-10-11T20:00:00Z",
  "confirmed_by_id": "usr_emp_case_manager_01",
  "is_ai_generated": false,
  "is_sensitive": false
}
```

#### Provenance Source Types:
- `client_profile`: Auto-populated from verified client onboarding records.
- `document_ocr`: Extracted from uploaded evidence (e.g., passport OCR, degree certificate).
- `user_provided`: Directly typed and submitted by the applicant or caseworker.
- `ai_generated`: Synthesized or suggested by AI analysis tools.

### 4. AI Draft Confirmation Protocol
- AI-generated or OCR-extracted answers default to `confirmed_by_user: false`.
- Visually flagged with amber "AI Draft" or "Unverified OCR" badges.
- Caseworkers or applicants must explicitly click **"Confirm Field Value"** (`POST /api/v1/forms/submissions/{id}/confirm-field`), which updates `confirmed_by_user: true` and logs the confirming actor.

### 5. Sensitive-Field Review Requirements
Fields touching criminal history, immigration violations, fraud allegations, or deportation proceedings carry `is_sensitive: true`.
- **Client Prohibited Signoff**: Retained clients are strictly barred from completing or waiving sensitive legal review.
- **Attorney Sign-off**: Requires authorized attorney action (`POST /api/v1/forms/submissions/{id}/review-sensitive`) with mandatory attorney certification notes.

---

## Subsystem B: Deterministic Readiness Evaluation

The `ReadinessService` (`backend/app/packages/readiness.py`) runs an exhaustive, deterministic 10-point inspection across the case:

| Check # | Check Name | Evaluation Criteria | Severity |
| :--- | :--- | :--- | :--- |
| **1** | `applicable_requirements` | Evaluates that all pathway statutory requirements are mapped. | Critical |
| **2** | `evidence_received` | Verifies that required evidentiary categories have uploaded documents. | Critical |
| **3** | `missing_evidence` | Flags any mandatory statutory requirements lacking verified evidence. | Critical |
| **4** | `unresolved_findings` | Checks for open discrepancies, OCR anomalies, or legal gaps. | Critical |
| **5** | `unverified_extracted_fields` | Scans for form fields populated via OCR/AI without human confirmation. | Warning |
| **6** | `expired_documents` | Checks passport, medical exam, or certification validity dates. | Critical |
| **7** | `incomplete_forms` | Verifies that required petition forms are started and completed. | Critical |
| **8** | `outstanding_client_responses` | Checks for pending document requests or unanswered inquiries. | Warning |
| **9** | `pending_reviewer_decisions` | Verifies that required staff or attorney reviews are complete. | Warning |
| **10** | `unmet_package_criteria` | Evaluates formatting, translations, and jurisdictional criteria. | Critical |

### 🚫 Prohibition on Approval Odds
Immigration adjudications depend on government discretion (e.g. USCIS two-step *Kazarian* framework, *Matter of Dhanasar* NIW prongs).
- **Hard Rule**: The system **never** calculates, simulates, or presents a "probability of approval", "chances of success", or "approval score".
- **Readiness Meaning**: The readiness score reflects strictly the percentage of internal compliance checks satisfied.
- The UI displays an explicit compliance notice:
  > *"Deterministic readiness indicates only that all internal evidentiary and verification criteria are satisfied. It does not predict or guarantee government adjudication decisions."*

---

## Subsystem C: Package Builder & Folder Hierarchy

The `PackageBuilderService` (`backend/app/packages/builder.py`) organizes all case materials into an industry-standard 11-folder structure:

```
00_Case_Summary/
  ├── G-28_Notice_of_Appearance.pdf
  └── Legal_Brief_and_Index.pdf
01_Identity_and_Civil_Status/
  ├── Passport_Biographical_Page.pdf
  └── Birth_Certificate_Certified_Copy.pdf
02_Application_Forms/
  └── Form_I-140_Immigrant_Petition_Signed.pdf
03_Pathway_Evidence/
  ├── Major_Prizes_and_Awards_Evidence.pdf
  └── Scholarly_Articles_and_Citations.pdf
04_Financial_Evidence/
  ├── W2_Tax_Statements.pdf
  └── Compensation_Benchmarking_Letters.pdf
05_Education_and_Employment/
  ├── Ph.D._Diploma_and_Transcripts.pdf
  └── Employment_Verification_Letters.pdf
06_Family_and_Sponsorship/
  └── Marriage_Certificate_Derivative.pdf
07_Translations_and_Certifications/
  └── Certified_English_Translations_with_Affidavits.pdf
08_Additional_Evidence/
  └── Media_Coverage_and_Press_Releases.pdf
09_Internal_Review/  <-- [STRICTLY EXCLUDED FROM SUBMISSION PACKAGE]
  ├── Attorney_Case_Risk_Analysis.pdf
  ├── OCR_Discrepancy_Audit_Notes.txt
  └── Evidentiary_Gap_Review_Memo.pdf
10_Approved_Package/
  ├── Complete_Filing_Package_Locked.pdf
  └── Cryptographic_Package_Manifest.json
```

### Strict Internal Segregation
- Materials in `09_Internal_Review` (attorney work product, risk ratings, internal staff memos) are tagged `is_internal: true`.
- When exporting submission-ready packages or viewing in "Submission-Ready" mode, `09_Internal_Review` documents are automatically filtered out.

---

## Subsystem D: Cryptographic Package Integrity

To prevent accidental mixing of old and new document revisions during multi-month petition preparation:

1. **SHA-256 Document Hashing**: Every document in the package is hashed upon assignment.
2. **Merkle Root Digest**: Hashes are sorted and concatenated to produce an immutable 64-character Merkle root package digest.
3. **Immutable Manifest**:
```json
{
  "manifest_items": [
    {
      "document_id": "doc_us_eb1a_001",
      "file_name": "Dr_Sarah_Chen_Passport.pdf",
      "sha256_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "category": "01_Identity_and_Civil_Status",
      "related_requirement": "8 CFR § 204.5(k)(3)",
      "version": "1.0",
      "review_status": "verified"
    }
  ],
  "merkle_root_hash": "35a8f27806ff3cdfe4777d4da08a8a25c6e8e8ce12053ef1240c3ff411c8413b",
  "generated_at": "2026-10-11T20:15:00Z",
  "rule_version_applied": "2026.1-USCIS-EB1A"
}
```

---

## Subsystem E: 7-Stage Auditable Approval Workflow & Manual Filing

Filing packages progress through a mandatory 7-stage sequential approval chain:

```
[1. evidence_and_forms_check] (Case Manager / Staff)
             │
             ▼
[2. findings_disposition] (Staff / Reviewer)
             │
             ▼
[3. authorized_staff_review] (Case Manager)
             │
             ▼
[4. senior_review] (Senior Reviewer / Senior Attorney)
             │
             ▼
[5. client_confirmation] (Retained Client)
             │
             ▼
[6. final_package_approval] (G-28 Signatory Attorney)
             │
             ▼
[7. version_locked] (System / Signatory)
```

### Stage Requirements & Role Enforcement
1. **Evidence & Forms Check**: Verifies all forms completed and mandatory evidence present.
2. **Findings Disposition**: Confirms all OCR anomalies and legal findings are dismissed, mitigated, or resolved.
3. **Authorized Staff Review**: Senior paralegal or case manager substantive check.
4. **Senior Review**: Mandatory when configured for high-scrutiny pathways (e.g. EB-1A extraordinary ability).
5. **Client Confirmation**: Client reviews redacted filing preview and confirms biographical accuracy.
6. **Final Package Approval**: Authorized G-28 attorney signs off on legal sufficiency and signature execution.
7. **Version Locked**: Package state transitions to `locked`. SHA-256 hash manifest becomes permanent.

### Prohibition on Automatic Portal Submission
- **Policy**: In accordance with legal ethics and jurisdictional security standards, the system **does not automatically push filings to government portals** via automated browser scripts or unauthorized reverse-engineered APIs.
- **Manual Filing Standard**: The system exports a verified filing brief, pre-sorted tabs, and generates official courier instructions:
  - Exact USCIS Lockbox / Service Center postal delivery address based on petitioner jurisdiction.
  - Mandatory filing fee checks and Form G-1450 authorization attachment.
  - Physical tab ordering (Tabs A through L).
  - Courier tracking number entry upon physical dispatch.

---

## API Endpoints Reference

### Form Schemas & Submissions (`/api/v1/forms`)
| Method | Endpoint | Description | RBAC Roles |
| :--- | :--- | :--- | :--- |
| `GET` | `/schemas` | List active form schemas by jurisdiction & pathway | All Authenticated |
| `GET` | `/schemas/{code}` | Retrieve full versioned schema JSON | All Authenticated |
| `POST` | `/schemas` | Create or update versioned form schema | Admin / Owner |
| `GET` | `/submissions` | List form submissions for a case | Staff / Retained Client |
| `POST` | `/submissions` | Initialize new submission with auto-populated draft values | Staff / Retained Client |
| `GET` | `/submissions/{id}` | Get submission details and answers | Staff / Retained Client |
| `PATCH`| `/submissions/{id}/answers` | Update form answers with provenance and revision history | Staff / Retained Client |
| `POST` | `/submissions/{id}/confirm-field` | Confirm AI-generated or unverified OCR draft value | Staff / Retained Client |
| `POST` | `/submissions/{id}/review-sensitive` | Attorney review & signoff for sensitive legal questions | Legal Specialist / Attorney |

### Readiness & Package Builder (`/api/v1/packages`)
| Method | Endpoint | Description | RBAC Roles |
| :--- | :--- | :--- | :--- |
| `GET` | `/readiness/{case_id}` | Run 10-point deterministic readiness evaluation | Staff / Retained Client |
| `GET` | `/` | List filing packages for a case | Staff / Retained Client |
| `POST` | `/` | Assemble filing package and calculate SHA-256 manifest | Staff / Attorney |
| `GET` | `/{package_id}` | Get filing package details and folder hierarchy | Staff / Retained Client |
| `POST` | `/{package_id}/advance-approval` | Advance approval stage in 7-stage chain | Role-Gated per Stage |
| `GET` | `/{package_id}/export` | Export package manifest and filing instructions | Staff / Retained Client |

---

## Frontend Components

The Phase 8 frontend suite provides clean, reactive interfaces with zero layout shifts:

1. **`ConfigurableFormViewer.tsx`**:
   - Section sidebar navigation with completion indicators.
   - Dynamic conditional field rendering.
   - Provenance badges: `Client Profile` (Blue), `Verified OCR` (Green), `User Entry` (Slate), `AI Draft` (Amber).
   - "Confirm Field Value" action for unverified OCR/AI drafts.
   - Dedicated "Attorney Sensitive Review" certification banner (disabled for clients).
   - Slide-over field revision history audit log.
2. **`DeterministicReadinessChecklist.tsx`**:
   - 10-check audit table with status chips (`PASS`, `FLAGGED`, `PENDING`).
   - Blocking issues count vs Warning count.
   - Prominent legal compliance banner explicitly disclaiming approval odds calculation.
3. **`PackageBuilderView.tsx`**:
   - Interactive 11-folder hierarchical tree view.
   - Document metadata viewer (file size, SHA-256 hash preview, upload date).
   - "Submission-Ready Mode" toggle strictly hiding internal review folders.
   - Merkle root hash card and manifest table exporter.
4. **`PackageApprovalWorkflowModal.tsx`**:
   - 7-stage interactive stepper tracking progression.
   - Role-gated stage advance buttons.
   - Lockbox mailing address and manual courier filing instructions card.

---

## Verification & Quality Assurance

Phase 8 was validated with full regression testing across both frontend and backend suites:

- **Backend Pytest Suite**: 84 passed, 0 failed in 16.47s (`tests/test_phase8_packages_forms_readiness.py`).
  - Schema creation and validation.
  - Provenance tracking and AI draft confirmation.
  - Sensitive field attorney review restrictions (prohibiting client sign-off).
  - 10-point deterministic readiness checks.
  - Absence of approval probabilities.
  - Package assembly, folder organization, and SHA-256 Merkle root hashing.
  - 7-stage approval workflow with strict role gatekeeping.
  - Exclusion of internal review documents from submission manifests.
- **Frontend Vitest Suite**: 62 passed across 8 test suites (`tests/phase8_packages_forms_readiness.test.tsx`, `tests/dashboards.test.tsx`, `tests/phase7_client_portal.test.tsx`, etc.).
- **Production Build**: Next.js production build (`npm run build`) completed with 0 errors and optimal static optimization.
