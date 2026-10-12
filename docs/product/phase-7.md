# Phase 7 — Client Portal, Requests, Messaging, and Notifications

## Overview

Phase 7 delivers the complete client communication and evidence-collection workflow for modern immigration casework. It bridges legal case teams and immigrant clients with a secure, transparent, mobile-responsive portal that eliminates opaque black-box waiting periods while upholding strict regulatory privacy boundaries.

Key capabilities delivered in Phase 7:
1. **Client Onboarding & Statutory Intake**: Cryptographically secure invitations, account activation, comprehensive civil and travel biodata collection, family and dependant management with granular case-viewing authorization (`is_authorized_to_view_case`), statutory questionnaires, and digital consent logging (Form G-28, representation disclosures, data processing).
2. **Statutory Document Requests**: Authorized staff create evidence requests specifying the exact document/information needed, why it is needed (statutory rationale), who must provide it, accepted MIME formats and acceptable alternatives, hard due dates, statutory requirement codes (e.g. `8 CFR § 204.5(k)(3)`), and explicit translation guidance.
3. **Evidence Response & Replacement**: Clients upload verified evidence files, submit responses, track status progression, engage in threaded Q&A notes, and replace unreadable or rejected evidence with full immutable audit history.
4. **Secure Messaging & Privacy Boundary Isolation**: Threaded messaging linked directly to cases, authorized attachment referencing, confirmed delivery and read timestamps, and **strict separation of staff-only internal notes from client-visible communications** (guaranteed at both API serialization and UI rendering levels).
5. **PII-Sanitized Notifications & Reliable Provider Delivery**: Configurable in-app and email alerts across 7 key lifecycle triggers (`new_request`, `upcoming_deadline`, `upload_completion`, `processing_failure`, `new_message`, `review_request`, `case_status_change`). All notification previews strictly redact sensitive immigration identifiers (passports, SSNs, Alien registration numbers, medical/asylum grounds). Delivery states (`queued` -> `sent` -> `delivered`/`failed`) are tracked honestly and never marked delivered without provider confirmation.
6. **Transparent Client Experience ("Waiting on You" vs. "Waiting on the Firm")**: Prominent waiting state breakdown showing clients exactly what is blocking their petition, who is responsible, and the single immediate next action required.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│             PHASE 7 CLIENT PORTAL, REQUESTS & MESSAGING SYSTEM              │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
       ┌───────────────────────────────┼───────────────────────────────┐
       ▼                               ▼                               ▼
┌────────────────────────────┐   ┌───────────────────────────┐   ┌────────────────────────────┐
│ Client Onboarding Wizard   │   │ Document Request Engine   │   │ Secure Messaging Hub       │
│ • Secure Activation & PWD  │   │ • Staff Request Issuance  │   │ • Case-Linked Threads      │
│ • Statutory Consents (G-28)│   │ • Statutory Citations     │   │ • Client-Visible Messages  │
│ • Applicant Biodata        │   │ • Translation Guidance    │   │ • 🔒 Staff Internal Notes  │
│ • Dependant View Access    │   │ • Upload / Replace Flow   │   │   (Strict Isolation)       │
│ • Guided Questionnaire     │   │ • Staff Review Modal      │   │ • Confirmed Read/Delivered │
└──────────────┬─────────────┘   └─────────────┬─────────────┘   └─────────────┬──────────────┘
               │                               │                               │
               └───────────────────────────────┼───────────────────────────────┘
                                               │
                                               ▼
                              ┌───────────────────────────────────┐
                              │ Transparency & Waiting Engine     │
                              │ • "Waiting on You (Client)"       │
                              │ • "Waiting on the Firm"           │
                              │ • Immediate Next Action Banner    │
                              │ • Filing Readiness Progress Meter │
                              └─────────────────┬─────────────────┘
                                                │
                                                ▼
                              ┌───────────────────────────────────┐
                              │ Notification Dispatcher & Privacy │
                              │ • PII Redaction / Sanitization    │
                              │ • State Machine (queued/sent/dlv) │
                              │ • Safe Exponential Retry Logic    │
                              │ • Cross-Client Isolation Tests    │
                              └───────────────────────────────────┘
