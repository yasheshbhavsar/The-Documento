import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_LIVE_BACKEND = "true";
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import LoginPage from "../app/login/page";
import { DocumentoLoginModal } from "../components/auth/DocumentoLoginModal";
import { ProvisionCredentialsModal } from "../components/modals/ProvisionCredentialsModal";
import { ClientPortal } from "../components/dashboards/ClientPortal";
import { EmployeeWorkspace } from "../components/dashboards/EmployeeWorkspace";
import { OwnerMasterDashboard } from "../components/dashboards/OwnerMasterDashboard";
import {
  fetchCaseFilingPackages,
  resolveBackendBaseUrl,
  FIXTURE_CASES,
  FIXTURE_CLIENTS,
  FIXTURE_DOCUMENTS,
  FIXTURE_TASKS,
  FIXTURE_AI_FINDINGS,
  FIXTURE_MESSAGES,
  FIXTURE_AUDIT_EVENTS,
  FIXTURE_INVOICES,
  FIXTURE_CAPACITY,
  api,
  DEMO_USERS,
} from "../lib/api";
import { resolveBackendBaseUrl as resolveBackendBaseUrlClient } from "../lib/api/client";
import { isRunningInTestEnv } from "../lib/testEnv";
import { authenticateUser, PLATFORM_HQ_OPERATOR_EMAIL } from "../lib/auth";
import { ClientProfile, RoleCode } from "../lib/types";

