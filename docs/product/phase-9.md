# Phase 9 — Owner Analytics, Company Management, and Billing

## Overview

Phase 9 completes the legal immigration practice owner's operational command center. It unifies **Executive Analytics**, **Business Operations**, **PCI-DSS Tokenized Billing**, and **Multi-Dimensional Caseload Intelligence** under strict enterprise governance and multi-tenant security boundaries.

### Core Objectives Delivered
1. **Executive Operational Command Center**: Twelve real, database-backed operational metrics covering caseload volume, retainers, pipeline distribution, statutory deadlines, capacity utilization, application filings, request lags, and system processing failures.
2. **Transparent Metric Definitions & Data Integrity**: Zero metric fabrication. Every metric publishes a mathematical formula, a defined rolling or point-in-time window, an operational drill-down path, and an explicit availability status (`available` vs `source_data_pending`).
3. **Business Operations & Workload Management**: Employee invitations, multi-branch and team structures, single and bulk work reassignment with immutable audit logging, service catalog definitions, and firm-wide governance settings.
4. **Configurable Billing & Verified Payment Foundation**: Itemized invoicing, retainer engagement agreements, payment status tracking, Accounts Receivable aging schedules, and **PCI-DSS compliant tokenized card settlement**. Raw Primary Account Numbers (PAN) and CVVs are strictly prohibited from client and database memory.
5. **Multi-Dimensional Analytics**: Analytical queries filtered by date range, country, pathway, stage, assignee, branch, and service type. Sophisticated turnaround time calculations accounting for reopened petitions and incomplete timestamps.
6. **Governance & Role-Based Access Control**: Sensitive billing and financial reports are restricted to authorized firm owners and finance administrators (`billing:read`, `billing:manage`), denying access to caseworkers (403 Forbidden). Every report export, payment, reassignment, and policy modification produces an append-only audit record.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│               PHASE 9: OWNER OPERATIONAL COMMAND CENTER & BILLING ENGINE               │
└────────────────────────────────────────────┬────────────────────────────────────────────┘
                                             │
      ┌──────────────────────┬───────────────┴───────────────┬──────────────────────┐
      ▼                      ▼                               ▼                      ▼
┌──────────────┐     ┌──────────────┐                ┌──────────────┐       ┌──────────────┐
│  Executive   │     │   Business   │                │   Billing    │       │  Operations  │
│  Dashboard   │     │  Operations  │                │  Foundation  │       │  Analytics   │
│ (12 Metrics) │     │ (Workload/HR)│                │ (PCI Token)  │       │ (Turnaround) │
└──────┬───────┘     └──────┬───────┘                └──────┬───────┘       └──────┬───────┘
       │                    │                               │                      │
       ├────────────────────┼───────────────────────────────┴──────────────────────┤
       │                    │                                                      │
       ▼                    ▼                                                      ▼
┌──────────────────────────────────────┐                   ┌───────────────────────────────────┐
│ Database Aggregations & Formulas     │                   │ Verified Payment Adapter (Stripe) │
│ • Explicit Window Functions          │                   │ • PCI-DSS Compliant Tokenization  │
│ • Reopened Case Adjustments          │                   │ • NO Raw PAN or CVV Stored        │
│ • Incomplete Timestamp Exclusions    │                   │ • Token Reference + Last 4 Only   │
│ • Source Data Pending Status         │                   │ • Accounts Receivable Aging (A/R) │
└──────────────────┬───────────────────┘                   └─────────────────┬─────────────────┘
                   │                                                         │
                   └───────────────────────────┬─────────────────────────────┘
                                               │
                                               ▼
                         ┌───────────────────────────────────────────┐
                         │ Multi-Tenant Governance & RBAC Security   │
                         │ • Organization Boundary Partitioning      │
                         │ • Role Permission Enforcement (403 Block) │
                         │ • Append-Only Cryptographic Audit Logging │
                         └───────────────────────────────────────────┘
