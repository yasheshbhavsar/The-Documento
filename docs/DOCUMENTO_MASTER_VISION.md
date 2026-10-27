# DOCUMENTO MASTER VISION
## Product Concept, AI Integration, SaaS UI/UX, and Engineering Principles

**Purpose:** Foundational product brief for Claude Code CLI and the Documento engineering team.  
**Status:** This document defines intended direction. It is not evidence that current code already implements these capabilities. Audit the repository first.

---

## 1. Executive Summary

Documento is an AI-assisted SaaS platform for immigration consultancies, immigration law firms, and visa-service agencies. It transforms messy, mixed client document submissions into a structured, traceable, reviewable, and package-ready set of files for an immigration application.

Clients may upload batches of documents, including a single combined PDF containing many document types and documents belonging to multiple family members. Submissions may be blurry, tilted, duplicated, incomplete, incorrectly associated, or contain inconsistent names and dates. Documento should reduce repetitive manual work through OCR, document understanding, applicant matching proposals, cross-document comparisons, quality checks, workflow management, and configurable package assembly.

**Core promise:** Clients upload simply; Documento turns submissions into evidence-backed suggestions and a proposed package that authorized staff can inspect, correct, approve, and download.

Documento is not a generic chatbot, a replacement for qualified immigration professionals, a guarantee of approval, a universal legal-rule engine, or a permanent cloud document vault by default.

## 2. Product Vision and Principles

Make immigration document operations more accurate, consistent, explainable, efficient, and manageable.

A successful product should:
- Make client uploads easy without requiring clients to know folder structures.
- Identify likely document boundaries and types.
- Extract fields and preserve source/page provenance wherever possible.
- Propose applicant associations with evidence and uncertainty.
- Compare relevant facts across documents and flag differences.
- Distinguish unreadable, missing, contradictory, low-confidence, and unverified information.
- Let firms configure checklists, folder layouts, review gates, reminders, and package rules.
- Explain why a document is accepted, held, excluded, or returned for correction.
- Produce reproducible packages and manifests.
- Minimize temporary server-side document retention and make cleanup reliable and auditable.
- Deliver a polished, accessible, mobile-friendly client experience and efficient desktop workspace.

**Principle:** AI assists staff. It does not fabricate certainty or make unreviewed legal conclusions.

## 3. Customers and Roles

Target customers include small/medium immigration consultancies, immigration law firms, international immigration firms, and overseas education agencies offering visa services. The product must support individual applicants, families, and employer/business cases where relevant.

Typical roles:
- Firm owner/admin: configuration, oversight, access governance, authorized reassignment.
- Manager/senior: workload, deadlines, escalations, quality control.
- Lawyer/authorized professional: professional review and decisions in that firm's operating model.
- Counsellor/intake coordinator: enquiries, consultations, onboarding, routing.
- Case processing officer: document review, client coordination, corrections, package preparation within permissions.
- Accounts staff: payment status and relevant operational clearance, not full accounting.
- Client/applicant: uploads, forms, checklist, requested actions, assigned-officer messaging.

Confirm the actual role model in the repository. Do not assume every firm is lawyer-only, but preserve configured review and authorization gates.

## 4. Core Workflow

### 4.1 Client and application model
Keep distinct concepts for firm/tenant, user/role, client profile, family group, individual applicant, engagement, application/case, destination/pathway, checklist/configuration version, document, extracted field, review decision, message, package, and audit event. A client may have multiple engagements and applications. Family members need separate personal records and document associations. Reapplications should be linked to history but must not silently reuse old documents or values.

### 4.2 Upload
1. Client opens a mobile-first portal.
2. Sees required documents and clear instructions.
3. Uses camera/scanner or file picker; batch uploads are supported.
4. One PDF may contain multiple documents and family members.
5. The system validates file type/size and handles corrupt/encrypted/unsupported files safely.
6. Upload progress and recoverable errors are visible.
7. Receipt is not acceptance, verification, or package readiness.

