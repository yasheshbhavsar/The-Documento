import type * as ApiModule from "../../lib/api";
import type {
  CaseRequirementEvaluation,
  ChecklistAuditReport,
  ClientAppointmentItem,
  ClientPendingActionItem,
  ClientProfileData,
  ClientQuestionnaireItem,
  DocumentItem,
  DocumentRequestItem,
  MessageThreadItem,
  ThreadMessageItem,
} from "../../lib/types";
import { FALLBACK_VISA_FILE_UPDATES as PORTAL_FALLBACK_VISA_FILE_UPDATES } from "../../components/portal/VisaFileUpdatesView";

export interface ApplicantRequirementItem {
  id: string;
  title: string;
  status: "accepted" | "received" | "rejected" | "required" | "outstanding";
  statutoryBasis: string;
  notes?: string;
  rejectionReasonCode?: string;
  rejectionReasonLabel?: string;
  clientExplanation?: string;
}

export interface ApplicantRequirementGroup {
  id: string;
  name: string;
  role: string;
  avatar: string;
  items: ApplicantRequirementItem[];
}
import {
  DEMO_ORG_ID,
  DEMO_USERS,
  FALLBACK_APPOINTMENTS,
  FALLBACK_CLIENT_PROFILE,
  FALLBACK_COUNTRIES,
  FALLBACK_DOCUMENT_REQUESTS,
  FALLBACK_ENGAGEMENTS,
  FALLBACK_EVALUATION,
  FALLBACK_EXECUTIVE_DASHBOARD,
  FALLBACK_FILING_PACKAGE,
  FALLBACK_FINANCIAL_REPORTS,
  FALLBACK_FIRM_AUDIT_LOG,
  FALLBACK_FIRM_CONFIGURATION,
  FALLBACK_FORM_SCHEMAS,
  FALLBACK_FORM_SUBMISSION,
  FALLBACK_INVOICES,
  FALLBACK_MANAGER_PRIORITY_QUEUE,
  FALLBACK_MESSAGE_THREADS,
  FALLBACK_OFFICIAL_SOURCES,
  FALLBACK_OPERATIONS_ANALYTICS,
  FALLBACK_ORG_SETTINGS,
  FALLBACK_PATHWAYS,
  FALLBACK_PHASE7_MANIFEST,
  FALLBACK_PRIORITY_QUEUE,
  FALLBACK_QUESTIONNAIRE,
  FALLBACK_READINESS_CHECKLIST,
  FALLBACK_REQUIREMENTS,
  FALLBACK_RULE_SETS,
  FALLBACK_RULE_VERSIONS,
  FALLBACK_SERVICES,
  FALLBACK_SNAPSHOTS,
  FALLBACK_SPONSORS,
  FALLBACK_THREAD_MESSAGES,
  FALLBACK_UPLOAD_GUIDANCE,
  FALLBACK_VISA_FILE_UPDATES,
  FALLBACK_WAITING_STATE,
  FALLBACK_WORKLOAD,
  FIXTURE_AI_FINDINGS,
  FIXTURE_AUDIT_EVENTS,
  FIXTURE_CAPACITY,
  FIXTURE_CASES,
  FIXTURE_CLIENTS,
  FIXTURE_DOCUMENTS,
  FIXTURE_INVOICES,
  FIXTURE_MESSAGES,
  FIXTURE_NOTIFICATIONS,
  FIXTURE_TASKS,
} from "./testFixtures";

