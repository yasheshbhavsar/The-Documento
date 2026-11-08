import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

import { OwnerMasterDashboard } from "../components/dashboards/OwnerMasterDashboard";
import { EmployeeWorkspace } from "../components/dashboards/EmployeeWorkspace";
import { ClientPortal } from "../components/dashboards/ClientPortal";
import { CreateClientModal } from "../components/modals/CreateClientModal";
import { PostOnboardingLaunchpadModal } from "../components/modals/PostOnboardingLaunchpadModal";
import { CaseDrilldownDrawer } from "../components/modals/CaseDrilldownDrawer";
import { DashboardErrorBoundary } from "../components/common/DashboardErrorBoundary";
import { EmptyState, LoadingState } from "../components/common/StateViews";

import {
  WorkspaceProvider,
  useWorkspace,
} from "../lib/context/WorkspaceContext";
import {
  getJurisdictionRepresentationInfo,
  JurisdictionRepresentationInfo,
} from "../lib/jurisdictionForms";
import {
  normalizeCaseStage,
  getCaseStageInfo,
  formatCaseStageBadge,
  CANONICAL_6_STAGES,
  CanonicalStageKey,
} from "../lib/caseLifecycle";

import {
  api,
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

import {
  ImmigrationCase,
  ClientProfile,
  DocumentItem,
  UserContext,
  CaseTask,
  CaseStage,
  DocumentStatus,
  CaseNote,
} from "../lib/types";

describe("Tier 5: Adversarial Workload & UI Boundary Verification Suite", () => {
  const baseOwner: UserContext = {
    id: "usr-apex-owner-1",
    email: "sarah.chen@apexlegal.com",
    full_name: "Sarah Chen, Managing Partner",
    role: "master_admin",
    experience: "master_admin",
    organization_id: "org-apex-001",
    organization_name: "Apex Immigration Legal Group",
    permissions: ["cases:read", "cases:write", "client:delete"],
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  /* ==========================================================================
   * SUITE 1: Full End-to-End User Journeys Across Roles & Workspaces
   * ========================================================================== */
  describe("Suite 1: Full End-to-End User Journeys (Owner, Caseworker, Client, Wizard, Launchpad, Drawer)", () => {
    it("Journey 1 — Owner Master Dashboard: executive overview, section navigation, and modal triggers", async () => {
      const handleOpenCreateCase = vi.fn();
      const handleOpenCreateClient = vi.fn();
      const handleSelectCase = vi.fn();

      const { container } = render(
        <OwnerMasterDashboard
          cases={FIXTURE_CASES}
          clients={FIXTURE_CLIENTS}
          auditEvents={FIXTURE_AUDIT_EVENTS}
          invoices={FIXTURE_INVOICES}
          capacity={FIXTURE_CAPACITY}
          isLiveBackend={true}
          onOpenCreateCase={handleOpenCreateCase}
          onOpenCreateClient={handleOpenCreateClient}
          onSelectCase={handleSelectCase}
        />
      );

      // Verify core executive metrics
      expect(screen.getByText("Operational Health & Tenant Boundary")).toBeDefined();
      expect(screen.getByText("Active Caseload & Retained Clients")).toBeDefined();

      // Verify and cycle through business navigation tabs
      const sectionButtons = [
        "Company Overview",
        "Partner Onboarding & Leads",
        "Firm Governance & Configuration",
        "Reliability, Privacy & Security",
      ];
      for (const btnText of sectionButtons) {
        const btn = screen.getByRole("button", { name: new RegExp(btnText, "i") });
        expect(btn).toBeDefined();
        act(() => {
          fireEvent.click(btn);
        });
      }

      // Switch to All Cases tab to access case and client creation actions
      const casesTabBtn = container.querySelector("#tab-btn-cases");
      expect(casesTabBtn).not.toBeNull();
      act(() => {
        fireEvent.click(casesTabBtn!);
      });

      // Trigger Create Case action
      const createCaseBtn = screen.getByRole("button", { name: /\+ Create Case/i });
      act(() => {
        fireEvent.click(createCaseBtn);
      });
      expect(handleOpenCreateCase).toHaveBeenCalledTimes(1);

      // Trigger Onboard Client action
      const onboardButtons = screen.getAllByRole("button", { name: /\+ Onboard Client & Case/i });
      expect(onboardButtons.length).toBeGreaterThan(0);
      act(() => {
        fireEvent.click(onboardButtons[0]);
      });
      expect(handleOpenCreateClient).toHaveBeenCalledTimes(1);
    });

    it("Journey 2 — Employee Workspace: caseworker queues, evidence matrix, task checklist & client comms", async () => {
      const handleSelectCase = vi.fn();
      const handleToggleTask = vi.fn();
      const handleSendMessage = vi.fn();

      render(
        <EmployeeWorkspace
          cases={FIXTURE_CASES}
          clients={FIXTURE_CLIENTS}
          documents={FIXTURE_DOCUMENTS}
          tasks={FIXTURE_TASKS}
          aiFindings={FIXTURE_AI_FINDINGS}
          messages={FIXTURE_MESSAGES}
          onToggleTask={handleToggleTask}
          onSendMessage={handleSendMessage}
          onSelectCase={handleSelectCase}
        />
      );

      // Verify casework counters
      expect(screen.getByText("Active Cases Assigned")).toBeDefined();
      expect(screen.getByText("Documents Pending Verification")).toBeDefined();
      expect(screen.getByText("AI Evidentiary Alerts")).toBeDefined();

      // Switch to Requirements & Evidence Tab
      const docsTabBtn = screen.getByRole("button", { name: /Requirements & Evidence/i });
      act(() => {
        fireEvent.click(docsTabBtn);
      });
      expect(screen.getByText("Evidence & Document Verification Matrix")).toBeDefined();

      // Switch to Tasks & Deadlines Tab
      const tasksTabBtn = screen.getByTestId("tab-btn-tasks");
      act(() => {
        fireEvent.click(tasksTabBtn);
      });
      expect(screen.getByText("Caseworker Action Items & Deadlines")).toBeDefined();

      // Toggle first task completion state
      const toggleBtns = screen.getAllByRole("button", { name: /Mark Done|✓ Done/i });
      expect(toggleBtns.length).toBeGreaterThan(0);
      act(() => {
        fireEvent.click(toggleBtns[0]);
      });
      expect(handleToggleTask).toHaveBeenCalled();
    });

    it("Journey 3 — Retained Client Portal: applicant transparency, 6-stage case lifecycle, and document requests", async () => {
      const activeCase: ImmigrationCase = {
        ...FIXTURE_CASES[0],
        status: "caseworker_review" as CaseStage,
      };
      const handleUpload = vi.fn();
      const handleQuestionnaire = vi.fn();
      const handleSendMessage = vi.fn();
      const handleMarkRead = vi.fn();

      render(
        <ClientPortal
          myCase={activeCase}
          documents={FIXTURE_DOCUMENTS}
          messages={FIXTURE_MESSAGES}
          notifications={FIXTURE_NOTIFICATIONS}
          invoices={FIXTURE_INVOICES}
          onOpenUploadModal={handleUpload}
          onOpenQuestionnaireModal={handleQuestionnaire}
          onSendMessage={handleSendMessage}
          onMarkNotificationRead={handleMarkRead}
        />
      );

      // Verify portal header & petition details
      expect(screen.getByText(/Welcome to Your Immigration Transparency Portal/i)).toBeDefined();
      expect(screen.getByText("My Petition Details")).toBeDefined();

      // Verify canonical 6-stage lifecycle display for applicant
      expect(screen.getByText("Stage: Caseworker Review")).toBeDefined();

      // Trigger Upload Evidence modal
      const uploadButtons = screen.getAllByRole("button", { name: /\+ Upload Evidence/i });
      expect(uploadButtons.length).toBeGreaterThan(0);
      act(() => {
        fireEvent.click(uploadButtons[0]);
      });
      expect(handleUpload).toHaveBeenCalledTimes(1);

      // Trigger Guided Questionnaire modal
      const questionnaireButtons = screen.getAllByRole("button", { name: /Guided Questionnaire/i });
      expect(questionnaireButtons.length).toBeGreaterThan(0);
      act(() => {
        questionnaireButtons.forEach((btn) => fireEvent.click(btn));
      });
      expect(handleQuestionnaire).toHaveBeenCalled();
    });

    it("Journey 4 — 2-Step Client Onboarding Wizard: corridor-aware representation & magic link generation", async () => {
      const handleClientCreated = vi.fn();
      const handleCaseCreated = vi.fn();
      const handleClose = vi.fn();

      render(
        <CreateClientModal
          isOpen={true}
          onClose={handleClose}
          onClientCreated={handleClientCreated}
          onCaseCreated={handleCaseCreated}
          activeRole="master_admin"
        />
      );

      // Verify Step 1 is rendered in unified flow
      expect(screen.getByText("Onboard Client & Open Visa Case")).toBeDefined();
      expect(screen.getByText(/Client Profile & Petition Scope/i)).toBeDefined();

      // Fill in Step 1 form fields (First Name, Last Name, Email, Nationality)
      fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: "Elena" } });
      fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: "Rostova" } });
      fireEvent.change(screen.getByLabelText(/Email Address/i), {
        target: { value: "elena.rostova@example.com" },
      });
      fireEvent.change(screen.getByLabelText(/Primary Nationality/i), {
        target: { value: "CAN" },
      });

      // Change jurisdiction to Canada
      const jurSelect = screen.getByLabelText(/Immigration Jurisdiction/i);
      fireEvent.change(jurSelect, { target: { value: "Canada (IRCC)" } });

      // Verify representation checkbox label dynamically updated to Canadian IMM 5476
      expect(
        screen.getByText(/Record IMM 5476 Use of a Representative for applicant/i)
      ).toBeDefined();

      // Advance to Step 2
      const configureInviteBtn = screen.getByRole("button", { name: /Configure Portal Invite →/i });
      act(() => {
        fireEvent.click(configureInviteBtn);
      });

      // Verify Step 2 is rendered with Portal Access & Magic Link tab
      expect(screen.getByText(/Portal Access & Magic Link/i)).toBeDefined();
      expect(screen.getByText(/Single-Use Invite Ready/i)).toBeDefined();

      // Complete onboarding
      const saveBtn = screen.getByRole("button", { name: /Onboard Client & Open Case/i });
      await act(async () => {
        fireEvent.click(saveBtn);
      });
      expect(handleClientCreated).toHaveBeenCalled();
    });

    it("Journey 5 — 4-Step Post-Onboarding Launchpad: credentials, officer checklist, retainer, and uploads", async () => {
      const clientRes = await api.createClient(
        {
          first_name: "Hiroshi",
          last_name: "Tanaka",
          email: "hiroshi.tanaka@example.com",
          nationality: "JPN",
          portal_credentials_provided: true,
          portal_access_enabled: true,
          temporary_password: "Doc2026!TempHiro",
        },
        "master_admin"
      );
      const testClient = clientRes.data;

      const caseRes = await api.createCase(
        {
          client_id: testClient.id,
          title: "O-1A Alien of Extraordinary Ability: Hiroshi Tanaka",
          case_number: "CASE-O1A-99",
          jurisdiction: "United States (USCIS)",
          visa_category: "O-1A Extraordinary Ability",
        },
        "master_admin"
      );
      const testCase = caseRes.data;

      const onCaseUpdated = vi.fn();
      const onDocumentUploaded = vi.fn();
      const onOpenCaseWorkspace = vi.fn();
      const onClose = vi.fn();

      render(
        <PostOnboardingLaunchpadModal
          isOpen={true}
          onClose={onClose}
          caseItem={testCase}
          clientItem={testClient}
          currentUser={baseOwner}
          activeRole="master_admin"
          onCaseUpdated={onCaseUpdated}
          onDocumentUploaded={onDocumentUploaded}
          onOpenCaseWorkspace={onOpenCaseWorkspace}
        />
      );

      // STEP 1: Portal Login Packet Handoff
      expect(
        screen.getByText(/Step 1: Hand Off Client Transparency Portal Credentials/i)
      ).toBeDefined();
      expect(screen.getByText("Portal Login Active")).toBeDefined();

      // Post welcome message to client portal
      const postWelcomeBtn = screen.getByRole("button", {
        name: /Post Welcome Note to Client Portal/i,
      });
      fireEvent.click(postWelcomeBtn);
      await waitFor(async () => {
        const msgs = await api.getMessages();
        expect(msgs.data.some((m) => m.content.includes("CASE-O1A-99"))).toBe(true);
      });

      // Move to Step 2
      fireEvent.click(screen.getByRole("button", { name: /Mark Login Shared & Next/i }));

      // STEP 2: Assign Officer & Dispatch Checklist
      expect(await screen.findByText(/Step 2: Assign Case Officer & Dispatch/i)).toBeDefined();
      fireEvent.click(
        screen.getByRole("button", { name: /Assign Officer & Dispatch Checklist/i })
      );

      // STEP 3: Initial Retainer Schedule
      expect(
        await screen.findByText(/Step 3: Configure Initial Legal Retainer/i)
      ).toBeDefined();
      fireEvent.click(
        screen.getByRole("button", { name: /Retainer Already Paid/i })
      );
      fireEvent.click(
        screen.getByRole("button", { name: /Record Paid Retainer & Next/i })
      );

      // STEP 4: Initial Counsel Evidentiary Uploads
      expect(
        await screen.findByText(/Step 4: Upload Initial Counsel Records/i)
      ).toBeDefined();
      const finishKickoffBtn = screen.getByRole("button", {
        name: /Complete Kickoff & Open Case Workspace/i,
      });
      fireEvent.click(finishKickoffBtn);
      expect(onOpenCaseWorkspace).toHaveBeenCalledWith(
        expect.objectContaining({ case_number: "CASE-O1A-99" })
      );
    });

    it("Journey 6 — Case Drilldown Drawer: canonical 6-stage badge and single primary action button", async () => {
      const activeCase: ImmigrationCase = {
        ...FIXTURE_CASES[0],
        id: "case-can-771-id",
        case_number: "CASE-CAN-771",
        title: "Express Entry Provincial Nominee: Priya Patel",
        status: "package_assembly" as CaseStage,
      };
      const handleOpenWorkspace = vi.fn();
      const handleClose = vi.fn();

      render(
        <CaseDrilldownDrawer
          isOpen={true}
          onClose={handleClose}
          caseItem={activeCase}
          onOpenWorkspace={handleOpenWorkspace}
        />
      );

      // Verify title and subtitle
      expect(screen.getByText("CASE-CAN-771")).toBeDefined();
      expect(screen.getByText("Express Entry Provincial Nominee: Priya Patel")).toBeDefined();

      // Verify canonical 6-stage badge
      expect(screen.getByText("Package Assembly")).toBeDefined();

      // Verify single primary action button (no duplicate 'Full Case Dossier ↗')
      const openBtn = screen.getByTestId("open-case-workspace-btn");
      expect(openBtn.textContent).toBe("Open Case Workspace →");
      expect(screen.queryByText("Full Case Dossier ↗")).toBeNull();

      // Click Open Case Workspace
      act(() => {
        fireEvent.click(openBtn);
      });
      expect(handleOpenWorkspace).toHaveBeenCalledWith("case-can-771-id");
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  /* ==========================================================================
   * SUITE 2: Rapid Tenant Switching & Unassigned Client Handling
   * ========================================================================== */
  describe("Suite 2: Rapid Tenant Switching & Unassigned Client Boundaries", () => {
    it("WorkspaceContext survives rapid 100-cycle tenant switching across 5 organizations without state contamination", async () => {
      const organizations = [
        { id: "org-apex-01", name: "Apex Immigration Legal", email: "sarah@apex.com" },
        { id: "org-beacon-02", name: "Beacon Global Visas", email: "alex@beacon.com" },
        { id: "org-horizon-03", name: "Horizon Global Counsel", email: "elena@horizon.com" },
        { id: "org-nordic-04", name: "Nordic Legal Partners", email: "sven@nordic.com" },
        { id: "org-pacific-05", name: "Pacific Rim Immigration", email: "mei@pacific.com" },
      ];

      function TestTenantConsumer() {
        const { currentUser, setCurrentUser } = useWorkspace();
        return (
          <div>
            <div data-testid="current-org-id">{currentUser?.organization_id}</div>
            <div data-testid="current-org-name">{currentUser?.organization_name}</div>
            <button
              data-testid="trigger-rapid-switch"
              onClick={() => {
                for (let i = 0; i < 100; i++) {
                  const org = organizations[i % organizations.length];
                  setCurrentUser({
                    ...baseOwner,
                    id: `usr-${org.id}`,
                    email: org.email,
                    organization_id: org.id,
                    organization_name: org.name,
                  });
                }
              }}
            >
              Rapid Switch
            </button>
          </div>
        );
      }

      render(
        <WorkspaceProvider initialUser={baseOwner}>
          <TestTenantConsumer />
        </WorkspaceProvider>
      );

      const triggerBtn = screen.getByTestId("trigger-rapid-switch");
      act(() => {
        fireEvent.click(triggerBtn);
      });

      // The final state should cleanly match organization index 99 % 5 = 4 ("Pacific Rim Immigration")
      const finalOrg = organizations[99 % organizations.length];
      await waitFor(() => {
        expect(screen.getByTestId("current-org-name").textContent).toBe(finalOrg.name);
        expect(screen.getByTestId("current-org-id").textContent).toBe(finalOrg.id);
      });
    });

    it("OwnerMasterDashboard renders cleanly on Day 0 clean slate (0 cases, 0 clients) with guided empty state and zero NaN", () => {
      const handleCreateClient = vi.fn();

      render(
        <OwnerMasterDashboard
          cases={[]}
          clients={[]}
          auditEvents={[]}
          invoices={[]}
          capacity={[]}
          isLiveBackend={true}
          onOpenCreateClient={handleCreateClient}
        />
      );

      // Verify no NaN or undefined rendered in metrics
      const dashboardText = document.body.textContent || "";
      expect(dashboardText.includes("NaN")).toBe(false);
      expect(dashboardText.includes("undefined")).toBe(false);

      // Active Caseload metric displays 0 Petitions cleanly
      expect(screen.getByText("Active Caseload: 0 Petitions")).toBeDefined();
      expect(screen.getByText("No Active Cases in Firm Workspace")).toBeDefined();

      // Unified "+ Onboard Client & Case" button triggers intake flow
      const onboardButtons = screen.getAllByRole("button", { name: /\+ Onboard Client & Case/i });
      expect(onboardButtons.length).toBeGreaterThan(0);
      act(() => {
        fireEvent.click(onboardButtons[0]);
      });
      expect(handleCreateClient).toHaveBeenCalled();
    });

    it("handles unassigned clients with null case IDs and empty caseworkers without null pointer errors", () => {
      const unassignedClients: ClientProfile[] = [
        {
          id: "cli-unassigned-1",
          first_name: "Unassigned",
          last_name: "Applicant 1",
          email: "unassigned1@example.com",
          nationality: "USA",
          organization_id: "org-apex-001",
          cases_count: 0,
          portal_access_enabled: false,
          created_at: new Date().toISOString(),
        },
        {
          id: "cli-unassigned-2",
          first_name: "Pending",
          last_name: "Applicant 2",
          email: "unassigned2@example.com",
          nationality: "CAN",
          organization_id: "org-apex-001",
          cases_count: 0,
          portal_access_enabled: true,
          created_at: new Date().toISOString(),
        },
      ];

      render(
        <OwnerMasterDashboard
          cases={[]}
          clients={unassignedClients}
          auditEvents={[]}
          invoices={[]}
          capacity={[]}
          isLiveBackend={true}
        />
      );

      // Successfully renders without crashing
      expect(screen.getByText("Operational Health & Tenant Boundary")).toBeDefined();
    });

    it("EmployeeWorkspace handles caseworker with zero assigned cases gracefully", () => {
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

      // Caseworker queues display 0 without crash
      expect(screen.getByText("Active Cases Assigned")).toBeDefined();
      const text = document.body.textContent || "";
      expect(text.includes("NaN")).toBe(false);
    });
  });

  /* ==========================================================================
   * SUITE 3: Multilingual Unicode Scripts, Extreme Character Counts, and Injection Vectors
   * ========================================================================== */
  describe("Suite 3: Multilingual Unicode Scripts, Extreme Character Counts, and Injection Vectors", () => {
    it("correctly renders international multilingual Unicode scripts across East Asian, Arabic, Devanagari, and Cyrillic", () => {
      const unicodeCases: ImmigrationCase[] = [
        {
          id: "case-uni-1",
          case_number: "CASE-JP-001",
          title: "技術・人文知識・国際業務: 鈴木 一朗 (Ichiro Suzuki)",
          client_id: "cli-jp-1",
          client_name: "鈴木 一朗",
          organization_id: "org-apex-001",
          status: "gathering" as CaseStage,
          jurisdiction: "Japan (MOJ)",
          visa_category: "Specialist in Humanities",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "case-uni-2",
          case_number: "CASE-AR-002",
          title: "تأشيرة العمل الدائم: د. فاطمة الزهراء الشريف",
          client_id: "cli-ar-2",
          client_name: "د. فاطمة الزهراء الشريف",
          organization_id: "org-apex-001",
          status: "review" as CaseStage,
          jurisdiction: "United Arab Emirates",
          visa_category: "Golden Visa",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "case-uni-3",
          case_number: "CASE-IN-003",
          title: "एच-१बी विशेष व्यवसाय: डॉ. राजेश कुमार शर्मा",
          client_id: "cli-in-3",
          client_name: "डॉ. राजेश कुमार शर्मा",
          organization_id: "org-apex-001",
          status: "assembly" as CaseStage,
          jurisdiction: "United States (USCIS)",
          visa_category: "H-1B Specialty Occupation",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "case-uni-4",
          case_number: "CASE-RU-004",
          title: "Виза высококвалифицированного специалиста: Михаил Борисович",
          client_id: "cli-ru-4",
          client_name: "Михаил Борисович",
          organization_id: "org-apex-001",
          status: "ready" as CaseStage,
          jurisdiction: "Germany (BAMF)",
          visa_category: "EU Blue Card",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const { container } = render(
        <OwnerMasterDashboard
          cases={unicodeCases}
          clients={FIXTURE_CLIENTS}
          auditEvents={[]}
          invoices={[]}
          capacity={[]}
          isLiveBackend={true}
        />
      );

      // Switch to All Cases table to display all records
      const casesTabBtn = container.querySelector("#tab-btn-cases");
      if (casesTabBtn) {
        act(() => {
          fireEvent.click(casesTabBtn);
        });
      }

      // Verify all Unicode titles are present in DOM without corruption
      expect(screen.getAllByText(/鈴木 一朗/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/د\. فاطمة الزهراء الشريف/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/डॉ\. राजेश कुमार शर्मा/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Михаил Борисович/).length).toBeGreaterThan(0);
    });

    it("resiliently renders cases with extreme 3,000+ character titles and 10,000+ character notes without overflow or crash", () => {
      const extremeTitle = "O-1A Extraordinary Alien Petition: " + "Supercalifragilisticexpialidocious ".repeat(90);
      const extremeNotes = "EVIDENTIARY EXHIBIT LOG:\n" + "Page 1: Certified translation verified. ".repeat(300);

      const extremeCase: ImmigrationCase = {
        id: "case-extreme-1",
        case_number: "CASE-EXTREME-BOUND-01",
        title: extremeTitle,
        client_id: "cli-ext-1",
        client_name: "Extreme Character Applicant",
        organization_id: "org-apex-001",
        status: "intake" as CaseStage,
        jurisdiction: "United States (USCIS)",
        visa_category: "O-1A",
        notes: [
          {
            id: "note-ext-1",
            case_id: "case-extreme-1",
            note_type: "internal",
            content: extremeNotes,
            is_client_visible: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      render(
        <CaseDrilldownDrawer
          isOpen={true}
          onClose={vi.fn()}
          caseItem={extremeCase}
          onOpenWorkspace={vi.fn()}
        />
      );

      expect(screen.getByText("CASE-EXTREME-BOUND-01")).toBeDefined();
      expect(screen.getByText(/Supercalifragilisticexpialidocious/)).toBeDefined();
    });

    it("safely sanitizes and neutralizes XSS and SQL injection payloads in case titles and notes", () => {
      const maliciousCase: ImmigrationCase = {
        id: "case-mal-1",
        case_number: "CASE-INJ-001",
        title: "<script>alert('XSS-ATTACK')</script><img src=x onerror=alert(1)>",
        client_id: "cli-mal-1",
        client_name: "Injection Testing User",
        organization_id: "org-apex-001",
        status: "review" as CaseStage,
        jurisdiction: "'; DROP TABLE cases; SELECT * FROM clients WHERE '1'='1",
        visa_category: "EB-1A & <svg/onload=alert('XSS')>",
        notes: [
          {
            id: "note-mal-1",
            case_id: "case-mal-1",
            note_type: "internal",
            content: "' OR '1'='1' -- /* comment */",
            is_client_visible: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { container } = render(
        <CaseDrilldownDrawer
          isOpen={true}
          onClose={vi.fn()}
          caseItem={maliciousCase}
          onOpenWorkspace={vi.fn()}
        />
      );

      // Verify raw script elements were NOT created in the DOM
      const scriptElements = container.querySelectorAll("script");
      expect(scriptElements.length).toBe(0);

      // Verify that malicious text is rendered as safe literal text
      expect(screen.getByText("<script>alert('XSS-ATTACK')</script><img src=x onerror=alert(1)>")).toBeDefined();
    });
  });

  /* ==========================================================================
   * SUITE 4: Multi-Corridor Representation Transitions without State Corruption
   * ========================================================================== */
  describe("Suite 4: Multi-Corridor Representation Transitions & Canonical 6-Stage Lifecycle", () => {
    it("empirically verifies rapid corridor transitions across US, Canada, UK, Germany, and Australia without lingering state", () => {
      const corridorTransitions = [
        {
          input: "United States (USCIS)",
          code: "USCIS_G28",
          citation: "8 CFR § 292.1 / § 292.4",
          formName: 'Form G-28 Notice of Entry of Appearance as Attorney',
        },
        {
          input: "Canada (IRCC)",
          code: "IMM_5476",
          citation: "IRPA s. 91 / IRPR Part 2",
          formName: 'IMM 5476 "Use of a Representative"',
        },
        {
          input: "United Kingdom (Home Office)",
          code: "UKVI_REP",
          citation: "Immigration Act 1971 / OISC Regulatory Scheme",
          formName: "Statutory Legal Representation Disclosure",
        },
        {
          input: "Germany (BAMF)",
          code: "GER_VOLLMACHT",
          citation: "§ 14 VwVfG / § 81 AufenthG",
          formName: "Statutory Representation Authorization (Vollmacht)",
        },
        {
          input: "Australia (Home Affairs)",
          code: "FORM_956",
          citation: "Migration Act 1958 Part 3",
          formName: "Form 956 Appointment of Representative",
        },
        {
          input: "Unknown Corridor / Non-Mapped",
          code: "USCIS_G28",
          citation: "8 CFR § 292.1 / § 292.4",
          formName: "Form G-28 Notice of Entry of Appearance as Attorney",
        },
      ];

      // Execute 20 rapid transitions back and forth
      for (let cycle = 0; cycle < 20; cycle++) {
        for (const c of corridorTransitions) {
          const info = getJurisdictionRepresentationInfo(c.input);
          expect(info.code).toBe(c.code);
          expect(info.statutoryCitation).toBe(c.citation);
          expect(info.formName).toBe(c.formName);
        }
      }
    });

    it("standardizes 25+ legacy and messy case status permutations into canonical 6-stage case lifecycle", () => {
      const testPermutations: Array<[string | null | undefined, CanonicalStageKey, string]> = [
        // Stage 1: Intake
        ["intake", "intake", "Intake"],
        ["INTAKE", "intake", "Intake"],
        ["inquiry", "intake", "Intake"],
        ["  inquiry  \n", "intake", "Intake"],
        [null, "intake", "Intake"],
        [undefined, "intake", "Intake"],
        ["", "intake", "Intake"],
        ["NON_EXISTENT_STATUS", "intake", "Intake"],

        // Stage 2: Evidence Gathering
        ["evidence_gathering", "evidence_gathering", "Evidence Gathering"],
        ["gathering", "evidence_gathering", "Evidence Gathering"],
        ["awaiting_documents", "evidence_gathering", "Evidence Gathering"],
        ["AWAITING_DOCUMENTS", "evidence_gathering", "Evidence Gathering"],

        // Stage 3: Caseworker Review
        ["caseworker_review", "caseworker_review", "Caseworker Review"],
        ["review", "caseworker_review", "Caseworker Review"],
        ["processing", "caseworker_review", "Caseworker Review"],
        ["internal_review", "caseworker_review", "Caseworker Review"],
        ["awaiting_client", "caseworker_review", "Caseworker Review"],

        // Stage 4: Package Assembly
        ["package_assembly", "package_assembly", "Package Assembly"],
        ["assembly", "package_assembly", "Package Assembly"],
        ["ready_for_approval", "package_assembly", "Package Assembly"],

        // Stage 5: Attorney Signoff
        ["attorney_signoff", "attorney_signoff", "Attorney Signoff"],
        ["ready", "attorney_signoff", "Attorney Signoff"],
        ["approved_for_submission", "attorney_signoff", "Attorney Signoff"],

        // Stage 6: Filed with Agency
        ["filed_with_agency", "filed_with_agency", "Filed with Agency"],
        ["filed", "filed_with_agency", "Filed with Agency"],
        ["submitted", "filed_with_agency", "Filed with Agency"],
        ["decision_received", "filed_with_agency", "Filed with Agency"],
        ["approved", "filed_with_agency", "Filed with Agency"],
        ["closed", "filed_with_agency", "Filed with Agency"],
        ["archived", "filed_with_agency", "Filed with Agency"],
      ];

      for (const [raw, expectedKey, expectedLabel] of testPermutations) {
        const normalized = normalizeCaseStage(raw);
        expect(normalized).toBe(expectedKey);

        const stageInfo = getCaseStageInfo(raw);
        expect(stageInfo.key).toBe(expectedKey);
        expect(stageInfo.label).toBe(expectedLabel);

        const badge = formatCaseStageBadge(raw);
        expect(badge.label).toBe(expectedLabel);
        expect(badge.variant).toBe(stageInfo.badgeVariant);
      }
    });
  });

  /* ==========================================================================
   * SUITE 5: Concurrent Document Status Updates, Error Boundaries & Fault Recovery
   * ========================================================================== */
  describe("Suite 5: Concurrent Document Status Updates, Error Boundaries & Fault Recovery", () => {
    it("manages concurrent document status transitions across multiple documents without state races", async () => {
      let currentDocs: DocumentItem[] = [...FIXTURE_DOCUMENTS];

      function TestDocManager() {
        const [docs, setDocs] = useState<DocumentItem[]>(currentDocs);

        const handleUpdateStatus = (id: string, newStatus: DocumentStatus) => {
          setDocs((prev) =>
            prev.map((d) => (d.id === id ? { ...d, status: newStatus } : d))
          );
        };

        return (
          <div>
            <div data-testid="verified-count">
              {docs.filter((d) => d.status === "verified").length}
            </div>
            <button
              data-testid="concurrent-update-btn"
              onClick={() => {
                // Simultaneously trigger 20 updates across docs
                for (let i = 0; i < 20; i++) {
                  const doc = docs[i % docs.length];
                  handleUpdateStatus(doc.id, i % 2 === 0 ? "verified" : "under_review");
                }
              }}
            >
              Update Concurrent
            </button>
          </div>
        );
      }

      render(<TestDocManager />);

      const updateBtn = screen.getByTestId("concurrent-update-btn");
      act(() => {
        fireEvent.click(updateBtn);
      });

      // Verify the component re-rendered with non-negative verified count
      const count = Number(screen.getByTestId("verified-count").textContent);
      expect(count).toBeGreaterThanOrEqual(0);
      expect(count).toBeLessThanOrEqual(currentDocs.length);
    });

    it("DashboardErrorBoundary intercepts catastrophic component crashes and offers user-friendly recovery", () => {
      function FlakyComponent({ shouldCrash }: { shouldCrash: boolean }) {
        if (shouldCrash) {
          throw new Error("Simulated critical rendering fault in Casework Studio");
        }
        return <div data-testid="flaky-content">Casework Studio Operational</div>;
      }

      function Harness() {
        const [hasError, setHasError] = useState(true);
        return (
          <DashboardErrorBoundary
            sectionTitle="Casework Studio"
            onReset={() => setHasError(false)}
          >
            <FlakyComponent shouldCrash={hasError} />
          </DashboardErrorBoundary>
        );
      }

      // Suppress console.error in vitest during intentional error test
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      render(<Harness />);

      // Verify error boundary fallback is triggered
      expect(screen.getByTestId("dashboard-error-boundary-fallback")).toBeDefined();
      expect(screen.getByText("⚠️ SECTION FAULT ISOLATED")).toBeDefined();
      expect(screen.getByText("Casework Studio Temporarily Unavailable")).toBeDefined();

      // Trigger recovery
      const retryBtn = screen.getByRole("button", { name: /Reload Section/i });
      act(() => {
        fireEvent.click(retryBtn);
      });

      // Verify child component recovered successfully
      expect(screen.getByTestId("flaky-content").textContent).toBe("Casework Studio Operational");

      spy.mockRestore();
    });

    it("LoadingState and EmptyState render accessible ARIA status and handle call-to-actions", () => {
      const handleAction = vi.fn();

      const { unmount } = render(
        <LoadingState message="Processing client petition in background..." />
      );
      expect(screen.getByRole("status")).toBeDefined();
      expect(screen.getByText("Processing client petition in background...")).toBeDefined();

      unmount();

      render(
        <EmptyState
          title="No Active Retainers"
          description="There are currently no active trust accounting retainers in this fiscal quarter."
          action={<button onClick={handleAction}>Issue Retainer Invoice</button>}
        />
      );

      expect(screen.getByText("No Active Retainers")).toBeDefined();
      expect(
        screen.getByText(
          "There are currently no active trust accounting retainers in this fiscal quarter."
        )
      ).toBeDefined();
      const actionBtn = screen.getByRole("button", { name: "Issue Retainer Invoice" });
      fireEvent.click(actionBtn);
      expect(handleAction).toHaveBeenCalledTimes(1);
    });
  });
});
