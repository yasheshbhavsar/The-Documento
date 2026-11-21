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
          json: () => Promise.resolve([]),
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

    const familyFile = new File(
      [
        [
          "--- PAGE 1 ---",
          "REPUBLIC OF INDIA - PASSPORT",
          "Type: P Code: IND Passport No: Z8492014",
          "Surname: SHARMA",
          "Given Names: AARAV",
          "Nationality: IND",
          "Date of Birth: 15 AUG 1990",
          "--- PAGE 2 ---",
          "GOVERNMENT OF INDIA - CERTIFICATE OF MARRIAGE",
          "Registration No: MH-MRG-2020-0011",
          "FULL NAME OF THE BRIDEGROOM: AARAV SHARMA",
          "FULL NAME OF THE BRIDE: ANANYA PATEL",
          "Date of Marriage: 12 FEB 2020",
        ].join("\n"),
      ],
      "family_test_packet.pdf",
      {
        type: "application/pdf",
      }
    );

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

    // Offline fallback must NOT fabricate fake blank PDF/ZIP base64 binaries
    expect(result.zip_archive_base64).toBeNull();
    expect(result.zip_archive_filename).toContain("family_test_packet");

    const splitDoc = primaryFolder.documents[0];
    expect(splitDoc.pdf_base64).toBeUndefined();
  });

  it("runs unified pipeline on packet sorter trigger and synchronizes deep inspection tabs on person/document selection", async () => {
    // Offline simulation for end-to-end fallback verification
    global.fetch = vi.fn().mockRejectedValue(new Error("Backend unreachable"));

    const { container } = render(<DocumentExtractorLab />);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const packetFile = new File(
      [
        [
          "--- PAGE 1 ---",
          "REPUBLIC OF INDIA - PASSPORT",
          "Type: P Code: IND Passport No: Z8492014",
          "Surname: SHARMA",
          "Given Names: AARAV",
          "Nationality: IND",
          "--- PAGE 2 ---",
          "GOVERNMENT OF INDIA - CERTIFICATE OF MARRIAGE",
          "FULL NAME OF THE BRIDEGROOM: AARAV SHARMA",
          "FULL NAME OF THE BRIDE: ANANYA PATEL",
          "Date of Marriage: 12 FEB 2020",
        ].join("\n"),
      ],
      "Sharma_Family_Packet.pdf",
      {
        type: "application/pdf",
      }
    );
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

  it("renders offline sorted person folders honestly without fabricated PDF or ZIP download buttons", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Offline"));

    const urlSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-download-url");
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    const { container } = render(<DocumentExtractorLab />);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const sampleFile = new File(
      [
        [
          "--- PAGE 1 ---",
          "REPUBLIC OF INDIA - PASSPORT",
          "Type: P Code: IND Passport No: Z8492014",
          "Surname: SHARMA",
          "Given Names: AARAV",
          "Nationality: IND",
          "--- PAGE 2 ---",
          "GOVERNMENT OF INDIA - CERTIFICATE OF MARRIAGE",
          "FULL NAME OF THE BRIDEGROOM: AARAV SHARMA",
          "FULL NAME OF THE BRIDE: ANANYA PATEL",
          "Date of Marriage: 12 FEB 2020",
        ].join("\n"),
      ],
      "family_download_test.pdf",
      {
        type: "application/pdf",
      }
    );
    fireEvent.change(fileInput, { target: { files: [sampleFile] } });

    const sortBtn = screen.getByText(/Sort & Split Multi-Person PDF Packet/i);
    fireEvent.click(sortBtn);

    await waitFor(() => {
      expect(screen.getByText(/Sorted Person Folders: family_download_test\.pdf/i)).toBeDefined();
    });

    expect(screen.getAllByText(/Aarav Sharma/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Ananya Patel/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Download All Person Folders \(\.ZIP\)/i)).toBeNull();
    expect(screen.queryByText(/⬇️ Download PDF/i)).toBeNull();
    expect(urlSpy).not.toHaveBeenCalled();

    urlSpy.mockRestore();
    revokeSpy.mockRestore();
  });

  it("renders Specialized Forensics with nullable financial balances and shows completion popup toast", async () => {
    const mockBankResult: extractorApi.ExtractorAnalysisResult = {
      status: "success",
      metadata: {
        filename: "hdfc_statement.pdf",
        mime_type: "application/pdf",
        file_size_bytes: 8200,
        sha256_hash: "bank1234567890abcdef",
        page_count: 1,
        detected_language: "en",
        total_blocks_detected: 8,
        overall_health_score: 92,
      },
      recognition: {
        category: "financial_bank_statement",
        category_label: "Bank Statements and Financial Evidence",
        confidence: 0.96,
        matched_keywords: ["ACCOUNT STATEMENT", "CLOSING BALANCE"],
      },
      extracted_fields: [
        {
          field_name: "closing_balance",
          field_label: "Closing Balance",
          original_value: "INR 450,000.00",
          normalized_value: "450,000.00",
          source_page: 1,
          ocr_confidence: 0.99,
          extraction_confidence: 0.95,
          calibrated_confidence: 0.96,
          extraction_method: "regex_pattern",
          model_version: "doc-intel-v5.0",
          bounding_box: [0.2, 0.1, 0.24, 0.5],
          review_status: "VERIFIED",
        },
      ],
      quality_findings: [],
      specialized_intelligence: {
        financial_forensics: {
          institution: "HDFC Bank",
          account_number_masked: "XXXX1234",
          statement_period: "01/01/2026 to 31/03/2026",
          currency: "INR",
          opening_balance: null,
          closing_balance: 450000,
          minimum_balance_observed: null,
          average_monthly_credits: null,
          suspicious_lump_sums: [],
          risk_findings: [],
        },
      },
      ocr_summary: {
        ocr_applied: false,
        avg_page_confidence: 0.99,
        pages: [],
      },
      raw_text_preview: "HDFC Bank\nAccount Statement\nClosing Balance: INR 450,000.00",
    };

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/extractor/samples")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockBankResult) });
    }) as any;

    const { container } = render(<DocumentExtractorLab />);
    expect(screen.getByTestId("extractor-desktop-alert-toggle")).toBeDefined();
    expect(screen.getByTestId("extractor-sound-toggle")).toBeDefined();

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File(["%PDF-1.4 bank"], "hdfc_statement.pdf", { type: "application/pdf" })] },
    });
    fireEvent.click(screen.getByText(/Run AI Recognition & Extraction/i));

    await waitFor(() => {
      expect(screen.getByText(/Structured Fields \(1\)/i)).toBeDefined();
      expect(screen.getByTestId("extraction-completion-toast")).toBeDefined();
      expect(screen.getByText(/AI Extraction Complete — Ready to Review/i)).toBeDefined();
    });

    fireEvent.click(screen.getByText(/Specialized Forensics/i));
    await waitFor(() => {
      expect(screen.getByText(/HDFC Bank \(XXXX1234\)/i)).toBeDefined();
      expect(screen.getAllByText(/Not stated/i).length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText(/₹450,000/i)).toBeDefined();
    });
  });

  it("runs analyzeDocumentStandalone before sortDocumentPacket in Packet Sorter mode and isolates same-category person fields", async () => {
    const analyzeResult: extractorApi.ExtractorAnalysisResult = {
      status: "success",
      metadata: {
        filename: "family_passports_packet.pdf",
        mime_type: "application/pdf",
        file_size_bytes: 24000,
        sha256_hash: "pkt1234567890abcdef",
        page_count: 2,
        detected_language: "en",
        total_blocks_detected: 6,
        overall_health_score: 94,
      },
      recognition: {
        category: "identity_passport",
        category_label: "Passports and Identity Documents",
        confidence: 0.98,
        matched_keywords: ["PASSPORT"],
      },
      extracted_fields: [
        {
          field_name: "passport_number",
          field_label: "Passport Number",
          original_value: "Z1111111",
          normalized_value: "Z1111111",
          source_page: 1,
          ocr_confidence: 0.99,
          extraction_confidence: 0.99,
          calibrated_confidence: 0.99,
          extraction_method: "regex_pattern",
          model_version: "doc-intel-v5.0",
          bounding_box: [0.1, 0.1, 0.15, 0.4],
          review_status: "VERIFIED",
        },
      ],
      quality_findings: [
        {
          finding_type: "minor_notice",
          severity: "minor",
          page_number: 1,
          title: "Sample Quality Finding",
          description: "Preserved from analyzeDocumentStandalone",
          recommended_action: "Keep original scan",
          uncertainty_limitations: "None",
        },
      ],
      specialized_intelligence: {},
      ocr_summary: {
        ocr_applied: false,
        avg_page_confidence: 0.99,
        pages: [
          {
            page_number: 1,
            width: 595,
            height: 842,
            ocr_applied: false,
            ocr_confidence: 0.99,
            rotation_corrected: false,
            detected_rotation: 0,
            block_count: 1,
            page_image_data_url: "data:image/png;base64,iVBORw0KGgo=",
            blocks: [
              {
                block_idx: 0,
                text: "Passport No: Z1111111",
                confidence: 0.99,
                coordinates: [0.1, 0.1, 0.15, 0.4],
              },
            ],
          },
          {
            page_number: 2,
            width: 595,
            height: 842,
            ocr_applied: false,
            ocr_confidence: 0.99,
            rotation_corrected: false,
            detected_rotation: 0,
            block_count: 1,
            page_image_data_url: "data:image/png;base64,iVBORw0KGgo=",
            blocks: [
              {
                block_idx: 0,
                text: "Passport No: P2222222",
                confidence: 0.99,
                coordinates: [0.2, 0.1, 0.25, 0.4],
              },
            ],
          },
        ],
      },
      raw_text_preview: "Page 1 Z1111111\nPage 2 P2222222",
    };

    const sortResult: extractorApi.PacketSortResult = {
      status: "success",
      source_filename: "family_passports_packet.pdf",
      total_pages_analyzed: 2,
      blank_pages_omitted: [],
      total_persons_detected: 2,
      total_split_documents: 2,
      person_folders: [
        {
          person_id: "person-1",
          canonical_name: "Arjun Patel",
          folder_name: "ARJUN_PATEL",
          person_role: "principal_applicant",
          name_variations: ["ARJUN PATEL"],
          id_anchors: { passport: ["Z1111111"] },
          is_caseworker_review_folder: false,
          is_corporate_folder: false,
          duplicates_count: 0,
          total_documents: 1,
          total_pages: 1,
          documents: [
            {
              document_index: 1,
              filename: "ARJUN_PATEL_Passport.pdf",
              relative_path: "ARJUN_PATEL/ARJUN_PATEL_Passport.pdf",
              category: "identity_passport",
              document_subtype: "Passport",
              page_numbers: [1],
              page_range: "Page 1",
              page_count: 1,
              is_joint_document: false,
              is_duplicate: false,
              shared_with: [],
              person_role: "principal_applicant",
              extracted_fields: {
                passport_number: "Z1111111",
                full_name: "ARJUN PATEL",
              },
              text_preview: "Passport No: Z1111111\nARJUN PATEL",
            },
          ],
        },
        {
          person_id: "person-2",
          canonical_name: "Priya Patel",
          folder_name: "PRIYA_PATEL",
          person_role: "spouse_partner",
          name_variations: ["PRIYA PATEL"],
          id_anchors: { passport: ["P2222222"] },
          is_caseworker_review_folder: false,
          is_corporate_folder: false,
          duplicates_count: 0,
          total_documents: 1,
          total_pages: 1,
          documents: [
            {
              document_index: 2,
              filename: "PRIYA_PATEL_Passport.pdf",
              relative_path: "PRIYA_PATEL/PRIYA_PATEL_Passport.pdf",
              category: "identity_passport",
              document_subtype: "Passport",
              page_numbers: [2],
              page_range: "Page 2",
              page_count: 1,
              is_joint_document: false,
              is_duplicate: false,
              shared_with: [],
              person_role: "spouse_partner",
              extracted_fields: {
                passport_number: "P2222222",
                full_name: "PRIYA PATEL",
              },
              text_preview: "Passport No: P2222222\nPRIYA PATEL",
            },
          ],
        },
      ],
      zip_archive_base64: null,
      zip_archive_filename: "family_passports_packet_sorted.zip",
    };

    const calledUrls: string[] = [];
    global.fetch = vi.fn().mockImplementation((url: string) => {
      calledUrls.push(String(url));
      if (String(url).includes("/extractor/samples")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (String(url).includes("/extractor/sort-packet")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(sortResult) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(analyzeResult) });
    }) as any;

    const { container } = render(<DocumentExtractorLab />);
    fireEvent.click(screen.getByText(/Multi-Person Packet Sorter & Splitter/i));

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["%PDF-1.4 packet"], "family_passports_packet.pdf", { type: "application/pdf" })],
      },
    });
    fireEvent.click(screen.getByText(/Sort & Split Multi-Person PDF Packet/i));

    await waitFor(() => {
      expect(screen.getByText(/Sorted Person Folders: family_passports_packet\.pdf/i)).toBeDefined();
    });

    // Sequential order warms backend OCR page cache before sort-packet runs
    const analyzeIdx = calledUrls.findIndex((u) => u.includes("/extractor/analyze"));
    const sortIdx = calledUrls.findIndex((u) => u.includes("/extractor/sort-packet"));
    expect(analyzeIdx).toBeGreaterThanOrEqual(0);
    expect(sortIdx).toBeGreaterThan(analyzeIdx);
    expect(screen.getByText(/Quality Audit \(1\)/i)).toBeDefined();

    fireEvent.click(screen.getAllByText(/Priya Patel/i)[0]);
    await waitFor(() => {
      expect(screen.getAllByText(/PRIYA_PATEL_Passport\.pdf/i).length).toBeGreaterThan(0);
    });
    const inspectBtns = screen.getAllByRole("button", { name: /Inspect Entities|✓ Inspecting/i });
    fireEvent.click(inspectBtns[0]);

    await waitFor(() => {
      expect(screen.getAllByText(/^P2222222$/i).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText(/^Z1111111$/i)).toBeNull();
  });
});