export const TEST_APPLICANT_CHECKLIST_GROUPS: ApplicantRequirementGroup[] = [
  {
    id: "primary",
    name: "Dr. Elena Rostova (Primary Applicant)",
    role: "Primary Beneficiary (EB-1A)",
    avatar: "ER",
    items: [
      {
        id: "req-pri-1",
        title: "Foreign Passport Identity & Biographic Page",
        status: "accepted",
        statutoryBasis: "8 CFR § 204.5(h) / Identity Verification",
        notes: "Passport biodata verified against MRZ.",
      },
      {
        id: "req-pri-2",
        title: "Peer-Reviewed Scholarly Articles & Citation Dossier",
        status: "received",
        statutoryBasis: "8 CFR § 204.5(h)(3)(vi)",
        notes: "Google Scholar citations index received.",
      },
      {
        id: "req-pri-3",
        title: "Independent Expert Recommendation Letters",
        status: "rejected",
        statutoryBasis: "8 CFR § 204.5(h)(3)(v)",
        rejectionReasonCode: "INCOMPLETE_DOCUMENT",
        rejectionReasonLabel: "Incomplete Document or Missing Pages",
        clientExplanation:
          "Letter 2 from Prof. H. Zhang lacks the referee's complete curriculum vitae and institutional letterhead footer.",
      },
    ],
  },
  {
    id: "spouse",
    name: "Dmitri Rostov (Spouse)",
    role: "Dependent Spouse",
    avatar: "DR",
    items: [
      {
        id: "req-sp-1",
        title: "Spouse Passport Biographic Page",
        status: "accepted",
        statutoryBasis: "Dependent Identity Requirement",
      },
      {
        id: "req-sp-2",
        title: "Certified Marriage Certificate Translation",
        status: "rejected",
        statutoryBasis: "8 CFR § 103.2(b)(3)",
        rejectionReasonCode: "MISSING_PAGES",
        rejectionReasonLabel: "Missing Pages or Declaration",
        clientExplanation:
          "Cyrillic marriage certificate was uploaded without the certified translator's formal declaration and certification stamp.",
      },
    ],
  },
  {
    id: "child",
    name: "Sofia Rostova (Child)",
    role: "Dependent Child",
    avatar: "SR",
    items: [
      {
        id: "req-ch-1",
        title: "Child Passport Biographic Page",
        status: "required",
        statutoryBasis: "Dependent Identity Requirement",
      },
      {
        id: "req-ch-2",
        title: "Official Long-Form Birth Certificate",
        status: "outstanding",
        statutoryBasis: "Parent-Child Relationship Evidence",
      },
    ],
  },
];

export const TEST_PENDING_ACTIONS: ClientPendingActionItem[] = [
  {
    id: "act-marriage-trans",
    title: "Re-upload Certified Translation of Foreign Marriage Record",
    description: "Translator certification page must include signed accuracy declaration.",
    due_date: "2026-11-01",
    priority: "high",
    action_type: "document_upload",
    target_applicant: "Dmitri Rostov (Spouse)",
  },
];

export const TEST_APPOINTMENTS: ClientAppointmentItem[] = [
  {
    id: "apt-bio-1",
    title: "USCIS Biometrics Appointment",
    appointment_type: "biometrics",
    date_time: "2026-11-08T09:30:00Z",
    location: "San Jose Application Support Center",
    officer_or_venue: "USCIS ASC #ASC-CA-88921",
    instructions: "Bring valid passport and Form I-797C ASC notice.",
    can_reschedule: true,
  },
  {
    id: "apt-strat-2",
    title: "Strategy Video Consultation with Lead Attorney",
    appointment_type: "attorney_strategy",
    date_time: "2026-11-12T15:00:00Z",
    location: "Secure Portal Video Room",
    officer_or_venue: "Sarah Jenkins, Esq.",
    instructions: "Review final Kazarian brief exhibits.",
    can_reschedule: true,
  },
];

export const TEST_CLIENT_PROFILE: ClientProfileData = {
  ...FALLBACK_CLIENT_PROFILE,
  id: "client-01",
  first_name: "Elena",
  last_name: "Rostova",
  email: "elena.rostova@stanford.edu",
  phone: "+1 (650) 498-0021",
  date_of_birth: "1988-04-12",
  nationality: "UKR",
  passport_verified: true,
  completeness_score: 85,
  dependants: [
    {
      id: "dep-01",
      relationship_type: "spouse",
      first_name: "Dmitri",
      last_name: "Rostov",
      email: "dmitri.rostov@example.com",
      nationality: "UKR",
      is_authorized_to_view_case: true,
    },
  ],
  cases: [
    {
      id: "case-01",
      case_number: "CASE-US-8841",
      title: "EB-1A Alien of Extraordinary Ability: Dr. Elena Rostova",
      jurisdiction: "United States (USCIS)",
      visa_category: "EB-1A Extraordinary Ability",
      status: "review",
    },
  ],
};

