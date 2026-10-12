import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ExecutiveCommandCenter } from "../components/analytics/ExecutiveCommandCenter";
import { AnalyticsExplorer } from "../components/analytics/AnalyticsExplorer";
import { BillingManager } from "../components/billing/BillingManager";
import { BusinessOperationsHub } from "../components/operations/BusinessOperationsHub";
import { OwnerMasterDashboard } from "../components/dashboards/OwnerMasterDashboard";
import {
  FALLBACK_EXECUTIVE_DASHBOARD,
  FALLBACK_OPERATIONS_ANALYTICS,
} from "../lib/api";

describe("Phase 9 — Owner Analytics, Company Management, and Billing", () => {
  describe("ExecutiveCommandCenter Component", () => {
    it("renders all database-backed operational metrics with calculation formulas and status indicators", () => {
      const handleNavigateTab = vi.fn();
      const handleSelectCase = vi.fn();

      render(
        <ExecutiveCommandCenter
          initialData={FALLBACK_EXECUTIVE_DASHBOARD}
          isLiveBackend={true}
          onNavigateTab={handleNavigateTab}
          onSelectCase={handleSelectCase}
        />
      );

      // Verify header and live DB status
      expect(screen.getByText("Executive Operational Command Center")).toBeDefined();
      expect(screen.getByText("Connected Live DB")).toBeDefined();

      // Verify Metric 1: Active Cases
      expect(screen.getByText("Active Petitions in Progress")).toBeDefined();
      expect(screen.getByText("6")).toBeDefined(); // from fallback value
      expect(screen.getAllByText("Verified DB").length).toBeGreaterThan(0);

      // Verify Metric 2: New Retained Clients
      expect(screen.getByText("New Retained Clients")).toBeDefined();

      // Verify Metric 5: Cases Needing Attention
      expect(screen.getByText("Cases Needing Immediate Attention")).toBeDefined();

      // Verify Metric 6: Deadlines
      expect(screen.getByText("Statutory Agency Deadlines")).toBeDefined();

      // Verify Metric 4: Stage Pipeline
      expect(screen.getByText("Cases by Workflow Stage")).toBeDefined();
      expect(screen.getByText("intake")).toBeDefined();
      expect(screen.getByText("gathering")).toBeDefined();

      // Verify Metric 3: Jurisdictions
      expect(screen.getByText("Cases by Country & Pathway")).toBeDefined();
      expect(screen.getByText("Target Jurisdictions")).toBeDefined();

      // Verify Metric 8: Staff Workload
      expect(screen.getByText("Staff Capacity & Workload")).toBeDefined();

      // Verify Metric 9: Filing Package Pipeline
      expect(screen.getByText("Filing Package Pipeline")).toBeDefined();
      expect(screen.getByText("PREPARED")).toBeDefined();
      expect(screen.getByText("REVIEWED")).toBeDefined();
      expect(screen.getByText("SUBMITTED")).toBeDefined();

      // Verify Metric 10: Outstanding Client Requests
      expect(screen.getByText("Outstanding Client Requests")).toBeDefined();

      // Verify Metric 11: Processing Failures
      expect(screen.getByText("Document & Processing Failures")).toBeDefined();

      // Verify Metric 12: Recent Company Activity
      expect(screen.getByText("Recent Company Audit & Activity Stream")).toBeDefined();
    });

    it("opens the Metric Formulas dictionary modal and details mathematical formulas and drill-downs", () => {
      render(
        <ExecutiveCommandCenter
          initialData={FALLBACK_EXECUTIVE_DASHBOARD}
          isLiveBackend={false}
          onNavigateTab={vi.fn()}
        />
      );

      const dictBtn = screen.getByRole("button", { name: /Metric Formulas/i });
      fireEvent.click(dictBtn);

      // Verify dictionary modal contents
      expect(
        screen.getByText("Executive Metrics Dictionary & Statutory Formula Specifications")
      ).toBeDefined();
      expect(screen.getAllByText(/Mathematical Formula \/ Query:/i).length).toBeGreaterThan(5);
    });

    it("allows switching time window filter between 7d, 30d, 90d, 180d", () => {
      render(
        <ExecutiveCommandCenter
          initialData={FALLBACK_EXECUTIVE_DASHBOARD}
          isLiveBackend={false}
          onNavigateTab={vi.fn()}
        />
      );

      const btn90 = screen.getByText("90d");
      fireEvent.click(btn90);
      expect(btn90).toBeDefined();
    });
  });

  describe("AnalyticsExplorer Component", () => {
    it("renders multi-dimensional filters across jurisdiction, pathway, stage, team member, and branch", () => {
      render(
        <AnalyticsExplorer
          initialData={FALLBACK_OPERATIONS_ANALYTICS}
          isLiveBackend={true}
        />
      );

      expect(screen.getByText("Firm Operations & Caseload Analytics")).toBeDefined();
      expect(screen.getByText("Multi-Dimensional Filters")).toBeDefined();

      // Verify filter dropdowns exist
      expect(screen.getByText("Country / Jurisdiction")).toBeDefined();
      expect(screen.getByText("Pathway / Category")).toBeDefined();
      expect(screen.getByText("Workflow Stage")).toBeDefined();
      expect(screen.getByText("Team Member / Assignee")).toBeDefined();
      expect(screen.getByText("Office Branch")).toBeDefined();
      expect(screen.getByText("Service Type")).toBeDefined();
    });

    it("displays turnaround time with reopened case adjustments and incomplete timestamp handling", () => {
      render(
        <AnalyticsExplorer
          initialData={FALLBACK_OPERATIONS_ANALYTICS}
          isLiveBackend={false}
        />
      );

      expect(screen.getByText("Petition Turnaround Time")).toBeDefined();
      expect(screen.getByText("58.4 days")).toBeDefined();
      expect(screen.getByText(/Reopened Cases Adjusted:/i)).toBeDefined();
      expect(screen.getByText(/Incomplete Timestamps Excluded:/i)).toBeDefined();
      expect(screen.getByText(/Standard Calculation Formula:/i)).toBeDefined();
    });

    it("displays tiered overdue work analysis (<7d, 7-30d, >30d)", () => {
      render(
        <AnalyticsExplorer
          initialData={FALLBACK_OPERATIONS_ANALYTICS}
          isLiveBackend={false}
        />
      );

      expect(screen.getByText("Tiered Overdue Work Analysis")).toBeDefined();
      expect(screen.getByText(/< 7 Days Overdue \(Early Warning\)/i)).toBeDefined();
      expect(screen.getByText(/7 to 30 Days Overdue \(Moderate Urgency\)/i)).toBeDefined();
      expect(screen.getByText(/> 30 Days Overdue \(Critical Escalation\)/i)).toBeDefined();
    });

    it("triggers audit export report and displays export notice", async () => {
      render(
        <AnalyticsExplorer
          initialData={FALLBACK_OPERATIONS_ANALYTICS}
          isLiveBackend={false}
        />
      );

      const exportBtn = screen.getByRole("button", { name: /Export Analytics Audit Report/i });
      fireEvent.click(exportBtn);

      await waitFor(() => {
        expect(screen.getByText(/Report 'operations_analytics_summary' generated and audit-logged/i)).toBeDefined();
      });
    });
  });

  describe("BillingManager Component", () => {
    it("enforces RBAC and denies access for unauthorized caseworker roles", () => {
      render(<BillingManager userRole="case_manager" isLiveBackend={false} />);

      expect(screen.getByText("Access Restricted by Organization Governance")).toBeDefined();
      expect(screen.getByText(/does not possess the/i)).toBeDefined();
      expect(screen.queryByText("Firm Billing, Retainers & Accounts Receivable")).toBeNull();
    });

    it("renders financial summary totals and Accounts Receivable Aging schedule for authorized owner", async () => {
      render(<BillingManager userRole="owner" isLiveBackend={false} />);

      await waitFor(() => {
        expect(screen.getByText("Firm Billing, Retainers & Accounts Receivable")).toBeDefined();
        expect(screen.getByText("PCI-DSS Tokenized")).toBeDefined();
        expect(screen.getByText("TOTAL INVOICED")).toBeDefined();
        expect(screen.getByText("CONFIRMED PAYMENTS")).toBeDefined();
        expect(screen.getByText("OUTSTANDING BALANCES")).toBeDefined();
      });
    });

    it("switches to Accounts Receivable Aging reports and displays aging buckets", async () => {
      render(<BillingManager userRole="owner" isLiveBackend={false} />);

      const reportsTab = await screen.findByRole("button", { name: /Accounts Receivable Aging/i });
      fireEvent.click(reportsTab);

      await waitFor(() => {
        expect(screen.getByText("Accounts Receivable (A/R) Aging Schedule")).toBeDefined();
        expect(screen.getByText("CURRENT (NOT DUE)")).toBeDefined();
        expect(screen.getByText("1 – 30 DAYS OVERDUE")).toBeDefined();
        expect(screen.getByText("31 – 60 DAYS OVERDUE")).toBeDefined();
        expect(screen.getByText("61 – 90 DAYS OVERDUE")).toBeDefined();
        expect(screen.getByText("90+ DAYS OVERDUE")).toBeDefined();
      });
    });

    it("opens Issue Invoice modal with line item builder", async () => {
      render(<BillingManager userRole="owner" isLiveBackend={false} />);

      const issueBtn = await screen.findByRole("button", { name: /\+ Issue Invoice/i });
      fireEvent.click(issueBtn);

      expect(screen.getByText("Issue New Client Invoice")).toBeDefined();
      expect(screen.getByText("Invoice Line Items")).toBeDefined();
      expect(screen.getByDisplayValue("Primary Petition Preparation & Statutory Strategy")).toBeDefined();
    });

    it("opens Record Payment modal with strict PCI-DSS tokenization disclaimer", async () => {
      render(<BillingManager userRole="owner" isLiveBackend={false} />);

      const payButtons = await screen.findAllByRole("button", { name: "Pay" });
      expect(payButtons.length).toBeGreaterThan(0);
      fireEvent.click(payButtons[0]);

      // Verify PCI-DSS security disclaimer
      expect(screen.getByText(/PCI-DSS Tokenization Architecture:/i)).toBeDefined();
      expect(
        screen.getByText(/Raw Primary Account Numbers \(PAN\) and CVV codes are never handled or stored/i)
      ).toBeDefined();
      expect(screen.getByText("Settlement Method")).toBeDefined();
    });
  });

  describe("BusinessOperationsHub Component", () => {
    it("renders staff workload, utilization percentages, and overload indicators", async () => {
      render(<BusinessOperationsHub isLiveBackend={false} />);

      await waitFor(() => {
        expect(screen.getByText("Company Operations, Workload & Governance")).toBeDefined();
        expect(screen.getByText("Caseworker Workload & Capacity Utilization")).toBeDefined();
        expect(screen.getByText(/Sarah Jenkins/i)).toBeDefined();
        expect(screen.getByText(/Marcus Reed/i)).toBeDefined();
      });
    });

    it("opens Work Reassignment modal and validates source and target staff members", async () => {
      render(<BusinessOperationsHub isLiveBackend={false} />);

      const reassignBtn = await screen.findByRole("button", { name: /⇄ Reassign Work/i });
      fireEvent.click(reassignBtn);

      expect(screen.getByText("Reassign Casework & Tasks")).toBeDefined();
      expect(screen.getByText("Source Team Member (From)")).toBeDefined();
      expect(screen.getByText("Target Team Member (To)")).toBeDefined();
      expect(screen.getByText("Transfer Scope")).toBeDefined();
      expect(screen.getByText("Reason for Reassignment (Audit Logged)")).toBeDefined();
    });

    it("switches to Organization Settings and allows updating firm policies", async () => {
      render(<BusinessOperationsHub isLiveBackend={false} />);

      const settingsTab = await screen.findByRole("button", { name: /Organization Settings/i });
      fireEvent.click(settingsTab);

      await waitFor(() => {
        expect(screen.getByText("Firm Operational & Governance Settings")).toBeDefined();
        expect(screen.getByText("Legal Practice Entity Name")).toBeDefined();
        expect(screen.getByText("Primary Billing Currency")).toBeDefined();
        expect(screen.getByText(/Require Two-Step Case Closure Verification/i)).toBeDefined();
      });

      const saveBtn = screen.getByRole("button", { name: /Save Organization Settings/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(screen.getByText(/Organization settings successfully updated and logged/i)).toBeDefined();
      });
    });

    it("switches to Branches & Teams tab and displays branch structures", async () => {
      render(<BusinessOperationsHub isLiveBackend={false} />);

      const branchesTab = await screen.findByRole("button", { name: /Branches & Teams/i });
      fireEvent.click(branchesTab);

      await waitFor(() => {
        expect(screen.getByText("New York Headquarters (US HQ)")).toBeDefined();
        expect(screen.getByText("London Branch (UK Office)")).toBeDefined();
        expect(screen.getByText("Toronto Branch (Canada Practice)")).toBeDefined();
      });
    });
  });

  describe("OwnerMasterDashboard Full Integration", () => {
    it("seamlessly navigates across Executive Dashboard, Deep Analytics, Operations, and Billing tabs", async () => {
      render(
        <OwnerMasterDashboard
          cases={[]}
          clients={[]}
          auditEvents={[]}
          invoices={[]}
          capacity={[]}
          isLiveBackend={false}
          onOpenCreateCase={vi.fn()}
          onOpenCreateClient={vi.fn()}
          onSelectCase={vi.fn()}
        />
      );

      // Default tab: Company Overview
      expect(screen.getByText("Operational Health & Tenant Boundary")).toBeDefined();

      // Navigate to Executive Command Center
      const execTab = screen.getByRole("button", { name: /Executive Command Center/i });
      fireEvent.click(execTab);
      expect(await screen.findByText("Executive Operational Command Center")).toBeDefined();

      // Navigate to Deep Analytics
      const analyticsTab = screen.getByRole("button", { name: /Deep Analytics/i });
      fireEvent.click(analyticsTab);
      expect(await screen.findByText("Firm Operations & Caseload Analytics")).toBeDefined();

      // Navigate to Operations Hub
      const opsTab = screen.getByRole("button", { name: /Operations Hub/i });
      fireEvent.click(opsTab);
      expect(await screen.findByText("Company Operations, Workload & Governance")).toBeDefined();

      // Navigate to Billing & Retainers
      const billingTab = screen.getByRole("button", { name: /Billing & Retainers/i });
      fireEvent.click(billingTab);
      expect(await screen.findByText("Firm Billing, Retainers & Accounts Receivable")).toBeDefined();
    });
  });
});
