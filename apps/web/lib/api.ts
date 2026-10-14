import {
  ImmigrationCase,
  ClientProfile,
  AuditEvent,
  NotificationItem,
  UserContext,
  DocumentItem,
  DocumentCategory,
  DocumentExtractedField,
  DocumentVersionItem,
  DocumentProcessingRunItem,
  CaseTask,
  AIFinding,
  MessageItem,
  InvoiceItem,
  TeamMemberCapacity,
  RoleCode,
  CaseMilestone,
  CaseNote,
  ClientDependant,
  ClientConsent,
  DuplicateCandidate,
  CaseStage,
  ChecklistAuditReport,
  ChecklistAuditItem,
  EvidenceBackedSummary,
  OfficialSource,
  SourceSnapshot,
  SnapshotCompareResult,
  RuleSet,
  RuleSetVersion,
  RuleRequirement,
  CaseRequirementEvaluation,
  AffectedCasesImpactResult,
  DocumentRequestItem,
  DocumentRequestCommentItem,
  MessageThreadItem,
  ThreadMessageItem,
  WaitingStateData,
  ClientProfileData,
  ClientQuestionnaireItem,
  FormSchemaItem,
  FormSubmissionItem,
  PackageReadinessChecklist,
  FilingPackageItem,
  PackageManifestItem,
  PackageApprovalStage,
  ServiceCatalogItem,
  ClientEngagementItem,
  InvoiceDetailItem,
  InvoiceLineItemDetail,
  PaymentRecordItem,
  AccountsReceivableAging,
  FinancialReportsData,
  StaffWorkloadItem,
  ExecutiveDashboardData,
  OperationsAnalyticsData,
  OrganizationSettingsData,
} from "./types";

const API_BASE_URL = typeof window !== "undefined" ? "/api/backend" : "http://localhost:8000/api/v1";

// Default simulation IDs for development
export const DEMO_ORG_ID = "11111111-1111-1111-1111-111111111111";
export const DEMO_USERS = {
  master_admin: {
    id: "22222222-2222-2222-2222-222222222222",
    email: "elena.vance@leximmigration.com",
    name: "Elena Vance (Managing Partner)",
    role: "master_admin" as RoleCode,
  },
  case_manager: {
    id: "33333333-3333-3333-3333-333333333333",
    email: "sarah.jenkins@leximmigration.com",
    name: "Sarah Jenkins, Esq. (Senior Reviewer)",
    role: "case_manager" as RoleCode,
  },
  client_applicant: {
    id: "44444444-4444-4444-4444-444444444444",
    email: "elena.rostova@stanford.edu",
    name: "Dr. Elena Rostova (Applicant)",
    role: "retained_client" as RoleCode,
  },
};

// Realistic development fixtures for full offline / decoupled presentation
export const FIXTURE_CASES: ImmigrationCase[] = [
  {
    id: "case-01",
    case_number: "CASE-US-8841",
    title: "EB-1A Alien of Extraordinary Ability: Dr. Elena Rostova",
    client_id: "client-01",
    client_name: "Dr. Elena Rostova",
    jurisdiction: "United States (USCIS)",
    visa_category: "EB-1A Extraordinary Ability",
    status: "review",
    readiness_score: 82,
    assigned_manager: "Sarah Jenkins, Esq.",
    deadline: "2026-11-15",
    priority_date: "2026-08-10",
    attention_required: true,
    attention_reason: "Major citation record update required before final petition brief indexing",
    organization_id: DEMO_ORG_ID,
    created_at: "2026-08-10T10:00:00Z",
  },
  {
    id: "case-02",
    case_number: "CASE-US-8842",
    title: "O-1A Extraordinary Ability in AI Systems: Marcus Thorne",
    client_id: "client-02",
    client_name: "Marcus Thorne",
    jurisdiction: "United States (USCIS)",
    visa_category: "O-1A Nonimmigrant",
    status: "assembly",
    readiness_score: 94,
    assigned_manager: "Sarah Jenkins, Esq.",
    deadline: "2026-10-30",
    priority_date: "2026-09-01",
    attention_required: false,
    organization_id: DEMO_ORG_ID,
    created_at: "2026-09-01T14:30:00Z",
  },
  {
    id: "case-03",
    case_number: "CASE-US-8843",
    title: "EB-2 National Interest Waiver: Amina Al-Mansoor",
    client_id: "client-03",
    client_name: "Amina Al-Mansoor",
    jurisdiction: "United States (USCIS)",
    visa_category: "EB-2 NIW",
    status: "gathering",
    readiness_score: 45,
    assigned_manager: "David Cho",
    deadline: "2026-12-01",
    priority_date: "2026-09-18",
    attention_required: false,
    organization_id: DEMO_ORG_ID,
    created_at: "2026-09-18T09:15:00Z",
  },
  {
    id: "case-04",
    case_number: "CASE-US-8844",
    title: "L-1A Executive Transfer: Kenji Sato (QuantumScale Inc.)",
    client_id: "client-04",
    client_name: "Kenji Sato",
    jurisdiction: "United States (USCIS)",
    visa_category: "L-1A Intracompany Transferee",
    status: "ready",
    readiness_score: 98,
    assigned_manager: "David Cho",
    deadline: "2026-10-25",
    priority_date: "2026-07-22",
    attention_required: false,
    organization_id: DEMO_ORG_ID,
    created_at: "2026-07-22T11:45:00Z",
  },
  {
    id: "case-05",
    case_number: "CASE-UK-3310",
    title: "UK Global Talent Visa (Digital Technology): Priya Nair",
    client_id: "client-05",
    client_name: "Priya Nair",
    jurisdiction: "United Kingdom (Home Office)",
    visa_category: "Global Talent Tech Nation",
    status: "intake",
    readiness_score: 28,
    assigned_manager: "Sarah Jenkins, Esq.",
    deadline: "2026-11-20",
    priority_date: "2026-10-02",
    attention_required: true,
    attention_reason: "Missing letters of recommendation from recognized enterprise founders",
    organization_id: DEMO_ORG_ID,
    created_at: "2026-10-02T16:20:00Z",
  },
  {
    id: "case-06",
    case_number: "CASE-CA-1904",
    title: "Canada Express Entry Provincial Nominee: Carlos Gomez",
    client_id: "client-06",
    client_name: "Carlos Gomez",
    jurisdiction: "Canada (IRCC)",
    visa_category: "Express Entry PNP",
    status: "filed",
    readiness_score: 100,
    assigned_manager: "David Cho",
    deadline: "2027-01-15",
    priority_date: "2026-05-14",
    attention_required: false,
    organization_id: DEMO_ORG_ID,
    created_at: "2026-05-14T08:00:00Z",
  },
];

export const FIXTURE_CLIENTS: ClientProfile[] = [
  {
    id: "client-01",
    first_name: "Elena",
    last_name: "Rostova",
    email: "elena.rostova@stanford.edu",
    phone: "+1 (650) 498-0021",
    nationality: "Ukraine",
    date_of_birth: "1988-04-12",
    organization_id: DEMO_ORG_ID,
    created_at: "2026-08-10T10:00:00Z",
  },
  {
    id: "client-02",
    first_name: "Marcus",
    last_name: "Thorne",
    email: "marcus@thorne-ai.co.uk",
    phone: "+44 20 7946 0912",
    nationality: "United Kingdom",
    date_of_birth: "1991-09-23",
    organization_id: DEMO_ORG_ID,
    created_at: "2026-09-01T14:30:00Z",
  },
  {
    id: "client-03",
    first_name: "Amina",
    last_name: "Al-Mansoor",
    email: "amina.mansoor@biotech.ae",
    phone: "+971 4 312 9900",
    nationality: "United Arab Emirates",
    date_of_birth: "1985-11-30",
    organization_id: DEMO_ORG_ID,
    created_at: "2026-09-18T09:15:00Z",
  },
  {
    id: "client-04",
    first_name: "Kenji",
    last_name: "Sato",
    email: "k.sato@quantumscale.jp",
    phone: "+81 3 5555 0143",
    nationality: "Japan",
    date_of_birth: "1979-02-14",
    organization_id: DEMO_ORG_ID,
    created_at: "2026-07-22T11:45:00Z",
  },
  {
    id: "client-05",
    first_name: "Priya",
    last_name: "Nair",
    email: "priya.nair@techscale.in",
    phone: "+91 80 2345 6789",
    nationality: "India",
    date_of_birth: "1994-06-05",
    organization_id: DEMO_ORG_ID,
    created_at: "2026-10-02T16:20:00Z",
  },
];

export const FIXTURE_DOCUMENTS: DocumentItem[] = [
  {
    id: "doc-01",
    case_id: "case-01",
    case_number: "CASE-US-8841",
    title: "US_Passport_Biodata_Elena_Rostova.pdf",
    filename: "US_Passport_Biodata_Elena_Rostova.pdf",
    category: "identity_passport",
    file_size: "2.4 MB",
    byte_size: 2516582,
    mime_type: "application/pdf",
    version: 1,
    is_current_version: true,
    uploaded_by: "Dr. Elena Rostova",
    status: "verified",
    processing_status: "completed",
    verification_status: "verified",
    sha256_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    uploaded_at: "2026-08-12T11:00:00Z",
    tamper_verified: true,
    detected_language: "en",
    page_count: 1,
    ocr_applied: false,
    extracted_text: "PASSPORT / PASSEPORT\nUNITED STATES OF AMERICA\nType: P Code: USA Passport No: C09812491\nSurname: ROSTOVA\nGiven Names: ELENA\nNationality: USA\nDate of Birth: 12 APR 1988\nSex: F\nP<USAROSTOVA<<ELENA<<<<<<<<<<<<<<<<<<<<<<<<<\nC098124914USA8804128F3105094<<<<<<<<<<<<<<06",
    extracted_fields: [
      {
        id: "field-01",
        field_name: "passport_number",
        field_label: "Passport Number",
        original_value: "C09812491",
        normalized_value: "C09812491",
        source_page: 1,
        source_location: { x0: 72, y0: 120, x1: 280, y1: 144, block_idx: 2 },
        extraction_method: "pymupdf_mrz_parser",
        model_version: "rule_mrz_v2.1",
        ocr_confidence: 0.99,
        extraction_confidence: 0.99,
        validation_status: "verified",
        is_manually_corrected: false,
      },
      {
        id: "field-02",
        field_name: "full_name",
        field_label: "Full Name",
        original_value: "ROSTOVA, ELENA",
        normalized_value: "Elena Rostova",
        source_page: 1,
        source_location: { x0: 72, y0: 144, x1: 320, y1: 168, block_idx: 3 },
        extraction_method: "pymupdf_regex_parser",
        model_version: "rule_identity_v1.4",
        ocr_confidence: 0.98,
        extraction_confidence: 0.97,
        validation_status: "verified",
        is_manually_corrected: false,
      },
      {
        id: "field-03",
        field_name: "date_of_birth",
        field_label: "Date of Birth",
        original_value: "12 APR 1988",
        normalized_value: "1988-04-12",
        source_page: 1,
        source_location: { x0: 72, y0: 192, x1: 240, y1: 216, block_idx: 5 },
        extraction_method: "pymupdf_mrz_parser",
        model_version: "rule_mrz_v2.1",
        ocr_confidence: 0.99,
        extraction_confidence: 0.99,
        validation_status: "verified",
        is_manually_corrected: false,
      },
      {
        id: "field-04",
        field_name: "nationality",
        field_label: "Nationality",
        original_value: "UNITED STATES OF AMERICA",
        normalized_value: "USA",
        source_page: 1,
        source_location: { x0: 72, y0: 168, x1: 340, y1: 192, block_idx: 4 },
        extraction_method: "pymupdf_regex_parser",
        model_version: "rule_iso3166_v1",
        ocr_confidence: 0.99,
        extraction_confidence: 0.99,
        validation_status: "verified",
        is_manually_corrected: false,
      },
    ],
    verified_at: "2026-08-12T14:30:00Z",
    verified_by_user_id: "33333333-3333-3333-3333-333333333333",
    verification_notes: "Physical passport inspected against state biometric registry match.",
    malware_scan_status: "clean",
    download_url: "/api/v1/documents/doc-01/download?token=demo_token",
  },
  {
    id: "doc-02",
    case_id: "case-01",
    case_number: "CASE-US-8841",
    title: "Stanford_PhD_Diploma_Certificate.pdf",
    filename: "Stanford_PhD_Diploma_Certificate.pdf",
    category: "educational_records",
    file_size: "4.1 MB",
    byte_size: 4300192,
    mime_type: "application/pdf",
    version: 1,
    is_current_version: true,
    uploaded_by: "Dr. Elena Rostova",
    status: "under_review",
    processing_status: "completed",
    verification_status: "unverified",
    sha256_hash: "7d1a54127b222502f5b79b5fb0803061152a44f92b37e23c65dd0f32937ec844",
    uploaded_at: "2026-08-14T09:20:00Z",
    tamper_verified: true,
    detected_language: "en",
    page_count: 1,
    ocr_applied: false,
    extracted_text: "STANFORD UNIVERSITY\nTHE TRUSTEES OF THE UNIVERSITY CONFER UPON\nELENA ROSTOVA\nTHE DEGREE OF DOCTOR OF PHILOSOPHY\nIN COMPUTER SCIENCE AND ARTIFICIAL INTELLIGENCE\nCUMULATIVE GPA: 3.96 / 4.00\nCONFERRED ON: 15 JUNE 2018",
    extracted_fields: [
      {
        id: "field-05",
        field_name: "degree_title",
        field_label: "Conferred Degree Title",
        original_value: "DOCTOR OF PHILOSOPHY",
        normalized_value: "Doctor Of Philosophy",
        source_page: 1,
        source_location: { x0: 72, y0: 144, x1: 420, y1: 168, block_idx: 3 },
        extraction_method: "pymupdf_regex_parser",
        model_version: "rule_edu_v1.0",
        ocr_confidence: 0.98,
        extraction_confidence: 0.95,
        validation_status: "unvalidated",
        is_manually_corrected: false,
      },
      {
        id: "field-06",
        field_name: "institution_name",
        field_label: "Academic Institution",
        original_value: "STANFORD UNIVERSITY",
        normalized_value: "Stanford University",
        source_page: 1,
        source_location: { x0: 72, y0: 72, x1: 300, y1: 96, block_idx: 0 },
        extraction_method: "pymupdf_regex_parser",
        model_version: "rule_edu_v1.0",
        ocr_confidence: 0.99,
        extraction_confidence: 0.96,
        validation_status: "unvalidated",
        is_manually_corrected: false,
      },
      {
        id: "field-07",
        field_name: "gpa",
        field_label: "Grade Point Average (GPA)",
        original_value: "3.96 / 4.00",
        normalized_value: "3.96 / 4.00",
        source_page: 1,
        source_location: { x0: 72, y0: 216, x1: 250, y1: 240, block_idx: 5 },
        extraction_method: "pymupdf_regex_parser",
        model_version: "rule_edu_v1.0",
        ocr_confidence: 0.97,
        extraction_confidence: 0.95,
        validation_status: "unvalidated",
        is_manually_corrected: false,
      },
      {
        id: "field-08",
        field_name: "graduation_date",
        field_label: "Graduation Date",
        original_value: "15 JUNE 2018",
        normalized_value: "2018-06-15",
        source_page: 1,
        source_location: { x0: 72, y0: 240, x1: 280, y1: 264, block_idx: 6 },
        extraction_method: "pymupdf_regex_parser",
        model_version: "rule_date_v2.0",
        ocr_confidence: 0.97,
        extraction_confidence: 0.92,
        validation_status: "unvalidated",
        is_manually_corrected: false,
      },
    ],
    malware_scan_status: "clean",
  },
  {
    id: "doc-03",
    case_id: "case-01",
    case_number: "CASE-US-8841",
    title: "Employment_Verification_NeuralDynamics.pdf",
    filename: "Employment_Verification_NeuralDynamics.pdf",
    category: "employment_records",
    file_size: "1.8 MB",
    byte_size: 1887436,
    mime_type: "application/pdf",
    version: 2,
    is_current_version: true,
    uploaded_by: "Sarah Jenkins, Esq.",
    status: "under_review",
    processing_status: "completed",
    verification_status: "under_review",
    sha256_hash: "bf5b8f2bf13597d6da3fe4c2b95b45f1b1c35b8f7236d81e05a8bf12185be168",
    uploaded_at: "2026-09-02T14:15:00Z",
    tamper_verified: true,
    detected_language: "en",
    page_count: 1,
    ocr_applied: false,
    extracted_text: "NEURALDYNAMICS AI TECHNOLOGIES INC.\nEMPLOYMENT VERIFICATION LETTER\nJob Title: Senior AI Principal Research Scientist\nEmployment Start Date: 01 September 2018\nAnnual Salary: $245,000.00 USD per year\nHours: 40 hours per week",
    extracted_fields: [
      {
        id: "field-09",
        field_name: "job_title",
        field_label: "Job Title",
        original_value: "Senior AI Principal Research Scientist",
        normalized_value: "Senior Ai Principal Research Scientist",
        source_page: 1,
        source_location: { x0: 72, y0: 120, x1: 450, y1: 144, block_idx: 2 },
        extraction_method: "pymupdf_regex_parser",
        model_version: "rule_emp_v1.0",
        ocr_confidence: 0.98,
        extraction_confidence: 0.96,
        validation_status: "verified",
        is_manually_corrected: false,
      },
      {
        id: "field-10",
        field_name: "annual_salary",
        field_label: "Annual Compensation",
        original_value: "$245,000.00 USD",
        normalized_value: "245000.00 USD",
        source_page: 1,
        source_location: { x0: 72, y0: 168, x1: 350, y1: 192, block_idx: 4 },
        extraction_method: "pymupdf_regex_parser",
        model_version: "rule_emp_v1.0",
        ocr_confidence: 0.97,
        extraction_confidence: 0.95,
        validation_status: "verified",
        is_manually_corrected: false,
      },
      {
        id: "field-11",
        field_name: "employment_start_date",
        field_label: "Employment Start Date",
        original_value: "01 September 2018",
        normalized_value: "2018-09-01",
        source_page: 1,
        source_location: { x0: 72, y0: 144, x1: 360, y1: 168, block_idx: 3 },
        extraction_method: "pymupdf_regex_parser",
        model_version: "rule_date_v2.0",
        ocr_confidence: 0.98,
        extraction_confidence: 0.95,
        validation_status: "corrected",
        is_manually_corrected: true,
        corrected_value: "2018-09-01",
        corrected_at: "2026-09-03T10:00:00Z",
        correction_reason: "Standardized to ISO-8601 date format for petition index.",
        correction_history: [
          {
            old_value: "01 September 2018",
            new_value: "2018-09-01",
            reason: "Standardized to ISO-8601 date format for petition index.",
            corrected_by: "Sarah Jenkins, Esq.",
            corrected_at: "2026-09-03T10:00:00Z",
          },
        ],
      },
    ],
    malware_scan_status: "clean",
  },
  {
    id: "doc-04",
    case_id: "case-01",
    case_number: "CASE-US-8841",
    title: "Chase_Private_Client_Bank_Statement.pdf",
    filename: "Chase_Private_Client_Bank_Statement.pdf",
    category: "financial_evidence",
    file_size: "1.2 MB",
    byte_size: 1258291,
    mime_type: "application/pdf",
    version: 1,
    is_current_version: true,
    uploaded_by: "Dr. Elena Rostova",
    status: "under_review",
    processing_status: "completed",
    verification_status: "unverified",
    sha256_hash: "3295c76ac127da6ced4e0f9b6e82f70ac6f8b1c8f237d65b71948332159f8164",
    uploaded_at: "2026-09-28T16:40:00Z",
    tamper_verified: true,
    detected_language: "en",
    page_count: 1,
    ocr_applied: false,
    extracted_text: "JPMORGAN CHASE BANK, N.A.\nPRIVATE CLIENT ACCOUNT STATEMENT\nAccount ending in: ...4921\nStatement Date: 30 September 2026\nClosing Balance: $148,250.75 USD",
    extracted_fields: [
      {
        id: "field-12",
        field_name: "financial_institution",
        field_label: "Financial Institution",
        original_value: "JPMORGAN CHASE BANK",
        normalized_value: "Jpmorgan Chase Bank",
        source_page: 1,
        source_location: { x0: 72, y0: 72, x1: 340, y1: 96, block_idx: 0 },
        extraction_method: "pymupdf_regex_parser",
        model_version: "rule_fin_v1.0",
        ocr_confidence: 0.98,
        extraction_confidence: 0.94,
        validation_status: "unvalidated",
        is_manually_corrected: false,
      },
      {
        id: "field-13",
        field_name: "closing_balance",
        field_label: "Closing Balance",
        original_value: "$148,250.75 USD",
        normalized_value: "148250.75 USD",
        source_page: 1,
        source_location: { x0: 72, y0: 168, x1: 340, y1: 192, block_idx: 4 },
        extraction_method: "pymupdf_regex_parser",
        model_version: "rule_fin_v1.0",
        ocr_confidence: 0.99,
        extraction_confidence: 0.96,
        validation_status: "unvalidated",
        is_manually_corrected: false,
      },
    ],
    malware_scan_status: "clean",
  },
  {
    id: "doc-05",
    case_id: "case-01",
    case_number: "CASE-US-8841",
    title: "USCIS_I797_O1A_Approval_Notice.pdf",
    filename: "USCIS_I797_O1A_Approval_Notice.pdf",
    category: "visas_residence_permits",
    file_size: "1.1 MB",
    byte_size: 1153433,
    mime_type: "application/pdf",
    version: 1,
    is_current_version: true,
    uploaded_by: "Sarah Jenkins, Esq.",
    status: "verified",
    processing_status: "completed",
    verification_status: "verified",
    sha256_hash: "a4920b72f102c91834190c102a901f1847120481029481928374910284719203",
    uploaded_at: "2026-10-01T12:00:00Z",
    tamper_verified: true,
    detected_language: "en",
    page_count: 1,
    ocr_applied: false,
    extracted_text: "UNITED STATES CITIZENSHIP AND IMMIGRATION SERVICES\nRECEIPT NUMBER: WAC2190084122\nNOTICE TYPE: APPROVAL NOTICE\nCLASS: O-1A\nVALID FROM 10/01/2023 TO 09/30/2026",
    extracted_fields: [
      {
        id: "field-14",
        field_name: "receipt_number",
        field_label: "USCIS Receipt Number",
        original_value: "WAC2190084122",
        normalized_value: "WAC2190084122",
        source_page: 1,
        source_location: { x0: 72, y0: 96, x1: 300, y1: 120, block_idx: 1 },
        extraction_method: "pymupdf_regex_parser",
        model_version: "rule_uscis_v1.0",
        ocr_confidence: 0.99,
        extraction_confidence: 0.99,
        validation_status: "verified",
        is_manually_corrected: false,
      },
      {
        id: "field-15",
        field_name: "visa_class",
        field_label: "Visa Classification",
        original_value: "O-1A",
        normalized_value: "O-1A",
        source_page: 1,
        source_location: { x0: 72, y0: 144, x1: 220, y1: 168, block_idx: 3 },
        extraction_method: "pymupdf_regex_parser",
        model_version: "rule_uscis_v1.0",
        ocr_confidence: 0.98,
        extraction_confidence: 0.98,
        validation_status: "verified",
        is_manually_corrected: false,
      },
    ],
    verified_at: "2026-10-01T14:00:00Z",
    verified_by_user_id: "33333333-3333-3333-3333-333333333333",
    verification_notes: "Direct match against USCIS online case status verification system.",
    malware_scan_status: "clean",
  },
  {
    id: "doc-06",
    case_id: "case-01",
    case_number: "CASE-US-8841",
    title: "State_Police_Clearance_Certificate.pdf",
    filename: "State_Police_Clearance_Certificate.pdf",
    category: "police_medical",
    file_size: "3.2 MB",
    byte_size: 3355443,
    mime_type: "application/pdf",
    version: 1,
    is_current_version: true,
    uploaded_by: "Dr. Elena Rostova",
    status: "under_review",
    processing_status: "processing",
    verification_status: "unverified",
    sha256_hash: "cc31802931a01294812401824091280918230912830192830129830129381029",
    uploaded_at: "2026-10-10T15:30:00Z",
    tamper_verified: true,
    malware_scan_status: "clean",
  },
  {
    id: "doc-07",
    case_id: "case-01",
    case_number: "CASE-US-8841",
    title: "Certified_Apostille_Birth_Record.pdf",
    filename: "Certified_Apostille_Birth_Record.pdf",
    category: "civil_status",
    file_size: "950 KB",
    byte_size: 972800,
    mime_type: "application/pdf",
    version: 1,
    is_current_version: true,
    uploaded_by: "Dr. Elena Rostova",
    status: "action_needed",
    processing_status: "failed",
    verification_status: "unverified",
    processing_error: "Low scan resolution (detected 72 DPI, minimum 150 DPI required for legal transcription). Please re-upload 300 DPI flatbed scan.",
    sha256_hash: "45f0912830192830192830192830192830192830192830192830192830192830",
    uploaded_at: "2026-10-11T09:10:00Z",
    tamper_verified: true,
    malware_scan_status: "clean",
  },
];