export const TEST_QUESTIONNAIRE: ClientQuestionnaireItem = {
  ...FALLBACK_QUESTIONNAIRE,
  title: "Statutory Criteria & Extraordinary Ability Intake",
};

export const TEST_CASE_EVALUATION: CaseRequirementEvaluation = {
  id: "eval-eb1a-demo",
  case_id: "case-01",
  rule_set_version_id: "ver-eb1a-100",
  version_number: "1.0.0",
  status: "needs_review",
  overall_fulfillment_percentage: 75.0,
  evaluated_at: "2026-10-11T12:30:00Z",
  is_superseded: false,
  results: {
    summary: {
      total: 6,
      applicable: 6,
      complete: 3,
      missing: 1,
      needs_review: 2,
      blocked: 0,
      expired: 0,
      not_applicable: 0,
      unknown: 0,
    },
    version_number: "1.0.0",
    rule_set_id: "ruleset-eb1a-01",
    requirements: [
      {
        code: "EB1A-MAND-ID",
        title: "Valid Unexpired Identity & Passport",
        requirement_id: "req-eb1a-id",
        category: "mandatory_identity",
        statutory_citation: "8 CFR § 204.5(a); INA § 221",
        status: "complete",
        is_applicable: true,
        is_mandatory: true,
        evidence_matched: ["doc-01"],
        validation_details: ["All evidence requirements, declarative validations, and approvals satisfied."],
        blocking_reasons: [],
        requires_human_signoff: true,
        human_signoff_completed: true,
      },
      {
        code: "EB1A-MAND-INTENT",
        title: "Intent to Continue Work in Field of Expertise in the United States",
        requirement_id: "req-eb1a-intent",
        category: "statutory_mandate",
        statutory_citation: "8 CFR § 204.5(h)(5)",
        status: "needs_review",
        is_applicable: true,
        is_mandatory: true,
        evidence_matched: ["doc-04"],
        validation_details: ["Evidence matches all criteria. Awaiting human legal professional sign-off."],
        blocking_reasons: [],
        requires_human_signoff: true,
        human_signoff_completed: false,
      },
      {
        code: "EB1A-EVID-ARTICLES",
        title: "Authorship of Scholarly Articles in Professional Publications",
        requirement_id: "req-eb1a-articles",
        category: "regulatory_criteria",
        statutory_citation: "8 CFR § 204.5(h)(3)(vi)",
        status: "complete",
        is_applicable: true,
        is_mandatory: false,
        evidence_matched: ["doc-02"],
        validation_details: ["Field 'article_title' verified present", "Human verification confirmed"],
        blocking_reasons: [],
        requires_human_signoff: true,
        human_signoff_completed: true,
      },
      {
        code: "EB1A-EVID-JUDGING",
        title: "Participation as a Judge of the Work of Others",
        requirement_id: "req-eb1a-judging",
        category: "regulatory_criteria",
        statutory_citation: "8 CFR § 204.5(h)(3)(iv)",
        status: "complete",
        is_applicable: true,
        is_mandatory: false,
        evidence_matched: ["doc-03"],
        validation_details: ["Verified peer reviewer status for IEEE Transactions"],
        blocking_reasons: [],
        requires_human_signoff: true,
        human_signoff_completed: true,
      },
      {
        code: "EB1A-EVID-CONTRIBUTION",
        title: "Original Contributions of Major Significance in the Field",
        requirement_id: "req-eb1a-contribution",
        category: "regulatory_criteria",
        statutory_citation: "8 CFR § 204.5(h)(3)(v)",
        status: "needs_review",
        is_applicable: true,
        is_mandatory: false,
        evidence_matched: ["doc-05"],
        validation_details: ["2 recommendation letters submitted. Awaiting attorney review of independent standing."],
        blocking_reasons: [],
        requires_human_signoff: true,
        human_signoff_completed: false,
      },
      {
        code: "EB1A-EVID-AWARDS",
        title: "Nationally or Internationally Recognized Prizes or Awards",
        requirement_id: "req-eb1a-awards",
        category: "regulatory_criteria",
        statutory_citation: "8 CFR § 204.5(h)(3)(i)",
        status: "missing",
        is_applicable: true,
        is_mandatory: false,
        evidence_matched: [],
        validation_details: ["Missing required evidence. Expected at least 1 document(s) in category: award_certificate"],
        blocking_reasons: ["evidence_missing"],
        requires_human_signoff: true,
        human_signoff_completed: false,
      },
    ],
  },
};

