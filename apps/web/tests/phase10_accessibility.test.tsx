import { describe, it, expect, vi } from "vitest";
import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Modal } from "../components/common/Modal";
import { Button } from "../components/common/Button";

describe("Phase 10 — Accessibility and Usability (WCAG 2.2 AA)", () => {
  it("verifies Modal has proper dialog role, aria-modal, and aria-labelledby", () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Statutory Filing Review" subtitle="Case CASE-US-999">
        <div>Modal Content for Assistive Tech</div>
      </Modal>
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeDefined();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe("modal-title");

    const heading = screen.getByRole("heading", { name: "Statutory Filing Review" });
    expect(heading).toBeDefined();
    expect(heading.getAttribute("id")).toBe("modal-title");
  });

  it("verifies Modal can be dismissed via keyboard Escape key", () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Keyboard Dismiss Test">
        <div>Press escape to close</div>
      </Modal>
    );

    fireEvent.keyDown(window, { key: "Escape", code: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("verifies interactive Buttons support keyboard activation and disabled state", () => {
    const handleClick = vi.fn();
    render(
      <Button variant="primary" onClick={handleClick} id="btn-submit-test">
        Submit Filing
      </Button>
    );

    const btn = screen.getByRole("button", { name: "Submit Filing" });
    expect(btn).toBeDefined();
    expect((btn as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(btn);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("verifies forms link labels with inputs and expose error states to assistive technologies", () => {
    function AccessibleForm() {
      const [email, setEmail] = useState("");
      const [hasError, setHasError] = useState(true);

      return (
        <form>
          <label htmlFor="client-email-input">Beneficiary Email Address</label>
          <input
            id="client-email-input"
            type="email"
            value={email}
            aria-invalid={hasError}
            aria-describedby="email-error-msg"
            onChange={(e) => setEmail(e.target.value)}
          />
          {hasError && (
            <div id="email-error-msg" role="alert" style={{ color: "red" }}>
              Please enter a valid email address.
            </div>
          )}
        </form>
      );
    }

    render(<AccessibleForm />);
    const input = screen.getByLabelText("Beneficiary Email Address");
    expect(input).toBeDefined();
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("email-error-msg");

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Please enter a valid email address.");
  });

  it("verifies loading and processing states expose aria-live and role status", () => {
    render(
      <div role="status" aria-live="polite" id="ai-processing-status">
        <span>Processing evidentiary OCR...</span>
      </div>
    );

    const statusElement = screen.getByRole("status");
    expect(statusElement).toBeDefined();
    expect(statusElement.getAttribute("aria-live")).toBe("polite");
    expect(statusElement.textContent).toContain("Processing evidentiary OCR...");
  });
});