export const FIXTURE_AUDIT_EVENTS: AuditEvent[] = [
  {
    id: "audit-01",
    action: "document.immutable_stored",
    object_type: "document",
    object_id: "DOC-04",
    actor_email: "elena.rostova@stanford.edu",
    created_at: "2026-10-11T13:42:00Z",
    metadata: {
      file: "First_Author_Nature_Biotech_Publications.pdf",
      sha256: "3295c76ac...8164",
      storage_mode: "private_immutable",
    },
  },
  {
    id: "audit-02",
    action: "case.stage_transition",
    object_type: "case",
    object_id: "CASE-US-8841",
    actor_email: "sarah.jenkins@leximmigration.com",
    created_at: "2026-10-10T17:15:00Z",
    metadata: {
      from_stage: "gathering",
      to_stage: "review",
      readiness: "82%",
    },
  },
  {
    id: "audit-03",
    action: "rbac.tenant_isolated_query",
    object_type: "organization",
    object_id: DEMO_ORG_ID,
    actor_email: "elena.vance@leximmigration.com",
    created_at: "2026-10-10T09:00:00Z",
    metadata: {
      target_branches: ["NYC", "LDN"],
      cross_tenant_denied: 0,
    },
  },
  {
    id: "audit-04",
    action: "security.session_created",
    object_type: "session",
    object_id: "sess-88124",
    actor_email: "sarah.jenkins@leximmigration.com",
    created_at: "2026-10-09T08:30:00Z",
    metadata: {
      ip_address: "192.168.1.104",
      user_agent: "Chrome 128 / macOS",
      mfa_verified: true,
    },
  },
];

export const FIXTURE_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "notif-01",
    title: "Document Verification Completed",
    body: "PhD Degree Certificate for Dr. Elena Rostova was cryptographically verified and matched against US equivalency criteria.",
    status: "unread",
    created_at: "2026-10-11T14:10:00Z",
  },
  {
    id: "notif-02",
    title: "Critical Filing Deadline Alert",
    body: "CASE-US-8844 (Kenji Sato L-1A) status clock has 14 days remaining before standard processing window closes.",
    status: "unread",
    created_at: "2026-10-10T11:00:00Z",
  },
  {
    id: "notif-03",
    title: "Retainer Payment Received",
    body: "Invoice #INV-2026-089 for Priya Nair ($4,500.00) successfully cleared trust escrow deposit.",
    status: "read",
    created_at: "2026-10-08T16:45:00Z",
  },
];

export const FIXTURE_TASKS: CaseTask[] = [
  {
    id: "task-01",
    case_id: "case-01",
    case_number: "CASE-US-8841",
    title: "Review expert letter draft from Dr. Venkatesh (MIT)",
    due_date: "2026-10-18",
    priority: "critical",
    is_completed: false,
    assigned_to: "Sarah Jenkins, Esq.",
  },
  {
    id: "task-02",
    case_id: "case-01",
    case_number: "CASE-US-8841",
    title: "Confirm Google Scholar citation count (currently 842 citations)",
    due_date: "2026-10-22",
    priority: "high",
    is_completed: true,
    assigned_to: "Sarah Jenkins, Esq.",
  },
  {
    id: "task-03",
    case_id: "case-02",
    case_number: "CASE-US-8842",
    title: "Assemble final Exhibit Tab list for O-1A filing binder",
    due_date: "2026-10-24",
    priority: "high",
    is_completed: false,
    assigned_to: "Sarah Jenkins, Esq.",
  },
  {
    id: "task-04",
    case_id: "case-04",
    case_number: "CASE-US-8844",
    title: "Obtain certified foreign entity payroll records for past 3 years",
    due_date: "2026-10-20",
    priority: "medium",
    is_completed: false,
    assigned_to: "David Cho",
  },
];

export const FIXTURE_AI_FINDINGS: AIFinding[] = [
  {
    id: "finding-01",
    case_id: "case-01",
    finding_type: "consistency_discrepancy",
    category: "consistency",
    severity: "minor",
    status: "needs_review",
    title: "Cyrillic Transliteration Name Variation",
    description: "Passport biodata extracts 'ROSTOVA, YELENA' while profile intake records 'Elena Rostova'. Standard East Slavic transliteration pattern detected.",
    evidence_text: "Ukrainian Passport Machine Readable Zone: P<UKRROSTOVA<<YELENA vs Intake Form Full Name: Elena Rostova",
    source_location: { document_id: "doc-01", document_title: "US_Passport_Biodata_Elena_Rostova.pdf", page: 1 },
    related_documents: [{ document_id: "doc-01", title: "Passport Biodata", category: "identity_passport", page: 1 }],
    related_fields: [
      { field_name: "full_name", field_label: "Intake Full Name", original_value: "Elena Rostova", normalized_value: "Elena Rostova" },
      { field_name: "passport_name", field_label: "Passport Surname/Given", original_value: "ROSTOVA, YELENA", normalized_value: "Yelena Rostova" },
    ],
    relevant_requirement: "8 CFR § 204.5(a) - Accurate Identification and Name Concordance",
    recommended_action: "Disclose 'Yelena Rostova' under Form I-140 Part 3 (Other Names Used) to avoid identity query.",
    clarification_question: "Does the applicant have foreign educational certificates or publications issued under 'Yelena' to list under aliases?",
    uncertainty_limitations: "Deterministically matched via Ukrainian BGN/PCGN transliteration table. No confirmed identity contradiction.",
    is_confirmed_contradiction: false,
    resolution_history: [],
    citation: "Matter of Chawathe, 25 I&N Dec. 369 (AAO 2010)",
  },
  {
    id: "finding-02",
    case_id: "case-01",
    finding_type: "document_quality",
    category: "evidence_gap",
    severity: "critical",
    status: "needs_review",
    title: "Missing Pages Detected in PhD Degree Scan",
    description: "Header on page 1 explicitly states 'Page 1 of 4', but uploaded document contains only 1 page. Coursework transcripts and registrar apostille appear missing.",
    evidence_text: "Header text extracted on page 1: 'STANFORD UNIVERSITY — OFFICIAL DOCTORAL CONFERRAL (Page 1 of 4)'",
    source_location: { document_id: "doc-02", document_title: "Stanford_PhD_Diploma_Certificate.pdf", page: 1 },
    related_documents: [{ document_id: "doc-02", title: "Stanford PhD Diploma", category: "educational_records", page: 1 }],
    relevant_requirement: "8 CFR § 204.5(k)(3) - Official academic record must be complete and unredacted",
    recommended_action: "Request client upload complete 4-page unredacted scan including registrar signature and coursework pages.",
    clarification_question: "Please upload the complete 4-page certified academic diploma including transcripts and registrar certification.",
    uncertainty_limitations: "Extracted from pagination pattern. Physical pages 2, 3, and 4 are absent from the file stream.",
    is_confirmed_contradiction: false,
    resolution_history: [],
    citation: "8 CFR § 204.5(k)(3)(i)(A)",
  },
  {
    id: "finding-03",
    case_id: "case-01",
    finding_type: "apparent_expiration",
    category: "evidence_gap",
    severity: "major",
    status: "needs_review",
    title: "Passport Nearing 6-Month Expiration Window",
    description: "Foreign passport validity expires within 6 months of target petition submission date (2026-11-20).",
    evidence_text: "Passport biodata validity field: EXP 20 NOV 2026",
    source_location: { document_id: "doc-01", document_title: "Foreign_Passport.pdf", page: 1 },
    related_documents: [{ document_id: "doc-01", title: "Passport Biodata", category: "identity_passport", page: 1 }],
    relevant_requirement: "INA § 212(a)(7)(B)(i)(I) - Passport validity requirement (6-month rule)",
    recommended_action: "Notify client to initiate passport renewal with consulate promptly to avoid travel or visa issuance delays.",
    clarification_question: "Has the applicant initiated consular passport renewal for expiration in November 2026?",
    uncertainty_limitations: "Direct date comparison against petition timeline. Expiration date is explicitly printed on document.",
    is_confirmed_contradiction: false,
    resolution_history: [],
    citation: "INA § 212(a)(7)(B)(i)(I)",
  },
  {
    id: "finding-04",
    case_id: "case-01",
    finding_type: "form_evidence_conflict",
    category: "contradiction",
    severity: "critical",
    status: "needs_review",
    title: "Employment Start Overlaps Full-Time Resident Degree",
    description: "Employment verification claims full-time 40 hr/week engineering employment commenced in Kyiv on 2012-06-01, but bachelor's diploma confirms in-person resident degree program in Kharkiv until 2013-05-30.",
    evidence_text: "NeuralDynamics verification: 40 hrs/wk from 2012-06-01 vs Kharkiv University enrollment certificate: full-time resident student through May 2013",
    source_location: { document_id: "doc-03", document_title: "Employment_Verification_NeuralDynamics.pdf", page: 1 },
    related_documents: [
      { document_id: "doc-03", title: "Employment Verification", category: "employment_records", page: 1 },
      { document_id: "doc-02", title: "Academic Record", category: "educational_records", page: 1 },
    ],
    related_fields: [
      { field_name: "employment_start", field_label: "Employment Start Date", original_value: "2012-06-01" },
      { field_name: "degree_conferral", field_label: "Degree Conferral Date", original_value: "2013-05-30" },
    ],
    relevant_requirement: "Matter of Ho, 19 I&N Dec. 582 - Petitioner must resolve inconsistencies in the record with independent objective evidence",
    recommended_action: "Obtain employer affidavit clarifying student intern or remote contractor status prior to degree completion.",
    clarification_question: "Was the 2012-2013 engagement conducted remotely or on a part-time student internship basis prior to graduation?",
    uncertainty_limitations: "Dates verified from source documents. Direct overlap between full-time employment and full-time resident coursework.",
    is_confirmed_contradiction: true,
    resolution_history: [],
    citation: "Matter of Ho, 19 I&N Dec. 582 (Comm. 1988)",
  },
  {
    id: "finding-05",
    case_id: "case-01",
    finding_type: "missing_evidence",
    category: "statutory_criteria",
    severity: "major",
    status: "needs_review",
    title: "EB-1A Statutory Checklist: Major Media Coverage Missing",
    description: "Statutory checklist for EB-1A Extraordinary Ability requires satisfaction of at least 3 regulatory criteria. Evidence under 8 CFR § 204.5(h)(3)(iii) (Published material about alien in major media) is currently missing from petition dossier.",
    relevant_requirement: "8 CFR § 204.5(h)(3)(iii) - Published material about the alien in professional or major trade publications or major media",
    recommended_action: "Request applicant provide clippings, media coverage articles, or recognized press features concerning their AI research.",
    clarification_question: "Can the applicant provide press articles or profiles in major trade publications (e.g. Wired, IEEE Spectrum, MIT Tech Review)?",
    uncertainty_limitations: "Evaluation based on uploaded documents. Applicant may have evidence not yet uploaded to the platform.",
    is_confirmed_contradiction: false,
    resolution_history: [],
    citation: "8 CFR § 204.5(h)(3)(iii)",
  },
];

let localFindings: AIFinding[] = [...FIXTURE_AI_FINDINGS];

export const FIXTURE_MESSAGES: MessageItem[] = [
  {
    id: "msg-01",
    sender: "Sarah Jenkins, Esq.",
    sender_role: "attorney",
    content: "Dr. Rostova, we have reviewed your updated publication list. The 3 Nature Biotechnology papers are exemplary. Please upload your IEEE Senior Membership confirmation when available.",
    timestamp: "Yesterday at 4:15 PM",
  },
  {
    id: "msg-02",
    sender: "Dr. Elena Rostova",
    sender_role: "client",
    content: "Thank you Sarah! I just requested the official membership certificate from IEEE headquarters. I expect to receive the PDF within 48 hours and will upload it immediately.",
    timestamp: "Yesterday at 5:30 PM",
  },
  {
    id: "msg-03",
    sender: "Sarah Jenkins, Esq.",
    sender_role: "attorney",
    content: "Excellent. Once that is uploaded, our package readiness score will reach 90% and we will begin drafting the Form I-140 formal petition letter.",
    timestamp: "Today at 9:15 AM",
  },
];

export const FIXTURE_INVOICES: InvoiceItem[] = [
  {
    id: "inv-01",
    invoice_number: "INV-2026-081",
    case_number: "CASE-US-8841",
    client_name: "Dr. Elena Rostova",
    amount: 5500.0,
    status: "paid",
    due_date: "2026-08-15",
  },
  {
    id: "inv-02",
    invoice_number: "INV-2026-082",
    case_number: "CASE-US-8841",
    client_name: "Dr. Elena Rostova",
    amount: 3500.0,
    status: "in_trust",
    due_date: "2026-11-01",
  },
  {
    id: "inv-03",
    invoice_number: "INV-2026-085",
    case_number: "CASE-US-8842",
    client_name: "Marcus Thorne",
    amount: 6000.0,
    status: "paid",
    due_date: "2026-09-10",
  },
  {
    id: "inv-04",
    invoice_number: "INV-2026-089",
    case_number: "CASE-UK-3310",
    client_name: "Priya Nair",
    amount: 4500.0,
    status: "outstanding",
    due_date: "2026-10-30",
  },
];

export const FIXTURE_CAPACITY: TeamMemberCapacity[] = [
  {
    id: "tm-01",
    name: "Sarah Jenkins, Esq.",
    role: "Senior Reviewer & Partner",
    active_cases: 18,
    max_capacity: 20,
    open_reviews: 4,
  },
  {
    id: "tm-02",
    name: "David Cho",
    role: "Immigration Case Manager",
    active_cases: 15,
    max_capacity: 20,
    open_reviews: 2,
  },
  {
    id: "tm-03",
    name: "Michael Chen",
    role: "Document Reviewer",
    active_cases: 22,
    max_capacity: 25,
    open_reviews: 7,
  },
  {
    id: "tm-04",
    name: "Rebecca Taylor",
    role: "Immigration Case Manager",
    active_cases: 12,
    max_capacity: 20,
    open_reviews: 1,
  },
];

// In-memory mutation state for local interactivity
let localCases = [...FIXTURE_CASES];
let localClients = [...FIXTURE_CLIENTS];
let localDocuments = [...FIXTURE_DOCUMENTS];
let localAuditEvents = [...FIXTURE_AUDIT_EVENTS];
let localNotifications = [...FIXTURE_NOTIFICATIONS];
let localTasks = [...FIXTURE_TASKS];
let localMessages = [...FIXTURE_MESSAGES];

export interface ApiResponse<T> {
  data: T;
  isLiveBackend: boolean;
  error?: string;
}

function getAuthHeaders(role: RoleCode): Record<string, string> {
  const user =
    role === "retained_client" || role === "applicant"
      ? DEMO_USERS.client_applicant
      : role === "master_admin" || role === "company_admin" || role === "organization_admin"
      ? DEMO_USERS.master_admin
      : DEMO_USERS.case_manager;

  return {
    "X-Organization-Id": DEMO_ORG_ID,
    "X-User-Id": user.id,
    "X-User-Role": role,
    "Content-Type": "application/json",
  };
}

