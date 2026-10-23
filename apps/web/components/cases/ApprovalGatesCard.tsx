import React, { useState } from "react";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import {
  ImmigrationCase,
  RoleCode,
  SubmissionAuthorizationStatus,
  HandoverAuthorizationStatus,
  PreparationStatus,
} from "../../lib/types";
import {
  recordTripartiteAuthorization,
  recordProgressiveReview,
  setSubmissionAuthorization,
  setHandoverAuthorization,
  sendManualReminder,
  sendManualAcknowledgement,
  migrateCaseFirmConfig,
} from "../../lib/api";

interface ApprovalGatesCardProps {
  caseItem: ImmigrationCase;
  activeRole?: RoleCode;
  onCaseUpdated?: (updated: ImmigrationCase) => void;
}

export function ApprovalGatesCard({
  caseItem,
  activeRole = "case_manager",
  onCaseUpdated,
}: ApprovalGatesCardProps) {
  const [currentCase, setCurrentCase] = useState<ImmigrationCase>(caseItem);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Modal States
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [holdType, setHoldType] = useState<"HELD_ACCOUNTS" | "HELD_COUNSELLOR" | "HELD_CLIENT_DECISION">("HELD_ACCOUNTS");
  const [holdReason, setHoldReason] = useState("");

  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);
  const [migrationReason, setMigrationReason] = useState("");

  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [reminderMessage, setReminderMessage] = useState("");

  const [isAckModalOpen, setIsAckModalOpen] = useState(false);
  const [ackMessage, setAckMessage] = useState("");

  // Sync with prop
  React.useEffect(() => {
    setCurrentCase(caseItem);
  }, [caseItem]);

  const isRetained = currentCase.is_retained !== false && currentCase.client_engagement_type !== "consultation" && currentCase.client_engagement_type !== "preliminary_assessment";
  const auths = currentCase.substantive_authorizations || {};
  const mgrCleared = auths.manager_authorization?.authorized || auths.manager_authorization?.cleared;
  const acctCleared = auths.accounts_clearance?.cleared || auths.accounts_clearance?.authorized;
  const counsCleared = auths.counsellor_confirmation?.confirmed || auths.counsellor_confirmation?.cleared;

  const reviews = currentCase.progressive_reviews || {};
  const officerDone = Boolean(
    reviews.officer_initial_review?.completed ||
    ["OFFICER_INITIAL_REVIEW", "SENIOR_REVIEW", "APPROVED", "LAWYER_REVIEW"].includes(currentCase.review_status)
  );
  const seniorDone = Boolean(
    reviews.senior_review?.completed ||
    ["SENIOR_REVIEW", "APPROVED", "LAWYER_REVIEW"].includes(currentCase.review_status)
  );
  const lawyerDone = Boolean(
    reviews.lawyer_review?.completed ||
    ["APPROVED"].includes(currentCase.review_status)
  );

  const subStatus = currentCase.submission_authorization_status || "NOT_REQUESTED";
  const handoverStatus = currentCase.handover_authorization_status || "NOT_REQUESTED";
  const isHeld = subStatus.startsWith("HELD_");

  async function handleTripartiteGate(gateType: string, authorized = true) {
    setLoadingAction(`tripartite-${gateType}`);
    setFeedback(null);
    try {
      const updated = await recordTripartiteAuthorization(
        currentCase.id,
        {
          gate_type: gateType,
          authorized,
          notes: `Cleared by ${activeRole}`,
        },
        activeRole
      );
      setCurrentCase(updated);
      onCaseUpdated?.(updated);
      setFeedback({ type: "success", message: `Tripartite gate '${gateType}' successfully updated.` });
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message || "Failed to update gate." });
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleProgressiveReview(stage: string) {
    setLoadingAction(`review-${stage}`);
    setFeedback(null);
    try {
      const updated = await recordProgressiveReview(
        currentCase.id,
        {
          stage,
          completed: true,
          notes: `Signed off in role: ${activeRole}`,
        },
        activeRole
      );
      setCurrentCase(updated);
      onCaseUpdated?.(updated);
      setFeedback({ type: "success", message: `Progressive review sign-off recorded for '${stage}'.` });
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message || "Failed to record review." });
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleApplySubmissionHold() {
    if (!holdReason || holdReason.trim().length < 5) {
      setFeedback({ type: "error", message: "Hold reason is required (min 5 characters)." });
      return;
    }
    setLoadingAction("submission-hold");
    try {
      const updated = await setSubmissionAuthorization(
        currentCase.id,
        { status: holdType, reason: holdReason.trim() },
        activeRole
      );
      setCurrentCase(updated);
      onCaseUpdated?.(updated);
      setIsHoldModalOpen(false);
      setHoldReason("");
      setFeedback({ type: "success", message: `Submission hold applied: ${holdType}` });
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message || "Failed to apply submission hold." });
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleReleaseSubmissionHold() {
    setLoadingAction("release-hold");
    try {
      const updated = await setSubmissionAuthorization(
        currentCase.id,
        { status: "APPROVED", reason: "Hold conditions resolved by authorized counsel." },
        activeRole
      );
      setCurrentCase(updated);
      onCaseUpdated?.(updated);
      setFeedback({ type: "success", message: "Submission hold released. Case authorized for agency filing." });
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message || "Failed to release hold." });
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleMigrationConfirm() {
    if (!migrationReason || migrationReason.trim().length < 10) {
      setFeedback({ type: "error", message: "Migration rationale must be at least 10 characters." });
      return;
    }
    setLoadingAction("migrate-config");
    try {
      const updated = await migrateCaseFirmConfig(
        currentCase.id,
        { reason: migrationReason.trim() },
        activeRole
      );
      setCurrentCase(updated);
      onCaseUpdated?.(updated);
      setIsMigrationModalOpen(false);
      setMigrationReason("");
      setFeedback({ type: "success", message: `Case successfully migrated to firm configuration snapshot v${updated.firm_config_version}.` });
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message || "Failed to migrate case configuration snapshot." });
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleSendReminder() {
    setLoadingAction("send-reminder");
    try {
      await sendManualReminder(
        currentCase.id,
        { custom_message: reminderMessage || undefined },
        activeRole
      );
      setIsReminderModalOpen(false);
      setReminderMessage("");
      setFeedback({ type: "success", message: "Manual client reminder dispatched successfully." });
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message || "Failed to dispatch reminder." });
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleSendAcknowledgement() {
    setLoadingAction("send-ack");
    try {
      await sendManualAcknowledgement(
        currentCase.id,
        { custom_message: ackMessage || undefined },
        activeRole
      );
      setIsAckModalOpen(false);
      setAckMessage("");
      setFeedback({ type: "success", message: "Client submission acknowledgement dispatched successfully." });
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message || "Failed to dispatch acknowledgement." });
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <Card className="border-[#DCE5E1] shadow-sm space-y-5 p-5" data-testid="approval-gates-card">
      {/* Retained vs Consultation Banner */}
      {!isRetained ? (
        <div className="p-4 bg-[#FFFBEB] border border-[#FCD34D] rounded-xl flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#92400E] text-sm">Non-Retained Prospect: {currentCase.client_engagement_type?.toUpperCase()}</span>
              <Badge variant="warning" size="sm">Preparation Blocked</Badge>
            </div>
            <p className="text-xs text-[#78350F] mt-1 leading-relaxed">
              Initial consultation and preliminary assessment remain strictly separate from retained-client preparation.
              Substantive preparation cannot commence until the prospect executes a retainer agreement and clears onboarding gates.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-[#166534] text-base">🛡️</span>
            <div>
              <span className="font-bold text-xs text-[#166534]">Retained Client Matter</span>
              <p className="text-[11px] text-[#15803D]">Substantive preparation governed by firm approval gates.</p>
            </div>
          </div>
          <Badge variant="success" size="sm">Retained</Badge>
        </div>
      )}

      {/* Migration Notice if Firm Config Update Available */}
      {currentCase.firm_config_update_available && (
        <div className="p-4 bg-gradient-to-r from-[#063C3D] to-[#0D6866] border border-[#145C56] text-white rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="text-teal-200 text-lg">📌</span>
            <div>
              <p className="text-xs font-bold text-white">
                Firm Configuration Update Available (Pinned to v{currentCase.firm_config_version || 1})
              </p>
              <p className="text-[11px] text-teal-100/90">
                Existing cases do not silently inherit configuration changes. Explicit migration with justification is required.
              </p>
            </div>
          </div>
          <Button
            variant="outline-inverted"
            size="sm"
            onClick={() => setIsMigrationModalOpen(true)}
            className="text-xs py-1"
          >
            Migrate Matter
          </Button>
        </div>
      )}

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between shadow-sm ${
            feedback.type === "success"
              ? "bg-emerald-50 border border-emerald-300 text-emerald-900"
              : "bg-rose-50 border border-rose-300 text-rose-900"
          }`}
        >
          <span className="font-medium">{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="font-bold hover:opacity-75 ml-2">✕</button>
        </div>
      )}

      {/* 5 Decoupled Orthogonal State Machines Grid */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-[#063C3D] uppercase tracking-wider">
          5 Decoupled State Machines (Independent Lifecycle Gates)
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
          {/* 1. Payment */}
          <div className="p-3 bg-[#F8FAF9] border border-[#DCE5E1] rounded-xl text-center space-y-1.5 shadow-sm">
            <span className="text-[10px] text-[#526360] font-bold block uppercase tracking-wider">1. Payment Status</span>
            <Badge
              variant={
                currentCase.payment_clearance_status === "PAID"
                  ? "success"
                  : currentCase.payment_clearance_status === "PARTIALLY_PAID"
                  ? "warning"
                  : "neutral"
              }
              size="sm"
            >
              {currentCase.payment_clearance_status || "PENDING"}
            </Badge>
          </div>

          {/* 2. Preparation */}
          <div className="p-3 bg-[#F8FAF9] border border-[#DCE5E1] rounded-xl text-center space-y-1.5 shadow-sm">
            <span className="text-[10px] text-[#526360] font-bold block uppercase tracking-wider">2. Preparation</span>
            <Badge
              variant={
                currentCase.preparation_status === "SUBMITTED"
                  ? "info"
                  : currentCase.preparation_status === "READY_TO_SUBMIT"
                  ? "success"
                  : currentCase.preparation_status === "PREPARATION_IN_PROGRESS"
                  ? "warning"
                  : "neutral"
              }
              size="sm"
            >
              {currentCase.preparation_status || "CLEARANCE_PENDING"}
            </Badge>
          </div>

          {/* 3. Review */}
          <div className="p-3 bg-[#F8FAF9] border border-[#DCE5E1] rounded-xl text-center space-y-1.5 shadow-sm">
            <span className="text-[10px] text-[#526360] font-bold block uppercase tracking-wider">3. Review Status</span>
            <Badge
              variant={
                currentCase.review_status === "APPROVED"
                  ? "success"
                  : currentCase.review_status?.includes("REVIEW")
                  ? "warning"
                  : "neutral"
              }
              size="sm"
            >
              {currentCase.review_status || "NOT_STARTED"}
            </Badge>
          </div>

          {/* 4. Submission Authorization */}
          <div className="p-3 bg-[#F8FAF9] border border-[#DCE5E1] rounded-xl text-center space-y-1.5 shadow-sm">
            <span className="text-[10px] text-[#526360] font-bold block uppercase tracking-wider">4. Submission Auth</span>
            <Badge
              variant={
                subStatus === "APPROVED"
                  ? "success"
                  : isHeld
                  ? "warning"
                  : "neutral"
              }
              size="sm"
            >
              {subStatus}
            </Badge>
          </div>

          {/* 5. Handover Authorization */}
          <div className="p-3 bg-[#F8FAF9] border border-[#DCE5E1] rounded-xl text-center space-y-1.5 shadow-sm">
            <span className="text-[10px] text-[#526360] font-bold block uppercase tracking-wider">5. Handover Auth</span>
            <Badge
              variant={handoverStatus === "APPROVED" || handoverStatus === "COMPLETED" ? "success" : "neutral"}
              size="sm"
            >
              {handoverStatus}
            </Badge>
          </div>
        </div>
      </div>

      {/* Tripartite Onboarding Clearance Gate */}
      <div className="p-4 bg-[#F8FAF9] border border-[#DCE5E1] rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🛡️</span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#063C3D]">
              Tripartite Onboarding Clearance Gate
            </span>
          </div>
          <span className="text-[11px] text-[#526360]">
            All 3 required before substantive preparation begins
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Gate 1: Manager Authorization */}
          <div className={`p-3.5 rounded-lg border flex flex-col justify-between ${
            mgrCleared ? "bg-[#F0FDF4] border-[#86EFAC]" : "bg-white border-[#DCE5E1]"
          }`}>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#063C3D]">1. Manager Authorization</span>
                <span className="text-sm">{mgrCleared ? "✅" : "⏳"}</span>
              </div>
              <p className="text-[11px] text-[#526360] mt-1">Supervising Attorney or Case Manager scope verification</p>
            </div>
            <div className="mt-3">
              {!mgrCleared ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTripartiteGate("manager_authorization")}
                  disabled={loadingAction === "tripartite-manager_authorization"}
                  className="w-full text-xs py-1 text-[#0D6866] border-[#0D6866] hover:bg-[#EAF6F0]"
                >
                  Authorize Manager Gate
                </Button>
              ) : (
                <span className="text-[10px] text-emerald-700 font-mono font-bold">Cleared by {auths.manager_authorization?.actor_name || "Manager"}</span>
              )}
            </div>
          </div>

          {/* Gate 2: Accounts Clearance */}
          <div className={`p-3.5 rounded-lg border flex flex-col justify-between ${
            acctCleared ? "bg-[#F0FDF4] border-[#86EFAC]" : "bg-white border-[#DCE5E1]"
          }`}>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#063C3D]">2. Accounts Clearance</span>
                <span className="text-sm">{acctCleared ? "✅" : "⏳"}</span>
              </div>
              <p className="text-[11px] text-[#526360] mt-1">Retainer billing verification or fee waiver approval</p>
            </div>
            <div className="mt-3">
              {!acctCleared ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTripartiteGate("accounts_clearance")}
                  disabled={loadingAction === "tripartite-accounts_clearance"}
                  className="w-full text-xs py-1 text-[#0D6866] border-[#0D6866] hover:bg-[#EAF6F0]"
                >
                  Clear Accounts Gate
                </Button>
              ) : (
                <span className="text-[10px] text-emerald-700 font-mono font-bold">Cleared / Billing Verified</span>
              )}
            </div>
          </div>

          {/* Gate 3: Counsellor Confirmation */}
          <div className={`p-3.5 rounded-lg border flex flex-col justify-between ${
            counsCleared ? "bg-[#F0FDF4] border-[#86EFAC]" : "bg-white border-[#DCE5E1]"
          }`}>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#063C3D]">3. Counsellor Confirmation</span>
                <span className="text-sm">{counsCleared ? "✅" : "⏳"}</span>
              </div>
              <p className="text-[11px] text-[#526360] mt-1">Intake counsellor client engagement agreement confirmation</p>
            </div>
            <div className="mt-3">
              {!counsCleared ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTripartiteGate("counsellor_confirmation")}
                  disabled={loadingAction === "tripartite-counsellor_confirmation"}
                  className="w-full text-xs py-1 text-[#0D6866] border-[#0D6866] hover:bg-[#EAF6F0]"
                >
                  Confirm Counsellor Gate
                </Button>
              ) : (
                <span className="text-[10px] text-emerald-700 font-mono font-bold">Confirmed by Intake Team</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Progressive Review Stages Stepper */}
      <div className="p-4 bg-[#F8FAF9] border border-[#DCE5E1] rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">⚖️</span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#063C3D]">
              Progressive Review Stages
            </span>
          </div>
          <span className="text-[11px] text-[#526360]">Sequential quality checks prior to filing</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Stage 1: Officer Initial Review */}
          <div className={`p-3.5 rounded-lg border flex flex-col justify-between ${
            officerDone ? "bg-[#F0FDF4] border-[#86EFAC]" : "bg-white border-[#DCE5E1]"
          }`}>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#063C3D]">1. Officer Initial Review</span>
                <span>{officerDone ? "✅" : "⚪"}</span>
              </div>
              <p className="text-[11px] text-[#526360] mt-1">Completeness check of evidence items and mandatory fields</p>
            </div>
            <div className="mt-3">
              {!officerDone ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleProgressiveReview("officer_initial_review")}
                  disabled={loadingAction === "review-officer_initial_review"}
                  className="w-full text-xs py-1"
                >
                  Sign Off Officer Review
                </Button>
              ) : (
                <span className="text-[10px] text-emerald-700 font-mono font-bold">Completed</span>
              )}
            </div>
          </div>

          {/* Stage 2: Senior Review */}
          <div className={`p-3.5 rounded-lg border flex flex-col justify-between ${
            seniorDone ? "bg-[#F0FDF4] border-[#86EFAC]" : "bg-white border-[#DCE5E1]"
          }`}>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#063C3D]">2. Senior Technical Check</span>
                <span>{seniorDone ? "✅" : "⚪"}</span>
              </div>
              <p className="text-[11px] text-[#526360] mt-1">Legal standards alignment and cross-statute consistency</p>
            </div>
            <div className="mt-3">
              {!seniorDone ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleProgressiveReview("senior_review")}
                  disabled={loadingAction === "review-senior_review"}
                  className="w-full text-xs py-1"
                >
                  Sign Off Senior Review
                </Button>
              ) : (
                <span className="text-[10px] text-emerald-700 font-mono font-bold">Completed</span>
              )}
            </div>
          </div>

          {/* Stage 3: Lawyer Review Signoff (Safeguard) */}
          <div className={`p-3.5 rounded-lg border flex flex-col justify-between ${
            lawyerDone ? "bg-[#F0FDF4] border-[#86EFAC]" : "bg-[#FFFBEB] border-[#FCD34D]"
          }`}>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#92400E]">3. Lead Lawyer Sign-Off</span>
                <span>{lawyerDone ? "✅" : "🔒"}</span>
              </div>
              <p className="text-[11px] text-[#78350F] mt-1">Final statutory authorization (Mandatory Safeguard)</p>
            </div>
            <div className="mt-3">
              {!lawyerDone ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleProgressiveReview("lawyer_review")}
                  disabled={loadingAction === "review-lawyer_review"}
                  className="w-full text-xs py-1 bg-amber-600 hover:bg-amber-700 font-semibold"
                >
                  Execute Lawyer Sign-Off
                </Button>
              ) : (
                <span className="text-[10px] text-emerald-700 font-mono font-bold">Approved by Counsel</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Submission Hold Controls (Accounts, Counsellor, Client Decision) */}
      <div className="p-4 bg-[#F8FAF9] border border-[#DCE5E1] rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#063C3D] block">
            Submission Authorization & Hold Controls
          </span>
          <p className="text-xs text-[#526360] mt-0.5">
            Even when ready-to-submit, filings may be held for accounts clearance, counsellor concerns, or client strategic decisions.
          </p>
          {isHeld && (
            <p className="text-xs text-amber-800 font-bold mt-1">
              Active Hold: {subStatus} {currentCase.submission_hold_reason ? `(${currentCase.submission_hold_reason})` : ""}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isHeld ? (
            <Button
              variant="primary"
              size="sm"
              onClick={handleReleaseSubmissionHold}
              disabled={loadingAction === "release-hold"}
              style={{ background: "#059669", borderColor: "#047857" }}
              className="text-xs py-1"
            >
              Release Submission Hold
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsHoldModalOpen(true)}
              className="border-amber-600/50 text-amber-800 hover:bg-amber-50 text-xs py-1"
            >
              Apply Submission Hold
            </Button>
          )}
        </div>
      </div>

      {/* Manual Reminders & Acknowledgements Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-[#EAF0ED] text-xs text-[#526360]">
        <div className="flex items-center gap-4">
          <span>Last Reminder: <strong className="text-[#172322]">{currentCase.last_reminder_sent_at ? new Date(currentCase.last_reminder_sent_at).toLocaleDateString() : "None"}</strong></span>
          <span>Last Acknowledgement: <strong className="text-[#172322]">{currentCase.last_acknowledgement_sent_at ? new Date(currentCase.last_acknowledgement_sent_at).toLocaleDateString() : "None"}</strong></span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsReminderModalOpen(true)}
            className="text-xs py-1"
          >
            ✉️ Send Manual Reminder
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAckModalOpen(true)}
            className="text-xs py-1"
          >
            📨 Send Acknowledgement
          </Button>
        </div>
      </div>

      {/* Hold Modal */}
      {isHoldModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-[#DCE5E1] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#063C3D] flex items-center gap-2">
              <span>🛑</span> Place Submission Hold
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#374744] block mb-1">Hold Type</label>
                <select
                  value={holdType}
                  onChange={(e: any) => setHoldType(e.target.value)}
                  className="w-full bg-white border border-[#DCE5E1] rounded-lg p-2 text-xs text-[#172322] focus:border-[#0D6866] focus:ring-1 focus:ring-[#0D6866] shadow-sm"
                >
                  <option value="HELD_ACCOUNTS">Accounts Concern (Billing / Arrears)</option>
                  <option value="HELD_COUNSELLOR">Counsellor Concern (Intake discrepancy)</option>
                  <option value="HELD_CLIENT_DECISION">Client Decision (Awaiting client instruction)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#374744] block mb-1">Specific Hold Reason *</label>
                <textarea
                  rows={3}
                  className="w-full bg-white border border-[#DCE5E1] rounded-lg p-2.5 text-xs text-[#172322] focus:border-[#0D6866] focus:ring-1 focus:ring-[#0D6866] shadow-sm"
                  placeholder="Detail why this filing cannot proceed to agency dispatch..."
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#EAF0ED]">
              <Button variant="outline" size="sm" onClick={() => setIsHoldModalOpen(false)}>Cancel</Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleApplySubmissionHold}
                className="bg-amber-600 hover:bg-amber-700"
              >
                Confirm Submission Hold
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Migration Modal */}
      {isMigrationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-[#DCE5E1] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#063C3D] flex items-center gap-2">
              <span>📌</span> Migrate Matter to Latest Firm Configuration
            </h3>

            <p className="text-xs text-[#526360]">
              This case is currently pinned to firm config snapshot v{currentCase.firm_config_version || 1}.
              Upgrading this matter to the latest firm release requires explicit professional justification (min 10 characters).
            </p>

            <div>
              <label className="text-xs font-semibold text-[#374744] block mb-1">Migration Justification *</label>
              <textarea
                rows={3}
                className="w-full bg-white border border-[#DCE5E1] rounded-lg p-2.5 text-xs text-[#172322] focus:border-[#0D6866] focus:ring-1 focus:ring-[#0D6866] shadow-sm"
                placeholder="State the reason for updating this case's pinned configuration rules..."
                value={migrationReason}
                onChange={(e) => setMigrationReason(e.target.value)}
              />
              <span className="text-[11px] text-[#526360] mt-1 block">
                {migrationReason.trim().length} / 10 min chars
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#EAF0ED]">
              <Button variant="outline" size="sm" onClick={() => setIsMigrationModalOpen(false)}>Cancel</Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleMigrationConfirm}
                disabled={migrationReason.trim().length < 10}
              >
                Migrate Matter Snapshot
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Reminder Modal */}
      {isReminderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-[#DCE5E1] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#063C3D] flex items-center gap-2">
              <span>✉️</span> Dispatch Manual Client Reminder
            </h3>
            <p className="text-xs text-[#526360]">
              Automated reminders remain active, but you can dispatch an immediate priority notice to the client.
            </p>
            <textarea
              rows={3}
              className="w-full bg-white border border-[#DCE5E1] rounded-lg p-2.5 text-xs text-[#172322] focus:border-[#0D6866] focus:ring-1 focus:ring-[#0D6866] shadow-sm"
              placeholder="Optional custom message override..."
              value={reminderMessage}
              onChange={(e) => setReminderMessage(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-[#EAF0ED]">
              <Button variant="outline" size="sm" onClick={() => setIsReminderModalOpen(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={handleSendReminder}>Dispatch Reminder</Button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Acknowledgement Modal */}
      {isAckModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-[#DCE5E1] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#063C3D] flex items-center gap-2">
              <span>📨</span> Dispatch Formal Acknowledgement
            </h3>
            <p className="text-xs text-[#526360]">
              Formally acknowledge receipt of the client's documents, forms, or retainer confirmation.
            </p>
            <textarea
              rows={3}
              className="w-full bg-white border border-[#DCE5E1] rounded-lg p-2.5 text-xs text-[#172322] focus:border-[#0D6866] focus:ring-1 focus:ring-[#0D6866] shadow-sm"
              placeholder="Optional customized acknowledgement text..."
              value={ackMessage}
              onChange={(e) => setAckMessage(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-[#EAF0ED]">
              <Button variant="outline" size="sm" onClick={() => setIsAckModalOpen(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={handleSendAcknowledgement}>Dispatch Acknowledgement</Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
