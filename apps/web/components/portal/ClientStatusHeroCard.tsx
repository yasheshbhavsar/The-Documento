import React from "react";
import { ImmigrationCase, UserContext } from "../../lib/types";
import { WaitingStateBanner } from "./WaitingStateBanner";
import { UnassignedClientEmptyState } from "../common/EmptyStates";
import { FALLBACK_WAITING_STATE } from "../../lib/api";
import { getCaseStageInfo } from "../../lib/caseLifecycle";
import { CLIENT_TRANSLATIONS } from "../../lib/clientLocalization";

export interface ClientStatusHeroCardProps {
  myCase: ImmigrationCase | null | undefined;
  currentUser?: UserContext | null;
  firmDisplayName?: string;
  dynamicReadinessPct: number;
  activeMilestoneIndex: number;
  totalMilestones: number;
  activeMilestoneLabel: string;
  isDemoCase?: boolean;
  assignedOfficerName?: string;
  hasAssignedOfficer?: boolean;
  onOpenUploadModal?: () => void;
  onOpenQuestionnaireModal?: () => void;
  onNavigateTab?: (tab: string) => void;
  onOpenOcrStandardsModal?: () => void;
  t?: typeof CLIENT_TRANSLATIONS["en"];
}

export function ClientStatusHeroCard({
  myCase,
  currentUser,
  firmDisplayName = "LexImmigration Law Firm",
  dynamicReadinessPct,
  activeMilestoneIndex,
  totalMilestones,
  activeMilestoneLabel,
  isDemoCase = false,
  assignedOfficerName,
  hasAssignedOfficer = false,
  onOpenUploadModal,
  onOpenQuestionnaireModal,
  onNavigateTab,
  onOpenOcrStandardsModal,
  t = CLIENT_TRANSLATIONS.en,
}: ClientStatusHeroCardProps) {
  // Day-0 / Pending Fallback state when case has not yet been assigned by legal team
  if (!myCase) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <UnassignedClientEmptyState
          clientName={currentUser?.full_name || "Valued Applicant"}
          firmName={firmDisplayName}
          onOpenQuestionnaire={onOpenQuestionnaireModal}
          onOpenOcrFaq={onOpenOcrStandardsModal}
          onOpenProfile={() => onNavigateTab?.("profile")}
        />
        <div
          style={{
            background: "#FFFFFF",
            border: "1px dashed #B9DED4",
            borderRadius: "14px",
            padding: "28px 24px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "32px", marginBottom: "8px" }}>📂</div>
          <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", fontWeight: 750, color: "#063C3D" }}>
            Awaiting Case File Setup by Legal Team
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: "#64748B",
              maxWidth: "560px",
              marginInline: "auto",
              lineHeight: 1.5,
            }}
          >
            Your secure portal account is active. Your legal team (firm Owner or Lead Paralegal) will configure your immigration matter, upload initial petition filings, and assign required checklists. You will be notified as soon as actions are ready.
          </p>
        </div>
      </div>
    );
  }

  // Active Case Presentation
  const stageInfo = getCaseStageInfo(myCase.status);
  const officerDisplay = hasAssignedOfficer && assignedOfficerName
    ? assignedOfficerName
    : myCase.assigned_manager || "Counsel Sarah Jenkins, Esq.";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      {/* Pillar 1 Hero Card */}
      <div
        style={{
          background: "linear-gradient(135deg, #FFFFFF 0%, #F5FAF8 100%)",
          border: "1.5px solid #B9DED4",
          borderRadius: "14px",
          padding: "22px 24px",
          boxShadow: "0 2px 10px rgba(6, 60, 61, 0.04)",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
              <span
                style={{
                  background: "#0D6866",
                  color: "#FFFFFF",
                  fontSize: "10.5px",
                  fontWeight: 700,
                  padding: "2.5px 8px",
                  borderRadius: "4px",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                Pillar 1 • Quick-Glance Status
              </span>
              <span
                style={{
                  background: "#EAF6F0",
                  color: "#176B50",
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "2.5px 8px",
                  borderRadius: "20px",
                  border: "1px solid #B9DED4",
                }}
              >
                {myCase.visa_category}
              </span>
              <span
                style={{
                  fontSize: "11px",
                  color: "#6E7F7C",
                  fontFamily: "monospace",
                }}
              >
                Ref: {myCase.case_number}
              </span>
            </div>

            {/* Plain-language Stage Description */}
            <h2
              style={{
                margin: "4px 0 6px 0",
                fontSize: "18px",
                fontWeight: 750,
                color: "#063C3D",
                lineHeight: 1.35,
              }}
            >
              Your {myCase.visa_category} application is currently in {stageInfo.label}.
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                color: "#445451",
                maxWidth: "680px",
                lineHeight: 1.5,
              }}
            >
              Our legal team is actively assembling your package for government submission. All evidentiary documents and intake questionnaires are reviewed under the supervision of <strong>{officerDisplay}</strong>.
            </p>
          </div>

          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCE5E1",
              borderRadius: "10px",
              padding: "10px 16px",
              textAlign: "right",
              minWidth: "160px",
              boxShadow: "0 1px 3px rgba(6, 60, 61, 0.03)",
            }}
          >
            <div style={{ fontSize: "11px", color: "#6E7F7C", fontWeight: 650, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Application Readiness
            </div>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "#0D6866", marginTop: "2px" }}>
              {dynamicReadinessPct}%
            </div>
            <div style={{ fontSize: "11px", color: "#166534", fontWeight: 600 }}>
              Stage {activeMilestoneIndex} of {totalMilestones}: {stageInfo.label}
            </div>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#063C3D" }}>
              Milestone Progress: {activeMilestoneLabel}
            </span>
            <span style={{ fontSize: "11px", color: "#6E7F7C" }}>
              {dynamicReadinessPct}% Complete
            </span>
          </div>
          <div
            style={{
              width: "100%",
              height: "8px",
              background: "#E2E8F0",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${dynamicReadinessPct}%`,
                height: "100%",
                background: "linear-gradient(90deg, #0D6866 0%, #176B50 100%)",
                borderRadius: "4px",
                transition: "width 0.4s ease",
              }}
            />
          </div>
        </div>
      </div>

      {/* Embedded Next-Action Banner (Dual Breakdown: Waiting on You vs Firm + Primary Action Button) */}
      <WaitingStateBanner
        waitingState={isDemoCase ? FALLBACK_WAITING_STATE : undefined}
        caseId={myCase.id}
        onActionClick={(item) => {
          if (item.type === "document_request") {
            onNavigateTab?.("documents");
          } else if (item.type === "questionnaire") {
            onOpenQuestionnaireModal?.();
          } else {
            onNavigateTab?.("documents");
          }
        }}
      />
    </div>
  );
}
