# Phase 2 — Complete Frontend & Role-Based Dashboards

## Intended Outcome
Deliver the complete frontend application for the AI Immigration platform based on the approved design specification and tokens:
1. **Three Separate Role-Based Dashboards & Workspaces**:
   - **Owner Master Dashboard**: Operational health, active caseload, case pipeline by stage, cases requiring owner attention, upcoming deadlines, team capacity, cases by jurisdiction/pathway, revenue/billing ledger, and append-only audit trail.
   - **Employee Workspace**: My Work dashboard, assigned cases, team queues, client directory, document verification matrix, statutory AI findings grounding, action items/tasks, direct client messaging, USCIS Form I-140 draft preparation, and exhibit package review.
   - **Client Portal**: Onboarding checklist, principal & family applicant profiles, guided statutory questionnaire wizard, private document upload with SHA-256 fingerprinting, milestone tracking, secure messages, notifications feed, retainer billing, and privacy/MFA controls.
2. **Reusable Component System** (Targeting WCAG 2.2 AA):
   - Badges, Buttons, Cards, MetricCards, Modals, Drawers, DataTables, Form Controls, Alert Banners, State Views.
3. **Typed API Integration Layer**:
   - Resilient typed client connecting to the FastAPI backend with dynamic role-header injection (`X-Organization-Id`, `X-User-Id`, `X-User-Role`), graceful offline fallback fixtures, and live backend connection indicator.
4. **Automated Frontend Test Suite**:
   - Vitest + jsdom test suite verifying reusable component behaviors, accessible ARIA attributes, modal lifecycles, and all three role experiences.

---

## Screen Inventory

| Screen / View | Role Persona | Primary Responsibilities | Real API / Action Link |
| :--- | :--- | :--- | :--- |
| **Firm Overview** | Master Admin | Company health, caseload stats, escrow metrics, pipeline stage graphs, country distribution | `api.getCases()`, `api.getInvoices()`, `api.getAuditEvents()` |
| **All Cases Catalog** | Master Admin | Full searchable/sortable firm caseload, stage filtering, drill-down trigger | `api.getCases()`, Case Inspector Drawer |
| **Team Capacity** | Master Admin | Caseworker active cases vs. capacity bars, open review queues | `api.getTeamCapacity()` |
| **Revenue & Retainers**| Master Admin | Escrow balances, invoices, payment status tracking | `api.getInvoices()` |
| **Security Audit Trail**| Master Admin | Append-only cryptographic audit stream, tenant boundary checks | `api.getAuditEvents()` |
| **My Work Dashboard** | Case Manager | Daily priorities, pending documents, action items checklist, statutory AI alerts | `api.getTasks()`, `api.getAIFindings()` |
| **Assigned Cases** | Case Manager | Individual assigned cases with object-level authorization applied | `api.getCases()`, Form Prep review trigger |
| **Team Queues** | Case Manager | Cross-team routing (unassigned intake, translation, signoff queues) | Dynamic queue counts |
| **Client Directory** | Case Manager | Retained applicant list with contact info and linked cases | `api.getClients()` |
| **Evidence Matrix** | Case Manager | Cryptographic document verification checklist, SHA-256 fingerprint inspection | `api.getDocuments()`, Upload Evidence trigger |
| **AI Findings Panel** | Case Manager | Analytical findings, statutory citations (8 CFR § 204.5), attorney disposition workflow | `api.getAIFindings()` |
| **Form Preparation** | Case Manager | USCIS Form I-140 field verification, sign-off workflow | Interactive form sign-off toggle |
| **Exhibit Binder** | Case Manager | Indexed exhibit tab catalog (Exhibits A–F), PDF/A submission generator | Filing exhibit list |
| **Applicant Overview** | Retained Client | Onboarding welcome banner, case summary, readiness score, notification alerts | `api.getCases()`, `api.getNotifications()` |
| **Guided Questionnaire**| Retained Client | Multi-step statutory wizard (Scholarly articles, peer review, critical role) | `GuidedQuestionnaireModal` |
| **Evidence & Uploads** | Retained Client | Document checklist, Web Crypto SHA-256 fingerprinting, upload progress | `DocumentUploadModal`, `calculateSHA256` |
| **Milestone Tracker** | Retained Client | Transparent stage progression (Retainer → Evidence → Review → Filing) | Visual milestone stepper |
| **Attorney Messages** | Retained Client | Direct, confidential message history with legal team, composer | `api.getMessages()`, `api.sendMessage()` |
| **Applicant Profile** | Retained Client | Principal applicant bio, Form I-485 derivative family dependents | Client profile data |
| **Billing Ledger** | Retained Client | Retainer invoices, trust account deposits, payment status | `api.getInvoices()` |
| **Privacy & Security** | Retained Client | Multi-factor authentication (MFA) status, tenant isolation assurance, data export | Security settings |

