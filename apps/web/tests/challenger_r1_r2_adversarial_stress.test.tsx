/** @vitest-environment jsdom */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

import {
  normalizeDateToDDMMYYYY,
  extractProfileFromAnalysis,
  mapAnalysisToInitialInfoSheet,
  mapPacketToInitialInfoSheet,
  hydrateCanonicalForm,
  persistAndBroadcastAutoFill,
  getAutoFillProvenance,
  CANONICAL_FORM_SCHEMAS,
} from "../lib/documentAutoFillEngine";
import {
  ExtractorAnalysisResult,
  PacketSortResult,
  MINIMAL_VALID_PDF_BASE64,
  MINIMAL_VALID_ZIP_BASE64,
  sortDocumentPacket,
} from "../lib/api/extractor";
import { INITIAL_INFO_SHEET_STORAGE_KEY } from "../components/portal/InitialInformationSheet";
import { DocumentExtractorLab } from "../components/tools/DocumentExtractorLab";
import * as extractorApi from "../lib/api/extractor";

describe("Adversarial Verification & Empirical Stress Suite: R1 & R2", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  // =========================================================================
  // 1. Extreme Date Inputs & Edge Cases in normalizeDateToDDMMYYYY
  // =========================================================================
  describe("1. Date Normalization Adversarial Stress (normalizeDateToDDMMYYYY)", () => {
    it("handles null, undefined, non-strings, and whitespace safely", () => {
      expect(normalizeDateToDDMMYYYY(null)).toBe("");
      expect(normalizeDateToDDMMYYYY(undefined)).toBe("");
      expect(normalizeDateToDDMMYYYY("")).toBe("");
      expect(normalizeDateToDDMMYYYY("    ")).toBe("");
      expect(normalizeDateToDDMMYYYY("\t\n\r  ")).toBe("");
      expect(normalizeDateToDDMMYYYY(12345 as any)).toBe("");
      expect(normalizeDateToDDMMYYYY({} as any)).toBe("");
      expect(normalizeDateToDDMMYYYY([] as any)).toBe("");
    });

    it("correctly handles various ISO-8601 timestamps and date patterns", () => {
      expect(normalizeDateToDDMMYYYY("2026-03-31")).toBe("31/03/2026");
      expect(normalizeDateToDDMMYYYY("1985-01-09T08:00:00Z")).toBe("09/01/1985");
      expect(normalizeDateToDDMMYYYY("2024-02-29T12:30:45.000Z")).toBe("29/02/2024");
      expect(normalizeDateToDDMMYYYY("1999/12/31")).toBe("31/12/1999");
    });

    it("correctly normalizes US slash format (MM/DD/YYYY) vs standard (DD/MM/YYYY)", () => {
      // Month <= 12 and Day > 12: unambiguously US MM/DD/YYYY -> converts to DD/MM/YYYY
      expect(normalizeDateToDDMMYYYY("05/14/1990")).toBe("14/05/1990");
      expect(normalizeDateToDDMMYYYY("12/31/2025")).toBe("31/12/2025");
      expect(normalizeDateToDDMMYYYY("08/25/1992")).toBe("25/08/1992");

      // Already DD/MM/YYYY format
      expect(normalizeDateToDDMMYYYY("14/05/1990")).toBe("14/05/1990");
      expect(normalizeDateToDDMMYYYY("28/11/2021")).toBe("28/11/2021");
      expect(normalizeDateToDDMMYYYY("31/12/2020")).toBe("31/12/2020");

      // Single digit padding
      expect(normalizeDateToDDMMYYYY("5/9/2022")).toBe("05/09/2022");
    });

    it("handles delimiters like dots and hyphens", () => {
      expect(normalizeDateToDDMMYYYY("14-05-1990")).toBe("14/05/1990");
      expect(normalizeDateToDDMMYYYY("09.11.2021")).toBe("09/11/2021");
      expect(normalizeDateToDDMMYYYY("1-2-2023")).toBe("01/02/2023");
      expect(normalizeDateToDDMMYYYY("2024-02-29")).toBe("29/02/2024");
    });

    it("handles written text dates with various case and formatting", () => {
      expect(normalizeDateToDDMMYYYY("14 May 1990")).toBe("14/05/1990");
      expect(normalizeDateToDDMMYYYY("14-MAY-1990")).toBe("14/05/1990");
      expect(normalizeDateToDDMMYYYY("May 14, 1990")).toBe("14/05/1990");
      expect(normalizeDateToDDMMYYYY("OCTOBER 2, 1869")).toBe("02/10/1869");
      expect(normalizeDateToDDMMYYYY("15 August 1947")).toBe("15/08/1947");
      expect(normalizeDateToDDMMYYYY("28 Nov 2021")).toBe("28/11/2021");
    });

    it("gracefully falls back on arbitrary or partial strings without throwing", () => {
      // Partial or unparseable text
      const res1 = normalizeDateToDDMMYYYY("NotADate");
      expect(res1).toBe("NotADate");

      const res2 = normalizeDateToDDMMYYYY("Circa 1990");
      expect(typeof res2).toBe("string");

      // Non-leap year date handling (1900-02-29 matches YYYY-MM-DD regex)
      const resLeap = normalizeDateToDDMMYYYY("1900-02-29");
      expect(resLeap).toBe("29/02/1900");
    });
  });

  // =========================================================================
  // 2. Corrupted & Empty Analysis Payloads
  // =========================================================================
  describe("2. Corrupted & Empty Payload Resilience", () => {
    it("extractProfileFromAnalysis survives completely empty or corrupted objects", () => {
      const corruptedAnalysis = {} as ExtractorAnalysisResult;
      const profile = extractProfileFromAnalysis(corruptedAnalysis);

      expect(profile).toBeDefined();
      expect(profile.firstName).toBe("");
      expect(profile.lastName).toBe("");
      expect(profile.email).toBe("");
      expect(profile.phone).toBe("");
      expect(profile.passportNumber).toBe("");
      expect(profile.confidence).toBeGreaterThan(0);
      expect(profile.sourceDocumentName).toBe("Uploaded Document");
      expect(profile.suggestedJurisdiction).toBe("United States (USCIS)");
    });

    it("extractProfileFromAnalysis handles null fields, undefined values, and single names", () => {
      const singleNameAnalysis: ExtractorAnalysisResult = {
        status: "success",
        metadata: {
          filename: "single_name_doc.pdf",
          mime_type: "application/pdf",
          file_size_bytes: 1000,
          sha256_hash: "single-hash",
          page_count: 1,
          detected_language: "en",
          total_blocks_detected: 2,
          overall_health_score: 90,
        },
        recognition: {
          category: "identity_passport",
          category_label: "Passports and Identity Documents",
          confidence: 0.95,
          matched_keywords: [],
        },
        extracted_fields: [
          {
            field_name: "full_name",
            field_label: "Full Name",
            original_value: "Prince",
            normalized_value: "Prince",
            source_page: 1,
            ocr_confidence: 0.99,
            extraction_confidence: 0.99,
            calibrated_confidence: 0.99,
            extraction_method: "single_name",
            model_version: "v1",
            bounding_box: [0, 0, 0, 0],
            review_status: "VERIFIED",
          },
        ],
        quality_findings: [],
        specialized_intelligence: {},
        ocr_summary: { ocr_applied: false, avg_page_confidence: 1, pages: [] },
        raw_text_preview: "Prince",
      };

      const profile = extractProfileFromAnalysis(singleNameAnalysis);
      expect(profile.firstName).toBe("Prince");
      expect(profile.lastName).toBe("");
    });

    it("mapAnalysisToInitialInfoSheet handles empty object and null inputs gracefully", () => {
      const res = mapAnalysisToInitialInfoSheet({} as any, null);
      expect(res).toBeDefined();
      expect(res.fieldsFilledCount).toBe(0);
      expect(res.updatedData).toBeDefined();
      expect(res.provenance).toBeDefined();
    });

    it("mapPacketToInitialInfoSheet handles corrupted packets with null person folders", () => {
      const corruptedPacket: PacketSortResult = {
        status: "success",
        source_filename: "corrupt.pdf",
        total_pages_analyzed: 0,
        total_persons_detected: 0,
        total_split_documents: 0,
        person_folders: null as any,
        zip_archive_filename: "corrupt.zip",
      };

      const res = mapPacketToInitialInfoSheet(corruptedPacket);
      expect(res.fieldsFilledCount).toBe(0);
      expect(res.updatedData).toEqual({});
      expect(res.provenance).toEqual({});
    });
  });

  // =========================================================================
  // 3. Form Schemas Hydration & Inadmissibility Safeguards
  // =========================================================================
  describe("3. Canonical Form Schemas & Inadmissibility Safeguards", () => {
    const canonicalCodes = ["USCIS_I140", "USCIS_G28", "USCIS_I485", "IRCC_IMM5257"];

    it("verifies all canonical schemas exist and define sensitive questions as is_sensitive: true", () => {
      canonicalCodes.forEach((code) => {
        const schema = CANONICAL_FORM_SCHEMAS[code];
        expect(schema).toBeDefined();
        expect(schema.form_code).toBe(code);
        expect(schema.versions[0]?.schema_definition?.sections.length).toBeGreaterThan(0);
      });

      // I-140 Part 4 sensitive check
      const i140Sections = CANONICAL_FORM_SCHEMAS["USCIS_I140"].versions[0].schema_definition.sections;
      const i140Criminal = i140Sections
        .flatMap((s) => s.fields)
        .find((f) => f.key === "prior_removal_or_criminal_record");
      expect(i140Criminal).toBeDefined();
      expect(i140Criminal?.is_sensitive).toBe(true);

      // G-28 Part 2 sensitive check
      const g28Sections = CANONICAL_FORM_SCHEMAS["USCIS_G28"].versions[0].schema_definition.sections;
      const g28Order = g28Sections
        .flatMap((s) => s.fields)
        .find((f) => f.key === "is_subject_to_order");
      expect(g28Order).toBeDefined();
      expect(g28Order?.is_sensitive).toBe(true);

      // I-485 Part 8 sensitive check
      const i485Sections = CANONICAL_FORM_SCHEMAS["USCIS_I485"].versions[0].schema_definition.sections;
      const i485Arrest = i485Sections
        .flatMap((s) => s.fields)
        .find((f) => f.key === "inadmissibility_arrests_citations");
      expect(i485Arrest).toBeDefined();
      expect(i485Arrest?.is_sensitive).toBe(true);

      // IMM 5257 Section 6 sensitive check
      const immSections = CANONICAL_FORM_SCHEMAS["IRCC_IMM5257"].versions[0].schema_definition.sections;
      const immRefusal = immSections
        .flatMap((s) => s.fields)
        .find((f) => f.key === "prior_visa_refusal_canada_or_other");
      expect(immRefusal).toBeDefined();
      expect(immRefusal?.is_sensitive).toBe(true);
    });

    it("guarantees sensitive inadmissibility fields are NEVER auto-confirmed by AI or documents", () => {
      canonicalCodes.forEach((code) => {
        const submission = hydrateCanonicalForm(
          code,
          { id: "case-99", title: "Test Case", visa_category: "EB-1A" } as any,
          { id: "client-99", first_name: "Test", last_name: "Applicant", email: "t@example.com" } as any,
          [
            {
              id: "doc-inadmissible",
              title: "Police Certificate",
              category: "criminal_background",
              extracted_fields: [
                {
                  id: "f-1",
                  field_name: "prior_removal_or_criminal_record",
                  original_value: "true",
                  normalized_value: "true",
                  confidence: 0.99,
                },
                {
                  id: "f-2",
                  field_name: "inadmissibility_arrests_citations",
                  original_value: "true",
                  normalized_value: "true",
                  confidence: 0.99,
                },
                {
                  id: "f-3",
                  field_name: "prior_visa_refusal_canada_or_other",
                  original_value: "true",
                  normalized_value: "true",
                  confidence: 0.99,
                },
              ],
            } as any,
          ]
        );

        expect(submission).toBeDefined();
        // sensitive_fields_reviewed MUST be false on initial hydration
        expect(submission.sensitive_fields_reviewed).toBe(false);

        // Check each sensitive field specifically: is_confirmed must be strictly false
        const sensitiveKeys = [
          "prior_removal_or_criminal_record",
          "inadmissibility_arrests_citations",
          "inadmissibility_violations",
          "is_subject_to_order",
          "prior_visa_refusal_canada_or_other",
          "prior_criminal_charges",
        ];

        for (const [key, answer] of Object.entries(submission.answers)) {
          if (sensitiveKeys.includes(key)) {
            expect(answer.is_confirmed).toBe(false);
            expect(answer.source_type).toBe("user_provided");
          }
        }
      });
    });

    it("hydrates forms safely when client, case, and documents are null", () => {
      canonicalCodes.forEach((code) => {
        const submission = hydrateCanonicalForm(code, null, null, []);
        expect(submission).toBeDefined();
        expect(submission.status).toBe("draft");
        expect(submission.completion_percentage).toBeGreaterThanOrEqual(0);
        expect(submission.completion_percentage).toBeLessThanOrEqual(100);
      });
    });
  });

  // =========================================================================
  // 4. Persistence & Broadcast Custom Event Listeners
  // =========================================================================
  describe("4. Persistence & Broadcast Custom Event", () => {
    it("persists to localStorage and dispatches 'documento-autofill-updated' event caught by listeners", () => {
      const caughtEvents: any[] = [];
      const handler = (event: Event) => {
        caughtEvents.push((event as CustomEvent).detail);
      };

      window.addEventListener("documento-autofill-updated", handler);

      const testPayload = {
        formData: {
          family_name: "PATEL",
          given_names: "PRIYA",
          passport_number: "P1234567",
        },
        provenance: {
          family_name: {
            field_name: "family_name",
            field_label: "Family Name",
            value: "PATEL",
            source_type: "document_ocr" as const,
            confidence: 0.97,
            extracted_at: new Date().toISOString(),
          },
        },
        sourceDocId: "doc-pass-1",
        sourceFilename: "passport_priya.pdf",
      };

      persistAndBroadcastAutoFill("client_007", testPayload);

      expect(caughtEvents.length).toBe(1);
      expect(caughtEvents[0].storageKeyId).toBe("client_007");
      expect(caughtEvents[0].formData.family_name).toBe("PATEL");
      expect(caughtEvents[0].sourceDocId).toBe("doc-pass-1");

      // Verify localStorage
      const stored = JSON.parse(window.localStorage.getItem(INITIAL_INFO_SHEET_STORAGE_KEY) || "{}");
      expect(stored["client_007"]).toBeDefined();
      expect(stored["client_007"].formData.family_name).toBe("PATEL");
      expect(stored["client_007"].fieldProvenance.family_name.confidence).toBe(0.97);

      // Verify retrieval helper
      const prov = getAutoFillProvenance("client_007");
      expect(prov.family_name.value).toBe("PATEL");

      window.removeEventListener("documento-autofill-updated", handler);
    });

    it("survives localStorage quota or access exceptions gracefully", () => {
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("QuotaExceededError: storage full");
      });

      let eventFired = false;
      const handler = () => {
        eventFired = true;
      };
      window.addEventListener("documento-autofill-updated", handler);

      expect(() => {
        persistAndBroadcastAutoFill("client_008", {
          formData: { given_names: "Test" },
        });
      }).not.toThrow();

      // Broadcast event still dispatches even if storage set fails
      expect(eventFired).toBe(true);

      window.removeEventListener("documento-autofill-updated", handler);
      setItemSpy.mockRestore();
    });
  });

  // =========================================================================
  // 5. Base64 Validity: MINIMAL_VALID_PDF_BASE64 & MINIMAL_VALID_ZIP_BASE64
  // =========================================================================
  describe("5. Base64 Assets Decoding (Zero DOMException Guarantee)", () => {
    it("decodes MINIMAL_VALID_PDF_BASE64 with atob() without throwing DOMException and has valid PDF header", () => {
      expect(() => {
        const binary = atob(MINIMAL_VALID_PDF_BASE64);
        expect(binary.startsWith("%PDF-1.4")).toBe(true);
        expect(binary.includes("%%EOF")).toBe(true);

        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: "application/pdf" });
        expect(blob.size).toBeGreaterThan(0);
      }).not.toThrow();
    });

    it("decodes MINIMAL_VALID_ZIP_BASE64 with atob() without throwing DOMException and has valid ZIP EOCD header", () => {
      expect(() => {
        const binary = atob(MINIMAL_VALID_ZIP_BASE64);
        // Valid ZIP End of Central Directory signature: 0x50 0x4B 0x05 0x06 ("PK\x05\x06")
        expect(binary.charCodeAt(0)).toBe(0x50); // P
        expect(binary.charCodeAt(1)).toBe(0x4b); // K
        expect(binary.charCodeAt(2)).toBe(0x05);
        expect(binary.charCodeAt(3)).toBe(0x06);

        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: "application/zip" });
        expect(blob.size).toBe(22); // Standard empty zip EOCD size is exactly 22 bytes
      }).not.toThrow();
    });
  });

  // =========================================================================
  // 6. Packet Sorter Offline Fallback with Disconnect Simulation
  // =========================================================================
  describe("6. Packet Sorter Offline Fallback with Simulated Backend Disconnects", () => {
    it("sortDocumentPacket falls back gracefully to deterministic client sorting on network error", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
        Promise.reject(new TypeError("Failed to fetch (ECONNREFUSED 127.0.0.1:8000)"))
      );

      const mockFile = new File(["dummy family packet content with ananya patel and marriage"], "family_packet.pdf", {
        type: "application/pdf",
      });

      const res = await sortDocumentPacket(mockFile);

      expect(res).toBeDefined();
      expect(res.status).toBe("success");
      expect(res.total_persons_detected).toBeGreaterThanOrEqual(1);
      expect(res.person_folders.length).toBeGreaterThanOrEqual(1);
      expect(res.zip_archive_base64).toBeDefined();
      // Ensure zip archive base64 is decodable
      expect(() => atob(res.zip_archive_base64!)).not.toThrow();

      fetchSpy.mockRestore();
    });

    it("sortDocumentPacket falls back gracefully on backend HTTP 500 error", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ detail: "Internal Server Error in OCR engine" }),
        } as Response)
      );

      const mockFile = new File(["dummy single passport text aarav sharma"], "aarav_passport.pdf", {
        type: "application/pdf",
      });

      const res = await sortDocumentPacket(mockFile);

      expect(res).toBeDefined();
      expect(res.status).toBe("success");
      expect(res.person_folders[0].canonical_name).toBe("Aarav Sharma");

      fetchSpy.mockRestore();
    });
  });

  // =========================================================================
  // 7. Dynamic Selection & Inspector Synchronization in DocumentExtractorLab
  // =========================================================================
  describe("7. Dynamic Selection & Inspector Synchronization in DocumentExtractorLab", () => {
    it("synchronizes active inspector tabs when switching between person folders and split documents", async () => {
      // Simulate offline backend for deterministic fallback
      global.fetch = vi.fn().mockRejectedValue(new Error("Backend offline"));

      const { container } = render(<DocumentExtractorLab />);

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).not.toBeNull();

      const packetFile = new File(["%PDF-1.4 family marriage packet ananya patel"], "Sharma_Family_Packet.pdf", {
        type: "application/pdf",
      });

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [packetFile] } });
      });

      // Click "Sort & Split Multi-Person PDF Packet"
      const sortBtn = screen.getByText(/Sort & Split Multi-Person PDF Packet/i);
      await act(async () => {
        fireEvent.click(sortBtn);
      });

      // Await packet sorter person folders rendering
      await waitFor(() => {
        expect(screen.getByText(/Sorted Person Folders: Sharma_Family_Packet.pdf/i)).toBeDefined();
      });

      // Verify both person folders are detected
      expect(screen.getAllByText(/Aarav Sharma/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Ananya Patel/i).length).toBeGreaterThan(0);

      // Verify unified pipeline also populated the deep AI inspector
      await waitFor(() => {
        expect(screen.getByText(/Active Document Inspector:/i)).toBeDefined();
        expect(screen.getAllByText(/Structured Fields/i).length).toBeGreaterThan(0);
      });

      // Select Ananya Patel's folder
      const ananyaFolderBtn = screen.getAllByText(/Ananya Patel/i)[0];
      await act(async () => {
        fireEvent.click(ananyaFolderBtn);
      });

      // Verify that the split documents updated for Ananya Patel
      await waitFor(() => {
        expect(screen.getAllByText(/ANANYA_PATEL/i).length).toBeGreaterThan(0);
      });

      // Find and click the "Inspect Entities" button for a document in Ananya's folder
      const inspectButtons = screen.getAllByRole("button", { name: /Inspect Entities|✓ Inspecting/i });
      expect(inspectButtons.length).toBeGreaterThan(0);
      await act(async () => {
        fireEvent.click(inspectButtons[0]);
      });

      // Verify active inspector synchronization banner reflects the selected document
      expect(screen.getByText(/Synchronized with Packet Sorter Tree/i)).toBeDefined();

      // Switch to Recognition & Keywords tab
      const taxonomyTab = screen.getByText(/Recognition & Keywords/i);
      await act(async () => {
        fireEvent.click(taxonomyTab);
      });
      expect(screen.getByText(/Taxonomy Classification/i)).toBeDefined();

      // Switch to JSON Schema tab
      const jsonTab = screen.getByText(/JSON Schema Export/i);
      await act(async () => {
        fireEvent.click(jsonTab);
      });
      expect(screen.getByText(/Full Interoperable API Response Payload/i)).toBeDefined();
    });
  });
});
