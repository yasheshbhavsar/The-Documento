import React, { useState, useEffect } from "react";
import { Modal } from "../common/Modal";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { TextInput, SelectInput } from "../common/FormControls";
import {
  ImmigrationCase,
  CaseMilestone,
  CaseNote,
  CaseTask,
  ClientDependant,
  RoleCode,
  CaseStage,
  AIFinding,
  CaseInterimReport,
  RouteFindingPayload,
} from "../../lib/types";
import { api, FIXTURE_AI_FINDINGS, fetchCaseInterimReports, resolveDocumentAnomaly } from "../../lib/api";
import { CaseMilestoneTimeline } from "./CaseMilestoneTimeline";
import { CaseDiscrepancyAlertCenter } from "./CaseDiscrepancyAlertCenter";
import { ApprovalGatesCard } from "./ApprovalGatesCard";

interface CaseDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseItem: ImmigrationCase | null;
  onCaseUpdated?: (updatedCase: ImmigrationCase) => void;
  activeRole?: RoleCode;
}

const LIFECYCLE_STAGES: { stage: CaseStage; label: string }[] = [
  { stage: "inquiry", label: "1. Inquiry" },
  { stage: "intake", label: "2. Intake & Retainer" },
  { stage: "awaiting_documents", label: "3. Awaiting Documents" },
  { stage: "processing", label: "4. Processing" },
  { stage: "internal_review", label: "5. Internal Review" },
  { stage: "awaiting_client", label: "6. Awaiting Client" },
  { stage: "ready_for_approval", label: "7. Ready for Approval" },
  { stage: "approved_for_submission", label: "8. Approved for Submission" },
  { stage: "submitted", label: "9. Submitted to Agency" },
  { stage: "decision_received", label: "10. Decision Received" },
  { stage: "closed", label: "11. Closed" },
  { stage: "archived", label: "12. Archived" },
  { stage: "reopened", label: "Reopened" },
];

