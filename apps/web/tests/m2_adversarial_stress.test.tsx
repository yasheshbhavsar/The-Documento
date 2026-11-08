import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import {
  WorkspaceProvider,
  useWorkspace,
  useWorkspaceSafe,
  WorkspaceContextType,
} from "../lib/context/WorkspaceContext";
import { DashboardErrorBoundary } from "../components/common/DashboardErrorBoundary";
import { api } from "../lib/api";
import { UserContext } from "../lib/types";

describe("Milestone 2 Adversarial Stress Testing & Error Containment", () => {
  const originalConsoleError = console.error;

  beforeEach(() => {
    vi.restoreAllMocks();
    if (typeof window !== "undefined") {
      localStorage.clear();
      sessionStorage.clear();
    }
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  // =========================================================================
  // SECTION 1: WorkspaceContext Adversarial Stress Tests
  // =========================================================================
  describe("1. WorkspaceContext Rapid Role Switching & Auth State Mutation", () => {
    const mockUsers: Record<string, UserContext> = {
      master_admin: {
        id: "usr-admin",
        email: "owner@immigov.com",
        full_name: "Sarah Jenkins, Esq.",
        role: "master_admin",
        organization_id: "org-01",
        organization_name: "Apex Global Law",
        experience: "master_admin",
        permissions: ["all"],
      },
      case_manager: {
        id: "usr-manager",
        email: "manager@immigov.com",
        full_name: "Marcus Vance",
        role: "case_manager",
        organization_id: "org-01",
        organization_name: "Apex Global Law",
        experience: "case_manager",
        permissions: ["cases.manage", "tasks.assign"],
      },
      paralegal: {
        id: "usr-paralegal",
        email: "paralegal@immigov.com",
        full_name: "Elena Rostova",
        role: "document_reviewer",
        organization_id: "org-01",
        organization_name: "Apex Global Law",
        experience: "paralegal",
        permissions: ["documents.review", "tasks.read"],
      },
      client_applicant: {
        id: "usr-client",
        email: "applicant@gmail.com",
        full_name: "Li Wei",
        role: "applicant",
        organization_id: "org-01",
        organization_name: "Apex Global Law",
        experience: "client_applicant",
        permissions: ["portal.access"],
      },
      super_admin: {
        id: "usr-super",
        email: "superadmin@documento.internal",
        full_name: "DevOps Controller",
        role: "platform_super_admin",
        organization_id: "platform-root",
        organization_name: "Documento Global Platform",
        experience: "platform_super_admin",
        permissions: ["platform.cross_tenant_read"],
      },
    };

    function RoleStressTester({ onCapture }: { onCapture: (ws: WorkspaceContextType) => void }) {
      const ws = useWorkspace();
      onCapture(ws);
      return (
        <div data-testid="role-info">
          <span data-testid="active-role">{ws.activeRole}</span>
          <span data-testid="active-exp">{ws.activeExp}</span>
          <span data-testid="role-code">{ws.currentRoleCode}</span>
          <span data-testid="user-email">{ws.currentUser?.email || "none"}</span>
          <span data-testid="alert-msg">{ws.bannerAlert?.message || "no-alert"}</span>
          <button data-testid="btn-logout" onClick={ws.handleLogout}>
            Logout
          </button>
        </div>
      );
    }

    it("survives 30 rapid back-to-back role and auth state changes without race condition or memory leak", async () => {
      let capturedWs!: WorkspaceContextType;

      render(
        <WorkspaceProvider initialUser={mockUsers.master_admin}>
          <RoleStressTester onCapture={(ws) => (capturedWs = ws)} />
        </WorkspaceProvider>
      );

      expect(screen.getByTestId("active-role").textContent).toBe("master_admin");
      expect(screen.getByTestId("active-exp").textContent).toBe("master_admin");

      const roleKeys = [
        "case_manager",
        "paralegal",
        "client_applicant",
        "super_admin",
        "master_admin",
      ];

      // Rapidly flip roles 29 times, ending on super_admin (index 3)
      for (let i = 0; i < 29; i++) {
        const targetRole = roleKeys[i % roleKeys.length];
        const nextUser = mockUsers[targetRole];

        await act(async () => {
          capturedWs.handleLoginSuccess(nextUser);
        });

        // Verify intermediate convergence
        if (targetRole === "super_admin") {
          expect(capturedWs.activeRole).toBe("super_admin");
        } else {
          expect(capturedWs.activeRole).toBe(targetRole);
        }
        expect(capturedWs.currentUser?.id).toBe(nextUser.id);
      }

      // Verify final state after rapid stress cycling (28 % 5 = 3 => super_admin)
      expect(screen.getByTestId("active-role").textContent).toBe("super_admin");
      expect(screen.getByTestId("user-email").textContent).toBe("superadmin@documento.internal");

      // Verify safe signout after stress cycling
      await act(async () => {
        capturedWs.handleLogout();
      });

      expect(screen.getByTestId("active-role").textContent).toBe("master_admin");
      expect(screen.getByTestId("user-email").textContent).toBe("none");
      expect(capturedWs.bannerAlert?.message).toContain("signed out");
      expect(localStorage.getItem("documento_user")).toBeNull();
    });

    it("handles rapid consecutive login/logout flapping without unhandled rejections", async () => {
      let capturedWs!: WorkspaceContextType;

      render(
        <WorkspaceProvider>
          <RoleStressTester onCapture={(ws) => (capturedWs = ws)} />
        </WorkspaceProvider>
      );

      for (let cycle = 0; cycle < 10; cycle++) {
        await act(async () => {
          capturedWs.handleLoginSuccess(mockUsers.client_applicant);
        });
        expect(capturedWs.activeRole).toBe("client_applicant");

        await act(async () => {
          capturedWs.handleLogout();
        });
        expect(capturedWs.activeRole).toBe("master_admin");
        expect(capturedWs.currentUser).toBeNull();
      }

      expect(localStorage.getItem("documento_user")).toBeNull();
    });
  });

  // =========================================================================
  // SECTION 2: Network / Backend 500 Outage Resilience
  // =========================================================================
  describe("2. Network & Backend 500 Failure Resilience in WorkspaceContext", () => {
    let capturedWs!: WorkspaceContextType;

    function StateHarness({ onCapture }: { onCapture: (ws: WorkspaceContextType) => void }) {
      const ws = useWorkspace();
      onCapture(ws);
      return (
        <div>
          <span data-testid="loading-state">{ws.isLoading ? "loading" : "idle"}</span>
          <span data-testid="cases-length">{ws.cases.length}</span>
          <span data-testid="clients-length">{ws.clients.length}</span>
          <span data-testid="banner-alert">{ws.bannerAlert?.message || "none"}</span>
        </div>
      );
    }

    it("refreshCases absorbs 500 Internal Server Error without throwing or corrupting state", async () => {
      vi.spyOn(api, "getCases").mockRejectedValue(
        new Error("HTTP 500 Internal Server Error: Casework microservice crashed")
      );

      render(
        <WorkspaceProvider>
          <StateHarness onCapture={(ws) => (capturedWs = ws)} />
        </WorkspaceProvider>
      );

      // Must resolve without unhandled rejection
      await expect(
        act(async () => {
          await capturedWs.refreshCases();
        })
      ).resolves.not.toThrow();

      expect(Array.isArray(capturedWs.cases)).toBe(true);
      expect(capturedWs.cases.length).toBe(0);
    });

    it("refreshClients absorbs network disconnect (TypeError: Failed to fetch) gracefully", async () => {
      vi.spyOn(api, "getClients").mockRejectedValue(
        new TypeError("Failed to fetch: net::ERR_INTERNET_DISCONNECTED")
      );

      render(
        <WorkspaceProvider>
          <StateHarness onCapture={(ws) => (capturedWs = ws)} />
        </WorkspaceProvider>
      );

      await expect(
        act(async () => {
          await capturedWs.refreshClients();
        })
      ).resolves.not.toThrow();

      expect(Array.isArray(capturedWs.clients)).toBe(true);
      expect(capturedWs.clients.length).toBe(0);
    });

    it("refreshDocuments absorbs 503 Service Unavailable without crashing", async () => {
      vi.spyOn(api, "getDocuments").mockRejectedValue(
        new Error("HTTP 503 Service Unavailable: Document vault is under maintenance")
      );

      render(
        <WorkspaceProvider>
          <StateHarness onCapture={(ws) => (capturedWs = ws)} />
        </WorkspaceProvider>
      );

      await expect(
        act(async () => {
          await capturedWs.refreshDocuments();
        })
      ).resolves.not.toThrow();

      expect(Array.isArray(capturedWs.documents)).toBe(true);
    });

    it("refreshLiveTasksAndAudit absorbs partial downstream microservice failures", async () => {
      vi.spyOn(api, "getTasks").mockRejectedValue(new Error("Redis connection refused"));
      vi.spyOn(api, "getAuditEvents").mockRejectedValue(new Error("Audit log locked"));

      render(
        <WorkspaceProvider>
          <StateHarness onCapture={(ws) => (capturedWs = ws)} />
        </WorkspaceProvider>
      );

      await expect(
        act(async () => {
          await capturedWs.refreshLiveTasksAndAudit();
        })
      ).resolves.not.toThrow();

      expect(Array.isArray(capturedWs.tasks)).toBe(true);
      expect(Array.isArray(capturedWs.auditEvents)).toBe(true);
    });

    it("refreshAll catches fatal API error, exposes user-friendly bannerAlert, and resets isLoading to false", async () => {
      vi.spyOn(api, "checkBackendHealth").mockResolvedValue(true);
      vi.spyOn(api, "getCases").mockRejectedValue(
        new Error("Backend Gateway Timeout: upstream service did not respond in 5000ms")
      );

      render(
        <WorkspaceProvider
          initialUser={{
            id: "u-1",
            email: "admin@test.com",
            full_name: "Admin User",
            role: "master_admin",
            organization_id: "org-1",
            organization_name: "Test Firm",
            experience: "master_admin",
            permissions: ["all"],
          }}
        >
          <StateHarness onCapture={(ws) => (capturedWs = ws)} />
        </WorkspaceProvider>
      );

      await act(async () => {
        await capturedWs.refreshAll();
      });

      expect(capturedWs.isLoading).toBe(false);
      expect(capturedWs.bannerAlert?.type).toBe("warning");
      expect(capturedWs.bannerAlert?.message).toContain("Backend Gateway Timeout");
    });
  });

  // =========================================================================
  // SECTION 3: Hook Safety & Outside-Provider Invariants
  // =========================================================================
  describe("3. Hook Contract Invariants: useWorkspace vs useWorkspaceSafe", () => {
    it("useWorkspace throws strict invariant error when called outside WorkspaceProvider", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      function IllegalStrictCaller() {
        useWorkspace();
        return <div>Never renders</div>;
      }

      expect(() => render(<IllegalStrictCaller />)).toThrow(
        "useWorkspace must be used within a WorkspaceProvider"
      );

      consoleSpy.mockRestore();
    });

    it("useWorkspaceSafe returns null without throwing when called outside WorkspaceProvider", () => {
      function LegalSafeCaller() {
        const ws = useWorkspaceSafe();
        return (
          <div data-testid="safe-result">
            {ws === null ? "IS_STRICTLY_NULL" : "UNEXPECTED_VALUE"}
          </div>
        );
      }

      render(<LegalSafeCaller />);
      expect(screen.getByTestId("safe-result").textContent).toBe("IS_STRICTLY_NULL");
    });

    it("both hooks return the exact same instance reference inside WorkspaceProvider", () => {
      let strictRef: WorkspaceContextType | null = null;
      let safeRef: WorkspaceContextType | null = null;

      function DualHookConsumer() {
        strictRef = useWorkspace();
        safeRef = useWorkspaceSafe();
        return <div>Rendered</div>;
      }

      render(
        <WorkspaceProvider>
          <DualHookConsumer />
        </WorkspaceProvider>
      );

      expect(strictRef).not.toBeNull();
      expect(safeRef).not.toBeNull();
      expect(strictRef).toBe(safeRef);
    });
  });

  // =========================================================================
  // SECTION 4: DashboardErrorBoundary Adversarial Stress Tests
  // =========================================================================
  describe("4. DashboardErrorBoundary Adversarial Exception Containment", () => {
    it("catches synchronous exception during render and shows fault card", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      function SyncExplodingComponent(): React.ReactNode {
        throw new Error("Fatal synchronous render explosion: DOM unmountable");
      }

      render(
        <DashboardErrorBoundary sectionTitle="Casework Kanban Board">
          <SyncExplodingComponent />
        </DashboardErrorBoundary>
      );

      expect(screen.getByTestId("dashboard-error-boundary-fallback")).toBeDefined();
      expect(screen.getByText("⚠️ SECTION FAULT ISOLATED")).toBeDefined();
      expect(screen.getByText("Casework Kanban Board Temporarily Unavailable")).toBeDefined();
      expect(screen.getByRole("button", { name: /↻ Reload Section/i })).toBeDefined();

      consoleSpy.mockRestore();
    });

    it("catches TypeError: null pointer dereference during render", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      function NullDereferenceComponent(): React.ReactNode {
        const nullObject: any = null;
        return <div>{nullObject.deeply.nested.property.that.does.not.exist}</div>;
      }

      render(
        <DashboardErrorBoundary sectionTitle="Evidentiary Ledger">
          <NullDereferenceComponent />
        </DashboardErrorBoundary>
      );

      expect(screen.getByTestId("dashboard-error-boundary-fallback")).toBeDefined();
      expect(screen.getByText("Evidentiary Ledger Temporarily Unavailable")).toBeDefined();

      consoleSpy.mockRestore();
    });

    it("catches RangeError: Invalid time value on corrupted date parsing", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      function CorruptedDateParserComponent(): React.ReactNode {
        const rawDate = "not-a-valid-iso-date-string-corrupted-by-db";
        const parsed = new Date(rawDate);
        return <div>Case Filed Date: {parsed.toISOString()}</div>;
      }

      render(
        <DashboardErrorBoundary sectionTitle="Filing Timeline">
          <CorruptedDateParserComponent />
        </DashboardErrorBoundary>
      );

      expect(screen.getByTestId("dashboard-error-boundary-fallback")).toBeDefined();
      expect(screen.getByText("Filing Timeline Temporarily Unavailable")).toBeDefined();

      consoleSpy.mockRestore();
    });

    it("catches non-Error thrown types (string literal thrown)", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      function StringThrowingComponent(): React.ReactNode {
        throw "Raw string literal thrown from legacy module";
      }

      render(
        <DashboardErrorBoundary sectionTitle="Legacy Addon">
          <StringThrowingComponent />
        </DashboardErrorBoundary>
      );

      expect(screen.getByTestId("dashboard-error-boundary-fallback")).toBeDefined();
      expect(screen.getByText("Legacy Addon Temporarily Unavailable")).toBeDefined();

      consoleSpy.mockRestore();
    });

    it("isolates fault completely: parent application and sibling trees remain fully mounted and interactive", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      function FaultyChild(): React.ReactNode {
        throw new Error("Crash inside isolated section!");
      }

      function ParentHostApp() {
        const [counter, setCounter] = useState(0);

        return (
          <div data-testid="parent-app">
            <header data-testid="parent-header">
              <span data-testid="parent-counter">Count: {counter}</span>
              <button
                data-testid="parent-btn"
                onClick={() => setCounter((c) => c + 1)}
              >
                Increment Parent State
              </button>
            </header>

            <main data-testid="parent-main">
              <DashboardErrorBoundary sectionTitle="Faulty Subtree">
                <FaultyChild />
              </DashboardErrorBoundary>
            </main>

            <footer data-testid="parent-footer">
              <span>Tenant Security Shield Active</span>
            </footer>
          </div>
        );
      }

      render(<ParentHostApp />);

      // Verify parent, header, and footer survive untouched
      expect(screen.getByTestId("parent-app")).toBeDefined();
      expect(screen.getByTestId("parent-header")).toBeDefined();
      expect(screen.getByTestId("parent-footer")).toBeDefined();
      expect(screen.getByText("Tenant Security Shield Active")).toBeDefined();

      // Verify interactive state in parent still functions perfectly
      expect(screen.getByTestId("parent-counter").textContent).toBe("Count: 0");
      fireEvent.click(screen.getByTestId("parent-btn"));
      expect(screen.getByTestId("parent-counter").textContent).toBe("Count: 1");
      fireEvent.click(screen.getByTestId("parent-btn"));
      expect(screen.getByTestId("parent-counter").textContent).toBe("Count: 2");

      // Verify fault UI is quarantined strictly to main
      expect(screen.getByTestId("dashboard-error-boundary-fallback")).toBeDefined();
      expect(screen.getByText("Faulty Subtree Temporarily Unavailable")).toBeDefined();

      consoleSpy.mockRestore();
    });

    it("allows full recovery via ↻ Reload Section when transient fault condition is remediated", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      let shouldFail = true;

      function FlakyComponent() {
        if (shouldFail) {
          throw new Error("Transient network failure during render");
        }
        return <div data-testid="flaky-success">Section successfully recovered!</div>;
      }

      render(
        <DashboardErrorBoundary sectionTitle="Recoverable Section">
          <FlakyComponent />
        </DashboardErrorBoundary>
      );

      // Initially faulty
      expect(screen.getByTestId("dashboard-error-boundary-fallback")).toBeDefined();
      expect(screen.queryByTestId("flaky-success")).toBeNull();

      // Remediate transient issue
      shouldFail = false;

      // Click reload
      const reloadBtn = screen.getByRole("button", { name: /↻ Reload Section/i });
      fireEvent.click(reloadBtn);

      // Boundary resets and re-renders child successfully
      expect(screen.queryByTestId("dashboard-error-boundary-fallback")).toBeNull();
      expect(screen.getByTestId("flaky-success").textContent).toBe(
        "Section successfully recovered!"
      );

      consoleSpy.mockRestore();
    });

    it("automatically resets error state when isolateStateKey prop changes (e.g., tab navigation)", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      function FlakyTabComponent({ activeTab }: { activeTab: string }) {
        if (activeTab === "broken-tab") {
          throw new Error("Broken tab exploded");
        }
        return <div data-testid="tab-content">Displaying content for {activeTab}</div>;
      }

      function TabNavigationHost() {
        const [tab, setTab] = useState("broken-tab");

        return (
          <div>
            <button data-testid="switch-tab-btn" onClick={() => setTab("working-tab")}>
              Switch to Working Tab
            </button>
            <DashboardErrorBoundary
              sectionTitle="Tab Container"
              isolateStateKey={tab}
            >
              <FlakyTabComponent activeTab={tab} />
            </DashboardErrorBoundary>
          </div>
        );
      }

      render(<TabNavigationHost />);

      // Initially broken tab causes fault card
      expect(screen.getByTestId("dashboard-error-boundary-fallback")).toBeDefined();
      expect(screen.getByText("Tab Container Temporarily Unavailable")).toBeDefined();

      // User switches tab (isolateStateKey changes)
      fireEvent.click(screen.getByTestId("switch-tab-btn"));

      // Boundary automatically cleared error state and rendered working tab
      expect(screen.queryByTestId("dashboard-error-boundary-fallback")).toBeNull();
      expect(screen.getByTestId("tab-content").textContent).toBe(
        "Displaying content for working-tab"
      );

      consoleSpy.mockRestore();
    });

    it("toggles collapsible diagnostic trace visibility", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      function ExplodingWithDiagnostics(): React.ReactNode {
        throw new Error("SpecificDiagnosticFailureCode_XYZ999");
      }

      render(
        <DashboardErrorBoundary sectionTitle="Diagnostics Test">
          <ExplodingWithDiagnostics />
        </DashboardErrorBoundary>
      );

      // Initially diagnostic info is hidden
      expect(screen.queryByText(/SpecificDiagnosticFailureCode_XYZ999/)).toBeNull();

      const toggleBtn = screen.getByRole("button", { name: /Show Diagnostic Info/i });
      fireEvent.click(toggleBtn);

      // Diagnostic info is now visible
      expect(screen.getByText(/SpecificDiagnosticFailureCode_XYZ999/)).toBeDefined();
      expect(screen.getByText(/Hide Diagnostic Info/i)).toBeDefined();

      // Toggle back to hidden
      fireEvent.click(screen.getByRole("button", { name: /Hide Diagnostic Info/i }));
      expect(screen.queryByText(/SpecificDiagnosticFailureCode_XYZ999/)).toBeNull();

      consoleSpy.mockRestore();
    });

    it("triggers optional onError and onReset lifecycle callbacks accurately", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const onErrorMock = vi.fn();
      const onResetMock = vi.fn();

      function FailOnce(): React.ReactNode {
        throw new Error("Trigger callbacks");
      }

      render(
        <DashboardErrorBoundary
          sectionTitle="Callback Testing"
          onError={onErrorMock}
          onReset={onResetMock}
        >
          <FailOnce />
        </DashboardErrorBoundary>
      );

      expect(onErrorMock).toHaveBeenCalledTimes(1);
      expect(onErrorMock.mock.calls[0][0].message).toBe("Trigger callbacks");
      expect(onErrorMock.mock.calls[0][1]).toHaveProperty("componentStack");

      const reloadBtn = screen.getByRole("button", { name: /↻ Reload Section/i });
      fireEvent.click(reloadBtn);

      expect(onResetMock).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
    });

    it("survives thrown exceptions inside its own onError callback without crashing the boundary", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      function FailForExplodingCallback(): React.ReactNode {
        throw new Error("Trigger crashing logger");
      }

      render(
        <DashboardErrorBoundary
          sectionTitle="Crashing Callback Test"
          onError={() => {
            throw new Error("Telemetry service logger crashed!");
          }}
        >
          <FailForExplodingCallback />
        </DashboardErrorBoundary>
      );

      // Fault card must still render cleanly
      expect(screen.getByTestId("dashboard-error-boundary-fallback")).toBeDefined();
      expect(screen.getByText("Crashing Callback Test Temporarily Unavailable")).toBeDefined();

      consoleSpy.mockRestore();
    });

    it("renders all visual variants (card, table, inline, full-tab) without throwing", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      function Boom(): React.ReactNode {
        throw new Error("Visual variant boom");
      }

      const variants: Array<"card" | "table" | "inline" | "full-tab"> = [
        "card",
        "table",
        "inline",
        "full-tab",
      ];

      for (const variant of variants) {
        const { unmount } = render(
          <DashboardErrorBoundary sectionTitle={`Variant ${variant}`} variant={variant}>
            <Boom />
          </DashboardErrorBoundary>
        );

        expect(screen.getByTestId("dashboard-error-boundary-fallback")).toBeDefined();
        expect(screen.getByText(`Variant ${variant} Temporarily Unavailable`)).toBeDefined();
        unmount();
      }

      consoleSpy.mockRestore();
    });
  });

  // =========================================================================
  // SECTION 5: Domain Mutators & Banner Lifecycle Adversarial Tests
  // =========================================================================
  describe("5. Domain Mutator Invariants & Feedback Lifecycle", () => {
    let capturedWs!: WorkspaceContextType;

    function MutatorHarness({ onCapture }: { onCapture: (ws: WorkspaceContextType) => void }) {
      const ws = useWorkspace();
      onCapture(ws);
      return (
        <div>
          <span data-testid="clients-count">{ws.clients.length}</span>
          <span data-testid="tasks-count">{ws.tasks.length}</span>
          <span data-testid="alert-type">{ws.bannerAlert?.type || "none"}</span>
          <span data-testid="alert-msg">{ws.bannerAlert?.message || "none"}</span>
        </div>
      );
    }

    it("handleDeleteClient gracefully sets critical bannerAlert on API deletion rejection without wiping state", async () => {
      vi.spyOn(api, "checkBackendHealth").mockResolvedValue(true);
      vi.spyOn(api, "getClients").mockResolvedValue({ data: [] } as any);
      vi.spyOn(api, "deleteClient").mockRejectedValue(
        new Error("403 Forbidden: Insufficient tenant deletion privileges")
      );

      const testUser: UserContext = {
        id: "usr-admin-mutator",
        email: "admin@test.com",
        full_name: "Admin User",
        role: "master_admin",
        organization_id: "org-1",
        organization_name: "Test Firm",
        experience: "master_admin",
        permissions: ["all"],
      };

      render(
        <WorkspaceProvider initialUser={testUser}>
          <MutatorHarness onCapture={(ws) => (capturedWs = ws)} />
        </WorkspaceProvider>
      );

      // Wait for initial mount effect to settle
      await waitFor(() => {
        expect(capturedWs.isLoading).toBe(false);
      });

      // Add a client first
      act(() => {
        capturedWs.handleClientCreated({
          id: "cli-99",
          first_name: "Anita",
          last_name: "Sharma",
          email: "anita@example.com",
          phone: "+1-555-0199",
          nationality: "India",
          organization_id: "org-1",
          portal_access_enabled: true,
          created_at: new Date().toISOString(),
        } as any);
      });

      expect(capturedWs.clients.length).toBe(1);

      // Attempt to delete client with rejecting backend
      await act(async () => {
        await capturedWs.handleDeleteClient("cli-99");
      });

      // Client profile was NOT deleted due to failure, critical alert raised
      expect(capturedWs.clients.length).toBe(1);
      expect(capturedWs.bannerAlert?.type).toBe("critical");
      expect(capturedWs.bannerAlert?.message).toContain("403 Forbidden");
    });

    it("handleResolveFinding and handleDismissFinding gracefully fallback when finding is missing from cache", async () => {
      const resolveSpy = vi.spyOn(api, "resolveFinding").mockResolvedValue({} as any);
      const dismissSpy = vi.spyOn(api, "dismissFinding").mockResolvedValue({} as any);

      render(
        <WorkspaceProvider>
          <MutatorHarness onCapture={(ws) => (capturedWs = ws)} />
        </WorkspaceProvider>
      );

      await act(async () => {
        await capturedWs.handleResolveFinding("non-existent-finding-id", "Valid note");
      });

      expect(resolveSpy).toHaveBeenCalledWith("case-01", "non-existent-finding-id", "Valid note");
      expect(capturedWs.bannerAlert?.type).toBe("success");

      await act(async () => {
        await capturedWs.handleDismissFinding("non-existent-finding-id", "false_positive", "Dismiss note");
      });

      expect(dismissSpy).toHaveBeenCalledWith(
        "case-01",
        "non-existent-finding-id",
        "false_positive",
        "Dismiss note"
      );
      expect(capturedWs.bannerAlert?.type).toBe("info");
    });

    it("handleResetToScratch completely empties collections and provisions Day 0 audit & notification logs", () => {
      render(
        <WorkspaceProvider>
          <MutatorHarness onCapture={(ws) => (capturedWs = ws)} />
        </WorkspaceProvider>
      );

      // Populate dummy data
      act(() => {
        capturedWs.handleClientCreated({
          id: "cli-temp",
          first_name: "Temp",
          last_name: "Client",
          email: "temp@client.org",
          phone: "000",
          nationality: "CA",
          organization_id: "org-1",
          portal_access_enabled: false,
          created_at: new Date().toISOString(),
        } as any);
      });

      expect(capturedWs.clients.length).toBe(1);

      // Reset to scratch
      act(() => {
        capturedWs.handleResetToScratch();
      });

      expect(capturedWs.cases.length).toBe(0);
      expect(capturedWs.clients.length).toBe(0);
      expect(capturedWs.documents.length).toBe(0);
      expect(capturedWs.tasks.length).toBe(0);
      expect(capturedWs.aiFindings.length).toBe(0);
      expect(capturedWs.auditEvents.length).toBe(1);
      expect(capturedWs.auditEvents[0].action).toBe("workspace.initialized");
      expect(capturedWs.notifications.length).toBe(1);
      expect(capturedWs.notifications[0].title).toBe("Initial Setup Ready");
      expect(capturedWs.bannerAlert?.message).toContain("Day 0 clean slate");
    });

    it("auto-dismisses transient banner alerts after 4000ms timeout", () => {
      vi.useFakeTimers();

      render(
        <WorkspaceProvider>
          <MutatorHarness onCapture={(ws) => (capturedWs = ws)} />
        </WorkspaceProvider>
      );

      act(() => {
        capturedWs.setBannerAlert({
          type: "info",
          message: "Transient notification test",
        });
      });

      expect(capturedWs.bannerAlert?.message).toBe("Transient notification test");

      // Advance timers by 3999ms - alert must still exist
      act(() => {
        vi.advanceTimersByTime(3999);
      });
      expect(capturedWs.bannerAlert?.message).toBe("Transient notification test");

      // Advance by remaining 1ms (total 4000ms) - alert must be dismissed
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(capturedWs.bannerAlert).toBeNull();

      vi.useRealTimers();
    });
  });
});
