from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.core.config import get_settings
from backend.app.core.errors import (
    AppException,
    app_exception_handler,
    unhandled_exception_handler,
)
from backend.app.core.logging import setup_logging
from backend.app.core.middleware import (
    CorrelationIdMiddleware,
    SecurityHeadersMiddleware,
    SimpleRateLimiterMiddleware,
)

# Route imports
from backend.app.api.v1.health import router as health_router
from backend.app.api.v1.foundation import router as foundation_router
from backend.app.api.v1.auth import router as auth_router
from backend.app.api.v1.organizations import router as organizations_router
from backend.app.api.v1.cases import router as cases_router
from backend.app.api.v1.clients import router as clients_router
from backend.app.api.v1.notifications import router as notifications_router
from backend.app.api.v1.roles import router as roles_router
from backend.app.api.v1.documents import router as documents_router
from backend.app.api.v1.findings import router as findings_router
from backend.app.api.v1.rules import router as rules_router
from backend.app.api.v1.requests import router as requests_router
from backend.app.api.v1.messaging import router as messaging_router
from backend.app.api.v1.portal import router as portal_router
from backend.app.api.v1.forms import router as forms_router
from backend.app.api.v1.packages import router as packages_router
from backend.app.api.v1.billing import router as billing_router
from backend.app.api.v1.analytics import router as analytics_router
from backend.app.api.v1.operations import router as operations_router
from backend.app.api.v1.firm_config import router as firm_config_router, tenant_firm_config_router

# Initialize structured logging
setup_logging()
settings = get_settings()

app = FastAPI(
    title="AI Immigration SaaS API",
    version="1.0.0",
    description="Multi-tenant immigration case management and evidence intelligence platform.",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    openapi_tags=[
        {"name": "authentication", "description": "Login, logout, session lifecycle, password reset, invitations, and MFA"},
        {"name": "organizations", "description": "Multi-tenant organization, branch, team, member, and invitation management"},
        {"name": "cases", "description": "Immigration cases, petition lifecycles, and staff assignments with object-level authorization"},
        {"name": "clients", "description": "Retained client and applicant profiles with strict privacy"},
        {"name": "notifications", "description": "User notifications, alerts, and deadline tracking"},
        {"name": "roles", "description": "Platform roles, permissions, and security boundary assignment rules"},
        {"name": "documents", "description": "Document management, OCR, structured extraction, provenance, and verification"},
        {"name": "findings", "description": "AI discrepancy detection, document validation, and discrepancy resolution"},
        {"name": "rules", "description": "Versioned immigration rules, official sources, and declarative requirement engine"},
        {"name": "foundation", "description": "System foundation, tenant health, and immutable audit log"},
        {"name": "health", "description": "Service health and readiness probes"},
    ],
)

# Exception Handlers
app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

# Middlewares
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(SimpleRateLimiterMiddleware, max_requests=settings.rate_limit_per_minute)
app.add_middleware(CorrelationIdMiddleware)

# Versioned API routes
app.include_router(health_router, prefix="/api/v1")
app.include_router(foundation_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(organizations_router, prefix="/api/v1")
app.include_router(cases_router, prefix="/api/v1")
app.include_router(clients_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
app.include_router(roles_router, prefix="/api/v1")
app.include_router(documents_router, prefix="/api/v1")
app.include_router(findings_router, prefix="/api/v1")
app.include_router(rules_router, prefix="/api/v1")
app.include_router(requests_router, prefix="/api/v1")
app.include_router(messaging_router, prefix="/api/v1")
app.include_router(portal_router, prefix="/api/v1")
app.include_router(forms_router, prefix="/api/v1")
app.include_router(packages_router, prefix="/api/v1")
app.include_router(billing_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(operations_router, prefix="/api/v1")
app.include_router(firm_config_router, prefix="/api/v1")
app.include_router(tenant_firm_config_router, prefix="/api/v1")


@app.get("/", tags=["health"])
def root() -> dict[str, str]:
    return {
        "service": "ai-immigration-api",
        "status": "ok",
        "version": "1.0.0",
        "environment": settings.environment,
    }
