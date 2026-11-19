import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OwnerMasterDashboard } from "../components/dashboards/OwnerMasterDashboard";
import { CaseDrilldownDrawer } from "../components/modals/CaseDrilldownDrawer";
import { CreateCaseModal } from "../components/modals/CreateCaseModal";
import { api } from "../lib/api";
import type { ClientProfile, ImmigrationCase, TeamMemberCapacity, UserContext } from "../lib/types";

const OWNER_USER: UserContext = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "owner@maplecounsel.ca",
  full_name: "Yashesh Bhavsar",
  role: "master_admin",
  organization_id: "org-maple-01",
  organization_name: "Maple Counsel RCIC",
  experience: "master_admin",
  permissions: ["*"],
};

const PARALEGAL_USER: UserContext = {
  id: "22222222-2222-2222-2222-222222222222",
  email: "priya@maplecounsel.ca",
  full_name: "Priya Nair",
  role: "case_worker",
  organization_id: "org-maple-01",
  organization_name: "Maple Counsel RCIC",
  experience: "paralegal",
  permissions: ["case:read"],
};

const TEAM_CAPACITY: TeamMemberCapacity[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Yashesh Bhavsar",
    email: "owner@maplecounsel.ca",
    role: "Managing Partner / Agency Owner",
    active_cases: 1,
    max_capacity: 25,
    open_reviews: 0,
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Priya Nair",
    email: "priya@maplecounsel.ca",
    role: "Case Processor / Paralegal",
    active_cases: 0,
    max_capacity: 20,
    open_reviews: 0,
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    name: "Rohan Desai",
    email: "rohan@maplecounsel.ca",
    role: "Case Manager / Licensed Counsel",
    active_cases: 0,
    max_capacity: 20,
    open_reviews: 0,
  },
];

const SAMPLE_CLIENT: ClientProfile = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  first_name: "Ananya",
  last_name: "Patel",
  email: "ananya.patel@example.com",
  nationality: "IND",
  organization_id: "org-maple-01",
  created_at: new Date().toISOString(),
  portal_credentials_provided: true,
  portal_access_enabled: true,
};

const SAMPLE_CASE: ImmigrationCase = {
  id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  case_number: "CASE-CA-901",
  title: "Canada Express Entry: Ananya Patel",
  client_id: SAMPLE_CLIENT.id,
  client_name: "Ananya Patel",
  jurisdiction: "Canada (IRCC)",
  visa_category: "Express Entry PNP",
  status: "intake",
  readiness_score: 25,
  organization_id: "org-maple-01",
  created_at: new Date().toISOString(),
};

