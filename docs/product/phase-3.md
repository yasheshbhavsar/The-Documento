# Phase 3 — Client, Applicant, Family, and Case Management

## Intended Outcome
Implement the core immigration case-management domain, establishing robust, production-grade workflows for:
1. Registering new clients and creating organization-specific client profiles.
2. Adding principal applicants and authorized family dependants.
3. Recording legal consents (Form G-28 representation, GDPR / data processing) and family relationships.
4. Creating immigration cases with destination jurisdiction and intended pathway.
5. Assigning case managers, lead reviewers, and petition drafters.
6. Setting internal milestones, filing roadmaps, and statutory deadlines.
7. Recording confidential internal legal strategy notes vs. client-visible communications.
8. Creating tasks with assignment of responsibility, priority, and completion tracking.
9. Controlled lifecycle state machine progression (`inquiry` → `intake` → `awaiting_documents` → `processing` → `internal_review` → `awaiting_client` → `ready_for_approval` → `approved_for_submission` → `submitted` → `decision_received` → `closed` / `archived` / `reopened`).
10. Closing, reopening, and archiving cases under strict role-based permission gates.
11. Real-time duplicate-record detection suggestions (matching email, phone, passport hash, or name within tenant).
12. Strict object-level access boundaries: retained clients only view cases and dependants they are authorized to access; employees only access permitted caseloads; company owners oversee firm records under tenant boundaries.
13. Comprehensive backend and frontend automated testing.

---

## 1. Controlled Case Lifecycle State Machine

Immigration casework stages represent **configurable workflow checkpoints**, not universal legal statuses. Case stages do not automatically infer statutory eligibility.

### Lifecycle Stages
```
inquiry
  ↓
intake
  ↓
awaiting_documents ←─────────┐
  ↓                          │
processing                   │
  ↓                          │
internal_review              │
  ↓                          │
awaiting_client ─────────────┘
  ↓
ready_for_approval
  ↓
approved_for_submission
  ↓
submitted
  ↓
decision_received
  ↓
closed ───────────→ archived
  │
  └───────────────→ reopened ──→ intake / processing
```

### Transition & Permission Rules
- **State Progression (`ALLOWED_TRANSITIONS`)**:
  - `inquiry` → `intake`, `closed`
  - `intake` → `awaiting_documents`, `processing`, `closed`
  - `awaiting_documents` → `processing`, `awaiting_client`, `closed`
  - `processing` → `internal_review`, `awaiting_documents`, `awaiting_client`, `closed`
  - `internal_review` → `awaiting_client`, `ready_for_approval`, `processing`, `closed`
  - `awaiting_client` → `processing`, `internal_review`, `ready_for_approval`, `closed`
  - `ready_for_approval` → `approved_for_submission`, `internal_review`, `closed`
  - `approved_for_submission` → `submitted`, `internal_review`, `closed`
  - `submitted` → `decision_received`, `awaiting_documents`, `closed`
  - `decision_received` → `closed`, `processing`
  - `closed` → `reopened`, `archived`
  - `archived` → `reopened`
  - `reopened` → `intake`, `processing`, `awaiting_documents`
- **Role Permissions**:
  - **Retained Clients**: Denied from altering workflow stages (`Client cannot alter case status`).
  - **Close Case**: Only `case_manager`, `company_admin`, or `master_admin` can close a case; reason is mandatory.
  - **Reopen Case**: Only `company_admin`, `master_admin`, or `case_manager` can reopen a closed/archived case; reason is mandatory.
  - **Archive Case**: Only `company_admin` or `master_admin` can archive a closed case record.

---

## 2. Duplicate-Record Detection Engine

Located in `backend/app/domain/case_service.py` (`detect_client_duplicates`), the duplicate engine protects organizations from creating redundant, overlapping, or conflicting client files within the tenant boundary:

| Match Vector | Matching Logic | Confidence | Score |
| :--- | :--- | :--- | :--- |
| **Exact Email** | Case-insensitive trimmed email match | `high` | `1.0` |
| **Passport Hash** | SHA-256 digest comparison of passport number | `high` | `0.95` |
| **Phone Digits** | Normalized alphanumeric string comparison | `medium` | `0.85` |
| **Name + Nationality** | Exact first & last name match within same country | `medium` | `0.75` |
| **Dependant Match** | Match on family dependant's name, email, or passport | `medium` | `0.70` |