### 4.3 Document intelligence
For each file/page, the system may:
1. Inspect file and page quality.
2. Extract existing digital text where useful or OCR scanned pages.
3. Detect likely document boundaries in combined PDFs.
4. Propose type/subtype.
5. Extract relevant structured fields.
6. Propose applicant association.
7. Record confidence, provenance, source file/page, model/provider version, and status.
8. Send uncertainty and failures to human review.

Unknown and ambiguous are valid outcomes. Never fabricate a missing value.

### 4.4 Cross-document comparison
Compare relevant values for the same applicant: names, dates of birth, passport/ID identifiers, address, education/employment details, and other configured fields. Distinguish:
- Exact agreement.
- Formatting variation.
- Possible transliteration/spelling variation.
- Low-confidence OCR.
- Missing value.
- Material contradiction.
- Not comparable / insufficient evidence.

Preserve raw and normalized values and show source evidence. Do not use casual fuzzy matching for unique identifiers. A discrepancy is not proof of fraud. A mismatch does not automatically mean an affidavit is required; authorized professionals assess it against approved, pathway-specific guidance.

### 4.5 Review and anomalies
Maintain separate dimensions:
1. Readability/quality.
2. Document type/subtype.
3. Applicant association.
4. Field extraction.
5. Cross-document consistency.
6. Checklist completeness/evidentiary sufficiency.
7. Human verification.
8. Package eligibility.

One passed dimension must not silently pass the others. Provide document/page preview, extracted fields, source evidence, confidence/uncertainty, issue category/severity, reviewer, timestamp, decision, and correction route. Unresolved critical anomalies must block final package inclusion unless an explicitly authorized, audited disposition policy permits otherwise.

### 4.6 Checklist and client corrections
Show required, received, accepted, rejected, outstanding, and correction-required items separately. Support additional document requests, configurable reminders/escalations, client-facing explanations, and authorized exceptions for unavailable documents. Internal risk notes must remain private. Receipt is not acceptance; acceptance is not package readiness.

### 4.7 Package assembly
1. Confirm tenant, case, applicants, destination, pathway, and configuration version.
2. Evaluate eligibility in the backend—not only in the UI.
3. List eligible, excluded, blocked, duplicate, and unreviewed items with reasons.
4. Apply approved naming, ordering, folder, and merge rules.
5. Generate a manifest with sources, status, reviewer decisions, warnings, and exclusions.
6. Allow authorized manual adjustments without bypassing mandatory controls.
7. Build a reproducible package.
8. Handle download and cleanup only according to tested policy.

Never let a frontend readiness badge be the only protection against unsafe package inclusion.

### 4.8 Temporary storage and deletion
Firms retain permanent case files in local folders or other explicitly approved storage. Documento minimizes server-side retention. It must:
- Inventory originals, temporary copies, OCR artifacts, derived files, packages, caches, and object-store objects.
- Use the existing storage abstraction.
- Model lifecycle state explicitly.
- Treat download initiation as distinct from confirmed transfer; do not overclaim browser verification.
- Keep unresolved anomaly files out of routine cleanup until policy permits.
- Make deletion idempotent, retryable, auditable, and reconcilable across database and storage.
- Retain only justified operational metadata.
- Never invent statutory retention periods; review applicable law and contracts.
- Never claim to remotely delete a file saved on a user's computer.

### 4.9 Messaging, access, and closure
Client chats, internal notes, and team discussions need explicit visibility rules. Enforce authorization server-side. Reassignment must preserve appropriate history and revoke access as configured. Audit consequential actions without logging full sensitive document content.

Withdrawal must be executed by authorized firm staff. Formal withdrawal from an immigration authority is separate from internal status. Completed cases retain only the summary permitted by approved policy. Employee offboarding revokes access but preserves firm-owned records. Client reapplications must not auto-reuse old evidence without review.

