import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PilotReleaseGovernanceDesk } from "../components/operations/PilotReleaseGovernanceDesk";
import * as api from "../lib/api";

const mockGates: any = {
  id: "eval-stage9-test",
  evaluation_version: "v1.13.0-rc1",
  overall_status: "PASSED",
  evaluated_at: new Date().toISOString(),
  evaluated_by_name: "Continuous Release Auditor",
  signed_off_by_owner: false,
  signoff_notes: null,
  signed_off_at: null,
  gates: [
    {
      gate_id: "gate_1_security_isolation",
      gate_number: 1,
      title: "Zero Open Critical Security or Tenant-Isolation Defects",
      status: "PASSED",
      evidence: "Strict org_id scoping across all queries, signed JWT download tokens (300s TTL), malware antivirus quarantine block active.",
      blocking_issues: [],
    },
    {
      gate_id: "gate_2_package_eligibility_bypass",
      gate_number: 2,
      title: "Package-Eligibility Bypass Prevention",
      status: "PASSED",
      evidence: "Deterministic Safe Stop engine rejects invalid generation attempts.",
      blocking_issues: [],
    },
    {
      gate_id: "gate_3_retention_deletion_accounting",
      gate_number: 3,
      title: "Retention & Deletion Tested Across Storage and DB Failure Modes",
      status: "PASSED",
      evidence: "Deletion accounting verified against storage snapshots.",
      blocking_issues: [],
    },
    {
      gate_id: "gate_4_role_matrix_coverage",
      gate_number: 4,
      title: "Core Flows Tested for All 6 Key Firm Roles",
      status: "PASSED",
      evidence: "Role codes verified: client, officer, senior, manager, owner, accounts.",
      blocking_issues: [],
    },
    {
      gate_id: "gate_5_country_pathway_visibility",
      gate_number: 5,
      title: "Country & Pathway Support State Visible and Reviewed",
      status: "PASSED",
      evidence: "Priorities 1-5 support states rendered with official citations.",
      blocking_issues: [],
    },
    {
      gate_id: "gate_6_privacy_processor_agreements",
      gate_number: 6,
      title: "Privacy Notices, Processor Agreements & Retention Schedules Reviewed",
      status: "PASSED",
      evidence: "Formal counsel signoffs valid for India, Canada, US, and UK/EU.",
      blocking_issues: [],
    },
    {
      gate_id: "gate_7_operational_readiness",
      gate_number: 7,
      title: "Migrations, Rollback, Backup/Restore, Monitoring & Runbooks Documented",
      status: "PASSED",
      evidence: "Pre-launch operational safety pack active: reversible Alembic migrations.",
      blocking_issues: [],
    },
    {
      gate_id: "gate_8_ci_build_readiness",
      gate_number: 8,
      title: "CI Backend Tests & Frontend Build Pass with Zero Pre-Existing Failures",
      status: "PASSED",
      evidence: "Automated test suite (pytest: 404 tests) and Next.js/TypeScript frontend build pass.",
      blocking_issues: [],
    },
  ],
};

