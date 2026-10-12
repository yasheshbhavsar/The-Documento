# Phase 4 — Document Management, OCR, and Structured Extraction

## Intended Outcome
Deliver a secure, asynchronous document-processing system for the AI Immigration SaaS platform that provides:
1. **Secure Upload Pipeline**: Authorized upload sessions, file size and MIME validation, magic-byte signature validation, malware scanning, private storage isolation, SHA-256 integrity hashing, document versioning, upload idempotency, and short-lived signed download tokens.
2. **Document Processing & OCR Engine**: PyMuPDF vector text extraction, page-level block layout and bounding box detection, OCR fallback for scanned raster documents, language detection heuristics, automated classification across 12 configurable immigration categories, and structured field extraction with value normalization.
3. **12 Configurable Categories**: Passports & identity, civil-status & family, existing visas & permits, educational records, employment records, financial evidence, travel records, insurance & accommodation, police & medical, government correspondence, translations & certifications, and other supporting evidence.
4. **Data Provenance & Decoupled Verification Gate**: Complete field-level provenance (source document, version, page, bounding boxes, original extracted value, normalized value, extraction method, model/rule version, separate OCR and extraction confidence, validation status, and human correction history). **Crucially, automated OCR and structured LLM extraction never automatically certify a document as legally verified** (`verification_status` remains strictly `"unverified"` until an authorized caseworker certifies it). Reprocessing preserves all human corrections and audit trails.
5. **Interactive UI Dossier Inspector**: Document library with search, 12-category filter, processing and verification status filters, document dossier inspector modal (`DocumentInspectorModal`) with tabs for Extracted Fields & Provenance, Preview & OCR Text, Human Verification & Caseworker Certification, and Version History.
6. **Automated Test Coverage**: Comprehensive test suites across Python backend (48 passing tests) and TypeScript React frontend (20 passing tests), validating magic-byte enforcement, malware blocking, tamper detection, idempotency, versioning, provenance retention, and multi-tenant isolation.

---

## 1. Architecture Overview

```
                                      +---------------------------------------------+
                                      |            Client Web Application           |
                                      |   - Client-side Magic Signature Checking    |
                                      |   - Client-side WebCrypto SHA-256 Hashing   |
                                      |   - 12-Category Document Upload Modal       |
                                      |   - Document Dossier Inspector Modal        |
                                      +----------------------+----------------------+
                                                             |
                                         HTTPS Multipart / Bearer Token
                                                             v
+------------------------------------------------------------+------------------------------------------------------------+
|                                                   FastAPI Backend Core                                                  |
|                                                                                                                         |
|  [Security & Validation Gate]                                                                                           |
|  1. Tenant & Object-Level Access Check                                                                                  |
|  2. Upload Session Verification (Expiry, Case Boundary)                                                                 |
|  3. Magic-Byte Validation (%PDF-, \xFF\xD8\xFF, \x89PNG, TIFF, RIFF/WEBP) & Executable Blocker (MZ, ELF, Mach-O, Scripts) |
|  4. Antivirus Scanner Integration (EICAR signature & malicious heuristics)                                              |
|  5. SHA-256 Calculation & Idempotency Key Deduplication Check                                                          |
|                                                                                                                         |
|  [Storage Layer]                                                                                                        |
|  - Private Isolated Object Storage: {tenant_id}/{case_id}/{document_id}/v{version}_{filename}                           |
|  - S3 / MinIO with seamless local filesystem fallback                                                                   |
|                                                                                                                         |
|  [OCR, Classification & Structured Extraction Engine]                                                                   |
|  1. PyMuPDF Text & Geometry Extraction (PageBlock bounding boxes: x0, y0, x1, y1)                                       |
|  2. Scanned Raster PDF / Image OCR Fallback                                                                             |
|  3. Language Detection (EN, ES, FR, DE, RU, UK, ZH, AR, HI)                                                              |
|  4. 12-Category Rule & Keyword Classifier                                                                               |
|  5. Structured Field Extractor (MRZ, Degree, Employer, Financials)                                                       |
|  6. Normalization Engine (Dates -> YYYY-MM-DD, Countries -> ISO-3, Currency Amounts)                                    |
|  7. Human Correction Preservation (is_manually_corrected = True retained across reprocessing)                           |
|                                                                                                                         |
|  [Decoupled Verification Gate]                                                                                          |
|  - processing_status = "completed" | verification_status = "unverified" (Strictly requires human caseworker signoff)     |
+-------------------------------------------------------------------------------------------------------------------------+
```

