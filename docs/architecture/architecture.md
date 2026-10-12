# AI Immigration — Foundation Architecture

## Product boundary
The platform is a multi-country immigration case-management and document-intelligence system, not an immigration authority or autonomous legal decision-maker.

## Phase 0 system-of-record contract
- PostgreSQL: organizations, users, roles, permissions, case metadata, workflow state, rules metadata and audit metadata.
- S3-compatible object storage: immutable original evidence and derived document artifacts.
- Redis: short-lived cache and background-job broker.
- AI: derived artifacts only; never the source of truth.

## Authentication boundary
Use an OIDC/OAuth2-compatible identity provider. The application stores the provider subject (`auth_subject`) and maps it to an organization-scoped user. The application does not implement password hashing, password reset, token signing or identity verification.

## Tenant isolation contract
Every organization-owned row carries `organization_id` directly or through a mandatory relationship. Every repository/service operation must constrain access by organization context. Database Row-Level Security is the defense-in-depth target from the master specification; application authorization remains mandatory.

## RBAC
Applicant, Case Worker, Senior Reviewer, Organization Admin, Rule Editor, Rule Approver, System Admin and Auditor are modeled as distinct roles. Rule editing and rule publication are intentionally separated.

## Audit event contract
Every sensitive mutation or access event should record: organization, actor, action, object type, object ID, timestamp, and structured metadata. Where state changes occur, before/after hashes may be attached. Sensitive document contents and passport numbers must not be written into logs.

## Design system baseline
- Background `#F8FAFC`
- Surface `#FFFFFF`
- Subtle surface `#F1F5F9`
- Primary text `#0F172A`
- Secondary text `#475569`
- Muted text `#64748B`
- Accent `#1D4ED8`
- Success `#15803D`
- Warning `#B45309`
- Critical `#B91C1C`
- Info `#0369A1`
- 16px body text starting point; approximately 1.5 line-height
- ~44px control target
- Spacing scale: 4/8/12/16/20/24/32/40/48/64

## Next product slice
Organization Owner Master Dashboard → Case List → Case Overview → Document Library → Upload Center → Processing Queue → Requirements Matrix.
