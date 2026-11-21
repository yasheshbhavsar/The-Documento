import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { useState } from "react";
import fs from "node:fs";
import path from "node:path";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

import { Modal } from "../components/common/Modal";
import { Drawer } from "../components/common/Drawer";
import { DataTable } from "../components/common/DataTable";
import { WorkspaceHeader } from "../components/layout/WorkspaceHeader";
import { ClientPortal } from "../components/dashboards/ClientPortal";
import { EmployeeWorkspace } from "../components/dashboards/EmployeeWorkspace";
import { OwnerMasterDashboard } from "../components/dashboards/OwnerMasterDashboard";
import { CreateClientModal } from "../components/modals/CreateClientModal";
import { ProvisionCredentialsModal } from "../components/modals/ProvisionCredentialsModal";
import { AuditGovernanceView } from "../components/admin/views/AuditGovernanceView";
import { BillingTrialsView } from "../components/admin/views/BillingTrialsView";
import { NetworkOverviewView } from "../components/admin/views/NetworkOverviewView";
import { AIFindingInspectorModal } from "../components/modals/AIFindingInspectorModal";
import { DocumentInspectorModal } from "../components/modals/DocumentInspectorModal";
import { InitialInformationSheet } from "../components/portal/InitialInformationSheet";
import { DocumentoFAQ } from "../components/landing/DocumentoFAQ";
import { DocumentoFooter } from "../components/landing/DocumentoFooter";
import { VisaAppointmentDesk } from "../components/cases/VisaAppointmentDesk";
import { RuleAdministrationHub } from "../components/rules/RuleAdministrationHub";
import { BillingManager } from "../components/billing/BillingManager";
import { DocumentExtractorLab } from "../components/tools/DocumentExtractorLab";
import LoginPage from "../app/login/page";
import * as apiModule from "../lib/api";
import { api } from "../lib/api";
import * as appointmentsApi from "../lib/api/appointments";
import * as extractorApi from "../lib/api/extractor";
import { PackageBuilderView } from "../components/packages/PackageBuilderView";
import { AuthenticatedWorkspaceShell } from "../components/layout/AuthenticatedWorkspaceShell";
import { WorkspaceProvider } from "../lib/context/WorkspaceContext";
import {
  FIXTURE_CASES,
  FIXTURE_CLIENTS,
  FIXTURE_DOCUMENTS,
  FIXTURE_TASKS,
  FIXTURE_AI_FINDINGS,
  FIXTURE_MESSAGES,
  FIXTURE_NOTIFICATIONS,
  FIXTURE_AUDIT_EVENTS,
  FIXTURE_CAPACITY,
  FIXTURE_INVOICES,
} from "./helpers/testFixtures";
import type { UserContext } from "../lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/login",
  useSearchParams: () => new URLSearchParams(),
}));

