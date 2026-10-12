from typing import Any
from fastapi import Request, status
from fastapi.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)


class AppException(Exception):
    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST, details: Any = None):
        self.message = message
        self.status_code = status_code
        self.details = details
        super().__init__(message)


class AuthenticationError(AppException):
    def __init__(self, message: str = "Authentication required", details: Any = None):
        super().__init__(message, status_code=status.HTTP_401_UNAUTHORIZED, details=details)


class PermissionDeniedError(AppException):
    def __init__(self, message: str = "Permission denied", details: Any = None):
        super().__init__(message, status_code=status.HTTP_403_FORBIDDEN, details=details)


class TenantIsolationError(AppException):
    def __init__(self, message: str = "Cross-tenant access strictly forbidden", details: Any = None):
        super().__init__(message, status_code=status.HTTP_403_FORBIDDEN, details=details)


class EntityNotFoundError(AppException):
    def __init__(self, entity_name: str, entity_id: Any):
        super().__init__(f"{entity_name} '{entity_id}' not found", status_code=status.HTTP_404_NOT_FOUND)


class NotFoundError(AppException):
    def __init__(self, message: str = "Resource not found", details: Any = None):
        super().__init__(message, status_code=status.HTTP_404_NOT_FOUND, details=details)


class ConflictError(AppException):
    def __init__(self, message: str, details: Any = None):
        super().__init__(message, status_code=status.HTTP_409_CONFLICT, details=details)


class ValidationError(AppException):
    def __init__(self, message: str, details: Any = None):
        super().__init__(message, status_code=status.HTTP_400_BAD_REQUEST, details=details)


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    logger.warning("Application exception: %s (status %s)", exc.message, exc.status_code, extra={"path": request.url.path})
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.__class__.__name__,
            "message": exc.message,
            "detail": exc.message,
            "details": exc.details,
        },
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled server exception: %s", str(exc), exc_info=True, extra={"path": request.url.path})
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "InternalServerError",
            "message": "An unexpected server error occurred. Please contact support.",
        },
    )
