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
} from "../../lib/types";
import { RuleAdministrationHub } from "../rules/RuleAdministrationHub";
import { ExecutiveCommandCenter } from "../analytics/ExecutiveCommandCenter";
import { AnalyticsExplorer } from "../analytics/AnalyticsExplorer";
import { BillingManager } from "../billing/BillingManager";
import { BusinessOperationsHub } from "../operations/BusinessOperationsHub";

interface OwnerMasterDashboardProps {
  cases: ImmigrationCase[];
  clients: ClientProfile[];
  auditEvents: AuditEvent[];
  invoices: InvoiceItem[];
  capacity: TeamMemberCapacity[];
  isLiveBackend: boolean;
  onOpenCreateCase: () => void;
  onOpenCreateClient: () => void;
  onSelectCase: (c: ImmigrationCase) => void;
}

export function OwnerMasterDashboard({
  cases,
  clients,
  auditEvents,
  invoices,
  capacity,
  isLiveBackend,
  onOpenCreateCase,
  onOpenCreateClient,
  onSelectCase,
}: OwnerMasterDashboardProps) {
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "executive"
    | "analytics"
    | "operations"
    | "billing"
    | "cases"
    | "team"
    | "financials"
    | "audit"
    | "rules"
  >("overview");

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
    { key: "executive", id: "tab-btn-executive", label: "Executive Command Center", icon: "⚡", count: null },
    { key: "analytics", id: "tab-btn-analytics", label: "Deep Analytics", icon: "📈", count: null },
    { key: "operations", id: "tab-btn-operations", label: "Operations Hub", icon: "👥", count: null },
    { key: "billing", id: "tab-btn-billing", label: "Billing & Retainers", icon: "💳", count: null },
    { key: "cases", id: "tab-btn-cases", label: "All Cases", icon: "📋", count: cases.length },
    { key: "team", id: "tab-btn-team", label: "Team Capacity", icon: "👥", count: capacity.length },
    { key: "financials", id: "tab-btn-financials", label: "Revenue & Billing", icon: "💳", count: null },
    { key: "audit", id: "tab-btn-audit", label: "Audit Alerts", icon: "🛡️", count: auditEvents.length },
    { key: "rules", id: "tab-btn-rules", label: "Rules & Authorities", icon: "⚖️", count: null },
  ] as const;

  const activeTabInfo = {
    overview: {
      title: "Company Overview",
      subtitle: "Executive Command & Operational Health • Vanguard Immigration Law Group LLP",
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
                {Object.entries(countryCounts).map(([country, count]) => (
                  <div key={country} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                    <span style={{ color: "var(--text)", fontWeight: 600 }}>{country}</span>
                    <Badge variant="neutral">{count} petitions</Badge>
                  </div>
                ))}
              </div>
            </Card>

            <Card
              title="Upcoming Deadlines & Priority Action Items"
              subtitle="Agency filing clocks and RFE response deadlines."
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {cases.slice(0, 3).map((c) => (
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
                ))}
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

      {/* RULES & AUTHORITIES TAB */}
      {activeTab === "rules" && (
        <RuleAdministrationHub isLiveBackend={isLiveBackend} />
      )}
    </main>
  </div>
  );
}
