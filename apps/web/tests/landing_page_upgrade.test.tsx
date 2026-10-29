import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DocumentoHero } from "../components/landing/DocumentoHero";
import { DocumentoPreview } from "../components/landing/DocumentoPreview";
import { DocumentoCoverageExplorer } from "../components/landing/DocumentoCoverageExplorer";
import { DocumentoProblemSolution } from "../components/landing/DocumentoProblemSolution";
import { DocumentoWorkflow } from "../components/landing/DocumentoWorkflow";
import { DocumentoInteractiveTools } from "../components/landing/DocumentoInteractiveTools";
import { DocumentoFAQ } from "../components/landing/DocumentoFAQ";
import { DocumentoNavbar } from "../components/landing/DocumentoNavbar";
import { DocumentoFooter } from "../components/landing/DocumentoFooter";

describe("Landing Page Enhanced Features & Quality Gate", () => {
  describe("1. DocumentoHero", () => {
    it("renders headline, value messaging, and prominent CTAs", () => {
      const handleOpenLogin = vi.fn();
      render(<DocumentoHero onOpenLogin={handleOpenLogin} />);

      expect(screen.getByText(/Every immigration case\./i)).toBeDefined();
      expect(screen.getByText(/Clearer by design\./i)).toBeDefined();
      expect(screen.getByText(/Eliminate administrative paperwork chaos\./i)).toBeDefined();

      const getStartedBtn = screen.getByRole("button", { name: /Get Started/i });
      expect(getStartedBtn).toBeDefined();
      fireEvent.click(getStartedBtn);
      expect(handleOpenLogin).toHaveBeenCalledWith("firm");

      expect(screen.getByText(/Explore How It Works/i)).toBeDefined();
      expect(screen.getAllByText(/3 Verified Jurisdictions/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/6 Operational Pathways/i).length).toBeGreaterThan(0);
    });
  });

  describe("2. DocumentoPreview (5 Interactive Tabs)", () => {
    it("renders 5 tabs and allows exploring dashboard, vault, tasks, AI desk, and messaging", () => {
      render(<DocumentoPreview />);

      // Tab 1: Case Overview
      expect(screen.getByText(/68% Ready/i)).toBeDefined();
      expect(screen.getAllByText(/Dr\. Aris Thorne/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Filing Readiness/i)).toBeDefined();
      expect(screen.getByText(/Waiting on Firm Counsel/i)).toBeDefined();

      // Switch to Tab 2: Document Vault & Checklist
      const vaultTab = screen.getByRole("tab", { name: /2\. Document Vault & Checklist/i });
      fireEvent.click(vaultTab);
      expect(screen.getAllByText(/Passport_Bio_Page_UK\.pdf/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Employer_Support_Letter_MIT\.pdf/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Exhibit Metadata Inspector/i)).toBeDefined();

      // Switch to Tab 3: Milestones & Tasks
      const tasksTab = screen.getByRole("tab", { name: /3\. Procedural Milestones & Tasks/i });
      fireEvent.click(tasksTab);
      expect(screen.getByText(/Active Case Task Docket/i)).toBeDefined();
      const taskItem = screen.getByText(/Resolve employment start date discrepancy with Dr\. Thorne/i);
      expect(taskItem).toBeDefined();
      fireEvent.click(taskItem); // toggle completion
      expect(screen.getByText(/3 of 4 Completed/i)).toBeDefined();

      // Switch to Tab 4: AI Evidentiary Checks
      const aiTab = screen.getByRole("tab", { name: /4\. AI Evidentiary Checks/i });
      fireEvent.click(aiTab);
      expect(screen.getByText(/AI Discrepancy Detection & Attorney Adjudication Desk/i)).toBeDefined();
      expect(screen.getByText(/Employment Start Date Variance/i)).toBeDefined();
      const resolveBtn = screen.getByRole("button", { name: /Mark Clarified with HR Addendum/i });
      fireEvent.click(resolveBtn);
      expect(screen.getByText(/STATUS: RESOLVED BY COUNSEL/i)).toBeDefined();

      // Switch to Tab 5: Client & Legal Coordination
      const chatTab = screen.getByRole("tab", { name: /5\. Client & Legal Coordination/i });
      fireEvent.click(chatTab);
      expect(screen.getByText(/Case Coordination & Document Request Thread/i)).toBeDefined();
      expect(screen.getByText(/Sarah Jenkins \(Senior Paralegal\)/i)).toBeDefined();

      const input = screen.getByPlaceholderText(/Test reply:/i);
      fireEvent.change(input, { target: { value: "All set, brief finalized." } });
      const sendBtn = screen.getByRole("button", { name: /Send/i });
      fireEvent.click(sendBtn);
      expect(screen.getByText(/All set, brief finalized\./i)).toBeDefined();
    });
  });

  describe("3. DocumentoCoverageExplorer", () => {
    it("filters and searches supported visa pathways with verified counts", () => {
      render(<DocumentoCoverageExplorer />);

      expect(screen.getByText(/Explicit pathway coverage\. Zero exaggerated claims\./i)).toBeDefined();
      expect(screen.getByText(/3 Active Jurisdictions/i)).toBeDefined();
      expect(screen.getByText(/6 Operational Pathways/i)).toBeDefined();
      expect(screen.getByText(/2 Roadmap Pathways/i)).toBeDefined();

      // Search input test
      const searchInput = screen.getByPlaceholderText(/Search visa name/i);
      fireEvent.change(searchInput, { target: { value: "Global Talent" } });
      expect(screen.getAllByText(/UK Global Talent Visa/i).length).toBeGreaterThan(0);

      // Filter by Planned status
      const plannedBtn = screen.getByRole("button", { name: /Roadmap \/ Planned/i });
      fireEvent.click(plannedBtn);
      expect(screen.getAllByText(/Australia Global Talent Visa/i).length).toBeGreaterThan(0);

      // Filter by Available status
      const availableBtn = screen.getByRole("button", { name: /Available Now/i });
      fireEvent.click(availableBtn);
      fireEvent.change(searchInput, { target: { value: "" } });
      expect(screen.getAllByText(/EB-1A Extraordinary Ability/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Canada Express Entry/i).length).toBeGreaterThan(0);
    });
  });

  describe("4. DocumentoProblemSolution", () => {
    it("renders before-and-after challenges and switches between views", () => {
      render(<DocumentoProblemSolution />);

      expect(screen.getByText(/Immigration is complicated enough\./i)).toBeDefined();
      expect(screen.getByText(/Managing it shouldn’t be\./i)).toBeDefined();
      expect(screen.getAllByText(/Scattered Documents & Version Confusion/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/With Documento Vault/i)).toBeDefined();
      expect(screen.getByRole("tab", { name: /Evidence Management/i })).toBeDefined();
      expect(screen.getByRole("tab", { name: /Statutory Criteria/i })).toBeDefined();
      expect(screen.getByRole("tab", { name: /Timeline & Bottlenecks/i })).toBeDefined();

      // Switch to Challenge 2
      const tab2 = screen.getByRole("tab", { name: /Statutory Criteria/i });
      fireEvent.click(tab2);
      expect(screen.getAllByText(/Unclear Requirements & Regulatory Guesswork/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/With Documento Rule Engine/i)).toBeDefined();
    });
  });

  describe("5. DocumentoWorkflow", () => {
    it("navigates through the 6-stage casework journey", () => {
      render(<DocumentoWorkflow />);

      expect(screen.getByText(/From overwhelming paperwork to an organized process\./i)).toBeDefined();
      expect(screen.getByText(/Stage 01 of 06/i)).toBeDefined();
      expect(screen.getAllByText(/Case Setup & Profile Intake/i).length).toBeGreaterThan(0);

      const nextBtn = screen.getByRole("button", { name: /Next Stage →/i });
      fireEvent.click(nextBtn);
      expect(screen.getByText(/Stage 02 of 06/i)).toBeDefined();
      expect(screen.getAllByText(/Requirements Mapping & Statutory Engine/i).length).toBeGreaterThan(0);

      // Jump to stage 6 directly
      const stage6Btn = screen.getAllByText(/Filing Readiness & Package Assembly/i)[0];
      fireEvent.click(stage6Btn);
      expect(screen.getByText(/Stage 06 of 06/i)).toBeDefined();
      expect(screen.getByText(/Deterministic bundle generation with sequential exhibit tabs\./i)).toBeDefined();
    });
  });

  describe("6. DocumentoInteractiveTools", () => {
    it("evaluates case suitability and switches between applicant and legal team views", () => {
      const handleOpenLogin = vi.fn();
      render(<DocumentoInteractiveTools onOpenLogin={handleOpenLogin} />);

      expect(screen.getByText(/Is Documento right for your case\?/i)).toBeDefined();
      expect(screen.getByText(/EB-1A & O-1A Extraordinary Ability/i)).toBeDefined();
      expect(screen.getByText(/Coverage Verified • Operational/i)).toBeDefined();

      // Select Germany
      const germanyBtn = screen.getByText(/Germany \(Planned\)/i);
      fireEvent.click(germanyBtn);
      expect(screen.getByText(/Germany EU Blue Card & Chancenkarte/i)).toBeDefined();
      expect(screen.getByText(/Expansion Pipeline • In Development/i)).toBeDefined();

      // Toggle personas
      const firmPersonaBtn = screen.getByRole("button", { name: /For Legal Teams & Law Firms/i });
      fireEvent.click(firmPersonaBtn);
      expect(screen.getByText(/Automated Evidence Cross-Examination/i)).toBeDefined();
      expect(screen.getByText(/Deterministic Exhibit Index & Assembly/i)).toBeDefined();
    });
  });

  describe("7. DocumentoFAQ", () => {
    it("searches and toggles accordion FAQ items", () => {
      render(<DocumentoFAQ />);

      expect(screen.getByText(/Frequently Asked Questions/i)).toBeDefined();
      expect(screen.getByText(/Which destination countries and immigration categories does Documento support today\?/i)).toBeDefined();

      // Click to toggle
      const questionBtn = screen.getByRole("button", { name: /Does Documento replace immigration attorneys/i });
      fireEvent.click(questionBtn);
      expect(screen.getByText(/Documento is an immigration casework and evidence intelligence platform, not a law firm\./i)).toBeDefined();

      // Search filter
      const searchInput = screen.getByPlaceholderText(/Search frequently asked questions/i);
      fireEvent.change(searchInput, { target: { value: "hallucinate" } });
      expect(screen.getByText(/How does Documento's AI assistance work, and can it hallucinate/i)).toBeDefined();
    });
  });

  describe("8. DocumentoNavbar & DocumentoFooter", () => {
    it("renders navigation and footer links cleanly", () => {
      const handleOpenLogin = vi.fn();
      render(
        <>
          <DocumentoNavbar onOpenLogin={handleOpenLogin} isLiveBackend={true} />
          <DocumentoFooter onOpenLogin={handleOpenLogin} />
        </>
      );

      expect(screen.getByText(/Engine Live/i)).toBeDefined();
      expect(screen.getAllByText(/Client Portal/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/100% SHA-256 Provenance/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Legal Disclaimer:/i)).toBeDefined();
    });
  });
});
