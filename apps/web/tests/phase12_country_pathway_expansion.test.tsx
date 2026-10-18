import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RuleAdministrationHub } from "../components/rules/RuleAdministrationHub";
import {
  getCountryRegistry,
  getPathwayTaxonomy,
  getCoverageMatrix,
  getPathwayDossier,
  generateFactGroundedChecklist,
} from "../lib/api";

describe("Phase 12 — Country and Pathway Expansion Architecture", () => {
  describe("API Client Layer & Data Integrity", () => {
    it("retrieves country registry ordered by statutory priority tier 1 through 5", async () => {
      const countries = await getCountryRegistry();
      expect(countries.length).toBeGreaterThanOrEqual(11);

      // Verify Priority Tiers ordering
      const ca = countries.find((c) => c.code === "CA");
      const us = countries.find((c) => c.code === "US");
      const au = countries.find((c) => c.code === "AU");
      const nz = countries.find((c) => c.code === "NZ");
      const gb = countries.find((c) => c.code === "GB");
      const de = countries.find((c) => c.code === "DE");
      const fr = countries.find((c) => c.code === "FR");
      const ru = countries.find((c) => c.code === "RU");
      const sg = countries.find((c) => c.code === "SG");
      const ae = countries.find((c) => c.code === "AE");
      const jp = countries.find((c) => c.code === "JP");

      expect(ca?.priority_tier).toBe(1);
      expect(us?.priority_tier).toBe(2);
      expect(au?.priority_tier).toBe(3);
      expect(nz?.priority_tier).toBe(3);
      expect(gb?.priority_tier).toBe(4);
      expect(de?.priority_tier).toBe(4);
      expect(fr?.priority_tier).toBe(4);
      expect(ru?.priority_tier).toBe(5);
      expect(sg?.priority_tier).toBe(5);
      expect(ae?.priority_tier).toBe(5);
      expect(jp?.priority_tier).toBe(5);

      // Verify EU Schengen distinction flag
      expect(de?.eu_schengen_distinction_applies).toBe(true);
      expect(fr?.eu_schengen_distinction_applies).toBe(true);
      expect(Boolean(gb?.eu_schengen_distinction_applies)).toBe(false);
      expect(Boolean(ca?.eu_schengen_distinction_applies)).toBe(false);

      // Verify Australia and New Zealand separate statutory frameworks
      expect(au?.statutory_framework).toContain("Migration Act 1958");
      expect(nz?.statutory_framework).toContain("Immigration Act 2009");
      expect(au?.independent_jurisdiction_rules).toBe(true);
      expect(nz?.independent_jurisdiction_rules).toBe(true);
    });

    it("covers all 8 standard application families across taxonomy pathways", async () => {
      const pathways = await getPathwayTaxonomy();
      expect(pathways.length).toBeGreaterThanOrEqual(30);

      const categories = new Set(pathways.map((p) => p.category));
      expect(categories.has("visitor")).toBe(true);
      expect(categories.has("study")).toBe(true);
      expect(categories.has("work")).toBe(true);
      expect(categories.has("family")).toBe(true);
      expect(categories.has("pr_residence")).toBe(true);
      expect(categories.has("citizenship")).toBe(true);
      expect(categories.has("humanitarian_protection")).toBe(true);
      expect(categories.has("extension_renewal_change")).toBe(true);

      // Verify legal provenance fields exist on all pathways
      for (const p of pathways) {
        expect(p.statutory_reference).toBeDefined();
        expect(p.official_source_url).toMatch(/^https?:\/\//);
        expect(["SUPPORTED", "PARTIAL", "UNVERIFIED", "UNSUPPORTED"]).toContain(p.coverage_status);
      }
    });

    it("returns comprehensive coverage matrix with summary and family breakdown", async () => {
      const matrix = await getCoverageMatrix();
      expect(matrix.coverage_summary.total_countries).toBeGreaterThanOrEqual(11);
      expect(matrix.coverage_summary.total_pathways).toBeGreaterThanOrEqual(30);
      expect(matrix.coverage_summary.supported_pathways).toBeGreaterThanOrEqual(14);
      expect(matrix.coverage_summary.partial_pathways).toBeGreaterThanOrEqual(1);
      expect(matrix.coverage_summary.unverified_pathways).toBeGreaterThanOrEqual(5);

      expect(matrix.countries).toBeDefined();
      expect(matrix.countries.length).toBeGreaterThanOrEqual(11);
    });

    it("returns pathway validation dossier with professional review and safe stop requirements", async () => {
      // Test supported Canada pathway
      const caDossier = await getPathwayDossier("CA_EXPRESS_ENTRY_FSW");
      expect(caDossier?.pathway.pathway_key).toBe("CA_EXPRESS_ENTRY_FSW");
      expect(caDossier?.is_safe_to_generate_checklist).toBe(true);
      expect(caDossier?.safe_stop_required).toBe(false);
      expect(caDossier?.pathway.professional_reviewer).toContain("RCIC");
      expect(caDossier?.pathway.regression_test_suite).toBeDefined();

      // Test unverified Russia pathway
      const ruDossier = await getPathwayDossier("RU_VKS");
      expect(ruDossier?.pathway.pathway_key).toBe("RU_VKS");
      expect(ruDossier?.is_safe_to_generate_checklist).toBe(false);
      expect(ruDossier?.safe_stop_required).toBe(true);
    });

    it("enforces safe stop and returns EU Schengen notice on France via checklist engine API", async () => {
      const res = await generateFactGroundedChecklist({
        jurisdiction: "FR",
        pathway: "FR_PASSEPORT_TALENT",
      });
      expect(res.is_supported).toBe(false);
      expect(res.can_generate_checklist).toBe(false);
      expect(res.status).toBe("UNVERIFIED");
      expect(res.checklist.length).toBe(0);
      expect(res.eu_schengen_notice).toContain("CESEDA");
    });

    it("generates partial checklist with EU Schengen notice on Germany via checklist engine API", async () => {
      const res = await generateFactGroundedChecklist({
        jurisdiction: "DE",
        pathway: "DE_EU_BLUE_CARD",
      });
      expect(res.is_supported).toBe(true);
      expect(res.can_generate_checklist).toBe(true);
      expect(res.status).toBe("PARTIAL");
      expect(res.checklist.length).toBeGreaterThan(0);
      expect(res.eu_schengen_notice).toContain("AufenthG");
      expect(res.partial_coverage_warning).toBeDefined();
    });
  });

  describe("RuleAdministrationHub Component — Phase 12 Coverage Tab", () => {
    it("renders priority tiers filter buttons and updates country cards view", async () => {
      render(<RuleAdministrationHub isLiveBackend={false} initialTab="coverage" />);

      // Wait for country cards to load
      await waitFor(() => {
        expect(screen.getByText(/Canada \(CA\)/i)).toBeDefined();
      });

      // Verify Priority Tier filter buttons exist
      expect(screen.getByRole("button", { name: /All Priority Tiers/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Priority 1: Canada/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Priority 2: USA/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Priority 3: AU & NZ/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Priority 4: UK & Europe/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Priority 5: Emerging \/ Safe-Stop/i })).toBeDefined();

      // Click Priority 1 filter
      const p1Btn = screen.getByRole("button", { name: /Priority 1: Canada/i });
      fireEvent.click(p1Btn);

      // Verify Canada is visible and USA is filtered out in country cards
      await waitFor(() => {
        expect(screen.getByText(/Canada \(CA\)/i)).toBeDefined();
        expect(screen.queryByText(/United States \(US\)/i)).toBeNull();
      });

      // Click Priority 4 filter
      const p4Btn = screen.getByRole("button", { name: /Priority 4: UK & Europe/i });
      fireEvent.click(p4Btn);

      await waitFor(() => {
        expect(screen.getByText(/United Kingdom \(GB\)/i)).toBeDefined();
        expect(screen.getByText(/Germany \(DE\)/i)).toBeDefined();
        expect(screen.getByText(/France \(FR\)/i)).toBeDefined();
      });

      // Verify EU Schengen distinction badge on Germany and France
      const euBadges = screen.getAllByTestId("country-eu-schengen-badge");
      expect(euBadges.length).toBeGreaterThanOrEqual(2);
    });

    it("filters pathways by all 8 broad application families and coverage status", async () => {
      render(<RuleAdministrationHub isLiveBackend={false} initialTab="coverage" />);

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText(/H-1B Specialty Occupation Nonimmigrant Worker/i)).toBeDefined();
      });

      // Verify Application Family filter pills exist
      expect(screen.getByRole("button", { name: /All Categories/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /^Visitor$/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /^Study$/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /^Work$/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /^Family$/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /PR \/ Residence/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /^Citizenship$/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /^Humanitarian$/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /^Extensions$/i })).toBeDefined();

      // Click Work category filter
      const workBtn = screen.getByRole("button", { name: /^Work$/i });
      fireEvent.click(workBtn);

      await waitFor(() => {
        expect(screen.getByText(/H-1B Specialty Occupation Nonimmigrant Worker/i)).toBeDefined();
      });

      // Filter by UNVERIFIED coverage status dropdown
      const statusSelect = screen.getByTestId("coverage-status-filter-select");
      fireEvent.change(statusSelect, { target: { value: "UNVERIFIED" } });

      await waitFor(() => {
        expect(screen.getByText(/Highly Skilled Professional/i)).toBeDefined();
      });
    });

    it("opens Pathway Validation Dossier Modal displaying statutory provenance and safe-stop status", async () => {
      render(<RuleAdministrationHub isLiveBackend={false} initialTab="coverage" />);

      // Find first Dossier button in pathway inventory table
      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: /Dossier 📜/i }).length).toBeGreaterThan(0);
      });

      const dossierBtns = screen.getAllByRole("button", { name: /Dossier 📜/i });
      fireEvent.click(dossierBtns[0]);

      // Verify modal opens with statutory provenance
      await waitFor(() => {
        expect(screen.getByText(/Pathway Validation Dossier:/i)).toBeDefined();
        expect(screen.getByText(/Statutory Framework & Legal Provenance/i)).toBeDefined();
        expect(screen.getByText(/Professional Review & Quality Assurance/i)).toBeDefined();
        expect(screen.getByText(/Jurisdiction Release Conditions Attestation/i)).toBeDefined();
      });

      // Close modal
      const closeBtn = screen.getByRole("button", { name: /Close Dossier/i });
      fireEvent.click(closeBtn);

      await waitFor(() => {
        expect(screen.queryByText(/Professional Review & Quality Assurance/i)).toBeNull();
      });
    });
  });

  describe("RuleAdministrationHub Component — Checklist Engine & Safe Stop Simulator", () => {
    it("lists all 11 Priority 1-5 jurisdictions in simulator select", async () => {
      render(<RuleAdministrationHub isLiveBackend={false} initialTab="checklist_engine" />);

      // Wait for options in select
      await waitFor(() => {
        expect(screen.getByTestId("sim-jurisdiction-select")).toBeDefined();
      });

      expect(screen.getByText(/Canada \(Priority 1\)/i)).toBeDefined();
      expect(screen.getByText(/United States \(Priority 2\)/i)).toBeDefined();
      expect(screen.getByText(/Australia \(Priority 3\)/i)).toBeDefined();
      expect(screen.getByText(/New Zealand \(Priority 3\)/i)).toBeDefined();
      expect(screen.getByText(/United Kingdom \(Priority 4\)/i)).toBeDefined();
      expect(screen.getByText(/Germany \(Priority 4\)/i)).toBeDefined();
      expect(screen.getByText(/France \(Priority 4\)/i)).toBeDefined();
      expect(screen.getByText(/Russia \(Priority 5\)/i)).toBeDefined();
      expect(screen.getByText(/Singapore \(Priority 5\)/i)).toBeDefined();
      expect(screen.getByText(/United Arab Emirates \(Priority 5\)/i)).toBeDefined();
      expect(screen.getByText(/Japan \(Priority 5\)/i)).toBeDefined();
    });

    it("enforces safe stop with zero checklist items when simulating unverified jurisdiction", async () => {
      render(<RuleAdministrationHub isLiveBackend={false} initialTab="checklist_engine" />);

      // Wait for taxonomies to be loaded
      await waitFor(() => {
        expect(screen.getByText(/Express Entry — Federal Skilled Worker/i)).toBeDefined();
      });

      // Change jurisdiction to France (FR)
      const jurSelect = screen.getByTestId("sim-jurisdiction-select");
      fireEvent.change(jurSelect, { target: { value: "FR" } });

      // Wait for France pathway to be selected in pathway select
      await waitFor(() => {
        expect(screen.getByText(/Passeport Talent/i)).toBeDefined();
      });

      // Generate checklist
      const genBtn = screen.getByRole("button", { name: /Generate Fact-Grounded Checklist/i });
      fireEvent.click(genBtn);

      // Verify safe stop card and EU Schengen banner
      await waitFor(
        () => {
          expect(screen.getByText(/SAFE STOP ACTIVATED: PATHWAY NOT APPROVED/i)).toBeDefined();
          expect(screen.getByText(/Zero Unrelated Fallback Items Presented/i)).toBeDefined();
          expect(screen.getByTestId("eu-schengen-notice-banner")).toBeDefined();
          expect(screen.getAllByText(/CESEDA/i).length).toBeGreaterThan(0);
        },
        { timeout: 4000 }
      );
    });

    it("displays EU Schengen notice and partial coverage advisory when simulating Germany EU Blue Card", async () => {
      render(<RuleAdministrationHub isLiveBackend={false} initialTab="checklist_engine" />);

      // Wait for taxonomies to be loaded
      await waitFor(() => {
        expect(screen.getByText(/Express Entry — Federal Skilled Worker/i)).toBeDefined();
      });

      // Change jurisdiction to Germany (DE)
      const jurSelect = screen.getByTestId("sim-jurisdiction-select");
      fireEvent.change(jurSelect, { target: { value: "DE" } });

      // Wait for Germany EU Blue Card pathway to be selected in pathway select
      await waitFor(() => {
        expect(screen.getByText(/EU Blue Card/i)).toBeDefined();
      });

      // Generate checklist
      const genBtn = screen.getByRole("button", { name: /Generate Fact-Grounded Checklist/i });
      fireEvent.click(genBtn);

      // Verify EU Schengen notice and Partial coverage advisory banners
      await waitFor(
        () => {
          expect(screen.getByTestId("eu-schengen-notice-banner")).toBeDefined();
          expect(screen.getByTestId("partial-coverage-warning-banner")).toBeDefined();
          expect(screen.getAllByText(/AufenthG § 18b/i).length).toBeGreaterThan(0);
          expect(screen.getByText(/Erklärung zum Beschäftigungsverhältnis/i)).toBeDefined();
        },
        { timeout: 4000 }
      );
    });
  });
});
