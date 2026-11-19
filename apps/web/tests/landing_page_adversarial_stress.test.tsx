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

describe("Adversarial Stress & Regression Test Suite — Landing Page Middle Sections", () => {
  describe("1. DocumentoCoverageExplorer Adversarial Scenarios", () => {
    it("handles empty, whitespace, and special regex characters in search without throwing", () => {
      render(<DocumentoCoverageExplorer />);

      const searchInput = screen.getByPlaceholderText(/Search visa name/i);

      // Whitespace search
      fireEvent.change(searchInput, { target: { value: "    " } });
      expect(screen.getByText(/3 Active Jurisdictions/i)).toBeDefined();
      expect(screen.getAllByText(/Canada Express Entry/i).length).toBeGreaterThan(0);

      // Regex special characters that could break unescaped RegExp
      fireEvent.change(searchInput, { target: { value: "[.*+?^${}()|[\\]\\]" } });
      // Should show zero results empty state without throwing
      expect(screen.getByText(/No immigration pathways match the current search or filter\./i)).toBeDefined();

      // Reset button should restore items
      const resetBtn = screen.getByRole("button", { name: /Reset Filters/i });
      fireEvent.click(resetBtn);
      expect(screen.getAllByText(/Canada Express Entry/i).length).toBeGreaterThan(0);
    });

    it("survives rapid filter toggling across countries and statuses", () => {
      render(<DocumentoCoverageExplorer />);

      const availableBtn = screen.getByRole("button", { name: /Available Now/i });
      const plannedBtn = screen.getByRole("button", { name: /Roadmap \/ Planned/i });
      const allStatusBtn = screen.getByRole("button", { name: /^All$/i });

      // Rapidly toggle status 20 times
      for (let i = 0; i < 20; i++) {
        fireEvent.click(availableBtn);
        fireEvent.click(plannedBtn);
        fireEvent.click(allStatusBtn);
      }

      expect(screen.getByText(/3 Active Jurisdictions/i)).toBeDefined();
      expect(screen.getAllByText(/Canada Express Entry/i).length).toBeGreaterThan(0);
    });
  });

  describe("2. DocumentoFAQ Adversarial Scenarios", () => {
    it("handles non-existent search queries and resets properly", () => {
      render(<DocumentoFAQ />);

      const searchInput = screen.getByPlaceholderText(/Search frequently asked questions/i);

      // Search non-existent phrase
      fireEvent.change(searchInput, { target: { value: "supercalifragilistic_nonexistent_query" } });
      expect(screen.getByText(/No questions matched your search query/i)).toBeDefined();

      // Clear via the '✕' button
      const clearBtn = screen.getByLabelText(/Clear search/i);
      fireEvent.click(clearBtn);
      expect(screen.queryByText(/No questions matched your search query/i)).toBeNull();
      expect(screen.getByText(/Which destination countries and immigration categories does Documento support today\?/i)).toBeDefined();
    });

    it("survives 30 rapid accordion toggles and category switches", () => {
      render(<DocumentoFAQ />);

      const q1 = screen.getByRole("button", { name: /Does Documento replace immigration attorneys/i });
      const q2 = screen.getByRole("button", { name: /Which destination countries and immigration categories/i });

      // Rapid toggling
      for (let i = 0; i < 15; i++) {
        fireEvent.click(q1);
        fireEvent.click(q2);
      }

      // Check category switching via nav rail
      const navRail = screen.getByRole("navigation", { name: /FAQ Categories/i });
      const ethicsPill = within(navRail).getByRole("button", { name: /Legal & Ethics/i });
      fireEvent.click(ethicsPill);
      expect(screen.getByText(/Does Documento replace immigration attorneys/i)).toBeDefined();
      expect(screen.getByText(/Can Documento guarantee that an immigration petition/i)).toBeDefined();
    });
  });

  describe("3. DocumentoInteractiveTools Adversarial Scenarios", () => {
    it("handles extreme slider values and rapid scrubbing without failure", () => {
      const handleOpenLogin = vi.fn();
      render(<DocumentoInteractiveTools onOpenLogin={handleOpenLogin} />);

      const volumeSlider = screen.getByLabelText(/Simulate case exhibit volume/i) as HTMLInputElement;

      // Minimum normal value: 10
      fireEvent.change(volumeSlider, { target: { value: "10" } });
      expect(screen.getByText(/Case Volume: 10 Exhibits/i)).toBeDefined();
      expect(screen.getByText(/~5 hrs paralegal assembly saved/i)).toBeDefined();

      // Maximum normal value: 85
      fireEvent.change(volumeSlider, { target: { value: "85" } });
      expect(screen.getByText(/Case Volume: 85 Exhibits/i)).toBeDefined();
      expect(screen.getByText(/~38 hrs paralegal assembly saved/i)).toBeDefined();

      // Rapid scrubbing across range
      for (let v = 10; v <= 85; v += 5) {
        fireEvent.change(volumeSlider, { target: { value: String(v) } });
      }
      expect(screen.getByText(/Case Volume: 85 Exhibits/i)).toBeDefined();
    });

    it("survives rapid destination preset and persona switching", () => {
      const handleOpenLogin = vi.fn();
      render(<DocumentoInteractiveTools onOpenLogin={handleOpenLogin} />);

      const superVisaBtn = screen.getByRole("button", { name: /Canada Super Visa & TRV/i });
      const caPrBtn = screen.getByRole("button", { name: /Canada Express Entry & PNP/i });
      const deBtn = screen.getByRole("button", { name: /Germany & Australia \(Planned\)/i });
      const usUkBtn = screen.getByRole("button", { name: /US \(USCIS\) & UK \(UKVI\)/i });

      for (let i = 0; i < 5; i++) {
        fireEvent.click(superVisaBtn);
        fireEvent.click(caPrBtn);
        fireEvent.click(deBtn);
        fireEvent.click(usUkBtn);
      }

      // Persona toggling
      const firmPersonaBtn = screen.getByRole("button", { name: /For Legal Teams & Law Firms/i });
      const clientPersonaBtn = screen.getByRole("button", { name: /For Retained Applicants/i });

      for (let i = 0; i < 5; i++) {
        fireEvent.click(firmPersonaBtn);
        fireEvent.click(clientPersonaBtn);
      }

      expect(screen.getByText(/Know Exactly What Documents Are Needed/i)).toBeDefined();
    });
  });

  describe("4. DocumentoPreview Rapid Tab Switching & State Mutation", () => {
    it("survives 50 rapid sequential tab switches and concurrent user mutations", () => {
      render(<DocumentoPreview />);

      const tabNames = [
        /1\. Case Overview/i,
        /2\. Document Vault & Checklist/i,
        /3\. Procedural Milestones & Tasks/i,
        /4\. AI Evidentiary Checks/i,
        /5\. Client & Legal Coordination/i,
      ];

      // Switch tabs 10 times in a complete 5-tab cycle (50 tab switches)
      for (let cycle = 0; cycle < 10; cycle++) {
        for (const name of tabNames) {
          const tab = screen.getByRole("tab", { name });
          fireEvent.click(tab);
        }
      }

      // Check final state on Tab 5 (Chat)
      const input = screen.getByPlaceholderText(/Test reply:/i);
      fireEvent.change(input, { target: { value: "Rapid chat message test" } });
      const sendBtn = screen.getByRole("button", { name: /Send/i });
      fireEvent.click(sendBtn);
      expect(screen.getByText(/Rapid chat message test/i)).toBeDefined();

      // Return to Tab 3 and toggle tasks
      const tab3 = screen.getByRole("tab", { name: /3\. Procedural Milestones & Tasks/i });
      fireEvent.click(tab3);
      const taskItem = screen.getByText(/Resolve employment start date discrepancy with Applicant/i);
      fireEvent.click(taskItem);
      expect(screen.getByText(/3 of 4 Completed/i)).toBeDefined();
    });
  });

  describe("5. DocumentoWorkflow Cyclical Stage Traversal", () => {
    it("cycles forward and backward through all 6 stages repeatedly via next and prev controls", () => {
      render(<DocumentoWorkflow />);

      const nextBtn = screen.getByRole("button", { name: /Next Stage →/i });
      const prevBtn = screen.getByRole("button", { name: /← Previous Stage/i });

      // Advance 12 times (2 full 6-stage forward cycles)
      for (let i = 0; i < 12; i++) {
        fireEvent.click(nextBtn);
      }
      expect(screen.getByText(/Stage 01 of 06/i)).toBeDefined();

      // Retreat 12 times (2 full 6-stage reverse cycles)
      for (let i = 0; i < 12; i++) {
        fireEvent.click(prevBtn);
      }
      expect(screen.getByText(/Stage 01 of 06/i)).toBeDefined();
    });
  });

  describe("6. DocumentoTrust Codex Switcher & Invariants", () => {
    it("switches smoothly between Institutional Principles and Architecture Capabilities", () => {
      render(<DocumentoTrust />);

      const principlesBtn = screen.getByRole("button", { name: /4 Core Trust Principles/i });
      const capabilitiesBtn = screen.getByRole("button", { name: /6 Core Platform Capabilities/i });

      for (let i = 0; i < 5; i++) {
        fireEvent.click(capabilitiesBtn);
        fireEvent.click(principlesBtn);
      }

      expect(screen.getByText(/Human-in-the-Loop Review/i)).toBeDefined();
      expect(screen.getByText(/Evidence-Linked Findings/i)).toBeDefined();
      expect(screen.getByText(/Tenant & Role Isolation/i)).toBeDefined();
      expect(screen.getByText(/Provenance & Audit Trails/i)).toBeDefined();

      // Switch to capabilities and assert
      fireEvent.click(capabilitiesBtn);
      expect(screen.getByText(/Intake & Organization/i)).toBeDefined();
      expect(screen.getByText(/Cross-Document Verification/i)).toBeDefined();
      expect(screen.getByText(/Package Assembly/i)).toBeDefined();
    });
  });

  describe("7. .animate-on-scroll Classes Presence Verification", () => {
    it("ensures each middle section renders .animate-on-scroll classes for intersection observers", () => {
      const { container: c1 } = render(<DocumentoSignalStrip />);
      expect(c1.querySelectorAll(".animate-on-scroll").length).toBeGreaterThan(0);

      const { container: c2 } = render(<DocumentoPreview />);
      expect(c2.querySelectorAll(".animate-on-scroll").length).toBeGreaterThan(0);

      const { container: c3 } = render(<DocumentoWorkflow />);
      expect(c3.querySelectorAll(".animate-on-scroll").length).toBeGreaterThan(0);

      const { container: c4 } = render(<DocumentoCoverageExplorer />);
      expect(c4.querySelectorAll(".animate-on-scroll").length).toBeGreaterThan(0);

      const { container: c5 } = render(<DocumentoInteractiveTools onOpenLogin={() => { }} />);
      expect(c5.querySelectorAll(".animate-on-scroll").length).toBeGreaterThan(0);

      const { container: c6 } = render(<DocumentoTrust />);
      expect(c6.querySelectorAll(".animate-on-scroll").length).toBeGreaterThan(0);

      const { container: c7 } = render(<DocumentoFAQ />);
      expect(c7.querySelectorAll(".animate-on-scroll").length).toBeGreaterThan(0);
    });
  });
});