---

## 2. Secure Upload Pipeline

### A. Upload Sessions (`DocumentUploadSession`)
- Upload sessions are created via `POST /api/v1/documents/upload-sessions` with a 30-minute expiry window (`expires_at`), pre-validating tenant boundaries, target case ID, and authorized user permissions.

### B. Magic-Byte Signature Validation & Executable Blocker
- MIME types declared in HTTP headers are untrusted. The backend inspects raw binary magic numbers:
  - **PDF**: `%PDF-` (`0x25 0x50 0x44 0x46 0x2D`)
  - **JPEG**: `\xFF\xD8\xFF`
  - **PNG**: `\x89PNG\r\n\x1a\n` (`0x89 0x50 0x4E 0x47`)
  - **TIFF**: `II*\x00` (little-endian) or `MM\x00*` (big-endian)
  - **WebP**: `RIFF....WEBP`
- Dangerous executable signatures are strictly rejected with HTTP 400 (`SecurityValidationError`):
  - Windows PE executables (`MZ` / `0x4D 0x5A`)
  - Linux ELF binaries (`\x7FELF`)
  - macOS Mach-O binaries (`\xFE\xED\xFA\xCE`, `\xCF\xFA\xED\xFE`)
  - Shell / script payloads (`#!/bin/sh`, `#!/bin/bash`, `<?php`)

### C. Antivirus & Malware Scanning Integration
- Integrated `MalwareScanner` checks uploaded streams against known virus patterns, including the EICAR standard antivirus test string and heuristic embedded executable patterns.
- Detected threats immediately fail the upload with HTTP 400 (`MalwareDetectedError`), recording a security audit alert.

### D. Private Object Storage Isolation & Immutability
- Files are stored in tenant-isolated paths:
  `{tenant_id}/{case_id}/{document_id}/v{version}_{filename}`
- Uploads compute a cryptographic SHA-256 checksum during streaming. The hash is saved to the database. Storage downloads verify data integrity against this checksum.
- Immutability: Once uploaded, versioned files cannot be mutated in place. Revisions increment `version` and create a distinct immutable storage object.

### E. Upload Idempotency & Versioning
- Client requests may supply an `Idempotency-Key` or rely on identical content hash detection.
- Re-submitting an identical document returns the existing record immediately without duplicating storage or reprocessing.
- Uploading a new revision referencing `parent_document_id` increments `version = parent.version + 1`, marks the previous record `is_current_version = False`, and preserves the full revision history.

### F. Short-Lived Signed Download Access
- Documents in private storage are never publicly accessible.
- Downloads and previews require a short-lived HMAC-SHA256 JWT access token (`generate_download_token`) with a 15-minute expiration, scoped strictly to the authorized tenant and user.

---

## 3. Document Processing, OCR & Structured Extraction Engine

### A. PDF Text & Layout Extraction
- Powered by `PyMuPDF` (MuPDF vector engine):
  - Extracts text spans with font names, font sizes, and precise coordinate rectangles (`x0, y0, x1, y1`).
  - Groups spans into structural blocks (`PageBlock`).
  - Detects scanned or image-only pages when vector text density is below threshold, seamlessly invoking raster OCR.

### B. Language Detection Heuristics
- Analyzes character frequencies, script ranges, and linguistic token distributions:
  - English (`en`), Spanish (`es`), French (`fr`), German (`de`)
  - Russian (`ru`), Ukrainian (`uk`), Chinese (`zh`), Arabic (`ar`), Hindi (`hi`)

