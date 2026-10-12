import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CaseDetailModal } from "../components/cases/CaseDetailModal";
import { CreateClientModal } from "../components/modals/CreateClientModal";
import { FIXTURE_CASES } from "../lib/api";

describe("Phase 3 — Core Immigration Case Management Workflows", () => {
  const sampleCase = FIXTURE_CASES[0]; // CASE-US-8841

  it("renders CaseDetailModal with overview, jurisdiction, and tabs", () => {
    const handleClose = vi.fn();
    const handleUpdated = vi.fn();

    render(
      <CaseDetailModal
        isOpen={true}
        onClose={handleClose}
        caseItem={sampleCase}
        onCaseUpdated={handleUpdated}
        activeRole="case_manager"
      />
    );

    // Title and case number
    expect(screen.getAllByText(new RegExp(sampleCase.case_number, "i")).length).toBeGreaterThan(0);
    expect(screen.getByText(/Destination Jurisdiction:/i)).toBeDefined();

    // Tab buttons exist
    expect(screen.getByRole("button", { name: /Overview & Team/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Milestones/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Tasks/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Dependants & Consents/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Notes & Activity/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /History Audit/i })).toBeDefined();

    // Stage transition form is visible
    expect(screen.getByText(/Current Controlled Lifecycle Stage/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Transition Stage/i })).toBeDefined();
  });

  it("switches to Milestones tab and shows milestones workflow", () => {
    render(
      <CaseDetailModal
        isOpen={true}
        onClose={vi.fn()}
        caseItem={sampleCase}
        activeRole="case_manager"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Milestones/i }));
    expect(screen.getByText(/Initial Strategy Consultation/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /\+ Add Milestone/i })).toBeDefined();
  });

  it("switches to Tasks tab and shows task assignment list", () => {
    render(
      <CaseDetailModal
        isOpen={true}
        onClose={vi.fn()}
        caseItem={sampleCase}
        activeRole="case_manager"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Tasks/i }));
    expect(screen.getByText(/Verify sworn English translations/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /\+ Add Task/i })).toBeDefined();
  });

  it("switches to Dependants tab and shows family management", () => {
    render(
      <CaseDetailModal
        isOpen={true}
        onClose={vi.fn()}
        caseItem={sampleCase}
        activeRole="case_manager"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Dependants & Consents/i }));
    expect(screen.getByText(/Family Members & Authorized Dependants/i)).toBeDefined();
    expect(screen.getByText(/Principal Applicant & Legal Consents/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /\+ Add Dependant/i })).toBeDefined();
  });

  it("switches to Notes tab and distinguishes internal strategy from client visible notes", () => {
    render(
      <CaseDetailModal
        isOpen={true}
        onClose={vi.fn()}
        caseItem={sampleCase}
        activeRole="case_manager"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Notes & Activity/i }));
    expect(screen.getByText(/Internal Legal Strategy/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Post Note/i })).toBeDefined();
  });

  it("renders CreateClientModal with duplicate-record detection and dependants section", async () => {
    const handleClose = vi.fn();
    const handleCreated = vi.fn();

    render(
      <CreateClientModal
        isOpen={true}
        onClose={handleClose}
        onClientCreated={handleCreated}
        activeRole="master_admin"
      />
    );

    expect(screen.getByText("Retain New Client / Applicant")).toBeDefined();
    expect(screen.getByText(/Add Principal Dependant \/ Family Member/i)).toBeDefined();
    expect(screen.getByText(/Record Form G-28 Legal Representation Agreement/i)).toBeDefined();

    // Type an email that matches Elena Rostova
    const emailInput = screen.getByPlaceholderText("e.g. marcus@example.com");
    fireEvent.change(emailInput, { target: { value: "elena.rostova@example.com" } });

    // Verify duplicate warning banner appears
    await waitFor(
      () => {
        expect(screen.getByText(/Duplicate Record Suggestion/i)).toBeDefined();
      },
      { timeout: 1500 }
    );
  });
});