export const TEST_CASE01_CHECKLIST: ChecklistAuditReport = {
  jurisdiction: "US",
  visa_category: "EB-1A",
  statutory_framework: "8 CFR § 204.5(h)(3)",
  items: [
    {
      id: "eb1a-original-contributions",
      title: "Original Scientific, Scholarly, Artistic, Athletic, or Business-Related Contributions",
      statutory_citation: "8 CFR § 204.5(h)(3)(v)",
      description: "Evidence of original contributions of major significance in the field.",
      is_mandatory: true,
      status: "satisfied",
      matched_documents: [
        {
          document_id: "doc-01",
          title: "US_Passport_Biodata_Elena_Rostova.pdf",
          verification_status: "verified",
        },
      ],
    },
    {
      id: "eb1a-scholarly-articles",
      title: "Authorship of Scholarly Articles in the Field",
      statutory_citation: "8 CFR § 204.5(h)(3)(vi)",
      description: "Published articles in professional or major trade publications or major media.",
      is_mandatory: true,
      status: "satisfied",
      matched_documents: [],
    },
    {
      id: "eb1a-leading-role",
      title: "Leading or Critical Role in Distinguished Organizations",
      statutory_citation: "8 CFR § 204.5(h)(3)(viii)",
      description: "Evidence of performing in a leading or critical role for organizations with a distinguished reputation.",
      is_mandatory: false,
      status: "missing",
      matched_documents: [],
    },
    {
      id: "eb1a-published-material",
      title: "Published Material About Alien in Major Media",
      statutory_citation: "8 CFR § 204.5(h)(3)(iii)",
      description: "Published material about the beneficiary in professional or major trade publications.",
      is_mandatory: false,
      status: "missing",
      matched_documents: [],
    },
  ],
  fulfillment_percentage: 71.4,
  total_mandatory: 2,
  satisfied_mandatory: 2,
  missing_items: [
    "Leading or Critical Role in Distinguished Organizations (8 CFR § 204.5(h)(3)(viii))",
    "Published Material About Alien in Major Media (8 CFR § 204.5(h)(3)(iii))",
  ],
};

function cloneValue<T>(val: T): T {
  return JSON.parse(JSON.stringify(val));
}

export function seedStorageFixtures(): void {
  if (typeof window === "undefined") return;
  const defaults: Array<[string, unknown]> = [
    ["documento_cases_v3_clean", FIXTURE_CASES],
    ["documento_clients_v3_clean", FIXTURE_CLIENTS],
    ["documento_documents_v3_clean", FIXTURE_DOCUMENTS],
    ["documento_audit_events_v3_clean", FIXTURE_AUDIT_EVENTS],
    ["documento_notifications_v3_clean", FIXTURE_NOTIFICATIONS],
    ["documento_tasks_v3_clean", FIXTURE_TASKS],
    ["documento_findings_v3_clean", FIXTURE_AI_FINDINGS],
    ["documento_messages_v3_clean", FIXTURE_MESSAGES],
    ["documento_invoices_v3_clean", FIXTURE_INVOICES],
    ["documento_doc_requests_v3_clean", FALLBACK_DOCUMENT_REQUESTS],
    ["documento_msg_threads_v3_clean", FALLBACK_MESSAGE_THREADS],
    ["documento_thread_msgs_v3_clean", FALLBACK_THREAD_MESSAGES],
    ["documento_appointments_v3_clean", FALLBACK_APPOINTMENTS],
    ["documento_sponsors_v3_clean", FALLBACK_SPONSORS],
    ["documento_engagements_v3_clean", FALLBACK_ENGAGEMENTS],
    ["documento_billing_invoices_v3_clean", FALLBACK_INVOICES],
  ];
  for (const [key, value] of defaults) {
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }
}

