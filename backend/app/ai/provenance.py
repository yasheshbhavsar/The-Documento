"""Evidence Traceability, Three-Tier Verification, and Provenance Metadata Framework.

Implements Phase 10 Guardrails:
1. Three-Tier Separation:
   - Tier 1: Extracted Fact (Verbatim source evidence with exact page, coords, and OCR raw text).
   - Tier 2: Model Inference (AI-derived candidate fields, classifications, anomaly flags, and draft templates).
   - Tier 3: Professional Decision (Human legal review, manual correction, dismissal justification, or sign-off).
2. Explicit Guardrail Disclaimers:
   - AI does not decide legal eligibility, authenticity, fraud, or legal sufficiency.
   - High OCR confidence != legal sufficiency.
3. Complete Provenance Tracking:
   - Provider, model, pipeline version, prompt version, and exact source references.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID

logger = logging.getLogger("ai_immigration.ai.provenance")

# Statutory and Regulatory Guardrail Disclaimers
LEGAL_SUFFICIENCY_GUARDRAIL = (
    "AI systems do not decide legal eligibility, document authenticity, fraud, or legal sufficiency. "
    "All model inferences represent automated assistance and must be independently adjudicated by licensed legal professionals."
)

HIGH_CONFIDENCE_NOT_LEGAL_SUFFICIENCY_NOTICE = (
    "High optical character recognition (OCR) and extraction confidence reflects typographical and contrast fidelity only; "
    "it does not constitute evidentiary or statutory legal sufficiency under governing immigration regulations."
)


class EvidenceTier(str, Enum):
    EXTRACTED_FACT = "extracted_fact"          # Tier 1: Verbatim document source
    MODEL_INFERENCE = "model_inference"        # Tier 2: AI hypothesis / suggestion / candidate
    PROFESSIONAL_DECISION = "professional_decision"  # Tier 3: Human professional action

ProvenanceTier = EvidenceTier


@dataclass
class SourceReference:
    document_id: str
    document_title: str
    document_version: int = 1
    page_number: int = 1
    bounding_box: Optional[Dict[str, float]] = None
    raw_verbatim_text: Optional[str] = None


@dataclass
class AIProvenanceMetadata:
    provider: str = "mock_local"
    model: str = "mock-vision-neural-v2"
    pipeline_version: str = "doc_intel_v10.0"
    prompt_version: str = "legal_doc_prompt_v10.1"
    generated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    source_references: List[Dict[str, Any]] = field(default_factory=list)
    confidence_score: float = 0.95
    do_not_train: bool = True
    disclaimer: str = LEGAL_SUFFICIENCY_GUARDRAIL


@dataclass
class ThreeTierEntity:
    """Standard container encapsulating the 3 distinct evidentiary tiers."""
    entity_id: str
    field_name: str
    field_label: str
    tier: EvidenceTier
    
    # Tier 1: Extracted Fact
    verbatim_raw_value: str
    source_page: int = 1
    source_location: Optional[Dict[str, Any]] = None
    ocr_confidence: float = 0.95

    # Tier 2: Model Inference
    candidate_normalized_value: Optional[str] = None
    inference_confidence: float = 0.95
    provenance: Optional[AIProvenanceMetadata] = None

    # Tier 3: Professional Decision
    human_status: str = "unverified"  # unverified, verified, corrected, dismissed
    human_verified_value: Optional[str] = None
    decision_maker_user_id: Optional[str] = None
    decision_timestamp: Optional[str] = None
    decision_rationale: Optional[str] = None


def format_three_tier_entity(
    field_id: str,
    field_name: str,
    field_label: str,
    raw_value: str,
    normalized_value: Optional[str] = None,
    source_page: int = 1,
    source_location: Optional[dict] = None,
    ocr_confidence: float = 0.95,
    extraction_confidence: float = 0.95,
    model_version: str = "mock-vision-neural-v2",
    validation_status: str = "unvalidated",
    corrected_value: Optional[str] = None,
    corrected_by_user_id: Optional[str] = None,
    corrected_at: Optional[str] = None,
    correction_reason: Optional[str] = None,
) -> Dict[str, Any]:
    """Serializes a field with explicit 3-tier boundaries and legal disclaimers."""
    is_human_action = validation_status in ("verified", "corrected", "dismissed")
    current_tier = (
        EvidenceTier.PROFESSIONAL_DECISION
        if is_human_action
        else EvidenceTier.MODEL_INFERENCE
    )

    return {
        "id": field_id,
        "field_name": field_name,
        "field_label": field_label,
        "current_tier": current_tier.value,
        "tiers": {
            "tier1_extracted_fact": {
                "verbatim_text": raw_value,
                "source_page": source_page,
                "bounding_box": source_location,
                "ocr_confidence": ocr_confidence,
                "optical_fidelity_disclaimer": HIGH_CONFIDENCE_NOT_LEGAL_SUFFICIENCY_NOTICE,
            },
            "tier2_model_inference": {
                "candidate_normalized_value": normalized_value or raw_value,
                "extraction_confidence": extraction_confidence,
                "provenance": {
                    "provider": "gemini" if "gemini" in model_version.lower() else "mock_local",
                    "model": model_version,
                    "pipeline_version": "doc_intel_v10.0",
                    "prompt_version": "legal_doc_prompt_v10.1",
                    "do_not_train": True,
                },
                "legal_scope_guardrail": LEGAL_SUFFICIENCY_GUARDRAIL,
            },
            "tier3_professional_decision": {
                "status": "verified" if validation_status == "valid" else validation_status,
                "effective_value": corrected_value if corrected_value is not None else (normalized_value or raw_value),
                "is_manually_corrected": bool(corrected_value is not None),
                "decision_maker_user_id": corrected_by_user_id,
                "decision_timestamp": corrected_at,
                "rationale": correction_reason,
            },
        },
    }
