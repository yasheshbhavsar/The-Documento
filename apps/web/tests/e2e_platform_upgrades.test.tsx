import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";

// Components
import { InitialInformationSheet } from "../components/portal/InitialInformationSheet";
import { GuidedQuestionnaireModal } from "../components/modals/GuidedQuestionnaireModal";
import { ConfigurableFormViewer } from "../components/forms/ConfigurableFormViewer";
import { CreateClientModal } from "../components/modals/CreateClientModal";
import { DocumentExtractorLab } from "../components/tools/DocumentExtractorLab";
import { ClientPortal } from "../components/dashboards/ClientPortal";
import { ClientStatusHeroCard } from "../components/portal/ClientStatusHeroCard";
import { ClientDocumentUploadCard } from "../components/portal/ClientDocumentUploadCard";
import { ClientDirectChatWidget } from "../components/portal/ClientDirectChatWidget";
import { SuperAdminControlPlane } from "../components/admin/SuperAdminControlPlane";

// Libraries & Engines
import {
  normalizeDateToDDMMYYYY,
  extractProfileFromAnalysis,
  extractProfileFromDocument,
  mapAnalysisToInitialInfoSheet,
  mapPacketToInitialInfoSheet,
  hydrateCanonicalForm,
  persistAndBroadcastAutoFill,
  getAutoFillProvenance,
  CANONICAL_FORM_SCHEMAS,
  AutoFillFieldProvenance,
  AutoFillClientProfile,
  AutoFillSheetResult,
} from "../lib/documentAutoFillEngine";

import {
  sortDocumentPacket,
  generateClientFallbackPacketSort,
  analyzeDocumentStandalone,
  generateClientFallbackAnalysis,
  PacketSortResult,
  PacketPersonFolder,
  PacketSortedDocument,
  ExtractorAnalysisResult,
  ExtractorFieldProvenance,
} from "../lib/api/extractor";

import {
  deleteAgencyTenant,
  deleteAgencyApplication,
  getAgencyTenants,
  getAgencyApplications,
  getPlatformBillingInvoices,
  getAgencyTeamInvites,
  getAgencySupportTickets,
  getCalculatorAgencyLeads,
  computePlatformOverview,
  submitAgencyOnboarding,
  adjudicateAgencyKybApplication,
  buildKybUploadedDocMeta,
  AgencyTenantRecord,
  AgencyKybApplication,
} from "../lib/agencyPlatformStore";

import { WorkspaceProvider, useWorkspace } from "../lib/context/WorkspaceContext";
import { canDeleteClient, authenticateUser, PLATFORM_HQ_OPERATOR_EMAIL } from "../lib/auth";
import {
  api,
  FIXTURE_CASES,
  FIXTURE_CLIENTS,
  FIXTURE_DOCUMENTS,
  FIXTURE_AUDIT_EVENTS,
  FIXTURE_TASKS,
  FIXTURE_INVOICES,
  FIXTURE_CAPACITY,
  FIXTURE_NOTIFICATIONS,
} from "../lib/api";

import {
  ImmigrationCase,
  ClientProfile,
  DocumentItem,
  UserContext,
  FormSubmissionItem,
} from "../lib/types";

// Explicit Agency Platform Storage Keys matching agencyPlatformStore.ts contract
const AGENCY_STORAGE = {
  tenants: "documento_agency_tenants_v3_clean",
  applications: "documento_agency_applications_v3_clean",
  leads: "documento_calculator_leads_v3_clean",
  logs: "documento_platform_gov_logs_v3_clean",
  teamInvites: "documento_agency_team_invites_v3_clean",
  invoices: "documento_agency_invoices_v3_clean",
  tickets: "documento_agency_support_tickets_v3_clean",
};

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

