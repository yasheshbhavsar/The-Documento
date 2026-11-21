import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

import {
  authenticateUser,
  getRoleScopedPermissions,
  resolveLiveBackendUserContext,
  setClientCredential,
  PLATFORM_HQ_OPERATOR_EMAIL,
} from "../lib/auth";
import { AuthForm } from "../components/auth/AuthForm";
import {
  api,
  setAccessToken,
  getAccessToken,
  getAuthHeaders,
  fetchEngagements,
  fetchDocumentRequests,
  createInvoice,
  recordInvoicePayment,
  deleteCaseAppointment,
  fetchClientIntakeSheet,
  saveClientIntakeSheet,
  NetworkError,
} from "../lib/api";
import {
  setAccessToken as setClientAccessToken,
  getAccessToken as getClientAccessToken,
  getAuthHeaders as getClientAuthHeaders,
} from "../lib/api/client";
import { WorkspaceProvider, useWorkspace } from "../lib/context/WorkspaceContext";
import {
  createSponsorInviteLink,
  recordSponsorContributionUpload,
  syncSponsorInvitesFromBackend,
  getSponsorInvitesForCase,
} from "../lib/sponsorContributorStore";
import {
  enqueueRawClientPacket,
  getOrReconstructRawPacketFile,
  loadRawPacketFileAsync,
  getRawPacketsForCase,
  clearRawPacketStoreInMemoryCache,
} from "../lib/rawClientPacketStore";
import {
  mapPacketToInitialInfoSheet,
  hydrateCanonicalForm,
} from "../lib/documentAutoFillEngine";
import {
  runSmartIntakePipeline,
  sortDocumentPacket,
} from "../lib/api/extractor";
import {
  submitAgencyOnboarding,
  syncSuperAdminPlatformFromBackend,
  getAgencyTenants,
  getAgencyApplications,
  adjudicateAgencyKybApplication,
} from "../lib/agencyPlatformStore";
import { UserContext } from "../lib/types";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

const originalNodeEnv = process.env.NODE_ENV;
const originalFetch = global.fetch;

function setNodeEnv(val: string | undefined) {
  (process.env as Record<string, string | undefined>).NODE_ENV = val;
}

