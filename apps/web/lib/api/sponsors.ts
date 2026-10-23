import { FinancialSponsor } from "../types";
import { API_BASE_URL, getAuthHeaders, fallbackData } from "./client";

const API_BASE = API_BASE_URL;

export const FALLBACK_SPONSORS: FinancialSponsor[] = [
  {
    id: "sp-01",
    organization_id: "org-01",
    case_id: "case-01",
    client_id: "client-01",
    name: "Rajesh Kumar Sharma",
    relationship: "parent",
    sponsor_type: "individual",
    pan: "ABCPS1234F",
    itr_gross_income: 2850000.0,
    liquid_funds: 4500000.0,
    currency: "INR",
    bank_name: "State Bank of India (SBI)",
    loan_sanction_amount: 3500000.0,
    affidavit_doc_id: null,
    notes: "Primary financial sponsor with verified ITR-V past 3 years and SBI education loan sanction letter.",
    created_at: "2026-10-12T10:00:00Z",
    updated_at: "2026-10-12T10:00:00Z",
  },
];

export async function fetchCaseSponsors(caseId: string): Promise<FinancialSponsor[]> {
  try {
    const res = await fetch(`${API_BASE}/cases/${caseId}/sponsors`, {
      headers: getAuthHeaders(),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback
  }
  return fallbackData(
    FALLBACK_SPONSORS.filter((s) => s.case_id === caseId || caseId === "case-01" || caseId === "case-02"),
    "fetchCaseSponsors"
  );
}

export async function createCaseSponsor(caseId: string, data: any): Promise<FinancialSponsor> {
  try {
    const res = await fetch(`${API_BASE}/cases/${caseId}/sponsors`, {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback
  }
  const newSponsor: FinancialSponsor = {
    id: `sp-${Date.now()}`,
    organization_id: "org-01",
    case_id: caseId,
    client_id: data.client_id || "client-01",
    name: data.name || "Sponsor Name",
    relationship: data.relationship || "parent",
    sponsor_type: data.sponsor_type || "individual",
    pan: data.pan || null,
    itr_gross_income: Number(data.itr_gross_income || 0),
    liquid_funds: Number(data.liquid_funds || 0),
    currency: data.currency || "INR",
    bank_name: data.bank_name || null,
    loan_sanction_amount: Number(data.loan_sanction_amount || 0),
    affidavit_doc_id: data.affidavit_doc_id || null,
    notes: data.notes || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  return fallbackData(newSponsor, "createCaseSponsor");
}

export async function deleteCaseSponsor(caseId: string, sponsorId: string): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/cases/${caseId}/sponsors/${sponsorId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (res.ok) return;
  } catch {
    // Fallback
  }
  return fallbackData(undefined, "deleteCaseSponsor");
}
