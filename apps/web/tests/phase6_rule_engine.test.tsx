import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { RuleAdministrationHub } from "../components/rules/RuleAdministrationHub";
import { CaseRequirementEvaluationView } from "../components/rules/CaseRequirementEvaluationView";
import { EmployeeWorkspace } from "../components/dashboards/EmployeeWorkspace";
import { OwnerMasterDashboard } from "../components/dashboards/OwnerMasterDashboard";
import {
  FIXTURE_CASES,
  FIXTURE_CLIENTS,
  FIXTURE_DOCUMENTS,
  FIXTURE_TASKS,
  FIXTURE_AI_FINDINGS,
  FIXTURE_MESSAGES,
  FIXTURE_INVOICES,
} from "../lib/api";

describe("Phase 6 — Immigration Rules, Official Sources & Requirement Engine", () => {
  describe("RuleAdministrationHub Component", () => {
    it("renders the administrative tabs and official government sources registry", async () => {
      render(<RuleAdministrationHub isLiveBackend={false} initialTab="sources" />);

      // Verify title and subtitle
      expect(screen.getByText(/Immigration Rules & Requirement Engine/i)).toBeDefined();
      expect(screen.getByText(/US EB-1A Pilot Active/i)).toBeDefined();

      // Verify tabs
      expect(screen.getByText(/Country Registry & Coverage Matrix/i)).toBeDefined();
      expect(screen.getByText(/Checklist Engine & Safe Stop Simulator/i)).toBeDefined();
      expect(screen.getByText(/Official Sources & Snapshots/i)).toBeDefined();
      expect(screen.getByText(/Rule Sets & Version Lifecycle/i)).toBeDefined();
      expect(screen.getByText(/Declarative Requirements/i)).toBeDefined();
      expect(screen.getByText(/Regression Testing & Impact Analyzer/i)).toBeDefined();

      // Official source record checks
      expect(screen.getAllByText(/USCIS Policy Manual/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/USCIS/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Legal Scope & Limitations/i)).toBeDefined();
    });

    it("displays snapshot comparison with visual diff viewer and hashes", async () => {
      render(<RuleAdministrationHub isLiveBackend={false} initialTab="sources" />);

      // Wait for snapshots to load and compare button to become active
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Compare Diff/i })).toBeDefined();
      });

      const compareBtn = screen.getByRole("button", { name: /Compare Diff/i });
      fireEvent.click(compareBtn);

      // Verify diff modal opens
      await waitFor(() => {
        expect(screen.getByText(/Visual Snapshot Diff & Revision Comparison/i)).toBeDefined();
      });
      expect(screen.getByText(/USCIS Policy clarification: STEM degrees/i)).toBeDefined();
      expect(screen.getByText(/Kazarian Step 2 merits guidance/i)).toBeDefined();
    });

    it("renders Phase 6 Country Registry with priority tiers and coverage matrix", async () => {
      render(<RuleAdministrationHub isLiveBackend={false} initialTab="coverage" />);

      // Verify Priority statement
      expect(screen.getByText(/Statutory Priority Order:/i)).toBeDefined();
      expect(screen.getByText(/Canada \(IRCC\) Tier 1, USA \(USCIS\/DOS\) Tier 1/i)).toBeDefined();

      // Verify Country Registry cards
      await waitFor(() => {
        expect(screen.getByText(/Canada \(CA\)/i)).toBeDefined();
        expect(screen.getByText(/United States \(US\)/i)).toBeDefined();
        expect(screen.getByText(/Australia \(AU\)/i)).toBeDefined();
        expect(screen.getByText(/New Zealand \(NZ\)/i)).toBeDefined();
      });

      // Verify strict governance statement
      expect(screen.getByText(/Long-term breadth is an ambition, not permission to market unvalidated pathways as complete/i)).toBeDefined();

      // Verify Seed Production Packs button
      expect(screen.getByRole("button", { name: /Seed Authentic Production Packs/i })).toBeDefined();
    });

    it("demonstrates safe stop behavior on unsupported pathways with zero fallback items", async () => {
      render(<RuleAdministrationHub isLiveBackend={false} initialTab="checklist_engine" />);

      // Verify Checklist Engine header and safe stop badge
      expect(screen.getByText(/Fact-Grounded Checklist Evaluator & Safe Stop Simulator/i)).toBeDefined();
      expect(screen.getByText(/Safe Stop Active/i)).toBeDefined();

      // Trigger checklist generation
      const genBtn = screen.getByRole("button", { name: /Generate Fact-Grounded Checklist/i });
      fireEvent.click(genBtn);

      // Verify evaluated checklist cards
      await waitFor(() => {
        expect(screen.getByText(/Valid Unexpired Passport or Travel Document/i)).toBeDefined();
        expect(screen.getByText(/identity.passport/i)).toBeDefined();
      });

      // Open Phase 6 Rule JSON modal
      const viewJsonBtns = screen.getAllByRole("button", { name: /View Phase 6 JSON/i });
      expect(viewJsonBtns.length).toBeGreaterThan(0);
      fireEvent.click(viewJsonBtns[0]);

      // Verify Modal displays canonical Phase 6 JSON schema
      await waitFor(() => {
        expect(screen.getByText(/Official Statutory Rule Provenance \(Phase 6 Compliant\)/i)).toBeDefined();
        expect(screen.getByText(/Phase 6 Canonical JSON Schema/i)).toBeDefined();
      });
      expect(screen.getByRole("button", { name: /Copy Phase 6 JSON/i })).toBeDefined();
    });

    it("manages rule set versions and lifecycle state machine", async () => {
      render(<RuleAdministrationHub isLiveBackend={false} />);

      // Switch to Rule Sets & Lifecycles tab
      fireEvent.click(screen.getByText(/Rule Sets & Version Lifecycle/i));

      // Rule set and version cards
      expect(screen.getAllByText(/US EB-1A Extraordinary Ability/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/US-USCIS-EB1A/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/v1.0.0/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/PUBLISHED/i).length).toBeGreaterThan(0);

      // State machine transitions exist
      expect(screen.getByRole("button", { name: /Suspend/i })).toBeDefined();
    });

    it("displays declarative requirement builder with AST safety principles", async () => {
      render(<RuleAdministrationHub isLiveBackend={false} />);

      // Switch to Requirement Builder tab
      fireEvent.click(screen.getByText(/Declarative Requirements/i));

      // AST Safety Callout
      expect(screen.getByText(/Purely declarative rules evaluated by constrained AST engine/i)).toBeDefined();
      expect(screen.getByText(/No arbitrary database code execution/i)).toBeDefined();

      // Requirements listed
      expect(screen.getAllByText(/EB1A-MAND-ID/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Valid Unexpired Identity & Passport/i)).toBeDefined();
      expect(screen.getAllByText(/EB1A-EVID-AWARDS/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Nationally or Internationally Recognized Prizes or Awards/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/8 CFR § 204.5\(h\)\(3\)\(i\)/i).length).toBeGreaterThan(0);
    });

    it("runs regression testing and identifies affected cases without silent overwrites", async () => {
      render(<RuleAdministrationHub isLiveBackend={false} />);

      // Switch to Regression & Impact Analyzer tab
      fireEvent.click(screen.getByText(/Regression Testing & Impact Analyzer/i));

      // Impact analysis banner
      await waitFor(() => {
        expect(screen.getByText(/Zero Silent Overwrites/i)).toBeDefined();
      });
      expect(screen.getByText(/scans open cases in this jurisdiction & pathway/i)).toBeDefined();

      // Test Regression Action
      const testRegressionBtn = screen.getByRole("button", { name: /Run Automated Regression Suite/i });
      fireEvent.click(testRegressionBtn);

      await waitFor(() => {
        expect(screen.getByText(/ALL CHECKS PASSED/i)).toBeDefined();
      });
      expect(screen.getByText(/Dependency graph free of circular deadlocks/i)).toBeDefined();

      // Identify Affected Cases Action
      const impactBtn = screen.getByRole("button", { name: /Identify Affected Open Cases & Queue Tasks/i });
      fireEvent.click(impactBtn);

      await waitFor(() => {
        expect(screen.getByText(/Queued Caseworker Review Tasks/i)).toBeDefined();
      });
      expect(screen.getByText(/CASE-US-8841/i)).toBeDefined();
      expect(screen.getByText(/CASE-US-9012/i)).toBeDefined();
    });
  });

  describe("CaseRequirementEvaluationView Component", () => {
    it("renders fulfillment progress, distinct statuses, and evidentiary completion notice", async () => {
      render(
        <CaseRequirementEvaluationView
          caseId="case-01"
          cases={FIXTURE_CASES}
          isLiveBackend={false}
        />
      );

      // Header and provenance
      expect(screen.getByText(/Immigration Requirements & Rule Engine Evaluation/i)).toBeDefined();
      expect(screen.getByText(/ruleset-eb1a-01|US-USCIS-EB1A/i)).toBeDefined();
      expect(screen.getByText(/AST Constrained \(Zero DB Python\)/i)).toBeDefined();

      // Evidentiary completion principle
      expect(screen.getByText(/Evidentiary Completion Principle:/i)).toBeDefined();
      expect(screen.getByText(/A document being present in storage does not automatically satisfy a legal requirement/i)).toBeDefined();

      // Fulfillment percentage progress
      expect(screen.getAllByText(/75/i).length).toBeGreaterThan(0);

      // Distinct statuses breakdown
      expect(screen.getAllByText(/✓ Complete/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/✕ Missing/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/⚠ Needs Review/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/⛔ Blocked/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/⏱ Expired/i).length).toBeGreaterThan(0);

      // Requirement items
      expect(screen.getAllByText(/EB1A-MAND-ID/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/EB1A-EVID-AWARDS/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/EB1A-EVID-ARTICLES/i).length).toBeGreaterThan(0);

      // Missing evidence notice
      expect(screen.getByText(/No qualifying evidence documents uploaded/i)).toBeDefined();
    });

    it("filters requirements by status in CaseRequirementEvaluationView", async () => {
      render(
        <CaseRequirementEvaluationView
          caseId="case-01"
          cases={FIXTURE_CASES}
          isLiveBackend={false}
        />
      );

      expect(screen.getAllByText(/EB1A-MAND-ID/i).length).toBeGreaterThan(0);

      // Filter by 'missing' status
      const statusSelect = screen.getByLabelText(/Filter by Status/i);
      fireEvent.change(statusSelect, { target: { value: "missing" } });

      // Awards requirement is missing, should remain
      expect(screen.getAllByText(/EB1A-EVID-AWARDS/i).length).toBeGreaterThan(0);
      // Complete requirement title should be filtered out
      expect(screen.queryByText(/Valid Unexpired Identity & Passport/i)).toBeNull();
    });

    it("opens inspection modal and allows legal specialist adjudication sign-off", async () => {
      render(
        <CaseRequirementEvaluationView
          caseId="case-01"
          cases={FIXTURE_CASES}
          isLiveBackend={false}
        />
      );

      expect(screen.getAllByRole("button", { name: /^Adjudicate$/i }).length).toBeGreaterThan(0);

      // Click first Adjudicate button
      const adjudicateBtn = screen.getAllByRole("button", { name: /^Adjudicate$/i })[0];
      fireEvent.click(adjudicateBtn);

      // Verify modal opens
      expect(screen.getByText(/Adjudication Notes \/ Rationale:/i)).toBeDefined();

      // Enter notes and sign off
      const textarea = screen.getByPlaceholderText(/Enter specialist review findings/i);
      fireEvent.change(textarea, { target: { value: "Kazarian Step 2 merits analysis confirms extraordinary caliber." } });

      const signoffBtn = screen.getByRole("button", { name: /Sign Off & Satisfy Requirement/i });
      fireEvent.click(signoffBtn);

      // Modal closed and sign-off satisfied
      expect(screen.queryByText(/Adjudication Notes \/ Rationale:/i)).toBeNull();
    });

    it("shows version traceability history permanently preserving past evaluations", async () => {
      render(
        <CaseRequirementEvaluationView
          caseId="case-01"
          cases={FIXTURE_CASES}
          isLiveBackend={false}
        />
      );

      // Verify audit history card
      expect(screen.getByText(/Rule Version Traceability & Audit History/i)).toBeDefined();
      expect(screen.getByText(/Historical case evaluations are permanently preserved when rules change/i)).toBeDefined();
      expect(screen.getAllByText(/v1\.0\.0/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/\[Current Active\]/i).length).toBeGreaterThan(0);
    });
  });

  describe("Integration in Workspaces", () => {
    it("renders Case Requirements and Rule Registry tabs in EmployeeWorkspace", async () => {
      await act(async () => {
        render(
          <EmployeeWorkspace
            cases={FIXTURE_CASES}
            clients={FIXTURE_CLIENTS}
            documents={FIXTURE_DOCUMENTS}
            tasks={FIXTURE_TASKS}
            aiFindings={FIXTURE_AI_FINDINGS}
            messages={FIXTURE_MESSAGES}
            onToggleTask={vi.fn()}
            onSendMessage={vi.fn()}
            onSelectCase={vi.fn()}
            onOpenUploadModal={vi.fn()}
          />
        );
      });

      // Switch to Case Requirements
      const caseReqTab = screen.getByRole("button", { name: /Case Requirements/i });
      act(() => {
        fireEvent.click(caseReqTab);
      });

      expect(screen.getByText(/Immigration Requirements & Rule Engine Evaluation/i)).toBeDefined();

      // Switch to Rule Registry & Pilot
      const ruleRegTab = screen.getByRole("button", { name: /Rule Registry & Pilot/i });
      act(() => {
        fireEvent.click(ruleRegTab);
      });

      expect(screen.getByText(/Immigration Rules & Requirement Engine/i)).toBeDefined();
    });

    it("renders Rules & Authorities tab in OwnerMasterDashboard", async () => {
      await act(async () => {
        render(
          <OwnerMasterDashboard
            cases={FIXTURE_CASES}
            clients={FIXTURE_CLIENTS}
            auditEvents={[]}
            invoices={FIXTURE_INVOICES}
            capacity={[]}
            isLiveBackend={false}
            onOpenCreateCase={vi.fn()}
            onOpenCreateClient={vi.fn()}
            onSelectCase={vi.fn()}
          />
        );
      });

      // Click on Rules & Authorities tab button
      const rulesBtn = screen.getByRole("button", { name: /Rules & Authorities/i });
      act(() => {
        fireEvent.click(rulesBtn);
      });

      expect(screen.getByText(/Immigration Rules & Requirement Engine/i)).toBeDefined();
      expect(screen.getByText(/Official Sources & Snapshots/i)).toBeDefined();
    });
  });
});