describe("End-to-End Caseworker Assignment Workflow", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows assigning a caseworker directly from the Retained Clients table and syncs linked cases", async () => {
    const assignClientSpy = vi.spyOn(api, "assignClientCaseworker");

    render(
      <OwnerMasterDashboard
        initialTab="clients"
        clients={[SAMPLE_CLIENT]}
        cases={[SAMPLE_CASE]}
        capacity={TEAM_CAPACITY}
        currentUser={OWNER_USER}
      />
    );

    const select = screen.getByTestId(`assign-client-caseworker-${SAMPLE_CLIENT.id}`) as HTMLSelectElement;
    expect(select).toBeDefined();
    expect(select.value).toBe("");

    fireEvent.change(select, { target: { value: "Rohan Desai" } });

    await waitFor(() => {
      expect(assignClientSpy).toHaveBeenCalledWith(
        SAMPLE_CLIENT.id,
        "Rohan Desai",
        expect.objectContaining({
          userId: "33333333-3333-3333-3333-333333333333",
          roleInCase: "case_manager",
        }),
        "master_admin"
      );
    });
    expect(select.value).toBe("Rohan Desai");
  });

  it("allows assigning a caseworker inline from the All Cases table without opening the row drawer", async () => {
    const onSelectCase = vi.fn();
    const assignCaseSpy = vi.spyOn(api, "assignCaseOfficer");

    render(
      <OwnerMasterDashboard
        initialTab="cases"
        clients={[SAMPLE_CLIENT]}
        cases={[SAMPLE_CASE]}
        capacity={TEAM_CAPACITY}
        currentUser={OWNER_USER}
        onSelectCase={onSelectCase}
      />
    );

    const select = screen.getByTestId(`assign-case-caseworker-${SAMPLE_CASE.id}`) as HTMLSelectElement;
    fireEvent.click(select);
    fireEvent.change(select, { target: { value: "Priya Nair" } });

    await waitFor(() => {
      expect(assignCaseSpy).toHaveBeenCalledWith(
        SAMPLE_CASE.id,
        "Priya Nair",
        expect.objectContaining({
          userId: "22222222-2222-2222-2222-222222222222",
        }),
        "master_admin"
      );
    });
    expect(onSelectCase).not.toHaveBeenCalled();
  });

  it("renders interactive caseworker selector in CaseDrilldownDrawer for Owner and read-only for Paralegal", async () => {
    const onCaseAssigned = vi.fn();
    const { rerender } = render(
      <CaseDrilldownDrawer
        isOpen={true}
        onClose={vi.fn()}
        caseItem={SAMPLE_CASE}
        teamCapacity={TEAM_CAPACITY}
        currentUser={OWNER_USER}
        onCaseAssigned={onCaseAssigned}
      />
    );

    const drawerSelect = screen.getByTestId("drawer-assign-caseworker-select") as HTMLSelectElement;
    fireEvent.change(drawerSelect, { target: { value: "Rohan Desai" } });

    await waitFor(() => {
      expect(onCaseAssigned).toHaveBeenCalledWith(
        expect.objectContaining({
          id: SAMPLE_CASE.id,
          assigned_manager: "Rohan Desai",
        })
      );
    });

    // Paralegal should see read-only display, never the assignment select
    rerender(
      <CaseDrilldownDrawer
        isOpen={true}
        onClose={vi.fn()}
        caseItem={{ ...SAMPLE_CASE, assigned_manager: "Rohan Desai" }}
        teamCapacity={TEAM_CAPACITY}
        currentUser={PARALEGAL_USER}
      />
    );
    expect(screen.queryByTestId("drawer-assign-caseworker-select")).toBeNull();
    expect(screen.getByText("Rohan Desai")).toBeDefined();
  });

  it("allows selecting Assigned Caseworker inside CreateCaseModal and passes case_manager_id", async () => {
    const createCaseSpy = vi.spyOn(api, "createCase");
    const onCaseCreated = vi.fn();

    render(
      <CreateCaseModal
        isOpen={true}
        onClose={vi.fn()}
        clients={[SAMPLE_CLIENT]}
        teamCapacity={TEAM_CAPACITY}
        currentUser={OWNER_USER}
        onCaseCreated={onCaseCreated}
      />
    );

    const titleInput = screen.getByPlaceholderText(/e\.g\. EB-1A Petition/i);
    fireEvent.change(titleInput, { target: { value: "Super Visa — Parents" } });

    const workerSelect = screen.getByLabelText(/Assigned Caseworker/i) as HTMLSelectElement;
    fireEvent.change(workerSelect, { target: { value: "Rohan Desai" } });

    fireEvent.click(screen.getByRole("button", { name: /Create Case Record/i }));

    await waitFor(() => {
      expect(createCaseSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          client_id: SAMPLE_CLIENT.id,
          assigned_manager: "Rohan Desai",
          case_manager_id: "33333333-3333-3333-3333-333333333333",
        }),
        "master_admin"
      );
    });
  });

  it("persists caseworker assignment to live backend reassignment endpoint and derives assigned_manager on getCases", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any, init?: any) => {
      const urlStr = String(url);
      if (urlStr.includes(`/cases/${SAMPLE_CASE.id}/lifecycle/reassign`) && init?.method === "POST") {
        const body = JSON.parse(init.body);
        expect(body.new_user_id).toBe("33333333-3333-3333-3333-333333333333");
        expect(body.role_in_case).toBe("case_manager");
        return new Response(
          JSON.stringify({
            ...SAMPLE_CASE,
            assignments: [
              {
                assignment_id: "asn-1",
                user_id: body.new_user_id,
                user_name: "Rohan Desai",
                role_in_case: "case_manager",
                assigned_at: new Date().toISOString(),
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (urlStr.endsWith("/cases")) {
        return new Response(
          JSON.stringify([
            {
              ...SAMPLE_CASE,
              assignments: [
                {
                  assignment_id: "asn-1",
                  user_id: "33333333-3333-3333-3333-333333333333",
                  user_name: "Rohan Desai",
                  role_in_case: "case_manager",
                  assigned_at: new Date().toISOString(),
                },
              ],
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("Not Found", { status: 404 });
    });

    const assignRes = await api.assignCaseOfficer(
      SAMPLE_CASE.id,
      "Rohan Desai",
      {
        userId: "33333333-3333-3333-3333-333333333333",
        roleInCase: "case_manager",
        fallbackCase: SAMPLE_CASE,
      },
      "master_admin"
    );

    expect(assignRes.isLiveBackend).toBe(true);
    expect(assignRes.data?.assigned_manager).toBe("Rohan Desai");

    const casesRes = await api.getCases("master_admin");
    expect(casesRes.isLiveBackend).toBe(true);
    expect(casesRes.data[0].assigned_manager).toBe("Rohan Desai");
    expect(fetchMock).toHaveBeenCalled();
  });
});
