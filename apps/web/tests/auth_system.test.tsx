import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { authenticateUser, PLATFORM_HQ_OPERATOR_EMAIL } from "../lib/auth";
import {
  submitAgencyOnboarding,
  adjudicateAgencyKybApplication,
  inviteAgencyTeamMember,
} from "../lib/agencyPlatformStore";
import { api } from "../lib/api";
import { UserContext } from "../lib/types";
import { DocumentoLoginModal } from "../components/auth/DocumentoLoginModal";
import { WorkspaceHeader } from "../components/layout/WorkspaceHeader";

async function provisionRealPartnerAgency() {
  const application = await submitAgencyOnboarding({
    legalEntityName: "Horizon Immigration Counsel Professional Corp.",
    tradingName: "Horizon Immigration",
    requestedSlug: "horizon-immigration",
    hqCountry: "CA",
    hqCity: "Toronto",
    corporateDomain: "horizonimmigration.ca",
    taxRegistrationId: "BN-748291003RC0001",
    contactFullName: "Ananya Rao, RCIC",
    contactWorkEmail: "ananya@horizonimmigration.ca",
    contactPhone: "+1-416-555-0148",
    ownerPassword: "HorizonOwnerPass2026!",
    kybTrack: "regulated_counsel",
    regulatoryBody: "CICC",
    licenseNumber: "R718842",
    targetCorridors: ["CA", "AU"],
    estimatedMonthlyCases: 30,
    requestedSeats: 8,
    branchCount: 1,
    selectedPlanTier: "growth",
    dpaAccepted: true,
    zeroTrainingAccepted: true,
  });

  const outcome = adjudicateAgencyKybApplication(
    application.id,
    "approve",
    "Verified CICC active registry standing.",
    PLATFORM_HQ_OPERATOR_EMAIL
  );
  return outcome.provisionedTenant!;
}