export const api = {
  // Check if live backend is running
  async checkBackendHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/health`, { method: "GET", cache: "no-store" });
      return res.ok;
    } catch {
      return false;
    }
  },

  // Cases
  async getCases(role: RoleCode = "master_admin"): Promise<ApiResponse<ImmigrationCase[]>> {
    try {
      const res = await fetch(`${API_BASE_URL}/cases`, {
        headers: getAuthHeaders(role),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Graceful fallback to fixture
    }

    // Role-filter fixtures according to boundary rules
    if (role === "retained_client" || role === "applicant") {
      const filtered = localCases.filter((c) => c.client_name.includes("Rostova") || c.case_number === "CASE-US-8841");
      return { data: filtered, isLiveBackend: false };
    }
    return { data: localCases, isLiveBackend: false };
  },

  async createCase(
    payload: {
      client_id: string;
      title: string;
      case_number: string;
      jurisdiction: string;
      visa_category: string;
    },
    role: RoleCode = "master_admin"
  ): Promise<ApiResponse<ImmigrationCase>> {
    try {
      const res = await fetch(`${API_BASE_URL}/cases`, {
        method: "POST",
        headers: getAuthHeaders(role),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    const client = localClients.find((c) => c.id === payload.client_id);
    const newCase: ImmigrationCase = {
      id: `case-${Date.now()}`,
      case_number: payload.case_number,
      title: payload.title,
      client_id: payload.client_id,
      client_name: client ? `${client.first_name} ${client.last_name}` : "Retained Client",
      jurisdiction: payload.jurisdiction,
      visa_category: payload.visa_category,
      status: "intake",
      readiness_score: 10,
      assigned_manager: "Sarah Jenkins, Esq.",
      deadline: "2026-12-31",
      priority_date: new Date().toISOString().split("T")[0],
      organization_id: DEMO_ORG_ID,
      created_at: new Date().toISOString(),
    };
    localCases = [newCase, ...localCases];

    // Record audit event
    localAuditEvents = [
      {
        id: `audit-${Date.now()}`,
        action: "case.created",
        object_type: "case",
        object_id: newCase.case_number,
        actor_email: DEMO_USERS[role === "master_admin" ? "master_admin" : "case_manager"].email,
        created_at: new Date().toISOString(),
        metadata: { title: newCase.title, jurisdiction: newCase.jurisdiction },
      },
      ...localAuditEvents,
    ];

    return { data: newCase, isLiveBackend: false };
  },

  // Clients
  async getClients(role: RoleCode = "master_admin"): Promise<ApiResponse<ClientProfile[]>> {
    try {
      const res = await fetch(`${API_BASE_URL}/clients`, {
        headers: getAuthHeaders(role),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }
    return { data: localClients, isLiveBackend: false };
  },

  async createClient(
    payload: {
      first_name: string;
      last_name: string;
      email: string;
      phone?: string;
      nationality: string;
    },
    role: RoleCode = "master_admin"
  ): Promise<ApiResponse<ClientProfile>> {
    try {
      const res = await fetch(`${API_BASE_URL}/clients`, {
        method: "POST",
        headers: getAuthHeaders(role),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    const newClient: ClientProfile = {
      id: `client-${Date.now()}`,
      first_name: payload.first_name,
      last_name: payload.last_name,
      email: payload.email,
      phone: payload.phone,
      nationality: payload.nationality,
      organization_id: DEMO_ORG_ID,
      created_at: new Date().toISOString(),
    };
    localClients = [newClient, ...localClients];
    return { data: newClient, isLiveBackend: false };
  },

  // Audit Events
  async getAuditEvents(role: RoleCode = "master_admin"): Promise<ApiResponse<AuditEvent[]>> {
    try {
      const res = await fetch(`${API_BASE_URL}/foundation/audit-events`, {
        headers: getAuthHeaders(role),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }
    return { data: localAuditEvents, isLiveBackend: false };
  },

  // Notifications
  async getNotifications(role: RoleCode = "master_admin"): Promise<ApiResponse<NotificationItem[]>> {
    try {
      const res = await fetch(`${API_BASE_URL}/notifications`, {
        headers: getAuthHeaders(role),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }
    return { data: localNotifications, isLiveBackend: false };
  },

  async markNotificationRead(id: string, role: RoleCode = "master_admin"): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
        method: "POST",
        headers: getAuthHeaders(role),
      });
    } catch {
      // Fallback
    }
    localNotifications = localNotifications.map((n) => (n.id === id ? { ...n, status: "read" } : n));
  },

  // Documents
  async getDocuments(
    filter?: {
      caseId?: string;
      clientId?: string;
      category?: string;
      processingStatus?: string;
      verificationStatus?: string;
      search?: string;
    },
    role: RoleCode = "master_admin"
  ): Promise<ApiResponse<DocumentItem[]>> {
    try {
      const params = new URLSearchParams();
      if (filter?.caseId) params.append("case_id", filter.caseId);
      if (filter?.clientId) params.append("client_id", filter.clientId);
      if (filter?.category && filter.category !== "all") params.append("category", filter.category);
      if (filter?.processingStatus && filter.processingStatus !== "all") params.append("processing_status", filter.processingStatus);
      if (filter?.verificationStatus && filter.verificationStatus !== "all") params.append("verification_status", filter.verificationStatus);
      if (filter?.search) params.append("search", filter.search);

      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`${API_BASE_URL}/documents${qs}`, {
        headers: getAuthHeaders(role),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    let docs = [...localDocuments];
    if (filter?.caseId) {
      docs = docs.filter((d) => d.case_id === filter.caseId || d.case_number === filter.caseId);
    }
    if (filter?.category && filter.category !== "all") {
      docs = docs.filter((d) => d.category === filter.category);
    }
    if (filter?.processingStatus && filter.processingStatus !== "all") {
      docs = docs.filter((d) => (d.processing_status || "completed") === filter.processingStatus);
    }
    if (filter?.verificationStatus && filter.verificationStatus !== "all") {
      docs = docs.filter((d) => (d.verification_status || (d.status === "verified" ? "verified" : "unverified")) === filter.verificationStatus);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      docs = docs.filter((d) => d.title.toLowerCase().includes(q) || (d.category || "").toLowerCase().includes(q));
    }
    return { data: docs, isLiveBackend: false };
  },

  async getDocument(id: string, role: RoleCode = "master_admin"): Promise<ApiResponse<DocumentItem | null>> {
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${id}`, {
        headers: getAuthHeaders(role),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    const doc = localDocuments.find((d) => d.id === id) || null;
    return { data: doc, isLiveBackend: false };
  },

  async uploadDocument(
    doc: {
      title: string;
      category: string;
      file_size: string;
      uploaded_by: string;
      sha256_hash: string;
      case_id?: string;
    },
    role: RoleCode = "retained_client"
  ): Promise<ApiResponse<DocumentItem>> {
    const newDoc: DocumentItem = {
      id: `doc-${Date.now()}`,
      case_id: doc.case_id || "case-01",
      case_number: "CASE-US-8841",
      title: doc.title,
      filename: doc.title,
      category: doc.category,
      file_size: doc.file_size,
      byte_size: 1048576,
      mime_type: "application/pdf",
      version: 1,
      is_current_version: true,
      uploaded_by: doc.uploaded_by,
      status: "under_review",
      processing_status: "completed",
      verification_status: "unverified",
      sha256_hash: doc.sha256_hash,
      uploaded_at: new Date().toISOString(),
      tamper_verified: true,
      detected_language: "en",
      page_count: 1,
      ocr_applied: true,
      extracted_fields: [],
      malware_scan_status: "clean",
    };
    localDocuments = [newDoc, ...localDocuments];

    // Log immutable storage event
    localAuditEvents = [
      {
        id: `audit-${Date.now()}`,
        action: "document.immutable_stored",
        object_type: "document",
        object_id: newDoc.id,
        actor_email: DEMO_USERS[role === "retained_client" ? "client_applicant" : "case_manager"].email,
        created_at: new Date().toISOString(),
        metadata: {
          file: newDoc.title,
          sha256: newDoc.sha256_hash,
          verified: false,
        },
      },
      ...localAuditEvents,
    ];

    return { data: newDoc, isLiveBackend: false };
  },

  async uploadDocumentFile(
    formData: FormData,
    role: RoleCode = "case_manager"
  ): Promise<ApiResponse<DocumentItem>> {
    try {
      const headers = getAuthHeaders(role);
      delete (headers as any)["Content-Type"]; // Let browser set boundary
      const res = await fetch(`${API_BASE_URL}/documents/upload`, {
        method: "POST",
        headers,
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        // Sync to local
        localDocuments = [data, ...localDocuments];
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    const file = formData.get("file") as File | null;
    const category = (formData.get("category") as string) || "supporting_evidence";
    const title = (formData.get("title") as string) || (file?.name || "Uploaded_Evidence.pdf");
    const caseId = (formData.get("case_id") as string) || "case-01";

    const newDoc: DocumentItem = {
      id: `doc-${Date.now()}`,
      case_id: caseId,
      case_number: "CASE-US-8841",
      title,
      filename: file?.name || title,
      category,
      file_size: file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : "1.2 MB",
      byte_size: file?.size || 1200000,
      mime_type: file?.type || "application/pdf",
      version: 1,
      is_current_version: true,
      uploaded_by: DEMO_USERS[role === "retained_client" ? "client_applicant" : "case_manager"].name,
      status: "under_review",
      processing_status: "completed",
      verification_status: "unverified",
      sha256_hash: "a492f1b02931a012948124018240912809182309128301928301298301293810",
      uploaded_at: new Date().toISOString(),
      tamper_verified: true,
      detected_language: "en",
      page_count: 1,
      ocr_applied: true,
      extracted_fields: [
        {
          id: `field-${Date.now()}`,
          field_name: "extracted_snippet",
          field_label: "Extracted Reference",
          original_value: "VERIFIED IMMIGRATION RECORD EVIDENCE",
          normalized_value: "Verified Immigration Record Evidence",
          source_page: 1,
          extraction_method: "pymupdf_regex_parser",
          ocr_confidence: 0.98,
          extraction_confidence: 0.95,
          validation_status: "unvalidated",
          is_manually_corrected: false,
        },
      ],
      malware_scan_status: "clean",
    };
    localDocuments = [newDoc, ...localDocuments];
    return { data: newDoc, isLiveBackend: false };
  },

  async reprocessDocument(
    id: string,
    role: RoleCode = "case_manager"
  ): Promise<ApiResponse<DocumentItem>> {
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${id}/reprocess`, {
        method: "POST",
        headers: getAuthHeaders(role),
      });
      if (res.ok) {
        const data = await res.json();
        localDocuments = localDocuments.map((d) => (d.id === id ? data : d));
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    const docIndex = localDocuments.findIndex((d) => d.id === id);
    if (docIndex >= 0) {
      const doc = localDocuments[docIndex];
      const updatedDoc: DocumentItem = {
        ...doc,
        processing_status: "completed",
        ocr_applied: true,
        retry_count: (doc.retry_count || 0) + 1,
      };
      localDocuments[docIndex] = updatedDoc;
      return { data: updatedDoc, isLiveBackend: false };
    }
    throw new Error("Document not found");
  },

  async verifyDocument(
    id: string,
    status: "verified" | "rejected" | "under_review",
    notes?: string,
    role: RoleCode = "case_manager"
  ): Promise<ApiResponse<DocumentItem>> {
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${id}/verify`, {
        method: "PUT",
        headers: getAuthHeaders(role),
        body: JSON.stringify({ status, notes }),
      });
      if (res.ok) {
        const data = await res.json();
        localDocuments = localDocuments.map((d) => (d.id === id ? data : d));
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    const docIndex = localDocuments.findIndex((d) => d.id === id);
    if (docIndex >= 0) {
      const doc = localDocuments[docIndex];
      const updatedDoc: DocumentItem = {
        ...doc,
        status: status === "verified" ? "verified" : status === "rejected" ? "action_needed" : "under_review",
        verification_status: status,
        verification_notes: notes,
        verified_at: new Date().toISOString(),
        verified_by_user_id: DEMO_USERS.case_manager.id,
      };
      localDocuments[docIndex] = updatedDoc;

      localAuditEvents = [
        {
          id: `audit-${Date.now()}`,
          action: `document.verification_${status}`,
          object_type: "document",
          object_id: id,
          actor_email: DEMO_USERS.case_manager.email,
          created_at: new Date().toISOString(),
          metadata: { status, notes },
        },
        ...localAuditEvents,
      ];

      return { data: updatedDoc, isLiveBackend: false };
    }
    throw new Error("Document not found");
  },

  async correctExtractedField(
    docId: string,
    fieldId: string,
    correctedValue: string,
    reason: string,
    role: RoleCode = "case_manager"
  ): Promise<ApiResponse<DocumentExtractedField>> {
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${docId}/fields/${fieldId}`, {
        method: "PUT",
        headers: getAuthHeaders(role),
        body: JSON.stringify({ corrected_value: correctedValue, reason }),
      });
      if (res.ok) {
        const data = await res.json();
        // Update local state if needed
        localDocuments = localDocuments.map((d) => {
          if (d.id === docId && d.extracted_fields) {
            return {
              ...d,
              extracted_fields: d.extracted_fields.map((f) => (f.id === fieldId ? data : f)),
            };
          }
          return d;
        });
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    const doc = localDocuments.find((d) => d.id === docId);
    if (doc && doc.extracted_fields) {
      const field = doc.extracted_fields.find((f) => f.id === fieldId);
      if (field) {
        const historyItem = {
          old_value: field.corrected_value || field.normalized_value || field.original_value,
          new_value: correctedValue,
          reason,
          corrected_by: DEMO_USERS.case_manager.name,
          corrected_at: new Date().toISOString(),
        };
        field.is_manually_corrected = true;
        field.corrected_value = correctedValue;
        field.validation_status = "corrected";
        field.correction_reason = reason;
        field.corrected_at = new Date().toISOString();
        field.correction_history = [historyItem, ...(field.correction_history || [])];

        localAuditEvents = [
          {
            id: `audit-${Date.now()}`,
            action: "document.field_manually_corrected",
            object_type: "document_field",
            object_id: fieldId,
            actor_email: DEMO_USERS.case_manager.email,
            created_at: new Date().toISOString(),
            metadata: { doc_id: docId, field: field.field_name, new_value: correctedValue, reason },
          },
          ...localAuditEvents,
        ];

        return { data: field, isLiveBackend: false };
      }
    }
    throw new Error("Document field not found");
  },

  async getDocumentVersions(id: string, role: RoleCode = "master_admin"): Promise<ApiResponse<DocumentVersionItem[]>> {
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${id}/versions`, {
        headers: getAuthHeaders(role),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    const doc = localDocuments.find((d) => d.id === id);
    const versions: DocumentVersionItem[] = [
      {
        id: id,
        version: doc?.version || 1,
        filename: doc?.filename || doc?.title || "document.pdf",
        byte_size: doc?.byte_size || 1048576,
        sha256_hash: doc?.sha256_hash || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        is_current_version: true,
        created_at: doc?.uploaded_at || new Date().toISOString(),
      },
    ];
    return { data: versions, isLiveBackend: false };
  },

  async getDocumentRuns(
    id: string,
    role: RoleCode = "master_admin"
  ): Promise<ApiResponse<DocumentProcessingRunItem[]>> {
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${id}/runs`, {
        headers: getAuthHeaders(role),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    const doc = localDocuments.find((d) => d.id === id);
    const mockRuns: DocumentProcessingRunItem[] = doc
      ? [
          {
            id: doc.active_run_id || `run-${doc.id}`,
            organization_id: "org-01",
            document_id: doc.id,
            run_number: doc.version || 1,
            idempotency_key: `mock-run-${doc.id}`,
            stage: doc.active_run_stage || (doc.processing_status === "completed" ? "completed" : doc.processing_status === "failed" ? "failed" : "extraction"),
            status: doc.processing_status || "completed",
            trigger_type: "upload",
            progress_percent: doc.active_run_progress_percent ?? (doc.processing_status === "completed" ? 100 : doc.processing_status === "failed" ? 45 : 75),
            metrics: { pages: doc.page_count || 1 },
            created_at: doc.uploaded_at || new Date().toISOString(),
            updated_at: doc.uploaded_at || new Date().toISOString(),
          },
        ]
      : [];

    return { data: mockRuns, isLiveBackend: false };
  },

  // Tasks
  async getTasks(): Promise<ApiResponse<CaseTask[]>> {
    return { data: localTasks, isLiveBackend: false };
  },

  async toggleTask(taskId: string): Promise<ApiResponse<CaseTask[]>> {
    localTasks = localTasks.map((t) => (t.id === taskId ? { ...t, is_completed: !t.is_completed } : t));
    return { data: localTasks, isLiveBackend: false };
  },

  // AI Findings & Discrepancies (Phase 5)
  async getAIFindings(caseId?: string): Promise<ApiResponse<AIFinding[]>> {
    const targetCaseId = caseId || "case-01";
    try {
      const res = await fetch(`${API_BASE_URL}/cases/${targetCaseId}/findings`, {
        headers: getAuthHeaders("case_manager"),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Offline fallback
    }
    const filtered = caseId ? localFindings.filter((f) => f.case_id === caseId) : localFindings;
    return { data: filtered.length ? filtered : localFindings, isLiveBackend: false };
  },

  async triggerCaseAIAnalysis(caseId: string): Promise<ApiResponse<AIFinding[]>> {
    try {
      const res = await fetch(`${API_BASE_URL}/cases/${caseId}/findings/analyze`, {
        method: "POST",
        headers: getAuthHeaders("case_manager"),
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Offline fallback
    }
    return { data: localFindings, isLiveBackend: false };
  },

  async getCaseChecklist(caseId: string): Promise<ApiResponse<ChecklistAuditReport>> {
    try {
      const res = await fetch(`${API_BASE_URL}/cases/${caseId}/findings/checklist`, {
        headers: getAuthHeaders("case_manager"),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    const currentCase = localCases.find((c) => c.id === caseId) || FIXTURE_CASES.find((c) => c.id === caseId);
    const category = (currentCase?.visa_category || "").toLowerCase();
    const caseDocs = localDocuments.filter((d) => d.case_id === caseId);

    // If case is specifically EB-1A or case-01, preserve exact existing fixture response
    if (caseId === "case-01" || (!currentCase && !category) || category.includes("eb-1a") || category.includes("extraordinary")) {
      const demoReport: ChecklistAuditReport = {
        jurisdiction: currentCase?.jurisdiction || "US",
        visa_category: "EB-1A",
        statutory_framework: "8 CFR § 204.5(h)(3)",
        items: [
          {
            id: "item-01",
            title: "Identity & Travel Document (Passport)",
            statutory_citation: "8 CFR § 204.5(a)",
            description: "Unexpired passport biodata showing nationality and identity",
            is_mandatory: true,
            status: "satisfied",
            matched_documents: [{ document_id: "doc-01", title: "US_Passport_Biodata_Elena_Rostova.pdf", verification_status: "verified" }],
          },
          {
            id: "item-02",
            title: "Curriculum Vitae / Professional Background",
            statutory_citation: "8 CFR § 204.5(h)(3)",
            description: "Comprehensive professional record of career trajectory and honors",
            is_mandatory: true,
            status: "satisfied",
            matched_documents: [{ document_id: "doc-03", title: "Employment_Verification_NeuralDynamics.pdf", verification_status: "under_review" }],
          },
          {
            id: "item-03",
            title: "Evidence of Participation as a Judge / Peer Review",
            statutory_citation: "8 CFR § 204.5(h)(3)(iv)",
            description: "Documented evaluation of the work of others in the same or allied field",
            is_mandatory: false,
            status: "satisfied",
            matched_documents: [{ document_id: "doc-04", title: "Peer_Review_Invitation_IEEE.pdf", verification_status: "verified" }],
          },
          {
            id: "item-04",
            title: "Original Scientific or Scholarly Contributions",
            statutory_citation: "8 CFR § 204.5(h)(3)(v)",
            description: "Evidence of major significance in the field (citations, adoption metrics)",
            is_mandatory: false,
            status: "satisfied",
            matched_documents: [{ document_id: "doc-02", title: "Stanford_PhD_Diploma_Certificate.pdf", verification_status: "verified" }],
          },
          {
            id: "item-05",
            title: "Authorship of Scholarly Articles",
            statutory_citation: "8 CFR § 204.5(h)(3)(vi)",
            description: "Published research in international journals or major industry conferences",
            is_mandatory: false,
            status: "satisfied",
            matched_documents: [{ document_id: "doc-02", title: "Stanford_PhD_Diploma_Certificate.pdf", verification_status: "verified" }],
          },
          {
            id: "item-06",
            title: "Leading or Critical Role in Distinguished Organizations",
            statutory_citation: "8 CFR § 204.5(h)(3)(viii)",
            description: "Letters from founders/executives attesting to critical organizational role",
            is_mandatory: false,
            status: "missing",
            matched_documents: [],
          },
          {
            id: "item-07",
            title: "Published Material About Alien in Major Media",
            statutory_citation: "8 CFR § 204.5(h)(3)(iii)",
            description: "Published articles in major newspapers, trade journals, or media outlets",
            is_mandatory: false,
            status: "missing",
            matched_documents: [],
          },
        ],
        fulfillment_percentage: 71.4,
        total_mandatory: 2,
        satisfied_mandatory: 2,
        missing_items: [
          "Leading or Critical Role in Distinguished Organizations (8 CFR § 204.5(h)(3)(viii))",
          "Published Material About Alien in Major Media (8 CFR § 204.5(h)(3)(iii))",
        ],
      };
      return { data: demoReport, isLiveBackend: false };
    }

    // Pathway definitions for statutory checklists
    let statutoryFramework = "Immigration Statutory Framework";
    let rawItems: {
      id: string;
      title: string;
      statutory_citation: string;
      description: string;
      is_mandatory: boolean;
      acceptable_categories: string[];
    }[] = [];

    if (category.includes("study permit") || category.includes("sds") || category.includes("pal")) {
      statutoryFramework = "IRPA § 30(1); IRPR Part 12 (SOR/2002-227)";
      rawItems = [
        {
          id: "item-ca-sp-01",
          title: "Designated Learning Institution (DLI) Letter of Acceptance (LOA)",
          statutory_citation: "IRPR § 211.1 - Acceptance at DLI",
          description: "Unconditional official acceptance letter with DLI number from accredited Canadian institution",
          is_mandatory: true,
          acceptable_categories: ["educational_records", "government_correspondence"],
        },
        {
          id: "item-ca-sp-02",
          title: "Provincial Attestation Letter (PAL 2024 Mandate)",
          statutory_citation: "IRCC Ministerial Instructions 2024 - Study Cap Quota",
          description: "Provincial verification confirming study permit allocation under national cap",
          is_mandatory: true,
          acceptable_categories: ["educational_records", "government_correspondence"],
        },
        {
          id: "item-ca-sp-03",
          title: "Guaranteed Investment Certificate (GIC $20,635 Minimum)",
          statutory_citation: "IRCC Financial Sufficiency Guideline 2024",
          description: "GIC certificate from CDIC-participating bank (CIBC, Scotiabank, ICICI Canada)",
          is_mandatory: true,
          acceptable_categories: ["financial_evidence"],
        },
        {
          id: "item-ca-sp-04",
          title: "SDS Language Proficiency Result (IELTS 6.0+ / PTE 60+)",
          statutory_citation: "IRCC Student Direct Stream Language Threshold",
          description: "Standardized language test certificate taken within last 24 months",
          is_mandatory: true,
          acceptable_categories: ["educational_records", "supporting_evidence"],
        },
        {
          id: "item-ca-sp-05",
          title: "IRCC Upfront Medical Examination (eMedical Sheet)",
          statutory_citation: "IRPR § 29 - Medical Examination of Foreign Nationals",
          description: "Panel physician eMedical tracking sheet with UMI/IME barcode",
          is_mandatory: true,
          acceptable_categories: ["police_medical"],
        },
        {
          id: "item-ca-sp-06",
          title: "Primary Passport & Identity Travel Record",
          statutory_citation: "IRPR § 52 - Valid Travel Document",
          description: "Valid international passport biodata with post-study validity",
          is_mandatory: true,
          acceptable_categories: ["identity_passport"],
        },
      ];
    } else if (category.includes("visitor") || category.includes("trv") || category.includes("touris") || category.includes("b-1") || category.includes("b-2") || category.includes("b1b2")) {
      if (category.includes("us") || (currentCase?.jurisdiction || "").includes("United States")) {
        statutoryFramework = "INA § 101(a)(15)(B); 22 CFR § 41.31; 9 FAM 402.2";
        rawItems = [
          {
            id: "item-us-b1-01",
            title: "Form DS-160 Nonimmigrant Visa Application Confirmation",
            statutory_citation: "22 CFR § 41.103 - Online Visa Application",
            description: "Completed DS-160 confirmation page with CEAC barcode",
            is_mandatory: true,
            acceptable_categories: ["government_correspondence", "supporting_evidence"],
          },
          {
            id: "item-us-b1-02",
            title: "Proof of Financial Solvency (6 Months Liquid Bank Statements)",
            statutory_citation: "9 FAM 402.2-5 - Ability to Pay Travel Expenses",
            description: "Continuous bank statements demonstrating funds for travel without unauthorized employment",
            is_mandatory: true,
            acceptable_categories: ["financial_evidence"],
          },
          {
            id: "item-us-b1-03",
            title: "3 Consecutive Years Income Tax Returns (ITR-V / Form 16)",
            statutory_citation: "INA § 214(b) - Economic Ties to India",
            description: "Verified Indian Income Tax acknowledgment receipts confirming local economic ties",
            is_mandatory: true,
            acceptable_categories: ["financial_evidence", "employment_records"],
          },
          {
            id: "item-us-b1-04",
            title: "Employer Leave Sanction & No-Objection Certificate (NOC)",
            statutory_citation: "INA § 214(b) - Employment Ties & Intent to Return",
            description: "Official employer letter approving leave duration and guaranteeing position upon return",
            is_mandatory: true,
            acceptable_categories: ["employment_records"],
          },
          {
            id: "item-us-b1-05",
            title: "Host Invitation Letter / Travel Itinerary & Form I-134",
            statutory_citation: "9 FAM 402.2-4 - Temporary Purpose of Travel",
            description: "Detailed day-by-day travel itinerary or host invitation with affidavit of support",
            is_mandatory: false,
            acceptable_categories: ["supporting_evidence", "government_correspondence"],
          },
          {
            id: "item-us-b1-06",
            title: "Valid International Passport Biodata",
            statutory_citation: "INA § 221; 8 CFR § 214.1 - Identity & Travel Record",
            description: "Machine-readable passport valid at least 6 months beyond intended departure",
            is_mandatory: true,
            acceptable_categories: ["identity_passport"],
          },
        ];
      } else {
        statutoryFramework = "IRPA § 22; IRPR § 179 - Temporary Resident Visa";
        rawItems = [
          {
            id: "item-ca-trv-01",
            title: "Valid Passport Biodata Page",
            statutory_citation: "IRPR § 52 - Valid Travel Document",
            description: "Clear scan of passport biographical data page",
            is_mandatory: true,
            acceptable_categories: ["identity_passport"],
          },
          {
            id: "item-ca-trv-02",
            title: "3 Consecutive Years Indian Income Tax Returns (ITR-V)",
            statutory_citation: "IRPR § 179(b) - Economic Ties to India",
            description: "Official tax acknowledgment slips showing domestic income stream",
            is_mandatory: true,
            acceptable_categories: ["financial_evidence", "employment_records"],
          },
          {
            id: "item-ca-trv-03",
            title: "6 Months Continuous Bank Account Statements",
            statutory_citation: "IRPR § 179(b) - Financial Solvency & Sufficiency",
            description: "Certified bank statements showing consistent balance without sudden unexplained deposits",
            is_mandatory: true,
            acceptable_categories: ["financial_evidence"],
          },
          {
            id: "item-ca-trv-04",
            title: "Employer Leave Sanction & No-Objection Certificate (NOC)",
            statutory_citation: "IRPR § 179(b) - Ongoing Employment Ties",
            description: "Signed employer letter authorizing vacation and confirming ongoing position",
            is_mandatory: true,
            acceptable_categories: ["employment_records"],
          },
          {
            id: "item-ca-trv-05",
            title: "CA Net Worth Certificate & Fixed Asset Valuations",
            statutory_citation: "IRPR § 179(b) - Real Property & Family Ties",
            description: "Chartered accountant report summarizing domestic immovable properties and assets",
            is_mandatory: false,
            acceptable_categories: ["financial_evidence", "supporting_evidence"],
          },
          {
            id: "item-ca-trv-06",
            title: "Detailed Travel Itinerary & Purpose of Visit Letter",
            statutory_citation: "IRPR § 179(a) - Genuine Visitor Intent",
            description: "Flight reservation, accommodation bookings, and personal statement of purpose",
            is_mandatory: true,
            acceptable_categories: ["supporting_evidence"],
          },
        ];
      }
    } else if (category.includes("sowp") || category.includes("spousal")) {
      statutoryFramework = "IRPR § 205(c)(ii) - LMIA Exemption Code C41/C42";
      rawItems = [
        {
          id: "item-ca-sowp-01",
          title: "Principal Spouse Valid Canadian Study / Work Permit",
          statutory_citation: "IRPR § 205(c)(ii) - Qualifying Principal Status",
          description: "Unexpired Canadian permit copy and proof of full-time enrolment or NOC TEER 0/1/2/3 job",
          is_mandatory: true,
          acceptable_categories: ["visas_residence_permits", "government_correspondence"],
        },
        {
          id: "item-ca-sowp-02",
          title: "Registered Marriage Certificate & Official Wedding Album",
          statutory_citation: "IRPR § 4 - Genuine Marital Relationship",
          description: "Civil registration under Hindu Marriage Act / Special Marriage Act with photo evidence",
          is_mandatory: true,
          acceptable_categories: ["civil_status"],
        },
        {
          id: "item-ca-sowp-03",
          title: "Proof of Cohabitation & Intermingled Financial Affairs",
          statutory_citation: "IRPR § 4 - Cohabitation & Joint Affairs",
          description: "Joint bank accounts, shared rental agreements, or family remittance records",
          is_mandatory: true,
          acceptable_categories: ["financial_evidence", "civil_status", "supporting_evidence"],
        },
        {
          id: "item-ca-sowp-04",
          title: "Police Clearance Certificate (PCC) from Regional Passport Office",
          statutory_citation: "IRPA § 36 - Criminal Admissibility",
          description: "Official Indian RPO Police Clearance Certificate issued within 6 months",
          is_mandatory: true,
          acceptable_categories: ["police_medical"],
        },
        {
          id: "item-ca-sowp-05",
          title: "Applicant International Passport Biodata",
          statutory_citation: "IRPR § 52 - Valid Travel Document",
          description: "Unexpired passport showing spouse's endorsed name if updated",
          is_mandatory: true,
          acceptable_categories: ["identity_passport"],
        },
      ];
    } else if (category.includes("f-1") || category.includes("f1") || (category.includes("student") && (currentCase?.jurisdiction || "").includes("United States"))) {
      statutoryFramework = "INA § 101(a)(15)(F)(i); 8 CFR § 214.2(f); 22 CFR § 41.61";
      rawItems = [
        {
          id: "item-us-f1-01",
          title: "Form I-20 Certificate of Eligibility (SEVP Certified)",
          statutory_citation: "8 CFR § 214.2(f)(1)(i) - SEVP Form I-20",
          description: "Signed Form I-20 issued by SEVP-approved school certifying admission and program length",
          is_mandatory: true,
          acceptable_categories: ["educational_records", "government_correspondence"],
        },
        {
          id: "item-us-f1-02",
          title: "SEVIS I-901 Fee Payment Receipt ($350)",
          statutory_citation: "8 CFR § 214.13 - SEVIS Fee Requirement",
          description: "Official receipt showing payment of mandatory $350 SEVIS fee prior to visa interview",
          is_mandatory: true,
          acceptable_categories: ["financial_evidence", "government_correspondence"],
        },
        {
          id: "item-us-f1-03",
          title: "Liquid Financial Proof (Year 1 Tuition + Living Costs)",
          statutory_citation: "8 CFR § 214.2(f)(1)(i)(B) - Financial Sufficiency",
          description: "Liquid savings, fixed deposits, or sanctioned education loan letters covering year 1",
          is_mandatory: true,
          acceptable_categories: ["financial_evidence"],
        },
        {
          id: "item-us-f1-04",
          title: "Parent/Sponsor Affidavit of Support & 3-Year ITRs",
          statutory_citation: "INA § 214(b) - Verifiable Source of Funds",
          description: "Notarized sponsor affidavit accompanied by Income Tax Returns and bank proof",
          is_mandatory: true,
          acceptable_categories: ["financial_evidence", "supporting_evidence"],
        },
        {
          id: "item-us-f1-05",
          title: "Academic Degree Transcripts & Standardized Test Scores",
          statutory_citation: "8 CFR § 214.2(f)(6) - Academic Preparedness",
          description: "Undergraduate/high school degree transcripts, GRE/GMAT, and TOEFL/IELTS scorecards",
          is_mandatory: true,
          acceptable_categories: ["educational_records"],
        },
        {
          id: "item-us-f1-06",
          title: "Valid Student Passport Biodata",
          statutory_citation: "INA § 221 - Primary Identity Record",
          description: "Valid passport with post-graduation validity",
          is_mandatory: true,
          acceptable_categories: ["identity_passport"],
        },
      ];
    } else if (category.includes("student") && (category.includes("uk") || (currentCase?.jurisdiction || "").includes("United Kingdom"))) {
      statutoryFramework = "Immigration Rules Appendix Student; HC 813";
      rawItems = [
        {
          id: "item-uk-stu-01",
          title: "Confirmation of Acceptance for Studies (CAS) Reference",
          statutory_citation: "Appendix Student ST 5.1 - Valid CAS",
          description: "Valid CAS issued by licensed UK student sponsor university",
          is_mandatory: true,
          acceptable_categories: ["educational_records", "government_correspondence"],
        },
        {
          id: "item-uk-stu-02",
          title: "28-Consecutive-Day Maintenance Funds Proof",
          statutory_citation: "Appendix Student ST 12.3 - Financial Requirement",
          description: "Bank statements showing required living funds held consecutively for 28 days",
          is_mandatory: true,
          acceptable_categories: ["financial_evidence"],
        },
        {
          id: "item-uk-stu-03",
          title: "UKVI Approved Clinic Tuberculosis (TB) Screening Certificate",
          statutory_citation: "Appendix T - Tuberculosis Screening for Indian Residents",
          description: "IOM / UKVI clinic TB chest x-ray clearance certificate",
          is_mandatory: true,
          acceptable_categories: ["police_medical"],
        },
        {
          id: "item-uk-stu-04",
          title: "Academic Qualifications & Certificates Listed on CAS",
          statutory_citation: "Appendix Student ST 14.1 - Academic Qualifications",
          description: "Degree diplomas and marksheets assessed by the university sponsor",
          is_mandatory: true,
          acceptable_categories: ["educational_records"],
        },
        {
          id: "item-uk-stu-05",
          title: "Valid International Passport Biodata",
          statutory_citation: "Appendix Student ST 1.2 - Identity Requirement",
          description: "Passport biodata page",
          is_mandatory: true,
          acceptable_categories: ["identity_passport"],
        },
      ];
    } else {
      // Default to universal statutory baseline
      statutoryFramework = "Statutory Immigration Evidentiary Framework";
      rawItems = [
        {
          id: "item-gen-01",
          title: "Primary Identity & Travel Document (Passport)",
          statutory_citation: "Universal Passport & Nationality Mandate",
          description: "Unexpired passport biographical data page showing legal nationality and identity",
          is_mandatory: true,
          acceptable_categories: ["identity_passport"],
        },
        {
          id: "item-gen-02",
          title: "Curriculum Vitae / Professional Background & Qualifications",
          statutory_citation: "Evidentiary Foundation of Professional Record",
          description: "Comprehensive professional CV detailing work experience, degrees, and qualifications",
          is_mandatory: true,
          acceptable_categories: ["employment_records", "educational_records"],
        },
        {
          id: "item-gen-03",
          title: "Proof of Financial Sufficiency & Solvency",
          statutory_citation: "Financial Admissibility Requirement",
          description: "Recent bank statements, liquid asset proofs, or employment remuneration records",
          is_mandatory: true,
          acceptable_categories: ["financial_evidence"],
        },
      ];
    }

    // Match case documents against items
    const items: ChecklistAuditItem[] = rawItems.map((ri) => {
      const matched = caseDocs.filter((d) => ri.acceptable_categories.includes(d.category));
      const isSatisfied = matched.length > 0;
      return {
        id: ri.id,
        title: ri.title,
        statutory_citation: ri.statutory_citation,
        description: ri.description,
        is_mandatory: ri.is_mandatory,
        status: isSatisfied ? ("satisfied" as const) : ("missing" as const),
        matched_documents: matched.map((m) => ({
          document_id: m.id,
          title: m.title,
          verification_status: m.verification_status,
        })),
      };
    });

    const totalMandatory = items.filter((i) => i.is_mandatory).length;
    const satisfiedMandatory = items.filter((i) => i.is_mandatory && i.status === "satisfied").length;
    const fulfillmentPct = totalMandatory > 0 ? Math.round((satisfiedMandatory / totalMandatory) * 1000) / 10 : 0;
    const missingItems = items
      .filter((i) => i.is_mandatory && i.status === "missing")
      .map((i) => `${i.title} (${i.statutory_citation})`);

    const report: ChecklistAuditReport = {
      jurisdiction: currentCase?.jurisdiction || "US",
      visa_category: currentCase?.visa_category || "EB-1A",
      statutory_framework: statutoryFramework,
      items,
      fulfillment_percentage: fulfillmentPct,
      total_mandatory: totalMandatory,
      satisfied_mandatory: satisfiedMandatory,
      missing_items: missingItems,
    };

    return { data: report, isLiveBackend: false };
  },

  async getCaseEvidenceSummary(caseId: string): Promise<ApiResponse<EvidenceBackedSummary>> {
    try {
      const res = await fetch(`${API_BASE_URL}/cases/${caseId}/findings/summary`, {
        headers: getAuthHeaders("case_manager"),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    const demoSummary: EvidenceBackedSummary = {
      case_number: "CASE-US-8841",
      jurisdiction: "US",
      visa_category: "EB-1A",
      applicant_name: "Elena Rostova",
      generated_at: new Date().toISOString(),
      verified_facts: [
        { category: "Identity", key: "Passport Number", value: "C09812491", source_document: "US_Passport_Biodata_Elena_Rostova.pdf", source_page: 1 },
        { category: "Identity", key: "Date of Birth", value: "1988-04-12", source_document: "US_Passport_Biodata_Elena_Rostova.pdf", source_page: 1 },
        { category: "Education", key: "Doctor of Philosophy (Computer Science)", value: "Stanford University (conferred 2018-06-15)", source_document: "Stanford_PhD_Diploma_Certificate.pdf", source_page: 1 },
        { category: "Employment", key: "Senior AI Principal Research Scientist", value: "NeuralDynamics Inc. ($245k/yr since 2018-09-01)", source_document: "Employment_Verification_NeuralDynamics.pdf", source_page: 1 },
      ],
      potential_discrepancies: [
        {
          title: "Cyrillic Transliteration Name Variation",
          severity: "minor",
          details: "Passport records 'Yelena' while petition uses 'Elena'. Standard Cyrillic transliteration.",
          recommendation: "Disclose alias on Form I-140 Part 3.",
        },
        {
          title: "Missing Pages in Academic Diploma",
          severity: "critical",
          details: "Uploaded document contains 1 page but header states 'Page 1 of 4'.",
          recommendation: "Obtain complete 4-page certified academic diploma including transcripts.",
        },
      ],
      missing_statutory_evidence: [
        "Major media coverage (8 CFR § 204.5(h)(3)(iii))",
        "Letters attesting to critical role (8 CFR § 204.5(h)(3)(viii))",
      ],
      suggested_clarification_questions: [
        {
          target: "client",
          question: "Does the applicant have foreign educational certificates or publications issued under 'Yelena' to list under aliases on Form I-140?",
          rationale: "Ensures USCIS background check captures all prior publications and degrees without RFE.",
        },
        {
          target: "client",
          question: "Please upload the complete 4-page certified academic diploma including transcripts and registrar certification.",
          rationale: "USCIS requires unredacted complete academic credentials under 8 CFR § 204.5(k)(3).",
        },
      ],
      uncertainty_disclosures: [
        "AI findings are analytical aids and do not constitute formal legal conclusions or guarantee petition approval.",
        "Transliteration variance was evaluated using rule-based BGN/PCGN linguistic tables; official civil records must verify legal aliases.",
        "Checklist criteria evaluated based only on documents uploaded to date.",
      ],
      summary_markdown: `### Evidence-Backed Case Summary — CASE-US-8841\n**Applicant:** Elena Rostova | **Category:** EB-1A Extraordinary Ability\n\n#### Verified Facts\n- **Passport Number:** C09812491 [US_Passport_Biodata_Elena_Rostova.pdf, Page 1]\n- **Degree Conferred:** Ph.D. in Computer Science, Stanford University [Stanford_PhD_Diploma_Certificate.pdf, Page 1]\n- **Current Role:** Senior AI Principal Research Scientist [Employment_Verification_NeuralDynamics.pdf, Page 1]\n\n#### Open Review Items\n1. **Critical:** Missing pages in PhD degree record (1 of 4 pages uploaded).\n2. **Major:** Passport expiration within 6 months.\n3. **Minor:** Transliteration difference ('Yelena' vs 'Elena').`,
    };

    return { data: demoSummary, isLiveBackend: false };
  },

  async resolveFinding(caseId: string, findingId: string, note: string): Promise<ApiResponse<AIFinding>> {
    try {
      const res = await fetch(`${API_BASE_URL}/cases/${caseId}/findings/${findingId}/resolve`, {
        method: "PUT",
        headers: getAuthHeaders("case_manager"),
        body: JSON.stringify({ note }),
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Offline fallback
    }

    localFindings = localFindings.map((f) => {
      if (f.id === findingId) {
        const audit = {
          timestamp: new Date().toISOString(),
          action: "resolve",
          reviewer_email: "attorney@lexai.com",
          note,
        };
        return {
          ...f,
          status: "resolved" as const,
          resolution_action: "resolve" as const,
          resolved_at: new Date().toISOString(),
          resolution_history: [...(f.resolution_history || []), audit],
        };
      }
      return f;
    });

    const updated = localFindings.find((f) => f.id === findingId)!;
    return { data: updated, isLiveBackend: false };
  },

  async dismissFinding(
    caseId: string,
    findingId: string,
    reason: string,
    note: string
  ): Promise<ApiResponse<AIFinding>> {
    try {
      const res = await fetch(`${API_BASE_URL}/cases/${caseId}/findings/${findingId}/dismiss`, {
        method: "PUT",
        headers: getAuthHeaders("case_manager"),
        body: JSON.stringify({ reason, note }),
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Offline fallback
    }

    localFindings = localFindings.map((f) => {
      if (f.id === findingId) {
        const audit = {
          timestamp: new Date().toISOString(),
          action: "dismiss",
          reviewer_email: "attorney@lexai.com",
          reason,
          note,
        };
        return {
          ...f,
          status: "dismissed" as const,
          resolution_action: "dismiss" as const,
          resolution_reason: reason,
          resolved_at: new Date().toISOString(),
          resolution_history: [...(f.resolution_history || []), audit],
        };
      }
      return f;
    });

    const updated = localFindings.find((f) => f.id === findingId)!;
    return { data: updated, isLiveBackend: false };
  },

  async escalateFinding(caseId: string, findingId: string, note: string): Promise<ApiResponse<AIFinding>> {
    try {
      const res = await fetch(`${API_BASE_URL}/cases/${caseId}/findings/${findingId}/escalate`, {
        method: "PUT",
        headers: getAuthHeaders("case_manager"),
        body: JSON.stringify({ note }),
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Offline fallback
    }

    localFindings = localFindings.map((f) => {
      if (f.id === findingId) {
        const audit = {
          timestamp: new Date().toISOString(),
          action: "escalate",
          reviewer_email: "attorney@lexai.com",
          note,
        };
        return {
          ...f,
          severity: "critical" as const,
          resolution_action: "escalate" as const,
          resolution_history: [...(f.resolution_history || []), audit],
        };
      }
      return f;
    });

    const updated = localFindings.find((f) => f.id === findingId)!;
    return { data: updated, isLiveBackend: false };
  },

  // Messages
  async getMessages(): Promise<ApiResponse<MessageItem[]>> {
    return { data: localMessages, isLiveBackend: false };
  },

  async sendMessage(content: string, senderRole: "attorney" | "client"): Promise<ApiResponse<MessageItem>> {
    const newMsg: MessageItem = {
      id: `msg-${Date.now()}`,
      sender: senderRole === "attorney" ? "Sarah Jenkins, Esq." : "Dr. Elena Rostova",
      sender_role: senderRole,
      content,
      timestamp: "Just now",
    };
    localMessages = [...localMessages, newMsg];
    return { data: newMsg, isLiveBackend: false };
  },

  // Invoices & Capacity
  async getInvoices(): Promise<ApiResponse<InvoiceItem[]>> {
    return { data: FIXTURE_INVOICES, isLiveBackend: false };
  },

  async getTeamCapacity(): Promise<ApiResponse<TeamMemberCapacity[]>> {
    return { data: FIXTURE_CAPACITY, isLiveBackend: false };
  },

  // --- Phase 3 Case & Client Management ---

  async checkDuplicateClients(payload: {
    email?: string;
    phone?: string;
    passport_number?: string;
    first_name?: string;
    last_name?: string;
    nationality?: string;
  }): Promise<ApiResponse<{ has_duplicates: boolean; matches: DuplicateCandidate[] }>> {
    try {
      const res = await fetch(`${API_BASE_URL}/clients/check-duplicates`, {
        method: "POST",
        headers: getAuthHeaders("case_manager"),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    const matches: DuplicateCandidate[] = [];
    if (payload.email) {
      const match = localClients.find(
        (c) =>
          c.email.toLowerCase() === payload.email?.toLowerCase() ||
          (payload.email && payload.email.toLowerCase().includes("elena.rostova") && c.email.includes("elena.rostova"))
      );
      if (match) {
        matches.push({
          client_id: match.id,
          client_name: `${match.first_name} ${match.last_name}`,
          client_email: match.email,
          match_type: "email",
          confidence: "high",
          score: 1.0,
          details: `Exact email match with registered client ${match.first_name} ${match.last_name}`,
        });
      }
    }
    return { data: { has_duplicates: matches.length > 0, matches }, isLiveBackend: false };
  },

  async addDependant(
    clientId: string,
    payload: {
      relationship_type: string;
      first_name: string;
      last_name: string;
      email?: string;
      phone?: string;
      nationality: string;
      passport_number?: string;
      is_authorized_to_view_case?: boolean;
    }
  ): Promise<ApiResponse<ClientDependant>> {
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${clientId}/dependants`, {
        method: "POST",
        headers: getAuthHeaders("case_manager"),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    const newDep: ClientDependant = {
      id: `dep-${Date.now()}`,
      relationship_type: payload.relationship_type,
      first_name: payload.first_name,
      last_name: payload.last_name,
      email: payload.email,
      phone: payload.phone,
      nationality: payload.nationality,
      is_authorized_to_view_case: payload.is_authorized_to_view_case || false,
      created_at: new Date().toISOString(),
    };
    return { data: newDep, isLiveBackend: false };
  },

  async updateCaseStatus(
    caseId: string,
    status: CaseStage,
    reason?: string,
    notes?: string
  ): Promise<ApiResponse<ImmigrationCase>> {
    try {
      const res = await fetch(`${API_BASE_URL}/cases/${caseId}/status`, {
        method: "PUT",
        headers: getAuthHeaders("case_manager"),
        body: JSON.stringify({ status, reason, notes }),
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    localCases = localCases.map((c) =>
      c.id === caseId || c.case_number === caseId ? { ...c, status } : c
    );
    const updated = localCases.find((c) => c.id === caseId || c.case_number === caseId)!;
    return { data: updated, isLiveBackend: false };
  },

  async closeCase(caseId: string, reason: string, notes?: string): Promise<ApiResponse<ImmigrationCase>> {
    try {
      const res = await fetch(`${API_BASE_URL}/cases/${caseId}/close`, {
        method: "POST",
        headers: getAuthHeaders("case_manager"),
        body: JSON.stringify({ reason, notes }),
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    localCases = localCases.map((c) =>
      c.id === caseId || c.case_number === caseId ? { ...c, status: "closed" as CaseStage } : c
    );
    const updated = localCases.find((c) => c.id === caseId || c.case_number === caseId)!;
    return { data: updated, isLiveBackend: false };
  },

  async reopenCase(caseId: string, reason: string, notes?: string): Promise<ApiResponse<ImmigrationCase>> {
    try {
      const res = await fetch(`${API_BASE_URL}/cases/${caseId}/reopen`, {
        method: "POST",
        headers: getAuthHeaders("case_manager"),
        body: JSON.stringify({ reason, notes }),
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    localCases = localCases.map((c) =>
      c.id === caseId || c.case_number === caseId ? { ...c, status: "reopened" as CaseStage } : c
    );
    const updated = localCases.find((c) => c.id === caseId || c.case_number === caseId)!;
    return { data: updated, isLiveBackend: false };
  },

  async archiveCase(caseId: string, notes?: string): Promise<ApiResponse<ImmigrationCase>> {
    try {
      const res = await fetch(`${API_BASE_URL}/cases/${caseId}/archive`, {
        method: "POST",
        headers: getAuthHeaders("master_admin"),
        body: JSON.stringify({ notes }),
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    localCases = localCases.map((c) =>
      c.id === caseId || c.case_number === caseId ? { ...c, status: "archived" as CaseStage } : c
    );
    const updated = localCases.find((c) => c.id === caseId || c.case_number === caseId)!;
    return { data: updated, isLiveBackend: false };
  },

  async createMilestone(
    caseId: string,
    payload: { title: string; stage: string; target_date: string }
  ): Promise<ApiResponse<CaseMilestone>> {
    try {
      const res = await fetch(`${API_BASE_URL}/cases/${caseId}/milestones`, {
        method: "POST",
        headers: getAuthHeaders("case_manager"),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    const newMs: CaseMilestone = {
      id: `ms-${Date.now()}`,
      case_id: caseId,
      title: payload.title,
      stage: payload.stage,
      target_date: payload.target_date,
      status: "pending",
      created_at: new Date().toISOString(),
    };
    return { data: newMs, isLiveBackend: false };
  },

  async toggleMilestone(caseId: string, milestoneId: string, isCompleted: boolean): Promise<ApiResponse<void>> {
    try {
      await fetch(`${API_BASE_URL}/cases/${caseId}/milestones/${milestoneId}`, {
        method: "PUT",
        headers: getAuthHeaders("case_manager"),
        body: JSON.stringify({ status: isCompleted ? "completed" : "pending" }),
      });
    } catch {
      // Fallback
    }
    return { data: undefined, isLiveBackend: false };
  },

  async createNote(
    caseId: string,
    payload: { note_type: string; content: string; is_client_visible: boolean },
    role: RoleCode = "case_manager"
  ): Promise<ApiResponse<CaseNote>> {
    try {
      const res = await fetch(`${API_BASE_URL}/cases/${caseId}/notes`, {
        method: "POST",
        headers: getAuthHeaders(role),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    const newNote: CaseNote = {
      id: `note-${Date.now()}`,
      case_id: caseId,
      author_name: role === "retained_client" ? "Dr. Elena Rostova" : "Sarah Jenkins, Esq.",
      note_type: payload.note_type as any,
      content: payload.content,
      is_client_visible: payload.is_client_visible,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return { data: newNote, isLiveBackend: false };
  },

  async getCaseNotes(caseId: string, role: RoleCode = "case_manager"): Promise<ApiResponse<CaseNote[]>> {
    try {
      const res = await fetch(`${API_BASE_URL}/cases/${caseId}/notes`, {
        headers: getAuthHeaders(role),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }
    return { data: [], isLiveBackend: false };
  },

  // ==========================================
  // Phase 6: Immigration Rules & Requirements
  // ==========================================

  async getOfficialSources(jurisdiction?: string, authority?: string, role: RoleCode = "case_manager"): Promise<ApiResponse<OfficialSource[]>> {
    try {
      const params = new URLSearchParams();
      if (jurisdiction) params.set("jurisdiction", jurisdiction);
      if (authority) params.set("authority", authority);
      const res = await fetch(`${API_BASE_URL}/rules/sources?${params.toString()}`, {
        headers: getAuthHeaders(role),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    const filtered = FALLBACK_OFFICIAL_SOURCES.filter(s => {
      if (jurisdiction && s.jurisdiction !== jurisdiction.toUpperCase()) return false;
      if (authority && s.authority !== authority) return false;
      return true;
    });
    return { data: filtered, isLiveBackend: false };
  },

  async createOfficialSource(payload: { jurisdiction: string; authority: string; title: string; url: string; scope_limitations: string }, role: RoleCode = "master_admin"): Promise<ApiResponse<OfficialSource>> {
    try {
      const res = await fetch(`${API_BASE_URL}/rules/sources`, {
        method: "POST",
        headers: getAuthHeaders(role),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    const created: OfficialSource = {
      id: `source-${Date.now()}`,
      organization_id: DEMO_ORG_ID,
      jurisdiction: payload.jurisdiction.toUpperCase(),
      authority: payload.authority,
      title: payload.title,
      url: payload.url,
      scope_limitations: payload.scope_limitations,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      snapshots_count: 0,
    };
    FALLBACK_OFFICIAL_SOURCES.push(created);
    return { data: created, isLiveBackend: false };
  },

  async getOfficialSource(id: string, role: RoleCode = "case_manager"): Promise<ApiResponse<OfficialSource>> {
    try {
      const res = await fetch(`${API_BASE_URL}/rules/sources/${id}`, {
        headers: getAuthHeaders(role),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }
    const found = FALLBACK_OFFICIAL_SOURCES.find(s => s.id === id) || FALLBACK_OFFICIAL_SOURCES[0];
    return { data: found, isLiveBackend: false };
  },

  async getSourceSnapshots(sourceId: string, role: RoleCode = "case_manager"): Promise<ApiResponse<SourceSnapshot[]>> {
    try {
      const res = await fetch(`${API_BASE_URL}/rules/sources/${sourceId}/snapshots`, {
        headers: getAuthHeaders(role),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }
    return { data: FALLBACK_SNAPSHOTS, isLiveBackend: false };
  },

  async captureSourceSnapshot(sourceId: string, payload: { raw_content: string; publication_date?: string; effective_date?: string }, role: RoleCode = "master_admin"): Promise<ApiResponse<SourceSnapshot>> {
    try {
      const res = await fetch(`${API_BASE_URL}/rules/sources/${sourceId}/snapshots`, {
        method: "POST",
        headers: getAuthHeaders(role),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    const created: SourceSnapshot = {
      id: `snap-${Date.now()}`,
      source_id: sourceId,
      retrieval_timestamp: new Date().toISOString(),
      publication_date: payload.publication_date || new Date().toISOString(),
      effective_date: payload.effective_date || new Date().toISOString(),
      content_hash: "a9f8102381203810239810239810293810293810293810293810293810293810",
      raw_content: payload.raw_content,
      snapshot_metadata: { retrieved_via: "web_ui_specialist" },
    };
    FALLBACK_SNAPSHOTS.unshift(created);
    return { data: created, isLiveBackend: false };
  },

  async compareSourceSnapshots(sourceId: string, fromId: string, toId: string, role: RoleCode = "case_manager"): Promise<ApiResponse<SnapshotCompareResult>> {
    try {
      const res = await fetch(`${API_BASE_URL}/rules/sources/${sourceId}/snapshots/compare?from_id=${fromId}&to_id=${toId}`, {
        headers: getAuthHeaders(role),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    return {
      data: {
        from_snapshot_id: fromId,
        to_snapshot_id: toId,
        from_retrieval_timestamp: "2023-01-01T00:00:00Z",
        to_retrieval_timestamp: "2023-09-12T00:00:00Z",
        diff_lines: [
          "--- Snapshot Baseline 2023-01-01",
          "+++ Snapshot Update 2023-09-12",
          "@@ -14,6 +14,8 @@",
          " Regulatory criteria under 8 CFR 204.5(h)(3).",
          "+Added USCIS Policy clarification: STEM degrees and qualifying pre-arranged commitments.",
          "+Kazarian Step 2 merits guidance: evaluating totality of circumstances without applying novel evidentiary criteria beyond the 10 statutory prongs.",
        ],
        has_changes: true,
        summary: "2 lines added: USCIS Policy manual update clarifying STEM and Kazarian step 2 evidentiary analysis.",
      },
      isLiveBackend: false,
    };
  },

  async getRuleSets(jurisdiction?: string, pathway?: string, role: RoleCode = "case_manager"): Promise<ApiResponse<RuleSet[]>> {
    try {
      const params = new URLSearchParams();
      if (jurisdiction) params.set("jurisdiction", jurisdiction);
      if (pathway) params.set("program_pathway", pathway);
      const res = await fetch(`${API_BASE_URL}/rules/sets?${params.toString()}`, {
        headers: getAuthHeaders(role),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    return { data: FALLBACK_RULE_SETS, isLiveBackend: false };
  },

  async createRuleSet(payload: { jurisdiction: string; authority: string; program_pathway: string; code: string; name: string; description: string }, role: RoleCode = "master_admin"): Promise<ApiResponse<RuleSet>> {
    try {
      const res = await fetch(`${API_BASE_URL}/rules/sets`, {
        method: "POST",
        headers: getAuthHeaders(role),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    const created: RuleSet = {
      id: `ruleset-${Date.now()}`,
      organization_id: DEMO_ORG_ID,
      jurisdiction: payload.jurisdiction.toUpperCase(),
      authority: payload.authority,
      program_pathway: payload.program_pathway,
      code: payload.code,
      name: payload.name,
      description: payload.description,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    FALLBACK_RULE_SETS.push(created);
    return { data: created, isLiveBackend: false };
  },

  async getRuleSet(id: string, role: RoleCode = "case_manager"): Promise<ApiResponse<RuleSet>> {
    try {
      const res = await fetch(`${API_BASE_URL}/rules/sets/${id}`, {
        headers: getAuthHeaders(role),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }
    const found = FALLBACK_RULE_SETS.find(r => r.id === id) || FALLBACK_RULE_SETS[0];
    return { data: found, isLiveBackend: false };
  },

  async getRuleSetVersions(setId: string, role: RoleCode = "case_manager"): Promise<ApiResponse<RuleSetVersion[]>> {
    try {
      const res = await fetch(`${API_BASE_URL}/rules/sets/${setId}/versions`, {
        headers: getAuthHeaders(role),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }
    return { data: FALLBACK_RULE_VERSIONS, isLiveBackend: false };
  },

  async createRuleSetVersion(setId: string, payload: any, role: RoleCode = "master_admin"): Promise<ApiResponse<RuleSetVersion>> {
    try {
      const res = await fetch(`${API_BASE_URL}/rules/sets/${setId}/versions`, {
        method: "POST",
        headers: getAuthHeaders(role),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    const created: RuleSetVersion = {
      id: `ver-${Date.now()}`,
      rule_set_id: setId,
      version_number: payload.version_number,
      status: "draft",
      change_summary: payload.change_summary || "Draft version created in specialist hub",
      approval_history: [
        {
          stage: "draft",
          action: "created",
          actor_id: DEMO_USERS[role]?.id || "system",
          timestamp: new Date().toISOString(),
          comments: payload.change_summary || "Draft version initiated",
        },
      ],
      created_at: new Date().toISOString(),
      requirements_count: 0,
    };
    FALLBACK_RULE_VERSIONS.unshift(created);
    return { data: created, isLiveBackend: false };
  },

  async getRuleSetVersion(versionId: string, role: RoleCode = "case_manager"): Promise<ApiResponse<RuleSetVersion>> {
    try {
      const res = await fetch(`${API_BASE_URL}/rules/versions/${versionId}`, {
        headers: getAuthHeaders(role),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }
    const found = FALLBACK_RULE_VERSIONS.find(v => v.id === versionId) || FALLBACK_RULE_VERSIONS[0];
    return { data: found, isLiveBackend: false };
  },

  async getVersionRequirements(versionId: string, role: RoleCode = "case_manager"): Promise<ApiResponse<RuleRequirement[]>> {
    try {
      const res = await fetch(`${API_BASE_URL}/rules/versions/${versionId}/requirements`, {
        headers: getAuthHeaders(role),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }
    return { data: FALLBACK_REQUIREMENTS, isLiveBackend: false };
  },

  async createVersionRequirement(versionId: string, payload: any, role: RoleCode = "master_admin"): Promise<ApiResponse<RuleRequirement>> {
    try {
      const res = await fetch(`${API_BASE_URL}/rules/versions/${versionId}/requirements`, {
        method: "POST",
        headers: getAuthHeaders(role),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    const created: RuleRequirement = {
      id: `req-${Date.now()}`,
      rule_set_version_id: versionId,
      code: payload.code,
      title: payload.title,
      description: payload.description,
      category: payload.category,
      statutory_citation: payload.statutory_citation,
      is_mandatory: payload.is_mandatory ?? true,
      priority: payload.priority ?? 1,
      applicability_conditions: payload.applicability_conditions || {},
      accepted_evidence_types: payload.accepted_evidence_types || [],
      validation_rules: payload.validation_rules || [],
      requires_human_review: payload.requires_human_review ?? true,
      review_guidance: payload.review_guidance,
      blocking_dependencies: payload.blocking_dependencies || [],
    };
    FALLBACK_REQUIREMENTS.push(created);
    return { data: created, isLiveBackend: false };
  },

  async transitionVersionStatus(versionId: string, targetStatus: string, comments?: string, role: RoleCode = "master_admin"): Promise<ApiResponse<RuleSetVersion>> {
    try {
      const res = await fetch(`${API_BASE_URL}/rules/versions/${versionId}/transition`, {
        method: "POST",
        headers: getAuthHeaders(role),
        body: JSON.stringify({ target_status: targetStatus, comments }),
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    const v = FALLBACK_RULE_VERSIONS.find(ver => ver.id === versionId) || FALLBACK_RULE_VERSIONS[0];
    v.status = targetStatus as any;
    v.approval_history.push({
      action: `transition_to_${targetStatus}`,
      actor_id: DEMO_USERS[role]?.id || "admin",
      timestamp: new Date().toISOString(),
      comments: comments || `Status changed to ${targetStatus}`,
    });
    return { data: v, isLiveBackend: false };
  },

  async testVersionRegression(versionId: string, role: RoleCode = "master_admin"): Promise<ApiResponse<any>> {
    try {
      const res = await fetch(`${API_BASE_URL}/rules/versions/${versionId}/test-regression`, {
        method: "POST",
        headers: getAuthHeaders(role),
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    return {
      data: {
        rule_set_version_id: versionId,
        version_number: "1.0.0",
        is_valid: true,
        passed_checks: [
          "Contains 12 configured requirement definitions",
          "Requirement codes are uniquely defined without duplicates",
          "Dependency graph free of circular deadlocks",
          "All conditional expressions validated against safe declarative AST operators",
          "Linked to official USCIS Policy Manual Volume 6 Part F Chapter 2",
        ],
        warnings: [],
        errors: [],
        recommendation: "Ready for formal review and publication",
      },
      isLiveBackend: false,
    };
  },

  async identifyAffectedCases(versionId: string, createTasks: boolean = true, role: RoleCode = "master_admin"): Promise<ApiResponse<AffectedCasesImpactResult>> {
    try {
      const res = await fetch(`${API_BASE_URL}/rules/versions/${versionId}/affected-cases?create_review_tasks=${createTasks}`, {
        method: "POST",
        headers: getAuthHeaders(role),
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    return {
      data: {
        rule_set_id: "ruleset-eb1a-01",
        rule_set_code: "US-USCIS-EB1A",
        rule_set_version_id: versionId,
        version_number: "1.0.0",
        jurisdiction: "US",
        program_pathway: "EB-1A",
        total_open_cases_inspected: 8,
        affected_cases_count: 2,
        affected_cases: [
          {
            case_id: "case-01",
            case_number: "CASE-US-8841",
            current_processing_stage: "processing",
            previous_evaluation_status: "needs_review",
            previous_rule_version: "None",
            task_id: "task-rule-rev-01",
          },
          {
            case_id: "case-02",
            case_number: "CASE-US-9012",
            current_processing_stage: "awaiting_documents",
            previous_evaluation_status: "missing",
            previous_rule_version: "None",
            task_id: "task-rule-rev-02",
          },
        ],
        tasks_queued_count: 2,
      },
      isLiveBackend: false,
    };
  },

  async evaluateCaseRequirements(caseId: string, versionId?: string, role: RoleCode = "case_manager"): Promise<ApiResponse<any>> {
    try {
      const url = versionId
        ? `${API_BASE_URL}/rules/cases/${caseId}/evaluate?rule_set_version_id=${versionId}`
        : `${API_BASE_URL}/rules/cases/${caseId}/evaluate`;
      const res = await fetch(url, {
        method: "POST",
        headers: getAuthHeaders(role),
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    return {
      data: {
        evaluation_id: "eval-eb1a-demo",
        case_id: caseId,
        rule_set_version_id: "ver-eb1a-100",
        version_number: "1.0.0",
        status: "needs_review",
        overall_fulfillment_percentage: 75.0,
        evaluated_at: new Date().toISOString(),
        is_superseded: false,
        results: FALLBACK_EVALUATION.results,
      },
      isLiveBackend: false,
    };
  },

  async getCaseEvaluations(caseId: string, role: RoleCode = "case_manager"): Promise<ApiResponse<CaseRequirementEvaluation[]>> {
    try {
      const res = await fetch(`${API_BASE_URL}/rules/cases/${caseId}/evaluations`, {
        headers: getAuthHeaders(role),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    return { data: [FALLBACK_EVALUATION], isLiveBackend: false };
  },

  async seedEB1APilot(role: RoleCode = "master_admin"): Promise<ApiResponse<any>> {
    try {
      const res = await fetch(`${API_BASE_URL}/rules/pilot/seed-eb1a`, {
        method: "POST",
        headers: getAuthHeaders(role),
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLiveBackend: true };
      }
    } catch {
      // Fallback
    }

    return {
      data: {
        success: true,
        message: "US EB-1A Extraordinary Ability pilot pathway provisioned and published",
        rule_set_version_id: "ver-eb1a-100",
        version_number: "1.0.0",
        status: "published",
        requirements_count: 12,
      },
      isLiveBackend: false,
    };
  },
};

// ==========================================
// Phase 6 Fallback Pilot Fixtures
// ==========================================

export const FALLBACK_OFFICIAL_SOURCES: OfficialSource[] = [
  {
    id: "source-eb1a-01",
    organization_id: DEMO_ORG_ID,
    jurisdiction: "US",
    authority: "USCIS",
    title: "USCIS Policy Manual - Volume 6, Part F, Chapter 2: Extraordinary Ability",
    url: "https://www.uscis.gov/policy-manual/volume-6-part-f-chapter-2",
    scope_limitations: "Governs evidentiary criteria (8 CFR 204.5(h)) and two-step Kazarian adjudication framework for immigrant petitions for extraordinary ability. Excludes labor certification or employer sponsorship since EB-1A allows self-petitioning.",
    last_retrieved_at: "2026-10-11T12:00:00Z",
    created_at: "2023-09-12T00:00:00Z",
    updated_at: "2026-10-11T12:00:00Z",
    snapshots_count: 2,
  },
  {
    id: "source-dos-01",
    organization_id: DEMO_ORG_ID,
    jurisdiction: "US",
    authority: "Department of State",
    title: "Foreign Affairs Manual 9 FAM 502.4: First Preference Employment Visas",
    url: "https://fam.state.gov/fam/09fam/09fam050204.html",
    scope_limitations: "Consular visa processing standards for immigrant visa issuance overseas upon approved Form I-140 petition.",
    last_retrieved_at: "2026-10-10T11:00:00Z",
    created_at: "2024-01-15T00:00:00Z",
    updated_at: "2026-10-10T11:00:00Z",
    snapshots_count: 1,
  },
  {
    id: "source-ukvi-01",
    organization_id: DEMO_ORG_ID,
    jurisdiction: "GB",
    authority: "UK Visas & Immigration (Home Office)",
    title: "Immigration Rules Appendix Global Talent",
    url: "https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-global-talent",
    scope_limitations: "Endorsement and visa criteria for Tech Nation, Royal Society, British Academy, and Arts Council England endorsements.",
    last_retrieved_at: "2026-10-09T09:30:00Z",
    created_at: "2024-04-01T00:00:00Z",
    updated_at: "2026-10-09T09:30:00Z",
    snapshots_count: 1,
  },
  {
    id: "source-ircc-01",
    organization_id: DEMO_ORG_ID,
    jurisdiction: "CA",
    authority: "Immigration, Refugees and Citizenship Canada (IRCC)",
    title: "Express Entry Ministerial Instructions & Federal Skilled Worker Program (FSWP)",
    url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/eligibility/federal-skilled-workers.html",
    scope_limitations: "Comprehensive Ranking System (CRS) thresholds, language CLB criteria, Educational Credential Assessments (ECA).",
    last_retrieved_at: "2026-10-08T16:00:00Z",
    created_at: "2024-06-10T00:00:00Z",
    updated_at: "2026-10-08T16:00:00Z",
    snapshots_count: 1,
  },
  {
    id: "source-dha-01",
    organization_id: DEMO_ORG_ID,
    jurisdiction: "AU",
    authority: "Department of Home Affairs",
    title: "Global Talent Visa (Subclass 858) Evidentiary Requirements",
    url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/global-talent-visa-858",
    scope_limitations: "Target sector excellence criteria, high income threshold (FWHIT), and nominator qualification standards.",
    last_retrieved_at: "2026-10-07T08:15:00Z",
    created_at: "2024-08-01T00:00:00Z",
    updated_at: "2026-10-07T08:15:00Z",
    snapshots_count: 1,
  },
  {
    id: "source-bamf-01",
    organization_id: DEMO_ORG_ID,
    jurisdiction: "DE",
    authority: "Bundesamt für Migration und Flüchtlinge (BAMF)",
    title: "Aufenthaltsgesetz § 18b Blaue Karte EU / Chancenkarte",
    url: "https://www.bamf.de/DE/Themen/MigrationAufenthalt/ZuwandererDrittstaaten/Arbeit/BlaueKarteEU/blauekarteeu-node.html",
    scope_limitations: "German skilled worker immigration law, minimum salary thresholds, and German language integration benchmarks.",
    last_retrieved_at: "2026-10-06T14:20:00Z",
    created_at: "2024-09-01T00:00:00Z",
    updated_at: "2026-10-06T14:20:00Z",
    snapshots_count: 1,
  },
];

export const FALLBACK_SNAPSHOTS: SourceSnapshot[] = [
  {
    id: "snap-eb1a-02",
    source_id: "source-eb1a-01",
    retrieval_timestamp: "2023-09-12T00:00:00Z",
    publication_date: "2023-09-12T00:00:00Z",
    effective_date: "2023-09-12T00:00:00Z",
    content_hash: "a9f8102381203810239810239810293810293810293810293810293810293810",
    raw_content: `# USCIS Policy Manual: Volume 6, Part F, Chapter 2 - Extraordinary Ability
## Two-Step Evidentiary Framework (Kazarian Adjudication)
Step 1: Evaluate whether the petitioner has submitted evidence demonstrating either a one-time major internationally recognized award OR at least three of the ten regulatory criteria under 8 CFR 204.5(h)(3).
Step 2: Final Merits Determination. Totality of evidence must establish sustained national or international acclaim.`,
    snapshot_metadata: { authority_code: "US-USCIS-PM-V6PF", format: "markdown" },
  },
  {
    id: "snap-eb1a-01",
    source_id: "source-eb1a-01",
    retrieval_timestamp: "2023-01-01T00:00:00Z",
    publication_date: "2023-01-01T00:00:00Z",
    effective_date: "2023-01-01T00:00:00Z",
    content_hash: "3b8a102381203810239810239810293810293810293810293810293810293810",
    raw_content: `# USCIS Policy Manual: Volume 6, Part F, Chapter 2 - Extraordinary Ability
Standard baseline criteria under 8 CFR 204.5(h). 10 regulatory criteria.`,
    snapshot_metadata: { authority_code: "US-USCIS-PM-V6PF-LEGACY", format: "markdown" },
  },
];

export const FALLBACK_RULE_SETS: RuleSet[] = [
  {
    id: "ruleset-eb1a-01",
    organization_id: DEMO_ORG_ID,
    jurisdiction: "US",
    authority: "USCIS",
    program_pathway: "EB-1A",
    code: "US-USCIS-EB1A",
    name: "US EB-1A Extraordinary Ability Requirements",
    description: "Statutory and regulatory criteria for Employment-Based First Preference Extraordinary Ability petitions pursuant to INA § 203(b)(1)(A), 8 CFR § 204.5(h), and USCIS Policy Manual Vol 6 Part F Ch 2.",
    current_version_id: "ver-eb1a-100",
    created_at: "2023-09-12T00:00:00Z",
    updated_at: "2026-10-11T12:00:00Z",
  },
  {
    id: "ruleset-uk-gt-01",
    organization_id: DEMO_ORG_ID,
    jurisdiction: "GB",
    authority: "UKVI",
    program_pathway: "Global Talent",
    code: "UK-UKVI-GT",
    name: "UK Global Talent Visa Criteria",
    description: "Home Office Appendix Global Talent evidentiary standards for digital technology and sciences endorsement.",
    current_version_id: "ver-uk-gt-100",
    created_at: "2024-04-01T00:00:00Z",
    updated_at: "2026-10-09T09:30:00Z",
  },
];

export const FALLBACK_RULE_VERSIONS: RuleSetVersion[] = [
  {
    id: "ver-eb1a-100",
    rule_set_id: "ruleset-eb1a-01",
    version_number: "1.0.0",
    status: "published",
    official_source_id: "source-eb1a-01",
    source_snapshot_id: "snap-eb1a-02",
    publication_date: "2023-09-12T00:00:00Z",
    effective_date: "2023-09-12T00:00:00Z",
    change_summary: "Initial codified baseline pilot for 8 CFR § 204.5(h) 10 criteria plus identity and intent mandates.",
    published_at: "2023-09-12T00:00:00Z",
    approval_history: [
      { stage: "review", action: "approved", actor_id: "Senior Reviewer (Sarah Jenkins)", timestamp: "2023-09-11T14:00:00Z", comments: "Validated against USCIS Policy Manual Vol 6 Part F" },
      { stage: "publication", action: "published", actor_id: "Managing Partner (Elena Vance)", timestamp: "2023-09-12T09:00:00Z", comments: "Published as operational pilot baseline" },
    ],
    created_at: "2023-09-12T00:00:00Z",
    requirements_count: 12,
  },
];

export const FALLBACK_REQUIREMENTS: RuleRequirement[] = [
  {
    id: "req-eb1a-id",
    rule_set_version_id: "ver-eb1a-100",
    code: "EB1A-MAND-ID",
    title: "Valid Unexpired Identity & Passport",
    description: "Valid unexpired passport establishing legal identity, nationality, and biometric consistency under INA § 221 and 8 CFR § 204.5(a).",
    category: "mandatory_identity",
    statutory_citation: "8 CFR § 204.5(a); INA § 221",
    is_mandatory: true,
    priority: 1,
    applicability_conditions: {},
    accepted_evidence_types: [{ category: "passport", min_count: 1 }],
    validation_rules: [
      { check: "field_present", field_name: "passport_number" },
      { check: "field_present", field_name: "date_of_birth" },
      { check: "ocr_confidence_threshold", min_confidence: 0.70 },
    ],
    requires_human_review: true,
    review_guidance: "Inspect bio page scan for clear security marks, expiration date beyond 6 months, and exact spelling match with petition.",
    blocking_dependencies: [],
  },
  {
    id: "req-eb1a-intent",
    rule_set_version_id: "ver-eb1a-100",
    code: "EB1A-MAND-INTENT",
    title: "Intent to Continue Work in Field of Expertise in the United States",
    description: "Evidence that the beneficiary intends to enter the United States to continue work in the area of substantial expertise under 8 CFR § 204.5(h)(5).",
    category: "statutory_mandate",
    statutory_citation: "8 CFR § 204.5(h)(5)",
    is_mandatory: true,
    priority: 2,
    applicability_conditions: {},
    accepted_evidence_types: [{ category: "intent_statement", min_count: 1 }, { category: "employment_commitment", min_count: 1 }],
    validation_rules: [{ check: "min_pages", min_pages: 1 }],
    requires_human_review: true,
    review_guidance: "Verify prospective US employment letters, consulting contracts, or sworn statement outlining anticipated projects in field.",
    blocking_dependencies: ["EB1A-MAND-ID"],
  },
  {
    id: "req-eb1a-awards",
    rule_set_version_id: "ver-eb1a-100",
    code: "EB1A-EVID-AWARDS",
    title: "Nationally or Internationally Recognized Prizes or Awards",
    description: "Documentation of the alien's receipt of lesser nationally or internationally recognized prizes or awards for excellence in the field.",
    category: "regulatory_criteria",
    statutory_citation: "8 CFR § 204.5(h)(3)(i)",
    is_mandatory: false,
    priority: 10,
    applicability_conditions: {},
    accepted_evidence_types: [{ category: "award_certificate", min_count: 1 }],
    validation_rules: [{ check: "min_pages", min_pages: 1 }],
    requires_human_review: true,
    review_guidance: "Verify criteria of the award, national/international scope, competitor pool, and that award was given directly to beneficiary.",
    blocking_dependencies: ["EB1A-MAND-ID"],
  },
  {
    id: "req-eb1a-judging",
    rule_set_version_id: "ver-eb1a-100",
    code: "EB1A-EVID-JUDGING",
    title: "Participation as a Judge of the Work of Others",
    description: "Evidence of the alien's participation, either individually or on a panel, as a judge of the work of others in the same or an allied field.",
    category: "regulatory_criteria",
    statutory_citation: "8 CFR § 204.5(h)(3)(iv)",
    is_mandatory: false,
    priority: 13,
    applicability_conditions: {},
    accepted_evidence_types: [{ category: "peer_review_invitation", min_count: 1 }],
    validation_rules: [{ check: "min_pages", min_pages: 1 }],
    requires_human_review: true,
    review_guidance: "Confirm actual completion of review (e.g. editor thank you letter, Publons record) not just an invitation.",
    blocking_dependencies: ["EB1A-MAND-ID"],
  },
  {
    id: "req-eb1a-contribution",
    rule_set_version_id: "ver-eb1a-100",
    code: "EB1A-EVID-CONTRIBUTION",
    title: "Original Contributions of Major Significance in the Field",
    description: "Evidence of the alien's original scientific, scholarly, artistic, athletic, or business-related contributions of major significance in the field.",
    category: "regulatory_criteria",
    statutory_citation: "8 CFR § 204.5(h)(3)(v)",
    is_mandatory: false,
    priority: 14,
    applicability_conditions: {},
    accepted_evidence_types: [{ category: "expert_recommendation_letter", min_count: 1 }, { category: "patent_commercialization", min_count: 1 }],
    validation_rules: [{ check: "min_pages", min_pages: 2 }],
    requires_human_review: true,
    review_guidance: "Independent expert letters must explain how work provoked wide adoption, influenced field, or shifted commercial/clinical paradigms.",
    blocking_dependencies: ["EB1A-MAND-ID"],
  },
  {
    id: "req-eb1a-articles",
    rule_set_version_id: "ver-eb1a-100",
    code: "EB1A-EVID-ARTICLES",
    title: "Authorship of Scholarly Articles in Professional Publications",
    description: "Evidence of the alien's authorship of scholarly articles in the field, in professional or major trade publications or other major media.",
    category: "regulatory_criteria",
    statutory_citation: "8 CFR § 204.5(h)(3)(vi)",
    is_mandatory: false,
    priority: 15,
    applicability_conditions: {},
    accepted_evidence_types: [{ category: "scholarly_article", min_count: 1 }],
    validation_rules: [{ check: "field_present", field_name: "article_title" }],
    requires_human_review: true,
    review_guidance: "Scholarly articles written for learned audience. Must show author name and journal/publisher masthead.",
    blocking_dependencies: ["EB1A-MAND-ID"],
  },
];

export const FALLBACK_EVALUATION: CaseRequirementEvaluation = {
  id: "eval-eb1a-demo",
  case_id: "case-01",
  rule_set_version_id: "ver-eb1a-100",
  version_number: "1.0.0",
  status: "needs_review",
  overall_fulfillment_percentage: 75.0,
  evaluated_at: "2026-10-11T12:30:00Z",
  is_superseded: false,
  results: {
    summary: {
      total: 6,
      applicable: 6,
      complete: 3,
      missing: 1,
      needs_review: 2,
      blocked: 0,
      expired: 0,
      not_applicable: 0,
      unknown: 0,
    },
    version_number: "1.0.0",
    rule_set_id: "ruleset-eb1a-01",
    requirements: [
      {
        code: "EB1A-MAND-ID",
        title: "Valid Unexpired Identity & Passport",
        requirement_id: "req-eb1a-id",
        category: "mandatory_identity",
        statutory_citation: "8 CFR § 204.5(a); INA § 221",
        status: "complete",
        is_applicable: true,
        is_mandatory: true,
        evidence_matched: ["doc-01"],
        validation_details: ["All evidence requirements, declarative validations, and approvals satisfied."],
        blocking_reasons: [],
        requires_human_signoff: true,
        human_signoff_completed: true,
      },
      {
        code: "EB1A-MAND-INTENT",
        title: "Intent to Continue Work in Field of Expertise in the United States",
        requirement_id: "req-eb1a-intent",
        category: "statutory_mandate",
        statutory_citation: "8 CFR § 204.5(h)(5)",
        status: "needs_review",
        is_applicable: true,
        is_mandatory: true,
        evidence_matched: ["doc-04"],
        validation_details: ["Evidence matches all criteria. Awaiting human legal professional sign-off."],
        blocking_reasons: [],
        requires_human_signoff: true,
        human_signoff_completed: false,
      },
      {
        code: "EB1A-EVID-ARTICLES",
        title: "Authorship of Scholarly Articles in Professional Publications",
        requirement_id: "req-eb1a-articles",
        category: "regulatory_criteria",
        statutory_citation: "8 CFR § 204.5(h)(3)(vi)",
        status: "complete",
        is_applicable: true,
        is_mandatory: false,
        evidence_matched: ["doc-02"],
        validation_details: ["Field 'article_title' verified present", "Human verification confirmed"],
        blocking_reasons: [],
        requires_human_signoff: true,
        human_signoff_completed: true,
      },
      {
        code: "EB1A-EVID-JUDGING",
        title: "Participation as a Judge of the Work of Others",
        requirement_id: "req-eb1a-judging",
        category: "regulatory_criteria",
        statutory_citation: "8 CFR § 204.5(h)(3)(iv)",
        status: "complete",
        is_applicable: true,
        is_mandatory: false,
        evidence_matched: ["doc-03"],
        validation_details: ["Verified peer reviewer status for IEEE Transactions"],
        blocking_reasons: [],
        requires_human_signoff: true,
        human_signoff_completed: true,
      },
      {
        code: "EB1A-EVID-CONTRIBUTION",
        title: "Original Contributions of Major Significance in the Field",
        requirement_id: "req-eb1a-contribution",
        category: "regulatory_criteria",
        statutory_citation: "8 CFR § 204.5(h)(3)(v)",
        status: "needs_review",
        is_applicable: true,
        is_mandatory: false,
        evidence_matched: ["doc-05"],
        validation_details: ["2 recommendation letters submitted. Awaiting attorney review of independent standing."],
        blocking_reasons: [],
        requires_human_signoff: true,
        human_signoff_completed: false,
      },
      {
        code: "EB1A-EVID-AWARDS",
        title: "Nationally or Internationally Recognized Prizes or Awards",
        requirement_id: "req-eb1a-awards",
        category: "regulatory_criteria",
        statutory_citation: "8 CFR § 204.5(h)(3)(i)",
        status: "missing",
        is_applicable: true,
        is_mandatory: false,
        evidence_matched: [],
        validation_details: ["Missing required evidence. Expected at least 1 document(s) in category: award_certificate"],
        blocking_reasons: ["evidence_missing"],
        requires_human_signoff: true,
        human_signoff_completed: false,
      },
    ],
  },
};

// --- PHASE 7 FALLBACK FIXTURES & API CLIENTS ---

export const FALLBACK_DOCUMENT_REQUESTS: DocumentRequestItem[] = [
  {
    id: "req-01",
    case_id: "case-01",
    requested_from_client_id: "client-01",
    title: "IEEE Senior Member Grade Certificate",
    description: "Official confirmation of IEEE Senior Member grade issued by the IEEE Executive Committee.",
    category: "supporting_evidence",
    rationale: "Required under 8 CFR § 204.5(h)(3)(ii) to satisfy the criteria for membership in associations requiring outstanding achievements.",
    statutory_requirement_code: "EB1A-CRIT-MEMBERSHIP",
    accepted_formats: ["application/pdf", "image/png", "image/jpeg"],
    acceptable_alternatives: "If official certificate is delayed, submit IEEE official membership card accompanied by membership portal confirmation screenshot.",
    due_date: "2026-11-01T00:00:00Z",
    instructions: "Please upload the high-resolution PDF certificate directly issued by IEEE.",
    translation_guidance: "If certificate is issued in another language, attach a certified English translation.",
    status: "requested",
    status_history: [
      {
        status: "requested",
        changed_by: "Sarah Jenkins, Esq.",
        timestamp: "2026-10-01T10:00:00Z",
        notes: "Initial evidence request issued by case manager.",
      },
    ],
    created_at: "2026-10-01T10:00:00Z",
    updated_at: "2026-10-01T10:00:00Z",
    comments_count: 1,
  },
  {
    id: "req-02",
    case_id: "case-01",
    requested_from_client_id: "client-01",
    title: "Certified English Translation of Master's Diploma",
    description: "Certified translation of Ukrainian National Academy of Sciences diploma.",
    category: "educational_credential",
    rationale: "Under 8 CFR § 103.2(b)(3), any foreign language document must be submitted with a complete English translation and certification of translator competence.",
    statutory_requirement_code: "8 CFR § 103.2(b)(3)",
    accepted_formats: ["application/pdf"],
    acceptable_alternatives: "ATA-certified translation or letter from a professional translation agency.",
    due_date: "2026-10-25T00:00:00Z",
    instructions: "Ensure the certification of competence and translator signature is visibly stamped on the final page.",
    translation_guidance: "Mandatory ATA or notarized translator certification required.",
    status: "rejected",
    fulfilled_document_id: "doc-legacy-scan",
    rejection_reason: "Low resolution photocopy. Transcripts page 2 is blurred and unreadable. Translator certificate was missing signature and ATA accreditation stamp. Please upload certified version.",
    status_history: [
      {
        status: "requested",
        changed_by: "Sarah Jenkins, Esq.",
        timestamp: "2026-09-15T09:00:00Z",
      },
      {
        status: "submitted",
        changed_by: "Dr. Elena Rostova",
        timestamp: "2026-09-20T14:30:00Z",
        notes: "Uploaded initial translation scan.",
      },
      {
        status: "rejected",
        changed_by: "Sarah Jenkins, Esq.",
        timestamp: "2026-09-22T11:15:00Z",
        rejection_reason: "Low resolution photocopy. Transcripts page 2 is blurred and unreadable. Translator certificate was missing signature and ATA accreditation stamp. Please upload certified version.",
      },
    ],
    created_at: "2026-09-15T09:00:00Z",
    updated_at: "2026-09-22T11:15:00Z",
    comments_count: 2,
  },
  {
    id: "req-04",
    case_id: "case-01",
    requested_from_client_id: "client-01",
    title: "Official Master's Degree Diploma & Transcripts",
    description: "Certified university graduation diploma and complete academic transcripts.",
    category: "educational_credential",
    rationale: "Required to substantiate the advanced degree prerequisite under 8 CFR § 204.5(k)(3).",
    statutory_requirement_code: "8 CFR § 204.5(k)(3)",
    accepted_formats: ["application/pdf"],
    acceptable_alternatives: "Official registrar transcript with sealed degree conferral verification letter.",
    due_date: "2026-11-15T00:00:00Z",
    instructions: "Please upload full color scan of front and back including university seal.",
    translation_guidance: "Include certified English translation if original is in Ukrainian.",
    status: "submitted",
    fulfilled_document_id: "doc-04-sub",
    status_history: [
      {
        status: "requested",
        changed_by: "Sarah Jenkins, Esq.",
        timestamp: "2026-10-02T10:00:00Z",
      },
      {
        status: "submitted",
        changed_by: "Dr. Elena Rostova",
        timestamp: "2026-10-05T16:20:00Z",
        notes: "Uploaded original diplomas and translation package.",
      },
    ],
    created_at: "2026-10-02T10:00:00Z",
    updated_at: "2026-10-05T16:20:00Z",
    comments_count: 1,
  },
  {
    id: "req-03",
    case_id: "case-01",
    requested_from_client_id: "client-01",
    title: "Unexpired Foreign Passport Biographical Page",
    description: "Color scan of unexpired passport identification page.",
    category: "identity_document",
    rationale: "Statutory identification prerequisite under 8 CFR § 204.5(a).",
    statutory_requirement_code: "EB1A-MAND-ID",
    accepted_formats: ["application/pdf", "image/png", "image/jpeg"],
    due_date: "2026-09-01T00:00:00Z",
    status: "approved",
    fulfilled_document_id: "doc-01",
    status_history: [
      {
        status: "requested",
        changed_by: "Sarah Jenkins, Esq.",
        timestamp: "2026-08-15T10:00:00Z",
      },
      {
        status: "submitted",
        changed_by: "Dr. Elena Rostova",
        timestamp: "2026-08-16T12:00:00Z",
      },
      {
        status: "approved",
        changed_by: "Sarah Jenkins, Esq.",
        timestamp: "2026-08-17T09:00:00Z",
        notes: "Passport validity confirmed through 2031.",
      },
    ],
    created_at: "2026-08-15T10:00:00Z",
    updated_at: "2026-08-17T09:00:00Z",
    comments_count: 0,
  },
];

export const FALLBACK_MESSAGE_THREADS: MessageThreadItem[] = [
  {
    id: "thread-01",
    case_id: "case-01",
    case_number: "CASE-US-8841",
    subject: "EB-1A Petition Strategy & Evidentiary Roadmap",
    thread_type: "case_update",
    status: "open",
    messages_count: 3,
    unread_count: 1,
    last_message_preview: "We have finalized the exhibit indexing for your scholarly citations.",
    created_at: "2026-10-02T10:00:00Z",
    updated_at: "2026-10-10T15:30:00Z",
  },
  {
    id: "thread-02",
    case_id: "case-01",
    case_number: "CASE-US-8841",
    subject: "IEEE Expert Testimonial Guidance",
    thread_type: "client_inquiry",
    status: "open",
    messages_count: 2,
    unread_count: 0,
    last_message_preview: "Thank you for the template; I sent it to Prof. Vance.",
    created_at: "2026-10-05T14:00:00Z",
    updated_at: "2026-10-08T11:20:00Z",
  },
];

export const FALLBACK_THREAD_MESSAGES: ThreadMessageItem[] = [
  {
    id: "msg-01",
    thread_id: "thread-01",
    sender_id: "staff-01",
    sender_name: "Sarah Jenkins, Esq.",
    sender_role: "lawyer",
    content: "Hello Dr. Rostova, we reviewed your Google Scholar profile and confirmed over 840 citations across 14 journal articles.",
    is_internal: false,
    attachment_document_ids: ["doc-02"],
    delivery_status: "delivered",
    read_at: "2026-10-02T11:00:00Z",
    delivered_at: "2026-10-02T10:05:00Z",
    created_at: "2026-10-02T10:00:00Z",
  },
  {
    id: "msg-02",
    thread_id: "thread-01",
    sender_id: "client-01",
    sender_name: "Dr. Elena Rostova",
    sender_role: "client",
    content: "Thank you Sarah! I also uploaded my IEEE Senior Member confirmation and the peer review records.",
    is_internal: false,
    attachment_document_ids: [],
    delivery_status: "delivered",
    read_at: undefined,
    delivered_at: "2026-10-02T12:35:00Z",
    created_at: "2026-10-02T12:30:00Z",
  },
  {
    id: "msg-03",
    thread_id: "thread-01",
    sender_id: "staff-01",
    sender_name: "Sarah Jenkins, Esq.",
    sender_role: "lawyer",
    content: "INTERNAL STRATEGY: Kazarian prong 1 satisfied for 3 criteria (articles, judging, original). Drafting prong 2 final merits brief.",
    is_internal: true,
    attachment_document_ids: [],
    delivery_status: "delivered",
    read_at: undefined,
    delivered_at: "2026-10-10T15:30:00Z",
    created_at: "2026-10-10T15:30:00Z",
  },
];

export const FALLBACK_WAITING_STATE: WaitingStateData = {
  waiting_on_client_count: 2,
  waiting_on_firm_count: 2,
  primary_next_action: {
    id: "req-01",
    type: "document_request",
    title: "Upload IEEE Senior Member Grade Certificate",
    description: "Required to document membership in associations requiring outstanding achievement (8 CFR § 204.5(h)(3)(ii)).",
    due_date: "2026-11-01T00:00:00Z",
    priority: "high",
    action_url: "/portal/requests/req-01",
  },
  waiting_on_client: [
    {
      id: "req-01",
      type: "document_request",
      title: "Upload IEEE Senior Member Grade Certificate",
      description: "Required to document membership in associations requiring outstanding achievement.",
      due_date: "2026-11-01T00:00:00Z",
      priority: "high",
      action_url: "/portal/requests/req-01",
    },
    {
      id: "req-02",
      type: "document_request",
      title: "Action Needed: Re-upload Master's Diploma Translation",
      description: "Translator certificate was missing signature and ATA accreditation stamp. Please upload certified version.",
      due_date: "2026-10-25T00:00:00Z",
      priority: "critical",
      action_url: "/portal/requests/req-02",
    },
  ],
  waiting_on_firm: [
    {
      id: "firm-01",
      type: "drafting",
      title: "Formal Legal Brief & Kazarian Two-Part Argument Drafting",
      description: "Our Senior Immigration Attorney is synthesizing your exhibits into the formal USCIS petition brief.",
      priority: "medium",
    },
    {
      id: "firm-02",
      type: "firm_review",
      title: "Review of Submitted Recommendation Testimonial Letters",
      description: "Legal team is reviewing the independent standing of your external expert testimonials.",
      priority: "medium",
    },
  ],
  profile_completeness_percentage: 85.0,
  onboarding_completed: false,
};

export const FALLBACK_CLIENT_PROFILE: ClientProfileData = {
  id: "client-01",
  first_name: "Elena",
  last_name: "Rostova",
  email: "elena.rostova@stanford.edu",
  phone: "+1 (650) 555-0199",
  date_of_birth: "1988-04-12",
  nationality: "UKR",
  passport_verified: true,
  dependants: [
    {
      id: "dep-01",
      relationship_type: "spouse",
      first_name: "Alexander",
      last_name: "Rostov",
      email: "alex.rostov@example.com",
      phone: "+1 (650) 555-0188",
      nationality: "UKR",
      is_authorized_to_view_case: true,
    },
  ],
  cases: [
    {
      id: "case-01",
      case_number: "CASE-US-8841",
      title: "EB-1A Extraordinary Ability Immigrant Visa Petition",
      jurisdiction: "US",
      visa_category: "EB-1A",
      status: "gathering",
    },
  ],
  completeness_score: 90,
};

export const FALLBACK_QUESTIONNAIRE: ClientQuestionnaireItem = {
  id: "q-01",
  title: "EB-1A Extraordinary Ability Statutory Intake Questionnaire",
  status: "in_progress",
  completion_percentage: 65.0,
  sections: [
    {
      id: "biographical",
      title: "1. Biographical & Professional Identification",
      description: "Full legal name and professional affiliation matching official passport.",
      fields: [
        { id: "current_employer", label: "Current Employer or Institutional Affiliation", type: "text", required: true },
        { id: "job_title", label: "Current Professional Title", type: "text", required: true },
        { id: "field_of_expertise", label: "Specific Field of Extraordinary Ability", type: "text", required: true },
      ],
    },
    {
      id: "scholarly_publications",
      title: "2. Scholarly Articles & Citations",
      description: "Published articles in major journals or international conference proceedings.",
      fields: [
        { id: "total_articles_count", label: "Approximate total number of peer-reviewed articles published", type: "number", required: true },
        { id: "google_scholar_link", label: "Google Scholar or Scopus Profile URL", type: "url", required: false },
      ],
    },
  ],
  responses: {
    current_employer: "Stanford University School of Medicine",
    job_title: "Senior Research Scientist in Computational Genomics",
    field_of_expertise: "Machine Learning applied to Cancer Genomics",
    total_articles_count: 14,
    google_scholar_link: "https://scholar.google.com/citations?user=sample_rostova",
  },
  reviewer_notes: "Strong scholarly publication record with high citation impact.",
};

// --- API METHODS ---

const isLiveBackend = false;
const API_BASE = API_BASE_URL;

export async function fetchDocumentRequests(caseId?: string, statusFilter?: string): Promise<DocumentRequestItem[]> {
  if (isLiveBackend) {
    try {
      const params = new URLSearchParams();
      if (caseId) params.append("case_id", caseId);
      if (statusFilter) params.append("status", statusFilter);
      const res = await fetch(`${API_BASE}/requests?${params.toString()}`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  let filtered = [...FALLBACK_DOCUMENT_REQUESTS];
  if (caseId) filtered = filtered.filter((r) => r.case_id === caseId);
  if (statusFilter) filtered = filtered.filter((r) => r.status === statusFilter);
  return filtered;
}

export async function createDocumentRequest(payload: Partial<DocumentRequestItem>): Promise<DocumentRequestItem> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  const created: DocumentRequestItem = {
    id: `req-${Date.now()}`,
    case_id: payload.case_id || "case-01",
    requested_from_client_id: payload.requested_from_client_id || "client-01",
    title: payload.title || "New Evidence Request",
    description: payload.description || "",
    category: payload.category || "supporting_evidence",
    rationale: payload.rationale || "Required for statutory criteria",
    statutory_requirement_code: payload.statutory_requirement_code,
    accepted_formats: payload.accepted_formats || ["application/pdf"],
    acceptable_alternatives: payload.acceptable_alternatives,
    due_date: payload.due_date,
    instructions: payload.instructions,
    translation_guidance: payload.translation_guidance,
    status: "requested",
    status_history: [{ status: "requested", changed_by: "Staff", timestamp: new Date().toISOString() }],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    comments_count: 0,
  };
  FALLBACK_DOCUMENT_REQUESTS.unshift(created);
  return created;
}

export async function respondToDocumentRequest(
  requestId: string,
  documentId: string,
  notes?: string
): Promise<DocumentRequestItem> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/requests/${requestId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: documentId, response_notes: notes }),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  const item = FALLBACK_DOCUMENT_REQUESTS.find((r) => r.id === requestId);
  if (item) {
    item.status = "submitted";
    item.fulfilled_document_id = documentId;
    item.rejection_reason = undefined;
    item.status_history.push({
      status: "submitted",
      changed_by: "Client",
      timestamp: new Date().toISOString(),
      notes: notes || "Submitted evidence file",
    });
    return { ...item };
  }
  throw new Error(`Request ${requestId} not found`);
}

export async function reviewDocumentRequest(
  requestId: string,
  decision: "approved" | "rejected",
  rejectionReason?: string,
  reviewNotes?: string
): Promise<DocumentRequestItem> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/requests/${requestId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, rejection_reason: rejectionReason, review_notes: reviewNotes }),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  const item = FALLBACK_DOCUMENT_REQUESTS.find((r) => r.id === requestId);
  if (item) {
    item.status = decision;
    item.rejection_reason = decision === "rejected" ? rejectionReason : undefined;
    item.status_history.push({
      status: decision,
      changed_by: "Legal Reviewer",
      timestamp: new Date().toISOString(),
      notes: reviewNotes,
      rejection_reason: rejectionReason,
    });
    return { ...item };
  }
  throw new Error(`Request ${requestId} not found`);
}

export async function replaceDocumentRequestEvidence(
  requestId: string,
  replacementDocId: string,
  explanation?: string
): Promise<DocumentRequestItem> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/requests/${requestId}/replace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replacement_document_id: replacementDocId, explanation }),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  const item = FALLBACK_DOCUMENT_REQUESTS.find((r) => r.id === requestId);
  if (item) {
    item.status = "submitted";
    item.fulfilled_document_id = replacementDocId;
    item.rejection_reason = undefined;
    item.status_history.push({
      status: "submitted",
      changed_by: "Client",
      timestamp: new Date().toISOString(),
      notes: `Replaced evidence document: ${explanation || ""}`,
    });
    return { ...item };
  }
  throw new Error(`Request ${requestId} not found`);
}

export async function fetchMessageThreads(caseId?: string): Promise<MessageThreadItem[]> {
  if (isLiveBackend) {
    try {
      const params = caseId ? `?case_id=${caseId}` : "";
      const res = await fetch(`${API_BASE}/messaging/threads${params}`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  return [...FALLBACK_MESSAGE_THREADS];
}

export async function fetchThreadMessages(threadId: string): Promise<ThreadMessageItem[]> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/messaging/threads/${threadId}/messages`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  return FALLBACK_THREAD_MESSAGES.filter((m) => m.thread_id === threadId);
}

export async function postThreadMessage(
  threadId: string,
  content: string,
  isInternal: boolean = false,
  attachments: string[] = []
): Promise<ThreadMessageItem> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/messaging/threads/${threadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, is_internal: isInternal, attachment_document_ids: attachments }),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  const msg: ThreadMessageItem = {
    id: `msg-${Date.now()}`,
    thread_id: threadId,
    sender_id: "current-user",
    sender_name: isInternal ? "Staff Member" : "Client User",
    sender_role: isInternal ? "lawyer" : "client",
    content,
    is_internal: isInternal,
    attachment_document_ids: attachments,
    delivery_status: "delivered",
    created_at: new Date().toISOString(),
  };
  FALLBACK_THREAD_MESSAGES.push(msg);
  return msg;
}

export async function fetchClientWaitingState(caseId?: string): Promise<WaitingStateData> {
  if (isLiveBackend) {
    try {
      const params = caseId ? `?case_id=${caseId}` : "";
      const res = await fetch(`${API_BASE}/portal/waiting-state${params}`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  return { ...FALLBACK_WAITING_STATE };
}

export async function fetchClientProfile(): Promise<ClientProfileData> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/portal/profile`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  return { ...FALLBACK_CLIENT_PROFILE };
}

export async function fetchQuestionnaires(caseId?: string): Promise<ClientQuestionnaireItem[]> {
  if (isLiveBackend) {
    try {
      const params = caseId ? `?case_id=${caseId}` : "";
      const res = await fetch(`${API_BASE}/portal/questionnaires${params}`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  return [{ ...FALLBACK_QUESTIONNAIRE }];
}

export async function saveQuestionnaire(
  questionnaireId: string,
  responses: Record<string, any>,
  submitForReview: boolean = false
): Promise<any> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/portal/questionnaires/${questionnaireId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses, submit_for_review: submitForReview }),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  FALLBACK_QUESTIONNAIRE.responses = { ...FALLBACK_QUESTIONNAIRE.responses, ...responses };
  if (submitForReview) {
    FALLBACK_QUESTIONNAIRE.status = "submitted";
  }
  return { status: "ok", questionnaire_status: FALLBACK_QUESTIONNAIRE.status };
}

// ==========================================
// PHASE 8: FORMS, READINESS & PACKAGE BUILDER
// ==========================================

export const FALLBACK_FORM_SCHEMAS: FormSchemaItem[] = [
  {
    id: "schema-i140",
    form_code: "USCIS_I140",
    name: "Form I-140: Immigrant Petition for Alien Workers",
    jurisdiction: "US",
    pathway: "EB-1A",
    description: "Petition to classify an alien as eligible for an immigrant visa under INA § 203(b)(1)(A).",
    versions: [
      {
        id: "ver-i140-2026",
        version_number: "v2026.1",
        is_active: true,
        effective_date: "2026-01-01",
        schema_definition: {
          sections: [
            {
              id: "part1_petitioner",
              title: "Part 1. Information About the Person or Organization Filing This Petition",
              description: "Petitioner identifying and contact information.",
              fields: [
                {
                  key: "petitioner_is_self",
                  label: "Is the beneficiary self-petitioning?",
                  field_type: "boolean",
                  required: true,
                  default: true,
                  source_mapping_hint: "case.is_self_petition",
                },
                {
                  key: "petitioner_family_name",
                  label: "Family Name (Last Name)",
                  field_type: "text",
                  required: true,
                  source_mapping_hint: "profile.last_name",
                },
                {
                  key: "petitioner_given_name",
                  label: "Given Name (First Name)",
                  field_type: "text",
                  required: true,
                  source_mapping_hint: "profile.first_name",
                },
                {
                  key: "petitioner_company_name",
                  label: "Company or Organization Name (if petitioning entity)",
                  field_type: "text",
                  required: false,
                  conditional: {
                    depends_on_field: "petitioner_is_self",
                    operator: "equals",
                    expected_value: false,
                  },
                },
                {
                  key: "petitioner_email",
                  label: "Primary Contact Email Address",
                  field_type: "text",
                  required: true,
                  validation_rules: { regex: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" },
                  source_mapping_hint: "profile.email",
                },
              ],
            },
            {
              id: "part2_petition_type",
              title: "Part 2. Petition Type & Classification",
              description: "Select the statutory immigrant classification being sought.",
              fields: [
                {
                  key: "visa_classification",
                  label: "Requested Immigrant Classification",
                  field_type: "select",
                  required: true,
                  options: [
                    { value: "EB1A_EXTRAORDINARY", label: "Alien of Extraordinary Ability (INA § 203(b)(1)(A))" },
                    { value: "EB1B_PROFESSOR", label: "Outstanding Professor or Researcher (INA § 203(b)(1)(B))" },
                    { value: "EB1C_MANAGER", label: "Multinational Executive or Manager (INA § 203(b)(1)(C))" },
                    { value: "EB2_NIW", label: "Member of Professions with Advanced Degree / NIW (INA § 203(b)(2))" },
                  ],
                  default: "EB1A_EXTRAORDINARY",
                  source_mapping_hint: "case.visa_category",
                },
              ],
            },
            {
              id: "part3_beneficiary_bio",
              title: "Part 3. Information About the Alien (Beneficiary)",
              description: "Biographical data and identity identifiers matching passport.",
              fields: [
                {
                  key: "beneficiary_family_name",
                  label: "Beneficiary Family Name (Last Name)",
                  field_type: "text",
                  required: true,
                  source_mapping_hint: "profile.last_name",
                },
                {
                  key: "beneficiary_given_name",
                  label: "Beneficiary Given Name (First Name)",
                  field_type: "text",
                  required: true,
                  source_mapping_hint: "profile.first_name",
                },
                {
                  key: "beneficiary_passport_number",
                  label: "Passport Number",
                  field_type: "text",
                  required: true,
                  source_mapping_hint: "doc.ocr.passport_number",
                },
                {
                  key: "beneficiary_country_of_citizenship",
                  label: "Country of Citizenship or Nationality",
                  field_type: "text",
                  required: true,
                  source_mapping_hint: "profile.nationality",
                },
                {
                  key: "beneficiary_alien_number",
                  label: "Alien Registration Number (A-Number, if any)",
                  field_type: "text",
                  required: false,
                  validation_rules: { regex: "^A?\\d{9}$" },
                  source_mapping_hint: "doc.ocr.alien_number",
                },
              ],
            },
            {
              id: "part4_processing",
              title: "Part 4. Processing Information & Sensitive Inadmissibility Background",
              description: "Statutory background questions requiring certified legal counsel review.",
              fields: [
                {
                  key: "prior_removal_or_criminal_record",
                  label: "Has the beneficiary ever been in removal proceedings or convicted of a criminal offense?",
                  field_type: "boolean",
                  required: true,
                  is_sensitive: true,
                  default: false,
                },
                {
                  key: "removal_details_notes",
                  label: "Explanation of Prior Proceedings / Incidents (if applicable)",
                  field_type: "textarea",
                  required: false,
                  conditional: {
                    depends_on_field: "prior_removal_or_criminal_record",
                    operator: "equals",
                    expected_value: true,
                  },
                },
              ],
            },
            {
              id: "part8_endeavor",
              title: "Part 8. Proposed Endeavor & Extraordinary Ability Rationale",
              description: "Summary statement of proposed national importance endeavor.",
              fields: [
                {
                  key: "proposed_endeavor_summary",
                  label: "Proposed Endeavor Statement (Drafted by AI Synthesis)",
                  field_type: "textarea",
                  required: true,
                  source_mapping_hint: "case.title",
                },
                {
                  key: "soc_code",
                  label: "Standard Occupational Classification (SOC Code)",
                  field_type: "text",
                  required: true,
                  default: "19-1029",
                },
              ],
            },
          ],
        },
      },
    ],
  },
];

export const FALLBACK_FORM_SUBMISSION: FormSubmissionItem = {
  id: "sub-i140-01",
  case_id: "case-01",
  form_code: "USCIS_I140",
  form_name: "Form I-140: Immigrant Petition for Alien Workers",
  version_number: "v2026.1",
  status: "draft",
  completion_percentage: 82.5,
  has_unconfirmed_ai_fields: true,
  sensitive_fields_reviewed: false,
  revision_number: 1,
  reviewer_notes: null,
  reviewed_at: null,
  answers: {
    petitioner_is_self: {
      value: true,
      source_type: "client_profile",
      source_id: "case-01",
      source_label: "Case Filing Structure (Self-Petition)",
      is_confirmed: true,
      confirmed_by_user_id: "22222222-2222-2222-2222-222222222222",
      confirmed_at: "2026-10-10T12:00:00Z",
    },
    petitioner_family_name: {
      value: "Rostova",
      source_type: "client_profile",
      source_id: "client-01",
      source_label: "Client Profile (Elena Rostova)",
      is_confirmed: true,
      confirmed_by_user_id: "22222222-2222-2222-2222-222222222222",
      confirmed_at: "2026-10-10T12:00:00Z",
    },
    petitioner_given_name: {
      value: "Elena",
      source_type: "client_profile",
      source_id: "client-01",
      source_label: "Client Profile (Elena Rostova)",
      is_confirmed: true,
      confirmed_by_user_id: "22222222-2222-2222-2222-222222222222",
      confirmed_at: "2026-10-10T12:00:00Z",
    },
    petitioner_email: {
      value: "elena.rostova@example.com",
      source_type: "client_profile",
      source_id: "client-01",
      source_label: "Client Profile Primary Email",
      is_confirmed: true,
      confirmed_by_user_id: "22222222-2222-2222-2222-222222222222",
      confirmed_at: "2026-10-10T12:00:00Z",
    },
    visa_classification: {
      value: "EB1A_EXTRAORDINARY",
      source_type: "client_profile",
      source_id: "case-01",
      source_label: "Case Visa Category Designation",
      is_confirmed: true,
      confirmed_by_user_id: "22222222-2222-2222-2222-222222222222",
      confirmed_at: "2026-10-10T12:00:00Z",
    },
    beneficiary_family_name: {
      value: "Rostova",
      source_type: "client_profile",
      source_id: "client-01",
      source_label: "Client Profile (Elena Rostova)",
      is_confirmed: true,
      confirmed_by_user_id: "22222222-2222-2222-2222-222222222222",
      confirmed_at: "2026-10-10T12:00:00Z",
    },
    beneficiary_given_name: {
      value: "Elena",
      source_type: "client_profile",
      source_id: "client-01",
      source_label: "Client Profile (Elena Rostova)",
      is_confirmed: true,
      confirmed_by_user_id: "22222222-2222-2222-2222-222222222222",
      confirmed_at: "2026-10-10T12:00:00Z",
    },
    beneficiary_passport_number: {
      value: "EP8849201",
      source_type: "document_ocr",
      source_id: "doc-01",
      source_label: "Verified OCR: Elena_Rostova_Passport_Bio.pdf",
      is_confirmed: false,
      confirmed_by_user_id: null,
      confirmed_at: null,
    },
    beneficiary_country_of_citizenship: {
      value: "Germany",
      source_type: "client_profile",
      source_id: "client-01",
      source_label: "Client Nationality Record",
      is_confirmed: true,
      confirmed_by_user_id: "22222222-2222-2222-2222-222222222222",
      confirmed_at: "2026-10-10T12:00:00Z",
    },
    prior_removal_or_criminal_record: {
      value: false,
      source_type: "user_provided",
      source_id: null,
      source_label: "Intake Questionnaire Declaration",
      is_confirmed: false,
      confirmed_by_user_id: null,
      confirmed_at: null,
    },
    proposed_endeavor_summary: {
      value: "Developing fault-tolerant quantum optical neural networks and algorithms to advance high-performance computing in the United States.",
      source_type: "ai_generated",
      source_id: "case-01",
      source_label: "AI Extracted Proposed Endeavor (Draft Synthesis)",
      is_confirmed: false,
      confirmed_by_user_id: null,
      confirmed_at: null,
    },
    soc_code: {
      value: "19-1029",
      source_type: "user_provided",
      source_id: null,
      source_label: "Default Regulatory SOC Mapping",
      is_confirmed: true,
      confirmed_by_user_id: "22222222-2222-2222-2222-222222222222",
      confirmed_at: "2026-10-10T12:00:00Z",
    },
  },
  schema_definition: FALLBACK_FORM_SCHEMAS[0].versions[0].schema_definition,
  revision_history: [
    {
      revision: 1,
      updated_by: "System Intake Auto-Populator",
      timestamp: "2026-10-10T12:00:00Z",
      changes_summary: "Initial draft auto-populated from Client Profile and verified Passport OCR.",
    },
  ],
};

export const FALLBACK_READINESS_CHECKLIST: PackageReadinessChecklist = {
  case_id: "case-01",
  case_number: "CASE-US-8841",
  evaluated_at: new Date().toISOString(),
  is_ready_for_package_assembly: true,
  total_checks_evaluated: 10,
  passed_checks_count: 7,
  blocking_failures_count: 0,
  warnings_count: 3,
  prohibition_disclaimer: "Deterministic internal readiness evaluation only. In compliance with strict legal ethics, this platform does not calculate or display a probability of government approval.",
  checks: [
    {
      code: "applicable_requirements",
      name: "Applicable Statutory Requirements",
      status: "passed",
      is_blocking: true,
      summary: "3 of 3 mandatory statutory rules evaluated under INA § 203(b)(1)(A).",
      details: { rules_evaluated: ["USCIS_EB1A_MAJOR_PRIZE", "USCIS_EB1A_ORIGINAL_CONTRIBUTIONS", "USCIS_EB1A_SCHOLARLY_ARTICLES"] },
    },
    {
      code: "evidence_received",
      name: "Evidence Documents Received",
      status: "passed",
      is_blocking: true,
      summary: "4 verified evidence documents uploaded and cryptographically hashed.",
      details: { verified_documents_count: 4 },
    },
    {
      code: "missing_evidence",
      name: "Missing Evidence Gaps",
      status: "passed",
      is_blocking: true,
      summary: "All mandatory evidentiary categories have at least one uploaded document.",
      details: { missing_categories: [] },
    },
    {
      code: "unresolved_findings",
      name: "Unresolved AI Findings & Discrepancies",
      status: "warning",
      is_blocking: false,
      summary: "1 informational finding remains open for attorney review.",
      details: { open_findings_count: 1, critical_count: 0 },
    },
    {
      code: "unverified_extracted_fields",
      name: "Unverified Extracted Fields",
      status: "warning",
      is_blocking: false,
      summary: "1 extracted document field (passport number) awaits human confirmation.",
      details: { unconfirmed_fields: ["beneficiary_passport_number"] },
    },
    {
      code: "expired_outdated_documents",
      name: "Expired or Outdated Documents",
      status: "passed",
      is_blocking: true,
      summary: "All identity and civil documents remain valid through at least 2028.",
      details: { expired_count: 0 },
    },
    {
      code: "incomplete_forms",
      name: "Incomplete Application Forms",
      status: "passed",
      is_blocking: true,
      summary: "Form I-140 draft answers 82.5% complete; all mandatory questions answered.",
      details: { forms_evaluated: 1, incomplete_count: 0 },
    },
    {
      code: "outstanding_client_responses",
      name: "Outstanding Client Requests",
      status: "passed",
      is_blocking: true,
      summary: "All client document requests have been responded to and uploaded.",
      details: { open_requests_count: 0 },
    },
    {
      code: "pending_reviewer_decisions",
      name: "Pending Reviewer Decisions",
      status: "warning",
      is_blocking: false,
      summary: "Sensitive background fields review is awaiting partner certification.",
      details: { sensitive_fields_reviewed: false },
    },
    {
      code: "unmet_package_validation_criteria",
      name: "Unmet Package Assembly Criteria",
      status: "passed",
      is_blocking: true,
      summary: "All core folder templates and manifest criteria satisfied for assembly.",
      details: { criteria_satisfied: true },
    },
  ],
};

export const FALLBACK_FILING_PACKAGE: FilingPackageItem = {
  id: "pkg-01",
  case_id: "case-01",
  name: "Dr. Elena Rostova - EB-1A Immigrant Petition Package",
  version_number: "v1.0.0",
  status: "in_review",
  package_hash: "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
  folder_template_name: "USCIS Standard Immigrant Petition Template",
  submission_method: "manual_filing",
  submission_instructions:
    "Assemble physical submission with two-hole top punch and exhibit tabs. Send via trackable courier (FedEx/UPS) to the designated USCIS Lockbox. Automated portal submission is strictly prohibited.",
  manifest: {
    package_generation_time: new Date().toISOString(),
    rule_version_used: "USCIS-EB1A-2026.2",
    items_count: 5,
    internal_items_count: 1,
    external_items_count: 4,
    merkle_root_hash: "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    items: [
      {
        file_name: "Case_Summary_Exhibits_Index.pdf",
        folder_code: "00_Case_Summary",
        folder_path: "00_Case_Summary/Case_Summary_Exhibits_Index.pdf",
        document_category: "case_summary",
        version: 1,
        sha256_hash: "d41d8cd98f00b204e9800998ecf8427e00000000000000000000000000000001",
        review_status: "verified",
        related_requirement_code: "CASE_OVERVIEW",
        is_internal_only: false,
        page_count: 4,
        file_size: "0.8 MB",
      },
      {
        file_name: "Elena_Rostova_Passport_Bio.pdf",
        folder_code: "01_Identity_and_Civil_Status",
        folder_path: "01_Identity_and_Civil_Status/Elena_Rostova_Passport_Bio.pdf",
        document_category: "identity_passport",
        version: 1,
        sha256_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        review_status: "verified",
        related_requirement_code: "IDENTITY_VERIFICATION",
        is_internal_only: false,
        page_count: 2,
        file_size: "2.4 MB",
      },
      {
        file_name: "Form_I140_Executed_Rev1.pdf",
        folder_code: "02_Application_Forms",
        folder_path: "02_Application_Forms/Form_I140_Executed_Rev1.pdf",
        document_category: "application_forms",
        version: 1,
        sha256_hash: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
        review_status: "pending_review",
        related_requirement_code: "USCIS_FORM_I140",
        is_internal_only: false,
        page_count: 8,
        file_size: "2.4 MB",
      },
      {
        file_name: "Major_Prize_Optics_Award_Cert.pdf",
        folder_code: "03_Pathway_Evidence",
        folder_path: "03_Pathway_Evidence/Major_Prize_Optics_Award_Cert.pdf",
        document_category: "supporting_evidence",
        version: 1,
        sha256_hash: "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3",
        review_status: "verified",
        related_requirement_code: "USCIS_EB1A_MAJOR_PRIZE",
        is_internal_only: false,
        page_count: 12,
        file_size: "4.1 MB",
      },
      {
        file_name: "Attorney_Confidential_Strategy_Memo.pdf",
        folder_code: "09_Internal_Review",
        folder_path: "09_Internal_Review/Attorney_Confidential_Strategy_Memo.pdf",
        document_category: "internal_review",
        version: 1,
        sha256_hash: "c3d4e5f6a7b8c3d4e5f6a7b8c3d4e5f6a7b8c3d4e5f6a7b8c3d4e5f6a7b8c3d4",
        review_status: "verified",
        related_requirement_code: "INTERNAL_LEGAL_ANALYSIS",
        is_internal_only: true, // EXCLUDED FROM SUBMISSION BUNDLE
        page_count: 5,
        file_size: "0.5 MB",
      },
    ],
  },
  approval_chain: [
    {
      stage: "evidence_and_forms_check",
      title: "1. Evidence and Form Check",
      status: "passed",
      actor: "Deterministic Readiness Engine",
      timestamp: "2026-10-10T14:00:00Z",
      notes: "0 blocking criteria detected. 10 of 10 checks evaluated.",
    },
    {
      stage: "findings_disposition",
      title: "2. Required Findings Resolution",
      status: "passed",
      actor: "Legal Caseworker (Sarah Jenkins)",
      timestamp: "2026-10-10T14:15:00Z",
      notes: "All critical findings disposed with cited evidence.",
    },
    {
      stage: "authorized_staff_review",
      title: "3. Authorized Staff Review",
      status: "approved",
      actor: "Sarah Jenkins (Paralegal)",
      timestamp: "2026-10-10T14:30:00Z",
      notes: "Checked document hashes and exhibit order tabs.",
    },
    {
      stage: "senior_review",
      title: "4. Senior Managing Attorney Review",
      status: "pending",
      actor: "Elena Vance (Managing Partner)",
      timestamp: null,
      notes: null,
    },
    {
      stage: "client_confirmation",
      title: "5. Client Confirmation",
      status: "pending",
      actor: "Dr. Elena Rostova",
      timestamp: null,
      notes: null,
    },
    {
      stage: "final_package_approval",
      title: "6. Final Package Approval",
      status: "pending",
      actor: "G-28 Signatory of Record",
      timestamp: null,
      notes: null,
    },
    {
      stage: "package_locked_export",
      title: "7. Package Lock & Export Generation",
      status: "pending",
      actor: "System Integrity Engine",
      timestamp: null,
      notes: null,
    },
  ],
  manual_filing_instructions: {
    jurisdiction: "USCIS (United States)",
    submission_method: "Trackable Express Courier (FedEx/UPS/USPS Priority Express)",
    primary_filing_address: "USCIS Texas Service Center, Attn: Premium I-140, 6046 N Belt Line Rd STE 110, Irving, TX 75038",
    filing_fee_usd: 715,
    portal_submission_disclaimer:
      "Automated government portal submission is explicitly disabled. Government regulations require manual wet-ink physical filing or verified attorney portal authentication.",
    steps: [
      "Download and inspect the submission bundle ZIP (internal materials in 09_Internal_Review are excluded).",
      "Print double-sided using 20lb paper; insert bottom tab exhibit dividers between folders 00 through 08.",
      "Fasten top using two-hole ACCO fasteners in standard legal order (G-28, Form I-140, Brief, Exhibits).",
      "Attach two separate cashier's checks: $715 (Form I-140 fee) + $300 (Asylum Program Fee).",
      "Ship via FedEx or UPS to the Texas Lockbox address above; log the courier tracking number in the system.",
    ],
  },
  created_at: new Date().toISOString(),
};

// API Fetchers
export async function fetchFormSchemas(jurisdiction?: string, pathway?: string): Promise<FormSchemaItem[]> {
  if (isLiveBackend) {
    try {
      const q = new URLSearchParams();
      if (jurisdiction) q.append("jurisdiction", jurisdiction);
      if (pathway) q.append("pathway", pathway);
      const res = await fetch(`${API_BASE}/forms/schemas?${q.toString()}`);
      if (res.ok) {
        const json = await res.json();
        return json.schemas || [];
      }
    } catch {
      // Fallback
    }
  }
  return FALLBACK_FORM_SCHEMAS;
}

export async function fetchFormSchemaDetail(schemaId: string): Promise<FormSchemaItem> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/forms/schemas/${schemaId}`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  return FALLBACK_FORM_SCHEMAS[0];
}

export async function fetchCaseFormSubmissions(caseId: string): Promise<FormSubmissionItem[]> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/forms/cases/${caseId}/submissions`);
      if (res.ok) {
        const json = await res.json();
        return json.submissions || [];
      }
    } catch {
      // Fallback
    }
  }
  return [{ ...FALLBACK_FORM_SUBMISSION, case_id: caseId }];
}

export async function fetchFormSubmission(submissionId: string): Promise<FormSubmissionItem> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/forms/submissions/${submissionId}`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  return FALLBACK_FORM_SUBMISSION;
}

export async function createFormSubmissionDraft(caseId: string, schemaVersionId?: string): Promise<FormSubmissionItem> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/forms/cases/${caseId}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema_version_id: schemaVersionId }),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  return { ...FALLBACK_FORM_SUBMISSION, case_id: caseId };
}

export async function updateFormAnswers(
  submissionId: string,
  answers: Record<string, any>,
  notes?: string
): Promise<FormSubmissionItem> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/forms/submissions/${submissionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, notes }),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  // Local fallback update
  const current = { ...FALLBACK_FORM_SUBMISSION };
  for (const [key, val] of Object.entries(answers)) {
    current.answers[key] = {
      value: val,
      source_type: "user_provided",
      source_label: "Manual User Input",
      is_confirmed: true,
      confirmed_by_user_id: "demo-user",
      confirmed_at: new Date().toISOString(),
    };
  }
  current.revision_number += 1;
  current.revision_history = [
    ...(current.revision_history || []),
    {
      revision: current.revision_number,
      updated_by: "Active Staff Member",
      timestamp: new Date().toISOString(),
      changes_summary: notes || `Updated ${Object.keys(answers).length} field answers`,
    },
  ];
  return current;
}

export async function confirmFormField(submissionId: string, fieldKey: string): Promise<any> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/forms/submissions/${submissionId}/confirm-field`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field_key: fieldKey }),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  if (FALLBACK_FORM_SUBMISSION.answers[fieldKey]) {
    FALLBACK_FORM_SUBMISSION.answers[fieldKey].is_confirmed = true;
    FALLBACK_FORM_SUBMISSION.answers[fieldKey].confirmed_at = new Date().toISOString();
  }
  return { success: true, field_key: fieldKey };
}

export async function reviewSensitiveFields(submissionId: string, notes: string): Promise<any> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/forms/submissions/${submissionId}/review-sensitive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  FALLBACK_FORM_SUBMISSION.sensitive_fields_reviewed = true;
  FALLBACK_FORM_SUBMISSION.reviewer_notes = notes;
  FALLBACK_FORM_SUBMISSION.reviewed_at = new Date().toISOString();
  return { success: true, sensitive_fields_reviewed: true };
}

export async function fetchCaseReadinessChecklist(caseId: string): Promise<PackageReadinessChecklist> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/packages/cases/${caseId}/readiness`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  return { ...FALLBACK_READINESS_CHECKLIST, case_id: caseId };
}

export async function buildFilingPackage(
  caseId: string,
  name: string,
  templateId?: string
): Promise<FilingPackageItem> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/packages/cases/${caseId}/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, template_id: templateId }),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  return { ...FALLBACK_FILING_PACKAGE, case_id: caseId, name };
}

export async function fetchCaseFilingPackages(caseId: string): Promise<FilingPackageItem[]> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/packages/cases/${caseId}/packages`);
      if (res.ok) {
        const json = await res.json();
        return json.packages || [];
      }
    } catch {
      // Fallback
    }
  }
  return [{ ...FALLBACK_FILING_PACKAGE, case_id: caseId }];
}

export async function fetchFilingPackage(packageId: string): Promise<FilingPackageItem> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/packages/${packageId}`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  return FALLBACK_FILING_PACKAGE;
}

export async function advancePackageApproval(
  packageId: string,
  stage: string,
  decision: string,
  notes?: string
): Promise<FilingPackageItem> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/packages/${packageId}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, decision, notes }),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  const current = { ...FALLBACK_FILING_PACKAGE };
  const target = current.approval_chain.find((s) => s.stage === stage);
  if (target) {
    target.status = decision === "approved" ? "approved" : "rejected";
    target.timestamp = new Date().toISOString();
    target.notes = notes || null;
  }
  return current;
}

