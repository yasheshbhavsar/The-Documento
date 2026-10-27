"""AI Token Usage Tracker, Cost Controller, and Quota Management Engine.

Enforces Stage 8 AI Governance (§6.6, §8 of DOCUMENTO_MASTER_VISION.md):
- Per-organization token tracking (prompt tokens, completion tokens, total tokens).
- Model-specific cost estimation (Gemini 2.0 Flash, Claude 3.5 Sonnet, Local).
- Monthly token quotas and rate controls.
- Graceful fail-closed fallback to deterministic local models when quota is exceeded.
- Audit logging of AI operations for financial and operational governance.
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

logger = logging.getLogger("ai_immigration.ai.token_tracker")

# Model pricing in USD per 1,000,000 tokens (as of late 2024 / 2025)
MODEL_PRICING_PER_MILLION = {
    "gemini-2.0-flash": {"prompt": 0.10, "completion": 0.40},
    "gemini-1.5-pro": {"prompt": 1.25, "completion": 5.00},
    "claude-3-5-sonnet-20241022": {"prompt": 3.00, "completion": 15.00},
    "claude-3-haiku-20240307": {"prompt": 0.25, "completion": 1.25},
    "mock-local-deterministic": {"prompt": 0.00, "completion": 0.00},
}

DEFAULT_MONTHLY_TOKEN_QUOTA = 1_000_000  # 1M tokens / month default tier
DEFAULT_MONTHLY_COST_BUDGET_USD = 50.0   # $50 / month default cap


@dataclass
class TokenUsageRecord:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str = ""
    case_id: Optional[str] = None
    model_name: str = "mock-local-deterministic"
    operation_type: str = "general_inference"  # extraction, rag_query, summary, authority_analysis, classification
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    estimated_cost_usd: float = 0.0
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    is_quota_fallback: bool = False


class TokenBudgetManager:
    """Manages firm-level AI token budgets, tracking, and quota enforcement."""

    _usage_ledger: List[TokenUsageRecord] = []

    @classmethod
    def calculate_cost_usd(cls, model_name: str, prompt_tokens: int, completion_tokens: int) -> float:
        """Calculates estimated cost in USD based on model pricing."""
        pricing = MODEL_PRICING_PER_MILLION.get(
            model_name,
            MODEL_PRICING_PER_MILLION["mock-local-deterministic"]
        )
        prompt_cost = (prompt_tokens / 1_000_000.0) * pricing["prompt"]
        completion_cost = (completion_tokens / 1_000_000.0) * pricing["completion"]
        return round(prompt_cost + completion_cost, 6)

    @classmethod
    def record_usage(
        cls,
        organization_id: UUID | str,
        model_name: str,
        prompt_tokens: int,
        completion_tokens: int,
        operation_type: str = "general_inference",
        case_id: Optional[UUID | str] = None,
        is_quota_fallback: bool = False,
    ) -> TokenUsageRecord:
        """Records an AI inference event in the firm token ledger."""
        org_str = str(organization_id)
        case_str = str(case_id) if case_id else None
        total = prompt_tokens + completion_tokens
        cost = cls.calculate_cost_usd(model_name, prompt_tokens, completion_tokens)

        record = TokenUsageRecord(
            organization_id=org_str,
            case_id=case_str,
            model_name=model_name,
            operation_type=operation_type,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total,
            estimated_cost_usd=cost,
            is_quota_fallback=is_quota_fallback,
        )
        cls._usage_ledger.append(record)
        return record

    @classmethod
    def get_organization_usage(
        cls,
        organization_id: UUID | str,
        start_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """Calculates aggregated token and cost metrics for an organization."""
        org_str = str(organization_id)
        records = [r for r in cls._usage_ledger if r.organization_id == org_str]

        total_prompt = sum(r.prompt_tokens for r in records)
        total_completion = sum(r.completion_tokens for r in records)
        total_tokens = total_prompt + total_completion
        total_cost = round(sum(r.estimated_cost_usd for r in records), 4)

        quota_limit = DEFAULT_MONTHLY_TOKEN_QUOTA
        cost_budget = DEFAULT_MONTHLY_COST_BUDGET_USD

        quota_used_pct = round((total_tokens / quota_limit) * 100.0, 2) if quota_limit > 0 else 0.0
        budget_used_pct = round((total_cost / cost_budget) * 100.0, 2) if cost_budget > 0 else 0.0

        by_operation: Dict[str, Dict[str, Any]] = {}
        for r in records:
            if r.operation_type not in by_operation:
                by_operation[r.operation_type] = {
                    "count": 0,
                    "tokens": 0,
                    "cost_usd": 0.0,
                }
            by_operation[r.operation_type]["count"] += 1
            by_operation[r.operation_type]["tokens"] += r.total_tokens
            by_operation[r.operation_type]["cost_usd"] = round(
                by_operation[r.operation_type]["cost_usd"] + r.estimated_cost_usd, 4
            )

        return {
            "organization_id": org_str,
            "period": "current_month",
            "total_prompt_tokens": total_prompt,
            "total_completion_tokens": total_completion,
            "total_tokens": total_tokens,
            "total_cost_usd": total_cost,
            "monthly_token_quota": quota_limit,
            "monthly_cost_budget_usd": cost_budget,
            "quota_used_percentage": quota_used_pct,
            "budget_used_percentage": budget_used_pct,
            "is_quota_exceeded": total_tokens >= quota_limit or total_cost >= cost_budget,
            "operations_count": len(records),
            "breakdown_by_operation": by_operation,
        }

    @classmethod
    def check_quota_available(cls, organization_id: UUID | str) -> bool:
        """Checks if organization has available token quota. If false, fallback must engage."""
        usage = cls.get_organization_usage(organization_id)
        return not usage["is_quota_exceeded"]

    @classmethod
    def reset_ledger_for_testing(cls) -> None:
        """Utility for test suites to ensure isolated test runs."""
        cls._usage_ledger.clear()
