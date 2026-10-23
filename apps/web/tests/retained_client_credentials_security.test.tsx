import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { authenticateUser, setClientCredential } from "../lib/auth";
import { api } from "../lib/api";
import { ClientPortal } from "../components/dashboards/ClientPortal";
import { OwnerMasterDashboard } from "../components/dashboards/OwnerMasterDashboard";
import { EmployeeWorkspace } from "../components/dashboards/EmployeeWorkspace";

describe("Retained Client Security & Day-0 Clean Slate", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe("1. Retained Client Credential Provisioning Gate", () => {
    it("strictly rejects client login when credentials have not been provisioned by Owner or Lead Paralegal", () => {
      const result = authenticateUser("client.unregistered@example.com", "client", "SomePassword123!");
      expect(result.success).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.error).toMatch(/Owner or Lead Paralegal must retain your profile and provide your portal credentials/i);
    });

    it("allows Owner (master_admin) to provision credentials for a retained client", async () => {
      // 1. Owner creates client with initial credentials
      const res = await api.createClient(
        {
          first_name: "Aarav",
          last_name: "Patel",
          nationality: "India",
          email: "aarav.patel@client.com",
          phone: "+1 (555) 901-2345",
          portal_credentials_provided: true,
          portal_access_enabled: true,
          temporary_password: "DocSecure2026!Patel",
        },
        "master_admin"
      );

      const client = res.data;
      expect(client.portal_credentials_provided).toBe(true);
      expect(client.portal_access_enabled).toBe(true);
      expect(client.credentials_provisioned_by).toBe("Owner (Managing Partner)");

      // Verify authentication succeeds with the provisioned credentials
      const authSuccess = authenticateUser("aarav.patel@client.com", "client", "DocSecure2026!Patel");
      expect(authSuccess.success).toBe(true);
      expect(authSuccess.user).toBeDefined();
      expect(authSuccess.user?.email).toBe("aarav.patel@client.com");
      expect(authSuccess.user?.role).toBe("retained_client");

      // Verify wrong password is rejected
      const authWrongPwd = authenticateUser("aarav.patel@client.com", "client", "WrongPassword123!");
      expect(authWrongPwd.success).toBe(false);
      expect(authWrongPwd.error).toMatch(/Invalid password/i);

      // Verify omitted/empty password is also strictly rejected
      const authEmptyPwd = authenticateUser("aarav.patel@client.com", "client", "");
      expect(authEmptyPwd.success).toBe(false);
      expect(authEmptyPwd.error).toMatch(/Invalid password/i);
    });

    it("allows Lead Paralegal (case_manager) to provision and update client credentials", async () => {
      // 1. Create client without initial credentials
      const res = await api.createClient(
        {
          first_name: "Priya",
          last_name: "Sharma",
          nationality: "India",
          email: "priya.sharma@example.com",
          phone: "+1 (555) 321-7654",
        },
        "case_manager"
      );
      const client = res.data;
      expect(client.portal_credentials_provided).toBe(false);

      // Verify login fails prior to provisioning
      const authBefore = authenticateUser("priya.sharma@example.com", "client", "AnyPassword123");
      expect(authBefore.success).toBe(false);

      // 2. Lead Paralegal issues credentials
      const updateRes = await api.provisionClientCredentials(
        client.id,
        "ParalegalSet2026!Priya",
        true,
        "case_manager"
      );
      const updatedClient = updateRes.data;
      expect(updatedClient.portal_credentials_provided).toBe(true);
      expect(updatedClient.portal_access_enabled).toBe(true);
      expect(updatedClient.credentials_provisioned_by).toBe("Lead Paralegal");

      // 3. Login now succeeds
      const authAfter = authenticateUser("priya.sharma@example.com", "client", "ParalegalSet2026!Priya");
      expect(authAfter.success).toBe(true);
      expect(authAfter.user?.name).toBe("Priya Sharma");
    });

    it("denies access immediately if Owner or Lead Paralegal revokes/disables portal access", async () => {
      // Provision client
      await api.createClient(
        {
          first_name: "Vikram",
          last_name: "Malhotra",
          nationality: "India",
          email: "vikram@malhotra.org",
          portal_credentials_provided: true,
          portal_access_enabled: true,
          temporary_password: "DocInitial2026!",
        },
        "master_admin"
      );

      // Disable access
      setClientCredential({
        client_id: "client-vikram",
        email: "vikram@malhotra.org",
        temporary_password: "DocInitial2026!",
        portal_access_enabled: false,
        provisioned_by: "master_admin",
        provisioned_at: new Date().toISOString(),
      });

      const res = authenticateUser("vikram@malhotra.org", "client", "DocInitial2026!");
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/portal access has been disabled by your legal team/i);
    });
  });

  describe("2. Clean Slate Day-0 Retained Client Portal View", () => {
    it("renders clean Day-0 empty state when client logs in but counsel has not yet assigned a case", () => {
      render(
        <ClientPortal
          myCase={null}
          documents={[]}
          messages={[]}
          notifications={[]}
          invoices={[]}
          onOpenUploadModal={vi.fn()}
          onOpenQuestionnaireModal={vi.fn()}
          onSendMessage={vi.fn()}
          onMarkNotificationRead={vi.fn()}
        />
      );

      // Overview Tab Day-0 Banner
      expect(screen.getByText(/Awaiting Case File Setup by Legal Team/i)).toBeDefined();
      expect(screen.getByText(/Your legal team \(firm Owner or Lead Paralegal\) will configure your immigration matter/i)).toBeDefined();
    });

    it("renders Day-0 clean slate when navigating to Updates tab without assigned case", () => {
      render(
        <ClientPortal
          myCase={null}
          documents={[]}
          messages={[]}
          notifications={[]}
          invoices={[]}
          onOpenUploadModal={vi.fn()}
          onOpenQuestionnaireModal={vi.fn()}
          onSendMessage={vi.fn()}
          onMarkNotificationRead={vi.fn()}
        />
      );

      // Click on Updates tab in sidebar navigation
      const navSidebar = screen.getByRole("navigation", { name: /Portal Navigation/i });
      const updatesTab = within(navSidebar).getByText(/Visa File Updates/i);
      fireEvent.click(updatesTab);

      expect(screen.getByTestId("visa-updates-empty-state")).toBeDefined();
      expect(screen.getByText(/No Case Docket Registered Yet/i)).toBeDefined();
      expect(screen.getByText(/Your legal team \(Owner or Lead Paralegal\) has not yet activated a petition docket/i)).toBeDefined();
    });

    it("renders Day-0 clean slate when navigating to Checklist, Documents, Questionnaire, and Billing tabs", () => {
      render(
        <ClientPortal
          myCase={null}
          documents={[]}
          messages={[]}
          notifications={[]}
          invoices={[]}
          onOpenUploadModal={vi.fn()}
          onOpenQuestionnaireModal={vi.fn()}
          onSendMessage={vi.fn()}
          onMarkNotificationRead={vi.fn()}
        />
      );

      const navSidebar = screen.getByRole("navigation", { name: /Portal Navigation/i });

      // Checklist tab
      const checklistTab = within(navSidebar).getByText(/Per-Applicant Checklist/i);
      fireEvent.click(checklistTab);
      expect(screen.getByTestId("checklist-empty-state")).toBeDefined();
      expect(screen.getByText(/No Evidentiary Checklist Configured/i)).toBeDefined();

      // Documents tab
      const docsTab = within(navSidebar).getByText(/Upload Documents/i);
      fireEvent.click(docsTab);
      expect(screen.getByTestId("documents-empty-state")).toBeDefined();
      expect(screen.getByText(/No Documents Requested Yet/i)).toBeDefined();

      // Questionnaire tab
      const questionnaireTab = within(navSidebar).getByText(/Guided Questionnaire/i);
      fireEvent.click(questionnaireTab);
      expect(screen.getByTestId("questionnaire-empty-state")).toBeDefined();
      expect(screen.getByText(/No Questionnaire Configured/i)).toBeDefined();

      // Messages tab
      const messagesTab = within(navSidebar).getByText(/Chat with Case Officer/i);
      fireEvent.click(messagesTab);
      expect(screen.getByTestId("messages-empty-state")).toBeDefined();
      expect(screen.getByText(/Direct Attorney Communication Pending/i)).toBeDefined();

      // Billing tab
      const billingTab = within(navSidebar).getByText(/Retainers & Invoices/i);
      fireEvent.click(billingTab);
      expect(screen.getByTestId("billing-empty-state")).toBeDefined();
      expect(screen.getByText(/No Invoices or Retainer Ledgers/i)).toBeDefined();
    });
  });

  describe("3. Retained Clients Section Clean Slate in Firm Dashboards", () => {
    it("displays clean zero-state in Owner Master Dashboard when zero clients exist", () => {
      render(
        <OwnerMasterDashboard
          cases={[]}
          clients={[]}
          auditEvents={[]}
          invoices={[]}
          onOpenCreateCase={vi.fn()}
          onOpenCreateClient={vi.fn()}
          onSelectCase={vi.fn()}
        />
      );

      // Navigate to Retained Clients tab in sidebar navigation
      const navSidebar = screen.getByRole("navigation", { name: /Executive Navigation/i });
      const clientsTab = within(navSidebar).getByRole("button", { name: /Retained Clients/i });
      fireEvent.click(clientsTab);

      expect(screen.getByText(/No Retained Clients in Firm Directory \(Clean Slate\)/i)).toBeDefined();
      expect(screen.getByText(/Zero client profiles are currently registered/i)).toBeDefined();
      expect(screen.getByRole("button", { name: /\+ Retain First Client & Issue Credentials/i })).toBeDefined();
    });

    it("displays clean zero-state in Employee Workspace when zero clients exist", () => {
      render(
        <EmployeeWorkspace
          currentUser={{
            id: "emp-01",
            email: "sarah.vance@vanguardlegal.com",
            full_name: "Sarah Vance, Lead Paralegal",
            role: "case_manager",
            experience: "case_manager",
            organization_id: "org-01",
            organization_name: "Vanguard Immigration Law Group LLP",
            permissions: ["manage_cases", "edit_records"],
          }}
          cases={[]}
          clients={[]}
          documents={[]}
          tasks={[]}
          aiFindings={[]}
          messages={[]}
          onToggleTask={vi.fn()}
          onSendMessage={vi.fn()}
          onSelectCase={vi.fn()}
          onOpenUploadModal={vi.fn()}
        />
      );

      // Navigate to Clients tab in Employee Workspace (labeled "Client Directory")
      const clientsTab = screen.getByRole("button", { name: /Client Directory/i });
      fireEvent.click(clientsTab);

      expect(screen.getByText(/No Retained Clients in Firm Directory/i)).toBeDefined();
      expect(screen.getByText(/Zero client profiles are currently registered/i)).toBeDefined();
    });
  });
});