describe("Workstream 4: Frontend Auth, Session, API Sync, Sponsor Upload & Persistence Hardening", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    clearRawPacketStoreInMemoryCache();
    setAccessToken(null);
    setNodeEnv("test");
    mockPush.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    setNodeEnv(originalNodeEnv);
    global.fetch = originalFetch;
    setAccessToken(null);
  });

  // ---------------------------------------------------------------------------
  // 1. Live-Backend Staff Role Mapping & AuthForm Anti-Escalation
  // ---------------------------------------------------------------------------
  describe("1. Live-backend staff role mapping & anti-escalation", () => {
    it("maps backend roles strictly without escalating unknown or staff users to master_admin / wildcard", () => {
      const superAdmin = resolveLiveBackendUserContext({
        email: "hq@documento.ai",
        portal: "firm",
        liveUser: { id: "u-1", roles: ["platform_super_admin"], full_name: "HQ Ops" },
      });
      expect(superAdmin.experience).toBe("platform_super_admin");
      expect(superAdmin.role).toBe("platform_super_admin");
      expect(superAdmin.permissions).toContain("platform:agencies:read");
      expect(superAdmin.permissions).not.toContain("*");

      const opsUser = resolveLiveBackendUserContext({
        email: "ops@documento.ai",
        portal: "firm",
        liveUser: { id: "u-2", roles: ["platform_ops"] },
      });
      expect(opsUser.experience).toBe("platform_super_admin");
      expect(opsUser.permissions).not.toContain("*");

      const firmOwner = resolveLiveBackendUserContext({
        email: "owner@firm.ca",
        portal: "firm",
        liveUser: { id: "u-3", roles: ["firm_owner"], organization_name: "Northstar Law" },
      });
      expect(firmOwner.experience).toBe("master_admin");
      expect(firmOwner.role).toBe("master_admin");
      expect(firmOwner.organization_name).toBe("Northstar Law");

      for (const staffRole of [
        "case_manager",
        "case_worker",
        "paralegal",
        "finance_staff",
        "rule_editor",
        "auditor",
      ]) {
        const mapped = resolveLiveBackendUserContext({
          email: `${staffRole}@firm.ca`,
          portal: "firm",
          liveUser: { id: `u-${staffRole}`, roles: [staffRole] },
        });
        expect(mapped.experience).toBe("case_manager");
        expect(mapped.permissions).toEqual(getRoleScopedPermissions(staffRole));
        expect(mapped.permissions).not.toContain("*");
        expect(mapped.role).not.toBe("master_admin");
      }

      const client = resolveLiveBackendUserContext({
        email: "client@example.com",
        portal: "client",
        liveUser: { id: "u-c1", roles: ["retained_client"] },
      });
      expect(client.experience).toBe("client_applicant");
      expect(client.role).toBe("retained_client");
      expect(client.permissions).not.toContain("*");

      // Unknown / empty role MUST default to least privilege, never master_admin or ["*"]
      const unknown = resolveLiveBackendUserContext({
        email: "fresh@firm.ca",
        portal: "firm",
        liveUser: { id: "u-unk", roles: [] },
      });
      expect(unknown.experience).toBe("case_manager");
      expect(unknown.role).toBe("case_worker");
      expect(unknown.permissions).toEqual(["cases:read", "documents:read"]);
      expect(unknown.permissions).not.toContain("*");
    });

    it("AuthForm derives role & scoped permissions from live api.login() on a fresh browser without escalating", async () => {
      vi.spyOn(api, "login").mockResolvedValueOnce({
        success: true,
        access_token: "live-jwt-paralegal",
        user: {
          user_id: "usr-para-99",
          email: "maya.para@apexlegal.ca",
          full_name: "Maya Patel",
          roles: ["paralegal"],
          organization_id: "org-apex-1",
          organization_name: "Apex Immigration LLP",
        },
      });

      const onLoginSuccess = vi.fn();
      render(<AuthForm initialPortal="firm" onLoginSuccess={onLoginSuccess} />);

      fireEvent.change(screen.getByTestId("login-email-input"), {
        target: { value: "maya.para@apexlegal.ca" },
      });
      fireEvent.change(screen.getByTestId("login-password-input"), {
        target: { value: "StrongPass2026!" },
      });

      fireEvent.click(screen.getByTestId("login-submit-btn"));

      await waitFor(() => expect(onLoginSuccess).toHaveBeenCalledTimes(1));
      const userArg: UserContext = onLoginSuccess.mock.calls[0][0];
      expect(userArg.role).toBe("case_worker");
      expect(userArg.experience).toBe("case_manager");
      expect(userArg.organization_name).toBe("Apex Immigration LLP");
      expect(userArg.permissions).not.toContain("*");
      expect(userArg.permissions).toEqual(getRoleScopedPermissions("paralegal"));
    });

    it("never stores plaintext client passwords in localStorage and blocks local fallback in production", () => {
      setClientCredential({
        email: "applicant@example.com",
        password: "SuperSecretPassword!99",
        client_name: "Priya Nair",
        client_id: "cli-001",
        organization_id: "org-1",
        organization_name: "Firm One",
        portal_access_enabled: true,
        provisioned_at: new Date().toISOString(),
        provisioned_by: "owner@firm.ca",
      });

      const rawStored = window.localStorage.getItem("documento_client_credentials") || "";
      expect(rawStored).not.toContain("SuperSecretPassword!99");
      const parsed = JSON.parse(rawStored);
      expect(parsed["applicant@example.com"].password).toBeUndefined();
      expect(parsed["applicant@example.com"].password_hash).toBeTruthy();

      // In dev/test, hashed password still verifies correctly
      const ok = authenticateUser("applicant@example.com", "client", "SuperSecretPassword!99");
      expect(ok.success).toBe(true);
      expect(authenticateUser("applicant@example.com", "client", "WrongPass").success).toBe(false);

      // In production, local fallback is blocked for HQ super admin and clients
      setNodeEnv("production");
      expect(
        authenticateUser(PLATFORM_HQ_OPERATOR_EMAIL, "firm", "DocumentoHQ2026!").success
      ).toBe(false);
      expect(
        authenticateUser("applicant@example.com", "client", "SuperSecretPassword!99").success
      ).toBe(false);

      setClientCredential({
        email: "prod.client@example.com",
        password: "ProdSecretPassword!88",
        client_name: "Prod Client",
        client_id: "cli-prod-1",
        organization_id: "org-1",
        organization_name: "Firm One",
        portal_access_enabled: true,
        provisioned_at: new Date().toISOString(),
        provisioned_by: "owner@firm.ca",
      });
      const prodStored = JSON.parse(
        window.localStorage.getItem("documento_client_credentials") || "{}"
      );
      expect(prodStored["prod.client@example.com"].password).toBeUndefined();
      expect(prodStored["prod.client@example.com"].password_hash).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Single Token Cache & WorkspaceContext Hardening
  // ---------------------------------------------------------------------------
  describe("2. Single token cache, clean logout & WorkspaceContext hardening", () => {
    it("shares a single access token state between lib/api.ts and lib/api/client.ts", () => {
      setAccessToken("tok-alpha-123");
      expect(getClientAccessToken()).toBe("tok-alpha-123");
      expect(getClientAuthHeaders().Authorization).toBe("Bearer tok-alpha-123");

      setClientAccessToken("tok-beta-456");
      expect(getAccessToken()).toBe("tok-beta-456");
      expect(getAuthHeaders().Authorization).toBe("Bearer tok-beta-456");

      setAccessToken(null);
      expect(getClientAccessToken()).toBeNull();
      expect(getAuthHeaders().Authorization).toBeUndefined();
    });

    it("clears token, fires api.logout(), and skips firm-only fetches for retained_client", async () => {
      const clientUser: UserContext = {
        id: "cli-user-1",
        email: "retained@example.com",
        full_name: "Alex",
        role: "retained_client",
        experience: "client_applicant",
        organization_id: "org-1",
        organization_name: "Firm One",
        permissions: ["portal:read"],
      };
      window.localStorage.setItem("documento_user", JSON.stringify(clientUser));
      setAccessToken("live-client-token");

      const getCasesSpy = vi.spyOn(api, "getCases").mockResolvedValue({ data: [], isLiveBackend: true });
      const getClientsSpy = vi.spyOn(api, "getClients").mockResolvedValue({ data: [], isLiveBackend: true });
      const getCapacitySpy = vi.spyOn(api, "getTeamCapacity").mockResolvedValue({ data: [], isLiveBackend: true });
      const getAuditSpy = vi.spyOn(api, "getAuditEvents").mockResolvedValue({ data: [], isLiveBackend: true });
      const getNotifsSpy = vi.spyOn(api, "getNotifications").mockResolvedValue({ data: [], isLiveBackend: true });
      const getTasksSpy = vi.spyOn(api, "getTasks").mockResolvedValue({ data: [], isLiveBackend: true });
      const getInvoicesSpy = vi.spyOn(api, "getInvoices").mockResolvedValue({ data: [], isLiveBackend: true });
      const logoutSpy = vi.spyOn(api, "logout").mockImplementation(async () => {
        setAccessToken(null);
      });

      let latestCtx: ReturnType<typeof useWorkspace> | null = null;
      function Probe() {
        latestCtx = useWorkspace();
        return <div data-testid="probe">{latestCtx.currentUser?.email || "none"}</div>;
      }

      render(
        <WorkspaceProvider>
          <Probe />
        </WorkspaceProvider>
      );

      await waitFor(() => expect(getCasesSpy).toHaveBeenCalled());
      expect(getNotifsSpy).toHaveBeenCalled();
      expect(getTasksSpy).toHaveBeenCalled();
      expect(getInvoicesSpy).toHaveBeenCalled();
      // Retained client MUST NOT call firm-only endpoints
      expect(getClientsSpy).not.toHaveBeenCalled();
      expect(getCapacitySpy).not.toHaveBeenCalled();
      expect(getAuditSpy).not.toHaveBeenCalled();

      // Trigger handleLogout()
      act(() => {
        latestCtx!.handleLogout();
      });

      await waitFor(() => expect(logoutSpy).toHaveBeenCalledTimes(1));
      expect(getAccessToken()).toBeNull();
      expect(window.localStorage.getItem("documento_user")).toBeNull();
    });

    it("handleDeleteClient matches strictly by client_id and handleToggleTask rolls back on failure", async () => {
      const adminUser: UserContext = {
        id: "usr-admin-1",
        email: "admin@firm.ca",
        full_name: "Partner Admin",
        role: "master_admin",
        experience: "master_admin",
        organization_id: "org-1",
        organization_name: "Firm One",
        permissions: ["*"],
      };
      window.localStorage.setItem("documento_user", JSON.stringify(adminUser));

      vi.spyOn(api, "getCases").mockResolvedValue({
        data: [
          {
            id: "case-alex",
            organization_id: "org-1",
            case_number: "DOC-001",
            title: "Alex Case",
            client_id: "cli-alex",
            client_name: "Alex",
            jurisdiction: "US",
            visa_category: "EB-1A",
            status: "intake",
            readiness_score: 20,
            created_at: new Date().toISOString(),
          },
          {
            id: "case-alexander",
            organization_id: "org-1",
            case_number: "DOC-002",
            title: "Alexander Case",
            client_id: "cli-alexander",
            client_name: "Alexander Hamilton",
            jurisdiction: "US",
            visa_category: "O-1A",
            status: "intake",
            readiness_score: 20,
            created_at: new Date().toISOString(),
          },
        ],
        isLiveBackend: true,
      });
      vi.spyOn(api, "getClients").mockResolvedValue({
        data: [
          {
            id: "cli-alex",
            organization_id: "org-1",
            first_name: "Alex",
            last_name: "",
            email: "alex@example.com",
            nationality: "CA",
            cases_count: 1,
            created_at: new Date().toISOString(),
          },
          {
            id: "cli-alexander",
            organization_id: "org-1",
            first_name: "Alexander",
            last_name: "Hamilton",
            email: "alexander@example.com",
            nationality: "US",
            cases_count: 1,
            created_at: new Date().toISOString(),
          },
        ],
        isLiveBackend: true,
      });
      vi.spyOn(api, "getTeamCapacity").mockResolvedValue({ data: [], isLiveBackend: true });
      vi.spyOn(api, "getAuditEvents").mockResolvedValue({ data: [], isLiveBackend: true });
      vi.spyOn(api, "getNotifications").mockResolvedValue({ data: [], isLiveBackend: true });
      vi.spyOn(api, "getTasks").mockResolvedValue({
        data: [
          {
            id: "task-1",
            case_id: "case-alexander",
            case_number: "DOC-002",
            title: "Review passport",
            priority: "high",
            due_date: "2026-12-01",
            is_completed: false,
          },
        ],
        isLiveBackend: true,
      });
      vi.spyOn(api, "getInvoices").mockResolvedValue({ data: [], isLiveBackend: true });
      vi.spyOn(api, "deleteClient").mockResolvedValue({
        data: { success: true, id: "cli-alex" },
        isLiveBackend: true,
      });
      vi.spyOn(api, "toggleTask").mockRejectedValueOnce(new Error("Backend 500"));

      let latestCtx: ReturnType<typeof useWorkspace> | null = null;
      function Probe() {
        latestCtx = useWorkspace();
        return <div data-testid="cases-count">{latestCtx.cases.length}</div>;
      }

      render(
        <WorkspaceProvider>
          <Probe />
        </WorkspaceProvider>
      );

      await waitFor(() => expect(latestCtx?.cases.length).toBe(2));

      // Deleting "Alex" MUST NOT evict "Alexander Hamilton"'s case
      await act(async () => {
        await latestCtx!.handleDeleteClient("cli-alex");
      });
      expect(latestCtx!.cases.map((c) => c.id)).toEqual(["case-alexander"]);

      // Toggling task-1 when API fails MUST roll back to is_completed: false
      await act(async () => {
        await latestCtx!.handleToggleTask("task-1");
      });
      expect(latestCtx!.tasks.find((t) => t.id === "task-1")?.is_completed).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Sponsor Real File Upload, Packet Store, AutoFill & Extractor Honesty
  // ---------------------------------------------------------------------------
  describe("3. Sponsor real file upload, cross-device sync, packet store, autofill & extractor", () => {
    it("uploads the sponsor's ACTUAL File bytes via FormData and attaches auth headers on link creation & cross-device sync", async () => {
      setAccessToken("staff-live-jwt-777");
      const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];

      global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        fetchCalls.push({ url, init });
        if (url.includes("/portal/cases/case-sp-1/sponsor-contributions")) {
          return new Response(
            JSON.stringify({
              invites: [
                {
                  token: "remote-tok-1",
                  case_id: "case-sp-1",
                  case_number: "DOC-SP-1",
                  applicant_name: "Aarav Sharma",
                  pathway: "CA Super Visa",
                  sponsor_name: "Rajesh Sharma",
                  relationship: "child_grandchild",
                  jurisdiction: "CA",
                  privacy_shield: true,
                  created_at: "2026-06-01T10:00:00Z",
                  uploaded_items: [
                    {
                      id: "upl-remote-1",
                      subtype_label: "CRA Notice of Assessment",
                      category: "financial_sponsorship",
                      filename: "HDFC_Statement_Real.pdf",
                      sha256: "abc123remote",
                      verified: false,
                      is_private_to_firm: true,
                      uploaded_at: "2026-06-01T12:00:00Z",
                    },
                  ],
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }) as typeof fetch;

      const invite = createSponsorInviteLink({
        caseId: "case-sp-1",
        caseNumber: "DOC-SP-1",
        applicantName: "Aarav Sharma",
        pathway: "CA Super Visa",
        sponsorName: "Rajesh Sharma",
        relationship: "child_grandchild",
        jurisdiction: "CA",
      });

      await waitFor(() =>
        expect(fetchCalls.some((c) => c.url.includes("/portal/contributor-links"))).toBe(true)
      );
      const createCall = fetchCalls.find((c) => c.url.includes("/portal/contributor-links"))!;
      const createHeaders = createCall.init?.headers as Record<string, string>;
      expect(createHeaders.Authorization).toBe("Bearer staff-live-jwt-777");

      // Upload actual sponsor file bytes
      const realPdfBytes = "%PDF-1.7\nREAL-SPONSOR-BANK-STATEMENT-BYTES-987654\n%%EOF";
      const realFile = new File([realPdfBytes], "Sponsor_HDFC_2026.pdf", {
        type: "application/pdf",
      });

      recordSponsorContributionUpload(invite.token, {
        subtypeLabel: "CRA Notice of Assessment",
        category: "financial_sponsorship",
        filename: realFile.name,
        sha256: "real-sha256-987654",
        verified: false,
        isPrivateToFirm: true,
        file: realFile,
      });

      await waitFor(() =>
        expect(fetchCalls.some((c) => c.url.includes(`/upload`))).toBe(true)
      );
      const uploadCall = fetchCalls.find((c) => c.url.includes(`/upload`))!;
      expect(uploadCall.init?.body).toBeInstanceOf(FormData);
      const fd = uploadCall.init?.body as FormData;
      const uploadedEntry = fd.get("file") as File;
      expect(uploadedEntry).toBeInstanceOf(File);
      expect(uploadedEntry.name).toBe("Sponsor_HDFC_2026.pdf");
      const uploadedText = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(uploadedEntry);
      });
      expect(uploadedText).toContain("REAL-SPONSOR-BANK-STATEMENT-BYTES-987654");
      expect(uploadedText).not.toContain("Documento Sponsor Uploaded Document");

      // Cross-device backend sync
      window.localStorage.clear();
      const hydrated = await syncSponsorInvitesFromBackend("case-sp-1");
      expect(hydrated.length).toBe(1);
      expect(hydrated[0].uploadedItems[0].filename).toBe("HDFC_Statement_Real.pdf");
      const syncCall = fetchCalls.find((c) =>
        c.url.includes("/portal/cases/case-sp-1/sponsor-contributions")
      )!;
      expect((syncCall.init?.headers as Record<string, string>).Authorization).toBe(
        "Bearer staff-live-jwt-777"
      );
      expect(getSponsorInvitesForCase("case-sp-1").length).toBe(1);
    });

    it("rawClientPacketStore returns null when binary missing and does not leak default_client packets", async () => {
      const fakeFile = new File(["real content"], "passport.pdf", { type: "application/pdf" });
      const rec = enqueueRawClientPacket({
        caseId: "case-alpha",
        vaultDocId: "vdoc-alpha-1",
        file: fakeFile,
        sha256: "sha-alpha-1",
        uploaderRole: "applicant",
        declaredCategory: "identity_passport",
      });
      enqueueRawClientPacket({
        caseId: "default_client",
        vaultDocId: "vdoc-leak-1",
        file: new File(["leak"], "leak.pdf", { type: "application/pdf" }),
        sha256: "sha-leak-1",
        uploaderRole: "applicant",
        declaredCategory: "identity_passport",
      });
      enqueueRawClientPacket({
        caseId: "client-portal-intake",
        vaultDocId: "vdoc-leak-2",
        file: new File(["leak2"], "leak2.pdf", { type: "application/pdf" }),
        sha256: "sha-leak-2",
        uploaderRole: "applicant",
        declaredCategory: "identity_passport",
      });

      // Unrelated case MUST NOT receive default_client or client-portal-intake packets
      expect(getRawPacketsForCase("case-beta")).toEqual([]);
      expect(getRawPacketsForCase("case-alpha").length).toBe(1);

      // Clear in-memory binary cache (simulating reload without IndexedDB)
      clearRawPacketStoreInMemoryCache();
      expect(getOrReconstructRawPacketFile(rec)).toBeNull();
      expect(await loadRawPacketFileAsync(rec)).toBeNull();
    });

    it("documentAutoFillEngine does not auto-verify docs, maps pathways accurately, and omits fabricated/sensitive defaults", () => {
      const mapped = mapPacketToInitialInfoSheet({
        status: "success",
        source_filename: "packet.pdf",
        total_pages_analyzed: 1,
        total_persons_detected: 1,
        total_split_documents: 1,
        zip_archive_base64: null,
        zip_archive_filename: "packet.zip",
        person_folders: [
          {
            person_id: "p1",
            canonical_name: "Elena Rostova",
            folder_name: "ELENA_ROSTOVA",
            name_variations: ["Elena Rostova"],
            id_anchors: {},
            is_caseworker_review_folder: false,
            is_corporate_folder: false,
            duplicates_count: 0,
            total_documents: 1,
            total_pages: 1,
            documents: [
              {
                document_index: 1,
                filename: "passport.pdf",
                relative_path: "ELENA_ROSTOVA/passport.pdf",
                category: "identity_passport",
                document_subtype: "Passport",
                page_numbers: [1],
                page_range: "Page 1",
                page_count: 1,
                is_joint_document: false,
                is_duplicate: false,
                shared_with: [],
                extracted_fields: {
                  given_name: "Elena",
                  surname: "Rostova",
                },
                text_preview: "PASSPORT",
              },
            ],
          },
        ],
      });
      expect(mapped.fieldsFilledCount).toBeGreaterThan(0);

      const form = hydrateCanonicalForm(
        "USCIS_I140",
        {
          id: "case-o1a",
          organization_id: "org-1",
          case_number: "DOC-O1A",
          title: "O-1A Petition",
          client_id: "cli-o1a",
          client_name: "Elena Rostova",
          jurisdiction: "US",
          visa_category: "O-1A Extraordinary Ability",
          status: "intake",
          readiness_score: 0,
          created_at: new Date().toISOString(),
        },
        {
          id: "cli-o1a",
          organization_id: "org-1",
          first_name: "Elena",
          last_name: "Rostova",
          email: "elena@example.com",
          nationality: "",
          cases_count: 1,
          created_at: new Date().toISOString(),
        },
        []
      );

      expect(form.answers.visa_classification?.value).toBe("O1A_EXTRAORDINARY");
      expect(form.answers.beneficiary_country_of_citizenship).toBeUndefined();
      expect(form.answers.proposed_endeavor_summary).toBeUndefined();
      expect(form.answers.prior_immigration_violations).toBeUndefined();
      expect(form.answers.criminal_history_disclosure).toBeUndefined();
    });

    it("extractor offline fallback marks fields NEEDS_HUMAN_REVIEW with 0 confidence, empty barcodes, and no blank PDF/ZIP stubs", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Offline")) as typeof fetch;

      const file = new File(["dummy"], "CRA_NOA_2025.pdf", { type: "application/pdf" });
      const res = await runSmartIntakePipeline([file, null], {
        caseId: "case-offline-1",
      });
      expect(res.documents.length).toBe(1);
      const doc = res.documents[0];
      expect(doc.analysis?.specialized_intelligence.barcode_qr_payloads).toEqual([]);
      for (const f of doc.analysis?.extracted_fields || []) {
        expect(f.review_status).toBe("NEEDS_HUMAN_REVIEW");
        expect(f.ocr_confidence).toBe(0);
      }

      const sorted = await sortDocumentPacket(file);
      expect(sorted.zip_archive_base64).toBeNull();
      for (const folder of sorted.person_folders) {
        for (const d of folder.documents) {
          expect(d.pdf_base64).toBeUndefined();
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 4. lib/api.ts Production Guards, Intake Sheet Sync & Super-Admin Wiring
  // ---------------------------------------------------------------------------
  describe("4. lib/api.ts production guards, intake sheet sync & super-admin backend wiring", () => {
    it("fetchEngagements attaches Authorization header and intake sheet sync hits GET/PUT /portal/cases/:id/intake-sheet", async () => {
      setAccessToken("live-token-xyz");
      const calls: Array<{ url: string; init?: RequestInit }> = [];

      global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, init });
        if (url.includes("/billing/engagements")) {
          return new Response(JSON.stringify([{ id: "eng-1", client_id: "cli-1" }]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (url.includes("/portal/cases/case-404/intake-sheet") && (!init?.method || init.method === "GET")) {
          return new Response(JSON.stringify({ detail: "Not found" }), { status: 404 });
        }
        if (url.includes("/portal/cases/case-99/intake-sheet") && init?.method === "PUT") {
          const parsed = JSON.parse(String(init.body || "{}"));
          return new Response(
            JSON.stringify({ case_id: "case-99", ...parsed }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({
            case_id: "case-99",
            payload: { surname: "Kaur" },
            status: "submitted",
            completion_pct: 100,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }) as typeof fetch;

      const engagements = await fetchEngagements("cli-1");
      expect(engagements.length).toBe(1);
      expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe(
        "Bearer live-token-xyz"
      );

      expect(await fetchClientIntakeSheet("case-404")).toBeNull();

      const saved = await saveClientIntakeSheet("case-99", { surname: "Kaur" }, "submitted", 100);
      expect(saved.status).toBe("submitted");
      expect(saved.completion_pct).toBe(100);
      const putCall = calls.find((c) => c.init?.method === "PUT")!;
      expect(putCall.url).toContain("/portal/cases/case-99/intake-sheet");
      expect((putCall.init?.headers as Record<string, string>).Authorization).toBe(
        "Bearer live-token-xyz"
      );

      const loaded = await fetchClientIntakeSheet("case-99");
      expect(loaded?.payload.surname).toBe("Kaur");
    });

    it("throws NetworkError and NEVER mutates localStorage on production backend failures", async () => {
      setNodeEnv("production");
      setAccessToken("prod-token-1");
      global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as typeof fetch;

      await expect(
        api.createCase({
          client_id: "cli-1",
          case_number: "DOC-PROD-1",
          title: "Prod Case",
          jurisdiction: "US",
          visa_category: "EB-1A",
        })
      ).rejects.toBeInstanceOf(NetworkError);
      expect(window.localStorage.getItem("documento_cases_v3_clean")).toBeNull();

      await expect(
        createInvoice({
          client_id: "cli-1",
          line_items: [{ description: "Retainer", quantity: 1, unit_price: 5000 }],
        })
      ).rejects.toBeInstanceOf(NetworkError);
      expect(window.localStorage.getItem("documento_billing_invoices_v3_clean")).toBeNull();
      expect(window.localStorage.getItem("documento_invoices_v3_clean")).toBeNull();

      window.localStorage.setItem(
        "documento_billing_invoices_v3_clean",
        JSON.stringify([{ id: "inv-keep", total_amount: 1000, paid_amount: 0, balance_due: 1000, status: "issued" }])
      );
      await expect(recordInvoicePayment("inv-keep", { amount: 1000 })).rejects.toBeInstanceOf(NetworkError);
      expect(
        JSON.parse(window.localStorage.getItem("documento_billing_invoices_v3_clean")!)[0].paid_amount
      ).toBe(0);

      window.localStorage.setItem(
        "documento_appointments_v3_clean",
        JSON.stringify([{ id: "appt-keep", case_id: "c-1" }])
      );
      await expect(deleteCaseAppointment("c-1", "appt-keep")).rejects.toBeInstanceOf(NetworkError);
      expect(
        JSON.parse(window.localStorage.getItem("documento_appointments_v3_clean")!).length
      ).toBe(1);

      await expect(fetchDocumentRequests("c-1")).rejects.toBeInstanceOf(NetworkError);
      await expect(fetchEngagements("cli-1")).rejects.toBeInstanceOf(NetworkError);
      await expect(
        saveClientIntakeSheet("c-1", { given_name: "Test" }, "in_progress", 25)
      ).rejects.toBeInstanceOf(NetworkError);
      expect(window.localStorage.getItem("documento_initial_info_sheet_c-1")).toBeNull();
    });

    it("Super-Admin store sends Bearer auth headers, hydrates live backend tenants/applications, and throws on production onboarding errors", async () => {
      setAccessToken("super-admin-live-jwt");
      const calls: Array<{ url: string; init?: RequestInit }> = [];

      global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, init });
        if (url.includes("/super-admin/agencies")) {
          return new Response(
            JSON.stringify([
              {
                id: "org-live-1",
                slug: "aurora-global",
                trading_name: "Aurora Global Immigration",
                legal_entity_name: "Aurora Global Immigration Inc.",
                owner_email: "owner@auroraglobal.ca",
                owner_full_name: "Nadia Chen",
                status: "active",
                plan_tier: "growth",
                seat_limit: 12,
                active_seats: 3,
                branch_limit: 2,
                active_branches: 1,
                monthly_case_quota: 50,
                active_cases_count: 14,
                documents_processed_month: 88,
                ai_extractions_month: 64,
                mrr_usd: 799,
                hq_country: "CA",
                hq_city: "Vancouver",
                target_corridors: ["CA", "US"],
                kyb_track: "regulated_counsel",
                regulatory_body: "CICC",
                license_number: "R512345",
                created_at: "2026-05-01T00:00:00Z",
              },
            ]),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        if (url.includes("/super-admin/applications")) {
          return new Response(
            JSON.stringify([
              {
                id: "app-live-1",
                dossier_code: "KYB-LIVE-01",
                legal_entity_name: "Maple Leaf Law PC",
                trading_name: "Maple Leaf Law",
                requested_slug: "maple-leaf-law",
                hq_country: "CA",
                hq_city: "Ottawa",
                corporate_domain: "mapleleaflaw.ca",
                tax_registration_id: "BN-123",
                contact_full_name: "Liam Scott",
                contact_work_email: "liam@mapleleaflaw.ca",
                contact_phone: "+1-613-555-0100",
                kyb_track: "regulated_counsel",
                target_corridors: ["CA"],
                estimated_monthly_cases: 20,
                requested_seats: 5,
                branch_count: 1,
                selected_plan_tier: "boutique",
                kyb_status: "pending_kyb",
                created_at: "2026-05-10T00:00:00Z",
              },
            ]),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(JSON.stringify({ detail: "Backend unavailable" }), { status: 503 });
      }) as typeof fetch;

      const synced = await syncSuperAdminPlatformFromBackend();
      expect(synced.hydrated).toBe(true);
      expect(getAgencyTenants().some((t) => t.slug === "aurora-global")).toBe(true);
      expect(getAgencyApplications().some((a) => a.dossierCode === "KYB-LIVE-01")).toBe(true);
      for (const c of calls) {
        expect((c.init?.headers as Record<string, string>).Authorization).toBe(
          "Bearer super-admin-live-jwt"
        );
      }

      // Adjudicate also sends real Bearer token
      adjudicateAgencyKybApplication("app-live-1", "approve", "Verified", "hq@documento.ai");
      await waitFor(() =>
        expect(calls.some((c) => c.url.includes("/decision"))).toBe(true)
      );
      const adjCall = calls.find((c) => c.url.includes("/decision"))!;
      expect((adjCall.init?.headers as Record<string, string>).Authorization).toBe(
        "Bearer super-admin-live-jwt"
      );

      // In production, submitAgencyOnboarding MUST throw when backend returns 503
      setNodeEnv("production");
      await expect(
        submitAgencyOnboarding({
          legalEntityName: "Prod Fail Firm",
          tradingName: "Prod Fail",
          requestedSlug: "prod-fail",
          hqCountry: "CA",
          hqCity: "Toronto",
          corporateDomain: "prodfail.ca",
          taxRegistrationId: "BN-999",
          contactFullName: "Owner",
          contactWorkEmail: "owner@prodfail.ca",
          contactPhone: "+1-416-555-0000",
          ownerPassword: "ShouldNeverLeakToLocalStorage!",
          kybTrack: "regulated_counsel",
          regulatoryBody: "CICC",
          licenseNumber: "R999999",
          targetCorridors: ["CA"],
          estimatedMonthlyCases: 10,
          requestedSeats: 3,
          branchCount: 1,
          selectedPlanTier: "boutique",
          dpaAccepted: true,
          zeroTrainingAccepted: true,
        })
      ).rejects.toThrow();
      expect(window.localStorage.getItem("documento_agency_applications_v3_clean") || "").not.toContain(
        "ShouldNeverLeakToLocalStorage!"
      );
    });
  });
});
