import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Home from "../app/page";
import {
  submitAgencyOnboarding,
  adjudicateAgencyKybApplication,
} from "../lib/agencyPlatformStore";
import { PLATFORM_HQ_OPERATOR_EMAIL } from "../lib/auth";

async function seedRealApprovedPartnerForSignIn() {
  const application = await submitAgencyOnboarding({
    legalEntityName: "Maple North Immigration Counsel Inc.",
    tradingName: "Maple North RCIC",
    requestedSlug: "maple-north-rcic",
    hqCountry: "CA",
    hqCity: "Ottawa",
    corporateDomain: "maplenorthrcic.ca",
    taxRegistrationId: "BN-719204881RC0001",
    contactFullName: "Harpreet Sidhu, RCIC",
    contactWorkEmail: "harpreet@maplenorthrcic.ca",
    contactPhone: "+1-613-555-0188",
    ownerPassword: "MapleNorthPassword2026!",
    kybTrack: "regulated_counsel",
    regulatoryBody: "CICC",
    licenseNumber: "R715902",
    targetCorridors: ["CA"],
    estimatedMonthlyCases: 20,
    requestedSeats: 5,
    branchCount: 1,
    selectedPlanTier: "growth",
    dpaAccepted: true,
    zeroTrainingAccepted: true,
  });

  adjudicateAgencyKybApplication(
    application.id,
    "approve",
    "Verified CICC registry standing.",
    PLATFORM_HQ_OPERATOR_EMAIL
  );
}

describe("Landing Page Sign-In and Sign-Out Flow", () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    window.scrollTo = vi.fn();
    await seedRealApprovedPartnerForSignIn();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it(
    "renders landing page, signs in as real provisioned agency owner with 0 demo cases, signs out, and restores landing page",
    async () => {
      render(<Home />);

      expect(screen.getByText(/Every immigration case\./i)).toBeDefined();
      expect(screen.getByText(/Clearer by design\./i)).toBeDefined();
      const signInBtn = screen.getAllByRole("button", { name: /Sign In/i })[0];
      fireEvent.click(signInBtn);

      expect(screen.getByText(/Sign in to Documento/i)).toBeDefined();

      fireEvent.change(screen.getByLabelText(/Business Email/i), {
        target: { value: "harpreet@maplenorthrcic.ca" },
      });
      fireEvent.change(screen.getByLabelText(/^Password$/i), {
        target: { value: "MapleNorthPassword2026!" },
      });
      fireEvent.click(screen.getByRole("button", { name: /Sign In to Firm Workspace/i }));

      await waitFor(
        () => {
          expect(screen.getAllByText(/Executive Command Center/i).length).toBeGreaterThan(0);
          expect(screen.queryByText(/Every immigration case\./i)).toBeNull();
        },
        { timeout: 2500 }
      );

      // Verify clean slate (zero demo cases or fake personas in live workspace)
      expect(screen.getByText("Active Caseload: 0 Petitions")).toBeDefined();
      expect(screen.queryByText(/Vanguard Immigration Law/i)).toBeNull();

      const profileBtn = screen.getByLabelText(/User profile menu/i);
      fireEvent.click(profileBtn);
      expect(screen.getAllByText(/Managing Partner/i).length).toBeGreaterThan(0);

      fireEvent.click(screen.getByRole("button", { name: /Sign Out of Documento/i }));

      await waitFor(() => {
        expect(screen.getByText(/Every immigration case\./i)).toBeDefined();
      });
      expect(screen.getByText(/You have been safely signed out of Documento\./i)).toBeDefined();
    },
    30000
  );

  it(
    "ensures on-scroll animated elements receive animate class when re-mounting upon sign out in browser with IntersectionObserver",
    async () => {
      const observedElements: Element[] = [];
      class MockIntersectionObserver {
        constructor(private callback: IntersectionObserverCallback) {}
        observe(el: Element) {
          observedElements.push(el);
          this.callback(
            [{ isIntersecting: true, target: el } as unknown as IntersectionObserverEntry],
            this as unknown as IntersectionObserver
          );
        }
        unobserve = vi.fn();
        disconnect = vi.fn();
      }
      (window as any).IntersectionObserver = MockIntersectionObserver;

      render(<Home />);

      const signInBtn = screen.getAllByRole("button", { name: /Sign In/i })[0];
      fireEvent.click(signInBtn);
      fireEvent.change(screen.getByLabelText(/Business Email/i), {
        target: { value: "harpreet@maplenorthrcic.ca" },
      });
      fireEvent.change(screen.getByLabelText(/^Password$/i), {
        target: { value: "MapleNorthPassword2026!" },
      });
      fireEvent.click(screen.getByRole("button", { name: /Sign In to Firm Workspace/i }));

      await waitFor(() => {
        expect(screen.getAllByText(/Executive Command Center/i).length).toBeGreaterThan(0);
      });

      fireEvent.click(screen.getByLabelText(/User profile menu/i));
      fireEvent.click(screen.getByRole("button", { name: /Sign Out of Documento/i }));

      await waitFor(() => {
        expect(screen.getByText(/Every immigration case\./i)).toBeDefined();
      });

      const animatedElements = document.querySelectorAll(".animate-on-scroll");
      expect(animatedElements.length).toBeGreaterThan(0);
      const animatedWithClass = document.querySelectorAll(".animate-on-scroll.animate");
      expect(animatedWithClass.length).toBeGreaterThan(0);

      delete (window as any).IntersectionObserver;
    },
    15000
  );
});