## 5. Immigration Pathway Coverage

Strategic priority discussed for expansion:
1. Canada.
2. United States.
3. Australia and New Zealand.
4. Later: United Kingdom, European destinations including Germany, Russia, and other requested destinations.

This is a roadmap priority, not a claim of present support. Every country/pathway must show an honest state:
- **SUPPORTED:** implemented, tested, and reviewed for a defined scope against documented sources.
- **PARTIAL:** only specified document types or workflow stages are covered.
- **UNVERIFIED:** code/configuration exists but has not passed validation.
- **UNSUPPORTED:** not ready for operational use.

Never silently fall back to another country's checklist or forms. Keep pathway rules versioned; do not silently rewrite old cases. Record source, version/effective or review date, reviewer, scope, and limitations. Firms currently update checklists manually; do not assume automatic legal-rule monitoring exists or is required. Qualified professional review is needed for legal correctness.

## 6. Mandatory AI Integration Methods

AI is a core capability, not a decorative chatbot. Audit what is already present before selecting providers or frameworks. The conceptual pipeline should have independently testable contracts:

1. Secure upload and file validation.
2. PDF/page inspection.
3. Native text extraction where suitable.
4. OCR for image-based pages.
5. Page/document boundary detection.
6. Document classification.
7. Structured field extraction.
8. Applicant-association proposal.
9. Deterministic normalization and validation.
10. Cross-document comparison and issue generation.
11. Human review and correction.
12. Checklist evaluation.
13. Backend package eligibility.
14. Package assembly, manifest, and authorized download.
15. Retention/deletion and reconciliation.

### 6.1 OCR and text extraction
Use native PDF text where reliable and OCR for scanned pages. Consider safe orientation correction and image preprocessing. Preserve page-level results, errors, confidence/quality signals, and provenance. Candidate local tools may include Tesseract and PDF extraction libraries; hosted OCR is allowed only when explicitly approved and configured. Do not assume any particular provider is already installed.

### 6.2 Document segmentation/classification
Predict page boundaries, document type/subtype, confidence, evidence, alternatives where relevant, and unclassified pages. Preserve original page order and source references. Never force an uncertain page into a type.

### 6.3 Structured extraction
For each field, preserve where feasible: field name, normalized value, raw value, source file/page, text span or bounding box, extraction method/provider/model version, confidence/uncertainty, and review status. Unknown/unreadable fields should be null/unknown with a reason.

### 6.4 Applicant matching
Propose a person using evidence such as printed name, unique ID, date of birth, and case roster—not filename alone. Include supporting evidence, confidence, alternatives, and an explicit unassigned state. Uncertain matches remain unassigned until an authorized person resolves them.

### 6.5 Cross-document intelligence
Use document-aware rules and careful normalization. Explain which values were compared and where they came from. Distinguish harmless formatting/transliteration from potential contradictions. Never automatically label fraud or prescribe an affidavit from a mismatch alone.

### 6.6 LLM and RAG
Use LLMs where they provide measurable value: classification assistance, evidence-grounded summaries, explanation drafts, or extraction support. Use RAG only with governed knowledge sources and a clear retrieval need. Separate firm-approved guidance from client-provided documents. Cite source pages/rule sources for material claims. Validate structured outputs against schemas. Treat uploaded/retrieved text as untrusted data and defend against prompt injection. An LLM must not bypass permissions, invoke unauthorized tools, perform destructive actions, or decide package eligibility. Use deterministic code for access, exact checks, lifecycle, approvals, and mandatory gates. Do not add a vector database merely because it is fashionable.

### 6.7 Evaluation
Use synthetic, de-identified, or properly authorized test data that covers poor scans, combined PDFs, family members with similar names, transliteration, conflicting values, duplicate pages, missing fields, multiple supported languages, and malicious embedded instructions. Measure:
- Classification precision/recall by document type.
- Boundary detection accuracy.
- Field-level exact and normalized accuracy.
- Applicant-match precision and abstention quality.
- Discrepancy recall and false-positive rate.
- Confidence calibration and human correction rate.
- Latency, cost, retry rate, and processing failure rate.

