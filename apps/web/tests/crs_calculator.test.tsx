import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CrsCalculatorTool } from "../components/tools/CrsCalculatorTool";

describe("Canada Express Entry CRS Score Calculator UI (Zero-Start Audited)", () => {
  it("starts at 0 CRS points with zero sample scenarios and renders official 4-part IRCC ledger", () => {
    render(<CrsCalculatorTool />);

    expect(
      screen.getByRole("heading", { name: /Express Entry CRS Score Calculator/i })
    ).toBeDefined();

    // Grand total starts strictly at 0 out of 1,270
    expect(screen.getByTestId("crs-grand-total").textContent).toBe("0");
    expect(screen.getAllByText(/1,270/i).length).toBeGreaterThan(0);

    // Zero sample scenario presets exist anywhere in the UI
    expect(screen.queryByText(/Load sample scenario/i)).toBeNull();
    expect(screen.queryByText(/CEC Inland Engineer/i)).toBeNull();
    expect(screen.queryByText(/FSW Outland Master's/i)).toBeNull();
    expect(screen.queryByText(/French Bilingual \(NCLC 7\+\)/i)).toBeNull();
    expect(screen.queryByText(/Married Couple \+ CAN Study/i)).toBeNull();

    // Clean Day-0 guidance instead of premature error banners
    expect(
      screen.getByText(/Complete the questionnaire on the left to calculate your CRS score from 0/i)
    ).toBeDefined();
    expect(screen.queryByText(/Pool Entry Gate Not Yet Met:/i)).toBeNull();

    // Official 4 sections of IRCC Ministerial Instructions
    expect(screen.getAllByText(/Core \/ Human Capital/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Skill Transferability/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Additional Points/i).length).toBeGreaterThan(0);
  });

  it("accumulates CRS points live from 0 as user answers questions, supports booster preview + undo, and resets to 0", () => {
    render(<CrsCalculatorTool />);
    expect(screen.getByTestId("crs-grand-total").textContent).toBe("0");

    // 1. Select Age 28 -> +110 pts
    fireEvent.change(screen.getByLabelText(/How old are you\?/i), {
      target: { value: "28" },
    });
    expect(screen.getByTestId("crs-grand-total").textContent).toBe("110");

    // 2. Select Master's degree -> +135 pts = 245 pts
    fireEvent.change(screen.getByLabelText(/What is your level of education\?/i), {
      target: { value: "masters_or_professional" },
    });
    expect(screen.getByTestId("crs-grand-total").textContent).toBe("245");

    // 3. Confirm valid language test (< 2 years) & IELTS GT with CLB 9/9/9/8 -> +116 Core + 25 Transferability = 386 pts
    fireEvent.click(screen.getByRole("button", { name: /Yes \(Valid < 2 Years\)/i }));
    fireEvent.change(
      screen.getByLabelText(/Which language test did you take for your first official language\?/i),
      { target: { value: "ielts_gt" } }
    );
    fireEvent.change(screen.getByLabelText(/^Speaking/i), { target: { value: "9" } });
    fireEvent.change(screen.getByLabelText(/^Listening/i), { target: { value: "9" } });
    fireEvent.change(screen.getByLabelText(/^Reading/i), { target: { value: "9" } });
    fireEvent.change(screen.getByLabelText(/^Writing/i), { target: { value: "8" } });
    expect(screen.getByTestId("crs-grand-total").textContent).toBe("386");

    // 4. Preview a booster scenario and undo back to 386
    const previewButtons = screen.getAllByRole("button", { name: /Preview Scenario/i });
    expect(previewButtons.length).toBeGreaterThan(0);
    fireEvent.click(previewButtons[0]);
    expect(Number(screen.getByTestId("crs-grand-total").textContent)).toBeGreaterThan(386);

    fireEvent.click(screen.getByRole("button", { name: /Undo Booster Preview/i }));
    expect(screen.getByTestId("crs-grand-total").textContent).toBe("386");

    // 5. Reset back to 0 CRS points
    fireEvent.click(screen.getByRole("button", { name: /Reset to 0/i }));
    expect(screen.getByTestId("crs-grand-total").textContent).toBe("0");
  });

  it("evaluates Accompanying Spouse grid vs Non-Accompanying comparison and enforces Question 5 validity gate", () => {
    render(<CrsCalculatorTool />);

    // Select Married -> Not Citizen/PR -> Accompanying
    fireEvent.change(screen.getByLabelText(/What is your marital status\?/i), {
      target: { value: "married" },
    });
    const noButtons = screen.getAllByRole("button", { name: /^No$/i });
    fireEvent.click(noButtons[0]); // Spouse is NOT Citizen/PR
    fireEvent.click(screen.getByRole("button", { name: /Yes \(Accompanying\)/i }));

    expect(screen.getByText(/With Spouse Grid/i)).toBeDefined();
    expect(screen.getAllByText(/Non-accompanying/i).length).toBeGreaterThan(0);

    // Switch IRCC policy standard between 1,270 and 1,200
    const policySelect = screen.getByLabelText(
      /IRCC Ministerial Instructions Standard/i
    ) as HTMLSelectElement;
    expect(policySelect.value).toBe("nov_2026_lmi");
    fireEvent.change(policySelect, { target: { value: "mar_2025_no_job_offer" } });
    expect(policySelect.value).toBe("mar_2025_no_job_offer");
    expect(screen.getAllByText(/1,200/i).length).toBeGreaterThan(0);

    // Toggle "No / Not Taken Yet" on Question 5 valid language test gate
    fireEvent.click(screen.getByRole("button", { name: /No \/ Not Taken Yet/i }));
    expect(screen.getByText(/Express Entry Statutory Requirement:/i)).toBeDefined();
  });

  it("supports Exact Raw Score numeric input mode converting raw test scores live from 0", () => {
    render(<CrsCalculatorTool />);

    fireEvent.click(screen.getByRole("button", { name: /Yes \(Valid < 2 Years\)/i }));
    fireEvent.change(
      screen.getByLabelText(/Which language test did you take for your first official language\?/i),
      { target: { value: "ielts_gt" } }
    );
    fireEvent.click(screen.getByRole("button", { name: /Type Exact Raw Scores/i }));

    const rawInputs = screen.getAllByPlaceholderText(/Exact score/i);
    expect(rawInputs.length).toBe(4);

    // Enter IELTS Speaking 7.5 -> converts to CLB 10+ (34 pts single)
    fireEvent.change(rawInputs[0], { target: { value: "7.5" } });
    expect(screen.getAllByText(/CLB 10\+/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId("crs-grand-total").textContent).toBe("34");
  });
});
