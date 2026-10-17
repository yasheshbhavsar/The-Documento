import React, { useState, useEffect } from "react";
import { DataTable, Column } from "../common/DataTable";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import {
  ImmigrationCase,
  ClientProfile,
  DocumentItem,
  CaseTask,
  AIFinding,
  MessageItem,
  ChecklistAuditReport,
  EvidenceBackedSummary,
  FormSubmissionItem,
  PackageReadinessChecklist,
  FilingPackageItem,
  RouteFindingPayload,
} from "../../lib/types";
import {
  api,
  FALLBACK_FORM_SUBMISSION,
  FALLBACK_FORM_SCHEMAS,
  FALLBACK_READINESS_CHECKLIST,
  FALLBACK_FILING_PACKAGE,
  updateFormAnswers,
  confirmFormField,
  reviewSensitiveFields,
  buildFilingPackage,
  advancePackageApproval,
  exportFilingPackage,
} from "../../lib/api";
import { DocumentInspectorModal } from "../modals/DocumentInspectorModal";
import { AIFindingInspectorModal } from "../modals/AIFindingInspectorModal";
import { EvidenceSummaryModal } from "../modals/EvidenceSummaryModal";
import { CaseRequirementEvaluationView } from "../rules/CaseRequirementEvaluationView";
import { RuleAdministrationHub } from "../rules/RuleAdministrationHub";
import { DocumentRequestManager } from "../portal/DocumentRequestManager";
import { SecureMessagingHub } from "../portal/SecureMessagingHub";
import { ConfigurableFormViewer } from "../forms/ConfigurableFormViewer";
import { DeterministicReadinessChecklist } from "../packages/DeterministicReadinessChecklist";
import { PackageBuilderView } from "../packages/PackageBuilderView";
import { PackageApprovalWorkflowModal } from "../packages/PackageApprovalWorkflowModal";
import { CaseDiscrepancyAlertCenter } from "../cases/CaseDiscrepancyAlertCenter";
import { ApprovalGatesCard } from "../cases/ApprovalGatesCard";

interface EmployeeWorkspaceProps {
  cases: ImmigrationCase[];
  clients: ClientProfile[];
  documents: DocumentItem[];
  tasks: CaseTask[];
  aiFindings: AIFinding[];
  messages: MessageItem[];
  onToggleTask: (taskId: string) => void;
  onSendMessage: (content: string) => void;
  onSelectCase: (c: ImmigrationCase) => void;
  onOpenUploadModal: (caseId: string) => void;
  onDocumentUpdated?: (doc: DocumentItem) => void;
  onResolveFinding?: (findingId: string, note: string) => Promise<void>;
  onDismissFinding?: (findingId: string, reason: string, note: string) => Promise<void>;
  onEscalateFinding?: (findingId: string, note: string) => Promise<void>;
  onTriggerAnalysis?: (caseId: string) => Promise<void>;
}

