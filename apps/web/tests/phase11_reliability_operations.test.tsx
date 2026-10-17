import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OperationalReliabilityHub } from "../components/operations/OperationalReliabilityHub";
import * as api from "../lib/api";

describe("Phase 11 — Operational Reliability, Privacy, Security & Lifecycle Scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(api, "getOperationalDashboard").mockResolvedValue({
      organization_id: "org-1111",
      system_status: "healthy",
      workers: { active: 8, idle: 0 },
      dead_letter_queue: {
        size: 1,
        jobs: [
          {
            job_id: "dlq-job-99",
            task_type: "document_deep_ocr",
            organization_id: "org-1111",
            error_message: "Transient upstream network timeout",
            retry_count: 5,
            failed_at: "2026-10-17T12:00:00Z",
            reprocessed: false,
          },
        ],
      },
      security: {
        quarantined_files_count: 2,
        rate_limiting_active: true,
        short_lived_download_tokens_enforced: true,
        least_privilege_enforced: true,
      },
      lifecycle_metrics: {
        completed_applications_retained: 4,
        withdrawn_tombstones_retained: 2,
      },
      data_flow_summary: {
        total_entities: 7,
        external_processors: 4,
        zero_training_guarantee: true,
      },
      privacy_reviews: [
        { jurisdiction: "IN", market_name: "India", status: "signed_off", is_valid: true },
        { jurisdiction: "CA", market_name: "Canada", status: "signed_off", is_valid: true },
        { jurisdiction: "US", market_name: "United States", status: "signed_off", is_valid: true },
        { jurisdiction: "UK_EU", market_name: "UK & European Union", status: "signed_off", is_valid: true },
      ],
      workforce: {
        total_active_staff: 12,
        overloaded_staff_count: 1,
      },
    });

    vi.spyOn(api, "getDataFlowRegister").mockResolvedValue({
      title: "Documento Global Data-Flow & Processing Register",
      compliance_statement: "Customer documents and extracted OCR text are strictly never used for AI model training.",
      total_components: 7,
      external_processors: 4,
      zero_training_guarantee: true,
      data_flows: [
        {
          id: "storage_primary_s3",
          category: "primary_object_storage",
          provider: "Amazon Web Services (AWS S3)",
          location: "us-east-1 (N. Virginia)",
          residency_model: "Regional boundary enforcement",
          data_classes_handled: ["Customer Document Uploads", "PDF Assembly Packages"],
          encryption_in_transit: "TLS 1.3",
          encryption_at_rest: "AES-256-GCM / KMS",
          pii_retention_policy: "15-day idle case purge; 30-day post-completion purge",
          ai_training_permitted: false,
          subprocessor_agreement_active: true,
        },
        {
          id: "ai_llm_bedrock",
          category: "ai_inference",
          provider: "AWS Bedrock (Anthropic Claude 3.5 Sonnet)",
          location: "us-east-1",
          residency_model: "Zero Data Retention (ZDR)",
          data_classes_handled: ["Redacted Form Schemas", "Authority Request Text"],
          encryption_in_transit: "TLS 1.3",
          encryption_at_rest: "Ephemeral in-memory only",
          pii_retention_policy: "Immediate in-memory destruction upon completion",
          ai_training_permitted: false,
          subprocessor_agreement_active: true,
        },
      ],
    });

    vi.spyOn(api, "getPrivacyReviews").mockResolvedValue([
      {
        jurisdiction: "IN",
        market_name: "India",
        review_status: "signed_off",
        is_valid: true,
        governing_statute: "Digital Personal Data Protection Act, 2023 (DPDP Act)",
        counsel_signoff_date: "2026-04-10",
        counsel_name: "Vikramaditya Sharma, Advocate",
        firm_name: "Trilegal New Delhi",
        key_statutory_requirements: [
          "Affirmative Notice & Purpose Limitation (Section 5)",
          "Aadhaar / National ID Masking & Strict Ephemeral Processing",
        ],
      },
      {
        jurisdiction: "CA",
        market_name: "Canada",
        review_status: "signed_off",
        is_valid: true,
        governing_statute: "PIPEDA & Quebec Law 25",
        counsel_signoff_date: "2026-04-12",
        counsel_name: "Claire Boucher, Avocate",
        firm_name: "Stikeman Elliott LLP (Montreal)",
        key_statutory_requirements: [
          "Meaningful Consent & Purpose Specification",
          "Cross-Border Transfer Impact Assessment",
        ],
      },
    ]);

    vi.spyOn(api, "getCompletedApplicationSummaries").mockResolvedValue([
      {
        id: "comp-01",
        case_id: "case-01",
        case_number: "CASE-US-8841",
        client_name: "Dr. Elena Rostova",
        visa_category: "EB-1A Extraordinary Ability",
        jurisdiction: "United States (USCIS)",
        start_date: "2026-08-10T10:00:00Z",
        completion_date: "2026-10-15T14:30:00Z",
        assigned_officer_name: "Sarah Jenkins, Esq.",
        assigned_officer_role: "Senior Partner",
        adjudication_outcome: "APPROVED",
        official_reference_number: "LIN-26-902-8841",
        purged_files_count: 7,
      },
    ]);

    vi.spyOn(api, "getWithdrawnTombstones").mockResolvedValue([
      {
        id: "tomb-01",
        case_id: "case-02",
        case_number: "CASE-US-8842",
        client_name: "Marcus Thorne",
        client_email: "marcus.thorne@example.com",
        intended_application_type: "O-1A Nonimmigrant",
        jurisdiction: "United States (USCIS)",
        executed_by_name: "Sarah Jenkins, Esq.",
        withdrawal_reason: "Client elected to withdraw prior to filing",
        executed_at: "2026-10-14T09:15:00Z",
        formal_authority_withdrawal_required: false,
        formal_authority_status: "not_applicable",
      },
    ]);
  });

  it("renders main navigation tabs and telemetry cards", async () => {
    render(<OperationalReliabilityHub />);

    expect(screen.getByText("⚡ Telemetry & Worker Health")).toBeDefined();
    expect(screen.getByText("🌐 Data-Flow Register & Privacy Matrix")).toBeDefined();
    expect(screen.getByText("🔄 Core Lifecycle Scenarios")).toBeDefined();
    expect(screen.getByText("📁 Retained Summaries & Tombstones")).toBeDefined();
    expect(screen.getByText("🛡️ Disaster Recovery & Security Ops")).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText("HEALTHY")).toBeDefined();
      expect(screen.getByText("1 Quarantined Jobs")).toBeDefined();
      expect(screen.getByText("2 Blocked Files")).toBeDefined();
      expect(screen.getByText("300s Expiration")).toBeDefined();
    });
  });

  it("displays DLQ job and allows reprocess triggering", async () => {
    const reprocessSpy = vi.spyOn(api, "reprocessDeadLetterJob").mockResolvedValue({
      job_id: "dlq-job-99",
      status: "reprocessed",
    });

    render(<OperationalReliabilityHub />);

    await waitFor(() => {
      expect(screen.getByText("dlq-job-99")).toBeDefined();
      expect(screen.getByText("Transient upstream network timeout")).toBeDefined();
    });

    const reprocessBtn = screen.getByText("Reprocess / Retry");
    fireEvent.click(reprocessBtn);

    await waitFor(() => {
      expect(reprocessSpy).toHaveBeenCalledWith("dlq-job-99", "master_admin");
    });
  });

  it("switches to Data-Flow Register tab and displays zero-training guarantees and privacy reviews", async () => {
    render(<OperationalReliabilityHub />);

    const dataFlowTab = screen.getByText("🌐 Data-Flow Register & Privacy Matrix");
    fireEvent.click(dataFlowTab);

    await waitFor(() => {
      expect(screen.getByText("Zero-Training Guarantee Active & Audited")).toBeDefined();
      expect(screen.getByText("Amazon Web Services (AWS S3)")).toBeDefined();
      expect(screen.getByText("AWS Bedrock (Anthropic Claude 3.5 Sonnet)")).toBeDefined();
      expect(screen.getByText("India (IN)")).toBeDefined();
      expect(screen.getByText("Canada (CA)")).toBeDefined();
      expect(screen.getByText("Digital Personal Data Protection Act, 2023 (DPDP Act)")).toBeDefined();
    });
  });

  it("switches to Core Lifecycle Scenarios tab and opens withdrawal modal", async () => {
    render(<OperationalReliabilityHub />);

    const scenariosTab = screen.getByText("🔄 Core Lifecycle Scenarios");
    fireEvent.click(scenariosTab);

    expect(screen.getByText("Scenario 1: Idle Case Cleanup Policy")).toBeDefined();
    expect(screen.getByText("Scenario 2: Hold & Reassignment")).toBeDefined();
    expect(screen.getByText("Scenario 3: Client Withdrawal")).toBeDefined();
    expect(screen.getByText("Scenario 4: Completed Application Cleanup")).toBeDefined();
    expect(screen.getByText("Scenario 5: Reapplication from Scratch")).toBeDefined();

    // Open withdrawal modal
    const withdrawBtn = screen.getByText("Execute Case Withdrawal");
    fireEvent.click(withdrawBtn);

    expect(screen.getByText("Execute Client Case Withdrawal")).toBeDefined();
    expect(screen.getByText("Case UUID:")).toBeDefined();
    expect(screen.getByText("Withdrawal Reason:")).toBeDefined();
  });

  it("switches to Archives tab and displays completed application summaries and minimal tombstones", async () => {
    render(<OperationalReliabilityHub />);

    const archivesTab = screen.getByText("📁 Retained Summaries & Tombstones");
    fireEvent.click(archivesTab);

    await waitFor(() => {
      expect(screen.getByText("Completed Applications Summary Archive")).toBeDefined();
      expect(screen.getByText("CASE-US-8841")).toBeDefined();
      expect(screen.getByText("Dr. Elena Rostova")).toBeDefined();
      expect(screen.getByText("🗑️ 7 files")).toBeDefined();

      expect(screen.getByText("Withdrawn Cases Minimal Tombstone Register")).toBeDefined();
      expect(screen.getByText("CASE-US-8842")).toBeDefined();
      expect(screen.getByText("Marcus Thorne")).toBeDefined();
    });
  });

  it("switches to Disaster Recovery tab and executes automated restore drill", async () => {
    const drillSpy = vi.spyOn(api, "executeBackupRestoreDrill").mockResolvedValue({
      drill_id: "drill-20261017",
      status: "PASSED",
      organization_id: "org-1111",
      initiated_by: "user-admin",
      tested_components: [
        { component: "PostgreSQL Database Backup", target: "s3://backups/db/daily.dump", status: "VERIFIED", latency_ms: 12 },
        { component: "Document Storage Snapshots", target: "s3://backups/objects/store.tar.gz", status: "VERIFIED", latency_ms: 18 },
      ],
      deletion_policy_accounting_verified: true,
      completed_at: "2026-10-17T12:00:00Z",
      details: "Disaster recovery restore verification passed successfully.",
    });

    render(<OperationalReliabilityHub />);

    const drTab = screen.getByText("🛡️ Disaster Recovery & Security Ops");
    fireEvent.click(drTab);

    const runDrillBtn = screen.getByText("🔄 Run Automated Restore Drill");
    fireEvent.click(runDrillBtn);

    await waitFor(() => {
      expect(drillSpy).toHaveBeenCalledWith("master_admin");
      expect(screen.getByText("Restore Drill Results (drill-20261017):")).toBeDefined();
      expect(screen.getByText("PostgreSQL Database Backup")).toBeDefined();
    });
  });

  it("renders quick selection dropdowns for active cases and staff in scenario modals", async () => {
    const dummyCases = [
      {
        id: "case-01",
        case_number: "CASE-US-8841",
        title: "EB-1A Petition",
        client_name: "Dr. Elena Rostova",
        visa_category: "EB-1A",
      } as any,
    ];
    const dummyStaff = [
      {
        id: "staff-01",
        name: "Sarah Jenkins, Esq.",
        role: "Senior Partner",
        active_cases: 4,
        max_capacity: 10,
      } as any,
    ];

    render(<OperationalReliabilityHub cases={dummyCases} staff={dummyStaff} />);

    const scenariosTab = screen.getByText("🔄 Core Lifecycle Scenarios");
    fireEvent.click(scenariosTab);

    // Open withdrawal modal
    const withdrawBtn = screen.getByText("Execute Case Withdrawal");
    fireEvent.click(withdrawBtn);

    expect(screen.getByText("Select From Active Cases:")).toBeDefined();
    expect(screen.getByText("CASE-US-8841 — Dr. Elena Rostova (EB-1A)")).toBeDefined();

    // Close modal
    fireEvent.click(screen.getByText("Cancel"));

    // Open offboarding modal
    const offboardBtn = screen.getByText("Employee Offboarding");
    fireEvent.click(offboardBtn);

    expect(screen.getByText("Select Departing Caseworker:")).toBeDefined();
    expect(screen.getByText("Sarah Jenkins, Esq. (Senior Partner) — 4 active cases")).toBeDefined();
  });
});
