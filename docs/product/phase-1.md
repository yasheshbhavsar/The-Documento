# Phase 1 — Secure Technical Foundation & Three Distinct User Experiences

## Intended Outcome
Deliver a hardened, verified technical foundation establishing:
1. **FastAPI Backend Architecture**: Clean separation between routing, domain logic, persistence, and security; structured JSON logging with automated PII/credential redaction; centralized exception hierarchy; environment configuration; and complete OpenAPI 3.x specification.
2. **PostgreSQL Relational Schema & Alembic Migrations**: Fully modeled, indexed, and constrained tables using UUID primary keys for:
   - `organizations`
   - `branches` and `teams`
   - `users`, `organization_memberships`, `membership_roles`
   - `roles`, `permissions`, `role_permissions`
   - `invitations`, `sessions`, `password_reset_tokens`
   - `client_profiles`
   - `immigration_cases`, `case_assignments`
   - `audit_events`, `notifications`
3. **Authentication & Authorization**:
   - Secure login and logout with bcrypt password hashing (12 rounds) and SHA-256 session tokens.
   - HttpOnly, Secure, SameSite session cookie handling.
   - Invitation acceptance and password reset flows with cryptographic tokens.
   - MFA-ready architecture (TOTP secret provisioning and verification).
   - Server-side Role-Based Access Control (RBAC) across 7 core roles:
     - *Master Admin / Company Owner* (`master_admin` / `organization_admin`)
     - *Company Admin* (`company_admin`)
     - *Senior Reviewer* (`senior_reviewer` / `rule_approver`)
     - *Immigration Case Manager* (`case_manager` / `case_worker`)
     - *Document Reviewer* (`document_reviewer` / `rule_editor`)
     - *Finance Staff* (`finance_staff`)
     - *Retained Client / Applicant* (`retained_client` / `applicant`)
   - Configurable permissions subject to protected platform-level security boundaries.
   - Strict organization-level tenant isolation and object-level case authorization.
4. **Security Hardening**:
   - Rate limiting and standard security headers (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy).
   - Insecure Direct Object Reference (IDOR) prevention.
   - Structured JSON logging redacting sensitive keys (`password`, `token`, `passport_number`, `api_key`, `secret`).
   - Clean, secret-free `.env.example`.
5. **Three Distinct User Experiences**:
   - Master Admin / Company Owner: Firm-wide metrics, caseload overview, audit stream, tenant boundary status.
   - Case Manager: Caseworker workspace, priority document verification queue, upcoming deadlines.
   - Retained Client / Applicant: Applicant transparency portal, petition milestone tracking, document checklist.
6. **Automated Test Suite**: Full test coverage verifying auth, permissions, organization isolation, database constraints, migrations, and unauthorized record access.

---

## Implemented Scope & Architecture

### A. Backend Layering & Infrastructure
- **Layer Separation**:
  - `backend/app/api/v1/`: API endpoints grouped by domain (`auth`, `organizations`, `cases`, `clients`, `notifications`, `roles`, `foundation`).
  - `backend/app/domain/`: SQLAlchemy models (`models.py`) and Pydantic request/response schemas (`schemas.py`).
  - `backend/app/security/`: Password hashing (`passwords.py`), token cryptography (`tokens.py`), RBAC & permission boundaries (`rbac.py`), and authentication context (`auth.py`).
  - `backend/app/core/`: Configuration (`config.py`), structured logging (`logging.py`), centralized error handling (`errors.py`), and security middleware (`middleware.py`).
  - `backend/app/db/`: Session management (`session.py`), metadata base (`base.py`), and system role seeder (`init.py`).
  - `backend/app/documents/`: Private document storage abstraction (`storage.py`) with SHA-256 integrity and tenant directory isolation.
- **OpenAPI Specification**:
  - Auto-generated OpenAPI 3.x schema exposed at `/openapi.json` and interactive Swagger UI at `/docs`.

### B. Database Schema & Alembic Migrations
- **Revisions**:
  - `18c7dc3c2b8a_initial_foundation_schema.py`: Initial schema baseline.
  - `d5ff8ca2fc47_complete_technical_foundation_schema.py`: Complete technical foundation migration adding all 17 tables, foreign keys, unique constraints, and search indexes.
- **Tables Created**:
  1. `organizations` (UUID PK, unique slug, status, timestamps)
  2. `branches` (UUID PK, FK to org, unique `(organization_id, code)`, timestamps)
  3. `teams` (UUID PK, FK to org and optional branch, timestamps)
  4. `users` (UUID PK, unique email, password hash, status, MFA fields, timestamps)
  5. `roles` (UUID PK, unique code, name, description, timestamps)
  6. `permissions` (UUID PK, unique code, description, timestamps)
  7. `role_permissions` (UUID PK, FK to role, FK to permission, unique constraint)
  8. `organization_memberships` (UUID PK, FK to user and org, unique `(user_id, organization_id)`, branch/team FKs, timestamps)
  9. `membership_roles` (UUID PK, FK to membership, FK to role, unique constraint)
  10. `invitations` (UUID PK, FK to org, email, token hash, role code, expiry, status, timestamps)
  11. `sessions` (UUID PK, FK to user and org, token hash, ip, user agent, expires_at, revoked_at, timestamps)
  12. `password_reset_tokens` (UUID PK, FK to user, token hash, expires_at, used_at, timestamps)
  13. `client_profiles` (UUID PK, FK to org, optional FK to user, nationality, passport hash, timestamps)
  14. `immigration_cases` (UUID PK, FK to org, FK to client, unique `(organization_id, case_number)`, jurisdiction, visa category, status, timestamps)
  15. `case_assignments` (UUID PK, FK to case, FK to user, role, timestamps)
  16. `audit_events` (UUID PK, FK to org, optional FK to user, action, object type/id, metadata JSONB, IP, timestamps)
  17. `notifications` (UUID PK, FK to org, FK to user, title, body, status, timestamps)