export async function exportFilingPackage(packageId: string): Promise<any> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/packages/${packageId}/export`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  return {
    package_id: packageId,
    version_number: FALLBACK_FILING_PACKAGE.version_number,
    package_hash: FALLBACK_FILING_PACKAGE.package_hash,
    manifest: FALLBACK_FILING_PACKAGE.manifest,
    approval_chain: FALLBACK_FILING_PACKAGE.approval_chain,
    manual_filing_instructions: FALLBACK_FILING_PACKAGE.manual_filing_instructions,
  };
}

// ==========================================
// PHASE 9: OWNER ANALYTICS, COMPANY MANAGEMENT & BILLING
// ==========================================

export const FALLBACK_SERVICES: ServiceCatalogItem[] = [
  {
    id: "srv-01",
    code: "EB1A_PETITION",
    name: "US EB-1A Extraordinary Ability Immigrant Petition",
    description: "Comprehensive legal brief, evidentiary compilation, Form I-140 preparation, and attorney representation.",
    jurisdiction: "US",
    visa_category: "EB-1A",
    pricing_model: "fixed",
    base_fee: 8500.0,
    currency: "USD",
    estimated_duration_days: 90,
    is_active: true,
  },
  {
    id: "srv-02",
    code: "EB2_NIW_PETITION",
    name: "US EB-2 National Interest Waiver Immigrant Petition",
    description: "Matter of Dhanasar statutory brief, proposed endeavor analysis, Form I-140 petition.",
    jurisdiction: "US",
    visa_category: "EB-2 NIW",
    pricing_model: "fixed",
    base_fee: 7500.0,
    currency: "USD",
    estimated_duration_days: 75,
    is_active: true,
  },
  {
    id: "srv-03",
    code: "O1A_PETITION",
    name: "US O-1A Nonimmigrant Alien of Extraordinary Ability",
    description: "Form I-129 assembly, peer advisory consultation, expert opinion letter drafting.",
    jurisdiction: "US",
    visa_category: "O-1A",
    pricing_model: "fixed",
    base_fee: 6500.0,
    currency: "USD",
    estimated_duration_days: 45,
    is_active: true,
  },
  {
    id: "srv-04",
    code: "CONSULTATION_INITIAL",
    name: "Initial Immigration Strategy & Eligibility Assessment",
    description: "Comprehensive 60-minute case evaluation, CV appraisal, and statutory pathway recommendation.",
    jurisdiction: "US",
    visa_category: "ALL",
    pricing_model: "fixed",
    base_fee: 350.0,
    currency: "USD",
    estimated_duration_days: 1,
    is_active: true,
  },
];

export const FALLBACK_ENGAGEMENTS: ClientEngagementItem[] = [
  {
    id: "eng-01",
    engagement_number: "ENG-2026-0001",
    client_id: "client-01",
    case_id: "case-01",
    service_id: "srv-01",
    status: "active",
    retainer_amount: 4250.0,
    agreed_fee: 8500.0,
    billing_terms: "fixed_split",
    responsible_attorney_id: "usr-01",
    signed_agreement_date: "2026-09-15T10:00:00Z",
    notes: "50% retainer on engagement signing, 50% prior to filing package lock.",
    created_at: "2026-09-15T10:00:00Z",
  },
];

export const FALLBACK_INVOICES: InvoiceDetailItem[] = [
  {
    id: "inv-01",
    invoice_number: "INV-2026-0001",
    client_id: "client-01",
    client_name: "Dr. Elena Rostova",
    case_id: "case-01",
    issue_date: "2026-09-15T10:00:00Z",
    due_date: "2026-10-15T10:00:00Z",
    subtotal: 4250.0,
    tax_amount: 0.0,
    discount_amount: 0.0,
    total_amount: 4250.0,
    paid_amount: 4250.0,
    balance_due: 0.0,
    currency: "USD",
    status: "paid",
    payment_provider: "stripe_verified",
    notes: "Retainer Phase 1 received via verified ACH transfer.",
    line_items_count: 1,
    line_items: [
      {
        id: "li-01",
        description: "EB-1A Retainer Fee (Phase 1)",
        quantity: 1,
        unit_price: 4250.0,
        total: 4250.0,
        line_type: "service_fee",
      },
    ],
    payments: [
      {
        id: "pay-01",
        transaction_reference: "txn_stripe_tok_99182371",
        amount: 4250.0,
        currency: "USD",
        payment_method: "ach_bank_transfer",
        status: "succeeded",
        card_brand: null,
        card_last4: null,
        payment_date: "2026-09-15T14:30:00Z",
      },
    ],
  },
  {
    id: "inv-02",
    invoice_number: "INV-2026-0002",
    client_id: "client-01",
    client_name: "Dr. Elena Rostova",
    case_id: "case-01",
    issue_date: "2026-10-01T09:00:00Z",
    due_date: "2026-10-31T09:00:00Z",
    subtotal: 4965.0,
    tax_amount: 0.0,
    discount_amount: 0.0,
    total_amount: 4965.0,
    paid_amount: 0.0,
    balance_due: 4965.0,
    currency: "USD",
    status: "issued",
    payment_provider: "stripe_verified",
    notes: "Filing Phase: Final representation fee + Form I-140 statutory government filing fee.",
    line_items_count: 2,
    line_items: [
      {
        id: "li-02",
        description: "EB-1A Final Representation Fee (Phase 2)",
        quantity: 1,
        unit_price: 4250.0,
        total: 4250.0,
        line_type: "service_fee",
      },
      {
        id: "li-03",
        description: "USCIS Form I-140 Statutory Government Filing Fee",
        quantity: 1,
        unit_price: 715.0,
        total: 715.0,
        line_type: "filing_fee",
      },
    ],
    payments: [],
  },
];

export const FALLBACK_FINANCIAL_REPORTS: FinancialReportsData = {
  period: {
    start_date: "2026-08-01T00:00:00Z",
    end_date: "2026-10-11T23:59:59Z",
  },
  summary: {
    total_invoiced: 9215.0,
    total_collected: 4250.0,
    total_outstanding: 4965.0,
    total_refunded: 0.0,
    net_collections: 4250.0,
    currency: "USD",
  },
  accounts_receivable_aging: {
    current_not_due: 4965.0,
    overdue_1_to_30_days: 0.0,
    overdue_31_to_60_days: 0.0,
    overdue_61_to_90_days: 0.0,
    overdue_greater_90_days: 0.0,
    total_overdue: 0.0,
  },
  collections_by_pathway: {
    "EB-1A": 4250.0,
  },
  invoice_counts: {
    total: 2,
    paid: 1,
    issued: 1,
    partially_paid: 0,
    overdue: 0,
  },
};

export const FALLBACK_WORKLOAD: StaffWorkloadItem[] = [
  {
    user_id: "usr-01",
    full_name: "Sarah Jenkins, Esq.",
    email: "sarah.jenkins@leximmigration.com",
    roles: ["case_manager", "senior_reviewer"],
    assigned_cases: 12,
    pending_tasks: 4,
    nominal_capacity: 25,
    utilization_pct: 48.0,
    status: "normal",
    branch_id: "branch-01",
    team_id: "team-01",
  },
  {
    user_id: "usr-02",
    full_name: "Marcus Reed",
    email: "marcus.reed@leximmigration.com",
    roles: ["case_manager"],
    assigned_cases: 18,
    pending_tasks: 7,
    nominal_capacity: 25,
    utilization_pct: 72.0,
    status: "normal",
    branch_id: "branch-01",
    team_id: "team-01",
  },
  {
    user_id: "usr-03",
    full_name: "Elena Vance, Managing Partner",
    email: "elena.vance@leximmigration.com",
    roles: ["company_admin", "master_admin"],
    assigned_cases: 4,
    pending_tasks: 2,
    nominal_capacity: 25,
    utilization_pct: 16.0,
    status: "normal",
    branch_id: "branch-01",
    team_id: "team-01",
  },
];

export const FALLBACK_EXECUTIVE_DASHBOARD: ExecutiveDashboardData = {
  time_window_days: 30,
  generated_at: "2026-10-11T21:00:00Z",
  metrics: {
    active_cases: {
      value: 6,
      total_cases: 8,
      calculation_method: "Count of immigration cases with status NOT IN ('approved', 'closed', 'denied', 'withdrawn')",
      time_window: "Current active snapshot",
      drill_down_path: "/cases?status=active",
      status: "available",
    },
    new_retained_clients: {
      value: 3,
      total_clients: 6,
      calculation_method: "Count of client profiles created within the last 30 days",
      time_window: "Last 30 days",
      drill_down_path: "/clients?filter=new_retained",
      status: "available",
    },
    cases_by_country_and_pathway: {
      value: null,
      by_country: { US: 4, CA: 1, GB: 1 },
      by_pathway: { "EB-1A": 3, "EB-2 NIW": 1, "Express Entry": 1, "Global Talent": 1 },
      calculation_method: "Active cases grouped by jurisdiction code and visa category",
      time_window: "Current active caseload",
      drill_down_path: "/cases",
      status: "available",
    },
    cases_by_workflow_stage: {
      value: null,
      stages: { intake: 2, gathering: 2, review: 1, ready: 1, approved: 2 },
      calculation_method: "All organization cases grouped by workflow status",
      time_window: "All-time case repository",
      drill_down_path: "/cases?filter=by_stage",
      status: "available",
    },
    cases_needing_attention: {
      value: 2,
      items: [
        {
          case_id: "case-01",
          case_number: "CASE-US-8841",
          title: "Dr. Elena Rostova EB-1A",
          reasons: ["Unresolved statutory discrepancies", "Overdue task deadlines"],
        },
        {
          case_id: "case-03",
          case_number: "CASE-US-9912",
          title: "Rajesh Patel EB-2 NIW",
          reasons: ["Document OCR processing failure"],
        },
      ],
      calculation_method: "Distinct cases with open statutory discrepancies (CaseAIFinding), overdue tasks, or failed document scans",
      time_window: "Immediate attention backlog",
      drill_down_path: "/cases?filter=needing_attention",
      status: "available",
    },
    deadlines: {
      value: null,
      overdue_milestones: 1,
      overdue_tasks: 2,
      upcoming_milestones_14d: 3,
      upcoming_tasks_14d: 5,
      total_overdue: 3,
      total_upcoming: 8,
      calculation_method: "Milestones and tasks past due date with status != 'completed', plus upcoming within 14 days",
      time_window: "Past due + next 14 days",
      drill_down_path: "/cases/deadlines",
      status: "available",
    },
    unassigned_cases: {
      value: 1,
      sample: [{ id: "case-04", case_number: "CASE-CA-4412", title: "Express Entry Federal Skilled Worker" }],
      calculation_method: "Active cases with zero CaseAssignment records",
      time_window: "Current active cases",
      drill_down_path: "/cases?filter=unassigned",
      status: "available",
    },
    staff_workload_and_capacity: {
      value: null,
      staff_members: FALLBACK_WORKLOAD,
      calculation_method: "Active case assignments and pending tasks per user against nominal capacity threshold (25 cases)",
      time_window: "Current staffing allocation",
      drill_down_path: "/teams/workload",
      status: "available",
    },
    applications_prepared_reviewed_submitted: {
      value: null,
      prepared: 3,
      reviewed: 2,
      submitted: 1,
      calculation_method: "FilingPackage records categorized into draft/assembly (prepared), review stages (reviewed), and version-locked (submitted)",
      time_window: "All filing packages",
      drill_down_path: "/packages",
      status: "available",
    },
    outstanding_client_requests: {
      value: 4,
      avg_days_pending: 6.4,
      calculation_method: "Count of DocumentRequest records with status='requested' and average elapsed days since request issuance",
      time_window: "Open evidentiary requests",
      drill_down_path: "/requests?status=requested",
      status: "available",
    },
    processing_failures: {
      value: 1,
      failed_documents: 1,
      failed_notifications: 0,
      total_failures: 1,
      calculation_method: "Documents with processing_status='failed' or infected scan, plus failed delivery notifications",
      time_window: "All-time failure log",
      drill_down_path: "/documents?status=failed",
      status: "available",
    },
    recent_company_activity: {
      value: null,
      items: [
        {
          id: "act-01",
          action: "billing.payment_recorded",
          object_type: "payment_record",
          object_id: "pay-01",
          occurred_at: "2026-10-11T19:40:00Z",
          actor_id: "usr-01",
          metadata: { invoice_number: "INV-2026-0001", amount: 4250.0 },
        },
        {
          id: "act-02",
          action: "packages.package_locked",
          object_type: "filing_package",
          object_id: "pkg-01",
          occurred_at: "2026-10-11T18:15:00Z",
          actor_id: "usr-03",
          metadata: { package_number: "PKG-US-EB1A-20261011-001" },
        },
      ],
      calculation_method: "Latest 15 immutable AuditEvent records for the organization",
      time_window: "Most recent events",
      drill_down_path: "/governance/audit-logs",
      status: "available",
    },
    financial_snapshot: {
      value: null,
      paid_revenue: 4250.0,
      outstanding_balance: 4965.0,
      currency: "USD",
      calculation_method: "Sum of paid_amount vs balance_due from issued organization invoices",
      time_window: "Accounts receivable ledger",
      drill_down_path: "/billing",
      status: "available",
    },
  },
};

export const FALLBACK_OPERATIONS_ANALYTICS: OperationsAnalyticsData = {
  filters_applied: {
    jurisdiction: "all",
    pathway: "all",
    stage: "all",
  },
  total_cases_in_window: 8,
  completed_cases_count: 2,
  turnaround_time: {
    average_days: 58.4,
    completed_cases_evaluated: 2,
    reopened_cases_adjusted_count: 0,
    incomplete_timestamp_cases_count: 0,
    calculation_formula: "mean(completion_timestamp - effective_start_timestamp); Reopened cases use reopening timestamp; in-progress cases excluded",
    status: "available",
  },
  overdue_work: {
    total_overdue: 3,
    overdue_less_than_7_days: 2,
    overdue_7_to_30_days: 1,
    overdue_greater_than_30_days: 0,
    calculation_formula: "Count of open milestones and tasks past target/due dates partitioned by lateness tiers",
    status: "available",
  },
  client_response_time: {
    average_hours: 46.2,
    average_days: 1.9,
    requests_evaluated: 6,
    calculation_formula: "mean(request_submitted_timestamp - request_created_timestamp) for all completed requests",
    status: "available",
  },
};

export const FALLBACK_ORG_SETTINGS: OrganizationSettingsData = {
  firm_name: "Lex Immigration Global Law Group",
  billing_currency: "USD",
  default_jurisdiction: "US",
  invoice_prefix: "INV",
  deadline_warning_days: 14,
  require_two_step_case_closure: true,
  allow_client_portal_billing: true,
};

// --- PHASE 9 CLIENT FUNCTIONS ---

export async function fetchExecutiveDashboard(windowDays = 30): Promise<ExecutiveDashboardData> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/analytics/dashboard/executive?window_days=${windowDays}`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  return FALLBACK_EXECUTIVE_DASHBOARD;
}

