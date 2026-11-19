import type {
  RoleCode,
  UserContext,
  ClientProfile,
  ClientDependant,
  ClientConsent,
  ClientEngagementType,
} from "./client";
import type {
  DocumentCategory,
  DocumentStatus,
  StructuredRejectionReasonCode,
  DocumentItem,
  AIFinding,
  FindingSeverity,
  FindingStatus,
} from "./extractor";
import type {
  InvoiceItem,
  PaymentClearanceStatus,
} from "./billing";
import type {
  DocumentRequestItem,
  MessageThreadItem,
  NotificationItem,
} from "./portal";

export type PreparationStatus =
  | "CONSULTATION_ONLY"
  | "PRELIMINARY_ASSESSMENT"
  | "CLEARANCE_PENDING"
  | "AUTHORIZED_FOR_PREPARATION"
  | "PREPARATION_IN_PROGRESS"
  | "READY_FOR_FINAL_REVIEW"
  | "READY_TO_SUBMIT"
  | "SUBMITTED";

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
  source_document_id?: string | null;
  source_page?: number | null;
  source_location?: any;
  extraction_confidence?: number | null;
  has_conflict?: boolean;
  conflicting_candidates?: any[] | null;
  conflict_reason?: string | null;
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
  status: "draft" | "under_review" | "signed_off" | "confirmed" | "approved" | "submitted" | "archived";
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
  supported_families?: PathwayCategory[];
  release_conditions_status?: Record<string, boolean>;
  eu_schengen_distinction_applies?: boolean;
  independent_jurisdiction_rules?: boolean;
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
  validation_level?: string;
  release_conditions_met?: boolean;
  professional_reviewer?: string | null;
  review_timestamp?: string | null;
  regression_test_suite?: string | null;
  scope_limitations?: string | null;
  independent_validation_confirmed?: boolean;
}

export interface PathwayDossierResponse {
  pathway: PathwayTaxonomyItem;
  country: CountryRegistryItem | null;
  is_safe_to_generate_checklist: boolean;
  safe_stop_required: boolean;
}

export interface CountryCoverageMatrixItem {
  country: CountryRegistryItem;
  pathways_count: number;
  supported_count: number;
  partial_count: number;
  unverified_count: number;
  unsupported_count?: number;
  pathways: PathwayTaxonomyItem[];
}

export interface CoverageMatrixResponse {
  coverage_summary: {
    total_countries: number;
    supported_countries: number;
    partial_countries?: number;
    unverified_countries?: number;
    total_pathways: number;
    supported_pathways: number;
    partial_pathways?: number;
    unverified_pathways?: number;
    priority_tiers?: Record<string, string>;
  };
  families_breakdown?: Record<string, {
    total: number;
    supported: number;
    partial: number;
    unverified: number;
    unsupported: number;
  }>;
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
  partial_coverage_warning?: string | null;
  eu_schengen_notice?: string | null;
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

export interface PilotCohort {
  id: string;
  organization_id: string;
  cohort_name: string;
  firm_tier: 'small_firm' | 'medium_firm' | 'boutique' | string;
  status: 'active' | 'graduated' | 'suspended' | string;
  max_cases_allowed: number;
  allowed_pathways: string[];
  synthetic_data_attestation: boolean;
  unapproved_ai_block_enabled: boolean;
  assigned_lead_email: string;
  start_date: string;
  target_end_date?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface PilotKPIBenchmark {
  id: string;
  period_label: string;
  pathway_key: string;
  baseline_workflow_hours: number;
  documento_workflow_hours: number;
  time_saved_hours: number;
  time_saved_percentage: number;
  correction_rate_percentage: number;
  false_positive_flags_count: number;
  missed_exceptions_count: number;
  package_rework_rate_percentage: number;
  operational_failures_count: number;
  operational_recovery_rate_percentage: number;
  created_at: string;
}

export interface StressTestExecution {
  id: string;
  scenario_key: string;
  scenario_name: string;
  status: 'passed' | 'failed' | 'pending' | string;
  execution_notes: string;
  metrics: Record<string, any>;
  executed_at: string;
  executed_by_name: string;
}

export interface ReleaseGateItem {
  gate_id?: string;
  gate_number: number;
  title?: string;
  name?: string;
  description?: string;
  status: 'PASSED' | 'FAILED' | string;
  evidence: string | Record<string, any>;
  blocking_issues?: string[];
}

export interface ReleaseGateEvaluation {
  id: string;
  evaluation_version: string;
  overall_status: 'PASSED' | 'BLOCKED' | string;
  gates: ReleaseGateItem[];
  evaluated_at: string;
  evaluated_by_name: string;
  signed_off_by_owner: boolean;
  signoff_notes?: string | null;
  signed_off_at?: string | null;
}

export interface OperationalRunbook {
  id: string;
  runbook_type: string;
  title: string;
  content_markdown: string;
  metadata: Record<string, any>;
  last_verified_at: string;
  verified_by_name: string;
}

export interface PilotCohortCreatePayload {
  cohort_name: string;
  firm_tier?: string;
  max_cases_allowed?: number;
  allowed_pathways?: string[];
  synthetic_data_attestation?: boolean;
  unapproved_ai_block_enabled?: boolean;
  assigned_lead_email?: string;
  notes?: string;
}

export interface BackupRestoreDrillResult {
  drill_id: string;
  organization_id: string;
  status: string;
  executed_at?: string;
  snapshot_checksum?: string;
  records_evaluated?: {
    total_documents: number;
    purged_documents: number;
  };
  checks?: {
    checksum_verification: string;
    schema_integrity: string;
    foreign_key_consistency: string;
    object_versioning_sync: string;
    backup_aware_erasure_policy: string;
  };
  recovery_point_objective_minutes?: number;
  recovery_time_objective_minutes?: number;
  initiated_by?: string;
  tested_components?: {
    component: string;
    target: string;
    status: string;
    latency_ms: number;
  }[];
  deletion_policy_accounting_verified?: boolean;
  completed_at?: string;
  details?: string;
}

export interface DeletionAccountingReport {
  organization_id: string;
  purged_records_count: number;
  storage_payloads_expunged: boolean;
  object_storage_lifecycle_policy: {
    s3_delete_marker_expiration_days: number;
    noncurrent_version_expiration_days: number;
    transition_to_glacier_days: number;
  };
  backup_restoration_guarantee: string;
  compliance_status: string;
}

export interface OperationalDashboardTelemetry {
  organization_id: string;
  system_status: string;
  workers: Record<string, any>;
  dead_letter_queue: {
    size: number;
    jobs: any[];
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
  privacy_reviews: Array<{
    jurisdiction: string;
    market_name: string;
    status: string;
    is_valid: boolean;
  }>;
  workforce: {
    total_active_staff: number;
    overloaded_staff_count: number;
  };
}