### C. Authentication & Authorization
- **Password Security**: `bcrypt` (12 rounds) with constant-time verification.
- **Session Lifecycle**: High-entropy tokens hashed with SHA-256 before storage; session revocation on logout; HttpOnly, Secure, SameSite cookies.
- **Invitation Acceptance & Password Reset**: One-time cryptographically hashed tokens with expiration and single-use invalidation.
- **MFA Architecture**: Support for MFA setup, secret generation, and verification challenge checking.
- **Server-Side RBAC**:
  - Full mappings for all 7 required roles: Master Admin, Company Admin, Senior Reviewer, Immigration Case Manager, Document Reviewer, Finance Staff, Retained Client.
  - Backward compatibility aliases for existing foundation roles (`organization_admin`, `case_worker`, `rule_approver`, `rule_editor`, `applicant`).
  - Configurable permissions subject to `can_assign_permission()` platform boundaries:
    - Retained Clients cannot receive internal staff, administrative, or firm-wide case permissions.
    - `rule:publish` can only be assigned to senior approver roles.
- **Tenant & Object-Level Isolation**:
  - Organization boundary checked on every protected endpoint (`assert_organization_access`).
  - Object-level case authorization (`assert_case_access`): retained clients are strictly restricted to cases linked to their verified client profile, preventing cross-client or cross-tenant data access.

### D. Security Hardening
- **Secrets**: Kept strictly outside version control; `.env.example` provides safe development placeholders.
- **Rate Limiting**: `SimpleRateLimiterMiddleware` protects API endpoints from burst abuse.
- **Security Headers**: HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, and strict referrer policy.
- **PII / Document Redaction**: `sanitize_dict` automatically redacts sensitive fields from application and audit logs.

---

## Automated Test Results

All 26 automated backend tests pass with 0 errors:
- **`backend/tests/test_api_foundation.py`** (7 tests):
  - Health check & environment validation
  - Role definition mapping
  - 3-experience persona resolution (`master_admin`, `case_manager`, `client_applicant`)
  - Audit event tenant isolation and applicant access rejection (403)
  - OpenAPI 3.x specification structure and route coverage
  - Security headers middleware presence
  - Centralized error handling schema validation
- **`backend/tests/test_auth_flow.py`** (6 tests):
  - User login & session creation (JSON response + HttpOnly cookie)
  - Invalid login rejection
  - Logout and session token invalidation
  - Password reset request and confirmation flow
  - Organization invitation acceptance and membership creation
  - MFA setup and verification flow
- **`backend/tests/test_migrations.py`** (1 test):
  - Migration upgrade to `head` (all 17 tables verified) and downgrade to `base`
- **`backend/tests/test_rbac.py`** (2 tests):
  - Invariant validation for role permissions (applicants cannot write cases; case workers cannot publish rules)
  - Role hierarchy and alias mappings
- **`backend/tests/test_storage.py`** (4 tests):
  - Private document storage and retrieval
  - SHA-256 fingerprint verification
  - Immutability enforcement on overwrite attempt
  - Directory-level tenant isolation paths
- **`backend/tests/test_tenant_isolation_and_rbac.py`** (6 tests):
  - Cross-tenant organization isolation (Org A cannot see or mutate Org B data)
  - Object-level case authorization for Retained Clients (Applicant Elena cannot see Applicant Marcus's case)
  - Applicant rejection from organization client directories
  - Configurable permission platform boundary enforcement (preventing privilege escalation)
  - Database unique constraints on `(organization_id, code)` and `(organization_id, case_number)`
  - Cross-tenant case access blocking (403 Forbidden with `TenantIsolationError`) and IDOR probe rejection (404)
  - Structured logging PII & secret redaction verification

---

## Local Run & Setup Instructions

### 1. Environment Setup
```bash
# Copy example configuration
cp .env.example .env
```

### 2. Backend (FastAPI)
```bash
# Activate virtual environment
cd backend
source .venv/bin/activate  # Or on Windows: .\.venv\Scripts\activate

# Install dependencies (if not already installed)
pip install -e .

# Run database migrations
alembic upgrade head

# Start development server
uvicorn backend.app.main:app --reload --port 8000
```
- OpenAPI Documentation: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/api/v1/health`

### 3. Running Automated Tests
```bash
cd backend
pytest tests -v
```

### 4. Frontend (Next.js)
```bash
cd apps/web
npm install
npm run dev
```
- Interactive 3-experience app: `http://localhost:3000`

---

## Completed vs. Future Phase Scope
- **Completed in Phase 1**:
  - Secure FastAPI architecture with OpenAPI spec, structured logging, and error handling.
  - Complete 17-table relational schema and Alembic migrations.
  - Authentication flows (login, logout, session lifecycle, password reset, invitations, MFA readiness).
  - RBAC across 7 core roles with protected platform boundaries.
  - Multi-tenant and object-level case isolation with verified automated tests.
  - Private document storage engine with SHA-256 verification and immutability.
  - Interactive Next.js web application supporting 3 personas.
- **Reserved for Future Phases**:
  - *Phase 2 (Document Hub)*: Presigned multipart upload URLs, document type classification models, evidence bundling.
  - *Phase 3 (OCR & Data Extraction)*: Asynchronous worker processing, OCR pipeline, passport/visa bio extraction.
  - *Phase 4 (Requirements Engine)*: Formal jurisdiction rule graph and statutory requirement models.
  - *Phase 5 (AI Review & Evidence Grounding)*: Grounded citation checks, contradiction detection, and attorney review workspace.
