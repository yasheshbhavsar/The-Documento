import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { deflateSync } from "node:zlib";
import {
  analyzeDocumentStandalone,
  generateClientFallbackAnalysis,
  runSmartIntakePipeline,
} from "../lib/api/extractor";
import { extractProfileFromDocument } from "../lib/documentAutoFillEngine";
import { CreateClientModal } from "../components/modals/CreateClientModal";

function buildCompressedFlatePdfBytes(lines: string[]): Uint8Array {
  const ops = [
    "BT",
    "/F1 12 Tf",
    "48 740 Td",
    ...lines.map((line, i) => `${i > 0 ? "0 -18 Td " : ""}(${line.replace(/[()\\]/g, "\\$&")}) Tj`),
    "ET",
  ].join("\n");

  const compressed = deflateSync(Buffer.from(ops, "latin1"));
  const header = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R >> endobj\n", "latin1");
  const obj4Start = Buffer.from(`4 0 obj << /Length ${compressed.length} /Filter /FlateDecode >>\nstream\n`, "latin1");
  const obj4End = Buffer.from("\nendstream\nendobj\n%%EOF\n", "latin1");
  return new Uint8Array(Buffer.concat([header, obj4Start, compressed, obj4End]));
}

describe("Offline compressed /FlateDecode PDF decompression & OCR-offline UI banner", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("decompresses /FlateDecode PDF text streams offline to extract passport profile", async () => {
    const pdfBytes = buildCompressedFlatePdfBytes([
      "REPUBLIC OF INDIA PASSPORT",
      "Passport No: T8392014",
      "Surname: PATEL",
      "Given Names: ROHAN MAHESH",
      "Nationality: INDIAN",
      "Date of Birth: 14/08/1992",
      "Date of Expiry: 11/05/2031",
    ]);

    const file = new File([pdfBytes as unknown as BlobPart], "compressed_passport.pdf", { type: "application/pdf" });
    const profile = await extractProfileFromDocument(file);

    expect(profile.firstName).toBe("ROHAN MAHESH");
    expect(profile.lastName).toBe("PATEL");
    expect(profile.passportNumber).toBe("T8392014");
    expect(profile.nationality).toBe("INDIAN");
  });

  it("marks backend_offline=true only when backend connectivity fails and not on blank non-errored fallback", async () => {
    const emptyBytes = new Uint8Array(Buffer.from("%PDF-1.4\n%%EOF", "latin1"));
    const file = new File([emptyBytes], "scanned.pdf", { type: "application/pdf" });

    const offlineResult = await generateClientFallbackAnalysis({ file }, "Failed to fetch");
    expect(offlineResult.metadata.backend_offline).toBe(true);
    expect(offlineResult.extracted_fields).toEqual([]);

    const validationErrResult = await generateClientFallbackAnalysis({ file }, "Analysis failed with HTTP 422");
    expect(validationErrResult.metadata.backend_offline).toBe(false);
  });

  it("displays an actionable backend-offline notice and Re-scan button in CreateClientModal when scan finds 0 fields offline", async () => {
    const scannedStub = new File(
      [new Uint8Array(Buffer.from("%PDF-1.4\n% binary-image-only\n%%EOF", "latin1"))],
      "PASSPORT - SAMPLE.pdf",
      { type: "application/pdf" }
    );

    const onClose = vi.fn();
    const onClientCreated = vi.fn();

    render(
      <CreateClientModal
        isOpen={true}
        onClose={onClose}
        onClientCreated={onClientCreated}
      />
    );

    const dropInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(dropInput).toBeTruthy();

    fireEvent.change(dropInput, { target: { files: [scannedStub] } });

    await waitFor(() => {
      const banner = screen.getByTestId("autofill-success-banner");
      expect(banner.textContent).toContain("0");
      expect(banner.textContent).not.toContain("no scannable found");
      expect(screen.getByRole("button", { name: /Re-scan/i })).toBeTruthy();
    });
  });

  it("does not drop backend errors inside analyzeDocumentStandalone", async () => {
    const file = new File([Buffer.from("plain text")], "sample.txt", { type: "text/plain" });
    const res = await analyzeDocumentStandalone({ file });
    expect(res.status).toBe("success");
    const smartRes = await runSmartIntakePipeline([file]);
    expect(smartRes.totalFilesDropped).toBe(1);
  });
});
