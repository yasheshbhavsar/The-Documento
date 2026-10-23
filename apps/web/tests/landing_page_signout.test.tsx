import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Home from "../app/page";

describe("Landing Page Sign-In and Sign-Out Flow", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.scrollTo = vi.fn();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it(
    "renders landing page, signs in, signs out, and ensures landing page remains fully visible",
    async () => {
    render(<Home />);

    // 1. Initial State: Landing page should be visible
    expect(screen.getByText(/Every immigration case\./i)).toBeDefined();
    expect(screen.getByText(/Clearer by design\./i)).toBeDefined();
    const signInBtn = screen.getAllByRole("button", { name: /Sign In/i })[0];
    expect(signInBtn).toBeDefined();

    // 2. Open Login Modal
    fireEvent.click(signInBtn);

    // Login modal should be open
    expect(screen.getByText(/Sign in to Documento/i)).toBeDefined();

    // 3. Enter credentials & submit login
    const emailInput = screen.getByLabelText(/Business Email/i);
    const passwordInput = screen.getByLabelText(/^Password$/i);
    const submitBtn = screen.getByRole("button", { name: /Sign In to Firm Workspace/i });
    fireEvent.change(emailInput, { target: { value: "sarah.jenkins@vanguardlegal.com" } });
    fireEvent.change(passwordInput, { target: { value: "SecurePassword2026!" } });
    fireEvent.click(submitBtn);

    // Wait for login state transition (modal has 400ms setTimeout)
    await waitFor(
      () => {
        expect(screen.getAllByText(/Executive Command Center/i).length).toBeGreaterThan(0);
        expect(screen.queryByText(/Every immigration case\./i)).toBeNull();
      },
      { timeout: 2000 }
    );

    // 4. Open User Profile Menu in WorkspaceHeader
    const profileBtn = screen.getByLabelText(/User profile and persona switch menu/i);
    fireEvent.click(profileBtn);

    // Now Managing Partner and Sign Out should be in the opened menu
    expect(screen.getAllByText(/Managing Partner/i).length).toBeGreaterThan(0);

    // 5. Click Sign Out
    const signOutBtn = screen.getByRole("button", { name: /Sign Out of Documento/i });
    fireEvent.click(signOutBtn);

    // 6. Verify Landing Page is mounted back
    await waitFor(() => {
      expect(screen.getByText(/Every immigration case\./i)).toBeDefined();
    });
    expect(screen.getByText(/Clearer by design\./i)).toBeDefined();
    expect(screen.getByText(/Eliminate administrative paperwork chaos\./i)).toBeDefined();

    // Verify banner alert
    expect(screen.getByText(/You have been safely signed out of Documento\./i)).toBeDefined();
  }, 30000);

  it(
    "ensures on-scroll animated elements receive animate class when re-mounting upon sign out in browser with IntersectionObserver",
    async () => {
    // Mock browser IntersectionObserver
    const observedElements: Element[] = [];
    class MockIntersectionObserver {
      constructor(private callback: IntersectionObserverCallback) {}
      observe(el: Element) {
        observedElements.push(el);
        // Simulate immediate intersection entry
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

    // 1. Initial State: Landing page should be visible
    expect(screen.getByText(/Every immigration case\./i)).toBeDefined();

    // 2. Open Login Modal & Sign In
    const signInBtn = screen.getAllByRole("button", { name: /Sign In/i })[0];
    fireEvent.click(signInBtn);
    const emailInput = screen.getByLabelText(/Business Email/i);
    const passwordInput = screen.getByLabelText(/^Password$/i);
    const submitBtn = screen.getByRole("button", { name: /Sign In to Firm Workspace/i });
    fireEvent.change(emailInput, { target: { value: "sarah.jenkins@vanguardlegal.com" } });
    fireEvent.change(passwordInput, { target: { value: "SecurePassword2026!" } });
    fireEvent.click(submitBtn);

    // Wait for login transition
    await waitFor(() => {
      expect(screen.getAllByText(/Executive Command Center/i).length).toBeGreaterThan(0);
    });

    // 3. Trigger Sign Out
    const profileBtn = screen.getByLabelText(/User profile and persona switch menu/i);
    fireEvent.click(profileBtn);
    const signOutBtn = screen.getByRole("button", { name: /Sign Out of Documento/i });
    fireEvent.click(signOutBtn);

    // 4. Verify Landing Page returns and animated elements have animate class
    await waitFor(() => {
      expect(screen.getByText(/Every immigration case\./i)).toBeDefined();
    });

    const animatedElements = document.querySelectorAll(".animate-on-scroll");
    expect(animatedElements.length).toBeGreaterThan(0);

    // Verify all in-view elements received the .animate class so they are not blank/paused
    const animatedWithClass = document.querySelectorAll(".animate-on-scroll.animate");
    expect(animatedWithClass.length).toBeGreaterThan(0);

    // Clean up mock
    delete (window as any).IntersectionObserver;
  }, 15000);
});
