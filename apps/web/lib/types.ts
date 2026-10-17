export type UserExperience = "master_admin" | "case_manager" | "client_applicant";

export type RoleCode =
  | "master_admin"
  | "company_admin"
  | "senior_reviewer"
  | "case_manager"
  | "document_reviewer"
  | "finance_staff"
  | "retained_client"
  | "organization_admin"
  | "case_worker"
  | "applicant";

export interface UserContext {
  id: string;
  email: string;
  full_name: string;
  role: RoleCode;
  organization_id: string;
  organization_name: string;
  experience: UserExperience;
  permissions: string[];
}
export type PaymentClearanceStatus = "PENDING" | "PARTIALLY_PAID" | "PAID";
export type PreparationStatus =
  | "CONSULTATION_ONLY"
  | "PRELIMINARY_ASSESSMENT"
  | "CLEARANCE_PENDING"
  | "AUTHORIZED_FOR_PREPARATION"
  | "PREPARATION_IN_PROGRESS"
  | "READY_FOR_FINAL_REVIEW"
  | "READY_TO_SUBMIT"
  | "SUBMITTED";

export type ClientEngagementType = "consultation" | "preliminary_assessment" | "retained";

export type SubmissionAuthorizationStatus =
  | "NOT_REQUESTED"
  | "REQUESTED"
  | "APPROVED"
  | "HELD_ACCOUNTS"
  | "HELD_COUNSELLOR"
  | "HELD_CLIENT_DECISION"
  | "REJECTED";

export type HandoverAuthorizationStatus =
  | "NOT_REQUESTED"
  | "REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "COMPLETED";

export type ProgressiveReviewStage =
  | "officer_initial_review"
  | "senior_review"
  | "lawyer_review";
export type OperationalState = "ACTIVE" | "ON_HOLD" | "WITHDRAWN" | "COMPLETED" | "ARCHIVED";
export type ReviewStatus =
  | "NOT_STARTED"
  | "INTERNAL_REVIEW"
  | "SENIOR_REVIEW"
  | "CLIENT_CONFIRMATION"
  | "APPROVED"
  | "CHANGES_REQUESTED";
export type AdjudicationOutcome =
  | "PENDING_ADJUDICATION"
  | "RFE_ISSUED"
  | "APPROVED"
  | "REFUSED"
  | "APPEALED";

export interface CaseHoldHistoryItem {
  id: string;
  case_id: string;
  hold_type: string;
  reason: string;
  placed_by_id: string;
  placed_at: string;
  released_by_id?: string | null;
  released_at?: string | null;
  resolution_notes?: string | null;
}

export interface PackageDownloadEvent {
  id: string;
  package_id: string;
  downloaded_by: string;
  downloaded_at: string;
  package_hash: string;
}

export type CaseStage =
  | "inquiry"
  | "intake"
  | "awaiting_documents"
  | "processing"
  | "internal_review"
  | "awaiting_client"
  | "ready_for_approval"
  | "approved_for_submission"
  | "submitted"
  | "decision_received"
  | "closed"
  | "archived"
  | "reopened"
  | "gathering"
  | "review"
  | "assembly"
  | "ready"
  | "filed"
  | "approved"
  | "rfe";

export interface CaseMilestone {
  id: string;
  case_id: string;
  title: string;
  stage: string;
  target_date: string;
  completed_at?: string;
  status: "pending" | "completed" | "overdue" | "waived";
  created_at: string;
}