```

---

## A. Client Onboarding Workflow

### 1. Invitation & Activation
- Staff initiates an invitation via `POST /api/v1/portal/invitations` specifying the client email, case ID, and role.
- Generates a cryptographically secure token with expiry and stores in the invitation registry.
- Client activates their account via `POST /api/v1/portal/activate`, setting their secure password and agreeing to authentication requirements.

### 2. Multi-Step Onboarding Wizard (`ClientOnboardingWizard.tsx`)
A 5-step guided intake wizard designed for high completion rates and legally sound consent collection:
- **Step 1: Legal & Privacy Consents**: Disclosures for legal representation, Form G-28 Notice of Entry of Appearance consent, and cryptographic data processing and verification consent.
- **Step 2: Applicant Civil Biodata**: Full legal name, date of birth, country of citizenship and birth, current passport number and expiration, current residential address, and primary contact details.
- **Step 3: Family & Authorized Dependants**: Add derivative beneficiaries (spouse, minor children). Each dependant includes an explicit `is_authorized_to_view_case` toggle. Only authorized dependants can view shared case timelines and filings.
- **Step 4: Statutory Intake Questionnaire**: Case-specific questionnaires (e.g. EB-1A extraordinary ability criteria, NIW substantial merit and national importance narrative, O-1A advisory opinions).
- **Step 5: Review & Activation**: Comprehensive summary validation with immediate submission to the legal team and activation of the client portal.

---

## B. Document Request Lifecycle

### 1. Staff Request Creation
Authorized staff issue document requests via `POST /api/v1/requests/` or the "+ Issue Document Request" modal in `DocumentRequestManager.tsx`:
- **Document Title / Requested Evidence**: Clear description of what document is needed.
- **Legal Rationale & Justification**: Plain-language legal justification explaining *why* the evidence is required to satisfy statutory scrutiny.
- **Statutory Requirement Code**: Exact statutory regulation code (e.g. `8 CFR § 204.5(k)(3)`, `EB1A-CRIT-MEMBERSHIP`, `8 CFR § 103.2(b)(3)`).
- **Who Must Provide**: Principal applicant or specific derivative dependant.
- **Accepted Formats & Alternatives**: Configured MIME types (`application/pdf`, `image/jpeg`, `image/png`) and acceptable secondary alternatives if primary records are unavailable (e.g., official registrar transcript with degree conferral letter in lieu of original diploma).
- **Due Date**: Hard evidentiary submission deadline.
- **Translation Guidance**: Explicit instructions for foreign-language documents, including certified English translation standards under 8 CFR § 103.2(b)(3) and American Translators Association (ATA) credentials.

### 2. Status Progression Machine
```
[requested] ──(client uploads)──> [submitted] ──(staff review)──> [approved]
     ▲                                   │
     │                                   ▼
     └──────(client replaces)───── [rejected]
```
- `requested`: Awaiting client evidence upload.
- `submitted`: Client has uploaded evidence file and submitted notes; queued for staff adjudication.
- `approved`: Staff reviewed and confirmed evidence satisfies statutory requirement.
- `rejected`: Staff rejected evidence due to defect (e.g., blurred scan, missing signature, lack of certified translation) with structured resubmission feedback.
- `cancelled`: Request rescinded by case manager.

### 3. Evidentiary Replacement & Audit Trail
When evidence is rejected, the client portal displays a prominent alert banner:
`⚠️ Evidence Rejected — Action Required: Resubmission Feedback from Legal Reviewer`.
The client clicks `🔄 Re-upload Evidence` to submit a replacement document. Every status transition, reviewer note, and replacement document ID is permanently logged in `status_history`.

---

## C. Secure Messaging & Privacy Boundaries

### 1. Case-Linked Messaging Hub (`SecureMessagingHub.tsx`)
- **Thread Classifications**: Threads categorized as `client_inquiry`, `case_update`, `document_request`, or `general` with unread counts and case badges.
- **Attachment Referencing**: Verified case document IDs can be attached directly to messages.
- **Delivery & Read States**: Confirmed delivery indicators (`Sent ✓`, `Delivered ✓✓`, `Read at <timestamp>`, `Failed ⚠️`).
- **Search & Filter**: Real-time filtering by status (`open`, `resolved`, `archived`) and classification type.

### 2. Staff-Only Internal Notes Isolation
- **Strict Separation**: Staff members can post private internal notes within any thread by toggling `Post as Staff-Only Internal Note`.
- **Backend API Boundary**: `GET /api/v1/messaging/threads/{thread_id}/messages` verifies the requester's role. If the caller is a client, messages where `is_internal == True` are **strictly filtered out at the SQL query level** and never transmitted in API responses.
- **UI Visual Differentiation**: In staff workspace, internal notes render with an amber privacy badge (`🔒 STAFF INTERNAL NOTE — HIDDEN FROM CLIENT`). In client view, they are completely invisible.

---

## D. PII-Sanitized Notifications & Delivery Engine

### 1. Redaction of Sensitive Immigration Identifiers
To prevent unauthorized disclosure across email subject lines, push notification banners, and OS lock screens, the notification engine (`backend/app/notifications/service.py`) sanitizes all outbound previews:
- **Passport Numbers**: Any alphanumeric sequence matching international passport patterns is redacted to `[PROTECTED PASSPORT]`.
- **Social Security Numbers (SSN)**: Patterns matching `XXX-XX-XXXX` are redacted to `[PROTECTED SSN]`.
- **Alien Registration Numbers (A-Numbers)**: Formats matching `A-XXXXXXXXX` are redacted to `[PROTECTED A-NUMBER]`.
- **Sensitive Asylum / Medical Grounds**: Grounds related to asylum claims, removal proceedings, or medical conditions are generalized to `[IMMIGRATION CASE UPDATE]`.

### 2. Provider Delivery State Machine
The platform adheres to zero false delivery claims:
```
[queued] ──(dispatch)──> [sent] ──(provider webhook)──> [delivered]
                                └──(provider bounce)───> [failed] ──(retry)──> [queued]
