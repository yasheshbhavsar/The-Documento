import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
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
} from "../lib/documentAutoFillEngine";
import { ExtractorAnalysisResult, PacketSortResult } from "../lib/api/extractor";
import { DocumentItem, ClientProfile, ImmigrationCase } from "../lib/types";
import {
  InitialInformationSheet,
  INITIAL_INFO_SHEET_STORAGE_KEY,
} from "../components/portal/InitialInformationSheet";
import { GuidedQuestionnaireModal } from "../components/modals/GuidedQuestionnaireModal";
import { CreateClientModal } from "../components/modals/CreateClientModal";
import { ConfigurableFormViewer } from "../components/forms/ConfigurableFormViewer";

describe("Requirement R1 — Auto-Fetch & Live Document-to-Form Intelligence Engine", () => {
  beforeEach(() => {
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
    vi.clearAllMocks();
  });

  describe("1. Date Normalization (normalizeDateToDDMMYYYY)", () => {
    it("handles ISO YYYY-MM-DD dates", () => {
      expect(normalizeDateToDDMMYYYY("1990-05-14")).toBe("14/05/1990");
      expect(normalizeDateToDDMMYYYY("2026-12-31")).toBe("31/12/2026");
      expect(normalizeDateToDDMMYYYY("1985-01-09T08:00:00Z")).toBe("09/01/1985");
    });

    it("preserves already normalized DD/MM/YYYY dates", () => {
      expect(normalizeDateToDDMMYYYY("14/05/1990")).toBe("14/05/1990");
      expect(normalizeDateToDDMMYYYY("01/01/2000")).toBe("01/01/2000");
    });

    it("converts hyphen and dot delimited dates DD-MM-YYYY and DD.MM.YYYY", () => {
      expect(normalizeDateToDDMMYYYY("14-05-1990")).toBe("14/05/1990");
      expect(normalizeDateToDDMMYYYY("09.11.2021")).toBe("09/11/2021");
    });

    it("converts month-name formatted strings", () => {
      expect(normalizeDateToDDMMYYYY("14 May 1990")).toBe("14/05/1990");
      expect(normalizeDateToDDMMYYYY("May 14, 1990")).toBe("14/05/1990");
      expect(normalizeDateToDDMMYYYY("16 June, 2019")).toBe("16/06/2019");
      expect(normalizeDateToDDMMYYYY("28 November 2021")).toBe("28/11/2021");
    });

    it("converts US formatted MM/DD/YYYY when day > 12", () => {
      expect(normalizeDateToDDMMYYYY("05/14/1990")).toBe("14/05/1990");
      expect(normalizeDateToDDMMYYYY("11/28/2021")).toBe("28/11/2021");
    });

    it("gracefully handles null, undefined, empty, or unparseable input", () => {
      expect(normalizeDateToDDMMYYYY(null)).toBe("");
      expect(normalizeDateToDDMMYYYY(undefined)).toBe("");
      expect(normalizeDateToDDMMYYYY("")).toBe("");
      expect(normalizeDateToDDMMYYYY("   ")).toBe("");
    });
  });

  describe("2. Client Profile Extraction (extractProfileFromAnalysis & extractProfileFromDocument)", () => {
    it("extracts client onboarding profile from Indian Passport analysis", () => {
      const mockPassportAnalysis: ExtractorAnalysisResult = {
        status: "success",
        metadata: {
          filename: "Passport_Bhavsar.pdf",
          mime_type: "application/pdf",
          file_size_bytes: 420000,
          sha256_hash: "hash-pass-123",
          page_count: 2,
          detected_language: "en",
          total_blocks_detected: 12,
          overall_health_score: 98,
        },
        recognition: {
          category: "identity_passport",
          category_label: "Passports and Identity Documents",
          confidence: 0.98,
          matched_keywords: ["PASSPORT", "REPUBLIC OF INDIA"],
        },
        specialized_intelligence: {
          identity_compliance: {
            indian_passport: {
              passport_number: "Z8849201",
              surname: "BHAVSAR",
              given_names: "YASHESH ULLASKUMAR",
              holder_name: "YASHESH ULLASKUMAR BHAVSAR",
              date_of_birth: "1994-08-12",
              gender: "MALE",
              place_of_birth: "Ahmedabad, Gujarat",
              place_of_issue: "Ahmedabad",
              date_of_issue: "2018-05-10",
              date_of_expiry: "2028-05-09",
              father_name: "ULLASKUMAR BHAVSAR",
              mother_name: "DIPTI BHAVSAR",
              spouse_name: "PRIYA BHAVSAR",
              address: "12 Shivam Apts, Bodakdev, Ahmedabad 380054",
              nationality: "Indian",
            },
          },
        },
        extracted_fields: [],
        quality_findings: [],
        ocr_summary: {
          ocr_applied: true,
          avg_page_confidence: 0.98,
          pages: [],
        },
        raw_text_preview: "PASSPORT REPUBLIC OF INDIA...",
      };

      const profile = extractProfileFromAnalysis(mockPassportAnalysis, "Passport_Bhavsar.pdf");

      expect(profile.firstName).toBe("YASHESH ULLASKUMAR");
      expect(profile.lastName).toBe("BHAVSAR");
      expect(profile.passportNumber).toBe("Z8849201");
      expect(profile.nationality).toBe("Indian");
      expect(profile.confidence).toBe(0.98);
      expect(profile.sourceDocumentName).toBe("Passport_Bhavsar.pdf");
    });

    it("extracts client onboarding profile from Resume analysis", () => {
      const mockResumeAnalysis: ExtractorAnalysisResult = {
        status: "success",
        metadata: {
          filename: "John_Doe_CV.pdf",
          mime_type: "application/pdf",
          file_size_bytes: 120000,
          sha256_hash: "hash-cv-456",
          page_count: 3,
          detected_language: "en",
          total_blocks_detected: 35,
          overall_health_score: 95,
        },
        recognition: {
          category: "employment_records",
          category_label: "Employment & Experience Records",
          confidence: 0.94,
          matched_keywords: ["EXPERIENCE", "EDUCATION", "SKILLS"],
        },
        specialized_intelligence: {
          resume_intelligence: {
            candidate_name: "Dr. Jane Doe",
            current_role: "Principal AI Scientist",
            employer: "Global DeepTech Labs",
            email: "jane.doe@deeptech.ai",
            phone: "+1-415-555-8821",
            location: "San Francisco, CA",
            skills: "Machine Learning, Large Language Models, PyTorch",
            education: (["Ph.D. in Computer Science, Stanford University"] as unknown as string),
            languages: "English, French",
            years_experience: "12",
          },
        },
        extracted_fields: [],
        quality_findings: [],
        ocr_summary: {
          ocr_applied: true,
          avg_page_confidence: 0.98,
          pages: [],
        },
        raw_text_preview: "PASSPORT REPUBLIC OF INDIA...",
      };

      const profile = extractProfileFromAnalysis(mockResumeAnalysis, "John_Doe_CV.pdf");

      expect(profile.firstName).toBe("Dr. Jane");
      expect(profile.lastName).toBe("Doe");
      expect(profile.email).toBe("jane.doe@deeptech.ai");
      expect(profile.phone).toBe("+1-415-555-8821");
      expect(profile.currentField).toBe("Principal AI Scientist");
      expect(profile.highestDegree).toBe("Ph.D. in Computer Science, Stanford University");
      expect(profile.confidence).toBe(0.94);
    });

    it("extracts client profile deterministically offline from a simulated File", async () => {
      const fileContent = `
        PASSPORT
        Type: P Country Code: IND Passport No: K9948210
        Surname: PATEL
        Given Names: AARAV
        Date of Birth: 1991-03-25
        Place of Birth: Vadodara, India
        Date of Expiry: 2031-03-24
      `;
      const file = new File([fileContent], "Aarav_Patel_Passport.pdf", { type: "application/pdf" });

      const profile = await extractProfileFromDocument(file);

      expect(profile.firstName).toBeTruthy();
      expect(profile.sourceDocumentName).toBe("Aarav_Patel_Passport.pdf");
      expect(profile.confidence).toBeGreaterThan(0.8);
    });
  });

  describe("3. InitialInformationSheet Auto-Fill Mapping (mapAnalysisToInitialInfoSheet)", () => {
    it("maps Indian Passport data to Biodata, Passport, and Family register with DD/MM/YYYY dates and provenance", () => {
      const mockAnalysis: ExtractorAnalysisResult = {
        status: "success",
        metadata: {
          filename: "Passport_Scan.pdf",
          mime_type: "application/pdf",
          file_size_bytes: 512000,
          sha256_hash: "sha-pass-001",
          page_count: 2,
          detected_language: "en",
          total_blocks_detected: 20,
          overall_health_score: 96,
        },
        recognition: {
          category: "identity_passport",
          category_label: "Passports and Identity Documents",
          confidence: 0.97,
          matched_keywords: ["PASSPORT", "IND"],
        },
        specialized_intelligence: {
          identity_compliance: {
            indian_passport: {
              passport_number: "T9281720",
              surname: "SHAH",
              given_names: "VIKRAM",
              date_of_birth: "1988-11-04",
              gender: "MALE",
              place_of_birth: "Mumbai, Maharashtra",
              place_of_issue: "Mumbai",
              date_of_issue: "2016-02-15",
              date_of_expiry: "2026-02-14",
              father_name: "RAMESH SHAH",
              mother_name: "SARITA SHAH",
              spouse_name: "ANITA SHAH",
              address: "Flat 402, Sea Green Apts, Worli, Mumbai 400018",
              nationality: "Indian",
            },
          },
        },
        extracted_fields: [],
        quality_findings: [],
        ocr_summary: {
          ocr_applied: true,
          avg_page_confidence: 0.98,
          pages: [],
        },
        raw_text_preview: "PASSPORT REPUBLIC OF INDIA...",
      };

      const result = mapAnalysisToInitialInfoSheet(mockAnalysis);

      // Biodata fields
      expect(result.updatedData.family_name).toBe("SHAH");
      expect(result.updatedData.given_names).toBe("VIKRAM");
      expect(result.updatedData.dob).toBe("04/11/1988"); // Normalized DD/MM/YYYY
      expect(result.updatedData.gender).toBe("MALE");
      expect(result.updatedData.city_country_birth).toBe("Mumbai, Maharashtra");
      expect(result.updatedData.residential_address).toBe("Flat 402, Sea Green Apts, Worli, Mumbai 400018");

      // Passport fields
      expect(result.updatedData.passport_number).toBe("T9281720");
      expect(result.updatedData.passport_issue_place).toBe("Mumbai");
      expect(result.updatedData.passport_issue_date).toBe("15/02/2016");
      expect(result.updatedData.passport_expiry_date).toBe("14/02/2026");

      // Family register
      expect(result.updatedData.family?.father?.name).toBe("RAMESH SHAH");
      expect(result.updatedData.family?.mother?.name).toBe("SARITA SHAH");
      expect(result.updatedData.family?.spouse?.name).toBe("ANITA SHAH");
      expect(result.updatedData.marital_status).toBe("MARRIED");

      // Provenance indicators
      expect(result.provenance["family_name"]).toBeDefined();
      expect(result.provenance["family_name"].source_type).toBe("document_ocr");
      expect(result.provenance["family_name"].source_document_title).toBe("Passport_Scan.pdf");
      expect(result.provenance["family_name"].confidence).toBeGreaterThanOrEqual(0.95);

      expect(result.provenance["dob"]).toBeDefined();
      expect(result.provenance["dob"].value).toBe("04/11/1988");

      expect(result.provenance["passport_number"]).toBeDefined();
      expect(result.provenance["passport_number"].value).toBe("T9281720");

      expect(result.fieldsFilledCount).toBeGreaterThanOrEqual(8);
    });

    it("maps Marriage Certificate fields to marital status and date of marriage in DD/MM/YYYY", () => {
      const mockMarriageDoc: DocumentItem = {
        id: "doc-marriage-01",
        title: "Marriage_Certificate.pdf",
        category: "civil_status_family",
        file_size: "1.2 MB",
        sha256_hash: "hash-marriage-001",
        version: 1,
        is_current_version: true,
        processing_status: "completed",
        verification_status: "verified",
        status: "verified",
        uploaded_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        extracted_fields: [
          {
            id: "f-1",
            field_name: "marriage_date",
            field_label: "Date of Marriage",
            original_value: "November 28, 2021",
            normalized_value: "2021-11-28",
            field_value: "2021-11-28",
            source_page: 1,
            extraction_method: "civil_status_resolver",
            confidence: 0.99,
            ocr_confidence: 0.99,
            extraction_confidence: 0.99,
            validation_status: "unvalidated",
            is_manually_corrected: false,
          },
          {
            id: "f-2",
            field_name: "groom_name",
            field_label: "Bridegroom Name",
            original_value: "YASHESH BHAVSAR",
            normalized_value: "YASHESH BHAVSAR",
            field_value: "YASHESH BHAVSAR",
            source_page: 1,
            extraction_method: "civil_status_resolver",
            confidence: 0.98,
            ocr_confidence: 0.98,
            extraction_confidence: 0.98,
            validation_status: "unvalidated",
            is_manually_corrected: false,
          },
          {
            id: "f-3",
            field_name: "bride_name",
            field_label: "Bride Name",
            original_value: "PRIYA PARIKH",
            normalized_value: "PRIYA PARIKH",
            field_value: "PRIYA PARIKH",
            source_page: 1,
            extraction_method: "civil_status_resolver",
            confidence: 0.98,
            ocr_confidence: 0.98,
            extraction_confidence: 0.98,
            validation_status: "unvalidated",
            is_manually_corrected: false,
          },
        ],
      };

      const result = mapAnalysisToInitialInfoSheet(mockMarriageDoc);

      expect(result.updatedData.marital_status).toBe("MARRIED");
      expect(result.updatedData.date_of_marriage).toBe("28/11/2021");
      expect(result.updatedData.family?.spouse?.name).toBe("PRIYA PARIKH");
      expect(result.provenance["date_of_marriage"]).toBeDefined();
      expect(result.provenance["date_of_marriage"].value).toBe("28/11/2021");
    });
  });

  describe("4. Multi-Document Packet Mapping (mapPacketToInitialInfoSheet)", () => {
    it("aggregates fields across sorted packet documents into a unified intake sheet", () => {
      const mockPacket: PacketSortResult = {
        status: "success",
        source_filename: "Packet.pdf",
        total_pages_analyzed: 5,
        total_persons_detected: 1,
        total_split_documents: 2,
        zip_archive_filename: "Packet_sorted.zip",
        person_folders: [
          {
            person_id: "person-primary",
            canonical_name: "YASHESH BHAVSAR",
            folder_name: "YASHESH BHAVSAR",
            name_variations: ["YASHESH BHAVSAR"],
            id_anchors: { passport: ["Z9928172"] },
            is_caseworker_review_folder: false,
            total_documents: 2,
            total_pages: 5,
            documents: [
              {
                document_index: 1,
                filename: "Split_01_Passport.pdf",
                relative_path: "person-primary/Split_01_Passport.pdf",
                category: "identity_passport",
                document_subtype: "indian_passport",
                page_numbers: [1, 2],
                page_range: "1-2",
                page_count: 2,
                is_joint_document: false,
                shared_with: [],
                extracted_fields: {
                  passport_number: "Z9928172",
                  surname: "BHAVSAR",
                  given_names: "YASHESH",
                  date_of_birth: "1994-08-12",
                  date_of_expiry: "2034-08-11",
                },
                text_preview: "REPUBLIC OF INDIA PASSPORT...",
              },
              {
                document_index: 2,
                filename: "Split_02_Degree.pdf",
                relative_path: "person-primary/Split_02_Degree.pdf",
                category: "educational_records",
                document_subtype: "master_diploma",
                page_numbers: [3],
                page_range: "3",
                page_count: 1,
                is_joint_document: false,
                shared_with: [],
                extracted_fields: {
                  degree_title: "Master of Science in Computer Science",
                  institution_name: "Stanford University",
                  graduation_date: "2019-06-16",
                },
                text_preview: "STANFORD UNIVERSITY CONFERS THE DEGREE...",
              },
            ],
          },
        ],
      };

      const result = mapPacketToInitialInfoSheet(mockPacket);

      expect(result.updatedData.family_name).toBe("BHAVSAR");
      expect(result.updatedData.given_names).toBe("YASHESH");
      expect(result.updatedData.passport_number).toBe("Z9928172");
      expect(result.updatedData.dob).toBe("12/08/1994");
      expect(result.updatedData.education).toHaveLength(1);
      expect(result.updatedData.education[0].school_name).toBe("Stanford University");
      expect(result.updatedData.education[0].end_date).toBe("16/06/2019");
      expect(result.fieldsFilledCount).toBeGreaterThanOrEqual(4);
    });
  });

  describe("5. Canonical Form Dynamic Hydration (hydrateCanonicalForm)", () => {
    const mockClient: ClientProfile = {
      id: "cli-01",
      first_name: "Alex",
      last_name: "Mercer",
      email: "alex.mercer@biotech.org",
      phone: "+1-650-555-0144",
      nationality: "United States",
      organization_id: "org-01",
      created_at: new Date().toISOString(),
    };

    const mockCase: ImmigrationCase = {
      id: "case-01",
      client_id: "cli-01",
      client_name: "Alex Mercer",
      organization_id: "org-01",
      case_number: "CASE-9021",
      title: "EB-1A Extraordinary Ability in Biomedical Engineering",
      visa_category: "EB-1A Extraordinary Ability",
      jurisdiction: "United States (USCIS)",
      status: "processing",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockDocs: DocumentItem[] = [
      {
        id: "doc-pass-01",
        title: "US_Passport.pdf",
        category: "identity_passport",
        file_size: "1.5 MB",
        sha256_hash: "hash-us-pass",
        version: 1,
        is_current_version: true,
        processing_status: "completed",
        verification_status: "verified",
        status: "verified",
        uploaded_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        extracted_fields: [
          {
            id: "f-pass-no",
            field_name: "passport_number",
            field_label: "Passport Number",
            original_value: "USA5928104",
            normalized_value: "USA5928104",
            field_value: "USA5928104",
            source_page: 1,
            extraction_method: "icao_mrz_engine",
            confidence: 0.99,
            ocr_confidence: 0.99,
            extraction_confidence: 0.99,
            validation_status: "unvalidated",
            is_manually_corrected: false,
          },
          {
            id: "f-pass-dob",
            field_name: "date_of_birth",
            field_label: "Date of Birth",
            original_value: "1987-03-22",
            normalized_value: "1987-03-22",
            field_value: "1987-03-22",
            source_page: 1,
            extraction_method: "icao_mrz_engine",
            confidence: 0.99,
            ocr_confidence: 0.99,
            extraction_confidence: 0.99,
            validation_status: "unvalidated",
            is_manually_corrected: false,
          },
          {
            id: "f-pass-addr",
            field_name: "residential_address",
            field_label: "Address",
            original_value: "450 Serra Mall, Stanford, CA 94305",
            normalized_value: "450 Serra Mall, Stanford, CA 94305",
            field_value: "450 Serra Mall, Stanford, CA 94305",
            source_page: 1,
            extraction_method: "ocr_nlp",
            confidence: 0.95,
            ocr_confidence: 0.95,
            extraction_confidence: 0.95,
            validation_status: "unvalidated",
            is_manually_corrected: false,
          },
        ],
      },
    ];

    it("hydrates USCIS Form I-140 with client profile, OCR passport, and AI endeavor rationale", () => {
      const submission = hydrateCanonicalForm("USCIS_I140", mockCase, mockClient, mockDocs);

      expect(submission.form_code).toBe("USCIS_I140");
      expect(submission.status).toBe("draft");

      // Part 1 Petitioner (from client profile)
      expect(submission.answers["petitioner_family_name"]?.value).toBe("Mercer");
      expect(submission.answers["petitioner_family_name"]?.source_type).toBe("client_profile");
      expect(submission.answers["petitioner_given_name"]?.value).toBe("Alex");
      expect(submission.answers["petitioner_email"]?.value).toBe("alex.mercer@biotech.org");

      // Part 3 Beneficiary (from passport OCR)
      expect(submission.answers["beneficiary_passport_number"]?.value).toBe("USA5928104");
      expect(submission.answers["beneficiary_passport_number"]?.source_type).toBe("document_ocr");
      expect(submission.answers["beneficiary_passport_number"]?.source_label).toBe("US_Passport.pdf");

      // Part 4 Sensitive field must NOT be auto-confirmed
      expect(submission.answers["prior_removal_or_criminal_record"]?.value).toBe(false);
      expect(submission.answers["prior_removal_or_criminal_record"]?.is_confirmed).toBe(false);
      expect(submission.sensitive_fields_reviewed).toBe(false);

      // Part 8 Endeavor rationale
      expect(submission.answers["proposed_endeavor_summary"]?.value).toContain("EB-1A Extraordinary Ability");
      expect(submission.answers["proposed_endeavor_summary"]?.source_type).toBe("ai_generated");

      expect(submission.completion_percentage).toBeGreaterThan(50);
    });

    it("hydrates USCIS Form G-28 with attorney defaults, client identity, and notices consent", () => {
      const submission = hydrateCanonicalForm("USCIS_G28", mockCase, mockClient, mockDocs);

      expect(submission.form_code).toBe("USCIS_G28");
      expect(submission.answers["attorney_family_name"]?.value).toBe("Law Group");
      expect(submission.answers["client_family_name"]?.value).toBe("Mercer");
      expect(submission.answers["client_given_name"]?.value).toBe("Alex");
      expect(submission.answers["client_dob"]?.value).toBe("22/03/1987");
      expect(submission.answers["consent_send_notices_to_attorney"]?.value).toBe(true);
    });

    it("hydrates USCIS Form I-485 with applicant bio, residential address, and arrival details", () => {
      const submission = hydrateCanonicalForm("USCIS_I485", mockCase, mockClient, mockDocs);

      expect(submission.form_code).toBe("USCIS_I485");
      expect(submission.answers["applicant_family_name"]?.value).toBe("Mercer");
      expect(submission.answers["applicant_given_name"]?.value).toBe("Alex");
      expect(submission.answers["date_of_birth"]?.value).toBe("22/03/1987");
      expect(submission.answers["current_residential_address"]?.value).toBe("450 Serra Mall, Stanford, CA 94305");
      expect(submission.answers["passport_number"]?.value).toBe("USA5928104");
      expect(submission.answers["inadmissibility_arrests_citations"]?.is_confirmed).toBe(false);
    });

    it("hydrates IRCC Form IMM 5257 for Canada with personal identity, passport, and visit purpose", () => {
      const submission = hydrateCanonicalForm("IRCC_IMM5257", mockCase, mockClient, mockDocs);

      expect(submission.form_code).toBe("IRCC_IMM5257");
      expect(submission.answers["family_name"]?.value).toBe("Mercer");
      expect(submission.answers["given_names"]?.value).toBe("Alex");
      expect(submission.answers["date_of_birth"]?.value).toBe("22/03/1987");
      expect(submission.answers["passport_number"]?.value).toBe("USA5928104");
      expect(submission.answers["residential_address"]?.value).toBe("450 Serra Mall, Stanford, CA 94305");
      expect(submission.answers["prior_visa_refusal_canada_or_other"]?.is_confirmed).toBe(false);
    });

    it("exports canonical schemas matching ConfigurableFormViewer specifications", () => {
      expect(CANONICAL_FORM_SCHEMAS["USCIS_I140"]).toBeDefined();
      expect(CANONICAL_FORM_SCHEMAS["USCIS_G28"]).toBeDefined();
      expect(CANONICAL_FORM_SCHEMAS["USCIS_I485"]).toBeDefined();
      expect(CANONICAL_FORM_SCHEMAS["IRCC_IMM5257"]).toBeDefined();
    });
  });

  describe("6. Event Broadcasting and Persistence (persistAndBroadcastAutoFill & getAutoFillProvenance)", () => {
    it("persists sheet data and provenance to localStorage and dispatches CustomEvent", () => {
      const eventListenerSpy = vi.fn();
      window.addEventListener("documento-autofill-updated", eventListenerSpy as EventListener);

      const testStorageKey = "case-8819";
      const payload = {
        formData: {
          family_name: "KAPOOR",
          given_names: "ROHAN",
          dob: "18/07/1992",
        },
        provenance: {
          family_name: {
            field_name: "family_name",
            field_label: "Family Name",
            value: "KAPOOR",
            source_type: "document_ocr" as const,
            source_document_title: "Indian_Passport.pdf",
            confidence: 0.98,
            extracted_at: new Date().toISOString(),
          },
        },
        sourceFilename: "Indian_Passport.pdf",
      };

      persistAndBroadcastAutoFill(testStorageKey, payload);

      // Verify localStorage was updated
      const rawStored = window.localStorage.getItem(INITIAL_INFO_SHEET_STORAGE_KEY);
      expect(rawStored).toBeTruthy();
      const parsed = JSON.parse(rawStored!);
      expect(parsed[testStorageKey]?.formData?.family_name).toBe("KAPOOR");
      expect(parsed[testStorageKey]?.fieldProvenance?.family_name?.value).toBe("KAPOOR");

      // Verify event was fired
      expect(eventListenerSpy).toHaveBeenCalledTimes(1);
      const callArg = eventListenerSpy.mock.calls[0][0] as CustomEvent;
      expect(callArg.type).toBe("documento-autofill-updated");
      expect(callArg.detail.storageKeyId).toBe(testStorageKey);
      expect(callArg.detail.sourceFilename).toBe("Indian_Passport.pdf");

      // Verify getter
      const retrieved = getAutoFillProvenance(testStorageKey);
      expect(retrieved.family_name?.value).toBe("KAPOOR");

      window.removeEventListener("documento-autofill-updated", eventListenerSpy as EventListener);
    });
  });

  describe("7. UI Integration: InitialInformationSheet Component", () => {
    it("renders with auto-fill provenance badges and blue highlights matching Mockup Image 1", () => {
      const storageKey = "case-test-sheet-01";
      window.localStorage.setItem(
        INITIAL_INFO_SHEET_STORAGE_KEY,
        JSON.stringify({
          [storageKey]: {
            formData: {
              family_name: "BHAVSAR",
              given_names: "YASHESH ULLASKUMAR",
              dob: "12/08/1994",
              residential_address: "12 Shivam Apts, Ahmedabad",
            },
            fieldProvenance: {
              family_name: {
                field_name: "family_name",
                field_label: "Family Name",
                value: "BHAVSAR",
                source_type: "document_ocr",
                source_document_title: "Indian_Passport.pdf",
                confidence: 0.98,
                extracted_at: new Date().toISOString(),
              },
              dob: {
                field_name: "dob",
                field_label: "Date of Birth",
                value: "12/08/1994",
                source_type: "document_ocr",
                source_document_title: "Indian_Passport.pdf",
                confidence: 0.98,
                extracted_at: new Date().toISOString(),
              },
            },
            isSubmitted: false,
          },
        })
      );

      render(<InitialInformationSheet storageKeyId={storageKey} />);

      // Verify header sync badge
      expect(screen.getByTestId("autofill-sync-badge")).toBeDefined();
      expect(screen.getByText(/2 Fields Auto-Synchronized \(OCR\)/i)).toBeDefined();

      // Verify field provenance badge
      expect(screen.getByTestId("provenance-badge-family_name")).toBeDefined();
      expect(screen.getByTestId("provenance-badge-dob")).toBeDefined();

      // Verify DD/MM/YYYY header requirement
      expect(screen.getByText(/Dates formatted in/i)).toBeDefined();
    });

    it("reacts live to documento-autofill-updated broadcast events", async () => {
      const storageKey = "case-live-sheet";
      render(<InitialInformationSheet storageKeyId={storageKey} />);

      act(() => {
        persistAndBroadcastAutoFill(storageKey, {
          formData: {
            family_name: "CHOUDHURY",
            given_names: "PRIYA",
            dob: "19/04/1993",
          },
          provenance: {
            family_name: {
              field_name: "family_name",
              field_label: "Family Name",
              value: "CHOUDHURY",
              source_type: "document_ocr",
              source_document_title: "Passport_Priya.pdf",
              confidence: 0.99,
              extracted_at: new Date().toISOString(),
            },
          },
          sourceFilename: "Passport_Priya.pdf",
        });
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue("CHOUDHURY")).toBeDefined();
        expect(screen.getByDisplayValue("PRIYA")).toBeDefined();
        expect(screen.getByTestId("provenance-badge-family_name")).toBeDefined();
      });
    });
  });

  describe("8. UI Integration: GuidedQuestionnaireModal Component", () => {
    it("pre-fills Step 1 and Step 4 fields when prefillData is provided", () => {
      const prefill = {
        fullName: "Dr. Vikram Sethi",
        currentField: "Biomedical Engineering & Machine Learning",
        highestDegree: "Ph.D. in Bioengineering, Johns Hopkins",
        criticalRoleDescription: "Directing foundational research on computational neuro-prosthetics.",
      };

      render(
        <GuidedQuestionnaireModal
          isOpen={true}
          onClose={() => {}}
          onSaved={() => {}}
          applicantName="Dr. Vikram Sethi"
          prefillData={prefill}
        />
      );

      expect(screen.getByDisplayValue("Dr. Vikram Sethi")).toBeDefined();
      expect(screen.getByDisplayValue("Biomedical Engineering & Machine Learning")).toBeDefined();
      expect(screen.getByDisplayValue("Ph.D. in Bioengineering, Johns Hopkins")).toBeDefined();
      expect(screen.getByTestId("questionnaire-step1-autofill-badge")).toBeDefined();
    });
  });

  describe("9. UI Integration: CreateClientModal Component", () => {
    it("renders the auto-fill dropzone and handles drag-and-drop file upload", async () => {
      render(
        <CreateClientModal
          isOpen={true}
          onClose={() => {}}
          onClientCreated={() => {}}
        />
      );

      // Verify dropzone is present
      const dropzone = screen.getByTestId("client-autofill-dropzone");
      expect(dropzone).toBeDefined();
      expect(screen.getByText(/Drop Passport \/ Resume \/ Packet to Auto-Fill Client/i)).toBeDefined();

      const fileContent = `
        PASSPORT
        Type: P Country Code: IND Passport No: M1234567
        Surname: DESHMUKH
        Given Names: ANANYA
        Date of Birth: 1996-07-21
        Place of Birth: Pune, India
      `;
      const file = new File([fileContent], "Ananya_Passport.pdf", { type: "application/pdf" });

      const fileInput = screen.getByTestId("client-autofill-file-input");
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByTestId("autofill-success-banner")).toBeDefined();
        expect(screen.getByDisplayValue("DESHMUKH")).toBeDefined();
      });
    });
  });

  describe("10. UI Integration: ConfigurableFormViewer Component", () => {
    it("renders canonical form with Hydrate from Evidence button and verified OCR badges", () => {
      const mockSubmission = hydrateCanonicalForm("USCIS_I140", null, null, []);

      render(
        <ConfigurableFormViewer
          submission={mockSubmission}
          schema={CANONICAL_FORM_SCHEMAS["USCIS_I140"]}
          userRole="case_manager"
        />
      );

      expect(screen.getByText("USCIS_I140")).toBeDefined();
      expect(screen.getByTestId("hydrate-canonical-form-btn")).toBeDefined();
    });
  });
});
