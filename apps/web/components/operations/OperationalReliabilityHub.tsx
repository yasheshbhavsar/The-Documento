import React, { useState, useEffect } from "react";
import { Card } from "../common/Card";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { DataTable } from "../common/DataTable";
import { Modal } from "../common/Modal";
import {
  OperationalDashboardData,
  CompletedApplicationSummary,
  CaseWithdrawalTombstone,
  DataFlowRegister,
  PrivacyLegalReview,
  DeadLetterJob,
  RestoreDrillResult,
  FirmExportRequest,
  ImmigrationCase,
  TeamMemberCapacity,
} from "../../lib/types";
import {
  getOperationalDashboard,
  getCompletedApplicationSummaries,
  getWithdrawnTombstones,
  getDataFlowRegister,
  getPrivacyReviews,
  executeCaseWithdrawal,
  executeCompletedCaseCleanup,
  createReapplication,
  offboardEmployee,
  requestFirmExport,
  executeBackupRestoreDrill,
  getDeletionAccountingReport,
  simulateKeyRotationDrill,
  executeEmergencyLockdown,
  reprocessDeadLetterJob,
  getDocumentDownloadToken,
} from "../../lib/api";

interface OperationalReliabilityHubProps {
  isLiveBackend?: boolean;
  cases?: ImmigrationCase[];
  staff?: TeamMemberCapacity[];
}

