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
      screen.getByText(/1-Click Realistic Presets/i)
    ).toBeDefined();
    expect(
      screen.getByText(/Run AI Recognition & Extraction/i)
    ).toBeDefined();
  });

  it("allows switching between input modes: Presets, Upload, and Text", () => {
    render(<DocumentExtractorLab />);

    const uploadTab = screen.getByText(/Upload Document/i);
    fireEvent.click(uploadTab);
    expect(screen.getByText(/Drop document file here or click to browse/i)).toBeDefined();

    const textTab = screen.getByText(/Paste Raw Text/i);
    fireEvent.click(textTab);
    expect(screen.getByText(/Document Content \(Raw Text \/ OCR Stream\):/i)).toBeDefined();

    const presetsTab = screen.getByText(/1-Click Realistic Presets/i);
    fireEvent.click(presetsTab);
    expect(screen.getByText(/Republic of India Passport/i)).toBeDefined();
    expect(screen.getByText(/Chase Bank 6-Month Checking Statement/i)).toBeDefined();
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

    render(<DocumentExtractorLab />);

    const runBtn = screen.getByText(/Run AI Recognition & Extraction/i);
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(screen.getByText(/Passports and Identity Documents/i)).toBeDefined();
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
});
