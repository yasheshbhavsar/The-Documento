import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PnpCalculatorTool } from "../components/tools/PnpCalculatorTool";

describe("Canada Provincial Nominee Program (PNP) Calculator UI (Zero-Start Audited)", () => {
  it("starts strictly at 0 points across all 6 provinces with zero sample scenario presets", () => {
    render(<PnpCalculatorTool />);

    expect(
      screen.getByRole("heading", {
        name: /Provincial Nominee Program \(PNP\) Points Calculator/i,
      })
    ).toBeDefined();

    // Primary active readout starts at 0 / 132 (Ontario OINP)
    expect(screen.getByTestId("pnp-grand-total").textContent).toBe("0");

    // All 6 province tabs start strictly at 0
    for (const id of [
      "ontario_oinp",
      "bc_pnp",
      "alberta_aaip",
      "saskatchewan_sinp",
      "manitoba_mpnp",
      "pei_pnp",
    ]) {
      expect(screen.getByTestId(`pnp-tab-score-${id}`).textContent).toBe("0");
    }

    // Zero sample scenario / preset buttons exist anywhere
    expect(screen.queryByText(/Load sample scenario/i)).toBeNull();
    expect(screen.queryByText(/Sample Profile/i)).toBeNull();

    // Clean Day-0 zero-state guidance
    expect(
      screen.getByText(
        /Complete the questionnaire on the left to calculate your provincial EOI \/ selection score from 0/i
      )
    ).toBeDefined();
  });

  it("updates all 6 provincial scores simultaneously from shared human capital inputs, previews boosters, and resets to 0", () => {
    render(<PnpCalculatorTool />);

    // 1. Select Age 28 -> ON stays 0 (age not scored), AB=5, SK=12, MB=75, PE=20
    fireEvent.change(screen.getByLabelText(/How old are you\?/i), {
      target: { value: "28" },
    });
    expect(screen.getByTestId("pnp-tab-score-ontario_oinp").textContent).toBe("0");
    expect(screen.getByTestId("pnp-tab-score-alberta_aaip").textContent).toBe("5");
    expect(screen.getByTestId("pnp-tab-score-saskatchewan_sinp").textContent).toBe("12");
    expect(screen.getByTestId("pnp-tab-score-manitoba_mpnp").textContent).toBe("75");
    expect(screen.getByTestId("pnp-tab-score-pei_pnp").textContent).toBe("20");

    // 2. Select Master's degree -> ON=8, BC=22, AB=5+10=15, SK=12+23=35, MB=75+125=200, PE=20+15=35
    fireEvent.change(
      screen.getByLabelText(/What is your highest level of completed education/i),
      { target: { value: "masters" } }
    );
    expect(screen.getByTestId("pnp-grand-total").textContent).toBe("8");
    expect(screen.getByTestId("pnp-tab-score-bc_pnp").textContent).toBe("22");
    expect(screen.getByTestId("pnp-tab-score-alberta_aaip").textContent).toBe("15");
    expect(screen.getByTestId("pnp-tab-score-saskatchewan_sinp").textContent).toBe("35");
    expect(screen.getByTestId("pnp-tab-score-manitoba_mpnp").textContent).toBe("200");
    expect(screen.getByTestId("pnp-tab-score-pei_pnp").textContent).toBe("35");

    // 3. Switch to BC PNP tab, convert $78,000/yr @ 37.5 hrs/wk -> $40.00/hr (+25 Economic pts -> 47)
    fireEvent.click(screen.getByTestId("pnp-tab-bc_pnp"));
    expect(screen.getByTestId("pnp-grand-total").textContent).toBe("22");

    fireEvent.click(screen.getByRole("button", { name: /Convert Annual Salary/i }));
    fireEvent.change(screen.getByLabelText(/Annual Base Salary/i), {
      target: { value: "78000" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Apply \$40\.00\/hr/i }));
    expect(screen.getByTestId("pnp-grand-total").textContent).toBe("47");
    // Ontario OINP also receives $40/hr -> +15 pts (8 + 15 = 23)
    expect(screen.getByTestId("pnp-tab-score-ontario_oinp").textContent).toBe("23");

    // 4. Preview booster scenario on BC PNP and undo back to 47
    const previewBtns = screen.getAllByRole("button", { name: /Preview Scenario/i });
    expect(previewBtns.length).toBeGreaterThan(0);
    fireEvent.click(previewBtns[0]);
    expect(Number(screen.getByTestId("pnp-grand-total").textContent)).toBeGreaterThan(47);

    fireEvent.click(screen.getByRole("button", { name: /Undo Booster Preview/i }));
    expect(screen.getByTestId("pnp-grand-total").textContent).toBe("47");

    // 5. Reset to 0 clears all provinces back to 0 while keeping active BC PNP tab
    fireEvent.click(screen.getByRole("button", { name: /Reset to 0/i }));
    expect(screen.getByTestId("pnp-grand-total").textContent).toBe("0");
    expect(screen.getByTestId("pnp-tab-score-ontario_oinp").textContent).toBe("0");
    expect(screen.getByTestId("pnp-tab-score-manitoba_mpnp").textContent).toBe("0");
  });

  it("evaluates Saskatchewan SINP 60-point pass mark gate and Manitoba MPNP -100/-200 Risk Assessment deductions", () => {
    render(<PnpCalculatorTool />);

    // Switch to Saskatchewan SINP -> select Master's (23) + SK Job Approval Letter (+30) = 53 (below 60 pass mark)
    fireEvent.click(screen.getByTestId("pnp-tab-saskatchewan_sinp"));
    fireEvent.change(
      screen.getByLabelText(/What is your highest level of completed education/i),
      { target: { value: "masters" } }
    );
    fireEvent.click(screen.getByRole("button", { name: /Yes \(\+30 pts\)/i }));
    expect(screen.getByTestId("pnp-grand-total").textContent).toBe("53");
    expect(screen.getByText(/Below SINP Minimum Pass Mark: 7 more points needed/i)).toBeDefined();

    // Add Age 28 (+12 pts) -> 65 / 110 -> Meets SINP Statutory Pass Mark
    fireEvent.change(screen.getByLabelText(/How old are you\?/i), {
      target: { value: "28" },
    });
    expect(screen.getByTestId("pnp-grand-total").textContent).toBe("65");
    expect(screen.getByText(/Meets SINP Statutory Pass Mark/i)).toBeDefined();

    // Switch to Manitoba MPNP -> currently Age 28 (75) + Master's (125) = 200
    fireEvent.click(screen.getByTestId("pnp-tab-manitoba_mpnp"));
    expect(screen.getByTestId("pnp-grand-total").textContent).toBe("200");

    // Trigger Risk Assessment deduction: worked in another province (-100) -> drops to 100
    const riskYesButtons = screen.getAllByRole("button", { name: /Yes \(-100 pts\)/i });
    fireEvent.click(riskYesButtons[0]);
    expect(screen.getByTestId("pnp-grand-total").textContent).toBe("100");
  });
});

