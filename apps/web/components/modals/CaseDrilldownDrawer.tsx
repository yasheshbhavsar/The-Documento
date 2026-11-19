import React, { useMemo, useState } from "react";
import { Drawer } from "../common/Drawer";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { ImmigrationCase, UserContext, RoleCode, TeamMemberCapacity } from "../../lib/types";
import { getCaseKickoffProgress } from "../../lib/caseKickoffStore";
import { CANONICAL_6_STAGES, getCaseStageInfo } from "../../lib/caseLifecycle";
import { canDeleteClient, canDeleteCase, canAssignCaseworker } from "../../lib/auth";
import { useWorkspaceSafe } from "../../lib/context/WorkspaceContext";
import { api } from "../../lib/api";

interface CaseDrilldownDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  caseItem: ImmigrationCase | null;
  teamCapacity?: TeamMemberCapacity[];
  onOpenWorkspace?: (caseId: string) => void;
  onOpenDetailModal?: (caseItem: ImmigrationCase) => void;
  onOpenCaseKickoff?: (caseItem: ImmigrationCase) => void;
  currentUser?: UserContext | null;
  activeRole?: RoleCode;
  onDeleteClient?: (clientId: string) => void | Promise<void>;
  onDeleteCase?: (caseId: string) => void | Promise<void>;
  onCaseAssigned?: (updatedCase: ImmigrationCase) => void;
}