export interface CaseNote {
  id: string;
  case_id: string;
  author_id?: string;
  author_name?: string;
  note_type: "internal" | "client_communication" | "legal_strategy" | "status_update";
  content: string;
  is_client_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface CaseTask {
  id: string;
  case_id: string;
  case_number?: string;
  title: string;
  description?: string;
  due_date: string;
  priority: "critical" | "high" | "medium" | "low";
  status?: string;
  is_completed: boolean;
  assigned_to?: string;
  assigned_to_user_id?: string;
  assigned_to_name?: string;
  completed_at?: string;
}

export interface CaseAssignmentItem {
  assignment_id: string;
  user_id: string;
  user_name?: string;
  role_in_case: string;
  assigned_at: string;
}

export interface ImmigrationCase {
  id: string;
  case_number: string;
  title: string;
  client_id: string;
  client_name: string;
  client_email?: string;
  client_nationality?: string;
  jurisdiction: string;
  visa_category: string;
  status: CaseStage;
  // Phase 2 Decoupled Lifecycle States
  payment_clearance_status?: PaymentClearanceStatus;
  preparation_status?: PreparationStatus;
  operational_state?: OperationalState;
  review_status?: ReviewStatus;
  outcome_status?: AdjudicationOutcome | null;
  hold_reason?: string | null;
  hold_applied_at?: string | null;
  prior_case_id?: string | null;
  reapplication_reason?: string | null;
  readiness_score?: number;
  assigned_manager?: string;
  reviewer_name?: string;
  deadline?: string;
  priority_date?: string;
  attention_required?: boolean;
  attention_reason?: string;
  organization_id: string;
  created_at: string;
  updated_at?: string;
  assignments?: CaseAssignmentItem[];
  milestones?: CaseMilestone[];
  notes?: CaseNote[];
  tasks?: CaseTask[];
  tasks_count?: number;
  // Phase 9 Decoupled State Machines and Approval Gates
  client_engagement_type?: ClientEngagementType;
  is_retained?: boolean;
  submission_authorization_status?: SubmissionAuthorizationStatus;
  handover_authorization_status?: HandoverAuthorizationStatus;
  substantive_authorizations?: SubstantiveAuthorizations;
  progressive_reviews?: ProgressiveReviews;
  firm_config_version?: number;
  firm_config_update_available?: boolean;
  pinned_firm_config_snapshot?: Record<string, any>;
  submission_hold_reason?: string | null;
  last_reminder_sent_at?: string | null;
  last_acknowledgement_sent_at?: string | null;
}

export interface SubstantiveAuthorizations {
  manager_authorization?: {
    authorized?: boolean;
    cleared?: boolean;
    authorized_by_id?: string | null;
    authorized_at?: string | null;
    actor_id?: string | null;
    actor_name?: string | null;
    actor_role?: string | null;
    notes?: string | null;
    waived?: boolean;
    waiver_reason?: string | null;
    [key: string]: any;
  };
  accounts_clearance?: {
    cleared?: boolean;
    authorized?: boolean;
    cleared_by_id?: string | null;
    cleared_at?: string | null;
    actor_id?: string | null;
    actor_name?: string | null;
    actor_role?: string | null;
    invoice_id?: string | null;
    notes?: string | null;
    waived?: boolean;
    waiver_reason?: string | null;
    [key: string]: any;
  };
  counsellor_confirmation?: {
    confirmed?: boolean;
    cleared?: boolean;
    authorized?: boolean;
    confirmed_by_id?: string | null;
    confirmed_at?: string | null;
    actor_id?: string | null;
    actor_name?: string | null;
    actor_role?: string | null;
    counsellor_name?: string | null;
    notes?: string | null;
    waived?: boolean;
    waiver_reason?: string | null;
    [key: string]: any;
  };
}

export interface ProgressiveReviewStageRecord {
  completed: boolean;
  reviewed_by_id?: string | null;
  reviewed_at?: string | null;
  notes?: string | null;
}

export interface ProgressiveReviews {
  officer_initial_review?: ProgressiveReviewStageRecord;
  senior_review?: ProgressiveReviewStageRecord;
  lawyer_review?: ProgressiveReviewStageRecord;
}

export type FirmConfigDomain =
  | "roles"
  | "country_pathway_enablement"
  | "folder_structure"
  | "checklist_versions"
  | "reminders_escalations"
  | "inactivity_policy"
  | "review_stages"
  | "approval_owners"
  | "templates"
  | "rejection_reasons";

export interface FirmConfiguration {
  organization_id: string;
  version: number;
  domains: {
    roles?: Record<string, any>;
    country_pathway_enablement?: Record<string, any>;
    folder_structure?: Record<string, any>;
    checklist_versions?: Record<string, any>;
    reminders_escalations?: Record<string, any>;
    inactivity_policy?: Record<string, any>;
    review_stages?: Record<string, any>;
    approval_owners?: Record<string, any>;
    templates?: Record<string, any>;
    rejection_reasons?: Record<string, any>;
    [key: string]: any;
  };
  immutable_safeguards: Record<string, boolean | string | number>;
}

export interface FirmConfigAuditLogItem {
  id: string;
  organization_id: string;
  domain: string;
  version: number;
  old_version: number;
  new_version: number;
  actor_id?: string | null;
  actor_email: string;
  old_version_json: any;
  new_version_json: any;
  reason: string;
  effective_date: string;
  created_at: string;
}

export interface ClientDependant {
  id: string;
  primary_client_id?: string;
  relationship_type: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  nationality: string;
  is_authorized_to_view_case: boolean;
  created_at: string;
}

export interface ClientConsent {
  id: string;
  client_id?: string;
  consent_type: string;
  granted: boolean;
  granted_at: string;
  revoked_at?: string;
  ip_address?: string;
  document_hash?: string;
  notes?: string;
}

export interface ClientProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  nationality: string;
  date_of_birth?: string;
  organization_id: string;
  created_at: string;
  dependants?: ClientDependant[];
  consents?: ClientConsent[];
  dependants_count?: number;
  cases_count?: number;
}

export interface DuplicateCandidate {
  client_id: string;
  client_name: string;
  client_email: string;
  match_type: string;
  confidence: "high" | "medium" | "low";
  score: number;
  details: string;
}

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
  validation_status: "unvalidated" | "verified" | "flagged" | "corrected";
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
  is_assignment_confirmed?: boolean;
  has_unresolved_anomaly?: boolean;
  anomaly_notes?: string;
  review_dimensions?: DocumentSixDimensionsReview;
  three_tier_extractions?: ThreeTierEntity[];
  sub_documents_metadata?: any[];
  suggested_boundaries?: any[];
  provenance_extractions?: FieldExtractionProvenance[];
  legal_sufficiency_disclaimer?: string;
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

export interface RouteFindingPayload {
  owner_user_id: string;
  note: string;
  due_date?: string;
  client_facing_template?: string;
}

