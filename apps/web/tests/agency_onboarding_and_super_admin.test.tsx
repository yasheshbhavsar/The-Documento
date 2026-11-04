import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AgencyOnboardingWizard } from "../components/agency/AgencyOnboardingWizard";
import { SuperAdminControlPlane } from "../components/admin/SuperAdminControlPlane";
import { AgencyGrowthAndSetupDesk } from "../components/agency/AgencyGrowthAndSetupDesk";
import { PrCalculatorsHubView } from "../components/tools/PrCalculatorsHubView";
import { AustraliaSkillSelectTool } from "../components/tools/AustraliaSkillSelectTool";
import { CreateClientModal } from "../components/modals/CreateClientModal";
import {
  CalculatorAgencyLeadRecord,
  adjudicateAgencyKybApplication,
  computePlatformOverview,
  exportPartnerAgenciesCsv,
  getAgencyApplications,
  getAgencyTeamInvites,
  getAgencyTenants,
  getCalculatorAgencyLeads,
} from "../lib/agencyPlatformStore";
import { authenticateUser, DEMO_USERS } from "../lib/auth";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

describe("Visa Agency KYB Onboarding, Documento HQ Super-Admin & Co-Branded Calculator Lead Bridge", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("completes the 3-step real-world agency signup with certificate upload & password, isolates Day-1 workspace, and leaks zero HQ links", async () => {
    const { container, unmount } = render(<AgencyOnboardingWizard />);

    // Step 1 validation check when empty
    fireEvent.click(screen.getByRole("button", { name: /Continue to License & Proof/i }));
    expect(screen.getByRole("alert").textContent).toContain("full name");

    // Fill Step 1: Owner Login & Firm Profile
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

    // Step 2: Practice Licensing & Real File Upload
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

    // Step 3: Visa Corridors & 14-Day Trial — submitting before checking Partner Terms must alert
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

    // Zero internal /super-admin links leaked on customer-facing confirmation page
    expect(container.innerHTML).not.toContain("/super-admin");

    // Verify application & uploaded KYB evidence persisted
    const queued = getAgencyApplications();
    const match = queued.find((a) => a.requestedSlug === "northstar-rcic");
    expect(match).toBeDefined();
    expect(match?.regulatoryBody).toBe("CICC");
    expect(match?.licenseNumber).toBe("R719804");
    expect(match?.uploadedDocuments?.length).toBe(1);
    expect(match?.uploadedDocuments?.[0].fileName).toBe("CICC_Certificate_R719804.pdf");

    // Agency owner can sign back in with the exact password they created into their OWN isolated workspace
    const wrongPass = authenticateUser("priya@northstarrcic.ca", "firm", "WrongPass!");
    expect(wrongPass.success).toBe(false);

    const sandboxLogin = authenticateUser("priya@northstarrcic.ca", "firm", "NorthStarPass2026!");
    expect(sandboxLogin.success).toBe(true);
    expect(sandboxLogin.user?.organization_id).toBe("sandbox-northstar-rcic");
    expect(sandboxLogin.user?.is_sandbox_agency).toBe(true);
    unmount();

    // Launchpad shows NorthStar RCIC's own brand & uploaded file (never Vanguard Immigration Law)
    render(<AgencyGrowthAndSetupDesk currentUser={sandboxLogin.user} />);
    const deskText = screen.getByTestId("agency-growth-setup-desk").textContent || "";
    expect(deskText).toContain("NorthStar RCIC");
    expect(deskText).toContain("CICC_Certificate_R719804.pdf");
    expect(deskText).not.toContain("Vanguard Immigration Law");
  });

  it("reconciles HQ Control Plane KPIs, inspects KYB evidence, provisions a verified agency in 1 click, enables owner sign-in, and enforces Emergency Freeze", () => {
    const initialOverview = computePlatformOverview(getAgencyTenants(), getAgencyApplications());
    expect(initialOverview.zeroPiiBoundaryEnforced).toBe(true);
    expect(initialOverview.activeAgenciesCount).toBe(5);
    expect(initialOverview.recurringMrrUsd).toBe(2387);
    expect(initialOverview.pendingKybCount).toBe(2);

    render(<SuperAdminControlPlane />);

    fireEvent.click(screen.getByTestId("hq-instant-auth-btn"));
    expect(screen.getByText(/Zero-PII Boundary Sealed/i)).toBeDefined();

    // Navigate to KYB Verification Desk and inspect uploaded PDF evidence + 4-point checklist
    fireEvent.click(screen.getByRole("button", { name: /KYB Verification Desk/i }));
    expect(screen.getByTestId("kyb-adjudication-panel").textContent).toContain(
      "MapleCrest Regulated Immigration Inc."
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
    expect(afterProvisionOverview.activeAgenciesCount).toBe(6);
    expect(afterProvisionOverview.recurringMrrUsd).toBe(2886);
    expect(afterProvisionOverview.pendingKybCount).toBe(1);

    const provisionedTenant = getAgencyTenants().find((t) => t.slug === "maplecrest-rcic");
    expect(provisionedTenant).toBeDefined();
    const loginOk = authenticateUser(
      "amrit.grewal@maplecrestimmigration.ca",
      "firm",
      provisionedTenant?.temporaryPassword || "DocPartner!"
    );
    expect(loginOk.success).toBe(true);
    expect(loginOk.user?.organization_id).toBe("ten-maplecrest-rcic");

    fireEvent.click(screen.getByRole("button", { name: /Partner Agencies/i }));
    const freezeButtons = screen.getAllByRole("button", { name: "Freeze" });
    fireEvent.click(freezeButtons[0]);

    const loginBlocked = authenticateUser(
      "amrit.grewal@maplecrestimmigration.ca",
      "firm",
      provisionedTenant?.temporaryPassword || "DocPartner!"
    );
    expect(loginBlocked.success).toBe(false);
    expect(loginBlocked.error).toContain("Workspace Frozen");
  });

  it("supports HQ sales-led agency provisioning, SWIFT wire invoice settlement (upgrading Indus 6->18 seats), support replies, and live statutory broadcasts", () => {
    const { unmount } = render(<SuperAdminControlPlane />);
    fireEvent.click(screen.getByTestId("hq-instant-auth-btn"));

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

    // Reconciled MRR: $2,387 + $850 = $3,237
    expect(computePlatformOverview(getAgencyTenants(), getAgencyApplications()).recurringMrrUsd).toBe(
      3237
    );
    const salesTenant = getAgencyTenants().find((t) => t.slug === "pacific-rim-visas");
    expect(salesTenant?.seatLimit).toBe(25);
    expect(
      authenticateUser("daniel@pacificrimlaw.ca", "firm", salesTenant?.temporaryPassword || "").success
    ).toBe(true);

    // 2. Billing & Trials: Settle Indus PR Pathways' SWIFT Wire Upgrade (INV-2026-1104)
    fireEvent.click(screen.getByRole("button", { name: /Billing & Trials/i }));
    expect(screen.getByTestId("hq-billing-ops-view")).toBeDefined();
    fireEvent.click(screen.getByTestId("settle-invoice-btn-INV-2026-1104"));

    // Indus upgrades from Boutique ($199, 6 seats) -> Growth ($499, 18 seats): MRR $3,237 + $300 = $3,537
    const indusAfter = getAgencyTenants().find((t) => t.organizationId === "ten-indus");
    expect(indusAfter?.seatLimit).toBe(18);
    expect(indusAfter?.mrrUsd).toBe(499);
    expect(computePlatformOverview(getAgencyTenants(), getAgencyApplications()).recurringMrrUsd).toBe(
      3537
    );

    // 3. Support & Rules: Reply to SUP-4091 and publish a live Canada rule bulletin
    fireEvent.click(screen.getByRole("button", { name: /Support & Rules/i }));
    fireEvent.change(screen.getByTestId("hq-ticket-reply-input-SUP-4091"), {
      target: { value: "Wire INV-2026-1104 settled — 18 Growth seats are now unlocked." },
    });
    fireEvent.click(screen.getByTestId("hq-resolve-ticket-btn-SUP-4091"));

    fireEvent.change(screen.getByTestId("hq-broadcast-title-input"), {
      target: { value: "IRCC French Category Draw #325 — 478 CRS Cutoff Live" },
    });
    fireEvent.change(screen.getByTestId("hq-broadcast-summary-input"), {
      target: { value: "Updated French NCLC 7+ category threshold across Canada CRS calculators." },
    });
    fireEvent.click(screen.getByTestId("hq-publish-broadcast-btn"));
    unmount();

    // 4. Verify published statutory bulletin & paralegal invite inside Agency Launchpad
    render(<AgencyGrowthAndSetupDesk currentUser={DEMO_USERS.master_admin} />);
    expect(screen.getByTestId("agency-statutory-bulletins").textContent).toContain(
      "IRCC French Category Draw #325"
    );

    fireEvent.change(screen.getByPlaceholderText(/Simran Kaur/i), {
      target: { value: "Simran Kaur" },
    });
    fireEvent.change(screen.getByPlaceholderText(/simran@yourfirm\.com/i), {
      target: { value: "simran@vanguardlegal.ca" },
    });
    fireEvent.click(screen.getByTestId("invite-agency-staff-btn"));

    const invites = getAgencyTeamInvites("ten-vanguard");
    expect(invites.length).toBe(1);
    const staffAuth = authenticateUser("simran@vanguardlegal.ca", "firm", invites[0].passcode);
    expect(staffAuth.success).toBe(true);
    expect(staffAuth.user?.organization_id).toBe("ten-vanguard");
    expect(staffAuth.user?.experience).toBe("paralegal");
  });

  it("captures co-branded PR calculator leads (?agency=vanguard-legal) into the Managing Partner desk and governs 2-hour Break-Glass tokens", () => {
    const { unmount } = render(<PrCalculatorsHubView initialAgencySlug="vanguard-legal" />);

    const banner = screen.getByTestId("cobranded-agency-banner");
    expect(banner.textContent).toContain("Vanguard Immigration Law");
    expect(banner.textContent).toContain("R708412");

    fireEvent.click(screen.getByTestId("open-cobranded-lead-form-btn"));
    fireEvent.change(screen.getByLabelText(/Applicant Full Name/i), {
      target: { value: "Rohan Deshmukh" },
    });
    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: "rohan.deshmukh@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/Calculated Score Summary/i), {
      target: { value: "531 CRS (CLB 10 + Canadian STEM Master's)" },
    });
    fireEvent.click(screen.getByTestId("submit-cobranded-lead-btn"));

    expect(screen.getByTestId("cobranded-lead-confirmation").textContent).toContain("531 CRS");
    unmount();

    const vanguardLeads = getCalculatorAgencyLeads("ten-vanguard");
    expect(vanguardLeads.some((l) => l.applicantEmail === "rohan.deshmukh@example.com")).toBe(true);

    render(<AgencyGrowthAndSetupDesk currentUser={DEMO_USERS.master_admin} />);
    expect(screen.getByTestId("agency-growth-setup-desk").textContent).toContain(
      "Rohan Deshmukh"
    );
    expect(screen.getByTestId("cobranded-calculator-url").textContent).toContain(
      "/calculators?agency=vanguard-legal"
    );

    expect(computePlatformOverview(getAgencyTenants(), getAgencyApplications()).activeSupportGrantsCount).toBe(0);
    fireEvent.click(screen.getByTestId("issue-break-glass-btn"));
    expect(computePlatformOverview(getAgencyTenants(), getAgencyApplications()).activeSupportGrantsCount).toBe(1);

    fireEvent.click(screen.getByTestId("revoke-break-glass-btn"));
    expect(computePlatformOverview(getAgencyTenants(), getAgencyApplications()).activeSupportGrantsCount).toBe(0);
  });

  it("supports live KYB dossier lookup (KYB-71B04E88) and clarification resubmission back to HQ pending_kyb", () => {
    render(<AgencyOnboardingWizard />);

    fireEvent.change(screen.getByLabelText(/KYB Dossier Code or Work Email/i), {
      target: { value: "KYB-71B04E88" },
    });
    fireEvent.click(screen.getByTestId("kyb-dossier-lookup-btn"));

    expect(screen.getByTestId("kyb-lookup-result-card").textContent).toContain("Crescent Global Visas");
    expect(screen.getByTestId("kyb-lookup-status-badge").textContent).toBe("CLARIFICATION REQUESTED");
    expect(screen.getByTestId("kyb-lookup-result-card").textContent).toContain(
      "please provide co-counsel RCIC/SRA registration number"
    );

    fireEvent.change(screen.getByLabelText(/Co-Counsel Retainer \/ Registry Clarification Details/i), {
      target: { value: "Co-counsel retainer executed with Sarah Jenkins, RCIC #R708412 (Nov 2026)." },
    });
    fireEvent.click(screen.getByTestId("kyb-submit-clarification-btn"));

    expect(screen.getByTestId("kyb-lookup-status-badge").textContent).toBe("PENDING KYB");
    expect(screen.getByTestId("kyb-clarification-success").textContent).toContain("PENDING KYB");

    const overviewAfter = computePlatformOverview(getAgencyTenants(), getAgencyApplications());
    expect(overviewAfter.pendingKybCount).toBe(3);
    expect(overviewAfter.clarificationKybCount).toBe(0);
  });

  it("embeds co-branded partner scorecard capture inside individual PR calculators (?agency=vanguard-legal), blocks 0-point submissions, and renders Consultation Booking CTA", () => {
    window.history.replaceState({}, "", "/calculators/australia-pr?agency=vanguard-legal");

    render(<AustraliaSkillSelectTool />);

    const widget = screen.getByTestId("cobranded-calculator-lead-widget");
    expect(widget.textContent).toContain("Vanguard Immigration Law");
    expect(screen.getByTestId("cobranded-live-score-badge").textContent).toContain("0 pts");

    const submitBtn = screen.getByRole("button", {
      name: /Transmit Verified Scorecard to Vanguard Immigration Law/i,
    }) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/Age at the time you are invited to apply/i), {
      target: { value: "25_to_32" },
    });
    fireEvent.change(screen.getByLabelText(/English language proficiency level/i), {
      target: { value: "superior" },
    });

    expect(screen.getByTestId("cobranded-live-score-badge").textContent).toContain("50 pts");
    expect(submitBtn.disabled).toBe(false);

    fireEvent.change(screen.getByLabelText(/^Applicant full name$/i), {
      target: { value: "Liam O'Connor" },
    });
    fireEvent.change(screen.getByLabelText(/^Applicant email address$/i), {
      target: { value: "liam.oconnor@sydneytech.au" },
    });
    fireEvent.click(submitBtn);

    expect(screen.getByTestId("cobranded-lead-submitted-banner").textContent).toContain("50 pts");
    expect(screen.getByTestId("cobranded-book-consultation-link").getAttribute("href")).toBe(
      "https://vanguardlegal.com/book-pr-strategy"
    );

    const vanguardLeads = getCalculatorAgencyLeads("ten-vanguard");
    expect(
      vanguardLeads.some(
        (l) => l.applicantEmail === "liam.oconnor@sydneytech.au" && l.scoreSummary.includes("50 pts")
      )
    ).toBe(true);

    window.history.replaceState({}, "", "/");
  });

  it("enforces >=5 char compliance note on KYB clarification/rejection, blocks duplicate approval, and exports Zero-PII CSV ledger", () => {
    render(<SuperAdminControlPlane />);
    fireEvent.click(screen.getByTestId("hq-instant-auth-btn"));
    fireEvent.click(screen.getByRole("button", { name: /KYB Verification Desk/i }));

    fireEvent.click(screen.getByRole("button", { name: /Request Clarification/i }));
    expect(screen.getByTestId("kyb-decision-error").textContent).toContain("at least 5 characters");

    const targetAppId = getAgencyApplications()[0].id;
    fireEvent.click(screen.getByTestId("approve-provision-kyb-btn"));
    expect(getAgencyTenants().length).toBe(6);

    const secondOutcome = adjudicateAgencyKybApplication(
      targetAppId,
      "approve",
      "Duplicate click",
      "hq.admin@documento.ai"
    );
    expect(secondOutcome.provisionedTenant?.organizationId).toBe("ten-maplecrest-rcic");
    expect(getAgencyTenants().length).toBe(6);
    expect(computePlatformOverview(getAgencyTenants(), getAgencyApplications()).recurringMrrUsd).toBe(2886);

    const csv = exportPartnerAgenciesCsv(getAgencyTenants());
    expect(csv).toContain("Organization ID,Trading Name,Legal Entity Name,Workspace Slug");
    expect(csv).toContain("Vanguard Immigration Law");
    expect(csv).not.toContain("neha.kulkarni@proton.me");
  });

  it("passes full lead scorecard prefill into CreateClientModal when clicking Convert to Client", () => {
    let capturedLead: CalculatorAgencyLeadRecord | null = null;
    const { unmount } = render(
      <AgencyGrowthAndSetupDesk
        currentUser={DEMO_USERS.master_admin}
        onConvertLeadToClient={(lead) => {
          capturedLead = lead;
        }}
      />
    );

    const convertBtns = screen.getAllByRole("button", { name: /Convert to Client/i });
    fireEvent.click(convertBtns[0]);
    expect(capturedLead).not.toBeNull();
    expect(capturedLead!.applicantName).toBe("Neha Kulkarni");
    expect(capturedLead!.applicantEmail).toBe("neha.kulkarni@proton.me");
    unmount();

    const parts = capturedLead!.applicantName.split(/\s+/);
    render(
      <CreateClientModal
        isOpen={true}
        onClose={() => {}}
        onClientCreated={() => {}}
        initialPrefill={{
          firstName: parts[0],
          lastName: parts.slice(1).join(" "),
          email: capturedLead!.applicantEmail,
          phone: capturedLead!.applicantPhone,
          leadScoreNote: `${capturedLead!.calculatorTitle} — ${capturedLead!.scoreSummary}`,
        }}
      />
    );

    expect(screen.getByTestId("lead-prefill-banner").textContent).toContain("524 CRS");
    expect((screen.getByDisplayValue("Neha") as HTMLInputElement).value).toBe("Neha");
    expect((screen.getByDisplayValue("Kulkarni") as HTMLInputElement).value).toBe("Kulkarni");
    expect((screen.getByDisplayValue("neha.kulkarni@proton.me") as HTMLInputElement).value).toBe(
      "neha.kulkarni@proton.me"
    );
  });
});
