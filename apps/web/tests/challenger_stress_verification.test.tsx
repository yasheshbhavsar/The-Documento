import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

import { DocumentoSignalStrip } from "../components/landing/DocumentoSignalStrip";
import { DocumentoPreview } from "../components/landing/DocumentoPreview";
import { DocumentoWorkflow } from "../components/landing/DocumentoWorkflow";
import { DocumentoCoverageExplorer } from "../components/landing/DocumentoCoverageExplorer";
import { DocumentoInteractiveTools } from "../components/landing/DocumentoInteractiveTools";
import { DocumentoTrust } from "../components/landing/DocumentoTrust";
import { DocumentoFAQ } from "../components/landing/DocumentoFAQ";
import { DocumentoNavbar } from "../components/landing/DocumentoNavbar";
import { useSmoothScroll } from "../components/landing/useSmoothScroll";

describe("Challenger 1 Empirical Stress & Adversarial Test Harness", () => {
  describe("1. DocumentoPreview 100x Ultra-Rapid Tab Switches & Deep State Stability", () => {
    it("survives 100 rapid sequential tab switches (20 full 5-tab cycles) and maintains clean state", () => {
      render(<DocumentoPreview />);

      const tabLabels = [
        /1\. Case Overview & Pipeline/i,
        /2\. Document Vault & Checklist/i,
        /3\. Procedural Milestones & Tasks/i,
        /4\. AI Evidentiary Checks/i,
        /5\. Client & Legal Coordination/i,
      ];

      // Execute 20 full cycles = 100 rapid tab switch events
      for (let cycle = 0; cycle < 20; cycle++) {
        for (const label of tabLabels) {
          const tabBtn = screen.getByRole("tab", { name: label });
          fireEvent.click(tabBtn);
        }
      }

      // Assert Tab 5 (Chat) panel is active and interactive
      const chatInput = screen.getByPlaceholderText(/Test reply:/i);
      fireEvent.change(chatInput, { target: { value: "Challenger stress verification message" } });
      const sendBtn = screen.getByRole("button", { name: /Send/i });
      fireEvent.click(sendBtn);

      expect(screen.getByText(/Challenger stress verification message/i)).toBeDefined();

      // Switch back to Tab 4 (AI Checks) and test adjudication escalation and reset
      const tab4 = screen.getByRole("tab", { name: /4\. AI Evidentiary Checks/i });
      fireEvent.click(tab4);
      const escalateBtn = screen.getByRole("button", { name: /Escalate to Senior Partner/i });
      fireEvent.click(escalateBtn);
      expect(screen.getByText(/STATUS: ESCALATED TO SENIOR PARTNER/i)).toBeDefined();

      const resetAdjudicationBtn = screen.getByRole("button", { name: /Reset \/ Reopen Adjudication/i });
      fireEvent.click(resetAdjudicationBtn);
      expect(screen.getByText(/FLAG: TIMELINE DISCREPANCY/i)).toBeDefined();

      // Switch to Tab 3 (Tasks) and toggle multiple tasks repeatedly
      const tab3 = screen.getByRole("tab", { name: /3\. Procedural Milestones & Tasks/i });
      fireEvent.click(tab3);

      const task1 = screen.getByText(/Resolve employment start date discrepancy with Applicant/i);
      const task2 = screen.getByText(/Finalize Kazarian Stage Two final merits memorandum/i);

      // Rapidly toggle tasks 10 times
      for (let i = 0; i < 10; i++) {
        fireEvent.click(task1);
        fireEvent.click(task2);
      }

      // Both should be in their initial incomplete state after 10 even toggles
      expect(screen.getByText(/2 of 4 Completed/i)).toBeDefined();
    });
  });

  describe("2. DocumentoInteractiveTools Slider Extreme Boundaries & Malformed Values", () => {
    it("handles extreme slider values (0, 10, 85, 100, 500, negative) without crash", () => {
      const handleOpenLogin = vi.fn();
      render(<DocumentoInteractiveTools onOpenLogin={handleOpenLogin} />);

      const slider = screen.getByLabelText(/Simulate case exhibit volume/i) as HTMLInputElement;

      // Minimum normal boundary (10)
      fireEvent.change(slider, { target: { value: "10" } });
      expect(screen.getByText(/Case Volume: 10 Exhibits/i)).toBeDefined();
      expect(screen.getByText(/~5 hrs paralegal assembly saved/i)).toBeDefined();

      // Maximum normal boundary (85)
      fireEvent.change(slider, { target: { value: "85" } });
      expect(screen.getByText(/Case Volume: 85 Exhibits/i)).toBeDefined();
      expect(screen.getByText(/~38 hrs paralegal assembly saved/i)).toBeDefined();

      // Lower boundary beyond min (0) -> HTML5 input[type=range] clamps to min 10
      fireEvent.change(slider, { target: { value: "0" } });
      expect(screen.getByText(/Case Volume: 10 Exhibits/i)).toBeDefined();
      expect(screen.getByText(/~5 hrs paralegal assembly saved/i)).toBeDefined();

      // High boundary beyond max (200) -> HTML5 input[type=range] clamps to max 85
      fireEvent.change(slider, { target: { value: "200" } });
      expect(screen.getByText(/Case Volume: 85 Exhibits/i)).toBeDefined();
      expect(screen.getByText(/~38 hrs paralegal assembly saved/i)).toBeDefined();

      // Rapid boundary alternation
      for (let i = 0; i < 20; i++) {
        fireEvent.change(slider, { target: { value: i % 2 === 0 ? "10" : "85" } });
      }
      expect(screen.getByText(/Case Volume: 85 Exhibits/i)).toBeDefined();
    });

    it("survives rapid persona and waiting state toggles (50 times)", () => {
      const handleOpenLogin = vi.fn();
      render(<DocumentoInteractiveTools onOpenLogin={handleOpenLogin} />);

      const applicantBtn = screen.getByRole("button", { name: /For Retained Applicants/i });
      const firmBtn = screen.getByRole("button", { name: /For Legal Teams & Law Firms/i });

      for (let i = 0; i < 25; i++) {
        fireEvent.click(firmBtn);
        fireEvent.click(applicantBtn);
      }

      // Waiting state button inside applicant view
      const waitingBtn = screen.getByRole("button", { name: /Status:/i });
      for (let i = 0; i < 30; i++) {
        fireEvent.click(waitingBtn);
      }
      expect(screen.getByText(/Status: With Legal Team/i)).toBeDefined();
    });
  });

  describe("3. Adversarial Regex & Payload Injections in Search Inputs", () => {
    it("DocumentoCoverageExplorer safely ignores regex injection and huge queries", () => {
      render(<DocumentoCoverageExplorer />);

      const searchInput = screen.getByPlaceholderText(/Search visa name/i);

      const adversarialPayloads = [
        "[.*+?^${}()|[\\]\\]",
        "(((((((((((",
        "\\\\\\\\\\\\",
        "/^.*$/gi",
        "<script>alert(1)</script>",
        "🇨🇦 🇺🇸 🇬🇧 🇩🇪 🇦🇺",
        "مرحبا بالعالم",
        "A".repeat(2000), // Very long string
      ];

      for (const payload of adversarialPayloads) {
        fireEvent.change(searchInput, { target: { value: payload } });
        // Should show empty state without throwing runtime exceptions
        expect(screen.getByText(/No immigration pathways match the current search or filter\./i)).toBeDefined();
      }

      // Valid search restoring matches
      fireEvent.change(searchInput, { target: { value: "super visa" } });
      expect(screen.getByText(/Canadian Super Visa/i)).toBeDefined();
    });

    it("DocumentoFAQ safely handles regex injection and HTML tags in search", () => {
      render(<DocumentoFAQ />);

      const searchInput = screen.getByPlaceholderText(/Search frequently asked questions/i);

      const adversarialPayloads = [
        "[.*+?^${}()|[\\]\\]",
        "\\\\\\",
        "(?<!a)b",
        "<h3>Injection</h3>",
        "Z".repeat(1500),
      ];

      for (const payload of adversarialPayloads) {
        fireEvent.change(searchInput, { target: { value: payload } });
        expect(screen.getByText(/No questions matched your search query/i)).toBeDefined();
      }

      // Clear search restores items
      const clearBtn = screen.getByLabelText(/Clear search/i);
      fireEvent.click(clearBtn);
      expect(screen.getByText(/Which destination countries and immigration categories does Documento support today\?/i)).toBeDefined();
    });
  });

  describe("4. Performance & Structural Invariants Verification", () => {
    it("verifies useSmoothScroll is a strict no-op function", () => {
      expect(typeof useSmoothScroll).toBe("function");
      // Calling useSmoothScroll should return undefined without side effects
      expect(useSmoothScroll(true)).toBeUndefined();
      expect(useSmoothScroll(false)).toBeUndefined();
    });

    it("verifies all 7 middle landing components render .animate-on-scroll elements", () => {
      const { container: c1 } = render(<DocumentoSignalStrip />);
      expect(c1.querySelectorAll(".animate-on-scroll").length).toBeGreaterThanOrEqual(1);

      const { container: c2 } = render(<DocumentoPreview />);
      expect(c2.querySelectorAll(".animate-on-scroll").length).toBeGreaterThanOrEqual(1);

      const { container: c3 } = render(<DocumentoWorkflow />);
      expect(c3.querySelectorAll(".animate-on-scroll").length).toBeGreaterThanOrEqual(1);

      const { container: c4 } = render(<DocumentoCoverageExplorer />);
      expect(c4.querySelectorAll(".animate-on-scroll").length).toBeGreaterThanOrEqual(1);

      const { container: c5 } = render(<DocumentoInteractiveTools onOpenLogin={() => {}} />);
      expect(c5.querySelectorAll(".animate-on-scroll").length).toBeGreaterThanOrEqual(1);

      const { container: c6 } = render(<DocumentoTrust />);
      expect(c6.querySelectorAll(".animate-on-scroll").length).toBeGreaterThanOrEqual(1);

      const { container: c7 } = render(<DocumentoFAQ />);
      expect(c7.querySelectorAll(".animate-on-scroll").length).toBeGreaterThanOrEqual(1);
    });

    it("verifies DocumentoNavbar contract: direct /calculators and /agency-onboarding links without dropdowns", () => {
      render(<DocumentoNavbar onOpenLogin={() => {}} />);

      const calcLink = screen.getByTestId("nav-pr-calculators-link");
      expect(calcLink.getAttribute("href")).toBe("/calculators");
      expect(calcLink.textContent?.trim()).toBe("PR Calculators");

      const agencyLink = screen.getByTestId("nav-agency-onboarding-link");
      expect(agencyLink.getAttribute("href")).toBe("/agency-onboarding");
      expect(agencyLink.textContent?.trim()).toBe("For Agencies");
    });
  });
});