describe("WS5 — Frontend UX, Focus Theft, Mobile Drawers, A11y & Compliance Honesty", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    document.body.style.overflow = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.style.overflow = "";
  });

  describe("1. Modal & Drawer Focus Theft, Focus Trap, Stack & Body Scroll Lock", () => {
    it("does NOT steal focus from an input inside Modal when parent re-renders with new inline onClose", () => {
      function ParentWithTypingModal() {
        const [isOpen, setIsOpen] = useState(true);
        const [text, setText] = useState("");
        return (
          <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Typing Test Modal">
            <label htmlFor="modal-typing-input">Applicant Name</label>
            <input
              id="modal-typing-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button type="button">Save</button>
          </Modal>
        );
      }

      render(<ParentWithTypingModal />);
      const input = screen.getByLabelText("Applicant Name") as HTMLInputElement;
      input.focus();
      expect(document.activeElement).toBe(input);

      fireEvent.change(input, { target: { value: "A" } });
      expect(document.activeElement).toBe(input);

      fireEvent.change(input, { target: { value: "Aarav" } });
      expect(document.activeElement).toBe(input);
      expect(input.value).toBe("Aarav");
    });

    it("does NOT steal focus from an input inside Drawer when parent re-renders with new inline onClose", () => {
      function ParentWithTypingDrawer() {
        const [isOpen, setIsOpen] = useState(true);
        const [note, setNote] = useState("");
        return (
          <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)} title="Typing Test Drawer">
            <label htmlFor="drawer-note-input">Case Note</label>
            <input
              id="drawer-note-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Drawer>
        );
      }

      render(<ParentWithTypingDrawer />);
      const input = screen.getByLabelText("Case Note") as HTMLInputElement;
      input.focus();
      expect(document.activeElement).toBe(input);

      fireEvent.change(input, { target: { value: "Updated note" } });
      expect(document.activeElement).toBe(input);
      expect(input.value).toBe("Updated note");
    });

    it("traps Tab and Shift+Tab inside Modal, assigns unique aria-labelledby IDs, locks body scroll, and Escape closes only the topmost overlay", () => {
      const closeOuter = vi.fn();
      const closeInner = vi.fn();

      function StackedOverlays() {
        const [outerOpen, setOuterOpen] = useState(true);
        const [innerOpen, setInnerOpen] = useState(true);
        return (
          <>
            <Modal
              isOpen={outerOpen}
              onClose={() => {
                closeOuter();
                setOuterOpen(false);
              }}
              title="Outer Case Modal"
            >
              <button type="button">Outer Action</button>
            </Modal>
            <Modal
              isOpen={innerOpen}
              onClose={() => {
                closeInner();
                setInnerOpen(false);
              }}
              title="Inner Confirm Modal"
            >
              <input aria-label="Confirm Code" />
              <button type="button">Confirm Action</button>
            </Modal>
          </>
        );
      }

      render(<StackedOverlays />);

      // Body scroll locked while modals are open
      expect(document.body.style.overflow).toBe("hidden");

      // Both dialogs must have unique aria-labelledby matching their own heading
      const dialogs = screen.getAllByRole("dialog");
      expect(dialogs.length).toBe(2);
      const id0 = dialogs[0].getAttribute("aria-labelledby");
      const id1 = dialogs[1].getAttribute("aria-labelledby");
      expect(id0).toBeTruthy();
      expect(id1).toBeTruthy();
      expect(id0).not.toBe(id1);
      expect(document.getElementById(id0!)?.textContent).toBe("Outer Case Modal");
      expect(document.getElementById(id1!)?.textContent).toBe("Inner Confirm Modal");

      // Focus trap cycles Tab on last element of inner modal -> back to first focusable (Close dialog button)
      const confirmBtn = screen.getByRole("button", { name: "Confirm Action" });
      confirmBtn.focus();
      expect(document.activeElement).toBe(confirmBtn);
      fireEvent.keyDown(window, { key: "Tab" });
      const innerCloseBtn = dialogs[1].querySelector('button[aria-label="Close dialog"]') as HTMLElement;
      expect(document.activeElement).toBe(innerCloseBtn);

      // Shift+Tab from first element wraps to last focusable (Confirm Action)
      fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
      expect(document.activeElement).toBe(confirmBtn);

      // First Escape closes ONLY the topmost (inner) modal
      fireEvent.keyDown(window, { key: "Escape" });
      expect(closeInner).toHaveBeenCalledTimes(1);
      expect(closeOuter).not.toHaveBeenCalled();
      expect(document.body.style.overflow).toBe("hidden");

      // Second Escape closes the outer modal and restores body scroll
      fireEvent.keyDown(window, { key: "Escape" });
      expect(closeOuter).toHaveBeenCalledTimes(1);
      expect(document.body.style.overflow).toBe("");
    });
  });

  describe("2. DataTable Pagination Clamping & Responsive Raw Tables + Mobile Drawer CSS", () => {
    it("clamps DataTable currentPage automatically when data.length shrinks", () => {
      const fiveRows = [
        { id: "1", name: "Alpha" },
        { id: "2", name: "Beta" },
        { id: "3", name: "Gamma" },
        { id: "4", name: "Delta" },
        { id: "5", name: "Epsilon" },
      ];
      const columns = [{ key: "name", header: "Name" }];

      const { rerender } = render(
        <DataTable columns={columns} data={fiveRows} keyExtractor={(r) => r.id} pageSize={2} />
      );

      // Navigate to Page 3 of 3
      const nextBtn = screen.getByRole("button", { name: "Next" });
      fireEvent.click(nextBtn);
      fireEvent.click(nextBtn);
      expect(screen.getByText("Page 3 of 3")).toBeDefined();
      expect(screen.getByText("Epsilon")).toBeDefined();

      // Shrink dataset to 2 rows -> must automatically clamp to Page 1 of 1
      rerender(
        <DataTable
          columns={columns}
          data={fiveRows.slice(0, 2)}
          keyExtractor={(r) => r.id}
          pageSize={2}
        />
      );
      expect(screen.getByText("Page 1 of 1")).toBeDefined();
      expect(screen.getByText("Alpha")).toBeDefined();
      expect(screen.getByText("Beta")).toBeDefined();
    });

    it("defines .documento-firm-sidebar--open and .documento-applicant-sidebar--open in globals.css @media (max-width: 768px)", () => {
      const cssPath = path.resolve(__dirname, "../app/globals.css");
      const css = fs.readFileSync(cssPath, "utf8");
      expect(css).toContain(".documento-firm-sidebar--open");
      expect(css).toContain(".documento-applicant-sidebar--open");
      expect(css).toContain("display: flex !important");
      expect(css).toContain("position: fixed !important");
    });

    it("wraps raw <table> views in horizontal scroll containers (overflowX: auto)", () => {
      const { container: auditC } = render(
        <AuditGovernanceView
          tenants={[]}
          overview={{ activeSupportGrantsCount: 0, activeAgenciesCount: 1 }}
          govLogs={[
            {
              id: "g1",
              timestamp: "2026-03-01T10:00:00Z",
              actorEmail: "hq@documento.com",
              agencyName: "NorthStar",
              actionCode: "APPROVE",
              detail: "Verified RCIC",
            } as any,
          ]}
        />
      );
      expect((auditC.querySelector("table")?.parentElement as HTMLElement)?.style.overflowX).toBe("auto");

      const { container: billingC } = render(
        <BillingTrialsView
          tenants={[
            {
              organizationId: "org-1",
              tradingName: "Maple Immigration",
              ownerEmail: "owner@maple.ca",
              billingStatus: "trialing",
              casesActiveCount: 5,
              calculatorLeads30d: 12,
              trialEndsAt: "2026-04-01",
            } as any,
          ]}
          invoices={[
            {
              id: "inv-1",
              invoiceNumber: "INV-001",
              dueDate: "2026-04-05",
              tradingName: "Maple Immigration",
              planLabel: "Growth",
              paymentMethod: "wire_invoice",
              amountUsd: 499,
              status: "pending",
            } as any,
          ]}
          aiExtractions30dTotal={100}
          billingSummary={{
            mrrUsd: 499,
            pendingReceivablesUsd: 499,
            pendingWireCount: 1,
            pastDueCount: 0,
            estimatedAiCostUsd: 20,
            grossMarginPct: 95,
            netContributionUsd: 479,
          }}
          onExtendTrial={vi.fn()}
          onSettleInvoice={vi.fn()}
        />
      );
      const billingTables = Array.from(billingC.querySelectorAll("table"));
      expect(billingTables.length).toBe(2);
      billingTables.forEach((tbl) => {
        expect((tbl.parentElement as HTMLElement)?.style.overflowX).toBe("auto");
      });

      const { container: netC } = render(
        <NetworkOverviewView
          applications={[]}
          tenants={[
            {
              organizationId: "org-1",
              tradingName: "Maple Immigration",
              regulatoryBody: "CICC",
              licenseNumber: "R701234",
              enabledCorridors: ["CA"],
              mrrUsd: 499,
              casesActiveCount: 3,
              monthlyCaseQuota: 50,
              aiExtractionsUsed30d: 10,
              monthlyAiExtractionQuota: 500,
              status: "active",
            } as any,
          ]}
          unpaidInvoicesCount={0}
          openTicketsCount={0}
          broadcastsCount={0}
          billingSummary={{
            pendingReceivablesUsd: 0,
            pendingWireCount: 0,
            pastDueCount: 0,
            activeTrialsCount: 1,
          }}
          onNavigateView={vi.fn()}
          onSelectApp={vi.fn()}
          onSelectTenant={vi.fn()}
        />
      );
      expect((netC.querySelector("table")?.parentElement as HTMLElement)?.style.overflowX).toBe("auto");

      const { container: findingC } = render(
        <AIFindingInspectorModal
          isOpen={true}
          onClose={vi.fn()}
          onResolve={vi.fn()}
          onDismiss={vi.fn()}
          onEscalate={vi.fn()}
          finding={{
            id: "f1",
            case_id: "c1",
            title: "Date Discrepancy",
            description: "DOB mismatch",
            severity: "critical",
            status: "open",
            category: "identity",
            related_fields: [
              { field_name: "dob", field_label: "DOB", original_value: "1990-01-02", normalized_value: "1990-01-03" },
            ],
          } as any}
        />
      );
      expect((findingC.querySelector("table")?.parentElement as HTMLElement)?.style.overflowX).toBe("auto");

      const { container: docC } = render(
        <DocumentInspectorModal
          isOpen={true}
          onClose={vi.fn()}
          onDocumentUpdated={vi.fn()}
          document={FIXTURE_DOCUMENTS[0]}
        />
      );
      const versionsTab = screen.getByRole("button", { name: /Version History/i });
      fireEvent.click(versionsTab);
      const versionTables = Array.from(docC.querySelectorAll("table"));
      expect(versionTables.length).toBeGreaterThan(0);
      expect((versionTables[versionTables.length - 1].parentElement as HTMLElement)?.style.overflowX).toBe("auto");
    });
  });

  describe("3. WorkspaceHeader Day 0 Reset RBAC & Production Gate", () => {
    const baseUser: UserContext = {
      id: "u1",
      email: "admin@firm.ca",
      full_name: "Elena Admin",
      role: "master_admin",
      experience: "master_admin",
      organization_id: "org-1",
      organization_name: "Maple Immigration Law",
      permissions: ["*"],
    };

    it("hides Day 0 Reset for retained_client and case_worker roles", () => {
      const { rerender } = render(
        <WorkspaceHeader
          currentUser={{ ...baseUser, role: "retained_client", experience: "client_applicant" }}
          onLogout={vi.fn()}
          onResetToScratch={vi.fn()}
        />
      );
      expect(screen.queryByTestId("day0-reset-btn")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: /User profile menu/i }));
      expect(screen.queryByTestId("profile-day0-reset-btn")).toBeNull();

      rerender(
        <WorkspaceHeader
          currentUser={{ ...baseUser, role: "case_worker", experience: "paralegal" }}
          onLogout={vi.fn()}
          onResetToScratch={vi.fn()}
        />
      );
      expect(screen.queryByTestId("day0-reset-btn")).toBeNull();
      expect(screen.queryByTestId("profile-day0-reset-btn")).toBeNull();
    });

    it("hides Day 0 Reset in production even for master_admin, and shows it in non-production", () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        (process.env as any).NODE_ENV = "production";
        const { unmount } = render(
          <WorkspaceHeader
            currentUser={baseUser}
            onLogout={vi.fn()}
            onResetToScratch={vi.fn()}
          />
        );
        expect(screen.queryByTestId("day0-reset-btn")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: /User profile menu/i }));
        expect(screen.queryByTestId("profile-day0-reset-btn")).toBeNull();
        unmount();

        (process.env as any).NODE_ENV = "test";
        render(
          <WorkspaceHeader
            currentUser={baseUser}
            onLogout={vi.fn()}
            onResetToScratch={vi.fn()}
          />
        );
        expect(screen.getByTestId("day0-reset-btn")).toBeDefined();
        fireEvent.click(screen.getByRole("button", { name: /User profile menu/i }));
        expect(screen.getByTestId("profile-day0-reset-btn")).toBeDefined();
      } finally {
        (process.env as any).NODE_ENV = originalEnv;
      }
    });
  });

  describe("4. ClientPortal Honest MFA, Metadata Export, Currency, 4-Step Journey, Mobile Drawer & Hidden Buttons", () => {
    const clientUserBase: UserContext & { is_mfa_enabled?: boolean } = {
      id: "client-99",
      email: "meera@example.ca",
      full_name: "Meera Patel",
      role: "retained_client",
      experience: "client_applicant",
      organization_id: "org-ca-1",
      organization_name: "NorthStar RCIC",
      permissions: ["portal:read"],
      is_mfa_enabled: false,
    };

    it("renders honest MFA badge, JSON metadata export copy, Intl.NumberFormat currency, 1..4 journey numbering, mobile drawer class, and tabIndex=-1 on hidden shortcuts", () => {
      const { container, rerender } = render(
        <ClientPortal
          myCase={FIXTURE_CASES[0]}
          currentUser={clientUserBase}
          documents={FIXTURE_DOCUMENTS}
          messages={FIXTURE_MESSAGES}
          notifications={FIXTURE_NOTIFICATIONS}
          invoices={[
            {
              id: "inv-cad-1",
              invoice_number: "INV-CA-501",
              case_number: "CASE-CA-501",
              amount: 1250.5,
              currency: "CAD",
              status: "paid",
              due_date: "2026-05-01",
            } as any,
          ]}
          onOpenUploadModal={vi.fn()}
          onOpenQuestionnaireModal={vi.fn()}
        />
      );

      // 4-tab journey numbering 1 -> 2 -> 3 -> 4
      expect(screen.getByTestId("journey-step-home-upload").textContent).toContain("1. Home & Upload");
      expect(screen.getByTestId("journey-step-my-details").textContent).toContain("2. My Details");
      expect(screen.getByTestId("journey-step-my-files").textContent).toContain("3. My Files");
      expect(screen.getByTestId("journey-step-messages-status").textContent).toContain("4. Messages & Status");

      // Mobile drawer toggles documento-applicant-sidebar--open
      const aside = container.querySelector("aside.documento-applicant-sidebar") as HTMLElement;
      expect(aside.className).not.toContain("documento-applicant-sidebar--open");
      const mobileToggle = screen.getByRole("button", { name: /Switch Section/i, hidden: true });
      fireEvent.click(mobileToggle);
      expect(aside.className).toContain("documento-applicant-sidebar--open");

      // Hidden 1px shortcut buttons have tabIndex=-1
      const hiddenButtons = Array.from(aside.querySelectorAll('div[style*="width: 1px"] button'));
      expect(hiddenButtons.length).toBeGreaterThan(0);
      hiddenButtons.forEach((btn) => {
        expect(btn.getAttribute("tabindex")).toBe("-1");
      });

      // Selecting a tab closes mobile drawer
      fireEvent.click(screen.getByTestId("client-nav-billing"));
      expect(aside.className).not.toContain("documento-applicant-sidebar--open");

      // Currency formatted with Intl.NumberFormat (no malformed ".5.00")
      expect(container.textContent).toContain("1,250.50");
      expect(container.textContent).not.toContain("1,250.5.00");

      // Privacy & Security: MFA is honestly "Not Configured" when is_mfa_enabled is false
      fireEvent.click(screen.getByTestId("client-nav-settings"));
      expect(screen.getByText("Not Configured")).toBeDefined();
      expect(screen.queryByText("MFA Enabled")).toBeNull();
      expect(screen.getByText("Export Case Metadata Summary (JSON)")).toBeDefined();
      expect(screen.getByText(/structured JSON manifest/i)).toBeDefined();

      // When is_mfa_enabled is true -> shows "MFA Enabled"
      rerender(
        <ClientPortal
          myCase={FIXTURE_CASES[0]}
          currentUser={{ ...clientUserBase, is_mfa_enabled: true } as UserContext}
          documents={FIXTURE_DOCUMENTS}
          messages={FIXTURE_MESSAGES}
          notifications={FIXTURE_NOTIFICATIONS}
          invoices={FIXTURE_INVOICES}
          onOpenUploadModal={vi.fn()}
          onOpenQuestionnaireModal={vi.fn()}
        />
      );
      expect(screen.getByText("MFA Enabled")).toBeDefined();
    });

    it("sets tabIndex=-1 on hidden 1px compatibility buttons in EmployeeWorkspace and OwnerMasterDashboard", () => {
      const { container: empContainer } = render(
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
      const empHiddenBtns = Array.from(empContainer.querySelectorAll('div[style*="width: 1px"] button'));
      expect(empHiddenBtns.length).toBeGreaterThan(0);
      empHiddenBtns.forEach((btn) => {
        expect(btn.getAttribute("tabindex")).toBe("-1");
      });

      const { container: ownerContainer } = render(
        <OwnerMasterDashboard
          cases={FIXTURE_CASES}
          clients={FIXTURE_CLIENTS}
          auditEvents={FIXTURE_AUDIT_EVENTS}
          invoices={FIXTURE_INVOICES}
          capacity={FIXTURE_CAPACITY}
          onOpenCreateCase={vi.fn()}
          onOpenCreateClient={vi.fn()}
          onSelectCase={vi.fn()}
        />
      );
      const ownerHiddenBtns = Array.from(ownerContainer.querySelectorAll('div[style*="width: 1px"] button'));
      expect(ownerHiddenBtns.length).toBeGreaterThan(0);
      ownerHiddenBtns.forEach((btn) => {
        expect(btn.getAttribute("tabindex")).toBe("-1");
      });
    });
  });

  describe("5. CreateClientModal, ProvisionCredentialsModal & Login Query Params", () => {
    it("CreateClientModal defaults to Canada (IRCC), uses CSPRNG password (never ClientPass2026!), uses window.location.origin, and removes fake email dispatch", () => {
      render(
        <CreateClientModal
          isOpen={true}
          onClose={vi.fn()}
          onClientCreated={vi.fn()}
          onCaseCreated={vi.fn()}
          clients={[]}
        />
      );

      // Canada-first default jurisdiction
      const jurisdictionSelect = screen.getByLabelText(/Immigration Jurisdiction/i) as HTMLSelectElement;
      expect(jurisdictionSelect.value).toBe("Canada (IRCC)");

      // Fill required fields and move to Step 2
      fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: "Rohan" } });
      fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: "Kulkarni" } });
      fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: "rohan@canada.ca" } });
      fireEvent.change(screen.getByLabelText(/Nationality/i), { target: { value: "India" } });

      fireEvent.click(screen.getByRole("button", { name: /Configure Portal Invite/i }));

      // Invite link uses window.location.origin (never hardcoded app.documento.legal)
      const inviteInput = document.querySelector('input[readonly]') as HTMLInputElement;
      expect(inviteInput.value).toContain(window.location.origin);
      expect(inviteInput.value).not.toContain("app.documento.legal");

      // No fake "Send Portal Invite Email" button; honest "Copy Portal Invite Link & Credentials" present
      expect(screen.queryByText(/Send Portal Invite Email/i)).toBeNull();
      expect(screen.getByTestId("copy-portal-invite-credentials-btn")).toBeDefined();

      // Open fallback password accordion and verify CSPRNG 14-char password
      fireEvent.click(screen.getByText(/Fallback Temporary Password/i));
      const pwdInput = screen.getByLabelText(/Assigned Client Portal Password/i) as HTMLInputElement;
      expect(pwdInput.value).not.toBe("ClientPass2026!");
      expect(pwdInput.value.length).toBe(14);
    });

    it("ProvisionCredentialsModal generates a 14-char CSPRNG password instead of static defaults", () => {
      render(
        <ProvisionCredentialsModal
          isOpen={true}
          onClose={vi.fn()}
          client={{ ...FIXTURE_CLIENTS[0], portal_temporary_password: undefined }}
          onCredentialsUpdated={vi.fn()}
        />
      );

      const pwdInput = screen.getByLabelText(/Client Portal Password/i) as HTMLInputElement;
      expect(pwdInput.value).not.toBe("ClientPass2026!");
      expect(pwdInput.value).not.toBe("DocAccess2026!");
      expect(pwdInput.value.length).toBe(14);
    });

    it("LoginPage parses ?invite, ?email, and ?portal query params to pre-select Client Portal and prefill email", async () => {
      window.history.pushState(
        {},
        "",
        "/login?portal=client&invite=inv_secure99&email=priya.patel%40canada.ca"
      );

      render(<LoginPage />);

      await waitFor(() => {
        expect(screen.getByTestId("login-invite-banner")).toBeDefined();
      });
      const emailInput = document.getElementById("page-email-input") as HTMLInputElement;
      await waitFor(() => {
        expect(emailInput.value).toBe("priya.patel@canada.ca");
      });
      expect(screen.getByTestId("client-portal-policy-banner")).toBeDefined();
      expect(screen.getByLabelText("Applicant Email Address")).toBeDefined();

      window.history.pushState({}, "", "/");
    });
  });

  describe("6. BillingManager Currency Formatting & Honest Manual Payment Modal", () => {
    it("formats INR service fees properly with ₹ (never $45,000 INR) and labels manual payment entry without hardcoded card 4242", async () => {
      vi.spyOn(apiModule, "fetchInvoices").mockResolvedValue([
        {
          id: "inv-inr-1",
          invoice_number: "INV-IN-900",
          client_id: "c1",
          client_name: "Aarav Sharma",
          case_id: "case-1",
          status: "issued",
          currency: "INR",
          subtotal: 45000,
          tax_amount: 8100,
          total_amount: 53100,
          amount_paid: 0,
          balance_due: 53100,
          issue_date: "2026-03-01T00:00:00Z",
          due_date: "2026-03-31T00:00:00Z",
          line_items: [],
          payments: [],
        } as any,
      ]);
      vi.spyOn(apiModule, "fetchServices").mockResolvedValue([
        {
          id: "srv-inr-1",
          code: "SRV-CA-PR",
          name: "Canada Express Entry Filing",
          jurisdiction: "CA",
          pricing_model: "fixed",
          base_fee: 45000,
          currency: "INR",
          estimated_duration_days: 60,
          is_active: true,
        } as any,
      ]);
      vi.spyOn(apiModule, "fetchEngagements").mockResolvedValue([]);
      vi.spyOn(apiModule, "fetchFinancialReports").mockResolvedValue({
        summary: {
          total_invoiced: 53100,
          total_collected: 0,
          total_outstanding: 53100,
          total_refunded: 0,
          net_collections: 0,
        },
        accounts_receivable_aging: {
          current_not_due: 53100,
          overdue_1_to_30_days: 0,
          overdue_31_to_60_days: 0,
          overdue_61_to_90_days: 0,
          overdue_greater_90_days: 0,
        },
        collections_by_pathway: {},
      } as any);
      vi.spyOn(api, "getClients").mockResolvedValue({ data: [], isLiveBackend: false } as any);
      vi.spyOn(api, "getCases").mockResolvedValue({ data: [], isLiveBackend: false } as any);

      const { container } = render(<BillingManager userRole="master_admin" isLiveBackend={false} />);

      await waitFor(() => {
        expect(screen.getByText("INV-IN-900")).toBeDefined();
      });

      // Switch to Service Catalog tab and confirm ₹45,000.00 (never $45,000 INR)
      fireEvent.click(screen.getByRole("button", { name: /Service Catalog/i }));
      await waitFor(() => {
        expect(screen.getByText("Canada Express Entry Filing")).toBeDefined();
      });
      expect(container.textContent).toContain("₹45,000.00");
      expect(container.textContent).not.toContain("$45,000 INR");

      // Switch back to Invoices and open Record Payment modal
      fireEvent.click(screen.getByRole("button", { name: /Invoices & Ledgers/i }));
      const payBtn = await screen.findByRole("button", { name: /Record Payment|Pay/i });
      fireEvent.click(payBtn);

      expect(screen.getByRole("heading", { name: "Record Manual / External Payment" })).toBeDefined();
      const methodSelect = document.getElementById("select-payment-method") as HTMLSelectElement;
      expect(methodSelect.value).toBe("wire_transfer");
      const refInput = document.getElementById("input-payment-reference") as HTMLInputElement;
      expect(refInput.value).toBe("");
      expect(refInput.value).not.toContain("tok_visa_verified_provider");
    });
  });

  describe("7. RuleAdministrationHub Live Hydration & Dynamic Migration Version", () => {
    it("loads live snapshots, versions, and requirements when isLiveBackend is true and uses selected version ID for migration", async () => {
      vi.spyOn(apiModule, "getCountryRegistry").mockResolvedValue([]);
      vi.spyOn(apiModule, "getPathwayTaxonomy").mockResolvedValue([]);
      vi.spyOn(apiModule, "getCoverageMatrix").mockResolvedValue(null as any);
      vi.spyOn(api, "getOfficialSources").mockResolvedValue({
        data: [
          {
            id: "live-src-1",
            jurisdiction: "CA",
            authority: "IRCC",
            title: "Live IRCC Ministerial Instructions",
            url: "https://canada.ca/ircc",
            scope: "Express Entry",
            is_active: true,
          },
        ],
        isLiveBackend: true,
      } as any);
      const snapshotsSpy = vi.spyOn(api, "getSourceSnapshots").mockResolvedValue({
        data: [
          {
            id: "live-snap-1",
            source_id: "live-src-1",
            content_hash: "abc123",
            published_date: "2026-02-01",
            effective_date: "2026-02-15",
          },
        ],
        isLiveBackend: true,
      } as any);
      vi.spyOn(api, "getRuleSets").mockResolvedValue({
        data: [
          {
            id: "live-rs-1",
            jurisdiction: "CA",
            pathway: "CA_EXPRESS_ENTRY_FSW",
            name: "Live Express Entry 2026",
            description: "Live rule set",
          },
        ],
        isLiveBackend: true,
      } as any);
      const versionsSpy = vi.spyOn(api, "getRuleSetVersions").mockResolvedValue({
        data: [
          {
            id: "ver-uuid-310",
            rule_set_id: "live-rs-1",
            version_number: "3.1.0",
            status: "published",
            change_summary: "2026 CRS Update",
          },
        ],
        isLiveBackend: true,
      } as any);
      const reqsSpy = vi.spyOn(api, "getVersionRequirements").mockResolvedValue({
        data: [],
        isLiveBackend: true,
      } as any);
      vi.spyOn(apiModule, "getCasePinnedChecklist").mockResolvedValue({
        case_id: "CASE-US-8841",
        pinned_rule_version_id: "ver-uuid-100",
        rules_update_available: true,
        latest_available_version_id: "ver-uuid-310",
        snapshot_pinned_at: "2026-01-15T10:00:00Z",
      } as any);
      const migrateSpy = vi.spyOn(apiModule, "migrateCaseRuleVersion").mockResolvedValue({
        from_version_number: "1.0.0",
        to_version_number: "3.1.0",
        audit_event_id: "aud-1",
        impact: { added_count: 1, removed_count: 0, modified_count: 0 },
      } as any);

      render(
        <RuleAdministrationHub
          userRole="master_admin"
          isLiveBackend={true}
          cases={FIXTURE_CASES}
        />
      );

      await waitFor(() => {
        expect(snapshotsSpy).toHaveBeenCalledWith("live-src-1", "master_admin");
        expect(versionsSpy).toHaveBeenCalledWith("live-rs-1", "master_admin");
        expect(reqsSpy).toHaveBeenCalledWith("ver-uuid-310", "master_admin");
      });

      // Open Checklist Engine & Safe Stop Simulator tab (contains Case Migration panel), inspect pinned case, and execute migration -> must pass "ver-uuid-310", NOT "2.0.0"
      const migTab = screen.getByRole("button", { name: /Checklist Engine & Safe Stop Simulator/i });
      fireEvent.click(migTab);
      fireEvent.click(screen.getByRole("button", { name: /Inspect Pinned Case/i }));

      const select = await screen.findByTestId("migration-target-version-select") as HTMLSelectElement;
      expect(select.value).toBe("ver-uuid-310");

      const migrateBtn = screen.getByRole("button", { name: /Migrate Case Pinned Snapshot → v3\.1\.0/i });
      fireEvent.click(migrateBtn);

      await waitFor(() => {
        expect(migrateSpy).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ to_version_id: "ver-uuid-310" }),
          "master_admin"
        );
      });
    });
  });

  describe("8. DocumentExtractorLab Single-Pass Analysis (No Double-Upload)", () => {
    it("calls only analyzeDocumentStandalone for a single file (never calls sortDocumentPacket in parallel)", async () => {
      const analyzeSpy = vi.spyOn(extractorApi, "analyzeDocumentStandalone").mockResolvedValue({
        status: "success",
        metadata: {
          filename: "Passport_Single.pdf",
          mime_type: "application/pdf",
          file_size_bytes: 1200,
          sha256_hash: "hash123",
          page_count: 1,
          detected_language: "en",
          total_blocks_detected: 5,
          overall_health_score: 98,
        },
        recognition: {
          category: "passport",
          category_label: "Passports and Identity Documents",
          confidence: 0.99,
          matched_keywords: ["PASSPORT"],
        },
        extracted_fields: [],
        quality_findings: [],
        specialized_intelligence: {},
        ocr_summary: { ocr_applied: true, avg_page_confidence: 0.99, pages: [] },
        raw_text_preview: "PASSPORT",
      } as any);
      const sortSpy = vi.spyOn(extractorApi, "sortDocumentPacket");

      const { container } = render(<DocumentExtractorLab />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const singleFile = new File(["%PDF-1.4"], "Passport_Single.pdf", { type: "application/pdf" });
      fireEvent.change(fileInput, { target: { files: [singleFile] } });

      const runBtn = screen.getByTestId("extractor-primary-submit-btn");
      fireEvent.click(runBtn);

      await waitFor(() => {
        expect(analyzeSpy).toHaveBeenCalledTimes(1);
      });
      expect(sortSpy).not.toHaveBeenCalled();
    });
  });

  describe("9. InitialInformationSheet Backend Sync & Quota Error Surfacing", () => {
    it("syncs GET and PUT /api/v1/portal/cases/:id/intake-sheet with Bearer token and surfaces storage quota errors", async () => {
      window.localStorage.setItem("documento_access_token", "jwt-token-xyz");
      const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        if (!init || init.method === "GET") {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ form_data: { family_name: "VERMA" }, is_submitted: false }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ status: "saved" }),
        });
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<InitialInformationSheet storageKeyId="case-sync-99" />);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/v1/portal/cases/case-sync-99/intake-sheet",
          expect.objectContaining({
            method: "GET",
            headers: expect.objectContaining({ Authorization: "Bearer jwt-token-xyz" }),
          })
        );
      });

      // Trigger Save Draft -> PUT call with Bearer auth
      const saveBtn = screen.getByRole("button", { name: /Save Draft/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/v1/portal/cases/case-sync-99/intake-sheet",
          expect.objectContaining({
            method: "PUT",
            headers: expect.objectContaining({ Authorization: "Bearer jwt-token-xyz" }),
          })
        );
      });

      // Simulate localStorage QuotaExceededError -> must surface visible error alert instead of swallowing
      const quotaErr = new Error("Storage full");
      quotaErr.name = "QuotaExceededError";
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw quotaErr;
      });

      fireEvent.click(saveBtn);
      await waitFor(() => {
        expect(screen.getByTestId("intake-sheet-save-error").textContent).toContain("quota exceeded");
      });

      vi.unstubAllGlobals();
    });
  });

  describe("10. VisaAppointmentDesk Resilience & Honest FAQ/Footer Copy", () => {
    it("handles empty cases without hardcoded case-01 and handles rejected fallback fetchAllAppointments without unhandled rejections", async () => {
      vi.spyOn(api, "getVisaAppointments").mockRejectedValue(new Error("API offline"));
      vi.spyOn(appointmentsApi, "fetchAllAppointments").mockRejectedValue(new Error("Fallback offline"));

      await act(async () => {
        render(<VisaAppointmentDesk cases={[]} clients={[]} />);
      });

      // Open schedule modal and verify no hardcoded "case-01"
      const schedBtn = screen.getByRole("button", { name: /Schedule.*Appointment|\+ Schedule/i });
      fireEvent.click(schedBtn);
      expect(document.body.textContent).not.toContain("case-01");
    });

    it("DocumentoFAQ and DocumentoFooter display accurate AES-256-GCM / S3 SSE-KMS vault copy without obsolete whitepaper claims", () => {
      const { container: faqC } = render(<DocumentoFAQ />);
      expect(faqC.textContent).toContain("AES-256-GCM / S3 SSE-KMS");
      expect(faqC.textContent).not.toContain("Technical Whitepaper v2.4");

      const { container: footerC } = render(<DocumentoFooter onOpenLogin={vi.fn()} />);
      expect(footerC.textContent).toContain("AES-256-GCM / S3 SSE-KMS");
    });

    it("AuthenticatedWorkspaceShell avoids nested <main> landmarks and PackageBuilderView wraps Excluded table in overflowX: auto", async () => {
      // Static verification of AuthenticatedWorkspaceShell outer wrapper & conditional dynamic modal rendering
      const shellSource = fs.readFileSync(
        path.resolve(__dirname, "../components/layout/AuthenticatedWorkspaceShell.tsx"),
        "utf8"
      );
      expect(shellSource).not.toContain("<main ");
      expect(shellSource).toContain("{isCreateClientOpen && (");
      expect(shellSource).toContain("{isCreateCaseOpen && (");
      expect(shellSource).toContain("{isUploadModalOpen && (");

      // Verify PackageBuilderView Excluded Documents table is wrapped in overflowX: auto
      const pkgSource = fs.readFileSync(
        path.resolve(__dirname, "../components/packages/PackageBuilderView.tsx"),
        "utf8"
      );
      expect(pkgSource).toContain('style={{ overflowX: "auto", width: "100%" }}');
      expect(PackageBuilderView).toBeDefined();
      expect(AuthenticatedWorkspaceShell).toBeDefined();
      expect(WorkspaceProvider).toBeDefined();

      // Verify SmartDropzone & SplitScreenCaseStudio do not auto-stamp AI docs/fields as verified/confirmed without human review
      const dropzoneSrc = fs.readFileSync(
        path.resolve(__dirname, "../components/common/SmartDropzone.tsx"),
        "utf8"
      );
      expect(dropzoneSrc).toContain('validation_status: "needs_review"');
      expect(dropzoneSrc).toContain('"pending_review"');
      expect(dropzoneSrc).not.toContain('review_status: "VERIFIED"');

      const studioSrc = fs.readFileSync(
        path.resolve(__dirname, "../components/cases/SplitScreenCaseStudio.tsx"),
        "utf8"
      );
      expect(studioSrc).toContain('validation_status: "needs_review"');
      expect(studioSrc).toContain('is_confirmed: false');
      expect(studioSrc).toContain('"pending_review"');
    });
  });
});
