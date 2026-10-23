import { API_BASE_URL, getAuthHeaders, fallbackData } from "./client";

const API_BASE = API_BASE_URL;

export interface SOPFindingItem {
  dimension: string;
  severity: "critical" | "warning" | "info";
  issue_code: string;
  title: string;
  description: string;
  remediation: string;
  statutory_reference?: string | null;
}

export interface SOPAuditItem {
  overall_score: number;
  is_statutorily_sound: boolean;
  verdict: "HIGH_APPROVAL_POTENTIAL" | "NEEDS_REVISION" | "CRITICAL_STATUTORY_DEFICIENCY";
  jurisdiction: string;
  dimension_scores: {
    academic_progression: number;
    economic_home_ties: number;
    dual_intent_compliance: number;
    gap_justification: number;
    financial_clarity: number;
  };
  strengths: string[];
  findings: SOPFindingItem[];
  remediation_summary: string[];
}

export interface SOPAuditPayload {
  sop_text: string;
  jurisdiction?: string;
  applicant_profile?: Record<string, any>;
  has_study_gap?: boolean;
}

export const FALLBACK_SOP_AUDIT: SOPAuditItem = {
  overall_score: 84.5,
  is_statutorily_sound: true,
  verdict: "HIGH_APPROVAL_POTENTIAL",
  jurisdiction: "CA",
  dimension_scores: {
    academic_progression: 90.0,
    economic_home_ties: 85.0,
    dual_intent_compliance: 80.0,
    gap_justification: 85.0,
    financial_clarity: 82.5,
  },
  strengths: [
    "Clear articulation of academic curriculum progression and targeted skill acquisition.",
    "Strong references to home country family, property, and career opportunities.",
    "Affirmative compliance with IRPA s.22(2) temporary stay conditions.",
  ],
  findings: [],
  remediation_summary: [],
};

export async function auditSOP(payload: SOPAuditPayload, caseId?: string): Promise<SOPAuditItem> {
  const endpoint = caseId ? `${API_BASE}/cases/${caseId}/sop/audit` : `${API_BASE}/cases/sop/audit`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback
  }
  return fallbackData(FALLBACK_SOP_AUDIT, "auditSOP");
}