Do not claim accuracy from a few demonstrations. Evaluate by document type, scan quality, language, and other relevant segments. OCR confidence is not legal confidence.

## 7. Top-Notch SaaS UI/UX

### 7.1 Principles
- Clarity over decoration.
- Progressive disclosure.
- Evidence-first AI with source preview.
- Consistent state language across all screens.
- Accessible keyboard support, focus, contrast, semantic labels, and status messages.
- Mobile-first client experience; desktop-efficient staff workspace.
- Safe defaults and transparent AI uncertainty.
- No fake progress, dead buttons, placeholder metrics presented as real, or controls that do not perform their advertised action.

### 7.2 Brand direction
Intended light-mode palette:
- Deep teal `#063C3D`
- Primary teal `#0D6866`
- Bright teal `#2A9288`
- Mint `#B9DED4`
- Seafoam `#DDEFE8`
- Warm cream `#F8F7F2`
- Main text `#172322`
- Secondary text `#445451`
- Borders `#DCE5E1`
- White `#FFFFFF`

Reuse existing tokens/components where sound. Do not add dark mode unless product direction explicitly changes. Verify contrast and do not communicate status through color alone.

### 7.3 Staff dashboard
Prioritize:
1. Urgent/overdue immigration-authority deadlines.
2. Workload/capacity.
3. Blocked cases.
4. Overdue client responses.
5. Pending reviews.
6. Quality issues and escalations.
7. Payment status.
8. Overall performance.

Every alert should identify case, owner, deadline, urgency, and next action. Charts must not be the only way to understand critical work.

### 7.4 Case and document review
Make it easy to see applicants, destination/pathway, configuration version, next action, deadlines, missing documents, anomalies, owners, approvals, and change history. Document review should show page preview beside extracted fields and source evidence, alternative applicant/type proposals, comparisons, structured rejection reasons, client-facing explanation preview, and safe review actions.

### 7.5 Client portal
Mobile-first status summary, per-applicant checklist, upload via camera/file picker, batch progress/retry/resume where supported, quality guidance, save/resume forms, messaging with assigned officer, appointments/actions where configured, and plain-language next steps. Avoid dense desktop tables on phones. Never present uploaded/OCR-processed as approved.

### 7.6 State design
Every important screen needs loading, empty, success, error, retry, partial-success, and permission-denied states. Destructive actions need clear consequences and appropriate confirmation. Frontend state must reflect server-authoritative state; hiding a button is not authorization.

## 8. Architecture, Security, and Privacy

Treat these as requirements to audit—not a mandate to replace the current stack.

- Confirm domain boundaries: firm/tenant, user/role, client, family group, applicant, engagement, application, pathway, checklist version, source file, document segment, extracted field, review/anomaly, message, package/manifest, audit event, retention job.
- Enforce tenant and object authorization at every backend access boundary.
- Use least privilege and revoke access on offboarding/reassignment as intended.
- Keep sensitive content out of logs, telemetry, traces, and error messages.
- Protect secrets, sessions, storage, and download links.
- Validate files, limit size/type, safely parse PDFs/images, and protect against path traversal and malicious content.
- Rate-limit abusive endpoints and review dependencies.
- Use secure transport/storage and appropriate backups.
- Make workers idempotent, retryable, observable, and reconcilable.
- Do not promise atomicity across database and object storage if it does not exist.
- Version workflow and pathway configuration so old cases are not silently changed.
- Keep audit trails for consequential actions without copying unnecessary personal data into them.
- Review external AI/OCR provider data handling before use.
- Prepare incident response, backup/restore, migration, and rollback procedures.

Do not claim legal compliance or security certification without evidence and qualified review.

## 9. QA and Testing