```
- Notifications start as `queued`.
- Transition to `sent` when handed off to the delivery provider (e.g., SMTP server, SendGrid, Twilio).
- Only transition to `delivered` when the provider returns a confirmed delivery receipt or webhook callback.
- Delivery failures trigger exponential backoff retries with jitter up to `max_retries = 3`. If retries are exhausted, the notification is marked `failed` with failure reasons logged in the audit trail.

---

## E. Client Experience & Waiting State Transparency

### 1. Dual Waiting State Breakdown (`WaitingStateBanner.tsx`)
The primary source of client anxiety in immigration processes is uncertainty over what is holding up their case. Phase 7 solves this with a clear dual-column breakdown:
- **Waiting on You (Client)**: Clear list of pending actions with due dates and priority tags (e.g. Upload IEEE Certificate, Complete Intake Questionnaire, Sign G-28 Consent).
- **Waiting on the Firm**: Real-time transparency into attorney deliverables (e.g. Attorney Petition Brief Drafting, Legal Review of Reference Letters, USCIS Final Filing Assembly).

### 2. Primary Next Action Banner
A prominent hero card at the top of the client portal shows the single most critical immediate action required (e.g. *"Upload IEEE Senior Member Grade Certificate — Due Nov 1, 2026"*), guiding the client forward with a single click.

### 3. Petition Readiness Meter
Visual filing readiness percentage tracking overall completion across questionnaires, consents, and mandatory evidentiary requests.

---

## F. Authorization & Cross-Client Isolation Tests

### 1. Backend Security Tests (`backend/tests/test_phase7_client_portal.py`)
- `test_cross_client_isolation_on_requests`: Client A cannot view or manipulate Client B's document requests (`HTTP 403 Forbidden`).
- `test_cross_client_isolation_on_threads`: Client A cannot access Client B's message threads.
- `test_client_cannot_see_internal_staff_notes`: Verifies that internal staff notes are omitted from client query results.
- `test_notification_pii_sanitization`: Validates redaction of passports, SSNs, and A-numbers.
- `test_notification_delivery_state_transitions`: Verifies `queued` -> `sent` -> `delivered` and safe failure handling.
- `test_dependant_authorization_flag`: Verifies `is_authorized_to_view_case` authorization filtering.

### 2. Frontend Test Suite (`apps/web/tests/phase7_client_portal.test.tsx`)
13 Vitest tests verifying:
- `WaitingStateBanner`: Dual-breakdown rendering, primary next action callbacks, readiness meter.
- `DocumentRequestManager`: Statutory citations, legal rationales, translation guidance, rejection callout banners, staff creation modal, and staff adjudication workflow.
- `SecureMessagingHub`: Thread list, search & filters, delivery state indicators, and strict client vs. staff internal note isolation.
- `ClientOnboardingWizard`: Navigation across all 5 intake steps and dependant viewing authorization toggling.
- `ClientPortal Integration`: Seamless integration across Overview, Evidence & Uploads, and Messages tabs.

---

## Verification Summary

| Test Suite | Tests | Status | Execution Time |
| :--- | :--- | :--- | :--- |
| **Backend Pytest** (`test_phase7_client_portal.py` & full suite) | 76 | ✅ PASS (100%) | 11.51s |
| **Frontend Vitest** (`phase7_client_portal.test.tsx`) | 13 | ✅ PASS (100%) | 1.01s |
| **Complete Web Vitest Suite** (7 test suites) | 50 | ✅ PASS (100%) | 9.25s |
| **Next.js Production Build** (`npm run build`) | All Pages | ✅ COMPILED (0 errors) | 1.30s |