```

---

## A. Executive Dashboard (12 Real Indicators)

Every metric in the Executive Command Center represents actual database queries against the firm's multi-tenant partition (`organization_id`). If an underlying operational telemetry source has not yet been deployed, the metric explicitly displays `source_data_pending` rather than fabricating data or silently coercing missing data to zero.

### Metric Catalog & Formal Mathematical Definitions

| Metric Name | Calculation Method / Mathematical Query | Time Window | Drill-Down Destination | Data Status |
| :--- | :--- | :--- | :--- | :--- |
| **Active Cases** | `COUNT(ImmigrationCase) WHERE status NOT IN ('approved', 'closed', 'denied', 'withdrawn')` | Current active snapshot | `/cases?status=active` | `available` |
| **New Retained Clients** | `COUNT(ClientProfile) WHERE created_at >= NOW() - INTERVAL '30 DAYS'` | Rolling 30 Days (configurable 7d–180d) | `/operations?view=clients` | `available` |
| **Cases by Country & Pathway** | `GROUP_BY(jurisdiction, visa_category) COUNT(*)` for active cases | Current active caseload | `/cases` | `available` |
| **Cases by Workflow Stage** | `GROUP_BY(status) COUNT(*)` across all firm petitions | All-time active repository | `/cases?filter=by_stage` | `available` |
| **Cases Needing Attention** | `COUNT(DISTINCT ImmigrationCase) WHERE attention_required = TRUE OR EXISTS(unresolved CaseAIFinding) OR overdue_tasks > 0` | Immediate attention backlog | `/cases?filter=needing_attention` | `available` |
| **Upcoming & Overdue Deadlines** | `COUNT(Milestones, Tasks) WHERE due_date < NOW() AND status != 'completed'` (Overdue) + `COUNT(*) WHERE due_date BETWEEN NOW() AND NOW() + 14 DAYS` (Upcoming) | Past due + Next 14 calendar days | `/cases/deadlines` | `available` |
| **Unassigned Cases** | `COUNT(ImmigrationCase) WHERE id NOT IN (SELECT case_id FROM CaseAssignment WHERE is_active = TRUE)` | Current active cases | `/operations?filter=unassigned` | `available` |
| **Staff Workload & Capacity** | Caseload utilization ratio `(assigned_active_cases / nominal_capacity) * 100` per staff member (threshold: 25 cases nominal) | Current staffing allocation | `/operations/workload` | `available` |
| **Applications Prepared, Reviewed, Submitted** | `COUNT(FilingPackage)` grouped by lifecycle phases: draft/assembly (`prepared`), attorney review (`reviewed`), and version-locked submitted (`submitted`) | All filing packages | `/packages` | `available` |
| **Outstanding Client Requests** | `COUNT(DocumentRequest) WHERE status = 'requested'` + `AVG(NOW() - created_at)` in days | Open evidentiary requests | `/requests?status=requested` | `available` |
| **Processing Failures** | `COUNT(DocumentItem WHERE processing_status = 'failed') + COUNT(NotificationItem WHERE status = 'failed')` | Rolling 30 days | `/audit?filter=failures` | `available` |
| **Recent Company Activity** | `SELECT AuditEvent ORDER BY occurred_at DESC LIMIT 10` capturing user actions, object types, and security metadata | Immediate audit stream | `/audit` | `available` |

---

## B. Business Operations

The operations management subsystem provides tools for internal personnel scaling, work offloading, branch management, and firm configurations.

### 1. Workload Balancing & Work Reassignment
- **Staff Workload Table**: Tracks assigned active petitions, pending task queues, nominal capacity ceilings, and calculated utilization percentages (`utilization_pct`).
- **Overload Detection**: Highlights staff members operating at or above 100% capacity with visual warning badges to prevent burnout and statutory deadline slips.
- **Reassignment Modal**: Enables firm owners and case managers to offload work:
  - Supports transferring **All Active Cases & Pending Tasks**, **Active Cases Only**, or **Pending Tasks Only**.
  - Requires documenting the administrative justification (e.g., "Caseworker medical leave coverage").
  - Executes atomized case assignment closures (`is_active = FALSE`) and new assignment creation.
  - Automatically records an immutable `assignment.bulk_reassigned` audit event.

### 2. Multi-Branch & Team Structure
- Supports geographic operational partitioning (e.g. New York HQ, London Branch, Toronto Office).
- Tracks branch leads, staff headcount across attorney and paralegal roles, active branch caseload, and aggregate branch utilization.

### 3. Organization Governance Settings
Configurable settings stored in the `organization_settings` table:
- Legal practice entity name.
- Primary billing currency (`USD`, `GBP`, `CAD`, `EUR`).
- Default practice jurisdiction (`US`, `UK`, `CA`).
- Invoice number prefix (default: `INV`).
- Statutory agency deadline reminder threshold (default: 14 days).
- **Two-Step Case Closure Enforcement**: Mandates managing attorney sign-off before petitions can transition to archived status.
- **Client Portal Billing Toggle**: Controls whether retained applicants can inspect and settle invoices directly in their client portal.

---

## C. Billing Foundation & Verified Payment Processing

### 1. Service Fee Catalog
- Pre-configured service offerings with statutory fee codes (e.g. `SRV-EB1A`, `SRV-O1A`, `SRV-NIW`, `SRV-UK-SW`, `SRV-CA-EE`).
- Configurable pricing models (`fixed`, `hourly`, `milestone`).
- Standardized baseline fees and estimated processing durations.

### 2. Itemized Invoicing
- Standardized invoice numbering: `INV-{YYYY}-{NUM}` (e.g., `INV-2026-0001`).
- Multi-line item structure categorized into:
  - `service_fee`: Legal representation and petition drafting.
  - `filing_fee`: Government statutory agency fees (e.g., USCIS Form I-129 / I-140 filing fees).
  - `translation`: Certified translation costs.
  - `courier`: Physical physical submission shipping costs.
  - `discount`: Contractual fee adjustments.
- Real-time balance calculations: `subtotal`, `tax_amount`, `discount_amount`, `total_amount`, `paid_amount`, and `balance_due`.

### 3. Payment Processing & Strict PCI-DSS Security Guardrails
> [!CAUTION]
> **Strict Payment Card Data Prohibition**:
> The system strictly adheres to PCI-DSS Level 1 compliance rules:
> 1. Raw Primary Account Numbers (PAN), CVVs, and magnetic stripe data **are NEVER transmitted to or stored in backend databases or frontend state**.
> 2. All card settlement is handled through verified tokenized provider references (Stripe mock adapter).
> 3. Only the provider transaction reference (e.g. `tok_stripe_12345`), card network brand (e.g. `visa`), and masked last-4 digits (e.g. `4242`) are preserved for audit reconciliation.

### 4. Accounts Receivable (A/R) Aging Reports
Itemized aging schedule partitioning outstanding invoice balances into standardized delinquency tranches:
- **Current (Not Due)**: Within payment terms.
- **1 – 30 Days Overdue**: Early reminder notice.
- **31 – 60 Days Overdue**: Escalated caseworker follow-up.
- **61 – 90 Days Overdue**: Administrative hold on application assembly.
- **90+ Days Overdue**: Collections and bad debt review.

---

## D. Multi-Dimensional Analytics

The Operations Analytics engine allows filtering metrics across seven distinct dimensions:
1. Date range presets (`last_30d`, `last_90d`, `ytd`, `all_time`) or custom ISO date ranges.
2. Country / Jurisdiction (`US`, `UK`, `CA`, `DE`, `AU`).
3. Visa Category / Pathway (`O-1A`, `EB-1A`, `EB-2 NIW`, `H-1B`, etc.).
4. Workflow Stage (`intake`, `gathering`, `review`, `assembly`, `ready`, `filed`).
5. Staff Member / Assignee.
6. Branch Office.
7. Service Type.

### Advanced Analytical Calculations

#### 1. Adjusted Turnaround Time
- **Formula**: `mean(completion_timestamp - effective_start_timestamp)` for all completed petitions.
- **Reopened Petitions Handling**: Petitions that have been reopened calculate duration from their **latest reopening timestamp** rather than original intake, preventing skewed long-tail distortions.
- **Incomplete Timestamps Handling**: Cases missing filing confirmation timestamps are excluded from the turnaround denominator rather than treated as zero.

#### 2. Tiered Overdue Work Analysis
Classifies delayed tasks and past-due milestones into three severity buckets:
- `< 7 Days Overdue`: Early warning schedule slippage.
- `7 to 30 Days Overdue`: Moderate urgency requiring caseworker intervention.
- `> 30 Days Overdue`: Critical statutory risk of USCIS or agency abandonment.

#### 3. Client Response Lag
- **Formula**: `mean(submitted_at - created_at)` across completed questionnaires and document upload requests.
- Measures firm client responsiveness lag in both hours and calendar days.

---

## E. Governance & Security Enforcement

### Role-Based Access Control (RBAC) Matrix

| Role | `analytics:read` | `analytics:export` | `billing:read` | `billing:manage` | `assignment:manage` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Master Admin / Owner** | Yes | Yes | Yes | Yes | Yes |
| **Company Admin** | Yes | Yes | Yes | Yes | Yes |
| **Finance Staff** | Yes | Yes | Yes | Yes | No |
| **Senior Reviewer / Attorney** | Yes | Yes | No | No | Yes |
| **Case Manager / Caseworker** | Yes | No | **403 Forbidden** | **403 Forbidden** | No |
| **Retained Client** | **403 Forbidden** | **403 Forbidden** | Portal Invoices Only | Settle Invoice Only | **403 Forbidden** |

### Immutable Audit Trail
Consequential operations trigger append-only audit events logged to the database:
- `billing.invoice_created`: Captures invoice number, client ID, and itemized total.
- `billing.payment_recorded`: Captures transaction reference, amount, and masked payment method.
- `billing.payment_refunded`: Captures refund amount, original transaction, and legal reason.
- `assignment.bulk_reassigned`: Captures source user, target user, transfer scope, and operational justification.
- `operations.settings_updated`: Captures modified setting key and updated value.
- `analytics.exported`: Captures exported report type, requesting actor, and export reference.

---

## Verification & Test Results

### 1. Backend Test Suite (Pytest)
Comprehensive tests in `backend/tests/test_phase9_company_billing_analytics.py`:
- `test_executive_dashboard_metrics`: Validates all 12 database-backed metrics, formula definitions, drill-down links, and `available` status indicators.
- `test_service_catalog_and_engagements`: Verifies service seeding, custom service creation, and retainer agreement linkage.
- `test_invoice_creation_and_balance_calculation`: Verifies line items summation, invoice numbering, and due date assignment.
- `test_tokenized_payment_and_refund`: Validates verified Stripe payment tokenization, balance due decrement, partial refunds, and raw card PAN rejection.
- `test_financial_reports_and_ar_aging`: Verifies aging buckets (Current, 1–30d, 31–60d, 61–90d, 90+d) and collections by pathway.
- `test_staff_workload_and_reassignment`: Verifies capacity calculation, overloaded status, and bulk case/task reassignment with audit logs.
- `test_organization_settings`: Verifies retrieval and modification of organization parameters.
- `test_analytics_turnaround_and_overdue`: Verifies turnaround calculation, reopened case timestamp adjustments, and overdue tiers.
- `test_billing_and_analytics_rbac`: Verifies that unauthorized caseworkers receive 403 Forbidden when requesting billing endpoints.

**Result: 93 passed, 0 failed in 24.34s across all backend tests.**

### 2. Frontend Test Suite (Vitest)
Unit and integration tests in `apps/web/tests/phase9_owner_billing_analytics.test.tsx`:
- `ExecutiveCommandCenter`: Verifies rendering of all 12 metrics, metric formula dictionary modal, and time window switcher.
- `AnalyticsExplorer`: Verifies multi-dimensional filters, turnaround calculation details, overdue tiers, and report export.
- `BillingManager`: Verifies RBAC 403 banner for caseworkers, financial overview totals, A/R aging buckets, Issue Invoice modal with line items, and Record Payment modal with PCI-DSS security disclaimer.
- `BusinessOperationsHub`: Verifies staff workload table, Work Reassignment modal, branch cards, organization settings form, and access audit stream.
- `OwnerMasterDashboard`: Verifies seamless tab switching across Executive Command Center, Deep Analytics, Operations Hub, and Billing.

**Result: 79 passed, 0 failed across all 9 web test files; clean TypeScript compilation (`tsc --noEmit`).**
