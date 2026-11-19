export type DocumentCategory =
  | "identity_passport"
  | "civil_status"
  | "visas_residence_permits"
  | "educational_records"
  | "employment_records"
  | "financial_evidence"
  | "travel_records"
  | "insurance_accommodation"
  | "police_medical"
  | "government_correspondence"
  | "translations_certifications"
  | "supporting_evidence";

export interface FieldCorrectionAudit {
  old_value: string;
  new_value: string;
  reason: string;
  corrected_by?: string;
  corrected_at: string;
}

export interface DocumentExtractedField {
  id: string;
  field_name: string;
  field_label: string;
  original_value: string;
  normalized_value: string;
  source_page: number;
  source_location?: {
    x0?: number;
    y0?: number;
    x1?: number;
    y1?: number;
    block_idx?: number;
    bounding_box?: [number, number, number, number] | number[];
    [key: string]: any;
  };
  extraction_method: string;
  model_version?: string;
  ocr_confidence: number;
  extraction_confidence: number;
  validation_status: "unvalidated" | "verified" | "flagged" | "corrected" | "needs_review" | "rejected" | string;
  is_manually_corrected: boolean;
  corrected_value?: string;
  corrected_at?: string;
  correction_reason?: string;
  correction_history?: FieldCorrectionAudit[];
  field_value?: string;
  confidence?: number;
}

export type DocumentProcessingStatus = "pending" | "processing" | "completed" | "failed";
export type DocumentVerificationStatus = "unverified" | "under_review" | "verified" | "rejected";
export type DocumentStatus = "verified" | "under_review" | "action_needed" | "missing";
export type ProcessingStage = "queued" | "preprocessing" | "ocr" | "classification" | "extraction" | "completed" | "failed";

