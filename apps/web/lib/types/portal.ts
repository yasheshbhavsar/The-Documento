import type { StaffWorkloadItem } from "./client";

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  status: "unread" | "read";
  created_at: string;
}

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

export interface VisaAppointment {
  id: string;
  organization_id: string;
  case_id: string;
  client_id: string;
  case_number?: string | null;
  client_name?: string | null;
  visa_category?: string | null;
  vac_center: string;
  consular_post: string;
  ofc_biometrics_slot?: string | null;
  consular_interview_slot?: string | null;
  dropbox_eligible: boolean;
  tracking_number_blue_dart?: string | null;
  courier_status: "pending_pickup" | "in_transit" | "delivered_to_consulate" | "ready_for_pickup" | "delivered_to_applicant" | string;
  status_221g: boolean;
  status_221g_color?: string | null;
  appointment_status: "scheduled" | "completed" | "cancelled" | "rescheduled" | "no_show" | string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MetricDefinition<T> {
  value: T;
  calculation_method: string;
  time_window: string;
  drill_down_path: string;
  status: "available" | "source_data_pending" | "not_applicable";
  [key: string]: any;
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
