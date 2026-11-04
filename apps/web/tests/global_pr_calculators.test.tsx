import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DocumentoNavbar } from "../components/landing/DocumentoNavbar";
import { PrCalculatorsHubView as GlobalCalculatorsHub } from "../components/tools/PrCalculatorsHubView";
import { AustraliaSkillSelectTool } from "../components/tools/AustraliaSkillSelectTool";
import { NewZealandSmcTool } from "../components/tools/NewZealandSmcTool";
import { UkSkilledWorkerTool } from "../components/tools/UkSkilledWorkerTool";
import { GermanyPrCalculatorTool } from "../components/tools/GermanyPrCalculatorTool";

describe("Global Country-Separated PR Calculators Suite & Direct Page Navigation", () => {
  it("renders PR Calculators as a clean direct link to /calculators in DocumentoNavbar with zero dropdown menu", () => {
    render(<DocumentoNavbar onOpenLogin={vi.fn()} isLiveBackend={true} />);

    const link = screen.getByTestId("nav-pr-calculators-link");
    expect(link.textContent).toBe("PR Calculators");
    expect(link.getAttribute("href")).toBe("/calculators");

    // Verify dropdown menu is completely removed
    expect(screen.queryByTestId("pr-calculators-trigger")).toBeNull();
    expect(screen.queryByTestId("pr-calculators-menu")).toBeNull();
  });

  it("renders GlobalCalculatorsHub (/calculators) with personalized country photos, sovereign flags, interactive Radar, and 5-Country PR Fit Explorer", () => {
    const { container } = render(<GlobalCalculatorsHub />);

    expect(
      screen.getByRole("heading", { name: /PR & Skilled Migration Calculators/i })
    ).toBeDefined();

    // Verify sovereign flags and editorial architectural country images render across all jurisdictions
    const imgSrcs = Array.from(container.querySelectorAll("img")).map((img) =>
      img.getAttribute("src")
    );
    expect(imgSrcs).toContain("/flags/canada.png");
    expect(imgSrcs).toContain("/flags/australia.png");
    expect(imgSrcs).toContain("/flags/new-zealand.jpg");
    expect(imgSrcs).toContain("/flags/uk.png");
    expect(imgSrcs).toContain("/flags/germany.png");
    expect(imgSrcs).toContain("/flags/usa.png");
    expect(imgSrcs).toContain("/countries/canada.jpg");
    expect(imgSrcs).toContain("/countries/australia.jpg");
    expect(imgSrcs).toContain("/countries/new-zealand.jpg");
    expect(imgSrcs).toContain("/countries/uk.jpg");
    expect(imgSrcs).toContain("/countries/germany.jpg");

    // Sovereign Radar switches country snapshot AND panoramic country photo interactively
    const radar = screen.getByTestId("sovereign-radar-card");
    expect(radar.textContent).toContain("IRCC Express Entry");
    expect(screen.getByTestId("radar-country-photo").getAttribute("src")).toBe(
      "/countries/canada.jpg"
    );

    fireEvent.click(screen.getByRole("tab", { name: "DE" }));
    expect(radar.textContent).toContain("Chancenkarte");
    expect(screen.getByTestId("radar-country-photo").getAttribute("src")).toBe(
      "/countries/germany.jpg"
    );

    // Interactive 5-Country PR Fit Explorer starts neutral at 0 and updates live on click
    const explorer = screen.getByTestId("pr-pathway-pulse");
    expect(explorer.textContent).toContain("Awaiting Selection");
    fireEvent.click(screen.getByRole("button", { name: "45–55 yrs" }));
    expect(explorer.textContent).toContain("Ineligible (Age 45+ Gate)");

    fireEvent.click(screen.getByRole("button", { name: /Reset Explorer to 0/i }));
    expect(explorer.textContent).toContain("Awaiting Selection");

    // Filter to Australia only
    fireEvent.click(screen.getByTestId("hub-filter-australia"));
    expect(
      screen.getAllByText(/Australia SkillSelect PR Points Calculator/i).length
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/Express Entry CRS Score Calculator/i)).toBeNull();

    // Filter back to All Countries
    fireEvent.click(screen.getByRole("button", { name: /All Countries \(6\)/i }));
    expect(screen.getAllByText(/Express Entry CRS Score Calculator/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Chancenkarte \(Opportunity Card\)/i).length).toBeGreaterThan(0);
  });

  it("starts Australia SkillSelect strictly at 0 with zero sample scenarios, renders Sydney hero card, and scores Schedule 6D (+10 STEM Research) live", () => {
    const { container } = render(<AustraliaSkillSelectTool />);

    const imgSrcs = Array.from(container.querySelectorAll("img")).map((img) =>
      img.getAttribute("src")
    );
    expect(imgSrcs).toContain("/countries/australia.jpg");
    expect(imgSrcs).toContain("/flags/australia.png");

    expect(screen.getByTestId("au-grand-total").textContent).toBe("0");
    expect(screen.getByTestId("au-score-subclass_189").textContent).toBe("0");
    expect(screen.getByTestId("au-score-subclass_190").textContent).toBe("0");
    expect(screen.getByTestId("au-score-subclass_491").textContent).toBe("0");
    expect(screen.queryByText(/Load sample scenario/i)).toBeNull();
    expect(screen.queryByTestId("pr-calculators-trigger")).toBeNull();

    fireEvent.change(screen.getByLabelText(/Age at the time you are invited to apply/i), {
      target: { value: "25_to_32" },
    });
    expect(screen.getByTestId("au-grand-total").textContent).toBe("30");

    // Specialist STEM Research awards +10 points
    fireEvent.click(screen.getByRole("button", { name: "Yes (+10 pts)" }));
    expect(screen.getByTestId("au-grand-total").textContent).toBe("40");
    expect(screen.getByTestId("au-score-subclass_190").textContent).toBe("45");
    expect(screen.getByTestId("au-score-subclass_491").textContent).toBe("55");

    fireEvent.click(screen.getByRole("button", { name: /Reset to 0/i }));
    expect(screen.getByTestId("au-grand-total").textContent).toBe("0");
  });

  it("starts New Zealand SMC strictly at 0 with zero sample scenarios, renders Auckland hero card, and updates 6-point score live", () => {
    const { container } = render(<NewZealandSmcTool />);

    const imgSrcs = Array.from(container.querySelectorAll("img")).map((img) =>
      img.getAttribute("src")
    );
    expect(imgSrcs).toContain("/countries/new-zealand.jpg");
    expect(imgSrcs).toContain("/flags/new-zealand.jpg");

    expect(screen.getByTestId("nz-grand-total").textContent).toBe("0");
    expect(screen.queryByText(/Load sample scenario/i)).toBeNull();
    expect(screen.queryByTestId("pr-calculators-trigger")).toBeNull();

    fireEvent.change(screen.getByLabelText(/Highest recognized qualification/i), {
      target: { value: "nz_bachelor_or_level_8" },
    });
    expect(screen.getByTestId("nz-grand-total").textContent).toBe("5");

    fireEvent.change(
      screen.getByLabelText(/Skilled full-time work experience gained IN New Zealand/i),
      { target: { value: "1yr" } }
    );
    expect(screen.getByTestId("nz-grand-total").textContent).toBe("6");

    fireEvent.click(screen.getByRole("button", { name: /Reset to 0/i }));
    expect(screen.getByTestId("nz-grand-total").textContent).toBe("0");
  });

  it("starts UK 70-Point Skilled Worker strictly at 0 with zero sample scenarios, renders London Westminster hero card, and flags ILR salary floor", () => {
    const { container } = render(<UkSkilledWorkerTool />);

    const imgSrcs = Array.from(container.querySelectorAll("img")).map((img) =>
      img.getAttribute("src")
    );
    expect(imgSrcs).toContain("/countries/uk.jpg");
    expect(imgSrcs).toContain("/flags/uk.png");

    expect(screen.getByTestId("uk-grand-total").textContent).toBe("0");
    expect(screen.queryByText(/Load sample scenario/i)).toBeNull();
    expect(screen.queryByTestId("pr-calculators-trigger")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Yes — Licensed Sponsor CoS/i }));
    fireEvent.click(screen.getByRole("button", { name: /Yes — Eligible SOC Skill Level/i }));
    fireEvent.click(screen.getByRole("button", { name: /Yes — Meets English Requirement/i }));
    expect(screen.getByTestId("uk-grand-total").textContent).toBe("50");

    fireEvent.change(
      screen.getByLabelText(/Appendix Skilled Worker Tradeable Points Option/i),
      { target: { value: "option_e_new_entrant" } }
    );
    fireEvent.change(screen.getByLabelText(/Guaranteed Annual Gross Base Salary/i), {
      target: { value: "35000" },
    });
    expect(screen.getByTestId("uk-grand-total").textContent).toBe("70");
    expect(screen.getByTestId("uk-ilr-warning").textContent).toContain("£41,700");

    fireEvent.click(screen.getByRole("button", { name: /Reset to 0/i }));
    expect(screen.getByTestId("uk-grand-total").textContent).toBe("0");
  });

  it("starts Germany Chancenkarte & Blue Card strictly at 0 with zero sample scenarios, renders Berlin Brandenburg Gate hero card, and scores § 20b + Blue Card", () => {
    const { container } = render(<GermanyPrCalculatorTool />);

    const imgSrcs = Array.from(container.querySelectorAll("img")).map((img) =>
      img.getAttribute("src")
    );
    expect(imgSrcs).toContain("/countries/germany.jpg");
    expect(imgSrcs).toContain("/flags/germany.png");

    expect(screen.getByTestId("de-grand-total").textContent).toBe("0");
    expect(screen.queryByText(/Load sample scenario/i)).toBeNull();
    expect(screen.queryByTestId("pr-calculators-trigger")).toBeNull();

    fireEvent.change(screen.getByLabelText(/Academic \/ Vocational Qualification/i), {
      target: { value: "partial_recognition_defizitbescheid" },
    });
    fireEvent.change(screen.getByLabelText(/Applicant Age at Application/i), {
      target: { value: "35_or_under" },
    });
    expect(screen.getByTestId("de-grand-total").textContent).toBe("6");

    fireEvent.change(screen.getByLabelText(/Academic \/ Vocational Qualification/i), {
      target: { value: "foreign_degree_or_2yr_vocational" },
    });
    fireEvent.change(screen.getByLabelText(/German Gross Annual Salary Offer/i), {
      target: { value: "54000" },
    });
    expect(screen.getByTestId("de-bluecard-banner").textContent).toContain("27 months");

    fireEvent.click(screen.getByRole("button", { name: /Reset to 0/i }));
    expect(screen.getByTestId("de-grand-total").textContent).toBe("0");
  });
});
