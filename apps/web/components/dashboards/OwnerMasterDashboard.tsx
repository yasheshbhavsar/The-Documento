import React, { useState } from "react";
import { MetricCard } from "../common/MetricCard";
import { DataTable, Column } from "../common/DataTable";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import {
  ImmigrationCase,
  ClientProfile,
  AuditEvent,
  InvoiceItem,
  TeamMemberCapacity,
  ManagerPriorityQueueResponse,
  UserContext,
} from "../../lib/types";
import { canDeleteClient } from "../../lib/auth";
import { RuleAdministrationHub } from "../rules/RuleAdministrationHub";
import { ExecutiveCommandCenter } from "../analytics/ExecutiveCommandCenter";
import { AnalyticsExplorer } from "../analytics/AnalyticsExplorer";
import { BillingManager } from "../billing/BillingManager";
import { BusinessOperationsHub } from "../operations/BusinessOperationsHub";
import { OperationalReliabilityHub } from "../operations/OperationalReliabilityHub";
import { PilotReleaseGovernanceDesk } from "../operations/PilotReleaseGovernanceDesk";
import { FirmConfigurationHub } from "../firm/FirmConfigurationHub";
import { PathwayExpansionDesk } from "../pathways/PathwayExpansionDesk";
import { ProvisionCredentialsModal } from "../modals/ProvisionCredentialsModal";
import { ManagerPriorityQueueView } from "./ManagerPriorityQueueView";
import {
  api,
  fetchManagerPriorityQueue,
  FALLBACK_MANAGER_PRIORITY_QUEUE,
} from "../../lib/api";

interface OwnerMasterDashboardProps {
  cases: ImmigrationCase[];
  clients: ClientProfile[];
  auditEvents: AuditEvent[];
  invoices?: InvoiceItem[];
  capacity?: TeamMemberCapacity[];
  isLiveBackend?: boolean;
  onOpenCreateCase: () => void;
  onOpenCreateClient: () => void;
  onSelectCase: (c: ImmigrationCase) => void;
  onClientUpdated?: (c: ClientProfile) => void;
  onDeleteClient?: (clientId: string) => Promise<void> | void;
  currentUser?: UserContext;
}