### C. 12 Configurable Document Categories
Configured in `backend/app/domain/models.py` (`DocumentCategory` enum):
1. `identity_passport`: Passports and identity documents
2. `civil_status`: Civil-status and family documents (birth/marriage certificates)
3. `visa_residence_permit`: Existing visas and residence permits
4. `educational_record`: Educational records (degrees, transcripts, diplomas)
5. `employment_record`: Employment records (experience letters, contracts, pay slips)
6. `financial_evidence`: Financial evidence (bank statements, tax returns, audits)
7. `travel_record`: Travel records (flight itineraries, boarding passes, I-94)
8. `insurance_accommodation`: Insurance and accommodation evidence (leases, health policies)
9. `police_medical`: Police and medical documents (clearance certificates, medical exams)
10. `government_correspondence`: Government forms and correspondence (USCIS notices, RFEs)
11. `translation_certification`: Translations and certified affidavits
12. `other_evidence`: Other supporting evidence

### D. Structured Field Extraction & Normalization
- Category-specific extractors extract key domain fields:
  - **Passports**: Passport number, surname, given names, date of birth, nationality, expiration date, issuing country.
  - **Educational Records**: Degree title, institution name, graduation date, major/field of study, country of education.
  - **Employment Records**: Employer name, job title, start date, end date, annual salary, signatory name.
  - **Financial Records**: Financial institution, account holder name, statement period start/end, ending balance, currency.
  - **Government Notices**: Receipt number, petitioner/applicant name, form type, notice date, priority date.
- **Dual Preservation**:
  - `original_value`: Exact character sequence as extracted by OCR/parser.
  - `normalized_value`: Standardized value for immigration petition forms (dates formatted as `YYYY-MM-DD`, countries as ISO 3166-1 alpha-3, numeric currencies standardized).

---

## 4. Data Provenance & Decoupled Verification Gate

### A. Field-Level Provenance Metadata
For every extracted field (`DocumentExtractedField`), the database retains:
- `document_id` and `document_version`: Lineage origin
- `source_page`: 1-indexed page number
- `source_location`: JSON coordinates `{"x0": ..., "y0": ..., "x1": ..., "y1": ..., "block_idx": ...}`
- `original_value`: Raw extracted string
- `normalized_value`: Standardized string
- `extraction_method`: Parser method (`pymupdf_mrz_parser`, `pymupdf_academic_parser`, etc.)
- `model_version`: Parser or model version (`rule_mrz_v2.1`, `rule_academic_v1.2`, etc.)
- `ocr_confidence`: Confidence score from the OCR engine (0.0 to 1.0)
- `extraction_confidence`: Confidence score from the structured extraction rule (0.0 to 1.0)
- `validation_status`: `"unvalidated"`, `"verified"`, or `"flagged"`
- `is_manually_corrected`: Boolean indicating human intervention
- `correction_history`: Full audit trail of human corrections with caseworker ID, timestamp, prior value, corrected value, and legal justification reason

### B. Decoupled Verification Gate
> **Critical Legal Rule**: An immigration SaaS platform must never mark an evidentiary document as legally verified simply because OCR or an AI model successfully extracted text from it.
- Automated extraction sets `processing_status = "completed"`.
- However, `verification_status` remains strictly `"unverified"`.
- Only an authorized caseworker or legal reviewer can transition a document to `"verified"`, `"under_review"`, or `"rejected"` via `PUT /api/v1/documents/{doc_id}/verify`, providing certification notes.

### C. Human Correction Preservation on Reprocessing
- When a caseworker updates or corrects an extracted field via `PUT /api/v1/documents/{doc_id}/fields/{field_id}`, the change is recorded with mandatory legal justification.
- When a document is reprocessed (e.g. improved OCR engine or updated category rules via `POST /api/v1/documents/{doc_id}/reprocess`), any field with `is_manually_corrected = True` is preserved immutably. The automated extractor does not overwrite human caseworker corrections.

---

## 5. Frontend UI Implementation

### A. Document Library
- Accessible from both the Employee Workspace and the Client Transparency Portal.
- Real-time search across document title, filename, and extracted text.
- Category filter across all 12 configurable immigration categories.
- Verification status filter (`All`, `Verified`, `Unverified`, `Under Review`, `Rejected`).
- Provenance badge showing count of extracted fields and tamper verification status.

