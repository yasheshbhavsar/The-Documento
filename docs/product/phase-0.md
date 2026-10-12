# Phase 0 — Foundation Definition of Done

Implemented baseline:

- [x] Repository structure established
- [x] Web application shell boots from Next.js
- [x] FastAPI application boots
- [x] PostgreSQL / Redis / MinIO development services defined
- [x] Tenant-aware data model contract established around organization_id
- [x] OIDC/OAuth2 provider boundary documented; no custom password cryptography
- [x] RBAC roles defined with separated rule editing and publication permissions
- [x] Audit event contract defined with actor, tenant, object, action, metadata and timestamps
- [x] Design tokens established from the UI specification
- [x] Accessibility baseline: WCAG 2.2 AA target, keyboard-visible focus, semantic navigation, responsive reflow and reduced motion
- [x] CI gates documented for lint/type checks, tests, schema validation, security scanning and E2E smoke tests

## Architecture guardrails

1. PostgreSQL is the structured system of record; original evidence belongs in immutable object storage.
2. Authentication is delegated to an OIDC/OAuth2 provider boundary.
3. Tenant context must be enforced server-side; UI filtering is not an authorization boundary.
4. Rule Editor and Rule Approver are separate roles. Publishing is never granted by editing permission.
5. Audit events are append-only application records; future migrations should additionally enforce database-level append-only controls.
6. AI output remains derived data with model/prompt/schema provenance.
7. Unknown / Needs Review remains distinct from false, complete, or approved.
