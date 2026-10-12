import React, { useState, useEffect } from "react";
import { Card } from "../common/Card";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { MetricCard } from "../common/MetricCard";
import { OperationsAnalyticsData } from "../../lib/types";
import { fetchOperationsAnalytics, exportAnalyticsReport } from "../../lib/api";

interface AnalyticsExplorerProps {
  initialData?: OperationsAnalyticsData;
  isLiveBackend: boolean;
}

export function AnalyticsExplorer({
  initialData,
  isLiveBackend,
}: AnalyticsExplorerProps) {
  const [data, setData] = useState<OperationsAnalyticsData | null>(initialData || null);
  const [isLoading, setIsLoading] = useState<boolean>(!initialData);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Filter states
  const [filters, setFilters] = useState({
    date_preset: "last_90d",
    start_date: "",
    end_date: "",
    jurisdiction: "all",
    pathway: "all",
    stage: "all",
    team_member: "all",
    branch: "all",
    service_type: "all",
  });

  const loadAnalytics = async (customFilters = filters) => {
    setIsLoading(true);
    try {
      const res = await fetchOperationsAnalytics(customFilters);
      setData(res);
    } catch (err) {
      console.error("Failed to load operations analytics", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const handleFilterChange = (key: string, value: string) => {
    const updated = { ...filters, [key]: value };
    setFilters(updated);
  };

  const handleApplyFilters = () => {
    loadAnalytics(filters);
  };

  const handleResetFilters = () => {
    const reset = {
      date_preset: "all_time",
      start_date: "",
      end_date: "",
      jurisdiction: "all",
      pathway: "all",
      stage: "all",
      team_member: "all",
      branch: "all",
      service_type: "all",
    };
    setFilters(reset);
    loadAnalytics(reset);
  };

  const handleExport = async (reportType: string) => {
    setIsExporting(true);
    setExportNotice(null);
    try {
      const res = await exportAnalyticsReport(reportType);
      setExportNotice(
        `✓ Report '${reportType}' generated and audit-logged (Export Ref: ${res.export_id || "EXP-AUDIT"}).`
      );
      setTimeout(() => setExportNotice(null), 6000);
    } catch (err) {
      setExportNotice("Failed to generate export report.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }} id="analytics-explorer">
      {/* Top Header */}
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
              Firm Operations & Caseload Analytics
            </h2>
            <Badge variant="neutral" size="sm">
              Multi-Dimensional
            </Badge>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--muted)" }}>
            Deep-dive operational metrics including adjusted turnaround time, tiered overdue queues, and client responsiveness.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <Button
            id="btn-export-analytics-summary"
            variant="outline"
            size="sm"
            onClick={() => handleExport("operations_analytics_summary")}
            disabled={isExporting}
          >
            {isExporting ? "Exporting..." : "📥 Export Analytics Audit Report"}
          </Button>
        </div>
      </div>

      {exportNotice && (
        <div
          id="export-notice-banner"
          style={{
            padding: "12px 16px",
            background: "#ecfdf5",
            border: "1px solid #6ee7b7",
            borderRadius: "8px",
            color: "#065f46",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          {exportNotice}
        </div>
      )}

      {/* Comprehensive Filter Bar */}
      <Card
        title="Multi-Dimensional Filters"
        subtitle="Filter operations metrics across jurisdiction, pathway, workflow stage, personnel, and branch."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "14px",
            marginTop: "8px",
          }}
        >
          {/* Date Window */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
              Date Range
            </label>
            <select
              id="select-filter-date"
              value={filters.date_preset}
              onChange={(e) => handleFilterChange("date_preset", e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "6px",
                border: "1px solid var(--border, #cbd5e1)",
                fontSize: "13px",
                background: "var(--surface, #ffffff)",
              }}
            >
              <option value="last_30d">Last 30 Days</option>
              <option value="last_90d">Last 90 Days</option>
              <option value="ytd">Year to Date (YTD)</option>
              <option value="all_time">All Time</option>
            </select>
          </div>

          {/* Country / Jurisdiction */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
              Country / Jurisdiction
            </label>
            <select
              id="select-filter-jurisdiction"
              value={filters.jurisdiction}
              onChange={(e) => handleFilterChange("jurisdiction", e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "6px",
                border: "1px solid var(--border, #cbd5e1)",
                fontSize: "13px",
                background: "var(--surface, #ffffff)",
              }}
            >
              <option value="all">All Jurisdictions</option>
              <option value="US">United States (USCIS)</option>
              <option value="UK">United Kingdom (Home Office)</option>
              <option value="CA">Canada (IRCC)</option>
              <option value="DE">Germany (BAMF)</option>
              <option value="AU">Australia (DoHA)</option>
            </select>
          </div>

          {/* Pathway */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
              Pathway / Category
            </label>
            <select
              id="select-filter-pathway"
              value={filters.pathway}
              onChange={(e) => handleFilterChange("pathway", e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "6px",
                border: "1px solid var(--border, #cbd5e1)",
                fontSize: "13px",
                background: "var(--surface, #ffffff)",
              }}
            >
              <option value="all">All Pathways</option>
              <option value="O-1A">O-1A Extraordinary Ability</option>
              <option value="EB-1A">EB-1A Alien of Extraordinary Ability</option>
              <option value="EB-2 NIW">EB-2 National Interest Waiver</option>
              <option value="H-1B">H-1B Specialty Occupation</option>
              <option value="Skilled Worker">UK Skilled Worker</option>
              <option value="Express Entry">Canada Express Entry</option>
            </select>
          </div>

          {/* Case Stage */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
              Workflow Stage
            </label>
            <select
              id="select-filter-stage"
              value={filters.stage}
              onChange={(e) => handleFilterChange("stage", e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "6px",
                border: "1px solid var(--border, #cbd5e1)",
                fontSize: "13px",
                background: "var(--surface, #ffffff)",
              }}
            >
              <option value="all">All Stages</option>
              <option value="intake">Intake</option>
              <option value="gathering">Evidence Gathering</option>
              <option value="review">Attorney Review</option>
              <option value="assembly">Package Assembly</option>
              <option value="ready">Ready for Filing</option>
              <option value="filed">Filed with Agency</option>
            </select>
          </div>

          {/* Team Member */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
              Team Member / Assignee
            </label>
            <select
              id="select-filter-team-member"
              value={filters.team_member}
              onChange={(e) => handleFilterChange("team_member", e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "6px",
                border: "1px solid var(--border, #cbd5e1)",
                fontSize: "13px",
                background: "var(--surface, #ffffff)",
              }}
            >
              <option value="all">All Team Members</option>
              <option value="user-atty-01">Sarah Jenkins (Managing Attorney)</option>
              <option value="user-para-01">Michael Chang (Senior Paralegal)</option>
              <option value="user-spec-01">Elena Rostova (Compliance Specialist)</option>
              <option value="user-atty-02">David Vance (Associate Attorney)</option>
            </select>
          </div>

          {/* Branch */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
              Office Branch
            </label>
            <select
              id="select-filter-branch"
              value={filters.branch}
              onChange={(e) => handleFilterChange("branch", e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "6px",
                border: "1px solid var(--border, #cbd5e1)",
                fontSize: "13px",
                background: "var(--surface, #ffffff)",
              }}
            >
              <option value="all">All Branches</option>
              <option value="branch-ny">New York Headquarters</option>
              <option value="branch-lon">London Office</option>
              <option value="branch-tor">Toronto Branch</option>
            </select>
          </div>

          {/* Service Type */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
              Service Type
            </label>
            <select
              id="select-filter-service"
              value={filters.service_type}
              onChange={(e) => handleFilterChange("service_type", e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "6px",
                border: "1px solid var(--border, #cbd5e1)",
                fontSize: "13px",
                background: "var(--surface, #ffffff)",
              }}
            >
              <option value="all">All Service Types</option>
              <option value="srv-petition">Full Petition Preparation</option>
              <option value="srv-review">Attorney Document Review</option>
              <option value="srv-rfe">RFE Defense & Response</option>
              <option value="srv-consular">Consular Support</option>
            </select>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
          <Button variant="ghost" size="sm" onClick={handleResetFilters}>
            Reset Filters
          </Button>
          <Button id="btn-apply-analytics-filters" variant="primary" size="sm" onClick={handleApplyFilters}>
            Apply Filters
          </Button>
        </div>
      </Card>

      {/* Analytical Results Grid */}
      {data && (
        <>
          {/* Turnaround Time Analysis */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "20px" }}>
            <Card
              title="Petition Turnaround Time"
              subtitle="Elapsed calendar days from intake to filing with strict reopened-case adjustment."
              badge={<Badge variant="info">Formula Defined</Badge>}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: "14px", color: "var(--muted)" }}>Average Completion Time</span>
                  <strong style={{ fontSize: "32px", color: "var(--text)" }}>
                    {data.turnaround_time.average_days !== null
                      ? `${data.turnaround_time.average_days} days`
                      : "Pending data"}
                  </strong>
                </div>

                <div
                  style={{
                    background: "var(--surface-subtle, #f8fafc)",
                    border: "1px solid var(--border, #e2e8f0)",
                    borderRadius: "8px",
                    padding: "12px",
                    fontSize: "12px",
                    lineHeight: 1.5,
                  }}
                >
                  <strong style={{ display: "block", color: "var(--text)", marginBottom: "4px" }}>
                    Standard Calculation Formula:
                  </strong>
                  <code>{data.turnaround_time.calculation_formula}</code>
                </div>

                {/* Statutory & Data Quality Footnotes */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border, #f1f5f9)" }}>
                    <span style={{ color: "var(--muted)" }}>Completed Cases Evaluated:</span>
                    <strong>{data.turnaround_time.completed_cases_evaluated} cases</strong>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border, #f1f5f9)" }}>
                    <span style={{ color: "var(--muted)" }}>
                      Reopened Cases Adjusted:
                    </span>
                    <span style={{ color: "#0284c7", fontWeight: 600 }}>
                      {data.turnaround_time.reopened_cases_adjusted_count} adjusted
                    </span>
                  </div>
                  <small style={{ color: "var(--quiet)", fontStyle: "italic" }}>
                    ℹ Reopened petitions calculate duration from latest reopening date to avoid distorting baseline preparation metrics.
                  </small>

                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                    <span style={{ color: "var(--muted)" }}>Incomplete Timestamps Excluded:</span>
                    <Badge variant={data.turnaround_time.incomplete_timestamp_cases_count > 0 ? "warning" : "neutral"} size="sm">
                      {data.turnaround_time.incomplete_timestamp_cases_count} excluded
                    </Badge>
                  </div>
                  <small style={{ color: "var(--quiet)", fontStyle: "italic" }}>
                    ℹ Petitions missing filing confirmation timestamps are excluded from average calculation rather than treated as zero.
                  </small>
                </div>
              </div>
            </Card>

            {/* Overdue Work Breakdown */}
            <Card
              title="Tiered Overdue Work Analysis"
              subtitle="Granular classification of delayed milestones and past-due tasks."
              badge={
                <Badge variant={data.overdue_work.total_overdue > 0 ? "critical" : "success"}>
                  {data.overdue_work.total_overdue} Total Overdue
                </Badge>
              }
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {/* Tier 1: < 7 Days */}
                  <div
                    style={{
                      padding: "12px",
                      borderRadius: "8px",
                      background: "#fffbeb",
                      border: "1px solid #fde68a",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "13px", color: "#92400e", display: "block" }}>
                        &lt; 7 Days Overdue (Early Warning)
                      </strong>
                      <small style={{ color: "#b45309" }}>Minor schedule slippage; easily recoverable</small>
                    </div>
                    <strong style={{ fontSize: "20px", color: "#b45309" }}>
                      {data.overdue_work.overdue_less_than_7_days}
                    </strong>
                  </div>

                  {/* Tier 2: 7 to 30 Days */}
                  <div
                    style={{
                      padding: "12px",
                      borderRadius: "8px",
                      background: "#fff7ed",
                      border: "1px solid #fed7aa",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "13px", color: "#9a3412", display: "block" }}>
                        7 to 30 Days Overdue (Moderate Urgency)
                      </strong>
                      <small style={{ color: "#c2410c" }}>Requires caseworker check-in and re-prioritization</small>
                    </div>
                    <strong style={{ fontSize: "20px", color: "#c2410c" }}>
                      {data.overdue_work.overdue_7_to_30_days}
                    </strong>
                  </div>

                  {/* Tier 3: > 30 Days */}
                  <div
                    style={{
                      padding: "12px",
                      borderRadius: "8px",
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "13px", color: "#991b1b", display: "block" }}>
                        &gt; 30 Days Overdue (Critical Escalation)
                      </strong>
                      <small style={{ color: "#dc2626" }}>Statutory risk or abandoned client petition</small>
                    </div>
                    <strong style={{ fontSize: "20px", color: "#dc2626" }}>
                      {data.overdue_work.overdue_greater_than_30_days}
                    </strong>
                  </div>
                </div>

                <div style={{ fontSize: "11px", color: "var(--quiet)", fontStyle: "italic" }}>
                  Formula: {data.overdue_work.calculation_formula}
                </div>
              </div>
            </Card>

            {/* Client Response Time */}
            <Card
              title="Client Response Time"
              subtitle="Turnaround lag for client questionnaires, document uploads, and clarification items."
              badge={<Badge variant="success">Responsiveness</Badge>}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: "14px", color: "var(--muted)" }}>Average Client Response Lag</span>
                  <strong style={{ fontSize: "32px", color: "var(--text)" }}>
                    {data.client_response_time.average_hours !== null
                      ? `${data.client_response_time.average_hours}h`
                      : "Pending data"}
                  </strong>
                </div>

                <div
                  style={{
                    background: "var(--surface-subtle, #f8fafc)",
                    border: "1px solid var(--border, #e2e8f0)",
                    borderRadius: "8px",
                    padding: "12px",
                    fontSize: "12px",
                    lineHeight: 1.5,
                  }}
                >
                  <strong style={{ display: "block", color: "var(--text)", marginBottom: "4px" }}>
                    Equivalency:
                  </strong>
                  <span>
                    ~{data.client_response_time.average_days ?? 0} calendar days from staff request creation to client submission.
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", padding: "6px 0" }}>
                  <span style={{ color: "var(--muted)" }}>Completed Requests Evaluated:</span>
                  <strong>{data.client_response_time.requests_evaluated} client requests</strong>
                </div>

                <div style={{ fontSize: "11px", color: "var(--quiet)", fontStyle: "italic" }}>
                  Formula: {data.client_response_time.calculation_formula}
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