export async function fetchOperationsAnalytics(filters: Record<string, any> = {}): Promise<OperationsAnalyticsData> {
  if (isLiveBackend) {
    try {
      const query = new URLSearchParams(filters).toString();
      const res = await fetch(`${API_BASE}/analytics/operations?${query}`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  return FALLBACK_OPERATIONS_ANALYTICS;
}

export async function fetchServices(): Promise<ServiceCatalogItem[]> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/billing/services`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  return FALLBACK_SERVICES;
}

export async function createServiceItem(data: Partial<ServiceCatalogItem>): Promise<ServiceCatalogItem> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/billing/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  return {
    id: `srv-${Date.now()}`,
    code: data.code || "CUSTOM_SERVICE",
    name: data.name || "Custom Immigration Service",
    jurisdiction: data.jurisdiction || "US",
    pricing_model: data.pricing_model || "fixed",
    base_fee: data.base_fee || 500.0,
    currency: data.currency || "USD",
    estimated_duration_days: data.estimated_duration_days || 30,
    is_active: true,
  };
}

export async function fetchEngagements(clientId?: string): Promise<ClientEngagementItem[]> {
  if (isLiveBackend) {
    try {
      const url = clientId ? `${API_BASE}/billing/engagements?client_id=${clientId}` : `${API_BASE}/billing/engagements`;
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  return FALLBACK_ENGAGEMENTS;
}

export async function createEngagement(data: Partial<ClientEngagementItem>): Promise<ClientEngagementItem> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/billing/engagements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  return {
    id: `eng-${Date.now()}`,
    engagement_number: `ENG-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    client_id: data.client_id || "client-01",
    status: data.status || "active",
    retainer_amount: data.retainer_amount || 0,
    agreed_fee: data.agreed_fee || 0,
    billing_terms: data.billing_terms || "fixed_split",
    created_at: new Date().toISOString(),
  };
}

export async function fetchInvoices(filter: Record<string, any> = {}): Promise<InvoiceDetailItem[]> {
  if (isLiveBackend) {
    try {
      const query = new URLSearchParams(filter).toString();
      const res = await fetch(`${API_BASE}/billing/invoices?${query}`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  return FALLBACK_INVOICES;
}

export async function createInvoice(data: any): Promise<InvoiceDetailItem> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/billing/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  const total = (data.line_items || []).reduce((acc: number, l: any) => acc + (l.quantity * l.unit_price), 0);
  return {
    id: `inv-${Date.now()}`,
    invoice_number: `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    client_id: data.client_id || "client-01",
    issue_date: new Date().toISOString(),
    due_date: new Date(Date.now() + 30 * 86400000).toISOString(),
    subtotal: total,
    tax_amount: 0,
    discount_amount: 0,
    total_amount: total,
    paid_amount: 0,
    balance_due: total,
    currency: "USD",
    status: "issued",
    payment_provider: "stripe_verified",
    line_items: data.line_items,
  };
}

export async function recordInvoicePayment(invoiceId: string, data: any): Promise<any> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/billing/invoices/${invoiceId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  return {
    id: `pay-${Date.now()}`,
    transaction_reference: `txn_tok_${Date.now()}`,
    amount: data.amount,
    card_brand: data.card_brand || "visa",
    card_last4: data.card_last4 || "4242",
    status: "succeeded",
    invoice_status: "paid",
    balance_due: 0.0,
  };
}

export async function refundInvoicePayment(paymentId: string, data: any): Promise<any> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/billing/payments/${paymentId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  return {
    id: paymentId,
    refunded_amount: data.refund_amount || 100,
    status: "partially_refunded",
    invoice_status: "partially_paid",
  };
}

export async function fetchFinancialReports(startDate?: string, endDate?: string): Promise<FinancialReportsData> {
  if (isLiveBackend) {
    try {
      const query = new URLSearchParams({
        ...(startDate ? { start_date: startDate } : {}),
        ...(endDate ? { end_date: endDate } : {}),
      }).toString();
      const res = await fetch(`${API_BASE}/billing/reports/financial?${query}`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  return FALLBACK_FINANCIAL_REPORTS;
}

export async function fetchStaffWorkload(): Promise<StaffWorkloadItem[]> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/operations/workload`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  return FALLBACK_WORKLOAD;
}

export async function reassignWork(fromUserId: string, toUserId: string, opts: any = {}): Promise<any> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/operations/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from_user_id: fromUserId, to_user_id: toUserId, ...opts }),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  return {
    from_user_id: fromUserId,
    to_user_id: toUserId,
    cases_reassigned: 3,
    tasks_reassigned: 2,
    reassigned_at: new Date().toISOString(),
  };
}

export async function fetchOrganizationSettings(): Promise<OrganizationSettingsData> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/operations/settings`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  return FALLBACK_ORG_SETTINGS;
}

export async function updateOrganizationSetting(key: string, value: any): Promise<any> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/operations/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  return { [key]: value };
}

export async function fetchAccessReport(opts: any = {}): Promise<any[]> {
  if (isLiveBackend) {
    try {
      const query = new URLSearchParams(opts).toString();
      const res = await fetch(`${API_BASE}/operations/access-report?${query}`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  return FALLBACK_EXECUTIVE_DASHBOARD.metrics.recent_company_activity.items;
}

export async function exportAnalyticsReport(reportType = "executive_summary"): Promise<any> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/analytics/export?report_type=${reportType}`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  return {
    export_id: `exp-${Date.now()}`,
    report_type: reportType,
    exported_at: new Date().toISOString(),
    data: FALLBACK_EXECUTIVE_DASHBOARD,
  };
}

export async function inviteStaffMember(data: { email: string; role_code: string; branch?: string }): Promise<any> {
  if (isLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/organizations/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }
  return {
    id: `inv-${Date.now()}`,
    email: data.email,
    role_code: data.role_code,
    created_at: new Date().toISOString(),
  };
}


