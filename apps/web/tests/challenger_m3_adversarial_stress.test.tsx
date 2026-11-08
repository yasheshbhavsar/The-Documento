import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

import { OwnerMasterDashboard } from "../components/dashboards/OwnerMasterDashboard";
import { EmployeeWorkspace } from "../components/dashboards/EmployeeWorkspace";
import { ClientPortal } from "../components/dashboards/ClientPortal";
import { CaseOfficerChatBanner } from "../components/portal/CaseOfficerChatBanner";
import {
  FIXTURE_CASES,
  FIXTURE_CLIENTS,
  FIXTURE_DOCUMENTS,
  FIXTURE_AUDIT_EVENTS,
  FIXTURE_TASKS,
  FIXTURE_AI_FINDINGS,
  FIXTURE_MESSAGES,
  FIXTURE_INVOICES,
  FIXTURE_CAPACITY,
  FIXTURE_NOTIFICATIONS,
} from "../lib/api";
import { ImmigrationCase } from "../lib/types";

describe("Empirical Challenger Adversarial Stress Harness — Milestone 3 Consolidations", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  // =========================================================================
  // SUITE 1: RAPID TAB & SECTION SWITCHING STRESS TESTS
  // =========================================================================
  describe("1. Rapid Tab and Section Switching Invariants", () => {
    it("OwnerMasterDashboard: survives rapid 50-cycle switching across all 5 business sections and sub-tabs without crash or state desync", async () => {
      const handleSelectCase = vi.fn();
      const handleOpenCreateClient = vi.fn();

      const { container } = render(
        <OwnerMasterDashboard
          cases={FIXTURE_CASES}
          clients={FIXTURE_CLIENTS}
          auditEvents={FIXTURE_AUDIT_EVENTS}
          invoices={FIXTURE_INVOICES}
          capacity={FIXTURE_CAPACITY}
          isLiveBackend={true}
          onSelectCase={handleSelectCase}
          onOpenCreateClient={handleOpenCreateClient}
        />
      );

      // Verify initial mount in Executive Overview
      expect(screen.getByRole("heading", { name: "Company Overview" })).toBeDefined();

      // Define tab keys across the 5 business sections
      const testTabKeys = [
        // Section 1: Executive Overview
        "tab-btn-overview",
        "tab-btn-executive",
        "tab-btn-analytics",
        // Section 2: Caseload & Retainers
        "tab-btn-cases",
        "tab-btn-clients",
        "tab-btn-financials",
        // Section 3: Operations & Triage
        "tab-btn-manager-priority",
        "tab-btn-operations",
        "tab-btn-team",
        "tab-btn-conversation-inspector",
        "tab-btn-reliability-ops",
        // Section 4: Partner Growth
        "tab-btn-partner-growth",
        "tab-btn-stage10-pathway-expansion",
        // Section 5: Firm Governance
        "tab-btn-firm-config",
        "tab-btn-billing",
        "tab-btn-rules",
        "tab-btn-audit",
        "tab-btn-stage9-release-governance",
      ];

      // Execute 50 rapid sequential switches
      for (let i = 0; i < 50; i++) {
        const targetId = testTabKeys[i % testTabKeys.length];
        const btn = container.querySelector(`#${targetId}`);
        expect(btn).not.toBeNull();
        act(() => {
          fireEvent.click(btn!);
        });
      }

      // Conclude on "tab-btn-cases" in Section 2 (Caseload & Retainers)
      act(() => {
        const casesBtn = container.querySelector("#tab-btn-cases");
        fireEvent.click(casesBtn!);
      });

      // Verify that Section 2 is active and in-view sub-navigation pill bar is displayed
      expect(screen.getByRole("heading", { name: "All Cases" })).toBeDefined();
      const subNavTablist = screen.getByRole("tablist", { name: "Caseload & Retainers Views" });
      expect(subNavTablist).toBeDefined();

      // Test sub-navigation pill switching inside main
      const retainedClientsPill = screen.getByRole("tab", { name: /Retained Clients/i });
      act(() => {
        fireEvent.click(retainedClientsPill);
      });
      expect(screen.getByRole("heading", { name: /Retained Clients & Portal Access Control/i })).toBeDefined();
    });

    it("EmployeeWorkspace: survives rapid 50-cycle switching across all 4 caseworker views and sub-tabs without crash or state tearing", async () => {
      const handleToggleTask = vi.fn();
      const handleSelectCase = vi.fn();

      const { container } = render(
        <EmployeeWorkspace
          cases={FIXTURE_CASES}
          clients={FIXTURE_CLIENTS}
          documents={FIXTURE_DOCUMENTS}
          tasks={FIXTURE_TASKS}
          aiFindings={FIXTURE_AI_FINDINGS}
          messages={FIXTURE_MESSAGES}
          onToggleTask={handleToggleTask}
          onSelectCase={handleSelectCase}
        />
      );

      // Verify initial mount in My Casework
      expect(screen.getByRole("heading", { name: "Casework & Evidence Hub" })).toBeDefined();

      // Keys across all 4 caseworker views
      const employeeTabKeys = [
        // Hub 1: My Casework
        "tab-btn-my_work",
        "tab-btn-assigned_cases",
        "tab-btn-tasks",
        "tab-btn-clients",
        "tab-btn-team_queues",
        // Hub 2: Priority Triage & Exceptions
        "tab-btn-exception_queue",
        "tab-btn-ai_findings",
        "tab-btn-rules_requirements",
        "tab-btn-rules_admin",
        "tab-btn-release_governance",
        "tab-btn-pathway_expansion",
        // Hub 3: Casework Studio
        "tab-btn-all_in_one_workspace",
        "tab-btn-documents",
        "tab-btn-form_prep",
        "tab-btn-package_review",
        "tab-btn-ai_assistant",
        // Hub 4: Communications Hub
        "tab-btn-messages",
        "tab-btn-client_requests",
        "tab-btn-visa_appointments",
      ];

      // Execute 50 rapid sequential switches
      for (let i = 0; i < 50; i++) {
        const targetId = employeeTabKeys[i % employeeTabKeys.length];
        const btn = container.querySelector(`[data-testid="${targetId}"]`);
        expect(btn).not.toBeNull();
        act(() => {
          fireEvent.click(btn!);
        });
      }

      // Switch to Hub 3: Casework Studio -> Form Prep
      act(() => {
        const formPrepBtn = container.querySelector('[data-testid="tab-btn-form_prep"]');
        fireEvent.click(formPrepBtn!);
      });
      expect(screen.getByRole("heading", { name: "Form Preparation" })).toBeDefined();

      // Verify in-view horizontal sub-tab bar inside main
      const studioTablist = screen.getByRole("tablist", { name: "Casework Studio Views" });
      expect(studioTablist).toBeDefined();

      // Switch to Package Review via horizontal sub-tab bar
      const pkgReviewPill = screen.getByRole("tab", { name: /Package Review/i });
      act(() => {
        fireEvent.click(pkgReviewPill);
      });
      expect(screen.getByRole("heading", { name: "Package Review" })).toBeDefined();
    });

    it("ClientPortal: survives rapid 50-cycle switching across all 4 applicant hubs and horizontal sub-tabs without error", async () => {
      render(
        <ClientPortal
          myCase={FIXTURE_CASES[0]}
          documents={FIXTURE_DOCUMENTS}
          messages={FIXTURE_MESSAGES}
          notifications={FIXTURE_NOTIFICATIONS}
          invoices={FIXTURE_INVOICES}
        />
      );

      // Verify initial mount in Application Overview
      expect(screen.getByRole("heading", { name: /My Petition Overview/i })).toBeDefined();

      // Tabs across the 4 applicant hubs
      const clientNavButtons = [
        "My Petition Overview",
        "Case Milestones",
        "Retainers & Invoices",
        "Privacy & Security",
        "Per-Applicant Checklist",
        "Upload Documents",
        "Standards for Uploading Documents",
        "Initial Information Sheet",
        "Guided Questionnaire",
        "Review Application Forms",
        "Client Profile & Visa File Scope",
        "Chat with Case Officer",
        "Visa File Updates",
      ];

      // Execute 50 rapid switches
      for (let i = 0; i < 50; i++) {
        const targetName = clientNavButtons[i % clientNavButtons.length];
        const btn = screen.getAllByRole("button", { name: new RegExp(targetName, "i") })[0];
        expect(btn).toBeDefined();
        act(() => {
          fireEvent.click(btn);
        });
      }

      // Conclude on Evidentiary Checklist hub
      act(() => {
        const checklistBtn = screen.getAllByRole("button", { name: /Per-Applicant Checklist/i })[0];
        fireEvent.click(checklistBtn);
      });

      // Verify in-view sub-navigation exists
      const checklistSubTablist = screen.getByRole("tablist", { name: /Evidentiary Checklist Sub-navigation/i });
      expect(checklistSubTablist).toBeDefined();

      // Switch to "Upload Standards & OCR Guidelines" sub-tab
      const guidelinesPill = screen.getByRole("tab", { name: /Upload Standards & OCR Guidelines/i });
      act(() => {
        fireEvent.click(guidelinesPill);
      });
      expect(screen.getByText(/Standards for Uploading Documents for Optimal OCR/i)).toBeDefined();
    });
  });

  // =========================================================================
  // SUITE 2: MULTILINGUAL SWITCHING (EN -> GU -> HI) ADVERSARIAL STRESS
  // =========================================================================
  describe("2. Multilingual Switching (English -> Gujarati -> Hindi) Invariants", () => {
    it("dynamically transforms navigation labels and prompt chips across English, Gujarati, and Hindi without unhandled exceptions", async () => {
      render(
        <ClientPortal
          myCase={FIXTURE_CASES[0]}
          documents={FIXTURE_DOCUMENTS}
          messages={FIXTURE_MESSAGES}
          notifications={FIXTURE_NOTIFICATIONS}
          invoices={FIXTURE_INVOICES}
        />
      );

      // 1. Initial State: ENGLISH
      expect(screen.getAllByText(/My Petition Overview/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Visa File Updates/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Upload Documents/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Chat with Case Officer/i).length).toBeGreaterThan(0);

      // Switch to Messages view to expose CaseOfficerChatBanner
      const messagesNavBtn = screen.getAllByRole("button", { name: /Chat with Case Officer/i })[0];
      act(() => {
        fireEvent.click(messagesNavBtn);
      });

      // Verify English prompt chips in CaseOfficerChatBanner
      expect(screen.getByText(/Can you confirm if my USCIS Form I-797 receipt notice has arrived\?/i)).toBeDefined();
      expect(screen.getByText(/Ask about travel outside US while petition is pending/i)).toBeDefined();
      expect(screen.getByText(/Check if uploaded tax returns are sufficient/i)).toBeDefined();
      expect(screen.getByText(/Request certified copy of Form I-797 approval notice/i)).toBeDefined();

      // 2. Switch to GUJARATI (ગુજરાતી)
      const gujaratiBtn = screen.getByRole("button", { name: /ગુજરાતી/i });
      act(() => {
        fireEvent.click(gujaratiBtn);
      });

      // Assert Gujarati navigation labels
      expect(screen.getAllByText(/મારી અરજીની ઝાંખી/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/વિઝા ફાઇલ અપડેટ્સ/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/દસ્તાવેજો અપલોડ કરો/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/કેસ અધિકારી સાથે વાતચીત/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/કેસના મુખ્ય તબક્કા/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/રીટેનર અને ઇન્વૉઇસેસ/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/ગોપનીયતા અને સુરક્ષા/i).length).toBeGreaterThan(0);

      // Assert Gujarati prompt chips in CaseOfficerChatBanner
      expect(screen.getByText(/આગામી તબક્કા માટે અંદાજિત સમયરેખા પૂછો/i)).toBeDefined();
      expect(screen.getByText(/અરજી પેન્ડિંગ હોય ત્યારે વિદેશ મુસાફરી અંગે પૂછો/i)).toBeDefined();
      expect(screen.getByText(/અપલોડ કરેલા ટેક્સ રિટર્ન પૂરતા છે કે નહીં તે ચકાસો/i)).toBeDefined();
      expect(screen.getByText(/ફોર્મ I-797 મંજૂરી પત્રની પ્રમાણિત નકલની વિનંતી કરો/i)).toBeDefined();

      // Verify bilingual coordination indicator
      expect(screen.getByText(/🌐 Bilingual English Coordination Active/i)).toBeDefined();

      // 3. Switch to HINDI (हिन्दी)
      const hindiBtn = screen.getByRole("button", { name: /हिन्दी/i });
      act(() => {
        fireEvent.click(hindiBtn);
      });

      // Assert Hindi navigation labels
      expect(screen.getAllByText(/मेरी याचिका का विवरण/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/वीज़ा फ़ाइल अपडेट/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/दस्तावेज़ अपलोड करें/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/केस अधिकारी से चैट करें/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/केस के प्रमुख पड़ाव/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/रिटेनर और चालान/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/गोपनीयता और सुरक्षा/i).length).toBeGreaterThan(0);

      // Assert Hindi prompt chips in CaseOfficerChatBanner
      expect(screen.getByText(/अगले पड़ाव के लिए अनुमानित समय सीमा पूछें/i)).toBeDefined();
      expect(screen.getByText(/याचिका लंबित होने पर विदेश यात्रा के बारे में पूछें/i)).toBeDefined();
      expect(screen.getByText(/अपलोड किए गए टैक्स रिटर्न पर्याप्त हैं या नहीं यह जाँचें/i)).toBeDefined();
      expect(screen.getByText(/फॉर्म I-797 स्वीकृति पत्र की प्रमाणित प्रति का अनुरोध करें/i)).toBeDefined();

      // 4. Adversarial Stress: Rapid back-and-forth language switching 30 times
      const langButtons = [
        screen.getByRole("button", { name: /English/i }),
        screen.getByRole("button", { name: /ગુજરાતી/i }),
        screen.getByRole("button", { name: /हिन्दी/i }),
      ];

      for (let i = 0; i < 30; i++) {
        act(() => {
          fireEvent.click(langButtons[i % 3]);
        });
      }

      // Return to English and verify clean integrity
      act(() => {
        fireEvent.click(screen.getByRole("button", { name: /English/i }));
      });
      expect(screen.getAllByText(/My Petition Overview/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Can you confirm if my USCIS Form I-797 receipt notice has arrived\?/i)).toBeDefined();
    });

    it("CaseOfficerChatBanner: correctly triggers bilingual formatted text injection for English, Gujarati, and Hindi prompts", () => {
      const handleSelectPrompt = vi.fn();

      // Gujarati Test
      const { rerender } = render(
        <CaseOfficerChatBanner
          caseNumber="CASE-US-8841"
          visaCategory="EB-1A Extraordinary Ability"
          language="gu"
          onSelectPrompt={handleSelectPrompt}
        />
      );

      const gujaratiChip = screen.getByText(/આગામી તબક્કા માટે અંદાજિત સમયરેખા પૂછો/i);
      act(() => {
        fireEvent.click(gujaratiChip);
      });
      expect(handleSelectPrompt).toHaveBeenCalledWith(expect.stringContaining("[ગુજરાતી]:"));
      expect(handleSelectPrompt).toHaveBeenCalledWith(expect.stringContaining("[English for Officer]:"));

      // Hindi Test
      rerender(
        <CaseOfficerChatBanner
          caseNumber="CASE-US-8841"
          visaCategory="EB-1A Extraordinary Ability"
          language="hi"
          onSelectPrompt={handleSelectPrompt}
        />
      );

      const hindiChip = screen.getByText(/अगले पड़ाव के लिए अनुमानित समय सीमा पूछें/i);
      act(() => {
        fireEvent.click(hindiChip);
      });
      expect(handleSelectPrompt).toHaveBeenCalledWith(expect.stringContaining("[हिन्दी]:"));
      expect(handleSelectPrompt).toHaveBeenCalledWith(expect.stringContaining("[English for Officer]:"));
    });
  });

  // =========================================================================
  // SUITE 3: EMPTY STATE VS POPULATED STATE TOGGLING ADVERSARIAL STRESS
  // =========================================================================
  describe("3. Empty State vs Populated State Toggling Invariants", () => {
    // Wrapper component to simulate dynamic live toggling of myCase between null and populated fixture
    function DynamicClientPortalHarness() {
      const [caseData, setCaseData] = useState<ImmigrationCase | null>(null);

      return (
        <div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            <button
              type="button"
              data-testid="toggle-empty-btn"
              onClick={() => setCaseData(null)}
            >
              Set Case Null
            </button>
            <button
              type="button"
              data-testid="toggle-populated-btn"
              onClick={() => setCaseData(FIXTURE_CASES[0])}
            >
              Set Case Populated
            </button>
          </div>

          <ClientPortal
            myCase={caseData}
            documents={caseData ? FIXTURE_DOCUMENTS : []}
            messages={caseData ? FIXTURE_MESSAGES : []}
            notifications={caseData ? FIXTURE_NOTIFICATIONS : []}
            invoices={caseData ? FIXTURE_INVOICES : []}
          />
        </div>
      );
    }

    it("ClientPortal: dynamically toggles between empty state (`myCase === null`) and populated state without state leak or crash", async () => {
      render(<DynamicClientPortalHarness />);

      // STEP 1: Verify Initial Empty State (myCase === null)
      expect(screen.getByTestId("unassigned-client-empty-state")).toBeDefined();
      expect(screen.getByText(/PORTAL ACCOUNT ACTIVE/i)).toBeDefined();
      expect(screen.getByText(/Welcome to Documento/i)).toBeDefined();
      expect(screen.getByText(/Awaiting Case File Setup by Legal Team/i)).toBeDefined();
      expect(screen.getByText(/Initial Setup Ready/i)).toBeDefined();
      expect(screen.getByText(/No Active Case/i)).toBeDefined();
      expect(screen.getByText(/Pending Intake/i)).toBeDefined();
      expect(screen.getByTestId("overview-visa-scope-pending")).toBeDefined();

      // STEP 2: Toggle to Populated Case (myCase !== null)
      act(() => {
        fireEvent.click(screen.getByTestId("toggle-populated-btn"));
      });

      // Verify empty state is completely unmounted
      expect(screen.queryByTestId("unassigned-client-empty-state")).toBeNull();
      expect(screen.queryByText(/Awaiting Case File Setup by Legal Team/i)).toBeNull();
      expect(screen.queryByTestId("overview-visa-scope-pending")).toBeNull();

      // Verify populated case details appear
      expect(screen.getByText(/Case Ref: CASE-US-8841/i)).toBeDefined();
      expect(screen.getAllByText(/EB-1A Extraordinary Ability/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Case #CASE-US-8841/i)).toBeDefined();

      // STEP 3: Toggle back to Empty Case (myCase === null)
      act(() => {
        fireEvent.click(screen.getByTestId("toggle-empty-btn"));
      });

      // Verify clean restoration of empty state
      expect(screen.getByTestId("unassigned-client-empty-state")).toBeDefined();
      expect(screen.getByText(/Awaiting Case File Setup by Legal Team/i)).toBeDefined();
      expect(screen.getByText(/No Active Case/i)).toBeDefined();
      expect(screen.getByTestId("overview-visa-scope-pending")).toBeDefined();
      expect(screen.queryByText(/Case Ref: CASE-US-8841/i)).toBeNull();

      // STEP 4: Adversarial Rapid Flapping Stress (10 rapid toggles between null and populated)
      const emptyBtn = screen.getByTestId("toggle-empty-btn");
      const populatedBtn = screen.getByTestId("toggle-populated-btn");

      for (let i = 0; i < 10; i++) {
        act(() => {
          fireEvent.click(populatedBtn);
        });
        act(() => {
          fireEvent.click(emptyBtn);
        });
      }

      // Assert final state is cleanly empty
      expect(screen.getByTestId("unassigned-client-empty-state")).toBeDefined();
      expect(screen.getByText(/Awaiting Case File Setup by Legal Team/i)).toBeDefined();
      expect(screen.getByText(/Initial Setup Ready/i)).toBeDefined();
    });

    it("OwnerMasterDashboard: renders clean zero-state gracefully when cases, clients, and invoices are empty", async () => {
      render(
        <OwnerMasterDashboard
          cases={[]}
          clients={[]}
          auditEvents={[]}
          invoices={[]}
          capacity={[]}
        />
      );

      // Assert zero division safety in metrics
      expect(screen.getByText("Active Caseload: 0 Petitions")).toBeDefined();
      expect(screen.getByText("No Active Cases in Firm Workspace")).toBeDefined();

      // Check Invoices/Financials tab with zero data
      const financialsTab = screen.getByRole("button", { name: /Revenue & Billing/i });
      act(() => {
        fireEvent.click(financialsTab);
      });
      expect(screen.getByRole("heading", { name: "Revenue & Billing" })).toBeDefined();
    });

    it("EmployeeWorkspace: renders clean zero-state gracefully when all queues and matters are empty", async () => {
      render(
        <EmployeeWorkspace
          cases={[]}
          clients={[]}
          documents={[]}
          tasks={[]}
          aiFindings={[]}
          messages={[]}
        />
      );

      // Verify Exception-First Queue displays zero state
      const exceptionTab = screen.getByRole("button", { name: /Exception-First Queue/i });
      act(() => {
        fireEvent.click(exceptionTab);
      });
      expect(screen.getByText(/Zero Exceptions Pending • Day 0 Initial State/i)).toBeDefined();

      // Verify Assigned Cases displays empty caseload
      const assignedCasesTab = screen.getByRole("button", { name: /Assigned Cases/i });
      act(() => {
        fireEvent.click(assignedCasesTab);
      });
      expect(screen.getByRole("heading", { name: /Assigned Cases/i })).toBeDefined();
    });
  });
});