describe("Documento AI Immigration Platform Upgrades — Comprehensive E2E Integration Test Suite", () => {
  const mockOwnerUser: UserContext = {
    id: "usr-apex-owner-1",
    email: "sarah.chen@apexlegal.com",
    full_name: "Sarah Chen, Managing Partner",
    role: "master_admin",
    experience: "master_admin",
    organization_id: "org-apex-001",
    organization_name: "Apex Immigration Legal Group",
    permissions: ["cases:read", "cases:write", "client:delete"],
  };

  const mockParalegalUser: UserContext = {
    id: "usr-paralegal-1",
    email: "paralegal@apexlegal.com",
    full_name: "Alex Taylor, Senior Paralegal",
    role: "case_worker",
    experience: "paralegal",
    organization_id: "org-apex-001",
    organization_name: "Apex Immigration Legal Group",
    permissions: ["cases:read", "cases:write"],
  };

  const mockRetainedClientUser: UserContext = {
    id: "usr-client-1",
    email: "priya.sharma@example.com",
    full_name: "Priya Sharma",
    role: "retained_client",
    experience: "client_applicant",
    organization_id: "org-apex-001",
    organization_name: "Apex Immigration Legal Group",
    permissions: ["portal:access"],
  };

  const mockCase: ImmigrationCase = {
    ...FIXTURE_CASES[0],
    id: "case-e2e-001",
    case_number: "CASE-US-2026-E2E",
    title: "US EB-1A Extraordinary Ability — Priya Sharma",
    client_id: "client-e2e-001",
    client_name: "Priya Sharma",
    jurisdiction: "United States",
    visa_category: "EB-1A Extraordinary Ability",
    status: "processing",
    readiness_score: 78,
  };

  const mockClient: ClientProfile = {
    id: "client-e2e-001",
    first_name: "Priya",
    last_name: "Sharma",
    email: "priya.sharma@example.com",
    phone: "+1 (555) 234-5678",
    nationality: "India",
    organization_id: "org-apex-001",
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  /* ==========================================================================
   * TIER 1: FEATURE COVERAGE (Features 1–16 Isolated Contracts)
   * ========================================================================== */
  describe("Tier 1: Feature Coverage (R1, R2, R3, R4 Isolated Contracts)", () => {
    /* --- Feature 1: Central AutoFill Mapping Engine --- */
    it("Feature 1: normalizeDateToDDMMYYYY normalizes ISO, dashes, dots, and named month strings to DD/MM/YYYY", () => {
      expect(normalizeDateToDDMMYYYY("2026-05-18")).toBe("18/05/2026");
      expect(normalizeDateToDDMMYYYY("18-05-2026")).toBe("18/05/2026");
      expect(normalizeDateToDDMMYYYY("18.05.2026")).toBe("18/05/2026");
      expect(normalizeDateToDDMMYYYY("18 May 2026")).toBe("18/05/2026");
      expect(normalizeDateToDDMMYYYY("May 18, 2026")).toBe("18/05/2026");
      expect(normalizeDateToDDMMYYYY("18/05/2026")).toBe("18/05/2026");
      expect(normalizeDateToDDMMYYYY(null)).toBe("");
      expect(normalizeDateToDDMMYYYY("")).toBe("");
    });

    it("Feature 1: extractProfileFromAnalysis accurately extracts applicant profile and metadata from Indian Passport extraction", () => {
      const mockFields: ExtractorFieldProvenance[] = [
        {
          field_name: "passport_number",
          field_label: "Passport Number",
          original_value: "Z9876543",
          normalized_value: "Z9876543",
          source_page: 1,
          ocr_confidence: 0.98,
          extraction_confidence: 0.98,
          calibrated_confidence: 0.98,
          extraction_method: "ocr_regex",
          model_version: "v5.0",
          bounding_box: [0, 0, 0, 0],
          review_status: "verified",
        },
        {
          field_name: "surname",
          field_label: "Surname",
          original_value: "Sharma",
          normalized_value: "Sharma",
          source_page: 1,
          ocr_confidence: 0.98,
          extraction_confidence: 0.98,
          calibrated_confidence: 0.98,
          extraction_method: "ocr_regex",
          model_version: "v5.0",
          bounding_box: [0, 0, 0, 0],
          review_status: "verified",
        },
        {
          field_name: "given_names",
          field_label: "Given Names",
          original_value: "Priya",
          normalized_value: "Priya",
          source_page: 1,
          ocr_confidence: 0.98,
          extraction_confidence: 0.98,
          calibrated_confidence: 0.98,
          extraction_method: "ocr_regex",
          model_version: "v5.0",
          bounding_box: [0, 0, 0, 0],
          review_status: "verified",
        },
      ];

      const mockPassportAnalysis: ExtractorAnalysisResult = {
        status: "success",
        metadata: {
          filename: "PASSPORT_SHARMA_PRIYA.pdf",
          mime_type: "application/pdf",
          file_size_bytes: 250000,
          sha256_hash: "hash-priya-001",
          page_count: 2,
          detected_language: "en",
          total_blocks_detected: 15,
          overall_health_score: 95,
        },
        recognition: {
          category: "identity_passport",
          category_label: "Indian Passport",
          confidence: 0.98,
          matched_keywords: ["Republic of India", "Passport", "Surname"],
        },
        extracted_fields: mockFields,
        quality_findings: [],
        ocr_summary: {
          ocr_applied: true,
          avg_page_confidence: 0.98,
          pages: [],
        },
        raw_text_preview: "PASSPORT REPUBLIC OF INDIA...",
        specialized_intelligence: {
          identity_compliance: {
            indian_passport: {
              passport_number: "Z9876543",
              surname: "Sharma",
              given_names: "Priya",
              holder_name: "Priya Sharma",
              date_of_birth: "15/08/1992",
              gender: "F",
              nationality: "Indian",
              place_of_birth: "Mumbai",
              date_of_issue: "10/01/2020",
              date_of_expiry: "09/01/2030",
              father_name: "Ramesh Sharma",
              mother_name: "Sunita Sharma",
              spouse_name: "Vikram Malhotra",
              address: "Flat 402, Sea Green Apts, Worli, Mumbai",
              pin_code: "400018",
            },
          },
        },
      };

      const profile = extractProfileFromAnalysis(mockPassportAnalysis, "PASSPORT_SHARMA_PRIYA.pdf");
      expect(profile.firstName).toBe("Priya");
      expect(profile.lastName).toBe("Sharma");
      expect(profile.passportNumber).toBe("Z9876543");
      expect(profile.nationality).toBe("Indian");
      expect(profile.confidence).toBeGreaterThan(0.9);
      expect(profile.sourceDocumentName).toBe("PASSPORT_SHARMA_PRIYA.pdf");
    });

    /* --- Feature 2: InitialInformationSheet Provenance & Formatting --- */
    it("Feature 2: mapAnalysisToInitialInfoSheet maps biodata, passport, family, and address with provenance and DD/MM/YYYY dates", () => {
      const mockFields: ExtractorFieldProvenance[] = [
        {
          field_name: "passport_number",
          field_label: "Passport Number",
          original_value: "Z9876543",
          normalized_value: "Z9876543",
          source_page: 1,
          ocr_confidence: 0.96,
          extraction_confidence: 0.96,
          calibrated_confidence: 0.96,
          extraction_method: "ocr_regex",
          model_version: "v5.0",
          bounding_box: [0, 0, 0, 0],
          review_status: "verified",
        },
        {
          field_name: "surname",
          field_label: "Surname",
          original_value: "Sharma",
          normalized_value: "Sharma",
          source_page: 1,
          ocr_confidence: 0.96,
          extraction_confidence: 0.96,
          calibrated_confidence: 0.96,
          extraction_method: "ocr_regex",
          model_version: "v5.0",
          bounding_box: [0, 0, 0, 0],
          review_status: "verified",
        },
        {
          field_name: "given_names",
          field_label: "Given Names",
          original_value: "Priya",
          normalized_value: "Priya",
          source_page: 1,
          ocr_confidence: 0.96,
          extraction_confidence: 0.96,
          calibrated_confidence: 0.96,
          extraction_method: "ocr_regex",
          model_version: "v5.0",
          bounding_box: [0, 0, 0, 0],
          review_status: "verified",
        },
        {
          field_name: "dob",
          field_label: "Date of Birth",
          original_value: "1992-08-15",
          normalized_value: "1992-08-15",
          source_page: 1,
          ocr_confidence: 0.96,
          extraction_confidence: 0.96,
          calibrated_confidence: 0.96,
          extraction_method: "ocr_regex",
          model_version: "v5.0",
          bounding_box: [0, 0, 0, 0],
          review_status: "verified",
        },
        {
          field_name: "date_of_expiry",
          field_label: "Expiry Date",
          original_value: "2030-01-09",
          normalized_value: "2030-01-09",
          source_page: 1,
          ocr_confidence: 0.96,
          extraction_confidence: 0.96,
          calibrated_confidence: 0.96,
          extraction_method: "ocr_regex",
          model_version: "v5.0",
          bounding_box: [0, 0, 0, 0],
          review_status: "verified",
        },
      ];

      const mockPassportAnalysis: ExtractorAnalysisResult = {
        status: "success",
        metadata: {
          filename: "Indian_Passport_Priya.pdf",
          mime_type: "application/pdf",
          file_size_bytes: 250000,
          sha256_hash: "hash-002",
          page_count: 2,
          detected_language: "en",
          total_blocks_detected: 15,
          overall_health_score: 95,
        },
        recognition: {
          category: "identity_passport",
          category_label: "Indian Passport",
          confidence: 0.96,
          matched_keywords: ["Passport"],
        },
        extracted_fields: mockFields,
        quality_findings: [],
        ocr_summary: {
          ocr_applied: true,
          avg_page_confidence: 0.98,
          pages: [],
        },
        raw_text_preview: "PASSPORT REPUBLIC OF INDIA...",
        specialized_intelligence: {
          identity_compliance: {
            indian_passport: {
              passport_number: "Z9876543",
              surname: "Sharma",
              given_names: "Priya",
              holder_name: "Priya Sharma",
              date_of_birth: "15/08/1992",
              gender: "F",
              nationality: "Indian",
              place_of_birth: "Mumbai",
              date_of_issue: "10/01/2020",
              date_of_expiry: "09/01/2030",
              father_name: "Ramesh Sharma",
              mother_name: "Sunita Sharma",
              spouse_name: "Vikram Malhotra",
              address: "402 Worli Seaface, Mumbai 400018",
            },
          },
        },
      };

      const result: AutoFillSheetResult = mapAnalysisToInitialInfoSheet(mockPassportAnalysis);
      // Surname uppercase convention matching Image 1
      expect(result.updatedData.family_name).toBe("SHARMA");
      expect(result.updatedData.given_names).toBe("Priya");
      expect(result.updatedData.dob).toBe("15/08/1992");
      expect(result.updatedData.passport_number).toBe("Z9876543");
      expect(result.updatedData.passport_expiry_date).toBe("09/01/2030");
      expect(result.updatedData.residential_address).toContain("Worli Seaface");

      // Verify Provenance
      expect(result.provenance["family_name"]).toBeDefined();
      expect(result.provenance["family_name"].source_type).toBe("document_ocr");
      expect(result.provenance["family_name"].source_document_title).toBe("Indian_Passport_Priya.pdf");
      expect(result.fieldsFilledCount).toBeGreaterThan(4);
    });

    it("Feature 2: InitialInformationSheet renders synchronized fields with visual indicator and DD/MM/YYYY formatting", () => {
      const storageKey = "documento_initial_info_sheet_test_p2";
      persistAndBroadcastAutoFill(storageKey, {
        formData: {
          family_name: "Bhavsar",
          given_names: "Yashesh Ullaskumar",
          dob: "12/04/1990",
          residential_address: "100 Innovation Way, Suite 400, Toronto, ON",
          passport_number: "M1234567",
          passport_expiry_date: "15/10/2032",
        },
        provenance: {
          family_name: {
            field_name: "family_name",
            field_label: "Family Name",
            value: "Bhavsar",
            source_type: "document_ocr",
            source_document_title: "PASSPORT_BHAVSAR.pdf",
            extracted_at: new Date().toISOString(),
          },
          given_names: {
            field_name: "given_names",
            field_label: "Given Names",
            value: "Yashesh Ullaskumar",
            source_type: "document_ocr",
            source_document_title: "PASSPORT_BHAVSAR.pdf",
            extracted_at: new Date().toISOString(),
          },
        },
      });

      render(<InitialInformationSheet storageKeyId={storageKey} jurisdiction="Canada" />);

      // Verify applicant name and date are formatted and rendered
      expect(screen.getByDisplayValue("Bhavsar")).toBeDefined();
      expect(screen.getByDisplayValue("Yashesh Ullaskumar")).toBeDefined();
      expect(screen.getByDisplayValue("12/04/1990")).toBeDefined();
    });

    /* --- Feature 3: GuidedQuestionnaireModal Pre-fill --- */
    it("Feature 3: GuidedQuestionnaireModal pre-fills applicant name and allows step navigation", () => {
      const handleClose = vi.fn();
      const handleSaved = vi.fn();

      render(
        <GuidedQuestionnaireModal
          isOpen={true}
          onClose={handleClose}
          onSaved={handleSaved}
          applicantName="Dr. Priya Sharma"
        />
      );

      expect(screen.getByText(/Guided Extraordinary Ability Questionnaire/i)).toBeDefined();
      expect(screen.getByDisplayValue("Dr. Priya Sharma")).toBeDefined();

      // Step navigation
      const nextBtn = screen.getByRole("button", { name: /Next Step/i });
      fireEvent.click(nextBtn);
      expect(screen.getByText(/Step 2 of 4/i)).toBeDefined();
    });

    /* --- Feature 4: ConfigurableFormViewer Hydration --- */
    it("Feature 4: hydrateCanonicalForm hydrates USCIS I-140, G-28, I-485, and IRCC IMM 5257 with provenance metadata", () => {
      const testDocuments: DocumentItem[] = [
        {
          id: "doc-pass-1",
          case_id: mockCase.id,
          title: "Indian Passport — Priya Sharma",
          category: "identity_passport",
          sha256_hash: "hash-pass-001",
          status: "verified",
          uploaded_at: "2026-05-01",
          file_size: "1.2 MB",
          mime_type: "application/pdf",
          extracted_fields: [
            {
              id: "f-pass-01",
              field_name: "passport_number",
              field_label: "Passport Number",
              original_value: "Z9876543",
              normalized_value: "Z9876543",
              source_page: 1,
              ocr_confidence: 0.98,
              extraction_confidence: 0.98,
              extraction_method: "ocr_regex",
              model_version: "v5.0",
              validation_status: "verified",
              is_manually_corrected: false,
            },
          ],
        },
      ];

      // 1. USCIS I-140
      const i140Submission = hydrateCanonicalForm("USCIS_I140", mockCase, mockClient, testDocuments);
      expect(i140Submission.form_code).toBe("USCIS_I140");
      expect(i140Submission.answers["beneficiary_family_name"].value).toBe("Sharma");
      expect(i140Submission.answers["beneficiary_family_name"].source_type).toBe("client_profile");
      expect(i140Submission.answers["beneficiary_passport_number"].value).toBe("Z9876543");
      expect(i140Submission.answers["beneficiary_passport_number"].source_type).toBe("document_ocr");

      // 2. USCIS G-28
      const g28Submission = hydrateCanonicalForm("USCIS_G28", mockCase, mockClient, testDocuments);
      expect(g28Submission.form_code).toBe("USCIS_G28");
      expect(g28Submission.answers["client_family_name"].value).toBe("Sharma");

      // 3. USCIS I-485
      const i485Submission = hydrateCanonicalForm("USCIS_I485", mockCase, mockClient, testDocuments);
      expect(i485Submission.form_code).toBe("USCIS_I485");
      expect(i485Submission.answers["applicant_family_name"].value).toBe("Sharma");

      // 4. IRCC IMM 5257
      const imm5257Submission = hydrateCanonicalForm("IRCC_IMM5257", mockCase, mockClient, testDocuments);
      expect(imm5257Submission.form_code).toBe("IRCC_IMM5257");
      expect(imm5257Submission.answers["family_name"].value).toBe("Sharma");
    });

    it("Feature 4: ConfigurableFormViewer renders hydrated submission with field provenance badges", () => {
      const hydrated = hydrateCanonicalForm("USCIS_I140", mockCase, mockClient, []);
      const schema = CANONICAL_FORM_SCHEMAS["USCIS_I140"];

      render(
        <ConfigurableFormViewer
          submission={hydrated}
          schema={schema}
          userRole="case_manager"
        />
      );

      expect(screen.getByText(/Form I-140/i)).toBeDefined();
      expect(screen.getByDisplayValue("Sharma")).toBeDefined();
    });

    /* --- Feature 5 & 6: CreateClientModal Dropzone & Uploader Event Persistence --- */
    it("Feature 5: CreateClientModal renders onboarding fields and handles client creation", () => {
      const handleClientCreated = vi.fn();
      const handleClose = vi.fn();

      render(
        <CreateClientModal
          isOpen={true}
          onClose={handleClose}
          onClientCreated={handleClientCreated}
          initialPrefill={{
            firstName: "Aarav",
            lastName: "Patel",
            email: "aarav.patel@example.com",
            nationality: "India",
            passportNumber: "T1234567",
          }}
        />
      );

      expect(screen.getByText(/Retain New Client/i)).toBeDefined();
      expect(screen.getByTestId("client-autofill-dropzone")).toBeDefined();
      expect(screen.getByDisplayValue("Aarav")).toBeDefined();
      expect(screen.getByDisplayValue("Patel")).toBeDefined();
      expect(screen.getByDisplayValue("aarav.patel@example.com")).toBeDefined();
    });

    it("Feature 6: persistAndBroadcastAutoFill dispatches custom event and saves to localStorage", () => {
      const listenerSpy = vi.fn();
      window.addEventListener("documento-autofill-updated", listenerSpy);

      persistAndBroadcastAutoFill("test_storage_key_event", {
        formData: { testField: "Value 123" },
        provenance: {
          testField: {
            field_name: "testField",
            field_label: "Test Field",
            value: "Value 123",
            source_type: "document_ocr",
            extracted_at: new Date().toISOString(),
          },
        },
        sourceFilename: "test.pdf",
      });

      expect(listenerSpy).toHaveBeenCalled();
      const stored = getAutoFillProvenance("test_storage_key_event");
      expect(stored["testField"].value).toBe("Value 123");

      window.removeEventListener("documento-autofill-updated", listenerSpy);
    });

    /* --- Feature 7, 8 & 9: Unified Sorter, Deep Inspector Selection, and Offline Fallback --- */
    it("Feature 9: sortDocumentPacket executes offline fallback and produces valid PacketSortResult with person folders and valid base64", async () => {
      const testFile = new File(["%PDF-1.4 dummy multi-person packet"], "Combined_Family_Packet.pdf", {
        type: "application/pdf",
      });

      const result: PacketSortResult = await sortDocumentPacket(testFile);
      expect(result.status).toBe("success");
      expect(result.total_persons_detected).toBeGreaterThanOrEqual(1);
      expect(result.total_split_documents).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(result.person_folders)).toBe(true);
      expect(result.person_folders.length).toBeGreaterThanOrEqual(1);

      // Verify person folder structure
      const primaryFolder = result.person_folders[0];
      expect(primaryFolder.canonical_name).toBeTruthy();
      expect(primaryFolder.documents.length).toBeGreaterThanOrEqual(1);

      // Verify valid base64 without atob() throw
      const doc = primaryFolder.documents[0];
      expect(doc.pdf_base64).toBeTruthy();
      expect(() => atob(doc.pdf_base64)).not.toThrow();

      // Verify ZIP base64
      expect(result.zip_archive_base64).toBeTruthy();
      expect(() => atob(result.zip_archive_base64)).not.toThrow();
    });

    it("Feature 7 & 8: DocumentExtractorLab renders unified mode buttons and supports file upload", async () => {
      render(<DocumentExtractorLab />);

      expect(screen.getByText(/AI Document Recognition & Information Extractor/i)).toBeDefined();
      expect(screen.getByText(/Upload Document \(PDF \/ Images\)/i)).toBeDefined();
      expect(screen.getByText(/Multi-Person Packet Sorter & Splitter/i)).toBeDefined();

      // Test mode switching
      const packetTab = screen.getByText(/Multi-Person Packet Sorter & Splitter/i);
      fireEvent.click(packetTab);
      expect(
        screen.getByText(/Drop a combined multi-person PDF packet here or click to browse/i)
      ).toBeDefined();
    });

    /* --- Feature 10: Elimination of Standalone OCR Only labels --- */
    it("Feature 10: Elimination of standalone OCR Only labels in DocumentExtractorLab", () => {
      render(<DocumentExtractorLab />);
      // Verify no standalone "OCR Only" tab
      expect(screen.queryByRole("tab", { name: /^OCR Only$/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /^OCR Engine$/i })).toBeNull();
    });

    /* --- Feature 11, 12 & 13: ClientPortal 3-Pillar Home Redesign & 4 Nav Views --- */
    it("Feature 11: ClientPortal renders 3 core pillars (Status Hero, Document Upload, Direct Chat)", () => {
      render(
        <ClientPortal
          myCase={mockCase}
          documents={FIXTURE_DOCUMENTS.slice(0, 3)}
          messages={[]}
          currentUser={mockRetainedClientUser}
        />
      );

      // Pillar 1: Status Hero
      expect(screen.getByText(/application is currently in/i)).toBeDefined();
      expect(screen.getByText(/Application Readiness/i)).toBeDefined();

      // Pillar 2: Document Upload & Auto-Sort Card
      expect(screen.getByText(/Required Document List & Live Status/i)).toBeDefined();

      // Pillar 3: Direct Chat Card
      expect(screen.getByRole("button", { name: /Send Message/i })).toBeDefined();
    });

    it("Feature 12: ClientPortal provides 4 primary navigation views and handles tab switching", () => {
      render(
        <ClientPortal
          myCase={mockCase}
          documents={FIXTURE_DOCUMENTS.slice(0, 3)}
          messages={[]}
          currentUser={mockRetainedClientUser}
        />
      );

      // Scoped within the Applicant Navigation Sidebar
      const sidebar = screen.getByLabelText("Applicant Navigation Sidebar");
      expect(within(sidebar).getByText(/^Home$/i)).toBeDefined();
      expect(within(sidebar).getByText(/^Documents$/i)).toBeDefined();
      expect(within(sidebar).getByText(/^My Info & Forms$/i)).toBeDefined();
      expect(within(sidebar).getByText(/^Messages & Billing$/i)).toBeDefined();

      // Navigation buttons inside the hubs
      const docsButton = within(sidebar).getByRole("button", { name: /Upload Documents/i });
      fireEvent.click(docsButton);
      expect(screen.getByText(/My Evidence Checklist & Uploaded Files/i)).toBeDefined();

      const messagesButton = within(sidebar).getByRole("button", { name: /Lawyer Messages/i });
      fireEvent.click(messagesButton);
      expect(screen.getByText(/Attorney Communications/i)).toBeDefined();
    });

    it("Feature 13: ClientPortal preserves data-testid hooks and accessibility attributes", () => {
      render(
        <ClientPortal
          myCase={null} // Day-0 state
          documents={[]}
          messages={[]}
          currentUser={mockRetainedClientUser}
        />
      );

      // Day-0 pending test ID
      expect(screen.getByTestId("overview-visa-scope-pending")).toBeDefined();
      expect(screen.getByTestId("no-documents-uploaded")).toBeDefined();
    });

    /* --- Feature 14: Agency Tenant & Application Deletion --- */
    it("Feature 14: deleteAgencyTenant cascade-deletes tenant, invoices, team invites, tickets, leads, and writes audit log", () => {
      const tenantId = "org-delete-test-001";
      const tenantSlug = "test-delete-agency";
      const sampleTenant: AgencyTenantRecord = {
        organizationId: tenantId,
        legalEntityName: "Delete Test Agency LLC",
        tradingName: "Delete Test Agency LLC",
        slug: tenantSlug,
        ownerEmail: "owner@deletetest.com",
        ownerFullName: "Owner Test",
        status: "active",
        health: "thriving",
        planTier: "growth",
        mrrUsd: 1490,
        billingStatus: "active",
        kybTrack: "regulated_counsel",
        regulatoryBody: "CICC",
        licenseNumber: "R123456",
        hqCity: "Toronto",
        hqCountry: "CA",
        seatsUsed: 1,
        seatLimit: 5,
        casesActiveCount: 0,
        monthlyCaseQuota: 50,
        aiExtractionsUsed30d: 0,
        monthlyAiExtractionQuota: 100,
        calculatorLeads30d: 0,
        enabledCorridors: ["CA", "US"],
        featureFlags: { ai_lab: true, cobranded_calculators: true, multi_branch: true, custom_rules: true },
        branding: {
          primaryColor: "#063C3D",
          tagline: "Test",
          setupCompleted: true,
        },
        supportGrantActive: false,
        supportGrantExpiresAt: null,
        supportGrantReason: null,
        lastStaffLoginLabel: "Active today",
        createdAt: "2026-01-01",
      };

      const existingTenants = getAgencyTenants();
      localStorage.setItem(AGENCY_STORAGE.tenants, JSON.stringify([...existingTenants, sampleTenant]));

      // Seed an invoice, invite, ticket, and lead for this tenant
      localStorage.setItem(
        AGENCY_STORAGE.invoices,
        JSON.stringify([
          {
            id: "inv-test-01",
            invoiceNumber: "INV-DEL-01",
            organizationId: tenantId,
            organizationName: sampleTenant.tradingName,
            amountUsd: 1490,
            status: "paid",
            issuedAt: "2026-05-01",
            dueAt: "2026-05-15",
          },
        ])
      );

      localStorage.setItem(
        AGENCY_STORAGE.teamInvites,
        JSON.stringify([
          {
            id: "inv-user-01",
            organizationId: tenantId,
            email: "staff@deletetest.com",
            role: "paralegal",
            status: "pending",
            invitedAt: "2026-05-01",
          },
        ])
      );

      localStorage.setItem(
        AGENCY_STORAGE.tickets,
        JSON.stringify([
          {
            id: "tkt-01",
            ticketCode: "TKT-DEL-01",
            organizationId: tenantId,
            subject: "Help needed",
            status: "open",
            createdAt: "2026-05-01",
          },
        ])
      );

      localStorage.setItem(
        AGENCY_STORAGE.leads,
        JSON.stringify([
          {
            id: "lead-01",
            organizationId: tenantId,
            applicantName: "Lead Applicant",
            destinationCountry: "Canada",
            createdAt: "2026-05-01",
          },
        ])
      );

      expect(getAgencyTenants().some((t) => t.organizationId === tenantId)).toBe(true);

      const success = deleteAgencyTenant(tenantId, PLATFORM_HQ_OPERATOR_EMAIL, "End-to-end verification purge");
      expect(success).toBe(true);

      expect(getAgencyTenants().some((t) => t.organizationId === tenantId)).toBe(false);
      expect(getPlatformBillingInvoices().some((i) => i.organizationId === tenantId)).toBe(false);
      expect(getAgencyTeamInvites().some((inv) => inv.organizationId === tenantId)).toBe(false);
      expect(getAgencySupportTickets().some((t) => t.organizationId === tenantId)).toBe(false);
      expect(getCalculatorAgencyLeads().some((l) => l.organizationId === tenantId)).toBe(false);

      const logs = JSON.parse(localStorage.getItem(AGENCY_STORAGE.logs) || "[]");
      expect(logs.some((l: any) => l.actionCode === "agency_tenant_deleted" || l.action === "agency_tenant_deleted")).toBe(true);
    });

    it("Feature 14: deleteAgencyApplication removes KYB dossier application and writes audit log", () => {
      const appId = "kyb-app-delete-test-01";
      const sampleApp: AgencyKybApplication = {
        id: appId,
        dossierCode: "DOS-PURGE-01",
        legalEntityName: "Purge KYB Agency Corp.",
        tradingName: "Purge KYB Agency",
        requestedSlug: "purge-kyb-agency",
        contactWorkEmail: "owner@purgekyb.ca",
        kybStatus: "pending_kyb",
        createdAt: "2026-05-01",
        contactFullName: "Owner Test",
        contactPhone: "+1 (555) 000-0000",
        corporateDomain: "purgekyb.ca",
        hqCity: "Toronto",
        hqCountry: "CA",
        kybTrack: "regulated_counsel",
        regulatoryBody: "CICC",
        licenseNumber: "CICC-R12345",
        taxRegistrationId: "TAX-123",
        targetCorridors: ["CA"],
        requestedSeats: 5,
        branchCount: 1,
        estimatedMonthlyCases: 20,
        selectedPlanTier: "growth",
        dpaAccepted: true,
        zeroTrainingAccepted: true,
        uploadedDocuments: [],
      };

      const existingApps = getAgencyApplications();
      localStorage.setItem(AGENCY_STORAGE.applications, JSON.stringify([...existingApps, sampleApp]));

      const success = deleteAgencyApplication(appId, PLATFORM_HQ_OPERATOR_EMAIL, "Test rejection & cleanup");
      expect(success).toBe(true);
      expect(getAgencyApplications().some((a) => a.id === appId)).toBe(false);
    });

    /* --- Feature 15 & 16: Cascading Client Deletion & RBAC Guards --- */
    it("Feature 15 & 16: canDeleteClient strictly permits authorized roles and denies paralegals and clients", () => {
      expect(canDeleteClient(mockOwnerUser)).toBe(true);
      expect(canDeleteClient({ ...mockOwnerUser, role: "company_admin" })).toBe(true);
      expect(canDeleteClient({ ...mockOwnerUser, role: "case_manager" })).toBe(true);

      expect(canDeleteClient(mockParalegalUser)).toBe(false);
      expect(canDeleteClient(mockRetainedClientUser)).toBe(false);
      expect(canDeleteClient({ ...mockOwnerUser, role: "applicant" })).toBe(false);
      expect(canDeleteClient({ ...mockOwnerUser, role: "document_reviewer" })).toBe(false);
    });
  });

  /* ==========================================================================
   * TIER 2: BOUNDARY & CORNER CASES
   * ========================================================================== */
  describe("Tier 2: Boundary & Corner Cases (Adversarial, Offline, Corrupted Inputs)", () => {
    it("handles empty or zero-byte files gracefully in packet sorter fallback", async () => {
      const emptyFile = new File([], "empty.pdf", { type: "application/pdf" });
      const result = await generateClientFallbackPacketSort(emptyFile);
      expect(result.status).toBe("success");
      expect(result.person_folders.length).toBeGreaterThanOrEqual(1);
      expect(result.zip_archive_base64).toBeTruthy();
    });

    it("handles non-existent tenant deletion without crashing or altering existing data", () => {
      const initialTenants = getAgencyTenants();
      const res = deleteAgencyTenant("non-existent-tenant-id-999");
      expect(res).toBe(false);
      expect(getAgencyTenants().length).toBe(initialTenants.length);
    });

    it("handles non-existent application deletion returning false cleanly", () => {
      const res = deleteAgencyApplication("non-existent-app-id-999");
      expect(res).toBe(false);
    });

    it("prevents deletion of client profile when requested by an unauthorized paralegal role", async () => {
      await expect(api.deleteClient("client-any-id", "case_worker")).rejects.toThrow(
        /Paralegals and retained clients do not have permission to delete client records/i
      );
    });

    it("prevents deletion of client profile when requested by a retained client role", async () => {
      await expect(api.deleteClient("client-any-id", "retained_client")).rejects.toThrow(
        /Paralegals and retained clients do not have permission to delete client records/i
      );
    });

    it("handles missing case gracefully in ClientStatusHeroCard with Day-0 state", () => {
      render(
        <ClientStatusHeroCard
          myCase={null}
          currentUser={mockRetainedClientUser}
          dynamicReadinessPct={0}
          activeMilestoneIndex={0}
          totalMilestones={5}
          activeMilestoneLabel="Intake Setup"
        />
      );

      expect(screen.getByTestId("unassigned-client-empty-state")).toBeDefined();
      expect(screen.getByText(/Awaiting Case File Setup by Legal Team/i)).toBeDefined();
    });

    it("handles empty documents in ClientDocumentUploadCard with empty state message", () => {
      render(
        <ClientDocumentUploadCard
          documents={[]}
          onOpenUploadModal={vi.fn()}
          overviewDocFilter="all"
          onFilterChange={vi.fn()}
        />
      );

      expect(screen.getByTestId("no-documents-uploaded")).toBeDefined();
      expect(screen.getByText(/Your document collection is currently empty/i)).toBeDefined();
    });

    it("handles quick chat empty input without triggering dispatch", () => {
      const handleSendMessage = vi.fn();
      render(
        <ClientDirectChatWidget
          hasAssignedOfficer={true}
          displayOfficerTitle="Sarah Jenkins, Esq."
          quickChatMessage=""
          onQuickChatChange={vi.fn()}
          onSendMessage={handleSendMessage}
          quickChatSentFeedback={false}
          setQuickChatSentFeedback={vi.fn()}
        />
      );

      const sendBtn = screen.getByRole("button", { name: /Send Message/i });
      fireEvent.click(sendBtn);
      expect(handleSendMessage).not.toHaveBeenCalled();
    });
  });

  /* ==========================================================================
   * TIER 3: CROSS-FEATURE COMBINATIONS
   * ========================================================================== */
  describe("Tier 3: Cross-Feature Combinations (Integration across R1, R2, R3, R4)", () => {
    it("Packet Sorter output feeds documentAutoFillEngine which populates InitialInformationSheet and hydrates FormViewer", async () => {
      const sampleFile = new File(["%PDF-1.4 test"], "Family_Sharma_Packet.pdf", { type: "application/pdf" });
      const packetSortResult = await generateClientFallbackPacketSort(sampleFile);

      const autoFillResult = mapPacketToInitialInfoSheet(packetSortResult);
      expect(autoFillResult.updatedData.family_name).toBeTruthy();
      expect(autoFillResult.fieldsFilledCount).toBeGreaterThan(0);

      const caseItem: ImmigrationCase = {
        ...mockCase,
        client_name: `${autoFillResult.updatedData.given_names} ${autoFillResult.updatedData.family_name}`,
      };
      const submission = hydrateCanonicalForm("USCIS_I140", caseItem, mockClient, []);
      expect(submission.answers["beneficiary_family_name"].value).toBe(mockClient.last_name);
      expect(submission.answers["beneficiary_family_name"].source_type).toBe("client_profile");
    });

    it("Agency tenant deletion dynamically reconciles Platform Overview KPIs", () => {
      const existingOverview = computePlatformOverview(getAgencyTenants(), getAgencyApplications());
      const initialMrr = existingOverview.recurringMrrUsd;
      const initialActiveCount = existingOverview.activeAgenciesCount;

      const tempId = "org-kpi-reconcile-001";
      const sampleTenant: AgencyTenantRecord = {
        organizationId: tempId,
        legalEntityName: "Temporary KPI Agency Inc.",
        tradingName: "Temporary KPI Agency",
        slug: "temp-kpi-agency",
        ownerEmail: "owner@tempkpi.com",
        ownerFullName: "Owner Test",
        status: "active",
        health: "thriving",
        planTier: "growth",
        mrrUsd: 2990,
        billingStatus: "active",
        kybTrack: "regulated_counsel",
        regulatoryBody: "CICC",
        licenseNumber: "R99999",
        hqCity: "Vancouver",
        hqCountry: "CA",
        seatsUsed: 5,
        seatLimit: 15,
        casesActiveCount: 10,
        monthlyCaseQuota: 150,
        aiExtractionsUsed30d: 50,
        monthlyAiExtractionQuota: 500,
        calculatorLeads30d: 5,
        enabledCorridors: ["CA", "US"],
        featureFlags: { ai_lab: true, cobranded_calculators: true, multi_branch: true, custom_rules: true },
        branding: {
          primaryColor: "#063C3D",
          tagline: "Test",
          setupCompleted: true,
        },
        supportGrantActive: false,
        supportGrantExpiresAt: null,
        supportGrantReason: null,
        lastStaffLoginLabel: "Active today",
        createdAt: "2026-05-01",
      };

      const tenants = getAgencyTenants();
      localStorage.setItem(AGENCY_STORAGE.tenants, JSON.stringify([...tenants, sampleTenant]));

      const updatedOverview = computePlatformOverview(getAgencyTenants(), getAgencyApplications());
      expect(updatedOverview.activeAgenciesCount).toBe(initialActiveCount + 1);
      expect(updatedOverview.recurringMrrUsd).toBe(initialMrr + 2990);

      deleteAgencyTenant(tempId);

      const finalOverview = computePlatformOverview(getAgencyTenants(), getAgencyApplications());
      expect(finalOverview.activeAgenciesCount).toBe(initialActiveCount);
      expect(finalOverview.recurringMrrUsd).toBe(initialMrr);
    });

    it("WorkspaceContext provides delete client capability and updates state upon deletion", async () => {
      function TestConsumer() {
        const { clients, handleDeleteClient } = useWorkspace();
        return (
          <div>
            <div data-testid="clients-count">{clients.length}</div>
            {clients.map((c) => (
              <button
                key={c.id}
                data-testid={`delete-client-${c.id}`}
                onClick={() => handleDeleteClient(c.id)}
              >
                Delete {c.first_name}
              </button>
            ))}
          </div>
        );
      }

      const newClientRes = await api.createClient(
        {
          first_name: "Aman",
          last_name: "Verma",
          email: "aman.verma@example.com",
          nationality: "India",
        },
        "master_admin"
      );

      const { unmount } = render(
        <WorkspaceProvider initialUser={mockOwnerUser}>
          <TestConsumer />
        </WorkspaceProvider>
      );

      await waitFor(() => {
        expect(screen.queryByTestId(`delete-client-${newClientRes.data.id}`)).toBeDefined();
      });

      const delBtn = screen.getByTestId(`delete-client-${newClientRes.data.id}`);
      await act(async () => {
        fireEvent.click(delBtn);
      });

      await waitFor(() => {
        expect(screen.queryByTestId(`delete-client-${newClientRes.data.id}`)).toBeNull();
      });

      unmount();
    });
  });

  /* ==========================================================================
   * TIER 4: REAL-WORLD WORKFLOWS
   * ========================================================================== */
  describe("Tier 4: Real-World Workflows (Full End-to-End Lifecycles)", () => {
    it("Workflow 1: Complete Client Onboarding -> Packet Split -> Form Verification -> Portal Engagement -> Cleanup", async () => {
      const samplePassport = new File(["%PDF-1.4 passport"], "PASSPORT_SINGH_HARMEET.pdf", {
        type: "application/pdf",
      });
      const sortResult = await generateClientFallbackPacketSort(samplePassport);
      expect(sortResult.status).toBe("success");

      const clientRes = await api.createClient(
        {
          first_name: "Harmeet",
          last_name: "Singh",
          email: "harmeet.singh@example.com",
          nationality: "India",
          portal_access_enabled: true,
          portal_credentials_provided: true,
          temporary_password: "ClientPass2026!",
        },
        "master_admin"
      );
      expect(clientRes.data.first_name).toBe("Harmeet");

      const clientAuth = authenticateUser("harmeet.singh@example.com", "client", "ClientPass2026!");
      expect(clientAuth.success).toBe(true);

      const sampleCase: ImmigrationCase = {
        ...mockCase,
        id: "case-harmeet-001",
        case_number: "CASE-CA-2026-HS",
        title: "Canada Express Entry — Harmeet Singh",
        client_id: clientRes.data.id,
        client_name: "Harmeet Singh",
      };

      const handleSendMessage = vi.fn();
      const { unmount: unmountPortal } = render(
        <ClientPortal
          myCase={sampleCase}
          documents={[]}
          messages={[]}
          currentUser={clientAuth.user}
          onSendMessage={handleSendMessage}
        />
      );

      // Verify 3 Pillars rendered
      expect(screen.getByText(/application is currently in/i)).toBeDefined();
      expect(screen.getByText(/Required Document List & Live Status/i)).toBeDefined();
      expect(screen.getByRole("button", { name: /Send Message/i })).toBeDefined();

      // Send a direct message in Pillar 3
      const chatInput = screen.getByPlaceholderText(/Type a direct message to/i);
      fireEvent.change(chatInput, { target: { value: "Hello, when will my medical exam request arrive?" } });
      const sendBtn = screen.getByRole("button", { name: /Send Message/i });
      fireEvent.click(sendBtn);
      expect(handleSendMessage).toHaveBeenCalledWith("Hello, when will my medical exam request arrive?");

      unmountPortal();

      // Cleanup: Delete client record
      const delRes = await api.deleteClient(clientRes.data.id, "master_admin");
      expect(delRes.data.success).toBe(true);
      const remainingClients = (await api.getClients("master_admin")).data;
      expect(remainingClients.some((c) => c.id === clientRes.data.id)).toBe(false);
    });

    it("Workflow 2: Super Admin Platform Lifecycle (Partner Onboarding -> Audit -> Deletion)", async () => {
      // 1. Submit agency onboarding via official store function
      const app = await submitAgencyOnboarding({
        legalEntityName: "Pacific Immigration Associates PC",
        tradingName: "Pacific Immigration Associates",
        requestedSlug: "pacific-immigration-test",
        hqCountry: "CA",
        hqCity: "Vancouver",
        corporateDomain: "pacificimmigration.ca",
        taxRegistrationId: "TAX-BC-998811",
        contactFullName: "Douglas Vance, RCIC",
        contactWorkEmail: "douglas@pacificimmigration.ca",
        contactPhone: "+1 (604) 555-0199",
        ownerPassword: "PacificPass2026!",
        consultationBookingUrl: "https://pacificimmigration.ca/book",
        kybTrack: "regulated_counsel",
        regulatoryBody: "CICC",
        licenseNumber: "R554433",
        uploadedDocuments: [
          buildKybUploadedDocMeta(
            "practitioner_license",
            new File(["%PDF-1.4 License"], "CICC_License.pdf", { type: "application/pdf" })
          ),
        ],
        targetCorridors: ["CA", "US"],
        estimatedMonthlyCases: 25,
        requestedSeats: 6,
        branchCount: 1,
        selectedPlanTier: "growth",
        dpaAccepted: true,
        zeroTrainingAccepted: true,
      });

      // 2. Adjudicate & approve to provision tenant
      const adjudicated = adjudicateAgencyKybApplication(
        app.id,
        "approve",
        "Verified regulatory credentials.",
        PLATFORM_HQ_OPERATOR_EMAIL
      );
      expect(adjudicated.provisionedTenant).toBeTruthy();
      const partnerId = adjudicated.provisionedTenant!.organizationId;

      // 3. Render SuperAdminControlPlane
      render(<SuperAdminControlPlane />);

      fireEvent.change(screen.getByLabelText(/Documento HQ Operator Email/i), {
        target: { value: PLATFORM_HQ_OPERATOR_EMAIL },
      });
      fireEvent.change(screen.getByLabelText(/Operator Passphrase/i), {
        target: { value: "DocumentoHQ2026!" },
      });
      fireEvent.click(screen.getByRole("button", { name: /Authenticate to Control Plane/i }));

      await waitFor(() => {
        expect(screen.getByText(/Documento HQ Control Plane/i)).toBeDefined();
      });

      // 4. Decommission tenant
      const deleted = deleteAgencyTenant(partnerId, PLATFORM_HQ_OPERATOR_EMAIL, "End-of-audit decommissioning");
      expect(deleted).toBe(true);
      expect(getAgencyTenants().some((t) => t.organizationId === partnerId)).toBe(false);
    });
  });
});