export interface AuditEvent {
  id: string;
  action: string;
  object_type: string;
  object_id: string;
  actor_email?: string;
  actor_id?: string;
  occurred_at?: string;
  created_at: string;
  metadata?: Record<string, any>;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  status: "unread" | "read";
  created_at: string;
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

export interface ChecklistAuditItem {
  id: string;
  title: string;
  statutory_citation: string;
  description: string;
  is_mandatory: boolean;
  status: "satisfied" | "missing" | "inconclusive";
  matched_documents: { document_id: string; title: string; verification_status: string }[];
}

export interface ChecklistAuditReport {
  jurisdiction: string;
  visa_category: string;
  statutory_framework: string;
  items: ChecklistAuditItem[];
  fulfillment_percentage: number;
  total_mandatory: number;
  satisfied_mandatory: number;
  missing_items: string[];
}

export interface EvidenceBackedSummary {
  case_number: string;
  jurisdiction: string;
  visa_category: string;
  applicant_name: string;
  generated_at: string;
  verified_facts: { category: string; key: string; value: string; source_document: string; source_page: number }[];
  potential_discrepancies: { title: string; severity: string; details: string; recommendation: string }[];
  missing_statutory_evidence: string[];
  suggested_clarification_questions: { target: string; question: string; rationale: string }[];
  uncertainty_disclosures: string[];
  summary_markdown: string;
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

export interface MessageItem {
  id: string;
  sender: string;
  sender_name?: string;
  sender_role: "attorney" | "caseworker" | "client";
  content: string;
  timestamp: string;
  created_at?: string;
  is_unread?: boolean;
}

export interface InvoiceItem {
  id: string;
  invoice_number: string;
  case_number: string;
  client_name: string;
  amount: number;
  status: "paid" | "outstanding" | "in_trust";
  due_date: string;
}

export interface TeamMemberCapacity {
  id: string;
  name: string;
  role: string;
  active_cases: number;
  max_capacity: number;
  open_reviews: number;
}

// ==========================================
// Phase 6: Immigration Rules & Requirements
// ==========================================

export type RequirementEvaluationStatus =
  | "complete"
  | "missing"
  | "needs_review"
  | "unknown"
  | "not_applicable"
  | "expired"
  | "blocked";

export type RuleVersionStatus =
  | "draft"
  | "under_review"
  | "validated"
  | "published"
  | "superseded"
  | "suspended";

export interface OfficialSource {
  id: string;
  organization_id: string;
  jurisdiction: string;
  authority: string;
  title: string;
  url: string;
  scope_limitations: string;
  last_retrieved_at?: string;
  created_at: string;
  updated_at: string;
  snapshots_count: number;
}

export interface SourceSnapshot {
  id: string;
  source_id: string;
  retrieval_timestamp: string;
  publication_date?: string;
  effective_date?: string;
  content_hash: string;
  raw_content: string;
  snapshot_metadata: Record<string, any>;
  created_by_user_id?: string;
}

export interface SnapshotCompareResult {
  from_snapshot_id: string;
  to_snapshot_id: string;
  from_retrieval_timestamp: string;
  to_retrieval_timestamp: string;
  diff_lines: string[];
  has_changes: boolean;
  summary: string;
}

export interface RuleSet {
  id: string;
  organization_id: string;
  jurisdiction: string;
  authority: string;
  program_pathway: string;
  code: string;
  name: string;
  description: string;
  current_version_id?: string;
  created_at: string;
  updated_at: string;
}

export interface RuleSetVersion {
  id: string;
  rule_set_id: string;
  version_number: string;
  status: RuleVersionStatus;
  official_source_id?: string;
  source_snapshot_id?: string;
  publication_date?: string;
  effective_date?: string;
  superseded_at?: string;
  change_summary?: string;
  author_user_id?: string;
  approved_by_user_id?: string;
  published_at?: string;
  approval_history: {
    stage?: string;
    from_status?: string;
    to_status?: string;
    action: string;
    actor_id: string;
    timestamp: string;
    comments?: string;
  }[];
  created_at: string;
  requirements_count: number;
}

export interface RuleRequirement {
  id: string;
  rule_set_version_id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  statutory_citation?: string;
  is_mandatory: boolean;
  priority: number;
  applicability_conditions: Record<string, any>;
  accepted_evidence_types: Array<string | { category: string; min_count?: number }>;
  validation_rules: Array<{ check: string;[key: string]: any }>;
  requires_human_review: boolean;
  review_guidance?: string;
  blocking_dependencies: string[];
}

export interface RequirementEvaluationItem {
  code: string;
  title: string;
  requirement_id?: string;
  category?: string;
  statutory_citation?: string;
  status: RequirementEvaluationStatus;
  is_applicable: boolean;
  is_mandatory: boolean;
  evidence_matched: string[];
  validation_details: string[];
  blocking_reasons: string[];
  requires_human_signoff: boolean;
  human_signoff_completed: boolean;
}

export interface CaseRequirementEvaluation {
  id: string;
  case_id: string;
  rule_set_version_id: string;
  version_number: string;
  status: RequirementEvaluationStatus;
  overall_fulfillment_percentage: number;
  evaluated_at: string;
  is_superseded: boolean;
  results: {
    summary: {
      total: number;
      applicable: number;
      complete: number;
      missing: number;
      needs_review: number;
      blocked: number;
      expired: number;
      not_applicable: number;
      unknown: number;
    };
    version_number: string;
    rule_set_id: string;
    requirements: RequirementEvaluationItem[];
  };
}

export interface AffectedCasesImpactResult {
  rule_set_id: string;
  rule_set_code: string;
  rule_set_version_id: string;
  version_number: string;
  jurisdiction: string;
  program_pathway: string;
  total_open_cases_inspected: number;
  affected_cases_count: number;
  affected_cases: {
    case_id: string;
    case_number: string;
    current_processing_stage: string;
    previous_evaluation_status: string;
    previous_rule_version: string;
    task_id?: string;
  }[];
  tasks_queued_count: number;
}

// --- Phase 7 Client Portal, Requests, Messaging & Waiting State ---

export type DocumentRequestStatus =
  | "draft"
  | "requested"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "cancelled";

export interface DocumentRequestItem {
  id: string;
  case_id: string;
  requested_by_user_id?: string;
  requested_from_client_id: string;
  dependant_id?: string;
  title: string;
  description: string;
  category: string;
  rationale: string;
  statutory_requirement_code?: string;
  accepted_formats: string[];
  acceptable_alternatives?: string;
  due_date?: string;
  instructions?: string;
  translation_guidance?: string;
  status: DocumentRequestStatus;
  fulfilled_document_id?: string;
  rejection_reason?: string;
  status_history: Array<{
    status: string;
    changed_by: string;
    timestamp: string;
    notes?: string;
    rejection_reason?: string;
    replacement_document_id?: string;
  }>;
  created_at: string;
  updated_at: string;
  comments_count: number;
}

export interface DocumentRequestCommentItem {
  id: string;
  request_id: string;
  user_id: string;
  author_name: string;
  content: string;
  is_internal: boolean;
  created_at: string;
}

export interface MessageThreadItem {
  id: string;
  case_id: string;
  case_number: string;
  subject: string;
  thread_type: "client_inquiry" | "case_update" | "document_request" | "general";
  status: "open" | "resolved" | "archived";
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
  messages_count: number;
  unread_count: number;
  last_message_preview?: string;
}

export interface ThreadMessageItem {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: "client" | "lawyer";
  content: string;
  is_internal: boolean;
  attachment_document_ids: string[];
  delivery_status: "pending" | "sent" | "delivered" | "failed";
  read_at?: string;
  delivered_at?: string;
  created_at: string;
}

export interface ClientQuestionnaireSection {
  id: string;
  title: string;
  description: string;
  fields: Array<{
    id: string;
    label: string;
    type: string;
    required: boolean;
  }>;
}

export interface ClientQuestionnaireItem {
  id: string;
  title: string;
  status: "in_progress" | "submitted" | "under_review" | "reviewed" | "locked";
  completion_percentage: number;
  sections: ClientQuestionnaireSection[];
  responses: Record<string, any>;
  submitted_at?: string;
  reviewed_at?: string;
  reviewer_notes?: string;
}

export interface WaitingStateItem {
  id: string;
  type: "document_request" | "questionnaire" | "consent" | "firm_review" | "drafting";
  title: string;
  description: string;
  due_date?: string;
  priority: "critical" | "high" | "medium" | "low";
  action_url?: string;
}

export interface WaitingStateData {
  waiting_on_client_count: number;
  waiting_on_firm_count: number;
  primary_next_action: WaitingStateItem | null;
  waiting_on_client: WaitingStateItem[];
  waiting_on_firm: WaitingStateItem[];
  profile_completeness_percentage: number;
  onboarding_completed: boolean;
}

export interface ClientProfileData {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  date_of_birth?: string;
  nationality: string;
  passport_verified: boolean;
  dependants: Array<{
    id: string;
    relationship_type: string;
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    nationality: string;
    is_authorized_to_view_case: boolean;
  }>;
  cases: Array<{
    id: string;
    case_number: string;
    title: string;
    jurisdiction: string;
    visa_category: string;
    status: string;
  }>;
  completeness_score: number;
}

// ==========================================
// PHASE 8: FORMS, READINESS & PACKAGE BUILDER
// ==========================================

export type FormFieldType = "text" | "number" | "boolean" | "date" | "select" | "textarea";

export interface FormConditionalRule {
  depends_on_field: string;
  operator: "equals" | "not_equals" | "contains" | "in";
  expected_value: any;
}

export interface FormFieldValidationRules {
  regex?: string;
  min_length?: number;
  max_length?: number;
  min?: number;
  max?: number;
}

export interface FormSchemaField {
  key: string;
  label: string;
  field_type: FormFieldType;
  required: boolean;
  is_sensitive?: boolean;
  default?: any;
  options?: Array<{ value: string; label: string }>;
  conditional?: FormConditionalRule;
  validation_rules?: FormFieldValidationRules;
  source_mapping_hint?: string;
}

export interface FormSchemaSection {
  id: string;
  title: string;
  description?: string;
  fields: FormSchemaField[];
}

export interface FormSchemaDefinition {
  sections: FormSchemaSection[];
}

export interface FormSchemaVersionItem {
  id: string;
  version_number: string;
  is_active: boolean;
  effective_date?: string;
  schema_definition?: FormSchemaDefinition;
  schema_json?: FormSchemaDefinition;
}

export interface FormSchemaItem {
  id: string;
  form_code: string;
  name: string;
  jurisdiction: string;
  pathway: string;
  description?: string;
  active_version?: FormSchemaVersionItem;
  versions: FormSchemaVersionItem[];
}

export type FieldSourceType = "client_profile" | "document_ocr" | "user_provided" | "ai_generated";

export interface FormFieldAnswer {
  value: any;
  source_type: FieldSourceType;
  source_id?: string | null;
  source_label: string;
  is_confirmed: boolean;
  confirmed_by_user_id?: string | null;
  confirmed_at?: string | null;
}

export interface FormRevisionHistoryItem {
  revision: number;
  updated_by: string;
  timestamp: string;
  changes_summary: string;
}

export interface FormSubmissionItem {
  id: string;
  case_id: string;
  form_code: string;
  form_name: string;
  version_number: string;
  status: "draft" | "submitted" | "signed_off" | "archived";
  completion_percentage: number;
  has_unconfirmed_ai_fields: boolean;
  sensitive_fields_reviewed: boolean;
  reviewer_notes?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  revision_number: number;
  revision_history?: FormRevisionHistoryItem[];
  answers: Record<string, FormFieldAnswer>;
  schema_definition?: FormSchemaDefinition;
}

export interface ReadinessCheckItem {
  code: string;
  name: string;
  status: "passed" | "failed" | "warning" | "not_applicable";
  is_blocking: boolean;
  summary: string;
  details?: any;
}

export interface PackageReadinessChecklist {
  case_id: string;
  case_number: string;
  evaluated_at: string;
  is_ready_for_package_assembly: boolean;
  total_checks_evaluated: number;
  passed_checks_count: number;
  blocking_failures_count: number;
  warnings_count: number;
  checks: ReadinessCheckItem[];
  prohibition_disclaimer: string;
}

export interface PackageManifestItem {
  document_id?: string;
  form_submission_id?: string;
  version: number;
  file_name: string;
  folder_code: string;
  folder_path: string;
  document_category: string;
  sha256_hash: string;
  review_status: string;
  related_requirement_code: string;
  is_internal_only: boolean;
  page_count: number;
  file_size: string;
}

export interface Phase7CanonicalDocument {
  document_version_id: string;
  relative_path: string;
  sha256: string;
  review_status: string;
}

export interface Phase7CanonicalExclusion {
  document_version_id: string;
  reason_code: string;
}

export interface Phase7CanonicalManifest {
  case_reference: string;
  generated_at: string;
  generated_by: string;
  package_template_version: string;
  checklist_rule_version: string;
  documents: Phase7CanonicalDocument[];
  exclusions: Phase7CanonicalExclusion[];
  folder_structure?: { folder_code: string; folder_name: string }[];
  retention_policy?: string;
  immutable_disclaimer?: string;
}

export type ManifestReportFormat = "txt" | "docx" | "pdf";

export interface PackageFolderStructureItem {
  folder_code: string;
  folder_name: string;
  description?: string;
}

export interface PackageExclusionItem {
  document_id: string;
  title?: string;
  filename?: string;
  category?: string;
  reason_code: string;
  exclusion_reasons?: string[];
  blockers?: string[];
}

export interface PackageManifest {
  package_generation_time?: string;
  rule_version_used?: string;
  items_count?: number;
  internal_items_count?: number;
  external_items_count?: number;
  merkle_root_hash?: string;
  items: PackageManifestItem[];
  folders?: PackageFolderStructureItem[];
  excluded_items?: PackageExclusionItem[];
  phase7_manifest?: Phase7CanonicalManifest;
  retention_policy?: string;
}

export interface PackageApprovalStage {
  stage: string;
  title: string;
  status: "pending" | "passed" | "blocked" | "approved" | "rejected" | "skipped";
  actor?: string | null;
  timestamp?: string | null;
  notes?: string | null;
}

export interface ManualFilingInstructions {
  jurisdiction: string;
  submission_method: string;
  primary_filing_address: string;
  filing_fee_usd?: number;
  portal_submission_disclaimer: string;
  steps: string[];
}

export interface FilingPackageItem {
  id: string;
  case_id: string;
  name: string;
  version_number: string;
  status: "draft" | "readiness_passed" | "in_review" | "senior_review" | "client_confirmed" | "approved" | "rejected" | "ready_for_manual_filing";
  package_hash: string;
  folder_template_name?: string;
  folder_template_code?: string;
  readiness_snapshot?: any;
  manifest: PackageManifest;
  manifest_json?: PackageManifest;
  approval_chain: PackageApprovalStage[];
  approval_chain_json?: PackageApprovalStage[];
  approved_by?: string | null;
  approved_at?: string | null;
  submission_method?: string;
  submission_instructions?: string;
  manual_filing_instructions?: ManualFilingInstructions;
  created_at: string;
  updated_at?: string | null;
}

// ==========================================
// PHASE 9: OWNER ANALYTICS, COMPANY MANAGEMENT & BILLING
// ==========================================

export interface ServiceCatalogItem {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  jurisdiction: string;
  visa_category?: string | null;
  pricing_model: "fixed" | "hourly" | "milestone";
  base_fee: number;
  currency: string;
  estimated_duration_days: number;
  is_active: boolean;
}

export interface ClientEngagementItem {
  id: string;
  engagement_number: string;
  client_id: string;
  case_id?: string | null;
  service_id?: string | null;
  status: "draft" | "active" | "completed" | "terminated";
  retainer_amount: number;
  agreed_fee: number;
  billing_terms: string;
  responsible_attorney_id?: string | null;
  signed_agreement_date?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface InvoiceLineItemDetail {
  id?: string;
  service_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  line_type: "service_fee" | "filing_fee" | "translation" | "courier" | "discount";
}

export interface PaymentRecordItem {
  id: string;
  transaction_reference: string;
  amount: number;
  currency: string;
  payment_method: string;
  status: "succeeded" | "pending" | "failed" | "refunded" | "partially_refunded";
  refunded_amount?: number;
  card_brand?: string | null;
  card_last4?: string | null;
  payment_date: string;
}

export interface InvoiceDetailItem {
  id: string;
  invoice_number: string;
  client_id: string;
  client_name?: string;
  case_id?: string | null;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  currency: string;
  status: "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "void" | "refunded";
  payment_provider?: string | null;
  notes?: string | null;
  line_items?: InvoiceLineItemDetail[];
  line_items_count?: number;
  payments?: PaymentRecordItem[];
}

export interface AccountsReceivableAging {
  current_not_due: number;
  overdue_1_to_30_days: number;
  overdue_31_to_60_days: number;
  overdue_61_to_90_days: number;
  overdue_greater_90_days: number;
  total_overdue: number;
}

export interface FinancialReportsData {
  period: {
    start_date: string;
    end_date: string;
  };
  summary: {
    total_invoiced: number;
    total_collected: number;
    total_outstanding: number;
    total_refunded: number;
    net_collections: number;
    currency: string;
  };
  accounts_receivable_aging: AccountsReceivableAging;
  collections_by_pathway: Record<string, number>;
  invoice_counts: {
    total: number;
    paid: number;
    issued: number;
    partially_paid: number;
    overdue: number;
  };
}

export interface MetricDefinition<T> {
  value: T;
  calculation_method: string;
  time_window: string;
  drill_down_path: string;
  status: "available" | "source_data_pending" | "not_applicable";
  [key: string]: any;
}

export interface StaffWorkloadItem {
  user_id: string;
  full_name: string;
  email: string;
  roles: string[];
  assigned_cases: number;
  pending_tasks: number;
  nominal_capacity: number;
  utilization_pct: number;
  status: "normal" | "overloaded";
  branch_id?: string | null;
  team_id?: string | null;
}

export interface ExecutiveDashboardData {
  time_window_days: number;
  generated_at: string;
  metrics: {
    active_cases: MetricDefinition<number> & { total_cases: number };
    new_retained_clients: MetricDefinition<number> & { total_clients: number };
    cases_by_country_and_pathway: MetricDefinition<any> & {
      by_country: Record<string, number>;
      by_pathway: Record<string, number>;
    };
    cases_by_workflow_stage: MetricDefinition<any> & {
      stages: Record<string, number>;
    };
    cases_needing_attention: MetricDefinition<number> & {
      items: Array<{ case_id: string; case_number: string; title: string; reasons: string[] }>;
    };
    deadlines: MetricDefinition<any> & {
      overdue_milestones: number;
      overdue_tasks: number;
      upcoming_milestones_14d: number;
      upcoming_tasks_14d: number;
      total_overdue: number;
      total_upcoming: number;
    };
    unassigned_cases: MetricDefinition<number> & {
      sample: Array<{ id: string; case_number: string; title: string }>;
    };
    staff_workload_and_capacity: MetricDefinition<any> & {
      staff_members: StaffWorkloadItem[];
    };
    applications_prepared_reviewed_submitted: MetricDefinition<any> & {
      prepared: number;
      reviewed: number;
      submitted: number;
    };
    outstanding_client_requests: MetricDefinition<number> & {
      avg_days_pending: number;
    };
    processing_failures: MetricDefinition<number> & {
      failed_documents: number;
      failed_notifications: number;
      total_failures: number;
    };
    recent_company_activity: MetricDefinition<any> & {
      items: Array<{
        id: string;
        action: string;
        object_type: string;
        object_id: string;
        occurred_at: string;
        actor_id?: string | null;
        metadata?: Record<string, any>;
      }>;
    };
    financial_snapshot: MetricDefinition<any> & {
      paid_revenue: number;
      outstanding_balance: number;
      currency: string;
    };
  };
}

export interface OperationsAnalyticsData {
  filters_applied: Record<string, any>;
  total_cases_in_window: number;
  completed_cases_count: number;
  turnaround_time: {
    average_days: number | null;
    completed_cases_evaluated: number;
    reopened_cases_adjusted_count: number;
    incomplete_timestamp_cases_count: number;
    calculation_formula: string;
    status: "available" | "source_data_pending";
  };
  overdue_work: {
    total_overdue: number;
    overdue_less_than_7_days: number;
    overdue_7_to_30_days: number;
    overdue_greater_than_30_days: number;
    calculation_formula: string;
    status: string;
  };
  client_response_time: {
    average_hours: number | null;
    average_days: number | null;
    requests_evaluated: number;
    calculation_formula: string;
    status: "available" | "source_data_pending";
  };
}

export interface OrganizationSettingsData {
  firm_name: string;
  billing_currency: string;
  default_jurisdiction: string;
  invoice_prefix: string;
  deadline_warning_days: number;
  require_two_step_case_closure: boolean;
  allow_client_portal_billing: boolean;
}

export interface MessageThread {
  id: string;
  organization_id: string;
  case_id: string;
  case_number: string;
  subject: string;
  thread_type: string;
  channel_category: "client" | "team";
  is_internal: boolean;
  status: string;
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
  messages_count: number;
  unread_count: number;
  last_message_preview?: string;
}

export interface ThreadMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  is_internal: boolean;
  attachment_document_ids: string[];
  delivery_status: string;
  read_at?: string;
  delivered_at?: string;
  created_at: string;
}

export interface OffboardMemberResponse {
  user_id: string;
  organization_id: string;
  membership_status: string;
  user_status: string;
  transferred_cases_count: number;
  transferred_to_user_id?: string;
  sessions_revoked_count: number;
  offboarded_at: string;
}

// ============================================================================
// Phase 4: Intake, Boundary Detection, Family Summary, and Lifecycle Types
// ============================================================================

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

export interface CaseInterimReport {
  id: string;
  case_id: string;
  trigger_action: string;
  report_title: string;
  manifest_snapshot_json: Record<string, any>;
  ocr_summary_json: Record<string, any>;
  anomaly_report_json: Record<string, any>;
  created_at: string;
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

// ==========================================
// Phase 6: Rules & Checklist Engine Types
// ==========================================

export type CoverageStatus = "SUPPORTED" | "PARTIAL" | "UNVERIFIED" | "UNSUPPORTED";

export type PathwayCategory =
  | "visitor"
  | "study"
  | "work"
  | "family"
  | "pr_residence"
  | "citizenship"
  | "humanitarian_protection"
  | "extension_renewal_change";

export interface CountryRegistryItem {
  code: string;
  name: string;
  primary_authority: string;
  official_source_registry_url: string;
  release_owner: string;
  coverage_status: CoverageStatus;
  priority_tier: number;
  statutory_framework: string;
  notes: string;
}

export interface PathwayTaxonomyItem {
  pathway_key: string;
  jurisdiction: string;
  category: PathwayCategory;
  title: string;
  statutory_reference: string;
  coverage_status: CoverageStatus;
  official_source_url: string;
  requires_provincial_or_state_clearance?: boolean;
  description: string;
}

export interface CountryCoverageMatrixItem {
  country: CountryRegistryItem;
  pathways_count: number;
  supported_count: number;
  partial_count: number;
  unverified_count: number;
  pathways: PathwayTaxonomyItem[];
}

export interface CoverageMatrixResponse {
  coverage_summary: {
    total_countries: number;
    supported_countries: number;
    total_pathways: number;
    supported_pathways: number;
  };
  countries: CountryCoverageMatrixItem[];
}

export interface Phase6RuleRequirementItem {
  rule_id: string;
  jurisdiction: string;
  pathway: string;
  requirement_key: string;
  status: "DRAFT_UNVERIFIED" | "VERIFIED" | "STALE" | "DEPRECATED";
  source_url: string;
  effective_from: string | null;
  effective_to: string | null;
  last_verified_at: string | null;
  version: number;
  approved_by: string | null;
  title?: string;
  description?: string;
  category?: string;
  statutory_citation?: string | null;
  is_mandatory?: boolean;
  priority?: number;
  is_applicable?: boolean;
  requires_human_review?: boolean;
  accepted_evidence_types?: any[];
  blocking_dependencies?: string[];
}

export interface GeneratedChecklistResponse {
  status: "SUPPORTED" | "PARTIAL" | "UNVERIFIED" | "UNSUPPORTED";
  jurisdiction: string;
  pathway: string;
  is_supported: boolean;
  can_generate_checklist: boolean;
  coverage_level?: string;
  rule_set_name?: string;
  rule_version_id?: string | null;
  rule_version_number?: string | null;
  effective_as_of?: string;
  total_rules_count: number;
  applicable_count: number;
  stale_rules_excluded_count?: number;
  stale_rules_excluded?: any[];
  checklist: Phase6RuleRequirementItem[];
  all_rules?: Phase6RuleRequirementItem[];
  is_pinned_to_case?: boolean;
  case_id?: string | null;
  message?: string;
  disclaimer?: string;
}

export interface PinnedChecklistSnapshotResponse {
  case_id: string;
  case_number?: string;
  is_pinned: boolean;
  pinned_rule_version_id?: string | null;
  snapshot_pinned_at?: string | null;
  rules_update_available?: boolean;
  latest_available_version_id?: string | null;
  snapshot?: GeneratedChecklistResponse;
  message?: string;
}

export interface CaseMigrationResponse {
  success: boolean;
  case_id: string;
  case_number: string;
  from_version_number: string;
  to_version_number: string;
  migrated_at: string;
  migration_reason: string;
  impact: {
    from_version?: string;
    to_version?: string;
    added_count?: number;
    removed_count?: number;
    modified_count?: number;
    unchanged_count?: number;
    requirements_added?: any[];
    requirements_removed?: any[];
    requirements_modified?: any[];
  };
  pinned_checklist: GeneratedChecklistResponse;
  audit_event_id?: string;
}

// =========================================================================
// PHASE 8: STRUCTURED REJECTION, OFFICER QUEUES & MANAGER DASHBOARD (RANKS 1-8)
// =========================================================================

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

// Client Portal In-Progress Forms & Pending Actions & Appointments
export interface InProgressFormItem {
  id?: string;
  form_id?: string;
  form_code?: string;
  title?: string;
  form_title?: string;
  completion_percentage: number;
  last_saved_at: string;
  applicant_name: string;
  estimated_minutes_remaining: number;
}

export interface ClientPendingActionItem {
  id: string;
  title: string;
  description: string;
  due_date: string;
  priority: "high" | "medium" | "low";
  action_type: "document_upload" | "form_completion" | "esign" | "biographical_confirmation";
  target_applicant?: string;
}

export interface ClientAppointmentItem {
  id: string;
  title: string;
  appointment_type: "biometrics" | "attorney_strategy" | "consular_interview" | "medical_exam";
  date_time: string;
  location: string;
  officer_or_venue: string;
  instructions: string;
  can_reschedule: boolean;
}

// Manager Priority Queue Ranks 1-8
export interface ManagerPriorityRankItem {
  rank: number;
  title: string;
  priority: string;
  count?: number;
  description: string;
  items?: any[];
  staff_allocation?: any[];
  unassigned_cases?: any[];
  unassigned_cases_count?: number;
  paid_count?: number;
  pending_count?: number;
  partially_paid_count?: number;
  paid_amount?: number;
  pending_amount?: number;
  partially_paid_amount?: number;
  first_time_pass_rate_percent?: number;
  metrics?: Record<string, any>;
  coaching_focus_areas?: string[];
}

export interface ManagerPriorityQueueResponse {
  generated_at: string;
  organization_id: string;
  summary: {
    critical_overdue_deadlines_count: number;
    unassigned_cases_count: number;
    blocked_cases_count: number;
    overdue_client_responses_count: number;
    pending_reviews_count: number;
    quality_issues_count: number;
    payment_summary: {
      paid_count: number;
      pending_count: number;
      partially_paid_count: number;
      paid_amount: number;
      pending_amount: number;
      partially_paid_amount: number;
    };
    first_time_pass_rate_percent: number;
  };
  ranks: ManagerPriorityRankItem[];
}

// Phase 10 — AI Assistance, Evidence Traceability, Guardrails & Explanations

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

export type BlockerSeverity = "CRITICAL_BLOCKER" | "HIGH_WARNING" | "MEDIUM_WARNING";
export type BlockerCategory =
  | "ONBOARDING_CLEARANCE"
  | "SUBMISSION_HOLD"
  | "PROGRESSIVE_REVIEW"
  | "CRITICAL_FINDINGS"
  | "INCOMPLETE_FORMS"
  | "CLIENT_REQUESTS"
  | "DOCUMENT_VALIDITY";

export interface BlockerExplanation {
  blocker_code: string;
  status_code: string;
  category: BlockerCategory | string;
  severity: BlockerSeverity | string;
  title: string;
  explanation: string;
  statutory_context?: string | null;
  remediation_action: string;
  action_url?: string | null;
}

export interface PackageBlockerReport {
  case_id: string;
  case_number: string;
  organization_id: string;
  is_blocked: boolean;
  total_blockers_count: number;
  critical_blockers_count: number;
  warning_blockers_count: number;
  blockers: BlockerExplanation[];
  evaluated_at: string;
  guardrail_notice: string;
}

export interface ApprovedRequestTemplate {
  template_code: string;
  title: string;
  category: string;
  default_instructions: string;
  legal_context: string;
  suggested_days_to_due: number;
  required_review_role: string;
}

export interface DraftRequestPayload {
  case_id: string;
  template_code: string;
  finding_id?: string;
  custom_instructions?: string;
  due_date?: string;
}

export interface ApproveDraftRequestPayload {
  reviewed_title?: string;
  reviewed_instructions?: string;
  reviewed_due_date?: string;
  authorization_notes?: string;
}

export interface AuthorityRequestItem {
  deficiency_title?: string;
  citation_source?: string;
  target_field_or_topic?: string;
  document_or_form_reference?: string;
  page_reference?: string | null;
  current_status?: "MISSING" | "INCONSISTENT" | "EXPIRED" | "INSUFFICIENT" | string;
  rebuttal_strategy?: string;
  item_id?: string;
  authority_issue?: string;
  supporting_evidence_found?: any[];
  is_addressed_by_case_record?: boolean;
  unaddressed_deficiency_notes?: string;
}

export interface AuthorityRequestSummary {
  authority_type?: "RFE" | "NOID" | "PFL" | "ADR" | "221(g)" | "GENERAL_INQUIRY" | string;
  issuing_body?: string;
  issuance_date?: string | null;
  response_deadline?: string | null;
  statutory_citations?: string[];
  critical_deficiencies?: AuthorityRequestItem[];
  procedural_warnings?: string[];
  legal_guardrail_notice?: string;
  case_number?: string;
  authority_name?: string;
  request_type?: string;
  generated_at?: string;
  items_analyzed?: AuthorityRequestItem[];
  addressed_count?: number;
  unaddressed_count?: number;
  provenance?: Record<string, any>;
  summary_markdown?: string;
  legal_sufficiency_disclaimer?: string;
}

export interface DocumentSplitSection {
  title: string;
  category: string;
  start_page: number;
  end_page: number;
  confidence?: number;
}

// ---------------------------------------------------------------------------
// Phase 11: Reliability, Privacy, Security & Operations Types
// ---------------------------------------------------------------------------

export interface CompletedApplicationSummary {
  id: string;
  case_id: string;
  case_number: string;
  client_name: string;
  visa_category: string;
  jurisdiction: string;
  start_date: string;
  completion_date: string;
  assigned_officer_name: string;
  assigned_officer_role: string;
  adjudication_outcome: string;
  official_reference_number?: string | null;
  purged_files_count: number;
}

export interface CaseWithdrawalTombstone {
  id: string;
  case_id: string;
  case_number: string;
  client_name: string;
  client_email?: string | null;
  intended_application_type: string;
  jurisdiction: string;
  executed_by_name: string;
  withdrawal_reason: string;
  executed_at: string;
  formal_authority_withdrawal_required: boolean;
  formal_authority_status: string;
}

export interface FirmExportRequest {
  request_id: string;
  status: string;
  export_type: "self_service" | "assisted_concierge" | string;
  contractual_entitlement_verified: boolean;
  archive_url?: string | null;
  archive_sha256?: string | null;
  support_ticket_id?: string | null;
  contact_email?: string | null;
  notes?: string | null;
}

export interface PrivacyLegalReview {
  jurisdiction: string;
  market_name: string;
  review_status: string;
  is_valid: boolean;
  governing_statute?: string;
  counsel_signoff_date?: string | null;
  counsel_name?: string | null;
  firm_name?: string | null;
  key_statutory_requirements?: string[];
  last_audited_at?: string;
  next_review_due?: string;
}

export interface DataFlowRegisterItem {
  id: string;
  category: string;
  provider: string;
  location: string;
  residency_model: string;
  data_classes_handled: string[];
  encryption_in_transit: string;
  encryption_at_rest: string;
  pii_retention_policy: string;
  ai_training_permitted: boolean;
  subprocessor_agreement_active: boolean;
}

export interface DataFlowRegister {
  title: string;
  compliance_statement: string;
  total_components: number;
  external_processors: number;
  zero_training_guarantee: boolean;
  data_flows: DataFlowRegisterItem[];
}

export interface DeadLetterJob {
  job_id: string;
  task_type: string;
  organization_id: string;
  error_message: string;
  retry_count: number;
  failed_at: string;
  reprocessed: boolean;
}

export interface OperationalDashboardData {
  organization_id: string;
  system_status: string;
  workers: Record<string, any>;
  dead_letter_queue: {
    size: number;
    jobs: DeadLetterJob[];
  };
  security: {
    quarantined_files_count: number;
    rate_limiting_active: boolean;
    short_lived_download_tokens_enforced: boolean;
    least_privilege_enforced: boolean;
  };
  lifecycle_metrics: {
    completed_applications_retained: number;
    withdrawn_tombstones_retained: number;
  };
  data_flow_summary: {
    total_entities: number;
    external_processors: number;
    zero_training_guarantee: boolean;
  };
  privacy_reviews: {
    jurisdiction: string;
    market_name: string;
    status: string;
    is_valid: boolean;
  }[];
  workforce: {
    total_active_staff: number;
    overloaded_staff_count: number;
  };
}

export interface RestoreDrillResult {
  drill_id: string;
  status: string;
  organization_id: string;
  initiated_by: string;
  tested_components: {
    component: string;
    target: string;
    status: string;
    latency_ms: number;
  }[];
  deletion_policy_accounting_verified: boolean;
  completed_at: string;
  details: string;
}