---

## Reusable Component Inventory

- **`Badge`** (`components/common/Badge.tsx`): Accessible status badges with token styling (`verified`/success, `review`/info, `action`/critical, `warning`, `neutral`).
- **`Button`** (`components/common/Button.tsx`): Focus-visible buttons (`primary`, `secondary`, `outline`, `ghost`, `danger`) with loading spinner and `aria-busy` state.
- **`Card`** (`components/common/Card.tsx`): Standard container with header, subtitle, badge, action slots, and box shadow.
- **`MetricCard`** (`components/common/MetricCard.tsx`): KPI card with defined meaning tooltip (accessible expandable definition), trend indicator, data source badge (Live vs. Fixture), and drill-down action button.
- **`Modal`** (`components/common/Modal.tsx`): Accessible dialog component (`role="dialog"`, `aria-modal="true"`, focus trap, ESC key dismiss, backdrop dismiss).
- **`Drawer`** (`components/common/Drawer.tsx`): Slide-over drawer for deep inspection, case drill-downs, and side-by-side reviews.
- **`DataTable`** (`components/common/DataTable.tsx`): Complete data table with search filtering, status dropdowns, sortable headers, pagination, row click callbacks, and empty states.
- **`FormControls`** (`components/common/FormControls.tsx`): Accessible inputs (`TextInput`, `SelectInput`, `TextareaInput`, `CheckboxInput`) with labels, helper texts, required indicators, and `aria-invalid` / `role="alert"` error states.
- **`StateViews`** (`components/common/StateViews.tsx`): `LoadingState`, `EmptyState`, and `ErrorState` components.
- **`NotificationToast`** (`components/common/NotificationToast.tsx`): Alert banners (`AlertBanner`) with dismiss buttons.

---

## Automated Test Verification

### Frontend Tests (Vitest + jsdom)
Run via `npm test` in `apps/web`:
- **`tests/components.test.tsx`** (6 tests):
  - Badge variant rendering and token mappings
  - Button click handlers, disabled state, and loading spinner
  - MetricCard defined meaning definition expansion and drill-down execution
  - Accessible Modal lifecycle (ESC key, backdrop dismiss, focus management)
  - DataTable search filtering, column sorting, and pagination
  - Accessible FormControls with validation alert messages
- **`tests/dashboards.test.tsx`** (3 tests):
  - **Owner Master Dashboard**: Operational health, active caseload, attention flags, pipeline graphs, tab switching (Overview, Cases, Team, Financials, Audit)
  - **Employee Workspace**: Work queues, task completion checkbox toggle, document verification, AI findings grounding, Form I-140 sign-off
  - **Client Portal**: Transparency hub, onboarding banner, questionnaire modal trigger, milestone tracking, message sending, and MFA security settings

**Result: 9 / 9 tests passed (100% pass rate).**

### Backend Tests (Pytest)
Run via `.\backend\.venv\Scripts\pytest.exe backend/tests`:
- All 26 tests pass across migrations, RBAC, private storage, and tenant isolation.

---

## Completion Gate Checklist
- [x] All three roles (Owner, Case Manager, Client) can navigate their respective interfaces.
- [x] Every metric in the Owner Dashboard has a defined meaning and interactive drill-down action.
- [x] Interactions are connected to working APIs with graceful development fixture fallbacks.
- [x] Buttons perform real actions (no non-functional dummy buttons).
- [x] Client document uploads compute real SHA-256 fingerprints before storing.
- [x] WCAG 2.2 AA accessibility target verified (keyboard navigation, focus rings, ARIA roles, contrast).
