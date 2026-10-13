import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  CreateCaseModal,
  JURISDICTION_OPTIONS,
  JURISDICTION_PATHWAYS,
} from "../components/modals/CreateCaseModal";
import { api, FIXTURE_CLIENTS } from "../lib/api";

describe("Indian & High-Volume Global Pathway Checklists Integration", () => {
  it("exposes all target jurisdictions and pathways in CreateCaseModal definitions", () => {
    expect(JURISDICTION_OPTIONS.map((j) => j.value)).toContain("Canada (IRCC)");
    expect(JURISDICTION_OPTIONS.map((j) => j.value)).toContain("United States (USCIS)");
    expect(JURISDICTION_OPTIONS.map((j) => j.value)).toContain("United Kingdom (Home Office)");
    expect(JURISDICTION_OPTIONS.map((j) => j.value)).toContain("Australia (Home Affairs)");
    expect(JURISDICTION_OPTIONS.map((j) => j.value)).toContain("Germany (BAMF)");

    // Canada pathways
    const canadaValues = JURISDICTION_PATHWAYS["Canada (IRCC)"].map((p) => p.value);
    expect(canadaValues).toContain("Canada Study Permit");
    expect(canadaValues).toContain("Canada Visitor Visa (TRV)");
    expect(canadaValues).toContain("Canada Spousal Open Work Permit (SOWP)");
    expect(canadaValues).toContain("Express Entry PNP");

    // US pathways
    const usValues = JURISDICTION_PATHWAYS["United States (USCIS)"].map((p) => p.value);
    expect(usValues).toContain("EB-1A Extraordinary Ability");
    expect(usValues).toContain("US B-1/B-2 Visitor Visa");
    expect(usValues).toContain("US F-1 Academic Student");
    expect(usValues).toContain("H-1B Specialty Occupation");
    expect(usValues).toContain("US H-4 Dependent");

    // UK pathways
    const ukValues = JURISDICTION_PATHWAYS["United Kingdom (Home Office)"].map((p) => p.value);
    expect(ukValues).toContain("UK Standard Visitor Visa");
    expect(ukValues).toContain("UK Student Visa");
    expect(ukValues).toContain("UK Skilled Worker Visa");
  });

  it("dynamically switches available pathways when switching jurisdiction in CreateCaseModal", async () => {
    const handleCaseCreated = vi.fn();
    const handleClose = vi.fn();

    render(
      <CreateCaseModal
        isOpen={true}
        onClose={handleClose}
        clients={FIXTURE_CLIENTS}
        onCaseCreated={handleCaseCreated}
      />
    );

    // Initial jurisdiction is USCIS, EB-1A is selected
    expect(screen.getByText("Create New Immigration Case")).toBeDefined();
    const jurisdictionSelect = screen.getByLabelText(/Immigration Jurisdiction/i) as HTMLSelectElement;
    const pathwaySelect = screen.getByLabelText(/Pathway \/ Visa Category/i) as HTMLSelectElement;

    expect(jurisdictionSelect.value).toBe("United States (USCIS)");
    expect(pathwaySelect.value).toBe("EB-1A Extraordinary Ability");

    // Change jurisdiction to Canada (IRCC)
    fireEvent.change(jurisdictionSelect, { target: { value: "Canada (IRCC)" } });

    // Pathway automatically switches to first Canadian pathway: Canada Study Permit
    await waitFor(() => {
      expect(pathwaySelect.value).toBe("Canada Study Permit");
    });

    // Option for Canada Visitor TRV is now available in select
    expect(screen.getByText(/Canada Visitor Visa \(TRV & Super Visa\)/i)).toBeDefined();
    expect(screen.getByText(/Canada Spousal Open Work Permit \(SOWP\)/i)).toBeDefined();

    // Select Canada Visitor TRV
    fireEvent.change(pathwaySelect, { target: { value: "Canada Visitor Visa (TRV)" } });

    // Fill in title
    const titleInput = screen.getByPlaceholderText(/e.g. EB-1A Petition/i);
    fireEvent.change(titleInput, { target: { value: "Visitor Visa: Rajesh Patel & Family" } });

    // Submit form
    const createBtn = screen.getByText("Create Case Record");
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(handleCaseCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Visitor Visa: Rajesh Patel & Family",
          jurisdiction: "Canada (IRCC)",
          visa_category: "Canada Visitor Visa (TRV)",
        })
      );
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it("resolves Canada Study Permit statutory checklist with PAL, GIC, and LOA requirements", async () => {
    // Create a Canada Study Permit case via api
    const createRes = await api.createCase({
      client_id: FIXTURE_CLIENTS[0].id,
      title: "Study Permit: Aarav Sharma (University of Toronto)",
      case_number: "CASE-CA-STUDY-9901",
      jurisdiction: "Canada (IRCC)",
      visa_category: "Canada Study Permit",
    });

    const newCaseId = createRes.data.id;
    const checklistRes = await api.getCaseChecklist(newCaseId);

    expect(checklistRes.data.statutory_framework).toContain("IRPA § 30(1); IRPR Part 12");
    expect(checklistRes.data.visa_category).toBe("Canada Study Permit");

    const itemTitles = checklistRes.data.items.map((i) => i.title);
    expect(itemTitles).toContain("Designated Learning Institution (DLI) Letter of Acceptance (LOA)");
    expect(itemTitles).toContain("Provincial Attestation Letter (PAL 2024 Mandate)");
    expect(itemTitles).toContain("Guaranteed Investment Certificate (GIC $20,635 Minimum)");
    expect(itemTitles).toContain("SDS Language Proficiency Result (IELTS 6.0+ / PTE 60+)");
    expect(itemTitles).toContain("IRCC Upfront Medical Examination (eMedical Sheet)");
    expect(itemTitles).toContain("Primary Passport & Identity Travel Record");

    // All items mandatory
    expect(checklistRes.data.total_mandatory).toBe(6);
    expect(checklistRes.data.missing_items.length).toBe(6);
  });

  it("resolves US B-1/B-2 visitor checklist with DS-160, INA § 214(b) ties, and 3-year ITRs", async () => {
    const createRes = await api.createCase({
      client_id: FIXTURE_CLIENTS[1].id,
      title: "US B-1/B-2 Visitor Petition: Vikram Joshi",
      case_number: "CASE-US-B1B2-7712",
      jurisdiction: "United States (USCIS)",
      visa_category: "US B-1/B-2 Visitor Visa",
    });

    const checklistRes = await api.getCaseChecklist(createRes.data.id);

    expect(checklistRes.data.statutory_framework).toContain("INA § 101(a)(15)(B)");
    const itemCitations = checklistRes.data.items.map((i) => i.statutory_citation);

    expect(itemCitations).toContain("22 CFR § 41.103 - Online Visa Application");
    expect(itemCitations).toContain("INA § 214(b) - Economic Ties to India");
    expect(itemCitations).toContain("9 FAM 402.2-5 - Ability to Pay Travel Expenses");
    expect(itemCitations).toContain("INA § 214(b) - Employment Ties & Intent to Return");
  });

  it("resolves UK Student Visa checklist with CAS, 28-day maintenance funds, and TB screening", async () => {
    const createRes = await api.createCase({
      client_id: FIXTURE_CLIENTS[2].id,
      title: "UK Student Visa: Ananya Desai (Imperial College)",
      case_number: "CASE-UK-STU-4402",
      jurisdiction: "United Kingdom (Home Office)",
      visa_category: "UK Student Visa",
    });

    const checklistRes = await api.getCaseChecklist(createRes.data.id);

    expect(checklistRes.data.statutory_framework).toContain("Immigration Rules Appendix Student");
    const itemTitles = checklistRes.data.items.map((i) => i.title);

    expect(itemTitles).toContain("Confirmation of Acceptance for Studies (CAS) Reference");
    expect(itemTitles).toContain("28-Consecutive-Day Maintenance Funds Proof");
    expect(itemTitles).toContain("UKVI Approved Clinic Tuberculosis (TB) Screening Certificate");
    expect(itemTitles).toContain("Academic Qualifications & Certificates Listed on CAS");
  });

  it("resolves Canada Spousal Open Work Permit (SOWP) checklist with genuine marriage and RPO PCC", async () => {
    const createRes = await api.createCase({
      client_id: FIXTURE_CLIENTS[0].id,
      title: "Canada SOWP: Simran Kaur",
      case_number: "CASE-CA-SOWP-1122",
      jurisdiction: "Canada (IRCC)",
      visa_category: "Canada Spousal Open Work Permit (SOWP)",
    });

    const checklistRes = await api.getCaseChecklist(createRes.data.id);

    expect(checklistRes.data.statutory_framework).toContain("LMIA Exemption Code C41/C42");
    const itemTitles = checklistRes.data.items.map((i) => i.title);

    expect(itemTitles).toContain("Principal Spouse Valid Canadian Study / Work Permit");
    expect(itemTitles).toContain("Registered Marriage Certificate & Official Wedding Album");
    expect(itemTitles).toContain("Proof of Cohabitation & Intermingled Financial Affairs");
    expect(itemTitles).toContain("Police Clearance Certificate (PCC) from Regional Passport Office");
  });

  it("preserves exact backward compatibility for legacy EB-1A case-01 audit report", async () => {
    const checklistRes = await api.getCaseChecklist("case-01");

    expect(checklistRes.data.visa_category).toBe("EB-1A");
    expect(checklistRes.data.statutory_framework).toBe("8 CFR § 204.5(h)(3)");
    expect(checklistRes.data.fulfillment_percentage).toBe(71.4);
    expect(checklistRes.data.total_mandatory).toBe(2);
    expect(checklistRes.data.satisfied_mandatory).toBe(2);
    expect(checklistRes.data.missing_items).toContain(
      "Leading or Critical Role in Distinguished Organizations (8 CFR § 204.5(h)(3)(viii))"
    );
  });
});
