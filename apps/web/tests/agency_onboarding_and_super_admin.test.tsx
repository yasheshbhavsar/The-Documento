import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AgencyOnboardingWizard } from "../components/agency/AgencyOnboardingWizard";
import { SuperAdminControlPlane } from "../components/admin/SuperAdminControlPlane";
import { AgencyGrowthAndSetupDesk } from "../components/agency/AgencyGrowthAndSetupDesk";
import { PrCalculatorsHubView } from "../components/tools/PrCalculatorsHubView";
import { AustraliaSkillSelectTool } from "../components/tools/AustraliaSkillSelectTool";
import { CreateClientModal } from "../components/modals/CreateClientModal";
import { ClientPortal } from "../components/dashboards/ClientPortal";
import { EmployeeWorkspace } from "../components/dashboards/EmployeeWorkspace";
import {
  CalculatorAgencyLeadRecord,
  adjudicateAgencyKybApplication,
  buildKybUploadedDocMeta,
  computePlatformOverview,
  createAgencySupportTicket,
  exportPartnerAgenciesCsv,
  getAgencyApplications,
  getAgencySupportTickets,
  getAgencyTeamInvites,
  getAgencyTenants,
  getCalculatorAgencyLeads,
  getPlatformBillingInvoices,
  submitAgencyOnboarding,
  submitCobrandedCalculatorLead,
} from "../lib/agencyPlatformStore";
import { authenticateUser, PLATFORM_HQ_OPERATOR_EMAIL } from "../lib/auth";
import { api } from "../lib/api";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

function signInHqOperatorInUi() {
  fireEvent.change(screen.getByLabelText(/Documento HQ Operator Email/i), {
    target: { value: PLATFORM_HQ_OPERATOR_EMAIL },
  });
  fireEvent.change(screen.getByLabelText(/Operator Passphrase/i), {
    target: { value: "DocumentoHQ2026!" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Authenticate to Control Plane/i }));
}

async function seedPendingKybAgency(overrides?: {
  slug?: string;
  tradingName?: string;
  email?: string;
  bookingUrl?: string;
}) {
  const slug = overrides?.slug || "maplecrest-rcic";
  const tradingName = overrides?.tradingName || "MapleCrest Immigration";
  const email = overrides?.email || "amrit.grewal@maplecrestimmigration.ca";
  return submitAgencyOnboarding({
    legalEntityName: `${tradingName} Professional Corp.`,
    tradingName,
    requestedSlug: slug,
    hqCountry: "CA",
    hqCity: "Mississauga",
    corporateDomain: "maplecrestimmigration.ca",
    taxRegistrationId: "BN-841290441RC0001",
    contactFullName: "Amrit Grewal, RCIC",
    contactWorkEmail: email,
    contactPhone: "+1-905-555-0144",
    ownerPassword: "MapleCrestPass2026!",
    consultationBookingUrl:
      overrides?.bookingUrl || "https://maplecrestimmigration.ca/book-strategy",
    kybTrack: "regulated_counsel",
    regulatoryBody: "CICC",
    licenseNumber: "R714290",
    uploadedDocuments: [
      buildKybUploadedDocMeta(
        "practitioner_license",
        new File(["%PDF-1.4 CICC Certificate"], "CICC_Practicing_Certificate_R714290_2026.pdf", {
          type: "application/pdf",
        })
      ),
    ],
    targetCorridors: ["CA", "AU"],
    estimatedMonthlyCases: 35,
    requestedSeats: 12,
    branchCount: 1,
    selectedPlanTier: "growth",
    dpaAccepted: true,
    zeroTrainingAccepted: true,
  });
}

