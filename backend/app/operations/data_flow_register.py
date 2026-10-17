"""Data-Flow & Processing Provider Register.

Maintains a comprehensive register of all data storage, processing locations,
and every OCR/AI provider used across the Documento platform.
Complies with GDPR Article 30 (Records of Processing Activities),
India DPDP Act Section 8 (Data Fiduciary obligations), and PIPEDA Principle 4.1.
"""

from typing import Any, Dict, List


DATA_FLOW_REGISTER: List[Dict[str, Any]] = [
    {
        "component_name": "Primary Relational Database",
        "entity_type": "Data Store",
        "purpose": "Stores core application state, case metadata, client profiles, and user sessions",
        "provider": "PostgreSQL (Managed RDS / Cloud SQL) / SQLite Local",
        "storage_region": "Primary: AWS us-east-1 / Optional: AWS ca-central-1 (Canada dedicated tenant)",
        "encryption_at_rest": "AES-256 (KMS / dm-crypt)",
        "encryption_in_transit": "TLS 1.3",
        "retention_period": "Duration of active representation + 30-day post-completion minimization window",
        "external_egress": False,
        "third_party_access": False,
    },
    {
        "component_name": "Encrypted Document Vault",
        "entity_type": "Object Storage",
        "purpose": "Stores uploaded client evidence, affidavits, scanned certificates, and generated filing packages",
        "provider": "AWS S3 / GCP Cloud Storage / Local Secure Storage",
        "storage_region": "Primary: AWS us-east-1 / Secondary: AWS ca-central-1 (Canada tenancy)",
        "encryption_at_rest": "AES-256-GCM (SSE-KMS with firm-specific customer-managed keys)",
        "encryption_in_transit": "TLS 1.3",
        "retention_period": "Governed by Document Retention & Inactivity Policy (Day 15 cleanup on idle files)",
        "external_egress": False,
        "third_party_access": False,
    },
    {
        "component_name": "Local OCR Processing Engine",
        "entity_type": "Processing Engine",
        "purpose": "First-pass typographical optical character recognition and visual bounding box calculation",
        "provider": "Tesseract 5.3 / PyPDF / Local Worker Subprocess",
        "storage_region": "In-Memory RAM buffer on private worker node (zero persistent disk writes)",
        "encryption_at_rest": "Ephemeral In-Memory (Zero at-rest persistence)",
        "encryption_in_transit": "Internal Unix socket / local loopback TLS",
        "retention_period": "0 seconds (immediate memory deallocation upon extraction)",
        "external_egress": False,
        "third_party_access": False,
    },
    {
        "component_name": "Cloud AI Vision & LLM Fallback Provider",
        "entity_type": "AI Extraction & Intelligence",
        "purpose": "Complex handwriting extraction, non-English translation, and cross-document discrepancy audit",
        "provider": "Google Cloud Gemini / Anthropic Claude API",
        "storage_region": "US-Central / Global Private Endpoint with Zero Data Retention",
        "encryption_at_rest": "Provider Ephemeral Processing Only",
        "encryption_in_transit": "TLS 1.3 with Certificate Pinning",
        "retention_period": "Zero data retention commitment (`do_not_train: true`)",
        "external_egress": True,
        "third_party_access": True,
        "pre_flight_safeguards": [
            "PII redaction (SSN, Aadhaar, PAN, payment cards)",
            "Client consent verification (`ai_cloud_processing` and `cross_border_data_transfer`)",
            "Fail-closed local processing fallback when consent is absent",
        ],
    },
    {
        "component_name": "Transactional Outbox & Background Processing Queue",
        "entity_type": "Message Broker & Queue",
        "purpose": "Asynchronous document indexing, OCR jobs, and notification dispatches",
        "provider": "Internal Transactional Outbox Table (`outbox_events`) + Polling Worker Daemon",
        "storage_region": "Internal database colocation",
        "encryption_at_rest": "AES-256",
        "encryption_in_transit": "TLS 1.3",
        "retention_period": "Published events retained for 14 days before automatic compaction",
        "external_egress": False,
        "third_party_access": False,
    },
    {
        "component_name": "Immutable Audit Trail & Checksum Vault",
        "entity_type": "Audit & Compliance Log",
        "purpose": "WORM (Write-Once-Read-Many) cryptographic record of all administrative, file, and legal actions",
        "provider": "Documento Immutable Audit Engine (`audit_events`)",
        "storage_region": "Primary relational database + cold daily S3 archive snapshots",
        "encryption_at_rest": "AES-256",
        "encryption_in_transit": "TLS 1.3",
        "retention_period": "Permanent statutory audit record (7 years for legal compliance)",
        "external_egress": False,
        "third_party_access": False,
    },
    {
        "component_name": "Encrypted Backup & Disaster Recovery Store",
        "entity_type": "Backup Storage",
        "purpose": "Point-in-time disaster recovery snapshots with SHA-256 integrity verification",
        "provider": "AWS S3 Glacier Instant Retrieval / Encrypted Cross-Region Vault",
        "storage_region": "AWS us-west-2 / AWS ca-central-1 (Cross-Region Replica)",
        "encryption_at_rest": "AES-256 (KMS CMK)",
        "encryption_in_transit": "TLS 1.3",
        "retention_period": "Rolling 30-day snapshot policy; backup lifecycle rules purge expired versions",
        "external_egress": False,
        "third_party_access": False,
    },
]


def get_data_flow_register() -> Dict[str, Any]:
    """Returns the data flow register with summary statistics."""
    external_count = sum(1 for item in DATA_FLOW_REGISTER if item["external_egress"])
    return {
        "register_version": "2026.11",
        "total_components": len(DATA_FLOW_REGISTER),
        "internal_components": len(DATA_FLOW_REGISTER) - external_count,
        "external_processors": external_count,
        "zero_training_guarantee": True,
        "components": DATA_FLOW_REGISTER,
    }
