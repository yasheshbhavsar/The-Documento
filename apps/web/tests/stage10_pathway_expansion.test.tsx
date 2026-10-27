import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PathwayExpansionDesk } from "../components/pathways/PathwayExpansionDesk";
import { OwnerMasterDashboard } from "../components/dashboards/OwnerMasterDashboard";
import { EmployeeWorkspace } from "../components/dashboards/EmployeeWorkspace";
import {
  FIXTURE_CASES,
  FIXTURE_CLIENTS,
  FIXTURE_DOCUMENTS,
  FIXTURE_AUDIT_EVENTS,
  FIXTURE_TASKS,
  FIXTURE_AI_FINDINGS,
  FIXTURE_MESSAGES,
  FIXTURE_INVOICES,
  FIXTURE_CAPACITY,
} from "../lib/api";

describe("Stage 10 — Pathway Expansion & Regional Localization Desk (§10.1 - §10.3)", () => {
  describe("1. PathwayExpansionDesk Component", () => {
    it("renders the desk header and 5 operational tabs", () => {
      render(<PathwayExpansionDesk userRole="master_admin" />);

      expect(screen.getByText("Pathway Expansion & Regional Localization Desk")).toBeDefined();
      expect(screen.getByTestId("tab-priority_tiers")).toBeDefined();
      expect(screen.getByTestId("tab-taxonomy_grid")).toBeDefined();
      expect(screen.getByTestId("tab-coverage_matrix")).toBeDefined();
      expect(screen.getByTestId("tab-multilingual_matching")).toBeDefined();
      expect(screen.getByTestId("tab-dossier_inspector")).toBeDefined();
    });

    it("displays Priority 1 through Priority 5 country cards with statutory frameworks and EU/Schengen distinction", () => {
      render(<PathwayExpansionDesk userRole="master_admin" />);

      // Priority 1: Canada
      expect(screen.getByText("Priority 1: Canada (IRCC Expansion)")).toBeDefined();
      expect(screen.getAllByText(/Immigration and Refugee Protection Act/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/RCIC Review Required/i).length).toBeGreaterThan(0);

      // Priority 2: USA
      expect(screen.getByText("Priority 2: United States (USCIS / DOS)")).toBeDefined();

      // Priority 3: Australia & New Zealand
      expect(screen.getByText("Priority 3: Australia & New Zealand (Separated Systems)")).toBeDefined();
      expect(screen.getAllByText(/Migration Act 1958/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Immigration Act 2009/i).length).toBeGreaterThan(0);

      // Priority 4: UK, Germany & France
      expect(screen.getByText("Priority 4: United Kingdom & European Union Member States")).toBeDefined();
      expect(screen.getAllByText(/AufenthG/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/CESEDA/i).length).toBeGreaterThan(0);

      // Priority 5: Safe-Stop Jurisdictions
      expect(screen.getByText("Priority 5: Unverified & Emerging Jurisdictions")).toBeDefined();
      expect(screen.getAllByText(/SAFE-STOP REFUSAL/i).length).toBeGreaterThan(0);
    });

    it("allows searching and filtering in the Global Taxonomy Grid", async () => {
      render(<PathwayExpansionDesk userRole="master_admin" />);

      // Switch to Taxonomy Grid tab
      fireEvent.click(screen.getByTestId("tab-taxonomy_grid"));

      // Verify search input is present
      const searchInput = screen.getByTestId("taxonomy-search-input");
      expect(searchInput).toBeDefined();

      // Filter by keyword 'H-1B'
      fireEvent.change(searchInput, { target: { value: "H-1B" } });
      expect(screen.getByText("US_H1B")).toBeDefined();
      expect(screen.getByText(/H-1B Specialty Occupation/i)).toBeDefined();

      // Clear search
      fireEvent.change(searchInput, { target: { value: "" } });

      // Filter by Jurisdiction CA
      const jurisdictionSelect = screen.getByTestId("taxonomy-jurisdiction-filter");
      fireEvent.change(jurisdictionSelect, { target: { value: "CA" } });
      expect(screen.getByText("CA_EXPRESS_ENTRY_FSW")).toBeDefined();
      expect(screen.getByText("CA_STUDY_PERMIT")).toBeDefined();
    });

    it("displays the 8 broad application families and Safe-Stop principles in the Coverage Matrix", () => {
      render(<PathwayExpansionDesk userRole="master_admin" />);

      // Switch to Coverage Matrix tab
      fireEvent.click(screen.getByTestId("tab-coverage_matrix"));

      // Verify all 8 families are displayed
      expect(screen.getByText("Visitor & Temporary Resident")).toBeDefined();
      expect(screen.getByText("Study & Educational Permits")).toBeDefined();
      expect(screen.getByText("Work & Employment Authorization")).toBeDefined();
      expect(screen.getByText("Family Sponsorship & Reunification")).toBeDefined();
      expect(screen.getByText("Permanent Residence & Settlement")).toBeDefined();
      expect(screen.getByText("Citizenship & Naturalization")).toBeDefined();
      expect(screen.getByText("Humanitarian, Refugee & Protection")).toBeDefined();
      expect(screen.getByText("Extension, Renewal & Status Change")).toBeDefined();

      // Verify Safe-Stop Guarantees card
      expect(screen.getByText("Safe-Stop Architecture & Hallucination Prevention")).toBeDefined();
      expect(screen.getByText(/Refusal of Unverified Package Generation/i)).toBeDefined();
      expect(screen.getByText(/Zero Hallucinated Fallback Checklists/i)).toBeDefined();
    });

    it("performs interactive cross-document multilingual name matching and transliteration testing", () => {
      render(<PathwayExpansionDesk userRole="master_admin" />);

      // Switch to Multilingual Matching tab
      fireEvent.click(screen.getByTestId("tab-multilingual_matching"));

      expect(screen.getByText("Cross-Border Multilingual Name & Transliteration Intelligence (§4.4, §10)")).toBeDefined();

      // Verify name input fields exist
      const docNameInput = screen.getByTestId("input-doc-name");
      const idNameInput = screen.getByTestId("input-id-name");
      expect(docNameInput).toBeDefined();
      expect(idNameInput).toBeDefined();

      // Test preset button: Arabic
      const arabicPresetBtn = screen.getByTestId("preset-arabic");
      fireEvent.click(arabicPresetBtn);

      // Verify result display
      expect(screen.getAllByText(/Transliteration Equivalence Detected/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Confidence Match/i).length).toBeGreaterThan(0);

      // Test preset button: Cyrillic
      const cyrillicPresetBtn = screen.getByTestId("preset-cyrillic");
      fireEvent.click(cyrillicPresetBtn);
      expect(screen.getAllByText(/Cyrillic-Latin Transliteration Equivalence/i).length).toBeGreaterThan(0);

      // Test Given/Family Inversion
      const inversionPresetBtn = screen.getByTestId("preset-inversion");
      fireEvent.click(inversionPresetBtn);
      expect(screen.getAllByText(/Given\/Family Name Inversion Match/i).length).toBeGreaterThan(0);
    });

    it("inspects statutory dossier with statutory references, legal reviewer sign-off, and regression suite", () => {
      render(<PathwayExpansionDesk userRole="master_admin" />);

      // Switch to Dossier Inspector tab
      fireEvent.click(screen.getByTestId("tab-dossier_inspector"));

      // Verify statutory references and compliance badges
      expect(screen.getByText("Statutory Basis & Legal Authorities")).toBeDefined();
      expect(screen.getByText("Legal Reviewer Sign-Off")).toBeDefined();
      expect(screen.getByText("Automated Regression Suite")).toBeDefined();
      expect(screen.getByText("Official Authority Source")).toBeDefined();

      // Check selector changes dossier
      const dossierSelect = screen.getByTestId("dossier-selector");
      fireEvent.change(dossierSelect, { target: { value: "DE_CHANCE_KARTE" } });
      expect(screen.getByText("Germany: Opportunity Card (Chancenkarte - AufenthG §20a)")).toBeDefined();
      expect(screen.getAllByText(/Federal Ministry of the Interior/i).length).toBeGreaterThan(0);
    });
  });

  describe("2. Managing Partner Dashboard Integration", () => {
    it("renders the Pathway Expansion tab in OwnerMasterDashboard", async () => {
      render(
        <OwnerMasterDashboard
          cases={FIXTURE_CASES}
          clients={FIXTURE_CLIENTS}
          auditEvents={FIXTURE_AUDIT_EVENTS}
          invoices={FIXTURE_INVOICES}
          capacity={FIXTURE_CAPACITY}
          isLiveBackend={false}
          onOpenCreateCase={vi.fn()}
          onOpenCreateClient={vi.fn()}
          onSelectCase={vi.fn()}
        />
      );

      // Locate the Pathway Expansion tab button
      const pathwayTabBtn = screen.getByTestId("tab-btn-stage10-pathway-expansion");
      expect(pathwayTabBtn).toBeDefined();

      // Click to activate tab
      fireEvent.click(pathwayTabBtn);

      // Verify that the PathwayExpansionDesk is mounted
      expect(screen.getByText("Pathway Expansion & Regional Localization Desk")).toBeDefined();
      expect(screen.getByTestId("tab-priority_tiers")).toBeDefined();
    });
  });

  describe("3. Staff Employee Workspace Integration", () => {
    it("renders the Pathway Expansion tab in EmployeeWorkspace", async () => {
      render(
        <EmployeeWorkspace
          cases={FIXTURE_CASES}
          clients={FIXTURE_CLIENTS}
          documents={FIXTURE_DOCUMENTS}
          tasks={FIXTURE_TASKS}
          aiFindings={FIXTURE_AI_FINDINGS}
          messages={FIXTURE_MESSAGES}
          onToggleTask={vi.fn()}
          onSendMessage={vi.fn()}
          onSelectCase={vi.fn()}
          onOpenUploadModal={vi.fn()}
        />
      );

      // Locate the Pathway Expansion tab button
      const pathwayTabBtn = screen.getByRole("button", { name: /Pathway Expansion/i });
      expect(pathwayTabBtn).toBeDefined();

      // Click to switch tab
      fireEvent.click(pathwayTabBtn);

      // Verify that the PathwayExpansionDesk is mounted
      expect(screen.getByText("Pathway Expansion & Regional Localization Desk")).toBeDefined();
    });
  });
});