### B. Document Dossier & Provenance Inspector (`DocumentInspectorModal`)
- **Header**: Document title, version badge, category badge, SHA-256 fingerprint, detected language, page count, extraction method, processing status badge, legal verification status badge, reprocess button, and secure download link.
- **Tab 1: Extracted Fields & Provenance**:
  - Interactive table displaying Field Label, Original Value, Normalized Value, Page & Bounding Box, Separate OCR vs Extraction Confidence percentages, Validation Status, and Human Correction history.
  - Caseworkers can click "Edit" to open the inline correction modal, enter a corrected value, provide a mandatory legal justification reason, and save.
- **Tab 2: Preview & Extracted OCR Text**:
  - Live document preview container alongside raw extracted text with a quick-copy button.
- **Tab 3: Human Verification & Audit Trail**:
  - Clear policy notice explaining the Decoupled Verification Policy.
  - Caseworker certification form allowing status transition (`verified`, `under_review`, `rejected`) and recording notes into the immutable audit trail.
- **Tab 4: Version History**:
  - Revision table showing document version number, filename, SHA-256 hash prefix, active status (`Current Active` vs `Superseded`), and upload date.

### C. Document Upload Modal (`DocumentUploadModal`)
- Client-side pre-validation of magic bytes (rejects fake extensions).
- WebCrypto SHA-256 checksum computation for instantaneous fingerprint display.
- Dropdown with all 12 configurable categories.
- Optional revision linking (`parent_document_id`).
- Live multipart upload to the backend API.

---

## 6. Automated Verification & Test Coverage

### Backend Tests (pytest) — 48 Passed (0 Failures)
- `test_authorized_upload_session`: Validates session creation, expiration, and authorization checks.
- `test_reject_magic_byte_mismatch`: Tests uploading a file disguised as a PDF (starts with `FAKE_HEADER`), verifying HTTP 400 rejection.
- `test_reject_dangerous_executable_payload`: Tests uploading Windows PE executable disguised as `.pdf`, verifying HTTP 400 security rejection.
- `test_reject_eicar_malware`: Tests uploading the EICAR test signature, verifying malware detection and blocking.
- `test_upload_idempotency_and_sha256`: Tests duplicate uploads with identical idempotency key and content hash, verifying zero duplicate records.
- `test_document_versioning`: Tests uploading a revision linked to `parent_document_id`, verifying `version = 2`, `is_current_version = True` on v2, and `is_current_version = False` on v1.
- `test_secure_download_with_short_lived_token`: Tests token generation, token verification, and download access.
- `test_passport_mrz_and_field_extraction`: Tests MRZ parser extracting passport number, full name, DOB, country, bounding boxes, and OCR confidence.
- `test_diploma_extraction_and_classification`: Tests educational record classification and structured degree field extraction.
- `test_employment_letter_extraction`: Tests employment record classification and employer/salary extraction.
- `test_financial_statement_extraction`: Tests bank statement classification and balance extraction.
- `test_human_verification_workflow`: Validates decoupled verification gate (`processing_status = "completed"` with `verification_status = "unverified"`, transitioning to `"verified"` upon human signoff).
- `test_field_correction_provenance_and_reprocessing`: Validates manual correction audit trail and ensures corrections are preserved across reprocessing.
- `test_cross_tenant_document_isolation`: Validates that Organization B cannot retrieve or access documents owned by Organization A.

### Frontend Tests (Vitest) — 20 Passed (0 Failures)
- `tests/phase4_documents.test.tsx`:
  - `renders DocumentUploadModal with 12 configurable categories and security notes`
  - `renders DocumentInspectorModal with extracted fields, original vs normalized values, and OCR confidence`
  - `allows legal staff to make manual field corrections with required audit justification`
  - `enforces decoupled legal verification policy and records caseworker notes`
  - `displays version history and integrity lineage`
- `tests/dashboards.test.tsx`: Owner, Employee, and Client dashboards render properly.
- `tests/phase3_case_management.test.tsx`: Case management workflows and modals pass.
- `tests/components.test.tsx`: Common UI components pass.

### Production Build Verification
- `next build`: Turbopack production compilation succeeded with zero TypeScript or JSX errors.