const mockCohorts: any[] = [
  {
    id: "cohort-01",
    organization_id: "org-apex",
    cohort_name: "Apex Express Entry Pilot (Alpha)",
    firm_tier: "small_firm",
    status: "active",
    max_cases_allowed: 25,
    allowed_pathways: ["CA_EXPRESS_ENTRY_FSW", "CA_STUDY_PERMIT"],
    synthetic_data_attestation: true,
    unapproved_ai_block_enabled: true,
    assigned_lead_email: "lead.counsel@apexlaw.com",
    start_date: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
];

const mockKPIs: any[] = [
  {
    id: "bm-01",
    period_label: "Q4 Pilot Evaluation",
    pathway_key: "CA_EXPRESS_ENTRY_FSW",
    baseline_workflow_hours: 18.0,
    documento_workflow_hours: 3.6,
    time_saved_hours: 14.4,
    time_saved_percentage: 80.0,
    correction_rate_percentage: 1.8,
    false_positive_flags_count: 2,
    missed_exceptions_count: 0,
    package_rework_rate_percentage: 2.1,
    operational_failures_count: 0,
    operational_recovery_rate_percentage: 100.0,
    created_at: new Date().toISOString(),
  },
];

const mockRunbooks: any[] = [
  {
    id: "rb-01",
    runbook_type: "rollback_plan",
    title: "Emergency Production Deployment & Schema Rollback Plan",
    content_markdown: `# Emergency Production Deployment & Schema Rollback Plan

### 1. Decision Criteria
Trigger rollback immediately if any cross-tenant data leakage occurs.

### 2. Immediate Rollback Steps
1. **Traffic Diversion**: Re-route ingress router to previous stable container revision.
2. **Schema Downgrade**: Execute \`alembic downgrade -1\` if database migration was applied.`,
    metadata: { priority: "P1_CRITICAL" },
    last_verified_at: new Date().toISOString(),
    verified_by_name: "DevOps Release Commander",
  },
];

const mockTelemetry: any = {
  organization_id: "org-apex",
  system_status: "healthy",
  workers: { total_workers: 4, active_workers: 4, heartbeat_status: "normal" },
  dead_letter_queue: { size: 0, jobs: [] },
  security: {
    quarantined_files_count: 0,
    rate_limiting_active: true,
    short_lived_download_tokens_enforced: true,
    least_privilege_enforced: true,
  },
  lifecycle_metrics: {
    completed_applications_retained: 12,
    withdrawn_tombstones_retained: 2,
  },
  data_flow_summary: {
    total_entities: 14,
    external_processors: 2,
    zero_training_guarantee: true,
  },
  privacy_reviews: [
    { jurisdiction: "IN", market_name: "India", status: "approved", is_valid: true },
    { jurisdiction: "CA", market_name: "Canada", status: "approved", is_valid: true },
    { jurisdiction: "US", market_name: "United States", status: "approved", is_valid: true },
    { jurisdiction: "UK_EU", market_name: "UK & European Union", status: "approved", is_valid: true },
  ],
  workforce: {
    total_active_staff: 8,
    overloaded_staff_count: 0,
  },
};

describe("Stage 9: Release / Pilot Governance & Operational Reliability (§8, §9, §10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, "getLatestReleaseGates").mockResolvedValue(mockGates);
    vi.spyOn(api, "getPilotCohorts").mockResolvedValue(mockCohorts);
    vi.spyOn(api, "getKPIBenchmarks").mockResolvedValue(mockKPIs);
    vi.spyOn(api, "getOperationalRunbooks").mockResolvedValue(mockRunbooks);
    vi.spyOn(api, "getOperationalDashboardTelemetry").mockResolvedValue(mockTelemetry);
  });

  it("renders Stage 9 Release Governance Desk with Go/No-Go status banner and 8 mandatory release gates", async () => {
    render(<PilotReleaseGovernanceDesk userRole="company_admin" />);

    // Header banner & stage indicator
    expect(screen.getByText("Stage 9 Operations")).toBeDefined();
    expect(screen.getByText("Release & Pilot Operations Governance Desk")).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText("DECISION: GO (PASSED)")).toBeDefined();
    });

    // 8 Release Gate checklist
    await waitFor(() => {
      expect(screen.getByText("Zero Open Critical Security or Tenant-Isolation Defects")).toBeDefined();
      expect(screen.getByText("Package-Eligibility Bypass Prevention")).toBeDefined();
      expect(screen.getByText("Retention & Deletion Tested Across Storage and DB Failure Modes")).toBeDefined();
      expect(screen.getByText("Core Flows Tested for All 6 Key Firm Roles")).toBeDefined();
      expect(screen.getByText("Country & Pathway Support State Visible and Reviewed")).toBeDefined();
      expect(screen.getByText("Privacy Notices, Processor Agreements & Retention Schedules Reviewed")).toBeDefined();
      expect(screen.getByText("Migrations, Rollback, Backup/Restore, Monitoring & Runbooks Documented")).toBeDefined();
      expect(screen.getByText("CI Backend Tests & Frontend Build Pass with Zero Pre-Existing Failures")).toBeDefined();
    });
  });

  it("allows Managing Partner to authorize production release with formal sign-off", async () => {
    const signoffSpy = vi.spyOn(api, "signoffReleaseGates").mockResolvedValue({
      id: "eval-stage9-signed",
      evaluation_version: "v1.13.0-rc1",
      overall_status: "PASSED",
      evaluated_at: new Date().toISOString(),
      evaluated_by_name: "Continuous Release Auditor",
      signed_off_by_owner: true,
      signoff_notes: "Formal Managing Partner production sign-off recorded for Stage 9",
      signed_off_at: new Date().toISOString(),
      gates: mockGates.gates,
    });

    render(<PilotReleaseGovernanceDesk userRole="company_admin" />);

    // Click Sign Off button once gates are rendered
    const signoffBtn = await screen.findByText("Sign Off for Production");
    fireEvent.click(signoffBtn);

    // Modal opens
    expect(screen.getByText("Managing Partner Production Sign-Off")).toBeDefined();

    const notesInput = screen.getByPlaceholderText("Enter formal sign-off statement...");
    fireEvent.change(notesInput, {
      target: { value: "Formal Managing Partner production sign-off recorded for Stage 9" },
    });

    const submitBtn = screen.getByText("Authorize Production Release");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(signoffSpy).toHaveBeenCalled();
      expect(screen.getByText("Owner Sign-Off Authorized")).toBeDefined();
    });
  });

  it("manages narrow pilot cohorts with limited validated pathways and synthetic data controls", async () => {
    const createdCohort = {
      id: "cohort-stage9-new",
      organization_id: "org-apex",
      cohort_name: "Canada Express Entry Specialty Cohort",
      firm_tier: "small_firm",
      status: "active",
      max_cases_allowed: 20,
      allowed_pathways: ["CA_EXPRESS_ENTRY_FSW", "US_EB1A_EXTRAORDINARY"],
      synthetic_data_attestation: true,
      unapproved_ai_block_enabled: true,
      assigned_lead_email: "lead.attorney@pilotfirm.com",
      start_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    const createCohortSpy = vi.spyOn(api, "createPilotCohort").mockResolvedValue(createdCohort);

    render(<PilotReleaseGovernanceDesk userRole="company_admin" />);

    // Switch to Narrow Pilot Cohorts tab
    const cohortsTab = screen.getByText("Narrow Pilot Cohorts");
    fireEvent.click(cohortsTab);

    await waitFor(() => {
      expect(screen.getByText("Small & Medium Firm Pilot Cohorts")).toBeDefined();
      expect(screen.getByText("+ Provision Pilot Cohort")).toBeDefined();
    });

    // Open Provision Cohort modal
    fireEvent.click(screen.getByText("+ Provision Pilot Cohort"));
    expect(screen.getByText("Provision New Pilot Cohort")).toBeDefined();

    // Fill form
    const nameInput = screen.getByPlaceholderText("e.g. Apex Q4 Pilot Cohort");
    fireEvent.change(nameInput, { target: { value: "Canada Express Entry Specialty Cohort" } });

    const submitBtn = screen.getByText("Provision Cohort");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createCohortSpy).toHaveBeenCalled();
      expect(screen.getByText("Canada Express Entry Specialty Cohort")).toBeDefined();
    });
  });

  it("calculates workflow efficiency and displays comparative KPI benchmarks", async () => {
    render(<PilotReleaseGovernanceDesk userRole="company_admin" />);

    // Switch to Comparative Workflow KPIs tab
    const kpiTab = screen.getByText("Comparative Workflow KPIs");
    fireEvent.click(kpiTab);

    await waitFor(() => {
      expect(screen.getByText("Workflow Efficiency & ROI Calculator")).toBeDefined();
      expect(screen.getByText("Time Saved per Case:")).toBeDefined();
    });

    // Change baseline inputs
    const baselineInputs = screen.getAllByRole("spinbutton");
    const baselineInput = baselineInputs[0];
    const documentoInput = baselineInputs[1];

    fireEvent.change(baselineInput, { target: { value: "20" } });
    fireEvent.change(documentoInput, { target: { value: "4" } });

    await waitFor(() => {
      expect(screen.getByText("16 hrs")).toBeDefined();
      expect(screen.getByText("+80%")).toBeDefined();
    });

    // Check historical benchmark table
    expect(screen.getByText("Recorded Pilot Benchmarks & Quality Indicators")).toBeDefined();
    expect(screen.getByText("CA_EXPRESS_ENTRY_FSW")).toBeDefined();
  });

  it("executes automated disaster recovery restore drill and displays SHA-256 snapshot hash and SLAs", async () => {
    const drillSpy = vi.spyOn(api, "executeBackupRestoreDrill").mockResolvedValue({
      drill_id: "drill-stage9-verified",
      organization_id: "org-apex",
      executed_at: new Date().toISOString(),
      status: "passed",
      snapshot_checksum: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      records_evaluated: { total_documents: 250, purged_documents: 40 },
      checks: {
        checksum_verification: "passed",
        schema_integrity: "passed",
        foreign_key_consistency: "passed",
        object_versioning_sync: "passed",
        backup_aware_erasure_policy: "passed",
      },
      recovery_point_objective_minutes: 15,
      recovery_time_objective_minutes: 30,
    });

    render(<PilotReleaseGovernanceDesk userRole="company_admin" />);

    // Switch to Backup & Recovery Drills tab
    const drTab = screen.getByText("Backup & Recovery Drills");
    fireEvent.click(drTab);

    await waitFor(() => {
      expect(screen.getByText("< 15 Minutes")).toBeDefined();
      expect(screen.getByText("< 30 Minutes")).toBeDefined();
      expect(screen.getByText("Zero PII Resurrection")).toBeDefined();
    });

    // Trigger restore drill
    const drillBtn = screen.getByText("Execute Restore Drill");
    fireEvent.click(drillBtn);

    await waitFor(() => {
      expect(drillSpy).toHaveBeenCalled();
      expect(screen.getByText("SHA-256 Snapshot Checksum:")).toBeDefined();
      expect(screen.getByText("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")).toBeDefined();
    });
  });

  it("inspects operational runbooks including emergency rollback plan", async () => {
    render(<PilotReleaseGovernanceDesk userRole="company_admin" />);

    // Switch to Operational Runbooks tab
    const runbooksTab = screen.getByText("Operational Runbooks");
    fireEvent.click(runbooksTab);

    await waitFor(() => {
      expect(screen.getByText("Operational Safety Pack & Emergency Runbooks")).toBeDefined();
    });

    await waitFor(() => {
      expect(screen.getAllByText("Emergency Production Deployment & Schema Rollback Plan").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/alembic downgrade/)).toBeDefined();
      expect(screen.getByText(/Traffic Diversion/)).toBeDefined();
    });
  });

  it("renders production observability and dead letter queue telemetry", async () => {
    render(<PilotReleaseGovernanceDesk userRole="company_admin" />);

    // Switch to Observability & DLQ tab
    const telemetryTab = screen.getByText("Observability & DLQ");
    fireEvent.click(telemetryTab);

    await waitFor(() => {
      expect(screen.getByText("Production Observability & Worker Health Telemetry")).toBeDefined();
    });

    await waitFor(() => {
      expect(screen.getByText("0 quarantined")).toBeDefined();
      expect(screen.getByText("0 files")).toBeDefined();
      expect(screen.getByText("Guaranteed")).toBeDefined();
      expect(screen.getByText("Multi-Jurisdiction Privacy Reviews")).toBeDefined();
    });
  });
});
