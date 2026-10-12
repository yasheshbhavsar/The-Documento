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
  completed_tasks_count?: number;
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
}

export type DocumentProcessingStatus = "pending" | "processing" | "completed" | "failed";
export type DocumentVerificationStatus = "unverified" | "under_review" | "verified" | "rejected";
export type DocumentStatus = "verified" | "under_review" | "action_needed" | "missing";

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
  sender_role: "attorney" | "caseworker" | "client";
  content: string;
  timestamp: string;
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
  validation_rules: Array<{ check: string; [key: string]: any }>;
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

export interface PackageManifest {
  package_generation_time: string;
  rule_version_used: string;
  items_count: number;
  internal_items_count: number;
  external_items_count: number;
  merkle_root_hash: string;
  items: PackageManifestItem[];
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


