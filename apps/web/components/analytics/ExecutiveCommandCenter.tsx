import React, { useState, useEffect } from "react";
import { MetricCard } from "../common/MetricCard";
import { Card } from "../common/Card";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { Modal } from "../common/Modal";
import { ExecutiveDashboardData, MetricDefinition } from "../../lib/types";
import { fetchExecutiveDashboard } from "../../lib/api";

interface ExecutiveCommandCenterProps {
  initialData?: ExecutiveDashboardData;
  isLiveBackend: boolean;
  onNavigateTab: (tab: string, filter?: any) => void;
  onSelectCase?: (caseId: string) => void;
}

export function ExecutiveCommandCenter({
  initialData,
  isLiveBackend,
  onNavigateTab,
  onSelectCase,
}: ExecutiveCommandCenterProps) {
  const [data, setData] = useState<ExecutiveDashboardData | null>(initialData || null);
  const [windowDays, setWindowDays] = useState<number>(30);
  const [isLoading, setIsLoading] = useState<boolean>(!initialData);
  const [isDictionaryOpen, setIsDictionaryOpen] = useState<boolean>(false);
  const [activeMetricDetail, setActiveMetricDetail] = useState<{
    title: string;
    metric: MetricDefinition<any>;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      try {
        const res = await fetchExecutiveDashboard(windowDays);
        if (isMounted) setData(res);
      } catch (err) {
        console.error("Failed to load executive dashboard data", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [windowDays]);

  if (!data) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
        Loading executive command center metrics...
      </div>
    );
  }

  const m = data.metrics;

  const renderStatusBadge = (status: string) => {
    if (status === "available") {
      return (
        <Badge variant="success" size="sm">
          Verified DB
        </Badge>
      );
    }
    return (
      <Badge variant="warning" size="sm">
        Source Data Pending
      </Badge>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }} id="executive-command-center">
      {/* Top Header & Operational Filters */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          background: "var(--surface, #ffffff)",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: "12px",
          padding: "16px 20px",
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "var(--text)" }}>
              Executive Operational Command Center
            </h2>
            <Badge variant={isLiveBackend ? "success" : "neutral"} size="sm">
              {isLiveBackend ? "Connected Live DB" : "Verified Snapshot"}
            </Badge>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--muted)" }}>
            Database-backed operational telemetry across firm caseload, deadlines, capacity, and revenue.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Time Window Switcher */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
            <span style={{ color: "var(--muted)", fontWeight: 500 }}>Time Window:</span>
            {[7, 30, 90, 180].map((days) => (
              <button
                key={days}
                id={`btn-window-${days}d`}
                onClick={() => setWindowDays(days)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--border, #e2e8f0)",
                  background: windowDays === days ? "var(--primary, #0f172a)" : "var(--surface, #ffffff)",
                  color: windowDays === days ? "#ffffff" : "var(--text)",
                  fontWeight: 600,
                  fontSize: "12px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {days}d
              </button>
            ))}
          </div>

          <Button
            id="btn-metric-dictionary"
            variant="outline"
            size="sm"
            onClick={() => setIsDictionaryOpen(true)}
          >
            📖 Metric Formulas
          </Button>
        </div>
      </div>

      {/* Primary 4 High-Impact KPI Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "16px",
        }}
      >
        {/* Metric 1: Active Cases */}
        <MetricCard
          label="Active Petitions in Progress"
          value={m.active_cases.value}
          subtext={`${m.active_cases.total_cases} total across all statuses`}
          meaning={m.active_cases.calculation_method}
          onDrilldown={() => onNavigateTab("cases", { status: "active" })}
          drilldownLabel="Inspect active caseload →"
          isLiveApi={isLiveBackend}
          statusBadge={renderStatusBadge(m.active_cases.status)}
          trend={{ value: `${m.active_cases.time_window}`, isPositive: true }}
        />

        {/* Metric 2: New Retained Clients */}
        <MetricCard
          label="New Retained Clients"
          value={m.new_retained_clients.value}
          subtext={`${m.new_retained_clients.total_clients} all-time active client profiles`}
          meaning={m.new_retained_clients.calculation_method}
          onDrilldown={() => onNavigateTab("operations")}
          drilldownLabel="View client retainers →"
          isLiveApi={isLiveBackend}
          statusBadge={renderStatusBadge(m.new_retained_clients.status)}
          trend={{ value: `+${m.new_retained_clients.value} in ${m.new_retained_clients.time_window}`, isPositive: true }}
        />

        {/* Metric 5: Cases Needing Attention */}
        <MetricCard
          label="Cases Needing Immediate Attention"
          value={m.cases_needing_attention.value}
          subtext={
            m.cases_needing_attention.value > 0
              ? `${m.cases_needing_attention.value} flagged for statutory gaps or RFE risk`
              : "All petitions cleared of high-severity flags"
          }
          meaning={m.cases_needing_attention.calculation_method}
          onDrilldown={() => {
            const firstFlagged = m.cases_needing_attention.items?.[0];
            if (firstFlagged && onSelectCase) {
              onSelectCase(firstFlagged.case_id);
            } else {
              onNavigateTab("cases", { attention: true });
            }
          }}
          drilldownLabel="Review urgent attention cases →"
          isLiveApi={isLiveBackend}
          statusBadge={
            <Badge variant={m.cases_needing_attention.value > 0 ? "critical" : "success"} size="sm">
              {m.cases_needing_attention.value > 0 ? "Requires Action" : "Clear"}
            </Badge>
          }
        />

        {/* Metric 6: Deadlines & Overdue Clocks */}
        <MetricCard
          label="Statutory Agency Deadlines"
          value={m.deadlines.total_overdue}
          subtext={`${m.deadlines.total_upcoming} upcoming within 14 days`}
          meaning={m.deadlines.calculation_method}
          onDrilldown={() => onNavigateTab("analytics", { view: "deadlines" })}
          drilldownLabel="Audit filing clocks →"
          isLiveApi={isLiveBackend}
          statusBadge={
            <Badge variant={m.deadlines.total_overdue > 0 ? "critical" : "info"} size="sm">
              {m.deadlines.total_overdue > 0 ? `${m.deadlines.total_overdue} Overdue` : "On Schedule"}
            </Badge>
          }
        />
      </div>

      {/* Row 2: Caseload Distributions & Readiness Pipeline */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "20px" }}>
        {/* Metric 4: Workflow Stage Pipeline */}
        <Card
          title="Cases by Workflow Stage"
          subtitle={`Current pipeline distribution (Formula: ${m.cases_by_workflow_stage.calculation_method})`}
          badge={renderStatusBadge(m.cases_by_workflow_stage.status)}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
              gap: "10px",
              marginTop: "8px",
            }}
          >
            {Object.entries(m.cases_by_workflow_stage.stages || {}).map(([stage, count]) => (
              <div
                key={stage}
                id={`stage-card-${stage}`}
                onClick={() => onNavigateTab("cases", { status: stage })}
                style={{
                  background: "var(--surface-subtle, #f8fafc)",
                  border: "1px solid var(--border, #e2e8f0)",
                  borderRadius: "8px",
                  padding: "12px 10px",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--muted)",
                    display: "block",
                  }}
                >
                  {stage}
                </span>
                <strong style={{ fontSize: "22px", color: "var(--text)", display: "block", margin: "4px 0" }}>
                  {count}
                </strong>
                <small style={{ color: "var(--accent, #0284c7)", fontSize: "11px", fontWeight: 600 }}>
                  View →
                </small>
              </div>
            ))}
          </div>
        </Card>

        {/* Metric 3: Jurisdiction & Pathway Distribution */}
        <Card
          title="Cases by Country & Pathway"
          subtitle={`Geographic breakdown & visa categories (${m.cases_by_country_and_pathway.calculation_method})`}
          badge={renderStatusBadge(m.cases_by_country_and_pathway.status)}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "4px" }}>
            <div>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "8px" }}>
                Target Jurisdictions
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {Object.entries(m.cases_by_country_and_pathway.by_country || {}).map(([country, count]) => (
                  <div
                    key={country}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      background: "var(--surface-subtle, #f8fafc)",
                      fontSize: "13px",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{country}</span>
                    <Badge variant="neutral">{count} cases</Badge>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "8px" }}>
                Top Pathways
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {Object.entries(m.cases_by_country_and_pathway.by_pathway || {}).map(([pathway, count]) => (
                  <div
                    key={pathway}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      background: "var(--surface-subtle, #f8fafc)",
                      fontSize: "13px",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{pathway}</span>
                    <Badge variant="neutral">{count}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Row 3: Operational Capacity & Workload Balance */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "20px" }}>
        {/* Metric 7: Unassigned Cases */}
        <Card
          title="Unassigned Cases"
          subtitle={m.unassigned_cases.calculation_method}
          badge={
            <Badge variant={m.unassigned_cases.value > 0 ? "warning" : "success"} size="sm">
              {m.unassigned_cases.value} Unassigned
            </Badge>
          }
        >
          {m.unassigned_cases.sample && m.unassigned_cases.sample.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {m.unassigned_cases.sample.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    border: "1px solid var(--border, #e2e8f0)",
                    borderRadius: "6px",
                    background: "var(--surface-subtle, #f8fafc)",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "13px", display: "block" }}>{item.case_number}</strong>
                    <span style={{ fontSize: "12px", color: "var(--muted)" }}>{item.title}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigateTab("operations", { assignCaseId: item.id })}
                  >
                    Assign →
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: "16px", textAlign: "center", color: "var(--success, #16a34a)", fontSize: "13px" }}>
              ✓ All open petitions have designated responsible staff.
            </div>
          )}
        </Card>

        {/* Metric 8: Staff Workload & Capacity */}
        <Card
          title="Staff Capacity & Workload"
          subtitle={`Caseload distribution vs nominal target capacity (${m.staff_workload_and_capacity.calculation_method})`}
          badge={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigateTab("operations")}
              style={{ fontSize: "12px", padding: "2px 8px" }}
            >
              Manage Teams →
            </Button>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {(m.staff_workload_and_capacity.staff_members || []).slice(0, 4).map((member) => (
              <div
                key={member.user_id}
                style={{
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border, #e2e8f0)",
                  background: member.status === "overloaded" ? "#fff1f2" : "var(--surface-subtle, #f8fafc)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <div>
                    <strong style={{ fontSize: "13px", display: "block" }}>{member.full_name}</strong>
                    <small style={{ color: "var(--muted)" }}>{member.roles.join(", ")}</small>
                  </div>
                  <Badge variant={member.status === "overloaded" ? "critical" : "neutral"} size="sm">
                    {member.utilization_pct}% Load
                  </Badge>
                </div>
                <div style={{ width: "100%", height: "6px", backgroundColor: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${Math.min(member.utilization_pct, 100)}%`,
                      height: "100%",
                      backgroundColor: member.status === "overloaded" ? "var(--critical, #e11d48)" : "var(--accent, #0284c7)",
                    }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--quiet)", marginTop: "4px" }}>
                  <span>{member.assigned_cases} cases assigned</span>
                  <span>{member.pending_tasks} pending tasks</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Metric 9: Applications Prepared, Reviewed & Submitted */}
        <Card
          title="Filing Package Pipeline"
          subtitle={m.applications_prepared_reviewed_submitted.calculation_method}
          badge={renderStatusBadge(m.applications_prepared_reviewed_submitted.status)}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginTop: "12px" }}>
            <div style={{ textAlign: "center", padding: "12px 6px", background: "var(--surface-subtle)", borderRadius: "8px" }}>
              <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>PREPARED</span>
              <strong style={{ fontSize: "20px", display: "block", color: "var(--text)", margin: "4px 0" }}>
                {m.applications_prepared_reviewed_submitted.prepared}
              </strong>
              <small style={{ fontSize: "10px", color: "var(--quiet)" }}>Draft packages</small>
            </div>
            <div style={{ textAlign: "center", padding: "12px 6px", background: "var(--surface-subtle)", borderRadius: "8px" }}>
              <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>REVIEWED</span>
              <strong style={{ fontSize: "20px", display: "block", color: "#b45309", margin: "4px 0" }}>
                {m.applications_prepared_reviewed_submitted.reviewed}
              </strong>
              <small style={{ fontSize: "10px", color: "var(--quiet)" }}>Signed by Atty</small>
            </div>
            <div style={{ textAlign: "center", padding: "12px 6px", background: "var(--surface-subtle)", borderRadius: "8px" }}>
              <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>SUBMITTED</span>
              <strong style={{ fontSize: "20px", display: "block", color: "#15803d", margin: "4px 0" }}>
                {m.applications_prepared_reviewed_submitted.submitted}
              </strong>
              <small style={{ fontSize: "10px", color: "var(--quiet)" }}>Filed with USCIS</small>
            </div>
          </div>
        </Card>
      </div>

      {/* Row 4: Quality & Compliance Guardrails */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "20px" }}>
        {/* Metric 10: Outstanding Client Requests */}
        <Card
          title="Outstanding Client Requests"
          subtitle={m.outstanding_client_requests.calculation_method}
          badge={
            <Badge variant={m.outstanding_client_requests.value > 5 ? "warning" : "neutral"} size="sm">
              {m.outstanding_client_requests.value} Pending
            </Badge>
          }
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0" }}>
            <div>
              <span style={{ fontSize: "13px", color: "var(--muted)" }}>Average Turnaround Lag:</span>
              <strong style={{ display: "block", fontSize: "20px", color: "var(--text)" }}>
                {m.outstanding_client_requests.avg_days_pending} days
              </strong>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigateTab("cases", { filter: "requests_pending" })}
            >
              View Requests →
            </Button>
          </div>
        </Card>

        {/* Metric 11: Processing Failures */}
        <Card
          title="Document & Processing Failures"
          subtitle={m.processing_failures.calculation_method}
          badge={
            <Badge variant={m.processing_failures.total_failures > 0 ? "critical" : "success"} size="sm">
              {m.processing_failures.total_failures > 0 ? `${m.processing_failures.total_failures} Failures` : "Clean"}
            </Badge>
          }
        >
          <div style={{ display: "flex", justifyContent: "space-around", textAlign: "center", padding: "10px 0" }}>
            <div>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>Document OCR / Scan</span>
              <strong style={{ display: "block", fontSize: "18px", color: m.processing_failures.failed_documents > 0 ? "var(--critical)" : "var(--text)" }}>
                {m.processing_failures.failed_documents}
              </strong>
            </div>
            <div style={{ borderLeft: "1px solid var(--border)", paddingLeft: "20px" }}>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>Notification Delivery</span>
              <strong style={{ display: "block", fontSize: "18px", color: m.processing_failures.failed_notifications > 0 ? "var(--critical)" : "var(--text)" }}>
                {m.processing_failures.failed_notifications}
              </strong>
            </div>
          </div>
        </Card>

        {/* Metric 13: Financial Snapshot */}
        <Card
          title="Revenue & Receivables Snapshot"
          subtitle={m.financial_snapshot.calculation_method}
          badge={
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigateTab("financials")}
              style={{ fontSize: "12px" }}
            >
              Billing Center →
            </Button>
          }
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0" }}>
            <div>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>Paid Collections</span>
              <strong style={{ display: "block", fontSize: "20px", color: "var(--success, #16a34a)" }}>
                ${m.financial_snapshot.paid_revenue.toLocaleString()} {m.financial_snapshot.currency}
              </strong>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>Outstanding Invoices</span>
              <strong style={{ display: "block", fontSize: "20px", color: "var(--accent, #b45309)" }}>
                ${m.financial_snapshot.outstanding_balance.toLocaleString()} {m.financial_snapshot.currency}
              </strong>
            </div>
          </div>
        </Card>
      </div>

      {/* Metric 12: Recent Company Activity Stream */}
      <Card
        title="Recent Company Audit & Activity Stream"
        subtitle={`Immutable append-only telemetry (${m.recent_company_activity.calculation_method})`}
        badge={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigateTab("audit")}
          >
            Full Audit Log →
          </Button>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "6px" }}>
          {(m.recent_company_activity.items || []).slice(0, 5).map((act) => (
            <div
              key={act.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                borderRadius: "6px",
                background: "var(--surface-subtle, #f8fafc)",
                fontSize: "13px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Badge variant="neutral" size="sm">
                  {act.action}
                </Badge>
                <span style={{ color: "var(--text)", fontWeight: 500 }}>
                  {act.object_type}: {act.object_id}
                </span>
              </div>
              <span style={{ color: "var(--quiet)", fontSize: "12px", fontFamily: "monospace" }}>
                {new Date(act.occurred_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* METRIC CALCULATION DICTIONARY MODAL */}
      <Modal
        isOpen={isDictionaryOpen}
        onClose={() => setIsDictionaryOpen(false)}
        title="Executive Metrics Dictionary & Statutory Formula Specifications"
        subtitle="Full transparency into database queries, aggregation logic, time-windows, and data sources for all 12 executive dashboard indicators."
        maxWidth="lg"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxHeight: "65vh", overflowY: "auto" }}>
          {[
            { name: "Active Cases", def: m.active_cases },
            { name: "New Retained Clients", def: m.new_retained_clients },
            { name: "Cases by Country & Pathway", def: m.cases_by_country_and_pathway },
            { name: "Cases by Workflow Stage", def: m.cases_by_workflow_stage },
            { name: "Cases Needing Attention", def: m.cases_needing_attention },
            { name: "Upcoming & Overdue Deadlines", def: m.deadlines },
            { name: "Unassigned Cases", def: m.unassigned_cases },
            { name: "Staff Workload & Capacity", def: m.staff_workload_and_capacity },
            { name: "Applications Prepared / Reviewed / Submitted", def: m.applications_prepared_reviewed_submitted },
            { name: "Outstanding Client Requests", def: m.outstanding_client_requests },
            { name: "Processing Failures", def: m.processing_failures },
            { name: "Recent Company Activity", def: m.recent_company_activity },
            { name: "Financial Snapshot", def: m.financial_snapshot },
          ].map(({ name, def }) => (
            <div
              key={name}
              style={{
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: "8px",
                padding: "12px 14px",
                background: "var(--surface-subtle, #f8fafc)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <strong style={{ fontSize: "14px", color: "var(--text)" }}>{name}</strong>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <Badge variant="neutral" size="sm">
                    Window: {def.time_window}
                  </Badge>
                  {renderStatusBadge(def.status)}
                </div>
              </div>
              <p style={{ margin: "4px 0", fontSize: "13px", color: "var(--muted)", lineHeight: 1.4 }}>
                <strong>Mathematical Formula / Query:</strong> {def.calculation_method}
              </p>
              <div style={{ fontSize: "12px", color: "var(--quiet)", marginTop: "4px" }}>
                <span>Drill-down target: <code>{def.drill_down_path}</code></span>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
