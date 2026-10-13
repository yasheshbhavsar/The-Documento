import React from "react";
import { Drawer } from "../common/Drawer";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { ImmigrationCase } from "../../lib/types";

interface CaseDrilldownDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  caseItem: ImmigrationCase | null;
  onOpenWorkspace?: (caseId: string) => void;
  onOpenDetailModal?: (caseItem: ImmigrationCase) => void;
}

export function CaseDrilldownDrawer({
  isOpen,
  onClose,
  caseItem,
  onOpenWorkspace,
  onOpenDetailModal,
}: CaseDrilldownDrawerProps) {
  if (!caseItem) return null;

  const stageLabels: Record<string, string> = {
    intake: "1. Intake & Retainer",
    gathering: "2. Evidence Gathering",
    review: "3. Caseworker Review",
    assembly: "4. Petition Package Assembly",
    ready: "5. Ready for Final Attorney Signoff",
    filed: "6. Filed with Agency",
    approved: "7. Approved",
    rfe: "Request for Evidence (RFE)",
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={caseItem.case_number}
      subtitle={caseItem.title}
      badge={<Badge variant={caseItem.status === "ready" || caseItem.status === "filed" ? "success" : "review"}>{caseItem.status.toUpperCase()}</Badge>}
      footer={
        <div style={{ display: "flex", gap: "10px", width: "100%", justifyContent: "space-between" }}>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <div style={{ display: "flex", gap: "8px" }}>
            {onOpenDetailModal && (
              <Button
                variant="outline"
                onClick={() => {
                  onOpenDetailModal(caseItem);
                  onClose();
                }}
              >
                Full Case Dossier ↗
              </Button>
            )}
            {onOpenWorkspace && (
              <Button
                variant="primary"
                onClick={() => {
                  onOpenWorkspace(caseItem.id);
                  onClose();
                }}
              >
                Open Workspace →
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Urgent Attention Alert if applicable */}
        {caseItem.attention_required && (
          <div
            role="alert"
            style={{
              padding: "12px 16px",
              background: "var(--warning-soft, #fffbeb)",
              border: "1px solid #fde68a",
              borderRadius: "8px",
              color: "var(--warning, #b45309)",
              fontSize: "13px",
              display: "flex",
              gap: "10px",
              alignItems: "flex-start",
            }}
          >
            <span style={{ fontSize: "16px" }}>⚠️</span>
            <div>
              <strong style={{ display: "block", marginBottom: "2px" }}>Owner Attention Flagged</strong>
              <span>{caseItem.attention_reason || "Action required by managing attorney."}</span>
            </div>
          </div>
        )}

        {/* Readiness Meter */}
        <div
          style={{
            background: "var(--surface, #ffffff)",
            padding: "16px",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: "8px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px" }}>
            <strong>Filing Package Readiness Score</strong>
            <span style={{ fontWeight: 750, color: caseItem.readiness_score > 80 ? "var(--success)" : "var(--accent)" }}>
              {caseItem.readiness_score}% Complete
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={caseItem.readiness_score}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Filing Package Readiness Score"
            style={{
              width: "100%",
              height: "8px",
              backgroundColor: "var(--surface-subtle, #F1F6F4)",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${caseItem.readiness_score}%`,
                height: "100%",
                backgroundColor: caseItem.readiness_score > 80 ? "var(--success, #176B50)" : "var(--accent, #0D6866)",
                transition: "width 0.4s ease",
              }}
            />
          </div>
          <small style={{ display: "block", marginTop: "6px", color: "var(--quiet, #6E7F7C)" }}>
            Calculated across statutory evidentiary criteria and mandatory identity records.
          </small>
        </div>

        {/* Case Metadata Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
            gap: "14px",
            background: "var(--surface, #ffffff)",
            padding: "16px",
            border: "1px solid var(--border, #DCE5E1)",
            borderRadius: "8px",
            fontSize: "13px",
          }}
        >
          <div>
            <span style={{ color: "var(--quiet)", display: "block", fontSize: "11px", textTransform: "uppercase" }}>
              Retained Client
            </span>
            <strong style={{ color: "var(--text)" }}>{caseItem.client_name}</strong>
          </div>
          <div>
            <span style={{ color: "var(--quiet)", display: "block", fontSize: "11px", textTransform: "uppercase" }}>
              Assigned Caseworker
            </span>
            <strong style={{ color: "var(--text)" }}>{caseItem.assigned_manager || "Unassigned"}</strong>
          </div>
          <div>
            <span style={{ color: "var(--quiet)", display: "block", fontSize: "11px", textTransform: "uppercase" }}>
              Jurisdiction
            </span>
            <strong style={{ color: "var(--text)" }}>{caseItem.jurisdiction}</strong>
          </div>
          <div>
            <span style={{ color: "var(--quiet)", display: "block", fontSize: "11px", textTransform: "uppercase" }}>
              Pathway / Visa
            </span>
            <strong style={{ color: "var(--text)" }}>{caseItem.visa_category}</strong>
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
          <span style={{ color: "var(--quiet)", display: "block", fontSize: "11px", textTransform: "uppercase", marginBottom: "6px" }}>
            Active Processing Pipeline
          </span>
          <strong style={{ fontSize: "14px", color: "var(--text)" }}>
            {stageLabels[caseItem.status] || caseItem.status}
          </strong>
          <p style={{ margin: "6px 0 0", fontSize: "12px", color: "var(--muted)" }}>
            Subject to multi-tenant server-side authorization. All evidence files stored in private immutable storage.
          </p>
        </div>
      </div>
    </Drawer>
  );
}