export function OwnerMasterDashboard({
  cases = [],
  clients = [],
  auditEvents = [],
  invoices = [],
  capacity = [],
  isLiveBackend,
  onOpenCreateCase,
  onOpenCreateClient,
  onSelectCase,
  onClientUpdated,
  onDeleteClient,
  currentUser,
}: OwnerMasterDashboardProps) {
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "firm_config"
    | "reliability_ops"
    | "manager_priority"
    | "conversation_inspector"
    | "executive"
    | "analytics"
    | "operations"
    | "billing"
    | "cases"
    | "clients"
    | "team"
    | "financials"
    | "audit"
    | "rules"
    | "stage9_release_governance"
    | "stage10_pathway_expansion"
  >("overview");

  const [selectedClientForCredentials, setSelectedClientForCredentials] = useState<ClientProfile | null>(null);
  const [isProvisionModalOpen, setIsProvisionModalOpen] = useState(false);

  const [priorityQueueData, setPriorityQueueData] = useState<ManagerPriorityQueueResponse>(FALLBACK_MANAGER_PRIORITY_QUEUE);
  const [selectedInspectorCaseId, setSelectedInspectorCaseId] = useState<string>(cases[0]?.id || "");
  const [inspectorChannelFilter, setInspectorChannelFilter] = useState<"all" | "client_chat" | "internal_notes">("all");
  const [supervisoryNoteInput, setSupervisoryNoteInput] = useState("");
  const [supervisoryNotes, setSupervisoryNotes] = useState<Array<{ id: string; author: string; note: string; timestamp: string }>>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("documento_supervisory_notes");
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return [];
  });

  React.useEffect(() => {
    let isMounted = true;
    fetchManagerPriorityQueue("master_admin")
      .then((res) => {
        if (isMounted && res && res.ranks) {
          setPriorityQueueData(res);
        }
      })
      .catch(() => {
        // Fallback already assigned
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Filtered metrics
  const activeCasesCount = cases.filter((c) => c.status !== "filed" && c.status !== "approved").length;
  const attentionCases = cases.filter((c) => c.attention_required);
  const totalRevenue = invoices.filter((i) => i.status === "paid").reduce((sum, i) => sum + i.amount, 0);
  const outstandingRevenue = invoices.filter((i) => i.status === "outstanding").reduce((sum, i) => sum + i.amount, 0);

  // Group by stage
  const stageCounts: Record<string, number> = {
    intake: cases.filter((c) => c.status === "intake").length,
    gathering: cases.filter((c) => c.status === "gathering").length,
    review: cases.filter((c) => c.status === "review").length,
    assembly: cases.filter((c) => c.status === "assembly").length,
    ready: cases.filter((c) => c.status === "ready").length,
    filed: cases.filter((c) => c.status === "filed").length,
  };

  // Group by country/pathway
  const countryCounts: Record<string, number> = {};
  cases.forEach((c) => {
    countryCounts[c.jurisdiction] = (countryCounts[c.jurisdiction] || 0) + 1;
  });

  // Permissions check: Owner and Managers can delete clients; Paralegals and Retained Clients cannot
  const canDelete = currentUser ? canDeleteClient(currentUser) : true;

  const handleDeleteClientClick = async (client: ClientProfile) => {
    const clientCases = cases.filter(
      (c) =>
        c.client_id === client.id ||
        (c.client_name &&
          `${client.first_name} ${client.last_name}`.toLowerCase() === c.client_name.toLowerCase())
    );

    const caseWarning =
      clientCases.length > 0
        ? `\n\n⚠️ Notice: This client is associated with ${clientCases.length} case(s) (${clientCases
            .map((c) => c.case_number)
            .join(", ")}).`
        : "";

    const confirmMsg = `Are you sure you want to permanently delete retained client "${client.first_name} ${client.last_name}" (${client.email})?${caseWarning}\n\nThis will remove their profile and portal credentials. This action cannot be undone.`;

    if (window.confirm(confirmMsg)) {
      if (onDeleteClient) {
        await onDeleteClient(client.id);
      } else {
        await api.deleteClient(client.id);
      }
    }
  };

  // Table columns for Cases
  const caseColumns: Column<ImmigrationCase>[] = [
    {
      key: "case_number",
      header: "Case Ref",
      sortable: true,
      render: (c) => <strong>{c.case_number}</strong>,
    },
    {
      key: "title",
      header: "Petition Title & Client",
      sortable: true,
      render: (c) => (
        <div>
          <strong style={{ display: "block", color: "var(--text)" }}>{c.title}</strong>
          <small style={{ color: "var(--quiet)" }}>{c.client_name}</small>
        </div>
      ),
    },
    {
      key: "visa_category",
      header: "Pathway",
      sortable: true,
    },
    {
      key: "status",
      header: "Pipeline Stage",
      sortable: true,
      render: (c) => (
        <Badge variant={c.status === "ready" || c.status === "filed" ? "success" : c.attention_required ? "action" : "review"}>
          {c.status.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: "readiness_score",
      header: "Readiness",
      sortable: true,
      render: (c) => (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "60px", height: "6px", backgroundColor: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
            <div style={{ width: `${c.readiness_score}%`, height: "100%", backgroundColor: c.readiness_score > 80 ? "var(--success)" : "var(--accent)" }} />
          </div>
          <span style={{ fontSize: "12px", fontWeight: 700 }}>{c.readiness_score}%</span>
        </div>
      ),
    },
    {
      key: "deadline",
      header: "Filing Deadline",
      sortable: true,
      render: (c) => (
        <span style={{ color: c.attention_required ? "var(--critical)" : "inherit", fontWeight: c.attention_required ? 700 : 500 }}>
          {c.deadline || "Standard"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Action",
      render: (c) => (
        <Button variant="outline" size="sm" onClick={() => onSelectCase(c)}>
          Inspect
        </Button>
      ),
    },
  ];

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { key: "overview", id: "tab-btn-overview", label: "Company Overview", icon: "🏢", count: null },
    { key: "firm_config", id: "tab-btn-firm-config", label: "Firm Governance & Configuration", icon: "🏛️", count: null },
    { key: "reliability_ops", id: "tab-btn-reliability-ops", label: "Reliability, Privacy & Security", icon: "🛡️", count: null },
    { key: "manager_priority", id: "tab-btn-manager-priority", label: "Priority Command Board", icon: "🚨", count: 8 },
    { key: "conversation_inspector", id: "tab-btn-conversation-inspector", label: "Conversation Inspector", icon: "💬", count: null },
    { key: "executive", id: "tab-btn-executive", label: "Executive Command Center", icon: "⚡", count: null },
    { key: "analytics", id: "tab-btn-analytics", label: "Deep Analytics", icon: "📈", count: null },
    { key: "operations", id: "tab-btn-operations", label: "Operations Hub", icon: "👥", count: null },
    { key: "billing", id: "tab-btn-billing", label: "Billing & Retainers", icon: "💳", count: null },
    { key: "cases", id: "tab-btn-cases", label: "All Cases", icon: "📋", count: cases.length },
    { key: "clients", id: "tab-btn-clients", label: "Retained Clients", icon: "👥", count: clients.length },
    { key: "team", id: "tab-btn-team", label: "Team Capacity", icon: "👥", count: capacity?.length || 0 },
    { key: "financials", id: "tab-btn-financials", label: "Revenue & Billing", icon: "💳", count: null },
    { key: "audit", id: "tab-btn-audit", label: "Audit Alerts", icon: "🛡️", count: auditEvents.length },
    { key: "rules", id: "tab-btn-rules", label: "Rules & Authorities", icon: "⚖️", count: null },
    { key: "stage9_release_governance", id: "tab-btn-stage9-release-governance", label: "Release & Pilot Desk", icon: "🚀", count: null },
    { key: "stage10_pathway_expansion", id: "tab-btn-stage10-pathway-expansion", label: "Pathway Expansion", icon: "🌐", count: null },
  ] as const;

  const activeTabInfo = {
    overview: {
      title: "Company Overview",
      subtitle: "Executive Command & Operational Health • Vanguard Immigration Law Group LLP",
    },
    firm_config: {
      title: "Firm Governance & Configuration Hub",
      subtitle: "Owner & Managing Admin Configuration of Roles, Country Pathways, Folders, Checklists, Reminders, Review Gates & Inactivity Policies",
    },
    reliability_ops: {
      title: "Operational Reliability, Privacy & Security Hub",
      subtitle: "Tenant Isolation, Background Job Telemetry, Data-Flow Register, Jurisdiction Privacy Reviews, Drills & Lifecycle Scenarios",
    },
    manager_priority: {
      title: "Manager Priority Command Board (Ranks 1–8)",
      subtitle: "Strict 1–8 Sequential Triage: Deadlines, Staff Allocation, Blocked Cases, Client Delays, Reviews, Quality Escalations, Payment Tracking & Continuous Improvement.",
    },
    conversation_inspector: {
      title: "Officer-Client Conversation Inspector",
      subtitle: "Authorized Managing Partner Oversight Across All Caseworker & Client Transcripts with Confidential Notes Review.",
    },
    executive: {
      title: "Executive Command Center",
      subtitle: "Real-Time Firm Intelligence, Mathematical Metrics & Strategic Analytics",
    },
    analytics: {
      title: "Deep Analytics",
      subtitle: "Multi-Dimensional Pipeline Filtering, Turnaround Timelines & Bottleneck Diagnosis",
    },
    operations: {
      title: "Operations Hub",
      subtitle: "Caseworker Workload Capacity, Peer Reviews & SLA Compliance Management",
    },
    billing: {
      title: "Billing & Retainers",
      subtitle: "Escrow Ledger, Invoice Reconciliation & Retainer Accounting",
    },
    cases: {
      title: "All Cases",
      subtitle: `Comprehensive Caseload Management (${cases.length} active and in-progress petitions)`,
    },
    clients: {
      title: "Retained Clients & Portal Access Control",
      subtitle: `Directory of Retained Applicants (${clients.length} profiles under representation). Credentials must be provided by Owner or Lead Paralegal for portal login.`,
    },
    team: {
      title: "Team Capacity",
      subtitle: `Attorney & Paralegal Workload Distribution (${capacity.length} legal specialists)`,
    },
    financials: {
      title: "Revenue & Billing",
      subtitle: "Retainer Agreements, Milestone Billing & Cryptographic Trust Escrow",
    },
    audit: {
      title: "Audit Alerts",
      subtitle: `Append-Only Cryptographic Audit Log (${auditEvents.length} verifiable events)`,
    },
    rules: {
      title: "Rules & Authorities",
      subtitle: "Statutory Immigration Rule Registry, Regulatory Sources & Pilot Workflows",
    },
    stage9_release_governance: {
      title: "Stage 9: Release & Pilot Operations Governance Desk",
      subtitle: "Deterministic Go/No-Go Release Gates, Narrow Pilot Cohorts, Comparative Workflow KPIs, Cryptographic Backup Drills & Runbooks",
    },
    stage10_pathway_expansion: {
      title: "Stage 10: Pathway Expansion & Regional Localization Desk",
      subtitle: "Multi-Jurisdiction Inventory (Priorities 1–5), 8 Broad Application Families, EU/Schengen Distinctions, Safe-Stop Principles & Multilingual Matching Engine",
    },
  }[activeTab];

  return (
    <div
      id="owner-master-dashboard"
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
        aria-label="Managing Partner Navigation Sidebar"
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
        {/* Executive Suite Summary Card */}
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
                Vanguard Law Group
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
              Executive Command Center
            </div>
            <div style={{ fontSize: "11px", color: "#6E7F7C", marginTop: "4px" }}>
              Active Caseload: {activeCasesCount} Petitions
            </div>
          </div>
        </div>

        {/* Navigation Items List */}
        <nav
          aria-label="Executive Navigation"
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
            Executive Sections
          </div>

          {navItems.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                id={item.id}
                data-testid={item.id}
                type="button"
                aria-current={isActive ? "page" : undefined}
                onClick={() => {
                  setActiveTab(item.key);
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

        {/* Managing Partner Footer Card */}
        <div
          style={{
            padding: "14px 16px",
            borderTop: "1px solid #DCE5E1",
            background: "#FAFAF7",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
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
                Sarah Jenkins (Partner)
              </div>
              <div style={{ fontSize: "11px", color: "#6E7F7C", lineHeight: 1.2 }}>
                Managing Partner
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <Button variant="secondary" size="sm" onClick={onOpenCreateClient} style={{ width: "100%", justifyContent: "center" }}>
              + Retain Client
            </Button>
            <Button variant="primary" size="sm" onClick={onOpenCreateCase} style={{ width: "100%", justifyContent: "center" }}>
              + New Case Record
            </Button>
          </div>
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
            aria-controls="executive-mobile-sections-menu"
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
            id="executive-mobile-sections-menu"
            role="menu"
            aria-label="Executive Mobile Navigation"
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
                    setActiveTab(item.key);
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
                  {item.count !== null && item.count > 0 && (
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
                Managing Partner Suite
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
            <Button variant="secondary" size="sm" onClick={onOpenCreateClient}>
              + Retain Client
            </Button>
            <Button variant="primary" size="sm" onClick={onOpenCreateCase}>
              + New Case Record
            </Button>
          </div>
        </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <>
          {cases.length === 0 && (
            <div
              style={{
                padding: "24px 28px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #0A4A48 0%, #063C3D 100%)",
                color: "#FFFFFF",
                boxShadow: "0 4px 16px rgba(6, 60, 61, 0.15)",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                marginBottom: "8px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "20px" }}>🚀</span>
                    <h2 style={{ fontSize: "17px", fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>
                      Clean Slate Initial Setup • Day 0 Practice Ready
                    </h2>
                    <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "10px", background: "rgba(255,255,255,0.2)" }}>
                      0 Mock Cases Loaded
                    </span>
                  </div>
                  <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "#D1E7E1", maxWidth: "800px", lineHeight: "1.5" }}>
                    Your legal practice workspace is ready from scratch with zero pre-loaded cases or documents. Start by onboarding an applicant client, opening an immigration petition, and uploading evidence to experience the complete legal workflow.
                  </p>
                </div>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <Button variant="secondary" size="sm" onClick={onOpenCreateClient}>
                    1. + Retain Client
                  </Button>
                  <Button variant="primary" size="sm" onClick={onOpenCreateCase}>
                    2. + New Case Record
                  </Button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: "14px" }}>
                <div>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: 700, color: "#8AE0C8", letterSpacing: "0.05em" }}>Step 1: Retain Client</div>
                  <div style={{ fontSize: "12px", color: "#E0F2EE", marginTop: "2px" }}>Create applicant profile with contact, nationality, and passport verification.</div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: 700, color: "#8AE0C8", letterSpacing: "0.05em" }}>Step 2: Open Petition</div>
                  <div style={{ fontSize: "12px", color: "#E0F2EE", marginTop: "2px" }}>Select USCIS/IRCC/UK visa category, lead paralegal, and statutory deadline.</div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: 700, color: "#8AE0C8", letterSpacing: "0.05em" }}>Step 3: Upload Evidence</div>
                  <div style={{ fontSize: "12px", color: "#E0F2EE", marginTop: "2px" }}>Upload degree certificates, job letters, or passports for automated OCR parsing.</div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: 700, color: "#8AE0C8", letterSpacing: "0.05em" }}>Step 4: Real-time Readiness</div>
                  <div style={{ fontSize: "12px", color: "#E0F2EE", marginTop: "2px" }}>Track dynamic readiness scores advancing as statutory criteria are verified.</div>
                </div>
              </div>
            </div>
          )}

          {/* Key Metric Indicators with DEFINED MEANINGS and DRILL-DOWNS */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "16px",
            }}
          >
            <MetricCard
              label="Operational Health & Tenant Boundary"
              value="100% Strict"
              subtext="Zero cross-tenant leaks"
              meaning="Indicates that all database queries and document storage paths are strictly partitioned by organization_id with active server-side enforcement."
              onDrilldown={() => setActiveTab("audit")}
              drilldownLabel="View audit trace →"
              isLiveApi={isLiveBackend}
              statusBadge={<Badge variant="success" size="sm">Isolated</Badge>}
            />

            <MetricCard
              label="Active Caseload & Retained Clients"
              value={activeCasesCount}
              subtext={`${clients.length} retained applicants total`}
              meaning="Count of immigration petitions currently in progress across all caseworkers, excluding archived, closed, or denied cases."
              onDrilldown={() => setActiveTab("cases")}
              drilldownLabel="Filter active cases →"
              isLiveApi={isLiveBackend}
              trend={{ value: "+3 this month", isPositive: true }}
            />

            <MetricCard
              label="Cases Requiring Owner Attention"
              value={attentionCases.length}
              subtext={attentionCases.length > 0 ? "Requires review or RFE response" : "No urgent flags"}
              meaning="Petitions with flagged statutory evidentiary gaps, approaching statutory agency deadlines, or requiring attorney signoff."
              onDrilldown={() => {
                if (attentionCases.length > 0) onSelectCase(attentionCases[0]);
              }}
              drilldownLabel="Inspect priority case →"
              isLiveApi={isLiveBackend}
              trend={{ value: `${attentionCases.length} flagged`, isPositive: false }}
              statusBadge={<Badge variant={attentionCases.length > 0 ? "action" : "success"} size="sm">{attentionCases.length > 0 ? "Attention" : "Clear"}</Badge>}
            />

            <MetricCard
              label="Escrow & Retainer Revenue"
              value={`$${totalRevenue.toLocaleString()}`}
              subtext={`$${outstandingRevenue.toLocaleString()} pending escrow`}
              meaning="Realized revenue from completed filing milestones alongside funds held in attorney trust escrow."
              onDrilldown={() => setActiveTab("financials")}
              drilldownLabel="View billing ledger →"
              isLiveApi={isLiveBackend}
              trend={{ value: "100% Retainer Backed", isPositive: true }}
            />
          </div>

          {/* Pipeline by Processing Stage */}
          <Card
            title="Immigration Case Pipeline by Processing Stage"
            subtitle="Real-time distribution of petitions across intake, evidence gathering, review, and filing."
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "12px",
                marginTop: "6px",
              }}
            >
              {[
                { stage: "Intake", count: stageCounts.intake, color: "#64748b" },
                { stage: "Evidence Gathering", count: stageCounts.gathering, color: "#0284c7" },
                { stage: "Attorney Review", count: stageCounts.review, color: "#b45309" },
                { stage: "Package Assembly", count: stageCounts.assembly, color: "#1d4ed8" },
                { stage: "Ready for Signoff", count: stageCounts.ready, color: "#15803d" },
                { stage: "Filed with Agency", count: stageCounts.filed, color: "#475569" },
              ].map((item) => (
                <div
                  key={item.stage}
                  style={{
                    background: "var(--surface-subtle, #f8fafc)",
                    border: "1px solid var(--border, #e2e8f0)",
                    borderRadius: "8px",
                    padding: "14px",
                    textAlign: "center",
                  }}
                >
                  <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600, display: "block" }}>
                    {item.stage}
                  </span>
                  <strong style={{ fontSize: "24px", color: item.color, display: "block", margin: "6px 0" }}>
                    {item.count}
                  </strong>
                  <small style={{ color: "var(--quiet)", fontSize: "11px" }}>
                    {cases.length > 0 ? Math.round((item.count / cases.length) * 100) : 0}% of caseload
                  </small>
                </div>
              ))}
            </div>
          </Card>

          {/* Cases by Country & Pathway + Urgent Attention Cases */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "20px" }}>
            <Card
              title="Cases by Country & Jurisdiction"
              subtitle="Breakdown of petitions by target immigration authority."
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {Object.entries(countryCounts).length === 0 ? (
                  <div style={{ padding: "16px", textAlign: "center", color: "#64748B", fontSize: "12px", border: "1px dashed #CBD5E1", borderRadius: "6px" }}>
                    No applicant nationalities registered yet
                  </div>
                ) : (
                  Object.entries(countryCounts).map(([country, count]) => (
                    <div key={country} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                      <span style={{ color: "var(--text)", fontWeight: 600 }}>{country}</span>
                      <Badge variant="neutral">{count} petitions</Badge>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card
              title="Upcoming Deadlines & Priority Action Items"
              subtitle="Agency filing clocks and RFE response deadlines."
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {cases.length === 0 ? (
                  <div style={{ padding: "16px", textAlign: "center", color: "#64748B", fontSize: "12px", border: "1px dashed #CBD5E1", borderRadius: "6px" }}>
                    No Active Cases in Firm Workspace
                  </div>
                ) : (
                  cases.slice(0, 3).map((c) => (
                    <div
                      key={c.id}
                      onClick={() => onSelectCase(c)}
                      style={{
                        padding: "10px 12px",
                        background: "var(--surface-subtle, #f8fafc)",
                        border: "1px solid var(--border, #e2e8f0)",
                        borderRadius: "6px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: "pointer",
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: "13px", display: "block" }}>{c.case_number}</strong>
                        <span style={{ fontSize: "12px", color: "var(--muted)" }}>{c.client_name}</span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: c.attention_required ? "var(--critical)" : "var(--accent)" }}>
                          {c.deadline || "Standard"}
                        </span>
                        <small style={{ display: "block", color: "var(--quiet)" }}>Deadline</small>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </>
      )}

      {/* EXECUTIVE COMMAND CENTER TAB */}
      {activeTab === "executive" && (
        <ExecutiveCommandCenter
          isLiveBackend={isLiveBackend}
          onNavigateTab={(tab, filter) => {
            if (tab === "cases") setActiveTab("cases");
            else if (tab === "analytics") setActiveTab("analytics");
            else if (tab === "operations" || tab === "team") setActiveTab("operations");
            else if (tab === "billing" || tab === "financials") setActiveTab("billing");
            else if (tab === "audit") setActiveTab("audit");
          }}
          onSelectCase={(caseId) => {
            const found = cases.find((c) => c.id === caseId || c.case_number === caseId);
            if (found) {
              onSelectCase(found);
            } else if (cases.length > 0) {
              onSelectCase(cases[0]);
            }
          }}
        />
      )}

      {/* ANALYTICS TAB */}
      {activeTab === "analytics" && (
        <AnalyticsExplorer isLiveBackend={isLiveBackend} />
      )}

      {/* OPERATIONS & WORKLOAD TAB */}
      {activeTab === "operations" && (
        <BusinessOperationsHub isLiveBackend={isLiveBackend} />
      )}

      {/* RELIABILITY, PRIVACY & SECURITY TAB */}
      {activeTab === "reliability_ops" && (
        <OperationalReliabilityHub isLiveBackend={isLiveBackend} cases={cases} staff={capacity} />
      )}

      {/* STAGE 9 RELEASE & PILOT GOVERNANCE TAB */}
      {activeTab === "stage9_release_governance" && (
        <PilotReleaseGovernanceDesk
          userRole="company_admin"
          onNavigateToCase={(caseId) => {
            const found = cases.find((c) => c.id === caseId || c.case_number === caseId);
            if (found) onSelectCase(found);
          }}
        />
      )}

      {/* STAGE 10 PATHWAY EXPANSION & REGIONAL LOCALIZATION TAB */}
      {activeTab === "stage10_pathway_expansion" && (
        <PathwayExpansionDesk userRole="master_admin" />
      )}

      {/* BILLING & RETAINERS TAB */}
      {activeTab === "billing" && (
        <BillingManager userRole="owner" isLiveBackend={isLiveBackend} />
      )}

      {/* ALL CASES TAB */}
      {activeTab === "cases" && (
        <Card title="Comprehensive Firm Caseload" subtitle="Filter and inspect all active, filed, and in-review immigration petitions.">
          <DataTable
            columns={caseColumns}
            data={cases}
            keyExtractor={(c) => c.id}
            searchPlaceholder="Search case ref, client name, or title..."
            searchFields={["case_number", "title", "client_name", "visa_category"]}
            filterOptions={{
              label: "Stage",
              field: "status",
              options: [
                { label: "Intake", value: "intake" },
                { label: "Evidence Gathering", value: "gathering" },
                { label: "Review", value: "review" },
                { label: "Assembly", value: "assembly" },
                { label: "Ready for Filing", value: "ready" },
                { label: "Filed", value: "filed" },
              ],
            }}
            onRowClick={(c) => onSelectCase(c)}
          />
        </Card>
      )}

      {/* RETAINED CLIENTS TAB */}
      {activeTab === "clients" && (
        <Card
          title="Retained Applicant Directory & Portal Access Control"
          subtitle="All registered clients under organization representation. Credentials must be provided by Owner or Lead Paralegal for client portal sign-in."
          actions={
            <Button variant="primary" size="sm" onClick={onOpenCreateClient}>
              + Retain Client
            </Button>
          }
        >
          {clients.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "48px 24px",
                background: "#F8F7F2",
                border: "2px dashed #B9DED4",
                borderRadius: "12px",
                margin: "12px 0",
              }}
            >
              <div style={{ fontSize: "36px", marginBottom: "12px" }}>👤</div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#063C3D", marginBottom: "6px" }}>
                No Retained Clients in Firm Directory (Clean Slate)
              </h3>
              <p style={{ fontSize: "13px", color: "#6E7F7C", maxWidth: "520px", margin: "0 auto 20px auto", lineHeight: 1.5 }}>
                Zero client profiles are currently registered. Retained clients cannot log into Documento until an Owner or Lead Paralegal retains their record and provides their secure portal credentials.
              </p>
              <Button variant="primary" onClick={onOpenCreateClient}>
                + Retain First Client & Issue Credentials
              </Button>
            </div>
          ) : (
            <DataTable
              columns={[
                {
                  key: "name",
                  header: "Applicant Name",
                  render: (c) => (
                    <div>
                      <strong style={{ color: "#063C3D", display: "block" }}>{c.first_name} {c.last_name}</strong>
                      <span style={{ fontSize: "11px", color: "#6E7F7C" }}>ID: {c.id}</span>
                    </div>
                  ),
                },
                {
                  key: "email",
                  header: "Email Address",
                  render: (c) => <span style={{ fontWeight: 550, color: "#0D6866" }}>{c.email}</span>,
                },
                {
                  key: "nationality",
                  header: "Nationality",
                  render: (c) => <Badge variant="neutral">{c.nationality}</Badge>,
                },
                {
                  key: "phone",
                  header: "Telephone",
                  render: (c) => <span>{c.phone || "Not recorded"}</span>,
                },
                {
                  key: "created_at",
                  header: "Retained Date",
                  render: (c) => <span suppressHydrationWarning>{new Date(c.created_at).toLocaleDateString()}</span>,
                },
                {
                  key: "credentials_status",
                  header: "Portal Access",
                  render: (c) => (
                    <div>
                      {c.portal_credentials_provided ? (
                        <Badge variant="success" size="sm">
                          Active Credentials
                        </Badge>
                      ) : (
                        <Badge variant="warning" size="sm">
                          No Credentials (Blocked)
                        </Badge>
                      )}
                      {c.credentials_provisioned_by && (
                        <div style={{ fontSize: "10px", color: "#6E7F7C", marginTop: "2px" }}>
                          By {c.credentials_provisioned_by}
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  key: "actions",
                  header: "Action",
                  render: (c) => (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <Button
                        variant={c.portal_credentials_provided ? "outline" : "primary"}
                        size="sm"
                        onClick={() => {
                          setSelectedClientForCredentials(c);
                          setIsProvisionModalOpen(true);
                        }}
                      >
                        🔑 {c.portal_credentials_provided ? "Manage Credentials" : "Issue Credentials"}
                      </Button>
                      {canDelete && (
                        <Button
                          variant="danger"
                          size="sm"
                          id={`delete-client-${c.id}`}
                          aria-label={`Delete client ${c.first_name} ${c.last_name}`}
                          onClick={() => handleDeleteClientClick(c)}
                          style={{
                            background: "#FFF0F0",
                            color: "#D32F2F",
                            borderColor: "#FFCDD2",
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          🗑️ Delete Client
                        </Button>
                      )}
                    </div>
                  ),
                },
              ]}
              data={clients}
              keyExtractor={(c) => c.id}
            />
          )}
        </Card>
      )}

      {/* TEAM CAPACITY TAB */}
      {activeTab === "team" && (
        <Card title="Caseworker Workload & Review Capacity" subtitle="Monitor attorney caseload distribution and open peer reviews.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
            {capacity.map((member) => (
              <div
                key={member.id}
                style={{
                  border: "1px solid var(--border, #e2e8f0)",
                  borderRadius: "8px",
                  padding: "16px",
                  background: "var(--surface-subtle, #f8fafc)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div>
                  <strong style={{ fontSize: "15px", color: "var(--text)", display: "block" }}>{member.name}</strong>
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>{member.role}</span>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                    <span>Active Caseload</span>
                    <strong>{member.active_cases} / {member.max_capacity} cases</strong>
                  </div>
                  <div style={{ width: "100%", height: "6px", backgroundColor: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${Math.min((member.active_cases / member.max_capacity) * 100, 100)}%`,
                        height: "100%",
                        backgroundColor: member.active_cases >= member.max_capacity ? "var(--critical)" : "var(--accent)",
                      }}
                    />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--quiet)" }}>
                  <span>Open Document Reviews</span>
                  <Badge variant={member.open_reviews > 5 ? "warning" : "info"} size="sm">{member.open_reviews} pending</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* FINANCIALS TAB */}
      {activeTab === "financials" && (
        <Card title="Retainers, Invoices & Escrow Ledger" subtitle="Filing retainers and escrow balances where authorized by firm owner permissions.">
          <DataTable
            columns={[
              { key: "invoice_number", header: "Invoice #", render: (i) => <strong>{i.invoice_number}</strong> },
              { key: "client_name", header: "Client", render: (i) => <span>{i.client_name}</span> },
              { key: "case_number", header: "Case Ref", render: (i) => <span>{i.case_number}</span> },
              { key: "amount", header: "Amount", render: (i) => <strong>${i.amount.toLocaleString()}.00</strong> },
              { key: "status", header: "Payment Status", render: (i) => <Badge variant={i.status === "paid" ? "success" : i.status === "in_trust" ? "info" : "warning"}>{i.status.toUpperCase()}</Badge> },
              { key: "due_date", header: "Due Date", render: (i) => <span>{i.due_date}</span> },
            ]}
            data={invoices}
            keyExtractor={(i) => i.id}
          />
        </Card>
      )}

      {/* AUDIT ALERTS TAB */}
      {activeTab === "audit" && (
        <Card title="Append-Only Cryptographic Audit Log" subtitle="Tamper-evident system activity and multi-tenant boundary verifications.">
          <DataTable
            columns={[
              { key: "created_at", header: "Timestamp", render: (a) => <span style={{ fontFamily: "monospace", fontSize: "12px" }} suppressHydrationWarning>{new Date(a.created_at).toLocaleString()}</span> },
              { key: "action", header: "Security Action", render: (a) => <Badge variant="neutral">{a.action}</Badge> },
              { key: "object_id", header: "Target Entity", render: (a) => <strong>{a.object_id}</strong> },
              { key: "actor_email", header: "Actor Identity", render: (a) => <span>{a.actor_email}</span> },
              { key: "metadata", header: "Structured Event Metadata", render: (a) => <code style={{ fontSize: "11px", color: "var(--quiet)" }}>{JSON.stringify(a.metadata)}</code> },
            ]}
            data={auditEvents}
            keyExtractor={(a) => a.id}
          />
        </Card>
      )}

      {/* FIRM GOVERNANCE & CONFIGURATION TAB */}
      {activeTab === "firm_config" && (
        <FirmConfigurationHub />
      )}

      {/* RULES & AUTHORITIES TAB */}
      {activeTab === "rules" && (
        <RuleAdministrationHub isLiveBackend={isLiveBackend} />
      )}

      {/* MANAGER PRIORITY COMMAND BOARD (STRICT RANKS 1 TO 8) */}
      {activeTab === "manager_priority" && (
        <ManagerPriorityQueueView
          data={priorityQueueData}
          onAction={(rank, actionType, item) => {
            if (actionType === "dispatch_action" || actionType === "inspect_blocker" || actionType === "review_signoff") {
              setActiveTab("cases");
            } else if (actionType === "assign_caseworker" || actionType === "adjudicate_quality") {
              setActiveTab("operations");
            } else if (actionType === "dispatch_nudge") {
              setActiveTab("conversation_inspector");
            }
          }}
        />
      )}

      {/* OFFICER-CLIENT CONVERSATION INSPECTOR */}
      {activeTab === "conversation_inspector" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Header & Case Selector */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCE5E1",
              borderRadius: "12px",
              padding: "18px 22px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              boxShadow: "0 1px 4px rgba(6, 60, 61, 0.03)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <label style={{ fontSize: "13px", fontWeight: 700, color: "#063C3D" }}>
                Inspect Case Conversation:
              </label>
              <select
                value={selectedInspectorCaseId}
                onChange={(e) => setSelectedInspectorCaseId(e.target.value)}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid #B9DED4",
                  background: "#F8FAF9",
                  fontSize: "13px",
                  fontWeight: 650,
                  color: "#063C3D",
                  cursor: "pointer",
                }}
              >
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.case_number} — {c.client_name} ({c.visa_category}) • Lead: {c.assigned_manager || "Sarah Vance, Esq."}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: "6px" }}>
              {[
                { key: "all", label: "All Messages" },
                { key: "client_chat", label: "Client Chat" },
                { key: "internal_notes", label: "🔒 Internal Notes" },
              ].map((f) => {
                const active = inspectorChannelFilter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setInspectorChannelFilter(f.key as typeof inspectorChannelFilter)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: active ? 700 : 550,
                      background: active ? "#063C3D" : "#F4F6F5",
                      color: active ? "#FFFFFF" : "#445451",
                      border: "1px solid #DCE5E1",
                      cursor: "pointer",
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Authorization Notice */}
          <div
            style={{
              background: "#F0FDF4",
              border: "1px solid #BBF7D0",
              borderRadius: "8px",
              padding: "10px 14px",
              fontSize: "12px",
              color: "#166534",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>🔒</span>
            <span>
              <strong>Managing Partner Oversight Clearance:</strong> Full authorization to review case communications, audit trails, and quarantined legal work product pursuant to firm supervisory obligations.
            </span>
          </div>

          {/* Conversation Log Card */}
          <Card
            title={`Conversation History & Supervisory Log: ${cases.find((c) => c.id === selectedInspectorCaseId)?.case_number || (cases[0]?.case_number || "All Active Files")}`}
            subtitle="Immutable transcript of applicant messaging, caseworker updates, and managing partner directives."
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {cases.length === 0 ? (
                <div style={{ padding: "36px 20px", textAlign: "center", color: "#6E7F7C", background: "#F8F7F2", borderRadius: "8px" }}>
                  <div style={{ fontSize: "24px", marginBottom: "6px" }}>💬</div>
                  <strong style={{ fontSize: "14px", color: "#063C3D", display: "block" }}>No Conversation Messages Recorded</strong>
                  <p style={{ margin: "4px 0 0 0", fontSize: "12px" }}>
                    Day 0 Initial State: Retain a client or open a case to record immutable communications and supervisory directives.
                  </p>
                </div>
              ) : (
                <>
                  {[
                    {
                      id: "msg-1",
                      sender: cases.find((c) => c.id === selectedInspectorCaseId)?.client_name || "Dr. Elena Rostova",
                      role: "client",
                      text: "Hello Sarah, I have uploaded the revised Google Scholar citation analysis and our university press release for the O-1A filing.",
                      time: "March 24, 2026 at 10:15 AM",
                      avatar: "ER",
                    },
                    {
                      id: "msg-2",
                      sender: "Sarah Vance, Esq.",
                      role: "staff",
                      text: "Thank you Dr. Rostova. I have confirmed your citation count (h-index 24). Our paralegal Marcus is checking the referee independence documentation.",
                      time: "March 24, 2026 at 11:30 AM",
                      avatar: "SV",
                    },
                    {
                      id: "msg-3",
                      sender: "Marcus Jenkin",
                      role: "staff",
                      text: "Notice: The translation certificate for Dmitri's marriage record needs a certified translator signature. I have flagged this on the portal checklist.",
                      time: "March 24, 2026 at 02:45 PM",
                      avatar: "MJ",
                    },
                    {
                      id: "msg-4",
                      sender: "Sarah Vance, Esq.",
                      role: "internal_note",
                      text: "🔒 [QUARANTINED INTERNAL NOTE] Client's referee letters look solid for Criterion 5 (Major Significance). We need to ensure we distinguish referee independence under Kazarian v. USCIS.",
                      time: "March 24, 2026 at 04:00 PM",
                      avatar: "SV",
                    },
                  ]
                    .filter((m) => {
                      if (inspectorChannelFilter === "client_chat") return m.role !== "internal_note";
                      if (inspectorChannelFilter === "internal_notes") return m.role === "internal_note";
                      return true;
                    })
                    .map((m) => {
                      const isInternal = m.role === "internal_note";
                      const isClient = m.role === "client";

                      return (
                        <div
                          key={m.id}
                          style={{
                            padding: "12px 16px",
                            borderRadius: "10px",
                            background: isInternal ? "#FEF3C7" : isClient ? "#F1F5F9" : "#EAF6F0",
                            border: `1px solid ${isInternal ? "#FDE68A" : isClient ? "#CBD5E1" : "#B9DED4"}`,
                            alignSelf: isClient ? "flex-start" : "flex-end",
                            maxWidth: "85%",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <strong style={{ fontSize: "12px", color: "#063C3D" }}>{m.sender}</strong>
                              <Badge variant={isInternal ? "warning" : isClient ? "neutral" : "success"} size="sm">
                                {isInternal ? "INTERNAL WORK NOTE" : isClient ? "APPLICANT" : "CASE OFFICER"}
                              </Badge>
                            </div>
                            <span style={{ fontSize: "11px", color: "#64748B" }}>{m.time}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: "13px", color: isInternal ? "#78350F" : "#1E293B", lineHeight: "1.4" }}>
                            {m.text}
                          </p>
                        </div>
                      );
                    })}

                  {supervisoryNotes.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        padding: "12px 16px",
                        borderRadius: "10px",
                        background: "#FEF3C7",
                        border: "1px solid #FDE68A",
                        alignSelf: "flex-end",
                        maxWidth: "85%",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <strong style={{ fontSize: "12px", color: "#063C3D" }}>{n.author}</strong>
                          <Badge variant="warning" size="sm">SUPERVISORY DIRECTIVE</Badge>
                        </div>
                        <span style={{ fontSize: "11px", color: "#64748B" }}>{new Date(n.timestamp).toLocaleDateString()}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: "13px", color: "#78350F", lineHeight: "1.4" }}>
                        {n.note}
                      </p>
                    </div>
                  ))}
                </>
              )}

              {/* Supervisory Partner Guidance Input */}
              <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "14px", marginTop: "8px" }}>
                <strong style={{ fontSize: "13px", color: "#063C3D", display: "block", marginBottom: "8px" }}>
                  Record Supervisory Managing Partner Directive:
                </strong>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    value={supervisoryNoteInput}
                    onChange={(e) => setSupervisoryNoteInput(e.target.value)}
                    placeholder="Enter confidential managing partner direction for the case team..."
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      fontSize: "13px",
                    }}
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      if (!supervisoryNoteInput.trim()) return;
                      const newNote = {
                        id: `sup-${Date.now()}`,
                        author: "Managing Partner",
                        note: supervisoryNoteInput.trim(),
                        timestamp: new Date().toISOString(),
                      };
                      const updated = [...supervisoryNotes, newNote];
                      setSupervisoryNotes(updated);
                      if (typeof window !== "undefined") {
                        localStorage.setItem("documento_supervisory_notes", JSON.stringify(updated));
                      }
                      setSupervisoryNoteInput("");
                    }}
                  >
                    Post Directive
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </main>

    {/* Provision Client Portal Credentials Modal */}
    <ProvisionCredentialsModal
      isOpen={isProvisionModalOpen}
      onClose={() => {
        setIsProvisionModalOpen(false);
        setSelectedClientForCredentials(null);
      }}
      client={selectedClientForCredentials}
      onCredentialsUpdated={(updated) => {
        onClientUpdated?.(updated);
        setIsProvisionModalOpen(false);
        setSelectedClientForCredentials(null);
      }}
      activeRole="master_admin"
    />
  </div>
  );
}
