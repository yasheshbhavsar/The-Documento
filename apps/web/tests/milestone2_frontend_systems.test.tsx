import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  WorkspaceProvider,
  useWorkspace,
  useWorkspaceSafe,
} from "../lib/context/WorkspaceContext";
import {
  TableSkeleton,
  MetricCardSkeleton,
  CardGridSkeleton,
  MetricGridSkeleton,
  DossierSkeleton,
  DetailDrawerSkeleton,
} from "../components/common/Skeletons";
import { DashboardErrorBoundary } from "../components/common/DashboardErrorBoundary";
import {
  UnassignedClientEmptyState,
  FirmCleanSlateEmptyState,
} from "../components/common/EmptyStates";
import { DataTable } from "../components/common/DataTable";
import { MetricCard } from "../components/common/MetricCard";

describe("Milestone 2: Frontend Systems & State Management", () => {
  describe("1. WorkspaceContext Contract & Safety", () => {
    function TestSafeConsumer() {
      const ws = useWorkspaceSafe();
      return <div data-testid="ws-safe">{ws ? "has-context" : "no-context"}</div>;
    }

    function TestStrictConsumer() {
      const ws = useWorkspace();
      return <div data-testid="ws-strict">{ws.activeRole}</div>;
    }

    it("useWorkspaceSafe returns null without throwing when outside WorkspaceProvider", () => {
      render(<TestSafeConsumer />);
      expect(screen.getByTestId("ws-safe").textContent).toBe("no-context");
    });

    it("useWorkspace throws a descriptive error when invoked outside WorkspaceProvider", () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(() => render(<TestStrictConsumer />)).toThrow(
        "useWorkspace must be used within a WorkspaceProvider"
      );
      consoleError.mockRestore();
    });

    it("WorkspaceProvider renders children and supplies initialized domain collections and mutators", () => {
      function Consumer() {
        const { cases, clients, documents, activeRole, bannerAlert } = useWorkspace();
        return (
          <div>
            <span data-testid="role">{activeRole}</span>
            <span data-testid="cases-count">{cases.length}</span>
            <span data-testid="clients-count">{clients.length}</span>
            <span data-testid="docs-count">{documents.length}</span>
            <span data-testid="alert">{bannerAlert ? bannerAlert.message : "none"}</span>
          </div>
        );
      }

      render(
        <WorkspaceProvider>
          <Consumer />
        </WorkspaceProvider>
      );

      expect(screen.getByTestId("role").textContent).toBe("master_admin");
      expect(screen.getByTestId("cases-count").textContent).toBe("0");
      expect(screen.getByTestId("clients-count").textContent).toBe("0");
      expect(screen.getByTestId("docs-count").textContent).toBe("0");
      expect(screen.getByTestId("alert").textContent).toBe("none");
    });
  });

  describe("2. Reusable Animated Skeletons", () => {
    it("TableSkeleton renders table layout with status role and custom row/col counts", () => {
      render(<TableSkeleton rowCount={4} columnCount={3} />);
      const skeleton = screen.getByRole("status", { name: /loading table data/i });
      expect(skeleton).toBeDefined();
      expect(skeleton.getAttribute("aria-busy")).toBe("true");

      const rows = skeleton.querySelectorAll("tbody tr");
      expect(rows.length).toBe(4);
      const cells = rows[0].querySelectorAll("td");
      expect(cells.length).toBe(3);
    });

    it("MetricCardSkeleton renders status role with pulse numerals", () => {
      render(<MetricCardSkeleton hasDrilldown={true} hasBadge={true} />);
      const skeleton = screen.getByRole("status", { name: /loading metric/i });
      expect(skeleton).toBeDefined();
      expect(skeleton.getAttribute("aria-busy")).toBe("true");
    });

    it("CardGridSkeleton & MetricGridSkeleton render configurable multi-card grids", () => {
      render(<CardGridSkeleton count={3} columns={3} />);
      const grid = screen.getByRole("status", { name: /loading card grid/i });
      expect(grid).toBeDefined();
      const articles = grid.querySelectorAll("article");
      expect(articles.length).toBe(3);
      expect(MetricGridSkeleton).toBe(CardGridSkeleton);
    });

    it("DossierSkeleton renders workbench split-pane and drawer variants", () => {
      const { rerender } = render(<DossierSkeleton variant="workbench" />);
      expect(screen.getByRole("status", { name: /loading document dossier workbench/i })).toBeDefined();

      rerender(<DossierSkeleton variant="drawer" />);
      expect(screen.getByRole("status", { name: /loading case (details )?drawer/i })).toBeDefined();
    });

    it("DetailDrawerSkeleton renders slide-over drawer structure", () => {
      render(<DetailDrawerSkeleton />);
      expect(screen.getByRole("status", { name: /loading case details drawer/i })).toBeDefined();
    });
  });

  describe("3. DashboardErrorBoundary & Fault Isolation", () => {
    function BuggyComponent({ shouldThrow }: { shouldThrow: boolean }) {
      if (shouldThrow) {
        throw new Error("Simulated rendering defect in caseworker table");
      }
      return <div>Normal Content Display</div>;
    }

    it("catches render errors and renders non-alarmist fault recovery UI without crashing page", () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      render(
        <DashboardErrorBoundary sectionTitle="Caseworker Table">
          <BuggyComponent shouldThrow={true} />
        </DashboardErrorBoundary>
      );

      expect(screen.getByTestId("dashboard-error-boundary-fallback")).toBeDefined();
      expect(screen.getByText(/SECTION FAULT ISOLATED/i)).toBeDefined();
      expect(screen.getByText(/Caseworker Table Temporarily Unavailable/i)).toBeDefined();
      expect(screen.getByRole("button", { name: /↻ Reload Section/i })).toBeDefined();

      consoleError.mockRestore();
    });

    it("allows resetting the error state via reload button", () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const handleReset = vi.fn();

      render(
        <DashboardErrorBoundary sectionTitle="Operations Hub" onReset={handleReset}>
          <BuggyComponent shouldThrow={true} />
        </DashboardErrorBoundary>
      );

      const reloadBtn = screen.getByRole("button", { name: /↻ Reload Section/i });
      fireEvent.click(reloadBtn);
      expect(handleReset).toHaveBeenCalledTimes(1);

      consoleError.mockRestore();
    });

    it("renders custom fallbackRender when provided", () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      render(
        <DashboardErrorBoundary
          sectionTitle="Custom Boundary"
          fallbackRender={({ error, resetErrorBoundary }) => (
            <div data-testid="custom-fallback">
              <span>Custom: {error.message}</span>
              <button onClick={resetErrorBoundary}>Try Again</button>
            </div>
          )}
        >
          <BuggyComponent shouldThrow={true} />
        </DashboardErrorBoundary>
      );

      expect(screen.getByTestId("custom-fallback")).toBeDefined();
      expect(screen.getByText(/Custom: Simulated rendering defect in caseworker table/i)).toBeDefined();

      consoleError.mockRestore();
    });
  });

  describe("4. Guided Empty States", () => {
    it("UnassignedClientEmptyState renders roadmap and next step action triggers", () => {
      const onOpenQuestionnaire = vi.fn();
      const onOpenOcrFaq = vi.fn();

      render(
        <UnassignedClientEmptyState
          clientName="Priya Patel"
          firmName="Apex Global Immigration"
          onOpenQuestionnaire={onOpenQuestionnaire}
          onOpenOcrFaq={onOpenOcrFaq}
        />
      );

      expect(screen.getByTestId("unassigned-client-empty-state")).toBeDefined();
      expect(screen.getByText(/Welcome to Documento, Priya Patel/i)).toBeDefined();
      expect(screen.getByText(/Apex Global Immigration/i)).toBeDefined();
      expect(screen.getByText(/Your Immigration Onboarding Roadmap/i)).toBeDefined();

      const wizardBtn = screen.getByRole("button", { name: /Open Background Wizard →/i });
      fireEvent.click(wizardBtn);
      expect(onOpenQuestionnaire).toHaveBeenCalledTimes(1);

      const faqBtn = screen.getByRole("button", { name: /View Scanning Standards →/i });
      fireEvent.click(faqBtn);
      expect(onOpenOcrFaq).toHaveBeenCalledTimes(1);
    });

    it("FirmCleanSlateEmptyState renders Day 0 onboarding launchpad and 3 quickstart cards", () => {
      const onOpenCreateClient = vi.fn();
      const onNavigateToExtractorLab = vi.fn();
      const onNavigateToCalculators = vi.fn();

      render(
        <FirmCleanSlateEmptyState
          firmName="Pacific Counsel LLC"
          onOpenCreateClient={onOpenCreateClient}
          onNavigateToExtractorLab={onNavigateToExtractorLab}
          onNavigateToCalculators={onNavigateToCalculators}
        />
      );

      expect(screen.getByTestId("firm-clean-slate-empty-state")).toBeDefined();
      expect(screen.getByText(/Pacific Counsel LLC is Initialized and Ready/i)).toBeDefined();
      expect(screen.getByText(/1\. Retain Client & Issue Portal/i)).toBeDefined();
      expect(screen.getByText(/2\. Test Document Extractor Lab/i)).toBeDefined();
      expect(screen.getByText(/3\. Evaluate PR Pathways/i)).toBeDefined();

      const firstClientBtns = screen.getAllByRole("button", { name: /\+ Onboard First Client/i });
      expect(firstClientBtns.length).toBeGreaterThan(0);
      fireEvent.click(firstClientBtns[0]);
      expect(onOpenCreateClient).toHaveBeenCalled();

      const labBtn = screen.getByRole("button", { name: /Open Extractor Lab →/i });
      fireEvent.click(labBtn);
      expect(onNavigateToExtractorLab).toHaveBeenCalledTimes(1);

      const calcBtn = screen.getByRole("button", { name: /Open Calculators →/i });
      fireEvent.click(calcBtn);
      expect(onNavigateToCalculators).toHaveBeenCalledTimes(1);
    });
  });

  describe("5. DataTable & MetricCard Loading (CLS Elimination)", () => {
    it("DataTable renders animated skeleton rows when isLoading is true", () => {
      const columns = [
        { key: "id", header: "Case ID" },
        { key: "client", header: "Client Name" },
        { key: "status", header: "Status" },
      ];

      render(
        <DataTable
          columns={columns}
          data={[]}
          keyExtractor={(r: any) => r.id}
          isLoading={true}
          skeletonRows={4}
        />
      );

      // Does NOT show empty message
      expect(screen.queryByText(/No records found/i)).toBeNull();

      // Renders skeleton rows
      const skeletonRows = document.querySelectorAll("tr[key*='dt-skeleton-row'], tbody tr");
      expect(skeletonRows.length).toBe(4);
    });

    it("DataTable renders empty message when isLoading is false and data is empty", () => {
      const columns = [{ key: "id", header: "Case ID" }];

      render(
        <DataTable
          columns={columns}
          data={[]}
          keyExtractor={(r: any) => r.id}
          isLoading={false}
          emptyTitle="No Cases Open"
        />
      );

      expect(screen.getByText("No Cases Open")).toBeDefined();
    });

    it("MetricCard renders MetricCardSkeleton when isLoading is true", () => {
      render(
        <MetricCard
          label="Active Caseload"
          value={42}
          meaning="Total active cases"
          isLoading={true}
        />
      );

      expect(screen.getByRole("status", { name: /loading metric/i })).toBeDefined();
      expect(screen.queryByText("42")).toBeNull();
    });

    it("MetricCard renders real values when isLoading is false", () => {
      render(
        <MetricCard
          label="Active Caseload"
          value={42}
          meaning="Total active cases"
          isLoading={false}
        />
      );

      expect(screen.getByText("42")).toBeDefined();
      expect(screen.getByText("Active Caseload")).toBeDefined();
    });
  });
});
