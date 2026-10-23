import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { authenticateUser, DEMO_USERS } from "../lib/auth";
import { DocumentoLoginModal } from "../components/auth/DocumentoLoginModal";
import { WorkspaceHeader } from "../components/layout/WorkspaceHeader";

describe("Documento Authentication System", () => {
  describe("authenticateUser helper", () => {
    it("successfully authenticates master admin credentials in firm portal", () => {
      const result = authenticateUser("sarah.jenkins@vanguardlegal.com", "firm");
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.full_name).toBe("Sarah Jenkins, Esq.");
      expect(result.user?.role).toBe("master_admin");
    });

    it("successfully authenticates paralegal in firm portal", () => {
      const result = authenticateUser("marcus.vance@vanguardlegal.com", "firm");
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.role).toBe("case_manager");
      expect(result.user?.full_name).toBe("Marcus Vance, Lead Paralegal");
    });

    it("successfully authenticates client applicant in client portal", () => {
      const result = authenticateUser("dr.thorne@cambridge.edu", "client");
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.role).toBe("retained_client");
      expect(result.user?.full_name).toBe("Dr. Aris Thorne");
    });
  });

  describe("DocumentoLoginModal Component", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("renders dual portal tabs and credentials input fields", () => {
      const onClose = vi.fn();
      const onLoginSuccess = vi.fn();

      render(
        <DocumentoLoginModal
          isOpen={true}
          onClose={onClose}
          onLoginSuccess={onLoginSuccess}
          initialPortal="firm"
        />
      );

      // Verify header and security reassurance
      expect(screen.getByText(/Sign in to Documento/i)).toBeDefined();
      expect(screen.getByText("Firm & Attorney")).toBeDefined();
      expect(screen.getByText("Client & Applicant")).toBeDefined();

      // Verify secure form inputs
      expect(screen.getByLabelText(/Business Email/i)).toBeDefined();
      expect(screen.getByLabelText(/^Password$/i)).toBeDefined();
      expect(screen.getByRole("button", { name: /Sign In to Firm Workspace/i })).toBeDefined();
    });

    it("switches to client portal tab and updates email label", () => {
      const onClose = vi.fn();
      const onLoginSuccess = vi.fn();

      render(
        <DocumentoLoginModal
          isOpen={true}
          onClose={onClose}
          onLoginSuccess={onLoginSuccess}
          initialPortal="firm"
        />
      );

      const clientTab = screen.getByText("Client & Applicant");
      fireEvent.click(clientTab);

      expect(screen.getByText("Applicant Email Address")).toBeDefined();
    });

    it("executes credentials login and passes authenticated user", async () => {
      const onClose = vi.fn();
      const onLoginSuccess = vi.fn();

      render(
        <DocumentoLoginModal
          isOpen={true}
          onClose={onClose}
          onLoginSuccess={onLoginSuccess}
          initialPortal="firm"
        />
      );

      const emailInput = screen.getByLabelText(/Business Email/i);
      const passwordInput = screen.getByLabelText(/^Password$/i);
      const submitBtn = screen.getByRole("button", { name: /Sign In to Firm Workspace/i });

      fireEvent.change(emailInput, { target: { value: "sarah.jenkins@vanguardlegal.com" } });
      fireEvent.change(passwordInput, { target: { value: "SecureFirmPassword2026!" } });

      await act(async () => {
        fireEvent.click(submitBtn);
      });

      expect(onLoginSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "usr-01",
          role: "master_admin",
          full_name: "Sarah Jenkins, Esq.",
        })
      );
    });
  });

  describe("WorkspaceHeader Component", () => {
    it("renders firm organization, user avatar, and status badges", () => {
      const onLogout = vi.fn();
      const onSwitchRole = vi.fn();

      render(
        <WorkspaceHeader
          currentUser={DEMO_USERS.master_admin}
          onLogout={onLogout}
          onSwitchRole={onSwitchRole}
          isLiveBackend={true}
        />
      );

      expect(screen.getByText("Sarah Jenkins, Esq.")).toBeDefined();
      expect(screen.getByText("Vanguard Immigration Law Group LLP")).toBeDefined();
      expect(screen.getByText("Managing Partner")).toBeDefined();
      expect(screen.getByText("FastAPI Live")).toBeDefined();
    });

    it("allows user to open profile menu and trigger logout", () => {
      const onLogout = vi.fn();
      const onSwitchRole = vi.fn();

      render(
        <WorkspaceHeader
          currentUser={DEMO_USERS.master_admin}
          onLogout={onLogout}
          onSwitchRole={onSwitchRole}
          isLiveBackend={true}
        />
      );

      const profileBtn = screen.getByRole("button", { name: /Sarah Jenkins, Esq./i });
      fireEvent.click(profileBtn);

      const signOutBtn = screen.getByRole("button", { name: /Sign Out of Documento/i });
      fireEvent.click(signOutBtn);

      expect(onLogout).toHaveBeenCalled();
    });
  });
});
