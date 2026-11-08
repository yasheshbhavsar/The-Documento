import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DocumentExtractorLab } from "../components/tools/DocumentExtractorLab";
import * as extractorApi from "../lib/api/extractor";

describe("DocumentExtractorLab Standalone Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the standalone extractor lab with no authentication required badge", () => {
    render(<DocumentExtractorLab />);

    expect(
      screen.getByText(/AI Document Recognition & Information Extractor/i)
    ).toBeDefined();
    expect(screen.getByText(/No Authentication Required/i)).toBeDefined();
    expect(screen.getByText(/Standalone Lab/i)).toBeDefined();
    expect(
      screen.getByText(/Upload Document \(PDF \/ Images\)/i)
    ).toBeDefined();
    expect(
      screen.getByText(/Multi-Person Packet Sorter & Splitter/i)
    ).toBeDefined();
    expect(
      screen.getByText(/Run AI Recognition & Extraction/i)
    ).toBeDefined();
  });

  it("allows switching between input modes: Upload Document and Multi-Person Packet Sorter", () => {
    render(<DocumentExtractorLab />);

    expect(screen.getByText(/Drop document file here or click to browse/i)).toBeDefined();

    const packetTab = screen.getByText(/Multi-Person Packet Sorter & Splitter/i);
    fireEvent.click(packetTab);
    expect(
      screen.getByText(/Drop a combined multi-person PDF packet here or click to browse/i)
    ).toBeDefined();

    const uploadTab = screen.getByText(/Upload Document \(PDF \/ Images\)/i);
    fireEvent.click(uploadTab);
    expect(screen.getByText(/Drop document file here or click to browse/i)).toBeDefined();
  });

  it("executes analysis and renders structured extracted fields, recognition, and JSON tabs", async () => {
    const mockResult: extractorApi.ExtractorAnalysisResult = {
      status: "success",
      metadata: {
        filename: "PASSPORT_SHARMA_AARAV.pdf",
        mime_type: "application/pdf",
        file_size_bytes: 12450,
        sha256_hash: "a3f5b7890123456789abcdef",
        page_count: 1,
        detected_language: "en",
        total_blocks_detected: 14,
        overall_health_score: 95,
      },
      recognition: {
        category: "identity_passport",
        category_label: "Passports and Identity Documents",
        confidence: 0.98,
        matched_keywords: ["PASSPORT", "REPUBLIC OF INDIA"],
      },
      extracted_fields: [
        {
          field_name: "passport_number",
          field_label: "Passport Number",
          original_value: "Z8492014",
          normalized_value: "Z8492014",
          source_page: 1,
          ocr_confidence: 0.98,
          extraction_confidence: 0.99,
          calibrated_confidence: 0.98,
          extraction_method: "regex_pattern",
          model_version: "doc-intel-v5.0",
          bounding_box: [0.1, 0.2, 0.15, 0.4],
          review_status: "VERIFIED",
        },
        {
          field_name: "surname",
          field_label: "Surname / Last Name",
          original_value: "SHARMA",
          normalized_value: "SHARMA",
          source_page: 1,
          ocr_confidence: 0.99,
          extraction_confidence: 0.99,
          calibrated_confidence: 0.99,
          extraction_method: "layout_aware",
          model_version: "doc-intel-v5.0",
          bounding_box: [0.2, 0.2, 0.25, 0.45],
          review_status: "VERIFIED",
        },
      ],
      quality_findings: [],
      specialized_intelligence: {
        identity_compliance: {
          single_name_resolution: {
            is_single_name: false,
            uscis_representation: "Surname: SHARMA, Given Name: AARAV",
            ircc_representation: "Surname: SHARMA, Given Name: 'AARAV'",
            ukvi_representation: "Family Name: SHARMA, Given Name: 'AARAV'",
            guidance: "Standard multipart legal name detected.",
          },
        },
      },
      ocr_summary: {
        ocr_applied: false,
        avg_page_confidence: 0.99,
        pages: [],
      },
      raw_text_preview: "REPUBLIC OF INDIA\nPASSPORT\nPassport No: Z8492014",
    };

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/extractor/samples")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(extractorApi.FALLBACK_SAMPLES),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockResult),
      });
    }) as any;

    const { container } = render(<DocumentExtractorLab />);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const sampleFile = new File(["%PDF-1.4 passport"], "PASSPORT_SHARMA_AARAV.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(fileInput, { target: { files: [sampleFile] } });

    const runBtn = screen.getByText(/Run AI Recognition & Extraction/i);
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(screen.getAllByText(/Passports and Identity Documents/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Structured Fields \(2\)/i)).toBeDefined();
    });

    expect(screen.getAllByText(/Z8492014/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/SHARMA/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Field Provenance Inspector/i)).toBeDefined();

    // Switch to JSON schema tab
    const jsonTab = screen.getByText(/JSON Schema Export/i);
    fireEvent.click(jsonTab);
    expect(screen.getByText(/Full Interoperable API Response Payload/i)).toBeDefined();
  });

  it("provides deterministic client-side offline fallback for sortDocumentPacket with valid decodable base64 binaries", async () => {
    // Simulate completely offline backend network error
    global.fetch = vi.fn().mockRejectedValue(new Error("Failed to fetch"));

    const familyFile = new File(["%PDF-1.4 family content"], "family_test_packet.pdf", {
      type: "application/pdf",
    });

    const result = await extractorApi.sortDocumentPacket(familyFile);

    expect(result.status).toBe("success");
    expect(result.total_persons_detected).toBe(2);
    expect(result.person_folders.length).toBe(2);

    const primaryFolder = result.person_folders[0];
    expect(primaryFolder.canonical_name).toBe("Aarav Sharma");
    expect(primaryFolder.documents.length).toBeGreaterThan(0);
    expect(primaryFolder.id_anchors.passport).toContain("Z8492014");

    const spouseFolder = result.person_folders[1];
    expect(spouseFolder.canonical_name).toBe("Ananya Patel");
    expect(spouseFolder.documents.length).toBeGreaterThan(0);

    // Verify valid base64 strings that decode without DOMExceptions
    expect(result.zip_archive_base64).toBeDefined();
    expect(() => atob(result.zip_archive_base64!)).not.toThrow();

    const splitDoc = primaryFolder.documents[0];
    expect(splitDoc.pdf_base64).toBeDefined();
    expect(() => atob(splitDoc.pdf_base64!)).not.toThrow();
  });

  it("runs unified pipeline on packet sorter trigger and synchronizes deep inspection tabs on person/document selection", async () => {
    // Offline simulation for end-to-end fallback verification
    global.fetch = vi.fn().mockRejectedValue(new Error("Backend unreachable"));

    const { container } = render(<DocumentExtractorLab />);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const packetFile = new File(["%PDF-1.4 family marriage packet"], "Sharma_Family_Packet.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(fileInput, { target: { files: [packetFile] } });

    // Click "Sort & Split Multi-Person PDF Packet"
    const sortBtn = screen.getByText(/Sort & Split Multi-Person PDF Packet/i);
    fireEvent.click(sortBtn);

    // Await packet sorter person folders rendering
    await waitFor(() => {
      expect(screen.getByText(/Sorted Person Folders: Sharma_Family_Packet.pdf/i)).toBeDefined();
    });

    // Verify both person folders are detected and listed
    expect(screen.getAllByText(/Aarav Sharma/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Ananya Patel/i).length).toBeGreaterThan(0);

    // Verify unified pipeline also populated the deep AI inspector
    await waitFor(() => {
      expect(screen.getByText(/Active Document Inspector:/i)).toBeDefined();
      expect(screen.getAllByText(/Structured Fields/i).length).toBeGreaterThan(0);
    });

    // Select Ananya Patel's folder
    const ananyaFolderBtn = screen.getAllByText(/Ananya Patel/i)[0];
    fireEvent.click(ananyaFolderBtn);

    // Verify that the right column documents updated for Ananya Patel
    await waitFor(() => {
      expect(screen.getAllByText(/ANANYA_PATEL/i).length).toBeGreaterThan(0);
    });

    // Find and click the "Inspect Entities" button for a document in Ananya's folder
    const inspectButtons = screen.getAllByRole("button", { name: /Inspect Entities|✓ Inspecting/i });
    expect(inspectButtons.length).toBeGreaterThan(0);
    fireEvent.click(inspectButtons[0]);

    // Verify active inspector synchronization banner reflects the selected document
    expect(screen.getByText(/Synchronized with Packet Sorter Tree/i)).toBeDefined();
  });

  it("handles split PDF and ZIP archive downloads without network or decoding errors", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Offline"));

    const urlSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-download-url");
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    const { container } = render(<DocumentExtractorLab />);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const sampleFile = new File(["dummy packet"], "family_download_test.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(fileInput, { target: { files: [sampleFile] } });

    const sortBtn = screen.getByText(/Sort & Split Multi-Person PDF Packet/i);
    fireEvent.click(sortBtn);

    await waitFor(() => {
      expect(screen.getByText(/Download All Person Folders \(\.ZIP\)/i)).toBeDefined();
    });

    const zipBtn = screen.getByText(/Download All Person Folders \(\.ZIP\)/i);
    expect(() => fireEvent.click(zipBtn)).not.toThrow();

    const downloadPdfButtons = screen.getAllByText(/⬇️ Download PDF/i);
    expect(downloadPdfButtons.length).toBeGreaterThan(0);
    expect(() => fireEvent.click(downloadPdfButtons[0])).not.toThrow();

    urlSpy.mockRestore();
    revokeSpy.mockRestore();
  });
});
