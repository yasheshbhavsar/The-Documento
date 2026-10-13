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
  const [formReviewAccepted, setFormReviewAccepted] = useState(false);
  const [selectedDocForInspection, setSelectedDocForInspection] = useState<DocumentItem | null>(null);
  const [docSearch, setDocSearch] = useState("");
  const [docCategoryFilter, setDocCategoryFilter] = useState("all");
  const [docStatusFilter, setDocStatusFilter] = useState("all");

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
    const targetCaseId = selectedCaseForWorkspace?.id || "case-01";
    api.getCaseChecklist(targetCaseId).then((res) => setChecklistReport(res.data));
    api.getCaseEvidenceSummary(targetCaseId).then((res) => setEvidenceSummary(res.data));
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
    { key: "assigned_cases", label: "Assigned Cases", icon: "📁", count: cases.length },
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
    assigned_cases: {
      title: "Assigned Cases",
      subtitle: `Active Caseload Oversight (${cases.length} active petitions assigned for preparation)`,
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

      {/* 2. ASSIGNED CASES */}
      {activeTab === "assigned_cases" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Active Case Consistency & Discrepancy Alert Focus */}
          {selectedCaseForWorkspace && (
            <CaseDiscrepancyAlertCenter
              caseId={selectedCaseForWorkspace.id}
              findings={localFindingsState}
              onResolveFinding={handleResolveFindingAction}
              onEscalateFinding={handleEscalateFindingAction}
              onInspectDocument={(docId) => {
                const doc = documents.find((d) => d.id === docId);
                if (doc) setSelectedDocForInspection(doc);
              }}
            />
          )}

          <Card title="My Assigned Immigration Petitions" subtitle="Caseworker queue with object-level authorization applied.">
            <DataTable
              columns={caseColumns}
              data={cases}
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", padding: "12px 16px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <div>
              <span style={{ fontSize: "12px", color: "#64748b" }}>Active Immigration Petition Case:</span>
              <strong style={{ marginLeft: "8px", fontSize: "13px" }}>
                {selectedCaseForWorkspace?.case_number} — {selectedCaseForWorkspace?.title}
              </strong>
            </div>
            <select
              value={selectedCaseForWorkspace?.id || ""}
              onChange={(e) => {
                const found = cases.find((c) => c.id === e.target.value);
                if (found) setSelectedCaseForWorkspace(found);
              }}
              style={{ fontSize: "12px", padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
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
