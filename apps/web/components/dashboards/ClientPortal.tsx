import React, { useState } from "react";
import { DataTable } from "../common/DataTable";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import {
  ImmigrationCase,
  DocumentItem,
  MessageItem,
  NotificationItem,
  InvoiceItem,
} from "../../lib/types";
import { DocumentInspectorModal } from "../modals/DocumentInspectorModal";
import { WaitingStateBanner } from "../portal/WaitingStateBanner";
import { DocumentRequestManager } from "../portal/DocumentRequestManager";
import { SecureMessagingHub } from "../portal/SecureMessagingHub";
import { ClientOnboardingWizard } from "../portal/ClientOnboardingWizard";
import { ConfigurableFormViewer } from "../forms/ConfigurableFormViewer";
import { FALLBACK_FORM_SUBMISSION } from "../../lib/api";

interface ClientPortalProps {
  myCase: ImmigrationCase | null;
  documents: DocumentItem[];
  messages: MessageItem[];
  notifications: NotificationItem[];
  invoices: InvoiceItem[];
  onOpenUploadModal: () => void;
  onOpenQuestionnaireModal: () => void;
  onSendMessage: (content: string) => void;
  onMarkNotificationRead: (id: string) => void;
  onDocumentUpdated?: (doc: DocumentItem) => void;
}

