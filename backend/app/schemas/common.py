from typing import Any, Optional
from pydantic import BaseModel, Field


class ErrorResponseEnvelope(BaseModel):
    error: str = Field(..., description="Exception class or category code")
    message: str = Field(..., description="Human-readable user-facing message")
    detail: str = Field(..., description="Technical detail or error summary")
    details: Optional[Any] = Field(default=None, description="Detailed validation breakdown or field error list")
    correlation_id: str = Field(..., description="Unique request tracing correlation identifier")