describe("Visa Agency KYB Onboarding, Documento HQ Super-Admin & End-to-End Zero-Demo Flow", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("starts with 0 seeded demo agencies, 0 KYB dossiers, $0 MRR, 0 leads, 0 invoices, and 0 shortcut buttons", () => {
    expect(getAgencyTenants().length).toBe(0);
    expect(getAgencyApplications().length).toBe(0);
    expect(getCalculatorAgencyLeads().length).toBe(0);
    expect(getPlatformBillingInvoices().length).toBe(0);
    expect(getAgencySupportTickets().length).toBe(0);

    const initialOverview = computePlatformOverview(getAgencyTenants(), getAgencyApplications());
    expect(initialOverview.zeroPiiBoundaryEnforced).toBe(true);
    expect(initialOverview.activeAgenciesCount).toBe(0);
    expect(initialOverview.recurringMrrUsd).toBe(0);
    expect(initialOverview.pendingKybCount).toBe(0);

    render(<SuperAdminControlPlane />);
    expect(screen.queryByTestId("hq-instant-auth-btn")).toBeNull();

    // Reject invalid passphrase
    fireEvent.change(screen.getByLabelText(/Documento HQ Operator Email/i), {
      target: { value: PLATFORM_HQ_OPERATOR_EMAIL },
    });
    fireEvent.change(screen.getByLabelText(/Operator Passphrase/i), {
      target: { value: "WrongPassphrase!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Authenticate to Control Plane/i }));
    expect(screen.getByRole("alert")).toBeDefined();
  });

  it("completes the 3-step real-world agency signup with certificate upload & password, isolates Day-1 workspace, and leaks zero HQ links", async () => {
    const { container, unmount } = render(<AgencyOnboardingWizard />);

    fireEvent.click(screen.getByRole("button", { name: /Continue to License & Proof/i }));
    expect(screen.getByRole("alert").textContent).toContain("full name");

    fireEvent.change(screen.getByLabelText(/Your Full Name & Title/i), {
      target: { value: "Priya Grewal, RCIC" },
    });
    fireEvent.change(screen.getByLabelText(/Work Email \(Your Login ID\)/i), {
      target: { value: "priya@northstarrcic.ca" },
    });
    fireEvent.change(screen.getByLabelText(/Create Account Password/i), {
      target: { value: "NorthStarPass2026!" },
    });
    fireEvent.change(screen.getByLabelText(/Registered Legal Entity Name/i), {
      target: { value: "NorthStar Regulated Immigration Counsel Inc." },
    });
    fireEvent.change(screen.getByLabelText(/Public Brand \/ Trading Name/i), {
      target: { value: "NorthStar RCIC" },
    });
    fireEvent.change(screen.getByLabelText(/Primary Office City/i), {
      target: { value: "Vancouver" },
    });
    fireEvent.change(screen.getByLabelText(/Consultation Booking URL/i), {
      target: { value: "https://calendly.com/northstar-rcic/consult" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Continue to License & Proof/i }));

    expect(screen.getByText(/2\. Practice licensing & verification proof/i)).toBeDefined();
    fireEvent.change(screen.getByLabelText(/Practitioner License \/ Registration Number/i), {
      target: { value: "R719804" },
    });
    fireEvent.change(screen.getByLabelText(/Business Registration \/ Tax ID/i), {
      target: { value: "BN-892104552RC0001" },
    });

    const licenseFile = new File(["%PDF-1.4 CICC Certificate"], "CICC_Certificate_R719804.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(screen.getByTestId("kyb-upload-license-input"), {
      target: { files: [licenseFile] },
    });
    expect(screen.getByText(/CICC_Certificate_R719804\.pdf/i)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Continue to Visa Programs & Trial/i }));

    fireEvent.change(screen.getByLabelText(/Team Seats Needed/i), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByTestId("submit-agency-kyb-btn"));
    expect(screen.getByRole("alert").textContent).toContain("Partner Terms");

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByTestId("submit-agency-kyb-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("open-agency-workspace-btn")).toBeDefined();
    });

    expect(container.innerHTML).not.toContain("/super-admin");

    const queued = getAgencyApplications();
    const match = queued.find((a) => a.requestedSlug === "northstar-rcic");
    expect(match).toBeDefined();
    expect(match?.regulatoryBody).toBe("CICC");
    expect(match?.licenseNumber).toBe("R719804");
    expect(match?.uploadedDocuments?.length).toBe(1);
    expect(match?.uploadedDocuments?.[0].fileName).toBe("CICC_Certificate_R719804.pdf");

    expect(authenticateUser("priya@northstarrcic.ca", "firm", "WrongPass!").success).toBe(false);

    const sandboxLogin = authenticateUser("priya@northstarrcic.ca", "firm", "NorthStarPass2026!");
    expect(sandboxLogin.success).toBe(true);
    expect(sandboxLogin.user?.organization_id).toBe("sandbox-northstar-rcic");
    expect(sandboxLogin.user?.is_sandbox_agency).toBe(true);
    unmount();

    render(<AgencyGrowthAndSetupDesk currentUser={sandboxLogin.user} />);
    const deskText = screen.getByTestId("agency-growth-setup-desk").textContent || "";
    expect(deskText).toContain("NorthStar RCIC");
    expect(deskText).toContain("CICC_Certificate_R719804.pdf");
    expect(deskText).not.toContain("Vanguard Immigration Law");
  });

  it("authenticates HQ Operator with passphrase, inspects real KYB evidence, provisions agency in 1 click, enables owner sign-in, and enforces Emergency Freeze", async () => {
    await seedPendingKybAgency();

    const preOverview = computePlatformOverview(getAgencyTenants(), getAgencyApplications());
    expect(preOverview.activeAgenciesCount).toBe(0);
    expect(preOverview.pendingKybCount).toBe(1);

    render(<SuperAdminControlPlane />);
    signInHqOperatorInUi();
    expect(screen.getByText(/Zero-PII Boundary Sealed/i)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /KYB Verification Desk/i }));
    expect(screen.getByTestId("kyb-adjudication-panel").textContent).toContain(
      "MapleCrest Immigration Professional Corp."
    );
    expect(screen.getByTestId("kyb-uploaded-evidence-list").textContent).toContain(
      "CICC_Practicing_Certificate_R714290_2026.pdf"
    );
    expect(screen.getByTestId("kyb-compliance-checklist")).toBeDefined();

    fireEvent.click(screen.getByTestId("approve-provision-kyb-btn"));

    const afterProvisionOverview = computePlatformOverview(
      getAgencyTenants(),
      getAgencyApplications()
    );
    expect(afterProvisionOverview.activeAgenciesCount).toBe(1);
    expect(afterProvisionOverview.recurringMrrUsd).toBe(499);
    expect(afterProvisionOverview.pendingKybCount).toBe(0);

    const loginOk = authenticateUser(
      "amrit.grewal@maplecrestimmigration.ca",
      "firm",
      "MapleCrestPass2026!"
    );
    expect(loginOk.success).toBe(true);
    expect(loginOk.user?.organization_id).toBe("ten-maplecrest-rcic");

    fireEvent.click(screen.getByRole("button", { name: /Partner Agencies/i }));
    const freezeButtons = screen.getAllByRole("button", { name: "Freeze" });
    fireEvent.click(freezeButtons[0]);

    const loginBlocked = authenticateUser(
      "amrit.grewal@maplecrestimmigration.ca",
      "firm",
      "MapleCrestPass2026!"
    );
    expect(loginBlocked.success).toBe(false);
    expect(loginBlocked.error).toContain("Workspace Frozen");
  });

  it("supports HQ sales-led agency provisioning, SWIFT wire invoice settlement, support ticket resolution, and live statutory broadcasts", () => {
    const { unmount } = render(<SuperAdminControlPlane />);
    signInHqOperatorInUi();

    // 1. Sales-Led Direct Provisioning (+ Invite / Provision Agency)
    fireEvent.click(screen.getByTestId("open-sales-provision-modal-btn"));
    expect(screen.getByTestId("sales-led-provision-modal")).toBeDefined();

    fireEvent.change(screen.getByPlaceholderText(/Pacific Rim Immigration Law PC/i), {
      target: { value: "Pacific Rim Immigration Law PC" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Pacific Rim Visas/i), {
      target: { value: "Pacific Rim Visas" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Daniel Cho/i), {
      target: { value: "Daniel Cho, Barrister" },
    });
    fireEvent.change(screen.getByPlaceholderText(/daniel@pacificrimlaw\.ca/i), {
      target: { value: "daniel@pacificrimlaw.ca" },
    });
    fireEvent.change(screen.getByPlaceholderText(/R708112/i), {
      target: { value: "LSO-84920A" },
    });
    fireEvent.change(screen.getByLabelText(/Negotiated MRR USD/i), {
      target: { value: "850" },
    });
    fireEvent.change(screen.getByLabelText(/Custom Seat Cap/i), {
      target: { value: "25" },
    });
    fireEvent.change(screen.getByLabelText(/Sales billing method/i), {
      target: { value: "wire_invoice" },
    });

    fireEvent.click(screen.getByTestId("confirm-sales-provision-btn"));

    expect(computePlatformOverview(getAgencyTenants(), getAgencyApplications()).recurringMrrUsd).toBe(
      850
    );
    const salesTenant = getAgencyTenants().find((t) => t.slug === "pacific-rim-visas")!;
    expect(salesTenant.seatLimit).toBe(25);

    const ownerLogin = authenticateUser(
      "daniel@pacificrimlaw.ca",
      "firm",
      salesTenant.temporaryPassword || ""
    );
    expect(ownerLogin.success).toBe(true);

    // 2. Settle the generated SWIFT Wire Invoice in Billing & Trials
    const pendingWireInvoice = getPlatformBillingInvoices().find(
      (i) => i.organizationId === salesTenant.organizationId
    )!;
    expect(pendingWireInvoice.status).toBe("pending_wire");

    fireEvent.click(screen.getByRole("button", { name: /Billing & Trials/i }));
    expect(screen.getByTestId("hq-billing-ops-view")).toBeDefined();
    fireEvent.click(screen.getByTestId(`settle-invoice-btn-${pendingWireInvoice.invoiceNumber}`));

    const settledInvoice = getPlatformBillingInvoices().find(
      (i) => i.invoiceNumber === pendingWireInvoice.invoiceNumber
    );
    expect(settledInvoice?.status).toBe("paid");
    unmount();

    // 3. Partner agency raises a real support ticket -> HQ resolves it & publishes statutory broadcast
    const createdTicket = createAgencySupportTicket({
      organizationId: salesTenant.organizationId,
      requesterEmail: "daniel@pacificrimlaw.ca",
      category: "billing_seats",
      subject: "Confirm wire clearance receipt",
      message: "Please confirm SWIFT wire receipt for our 25-seat Growth plan.",
    });

    const { unmount: unmountHq2 } = render(<SuperAdminControlPlane />);
    fireEvent.click(screen.getByRole("button", { name: /Support & Rules/i }));
    fireEvent.change(screen.getByTestId(`hq-ticket-reply-input-${createdTicket.ticketCode}`), {
      target: { value: "SWIFT wire settled and all 25 seats are active." },
    });
    fireEvent.click(screen.getByTestId(`hq-resolve-ticket-btn-${createdTicket.ticketCode}`));

    fireEvent.change(screen.getByTestId("hq-broadcast-title-input"), {
      target: { value: "IRCC French Category Draw #325 — 478 CRS Cutoff Live" },
    });
    fireEvent.change(screen.getByTestId("hq-broadcast-summary-input"), {
      target: { value: "Updated French NCLC 7+ category threshold across Canada CRS calculators." },
    });
    fireEvent.click(screen.getByTestId("hq-publish-broadcast-btn"));
    unmountHq2();

    // 4. Verify published statutory bulletin & paralegal invite inside real partner's Agency Launchpad
    render(<AgencyGrowthAndSetupDesk currentUser={ownerLogin.user} />);
    expect(screen.getByTestId("agency-statutory-bulletins").textContent).toContain(
      "IRCC French Category Draw #325"
    );

    fireEvent.change(screen.getByPlaceholderText(/Simran Kaur/i), {
      target: { value: "Simran Kaur" },
    });
    fireEvent.change(screen.getByPlaceholderText(/simran@yourfirm\.com/i), {
      target: { value: "simran@pacificrimlaw.ca" },
    });
    fireEvent.click(screen.getByTestId("invite-agency-staff-btn"));

    const invites = getAgencyTeamInvites(salesTenant.organizationId);
    expect(invites.length).toBe(1);
    const staffAuth = authenticateUser("simran@pacificrimlaw.ca", "firm", invites[0].passcode);
    expect(staffAuth.success).toBe(true);
    expect(staffAuth.user?.organization_id).toBe(salesTenant.organizationId);
    expect(staffAuth.user?.experience).toBe("paralegal");
  });

  it("supports live KYB dossier lookup, clarification request, and clarification resubmission back to HQ pending_kyb", async () => {
    const app = await seedPendingKybAgency({
      slug: "crescent-global-visas",
      tradingName: "Crescent Global Visas",
      email: "tariq@crescentvisas.ae",
    });

    adjudicateAgencyKybApplication(
      app.id,
      "request_clarification",
      "Please provide your Canadian RCIC co-counsel registration number.",
      PLATFORM_HQ_OPERATOR_EMAIL
    );

    render(<AgencyOnboardingWizard />);

    fireEvent.change(screen.getByLabelText(/KYB Dossier Code or Work Email/i), {
      target: { value: app.dossierCode },
    });
    fireEvent.click(screen.getByTestId("kyb-dossier-lookup-btn"));

    expect(screen.getByTestId("kyb-lookup-result-card").textContent).toContain(
      "Crescent Global Visas"
    );
    expect(screen.getByTestId("kyb-lookup-status-badge").textContent).toBe(
      "CLARIFICATION REQUESTED"
    );

    fireEvent.change(screen.getByLabelText(/Co-Counsel Retainer \/ Registry Clarification Details/i), {
      target: {
        value: "Co-counsel retainer executed with Amrit Grewal, RCIC #R714290.",
      },
    });
    fireEvent.click(screen.getByTestId("kyb-submit-clarification-btn"));

    expect(screen.getByTestId("kyb-lookup-status-badge").textContent).toBe("PENDING KYB");
    const overviewAfter = computePlatformOverview(getAgencyTenants(), getAgencyApplications());
    expect(overviewAfter.pendingKybCount).toBe(1);
    expect(overviewAfter.clarificationKybCount).toBe(0);
  });

  it("enforces >=5 char compliance note on KYB clarification/rejection, blocks duplicate approval, and exports Zero-PII CSV ledger", async () => {
    const app = await seedPendingKybAgency();

    render(<SuperAdminControlPlane />);
    signInHqOperatorInUi();
    fireEvent.click(screen.getByRole("button", { name: /KYB Verification Desk/i }));

    fireEvent.click(screen.getByRole("button", { name: /Request Clarification/i }));
    expect(screen.getByTestId("kyb-decision-error").textContent).toContain("at least 5 characters");

    fireEvent.click(screen.getByTestId("approve-provision-kyb-btn"));
    expect(getAgencyTenants().length).toBe(1);

    const secondOutcome = adjudicateAgencyKybApplication(
      app.id,
      "approve",
      "Duplicate click",
      PLATFORM_HQ_OPERATOR_EMAIL
    );
    expect(secondOutcome.provisionedTenant?.organizationId).toBe("ten-maplecrest-rcic");
    expect(getAgencyTenants().length).toBe(1);

    const csv = exportPartnerAgenciesCsv(getAgencyTenants());
    expect(csv).toContain("Organization ID,Trading Name,Legal Entity Name,Workspace Slug");
    expect(csv).toContain("MapleCrest Immigration");
  });

  it("executes the complete Zero-to-Production E2E journey across HQ, Co-Branded Calculator, Agency Owner, Invited Paralegal, and Retained Client", async () => {
    // 1. Agency applies & HQ approves
    const app = await seedPendingKybAgency({
      slug: "maplecrest-rcic",
      tradingName: "MapleCrest Immigration",
      email: "amrit.grewal@maplecrestimmigration.ca",
      bookingUrl: "https://maplecrestimmigration.ca/book-strategy",
    });
    const { provisionedTenant } = adjudicateAgencyKybApplication(
      app.id,
      "approve",
      "Verified active CICC license.",
      PLATFORM_HQ_OPERATOR_EMAIL
    );
    expect(provisionedTenant).toBeDefined();

    // 2. Prospective applicant visits co-branded calculator (?agency=maplecrest-rcic) and submits scorecard
    window.history.replaceState({}, "", "/calculators/australia-pr?agency=maplecrest-rcic");
    const { unmount: unmountCalc } = render(<AustraliaSkillSelectTool />);
    expect(screen.getByTestId("cobranded-calculator-lead-widget").textContent).toContain(
      "MapleCrest Immigration"
    );

    const submitLeadBtn = screen.getByRole("button", {
      name: /Transmit Verified Scorecard to MapleCrest Immigration/i,
    }) as HTMLButtonElement;
    expect(submitLeadBtn.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/Age at the time you are invited to apply/i), {
      target: { value: "25_to_32" },
    });
    fireEvent.change(screen.getByLabelText(/English language proficiency level/i), {
      target: { value: "superior" },
    });
    expect(submitLeadBtn.disabled).toBe(false);

    fireEvent.change(screen.getByLabelText(/^Applicant full name$/i), {
      target: { value: "Neha Kulkarni" },
    });
    fireEvent.change(screen.getByLabelText(/^Applicant email address$/i), {
      target: { value: "neha.kulkarni@proton.me" },
    });
    fireEvent.click(submitLeadBtn);

    expect(screen.getByTestId("cobranded-lead-submitted-banner").textContent).toContain("50 pts");
    expect(screen.getByTestId("cobranded-book-consultation-link").getAttribute("href")).toBe(
      "https://maplecrestimmigration.ca/book-strategy"
    );
    unmountCalc();
    window.history.replaceState({}, "", "/");

    // 3. Agency Owner signs in, sees lead in Launchpad, converts lead -> retains client with portal password -> opens case -> uploads passport
    const ownerAuth = authenticateUser(
      "amrit.grewal@maplecrestimmigration.ca",
      "firm",
      "MapleCrestPass2026!"
    );
    expect(ownerAuth.success).toBe(true);
    window.localStorage.setItem("documento_user", JSON.stringify(ownerAuth.user));

    let capturedLead: CalculatorAgencyLeadRecord | null = null;
    const { unmount: unmountDesk } = render(
      <AgencyGrowthAndSetupDesk
        currentUser={ownerAuth.user}
        onConvertLeadToClient={(lead) => {
          capturedLead = lead;
        }}
      />
    );
    expect(screen.getByTestId("agency-growth-setup-desk").textContent).toContain("Neha Kulkarni");
    fireEvent.click(screen.getByRole("button", { name: /Convert to Client/i }));
    expect(capturedLead?.applicantEmail).toBe("neha.kulkarni@proton.me");

    // Issue & revoke 2-hour Break-Glass support token
    fireEvent.click(screen.getByTestId("issue-break-glass-btn"));
    expect(
      computePlatformOverview(getAgencyTenants(), getAgencyApplications()).activeSupportGrantsCount
    ).toBe(1);
    fireEvent.click(screen.getByTestId("revoke-break-glass-btn"));
    expect(
      computePlatformOverview(getAgencyTenants(), getAgencyApplications()).activeSupportGrantsCount
    ).toBe(0);

    // Invite a Paralegal from the Launchpad
    fireEvent.change(screen.getByPlaceholderText(/Simran Kaur/i), {
      target: { value: "Navneet Brar" },
    });
    fireEvent.change(screen.getByPlaceholderText(/simran@yourfirm\.com/i), {
      target: { value: "navneet@maplecrestimmigration.ca" },
    });
    fireEvent.click(screen.getByTestId("invite-agency-staff-btn"));
    unmountDesk();

    // Retain Neha Kulkarni with a temporary portal password, open her case, and upload a passport PDF
    const clientRes = await api.createClient({
      first_name: "Neha",
      last_name: "Kulkarni",
      email: "neha.kulkarni@proton.me",
      nationality: "IND",
      portal_credentials_provided: true,
      portal_access_enabled: true,
      temporary_password: "NehaPortalPassword2026!",
    });
    const caseRes = await api.createCase({
      client_id: clientRes.data.id,
      title: "Subclass 189 Skilled Independent — Neha Kulkarni",
      case_number: "CASE-AU-2026-01",
      visa_category: "Australia Subclass 189",
      jurisdiction: "Australia",
    });
    await api.uploadDocument({
      case_id: caseRes.data.id,
      title: "Neha_Kulkarni_Passport_Bio.pdf",
      category: "identity",
      file_size: "1.2 MB",
      uploaded_by: "Amrit Grewal, RCIC",
      sha256_hash: "sha256-neha-passport-01",
    });

    // 4. Invited Paralegal signs in and sees ONLY MapleCrest's real case & document (zero demo personas)
    const staffInvite = getAgencyTeamInvites(provisionedTenant!.organizationId)[0];
    const paraAuth = authenticateUser(
      "navneet@maplecrestimmigration.ca",
      "firm",
      staffInvite.passcode
    );
    expect(paraAuth.success).toBe(true);
    window.localStorage.setItem("documento_user", JSON.stringify(paraAuth.user));

    const staffCases = (await api.getCases()).data;
    const staffDocs = (await api.getDocuments()).data;
    expect(staffCases.length).toBe(1);
    expect(staffCases[0].case_number).toBe("CASE-AU-2026-01");
    expect(staffDocs.length).toBe(1);
    expect(staffDocs[0].title).toBe("Neha_Kulkarni_Passport_Bio.pdf");

    const { unmount: unmountStaff } = render(
      <EmployeeWorkspace
        cases={staffCases}
        clients={(await api.getClients()).data}
        documents={staffDocs}
        tasks={[]}
        aiFindings={[]}
        messages={[]}
        currentUser={paraAuth.user}
        onToggleTask={vi.fn()}
        onSendMessage={vi.fn()}
        onSelectCase={vi.fn()}
        onOpenUploadModal={vi.fn()}
      />
    );
    expect(document.body.textContent).toContain("CASE-AU-2026-01");
    expect(document.body.textContent).not.toContain("Elena Rostova");
    expect(document.body.textContent).not.toContain("Vanguard Immigration Law");
    fireEvent.click(screen.getByRole("button", { name: /Client Directory/i }));
    expect(document.body.textContent).toContain("Neha Kulkarni");
    unmountStaff();

    // 5. Retained Client signs into Client Portal and sees her own case, firm name, and uploaded passport
    const clientAuth = authenticateUser(
      "neha.kulkarni@proton.me",
      "client",
      "NehaPortalPassword2026!"
    );
    expect(clientAuth.success).toBe(true);
    window.localStorage.setItem("documento_user", JSON.stringify(clientAuth.user));

    const clientCases = (await api.getCases()).data;
    const clientDocs = (await api.getDocuments()).data;
    expect(clientCases.length).toBe(1);
    expect(clientCases[0].id).toBe(caseRes.data.id);

    render(
      <ClientPortal
        myCase={clientCases[0]}
        documents={clientDocs}
        messages={[]}
        notifications={[]}
        invoices={[]}
        currentUser={clientAuth.user}
        onOpenUploadModal={vi.fn()}
        onOpenQuestionnaireModal={vi.fn()}
        onSendMessage={vi.fn()}
        onMarkNotificationRead={vi.fn()}
      />
    );

    expect(document.body.textContent).toContain("CASE-AU-2026-01");
    expect(document.body.textContent).toContain("MapleCrest Immigration");
    expect(document.body.textContent).not.toContain("Vanguard Immigration Law");
    expect(document.body.textContent).not.toContain("Sarah Jenkins");
  });
});
