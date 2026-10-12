import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { MetricCard } from "../components/common/MetricCard";
import { Modal } from "../components/common/Modal";
import { DataTable } from "../components/common/DataTable";
import { TextInput, CheckboxInput } from "../components/common/FormControls";
import { AlertBanner } from "../components/common/NotificationToast";

describe("Reusable Frontend Design Components", () => {
  it("renders Badge variants correctly", () => {
    const { rerender } = render(<Badge variant="verified">VERIFIED</Badge>);
    expect(screen.getByText("VERIFIED")).toBeDefined();

    rerender(<Badge variant="action">ACTION NEEDED</Badge>);
    expect(screen.getByText("ACTION NEEDED")).toBeDefined();
  });

  it("handles Button clicks and loading states", () => {
    const handleClick = vi.fn();
    const { rerender } = render(
      <Button variant="primary" onClick={handleClick}>
        Save Case
      </Button>
    );

    const button = screen.getByRole("button", { name: "Save Case" });
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);

    // Test loading state
    rerender(
      <Button variant="primary" isLoading onClick={handleClick}>
        Save Case
      </Button>
    );
    expect(button.getAttribute("aria-busy")).toBe("true");
  });

  it("renders MetricCard with defined meaning tooltip and drilldown action", () => {
    const handleDrilldown = vi.fn();
    render(
      <MetricCard
        label="Active Firm Petitions"
        value={142}
        meaning="Count of immigration petitions currently in progress across all caseworkers."
        onDrilldown={handleDrilldown}
        drilldownLabel="View all cases →"
      />
    );

    expect(screen.getByText("Active Firm Petitions")).toBeDefined();
    expect(screen.getByText("142")).toBeDefined();

    // Toggle meaning definition
    const infoButton = screen.getByLabelText("Definition for Active Firm Petitions");
    fireEvent.click(infoButton);
    expect(
      screen.getByText((content) =>
        content.includes("Count of immigration petitions currently in progress")
      )
    ).toBeDefined();

    // Click drill-down
    const drilldownBtn = screen.getByRole("button", { name: "View all cases →" });
    fireEvent.click(drilldownBtn);
    expect(handleDrilldown).toHaveBeenCalledTimes(1);
  });

  it("manages accessible Modal lifecycle and dismiss", () => {
    const handleClose = vi.fn();
    const { rerender } = render(
      <Modal isOpen={true} onClose={handleClose} title="Test Modal Title">
        <p>Modal Body Content</p>
      </Modal>
    );

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("Test Modal Title")).toBeDefined();
    expect(screen.getByText("Modal Body Content")).toBeDefined();

    // Click close button
    const closeBtn = screen.getByLabelText("Close dialog");
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    // Press Escape
    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(2);

    // When closed, should render nothing
    rerender(
      <Modal isOpen={false} onClose={handleClose} title="Test Modal Title">
        <p>Modal Body Content</p>
      </Modal>
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders DataTable with search, sort and pagination", () => {
    const testData = [
      { id: "1", name: "Alpha Case", stage: "Review" },
      { id: "2", name: "Beta Case", stage: "Intake" },
      { id: "3", name: "Gamma Case", stage: "Filed" },
    ];

    render(
      <DataTable
        columns={[
          { key: "name", header: "Name", sortable: true },
          { key: "stage", header: "Stage" },
        ]}
        data={testData}
        keyExtractor={(row) => row.id}
        searchPlaceholder="Filter items..."
      />
    );

    expect(screen.getByText("Alpha Case")).toBeDefined();
    expect(screen.getByText("Beta Case")).toBeDefined();
    expect(screen.getByText("Gamma Case")).toBeDefined();

    // Search input filters items
    const searchInput = screen.getByLabelText("Filter items...");
    fireEvent.change(searchInput, { target: { value: "Alpha" } });

    expect(screen.getByText("Alpha Case")).toBeDefined();
    expect(screen.queryByText("Beta Case")).toBeNull();
  });

  it("renders accessible FormControls with validation messages", () => {
    render(
      <TextInput
        label="Passport Number"
        value=""
        error="Invalid passport format"
        required
        onChange={() => {}}
      />
    );

    const input = screen.getByLabelText("Passport Number *");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText("Invalid passport format")).toBeDefined();
  });
});