export function ClientPortal({
  myCase,
  documents,
  messages,
  notifications,
  invoices,
  onOpenUploadModal,
  onOpenQuestionnaireModal,
  onSendMessage,
  onMarkNotificationRead,
  onDocumentUpdated,
}: ClientPortalProps) {
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "profile"
    | "questionnaire"
    | "forms"
    | "documents"
    | "milestones"
    | "messages"
    | "billing"
    | "settings"
  >("overview");

  const [messageInput, setMessageInput] = useState("");
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const [draftApproved, setDraftApproved] = useState(false);
  const [selectedDocForInspection, setSelectedDocForInspection] = useState<DocumentItem | null>(null);

  const missingDocs = documents.filter((d) => d.status === "missing" || d.status === "action_needed");

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    onSendMessage(messageInput);
    setMessageInput("");
  };

  // Milestones progression
  const milestones = [
    { name: "Legal Retainer Executed", done: true, date: "August 10, 2026" },
    { name: "Questionnaire & Evidentiary Mapping", done: true, date: "August 20, 2026" },
    { name: "Evidence Collection & Expert Letters", done: true, date: "September 15, 2026" },
    { name: "Formal Brief Drafting & Exhibit Indexing", done: false, date: "In Progress (Current)" },
    { name: "Final Client Approval & Submission to USCIS", done: false, date: "Est. November 15, 2026" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Client Portal Navigation Tabs */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border, #e2e8f0)",
          paddingBottom: "8px",
          gap: "8px",
          overflowX: "auto",
        }}
      >
        <Button variant={activeTab === "overview" ? "primary" : "ghost"} size="sm" onClick={() => setActiveTab("overview")}>
          🏠 My Petition Overview
        </Button>
        <Button variant={activeTab === "documents" ? "primary" : "ghost"} size="sm" onClick={() => setActiveTab("documents")}>
          📄 Evidence & Uploads ({documents.length})
        </Button>
        <Button variant={activeTab === "questionnaire" ? "primary" : "ghost"} size="sm" onClick={() => setActiveTab("questionnaire")}>
          📝 Guided Questionnaire
        </Button>
        <Button variant={activeTab === "forms" ? "primary" : "ghost"} size="sm" onClick={() => setActiveTab("forms")}>
          📋 Review Application Forms
        </Button>
        <Button variant={activeTab === "milestones" ? "primary" : "ghost"} size="sm" onClick={() => setActiveTab("milestones")}>
          🏁 Case Milestones
        </Button>
        <Button variant={activeTab === "messages" ? "primary" : "ghost"} size="sm" onClick={() => setActiveTab("messages")}>
          💬 Lawyer Messages ({messages.length})
        </Button>
        <Button variant={activeTab === "profile" ? "primary" : "ghost"} size="sm" onClick={() => setActiveTab("profile")}>
          👤 Applicant Profile
        </Button>
        <Button variant={activeTab === "billing" ? "primary" : "ghost"} size="sm" onClick={() => setActiveTab("billing")}>
          💳 Retainers & Invoices
        </Button>
        <Button variant={activeTab === "settings" ? "primary" : "ghost"} size="sm" onClick={() => setActiveTab("settings")}>
          ⚙️ Privacy & Security
        </Button>
      </div>

      {/* 1. OVERVIEW */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Waiting State: Dual breakdown of Waiting on You vs Waiting on Firm */}
          <WaitingStateBanner
            caseId={myCase?.id}
            onActionClick={(item) => {
              if (item.type === "document_request") {
                setActiveTab("documents");
              } else if (item.type === "questionnaire") {
                setIsOnboardingModalOpen(true);
              }
            }}
          />

          {/* Onboarding Checklist Banner */}
          {!onboardingDismissed && (
            <div
              style={{
                background: "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)",
                color: "#ffffff",
                padding: "20px 24px",
                borderRadius: "12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                boxShadow: "0 4px 12px rgba(29, 78, 216, 0.25)",
              }}
            >
              <div>
                <strong style={{ fontSize: "16px", display: "block", marginBottom: "4px" }}>
                  👋 Welcome to Your Immigration Transparency Portal, Dr. Rostova
                </strong>
                <p style={{ margin: 0, fontSize: "13px", opacity: 0.9 }}>
                  Your petition is in <strong>Evidence Gathering & Review</strong>. Please complete your onboarding questionnaire and statutory consents.
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px", flexShrink: 0 }}>
                <Button variant="secondary" size="sm" onClick={onOpenQuestionnaireModal}>
                  Continue Questionnaire →
                </Button>
                <Button variant="ghost" size="sm" style={{ color: "#ffffff", border: "1px solid rgba(255,255,255,0.4)" }} onClick={() => setIsOnboardingModalOpen(true)}>
                  Complete Onboarding Wizard →
                </Button>
                <Button variant="ghost" size="sm" style={{ color: "#ffffff" }} onClick={() => setOnboardingDismissed(true)}>
                  Dismiss
                </Button>
              </div>
            </div>
          )}

          {/* Missing Document Warning Banner if needed */}
          {missingDocs.length > 0 && (
            <div
              role="alert"
              style={{
                padding: "14px 18px",
                background: "var(--warning-soft, #fffbeb)",
                border: "1px solid #fde68a",
                borderRadius: "8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "20px" }}>⚠️</span>
                <div>
                  <strong style={{ fontSize: "14px", color: "var(--warning, #b45309)", display: "block" }}>
                    Action Requested: {missingDocs.length} Document(s) Awaiting Upload
                  </strong>
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                    Your legal team requested: {missingDocs.map((d) => d.title).join(", ")}
                  </span>
                </div>
              </div>
              <Button variant="primary" size="sm" onClick={onOpenUploadModal}>
                Upload Requested Document
              </Button>
            </div>
          )}

          {/* Case Status & Summary */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "20px" }}>
            <Card title="My Petition Details" subtitle="Active legal representation under LexImmigration Global.">
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px" }}>
                  <div>
                    <span style={{ color: "var(--quiet)", display: "block", fontSize: "11px" }}>CASE NUMBER</span>
                    <strong style={{ fontSize: "15px" }}>{myCase?.case_number || "CASE-US-8841"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--quiet)", display: "block", fontSize: "11px" }}>PETITION TYPE</span>
                    <strong>{myCase?.visa_category || "EB-1A Extraordinary Ability"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--quiet)", display: "block", fontSize: "11px" }}>PRIMARY LAWYER</span>
                    <span>{myCase?.assigned_manager || "Sarah Jenkins, Esq."}</span>
                  </div>
                  <div>
                    <span style={{ color: "var(--quiet)", display: "block", fontSize: "11px" }}>TARGET JURISDICTION</span>
                    <span>{myCase?.jurisdiction || "United States (USCIS)"}</span>
                  </div>
                </div>

                {/* Progress meter */}
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px" }}>
                    <span>Petition Filing Readiness</span>
                    <strong style={{ color: "var(--accent)" }}>{myCase?.readiness_score || 82}% Complete</strong>
                  </div>
                  <div style={{ width: "100%", height: "8px", backgroundColor: "#e2e8f0", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ width: `${myCase?.readiness_score || 82}%`, height: "100%", backgroundColor: "var(--accent)" }} />
                  </div>
                </div>
              </div>
            </Card>

            {/* Notifications Feed */}
            <Card title="Recent Notifications & Alerts" subtitle="Official case updates from your legal team.">
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => onMarkNotificationRead(n.id)}
                    style={{
                      padding: "10px 12px",
                      background: n.status === "unread" ? "var(--accent-soft, #eff6ff)" : "var(--surface-subtle, #f8fafc)",
                      border: `1px solid ${n.status === "unread" ? "#bfdbfe" : "#e2e8f0"}`,
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                      <strong style={{ fontSize: "13px", color: "var(--text)" }}>{n.title}</strong>
                      {n.status === "unread" && <Badge variant="info" size="sm">New</Badge>}
                    </div>
                    <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>{n.body}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* 2. DOCUMENTS & UPLOADS */}
      {activeTab === "documents" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Phase 7 Document Requests: Specific rationale, due dates, translation guidance, and evidence response */}
          <DocumentRequestManager
            caseId={myCase?.id}
            isStaffMode={false}
            onUploadEvidence={(req) => onOpenUploadModal()}
          />

          <Card
            title="My Evidence Checklist & Uploaded Files"
            subtitle="All documents are verified with SHA-256 fingerprinting for privacy and tamper-proof storage with automated OCR extraction."
            actions={
              <Button variant="primary" size="sm" onClick={onOpenUploadModal}>
                + Upload Evidence File
              </Button>
            }
          >
          <DataTable
            columns={[
              {
                key: "title",
                header: "Document Title",
                render: (d) => (
                  <div>
                    <strong style={{ display: "block" }}>{d.title}</strong>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "2px" }}>
                      <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "999px", background: "#1e293b", color: "#94a3b8" }}>
                        v{d.version || 1} {d.is_current_version ? "(Current)" : "(Superseded)"}
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--muted)" }}>{d.file_size || "1.5 MB"}</span>
                    </div>
                  </div>
                ),
              },
              {
                key: "category",
                header: "Evidentiary Category",
                render: (d) => (
                  <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "6px", background: "#1e1b4b", color: "#a5b4fc" }}>
                    {(d.category || "").replace(/_/g, " ")}
                  </span>
                ),
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
                    <Badge variant={vStatus === "verified" ? "success" : vStatus === "rejected" ? "action" : "review"}>
                      {vStatus === "verified" ? "✓ VERIFIED" : vStatus.toUpperCase()}
                    </Badge>
                  );
                },
              },
              {
                key: "extracted_fields",
                header: "Extracted Data",
                render: (d) => (
                  <span style={{ fontSize: "11px", color: "var(--accent)", fontWeight: 500 }}>
                    {d.extracted_fields?.length || 0} fields
                  </span>
                ),
              },
              {
                key: "actions",
                header: "Action",
                render: (d) => (
                  <Button variant="outline" size="sm" onClick={() => setSelectedDocForInspection(d)}>
                    Inspect Dossier
                  </Button>
                ),
              },
            ]}
            data={documents}
            keyExtractor={(d) => d.id}
          />
        </Card>
        </div>
      )}

      {/* 3. GUIDED QUESTIONNAIRE */}
      {activeTab === "questionnaire" && (
        <Card
          title="Guided Statutory Evidentiary Questionnaire"
          subtitle="Map your career accomplishments directly against USCIS 8 CFR § 204.5(h)(3) criteria."
          actions={
            <Button variant="primary" size="sm" onClick={onOpenQuestionnaireModal}>
              Open Guided Wizard →
            </Button>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {[
              { criterion: "1. Scholarly Articles & Scientific Publications", status: "Completed (14 papers submitted)", verified: true },
              { criterion: "2. Participation as a Judge / Peer Reviewer", status: "Completed (28 verified reviews)", verified: true },
              { criterion: "3. Original Scientific Contributions of Major Significance", status: "In Review by Attorney", verified: false },
              { criterion: "4. Leading or Critical Role in Distinguished Organizations", status: "Draft Saved (Awaiting CEO letter)", verified: false },
            ].map((item) => (
              <div
                key={item.criterion}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 16px",
                  background: "var(--surface-subtle, #f8fafc)",
                  border: "1px solid var(--border, #e2e8f0)",
                  borderRadius: "8px",
                }}
              >
                <div>
                  <strong style={{ fontSize: "14px", color: "var(--text)", display: "block" }}>{item.criterion}</strong>
                  <span style={{ fontSize: "13px", color: "var(--muted)" }}>{item.status}</span>
                </div>
                <Badge variant={item.verified ? "success" : "review"}>
                  {item.verified ? "VERIFIED ✓" : "IN PROGRESS"}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 4. CASE MILESTONES */}
      {activeTab === "milestones" && (
        <Card title="Immigration Pathway Milestones" subtitle="Transparent progress tracking towards petition filing and adjudication.">
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {milestones.map((m, idx) => (
              <div key={m.name} style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: m.done ? "var(--success)" : "var(--surface-subtle)",
                    border: `2px solid ${m.done ? "var(--success)" : "var(--border-strong)"}`,
                    color: m.done ? "#ffffff" : "var(--quiet)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "13px",
                    flexShrink: 0,
                  }}
                >
                  {m.done ? "✓" : idx + 1}
                </div>
                <div style={{ flex: 1, paddingBottom: "12px", borderBottom: idx < milestones.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <strong style={{ fontSize: "14px", color: m.done ? "var(--text)" : "var(--muted)", display: "block" }}>
                    {m.name}
                  </strong>
                  <span style={{ fontSize: "12px", color: "var(--quiet)" }}>{m.date}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 5. MESSAGES */}
      {activeTab === "messages" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Phase 7 Secure Messaging Hub with thread classification, delivery states & attachments */}
          <SecureMessagingHub
            caseId={myCase?.id}
            isStaffMode={false}
            onSendMessage={(content) => onSendMessage?.(content)}
          />
        </div>
      )}

      {/* 6. APPLICANT & FAMILY PROFILES */}
      {activeTab === "profile" && (
        <Card title="Principal Applicant & Dependent Information" subtitle="Civil biodata matching official travel passports.">
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "14px",
                background: "var(--surface-subtle, #f8fafc)",
                padding: "16px",
                borderRadius: "8px",
                fontSize: "13px",
              }}
            >
              <div>
                <span style={{ color: "var(--quiet)", display: "block", fontSize: "11px" }}>LEGAL NAME</span>
                <strong>Dr. Elena Rostova</strong>
              </div>
              <div>
                <span style={{ color: "var(--quiet)", display: "block", fontSize: "11px" }}>DATE OF BIRTH</span>
                <span>1988-04-12</span>
              </div>
              <div>
                <span style={{ color: "var(--quiet)", display: "block", fontSize: "11px" }}>CITIZENSHIP / NATIONALITY</span>
                <span>Ukraine</span>
              </div>
              <div>
                <span style={{ color: "var(--quiet)", display: "block", fontSize: "11px" }}>CURRENT RESIDENCE</span>
                <span>Palo Alto, California, United States</span>
              </div>
            </div>

            <h4 style={{ margin: "6px 0 0", fontSize: "14px", color: "var(--text)" }}>Dependents (Form I-485 Derivative Applicants)</h4>
            <div style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>Alexander Rostova (Spouse)</strong>
                <Badge variant="neutral">Derivative Beneficiary</Badge>
              </div>
              <small style={{ color: "var(--quiet)" }}>DOB: 1987-11-04 • Nationality: Ukraine • Marriage Certificate verified</small>
            </div>
          </div>
        </Card>
      )}

      {/* 7. BILLING & INVOICES */}
      {activeTab === "billing" && (
        <Card title="Retainer Account & Payment Ledger" subtitle="Attorney trust account balances and fee invoices.">
          <DataTable
            columns={[
              { key: "invoice_number", header: "Invoice #", render: (i) => <strong>{i.invoice_number}</strong> },
              { key: "case_number", header: "Case Reference", render: (i) => <span>{i.case_number}</span> },
              { key: "amount", header: "Amount", render: (i) => <strong>${i.amount.toLocaleString()}.00</strong> },
              {
                key: "status",
                header: "Status",
                render: (i) => (
                  <Badge variant={i.status === "paid" ? "success" : i.status === "in_trust" ? "info" : "warning"}>
                    {i.status.toUpperCase()}
                  </Badge>
                ),
              },
              { key: "due_date", header: "Date", render: (i) => <span>{i.due_date}</span> },
            ]}
            data={invoices.filter((i) => i.client_name.includes("Rostova"))}
            keyExtractor={(i) => i.id}
          />
        </Card>
      )}

      {/* 8. PRIVACY & SETTINGS */}
      {activeTab === "settings" && (
        <Card title="Privacy, Multi-Factor Authentication & Account Settings" subtitle="Tenant isolation and security controls for your client account.">
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "var(--surface-subtle)", borderRadius: "6px" }}>
              <div>
                <strong>Two-Factor Authentication (MFA)</strong>
                <p style={{ margin: "2px 0 0", color: "var(--quiet)" }}>Protects your immigration documents with an authenticator app.</p>
              </div>
              <Badge variant="success">MFA Enabled</Badge>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "var(--surface-subtle)", borderRadius: "6px" }}>
              <div>
                <strong>Tenant Isolation Guarantee</strong>
                <p style={{ margin: "2px 0 0", color: "var(--quiet)" }}>Your data is isolated and protected by server-side object authorization.</p>
              </div>
              <Badge variant="success">Encrypted & Isolated</Badge>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "var(--surface-subtle)", borderRadius: "6px" }}>
              <div>
                <strong>Export Case Evidence Archive</strong>
                <p style={{ margin: "2px 0 0", color: "var(--quiet)" }}>Download a complete cryptographically verified ZIP of all uploaded files.</p>
              </div>
              <Button variant="outline" size="sm">Export Records</Button>
            </div>
          </div>
        </Card>
      )}

      {/* 8. FORMS REVIEW */}
      {activeTab === "forms" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <ConfigurableFormViewer
            submission={FALLBACK_FORM_SUBMISSION}
            userRole="retained_client"
          />
        </div>
      )}

      {/* Document Dossier Inspector Modal */}
      <DocumentInspectorModal
        isOpen={!!selectedDocForInspection}
        onClose={() => setSelectedDocForInspection(null)}
        document={selectedDocForInspection}
        onDocumentUpdated={(updated) => {
          onDocumentUpdated?.(updated);
          setSelectedDocForInspection(updated);
        }}
        activeRole="retained_client"
      />

      {/* Guided Client Onboarding Wizard Modal */}
      {isOnboardingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <ClientOnboardingWizard
            isModal={true}
            onClose={() => setIsOnboardingModalOpen(false)}
            onComplete={() => setIsOnboardingModalOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