describe("Documento Authentication System (Zero Demo Personas)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  describe("authenticateUser helper", () => {
    it("strictly rejects unregistered demo emails and wildcard domains", () => {
      expect(
        authenticateUser("sarah.jenkins@vanguardlegal.com", "firm", "anypass").success
      ).toBe(false);
      expect(
        authenticateUser("random.user@anyfirm.com", "firm", "anypass").success
      ).toBe(false);
      expect(
        authenticateUser("dr.thorne@cambridge.edu", "client", "anypass").success
      ).toBe(false);
    });

    it("enforces exact passphrase on HQ Super-Admin bootstrap operator", () => {
      expect(authenticateUser(PLATFORM_HQ_OPERATOR_EMAIL, "firm", "").success).toBe(false);
      expect(authenticateUser(PLATFORM_HQ_OPERATOR_EMAIL, "firm", "WrongPass!").success).toBe(false);

      const ok = authenticateUser(PLATFORM_HQ_OPERATOR_EMAIL, "firm", "DocumentoHQ2026!");
      expect(ok.success).toBe(true);
      expect(ok.user?.role).toBe("platform_super_admin");
    });

    it("authenticates provisioned Agency Owner, invited Paralegal, and Retained Client with real credentials", async () => {
      const tenant = await provisionRealPartnerAgency();

      // 1. Agency Owner
      const badOwner = authenticateUser("ananya@horizonimmigration.ca", "firm", "WrongPass!");
      expect(badOwner.success).toBe(false);

      const ownerRes = authenticateUser(
        "ananya@horizonimmigration.ca",
        "firm",
        "HorizonOwnerPass2026!"
      );
      expect(ownerRes.success).toBe(true);
      expect(ownerRes.user?.role).toBe("master_admin");
      expect(ownerRes.user?.organization_id).toBe(tenant.organizationId);
      expect(ownerRes.user?.full_name).toBe("Ananya Rao, RCIC");

      // 2. Invited Paralegal
      const invite = inviteAgencyTeamMember({
        organizationId: tenant.organizationId,
        fullName: "Devon Brooks",
        email: "devon@horizonimmigration.ca",
        role: "paralegal",
      });
      const staffRes = authenticateUser(
        "devon@horizonimmigration.ca",
        "firm",
        invite.passcode
      );
      expect(staffRes.success).toBe(true);
      expect(staffRes.user?.role).toBe("case_worker");
      expect(staffRes.user?.experience).toBe("paralegal");
      expect(staffRes.user?.organization_id).toBe(tenant.organizationId);

      // 3. Retained Client with issued portal password
      window.localStorage.setItem("documento_user", JSON.stringify(ownerRes.user));
      await api.createClient({
        first_name: "Meera",
        last_name: "Krishnan",
        email: "meera.krishnan@example.com",
        nationality: "IND",
        portal_credentials_provided: true,
        portal_access_enabled: true,
        temporary_password: "ClientPortal2026!",
      });

      expect(
        authenticateUser("meera.krishnan@example.com", "client", "WrongPass!").success
      ).toBe(false);

      const clientRes = authenticateUser(
        "meera.krishnan@example.com",
        "client",
        "ClientPortal2026!"
      );
      expect(clientRes.success).toBe(true);
      expect(clientRes.user?.role).toBe("retained_client");
      expect(clientRes.user?.full_name).toBe("Meera Krishnan");
      expect(clientRes.user?.organization_id).toBe(tenant.organizationId);
    });
  });

  describe("DocumentoLoginModal Component", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("renders dual portal tabs and credentials input fields without demo SSO shortcuts", () => {
      render(
        <DocumentoLoginModal
          isOpen={true}
          onClose={vi.fn()}
          onLoginSuccess={vi.fn()}
          initialPortal="firm"
        />
      );

      expect(screen.getByText(/Sign in to Documento/i)).toBeDefined();
      expect(screen.getByText("Firm & Attorney")).toBeDefined();
      expect(screen.getByText("Client & Applicant")).toBeDefined();
      expect(screen.getByLabelText(/Business Email/i)).toBeDefined();
      expect(screen.getByLabelText(/^Password$/i)).toBeDefined();
      expect(screen.queryByText(/vanguardlegal/i)).toBeNull();
    });

    it("switches to client portal tab and updates email label", () => {
      render(
        <DocumentoLoginModal
          isOpen={true}
          onClose={vi.fn()}
          onLoginSuccess={vi.fn()}
          initialPortal="firm"
        />
      );

      fireEvent.click(screen.getByText("Client & Applicant"));
      expect(screen.getByText("Applicant Email Address")).toBeDefined();
    });

    it("executes credentials login for a provisioned agency owner", async () => {
      vi.useRealTimers();
      const tenant = await provisionRealPartnerAgency();
      vi.useFakeTimers();
      const onLoginSuccess = vi.fn();

      render(
        <DocumentoLoginModal
          isOpen={true}
          onClose={vi.fn()}
          onLoginSuccess={onLoginSuccess}
          initialPortal="firm"
        />
      );

      fireEvent.change(screen.getByLabelText(/Business Email/i), {
        target: { value: "ananya@horizonimmigration.ca" },
      });
      fireEvent.change(screen.getByLabelText(/^Password$/i), {
        target: { value: "HorizonOwnerPass2026!" },
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /Sign In to Firm Workspace/i }));
      });

      expect(onLoginSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          role: "master_admin",
          full_name: "Ananya Rao, RCIC",
          organization_id: tenant.organizationId,
        })
      );
    });
  });

  describe("WorkspaceHeader Component", () => {
    const ownerUser: UserContext = {
      id: "owner-horizon-1",
      email: "ananya@horizonimmigration.ca",
      full_name: "Ananya Rao, RCIC",
      role: "master_admin",
      organization_id: "ten-horizon-immigration",
      organization_name: "Horizon Immigration",
      experience: "master_admin",
      permissions: ["cases:read", "cases:write", "client:delete"],
    };

    it("renders firm organization, user avatar, status badges, and zero demo persona switcher", () => {
      const onLogout = vi.fn();

      render(
        <WorkspaceHeader
          currentUser={ownerUser}
          onLogout={onLogout}
          isLiveBackend={true}
        />
      );

      expect(screen.getByText("Ananya Rao, RCIC")).toBeDefined();
      expect(screen.getByText("Horizon Immigration")).toBeDefined();
      expect(screen.getByText("Managing Partner")).toBeDefined();
      expect(screen.getByText("FastAPI Live")).toBeDefined();

      const profileBtn = screen.getByRole("button", { name: /Ananya Rao, RCIC - User profile menu/i });
      fireEvent.click(profileBtn);

      expect(screen.queryByText(/Switch Demo Persona/i)).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: /Sign Out of Documento/i }));
      expect(onLogout).toHaveBeenCalled();
    });
  });
});
