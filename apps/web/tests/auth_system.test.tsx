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

    it("renders dual portal tabs and evaluation demo buttons", () => {
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

      // Verify 1-click evaluation personas
      expect(screen.getByText(/Partner/i)).toBeDefined();
      expect(screen.getByText(/Paralegal/i)).toBeDefined();
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

    it("executes 1-click login and passes authenticated user", () => {
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

      const partnerDemoBtn = screen.getByRole("button", { name: /Partner/i });
      fireEvent.click(partnerDemoBtn);

      act(() => {
        vi.advanceTimersByTime(500);
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
