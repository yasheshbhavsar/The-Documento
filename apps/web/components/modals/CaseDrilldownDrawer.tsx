import React from "react";
import { Drawer } from "../common/Drawer";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { ImmigrationCase, UserContext, RoleCode } from "../../lib/types";
import { getCaseKickoffProgress } from "../../lib/caseKickoffStore";
import { CANONICAL_6_STAGES, getCaseStageInfo } from "../../lib/caseLifecycle";
import { canDeleteClient } from "../../lib/auth";
import { useWorkspaceSafe } from "../../lib/context/WorkspaceContext";
import { api } from "../../lib/api";

interface CaseDrilldownDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  caseItem: ImmigrationCase | null;
  onOpenWorkspace?: (caseId: string) => void;
  onOpenDetailModal?: (caseItem: ImmigrationCase) => void;
  onOpenCaseKickoff?: (caseItem: ImmigrationCase) => void;
  currentUser?: UserContext | null;
  activeRole?: RoleCode;
  onDeleteClient?: (clientId: string) => void | Promise<void>;
}

export function CaseDrilldownDrawer({
  isOpen,
  onClose,
  caseItem,
  onOpenWorkspace,
  onOpenDetailModal,
  onOpenCaseKickoff,
  currentUser,
  activeRole,
  onDeleteClient,
}: CaseDrilldownDrawerProps) {
  if (!caseItem) return null;

  const ws = useWorkspaceSafe();
  const effectiveUser =
    currentUser !== undefined
      ? currentUser
      : ws?.currentUser !== undefined
        ? ws.currentUser
        : (activeRole
          ? ({ role: activeRole, experience: activeRole } as UserContext)
          : null);
  const isDeleteClientAllowed = canDeleteClient(effectiveUser);

  const kickoff = getCaseKickoffProgress(caseItem.id);
  const stageInfo = getCaseStageInfo(caseItem.status);

  const handleOpenWorkspace = () => {
    if (onOpenWorkspace) {
      onOpenWorkspace(caseItem.id);
    } else if (onOpenDetailModal) {
      onOpenDetailModal(caseItem);
    }
    onClose();
  };

  const handleDeleteClientClick = async () => {
    if (!caseItem?.client_id) return;
    const ok = window.confirm(
      `Permanently delete client "${caseItem.client_name || caseItem.client_id}" and all associated cases, documents, and tasks? This action cannot be undone.`
    );
    if (!ok) return;

    if (onDeleteClient) {
      await onDeleteClient(caseItem.client_id);
    } else if (ws?.handleDeleteClient) {
      await ws.handleDeleteClient(caseItem.client_id);
    } else {
      await api.deleteClient(caseItem.client_id, activeRole || "master_admin", true);
    }
    onClose();
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={caseItem.case_number}
      subtitle={caseItem.title}
      badge={<Badge variant={stageInfo.badgeVariant}>{stageInfo.label}</Badge>}
      footer={
        <div style={{ display: "flex", gap: "10px", width: "100%", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <Button variant="secondary" onClick={onClose} data-testid="drawer-close-btn">
              Close
            </Button>
            {isDeleteClientAllowed && caseItem.client_id && (
              <Button
                variant="danger"
                data-testid="delete-client-drawer-btn"
                aria-label={`Delete client ${caseItem.client_name || ""}`.trim()}
                onClick={handleDeleteClientClick}
              >
                🗑️ Delete Client
              </Button>
            )}
          </div>
          {(onOpenWorkspace || onOpenDetailModal) && (
            <Button
              variant="primary"
              data-testid="open-case-workspace-btn"
              onClick={handleOpenWorkspace}
            >
              Open Case Workspace →
            </Button>
          )}
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {onOpenCaseKickoff && !kickoff.isComplete && (
          <div
            data-testid="drawer-kickoff-banner"
            style={{
              padding: "12px 14px",
              background: "#EAF6F0",
              border: "1px solid #B9DED4",
              borderRadius: "8px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <strong style={{ display: "block", fontSize: "13px", color: "#063C3D" }}>
                Post-Onboarding Kickoff ({kickoff.completedCount}/4 Steps Completed)
              </strong>
              <span style={{ fontSize: "12px", color: "#445451" }}>
                Finish login handoff, officer &amp; checklist dispatch, retainer setup, and initial uploads.
              </span>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onClose();
                onOpenCaseKickoff(caseItem);
              }}
            >
              Resume Kickoff ({kickoff.completedCount}/4) →
            </Button>
          </div>
        )}

        {/* Urgent Attention Alert if applicable */}
        {caseItem.attention_required && (
          <div
            role="alert"
            style={{
              padding: "12px 14px",
              background: "var(--critical-soft, #fef2f2)",
              border: "1px solid var(--critical, #b91c1c)",
              borderRadius: "8px",
              color: "var(--critical, #b91c1c)",
              fontSize: "13px",
            }}
          >
            <strong>Action Required:</strong> Critical filing alert flagged for this petition. Review evidentiary checklists and attorney signoff notes immediately.
          </div>
        )}

        {/* Client Card */}
        <div
          style={{
            background: "var(--surface-subtle, #f8fafc)",
            padding: "16px",
            borderRadius: "8px",
            border: "1px solid var(--border, #e2e8f0)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <span style={{ color: "var(--quiet)", display: "block", fontSize: "11px", textTransform: "uppercase", marginBottom: "4px" }}>
                Principal Retained Applicant
              </span>
              <strong style={{ fontSize: "16px", color: "var(--text)" }}>{caseItem.client_name}</strong>
            </div>
            {isDeleteClientAllowed && caseItem.client_id && (
              <Button
                variant="danger"
                size="sm"
                data-testid="delete-client-card-btn"
                aria-label={`Delete client ${caseItem.client_name || ""}`.trim()}
                onClick={handleDeleteClientClick}
              >
                Delete Client
              </Button>
            )}
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            <Badge variant="neutral">{caseItem.jurisdiction}</Badge>
            <Badge variant="info">{caseItem.visa_category}</Badge>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
            fontSize: "13px",
          }}
        >
          <div>
            <span style={{ color: "var(--quiet)", display: "block", fontSize: "11px", textTransform: "uppercase" }}>
              Assigned Caseworker
            </span>
            <strong>{caseItem.assigned_manager || "Unassigned"}</strong>
          </div>
          <div>
            <span style={{ color: "var(--quiet)", display: "block", fontSize: "11px", textTransform: "uppercase" }}>
              Case Opening Date
            </span>
            <span>{caseItem.created_at ? new Date(caseItem.created_at).toLocaleDateString() : "Active"}</span>
          </div>
          <div>
            <span style={{ color: "var(--quiet)", display: "block", fontSize: "11px", textTransform: "uppercase" }}>
              Priority Date
            </span>
            <span>{caseItem.priority_date || "Pending Filing"}</span>
          </div>
          <div>
            <span style={{ color: "var(--quiet)", display: "block", fontSize: "11px", textTransform: "uppercase" }}>
              Agency Filing Deadline
            </span>
            <strong style={{ color: "var(--critical, #b91c1c)" }}>{caseItem.deadline || "Standard"}</strong>
          </div>
        </div>

        {/* Current Workflow Stage */}
        <div
          style={{
            background: "var(--surface, #ffffff)",
            padding: "16px",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: "8px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ color: "var(--quiet)", fontSize: "11px", textTransform: "uppercase", fontWeight: 700 }}>
              Active Processing Pipeline
            </span>
            <Badge variant={stageInfo.badgeVariant} size="sm">
              Step {stageInfo.step} of 6
            </Badge>
          </div>
          <strong style={{ fontSize: "14px", color: "var(--text)" }}>
            {stageInfo.shortLabel}: {stageInfo.label}
          </strong>
          <p style={{ margin: "6px 0 0", fontSize: "12px", color: "var(--muted)" }}>
            {stageInfo.description}
          </p>
        </div>
      </div>
    </Drawer>
  );
}