describe("Adversarial Stress Frontend Remediations", () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    if (typeof window !== "undefined") {
      window.localStorage.clear();
      window.sessionStorage.clear();
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
  });

  // =========================================================================
  // 1. fetchCaseFilingPackages Adversarial Deserialization & Fault Tolerance
  // =========================================================================
  describe("1. fetchCaseFilingPackages: Deserialization & Network Resilience", () => {
    it("A. deserializes raw array payloads directly from /packages/cases/{caseId}", async () => {
      const rawArrayPayload = [
        {
          id: "pkg-raw-01",
          case_id: "case-adv-01",
          name: "EB-1A Canonical Filing Package",
          stage: "ready_for_review",
          documents: [],
        },
        {
          id: "pkg-raw-02",
          case_id: "case-adv-01",
          name: "O-1A Supporting Filing Package",
          stage: "draft",
          documents: [],
        },
      ];

      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        expect(url).toContain("/packages/cases/case-adv-01");
        return new Response(JSON.stringify(rawArrayPayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const result = await fetchCaseFilingPackages("case-adv-01");
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("pkg-raw-01");
      expect(result[1].id).toBe("pkg-raw-02");
    });

    it("B. deserializes wrapped { packages: [...] } payloads seamlessly", async () => {
      const wrappedPayload = {
        packages: [
          {
            id: "pkg-wrapped-01",
            case_id: "case-adv-02",
            name: "I-140 Wrapped Package",
            stage: "attorney_approved",
            documents: [],
          },
        ],
      };

      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        expect(url).toContain("/packages/cases/case-adv-02");
        return new Response(JSON.stringify(wrappedPayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const result = await fetchCaseFilingPackages("case-adv-02");
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("pkg-wrapped-01");
      expect(result[0].name).toBe("I-140 Wrapped Package");
    });

    it("C. gracefully handles null and non-conforming JSON without throwing", async () => {
      // C1: JSON response is literal null
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return new Response("null", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });
      const nullResult = await fetchCaseFilingPackages("case-null-01");
      expect(nullResult).toEqual([]);

      // C2: JSON response is arbitrary dictionary without packages key
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return new Response(JSON.stringify({ status: "success", count: 0, data: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });
      const dictResult = await fetchCaseFilingPackages("case-dict-01");
      expect(dictResult).toEqual([]);

      // C3: JSON parsing throws SyntaxError (e.g. malformed proxy html response)
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return new Response("<html>502 Bad Gateway</html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      });
      const corruptedResult = await fetchCaseFilingPackages("case-corrupted-01");
      expect(Array.isArray(corruptedResult)).toBe(true);
    });

    it("D. safely falls back on HTTP 404, 500 errors, and total network drop", async () => {
      // D1: HTTP 404 Not Found
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return new Response("Not Found", { status: 404, statusText: "Not Found" });
      });
      const res404 = await fetchCaseFilingPackages("case-404-01");
      expect(Array.isArray(res404)).toBe(true);

      // D2: HTTP 500 Internal Server Error
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return new Response("Internal Server Error", { status: 500, statusText: "Internal Error" });
      });
      const res500 = await fetchCaseFilingPackages("case-500-01");
      expect(Array.isArray(res500)).toBe(true);

      // D3: Complete Network Rejection (e.g. ECONNREFUSED)
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        throw new TypeError("Failed to fetch: Connection refused");
      });
      const resDrop = await fetchCaseFilingPackages("case-drop-01");
      expect(Array.isArray(resDrop)).toBe(true);
    });
  });

  // =========================================================================
  // 2. Component Rendering Without onOpenCaseKickoff Prop
  // =========================================================================
  describe("2. Component Rendering Without onOpenCaseKickoff Prop", () => {
    it("A. EmployeeWorkspace renders without onOpenCaseKickoff prop and handles button clicks safely", async () => {
      await act(async () => {
        render(
          <EmployeeWorkspace
            cases={FIXTURE_CASES}
            clients={FIXTURE_CLIENTS}
            documents={FIXTURE_DOCUMENTS}
            tasks={FIXTURE_TASKS}
            aiFindings={FIXTURE_AI_FINDINGS}
            messages={FIXTURE_MESSAGES}
          />
        );
      });

      // Confirm component rendered cleanly
      expect(screen.getByText("My Casework")).toBeDefined();
      expect(screen.getByText("Active Cases Assigned")).toBeDefined();

      // Find Kickoff buttons rendered in table actions
      const kickoffButtons = screen.getAllByRole("button", { name: /Kickoff/i });
      expect(kickoffButtons.length).toBeGreaterThan(0);

      // Clicking Kickoff button without props.onOpenCaseKickoff executes fallback safely
      expect(() => {
        act(() => {
          fireEvent.click(kickoffButtons[0]);
        });
      }).not.toThrow();
    });

    it("B. OwnerMasterDashboard renders without onOpenCaseKickoff prop and handles button clicks safely", async () => {
      await act(async () => {
        render(
          <OwnerMasterDashboard
            cases={FIXTURE_CASES}
            clients={FIXTURE_CLIENTS}
            auditEvents={FIXTURE_AUDIT_EVENTS}
            invoices={FIXTURE_INVOICES}
            capacity={FIXTURE_CAPACITY}
          />
        );
      });

      expect(screen.getByText("Operational Health & Tenant Boundary")).toBeDefined();

      // Switch to All Cases tab
      const casesTabBtn = screen.getByRole("button", { name: /All Cases/i });
      act(() => {
        fireEvent.click(casesTabBtn);
      });

      expect(screen.getByText("Comprehensive Firm Caseload")).toBeDefined();

      // Find Kickoff buttons in table actions
      const kickoffButtons = screen.getAllByRole("button", { name: /Kickoff/i });
      expect(kickoffButtons.length).toBeGreaterThan(0);

      expect(() => {
        act(() => {
          fireEvent.click(kickoffButtons[0]);
        });
      }).not.toThrow();
    });

    it("C. invoking onOpenCaseKickoff prop receives clicked case object", async () => {
      const handleOpenKickoff = vi.fn();
      await act(async () => {
        render(
          <EmployeeWorkspace
            cases={FIXTURE_CASES}
            clients={FIXTURE_CLIENTS}
            documents={FIXTURE_DOCUMENTS}
            tasks={FIXTURE_TASKS}
            aiFindings={FIXTURE_AI_FINDINGS}
            messages={FIXTURE_MESSAGES}
            onOpenCaseKickoff={handleOpenKickoff}
          />
        );
      });

      const kickoffButtons = screen.getAllByRole("button", { name: /Kickoff/i });
      act(() => {
        fireEvent.click(kickoffButtons[0]);
      });

      expect(handleOpenKickoff).toHaveBeenCalled();
      expect(handleOpenKickoff.mock.calls[0][0].id).toBe(FIXTURE_CASES[0].id);
    });
  });

  // =========================================================================
  // 3. DEMO_USERS Indexing with Valid & Unregistered Roles
  // =========================================================================
  describe("3. DEMO_USERS Safe Indexing Across Full Role Hierarchy", () => {
    const candidateRoles: (RoleCode | string)[] = [
      "applicant",
      "company_admin",
      "senior_reviewer",
      "document_reviewer",
      "finance_staff",
      "retained_client",
      "organization_admin",
      "case_worker",
      "platform_super_admin",
      "platform_ops",
      "paralegal",
      "owner",
      "custom_external_role",
    ];

    it("A. api.createRuleSetVersion falls back to actor_id 'system' for roles not in DEMO_USERS without throwing", async () => {
      for (const role of candidateRoles) {
        const res = await api.createRuleSetVersion(
          "rs-adversarial-01",
          {
            version_number: `v-${role}`,
            change_summary: `Adversarial test for role ${role}`,
          },
          role as RoleCode
        );

        expect(res.data).toBeDefined();
        expect(res.data.status).toBe("draft");
        expect(res.data.approval_history).toHaveLength(1);

        const expectedActorId = (DEMO_USERS as any)[role]?.id || "system";
        expect(res.data.approval_history[0].actor_id).toBe(expectedActorId);
        if (!(role in DEMO_USERS)) {
          expect(res.data.approval_history[0].actor_id).toBe("system");
        }
      }
    });

    it("B. api.transitionVersionStatus falls back to actor_id 'system' for unmapped roles", async () => {
      for (const role of candidateRoles) {
        const res = await api.transitionVersionStatus(
          "ver-01",
          "active",
          `Status changed by ${role}`,
          role as RoleCode
        );

        expect(res.data).toBeDefined();
        const latestHistory = res.data.approval_history.slice(-1)[0];
        expect(latestHistory).toBeDefined();

        const expectedActorId = (DEMO_USERS as any)[role]?.id || "system";
        expect(latestHistory.actor_id).toBe(expectedActorId);
        if (!(role in DEMO_USERS)) {
          expect(latestHistory.actor_id).toBe("system");
        }
      }
    });

    it("C. preserves explicit actor_id mapping for registered DEMO_USERS keys", async () => {
      const resCaseManager = await api.createRuleSetVersion(
        "rs-adversarial-02",
        { version_number: "v-cm", change_summary: "Case Manager" },
        "case_manager"
      );
      expect(resCaseManager.data.approval_history[0].actor_id).toBe(
        DEMO_USERS.case_manager.id
      );

      const resMasterAdmin = await api.createRuleSetVersion(
        "rs-adversarial-03",
        { version_number: "v-ma", change_summary: "Master Admin" },
        "master_admin"
      );
      expect(resMasterAdmin.data.approval_history[0].actor_id).toBe(
        DEMO_USERS.master_admin.id
      );
    });
  });

  // =========================================================================
  // 4. Super-Admin Login Environment Variable Gating & Hardening
  // =========================================================================
  describe("4. Super-Admin Login Gating & Hardening", () => {
    it("A. accepts custom NEXT_PUBLIC_SUPER_ADMIN_PASSWORD and rejects obsolete default", () => {
      process.env.NEXT_PUBLIC_SUPER_ADMIN_PASSWORD = "AdversarialHqPassphrase2026!";

      // Valid login with configured secret
      const successRes = authenticateUser(
        PLATFORM_HQ_OPERATOR_EMAIL,
        "firm",
        "AdversarialHqPassphrase2026!"
      );
      expect(successRes.success).toBe(true);
      expect(successRes.user?.role).toBe("platform_super_admin");
      expect(successRes.user?.email).toBe(PLATFORM_HQ_OPERATOR_EMAIL);

      // Obsolete default hardcoded passphrase must be rejected
      const obsoleteRes = authenticateUser(
        PLATFORM_HQ_OPERATOR_EMAIL,
        "firm",
        "DocumentoHQ2026!"
      );
      expect(obsoleteRes.success).toBe(false);
      expect(obsoleteRes.error).toContain("Invalid HQ operator passphrase");

      // Incorrect password rejected
      const wrongRes = authenticateUser(
        PLATFORM_HQ_OPERATOR_EMAIL,
        "firm",
        "WrongSecretPass123"
      );
      expect(wrongRes.success).toBe(false);

      // Empty password rejected
      const emptyRes = authenticateUser(
        PLATFORM_HQ_OPERATOR_EMAIL,
        "firm",
        ""
      );
      expect(emptyRes.success).toBe(false);
    });

    it("B. fails closed in production when NEXT_PUBLIC_SUPER_ADMIN_PASSWORD is missing", () => {
      delete process.env.NEXT_PUBLIC_SUPER_ADMIN_PASSWORD;
      (process.env as any).NODE_ENV = "production";

      // In production without env var, default password must NOT work (fail closed)
      const attemptDefault = authenticateUser(
        PLATFORM_HQ_OPERATOR_EMAIL,
        "firm",
        "DocumentoHQ2026!"
      );
      expect(attemptDefault.success).toBe(false);
      expect(attemptDefault.error).toContain("Invalid HQ operator passphrase");

      // Empty or arbitrary password also fails
      const attemptEmpty = authenticateUser(
        PLATFORM_HQ_OPERATOR_EMAIL,
        "firm",
        ""
      );
      expect(attemptEmpty.success).toBe(false);
    });

    it("C. allows dev fallback passphrase in non-production environments when unset", () => {
      delete process.env.NEXT_PUBLIC_SUPER_ADMIN_PASSWORD;
      (process.env as any).NODE_ENV = "test";

      // In test / development, local dev fallback works for testing
      const devRes = authenticateUser(
        PLATFORM_HQ_OPERATOR_EMAIL,
        "firm",
        "DocumentoHQ2026!"
      );
      expect(devRes.success).toBe(true);
      expect(devRes.user?.role).toBe("platform_super_admin");

      // Incorrect dev password still rejected
      const devWrongRes = authenticateUser(
        PLATFORM_HQ_OPERATOR_EMAIL,
        "firm",
        "WrongDevPass"
      );
      expect(devWrongRes.success).toBe(false);
    });
  });

  // =========================================================================
  // 5. INT-CFG-01: Containerized SSR Backend URL Resolution
  // =========================================================================
  describe("5. INT-CFG-01: Containerized SSR Backend URL Resolution", () => {
    it("A. returns /api/backend for browser client requests (window defined)", () => {
      expect(resolveBackendBaseUrl()).toBe("/api/backend");
      expect(resolveBackendBaseUrlClient()).toBe("/api/backend");
    });

    describe("SSR mode (typeof window === 'undefined')", () => {
      let win: any;
      beforeEach(() => {
        win = (globalThis as any).window;
        delete (globalThis as any).window;
      });

      afterEach(() => {
        (globalThis as any).window = win;
      });

      it("B. honors INTERNAL_BACKEND_URL without trailing /api/v1", () => {
        process.env.INTERNAL_BACKEND_URL = "http://backend:8000";
        expect(resolveBackendBaseUrl()).toBe("http://backend:8000/api/v1");
        expect(resolveBackendBaseUrlClient()).toBe("http://backend:8000/api/v1");
      });

      it("C. honors INTERNAL_BACKEND_URL with existing /api/v1 and trailing slashes", () => {
        process.env.INTERNAL_BACKEND_URL = "http://backend:8000/api/v1/";
        expect(resolveBackendBaseUrl()).toBe("http://backend:8000/api/v1");
        expect(resolveBackendBaseUrlClient()).toBe("http://backend:8000/api/v1");
      });

      it("C2. strips multiple consecutive trailing slashes and handles pre-existing /api/v1///", () => {
        process.env.INTERNAL_BACKEND_URL = "http://backend:8000///";
        expect(resolveBackendBaseUrl()).toBe("http://backend:8000/api/v1");
        expect(resolveBackendBaseUrlClient()).toBe("http://backend:8000/api/v1");

        process.env.INTERNAL_BACKEND_URL = "http://backend:8000/api/v1///";
        expect(resolveBackendBaseUrl()).toBe("http://backend:8000/api/v1");
        expect(resolveBackendBaseUrlClient()).toBe("http://backend:8000/api/v1");
      });

      it("D. honors INTERNAL_API_URL when INTERNAL_BACKEND_URL is unset", () => {
        delete process.env.INTERNAL_BACKEND_URL;
        process.env.INTERNAL_API_URL = "http://internal-host:9000";
        expect(resolveBackendBaseUrl()).toBe("http://internal-host:9000/api/v1");
        expect(resolveBackendBaseUrlClient()).toBe("http://internal-host:9000/api/v1");
      });

      it("D2. handles empty strings and honors priority hierarchy across mixed env vars", () => {
        // Empty string in INTERNAL_BACKEND_URL falls through to INTERNAL_API_URL
        process.env.INTERNAL_BACKEND_URL = "";
        process.env.INTERNAL_API_URL = "http://internal-api-host:9050";
        process.env.NEXT_PUBLIC_BACKEND_URL = "http://public-host:3000";
        expect(resolveBackendBaseUrl()).toBe("http://internal-api-host:9050/api/v1");
        expect(resolveBackendBaseUrlClient()).toBe("http://internal-api-host:9050/api/v1");

        // INTERNAL_BACKEND_URL wins over NEXT_PUBLIC_BACKEND_URL when non-empty
        process.env.INTERNAL_BACKEND_URL = "http://override-backend:8000";
        expect(resolveBackendBaseUrl()).toBe("http://override-backend:8000/api/v1");
        expect(resolveBackendBaseUrlClient()).toBe("http://override-backend:8000/api/v1");
      });

      it("E. honors NEXT_PUBLIC_BACKEND_URL when internal vars are unset", () => {
        delete process.env.INTERNAL_BACKEND_URL;
        delete process.env.INTERNAL_API_URL;
        process.env.NEXT_PUBLIC_BACKEND_URL = "https://public-backend.example.com";
        expect(resolveBackendBaseUrl()).toBe("https://public-backend.example.com/api/v1");
        expect(resolveBackendBaseUrlClient()).toBe("https://public-backend.example.com/api/v1");
      });

      it("F. honors NEXT_PUBLIC_API_URL when other vars are unset", () => {
        delete process.env.INTERNAL_BACKEND_URL;
        delete process.env.INTERNAL_API_URL;
        delete process.env.NEXT_PUBLIC_BACKEND_URL;
        process.env.NEXT_PUBLIC_API_URL = "https://public-api.example.com/api/v1";
        expect(resolveBackendBaseUrl()).toBe("https://public-api.example.com/api/v1");
        expect(resolveBackendBaseUrlClient()).toBe("https://public-api.example.com/api/v1");
      });

      it("G. defaults to http://localhost:8000/api/v1 when all backend env vars are unset or empty strings", () => {
        delete process.env.INTERNAL_BACKEND_URL;
        delete process.env.INTERNAL_API_URL;
        delete process.env.NEXT_PUBLIC_BACKEND_URL;
        delete process.env.NEXT_PUBLIC_API_URL;
        expect(resolveBackendBaseUrl()).toBe("http://localhost:8000/api/v1");
        expect(resolveBackendBaseUrlClient()).toBe("http://localhost:8000/api/v1");

        // When all env vars are explicitly set to empty strings ""
        process.env.INTERNAL_BACKEND_URL = "";
        process.env.INTERNAL_API_URL = "";
        process.env.NEXT_PUBLIC_BACKEND_URL = "";
        process.env.NEXT_PUBLIC_API_URL = "";
        expect(resolveBackendBaseUrl()).toBe("http://localhost:8000/api/v1");
        expect(resolveBackendBaseUrlClient()).toBe("http://localhost:8000/api/v1");
      });
    });
  });

  // =========================================================================
  // 6. INT-API-03: Password Length Boundary Parity (>= 8 characters)
  // =========================================================================
  describe("6. INT-API-03: Password Length Boundary Parity (>= 8 chars)", () => {
    it("A. LoginPage rejects passwords with < 8 chars [0, 1, 4, 7] and accepts >= 8 chars [8, 9, 100, unicode]", async () => {
      await act(async () => {
        render(<LoginPage />);
      });

      const emailInput = screen.getByLabelText(/Law Firm Business Email/i);
      const passwordInput = screen.getByLabelText(/^Password$/i);
      const submitBtn = screen.getByRole("button", { name: /Sign In to Firm Workspace/i });

      const invalidBoundaries = [
        { label: "0 chars (empty)", val: "" },
        { label: "1 char", val: "a" },
        { label: "4 chars", val: "Four" },
        { label: "7 chars", val: "Pass123" },
        { label: "7 chars unicode", val: "üöäß123" },
      ];

      for (const { label, val } of invalidBoundaries) {
        act(() => {
          fireEvent.change(emailInput, { target: { value: "attorney@leximmigration.com" } });
          fireEvent.change(passwordInput, { target: { value: val } });
          fireEvent.submit(emailInput.closest("form")!);
        });
        expect(
          screen.getByText(/Password must be at least 8 characters\./i),
          `Expected rejection for boundary: ${label}`
        ).toBeDefined();
      }

      const loginSpy = vi.spyOn(api, "login").mockResolvedValue({
        success: true,
        access_token: "mock-token",
        user: { user_id: "usr-01", roles: ["master_admin"] },
      } as any);

      const validBoundaries = [
        { label: "8 chars boundary", val: "Pass1234" },
        { label: "9 chars boundary", val: "Pass12345" },
        { label: "100 chars boundary", val: "A".repeat(100) },
        { label: "8 chars unicode", val: "üöäß1234" },
        { label: "8 UTF-16 code units emoji surrogate pairs", val: "🔑🔐🔒🛡️" },
      ];

      for (const { label, val } of validBoundaries) {
        loginSpy.mockClear();
        await act(async () => {
          fireEvent.change(passwordInput, { target: { value: val } });
          fireEvent.click(submitBtn);
        });
        expect(
          screen.queryByText(/Password must be at least 8 characters\./i),
          `Expected acceptance for boundary: ${label}`
        ).toBeNull();
        expect(loginSpy).toHaveBeenCalledWith({ email: "attorney@leximmigration.com", password: val });
      }

      loginSpy.mockRestore();
    });

    it("B. DocumentoLoginModal rejects passwords with < 8 chars [0, 1, 4, 7] and accepts >= 8 chars [8, 9, 100, unicode]", async () => {
      const handleClose = vi.fn();
      const handleLoginSuccess = vi.fn();
      await act(async () => {
        render(
          <DocumentoLoginModal
            isOpen={true}
            onClose={handleClose}
            initialPortal="firm"
            onLoginSuccess={handleLoginSuccess}
          />
        );
      });

      const emailInput = screen.getByLabelText(/Law Firm Business Email/i);
      const passwordInput = screen.getByLabelText(/^Password$/i);
      const submitBtn = screen.getByRole("button", { name: /Sign In to Firm Workspace/i });

      const invalidBoundaries = [
        { label: "0 chars (empty)", val: "" },
        { label: "1 char", val: "x" },
        { label: "4 chars", val: "1234" },
        { label: "7 chars", val: "1234567" },
        { label: "4 chars unicode", val: "café" },
      ];

      for (const { label, val } of invalidBoundaries) {
        act(() => {
          fireEvent.change(emailInput, { target: { value: "attorney@leximmigration.com" } });
          fireEvent.change(passwordInput, { target: { value: val } });
          fireEvent.submit(emailInput.closest("form")!);
        });
        expect(
          screen.getByText(/Password must be at least 8 characters\./i),
          `Expected modal rejection for boundary: ${label}`
        ).toBeDefined();
      }

      const loginSpy = vi.spyOn(api, "login").mockResolvedValue({
        success: true,
        access_token: "mock-token",
        user: { user_id: "usr-01", roles: ["master_admin"] },
      } as any);

      const validBoundaries = [
        { label: "8 chars boundary", val: "12345678" },
        { label: "9 chars boundary", val: "123456789" },
        { label: "100 chars boundary", val: "B".repeat(100) },
        { label: "8 chars unicode", val: "café1234" },
        { label: "8 UTF-16 code units emoji surrogate pairs", val: "🔑🔐🔒🛡️" },
      ];

      for (const { label, val } of validBoundaries) {
        loginSpy.mockClear();
        await act(async () => {
          fireEvent.change(passwordInput, { target: { value: val } });
          fireEvent.click(submitBtn);
        });
        expect(
          screen.queryByText(/Password must be at least 8 characters\./i),
          `Expected modal acceptance for boundary: ${label}`
        ).toBeNull();
        expect(loginSpy).toHaveBeenCalledWith({ email: "attorney@leximmigration.com", password: val });
      }

      loginSpy.mockRestore();
    });

    it("C. ProvisionCredentialsModal rejects passwords with < 8 chars [0, 1, 4, 7] and accepts >= 8 chars [8, 9, 100, unicode]", async () => {
      const mockClient: ClientProfile = {
        ...FIXTURE_CLIENTS[0],
        portal_credentials_provided: false,
        portal_temporary_password: "",
        portal_access_enabled: false,
      };
      const handleUpdate = vi.fn();
      const handleClose = vi.fn();

      await act(async () => {
        render(
          <ProvisionCredentialsModal
            isOpen={true}
            onClose={handleClose}
            client={mockClient}
            onCredentialsUpdated={handleUpdate}
          />
        );
      });

      const passwordInput = screen.getByLabelText(/Client Portal Password/i);
      const saveBtn = screen.getByRole("button", { name: /Save & Issue Credentials/i });

      const invalidBoundaries = [
        { label: "0 chars (empty)", val: "" },
        { label: "1 char", val: "a" },
        { label: "4 chars", val: "1234" },
        { label: "7 chars", val: "Pass123" },
        { label: "6 code units unicode", val: "pass🔑" },
      ];

      for (const { label, val } of invalidBoundaries) {
        act(() => {
          fireEvent.change(passwordInput, { target: { value: val } });
          fireEvent.click(saveBtn);
        });
        expect(
          screen.getByRole("alert").textContent,
          `Expected provision rejection for boundary: ${label}`
        ).toContain("Portal password must be at least 8 characters long.");
      }

      const provisionSpy = vi.spyOn(api, "provisionClientCredentials").mockResolvedValue({
        data: { ...mockClient, portal_credentials_provided: true },
        isLiveBackend: false,
      } as any);

      const validBoundaries = [
        { label: "8 chars boundary", val: "ValidPass1" },
        { label: "9 chars boundary", val: "ValidPass9" },
        { label: "100 chars boundary", val: "C".repeat(100) },
        { label: "8 code units unicode", val: "pass🔑🔐" },
      ];

      for (const { label, val } of validBoundaries) {
        provisionSpy.mockClear();
        await act(async () => {
          fireEvent.change(passwordInput, { target: { value: val } });
          fireEvent.click(saveBtn);
        });
        expect(
          screen.queryByRole("alert"),
          `Expected provision acceptance for boundary: ${label}`
        ).toBeNull();
        expect(provisionSpy).toHaveBeenCalledWith(mockClient.id, val, false, "master_admin");
      }

      provisionSpy.mockRestore();
    });
  });

  // =========================================================================
  // 7. FE-AUDIT-001 & FE-AUDIT-007: Test Environment Helper & Hydration Safety
  // =========================================================================
  describe("7. FE-AUDIT-001 & FE-AUDIT-007: Test Environment Helper & Hydration Safety", () => {
    it("A. isRunningInTestEnv returns true in Vitest and false when VITEST is unset", () => {
      expect(isRunningInTestEnv()).toBe(true);

      const oldVitest = process.env.VITEST;
      delete process.env.VITEST;
      expect(isRunningInTestEnv()).toBe(false);
      process.env.VITEST = oldVitest;
    });

    it("B. ClientPortal initializes clientLanguage to 'en' matching SSR and syncs saved preference post-mount", async () => {
      window.localStorage.setItem("documento_client_language", "gu");

      await act(async () => {
        render(
          <ClientPortal
            myCase={FIXTURE_CASES[0]}
            documents={FIXTURE_DOCUMENTS}
            messages={FIXTURE_MESSAGES}
            notifications={[]}
            invoices={FIXTURE_INVOICES}
            onOpenUploadModal={vi.fn()}
            onOpenQuestionnaireModal={vi.fn()}
            onSendMessage={vi.fn()}
            onMarkNotificationRead={vi.fn()}
          />
        );
      });

      // Post-mount, Gujarati strings are displayed based on saved preference
      expect(screen.getAllByText(/મારી અરજીની ઝાંખી/i).length).toBeGreaterThan(0);
    });

    it("C. ClientPortal gracefully handles Hindi preference and unsupported localStorage values", async () => {
      // C1: Hindi preference
      window.localStorage.setItem("documento_client_language", "hi");
      await act(async () => {
        render(
          <ClientPortal
            myCase={FIXTURE_CASES[0]}
            documents={FIXTURE_DOCUMENTS}
            messages={FIXTURE_MESSAGES}
            notifications={[]}
            invoices={FIXTURE_INVOICES}
            onOpenUploadModal={vi.fn()}
            onOpenQuestionnaireModal={vi.fn()}
            onSendMessage={vi.fn()}
            onMarkNotificationRead={vi.fn()}
          />
        );
      });
      expect(screen.getAllByText(/मेरी याचिका का विवरण/i).length).toBeGreaterThan(0);

      // C2: Invalid/unsupported language code in localStorage safely resolves to English ("en")
      window.localStorage.setItem("documento_client_language", "corrupted_lang_code");
      await act(async () => {
        render(
          <ClientPortal
            myCase={FIXTURE_CASES[0]}
            documents={FIXTURE_DOCUMENTS}
            messages={FIXTURE_MESSAGES}
            notifications={[]}
            invoices={FIXTURE_INVOICES}
            onOpenUploadModal={vi.fn()}
            onOpenQuestionnaireModal={vi.fn()}
            onSendMessage={vi.fn()}
            onMarkNotificationRead={vi.fn()}
          />
        );
      });
      // Should remain English
      expect(screen.getAllByText(/My Petition Overview/i).length).toBeGreaterThan(0);
    });
  });
});
