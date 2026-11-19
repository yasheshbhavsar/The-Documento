"""Unified v1 API Router initialization and endpoint governance registry."""

from fastapi import APIRouter

from backend.app.api.v1.agency_platform import router as agency_platform_router
from backend.app.api.v1.ai import router as ai_router
from backend.app.api.v1.analytics import router as analytics_router
from backend.app.api.v1.appointments import router as appointments_router
from backend.app.api.v1.auth import router as auth_router
from backend.app.api.v1.billing import router as billing_router
from backend.app.api.v1.cases import router as cases_router
from backend.app.api.v1.clients import router as clients_router
from backend.app.api.v1.documents import router as documents_router
from backend.app.api.v1.extractor import router as extractor_router
from backend.app.api.v1.findings import router as findings_router
from backend.app.api.v1.firm_config import (
    router as firm_config_router,
    tenant_firm_config_router,
)
from backend.app.api.v1.forms import router as forms_router
from backend.app.api.v1.foundation import router as foundation_router
from backend.app.api.v1.governance import router as governance_router
from backend.app.api.v1.health import router as health_router
from backend.app.api.v1.messaging import router as messaging_router
from backend.app.api.v1.notifications import router as notifications_router
from backend.app.api.v1.operations import router as operations_router
from backend.app.api.v1.organizations import router as organizations_router
from backend.app.api.v1.packages import router as packages_router
from backend.app.api.v1.portal import router as portal_router
from backend.app.api.v1.requests import router as requests_router
from backend.app.api.v1.roles import router as roles_router
from backend.app.api.v1.rules import router as rules_router

V1_ROUTERS = (
    health_router,
    foundation_router,
    auth_router,
    organizations_router,
    cases_router,
    clients_router,
    notifications_router,
    roles_router,
    documents_router,
    findings_router,
    rules_router,
    requests_router,
    messaging_router,
    portal_router,
    forms_router,
    packages_router,
    billing_router,
    analytics_router,
    operations_router,
    firm_config_router,
    tenant_firm_config_router,
    governance_router,
    appointments_router,
    extractor_router,
    ai_router,
    agency_platform_router,
)

api_router = APIRouter()
for _router in V1_ROUTERS:
    api_router.include_router(_router)

__all__ = ["api_router", "V1_ROUTERS"]
