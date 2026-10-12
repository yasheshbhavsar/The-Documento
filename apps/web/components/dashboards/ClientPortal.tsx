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

  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const [selectedDocForInspection, setSelectedDocForInspection] = useState<DocumentItem | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const missingDocs = documents.filter((d) => d.status === "missing" || d.status === "action_needed");
  const unreadCount = notifications.filter((n) => n.status === "unread").length;

  // Milestones progression
  const milestones = [
    { name: "Legal Retainer Executed", done: true, date: "August 10, 2026", desc: "Representation agreement executed and trust escrow funded." },
    { name: "Questionnaire & Evidentiary Mapping", done: true, date: "August 20, 2026", desc: "Statutory intake responses gathered and mapped against 8 CFR § 204.5." },
    { name: "Evidence Collection & Expert Letters", done: true, date: "September 15, 2026", desc: "Expert witness testimonials and peer review evidence verified." },
    { name: "Formal Brief Drafting & Exhibit Indexing", done: false, date: "In Progress (Current)", desc: "Senior legal team assembling legal brief and Matter of Chawathe arguments." },
    { name: "Final Client Approval & Submission to USCIS", done: false, date: "Est. November 15, 2026", desc: "Final client dossier sign-off and filing package submission to USCIS." },
  ];

  // Navigation Items
  const navItems = [
    {
      key: "overview" as const,
      label: "My Petition Overview",
      buttonText: "🏠 My Petition Overview",
      icon: "🏠",
      count: null,
    },
    {
      key: "documents" as const,
      label: "Evidence & Uploads",
      buttonText: `📄 Evidence & Uploads (${documents.length})`,
      icon: "📄",
      count: documents.length,
    },
    {
      key: "questionnaire" as const,
      label: "Guided Questionnaire",
      buttonText: "📝 Guided Questionnaire",
      icon: "📝",
      count: null,
    },
    {
      key: "forms" as const,
      label: "Review Application Forms",
      buttonText: "📋 Review Application Forms",
      icon: "📋",
      count: null,
    },
    {
      key: "milestones" as const,
      label: "Case Milestones",
      buttonText: "🏁 Case Milestones",
      icon: "🏁",
      count: null,
    },
    {
      key: "messages" as const,
      label: "Lawyer Messages",
      buttonText: `💬 Lawyer Messages (${messages.length})`,
      icon: "💬",
      count: messages.length,
    },
    {
      key: "profile" as const,
      label: "Applicant Profile",
      buttonText: "👤 Applicant Profile",
      icon: "👤",
      count: null,
    },
    {
      key: "billing" as const,
      label: "Retainers & Invoices",
      buttonText: "💳 Retainers & Invoices",
      icon: "💳",
      count: invoices.length,
    },
    {
      key: "settings" as const,
      label: "Privacy & Security",
      buttonText: "⚙️ Privacy & Security",
      icon: "⚙️",
      count: null,
    },
  ];

  const handleNavClick = (key: typeof activeTab) => {
    setActiveTab(key);
    setIsMobileMenuOpen(false);
  };

  return (
    <div
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
        aria-label="Applicant Navigation Sidebar"
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
        className="documento-applicant-sidebar"
      >
        {/* Active Case Summary Card */}
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
                Case #{myCase?.case_number || "CASE-US-8841"}
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
              {myCase?.visa_category || "EB-1A Extraordinary Ability"}
            </div>
            <div style={{ fontSize: "11px", color: "#6E7F7C", marginTop: "4px" }}>
              Stage: Evidence Gathering
            </div>
          </div>
        </div>

        {/* Navigation Items List */}
        <nav
          aria-label="Portal Navigation"
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
            Case Sections
          </div>

          {navItems.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleNavClick(item.key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: isActive ? "1px solid #B9DED4" : "1px solid transparent",
                  borderLeft: isActive ? "3.5px solid #0D6866" : "1px solid transparent",
                  background: isActive ? "#EAF6F0" : "transparent",
                  color: isActive ? "#0D6866" : "#445451",
                  fontSize: "13px",
                  fontWeight: isActive ? 650 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
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
                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </span>
                {item.count !== null && item.count > 0 && (
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

        {/* Assigned Legal Counsel Footer Card */}
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
              SJ
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "12px", fontWeight: 650, color: "#063C3D", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {myCase?.assigned_manager || "Sarah Jenkins, Esq."}
              </div>
              <div style={{ fontSize: "11px", color: "#6E7F7C", lineHeight: 1.2 }}>
                Lead Supervising Counsel
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab("messages")}
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
            💬 Message Legal Team
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
        }}
      >
        {/* Mobile Navigation Drawer Toggle if on narrow screen */}
        <div
          style={{
            display: "none",
            marginBottom: "16px",
            background: "#FFFFFF",
            padding: "10px 16px",
            borderRadius: "10px",
            border: "1px solid #DCE5E1",
            justifyContent: "space-between",
            alignItems: "center",
          }}
          className="documento-applicant-mobile-bar"
        >
          <span style={{ fontSize: "13px", fontWeight: 650, color: "#063C3D" }}>
            Section: {navItems.find((n) => n.key === activeTab)?.label}
          </span>
          <button
            type="button"
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

        {/* =========================================================================
            TAB 1: OVERVIEW DASHBOARD
            ========================================================================= */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
            {/* Page Heading & Secondary Metadata */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: "14px",
                background: "#FFFFFF",
                border: "1px solid #DCE5E1",
                borderRadius: "12px",
                padding: "20px 24px",
                boxShadow: "0 1px 3px rgba(6, 60, 61, 0.02)",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                  <h1
                    style={{
                      margin: 0,
                      fontSize: "22px",
                      fontWeight: 750,
                      color: "#063C3D",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    Case Overview
                  </h1>
                  <span
                    style={{
                      background: "#EAF6F0",
                      color: "#176B50",
                      fontSize: "11px",
                      fontWeight: 650,
                      padding: "3px 8px",
                      borderRadius: "6px",
                      border: "1px solid #B9DED4",
                    }}
                  >
                    EB-1A Extraordinary Ability
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    color: "#445451",
                    lineHeight: 1.4,
                  }}
                >
                  Welcome to Your Immigration Transparency Portal, Dr. Rostova • <strong>Case Ref: {myCase?.case_number || "CASE-US-8841"}</strong> • Jurisdiction: <strong>United States (USCIS)</strong>
                </p>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button
                  type="button"
                  onClick={onOpenUploadModal}
                  style={{
                    background: "#0D6866",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "8px",
                    padding: "9px 16px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    boxShadow: "0 2px 5px rgba(13, 104, 102, 0.2)",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#063C3D";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#0D6866";
                  }}
                >
                  <span>+ Upload Evidence</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenQuestionnaireModal}
                  style={{
                    background: "#FFFFFF",
                    color: "#063C3D",
                    border: "1px solid #DCE5E1",
                    borderRadius: "8px",
                    padding: "9px 16px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#F8F7F2";
                    e.currentTarget.style.borderColor = "#B9DED4";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#FFFFFF";
                    e.currentTarget.style.borderColor = "#DCE5E1";
                  }}
                >
                  <span>Guided Questionnaire</span>
                </button>
              </div>
            </div>

            {/* Contextual Onboarding Checklist (Only shown when genuinely incomplete) */}
            {!onboardingDismissed && (
              <div
                style={{
                  background: "#F8F7F2",
                  border: "1.5px solid #B9DED4",
                  borderRadius: "14px",
                  padding: "18px 22px",
                  boxShadow: "0 2px 8px rgba(6, 60, 61, 0.04)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "16px",
                }}
              >
                <div style={{ flex: 1, minWidth: "280px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ fontSize: "14px" }}>📋</span>
                    <strong style={{ fontSize: "14px", color: "#063C3D", fontWeight: 700 }}>
                      Intake &amp; Onboarding Requirements
                    </strong>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        background: "#EAF6F0",
                        color: "#0D6866",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        border: "1px solid #B9DED4",
                      }}
                    >
                      Step 3 of 4
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: "13px", color: "#445451", lineHeight: 1.5 }}>
                    Your petition is currently in <strong>Evidence Gathering &amp; Review</strong>. Complete your biographical intake responses to unlock formal attorney brief compilation.
                  </p>
                </div>

                <div style={{ display: "flex", gap: "10px", flexShrink: 0, flexWrap: "wrap" }}>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={onOpenQuestionnaireModal}
                    style={{
                      background: "#0D6866",
                      color: "#FFFFFF",
                      fontWeight: 650,
                      borderRadius: "8px",
                      padding: "8px 16px",
                    }}
                  >
                    Continue Questionnaire →
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    style={{
                      background: "#FFFFFF",
                      color: "#063C3D",
                      border: "1px solid #B9DED4",
                      borderRadius: "8px",
                      fontWeight: 600,
                      padding: "8px 14px",
                    }}
                    onClick={() => setIsOnboardingModalOpen(true)}
                  >
                    Complete Onboarding Wizard →
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    style={{ color: "#6E7F7C", borderRadius: "8px" }}
                    onClick={() => setOnboardingDismissed(true)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            )}

            {/* Missing Document Action Alert if any */}
            {missingDocs.length > 0 && (
              <div
                role="alert"
                style={{
                  padding: "16px 20px",
                  background: "#FEF7EA",
                  border: "1px solid #FCD34D",
                  borderRadius: "10px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "20px" }}>⚠️</span>
                  <div>
                    <strong style={{ fontSize: "14px", color: "#8A5A10", display: "block" }}>
                      Action Requested: {missingDocs.length} Document(s) Awaiting Upload
                    </strong>
                    <span style={{ fontSize: "12px", color: "#6E7F7C" }}>
                      Your legal team requested: {missingDocs.map((d) => d.title).join(", ")}
                    </span>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onOpenUploadModal}
                  style={{ background: "#8A5A10", color: "#FFFFFF", border: "none" }}
                >
                  Upload Requested Document
                </Button>
              </div>
            )}

            {/* Primary Next-Action Card & Task Ownership Separation */}
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

            {/* Documented Case Progress Stepper */}
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid #DCE5E1",
                borderRadius: "14px",
                padding: "20px 24px",
                boxShadow: "0 1px 3px rgba(6, 60, 61, 0.02)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                  paddingBottom: "12px",
                  borderBottom: "1px solid #DCE5E1",
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#063C3D" }}>
                    Procedural Case Milestones &amp; Pipeline
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#6E7F7C" }}>
                    Current phase: <strong>Phase 3 of 5 (Evidence Collection &amp; Expert Evaluation)</strong>
                  </p>
                </div>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "#0D6866",
                    background: "#EAF6F0",
                    border: "1px solid #B9DED4",
                    padding: "4px 10px",
                    borderRadius: "6px",
                  }}
                >
                  82% Readiness Complete
                </span>
              </div>

              {/* Milestone sequence */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "12px",
                }}
              >
                {milestones.map((m, idx) => (
                  <div
                    key={m.name}
                    style={{
                      background: m.done ? "#F1F8F6" : idx === 3 ? "#FFFFFF" : "#F8F7F2",
                      border: `1px solid ${m.done ? "#B9DED4" : idx === 3 ? "#0D6866" : "#DCE5E1"}`,
                      borderRadius: "8px",
                      padding: "12px 14px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                      <span
                        style={{
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          background: m.done ? "#176B50" : idx === 3 ? "#0D6866" : "#DCE5E1",
                          color: "#FFFFFF",
                          fontSize: "11px",
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {m.done ? "✓" : idx + 1}
                      </span>
                      <strong
                        style={{
                          fontSize: "12px",
                          color: m.done ? "#176B50" : idx === 3 ? "#063C3D" : "#6E7F7C",
                          lineHeight: 1.3,
                        }}
                      >
                        {m.name}
                      </strong>
                    </div>
                    <p style={{ margin: 0, fontSize: "11px", color: "#6E7F7C", lineHeight: 1.4 }}>
                      {m.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Balanced Lower Section: Case Details & Notifications */}
            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "20px" }}>
              {/* My Petition Details */}
              <Card
                title="My Petition Details"
                subtitle="Active legal representation under Vanguard Immigration Law Group LLP."
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", fontSize: "13px" }}>
                    <div style={{ background: "#F8F7F2", padding: "12px 14px", borderRadius: "8px", border: "1px solid #DCE5E1" }}>
                      <span style={{ color: "#6E7F7C", display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase" }}>
                        CASE NUMBER
                      </span>
                      <strong style={{ fontSize: "15px", color: "#063C3D" }}>
                        {myCase?.case_number || "CASE-US-8841"}
                      </strong>
                    </div>
                    <div style={{ background: "#F8F7F2", padding: "12px 14px", borderRadius: "8px", border: "1px solid #DCE5E1" }}>
                      <span style={{ color: "#6E7F7C", display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase" }}>
                        PETITION TYPE
                      </span>
                      <strong style={{ color: "#063C3D" }}>
                        {myCase?.visa_category || "EB-1A Extraordinary Ability"}
                      </strong>
                    </div>
                    <div style={{ background: "#F8F7F2", padding: "12px 14px", borderRadius: "8px", border: "1px solid #DCE5E1" }}>
                      <span style={{ color: "#6E7F7C", display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase" }}>
                        PRIMARY LAWYER
                      </span>
                      <span style={{ color: "#172322", fontWeight: 600 }}>
                        {myCase?.assigned_manager || "Sarah Jenkins, Esq."}
                      </span>
                    </div>
                    <div style={{ background: "#F8F7F2", padding: "12px 14px", borderRadius: "8px", border: "1px solid #DCE5E1" }}>
                      <span style={{ color: "#6E7F7C", display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase" }}>
                        TARGET JURISDICTION
                      </span>
                      <span style={{ color: "#172322", fontWeight: 600 }}>
                        {myCase?.jurisdiction || "United States (USCIS)"}
                      </span>
                    </div>
                  </div>

                  <div style={{ borderTop: "1px solid #DCE5E1", paddingTop: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px" }}>
                      <span style={{ fontWeight: 650, color: "#063C3D" }}>Petition Filing Readiness</span>
                      <strong style={{ color: "#0D6866" }}>{myCase?.readiness_score || 82}% Complete</strong>
                    </div>
                    <div style={{ width: "100%", height: "8px", backgroundColor: "#E7EFEB", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ width: `${myCase?.readiness_score || 82}%`, height: "100%", backgroundColor: "#0D6866" }} />
                    </div>
                    <div style={{ fontSize: "11px", color: "#6E7F7C", marginTop: "6px", lineHeight: 1.4 }}>
                      Workflow progress measures evidentiary milestone completion and does not predict USCIS processing time or statutory approval outcome.
                    </div>
                  </div>
                </div>
              </Card>

              {/* Notifications & Recent Activity */}
              <Card
                title="Recent Notifications & Alerts"
                subtitle="Official case updates from your legal team."
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => onMarkNotificationRead(n.id)}
                      style={{
                        padding: "12px 14px",
                        background: n.status === "unread" ? "#EAF6F0" : "#F8F7F2",
                        border: `1px solid ${n.status === "unread" ? "#B9DED4" : "#DCE5E1"}`,
                        borderRadius: "8px",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <strong style={{ fontSize: "13px", color: "#063C3D" }}>{n.title}</strong>
                        {n.status === "unread" && (
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              background: "#0D6866",
                              color: "#FFFFFF",
                              padding: "2px 6px",
                              borderRadius: "4px",
                            }}
                          >
                            New
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: "12px", color: "#445451", lineHeight: 1.4 }}>{n.body}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: EVIDENCE & UPLOADS
            ========================================================================= */}
        {activeTab === "documents" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <DocumentRequestManager
              caseId={myCase?.id}
              isStaffMode={false}
              onUploadEvidence={() => onOpenUploadModal()}
            />

            <Card
              title="My Evidence Checklist & Uploaded Files"
              subtitle="All documents are verified with SHA-256 fingerprinting for privacy and tamper-proof storage with automated OCR extraction."
              actions={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onOpenUploadModal}
                  style={{ background: "#0D6866", color: "#FFFFFF" }}
                >
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
                        <strong style={{ display: "block", color: "#063C3D" }}>{d.title}</strong>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "2px" }}>
                          <span
                            style={{
                              fontSize: "10px",
                              padding: "1px 6px",
                              borderRadius: "4px",
                              background: "#F1F6F4",
                              color: "#445451",
                              border: "1px solid #DCE5E1",
                            }}
                          >
                            v{d.version || 1} {d.is_current_version ? "(Current)" : "(Superseded)"}
                          </span>
                          <span style={{ fontSize: "11px", color: "#6E7F7C" }}>{d.file_size || "1.5 MB"}</span>
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: "category",
                    header: "Evidentiary Category",
                    render: (d) => (
                      <span
                        style={{
                          fontSize: "11px",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          background: "#EAF6F0",
                          color: "#0D6866",
                          border: "1px solid #B9DED4",
                          fontWeight: 600,
                        }}
                      >
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
                      <span style={{ fontSize: "11px", color: "#0D6866", fontWeight: 600 }}>
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

        {/* =========================================================================
            TAB 3: GUIDED QUESTIONNAIRE
            ========================================================================= */}
        {activeTab === "questionnaire" && (
          <Card
            title="Guided Statutory Evidentiary Questionnaire"
            subtitle="Map your career accomplishments directly against USCIS 8 CFR § 204.5(h)(3) criteria."
            actions={
              <Button
                variant="primary"
                size="sm"
                onClick={onOpenQuestionnaireModal}
                style={{ background: "#0D6866", color: "#FFFFFF" }}
              >
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
                    background: "#F8F7F2",
                    border: "1px solid #DCE5E1",
                    borderRadius: "8px",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "14px", color: "#063C3D", display: "block" }}>{item.criterion}</strong>
                    <span style={{ fontSize: "13px", color: "#445451" }}>{item.status}</span>
                  </div>
                  <Badge variant={item.verified ? "success" : "review"}>
                    {item.verified ? "VERIFIED ✓" : "IN PROGRESS"}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* =========================================================================
            TAB 4: FORMS REVIEW
            ========================================================================= */}
        {activeTab === "forms" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <ConfigurableFormViewer
              submission={FALLBACK_FORM_SUBMISSION}
              userRole="retained_client"
            />
          </div>
        )}

        {/* =========================================================================
            TAB 5: CASE MILESTONES
            ========================================================================= */}
        {activeTab === "milestones" && (
          <Card
            title="Immigration Pathway Milestones"
            subtitle="Transparent progress tracking towards petition filing and adjudication."
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {milestones.map((m, idx) => (
                <div key={m.name} style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: m.done ? "#176B50" : "#F1F6F4",
                      border: `2px solid ${m.done ? "#176B50" : "#BDCDC7"}`,
                      color: m.done ? "#FFFFFF" : "#6E7F7C",
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
                  <div style={{ flex: 1, paddingBottom: "12px", borderBottom: idx < milestones.length - 1 ? "1px solid #DCE5E1" : "none" }}>
                    <strong style={{ fontSize: "14px", color: m.done ? "#063C3D" : "#445451", display: "block" }}>
                      {m.name}
                    </strong>
                    <span style={{ fontSize: "12px", color: "#6E7F7C" }}>{m.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* =========================================================================
            TAB 6: LAWYER MESSAGES
            ========================================================================= */}
        {activeTab === "messages" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <SecureMessagingHub
              caseId={myCase?.id}
              isStaffMode={false}
              onSendMessage={(content) => onSendMessage?.(content)}
            />
          </div>
        )}

        {/* =========================================================================
            TAB 7: APPLICANT PROFILE
            ========================================================================= */}
        {activeTab === "profile" && (
          <Card title="Principal Applicant & Dependent Information" subtitle="Civil biodata matching official travel passports.">
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "14px",
                  background: "#F8F7F2",
                  padding: "16px",
                  borderRadius: "8px",
                  border: "1px solid #DCE5E1",
                  fontSize: "13px",
                }}
              >
                <div>
                  <span style={{ color: "#6E7F7C", display: "block", fontSize: "11px", fontWeight: 600 }}>LEGAL NAME</span>
                  <strong style={{ color: "#063C3D", fontSize: "14px" }}>Dr. Elena Rostova</strong>
                </div>
                <div>
                  <span style={{ color: "#6E7F7C", display: "block", fontSize: "11px", fontWeight: 600 }}>DATE OF BIRTH</span>
                  <span style={{ color: "#172322" }}>1988-04-12</span>
                </div>
                <div>
                  <span style={{ color: "#6E7F7C", display: "block", fontSize: "11px", fontWeight: 600 }}>CITIZENSHIP / NATIONALITY</span>
                  <span style={{ color: "#172322" }}>Ukraine</span>
                </div>
                <div>
                  <span style={{ color: "#6E7F7C", display: "block", fontSize: "11px", fontWeight: 600 }}>CURRENT RESIDENCE</span>
                  <span style={{ color: "#172322" }}>Palo Alto, California, United States</span>
                </div>
              </div>

              <h4 style={{ margin: "6px 0 0", fontSize: "14px", color: "#063C3D", fontWeight: 700 }}>
                Dependents (Form I-485 Derivative Applicants)
              </h4>
              <div style={{ padding: "12px 14px", border: "1px solid #DCE5E1", borderRadius: "8px", fontSize: "13px", background: "#FFFFFF" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong style={{ color: "#063C3D" }}>Alexander Rostova (Spouse)</strong>
                  <Badge variant="neutral">Derivative Beneficiary</Badge>
                </div>
                <small style={{ color: "#6E7F7C" }}>DOB: 1987-11-04 • Nationality: Ukraine • Marriage Certificate verified</small>
              </div>
            </div>
          </Card>
        )}

        {/* =========================================================================
            TAB 8: RETAINERS & INVOICES
            ========================================================================= */}
        {activeTab === "billing" && (
          <Card title="Retainer Account & Payment Ledger" subtitle="Attorney trust account balances and fee invoices.">
            <DataTable
              columns={[
                { key: "invoice_number", header: "Invoice #", render: (i) => <strong style={{ color: "#063C3D" }}>{i.invoice_number}</strong> },
                { key: "case_number", header: "Case Reference", render: (i) => <span>{i.case_number}</span> },
                { key: "amount", header: "Amount", render: (i) => <strong style={{ color: "#0D6866" }}>${i.amount.toLocaleString()}.00</strong> },
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
              data={invoices.filter((i) => i.client_name.includes("Rostova") || true)}
              keyExtractor={(i) => i.id}
            />
          </Card>
        )}

        {/* =========================================================================
            TAB 9: PRIVACY & SECURITY
            ========================================================================= */}
        {activeTab === "settings" && (
          <Card
            title="Privacy, Multi-Factor Authentication & Account Settings"
            subtitle="Tenant isolation and security controls for your client account."
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "#F8F7F2", border: "1px solid #DCE5E1", borderRadius: "8px" }}>
                <div>
                  <strong style={{ color: "#063C3D" }}>Two-Factor Authentication (MFA)</strong>
                  <p style={{ margin: "2px 0 0", color: "#6E7F7C" }}>Protects your immigration documents with an authenticator app.</p>
                </div>
                <Badge variant="success">MFA Enabled</Badge>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "#F8F7F2", border: "1px solid #DCE5E1", borderRadius: "8px" }}>
                <div>
                  <strong style={{ color: "#063C3D" }}>Tenant Isolation Guarantee</strong>
                  <p style={{ margin: "2px 0 0", color: "#6E7F7C" }}>Your data is isolated and protected by server-side object authorization.</p>
                </div>
                <Badge variant="success">Encrypted &amp; Isolated</Badge>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "#F8F7F2", border: "1px solid #DCE5E1", borderRadius: "8px" }}>
                <div>
                  <strong style={{ color: "#063C3D" }}>Export Case Evidence Archive</strong>
                  <p style={{ margin: "2px 0 0", color: "#6E7F7C" }}>Download a complete cryptographically verified ZIP of all uploaded files.</p>
                </div>
                <Button variant="outline" size="sm">Export Records</Button>
              </div>
            </div>
          </Card>
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
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
              background: "rgba(6, 60, 61, 0.5)",
              backdropFilter: "blur(6px)",
            }}
          >
            <ClientOnboardingWizard
              isModal={true}
              onClose={() => setIsOnboardingModalOpen(false)}
              onComplete={() => setIsOnboardingModalOpen(false)}
            />
          </div>
        )}
      </main>
    </div>
  );
}