---

## 3. Database Schema & Alembic Migration

Migration revision: `e6a18d34b5c7` (`phase3_case_management_domain.py`).

### New Tables
1. **`client_dependants`**:
   - `id`, `primary_client_id`, `relationship_type` (`spouse`, `child`, `parent`, `dependent`), `first_name`, `last_name`, `email`, `phone`, `date_of_birth`, `nationality`, `passport_hash`, `is_authorized_to_view_case`, `created_at`.
2. **`client_consents`**:
   - `id`, `client_id`, `consent_type` (`g28_representation`, `gdpr_processing`, `privacy_policy`), `granted`, `granted_at`, `revoked_at`, `ip_address`, `document_hash`, `notes`.
3. **`case_milestones`**:
   - `id`, `case_id`, `title`, `stage`, `target_date`, `completed_at`, `status` (`pending`, `completed`, `overdue`, `waived`), `created_at`.
4. **`case_notes`**:
   - `id`, `case_id`, `author_id`, `note_type` (`internal`, `client_communication`, `legal_strategy`, `status_update`), `content`, `is_client_visible`, `created_at`, `updated_at`.
5. **`case_tasks`**:
   - `id`, `case_id`, `title`, `description`, `due_date`, `priority` (`critical`, `high`, `medium`, `low`), `status` (`pending`, `in_progress`, `completed`, `cancelled`), `is_completed`, `assigned_to_user_id`, `completed_at`, `created_at`.

### Indexes & Cascades
- Composite index on `cases`: `ix_cases_org_status` (`organization_id`, `status`), `ix_cases_org_jurisdiction` (`organization_id`, `jurisdiction`).
- Composite index on `client_dependants`: `ix_client_dependants_client_rel` (`primary_client_id`, `relationship_type`).
- Composite index on `case_milestones`: `ix_milestones_case_stage` (`case_id`, `stage`).
- Composite index on `case_notes`: `ix_case_notes_case_visible` (`case_id`, `is_client_visible`).
- Composite index on `case_tasks`: `ix_tasks_case_completed` (`case_id`, `is_completed`).

---

## 4. REST API Endpoint Catalog