export function CaseDrilldownDrawer({
  isOpen,
  onClose,
  caseItem,
  teamCapacity,
  onOpenWorkspace,
  onOpenDetailModal,
  onOpenCaseKickoff,
  currentUser,
  activeRole,
  onDeleteClient,
  onDeleteCase,
  onCaseAssigned,
}: CaseDrilldownDrawerProps) {
  const ws = useWorkspaceSafe();
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignSaved, setAssignSaved] = useState(false);

  const effectiveTeam = teamCapacity ?? ws?.capacity ?? [];
  const effectiveUser =
    currentUser !== undefined
      ? currentUser
      : ws?.currentUser !== undefined
        ? ws.currentUser
        : (activeRole
          ? ({ role: activeRole, experience: activeRole } as UserContext)
          : null);

  const staffOptions = useMemo(() => {
    const map = new Map<string, { id?: string; name: string; role?: string }>();
    for (const tm of effectiveTeam) {
      if (tm.name) {
        map.set(tm.name.trim().toLowerCase(), { id: tm.id, name: tm.name.trim(), role: tm.role });
      }
    }
    if (effectiveUser?.full_name && !map.has(effectiveUser.full_name.trim().toLowerCase())) {
      map.set(effectiveUser.full_name.trim().toLowerCase(), {
        id: effectiveUser.id,
        name: effectiveUser.full_name.trim(),
        role: effectiveUser.role === "master_admin" ? "Managing Partner" : "Case Manager",
      });
    }
    if (
      caseItem?.assigned_manager &&
      caseItem.assigned_manager !== "Unassigned" &&
      !map.has(caseItem.assigned_manager.trim().toLowerCase())
    ) {
      map.set(caseItem.assigned_manager.trim().toLowerCase(), {
        name: caseItem.assigned_manager.trim(),
      });
    }
    return Array.from(map.values());
  }, [effectiveTeam, effectiveUser?.full_name, effectiveUser?.id, effectiveUser?.role, caseItem?.assigned_manager]);

  if (!caseItem) return null;

  const isDeleteClientAllowed = canDeleteClient(effectiveUser);
  const isDeleteCaseAllowed = canDeleteCase(effectiveUser);
  const isAssignAllowed = canAssignCaseworker(effectiveUser);

  const handleDrawerAssignChange = async (nextName: string) => {
    setIsAssigning(true);
    setAssignSaved(false);
    try {
      const matched = staffOptions.find((s) => s.name === nextName);
      if (ws?.handleAssignCaseworker) {
        await ws.handleAssignCaseworker({
          caseId: caseItem.id,
          officerName: nextName || "Unassigned",
          officerUserId: matched?.id,
        });
      } else {
        const res = await api.assignCaseOfficer(
          caseItem.id,
          nextName || "Unassigned",
          {
            userId: matched?.id,
            roleInCase: "case_manager",
            fallbackCase: caseItem,
          },
          effectiveUser?.role || activeRole || "master_admin"
        );
        if (res.data) onCaseAssigned?.(res.data);
      }
      setAssignSaved(true);
      setTimeout(() => setAssignSaved(false), 2500);
    } finally {
      setIsAssigning(false);
    }
  };

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

  const handleDeleteCaseClick = async () => {
    if (!caseItem?.id) return;
    const ok = window.confirm(
      `Permanently delete case "${caseItem.case_number}" (${caseItem.title}) along with its documents, tasks, and findings? Retained client profile (${caseItem.client_name || "Unlinked"}) will remain preserved. This action cannot be undone.`
    );
    if (!ok) return;

    if (onDeleteCase) {
      await onDeleteCase(caseItem.id);
    } else if (ws?.handleDeleteCase) {
      await ws.handleDeleteCase(caseItem.id);
    } else {
      await api.deleteCase(caseItem.id, effectiveUser?.role || activeRole || "master_admin");
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
        <div style={{ display: "flex", gap: "10px", width: "100%", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <Button variant="secondary" onClick={onClose} data-testid="drawer-close-btn">
              Close
            </Button>
            {isDeleteCaseAllowed && (
              <Button
                variant="danger"
                data-testid="delete-case-drawer-btn"
                aria-label={`Delete case ${caseItem.case_number}`}
                onClick={handleDeleteCaseClick}
                style={{ background: "#FEF2F2", color: "#DC2626", borderColor: "#FCA5A5" }}
              >
                Delete Case
              </Button>
            )}
            {isDeleteClientAllowed && caseItem.client_id && (
              <Button
                variant="danger"
                data-testid="delete-client-drawer-btn"
                aria-label={`Delete client ${caseItem.client_name || ""}`.trim()}
                onClick={handleDeleteClientClick}
                style={{ background: "#FEF2F2", color: "#DC2626", borderColor: "#FCA5A5" }}
              >
                Delete Client
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
            <span style={{ color: "var(--quiet)", display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", textTransform: "uppercase", marginBottom: "4px" }}>
              <span>Assigned Caseworker</span>
              {assignSaved && (
                <span style={{ color: "#176B50", fontWeight: 700, textTransform: "none", fontSize: "10.5px" }}>
                  ✓ Saved
                </span>
              )}
            </span>
            {isAssignAllowed ? (
              <select
                data-testid="drawer-assign-caseworker-select"
                aria-label={`Assign caseworker to case ${caseItem.case_number}`}
                value={caseItem.assigned_manager && caseItem.assigned_manager !== "Unassigned" ? caseItem.assigned_manager : ""}
                disabled={isAssigning}
                onChange={(e) => void handleDrawerAssignChange(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  borderRadius: "6px",
                  border: "1px solid #B9DED4",
                  background: "#FFFFFF",
                  color: "#063C3D",
                  fontSize: "12.5px",
                  fontWeight: 650,
                  cursor: isAssigning ? "wait" : "pointer",
                }}
              >
                <option value="">Unassigned</option>
                {staffOptions.map((member) => (
                  <option key={member.id || member.name} value={member.name}>
                    {member.name}{member.role ? ` (${member.role})` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <strong>{caseItem.assigned_manager || "Unassigned"}</strong>
            )}
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

        {/* Current Workflow Stage (Canonical 6-Stage Lifecycle) */}
        <div
          data-testid="drawer-canonical-lifecycle"
          style={{
            background: "var(--surface, #ffffff)",
            padding: "16px",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: "8px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ color: "var(--quiet)", fontSize: "11px", textTransform: "uppercase", fontWeight: 700 }}>
              Canonical Case Lifecycle Stage
            </span>
            <Badge variant={stageInfo.badgeVariant} size="sm">
              Step {stageInfo.step} of 6
            </Badge>
          </div>
          <strong style={{ fontSize: "14px", color: "var(--text)" }}>
            {stageInfo.shortLabel}: {stageInfo.label}
          </strong>
          <p style={{ margin: "6px 0 12px", fontSize: "12px", color: "var(--muted)" }}>
            {stageInfo.description}
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "6px",
            }}
          >
            {CANONICAL_6_STAGES.map((stage) => {
              const isCurrent = stage.key === stageInfo.key;
              const isCompleted = stage.step < stageInfo.step;
              return (
                <div
                  key={stage.key}
                  data-testid={`drawer-stage-step-${stage.key}`}
                  style={{
                    padding: "5px 8px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: isCurrent ? 700 : 500,
                    background: isCurrent ? stage.badgeBg : isCompleted ? "#F0FDF4" : "#F8FAF9",
                    color: isCurrent ? stage.badgeColor : isCompleted ? "#166534" : "#64748B",
                    border: `1px solid ${isCurrent ? stage.badgeBorder : isCompleted ? "#BBF7D0" : "#E2E8F0"}`,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {isCompleted ? `✓ ${stage.shortLabel}` : stage.shortLabel}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
