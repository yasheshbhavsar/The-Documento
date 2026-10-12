import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EmployeeWorkspace } from "../components/dashboards/EmployeeWorkspace";
import { AIFindingInspectorModal } from "../components/modals/AIFindingInspectorModal";
import { EvidenceSummaryModal } from "../components/modals/EvidenceSummaryModal";
import { FIXTURE_AI_FINDINGS, FIXTURE_CASES, FIXTURE_CLIENTS, FIXTURE_DOCUMENTS, FIXTURE_TASKS, FIXTURE_MESSAGES } from "../lib/api";
import { EvidenceBackedSummary } from "../lib/types";

describe("Phase 5 — AI Document Analysis, Discrepancy Detection & Finding Disposition", () => {
  const sampleFinding = FIXTURE_AI_FINDINGS[0]; // Cyrillic Transliteration
  const sampleContradiction = FIXTURE_AI_FINDINGS[3]; // Employment Start vs Degree Date

  it("renders EmployeeWorkspace AI findings tab with statutory checklist audit banner and finding cards", async () => {
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

    // Switch to AI findings tab
    const tabBtn = screen.getByRole("button", { name: /AI Findings/i });
    fireEvent.click(tabBtn);

    // Header & subtitle
    expect(screen.getByText(/AI Document Findings & Evidentiary Gap Analysis/i)).toBeDefined();

    // Action buttons
    expect(screen.getByText(/Run Case AI Consistency Analysis/i)).toBeDefined();
    expect(screen.getByText(/View Evidence-Backed Brief/i)).toBeDefined();

    // Findings rendered with badges
    expect(screen.getByText(/Cyrillic Transliteration Name Variation/i)).toBeDefined();
    expect(screen.getByText(/Missing Pages Detected in PhD Degree Scan/i)).toBeDefined();
    expect(screen.getByText(/Employment Start Overlaps Full-Time Resident Degree/i)).toBeDefined();

    // Contradiction vs Discrepancy distinction
    expect(screen.getByText(/CONFIRMED CONTRADICTION/i)).toBeDefined();
    expect(screen.getAllByText(/POTENTIAL DISCREPANCY/i).length).toBeGreaterThan(0);
  });

  it("filters findings by severity in EmployeeWorkspace", () => {
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

    fireEvent.click(screen.getByRole("button", { name: /AI Findings/i }));

    // Initial state shows multiple findings
    expect(screen.getByText(/Cyrillic Transliteration Name Variation/i)).toBeDefined();

    // Filter by Critical
    const selects = screen.getAllByRole("combobox");
    const severitySelect = selects[0];
    fireEvent.change(severitySelect, { target: { value: "critical" } });

    // Critical finding still present
    expect(screen.getByText(/Missing Pages Detected in PhD Degree Scan/i)).toBeDefined();
    // Minor finding filtered out
    expect(screen.queryByText(/Cyrillic Transliteration Name Variation/i)).toBeNull();
  });

  it("renders AIFindingInspectorModal with evidence source location, citation, and guardrails", () => {
    const handleClose = vi.fn();
    const handleResolve = vi.fn();
    const handleDismiss = vi.fn();
    const handleEscalate = vi.fn();

    render(
      <AIFindingInspectorModal
        isOpen={true}
        finding={sampleFinding}
        onClose={handleClose}
        onResolve={handleResolve}
        onDismiss={handleDismiss}
        onEscalate={handleEscalate}
      />
    );

    // Header metadata
    expect(screen.getByText(/ID: finding-01/i)).toBeDefined();
    expect(screen.getByText(/Cyrillic Transliteration Name Variation/i)).toBeDefined();
    expect(screen.getByText(/POTENTIAL DISCREPANCY \/ VARIATION/i)).toBeDefined();

    // Source location and evidence text
    expect(screen.getByText(/US_Passport_Biodata_Elena_Rostova\.pdf/i)).toBeDefined();
    expect(screen.getByText(/P<UKRROSTOVA<<YELENA/i)).toBeDefined();

    // Clarification question
    expect(screen.getByText(/Suggested Client \/ Sponsor Clarification Question/i)).toBeDefined();
    expect(screen.getByText(/Copy Question/i)).toBeDefined();

    // Strict guardrail notice
    expect(screen.getByText(/Strict Platform Guardrail/i)).toBeDefined();
  });

  it("handles Resolve finding with mandatory note", async () => {
    const handleResolve = vi.fn().mockResolvedValue(undefined);

    render(
      <AIFindingInspectorModal
        isOpen={true}
        finding={sampleFinding}
        onClose={vi.fn()}
        onResolve={handleResolve}
        onDismiss={vi.fn()}
        onEscalate={vi.fn()}
      />
    );

    // Switch to Reviewer Disposition tab
    fireEvent.click(screen.getByText(/Reviewer Disposition/i));

    // Try resolving without note -> validation error
    const confirmBtn = screen.getByText(/Confirm & Resolve Finding/i);
    fireEvent.click(confirmBtn);
    expect(screen.getByText(/Please provide an explanatory resolution note/i)).toBeDefined();

    // Enter note and submit
    const textarea = screen.getByPlaceholderText(/Verified spelling difference/i);
    fireEvent.change(textarea, {
      target: { value: "Verified standard Ukrainian transliteration. Disclosed on Form I-140 Part 3." },
    });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(handleResolve).toHaveBeenCalledWith(
        "finding-01",
        "Verified standard Ukrainian transliteration. Disclosed on Form I-140 Part 3."
      );
    });
  });

  it("handles Dismiss finding with structured reason dropdown and legal justification note", async () => {
    const handleDismiss = vi.fn().mockResolvedValue(undefined);

    render(
      <AIFindingInspectorModal
        isOpen={true}
        finding={sampleFinding}
        onClose={vi.fn()}
        onResolve={vi.fn()}
        onDismiss={handleDismiss}
        onEscalate={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText(/Reviewer Disposition/i));

    // Switch to Dismiss mode
    fireEvent.click(screen.getByText(/Dismiss with Reason/i));

    // Select structured reason
    const reasonSelect = screen.getByRole("combobox");
    fireEvent.change(reasonSelect, { target: { value: "acceptable_transliteration" } });

    // Enter justification note
    const textarea = screen.getByPlaceholderText(/Explain why this finding is dismissed/i);
    fireEvent.change(textarea, { target: { value: "BGN/PCGN Ukrainian system allows both E and Ye." } });

    // Submit dismissal
    const dismissBtn = screen.getByText(/Dismiss Finding with Recorded Reason/i);
    fireEvent.click(dismissBtn);

    await waitFor(() => {
      expect(handleDismiss).toHaveBeenCalledWith(
        "finding-01",
        "acceptable_transliteration",
        "BGN/PCGN Ukrainian system allows both E and Ye."
      );
    });
  });

  it("renders EvidenceSummaryModal with verified facts, citations, and uncertainty statements", () => {
    const sampleSummary: EvidenceBackedSummary = {
      case_number: "CASE-US-8841",
      jurisdiction: "US",
      visa_category: "EB-1A",
      applicant_name: "Elena Rostova",
      generated_at: new Date().toISOString(),
      verified_facts: [
        {
          category: "Identity",
          key: "Passport Number",
          value: "C09812491",
          source_document: "US_Passport.pdf",
          source_page: 1,
        },
      ],
      potential_discrepancies: [],
      missing_statutory_evidence: ["Major media coverage (8 CFR § 204.5(h)(3)(iii))"],
      suggested_clarification_questions: [
        {
          target: "client",
          question: "Please confirm other names used.",
          rationale: "Background check concordance.",
        },
      ],
      uncertainty_disclosures: [
        "AI findings are non-binding analytical recommendations.",
      ],
      summary_markdown: "### Evidence Brief Markdown",
    };

    render(
      <EvidenceSummaryModal
        isOpen={true}
        summary={sampleSummary}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Evidence-Backed Case Brief — Elena Rostova/i)).toBeDefined();
    expect(screen.getByText(/C09812491/i)).toBeDefined();
    expect(screen.getByText(/Source: \[US_Passport\.pdf, Page 1\]/i)).toBeDefined();
    expect(screen.getByText(/Major media coverage \(8 CFR § 204\.5\(h\)\(3\)\(iii\)\)/i)).toBeDefined();
    expect(screen.getByText(/Please confirm other names used\./i)).toBeDefined();
    expect(screen.getByText(/AI findings are non-binding analytical recommendations\./i)).toBeDefined();
    expect(screen.getByText(/Copy Formatted Brief/i)).toBeDefined();
  });
});
