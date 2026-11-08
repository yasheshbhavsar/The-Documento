import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

import { DataTable, Column } from "../components/common/DataTable";
import { MetricCard } from "../components/common/MetricCard";
import {
  TableSkeleton,
  MetricCardSkeleton,
  CardGridSkeleton,
  DossierSkeleton,
  DetailDrawerSkeleton,
} from "../components/common/Skeletons";
import {
  UnassignedClientEmptyState,
  FirmCleanSlateEmptyState,
} from "../components/common/EmptyStates";
import { DashboardErrorBoundary } from "../components/common/DashboardErrorBoundary";

interface SampleRow {
  id: string;
  name: string;
  category: string;
  amount: number;
}

const sampleColumns: Column<SampleRow>[] = [
  { key: "id", header: "ID", sortable: true, width: "15%" },
  { key: "name", header: "Name", sortable: true, width: "35%" },
  { key: "category", header: "Category", width: "25%" },
  { key: "amount", header: "Amount", width: "25%" },
];

const sampleData: SampleRow[] = [
  { id: "c1", name: "Elena Rostova", category: "O-1A", amount: 4500 },
  { id: "c2", name: "David Kim", category: "EB-1A", amount: 6000 },
];

describe("Empirical Challenger Stress Harness — Milestone 2", () => {
  describe("1. DataTable Layout Shift & Loading Invariants", () => {
    it("never displays empty state ('📂 No records found') when isLoading=true, even with data=[]", () => {
      const { container } = render(
        <DataTable<SampleRow>
          columns={sampleColumns}
          data={[]}
          keyExtractor={(row) => row.id}
          isLoading={true}
          emptyTitle="No records found"
          emptyDescription="Database contains zero matches."
        />
      );

      // Must NOT contain empty text, description, or folder icon
      expect(screen.queryByText(/No records found/i)).toBeNull();
      expect(screen.queryByText(/Database contains zero matches/i)).toBeNull();
      expect(container.textContent).not.toContain("📂");

      // Must render skeleton rows
      const tbody = container.querySelector("tbody");
      expect(tbody).not.toBeNull();
      const rows = tbody!.querySelectorAll("tr");
      expect(rows.length).toBe(6); // default pageSize is 6

      // Each skeleton row must match column count
      rows.forEach((row) => {
        const cells = row.querySelectorAll("td");
        expect(cells.length).toBe(sampleColumns.length);
        cells.forEach((cell) => {
          expect(cell.querySelector(".animate-pulse")).not.toBeNull();
        });
      });
    });

    it("never displays populated rows when isLoading=true, even if data has items", () => {
      const { container } = render(
        <DataTable<SampleRow>
          columns={sampleColumns}
          data={sampleData}
          keyExtractor={(row) => row.id}
          isLoading={true}
        />
      );

      // Skeletons must mask populated rows until loading completes
      expect(screen.queryByText("Elena Rostova")).toBeNull();
      expect(screen.queryByText("David Kim")).toBeNull();
      expect(container.textContent).not.toContain("Elena Rostova");
      expect(container.textContent).not.toContain("David Kim");

      // Verify pulse elements exist
      const pulses = container.querySelectorAll(".animate-pulse");
      expect(pulses.length).toBeGreaterThan(0);
    });

    it("respects custom skeletonRows count for exact layout matching", () => {
      const { container } = render(
        <DataTable<SampleRow>
          columns={sampleColumns}
          data={[]}
          keyExtractor={(row) => row.id}
          isLoading={true}
          skeletonRows={10}
        />
      );

      const rows = container.querySelectorAll("tbody tr");
      expect(rows.length).toBe(10);
    });

    it("transitions cleanly from loading skeletons to data without layout break", () => {
      const { rerender, container } = render(
        <DataTable<SampleRow>
          columns={sampleColumns}
          data={sampleData}
          keyExtractor={(row) => row.id}
          isLoading={true}
        />
      );

      expect(screen.queryByText("Elena Rostova")).toBeNull();

      // Now complete loading
      rerender(
        <DataTable<SampleRow>
          columns={sampleColumns}
          data={sampleData}
          keyExtractor={(row) => row.id}
          isLoading={false}
        />
      );

      expect(screen.getByText("Elena Rostova")).toBeDefined();
      expect(screen.getByText("David Kim")).toBeDefined();
      expect(container.querySelectorAll(".animate-pulse").length).toBe(0);
    });
  });

  describe("2. MetricCard False Zero & False Value Elimination", () => {
    it("renders MetricCardSkeleton and never displays 0, $0, or false values when isLoading=true", () => {
      const { container: c0 } = render(
        <MetricCard
          label="Active Retainers"
          value={0}
          meaning="Total active retainer count"
          isLoading={true}
        />
      );

      // Check status role and busy attribute
      const skel = screen.getByRole("status", { name: /loading metric/i });
      expect(skel).toBeDefined();
      expect(skel.getAttribute("aria-busy")).toBe("true");

      // Textual verification: zero must not appear
      expect(c0.textContent).not.toContain("0");
      expect(c0.textContent).not.toContain("$0");
      expect(screen.queryByText("0")).toBeNull();
      expect(screen.queryByText("Active Retainers")).toBeNull();

      // Test with string '$0.00'
      const { container: cStr } = render(
        <MetricCard
          label="Firm Escrow Balance"
          value="$0.00"
          meaning="Total statutory escrow held"
          isLoading={true}
        />
      );

      expect(cStr.textContent).not.toContain("$0.00");
      expect(cStr.textContent).not.toContain("Firm Escrow Balance");
      expect(screen.queryByText("$0.00")).toBeNull();
    });

    it("MetricCard maintains 'metric-card-box' container class across loading states to prevent grid reflow", () => {
      const { rerender, container } = render(
        <MetricCard
          label="Pending Audits"
          value={15}
          meaning="Cases flagged for review"
          isLoading={true}
        />
      );

      const loadingBox = container.querySelector(".metric-card-box");
      expect(loadingBox).not.toBeNull();
      expect(loadingBox?.getAttribute("role")).toBe("status");

      rerender(
        <MetricCard
          label="Pending Audits"
          value={15}
          meaning="Cases flagged for review"
          isLoading={false}
        />
      );

      const loadedBox = container.querySelector(".metric-card-box");
      expect(loadedBox).not.toBeNull();
      expect(screen.getByText("Pending Audits")).toBeDefined();
      expect(screen.getByText("15")).toBeDefined();
    });
  });

  describe("3. EmptyStates Actionable Controls & Legal Compliance", () => {
    it("UnassignedClientEmptyState mounts with legal guidance and triggers callbacks", () => {
      const onOpenQuestionnaire = vi.fn();
      const onOpenOcrFaq = vi.fn();

      render(
        <UnassignedClientEmptyState
          clientName="Carlos Mendoza"
          firmName="Lexington Immigrant Defense"
          onOpenQuestionnaire={onOpenQuestionnaire}
          onOpenOcrFaq={onOpenOcrFaq}
        />
      );

      // Verify legal onboarding roadmap stages
      expect(screen.getByText(/Your Immigration Onboarding Roadmap/i)).toBeDefined();
      expect(screen.getByText(/1\. Retainer & Portal Setup/i)).toBeDefined();
      expect(screen.getByText(/2\. Case Docket & Stream/i)).toBeDefined();
      expect(screen.getByText(/3\. Evidence Checklist/i)).toBeDefined();

      // Verify legal scanning guidance (300 DPI, government verification standards)
      expect(screen.getByText(/Document Scanning & OCR Guidelines/i)).toBeDefined();
      expect(screen.getByText(/300 DPI/i)).toBeDefined();

      // Verify actionable buttons
      const questionnaireBtn = screen.getByRole("button", { name: /Open Background Wizard →/i });
      fireEvent.click(questionnaireBtn);
      expect(onOpenQuestionnaire).toHaveBeenCalledTimes(1);

      const faqBtn = screen.getByRole("button", { name: /View Scanning Standards →/i });
      fireEvent.click(faqBtn);
      expect(onOpenOcrFaq).toHaveBeenCalledTimes(1);
    });

    it("FirmCleanSlateEmptyState mounts Day 0 onboarding launchpad with actionable multi-path triggers", () => {
      const onOpenCreateClient = vi.fn();
      const onNavigateToExtractorLab = vi.fn();
      const onNavigateToCalculators = vi.fn();

      render(
        <FirmCleanSlateEmptyState
          firmName="Sovereign Legal Partners"
          onOpenCreateClient={onOpenCreateClient}
          onNavigateToExtractorLab={onNavigateToExtractorLab}
          onNavigateToCalculators={onNavigateToCalculators}
        />
      );

      // Regulatory & tenant isolation guidance
      expect(screen.getByText(/Sovereign Legal Partners is Initialized and Ready/i)).toBeDefined();
      expect(
        screen.getByText(/Zero active client records or open matters are currently in this tenant partition/i)
      ).toBeDefined();

      // 3 Quickstart Pillars
      expect(screen.getByText(/1\. Retain Client & Issue Portal/i)).toBeDefined();
      expect(screen.getByText(/2\. Test Document Extractor Lab/i)).toBeDefined();
      expect(screen.getByText(/3\. Evaluate PR Pathways/i)).toBeDefined();

      // Triggers
      const createButtons = screen.getAllByRole("button", { name: /\+ Onboard First Client/i });
      expect(createButtons.length).toBeGreaterThanOrEqual(1);
      fireEvent.click(createButtons[0]);
      expect(onOpenCreateClient).toHaveBeenCalled();

      const labBtn = screen.getByRole("button", { name: /Open Extractor Lab →/i });
      fireEvent.click(labBtn);
      expect(onNavigateToExtractorLab).toHaveBeenCalledTimes(1);

      const calcBtn = screen.getByRole("button", { name: /Open Calculators →/i });
      fireEvent.click(calcBtn);
      expect(onNavigateToCalculators).toHaveBeenCalledTimes(1);
    });
  });

  describe("4. DashboardErrorBoundary Resilience & Containment", () => {
    function ExplodingTab(): React.ReactNode {
      throw new Error("Simulated tab component crash during parsing");
    }

    it("prevents catastrophic app crash, reports fault, and isolates error boundary", () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      render(
        <div data-testid="portal-root">
          <header>Portal Header Active</header>
          <DashboardErrorBoundary sectionTitle="Casework Dossier">
            <ExplodingTab />
          </DashboardErrorBoundary>
        </div>
      );

      // Surrounding application layout remains intact
      expect(screen.getByText("Portal Header Active")).toBeDefined();

      // Fault UI rendered
      expect(screen.getByText(/SECTION FAULT ISOLATED/i)).toBeDefined();
      expect(screen.getByText(/Casework Dossier Temporarily Unavailable/i)).toBeDefined();
      expect(screen.getByRole("button", { name: /↻ Reload Section/i })).toBeDefined();

      consoleError.mockRestore();
    });
  });
});