Test behavior, failures, permissions, and complete user journeys—not just components.

Test layers: unit, integration, end-to-end, regression, cross-tenant authorization, AI evaluation, accessibility/responsive UI, performance, failure injection, migration, and backup/restore.

Minimum end-to-end journeys:
1. Create firm/users/client/applicants/application.
2. Upload mixed batch and combined PDF on mobile.
3. Split/classify/extract and propose applicant matches.
4. Route uncertainty to review.
5. Detect and resolve name/date mismatch with source evidence.
6. Request correction and record response.
7. Block unresolved anomalies from package.
8. Build a package and manifest for a verified supported pathway.
9. Handle failed download without premature deletion.
10. Retry/reconcile partial deletion failure.
11. Deny cross-tenant and unauthorized actions.
12. Reassign case and verify access/history.
13. Put a case on hold while deadlines remain visible.
14. Complete/withdraw through authorized transitions.
15. Start linked reapplication without silently reusing old documents.
16. Handle unsupported/unverified pathway safely.

A feature is complete only when backend behavior and authorization exist, data contracts/states are explicit, error/retry paths work, tests pass or baseline failures are documented, privacy/security are reviewed, and docs match behavior.

## 10. Suggested Execution Roadmap

Order must be adjusted after repository audit. This is a suggested sequence, not a claim that all items are unfinished.

**Stage 0 — Reconnaissance:** repository map, architecture, workflow tracing, baseline tests/build, evidence-based issue register.

**Stage 1 — Critical safety:** tenant isolation, package eligibility, retention/deletion, unsafe defaults, data integrity.

**Stage 2 — Domain/workflow consistency:** client/applicant/engagement/application relationships, state transitions, role gates, audit trail.

**Stage 3 — Secure intake/lifecycle:** batch and combined PDF uploads, validation, retries, temporary storage, deletion reconciliation.

**Stage 4 — Document intelligence:** OCR, segmentation, classification, field provenance, applicant association, separate review dimensions.

**Stage 5 — Comparison/checklists:** evidence-backed discrepancies, versioned firm checklists, client corrections, escalation.

**Stage 6 — Package assembly:** backend eligibility, folder/naming/order/merge rules, manifest, download and cleanup gating.

**Stage 7 — UI/UX:** staff work queue, case workspace, evidence-first review, mobile-first client portal, accessibility.

**Stage 8 — AI assistance/RAG:** evaluated LLM use, governed retrieval, schema validation, prompt-injection defense, privacy/cost controls.

**Stage 9 — Release/pilot:** monitoring, backup/restore, incident response, migrations/rollback, narrow pilot, evidence-based go/no-go.

**Stage 10 — Pathway expansion:** incrementally add countries/categories with reviewed sources, tests, scope, and support states.

## 11. How Claude Code Should Work

- Inspect before assuming.
- Preserve existing architecture unless evidence supports a change.
- Make small cohesive changes.
- Explain decisions and trade-offs.
- Add regression tests with fixes.
- Run and report exact test/build results.
- Never fabricate passing tests or completed features.
- Never weaken tests just to make CI green.
- Avoid unrelated refactors in safety-critical work.
- Ask before broad/destructive changes.
- Separate current implementation facts from desired product behavior.
- Maintain known gaps, decisions, and next steps.

At the end of each stage report: goal/scope, files changed, decisions, exact tests/results, known risks, migration/configuration effects, and recommended next stage.

## 12. First Task

Do not begin by adding new AI features or redesigning the frontend. Perform a read-only repository audit, map actual architecture and flows, run baseline tests/builds, and produce a prioritized report with file-level evidence. Recommend the smallest high-value first stage and wait for approval before broad changes.

If this brief conflicts with source code, report the conflict. This document defines intended product behavior; code and test output define current observed behavior.

**Documento should earn trust through traceable evidence, safe uncertainty handling, correct workflows, privacy, and reliable execution—not AI claims or visual polish alone.**