| Method | Endpoint | Description | Role Authorization |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/clients/check-duplicates` | Analyze prospective client data for duplicate matches | Staff / Admins |
| `POST` | `/api/v1/clients` | Register client with optional nested initial dependants & consents | Staff / Admins |
| `POST` | `/api/v1/clients/{id}/dependants` | Add family member / dependant to client profile | Staff / Admins |
| `GET` | `/api/v1/clients/{id}/dependants` | List dependants with portal access indicators | Authorized Staff / Client |
| `POST` | `/api/v1/clients/{id}/consents` | Record Form G-28 or GDPR consent timestamp and hash | Authorized Staff / Client |
| `GET` | `/api/v1/cases` | Filterable, sortable cases with pagination headers | RBAC-filtered |
| `GET` | `/api/v1/cases/paginated` | Paginated case list with envelope (`items`, `total`, `limit`, `offset`) | RBAC-filtered |
| `POST` | `/api/v1/cases` | Create immigration case with jurisdiction, pathway, assignments | Staff / Admins |
| `GET` | `/api/v1/cases/{id}` | Detailed case dossier (milestones, tasks, dependants, notes) | Designated Staff / Client |
| `PUT` | `/api/v1/cases/{id}/status` | Controlled lifecycle stage transition with validation | Staff / Admins |
| `POST` | `/api/v1/cases/{id}/close` | Formally close case with mandatory reason | Case Manager / Admins |
| `POST` | `/api/v1/cases/{id}/reopen` | Reopen closed or archived case | Case Manager / Admins |
| `POST` | `/api/v1/cases/{id}/archive` | Archive closed case for compliance retention | Company / Master Admin |
| `POST` | `/api/v1/cases/{id}/assignments`| Assign case manager, senior reviewer, or paralegal | Staff / Admins |
| `POST` | `/api/v1/cases/{id}/milestones` | Add internal filing milestone and target date | Staff / Admins |
| `PUT` | `/api/v1/cases/{id}/milestones/{mid}`| Mark milestone completed or pending | Staff / Admins |
| `POST` | `/api/v1/cases/{id}/tasks` | Create task and assign to team member | Staff / Admins |
| `PUT` | `/api/v1/cases/{id}/tasks/{tid}` | Toggle task completion or status | Designated Assignee / Staff |
| `POST` | `/api/v1/cases/{id}/notes` | Create internal legal strategy note or client communication | Staff / Client |
| `GET` | `/api/v1/cases/{id}/notes` | List notes (clients only receive `is_client_visible=True`) | Role-filtered |
| `GET` | `/api/v1/cases/{id}/history` | Audit trail timeline of all case events | Designated Staff / Client |

---

## 5. Frontend Case Management Workflows

### Reusable Case Dossier Modal (`CaseDetailModal.tsx`)
Features a 6-tab inspection console:
1. **Overview & Staffing**: Case identifier, destination country, visa category, priority date, statutory deadline, assigned manager, senior reviewer, and lead paralegal.
2. **Milestones Roadmap**: Interactive checklist of stage-linked filing deadlines with target dates and completion toggles.
3. **Tasks & Assignment**: Task cards with priority badges (`critical`, `high`, `medium`, `low`), due dates, assignees, and instant completion toggles.
4. **Dependants & Consents**: Principal applicant badge, active Form G-28 and GDPR consent badges, derivative family members with portal view indicators, and new dependant intake form.
5. **Notes & Strategy**: Distinct cards separating **🔒 Internal Legal Strategy** (private to caseworkers/attorneys) from **🌐 Client Visible** communications, with a composer and privacy checkbox.
6. **History Audit**: Chronological log of case status changes, assignments, milestones, and audit events.
7. **Controlled Stage Transitions**: Dropdown showing permissible stages, reason input, transition trigger, and role-gated Close / Reopen / Archive buttons in modal footer.

### Real-Time Duplicate Detection (`CreateClientModal.tsx`)
- Submits debounced query as users enter email, phone, passport number, or name.
- Renders an amber alert banner detailing matched records, matching field, and confidence score (`high`, `medium`, `low`) before saving redundant files.

---

## 6. Test Suite Verification

### Backend Tests (`pytest backend/tests`)
**34 passed in 4.11s**:
- `test_phase3_case_management.py` (8 comprehensive tests):
  - `test_client_intake_and_duplicate_detection`: Validates duplicate suggestion algorithm on exact email, phone, passport hash, and name.
  - `test_dependants_and_consents`: Verifies family member creation, ISO nationality validation, and Form G-28 consent tracking.
  - `test_create_case_and_assignments`: Verifies destination jurisdiction, pathway, and multiple staff assignments.
  - `test_case_lifecycle_state_machine`: Verifies allowed transitions and validates error on invalid transitions (e.g. `inquiry` → `submitted`).
  - `test_close_reopen_archive_permissions`: Verifies role permission requirements for close, reopen, and archive actions.
  - `test_case_milestones_and_tasks`: Tests milestone completion toggles, statutory deadlines, task priorities, and assignees.
  - `test_case_notes_confidentiality_boundary`: Verifies that retained clients only see `is_client_visible=True` notes and cannot access confidential internal legal strategy notes.
  - `test_object_level_access_authorized_dependant`: Verifies that unauthorized clients cannot access other cases, while designated applicants and authorized dependants can.
- `test_migrations.py`: Verifies clean upgrade to `head` and downgrade to `base` including all Phase 3 tables.
- `test_api_foundation.py`, `test_auth_flow.py`, `test_rbac.py`, `test_storage.py`, `test_tenant_isolation_and_rbac.py`: 100% passing.

### Frontend Tests (`vitest run` in `apps/web`)
**15 passed in 2.96s**:
- `tests/phase3_case_management.test.tsx` (6 tests):
  - CaseDetailModal overview, jurisdiction, and tabs rendering.
  - Milestones tab switching and roadmap display.
  - Tasks tab switching and assignment list.
  - Dependants & Consents tab switching, family cards, and consent badges.
  - Notes & Strategy tab switching and internal strategy badge verification.
  - CreateClientModal duplicate-record detection suggestion banner and dependants section.
- `tests/components.test.tsx` (6 tests): Reusable component system tests.
- `tests/dashboards.test.tsx` (3 tests): Three role dashboard experiences.

### Production Build (`next build` in `apps/web`)
- Compiled successfully with Turbopack in 393ms.
- 0 TypeScript errors.
- 0 static generation or SSR errors.
