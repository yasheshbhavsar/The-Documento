import { describe, it, expect } from "vitest";
import {
  auditSOP,
  FALLBACK_SOP_AUDIT,
  SOPAuditItem,
} from "../lib/api/sop";
import {
  fetchInvoices,
  calculateGST,
  FALLBACK_SERVICES,
} from "../lib/api/billing";
import {
  fetchCaseAppointments,
  FALLBACK_APPOINTMENTS,
} from "../lib/api/appointments";
import {
  fetchCaseSponsors,
  FALLBACK_SPONSORS,
} from "../lib/api/sponsors";
import {
  getAuthHeaders,
  getAccessToken,
  setAccessToken,
  fallbackData,
} from "../lib/api/client";
import {
  auditSOP as backwardCompatAuditSOP,
  fetchInvoices as backwardCompatFetchInvoices,
} from "../lib/api";

describe("Phase 3 Modular API & SOP Evaluation System", () => {
  it("imports modular billing, appointments, sponsors, and SOP functions directly", () => {
    expect(typeof fetchInvoices).toBe("function");
    expect(typeof calculateGST).toBe("function");
    expect(typeof fetchCaseAppointments).toBe("function");
    expect(typeof fetchCaseSponsors).toBe("function");
    expect(typeof auditSOP).toBe("function");
    expect(Array.isArray(FALLBACK_SERVICES)).toBe(true);
    expect(Array.isArray(FALLBACK_APPOINTMENTS)).toBe(true);
    expect(Array.isArray(FALLBACK_SPONSORS)).toBe(true);
  });

  it("maintains 100% backward compatibility for imports from @/lib/api", () => {
    expect(typeof backwardCompatAuditSOP).toBe("function");
    expect(typeof backwardCompatFetchInvoices).toBe("function");
  });

  it("evaluates statement of purpose (SOP) via fallback when offline", async () => {
    const res = await auditSOP({
      sop_text: "I am applying for a master degree in artificial intelligence at University of Toronto...",
      jurisdiction: "CA",
    });

    expect(res).toBeDefined();
    expect(res.overall_score).toBeGreaterThanOrEqual(80.0);
    expect(res.is_statutorily_sound).toBe(true);
    expect(res.verdict).toBe("HIGH_APPROVAL_POTENTIAL");
    expect(res.jurisdiction).toBe("CA");
    expect(res.dimension_scores.academic_progression).toBeGreaterThan(0);
    expect(res.dimension_scores.economic_home_ties).toBeGreaterThan(0);
    expect(res.dimension_scores.dual_intent_compliance).toBeGreaterThan(0);
    expect(Array.isArray(res.strengths)).toBe(true);
  });

  it("supports authentication headers generation and access token caching in modular client", () => {
    setAccessToken("test_mock_jwt_token_12345");
    expect(getAccessToken()).toBe("test_mock_jwt_token_12345");

    const headers = getAuthHeaders("company_admin");
    expect(headers["Authorization"]).toBe("Bearer test_mock_jwt_token_12345");
    expect(headers["X-User-Role"]).toBe("company_admin");

    setAccessToken(null);
    const headersNoToken = getAuthHeaders("company_admin");
    expect(headersNoToken["Authorization"]).toBeUndefined();
  });
});
