import { describe, it, expect } from "vitest";
import { formatCurrency } from "../components/billing/BillingManager";
import {
  calculateGST,
  fetchCaseAppointments,
  createCaseAppointment,
  updateCaseAppointment,
  fetchCaseSponsors,
  createCaseSponsor,
} from "../lib/api";

describe("Phase 2 — Commercial & Operational Readiness", () => {
  describe("Multi-Currency & SAC 998311 Invoicing Formatter", () => {
    it("formats Indian Rupee (INR) amounts correctly using en-IN grouping and ₹ symbol", () => {
      const formatted = formatCurrency(1250000, "INR");
      expect(formatted).toContain("₹");
      expect(formatted).toContain("12,50,000.00");
    });

    it("formats USD, CAD, and GBP amounts correctly with their respective symbols", () => {
      expect(formatCurrency(4250, "USD")).toBe("$4,250.00");
      expect(formatCurrency(3500, "CAD")).toBe("CA$3,500.00");
      expect(formatCurrency(2800, "GBP")).toBe("£2,800.00");
    });

    it("calculates statutory 18% GST (CGST 9% + SGST 9%) for intra-state supply", async () => {
      const result = await calculateGST(100000, false, 0.18);
      expect(result.subtotal).toBe(100000);
      expect(result.cgst_amount).toBe(9000);
      expect(result.sgst_amount).toBe(9000);
      expect(result.igst_amount).toBe(0);
      expect(result.tax_amount).toBe(18000);
      expect(result.total_with_tax).toBe(118000);
      expect(result.is_interstate).toBe(false);
    });

    it("calculates statutory 18% IGST for inter-state supply", async () => {
      const result = await calculateGST(50000, true, 0.18);
      expect(result.subtotal).toBe(50000);
      expect(result.cgst_amount).toBe(0);
      expect(result.sgst_amount).toBe(0);
      expect(result.igst_amount).toBe(9000);
      expect(result.tax_amount).toBe(9000);
      expect(result.total_with_tax).toBe(59000);
      expect(result.is_interstate).toBe(true);
    });
  });

  describe("Visa Appointments & VAC Logistics Desk Client", () => {
    it("retrieves fallback appointment records for active cases", async () => {
      const appts = await fetchCaseAppointments("case-01");
      expect(Array.isArray(appts)).toBe(true);
      expect(appts.length).toBeGreaterThan(0);
      const appt = appts[0];
      expect(appt.vac_center).toBeDefined();
      expect(appt.consular_post).toBeDefined();
      expect(appt.appointment_status).toBeDefined();
    });

    it("creates a new appointment with Blue Dart tracking and courier status", async () => {
      const newAppt = await createCaseAppointment("case-01", {
        vac_center: "VFS Ahmedabad VAC",
        consular_post: "US Embassy New Delhi",
        tracking_number_blue_dart: "BD7788990011IN",
        courier_status: "in_transit_blue_dart",
        appointment_status: "scheduled",
      });
      expect(newAppt.vac_center).toBe("VFS Ahmedabad VAC");
      expect(newAppt.tracking_number_blue_dart).toBe("BD7788990011IN");
      expect(newAppt.courier_status).toBe("in_transit_blue_dart");
    });

    it("updates appointment courier status upon delivery", async () => {
      const updated = await updateCaseAppointment("case-01", "appt-01", {
        courier_status: "delivered_applicant",
        appointment_status: "completed",
      });
      expect(updated.courier_status).toBe("delivered_applicant");
      expect(updated.appointment_status).toBe("completed");
    });
  });

  describe("Financial Sponsor & Indian KYC Model Client", () => {
    it("retrieves financial sponsors for an active case", async () => {
      const sponsors = await fetchCaseSponsors("case-01");
      expect(Array.isArray(sponsors)).toBe(true);
      expect(sponsors.length).toBeGreaterThan(0);
      expect(sponsors[0].name).toBe("Rajesh Kumar Sharma");
      expect(sponsors[0].pan).toBe("ABCPS1234F");
      expect(sponsors[0].liquid_funds).toBe(4500000);
      expect(sponsors[0].loan_sanction_amount).toBe(3500000);
    });

    it("creates a new financial sponsor with ITR gross income and education loan details", async () => {
      const newSponsor = await createCaseSponsor("case-01", {
        name: "Sunita Patel",
        relationship: "Mother",
        sponsor_type: "parent",
        pan: "ABCDE9876K",
        itr_gross_income: 950000,
        liquid_funds: 1500000,
        currency: "INR",
        bank_name: "HDFC Bank",
        loan_sanction_amount: 0,
      });
      expect(newSponsor.name).toBe("Sunita Patel");
      expect(newSponsor.relationship).toBe("Mother");
      expect(newSponsor.pan).toBe("ABCDE9876K");
      expect(newSponsor.liquid_funds).toBe(1500000);
      expect(newSponsor.bank_name).toBe("HDFC Bank");
    });
  });
});