export interface DocumentProcessingRunItem {
  id: string;
  organization_id: string;
  document_id: string;
  run_number: number;
  idempotency_key: string;
  stage: ProcessingStage | string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled" | string;
  trigger_type: "upload" | "reprocess" | "manual_retry" | string;
  progress_percent: number;
  error_code?: string;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  metrics?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DocumentVersionItem {
  id: string;
  version: number;
  filename: string;
  byte_size: number;
  sha256_hash: string;
  is_current_version: boolean;
  created_at: string;
}

export interface ReviewDimensionDetail {
  dimension: string;
  status: "passed" | "needs_review" | "warning" | "unverified" | "rejected" | string;
  score: number;
  label: string;
  summary: string;
  details: Record<string, any>;
  high_priority_flags: string[];
}

export interface DocumentSixDimensionsReview {
  document_id: string;
  document_version: number;
  readability: ReviewDimensionDetail;
  document_type: ReviewDimensionDetail;
  applicant_association: ReviewDimensionDetail;
  consistency: ReviewDimensionDetail;
  evidentiary_sufficiency: ReviewDimensionDetail;
  human_verification: ReviewDimensionDetail;
  overall_review_status: "verified" | "needs_review" | "rejected" | string;
  high_ocr_confidence_notice: string;
}

export interface FieldExtractionProvenance {
  field: string;
  value: string;
  source_document_version_id: string;
  page_number: number;
  bounding_box: [number, number, number, number]; // [ymin, xmin, ymax, xmax]
  confidence: number;
  extractor_version: string;
  review_status: "NEEDS_HUMAN_REVIEW" | "VERIFIED" | "CORRECTED" | "REJECTED" | string;
}

export interface DocumentExtractionsResponse {
  document_id: string;
  version: number;
  items: FieldExtractionProvenance[];
  count: number;
  legal_sufficiency_disclaimer: string;
}

export type ThreeTierCategory = "EXTRACTED_FACT" | "MODEL_INFERENCE" | "PROFESSIONAL_DECISION";

export interface ThreeTierEntity {
  field_name: string;
  field_label: string;
  tier: ThreeTierCategory;
  tier_number: 1 | 2 | 3;
  tier_label: string;
  tier_badge_color: "emerald" | "amber" | "indigo" | "blue" | "slate" | string;
  value: any;
  normalized_value?: any;
  confidence: number;
  source_page?: number;
  bounding_box?: [number, number, number, number] | number[];
  model_or_method?: string;
  source_document_title?: string;
  decision_notes?: string;
  decided_by?: string;
  decided_at?: string;
  statutory_disclaimer: string;
}

export interface DocumentItem {
  id: string;
  case_id?: string;
  case_number?: string;
  client_id?: string;
  title: string;
  filename?: string;
  category: DocumentCategory | string;
  file_size?: string;
  byte_size?: number;
  mime_type?: string;
  version?: number;
  is_current_version?: boolean;
  uploaded_by?: string;
  status: DocumentStatus;
  processing_status?: DocumentProcessingStatus;
  verification_status?: DocumentVerificationStatus;
  sha256_hash: string;
  uploaded_at: string;
  created_at?: string;
  detected_language?: string;
  page_count?: number;
  ocr_applied?: boolean;
  extracted_text?: string;
  layout_metadata?: any;
  extracted_fields?: DocumentExtractedField[];
  verification_notes?: string;
  verified_at?: string;
  verified_by_user_id?: string;
  malware_scan_status?: "clean" | "suspicious" | "infected" | "skipped";
  processing_error?: string;
  retry_count?: number;
  download_url?: string;
  tamper_verified?: boolean;
  active_run_id?: string;
  active_run_stage?: ProcessingStage | string;
  active_run_progress_percent?: number;
  proposed_category?: string;
  proposed_applicant_name?: string;
  applicant_dependant_id?: string;
  is_assignment_confirmed?: boolean;
  has_unresolved_anomaly?: boolean;
  anomaly_notes?: string;
  review_dimensions?: DocumentSixDimensionsReview;
  three_tier_extractions?: ThreeTierEntity[];
  sub_documents_metadata?: any[];
  suggested_boundaries?: any[];
  provenance_extractions?: FieldExtractionProvenance[];
  legal_sufficiency_disclaimer?: string;
  // Raw Client/Sponsor Packet -> Paralegal AI Lab Sorted Tree Metadata
  is_raw_packet?: boolean;
  raw_packet_id?: string;
  ai_lab_status?: "pending" | "completed";
  parent_packet_id?: string;
  page_range?: string;
  page_numbers?: number[];
  person_role?: string;
  person_name?: string;
  uploader_role?: "applicant" | "sponsor" | "staff";
  is_private_to_firm?: boolean;
}

export interface RouteFindingPayload {
  owner_user_id: string;
  note: string;
  due_date?: string;
  client_facing_template?: string;
}

export type FindingSeverity = "critical" | "major" | "minor" | "informational" | "warning" | "advisory";
export type FindingStatus = "needs_review" | "unable_to_determine" | "resolved" | "dismissed" | "open" | "verified_resolved";
export type FindingType =
  | "consistency_discrepancy"
  | "document_quality"
  | "apparent_expiration"
  | "missing_evidence"
  | "form_evidence_conflict"
  | "statutory_criteria"
  | "other";

export interface FindingResolutionAudit {
  timestamp: string;
  action: "resolve" | "dismiss" | "escalate" | string;
  reviewer_id?: string;
  reviewer_email?: string;
  reason?: string;
  note?: string;
}

export interface RelatedDocumentRef {
  document_id: string;
  title: string;
  category?: string;
  page?: number;
}

export interface RelatedFieldRef {
  field_name: string;
  field_label: string;
  original_value?: string;
  normalized_value?: string;
}

export interface AIFinding {
  id: string;
  case_id: string;
  finding_type?: FindingType | string;
  category?: "evidence_gap" | "contradiction" | "statutory_criteria" | "consistency" | string;
  severity: FindingSeverity;
  status: FindingStatus;
  title: string;
  description: string;
  evidence_text?: string;
  source_location?: {
    document_id?: string;
    document_title?: string;
    page?: number;
    bbox?: { x0?: number; y0?: number; x1?: number; y1?: number };
    [key: string]: any;
  };
  related_documents?: RelatedDocumentRef[];
  related_fields?: RelatedFieldRef[];
  relevant_requirement?: string;
  recommended_action?: string;
  clarification_question?: string;
  uncertainty_limitations?: string;
  linked_task_id?: string;
  is_confirmed_contradiction?: boolean;
  reviewer_id?: string;
  resolved_at?: string;
  resolution_action?: "resolve" | "dismiss" | "escalate" | string;
  resolution_reason?: string;
  resolution_history?: FindingResolutionAudit[];
  citation?: string;
  owner_user_id?: string;
  due_date?: string;
  evidence_reference?: {
    document_id?: string;
    page?: number;
    evidence_text?: string;
    [key: string]: any;
  };
  client_facing_template?: string;
  internal_risk_notes?: string;
}

export const VALID_DISMISSAL_REASONS = [
  { value: "acceptable_transliteration", label: "Acceptable Transliteration Variation" },
  { value: "verified_name_change", label: "Verified Name Change (Civil Record On File)" },
  { value: "ocr_scan_artifact", label: "OCR Scanning Artifact (Physical Scan Legible)" },
  { value: "client_clarification_confirmed", label: "Client Provided Clarification" },
  { value: "statutory_exception_applies", label: "Statutory or Policy Exception Applies" },
  { value: "duplicate_finding", label: "Duplicate or Subsumed in Related Finding" },
  { value: "other_justified_reason", label: "Other Justified Legal Reason" },
] as const;

export interface UploadGuidance {
  focus_guidance: string;
  lighting_guidance: string;
  glare_guidance: string;
  orientation_guidance: string;
  corners_guidance: string;
  legibility_guidance: string;
  supported_mime_types: string[];
  max_file_size_bytes: number;
  non_acceptance_disclaimer: string;
}

export interface BatchUploadItemReceipt {
  document_id?: string;
  filename: string;
  byte_size: number;
  sha256_hash: string;
  status: "uploaded" | "duplicate_existing" | "failed";
  is_duplicate: boolean;
  existing_document_id?: string;
  proposed_category?: string;
  proposed_applicant_name?: string;
  is_assignment_confirmed: boolean;
  error_message?: string;
}

export interface BatchUploadReceipt {
  batch_id: string;
  total_files: number;
  uploaded_count: number;
  duplicate_count: number;
  failed_count: number;
  items: BatchUploadItemReceipt[];
  non_acceptance_disclaimer: string;
}

export interface ApplicantOutstandingItem {
  requirement_id: string;
  title: string;
  category: string;
  is_mandatory: boolean;
}

export interface ApplicantDocumentItem {
  document_id: string;
  title: string;
  category: string;
  processing_status: string;
  verification_status: string;
  has_unresolved_anomaly: boolean;
  created_at: string;
}

export interface ApplicantDocumentSummary {
  applicant_id?: string | null;
  applicant_name: string;
  relationship: string;
  outstanding: ApplicantOutstandingItem[];
  received: ApplicantDocumentItem[];
  correction_required: ApplicantDocumentItem[];
}

export interface FamilyDocumentSummary {
  case_id: string;
  case_number: string;
  total_required: number;
  total_received: number;
  total_verified: number;
  total_correction_required: number;
  total_unassigned: number;
  applicants: ApplicantDocumentSummary[];
  unassigned_documents: DocumentItem[];
  non_readiness_disclaimer: string;
}

export interface PurgeRequestResponse {
  confirmation_token: string;
  document_id: string;
  filename: string;
  expires_at: string;
  impact_summary: string;
  local_copy_notice: string;
  required_acknowledgment: string;
}

export interface PurgeConfirmResponse {
  document_id: string;
  purged: boolean;
  purged_at: string;
  audit_correlation_id: string;
  local_copy_notice: string;
}

export interface VerifyDocumentDownloadResponse {
  document_id: string;
  is_verified: boolean;
  verified_at: string;
  verification_limits_notice: string;
  local_copy_notice: string;
}

export type StructuredRejectionReasonCode =
  | "BLURRY_IMAGE"
  | "MISSING_PAGES"
  | "EXPIRED_RECORD"
  | "TAMPERING_SUSPECTED"
  | "WRONG_APPLICANT"
  | "INCOMPLETE_DOCUMENT"
  | "ILLEGIBLE_TRANSLATION"
  | "UNOFFICIAL_COPY"
  | "OTHER";

export interface StructuredRejectionReasonOption {
  code: StructuredRejectionReasonCode;
  label: string;
  description: string;
}

export const STRUCTURED_REJECTION_REASONS: StructuredRejectionReasonOption[] = [
  { code: "BLURRY_IMAGE", label: "Blurry or Low-Resolution Scan", description: "Image resolution is insufficient for OCR extraction or statutory verification." },
  { code: "MISSING_PAGES", label: "Missing Pages or Attachments", description: "Multi-page statutory instrument is missing required pages or schedules." },
  { code: "EXPIRED_RECORD", label: "Expired Document or Credential", description: "Record has expired prior to statutory filing eligibility threshold." },
  { code: "TAMPERING_SUSPECTED", label: "Suspected Modification / Hash Discrepancy", description: "Visible signs of tampering, font irregularities, or verification hash mismatch." },
  { code: "WRONG_APPLICANT", label: "Wrong Applicant / Identity Mismatch", description: "Document names an individual other than the designated applicant or dependant." },
  { code: "INCOMPLETE_DOCUMENT", label: "Incomplete / Partial Document", description: "Document lacks mandatory signatures, seals, or required statutory provisions." },
  { code: "ILLEGIBLE_TRANSLATION", label: "Illegible / Missing Certified Translation", description: "Foreign language record lacks certified English translation or translator certification." },
  { code: "UNOFFICIAL_COPY", label: "Unofficial Copy / Missing Certification", description: "Official issuing authority stamp or certified copy is required by the jurisdiction." },
  { code: "OTHER", label: "Other Statutory Non-Compliance", description: "Custom reason detailed in client-facing legal explanation." },
];

export interface RejectDocumentPayload {
  structured_reason_code: StructuredRejectionReasonCode;
  client_explanation: string;
  internal_notes?: string;
}

export interface DocumentSplitSection {
  title: string;
  category: string;
  start_page: number;
  end_page: number;
  confidence?: number;
}

export interface CitationReference {
  citation_type: 'statute_authority' | 'case_evidence_document';
  source_title: string;
  page_number?: number | null;
  section_reference?: string | null;
  snippet: string;
  reliability_tier: 'high' | 'medium' | 'low';
}

export interface RAGQueryRequest {
  case_id: string;
  query: string;
  jurisdiction?: string;
  visa_category?: string;
}

export interface GovernedRAGResponse {
  query: string;
  answer: string;
  jurisdiction: string;
  visa_category: string;
  is_grounded: boolean;
  evidence_found: boolean;
  confidence_score: number;
  citations: CitationReference[];
  uncertainty_disclosures: string[];
  prompt_guard_defanged: boolean;
  token_usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    estimated_cost_usd: number;
  };
  legal_sufficiency_disclaimer: string;
}