export function mockApiModuleWithFixtures(actual: typeof ApiModule) {
  if (PORTAL_FALLBACK_VISA_FILE_UPDATES.length === 0) {
    PORTAL_FALLBACK_VISA_FILE_UPDATES.push(...cloneValue(FALLBACK_VISA_FILE_UPDATES));
  }
  let docRequests: DocumentRequestItem[] = cloneValue(FALLBACK_DOCUMENT_REQUESTS);
  const msgThreads: MessageThreadItem[] = cloneValue(FALLBACK_MESSAGE_THREADS);
  const threadMsgs: ThreadMessageItem[] = cloneValue(FALLBACK_THREAD_MESSAGES);
  const fixtureDocs: DocumentItem[] = cloneValue(FIXTURE_DOCUMENTS);

  const hasStorageKey = (key: string): boolean =>
    typeof window !== "undefined" && Boolean(window.localStorage.getItem(key));

  return {
    ...actual,
    DEMO_ORG_ID,
    DEMO_USERS,
    FIXTURE_CASES,
    FIXTURE_CLIENTS,
    FIXTURE_DOCUMENTS,
    FIXTURE_AUDIT_EVENTS,
    FIXTURE_NOTIFICATIONS,
    FIXTURE_TASKS,
    FIXTURE_AI_FINDINGS,
    FIXTURE_MESSAGES,
    FIXTURE_INVOICES,
    FIXTURE_CAPACITY,
    FALLBACK_OFFICIAL_SOURCES,
    FALLBACK_SNAPSHOTS,
    FALLBACK_RULE_SETS,
    FALLBACK_RULE_VERSIONS,
    FALLBACK_REQUIREMENTS,
    FALLBACK_EVALUATION,
    FALLBACK_DOCUMENT_REQUESTS,
    FALLBACK_MESSAGE_THREADS,
    FALLBACK_THREAD_MESSAGES,
    FALLBACK_WAITING_STATE,
    FALLBACK_CLIENT_PROFILE,
    FALLBACK_QUESTIONNAIRE,
    FALLBACK_FORM_SCHEMAS,
    FALLBACK_FORM_SUBMISSION,
    FALLBACK_READINESS_CHECKLIST,
    FALLBACK_FILING_PACKAGE,
    FALLBACK_PHASE7_MANIFEST,
    FALLBACK_SERVICES,
    FALLBACK_ENGAGEMENTS,
    FALLBACK_INVOICES,
    FALLBACK_APPOINTMENTS,
    FALLBACK_SPONSORS,
    FALLBACK_FINANCIAL_REPORTS,
    FALLBACK_WORKLOAD,
    FALLBACK_EXECUTIVE_DASHBOARD,
    FALLBACK_OPERATIONS_ANALYTICS,
    FALLBACK_ORG_SETTINGS,
    FALLBACK_UPLOAD_GUIDANCE,
    FALLBACK_COUNTRIES,
    FALLBACK_PATHWAYS,
    FALLBACK_MANAGER_PRIORITY_QUEUE,
    FALLBACK_FIRM_CONFIGURATION,
    FALLBACK_FIRM_AUDIT_LOG,
    FALLBACK_PRIORITY_QUEUE,
    FALLBACK_VISA_FILE_UPDATES,

    fetchDocumentRequests: async (caseId?: string, statusFilter?: string) => {
      const res = await actual.fetchDocumentRequests(caseId, statusFilter);
      if (res.length > 0 || hasStorageKey("documento_doc_requests_v3_clean")) {
        return res;
      }
      return docRequests
        .filter((r) => (!caseId || r.case_id === caseId) && (!statusFilter || r.status === statusFilter))
        .map((r) => ({ ...r }));
    },

    reviewDocumentRequest: async (
      requestId: string,
      decision: "approved" | "rejected",
      rejectionReason?: string,
      reviewNotes?: string
    ) => {
      if (hasStorageKey("documento_doc_requests_v3_clean")) {
        return actual.reviewDocumentRequest(requestId, decision, rejectionReason, reviewNotes);
      }
      const idx = docRequests.findIndex((r) => r.id === requestId);
      if (idx !== -1) {
        docRequests[idx] = {
          ...docRequests[idx],
          status: decision,
          rejection_reason: decision === "rejected" ? rejectionReason : undefined,
          status_history: [
            ...docRequests[idx].status_history,
            {
              status: decision,
              changed_by: "Case Manager",
              timestamp: new Date().toISOString(),
              notes: reviewNotes,
              rejection_reason: rejectionReason,
            },
          ],
        };
        return { ...docRequests[idx] };
      }
      return actual.reviewDocumentRequest(requestId, decision, rejectionReason, reviewNotes);
    },

    replaceDocumentRequestEvidence: async (
      requestId: string,
      replacementDocId: string,
      explanation?: string
    ) => {
      if (hasStorageKey("documento_doc_requests_v3_clean")) {
        return actual.replaceDocumentRequestEvidence(requestId, replacementDocId, explanation);
      }
      const idx = docRequests.findIndex((r) => r.id === requestId);
      if (idx !== -1) {
        docRequests[idx] = {
          ...docRequests[idx],
          status: "submitted",
          fulfilled_document_id: replacementDocId,
          rejection_reason: undefined,
          status_history: [
            ...docRequests[idx].status_history,
            {
              status: "submitted",
              changed_by: "Retained Client",
              timestamp: new Date().toISOString(),
              notes: `Replaced evidence document: ${explanation || ""}`,
            },
          ],
        };
        return { ...docRequests[idx] };
      }
      return actual.replaceDocumentRequestEvidence(requestId, replacementDocId, explanation);
    },

    fetchMessageThreads: async (caseId?: string) => {
      const res = await actual.fetchMessageThreads(caseId);
      if (res.length > 0 || hasStorageKey("documento_msg_threads_v3_clean")) {
        return res;
      }
      return msgThreads.filter((t) => !caseId || t.case_id === caseId);
    },

    fetchThreadMessages: async (threadId: string) => {
      const res = await actual.fetchThreadMessages(threadId);
      if (res.length > 0 || hasStorageKey("documento_thread_msgs_v3_clean")) {
        return res;
      }
      return threadMsgs.filter((m) => m.thread_id === threadId);
    },

    postThreadMessage: async (
      threadId: string,
      content: string,
      isInternal: boolean = false,
      attachments: string[] = []
    ) => {
      if (hasStorageKey("documento_thread_msgs_v3_clean")) {
        return actual.postThreadMessage(threadId, content, isInternal, attachments);
      }
      const msg: ThreadMessageItem = {
        id: `msg-${Date.now()}`,
        thread_id: threadId,
        sender_id: "usr-01",
        sender_name: "Sarah Jenkins, Esq.",
        sender_role: "lawyer",
        content,
        is_internal: isInternal,
        attachment_document_ids: attachments,
        delivery_status: "delivered",
        created_at: new Date().toISOString(),
      };
      threadMsgs.push(msg);
      return msg;
    },

    fetchClientWaitingState: async (caseId?: string) => {
      const res = await actual.fetchClientWaitingState(caseId);
      if (
        res.waiting_on_client_count === 0 &&
        res.waiting_on_firm_count === 0 &&
        !res.primary_next_action &&
        !hasStorageKey("documento_doc_requests_v3_clean")
      ) {
        return cloneValue(FALLBACK_WAITING_STATE);
      }
      return res;
    },

    fetchClientProfile: async () => {
      const res = await actual.fetchClientProfile();
      if ((!res.first_name && !res.last_name) || (!res.email && res.dependants.length === 0)) {
        return cloneValue(TEST_CLIENT_PROFILE);
      }
      return res;
    },

    fetchQuestionnaires: async (caseId?: string) => {
      if (!caseId && !hasStorageKey("documento_questionnaires_v3_clean")) {
        return [cloneValue(TEST_QUESTIONNAIRE)];
      }
      const res = await actual.fetchQuestionnaires(caseId);
      if (res.length === 0) {
        return [cloneValue(TEST_QUESTIONNAIRE)];
      }
      return res;
    },

    fetchCaseReadinessChecklist: async (caseId: string) => {
      if (!hasStorageKey("documento_documents_v3_clean") && (caseId === "case-01" || !caseId)) {
        return { ...cloneValue(FALLBACK_READINESS_CHECKLIST), case_id: caseId };
      }
      return actual.fetchCaseReadinessChecklist(caseId);
    },

    fetchManagerPriorityQueue: async (...args: Parameters<typeof actual.fetchManagerPriorityQueue>) => {
      const res = await actual.fetchManagerPriorityQueue(...args);
      const hasAnyItems = res.ranks.some(
        (r: any) => (r.count ?? 0) > 0 || (r.items?.length ?? 0) > 0 || (r.staff_allocation?.length ?? 0) > 0
      );
      if (!hasAnyItems) {
        return cloneValue(FALLBACK_MANAGER_PRIORITY_QUEUE);
      }
      return res;
    },

    fetchStaffWorkload: async () => {
      const res = await actual.fetchStaffWorkload();
      if (res.length === 0) {
        return cloneValue(FALLBACK_WORKLOAD);
      }
      return res;
    },

    fetchOrganizationSettings: async () => {
      const res = await actual.fetchOrganizationSettings();
      if (!res.firm_name) {
        return cloneValue(FALLBACK_ORG_SETTINGS);
      }
      return res;
    },

    fetchAccessReport: async (opts: any = {}) => {
      const res = await actual.fetchAccessReport(opts);
      if (res.length === 0 && !hasStorageKey("documento_audit_events_v3_clean")) {
        return cloneValue(FALLBACK_EXECUTIVE_DASHBOARD.metrics.recent_company_activity.items);
      }
      return res;
    },

    fetchServices: async () => {
      const res = await actual.fetchServices();
      if (res.length === 0) {
        return cloneValue(FALLBACK_SERVICES);
      }
      return res;
    },

    fetchEngagements: async (clientId?: string) => {
      const res = await actual.fetchEngagements(clientId);
      if (res.length > 0 || hasStorageKey("documento_engagements_v3_clean")) {
        return res;
      }
      return cloneValue(FALLBACK_ENGAGEMENTS).filter((e) => !clientId || e.client_id === clientId);
    },

    fetchInvoices: async (filter: Record<string, any> = {}) => {
      const res = await actual.fetchInvoices(filter);
      if (res.length > 0 || hasStorageKey("documento_billing_invoices_v3_clean")) {
        return res;
      }
      return cloneValue(FALLBACK_INVOICES);
    },

    fetchFinancialReports: async (startDate?: string, endDate?: string) => {
      const res = await actual.fetchFinancialReports(startDate, endDate);
      if (res.summary.total_invoiced === 0 && !hasStorageKey("documento_billing_invoices_v3_clean")) {
        return cloneValue(FALLBACK_FINANCIAL_REPORTS);
      }
      return res;
    },

    fetchExecutiveDashboard: async (windowDays = 30) => {
      const res = await actual.fetchExecutiveDashboard(windowDays);
      if (res.metrics.active_cases.value === 0 && !hasStorageKey("documento_cases_v3_clean")) {
        return cloneValue(FALLBACK_EXECUTIVE_DASHBOARD);
      }
      return res;
    },

    fetchOperationsAnalytics: async (filters: Record<string, any> = {}) => {
      const res = await actual.fetchOperationsAnalytics(filters);
      if (res.total_cases_in_window === 0 && !hasStorageKey("documento_cases_v3_clean")) {
        return cloneValue(FALLBACK_OPERATIONS_ANALYTICS);
      }
      return res;
    },

    api: {
      ...actual.api,

      getVisaAppointments: async (filters?: { case_id?: string; status?: string }) => {
        const res = await actual.api.getVisaAppointments(filters);
        const list = Array.isArray(res) ? res : res?.data || [];
        if (list.length > 0 || hasStorageKey("documento_appointments_v3_clean")) {
          return res;
        }
        let fallback = cloneValue(FALLBACK_APPOINTMENTS);
        if (filters?.case_id) {
          fallback = fallback.filter((a) => a.case_id === filters.case_id);
        }
        return { data: fallback, isLiveBackend: false };
      },

      getCaseEvaluations: async (caseId: string, role?: any) => {
        if (!hasStorageKey("documento_case_evaluations_v3_clean") && caseId === "case-01") {
          return { data: [cloneValue(TEST_CASE_EVALUATION)], isLiveBackend: false };
        }
        return actual.api.getCaseEvaluations(caseId, role);
      },

      evaluateCaseRequirements: async (caseId: string, role?: any) => {
        if (!hasStorageKey("documento_case_evaluations_v3_clean") && caseId === "case-01") {
          return { data: cloneValue(TEST_CASE_EVALUATION), isLiveBackend: false };
        }
        return actual.api.evaluateCaseRequirements(caseId, role);
      },

      getCaseChecklist: async (caseId: string) => {
        if (caseId === "case-01" && !hasStorageKey("documento_documents_v3_clean")) {
          return { data: cloneValue(TEST_CASE01_CHECKLIST), isLiveBackend: false };
        }
        return actual.api.getCaseChecklist(caseId);
      },

      verifyDocument: async (...args: Parameters<typeof actual.api.verifyDocument>) => {
        try {
          return await actual.api.verifyDocument(...args);
        } catch (err) {
          const [docId, notes] = args;
          const idx = fixtureDocs.findIndex((d) => d.id === docId);
          if (idx !== -1) {
            fixtureDocs[idx] = {
              ...fixtureDocs[idx],
              status: "verified",
              verification_status: "verified",
              verification_notes: notes,
              verified_at: new Date().toISOString(),
            };
            return { data: cloneValue(fixtureDocs[idx]), isLiveBackend: false };
          }
          throw err;
        }
      },

      rejectDocument: async (...args: Parameters<typeof actual.api.rejectDocument>) => {
        try {
          return await actual.api.rejectDocument(...args);
        } catch (err) {
          const [docId, reason, notes] = args;
          const reasonText =
            typeof reason === "string"
              ? reason
              : reason.client_explanation || reason.structured_reason_code;
          const noteText =
            typeof notes === "string"
              ? notes
              : typeof reason === "object" && reason !== null
                ? reason.internal_notes
                : undefined;
          const idx = fixtureDocs.findIndex((d) => d.id === docId);
          if (idx !== -1) {
            fixtureDocs[idx] = {
              ...fixtureDocs[idx],
              status: "action_needed",
              verification_status: "rejected",
              verification_notes: noteText ? `${reasonText}: ${noteText}` : reasonText,
            };
            return { data: cloneValue(fixtureDocs[idx]), isLiveBackend: false };
          }
          throw err;
        }
      },

      correctExtractedField: async (...args: Parameters<typeof actual.api.correctExtractedField>) => {
        try {
          return await actual.api.correctExtractedField(...args);
        } catch (err) {
          const [docId, fieldId, newValue, reason] = args;
          const idx = fixtureDocs.findIndex((d) => d.id === docId);
          if (idx !== -1) {
            const updatedFields = (fixtureDocs[idx].extracted_fields || []).map((f) =>
              f.id === fieldId || f.field_name === fieldId
                ? {
                    ...f,
                    normalized_value: newValue,
                    is_manually_corrected: true,
                    validation_status: "corrected" as const,
                    correction_reason: reason,
                  }
                : f
            );
            fixtureDocs[idx] = {
              ...fixtureDocs[idx],
              extracted_fields: updatedFields,
            };
            return { data: cloneValue(fixtureDocs[idx]), isLiveBackend: false };
          }
          throw err;
        }
      },
    },
  };
}