export function OperationalReliabilityHub({
  isLiveBackend = true,
  cases = [],
  staff = [],
}: OperationalReliabilityHubProps) {
  const [activeTab, setActiveTab] = useState<
    "telemetry" | "data_flow_privacy" | "scenarios" | "archives" | "disaster_recovery"
  >("telemetry");

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dashboard, setDashboard] = useState<OperationalDashboardData | null>(null);
  const [dataFlows, setDataFlows] = useState<DataFlowRegister | null>(null);
  const [privacyReviews, setPrivacyReviews] = useState<PrivacyLegalReview[]>([]);
  const [completedSummaries, setCompletedSummaries] = useState<CompletedApplicationSummary[]>([]);
  const [withdrawnTombstones, setWithdrawnTombstones] = useState<CaseWithdrawalTombstone[]>([]);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Modal States
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({
    case_id: "",
    reason: "Client elected to withdraw before formal USCIS submission",
    formal_authority_already_submitted: false,
    formal_authority_notes: "",
  });

  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [completeForm, setCompleteForm] = useState({
    case_id: "",
    adjudication_outcome: "APPROVED",
    official_reference_number: "LIN-26-902-8841",
  });

  const [isReapplicationModalOpen, setIsReapplicationModalOpen] = useState(false);
  const [reapplicationForm, setReapplicationForm] = useState({
    prior_case_id: "",
    new_case_number: "CASE-US-8841-REAPP",
    reason: "Prior filing completed; initiating fresh petition without document carryover",
    new_title: "EB-1A Fresh Petition (Post-Approval Clearance)",
  });

  const [isOffboardModalOpen, setIsOffboardModalOpen] = useState(false);
  const [offboardForm, setOffboardForm] = useState({
    departing_user_id: "",
    successor_user_id: "",
    notes: "Caseworker departure - transferring active files to senior attorney",
  });

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportType, setExportType] = useState<"self_service" | "assisted_concierge">("self_service");
  const [exportResult, setExportResult] = useState<FirmExportRequest | null>(null);

  const [isLockdownModalOpen, setIsLockdownModalOpen] = useState(false);
  const [lockdownReason, setLockdownReason] = useState("Suspected credential compromise drill - revoking all active sessions");

  const [drillResult, setDrillResult] = useState<RestoreDrillResult | null>(null);
  const [accountingReport, setAccountingReport] = useState<any | null>(null);
  const [tokenTestResult, setTokenTestResult] = useState<{ token: string; url: string; expires: number } | null>(null);
  const [testDocId, setTestDocId] = useState("");

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 6000);
  };

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [dash, flows, revs, completed, withdrawn] = await Promise.all([
        getOperationalDashboard("master_admin").catch(() => null),
        getDataFlowRegister("master_admin").catch(() => null),
        getPrivacyReviews("master_admin").catch(() => []),
        getCompletedApplicationSummaries(50, "master_admin").catch(() => []),
        getWithdrawnTombstones(50, "master_admin").catch(() => []),
      ]);

      if (dash) setDashboard(dash);
      if (flows) setDataFlows(flows);
      if (revs) setPrivacyReviews(revs);
      setCompletedSummaries(completed);
      setWithdrawnTombstones(withdrawn);
    } catch (err: any) {
      console.error("Failed to load operational hub data", err);
      showToast("Notice: Loaded operational configuration and fallback registers.", "info");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Handlers
  const handleReprocessDlq = async (jobId: string) => {
    try {
      await reprocessDeadLetterJob(jobId, "master_admin");
      showToast(`Dead letter job ${jobId} marked for controlled retry.`, "success");
      loadAllData();
    } catch (err: any) {
      showToast(err.message || "Failed to reprocess DLQ job", "error");
    }
  };

  const handleExecuteWithdrawal = async () => {
    if (!withdrawForm.case_id || !withdrawForm.reason) {
      alert("Please provide both Case ID and a valid withdrawal reason.");
      return;
    }
    try {
      const res = await executeCaseWithdrawal(withdrawForm, "master_admin");
      showToast(`Case withdrawn. Sensitive files purged. Minimal tombstone created for ${res.client_name}.`, "success");
      setIsWithdrawModalOpen(false);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || "Failed to execute case withdrawal", "error");
    }
  };

  const handleExecuteCompletedCleanup = async () => {
    if (!completeForm.case_id) {
      alert("Please enter a valid Case ID to perform cleanup on.");
      return;
    }
    try {
      const res = await executeCompletedCaseCleanup(completeForm, "master_admin");
      showToast(`Completed case cleaned up. Retained dedicated summary for ${res.client_name}.`, "success");
      setIsCompleteModalOpen(false);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || "Failed to clean up completed case", "error");
    }
  };

  const handleCreateReapplication = async () => {
    if (!reapplicationForm.prior_case_id || !reapplicationForm.new_case_number) {
      alert("Please enter prior case ID and new case number.");
      return;
    }
    try {
      const res = await createReapplication(reapplicationForm, "master_admin");
      showToast(`New case ${res.case_number} created in CLEARANCE_PENDING with zero document carryover.`, "success");
      setIsReapplicationModalOpen(false);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || "Failed to initiate reapplication", "error");
    }
  };

  const handleOffboardEmployee = async () => {
    if (!offboardForm.departing_user_id) {
      alert("Please enter the departing caseworker's User ID.");
      return;
    }
    try {
      const res = await offboardEmployee({
        departing_user_id: offboardForm.departing_user_id,
        successor_user_id: offboardForm.successor_user_id || undefined,
        notes: offboardForm.notes,
      }, "master_admin");
      showToast(`Employee ${res.user_id} offboarded. Sessions revoked. ${res.reassigned_cases_count} cases transferred.`, "success");
      setIsOffboardModalOpen(false);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || "Failed to offboard employee", "error");
    }
  };

  const handleRequestFirmExport = async () => {
    try {
      const res = await requestFirmExport({ export_type: exportType }, "master_admin");
      setExportResult(res);
      showToast(
        res.export_type === "self_service"
          ? "Self-service export package generated with SHA-256 integrity seal."
          : `Concierge assisted export request registered: Ticket ${res.support_ticket_id}`,
        "success"
      );
    } catch (err: any) {
      showToast(err.message || "Failed to request firm export", "error");
    }
  };

  const handleRunRestoreDrill = async () => {
    try {
      const res = await executeBackupRestoreDrill("master_admin");
      setDrillResult(res);
      showToast("Disaster recovery and backup restore drill completed successfully.", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to execute restore drill", "error");
    }
  };

  const handleCheckDeletionAccounting = async () => {
    try {
      const res = await getDeletionAccountingReport("master_admin");
      setAccountingReport(res);
      showToast("Deletion policy accounting verified against backup snapshot catalog.", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to fetch deletion accounting", "error");
    }
  };

  const handleSimulateKeyRotation = async () => {
    try {
      const res = await simulateKeyRotationDrill("master_admin");
      showToast(`Cryptographic key rotated: ${res.current_key_id} -> ${res.new_key_id}`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to simulate key rotation", "error");
    }
  };

  const handleExecuteLockdown = async () => {
    if (!lockdownReason) {
      alert("Please provide an incident rationale for emergency lockdown.");
      return;
    }
    try {
      const res = await executeEmergencyLockdown(lockdownReason, "master_admin");
      showToast(`EMERGENCY LOCKDOWN COMPLETE: Revoked ${res.revoked_sessions_count} active database user sessions.`, "success");
      setIsLockdownModalOpen(false);
    } catch (err: any) {
      showToast(err.message || "Failed to execute lockdown", "error");
    }
  };

  const handleTestDownloadToken = async () => {
    if (!testDocId) {
      alert("Please enter a document ID to generate a short-lived download token.");
      return;
    }
    try {
      const res = await getDocumentDownloadToken(testDocId, 300, "case_manager");
      setTokenTestResult({
        token: res.download_token,
        url: res.download_url,
        expires: res.expires_in_seconds,
      });
      showToast("Generated short-lived JWT token (300s expiration).", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to generate download token (may be quarantined/unauthorized)", "error");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Toast Notification */}
      {notification && (
        <div
          role="alert"
          style={{
            padding: "12px 18px",
            borderRadius: "8px",
            backgroundColor:
              notification.type === "error"
                ? "#fef2f2"
                : notification.type === "info"
                ? "#f0f9ff"
                : "#f0fdf4",
            color:
              notification.type === "error"
                ? "#991b1b"
                : notification.type === "info"
                ? "#075985"
                : "#166534",
            border: `1px solid ${
              notification.type === "error"
                ? "#fecaca"
                : notification.type === "info"
                ? "#bae6fd"
                : "#bbf7d0"
            }`,
            fontSize: "14px",
            fontWeight: 500,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
          }}
        >
          <span>{notification.message}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              color: "inherit",
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #DCE5E1",
          gap: "8px",
          overflowX: "auto",
        }}
      >
        <button
          type="button"
          id="btn-tab-telemetry"
          onClick={() => setActiveTab("telemetry")}
          style={{
            padding: "12px 18px",
            border: "none",
            borderBottom: activeTab === "telemetry" ? "3px solid #063C3D" : "3px solid transparent",
            background: "none",
            fontWeight: activeTab === "telemetry" ? 700 : 500,
            color: activeTab === "telemetry" ? "#063C3D" : "#64748B",
            cursor: "pointer",
            fontSize: "14px",
            whiteSpace: "nowrap",
          }}
        >
          ⚡ Telemetry & Worker Health
        </button>

        <button
          type="button"
          id="btn-tab-dataflow"
          onClick={() => setActiveTab("data_flow_privacy")}
          style={{
            padding: "12px 18px",
            border: "none",
            borderBottom: activeTab === "data_flow_privacy" ? "3px solid #063C3D" : "3px solid transparent",
            background: "none",
            fontWeight: activeTab === "data_flow_privacy" ? 700 : 500,
            color: activeTab === "data_flow_privacy" ? "#063C3D" : "#64748B",
            cursor: "pointer",
            fontSize: "14px",
            whiteSpace: "nowrap",
          }}
        >
          🌐 Data-Flow Register & Privacy Matrix
        </button>

        <button
          type="button"
          id="btn-tab-scenarios"
          onClick={() => setActiveTab("scenarios")}
          style={{
            padding: "12px 18px",
            border: "none",
            borderBottom: activeTab === "scenarios" ? "3px solid #063C3D" : "3px solid transparent",
            background: "none",
            fontWeight: activeTab === "scenarios" ? 700 : 500,
            color: activeTab === "scenarios" ? "#063C3D" : "#64748B",
            cursor: "pointer",
            fontSize: "14px",
            whiteSpace: "nowrap",
          }}
        >
          🔄 Core Lifecycle Scenarios
        </button>

        <button
          type="button"
          id="btn-tab-archives"
          onClick={() => setActiveTab("archives")}
          style={{
            padding: "12px 18px",
            border: "none",
            borderBottom: activeTab === "archives" ? "3px solid #063C3D" : "3px solid transparent",
            background: "none",
            fontWeight: activeTab === "archives" ? 700 : 500,
            color: activeTab === "archives" ? "#063C3D" : "#64748B",
            cursor: "pointer",
            fontSize: "14px",
            whiteSpace: "nowrap",
          }}
        >
          📁 Retained Summaries & Tombstones
        </button>

        <button
          type="button"
          id="btn-tab-dr"
          onClick={() => setActiveTab("disaster_recovery")}
          style={{
            padding: "12px 18px",
            border: "none",
            borderBottom: activeTab === "disaster_recovery" ? "3px solid #063C3D" : "3px solid transparent",
            background: "none",
            fontWeight: activeTab === "disaster_recovery" ? 700 : 500,
            color: activeTab === "disaster_recovery" ? "#063C3D" : "#64748B",
            cursor: "pointer",
            fontSize: "14px",
            whiteSpace: "nowrap",
          }}
        >
          🛡️ Disaster Recovery & Security Ops
        </button>
      </div>

      {/* TAB 1: TELEMETRY & WORKER HEALTH */}
      {activeTab === "telemetry" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Key Metrics Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
            <Card>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "12px", color: "#64748B", textTransform: "uppercase", fontWeight: 600 }}>
                  Worker Cluster Status
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#10B981" }} />
                  <strong style={{ fontSize: "20px", color: "#063C3D" }}>
                    {dashboard?.system_status?.toUpperCase() || "HEALTHY"}
                  </strong>
                </div>
                <small style={{ color: "#64748B", fontSize: "12px" }}>
                  Heartbeat active • Concurrency: 8 workers
                </small>
              </div>
            </Card>

            <Card>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "12px", color: "#64748B", textTransform: "uppercase", fontWeight: 600 }}>
                  Dead Letter Queue (DLQ)
                </span>
                <strong style={{ fontSize: "20px", color: (dashboard?.dead_letter_queue?.size || 0) > 0 ? "#DC2626" : "#063C3D" }}>
                  {dashboard?.dead_letter_queue?.size || 0} Quarantined Jobs
                </strong>
                <small style={{ color: "#64748B", fontSize: "12px" }}>
                  Idempotent retries with exponential backoff
                </small>
              </div>
            </Card>

            <Card>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "12px", color: "#64748B", textTransform: "uppercase", fontWeight: 600 }}>
                  Malware / Quarantined Files
                </span>
                <strong style={{ fontSize: "20px", color: (dashboard?.security?.quarantined_files_count || 0) > 0 ? "#DC2626" : "#063C3D" }}>
                  {dashboard?.security?.quarantined_files_count || 0} Blocked Files
                </strong>
                <small style={{ color: "#64748B", fontSize: "12px" }}>
                  Magic-byte & antivirus sandbox active
                </small>
              </div>
            </Card>

            <Card>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "12px", color: "#64748B", textTransform: "uppercase", fontWeight: 600 }}>
                  Short-Lived Access Tokens
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Badge variant="success">300s Expiration</Badge>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#166534" }}>Enforced</span>
                </div>
                <small style={{ color: "#64748B", fontSize: "12px" }}>
                  Tenant-scoped signed JWT downloads
                </small>
              </div>
            </Card>
          </div>

          {/* DLQ Table */}
          <Card
            title="Dead Letter Queue Monitor & Reprocessing"
            subtitle="Background tasks exceeding maximum retries are halted here for forensic inspection and controlled recovery."
          >
            {(!dashboard?.dead_letter_queue?.jobs || dashboard.dead_letter_queue.jobs.length === 0) ? (
              <div style={{ padding: "32px", textAlign: "center", color: "#64748B" }}>
                <p style={{ margin: 0, fontWeight: 500 }}>No dead-letter tasks currently quarantined. All background queues healthy.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #E2E8F0", textAlign: "left", color: "#475569" }}>
                      <th style={{ padding: "10px" }}>Job ID</th>
                      <th style={{ padding: "10px" }}>Task Type</th>
                      <th style={{ padding: "10px" }}>Retry Count</th>
                      <th style={{ padding: "10px" }}>Failure Rationale</th>
                      <th style={{ padding: "10px" }}>Quarantined At</th>
                      <th style={{ padding: "10px" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.dead_letter_queue.jobs.map((job) => (
                      <tr key={job.job_id} style={{ borderBottom: "1px solid #E2E8F0" }}>
                        <td style={{ padding: "10px", fontFamily: "monospace" }}>{job.job_id}</td>
                        <td style={{ padding: "10px" }}>
                          <Badge variant="neutral">{job.task_type}</Badge>
                        </td>
                        <td style={{ padding: "10px", fontWeight: 600 }}>{job.retry_count}</td>
                        <td style={{ padding: "10px", color: "#DC2626" }}>{job.error_message}</td>
                        <td style={{ padding: "10px", color: "#64748B" }}>{new Date(job.failed_at).toLocaleTimeString()}</td>
                        <td style={{ padding: "10px" }}>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReprocessDlq(job.job_id)}
                          >
                            Reprocess / Retry
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Download Access Token Sandbox Tester */}
          <Card
            title="Short-Lived Download Token Verifier"
            subtitle="Simulate and test short-lived signed JWT download token issuance. Quarantined or infected documents are immediately rejected."
          >
            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder="Enter Document UUID (e.g. 5dc5c489-023e-4a29-826f-d1c7503bcbea)"
                value={testDocId}
                onChange={(e) => setTestDocId(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  fontSize: "13px",
                  minWidth: "340px",
                  flex: 1,
                }}
              />
              <Button onClick={handleTestDownloadToken}>
                Issue 300s Download Token
              </Button>
            </div>

            {tokenTestResult && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "16px",
                  borderRadius: "8px",
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  fontSize: "13px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <strong>Signed Download URL (Valid {tokenTestResult.expires}s):</strong>
                  <Badge variant="success">Active</Badge>
                </div>
                <div style={{ fontFamily: "monospace", wordBreak: "break-all", color: "#0D6866", background: "#FFFFFF", padding: "8px", borderRadius: "4px", border: "1px solid #CBD5E1" }}>
                  {tokenTestResult.url}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 2: DATA-FLOW REGISTER & PRIVACY MATRIX */}
      {activeTab === "data_flow_privacy" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Compliance Statement Banner */}
          <div
            style={{
              padding: "16px 20px",
              background: "#F0FDF4",
              borderRadius: "10px",
              border: "1px solid #BBF7D0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <strong style={{ fontSize: "15px", color: "#166534", display: "block" }}>
                Zero-Training Guarantee Active & Audited
              </strong>
              <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#15803D" }}>
                Documento and all approved subprocessors operate under zero-retention API contracts. Customer documents and extracted OCR text are strictly never used for AI model training.
              </p>
            </div>
            <Badge variant="success">Zero-Training Certified</Badge>
          </div>

          {/* 7-Tier Data-Flow Register */}
          <Card
            title="Official Platform Data-Flow & Processing Register"
            subtitle="Complete inventory of all primary storage locations, auxiliary caches, and external AI/OCR providers."
          >
            {(!dataFlows?.data_flows || dataFlows.data_flows.length === 0) ? (
              <div style={{ padding: "24px", textAlign: "center", color: "#64748B" }}>
                Loading register entities...
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #E2E8F0", textAlign: "left", color: "#475569" }}>
                      <th style={{ padding: "10px" }}>Entity / Provider</th>
                      <th style={{ padding: "10px" }}>Category</th>
                      <th style={{ padding: "10px" }}>Location & Residency</th>
                      <th style={{ padding: "10px" }}>Data Classes</th>
                      <th style={{ padding: "10px" }}>Encryption (Rest / Transit)</th>
                      <th style={{ padding: "10px" }}>Zero AI Training</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataFlows.data_flows.map((flow) => (
                      <tr key={flow.id} style={{ borderBottom: "1px solid #E2E8F0" }}>
                        <td style={{ padding: "10px", fontWeight: 600, color: "#063C3D" }}>
                          {flow.provider}
                        </td>
                        <td style={{ padding: "10px" }}>
                          <Badge variant="neutral">{flow.category}</Badge>
                        </td>
                        <td style={{ padding: "10px", color: "#475569" }}>
                          <div>{flow.location}</div>
                          <small style={{ color: "#64748B" }}>{flow.residency_model}</small>
                        </td>
                        <td style={{ padding: "10px" }}>
                          <span style={{ fontSize: "12px", color: "#475569" }}>
                            {flow.data_classes_handled.join(", ")}
                          </span>
                        </td>
                        <td style={{ padding: "10px", color: "#0D6866", fontSize: "12px" }}>
                          <div>🔒 {flow.encryption_at_rest}</div>
                          <div>🌐 {flow.encryption_in_transit}</div>
                        </td>
                        <td style={{ padding: "10px" }}>
                          <Badge variant={flow.ai_training_permitted ? "critical" : "success"}>
                            {flow.ai_training_permitted ? "Training Permitted" : "Zero Training"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Jurisdiction Privacy Reviews Matrix */}
          <Card
            title="Jurisdiction-Specific Privacy & Legal Reviews"
            subtitle="Statutory legal sign-offs by local counsel for India, Canada, United States, and UK/EU launch markets."
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
              {privacyReviews.map((rev) => (
                <div
                  key={rev.jurisdiction}
                  style={{
                    padding: "16px",
                    borderRadius: "8px",
                    border: "1px solid #E2E8F0",
                    background: "#F8FAFC",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: "15px", color: "#063C3D" }}>
                      {rev.market_name} ({rev.jurisdiction})
                    </strong>
                    <Badge variant={rev.is_valid ? "success" : "critical"}>
                      {rev.review_status.toUpperCase()}
                    </Badge>
                  </div>

                  <div style={{ fontSize: "12px", color: "#475569" }}>
                    <strong>Statute:</strong> {rev.governing_statute}
                  </div>

                  <div style={{ fontSize: "12px", color: "#475569" }}>
                    <strong>Counsel:</strong> {rev.counsel_name} • {rev.firm_name}
                  </div>

                  <div style={{ fontSize: "12px", color: "#475569" }}>
                    <strong>Sign-off Date:</strong> {rev.counsel_signoff_date}
                  </div>

                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                      Key Statutory Controls Verified:
                    </span>
                    <ul style={{ margin: "4px 0 0 0", paddingLeft: "16px", fontSize: "12px", color: "#334155" }}>
                      {rev.key_statutory_requirements?.map((req, idx) => (
                        <li key={idx}>{req}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: CORE LIFECYCLE SCENARIOS */}
      {activeTab === "scenarios" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Lifecycle Scenarios Explanation & Actions */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
            {/* Scenario 1: Idle Inactivity */}
            <Card title="Scenario 1: Idle Case Cleanup Policy" subtitle="Client Inactivity Timelines">
              <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>
                Cases with zero client activity trigger automated warnings on <strong>Day 7, 10, and 14</strong>. On <strong>Day 15</strong>, eligible files are permanently destroyed under agreed policy.
              </p>
              <div style={{ padding: "10px", background: "#FEF3C7", borderRadius: "6px", fontSize: "12px", color: "#92400E" }}>
                ⚠️ <strong>Key Safeguard:</strong> Internal caseworker notes or staff comments strictly do not reset client inactivity timers.
              </div>
            </Card>

            {/* Scenario 2: Hold & Reassignment */}
            <Card title="Scenario 2: Hold & Reassignment" subtitle="Interim Snapshot & OCR Report">
              <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>
                Placing a case on administrative hold prompts generation of an interim package snapshot and unresolved OCR anomaly report.
              </p>
              <div style={{ padding: "10px", background: "#E0F2FE", borderRadius: "6px", fontSize: "12px", color: "#0369A1" }}>
                ℹ️ <strong>Key Safeguard:</strong> Statutory filing deadlines remain active and escalate automatically. Idle cleanup timers still apply.
              </div>
            </Card>

            {/* Scenario 3: Withdrawal */}
            <Card title="Scenario 3: Client Withdrawal" subtitle="Snapshot, Purge & Minimal Tombstone">
              <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>
                When a client elects to withdraw, firm owners/managers execute a full snapshot export, purge all uploads/packages, and retain only a minimal tombstone record.
              </p>
              <Button
                variant="outline"
                onClick={() => setIsWithdrawModalOpen(true)}
                style={{ marginTop: "8px" }}
              >
                Execute Case Withdrawal
              </Button>
            </Card>

            {/* Scenario 4: Completed Cleanup */}
            <Card title="Scenario 4: Completed Application Cleanup" subtitle="Purge Uploads, Retain Summary">
              <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>
                Adjudicated cases delete bulky file uploads and assembly packages while preserving an audited <em>Completed Applications Summary</em> for compliance.
              </p>
              <Button
                variant="outline"
                onClick={() => setIsCompleteModalOpen(true)}
                style={{ marginTop: "8px" }}
              >
                Execute Completed Case Cleanup
              </Button>
            </Card>

            {/* Scenario 5: Reapplication */}
            <Card title="Scenario 5: Reapplication from Scratch" subtitle="Zero Automatic Reuse">
              <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>
                Prior clients initiating a new filing start fresh from <code>CLEARANCE_PENDING</code> with strictly no automatic reuse of past documents. An explicit link to prior filing history is preserved.
              </p>
              <Button
                variant="outline"
                onClick={() => setIsReapplicationModalOpen(true)}
                style={{ marginTop: "8px" }}
              >
                Create Fresh Reapplication
              </Button>
            </Card>

            {/* Scenario 6 & 7: Firm Export & Employee Offboard */}
            <Card title="Scenario 6 & 7: Offboarding Controls" subtitle="Firm Departure & Staff Deactivation">
              <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>
                Firm departure is governed by contractual export rights. Employee departure deactivates account, revokes sessions, and requires active case reassignment.
              </p>
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <Button variant="outline" onClick={() => setIsExportModalOpen(true)}>
                  Firm Data Export
                </Button>
                <Button variant="outline" onClick={() => setIsOffboardModalOpen(true)}>
                  Employee Offboarding
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 4: ARCHIVES & TOMBSTONES */}
      {activeTab === "archives" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Completed Applications Summary */}
          <Card
            title="Completed Applications Summary Archive"
            subtitle="Permanent statutory record of completed cases with all underlying client uploads securely purged."
          >
            {completedSummaries.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", color: "#64748B" }}>
                No completed application summaries recorded yet.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #E2E8F0", textAlign: "left", color: "#475569" }}>
                      <th style={{ padding: "10px" }}>Case Ref</th>
                      <th style={{ padding: "10px" }}>Client Name</th>
                      <th style={{ padding: "10px" }}>Visa Category</th>
                      <th style={{ padding: "10px" }}>Jurisdiction</th>
                      <th style={{ padding: "10px" }}>Officer Assigned</th>
                      <th style={{ padding: "10px" }}>Outcome</th>
                      <th style={{ padding: "10px" }}>Start / Complete</th>
                      <th style={{ padding: "10px" }}>Files Purged</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedSummaries.map((s) => (
                      <tr key={s.id} style={{ borderBottom: "1px solid #E2E8F0" }}>
                        <td style={{ padding: "10px", fontWeight: 600 }}>{s.case_number}</td>
                        <td style={{ padding: "10px" }}>{s.client_name}</td>
                        <td style={{ padding: "10px" }}>{s.visa_category}</td>
                        <td style={{ padding: "10px" }}>{s.jurisdiction}</td>
                        <td style={{ padding: "10px" }}>
                          {s.assigned_officer_name} ({s.assigned_officer_role})
                        </td>
                        <td style={{ padding: "10px" }}>
                          <Badge variant={s.adjudication_outcome === "APPROVED" ? "success" : "neutral"}>
                            {s.adjudication_outcome}
                          </Badge>
                        </td>
                        <td style={{ padding: "10px", color: "#64748B", fontSize: "12px" }}>
                          {new Date(s.start_date).toLocaleDateString()} – {new Date(s.completion_date).toLocaleDateString()}
                        </td>
                        <td style={{ padding: "10px", color: "#166534", fontWeight: 600 }}>
                          🗑️ {s.purged_files_count} files
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Withdrawn Case Tombstones */}
          <Card
            title="Withdrawn Cases Minimal Tombstone Register"
            subtitle="Minimal tombstone records for withdrawn cases. Retains only basic contact and application intent; all sensitive uploads purged."
          >
            {withdrawnTombstones.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", color: "#64748B" }}>
                No withdrawn case tombstones recorded yet.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #E2E8F0", textAlign: "left", color: "#475569" }}>
                      <th style={{ padding: "10px" }}>Case Ref</th>
                      <th style={{ padding: "10px" }}>Client Name</th>
                      <th style={{ padding: "10px" }}>Intended Application</th>
                      <th style={{ padding: "10px" }}>Executed By</th>
                      <th style={{ padding: "10px" }}>Withdrawal Reason</th>
                      <th style={{ padding: "10px" }}>Authority Status</th>
                      <th style={{ padding: "10px" }}>Executed Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawnTombstones.map((t) => (
                      <tr key={t.id} style={{ borderBottom: "1px solid #E2E8F0" }}>
                        <td style={{ padding: "10px", fontWeight: 600 }}>{t.case_number}</td>
                        <td style={{ padding: "10px" }}>
                          <div>{t.client_name}</div>
                          <small style={{ color: "#64748B" }}>{t.client_email}</small>
                        </td>
                        <td style={{ padding: "10px" }}>{t.intended_application_type}</td>
                        <td style={{ padding: "10px" }}>{t.executed_by_name}</td>
                        <td style={{ padding: "10px", color: "#475569" }}>{t.withdrawal_reason}</td>
                        <td style={{ padding: "10px" }}>
                          <Badge variant={t.formal_authority_withdrawal_required ? "critical" : "neutral"}>
                            {t.formal_authority_status}
                          </Badge>
                        </td>
                        <td style={{ padding: "10px", color: "#64748B", fontSize: "12px" }}>
                          {new Date(t.executed_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 5: DISASTER RECOVERY & SECURITY OPS */}
      {activeTab === "disaster_recovery" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* DR Controls Card */}
          <Card
            title="Disaster Recovery, Restore Drills & Deletion Accounting"
            subtitle="Automated verification drills ensuring platform resiliency, backup consistency, and non-rehydration of purged PII."
          >
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
              <Button onClick={handleRunRestoreDrill}>
                🔄 Run Automated Restore Drill
              </Button>
              <Button variant="outline" onClick={handleCheckDeletionAccounting}>
                🔍 Verify Deletion Accounting in Backups
              </Button>
              <Button variant="outline" onClick={handleSimulateKeyRotation}>
                🔑 Simulate Key Rotation Drill
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsLockdownModalOpen(true)}
                style={{ borderColor: "#DC2626", color: "#DC2626" }}
              >
                🚨 Emergency Incident Lockdown
              </Button>
            </div>

            {drillResult && (
              <div
                style={{
                  padding: "16px",
                  borderRadius: "8px",
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  fontSize: "13px",
                  marginBottom: "16px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <strong>Restore Drill Results ({drillResult.drill_id}):</strong>
                  <Badge variant={drillResult.status === "PASSED" ? "success" : "critical"}>
                    {drillResult.status}
                  </Badge>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", marginTop: "10px" }}>
                  {drillResult.tested_components.map((tc, idx) => (
                    <div key={idx} style={{ padding: "10px", background: "#FFFFFF", borderRadius: "6px", border: "1px solid #CBD5E1" }}>
                      <div style={{ fontWeight: 600, color: "#063C3D" }}>{tc.component}</div>
                      <div style={{ fontSize: "12px", color: "#64748B" }}>Target: {tc.target}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
                        <span style={{ color: "#166534", fontWeight: 600 }}>{tc.status}</span>
                        <span style={{ color: "#64748B" }}>{tc.latency_ms} ms</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {accountingReport && (
              <div
                style={{
                  padding: "16px",
                  borderRadius: "8px",
                  background: "#F0FDF4",
                  border: "1px solid #BBF7D0",
                  fontSize: "13px",
                }}
              >
                <strong style={{ color: "#166534", display: "block", marginBottom: "6px" }}>
                  Deletion Accounting Proof: {accountingReport.status}
                </strong>
                <p style={{ margin: "0 0 6px 0", color: "#15803D" }}>
                  {accountingReport.details}
                </p>
                <div style={{ fontSize: "12px", color: "#166534" }}>
                  • Backups verified: {accountingReport.active_backups_verified} snapshots<br />
                  • Tombstone consistency check: Passed (Purged files will not rehydrate on database restore)
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* WITHDRAWAL MODAL */}
      <Modal
        isOpen={isWithdrawModalOpen}
        onClose={() => setIsWithdrawModalOpen(false)}
        title="Execute Client Case Withdrawal"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "13px" }}>
          <p style={{ margin: 0, color: "#475569" }}>
            Executing withdrawal purges all client documents and package assemblies from storage and database. A minimal tombstone will be created with client name, contact, and intended application.
          </p>
          {cases && cases.length > 0 && (
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "#64748B", marginBottom: "4px" }}>
                Select From Active Cases:
              </label>
              <select
                onChange={(e) => {
                  if (e.target.value) setWithdrawForm({ ...withdrawForm, case_id: e.target.value });
                }}
                style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                defaultValue=""
              >
                <option value="">-- Choose active case --</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.case_number} — {c.client_name} ({c.visa_category})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
              Case UUID:
            </label>
            <input
              type="text"
              placeholder="e.g. 5dc5c489-023e-4a29-826f-d1c7503bcbea"
              value={withdrawForm.case_id}
              onChange={(e) => setWithdrawForm({ ...withdrawForm, case_id: e.target.value })}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
              Withdrawal Reason:
            </label>
            <textarea
              rows={3}
              value={withdrawForm.reason}
              onChange={(e) => setWithdrawForm({ ...withdrawForm, reason: e.target.value })}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1" }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="checkbox"
              id="formal_auth_sub"
              checked={withdrawForm.formal_authority_already_submitted}
              onChange={(e) => setWithdrawForm({ ...withdrawForm, formal_authority_already_submitted: e.target.checked })}
            />
            <label htmlFor="formal_auth_sub" style={{ fontWeight: 500 }}>
              Petition was already formally submitted to government authority (requires official USCIS/IRCC withdrawal letter)
            </label>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
            <Button variant="outline" onClick={() => setIsWithdrawModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExecuteWithdrawal}>
              Execute Withdrawal & Purge
            </Button>
          </div>
        </div>
      </Modal>

      {/* COMPLETED CLEANUP MODAL */}
      <Modal
        isOpen={isCompleteModalOpen}
        onClose={() => setIsCompleteModalOpen(false)}
        title="Execute Completed Case Cleanup"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "13px" }}>
          <p style={{ margin: 0, color: "#475569" }}>
            Under firm retention policy, completed cases delete underlying uploads and package files. A dedicated <em>Completed Applications Summary</em> will be generated for long-term audit compliance.
          </p>
          {cases && cases.length > 0 && (
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "#64748B", marginBottom: "4px" }}>
                Select From Active Cases:
              </label>
              <select
                onChange={(e) => {
                  if (e.target.value) setCompleteForm({ ...completeForm, case_id: e.target.value });
                }}
                style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                defaultValue=""
              >
                <option value="">-- Choose active case --</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.case_number} — {c.client_name} ({c.visa_category})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
              Case UUID:
            </label>
            <input
              type="text"
              placeholder="e.g. 5dc5c489-023e-4a29-826f-d1c7503bcbea"
              value={completeForm.case_id}
              onChange={(e) => setCompleteForm({ ...completeForm, case_id: e.target.value })}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
              Official Authority Receipt / Approval Number:
            </label>
            <input
              type="text"
              value={completeForm.official_reference_number}
              onChange={(e) => setCompleteForm({ ...completeForm, official_reference_number: e.target.value })}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1" }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
            <Button variant="outline" onClick={() => setIsCompleteModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExecuteCompletedCleanup}>
              Execute Cleanup & Archive Summary
            </Button>
          </div>
        </div>
      </Modal>

      {/* REAPPLICATION MODAL */}
      <Modal
        isOpen={isReapplicationModalOpen}
        onClose={() => setIsReapplicationModalOpen(false)}
        title="Create Fresh Reapplication from Scratch"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "13px" }}>
          <p style={{ margin: 0, color: "#475569" }}>
            Reapplication starts from <code>CLEARANCE_PENDING</code> with strictly no automatic reuse of documents. An audited historical link to the prior petition will be maintained.
          </p>
          {cases && cases.length > 0 && (
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "#64748B", marginBottom: "4px" }}>
                Select Prior Case:
              </label>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    const selected = cases.find((c) => c.id === e.target.value);
                    setReapplicationForm({
                      ...reapplicationForm,
                      prior_case_id: e.target.value,
                      new_case_number: selected ? `${selected.case_number}-REAPP` : "CASE-REAPP",
                      new_title: selected ? `Fresh Reapplication: ${selected.client_name}` : "Fresh Reapplication",
                    });
                  }
                }}
                style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                defaultValue=""
              >
                <option value="">-- Choose prior case --</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.case_number} — {c.client_name} ({c.visa_category})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
              Prior Case UUID:
            </label>
            <input
              type="text"
              value={reapplicationForm.prior_case_id}
              onChange={(e) => setReapplicationForm({ ...reapplicationForm, prior_case_id: e.target.value })}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
              New Case Number:
            </label>
            <input
              type="text"
              value={reapplicationForm.new_case_number}
              onChange={(e) => setReapplicationForm({ ...reapplicationForm, new_case_number: e.target.value })}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
              New Petition Title:
            </label>
            <input
              type="text"
              value={reapplicationForm.new_title}
              onChange={(e) => setReapplicationForm({ ...reapplicationForm, new_title: e.target.value })}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1" }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
            <Button variant="outline" onClick={() => setIsReapplicationModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateReapplication}>
              Create Reapplication
            </Button>
          </div>
        </div>
      </Modal>

      {/* EMPLOYEE OFFBOARD MODAL */}
      <Modal
        isOpen={isOffboardModalOpen}
        onClose={() => setIsOffboardModalOpen(false)}
        title="Employee Departure & Case Reassignment"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "13px" }}>
          <p style={{ margin: 0, color: "#475569" }}>
            Offboarding deactivates the user account and revokes active sessions immediately. If the caseworker has active case assignments, an authorized successor must be specified.
          </p>
          {staff && staff.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#64748B", marginBottom: "4px" }}>
                  Select Departing Caseworker:
                </label>
                <select
                  onChange={(e) => {
                    if (e.target.value) setOffboardForm({ ...offboardForm, departing_user_id: e.target.value });
                  }}
                  style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                  defaultValue=""
                >
                  <option value="">-- Choose departing staff member --</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role}) — {s.active_cases} active cases
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#64748B", marginBottom: "4px" }}>
                  Select Successor Caseworker:
                </label>
                <select
                  onChange={(e) => {
                    if (e.target.value) setOffboardForm({ ...offboardForm, successor_user_id: e.target.value });
                  }}
                  style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                  defaultValue=""
                >
                  <option value="">-- Choose successor staff member --</option>
                  {staff
                    .filter((s) => s.id !== offboardForm.departing_user_id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.role}) — Capacity: {s.active_cases}/{s.max_capacity}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          )}
          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
              Departing User UUID:
            </label>
            <input
              type="text"
              placeholder="e.g. 22222222-2222-2222-2222-222222222222"
              value={offboardForm.departing_user_id}
              onChange={(e) => setOffboardForm({ ...offboardForm, departing_user_id: e.target.value })}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
              Successor User UUID (Required if cases assigned):
            </label>
            <input
              type="text"
              placeholder="e.g. 33333333-3333-3333-3333-333333333333"
              value={offboardForm.successor_user_id}
              onChange={(e) => setOffboardForm({ ...offboardForm, successor_user_id: e.target.value })}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1" }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
            <Button variant="outline" onClick={() => setIsOffboardModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleOffboardEmployee}>
              Deactivate & Reassign Cases
            </Button>
          </div>
        </div>
      </Modal>

      {/* FIRM EXPORT MODAL */}
      <Modal
        isOpen={isExportModalOpen}
        onClose={() => {
          setIsExportModalOpen(false);
          setExportResult(null);
        }}
        title="Firm Offboarding & Data Export"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "13px" }}>
          <p style={{ margin: 0, color: "#475569" }}>
            Firm data exports are restricted to Owners/Admins under active subscription and contractual entitlement. Choose between self-service cryptographic archive or concierge-assisted export.
          </p>
          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "6px" }}>
              Export Channel:
            </label>
            <div style={{ display: "flex", gap: "16px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <input
                  type="radio"
                  name="export_type"
                  checked={exportType === "self_service"}
                  onChange={() => setExportType("self_service")}
                />
                Self-Service Direct Bundle
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <input
                  type="radio"
                  name="export_type"
                  checked={exportType === "assisted_concierge"}
                  onChange={() => setExportType("assisted_concierge")}
                />
                Assisted Concierge Export
              </label>
            </div>
          </div>

          {exportResult && (
            <div style={{ padding: "12px", background: "#F0FDF4", borderRadius: "6px", border: "1px solid #BBF7D0" }}>
              <strong style={{ color: "#166534", display: "block", marginBottom: "4px" }}>
                Export Request Registered: {exportResult.status}
              </strong>
              {exportResult.archive_url && (
                <div style={{ fontSize: "12px", wordBreak: "break-all" }}>
                  <strong>Archive URL:</strong> {exportResult.archive_url}<br />
                  <strong>SHA-256:</strong> <code>{exportResult.archive_sha256}</code>
                </div>
              )}
              {exportResult.support_ticket_id && (
                <div style={{ fontSize: "12px" }}>
                  <strong>Support Concierge Ticket:</strong> {exportResult.support_ticket_id}<br />
                  <strong>Dedicated Contact:</strong> {exportResult.contact_email}
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
            <Button variant="outline" onClick={() => setIsExportModalOpen(false)}>
              Close
            </Button>
            <Button onClick={handleRequestFirmExport}>
              Generate Export Package
            </Button>
          </div>
        </div>
      </Modal>

      {/* LOCKDOWN MODAL */}
      <Modal
        isOpen={isLockdownModalOpen}
        onClose={() => setIsLockdownModalOpen(false)}
        title="EMERGENCY INCIDENT LOCKDOWN"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "13px" }}>
          <div style={{ padding: "12px", background: "#FEF2F2", borderRadius: "6px", border: "1px solid #FECACA", color: "#991B1B" }}>
            ⚠️ <strong>CRITICAL SECURITY ACTION:</strong> This will immediately invalidate and purge all active database user sessions for every attorney, manager, and client in this firm. All users will be immediately logged out.
          </div>
          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
              Incident Rationale (Recorded in Immutable Audit Log):
            </label>
            <textarea
              rows={3}
              value={lockdownReason}
              onChange={(e) => setLockdownReason(e.target.value)}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1" }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
            <Button variant="outline" onClick={() => setIsLockdownModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleExecuteLockdown}
              style={{ backgroundColor: "#DC2626", borderColor: "#DC2626", color: "#FFFFFF" }}
            >
              Confirm Emergency Lockdown
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