export function CaseDetailModal({
  isOpen,
  onClose,
  caseItem,
  onCaseUpdated,
  activeRole = "case_manager",
}: CaseDetailModalProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "approval_gates" | "milestones" | "tasks" | "dependants" | "notes" | "audit" | "interim_reports"
  >("overview");

  // Local state for interactive editing
  const [currentCase, setCurrentCase] = useState<ImmigrationCase | null>(caseItem);
  const [milestones, setMilestones] = useState<CaseMilestone[]>([]);
  const [tasks, setTasks] = useState<CaseTask[]>([]);
  const [notes, setNotes] = useState<CaseNote[]>([]);
  const [dependants, setDependants] = useState<ClientDependant[]>([]);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [findings, setFindings] = useState<AIFinding[]>([]);
  const [interimReports, setInterimReports] = useState<CaseInterimReport[]>([]);
  const [isGeneratingInterim, setIsGeneratingInterim] = useState(false);
  const [anomalyResolutionNote, setAnomalyResolutionNote] = useState<Record<string, string>>({});

  // Action forms
  const [newStage, setNewStage] = useState<CaseStage>(caseItem?.status || "intake");
  const [stageReason, setStageReason] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // New milestone form
  const [newMsTitle, setNewMsTitle] = useState("");
  const [newMsStage, setNewMsStage] = useState("processing");
  const [newMsDate, setNewMsDate] = useState("");

  // New task form
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"critical" | "high" | "medium" | "low">("high");
  const [newTaskDue, setNewTaskDue] = useState("");

  // New note form
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNoteType, setNewNoteType] = useState<"internal" | "client_communication" | "legal_strategy">("internal");
  const [newNoteClientVisible, setNewNoteClientVisible] = useState(false);

  // New dependant form
  const [depRel, setDepRel] = useState("spouse");
  const [depFn, setDepFn] = useState("");
  const [depLn, setDepLn] = useState("");
  const [depNat, setDepNat] = useState("USA");
  const [depAuthView, setDepAuthView] = useState(true);

  // Feedback messages
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isClient = activeRole === "retained_client" || activeRole === "applicant";

  useEffect(() => {
    if (caseItem) {
      setCurrentCase(caseItem);
      setNewStage(caseItem.status);

      // Load initial milestones, tasks, notes, dependants
      const initialMs: CaseMilestone[] = caseItem.milestones || [
        {
          id: "ms-1",
          case_id: caseItem.id,
          title: "Initial Strategy Consultation & G-28 Filing",
          stage: "intake",
          target_date: "2026-08-15T00:00:00Z",
          completed_at: "2026-08-14T16:00:00Z",
          status: "completed",
          created_at: "2026-08-10T10:00:00Z",
        },
        {
          id: "ms-2",
          case_id: caseItem.id,
          title: "Evidentiary Review & Critical Role Documentation",
          stage: "processing",
          target_date: "2026-10-25T00:00:00Z",
          status: "pending",
          created_at: "2026-08-10T10:00:00Z",
        },
        {
          id: "ms-3",
          case_id: caseItem.id,
          title: "Final Attorney Brief Review & Exhibit Indexing",
          stage: "internal_review",
          target_date: "2026-11-05T00:00:00Z",
          status: "pending",
          created_at: "2026-08-10T10:00:00Z",
        },
        {
          id: "ms-4",
          case_id: caseItem.id,
          title: "USCIS Filing Package Submission",
          stage: "submitted",
          target_date: "2026-11-15T00:00:00Z",
          status: "pending",
          created_at: "2026-08-10T10:00:00Z",
        },
      ];
      setMilestones(initialMs);

      const initialTasks: CaseTask[] = [
        {
          id: "t-1",
          case_id: caseItem.id,
          title: "Verify sworn English translations for degree diplomas",
          due_date: "2026-10-22",
          priority: "high",
          is_completed: true,
          assigned_to: "Sarah Jenkins, Esq.",
        },
        {
          id: "t-2",
          case_id: caseItem.id,
          title: "Review expert opinion recommendation letter draft #3",
          due_date: "2026-10-28",
          priority: "critical",
          is_completed: false,
          assigned_to: "Sarah Jenkins, Esq.",
        },
      ];
      setTasks(initialTasks);

      const initialNotes: CaseNote[] = [
        {
          id: "n-1",
          case_id: caseItem.id,
          author_name: "Sarah Jenkins, Esq.",
          note_type: "legal_strategy",
          content: "Strategy: Formulate critical role prong citing Matter of Chawathe standards with quantitative impact metrics.",
          is_client_visible: false,
          created_at: "2026-10-09T14:30:00Z",
          updated_at: "2026-10-09T14:30:00Z",
        },
        {
          id: "n-2",
          case_id: caseItem.id,
          author_name: "Sarah Jenkins, Esq.",
          note_type: "client_communication",
          content: "Applicant update: Exhibit B-4 citation dossier has been successfully prepared and indexed.",
          is_client_visible: true,
          created_at: "2026-10-10T11:00:00Z",
          updated_at: "2026-10-10T11:00:00Z",
        },
      ];
      // Filter if client
      setNotes(isClient ? initialNotes.filter((n) => n.is_client_visible) : initialNotes);

      const initialDeps: ClientDependant[] = [
        {
          id: "dep-1",
          relationship_type: "spouse",
          first_name: "Authorized",
          last_name: "Spouse",
          nationality: "CAN",
          is_authorized_to_view_case: true,
          created_at: "2026-08-11T10:00:00Z",
        },
      ];
      setDependants(initialDeps);

      setAuditEvents([
        { action: "case.created", occurred_at: "2026-08-10T10:00:00Z", actor: "system", detail: "Case registered" },
        { action: "case.status_changed", occurred_at: "2026-09-01T15:00:00Z", actor: "sarah.jenkins@lex.com", detail: "Moved to processing" },
      ]);

      // Load AI findings & discrepancies
      api.getAIFindings(caseItem.id)
        .then((res) => {
          if (res?.data && res.data.length > 0) {
            setFindings(res.data);
          } else {
            setFindings(FIXTURE_AI_FINDINGS);
          }
        })
        .catch(() => setFindings(FIXTURE_AI_FINDINGS));

      // Phase 4: Load case interim snapshots
      fetchCaseInterimReports(caseItem.id)
        .then((reports) => setInterimReports(reports))
        .catch(() => {});
    }
  }, [caseItem, isClient]);

  if (!isOpen || !currentCase) return null;

  // Handle discrepancy resolution
  const handleResolveFinding = async (findingId: string, note: string) => {
    try {
      await api.resolveFinding(currentCase.id, findingId, note);
    } catch {
      // Offline fallback
    }
    setFindings((prev) =>
      prev.map((f) =>
        f.id === findingId
          ? {
              ...f,
              status: "resolved",
              resolution_action: "resolve",
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
    setActionSuccess("Cross-document discrepancy resolved with recorded affidavit.");
  };

  // Handle discrepancy escalation
  const handleEscalateFinding = async (findingId: string, note: string) => {
    try {
      await api.escalateFinding(currentCase.id, findingId, note);
    } catch {
      // Offline fallback
    }
    setFindings((prev) =>
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
    setActionSuccess("Discrepancy escalated to senior counsel for legal disposition.");
  };

  // Handle discrepancy routing
  const handleRouteFinding = async (findingId: string, payload: RouteFindingPayload) => {
    try {
      await api.routeFinding(currentCase.id, findingId, payload);
    } catch {
      // Offline fallback
    }
    setFindings((prev) =>
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
    setActionSuccess(`Issue routed to ${payload.owner_user_id}.`);
  };

  // Handle stage transition
  const handleTransitionStage = async () => {
    setIsUpdatingStatus(true);
    setActionError(null);
    try {
      const res = await api.updateCaseStatus(currentCase.id, newStage, stageReason);
      setCurrentCase(res.data);
      if (onCaseUpdated) onCaseUpdated(res.data);
      if (newStage === "internal_review" || newStage === "awaiting_client") {
        setActionSuccess(`Workflow stage transitioned to ${newStage.toUpperCase()} successfully. Notice: When a case is placed on hold or transitioned, Documento prompts download of the interim package plus OCR/anomaly report. Deadlines remain active and escalated.`);
      } else {
        setActionSuccess(`Workflow stage transitioned to ${newStage.toUpperCase()} successfully.`);
      }
      setStageReason("");
    } catch (err: any) {
      setActionError(err?.message || "Failed to transition stage.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Phase 4: Generate Interim Package Snapshot & Anomaly Report
  const handleGenerateInterimSnapshot = async () => {
    setIsGeneratingInterim(true);
    setActionError(null);
    try {
      const newReport: CaseInterimReport = {
        id: `ir-${Date.now()}`,
        case_id: currentCase.id,
        trigger_action: "manual_interim_snapshot",
        report_title: `Interim Dossier Snapshot (${new Date().toLocaleDateString()})`,
        manifest_snapshot_json: {
          total_documents: 8,
          verified_count: 6,
          anomaly_count: 1,
          generated_at: new Date().toISOString(),
        },
        ocr_summary_json: {
          completed_runs: 8,
          average_confidence: 0.97,
        },
        anomaly_report_json: {
          unresolved_anomalies: [
            {
              document_id: "doc-06",
              anomaly: "State Police Clearance: Low lighting glare detected on bottom signature corner",
            },
          ],
        },
        created_at: new Date().toISOString(),
      };
      setInterimReports((prev) => [newReport, ...prev]);
      setActionSuccess("Interim package snapshot and OCR/anomaly report generated. Deadlines remain active and escalated.");
    } catch {
      setActionError("Failed to generate interim snapshot.");
    } finally {
      setIsGeneratingInterim(false);
    }
  };

  // Phase 4: Officer Anomaly Resolution & Erroneous File Purge
  const handleResolveAnomaly = async (docId: string, action: "mark_resolved" | "confirm_erroneous_and_purge") => {
    const note = anomalyResolutionNote[docId] || "Reviewed and dispositioned by officer";
    try {
      await resolveDocumentAnomaly(docId, action, note);
      setActionSuccess(
        action === "mark_resolved"
          ? "Anomaly marked as resolved. Document returned to regular lifecycle cleanup schedule."
          : "Erroneous file confirmed and purged from storage. Transparent notice: Documento cannot delete already-downloaded local copies."
      );
      // Remove or update the anomaly in reports
      setInterimReports((prev) =>
        prev.map((r) => ({
          ...r,
          anomaly_report_json: {
            ...r.anomaly_report_json,
            unresolved_anomalies: (r.anomaly_report_json?.unresolved_anomalies || []).filter(
              (a: any) => a.document_id !== docId
            ),
          },
        }))
      );
    } catch {
      setActionError("Failed to resolve anomaly.");
    }
  };

  // Close case
  const handleCloseCase = async () => {
    const reason = prompt("Please provide reason for closing this case:", "Immigration visa granted and finalized");
    if (!reason) return;
    try {
      const res = await api.closeCase(currentCase.id, reason);
      setCurrentCase(res.data);
      if (onCaseUpdated) onCaseUpdated(res.data);
      setActionSuccess("Case successfully closed under authorized permissions.");
    } catch (err: any) {
      setActionError(err?.message || "Failed to close case.");
    }
  };

  // Reopen case
  const handleReopenCase = async () => {
    const reason = prompt("Please provide reason for reopening this case:", "Client requested PR extension petition");
    if (!reason) return;
    try {
      const res = await api.reopenCase(currentCase.id, reason);
      setCurrentCase(res.data);
      if (onCaseUpdated) onCaseUpdated(res.data);
      setActionSuccess("Case successfully reopened.");
    } catch (err: any) {
      setActionError(err?.message || "Failed to reopen case.");
    }
  };

  // Archive case
  const handleArchiveCase = async () => {
    if (!confirm("Are you sure you want to archive this closed case record?")) return;
    try {
      const res = await api.archiveCase(currentCase.id);
      setCurrentCase(res.data);
      if (onCaseUpdated) onCaseUpdated(res.data);
      setActionSuccess("Case archived for compliance retention.");
    } catch (err: any) {
      setActionError(err?.message || "Failed to archive case.");
    }
  };

  // Add milestone
  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsTitle.trim() || !newMsDate) return;
    try {
      const res = await api.createMilestone(currentCase.id, {
        title: newMsTitle.trim(),
        stage: newMsStage,
        target_date: new Date(newMsDate).toISOString(),
      });
      setMilestones((prev) => [...prev, res.data]);
      setNewMsTitle("");
      setNewMsDate("");
      setActionSuccess("Milestone added to filing roadmap.");
    } catch (err: any) {
      setActionError(err?.message || "Failed to add milestone.");
    }
  };

  // Toggle milestone completion
  const handleToggleMilestone = async (m: CaseMilestone) => {
    const nextStatus = m.status === "completed" ? "pending" : "completed";
    try {
      await api.toggleMilestone(currentCase.id, m.id, nextStatus === "completed");
      setMilestones((prev) =>
        prev.map((item) =>
          item.id === m.id
            ? { ...item, status: nextStatus, completed_at: nextStatus === "completed" ? new Date().toISOString() : undefined }
            : item
        )
      );
    } catch {
      // Offline fallback
      setMilestones((prev) =>
        prev.map((item) =>
          item.id === m.id
            ? { ...item, status: nextStatus, completed_at: nextStatus === "completed" ? new Date().toISOString() : undefined }
            : item
        )
      );
    }
  };

  // Add task
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const task: CaseTask = {
      id: `t-${Date.now()}`,
      case_id: currentCase.id,
      title: newTaskTitle.trim(),
      priority: newTaskPriority,
      due_date: newTaskDue || "2026-11-15",
      is_completed: false,
      assigned_to: "Sarah Jenkins, Esq.",
    };
    setTasks((prev) => [task, ...prev]);
    setNewTaskTitle("");
    setNewTaskDue("");
    setActionSuccess("Task assigned to case worker.");
  };

  // Toggle task
  const handleToggleTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, is_completed: !t.is_completed } : t))
    );
  };

  // Add note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;
    try {
      const res = await api.createNote(
        currentCase.id,
        {
          note_type: isClient ? "client_communication" : newNoteType,
          content: newNoteContent.trim(),
          is_client_visible: isClient ? true : newNoteClientVisible,
        },
        activeRole
      );
      setNotes((prev) => [res.data, ...prev]);
      setNewNoteContent("");
      setActionSuccess("Note logged in case history.");
    } catch (err: any) {
      setActionError(err?.message || "Failed to log note.");
    }
  };

  // Add dependant
  const handleAddDependant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depFn.trim() || !depLn.trim()) return;
    try {
      const res = await api.addDependant(currentCase.client_id, {
        relationship_type: depRel,
        first_name: depFn.trim(),
        last_name: depLn.trim(),
        nationality: depNat,
        is_authorized_to_view_case: depAuthView,
      });
      setDependants((prev) => [...prev, res.data]);
      setDepFn("");
      setDepLn("");
      setActionSuccess(`Added ${depRel} (${depFn} ${depLn}) to applicant family record.`);
    } catch (err: any) {
      setActionError(err?.message || "Failed to add dependant.");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      title={`${currentCase.case_number}: ${currentCase.title}`}
      subtitle={`Principal Client: ${currentCase.client_name} • Destination: ${currentCase.jurisdiction} (${currentCase.visa_category})`}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            {!isClient && currentCase.status !== "closed" && currentCase.status !== "archived" && (
              <Button variant="outline" size="sm" onClick={handleCloseCase}>
                🔒 Close Case
              </Button>
            )}
            {!isClient && (currentCase.status === "closed" || currentCase.status === "archived") && (
              <Button variant="outline" size="sm" onClick={handleReopenCase}>
                🔓 Reopen Case
              </Button>
            )}
            {!isClient && currentCase.status === "closed" && (
              <Button variant="outline" size="sm" onClick={handleArchiveCase}>
                🗄️ Archive Case
              </Button>
            )}
          </div>
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Banner alerts */}
        {actionSuccess && (
          <div
            role="status"
            style={{
              padding: "10px 14px",
              background: "var(--success-soft, #f0fdf4)",
              color: "var(--success, #15803d)",
              border: "1px solid #bbf7d0",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: 500,
            }}
          >
            ✓ {actionSuccess}
          </div>
        )}
        {actionError && (
          <div
            role="alert"
            style={{
              padding: "10px 14px",
              background: "var(--critical-soft, #fef2f2)",
              color: "var(--critical, #b91c1c)",
              border: "1px solid #fecaca",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: 500,
            }}
          >
            ⚠️ {actionError}
          </div>
        )}

        {/* Status Lifecycle Stepper / Bar */}
        <div
          style={{
            background: "var(--surface-subtle, #f8fafc)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: "8px",
            padding: "12px 16px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
              Current Controlled Lifecycle Stage
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
              <Badge variant={currentCase.status === "closed" || currentCase.status === "archived" ? "neutral" : "review"}>
                {currentCase.status.toUpperCase()}
              </Badge>
              <span style={{ fontSize: "13px", color: "var(--text)" }}>
                {LIFECYCLE_STAGES.find((s) => s.stage === currentCase.status)?.label || currentCase.status}
              </span>
            </div>
          </div>

          {!isClient && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <select
                value={newStage}
                onChange={(e) => setNewStage(e.target.value as CaseStage)}
                aria-label="Target Workflow Stage"
                style={{
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--border, #cbd5e1)",
                  fontSize: "13px",
                  background: "var(--surface, #ffffff)",
                  color: "var(--text)",
                }}
              >
                {LIFECYCLE_STAGES.map((s) => (
                  <option key={s.stage} value={s.stage}>
                    {s.label}
                  </option>
                ))}
              </select>
              <Button variant="primary" size="sm" onClick={handleTransitionStage} isLoading={isUpdatingStatus}>
                Transition Stage →
              </Button>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--border, #e2e8f0)",
            gap: "6px",
            overflowX: "auto",
          }}
        >
          {[
            { id: "overview", label: "📋 Overview & Team" },
            { id: "approval_gates", label: "🛡️ Approval Gates" },
            { id: "milestones", label: `⏳ Milestones (${milestones.length})` },
            { id: "tasks", label: `✓ Tasks (${tasks.filter((t) => !t.is_completed).length})` },
            { id: "dependants", label: `👨‍👩‍👧 Dependants & Consents (${dependants.length})` },
            { id: "notes", label: `📝 Notes & Activity (${notes.length})` },
            { id: "interim_reports", label: `📦 Interim Snapshots & Anomalies (${interimReports.length})` },
            { id: "audit", label: "📜 History Audit" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              aria-current={activeTab === tab.id ? "true" : undefined}
              style={{
                padding: "8px 12px",
                border: "none",
                background: "transparent",
                borderBottom: activeTab === tab.id ? "2px solid var(--accent, #0D6866)" : "2px solid transparent",
                color: activeTab === tab.id ? "var(--accent, #0D6866)" : "var(--muted, #6E7F7C)",
                fontWeight: activeTab === tab.id ? 700 : 500,
                cursor: "pointer",
                fontSize: "13px",
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 1. OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Phase 9 Firm Approval Gates & Decoupled State Machines */}
            <ApprovalGatesCard
              caseItem={currentCase}
              activeRole={activeRole}
              onCaseUpdated={(updated) => {
                setCurrentCase(updated);
                onCaseUpdated?.(updated);
              }}
            />

            {/* Cross-Document Discrepancy & Consistency Alert Center */}
            <CaseDiscrepancyAlertCenter
              caseId={currentCase.id}
              findings={findings}
              onResolveFinding={handleResolveFinding}
              onEscalateFinding={handleEscalateFinding}
              onRouteFinding={handleRouteFinding}
            />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: "16px" }}>
              <div
                style={{
                  padding: "16px",
                  border: "1px solid var(--border, #e2e8f0)",
                  borderRadius: "8px",
                  background: "var(--surface, #ffffff)",
                }}
              >
                <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", color: "var(--text)" }}>Case & Pathway Specifications</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
                  <div><strong>Case Identifier:</strong> {currentCase.case_number}</div>
                  <div><strong>Destination Jurisdiction:</strong> {currentCase.jurisdiction}</div>
                  <div><strong>Immigration Pathway:</strong> {currentCase.visa_category}</div>
                  <div><strong>Priority Date:</strong> {currentCase.priority_date || "2026-08-10 (Direct Filing)"}</div>
                  <div><strong>Statutory Deadline:</strong> {currentCase.deadline || "2026-11-15"}</div>
                  <div><strong>Filing Readiness Score:</strong> {currentCase.readiness_score || 82}% Complete</div>
                </div>
              </div>

              <div
                style={{
                  padding: "16px",
                  border: "1px solid var(--border, #e2e8f0)",
                  borderRadius: "8px",
                  background: "var(--surface, #ffffff)",
                }}
              >
                <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", color: "var(--text)" }}>Case Staffing & Assignments</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
                  <div><strong>Assigned Case Manager:</strong> {currentCase.assigned_manager || "Sarah Jenkins, Esq."}</div>
                  <div><strong>Senior Legal Reviewer:</strong> {currentCase.reviewer_name || "Elena Vance (Managing Partner)"}</div>
                  <div><strong>Lead Petition Drafter:</strong> David Cho (Associate Paralegal)</div>
                  <div style={{ marginTop: "10px", fontSize: "12px", color: "var(--muted)" }}>
                    Staff assignments govern object-level editing permissions and workload allocation.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* APPROVAL GATES TAB */}
        {activeTab === "approval_gates" && (
          <ApprovalGatesCard
            caseItem={currentCase}
            activeRole={activeRole}
            onCaseUpdated={(updated) => {
              setCurrentCase(updated);
              onCaseUpdated?.(updated);
            }}
          />
        )}

        {/* 2. MILESTONES TAB */}
        {activeTab === "milestones" && (
          <CaseMilestoneTimeline
            milestones={milestones}
            onToggleMilestone={handleToggleMilestone}
            onAddMilestone={handleAddMilestone}
            newMsTitle={newMsTitle}
            setNewMsTitle={setNewMsTitle}
            newMsDate={newMsDate}
            setNewMsDate={setNewMsDate}
            newMsStage={newMsStage}
            setNewMsStage={setNewMsStage}
            isClient={isClient}
          />
        )}

        {/* 3. TASKS TAB */}
        {activeTab === "tasks" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {tasks.map((task) => (
                <div
                  key={task.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    border: "1px solid var(--border, #e2e8f0)",
                    borderRadius: "6px",
                    background: task.is_completed ? "var(--surface-subtle, #f8fafc)" : "var(--surface, #ffffff)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <input
                      type="checkbox"
                      checked={task.is_completed}
                      onChange={() => handleToggleTask(task.id)}
                      aria-label={`Mark task ${task.title} complete`}
                      style={{ cursor: "pointer", width: "16px", height: "16px" }}
                    />
                    <div>
                      <strong style={{ fontSize: "13px", textDecoration: task.is_completed ? "line-through" : "none" }}>
                        {task.title}
                      </strong>
                      <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                        Assignee: {task.assigned_to || "Sarah Jenkins, Esq."} • Due: {task.due_date}
                      </div>
                    </div>
                  </div>
                  <Badge variant={task.priority === "critical" ? "critical" : task.priority === "high" ? "warning" : "neutral"}>
                    {task.priority.toUpperCase()}
                  </Badge>
                </div>
              ))}
            </div>

            {!isClient && (
              <form
                onSubmit={handleAddTask}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr auto",
                  gap: "10px",
                  padding: "14px",
                  background: "var(--surface-subtle, #f8fafc)",
                  borderRadius: "8px",
                  border: "1px dashed var(--border, #cbd5e1)",
                  alignItems: "flex-end",
                }}
              >
                <TextInput
                  label="Task Title"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="e.g. Request supplementary expert credentials"
                  required
                />
                <TextInput
                  label="Due Date"
                  type="date"
                  value={newTaskDue}
                  onChange={(e) => setNewTaskDue(e.target.value)}
                />
                <SelectInput
                  label="Priority"
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value as any)}
                  options={[
                    { label: "Critical", value: "critical" },
                    { label: "High", value: "high" },
                    { label: "Medium", value: "medium" },
                    { label: "Low", value: "low" },
                  ]}
                />
                <Button variant="primary" type="submit" size="sm">
                  + Add Task
                </Button>
              </form>
            )}
          </div>
        )}

        {/* 4. DEPENDANTS & CONSENTS TAB */}
        {activeTab === "dependants" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              style={{
                padding: "14px",
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: "8px",
                background: "var(--surface, #ffffff)",
              }}
            >
              <h4 style={{ margin: "0 0 10px 0", fontSize: "14px" }}>Principal Applicant & Legal Consents</h4>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", fontSize: "13px" }}>
                <span style={{ padding: "4px 8px", background: "#f1f5f9", borderRadius: "4px" }}>
                  👤 Principal: <strong>{currentCase.client_name}</strong>
                </span>
                <span style={{ padding: "4px 8px", background: "#f0fdf4", color: "#166534", borderRadius: "4px" }}>
                  ✓ Form G-28 Legal Representation Recorded
                </span>
                <span style={{ padding: "4px 8px", background: "#f0fdf4", color: "#166534", borderRadius: "4px" }}>
                  ✓ GDPR Data Processing Consent Active
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <h4 style={{ margin: "0", fontSize: "14px" }}>Family Members & Authorized Dependants</h4>
              {dependants.map((dep) => (
                <div
                  key={dep.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    border: "1px solid var(--border, #e2e8f0)",
                    borderRadius: "6px",
                    background: "var(--surface, #ffffff)",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "13px" }}>
                      {dep.first_name} {dep.last_name}
                    </strong>
                    <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                      Relationship: <span style={{ textTransform: "capitalize" }}>{dep.relationship_type}</span> • Nationality: {dep.nationality}
                    </div>
                  </div>
                  <Badge variant={dep.is_authorized_to_view_case ? "success" : "neutral"}>
                    {dep.is_authorized_to_view_case ? "Authorized Portal Viewer" : "No Portal Access"}
                  </Badge>
                </div>
              ))}
            </div>

            {!isClient && (
              <form
                onSubmit={handleAddDependant}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr 1fr auto",
                  gap: "10px",
                  padding: "14px",
                  background: "var(--surface-subtle, #f8fafc)",
                  borderRadius: "8px",
                  border: "1px dashed var(--border, #cbd5e1)",
                  alignItems: "flex-end",
                }}
              >
                <SelectInput
                  label="Relationship"
                  value={depRel}
                  onChange={(e) => setDepRel(e.target.value)}
                  options={[
                    { label: "Spouse", value: "spouse" },
                    { label: "Child", value: "child" },
                    { label: "Parent", value: "parent" },
                    { label: "Dependent", value: "dependent" },
                  ]}
                />
                <TextInput label="First Name" value={depFn} onChange={(e) => setDepFn(e.target.value)} required />
                <TextInput label="Last Name" value={depLn} onChange={(e) => setDepLn(e.target.value)} required />
                <TextInput label="Nationality (ISO)" value={depNat} onChange={(e) => setDepNat(e.target.value)} required />
                <Button variant="primary" type="submit" size="sm">
                  + Add Dependant
                </Button>
              </form>
            )}
          </div>
        )}

        {/* 5. NOTES TAB */}
        {activeTab === "notes" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {notes.map((note) => (
                <div
                  key={note.id}
                  style={{
                    padding: "12px 14px",
                    border: "1px solid var(--border, #e2e8f0)",
                    borderRadius: "6px",
                    background: note.is_client_visible ? "var(--surface, #ffffff)" : "var(--surface-subtle, #fefce8)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <strong style={{ fontSize: "13px" }}>{note.author_name || "Legal Staff"}</strong>
                      <span style={{ fontSize: "11px", color: "var(--muted)" }}>{note.created_at.split("T")[0]}</span>
                    </div>
                    <Badge variant={note.is_client_visible ? "success" : "warning"}>
                      {note.is_client_visible ? "🌐 Client Visible" : "🔒 Internal Legal Strategy"}
                    </Badge>
                  </div>
                  <p style={{ margin: 0, fontSize: "13px", color: "var(--text)", lineHeight: 1.5 }}>
                    {note.content}
                  </p>
                </div>
              ))}
            </div>

            <form
              onSubmit={handleAddNote}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                padding: "14px",
                background: "var(--surface-subtle, #f8fafc)",
                borderRadius: "8px",
                border: "1px dashed var(--border, #cbd5e1)",
              }}
            >
              <textarea
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                placeholder={isClient ? "Type message or inquiry for your legal team..." : "Record legal strategy memo, call notes, or client update..."}
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  border: "1px solid var(--border, #cbd5e1)",
                  fontSize: "13px",
                  fontFamily: "inherit",
                }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {!isClient ? (
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={newNoteClientVisible}
                      onChange={(e) => setNewNoteClientVisible(e.target.checked)}
                    />
                    <span>Make visible to retained client in portal</span>
                  </label>
                ) : (
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>Communication will be posted to your legal team.</span>
                )}
                <Button variant="primary" type="submit" size="sm">
                  Post Note
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* 6. INTERIM REPORTS & ANOMALY LIFECYCLE TAB */}
        {activeTab === "interim_reports" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Hold & Reassignment Protocol Banner */}
            <div
              style={{
                background: "linear-gradient(135deg, #063C3D 0%, #0D6866 100%)",
                borderRadius: "10px",
                padding: "16px 20px",
                color: "#FFFFFF",
                boxShadow: "0 2px 8px rgba(6, 60, 61, 0.15)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ fontSize: "16px" }}>🛡️</span>
                    <strong style={{ fontSize: "14px", fontWeight: 700 }}>
                      Phase 4 Temporary Lifecycle &amp; Evidentiary Snapshot Protocol
                    </strong>
                  </div>
                  <p style={{ margin: "4px 0 0 0", fontSize: "12px", opacity: 0.9, lineHeight: 1.45, maxWidth: "680px" }}>
                    <strong>Hold / Reassignment Rule:</strong> Any case placement on hold or staffing reassignment prompts an immediate download of an interim dossier package plus OCR/anomaly report. <em>Statutory deadlines remain active and escalated.</em> Internal-only activity does not reset inactivity counters when client requests remain untouched.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleGenerateInterimSnapshot}
                  isLoading={isGeneratingInterim}
                  style={{
                    background: "#FFFFFF",
                    color: "#063C3D",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  📸 Snapshot Interim Package
                </Button>
              </div>
            </div>

            {/* Inactivity & Cleanup Schedule Monitor */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
                gap: "12px",
              }}
            >
              <div
                style={{
                  background: "#F8F7F2",
                  border: "1px solid #DCE5E1",
                  borderRadius: "8px",
                  padding: "12px 14px",
                }}
              >
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#6E7F7C", textTransform: "uppercase" }}>
                  INACTIVITY WARNING TIMELINE
                </span>
                <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px" }}>
                  <div><strong>Day 7:</strong> First automated client notice</div>
                  <div><strong>Day 10:</strong> Escalated reminder</div>
                  <div><strong>Day 14:</strong> Final pre-cleanup warning</div>
                  <div style={{ color: "#B91C1C", fontWeight: 650 }}><strong>Day 15:</strong> Scheduled temporary file cleanup</div>
                </div>
              </div>

              <div
                style={{
                  background: "#F8F7F2",
                  border: "1px solid #DCE5E1",
                  borderRadius: "8px",
                  padding: "12px 14px",
                }}
              >
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#6E7F7C", textTransform: "uppercase" }}>
                  CLEANUP EXCLUSION RULES
                </span>
                <div style={{ marginTop: "6px", fontSize: "12px", color: "#445451", lineHeight: 1.4 }}>
                  <p style={{ margin: "0 0 6px 0" }}>
                    • Files with <strong>unresolved anomalies</strong> are strictly excluded from automated Day-15 cleanup until an officer reviews them.
                  </p>
                  <p style={{ margin: 0 }}>
                    • Internal notes or staff updates <strong>never</strong> reset client inactivity counters.
                  </p>
                </div>
              </div>

              <div
                style={{
                  background: "#F8F7F2",
                  border: "1px solid #DCE5E1",
                  borderRadius: "8px",
                  padding: "12px 14px",
                }}
              >
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#6E7F7C", textTransform: "uppercase" }}>
                  VERIFIED DOWNLOAD LIMITS
                </span>
                <div style={{ marginTop: "6px", fontSize: "12px", color: "#445451", lineHeight: 1.4 }}>
                  <p style={{ margin: 0 }}>
                    Browser download initiation is not proof of storage persistence. Verification confirms client-side receipt in the active browser session. Local storage copies remain under client/firm custody.
                  </p>
                </div>
              </div>
            </div>

            {/* Generated Interim Dossier Snapshots */}
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid #DCE5E1",
                borderRadius: "10px",
                padding: "16px 18px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#063C3D" }}>
                    Interim Dossier Packages on File ({interimReports.length})
                  </h4>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6E7F7C" }}>
                    Archival manifests captured upon legal hold, reassignment, or manual attorney checkpoint.
                  </p>
                </div>
              </div>

              {interimReports.length === 0 ? (
                <div style={{ padding: "24px", textAlign: "center", color: "#6E7F7C", fontSize: "13px" }}>
                  No interim reports have been generated yet for this case. Click "Snapshot Interim Package" above to create one.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {interimReports.map((report) => (
                    <div
                      key={report.id}
                      style={{
                        padding: "14px 16px",
                        borderRadius: "8px",
                        border: "1px solid #DCE5E1",
                        background: "#F8F7F2",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "12px",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <strong style={{ fontSize: "13px", color: "#063C3D" }}>{report.report_title}</strong>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: "#EAF6F0",
                              color: "#0D6866",
                              border: "1px solid #B9DED4",
                            }}
                          >
                            {report.trigger_action.replace(/_/g, " ").toUpperCase()}
                          </span>
                        </div>
                        <div style={{ fontSize: "12px", color: "#445451", marginTop: "4px", display: "flex", gap: "14px", flexWrap: "wrap" }}>
                          <span>Total Docs: <strong>{report.manifest_snapshot_json?.total_documents ?? 0}</strong></span>
                          <span>Verified: <strong>{report.manifest_snapshot_json?.verified_count ?? 0}</strong></span>
                          <span>Anomalies: <strong style={{ color: (report.manifest_snapshot_json?.anomaly_count || 0) > 0 ? "#D97706" : "#0D6866" }}>{report.manifest_snapshot_json?.anomaly_count ?? 0}</strong></span>
                          <span>OCR Confidence: <strong>{((report.ocr_summary_json?.average_confidence || 0.98) * 100).toFixed(0)}%</strong></span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <button
                          type="button"
                          onClick={() => {
                            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
                            const downloadAnchor = document.createElement("a");
                            downloadAnchor.setAttribute("href", dataStr);
                            downloadAnchor.setAttribute("download", `Interim_Report_${report.id}.json`);
                            document.body.appendChild(downloadAnchor);
                            downloadAnchor.click();
                            downloadAnchor.remove();
                            setActionSuccess("Interim package manifest downloaded. Starting a browser download is not proof the file was saved to local disk.");
                          }}
                          style={{
                            background: "#0D6866",
                            color: "#FFFFFF",
                            border: "none",
                            borderRadius: "6px",
                            padding: "6px 12px",
                            fontSize: "12px",
                            fontWeight: 650,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <span>📥 Download Manifest &amp; Snapshot</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Unresolved Anomalies Section */}
            <div
              style={{
                background: "#FFFFFF",
                border: "1.5px solid #FCD34D",
                borderRadius: "10px",
                padding: "16px 18px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <span style={{ fontSize: "16px" }}>⚠️</span>
                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#92400E" }}>
                  Unresolved Evidentiary Anomalies (Excluded From Routine Cleanup)
                </h4>
              </div>
              <p style={{ margin: "0 0 14px 0", fontSize: "12px", color: "#78350F", lineHeight: 1.4 }}>
                The following documents contain detected scan or boundary anomalies (e.g. lighting glare, visible corners cropped, illegible seal, or boundary overlap). Per Documento retention policy, these files are preserved indefinitely until an officer reviews and either marks them resolved or confirms them erroneous and purges them.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[
                  {
                    docId: "doc-06",
                    title: "State_Police_Clearance_Certificate.pdf",
                    anomaly: "Low lighting glare detected on bottom signature corner; visible seal slightly blurred.",
                  },
                ].map((item) => (
                  <div
                    key={item.docId}
                    style={{
                      background: "#FFFBEB",
                      border: "1px solid #FDE68A",
                      borderRadius: "8px",
                      padding: "12px 14px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <strong style={{ fontSize: "13px", color: "#92400E" }}>{item.title}</strong>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "#FEF3C7",
                          color: "#B45309",
                          border: "1px solid #FCD34D",
                        }}
                      >
                        ANOMALY ACTIVE
                      </span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#78350F", marginBottom: "10px" }}>
                      {item.anomaly}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <input
                        type="text"
                        placeholder="Officer disposition notes..."
                        value={anomalyResolutionNote[item.docId] || ""}
                        onChange={(e) =>
                          setAnomalyResolutionNote((prev) => ({ ...prev, [item.docId]: e.target.value }))
                        }
                        style={{
                          flex: 1,
                          minWidth: "200px",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: "1px solid #FCD34D",
                          fontSize: "12px",
                          background: "#FFFFFF",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleResolveAnomaly(item.docId, "mark_resolved")}
                        style={{
                          background: "#16A34A",
                          color: "#FFFFFF",
                          border: "none",
                          borderRadius: "6px",
                          padding: "6px 12px",
                          fontSize: "12px",
                          fontWeight: 650,
                          cursor: "pointer",
                        }}
                      >
                        ✓ Mark Resolved
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResolveAnomaly(item.docId, "confirm_erroneous_and_purge")}
                        style={{
                          background: "#DC2626",
                          color: "#FFFFFF",
                          border: "none",
                          borderRadius: "6px",
                          padding: "6px 12px",
                          fontSize: "12px",
                          fontWeight: 650,
                          cursor: "pointer",
                        }}
                      >
                        🗑️ Confirm Erroneous &amp; Purge
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 7. AUDIT TAB */}
        {activeTab === "audit" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {auditEvents.map((ev, idx) => (
              <div
                key={idx}
                style={{
                  padding: "10px 14px",
                  border: "1px solid var(--border, #e2e8f0)",
                  borderRadius: "6px",
                  fontSize: "13px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <strong style={{ color: "var(--text)" }}>{ev.action}</strong>
                  <span style={{ color: "var(--muted)", marginLeft: "8px" }}>{ev.detail}</span>
                </div>
                <span style={{ fontSize: "11px", color: "var(--quiet)" }}>{ev.occurred_at}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