export function EmployeeWorkspace({
  cases,
  clients,
  documents,
  tasks,
  aiFindings,
  messages,
  onToggleTask,
  onSendMessage,
  onSelectCase,
  onOpenUploadModal,
  onDocumentUpdated,
  onResolveFinding,
  onDismissFinding,
  onEscalateFinding,
  onTriggerAnalysis,
}: EmployeeWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<
    | "my_work"
    | "exception_queue"
    | "all_in_one_workspace"
    | "assigned_cases"
    | "team_queues"
    | "clients"
    | "documents"
    | "ai_findings"
    | "tasks"
    | "messages"
    | "form_prep"
    | "package_review"
    | "rules_requirements"
    | "rules_admin"
    | "client_requests"
  >("my_work");

  const [messageInput, setMessageInput] = useState("");
  const [selectedCaseForWorkspace, setSelectedCaseForWorkspace] = useState<ImmigrationCase>(cases[0] || null);
  const [showAssignedOnly, setShowAssignedOnly] = useState<boolean>(true);
  const [exceptionCategoryFilter, setExceptionCategoryFilter] = useState<"all" | "blockers" | "documents" | "client_actions" | "deadlines" | "reviews">("all");
  const [formReviewAccepted, setFormReviewAccepted] = useState(false);
  const [selectedDocForInspection, setSelectedDocForInspection] = useState<DocumentItem | null>(null);
  const [docSearch, setDocSearch] = useState("");
  const [docCategoryFilter, setDocCategoryFilter] = useState("all");
  const [docStatusFilter, setDocStatusFilter] = useState("all");
  const [internalNoteInput, setInternalNoteInput] = useState("");
  const [internalNotes, setInternalNotes] = useState<
    Array<{ id: string; author: string; role: string; content: string; timestamp: string }>
  >([
    {
      id: "note-1",
      author: "Sarah Vance, Esq.",
      role: "Lead Immigration Attorney",
      content:
        "Client has strong citation count (h-index 24) for O-1A / EB-1A. Need to verify that letters from referees are independent and not co-authors.",
      timestamp: "2026-03-24T14:30:00Z",
    },
    {
      id: "note-2",
      author: "Marcus Jenkin",
      role: "Senior Paralegal",
      content:
        "Contacted translation agency for Dmitri's marriage cert. Awaiting signed cert of translation by Friday.",
      timestamp: "2026-03-25T09:15:00Z",
    },
  ]);
  const [allInOneChatMode, setAllInOneChatMode] = useState<"client" | "internal_notes">("client");
  const [allInOneSubView, setAllInOneSubView] = useState<
    "all" | "checklist" | "tasks" | "chat" | "package" | "timeline"
  >("all");

  const visibleCases = showAssignedOnly
    ? cases.filter((c) => {
        const mgr = (c.assigned_manager || "").toLowerCase();
        return (
          mgr.includes("sarah") ||
          mgr.includes("vance") ||
          mgr.includes("jenkin") ||
          mgr.includes("lead") ||
          mgr.includes("esq") ||
          c.id === cases[0]?.id
        );
      })
    : cases;

  // Phase 5 State
  const [localFindingsState, setLocalFindingsState] = useState<AIFinding[]>(aiFindings);
  const [selectedFindingForInspection, setSelectedFindingForInspection] = useState<AIFinding | null>(null);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [checklistReport, setChecklistReport] = useState<ChecklistAuditReport | null>(null);
  const [evidenceSummary, setEvidenceSummary] = useState<EvidenceBackedSummary | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Phase 8 State
  const [formSubmission, setFormSubmission] = useState<FormSubmissionItem>(FALLBACK_FORM_SUBMISSION);
  const [readinessChecklist, setReadinessChecklist] = useState<PackageReadinessChecklist>(FALLBACK_READINESS_CHECKLIST);
  const [filingPackage, setFilingPackage] = useState<FilingPackageItem>(FALLBACK_FILING_PACKAGE);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const handleUpdateFormAnswers = async (answers: Record<string, any>, notes?: string) => {
    const updated = await updateFormAnswers(formSubmission.id, answers, notes);
    setFormSubmission(updated);
  };

  const handleConfirmFormField = async (fieldKey: string) => {
    await confirmFormField(formSubmission.id, fieldKey);
    setFormSubmission((prev) => {
      const updated = { ...prev };
      if (updated.answers[fieldKey]) {
        updated.answers[fieldKey] = {
          ...updated.answers[fieldKey],
          is_confirmed: true,
          confirmed_at: new Date().toISOString(),
        };
      }
      return updated;
    });
  };

  const handleReviewSensitiveFields = async (notes: string) => {
    await reviewSensitiveFields(formSubmission.id, notes);
    setFormSubmission((prev) => ({
      ...prev,
      sensitive_fields_reviewed: true,
      reviewer_notes: notes,
      reviewed_at: new Date().toISOString(),
    }));
  };

  const handleAssemblePackage = async () => {
    const pkg = await buildFilingPackage(
      selectedCaseForWorkspace?.id || "case-01",
      `${selectedCaseForWorkspace?.title || "Immigrant Petition"} Formal Submission Package`
    );
    setFilingPackage(pkg);
    setActiveTab("package_review");
  };

  const handleAdvanceApproval = async (stage: string, decision: string, notes?: string) => {
    const updated = await advancePackageApproval(filingPackage.id, stage, decision, notes);
    setFilingPackage(updated);
  };

  const handleExportPackage = async () => {
    const exported = await exportFilingPackage(filingPackage.id);
    setExportNotice(
      `Package ${exported.version_number} export prepared (Merkle Root Hash: ${exported.package_hash.slice(0, 16)}...). Manual filing instructions generated.`
    );
  };

  useEffect(() => {
    if (!selectedCaseForWorkspace && cases.length > 0) {
      setSelectedCaseForWorkspace(cases[0]);
    }
  }, [cases, selectedCaseForWorkspace]);

  useEffect(() => {
    setLocalFindingsState(aiFindings);
  }, [aiFindings]);

  useEffect(() => {
    let isMounted = true;
    const targetCaseId = selectedCaseForWorkspace?.id || "case-01";
    api.getCaseChecklist(targetCaseId).then((res) => {
      if (isMounted && res?.data) setChecklistReport(res.data);
    });
    api.getCaseEvidenceSummary(targetCaseId).then((res) => {
      if (isMounted && res?.data) setEvidenceSummary(res.data);
    });
    return () => {
      isMounted = false;
    };
  }, [selectedCaseForWorkspace?.id]);

  const handleResolveFindingAction = async (findingId: string, note: string) => {
    if (onResolveFinding) {
      await onResolveFinding(findingId, note);
    } else {
      const caseId = selectedCaseForWorkspace?.id || "case-01";
      await api.resolveFinding(caseId, findingId, note);
    }
    setLocalFindingsState((prev) =>
      prev.map((f) =>
        f.id === findingId
          ? {
              ...f,
              status: "resolved",
              resolution_action: "resolve",
              resolved_at: new Date().toISOString(),
              resolution_history: [
                ...(f.resolution_history || []),
                {
                  timestamp: new Date().toISOString(),
                  action: "resolve",
                  reviewer_email: "attorney@lexai.com",
                  note,
                },
              ],
            }
          : f
      )
    );
  };

  const handleDismissFindingAction = async (findingId: string, reason: string, note: string) => {
    if (onDismissFinding) {
      await onDismissFinding(findingId, reason, note);
    } else {
      const caseId = selectedCaseForWorkspace?.id || "case-01";
      await api.dismissFinding(caseId, findingId, reason, note);
    }
    setLocalFindingsState((prev) =>
      prev.map((f) =>
        f.id === findingId
          ? {
              ...f,
              status: "dismissed",
              resolution_action: "dismiss",
              resolution_reason: reason,
              resolved_at: new Date().toISOString(),
              resolution_history: [
                ...(f.resolution_history || []),
                {
                  timestamp: new Date().toISOString(),
                  action: "dismiss",
                  reason,
                  reviewer_email: "attorney@lexai.com",
                  note,
                },
              ],
            }
          : f
      )
    );
  };

  const handleEscalateFindingAction = async (findingId: string, note: string) => {
    if (onEscalateFinding) {
      await onEscalateFinding(findingId, note);
    } else {
      const caseId = selectedCaseForWorkspace?.id || "case-01";
      await api.escalateFinding(caseId, findingId, note);
    }
    setLocalFindingsState((prev) =>
      prev.map((f) =>
        f.id === findingId
          ? {
              ...f,
              severity: "critical",
              resolution_action: "escalate",
              resolution_history: [
                ...(f.resolution_history || []),
                {
                  timestamp: new Date().toISOString(),
                  action: "escalate",
                  reviewer_email: "attorney@lexai.com",
                  note,
                },
              ],
            }
          : f
      )
    );
  };

  const handleRouteFindingAction = async (findingId: string, payload: RouteFindingPayload) => {
    const caseId = selectedCaseForWorkspace?.id || "case-01";
    await api.routeFinding(caseId, findingId, payload);
    setLocalFindingsState((prev) =>
      prev.map((f) =>
        f.id === findingId
          ? {
              ...f,
              owner_user_id: payload.owner_user_id,
              due_date: payload.due_date,
              client_facing_template: payload.client_facing_template || f.client_facing_template,
              resolution_history: [
                ...(f.resolution_history || []),
                {
                  timestamp: new Date().toISOString(),
                  action: "routed",
                  reviewer_email: "attorney@lexai.com",
                  note: `Routed to ${payload.owner_user_id}: ${payload.note}`,
                },
              ],
            }
          : f
      )
    );
  };

  const handleTriggerAnalysisAction = async () => {
    setIsAnalyzing(true);
    const caseId = selectedCaseForWorkspace?.id || "case-01";
    try {
      if (onTriggerAnalysis) {
        await onTriggerAnalysis(caseId);
      } else {
        const res = await api.triggerCaseAIAnalysis(caseId);
        if (res.data) setLocalFindingsState(res.data);
      }
      const chkRes = await api.getCaseChecklist(caseId);
      setChecklistReport(chkRes.data);
      const sumRes = await api.getCaseEvidenceSummary(caseId);
      setEvidenceSummary(sumRes.data);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    onSendMessage(messageInput);
    setMessageInput("");
  };

  // Case columns
  const caseColumns: Column<ImmigrationCase>[] = [
    { key: "case_number", header: "Case Ref", render: (c) => <strong>{c.case_number}</strong>, sortable: true },
    { key: "title", header: "Petition Title", render: (c) => <span>{c.title}</span>, sortable: true },
    { key: "client_name", header: "Client", sortable: true },
    { key: "visa_category", header: "Pathway", sortable: true },
    {
      key: "status",
      header: "Status",
      render: (c) => (
        <Badge variant={c.status === "ready" || c.status === "filed" ? "success" : "review"}>
          {c.status.toUpperCase()}
        </Badge>
      ),
      sortable: true,
    },
    {
      key: "readiness_score",
      header: "Readiness",
      render: (c) => <span>{c.readiness_score}%</span>,
      sortable: true,
    },
    {
      key: "actions",
      header: "Actions",
      render: (c) => (
        <div style={{ display: "flex", gap: "6px" }}>
          <Button variant="outline" size="sm" onClick={() => onSelectCase(c)}>
            View Details
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSelectedCaseForWorkspace(c);
              setActiveTab("form_prep");
            }}
          >
            Review Forms
          </Button>
        </div>
      ),
    },
  ];

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { key: "my_work", label: "My Work", icon: "💼", count: null },
    { key: "exception_queue", label: "Exception-First Queue", icon: "🚨", count: 7 },
    { key: "all_in_one_workspace", label: "All-in-One Studio", icon: "⚡", count: null },
    { key: "assigned_cases", label: "Assigned Cases", icon: "📁", count: visibleCases.length },
    { key: "team_queues", label: "Team Queues", icon: "⏳", count: null },
    { key: "clients", label: "Client Directory", icon: "👤", count: clients.length },
    { key: "documents", label: "Requirements & Evidence", icon: "📄", count: documents.length },
    { key: "ai_findings", label: "AI Findings", icon: "🤖", count: aiFindings.length },
    { key: "tasks", label: "Tasks", icon: "✓", count: tasks.filter((t) => !t.is_completed).length },
    { key: "messages", label: "Client Messages", icon: "💬", count: messages.length },
    { key: "client_requests", label: "Document Requests", icon: "📥", count: null },
    { key: "form_prep", label: "Form Preparation", icon: "📝", count: null },
    { key: "package_review", label: "Package Review", icon: "📦", count: null },
    { key: "rules_requirements", label: "Case Requirements", icon: "⚖️", count: null },
    { key: "rules_admin", label: "Rule Registry & Pilot", icon: "📜", count: null },
  ] as const;

  const activeTabInfo = {
    my_work: {
      title: "Casework & Evidence Hub",
      subtitle: "Personal Workload, Evidentiary Reviews & Priority Action Items • Vanguard Immigration Law Group LLP",
    },
    exception_queue: {
      title: "Exception-First Casework Queue",
      subtitle: "Prioritized triage sorted by Hard Blockers, Document Anomalies, Client Actions, Filing Deadlines & Pending Reviews",
    },
    all_in_one_workspace: {
      title: "All-in-One Case Studio",
      subtitle: "Unified workspace integrating Checklist, Tasks, Client Chat, Package Preview & Immutable Case Timeline",
    },
    assigned_cases: {
      title: "Assigned Cases",
      subtitle: `Active Caseload Oversight (${visibleCases.length} active petitions assigned for preparation)`,
    },
    team_queues: {
      title: "Team Queues",
      subtitle: "Multi-Caseworker Escalations, Attorney Signoffs & SLA Filing Deadlines",
    },
    clients: {
      title: "Client Directory",
      subtitle: `Retained Petitioners & Beneficiaries (${clients.length} profiles under representation)`,
    },
    documents: {
      title: "Requirements & Evidence",
      subtitle: `Evidentiary Document Verification Matrix (${documents.length} uploaded records)`,
    },
    ai_findings: {
      title: "AI Findings",
      subtitle: `Grounded Evidentiary Gap Analysis (${aiFindings.length} analytical checks requiring disposition)`,
    },
    tasks: {
      title: "Tasks & Deadlines",
      subtitle: `Immediate Action Items & Filing Clocks (${tasks.filter((t) => !t.is_completed).length} open)`,
    },
    messages: {
      title: "Client Messages",
      subtitle: `Direct Secure Attorney-Client Communications (${messages.length} messages in thread)`,
    },
    client_requests: {
      title: "Document Requests",
      subtitle: "Targeted Evidentiary Solicitations & Formal Applicant Requests",
    },
    form_prep: {
      title: "Form Preparation",
      subtitle: "USCIS Form Field Verification, Canonical Data Mapping & Attorney Review",
    },
    package_review: {
      title: "Package Review",
      subtitle: "Deterministic Case Readiness Checklist, Cryptographic Merkle Assembly & Export",
    },
    rules_requirements: {
      title: "Case Requirements",
      subtitle: "Statutory Criteria Evaluation, Cazarian Two-Part Analysis & Evidence Mapping",
    },
    rules_admin: {
      title: "Rule Registry & Pilot",
      subtitle: "Administrative Law Authority Management, Regulatory Snapshots & Rules Engine",
    },
  }[activeTab];

  return (
    <div
      id="employee-workspace"
      style={{
        display: "flex",
        minHeight: "calc(100vh - 58px)",
        background: "#F8F7F2",
        color: "#172322",
      }}
    >
      {/* =========================================================================
          1. RESPONSIVE SIDEBAR NAVIGATION (Desktop: 270px; Mobile: Collapsible)
          ========================================================================= */}
      <aside
        aria-label="Lead Paralegal Navigation Sidebar"
        style={{
          width: "270px",
          background: "#FFFFFF",
          borderRight: "1px solid #DCE5E1",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          position: "sticky",
          top: "58px",
          height: "calc(100vh - 58px)",
          overflowY: "auto",
          boxShadow: "1px 0 3px rgba(6, 60, 61, 0.03)",
        }}
        className="documento-firm-sidebar"
      >
        {/* Active Casework Summary Card */}
        <div
          style={{
            padding: "20px 18px 16px 18px",
            borderBottom: "1px solid #DCE5E1",
          }}
        >
          <div
            style={{
              background: "#F8F7F2",
              border: "1px solid #B9DED4",
              borderRadius: "10px",
              padding: "12px 14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#063C3D",
                  fontFamily: "monospace",
                  letterSpacing: "0.02em",
                }}
              >
                Case #{selectedCaseForWorkspace?.case_number || "CASE-US-8841"}
              </span>
              <span
                style={{
                  background: "#EAF6F0",
                  color: "#176B50",
                  fontSize: "10px",
                  fontWeight: 650,
                  padding: "2px 6px",
                  borderRadius: "4px",
                  border: "1px solid #B9DED4",
                }}
              >
                Active
              </span>
            </div>
            <div style={{ fontSize: "12px", fontWeight: 650, color: "#172322", lineHeight: 1.3 }}>
              {selectedCaseForWorkspace?.visa_category || "EB-1A Extraordinary Ability"}
            </div>
            <div style={{ fontSize: "11px", color: "#6E7F7C", marginTop: "4px" }}>
              Stage: {selectedCaseForWorkspace?.status ? selectedCaseForWorkspace.status.toUpperCase() : "Evidence Gathering"}
            </div>
          </div>
        </div>

        {/* Navigation Items List */}
        <nav
          aria-label="Casework Navigation"
          style={{
            flex: 1,
            padding: "16px 12px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <div
            style={{
              fontSize: "10px",
              fontWeight: 700,
              color: "#6E7F7C",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              padding: "4px 10px 8px 10px",
            }}
          >
            Casework Sections
          </div>

          {navItems.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                aria-current={isActive ? "page" : undefined}
                onClick={() => {
                  setActiveTab(item.key as typeof activeTab);
                  setIsMobileMenuOpen(false);
                }}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "9px 12px 9px 14px",
                  borderRadius: "8px",
                  border: isActive ? "1px solid #B9DED4" : "1px solid transparent",
                  background: isActive ? "#EAF6F0" : "transparent",
                  color: isActive ? "#0D6866" : "#445451",
                  fontSize: "13px",
                  fontWeight: isActive ? 650 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                  overflow: "hidden",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "#F8F7F2";
                    e.currentTarget.style.color = "#063C3D";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#445451";
                  }
                }}
              >
                {isActive && (
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      top: "6px",
                      bottom: "6px",
                      width: "3.5px",
                      borderRadius: "0 2px 2px 0",
                      background: "#0D6866",
                    }}
                    aria-hidden="true"
                  />
                )}
                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </span>
                {item.count !== null && item.count !== undefined && item.count > 0 && (
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: "10px",
                      background: isActive ? "#0D6866" : "#F1F6F4",
                      color: isActive ? "#FFFFFF" : "#445451",
                      border: `1px solid ${isActive ? "#0D6866" : "#DCE5E1"}`,
                    }}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Assigned Paralegal Footer Card */}
        <div
          style={{
            padding: "14px 16px",
            borderTop: "1px solid #DCE5E1",
            background: "#FAFAF7",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "#0D6866",
                color: "#FFFFFF",
                fontSize: "12px",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                border: "1px solid #B9DED4",
              }}
            >
              MV
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "12px", fontWeight: 650, color: "#063C3D", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                Marcus Vance
              </div>
              <div style={{ fontSize: "11px", color: "#6E7F7C", lineHeight: 1.2 }}>
                Lead Paralegal
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenUploadModal(selectedCaseForWorkspace?.id || "case-01")}
            style={{
              width: "100%",
              marginTop: "10px",
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid #B9DED4",
              background: "#FFFFFF",
              color: "#0D6866",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            + Upload Evidentiary File
          </button>
        </div>
      </aside>

      {/* =========================================================================
          2. MAIN CONTENT AREA (Clean SaaS Grid Layout)
          ========================================================================= */}
      <main
        style={{
          flex: 1,
          padding: "24px 32px 64px 32px",
          maxWidth: "1320px",
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {/* Mobile Navigation Drawer Toggle if on narrow screen */}
        <div
          style={{
            display: "none",
            marginBottom: "8px",
            background: "#FFFFFF",
            padding: "10px 16px",
            borderRadius: "10px",
            border: "1px solid #DCE5E1",
            justifyContent: "space-between",
            alignItems: "center",
          }}
          className="documento-firm-mobile-bar"
        >
          <span style={{ fontSize: "13px", fontWeight: 650, color: "#063C3D" }}>
            Section: {navItems.find((n) => n.key === activeTab)?.label}
          </span>
          <button
            type="button"
            aria-expanded={isMobileMenuOpen}
            aria-controls="employee-mobile-sections-menu"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            style={{
              padding: "6px 12px",
              background: "#EAF6F0",
              color: "#0D6866",
              border: "1px solid #B9DED4",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ☰ Switch Section
          </button>
        </div>

        {isMobileMenuOpen && (
          <div
            id="employee-mobile-sections-menu"
            role="menu"
            aria-label="Employee Mobile Navigation"
            style={{
              marginBottom: "16px",
              background: "#FFFFFF",
              border: "1px solid #B9DED4",
              borderRadius: "10px",
              padding: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              boxShadow: "0 4px 12px rgba(6, 60, 61, 0.08)",
            }}
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setActiveTab(item.key as typeof activeTab);
                    setIsMobileMenuOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "6px",
                    border: "none",
                    background: isActive ? "#EAF6F0" : "transparent",
                    color: isActive ? "#0D6866" : "#445451",
                    fontSize: "13px",
                    fontWeight: isActive ? 650 : 500,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </span>
                  {item.count !== null && item.count !== undefined && item.count > 0 && (
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: "10px",
                        background: isActive ? "#0D6866" : "#F1F6F4",
                        color: isActive ? "#FFFFFF" : "#445451",
                      }}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Header Action Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "16px",
            background: "#FFFFFF",
            border: "1px solid #DCE5E1",
            borderRadius: "12px",
            padding: "20px 24px",
            boxShadow: "0 1px 3px rgba(6, 60, 61, 0.04)",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <h1
                style={{
                  fontSize: "22px",
                  fontWeight: 750,
                  color: "#063C3D",
                  margin: 0,
                  letterSpacing: "-0.01em",
                }}
              >
                {activeTabInfo.title}
              </h1>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 650,
                  padding: "3px 8px",
                  borderRadius: "6px",
                  background: "#EAF6F0",
                  color: "#176B50",
                  border: "1px solid #B9DED4",
                }}
              >
                Lead Paralegal Hub
              </span>
            </div>
            <p
              style={{
                fontSize: "13px",
                color: "#6E7F7C",
                margin: "6px 0 0 0",
              }}
            >
              {activeTabInfo.subtitle}
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              role="switch"
              aria-checked={showAssignedOnly}
              onClick={() => setShowAssignedOnly(!showAssignedOnly)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                fontSize: "12px",
                fontWeight: 650,
                color: "#063C3D",
                cursor: "pointer",
                background: showAssignedOnly ? "#EAF6F0" : "#F4F6F5",
                border: `1px solid ${showAssignedOnly ? "#B9DED4" : "#D0D9D5"}`,
                borderRadius: "6px",
                padding: "6px 12px",
                userSelect: "none",
              }}
            >
              <span
                style={{
                  width: "14px",
                  height: "14px",
                  borderRadius: "3px",
                  border: "1px solid #176B50",
                  background: showAssignedOnly ? "#176B50" : "#FFF",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FFF",
                  fontSize: "10px",
                  fontWeight: 900,
                }}
              >
                {showAssignedOnly ? "✓" : ""}
              </span>
              <span>{showAssignedOnly ? "Show: Assigned Cases Only (Default)" : "Show: All Office Cases"}</span>
            </button>
            <Button variant="secondary" size="sm" onClick={() => onOpenUploadModal(selectedCaseForWorkspace?.id || "case-01")}>
              + Upload Document
            </Button>
            <Button variant="primary" size="sm" onClick={handleAssemblePackage}>
              Assemble Package
            </Button>
          </div>
        </div>

      {/* 1. MY WORK DASHBOARD */}
      {activeTab === "my_work" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Quick stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
            <Card>
              <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>Active Cases Assigned</span>
              <strong style={{ fontSize: "28px", display: "block", color: "var(--text)", margin: "4px 0" }}>{cases.length}</strong>
              <small style={{ color: "var(--quiet)" }}>Primary lead attorney / reviewer</small>
            </Card>
            <Card>
              <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>Documents Pending Verification</span>
              <strong style={{ fontSize: "28px", display: "block", color: "var(--accent)", margin: "4px 0" }}>
                {documents.filter((d) => d.status === "under_review").length}
              </strong>
              <small style={{ color: "var(--quiet)" }}>Ready for evidentiary assessment</small>
            </Card>
            <Card>
              <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>Action Items / Tasks</span>
              <strong style={{ fontSize: "28px", display: "block", color: "var(--warning)", margin: "4px 0" }}>
                {tasks.filter((t) => !t.is_completed).length}
              </strong>
              <small style={{ color: "var(--quiet)" }}>Pending caseworker completion</small>
            </Card>
            <Card>
              <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>AI Evidentiary Alerts</span>
              <strong style={{ fontSize: "28px", display: "block", color: "var(--critical)", margin: "4px 0" }}>
                {aiFindings.filter((f) => f.status === "open").length}
              </strong>
              <small style={{ color: "var(--quiet)" }}>Requires human attorney signoff</small>
            </Card>
          </div>

          {/* Quick Tasks & Priority Caseload side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: "20px" }}>
            <Card title="Immediate Tasks & Filing Deadlines" subtitle="Check off completed evidentiary reviews.">
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      background: "var(--surface-subtle, #f8fafc)",
                      border: "1px solid var(--border, #e2e8f0)",
                      borderRadius: "6px",
                      gap: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <input
                        type="checkbox"
                        checked={task.is_completed}
                        onChange={() => onToggleTask(task.id)}
                        aria-label={`Mark ${task.title} complete`}
                        style={{ cursor: "pointer", width: "16px", height: "16px" }}
                      />
                      <div>
                        <strong
                          style={{
                            fontSize: "13px",
                            textDecoration: task.is_completed ? "line-through" : "none",
                            color: task.is_completed ? "var(--quiet)" : "var(--text)",
                          }}
                        >
                          {task.title}
                        </strong>
                        <small style={{ display: "block", color: "var(--muted)" }}>
                          {task.case_number} • Due {task.due_date}
                        </small>
                      </div>
                    </div>
                    <Badge variant={task.priority === "critical" ? "action" : "warning"} size="sm">
                      {task.priority.toUpperCase()}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="AI Findings & Grounded Evidentiary Checks" subtitle="Derived analytical findings (Human attorney disposition required).">
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {aiFindings.map((finding) => (
                  <div
                    key={finding.id}
                    style={{
                      padding: "12px",
                      borderRadius: "6px",
                      border: `1px solid ${finding.severity === "warning" ? "#fde68a" : "#bae6fd"}`,
                      background: finding.severity === "warning" ? "var(--warning-soft)" : "var(--info-soft)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <strong style={{ fontSize: "13px", color: "var(--text)" }}>{finding.title}</strong>
                      <Badge variant={finding.severity === "warning" ? "warning" : "info"} size="sm">
                        {finding.severity.toUpperCase()}
                      </Badge>
                    </div>
                    <p style={{ margin: "4px 0", fontSize: "12px", color: "var(--muted)" }}>{finding.description}</p>
                    <small style={{ color: "var(--quiet)", fontStyle: "italic", display: "block", marginTop: "4px" }}>
                      Authority: {finding.citation}
                    </small>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* 2. EXCEPTION-FIRST QUEUE */}
      {activeTab === "exception_queue" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Category Filter Pills */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
              background: "#FFFFFF",
              padding: "12px 16px",
              borderRadius: "10px",
              border: "1px solid #DCE5E1",
            }}
          >
            {[
              { key: "all", label: "All Exceptions", count: 10, icon: "🚨" },
              { key: "blockers", label: "Hard Blockers", count: 2, icon: "⛔" },
              { key: "documents", label: "Document Issues", count: 2, icon: "📄" },
              { key: "client_actions", label: "Client Actions", count: 2, icon: "👤" },
              { key: "deadlines", label: "Filing Deadlines", count: 2, icon: "⏳" },
              { key: "reviews", label: "Pending Reviews", count: 2, icon: "⚖️" },
            ].map((cat) => {
              const active = exceptionCategoryFilter === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setExceptionCategoryFilter(cat.key as typeof exceptionCategoryFilter)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 12px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: active ? 700 : 550,
                    background: active ? "#063C3D" : "#F4F6F5",
                    color: active ? "#FFFFFF" : "#445451",
                    border: active ? "1px solid #063C3D" : "1px solid #DCE5E1",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                  <span
                    style={{
                      background: active ? "rgba(255,255,255,0.25)" : "#E2E8F0",
                      color: active ? "#FFFFFF" : "#4A5568",
                      borderRadius: "10px",
                      padding: "1px 7px",
                      fontSize: "11px",
                      fontWeight: 700,
                    }}
                  >
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Exception Items List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[
              {
                id: "exc-01",
                category: "blockers",
                title: "Missing Mandatory Regulatory Criteria (O-1A)",
                caseNumber: "US-O1A-2026-091",
                clientName: "Dr. Elena Rostova",
                severity: "critical",
                description:
                  "Only 2 of 3 required regulatory criteria documented. Outstanding original contributions letter missing evidence of widespread field adoption.",
                statutoryCitation: "8 CFR § 204.5(h)(3)",
                dueBadge: "48h until filing cutoff",
                actionLabel: "Resolve Blocker",
                actionType: "blocker",
              },
              {
                id: "exc-02",
                category: "blockers",
                title: "Potential J-1 2-Year Foreign Residence Requirement",
                caseNumber: "EB2-NIW-8821",
                clientName: "Dmitri Rostov",
                severity: "critical",
                description:
                  "Previous DS-2019 indicates subject to Section 212(e). J-1 waiver approval (Form I-612) or Advisory Opinion not yet uploaded.",
                statutoryCitation: "INA § 212(e)",
                dueBadge: "Prerequisite for I-485",
                actionLabel: "Resolve Blocker",
                actionType: "blocker",
              },
              {
                id: "exc-03",
                category: "documents",
                title: "Passport Identity Page Rejected",
                caseNumber: "US-O1A-2026-091",
                clientName: "Dr. Elena Rostova",
                severity: "high",
                description:
                  "Rejected with code [BLURRY_IMAGE]: Machine-readable zone (MRZ) characters 28-44 unreadable due to glare. Replacement requested.",
                statutoryCitation: "8 CFR § 103.2(b)(1)",
                dueBadge: "Client re-upload requested",
                actionLabel: "Inspect Document",
                actionType: "document",
                docId: documents[0]?.id || "doc-01",
              },
              {
                id: "exc-04",
                category: "documents",
                title: "Birth Certificate Missing Certified Translation",
                caseNumber: "EB2-NIW-8821",
                clientName: "Sofia Rostova",
                severity: "high",
                description:
                  "Rejected with code [MISSING_PAGES]: Foreign-language birth certificate uploaded without certified English translator declaration.",
                statutoryCitation: "8 CFR § 103.2(b)(3)",
                dueBadge: "Awaiting certified translation",
                actionLabel: "Inspect Document",
                actionType: "document",
                docId: documents[1]?.id || "doc-02",
              },
              {
                id: "exc-05",
                category: "client_actions",
                title: "Form I-140 Questionnaire Incomplete (Stalled > 72h)",
                caseNumber: "US-O1A-2026-091",
                clientName: "Dr. Elena Rostova",
                severity: "high",
                description:
                  "Client questionnaire progress stalled at 65% for 4 consecutive days. Part 4 (Alien Information) requires completion.",
                statutoryCitation: "Firm Casework SLA (Stall > 72h)",
                dueBadge: "Overdue by 2 days",
                actionLabel: "Send Client Reminder",
                actionType: "reminder",
              },
              {
                id: "exc-06",
                category: "client_actions",
                title: "Dependent Biometrics Declaration Awaiting Confirmation",
                caseNumber: "EB2-NIW-8821",
                clientName: "Dmitri Rostov",
                severity: "medium",
                description:
                  "Physical presence history and travel log pending client digital confirmation before Form I-485 filing.",
                statutoryCitation: "Form I-485 Supplement A",
                dueBadge: "3 days remaining",
                actionLabel: "Send Client Reminder",
                actionType: "reminder",
              },
              {
                id: "exc-07",
                category: "deadlines",
                title: "USCIS Premium Processing 15-Day Milestone",
                caseNumber: "US-O1A-2026-091",
                clientName: "Dr. Elena Rostova",
                severity: "critical",
                description:
                  "Form I-907 Premium Processing clock reaches Day 12. Complete final evidentiary audit and assemble filing package before Day 14 cutoff.",
                statutoryCitation: "8 CFR § 106.4",
                dueBadge: "3 calendar days left",
                actionLabel: "Review Package",
                actionType: "package",
              },
              {
                id: "exc-08",
                category: "deadlines",
                title: "IRCC Provincial Nominee ITA Acceptance Window",
                caseNumber: "CA-PR-4019",
                clientName: "Marcus Vance",
                severity: "critical",
                description:
                  "Express Entry ITA submission window expires in 6 days. Police clearance certificate and proof of funds pending final validation.",
                statutoryCitation: "IRPA § 10.2",
                dueBadge: "6 calendar days left",
                actionLabel: "Send Client Reminder",
                actionType: "reminder",
              },
              {
                id: "exc-09",
                category: "reviews",
                title: "Form I-140 Petition Package Ready for Senior Attorney Sign-Off",
                caseNumber: "US-O1A-2026-091",
                clientName: "Dr. Elena Rostova",
                severity: "high",
                description:
                  "Forms I-140 & G-28 fully populated with 100% confirmed fields. Ready for legal partner review and cryptographic package seal.",
                statutoryCitation: "Firm QC Rule 4.2",
                dueBadge: "Sign-off queue: #1",
                actionLabel: "Review Form",
                actionType: "form",
              },
              {
                id: "exc-10",
                category: "reviews",
                title: "Form ETA-9089 Labor Certification Final Verification",
                caseNumber: "EB2-NIW-8821",
                clientName: "Dmitri Rostov",
                severity: "medium",
                description:
                  "Prevailing wage determination and SOC classification match verified. Caseworker sign-off pending.",
                statutoryCitation: "20 CFR § 656.17",
                dueBadge: "Review queue: #2",
                actionLabel: "Review Form",
                actionType: "form",
              },
            ]
              .filter(
                (item) =>
                  exceptionCategoryFilter === "all" ||
                  item.category === exceptionCategoryFilter
              )
              .map((item) => {
                const isCrit = item.severity === "critical";
                const isHigh = item.severity === "high";
                const borderLeftColor = isCrit
                  ? "#DC2626"
                  : isHigh
                  ? "#F59E0B"
                  : "#0284C7";

                return (
                  <div
                    key={item.id}
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #DCE5E1",
                      borderLeft: `5px solid ${borderLeftColor}`,
                      borderRadius: "10px",
                      padding: "16px 20px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        gap: "10px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <Badge
                          variant={
                            item.category === "blockers"
                              ? "action"
                              : item.category === "documents"
                              ? "warning"
                              : item.category === "deadlines"
                              ? "review"
                              : "neutral"
                          }
                          size="sm"
                        >
                          {item.category.toUpperCase().replace("_", " ")}
                        </Badge>
                        <Badge variant={isCrit ? "action" : isHigh ? "warning" : "info"} size="sm">
                          {item.severity.toUpperCase()}
                        </Badge>
                        <strong style={{ fontSize: "14px", color: "#063C3D" }}>{item.caseNumber}</strong>
                        <span style={{ fontSize: "13px", color: "#64748B" }}>• {item.clientName}</span>
                      </div>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "4px 8px",
                          borderRadius: "4px",
                          background: isCrit ? "#FEE2E2" : "#FEF3C7",
                          color: isCrit ? "#991B1B" : "#92400E",
                        }}
                      >
                        ⚡ {item.dueBadge}
                      </span>
                    </div>

                    <div>
                      <h4 style={{ margin: "0 0 4px 0", fontSize: "15px", color: "#0F172A", fontWeight: 700 }}>
                        {item.title}
                      </h4>
                      <p style={{ margin: "0", fontSize: "13px", color: "#334155", lineHeight: "1.5" }}>
                        {item.description}
                      </p>
                      <small style={{ display: "block", marginTop: "6px", color: "#64748B", fontStyle: "italic" }}>
                        Statutory / QC Citation: {item.statutoryCitation}
                      </small>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        alignItems: "center",
                        marginTop: "4px",
                        flexWrap: "wrap",
                        borderTop: "1px solid #F1F5F9",
                        paddingTop: "10px",
                      }}
                    >
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          if (item.actionType === "document") {
                            const doc = documents.find((d) => d.id === item.docId) || documents[0];
                            if (doc) setSelectedDocForInspection(doc);
                          } else if (item.actionType === "blocker") {
                            setActiveTab("ai_findings");
                          } else if (item.actionType === "form") {
                            setActiveTab("form_prep");
                          } else if (item.actionType === "package") {
                            setActiveTab("package_review");
                          } else {
                            setActiveTab("all_in_one_workspace");
                            setAllInOneChatMode("client");
                          }
                        }}
                      >
                        {item.actionLabel} →
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const targetCase = cases.find((c) => c.case_number === item.caseNumber) || cases[0];
                          if (targetCase) setSelectedCaseForWorkspace(targetCase);
                          setActiveTab("all_in_one_workspace");
                        }}
                      >
                        Open in Case Studio
                      </Button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* 3. ALL-IN-ONE WORKSPACE */}
      {activeTab === "all_in_one_workspace" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Top Bar: Case Selector and Meta Chips */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCE5E1",
              borderRadius: "12px",
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              boxShadow: "0 1px 4px rgba(6, 60, 61, 0.04)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <label style={{ fontSize: "13px", fontWeight: 700, color: "#063C3D" }}>
                  Active Case:
                </label>
                <select
                  value={selectedCaseForWorkspace?.id || cases[0]?.id}
                  onChange={(e) => {
                    const c = cases.find((item) => item.id === e.target.value);
                    if (c) setSelectedCaseForWorkspace(c);
                  }}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "1px solid #B9DED4",
                    background: "#F8FAF9",
                    fontSize: "13px",
                    fontWeight: 650,
                    color: "#063C3D",
                    cursor: "pointer",
                  }}
                >
                  {visibleCases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.case_number} — {c.client_name} ({c.visa_category})
                    </option>
                  ))}
                </select>
                <Badge variant="review">{selectedCaseForWorkspace?.visa_category || "O-1A"}</Badge>
                <Badge variant="success">Readiness: {selectedCaseForWorkspace?.readiness_score || 88}%</Badge>
              </div>

              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <Button variant="secondary" size="sm" onClick={() => setActiveTab("form_prep")}>
                  Review Forms
                </Button>
                <Button variant="primary" size="sm" onClick={handleAssemblePackage}>
                  Assemble Package
                </Button>
              </div>
            </div>

            {/* Sub-view navigation filter */}
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", borderTop: "1px solid #F1F5F9", paddingTop: "12px" }}>
              {[
                { key: "all", label: "Unified Studio (All 5 Panels)" },
                { key: "checklist", label: "Per-Applicant Checklist" },
                { key: "tasks", label: "Casework Tasks" },
                { key: "chat", label: "Chat & Quarantined Notes" },
                { key: "package", label: "Package Preview" },
                { key: "timeline", label: "Case Timeline" },
              ].map((sub) => {
                const active = allInOneSubView === sub.key;
                return (
                  <button
                    key={sub.key}
                    type="button"
                    onClick={() => setAllInOneSubView(sub.key as typeof allInOneSubView)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: active ? 700 : 550,
                      background: active ? "#EAF6F0" : "#F8FAF9",
                      color: active ? "#0D6866" : "#64748B",
                      border: active ? "1px solid #B9DED4" : "1px solid #E2E8F0",
                      cursor: "pointer",
                    }}
                  >
                    {sub.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Phase 9 Approval Gates Card */}
          {selectedCaseForWorkspace && (
            <ApprovalGatesCard
              caseItem={selectedCaseForWorkspace}
              onCaseUpdated={(updated) => {
                setSelectedCaseForWorkspace(updated);
                onSelectCase(updated);
              }}
            />
          )}

          {/* 5 Unified Panels Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 480px), 1fr))", gap: "20px" }}>
            {/* Panel 1: Per-Applicant Evidentiary Checklist */}
            {(allInOneSubView === "all" || allInOneSubView === "checklist") && (
              <Card
                title="Per-Applicant Evidentiary Checklist"
                subtitle="Requirements grouped per applicant with status and structured rejection reasons."
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {[
                    {
                      applicant: "Dr. Elena Rostova (Primary Applicant)",
                      role: "Primary Beneficiary",
                      items: [
                        { name: "Passport Identity Page", status: "accepted", note: "Valid through 2031" },
                        { name: "Ph.D. Academic Evaluation & Degree", status: "accepted", note: "US Equivalency certified" },
                        { name: "Peer-Reviewed Publications & Citations", status: "under_review", note: "h-index 24 documented" },
                        {
                          name: "Reference Letters (3 Letters)",
                          status: "correction_required",
                          reasonCode: "INCOMPLETE_DOCUMENT",
                          explanation: "Letter 2 lacks referee CV and proof of independence.",
                        },
                      ],
                    },
                    {
                      applicant: "Dmitri Rostov (Spouse)",
                      role: "Derivative Beneficiary",
                      items: [
                        { name: "Passport Identity Page", status: "accepted", note: "Valid through 2030" },
                        { name: "Marriage Certificate", status: "accepted", note: "Authenticated apostille verified" },
                        {
                          name: "Foreign Language Certified Translation",
                          status: "rejected",
                          reasonCode: "MISSING_PAGES",
                          explanation: "Translator declaration page omitted from PDF submission.",
                        },
                      ],
                    },
                    {
                      applicant: "Sofia Rostova (Child)",
                      role: "Derivative Child",
                      items: [
                        { name: "Passport Identity Page", status: "accepted", note: "Valid through 2029" },
                        { name: "Birth Certificate", status: "required", note: "Required for I-485 filing" },
                      ],
                    },
                  ].map((group) => (
                    <div
                      key={group.applicant}
                      style={{
                        border: "1px solid #E2E8F0",
                        borderRadius: "8px",
                        padding: "12px",
                        background: "#FAFAFA",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                        <strong style={{ fontSize: "13px", color: "#063C3D" }}>{group.applicant}</strong>
                        <Badge variant="neutral" size="sm">
                          {group.role}
                        </Badge>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {group.items.map((it) => (
                          <div
                            key={it.name}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              background: "#FFFFFF",
                              padding: "8px 10px",
                              borderRadius: "6px",
                              border: "1px solid #EDEDED",
                              fontSize: "12px",
                              flexWrap: "wrap",
                              gap: "8px",
                            }}
                          >
                            <div>
                              <strong style={{ color: "#1E293B" }}>{it.name}</strong>
                              {it.reasonCode && (
                                <span
                                  style={{
                                    display: "block",
                                    fontSize: "11px",
                                    color: "#DC2626",
                                    fontWeight: 650,
                                    marginTop: "2px",
                                  }}
                                >
                                  [{it.reasonCode}] {it.explanation}
                                </span>
                              )}
                              {it.note && !it.reasonCode && (
                                <span style={{ display: "block", fontSize: "11px", color: "#64748B" }}>
                                  {it.note}
                                </span>
                              )}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <Badge
                                variant={
                                  it.status === "accepted"
                                    ? "success"
                                    : it.status === "under_review"
                                    ? "review"
                                    : it.status === "rejected" || it.status === "correction_required"
                                    ? "action"
                                    : "neutral"
                                }
                                size="sm"
                              >
                                {it.status.replace("_", "-").toUpperCase()}
                              </Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const doc = documents[0];
                                  if (doc) setSelectedDocForInspection(doc);
                                }}
                              >
                                Inspect
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Panel 2: Immediate Tasks & Action Items */}
            {(allInOneSubView === "all" || allInOneSubView === "tasks") && (
              <Card
                title="Immediate Tasks & Milestones"
                subtitle="Caseworker action items with priority tags and completion audit."
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 12px",
                        background: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                        borderRadius: "8px",
                        gap: "10px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <input
                          type="checkbox"
                          checked={task.is_completed}
                          onChange={() => onToggleTask(task.id)}
                          aria-label={`Mark task ${task.title} complete`}
                          style={{ cursor: "pointer", width: "16px", height: "16px" }}
                        />
                        <div>
                          <strong
                            style={{
                              fontSize: "13px",
                              textDecoration: task.is_completed ? "line-through" : "none",
                              color: task.is_completed ? "#94A3B8" : "#0F172A",
                            }}
                          >
                            {task.title}
                          </strong>
                          <small style={{ display: "block", color: "#64748B" }}>
                            {task.case_number} • Due {task.due_date}
                          </small>
                        </div>
                      </div>
                      <Badge variant={task.priority === "critical" ? "action" : "warning"} size="sm">
                        {task.priority.toUpperCase()}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Panel 3: Client Chat & Quarantined Internal Notes */}
            {(allInOneSubView === "all" || allInOneSubView === "chat") && (
              <Card
                title="Client Messaging & Quarantined Notes"
                subtitle="Dual-channel communication: client portal messenger vs quarantined internal counsel work product."
              >
                {/* Channel Switcher */}
                <div style={{ display: "flex", gap: "6px", marginBottom: "14px" }}>
                  <button
                    type="button"
                    onClick={() => setAllInOneChatMode("client")}
                    style={{
                      flex: 1,
                      padding: "8px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: allInOneChatMode === "client" ? 700 : 550,
                      background: allInOneChatMode === "client" ? "#063C3D" : "#F1F5F9",
                      color: allInOneChatMode === "client" ? "#FFFFFF" : "#475569",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    💬 Client Portal Chat ({messages.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllInOneChatMode("internal_notes")}
                    style={{
                      flex: 1,
                      padding: "8px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: allInOneChatMode === "internal_notes" ? 700 : 550,
                      background: allInOneChatMode === "internal_notes" ? "#DC2626" : "#FEE2E2",
                      color: allInOneChatMode === "internal_notes" ? "#FFFFFF" : "#991B1B",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    🔒 Internal Notes ({internalNotes.length})
                  </button>
                </div>

                {allInOneChatMode === "client" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div
                      style={{
                        maxHeight: "260px",
                        overflowY: "auto",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        padding: "8px",
                        background: "#F8FAF9",
                        borderRadius: "8px",
                      }}
                    >
                      {messages.map((m) => (
                        <div
                          key={m.id}
                          style={{
                            padding: "8px 12px",
                            borderRadius: "8px",
                            background: m.sender_role === "client" ? "#E2E8F0" : "#EAF6F0",
                            alignSelf: m.sender_role === "client" ? "flex-start" : "flex-end",
                            maxWidth: "85%",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", fontSize: "11px" }}>
                            <strong style={{ color: "#063C3D" }}>{m.sender_name || m.sender}</strong>
                            <span style={{ color: "#64748B" }}>
                              {new Date(m.created_at || m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#1E293B" }}>{m.content}</p>
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleSend} style={{ display: "flex", gap: "8px" }}>
                      <input
                        type="text"
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        placeholder="Reply to client..."
                        style={{
                          flex: 1,
                          padding: "8px 12px",
                          borderRadius: "6px",
                          border: "1px solid #CBD5E1",
                          fontSize: "13px",
                        }}
                      />
                      <Button variant="primary" size="sm" type="submit">
                        Send
                      </Button>
                    </form>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div
                      style={{
                        background: "#FEF2F2",
                        border: "1px solid #FECACA",
                        borderRadius: "6px",
                        padding: "8px 10px",
                        fontSize: "11px",
                        color: "#991B1B",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span>🔒</span>
                      <span>
                        <strong>Quarantined Caseworker Workspace:</strong> These notes are internal work product and never exposed to the client portal.
                      </span>
                    </div>

                    <div
                      style={{
                        maxHeight: "220px",
                        overflowY: "auto",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        padding: "8px",
                        background: "#FFF",
                        borderRadius: "8px",
                        border: "1px solid #E2E8F0",
                      }}
                    >
                      {internalNotes.map((n) => (
                        <div key={n.id} style={{ padding: "8px", background: "#F8FAFC", borderRadius: "6px", border: "1px solid #E2E8F0" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                            <strong style={{ color: "#063C3D" }}>{n.author} ({n.role})</strong>
                            <span style={{ color: "#64748B" }}>
                              {new Date(n.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                          <p style={{ margin: "0", fontSize: "12px", color: "#334155" }}>{n.content}</p>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      <input
                        type="text"
                        value={internalNoteInput}
                        onChange={(e) => setInternalNoteInput(e.target.value)}
                        placeholder="Add confidential internal legal note..."
                        style={{
                          flex: 1,
                          padding: "8px 12px",
                          borderRadius: "6px",
                          border: "1px solid #CBD5E1",
                          fontSize: "13px",
                        }}
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          if (!internalNoteInput.trim()) return;
                          setInternalNotes((prev) => [
                            ...prev,
                            {
                              id: `note-${Date.now()}`,
                              author: "Sarah Vance, Esq.",
                              role: "Lead Counsel",
                              content: internalNoteInput.trim(),
                              timestamp: new Date().toISOString(),
                            },
                          ]);
                          setInternalNoteInput("");
                        }}
                      >
                        Save Note
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Panel 4: Package Preview & Cryptographic Manifest */}
            {(allInOneSubView === "all" || allInOneSubView === "package") && (
              <Card
                title="Filing Package Manifest & Provenance"
                subtitle="Live assembly index with Merkle tree validation."
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div
                    style={{
                      background: "#F0FDF4",
                      border: "1px solid #BBF7D0",
                      borderRadius: "8px",
                      padding: "10px 14px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <span style={{ fontSize: "11px", color: "#166534", fontWeight: 700, display: "block" }}>
                        MERKLE ROOT HASH SEAL
                      </span>
                      <code style={{ fontSize: "12px", color: "#14532D" }}>
                        sha256:7f9b8c2d4e1a0b3c...
                      </code>
                    </div>
                    <Badge variant="success" size="sm">
                      VERIFIED
                    </Badge>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {[
                      { index: "1", doc: "Form G-28 (Notice of Entry of Appearance)", status: "Validated" },
                      { index: "2", doc: "Form I-140 Immigrant Petition for Alien Worker", status: "Validated" },
                      { index: "3", doc: "Exhibit A: Identity, Passports & Curricula Vitae", status: "Validated" },
                      { index: "4", doc: "Exhibit B: Academic Evaluations & Equivalencies", status: "Validated" },
                      { index: "5", doc: "Exhibit C: Major Significance Letters & Citations", status: "Pending Seal" },
                    ].map((ex) => (
                      <div
                        key={ex.index}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "6px 10px",
                          background: "#F8FAFC",
                          borderRadius: "6px",
                          border: "1px solid #E2E8F0",
                          fontSize: "12px",
                        }}
                      >
                        <span>
                          <strong>#{ex.index}</strong> {ex.doc}
                        </span>
                        <span style={{ fontWeight: 600, color: ex.status === "Validated" ? "#166534" : "#D97706" }}>
                          {ex.status}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                    <Button variant="primary" size="sm" onClick={() => setActiveTab("package_review")}>
                      Open Package Studio
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportPackage}>
                      Generate Index PDF
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* Panel 5: Case Timeline & Immutable Audit Trail */}
            {(allInOneSubView === "all" || allInOneSubView === "timeline") && (
              <Card
                title="Immutable Case Timeline"
                subtitle="Cryptographically logged audit history across client and staff actions."
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {[
                    {
                      actor: "Sarah Vance, Esq. (Lead Counsel)",
                      action: "Verified Evidence: Passport Identity Page (Accepted)",
                      time: "Today at 11:20 AM",
                      icon: "✓",
                      color: "#166534",
                    },
                    {
                      actor: "Marcus Jenkin (Senior Paralegal)",
                      action: "Issued Document Rejection [BLURRY_IMAGE] on Foreign Translation",
                      time: "Yesterday at 04:15 PM",
                      icon: "✕",
                      color: "#DC2626",
                    },
                    {
                      actor: "Dr. Elena Rostova (Client)",
                      action: "Updated Form I-140 Questionnaire (Progress: 65%)",
                      time: "2 days ago",
                      icon: "📝",
                      color: "#0284C7",
                    },
                    {
                      actor: "LexAI Provenance Engine",
                      action: "Automated OCR Extraction & Entity Grounding Completed",
                      time: "3 days ago",
                      icon: "🤖",
                      color: "#7C3AED",
                    },
                    {
                      actor: "Firm Tenancy System",
                      action: "Case Retainer Signed & Tenancy Initialized",
                      time: "Last week",
                      icon: "📁",
                      color: "#063C3D",
                    },
                  ].map((evt, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        fontSize: "12px",
                        padding: "6px 0",
                        borderBottom: idx < 4 ? "1px solid #F1F5F9" : "none",
                      }}
                    >
                      <div
                        style={{
                          width: "22px",
                          height: "22px",
                          borderRadius: "50%",
                          background: evt.color,
                          color: "#FFF",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "11px",
                          flexShrink: 0,
                          fontWeight: 700,
                        }}
                      >
                        {evt.icon}
                      </div>
                      <div>
                        <strong style={{ color: "#0F172A", display: "block" }}>{evt.action}</strong>
                        <small style={{ color: "#64748B" }}>
                          {evt.actor} • {evt.time}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* 4. ASSIGNED CASES */}
      {activeTab === "assigned_cases" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Active Case Consistency & Discrepancy Alert Focus */}
          {selectedCaseForWorkspace && (
            <CaseDiscrepancyAlertCenter
              caseId={selectedCaseForWorkspace.id}
              findings={localFindingsState}
              onResolveFinding={handleResolveFindingAction}
              onEscalateFinding={handleEscalateFindingAction}
              onRouteFinding={handleRouteFindingAction}
              onInspectDocument={(docId) => {
                const doc = documents.find((d) => d.id === docId);
                if (doc) setSelectedDocForInspection(doc);
              }}
            />
          )}

          <Card
            title="My Assigned Immigration Petitions"
            subtitle={`Caseworker queue with object-level authorization applied (${visibleCases.length} petitions shown).`}
          >
            <DataTable
              columns={caseColumns}
              data={visibleCases}
              keyExtractor={(c) => c.id}
              searchPlaceholder="Search assigned cases..."
            />
          </Card>
        </div>
      )}

      {/* 3. TEAM QUEUES */}
      {activeTab === "team_queues" && (
        <Card title="Firm-Wide Intake & Processing Queues" subtitle="Cross-team casework routing and review distribution.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" }}>
            {[
              { queue: "Unassigned Intake Queue", count: 2, action: "Assign Caseworker" },
              { queue: "Document Translation & Evaluation Queue", count: 5, action: "Verify Credentials" },
              { queue: "Senior Partner Signoff Queue", count: 3, action: "Final Review" },
              { queue: "Agency RFE Priority Response Queue", count: 1, action: "Immediate Draft" },
            ].map((q) => (
              <div
                key={q.queue}
                style={{
                  border: "1px solid var(--border, #e2e8f0)",
                  borderRadius: "8px",
                  padding: "16px",
                  background: "var(--surface, #ffffff)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <div>
                  <strong style={{ fontSize: "14px", color: "var(--text)", display: "block" }}>{q.queue}</strong>
                  <span style={{ fontSize: "24px", fontWeight: 800, color: "var(--accent)" }}>{q.count} cases</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => setActiveTab("assigned_cases")}>
                  {q.action} →
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 4. CLIENT DIRECTORY */}
      {activeTab === "clients" && (
        <Card title="Retained Applicant Directory" subtitle="All registered clients under organization tenancy.">
          <DataTable
            columns={[
              { key: "name", header: "Applicant Name", render: (c) => <strong>{c.first_name} {c.last_name}</strong> },
              { key: "email", header: "Email Address", render: (c) => <span>{c.email}</span> },
              { key: "nationality", header: "Nationality", render: (c) => <Badge variant="neutral">{c.nationality}</Badge> },
              { key: "phone", header: "Telephone", render: (c) => <span>{c.phone || "Not recorded"}</span> },
              { key: "created_at", header: "Retained Date", render: (c) => <span suppressHydrationWarning>{new Date(c.created_at).toLocaleDateString()}</span> },
            ]}
            data={clients}
            keyExtractor={(c) => c.id}
          />
        </Card>
      )}

      {/* 5. REQUIREMENTS & DOCUMENTS */}
      {activeTab === "documents" && (
        <Card
          title="Evidence & Document Verification Matrix"
          subtitle="Cryptographically verified evidence items stored in private immutable storage with full OCR provenance."
          actions={
            <Button variant="primary" size="sm" onClick={() => onOpenUploadModal("case-01")}>
              + Upload Evidence File
            </Button>
          }
        >
          {/* Document Filters & Search Toolbar */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              marginBottom: "16px",
              flexWrap: "wrap",
              alignItems: "center",
              background: "#F8F7F2",
              padding: "12px 14px",
              borderRadius: "10px",
              border: "1px solid #DCE5E1",
            }}
          >
            <div style={{ position: "relative", flex: "1 1 260px" }}>
              <input
                type="text"
                placeholder="Search evidence by title or category..."
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                style={{
                  width: "100%",
                  paddingLeft: "34px",
                  paddingRight: "12px",
                  paddingTop: "8px",
                  paddingBottom: "8px",
                  borderRadius: "8px",
                  border: "1px solid #DCE5E1",
                  background: "#FFFFFF",
                  color: "#172322",
                  fontSize: "12px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <svg
                width="15"
                height="15"
                style={{
                  position: "absolute",
                  left: "11px",
                  top: "10px",
                  color: "#6E7F7C",
                  pointerEvents: "none",
                }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <select
              value={docCategoryFilter}
              onChange={(e) => setDocCategoryFilter(e.target.value)}
              aria-label="Filter by category"
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #DCE5E1",
                background: "#FFFFFF",
                color: "#172322",
                fontSize: "12px",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="all">All Categories (12)</option>
              <option value="identity_passport">Passports & Identity</option>
              <option value="civil_status">Civil-Status & Family</option>
              <option value="visas_residence_permits">Visas & Permits</option>
              <option value="educational_records">Educational Records</option>
              <option value="employment_records">Employment Records</option>
              <option value="financial_evidence">Financial Evidence</option>
              <option value="travel_records">Travel Records</option>
              <option value="police_medical">Police & Medical</option>
              <option value="government_correspondence">Government Forms</option>
              <option value="translations_certifications">Translations</option>
              <option value="supporting_evidence">Other Supporting</option>
            </select>

            <select
              value={docStatusFilter}
              onChange={(e) => setDocStatusFilter(e.target.value)}
              aria-label="Filter by verification status"
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #DCE5E1",
                background: "#FFFFFF",
                color: "#172322",
                fontSize: "12px",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="all">All Verification Statuses</option>
              <option value="verified">Verified</option>
              <option value="unverified">Unverified</option>
              <option value="under_review">Under Review</option>
              <option value="rejected">Rejected</option>
            </select>

            {(docSearch || docCategoryFilter !== "all" || docStatusFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setDocSearch("");
                  setDocCategoryFilter("all");
                  setDocStatusFilter("all");
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#0D6866",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: "6px 8px",
                  textDecoration: "underline",
                }}
              >
                Reset Filters
              </button>
            )}
          </div>

          <DataTable
            hideSearch={true}
            columns={[
              {
                key: "title",
                header: "Evidence Document",
                render: (d) => (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "8px",
                        background: "#F1F6F4",
                        border: "1px solid #DCE5E1",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#0D6866",
                        fontSize: "15px",
                        flexShrink: 0,
                        marginTop: "1px",
                      }}
                    >
                      📄
                    </div>
                    <div>
                      <strong
                        style={{
                          display: "block",
                          color: "#063C3D",
                          fontSize: "13px",
                          fontWeight: 700,
                          lineHeight: "1.3",
                        }}
                      >
                        {d.title}
                      </strong>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "4px" }}>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: "4px",
                            background: d.is_current_version ? "#EAF6F0" : "#F1F5F9",
                            color: d.is_current_version ? "#0D6866" : "#64748B",
                            border: d.is_current_version ? "1px solid #B9DED4" : "1px solid #CBD5E1",
                          }}
                        >
                          v{d.version || 1} {d.is_current_version ? "(Current)" : "(Superseded)"}
                        </span>
                        <span style={{ fontSize: "11px", color: "#6E7F7C", fontWeight: 500 }}>
                          {d.file_size || "1.5 MB"}
                        </span>
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                key: "category",
                header: "Category",
                render: (d) => {
                  const cat = (d.category || "").toLowerCase();
                  let catBg = "#F1F5F9";
                  let catColor = "#475569";
                  let catBorder = "#E2E8F0";

                  if (cat.includes("identity") || cat.includes("passport")) {
                    catBg = "#E0F2FE";
                    catColor = "#0369A1";
                    catBorder = "#BAE6FD";
                  } else if (cat.includes("education") || cat.includes("diploma") || cat.includes("degree")) {
                    catBg = "#F3E8FF";
                    catColor = "#6B21A8";
                    catBorder = "#E9D5FF";
                  } else if (cat.includes("employment") || cat.includes("work") || cat.includes("experience")) {
                    catBg = "#FEF3C7";
                    catColor = "#92400E";
                    catBorder = "#FDE68A";
                  } else if (cat.includes("financial") || cat.includes("bank") || cat.includes("tax")) {
                    catBg = "#DCFCE7";
                    catColor = "#166534";
                    catBorder = "#BBF7D0";
                  } else if (cat.includes("visa") || cat.includes("permit") || cat.includes("residence")) {
                    catBg = "#EAF6F0";
                    catColor = "#0D6866";
                    catBorder = "#B9DED4";
                  } else if (cat.includes("police") || cat.includes("medical") || cat.includes("clearance")) {
                    catBg = "#FEE2E2";
                    catColor = "#991B1B";
                    catBorder = "#FECACA";
                  }

                  return (
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 650,
                        padding: "3px 10px",
                        borderRadius: "6px",
                        background: catBg,
                        color: catColor,
                        border: `1px solid ${catBorder}`,
                        whiteSpace: "nowrap",
                        textTransform: "capitalize",
                        letterSpacing: "0.01em",
                        display: "inline-block",
                      }}
                    >
                      {(d.category || "General").replace(/_/g, " ")}
                    </span>
                  );
                },
              },
              {
                key: "processing_status",
                header: "Processing",
                render: (d) => {
                  const pStatus = d.processing_status || "completed";
                  return (
                    <Badge variant={pStatus === "completed" ? "success" : pStatus === "failed" ? "action" : "warning"}>
                      {pStatus.toUpperCase()}
                    </Badge>
                  );
                },
              },
              {
                key: "verification_status",
                header: "Legal Verification",
                render: (d) => {
                  const vStatus = d.verification_status || (d.status === "verified" ? "verified" : "unverified");
                  return (
                    <Badge variant={vStatus === "verified" ? "success" : vStatus === "rejected" ? "action" : vStatus === "under_review" ? "warning" : "review"}>
                      {vStatus === "verified" ? "✓ VERIFIED" : vStatus.replace(/_/g, " ").toUpperCase()}
                    </Badge>
                  );
                },
              },
              {
                key: "extracted_fields",
                header: "Extracted Provenance",
                render: (d) => (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 650,
                      color: "#063C3D",
                      background: "#F8F7F2",
                      border: "1px solid #DCE5E1",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      fontFamily: "monospace",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span style={{ color: "#0D6866" }}>⚡</span>
                    <span>{d.extracted_fields?.length || 0} fields</span>
                  </span>
                ),
              },
              {
                key: "sha256_hash",
                header: "SHA-256 Fingerprint",
                render: (d) => (
                  <code
                    style={{
                      fontSize: "11px",
                      color: "#6E7F7C",
                      background: "#F8F7F2",
                      padding: "3px 6px",
                      borderRadius: "4px",
                      border: "1px solid #EAEFEA",
                      fontFamily: "monospace",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {d.sha256_hash ? `${d.sha256_hash.slice(0, 14)}...` : "N/A"}
                  </code>
                ),
              },
              {
                key: "actions",
                header: "Action",
                render: (d) => (
                  <button
                    type="button"
                    onClick={() => setSelectedDocForInspection(d)}
                    style={{
                      background: "#0D6866",
                      color: "#FFFFFF",
                      fontSize: "12px",
                      fontWeight: 650,
                      borderRadius: "8px",
                      padding: "7px 14px",
                      border: "none",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: "0 2px 4px rgba(13, 104, 102, 0.18)",
                      whiteSpace: "nowrap",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#063C3D";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#0D6866";
                    }}
                  >
                    <span>⚡ Review OCR Dossier</span>
                  </button>
                ),
              },
            ]}
            data={documents.filter((d) => {
              if (docSearch) {
                const q = docSearch.toLowerCase();
                if (!d.title.toLowerCase().includes(q) && !(d.category || "").toLowerCase().includes(q)) return false;
              }
              if (docCategoryFilter !== "all" && d.category !== docCategoryFilter) return false;
              if (docStatusFilter !== "all") {
                const vStatus = d.verification_status || (d.status === "verified" ? "verified" : "unverified");
                if (vStatus !== docStatusFilter) return false;
              }
              return true;
            })}
            keyExtractor={(d) => d.id}
          />
        </Card>
      )}

      {/* 6. AI FINDINGS */}
      {activeTab === "ai_findings" && (
        <Card
          title="AI Document Findings & Evidentiary Gap Analysis"
          subtitle="AI document analysis and discrepancy detection with statutory checklist auditing. Non-binding advisory intelligence for authorized practitioners."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* STATUTORY CHECKLIST FULFILLMENT BANNER */}
            {checklistReport && (
              <div
                style={{
                  padding: "16px 20px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)",
                  border: "1px solid #bfdbfe",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#1e40af", letterSpacing: "0.5px" }}>
                      Statutory Framework Audit • {checklistReport.statutory_framework}
                    </span>
                    <h3 style={{ margin: "2px 0 0 0", fontSize: "15px", fontWeight: 700, color: "var(--text, #0f172a)" }}>
                      {checklistReport.jurisdiction} {checklistReport.visa_category} Evidentiary Checklist
                    </h3>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "12px", color: "var(--quiet, #64748b)" }}>Mandatory Met: </span>
                      <strong style={{ fontSize: "13px", color: "#166534" }}>
                        {checklistReport.satisfied_mandatory} / {checklistReport.total_mandatory}
                      </strong>
                    </div>
                    <Badge variant={checklistReport.fulfillment_percentage >= 70 ? "success" : "warning"}>
                      {checklistReport.fulfillment_percentage}% FULFILLED
                    </Badge>
                  </div>
                </div>

                {/* Progress meter */}
                <div style={{ width: "100%", height: "8px", background: "#e2e8f0", borderRadius: "4px", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${checklistReport.fulfillment_percentage}%`,
                      height: "100%",
                      background: checklistReport.fulfillment_percentage >= 70 ? "#16a34a" : "#eab308",
                      borderRadius: "4px",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>

                {/* Missing Criteria Tags */}
                {checklistReport.missing_items && checklistReport.missing_items.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#b91c1c" }}>
                      Missing Evidence:
                    </span>
                    {checklistReport.missing_items.map((item, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: "11px",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          background: "#fef2f2",
                          color: "#991b1b",
                          border: "1px solid #fecaca",
                        }}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ACTION & FILTER BAR */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                padding: "12px 16px",
                background: "var(--surface-subtle, #f8fafc)",
                borderRadius: "8px",
                border: "1px solid var(--border, #e2e8f0)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <Button
                  variant="primary"
                  onClick={handleTriggerAnalysisAction}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? "Analyzing Dossier..." : "⚡ Run Case AI Consistency Analysis"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsSummaryModalOpen(true)}
                >
                  📄 View Evidence-Backed Brief
                </Button>
              </div>

              {/* Filters */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--border, #cbd5e1)",
                    fontSize: "12px",
                    background: "var(--surface, #ffffff)",
                  }}
                >
                  <option value="all">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="major">Major</option>
                  <option value="minor">Minor</option>
                  <option value="informational">Informational</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--border, #cbd5e1)",
                    fontSize: "12px",
                    background: "var(--surface, #ffffff)",
                  }}
                >
                  <option value="all">All Statuses</option>
                  <option value="needs_review">Needs Review</option>
                  <option value="resolved">Resolved</option>
                  <option value="dismissed">Dismissed</option>
                </select>
              </div>
            </div>

            {/* FINDINGS LIST */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {localFindingsState
                .filter((f) => {
                  if (severityFilter !== "all" && f.severity.toLowerCase() !== severityFilter.toLowerCase()) {
                    return false;
                  }
                  if (statusFilter !== "all") {
                    if (statusFilter === "needs_review" && !(f.status === "needs_review" || f.status === "open")) return false;
                    if (statusFilter === "resolved" && !(f.status === "resolved" || f.status === "verified_resolved")) return false;
                    if (statusFilter === "dismissed" && f.status !== "dismissed") return false;
                  }
                  return true;
                })
                .map((finding) => {
                  const isResolvedOrDismissed = finding.status === "resolved" || finding.status === "dismissed";
                  return (
                    <div
                      key={finding.id}
                      style={{
                        padding: "16px 20px",
                        borderRadius: "8px",
                        border: finding.is_confirmed_contradiction
                          ? "1px solid #fca5a5"
                          : "1px solid var(--border, #e2e8f0)",
                        background: finding.is_confirmed_contradiction ? "#fffafb" : "var(--surface, #ffffff)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                      }}
                    >
                      {/* Finding Card Header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--quiet, #64748b)" }}>
                              {finding.id}
                            </span>
                            <Badge
                              variant={
                                finding.severity === "critical"
                                  ? "action"
                                  : finding.severity === "major" || finding.severity === "warning"
                                  ? "warning"
                                  : "neutral"
                              }
                            >
                              {finding.severity.toUpperCase()}
                            </Badge>
                            {finding.is_confirmed_contradiction ? (
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: "#fee2e2",
                                  color: "#b91c1c",
                                }}
                              >
                                ⚠️ CONFIRMED CONTRADICTION
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: "#eff6ff",
                                  color: "#1d4ed8",
                                }}
                              >
                                ℹ️ POTENTIAL DISCREPANCY
                              </span>
                            )}
                            <Badge variant={isResolvedOrDismissed ? "success" : "review"}>
                              {finding.status.replace("_", " ").toUpperCase()}
                            </Badge>
                          </div>
                          <strong style={{ fontSize: "15px", color: "var(--text, #0f172a)" }}>
                            {finding.title}
                          </strong>
                        </div>

                        <Button
                          variant={isResolvedOrDismissed ? "outline" : "primary"}
                          size="sm"
                          onClick={() => setSelectedFindingForInspection(finding)}
                        >
                          {isResolvedOrDismissed ? "View Audit Details" : "Inspect & Resolve ⚖️"}
                        </Button>
                      </div>

                      {/* Description */}
                      <p style={{ margin: 0, fontSize: "13px", color: "var(--muted, #334155)", lineHeight: "1.5" }}>
                        {finding.description}
                      </p>

                      {/* Evidence & Citation snippet */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          background: "var(--surface-subtle, #f8fafc)",
                          padding: "8px 12px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          color: "var(--quiet, #64748b)",
                          flexWrap: "wrap",
                          gap: "8px",
                        }}
                      >
                        <div>
                          <strong>Source:</strong> {finding.source_location?.document_title || finding.related_documents?.[0]?.title || "Case Record"}
                          {(finding.source_location?.page || finding.related_documents?.[0]?.page) && (
                            <span> (Page {finding.source_location?.page || finding.related_documents?.[0]?.page})</span>
                          )}
                          {finding.relevant_requirement && (
                            <span style={{ marginLeft: "12px" }}>
                              <strong>Rule:</strong> {finding.relevant_requirement}
                            </span>
                          )}
                          {finding.citation && (
                            <span style={{ marginLeft: "12px" }}>
                              <strong>Statutory Basis:</strong> {finding.citation}
                            </span>
                          )}
                        </div>

                        {finding.clarification_question && (
                          <span style={{ fontSize: "11px", color: "#2563eb", fontStyle: "italic" }}>
                            Clarification question formulated ✓
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </Card>
      )}

      {/* 7. TASKS & DEADLINES */}
      {activeTab === "tasks" && (
        <Card title="Caseworker Action Items & Deadlines" subtitle="Track tasks across client evidence collection and petition assembly.">
          <DataTable
            columns={[
              {
                key: "is_completed",
                header: "Status",
                render: (t) => (
                  <Button variant={t.is_completed ? "secondary" : "outline"} size="sm" onClick={() => onToggleTask(t.id)}>
                    {t.is_completed ? "✓ Done" : "Mark Done"}
                  </Button>
                ),
              },
              { key: "title", header: "Task Description", render: (t) => <strong>{t.title}</strong> },
              { key: "case_number", header: "Case", render: (t) => <span>{t.case_number}</span> },
              { key: "due_date", header: "Due Date", render: (t) => <span>{t.due_date}</span> },
              { key: "priority", header: "Priority", render: (t) => <Badge variant={t.priority === "critical" ? "action" : "warning"}>{t.priority.toUpperCase()}</Badge> },
              { key: "assigned_to", header: "Assignee", render: (t) => <span>{t.assigned_to}</span> },
            ]}
            data={tasks}
            keyExtractor={(t) => t.id}
          />
        </Card>
      )}

      {/* 8. MESSAGES (STAFF MODE WITH INTERNAL NOTES & DELIVERY INDICATORS) */}
      {activeTab === "messages" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <SecureMessagingHub
            caseId={selectedCaseForWorkspace?.id}
            isStaffMode={true}
          />
        </div>
      )}

      {/* 8B. CLIENT DOCUMENT REQUESTS & EVIDENCE REVIEW */}
      {activeTab === "client_requests" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <DocumentRequestManager
            caseId={selectedCaseForWorkspace?.id}
            isStaffMode={true}
          />
        </div>
      )}

      {/* 9. FORM PREPARATION (PHASE 8 CONFIGURABLE FORMS) */}
      {activeTab === "form_prep" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              background: "#FFFFFF",
              padding: "14px 20px",
              borderRadius: "12px",
              border: "1px solid #DCE5E1",
              boxShadow: "0 2px 8px rgba(6, 60, 61, 0.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "#0D6866",
                  background: "#EAF6F0",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "1px solid #B9DED4",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <span>📁</span> Active Case
              </span>
              <span style={{ fontSize: "12px", color: "#6E7F7C", fontWeight: 500 }}>
                Active Immigration Petition Case:
              </span>
              <strong style={{ fontSize: "13px", color: "#172322", fontWeight: 700 }}>
                {selectedCaseForWorkspace?.case_number} — {selectedCaseForWorkspace?.title}
              </strong>
            </div>
            <select
              value={selectedCaseForWorkspace?.id || ""}
              onChange={(e) => {
                const found = cases.find((c) => c.id === e.target.value);
                if (found) setSelectedCaseForWorkspace(found);
              }}
              style={{
                fontSize: "12px",
                fontWeight: 600,
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1.5px solid #DCE5E1",
                background: "#FAFAF8",
                color: "#172322",
                outline: "none",
                cursor: "pointer",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
              }}
            >
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.case_number}: {c.client_name} ({c.visa_category})
                </option>
              ))}
            </select>
          </div>

          <ConfigurableFormViewer
            submission={formSubmission}
            userRole="case_manager"
            onUpdateAnswers={handleUpdateFormAnswers}
            onConfirmField={handleConfirmFormField}
            onReviewSensitive={handleReviewSensitiveFields}
          />
        </div>
      )}

      {/* 10. PACKAGE REVIEW (PHASE 8 READINESS & PACKAGE BUILDER) */}
      {activeTab === "package_review" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {exportNotice && (
            <div style={{ padding: "12px 16px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", color: "#166534", fontSize: "13px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>✓ {exportNotice}</span>
              <button type="button" onClick={() => setExportNotice(null)} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: "bold" }}>×</button>
            </div>
          )}

          {/* 1. Deterministic Readiness Checklist */}
          <DeterministicReadinessChecklist
            checklist={readinessChecklist}
            onAssemblePackage={handleAssemblePackage}
          />

          {/* 2. Configurable Folder Tree & Manifest */}
          <PackageBuilderView
            packageItem={filingPackage}
            onOpenApprovalWorkflow={() => setIsApprovalModalOpen(true)}
            onExportPackage={handleExportPackage}
          />

          {/* 3. Approval Workflow Modal */}
          <PackageApprovalWorkflowModal
            isOpen={isApprovalModalOpen}
            onClose={() => setIsApprovalModalOpen(false)}
            packageItem={filingPackage}
            userRole="case_manager"
            onAdvanceApproval={handleAdvanceApproval}
          />
        </div>
      )}

      {/* 11. CASE REQUIREMENTS EVALUATION */}
      {activeTab === "rules_requirements" && (
        <CaseRequirementEvaluationView
          caseId={selectedCaseForWorkspace?.id || "case-01"}
          cases={cases}
          isLiveBackend={false}
          onSelectCase={(c) => setSelectedCaseForWorkspace(c)}
        />
      )}

      {/* 12. RULE REGISTRY & PILOT MANAGEMENT */}
      {activeTab === "rules_admin" && (
        <RuleAdministrationHub isLiveBackend={false} />
      )}
    </main>

      {/* Document Dossier Inspector Modal */}
      <DocumentInspectorModal
        isOpen={!!selectedDocForInspection}
        onClose={() => setSelectedDocForInspection(null)}
        document={selectedDocForInspection}
        onDocumentUpdated={(updated) => {
          onDocumentUpdated?.(updated);
          setSelectedDocForInspection(updated);
        }}
        activeRole="case_manager"
        defaultViewMode="workbench"
      />

      {/* Phase 5 AI Finding Inspector Modal */}
      <AIFindingInspectorModal
        isOpen={!!selectedFindingForInspection}
        onClose={() => setSelectedFindingForInspection(null)}
        finding={selectedFindingForInspection}
        onResolve={handleResolveFindingAction}
        onDismiss={handleDismissFindingAction}
        onEscalate={handleEscalateFindingAction}
      />

      {/* Phase 5 Evidence-Backed Summary Modal */}
      <EvidenceSummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        summary={evidenceSummary}
      />
    </div>
  );
}