export interface EvaluationGateResult {
  gate_id: string;
  gate_name: string;
  benchmark_target: string;
  achieved_metric: string;
  status: 'PASSED' | 'FAILED';
  description: string;
}

export interface AIEvaluationReport {
  evaluated_at: string;
  overall_status: 'PASSED' | 'BLOCKED';
  gates_passed_count: number;
  total_gates: number;
  readiness_percentage: number;
  gates: EvaluationGateResult[];
}

export interface TokenUsageMetrics {
  organization_id: string;
  monthly_token_quota: number;
  tokens_used_this_month: number;
  quota_remaining_tokens: number;
  quota_percentage_used: number;
  quota_exceeded: boolean;
  estimated_cost_usd_this_month: number;
  monthly_cost_cap_usd: number;
  total_operations_recorded: number;
  model_distribution: Record<string, number>;
  operation_breakdown: Record<string, number>;
}

export interface CaseEvidenceBriefFact {
  field_label: string;
  value: string;
  source_document: string;
  source_page: number;
  confidence: number;
}

export interface CaseEvidenceBriefDiscrepancy {
  id?: string;
  severity: string;
  title: string;
  description: string;
  is_confirmed_contradiction?: boolean;
  status: string;
}

export interface CaseEvidenceBriefQuestion {
  finding_id?: string;
  question: string;
  severity?: string;
  recommended_action?: string;
}

export interface CaseEvidenceBrief {
  case_number: string;
  jurisdiction: string;
  visa_category: string;
  generated_at: string;
  verified_facts: CaseEvidenceBriefFact[];
  potential_discrepancies: CaseEvidenceBriefDiscrepancy[];
  uncertainty_disclosures: string[];
  suggested_clarification_questions: CaseEvidenceBriefQuestion[];
  summary_markdown: string;
}

export interface PromptGuardScanResult {
  is_flagged: boolean;
  risk_score: number;
  detected_patterns: string[];
  sanitized_text: string;
}
