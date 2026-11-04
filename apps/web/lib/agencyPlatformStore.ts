/**
 * Agency Onboarding, Co-Branded PR Calculator Lead Bridge & Documento HQ Control Plane Store
 *
 * Implements:
 * 1. Hybrid sync with `/api/backend/agency-platform/*` when FastAPI is live, plus deterministic
 *    localStorage persistence so every KYB submission, 1-click tenant provisioning, quota edit,
 *    2-hour Break-Glass Support Grant, and co-branded PR calculator lead works immediately.
 * 2. Strict mathematical reconciliation: every summary KPI is computed directly from the active
 *    tenant, KYB application, and lead arrays — zero hardcoded summary totals, zero raw client PII.
 */

export type AgencyPlanTier = "pilot_14d" | "boutique" | "growth" | "enterprise";
export type KybTrack = "regulated_counsel" | "overseas_consultancy";
export type KybStatus = "pending_kyb" | "clarification_requested" | "approved" | "rejected";
export type AgencyHealthStatus = "thriving" | "onboarding" | "at_risk" | "suspended";

export interface PlanTierSpec {
  id: AgencyPlanTier;
  label: string;
  mrrUsd: number;
  priceLabel: string;
  seatLimit: number;
  monthlyCaseQuota: number;
  monthlyAiExtractions: number;
  summary: string;
}

export const AGENCY_PLAN_SPECS: Record<AgencyPlanTier, PlanTierSpec> = {
  pilot_14d: {
    id: "pilot_14d",
    label: "14-Day KYB Pilot",
    mrrUsd: 0,
    priceLabel: "$0 / 14 days",
    seatLimit: 3,
    monthlyCaseQuota: 15,
    monthlyAiExtractions: 150,
    summary: "Full workflow evaluation for solo counsel or partner evaluation teams.",
  },
  boutique: {
    id: "boutique",
    label: "Boutique Practice",
    mrrUsd: 199,
    priceLabel: "$199 / mo",
    seatLimit: 6,
    monthlyCaseQuota: 50,
    monthlyAiExtractions: 600,
    summary: "Built for licensed RCIC, MARA, OISC/IAA, and boutique immigration practices.",
  },
  growth: {
    id: "growth",
    label: "Growth Consultancy",
    mrrUsd: 499,
    priceLabel: "$499 / mo",
    seatLimit: 18,
    monthlyCaseQuota: 180,
    monthlyAiExtractions: 2500,
    summary: "Multi-corridor visa firms with co-branded PR calculator lead capture & AI Lab.",
  },
  enterprise: {
    id: "enterprise",
    label: "Enterprise Multi-Branch",
    mrrUsd: 1190,
    priceLabel: "$1,190 / mo",
    seatLimit: 60,
    monthlyCaseQuota: 750,
    monthlyAiExtractions: 10000,
    summary: "Multi-city mobility practices with custom rule packs, branch RBAC, and SLA.",
  },
};

export const REGULATORY_BODIES = [
  {
    code: "CICC",
    label: "CICC — College of Immigration & Citizenship Consultants (Canada RCIC)",
    track: "regulated_counsel" as KybTrack,
    placeholder: "e.g. R708412",
    registryUrl: "https://college-ic.ca/protecting-the-public/find-an-immigration-consultant",
  },
  {
    code: "LAW_SOCIETY_BAR",
    label: "Provincial Law Society / State Bar Association (Immigration Attorney)",
    track: "regulated_counsel" as KybTrack,
    placeholder: "e.g. LSO-84920P",
    registryUrl: "https://lso.ca/public-resources/finding-a-lawyer-or-paralegal",
  },
  {
    code: "OMARA",
    label: "OMARA — Office of the Migration Agents Registration Authority (Australia MARN)",
    track: "regulated_counsel" as KybTrack,
    placeholder: "e.g. MARN 2117483",
    registryUrl: "https://portal.mara.gov.au/search-the-register-of-migration-agents/",
  },
  {
    code: "UK_IAA_SRA",
    label: "UK Immigration Advice Authority (IAA / OISC) or Solicitors Regulation Authority (SRA)",
    track: "regulated_counsel" as KybTrack,
    placeholder: "e.g. SRA 649210 or F202300142",
    registryUrl: "https://www.sra.org.uk/consumers/register/",
  },
  {
    code: "NZ_IAA",
    label: "New Zealand Immigration Advisers Authority (Licensed Immigration Adviser)",
    track: "regulated_counsel" as KybTrack,
    placeholder: "e.g. IAA-202201489",
    registryUrl: "https://iaa.ewr.govt.nz/PublicRegister/",
  },
  {
    code: "MEA_IATA_CORP",
    label: "Registered Overseas Visa & Education Consultancy (CIN / GSTIN / Trade License / ICEF)",
    track: "overseas_consultancy" as KybTrack,
    placeholder: "e.g. CIN-U74999CH2021PTC054812",
    registryUrl: "https://www.mca.gov.in/",
  },
];

export const SOVEREIGN_CORRIDORS = [
  {
    code: "CA",
    label: "Canada (IRCC Express Entry, PNP, Study & Work)",
    unlockedChecklists: [
      "Express Entry e-APR (CEC / FSW / Category Draws)",
      "6 Provincial Nominee Grids (OINP, BC PNP, AAIP, SINP, MPNP, NSNP)",
      "Study Permit + PAL + Proof-of-Funds & Spousal OWP",
    ],
  },
  {
    code: "AU",
    label: "Australia (SkillSelect 189/190/491, Employer Sponsored)",
    unlockedChecklists: [
      "SkillSelect GSM Subclass 189 / 190 / 491 Schedule 6D Pack",
      "Skills Assessment (ACS / Engineers Australia / VETASSESS)",
      "Subclass 482 Skills in Demand & Student Subclass 500",
    ],
  },
  {
    code: "NZ",
    label: "New Zealand (6-Point SMC, AEWV, Green List)",
    unlockedChecklists: [
      "Skilled Migrant Category (6-Point Resident Visa)",
      "Accredited Employer Work Visa (AEWV) & Green List Tier 1/2",
      "Partnership & Post-Study Work Visa Checklists",
    ],
  },
  {
    code: "UK",
    label: "United Kingdom (Skilled Worker, Global Talent, ILR)",
    unlockedChecklists: [
      "Skilled Worker CoS & Going-Rate Salary Compliance Pack",
      "5-Year Indefinite Leave to Remain (ILR) Absence & PAYE Audit",
      "Student Route (CAS + 28-Day Maintenance) & Appendix FM",
    ],
  },
  {
    code: "DE",
    label: "Germany (Chancenkarte § 20b, EU Blue Card)",
    unlockedChecklists: [
      "Chancenkarte (§ 20a/20b AufenthG) Anabin & Blocked Account Pack",
      "EU Blue Card (§ 18g) Regular & Shortage Salary Audit",
      "21/27-Month Accelerated Settlement Permit (§ 18c) Tracker",
    ],
  },
  {
    code: "US",
    label: "United States (EB-1A, O-1A, H-1B, L-1A, Consular)",
    unlockedChecklists: [
      "EB-1A / O-1A Extraordinary Ability Evidentiary Criteria Matrix",
      "H-1B Specialty Occupation + LCA & L-1A Intracompany Transfer",
      "I-130 / I-485 Adjustment of Status & DS-160 Consular Pack",
    ],
  },
];

export type KybDocType =
  | "practitioner_license"
  | "business_registration"
  | "principal_id"
  | "co_counsel_retainer";

export interface KybUploadedDocument {
  id: string;
  docType: KybDocType;
  fileName: string;
  fileSizeKb: number;
  mimeType: string;
  sha256Preview: string;
  uploadedAt: string;
}

export interface KybVerificationChecklist {
  registryVerified: boolean;
  entityTaxMatched: boolean;
  domainOwnershipVerified: boolean;
  principalIdentityVerified: boolean;
}

export interface AgencyKybApplication {
  id: string;
  dossierCode: string;
  legalEntityName: string;
  tradingName: string;
  requestedSlug: string;
  hqCountry: string;
  hqCity: string;
  corporateDomain: string;
  taxRegistrationId: string;
  contactFullName: string;
  contactWorkEmail: string;
  contactPhone: string;
  ownerPassword?: string;
  consultationBookingUrl?: string;
  kybTrack: KybTrack;
  regulatoryBody: string;
  licenseNumber: string;
  coCounselDetails?: string;
  uploadedDocuments?: KybUploadedDocument[];
  verificationChecklist?: KybVerificationChecklist;
  targetCorridors: string[];
  estimatedMonthlyCases: number;
  requestedSeats: number;
  branchCount: number;
  selectedPlanTier: AgencyPlanTier;
  dpaAccepted: boolean;
  zeroTrainingAccepted: boolean;
  kybStatus: KybStatus;
  reviewerNotes?: string;
  reviewedByEmail?: string;
  reviewedAt?: string;
  provisionedOrganizationId?: string;
  temporaryOwnerPassword?: string;
  createdAt: string;
}

export interface AgencyFeatureFlags {
  ai_lab: boolean;
  cobranded_calculators: boolean;
  multi_branch: boolean;
  custom_rules: boolean;
}

export interface AgencyBrandingConfig {
  primaryColor: string;
  tagline: string;
  consultationBookingUrl?: string;
  whatsappNumber?: string;
  setupCompleted: boolean;
}

export interface AgencyTenantRecord {
  organizationId: string;
  legalEntityName: string;
  tradingName: string;
  slug: string;
  ownerEmail: string;
  ownerFullName: string;
  temporaryPassword?: string;
  status: "active" | "suspended";
  health: AgencyHealthStatus;
  planTier: AgencyPlanTier;
  mrrUsd: number;
  billingStatus: "trialing" | "active" | "past_due" | "suspended";
  paymentMethod?: "stripe_card" | "wire_invoice" | "trial";
  trialEndsAt?: string | null;
  onboardingSource?: "self_serve" | "hq_sales_invite";
  kybTrack: KybTrack;
  regulatoryBody: string;
  licenseNumber: string;
  hqCity: string;
  hqCountry: string;
  seatsUsed: number;
  seatLimit: number;
  casesActiveCount: number;
  monthlyCaseQuota: number;
  aiExtractionsUsed30d: number;
  monthlyAiExtractionQuota: number;
  calculatorLeads30d: number;
  enabledCorridors: string[];
  featureFlags: AgencyFeatureFlags;
  branding: AgencyBrandingConfig;
  supportGrantActive: boolean;
  supportGrantExpiresAt: string | null;
  supportGrantReason: string | null;
  lastStaffLoginLabel: string;
  createdAt: string;
}

export interface AgencyTeamInviteRecord {
  id: string;
  organizationId: string;
  agencySlug: string;
  agencyLegalName: string;
  fullName: string;
  email: string;
  role: "case_manager" | "paralegal";
  branchOffice: string;
  passcode: string;
  invitedAt: string;
}

export interface AgencyBillingInvoice {
  id: string;
  invoiceNumber: string;
  organizationId: string;
  tradingName: string;
  planLabel: string;
  amountUsd: number;
  paymentMethod: "stripe_card" | "wire_invoice";
  status: "paid" | "pending_wire" | "past_due";
  dueDate: string;
  paidAt?: string | null;
  notes?: string;
}

export interface AgencySupportTicket {
  id: string;
  ticketCode: string;
  organizationId: string;
  tradingName: string;
  requesterEmail: string;
  category: "statutory_rules" | "ocr_pipeline" | "billing_seats" | "kyb_verification";
  subject: string;
  message: string;
  breakGlassAttached: boolean;
  status: "open" | "resolved";
  hqReply?: string;
  repliedByEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StatutoryRuleBroadcast {
  id: string;
  corridorCode: string;
  title: string;
  summary: string;
  effectiveDate: string;
  publishedByEmail: string;
  publishedAt: string;
}

export interface CalculatorAgencyLeadRecord {
  id: string;
  organizationId: string;
  agencySlug: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone?: string;
  calculatorId: string;
  calculatorTitle: string;
  countryCode: string;
  scoreSummary: string;
  leadStatus: "new_lead" | "contacted" | "converted_to_client";
  createdAt: string;
}

export interface PlatformGovernanceLogEntry {
  id: string;
  timestamp: string;
  actorEmail: string;
  agencyName: string;
  actionCode: string;
  detail: string;
}

export interface ReconciledPlatformOverview {
  zeroPiiBoundaryEnforced: true;
  activeAgenciesCount: number;
  suspendedAgenciesCount: number;
  pendingKybCount: number;
  clarificationKybCount: number;
  recurringMrrUsd: number;
  annualizedRunRateUsd: number;
  seatsUsedTotal: number;
  seatsProvisionedTotal: number;
  networkActiveCasesCount: number;
  networkCaseQuotaTotal: number;
  aiExtractions30dTotal: number;
  aiQuotaTotal: number;
  calculatorLeads30dTotal: number;
  activeSupportGrantsCount: number;
  quotaAttentionCount: number;
}

const STORAGE_KEYS = {
  tenants: "documento_agency_tenants_v1",
  applications: "documento_agency_applications_v1",
  leads: "documento_calculator_leads_v1",
  logs: "documento_platform_gov_logs_v1",
  teamInvites: "documento_agency_team_invites_v1",
  invoices: "documento_agency_invoices_v1",
  tickets: "documento_agency_support_tickets_v1",
  broadcasts: "documento_statutory_broadcasts_v1",
};

export function normalizeAgencySlug(raw: string): string {
  return (
    raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "partner-agency"
  );
}

const SEED_TENANTS: AgencyTenantRecord[] = [
  {
    organizationId: "ten-vanguard",
    legalEntityName: "Vanguard Immigration Law Group LLP",
    tradingName: "Vanguard Immigration Law",
    slug: "vanguard-legal",
    ownerEmail: "sarah.jenkins@vanguardlegal.com",
    ownerFullName: "Sarah Jenkins, Esq.",
    status: "active",
    health: "thriving",
    planTier: "growth",
    mrrUsd: 499,
    billingStatus: "active",
    kybTrack: "regulated_counsel",
    regulatoryBody: "CICC",
    licenseNumber: "R708412",
    hqCity: "Toronto",
    hqCountry: "Canada",
    seatsUsed: 11,
    seatLimit: 18,
    casesActiveCount: 94,
    monthlyCaseQuota: 180,
    aiExtractionsUsed30d: 1420,
    monthlyAiExtractionQuota: 2500,
    calculatorLeads30d: 38,
    enabledCorridors: ["CA", "US", "UK"],
    featureFlags: {
      ai_lab: true,
      cobranded_calculators: true,
      multi_branch: true,
      custom_rules: true,
    },
    branding: {
      primaryColor: "#063C3D",
      tagline: "Regulated Canadian & Cross-Border PR Counsel — Submit your verified 2026 points scorecard.",
      consultationBookingUrl: "https://vanguardlegal.com/book-pr-strategy",
      whatsappNumber: "+1 416 555 0199",
      setupCompleted: true,
    },
    supportGrantActive: false,
    supportGrantExpiresAt: null,
    supportGrantReason: null,
    lastStaffLoginLabel: "14m ago",
    createdAt: "2026-06-12T09:30:00Z",
  },
  {
    organizationId: "ten-southerncross",
    legalEntityName: "Southern Cross Migration Advisory Pty Ltd",
    tradingName: "Southern Cross Migration",
    slug: "southern-cross-au",
    ownerEmail: "lachlan.reid@southerncrossmigration.com.au",
    ownerFullName: "Lachlan Reid, MARN",
    status: "active",
    health: "thriving",
    planTier: "growth",
    mrrUsd: 499,
    billingStatus: "active",
    kybTrack: "regulated_counsel",
    regulatoryBody: "OMARA",
    licenseNumber: "MARN 2117483",
    hqCity: "Melbourne",
    hqCountry: "Australia",
    seatsUsed: 14,
    seatLimit: 18,
    casesActiveCount: 152,
    monthlyCaseQuota: 180,
    aiExtractionsUsed30d: 2290,
    monthlyAiExtractionQuota: 2500,
    calculatorLeads30d: 29,
    enabledCorridors: ["AU", "NZ", "UK"],
    featureFlags: {
      ai_lab: true,
      cobranded_calculators: true,
      multi_branch: true,
      custom_rules: true,
    },
    branding: {
      primaryColor: "#0D6866",
      tagline: "OMARA-Registered Subclass 189/190/491 & Trans-Tasman SMC Specialists.",
      setupCompleted: true,
    },
    supportGrantActive: false,
    supportGrantExpiresAt: null,
    supportGrantReason: null,
    lastStaffLoginLabel: "42m ago",
    createdAt: "2026-07-04T04:15:00Z",
  },
  {
    organizationId: "ten-thamesbridge",
    legalEntityName: "Thamesbridge Chambers & Global Mobility LLP",
    tradingName: "Thamesbridge Mobility",
    slug: "thamesbridge-uk",
    ownerEmail: "eleanor.price@thamesbridgelaw.co.uk",
    ownerFullName: "Eleanor Price, Solicitor",
    status: "active",
    health: "thriving",
    planTier: "enterprise",
    mrrUsd: 1190,
    billingStatus: "active",
    kybTrack: "regulated_counsel",
    regulatoryBody: "UK_IAA_SRA",
    licenseNumber: "SRA 649210",
    hqCity: "London",
    hqCountry: "United Kingdom",
    seatsUsed: 34,
    seatLimit: 60,
    casesActiveCount: 312,
    monthlyCaseQuota: 750,
    aiExtractionsUsed30d: 5410,
    monthlyAiExtractionQuota: 10000,
    calculatorLeads30d: 64,
    enabledCorridors: ["UK", "DE", "CA", "US"],
    featureFlags: {
      ai_lab: true,
      cobranded_calculators: true,
      multi_branch: true,
      custom_rules: true,
    },
    branding: {
      primaryColor: "#063C3D",
      tagline: "Corporate Sponsor Licences, Skilled Worker & 5-Year ILR Practice.",
      setupCompleted: true,
    },
    supportGrantActive: false,
    supportGrantExpiresAt: null,
    supportGrantReason: null,
    lastStaffLoginLabel: "6m ago",
    createdAt: "2026-05-19T11:00:00Z",
  },
  {
    organizationId: "ten-indus",
    legalEntityName: "Indus Global Study & PR Pathways Pvt Ltd",
    tradingName: "Indus PR Pathways",
    slug: "indus-pathways",
    ownerEmail: "vikram.bedi@induspathways.in",
    ownerFullName: "Vikram Bedi",
    status: "active",
    health: "thriving",
    planTier: "boutique",
    mrrUsd: 199,
    billingStatus: "active",
    kybTrack: "overseas_consultancy",
    regulatoryBody: "MEA_IATA_CORP",
    licenseNumber: "CIN-U74999CH2021PTC054812",
    hqCity: "Chandigarh",
    hqCountry: "India",
    seatsUsed: 6,
    seatLimit: 6,
    casesActiveCount: 46,
    monthlyCaseQuota: 50,
    aiExtractionsUsed30d: 545,
    monthlyAiExtractionQuota: 600,
    calculatorLeads30d: 51,
    enabledCorridors: ["CA", "AU", "UK", "DE"],
    featureFlags: {
      ai_lab: true,
      cobranded_calculators: true,
      multi_branch: false,
      custom_rules: false,
    },
    branding: {
      primaryColor: "#0D6866",
      tagline: "Verified Express Entry, PNP, SkillSelect & Germany Chancenkarte Intake Desk.",
      setupCompleted: true,
    },
    supportGrantActive: false,
    supportGrantExpiresAt: null,
    supportGrantReason: null,
    lastStaffLoginLabel: "1h ago",
    createdAt: "2026-08-22T06:45:00Z",
  },
  {
    organizationId: "ten-rheinmain",
    legalEntityName: "RheinMain Fachkräfte & Relocation GmbH",
    tradingName: "RheinMain Relocation",
    slug: "rheinmain-relocation",
    ownerEmail: "lukas.weber@rheinmain-relocation.de",
    ownerFullName: "Dr. Lukas Weber",
    status: "active",
    health: "onboarding",
    planTier: "pilot_14d",
    mrrUsd: 0,
    billingStatus: "trialing",
    paymentMethod: "trial",
    trialEndsAt: "2026-11-12T13:20:00Z",
    kybTrack: "regulated_counsel",
    regulatoryBody: "LAW_SOCIETY_BAR",
    licenseNumber: "RAK-FFM-49201",
    hqCity: "Frankfurt",
    hqCountry: "Germany",
    seatsUsed: 2,
    seatLimit: 3,
    casesActiveCount: 4,
    monthlyCaseQuota: 15,
    aiExtractionsUsed30d: 28,
    monthlyAiExtractionQuota: 150,
    calculatorLeads30d: 7,
    enabledCorridors: ["DE", "UK"],
    featureFlags: {
      ai_lab: true,
      cobranded_calculators: true,
      multi_branch: false,
      custom_rules: false,
    },
    branding: {
      primaryColor: "#063C3D",
      tagline: "EU Blue Card § 18g & Chancenkarte § 20b Relocation Counsel.",
      setupCompleted: false,
    },
    supportGrantActive: false,
    supportGrantExpiresAt: null,
    supportGrantReason: null,
    lastStaffLoginLabel: "3h ago",
    createdAt: "2026-10-29T13:20:00Z",
  },
];

const SEED_APPLICATIONS: AgencyKybApplication[] = [
  {
    id: "app-maplecrest-01",
    dossierCode: "KYB-84F29A10",
    legalEntityName: "MapleCrest Regulated Immigration Inc.",
    tradingName: "MapleCrest RCIC Counsel",
    requestedSlug: "maplecrest-rcic",
    hqCountry: "Canada",
    hqCity: "Mississauga",
    corporateDomain: "maplecrestimmigration.ca",
    taxRegistrationId: "BN-748291044RC0001",
    contactFullName: "Amrit Grewal, RCIC-IRB",
    contactWorkEmail: "amrit.grewal@maplecrestimmigration.ca",
    contactPhone: "+1 (905) 555-0194",
    consultationBookingUrl: "https://maplecrestimmigration.ca/consult",
    kybTrack: "regulated_counsel",
    regulatoryBody: "CICC",
    licenseNumber: "R714290",
    uploadedDocuments: [
      {
        id: "kybdoc-mc-1",
        docType: "practitioner_license",
        fileName: "CICC_Practicing_Certificate_R714290_2026.pdf",
        fileSizeKb: 418,
        mimeType: "application/pdf",
        sha256Preview: "9f4c2a81...d70e",
        uploadedAt: "2026-11-04T07:38:00Z",
      },
      {
        id: "kybdoc-mc-2",
        docType: "business_registration",
        fileName: "Ontario_Articles_Incorporation_BN748291044.pdf",
        fileSizeKb: 612,
        mimeType: "application/pdf",
        sha256Preview: "3b18e09c...41af",
        uploadedAt: "2026-11-04T07:39:00Z",
      },
      {
        id: "kybdoc-mc-3",
        docType: "principal_id",
        fileName: "Amrit_Grewal_RCIC_Photo_Card.jpg",
        fileSizeKb: 284,
        mimeType: "image/jpeg",
        sha256Preview: "71da55e2...88c1",
        uploadedAt: "2026-11-04T07:39:30Z",
      },
    ],
    verificationChecklist: {
      registryVerified: true,
      entityTaxMatched: true,
      domainOwnershipVerified: true,
      principalIdentityVerified: true,
    },
    targetCorridors: ["CA", "US"],
    estimatedMonthlyCases: 45,
    requestedSeats: 8,
    branchCount: 2,
    selectedPlanTier: "growth",
    dpaAccepted: true,
    zeroTrainingAccepted: true,
    kybStatus: "pending_kyb",
    createdAt: "2026-11-04T07:40:00Z",
  },
  {
    id: "app-aotearoa-02",
    dossierCode: "KYB-39C18D04",
    legalEntityName: "Aotearoa Pacific Visa Advisers Ltd",
    tradingName: "Aotearoa Visa Advisers",
    requestedSlug: "aotearoa-visas",
    hqCountry: "New Zealand",
    hqCity: "Auckland",
    corporateDomain: "aotearoavisas.co.nz",
    taxRegistrationId: "NZBN-9429048192014",
    contactFullName: "Aroha Kerr, LIA",
    contactWorkEmail: "aroha.kerr@aotearoavisas.co.nz",
    contactPhone: "+64 9 555 0148",
    kybTrack: "regulated_counsel",
    regulatoryBody: "NZ_IAA",
    licenseNumber: "IAA-202201489",
    uploadedDocuments: [
      {
        id: "kybdoc-ao-1",
        docType: "practitioner_license",
        fileName: "NZ_IAA_Full_Licence_202201489.pdf",
        fileSizeKb: 392,
        mimeType: "application/pdf",
        sha256Preview: "c421ab90...19ef",
        uploadedAt: "2026-11-03T21:13:00Z",
      },
      {
        id: "kybdoc-ao-2",
        docType: "business_registration",
        fileName: "NZ_Companies_Office_NZBN_9429048192014.pdf",
        fileSizeKb: 510,
        mimeType: "application/pdf",
        sha256Preview: "88f012bc...03d4",
        uploadedAt: "2026-11-03T21:14:00Z",
      },
    ],
    verificationChecklist: {
      registryVerified: true,
      entityTaxMatched: true,
      domainOwnershipVerified: true,
      principalIdentityVerified: false,
    },
    targetCorridors: ["NZ", "AU"],
    estimatedMonthlyCases: 22,
    requestedSeats: 4,
    branchCount: 1,
    selectedPlanTier: "boutique",
    dpaAccepted: true,
    zeroTrainingAccepted: true,
    kybStatus: "pending_kyb",
    createdAt: "2026-11-03T21:15:00Z",
  },
  {
    id: "app-crescent-03",
    dossierCode: "KYB-71B04E88",
    legalEntityName: "Crescent Overseas Careers LLC",
    tradingName: "Crescent Global Visas",
    requestedSlug: "crescent-dubai",
    hqCountry: "United Arab Emirates",
    hqCity: "Dubai",
    corporateDomain: "crescentcareers.ae",
    taxRegistrationId: "DED-948120-DXB",
    contactFullName: "Tariq Mansoor",
    contactWorkEmail: "tariq.mansoor@crescentcareers.ae",
    contactPhone: "+971 4 555 0182",
    kybTrack: "overseas_consultancy",
    regulatoryBody: "MEA_IATA_CORP",
    licenseNumber: "DED-948120",
    coCounselDetails: "Awaiting signed CICC co-counsel addendum",
    uploadedDocuments: [
      {
        id: "kybdoc-cr-1",
        docType: "business_registration",
        fileName: "Dubai_DED_Commercial_License_948120.pdf",
        fileSizeKb: 740,
        mimeType: "application/pdf",
        sha256Preview: "55a9c112...e420",
        uploadedAt: "2026-11-02T11:24:00Z",
      },
    ],
    verificationChecklist: {
      registryVerified: false,
      entityTaxMatched: true,
      domainOwnershipVerified: true,
      principalIdentityVerified: true,
    },
    targetCorridors: ["CA", "UK", "DE"],
    estimatedMonthlyCases: 60,
    requestedSeats: 12,
    branchCount: 2,
    selectedPlanTier: "growth",
    dpaAccepted: true,
    zeroTrainingAccepted: true,
    kybStatus: "clarification_requested",
    reviewerNotes:
      "Trade license verified; please provide co-counsel RCIC/SRA registration number for direct representation filings.",
    reviewedByEmail: "hq.admin@documento.ai",
    reviewedAt: "2026-11-03T16:10:00Z",
    createdAt: "2026-11-02T11:25:00Z",
  },
];

const SEED_LEADS: CalculatorAgencyLeadRecord[] = [
  {
    id: "lead-01",
    organizationId: "ten-vanguard",
    agencySlug: "vanguard-legal",
    applicantName: "Neha Kulkarni",
    applicantEmail: "neha.kulkarni@proton.me",
    applicantPhone: "+1 (416) 555-0139",
    calculatorId: "canada-crs",
    calculatorTitle: "Canada Express Entry CRS",
    countryCode: "CA",
    scoreSummary: "524 CRS (Nov 2026 LMI Grid • CEC Eligible)",
    leadStatus: "new_lead",
    createdAt: "2026-11-04T10:12:00Z",
  },
  {
    id: "lead-02",
    organizationId: "ten-vanguard",
    agencySlug: "vanguard-legal",
    applicantName: "Jean-Luc Moreau",
    applicantEmail: "jl.moreau@umontreal.ca",
    applicantPhone: "+1 (514) 555-0172",
    calculatorId: "canada-pnp",
    calculatorTitle: "Canada OINP Employer Job Offer",
    countryCode: "CA",
    scoreSummary: "89 / 132 OINP Points (Bilingual + $80k+ CRA Tier)",
    leadStatus: "new_lead",
    createdAt: "2026-11-03T18:45:00Z",
  },
  {
    id: "lead-03",
    organizationId: "ten-vanguard",
    agencySlug: "vanguard-legal",
    applicantName: "Callum MacLeod",
    applicantEmail: "c.macleod@edinburgh-biotech.co.uk",
    calculatorId: "uk-skilled-worker",
    calculatorTitle: "UK 70-Point Skilled Worker & ILR",
    countryCode: "UK",
    scoreSummary: "70 / 70 Pts (Option C STEM PhD • £46,500/yr)",
    leadStatus: "contacted",
    createdAt: "2026-11-02T14:20:00Z",
  },
];

const SEED_LOGS: PlatformGovernanceLogEntry[] = [
  {
    id: "govlog-01",
    timestamp: "2026-11-03T16:10:00Z",
    actorEmail: "hq.admin@documento.ai",
    agencyName: "Crescent Global Visas",
    actionCode: "kyb.clarification_requested",
    detail: "Requested co-counsel RCIC/SRA registration addendum prior to tenant activation.",
  },
  {
    id: "govlog-02",
    timestamp: "2026-10-29T13:20:00Z",
    actorEmail: "hq.admin@documento.ai",
    agencyName: "RheinMain Relocation",
    actionCode: "platform.agency_provisioned",
    detail: "Verified RAK-FFM-49201 & provisioned 14-Day KYB Pilot workspace (DE, UK corridors).",
  },
];

function readJsonStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJsonStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage quota errors
  }
}

export function getAgencyTenants(): AgencyTenantRecord[] {
  const stored = readJsonStorage<AgencyTenantRecord[] | null>(STORAGE_KEYS.tenants, null);
  if (!stored) {
    writeJsonStorage(STORAGE_KEYS.tenants, SEED_TENANTS);
    return SEED_TENANTS;
  }
  // Auto-expire any elapsed support grants honestly
  const nowMs = Date.now();
  return stored.map((t) => {
    if (t.supportGrantActive && t.supportGrantExpiresAt && new Date(t.supportGrantExpiresAt).getTime() <= nowMs) {
      return { ...t, supportGrantActive: false, supportGrantExpiresAt: null, supportGrantReason: null };
    }
    return t;
  });
}

export function getAgencyApplications(): AgencyKybApplication[] {
  const stored = readJsonStorage<AgencyKybApplication[] | null>(STORAGE_KEYS.applications, null);
  if (!stored) {
    writeJsonStorage(STORAGE_KEYS.applications, SEED_APPLICATIONS);
    return SEED_APPLICATIONS;
  }
  return stored;
}

export function getCalculatorAgencyLeads(organizationId?: string): CalculatorAgencyLeadRecord[] {
  const stored = readJsonStorage<CalculatorAgencyLeadRecord[] | null>(STORAGE_KEYS.leads, null);
  const all = stored ?? SEED_LEADS;
  if (!stored) writeJsonStorage(STORAGE_KEYS.leads, SEED_LEADS);
  if (!organizationId) return all;
  return all.filter((l) => l.organizationId === organizationId);
}

export function getPlatformGovernanceLogs(): PlatformGovernanceLogEntry[] {
  const stored = readJsonStorage<PlatformGovernanceLogEntry[] | null>(STORAGE_KEYS.logs, null);
  if (!stored) {
    writeJsonStorage(STORAGE_KEYS.logs, SEED_LOGS);
    return SEED_LOGS;
  }
  return stored;
}

function appendGovernanceLog(entry: Omit<PlatformGovernanceLogEntry, "id" | "timestamp">): void {
  const current = getPlatformGovernanceLogs();
  const next: PlatformGovernanceLogEntry[] = [
    {
      id: `govlog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    },
    ...current,
  ];
  writeJsonStorage(STORAGE_KEYS.logs, next.slice(0, 50));
}

/**
 * Reconciles every platform KPI strictly from the active arrays so numbers always close.
 */
export function computePlatformOverview(
  tenants: AgencyTenantRecord[],
  applications: AgencyKybApplication[]
): ReconciledPlatformOverview {
  const activeTenants = tenants.filter((t) => t.status === "active");
  const suspendedTenants = tenants.filter((t) => t.status === "suspended");
  const pendingKyb = applications.filter((a) => a.kybStatus === "pending_kyb");
  const clarificationKyb = applications.filter((a) => a.kybStatus === "clarification_requested");

  const recurringMrrUsd = activeTenants.reduce((sum, t) => sum + t.mrrUsd, 0);
  const seatsUsedTotal = activeTenants.reduce((sum, t) => sum + t.seatsUsed, 0);
  const seatsProvisionedTotal = activeTenants.reduce((sum, t) => sum + t.seatLimit, 0);
  const networkActiveCasesCount = activeTenants.reduce((sum, t) => sum + t.casesActiveCount, 0);
  const networkCaseQuotaTotal = activeTenants.reduce((sum, t) => sum + t.monthlyCaseQuota, 0);
  const aiExtractions30dTotal = activeTenants.reduce((sum, t) => sum + t.aiExtractionsUsed30d, 0);
  const aiQuotaTotal = activeTenants.reduce((sum, t) => sum + t.monthlyAiExtractionQuota, 0);
  const calculatorLeads30dTotal = activeTenants.reduce((sum, t) => sum + t.calculatorLeads30d, 0);
  const activeSupportGrantsCount = activeTenants.filter((t) => t.supportGrantActive).length;

  const quotaAttentionCount = activeTenants.filter(
    (t) =>
      t.seatsUsed / Math.max(1, t.seatLimit) >= 0.85 ||
      t.casesActiveCount / Math.max(1, t.monthlyCaseQuota) >= 0.85 ||
      t.aiExtractionsUsed30d / Math.max(1, t.monthlyAiExtractionQuota) >= 0.85
  ).length;

  return {
    zeroPiiBoundaryEnforced: true,
    activeAgenciesCount: activeTenants.length,
    suspendedAgenciesCount: suspendedTenants.length,
    pendingKybCount: pendingKyb.length,
    clarificationKybCount: clarificationKyb.length,
    recurringMrrUsd,
    annualizedRunRateUsd: recurringMrrUsd * 12,
    seatsUsedTotal,
    seatsProvisionedTotal,
    networkActiveCasesCount,
    networkCaseQuotaTotal,
    aiExtractions30dTotal,
    aiQuotaTotal,
    calculatorLeads30dTotal,
    activeSupportGrantsCount,
    quotaAttentionCount,
  };
}

export interface SubmitAgencyOnboardingInput {
  legalEntityName: string;
  tradingName: string;
  requestedSlug: string;
  hqCountry: string;
  hqCity: string;
  corporateDomain: string;
  taxRegistrationId: string;
  contactFullName: string;
  contactWorkEmail: string;
  contactPhone: string;
  ownerPassword?: string;
  consultationBookingUrl?: string;
  kybTrack: KybTrack;
  regulatoryBody: string;
  licenseNumber: string;
  coCounselDetails?: string;
  uploadedDocuments?: KybUploadedDocument[];
  targetCorridors: string[];
  estimatedMonthlyCases: number;
  requestedSeats: number;
  branchCount: number;
  selectedPlanTier: AgencyPlanTier;
  dpaAccepted: boolean;
  zeroTrainingAccepted: boolean;
}

const COMMON_FREE_WEBMAIL = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "aol.com",
]);

export async function submitAgencyOnboarding(
  input: SubmitAgencyOnboardingInput
): Promise<AgencyKybApplication> {
  const slug = normalizeAgencySlug(input.requestedSlug || input.tradingName);
  const tenants = getAgencyTenants();
  if (tenants.some((t) => t.slug === slug)) {
    throw new Error(`Workspace slug "${slug}" is already claimed by an active partner agency.`);
  }

  let backendId: string | null = null;
  let backendDossier: string | null = null;
  try {
    const res = await fetch("/api/backend/agency-platform/onboarding/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        legal_entity_name: input.legalEntityName,
        trading_name: input.tradingName,
        requested_slug: slug,
        hq_country: input.hqCountry,
        hq_city: input.hqCity,
        corporate_domain: input.corporateDomain,
        tax_registration_id: input.taxRegistrationId,
        contact_full_name: input.contactFullName,
        contact_work_email: input.contactWorkEmail,
        contact_phone: input.contactPhone || null,
        owner_password: input.ownerPassword || null,
        kyb_track: input.kybTrack,
        regulatory_body: input.regulatoryBody,
        license_number: input.licenseNumber,
        co_counsel_details: input.coCounselDetails || null,
        target_corridors: input.targetCorridors,
        estimated_monthly_cases: input.estimatedMonthlyCases,
        requested_seats: input.requestedSeats,
        branch_count: input.branchCount,
        selected_plan_tier: input.selectedPlanTier,
        dpa_accepted: input.dpaAccepted,
        zero_training_accepted: input.zeroTrainingAccepted,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      backendId = data.application_id;
      backendDossier = data.dossier_code;
    }
  } catch {
    // Offline / serverless preview fallback continues cleanly via local persistence
  }

  const domainLower = input.corporateDomain.trim().toLowerCase();
  const docs = input.uploadedDocuments || [];
  const hex = Math.random().toString(16).slice(2, 10).toUpperCase();
  const created: AgencyKybApplication = {
    id: backendId || `app-${Date.now()}`,
    dossierCode: backendDossier || `KYB-${hex}`,
    legalEntityName: input.legalEntityName.trim(),
    tradingName: input.tradingName.trim(),
    requestedSlug: slug,
    hqCountry: input.hqCountry.trim(),
    hqCity: input.hqCity.trim(),
    corporateDomain: domainLower,
    taxRegistrationId: input.taxRegistrationId.trim(),
    contactFullName: input.contactFullName.trim(),
    contactWorkEmail: input.contactWorkEmail.trim().toLowerCase(),
    contactPhone: input.contactPhone.trim(),
    ownerPassword: input.ownerPassword || undefined,
    consultationBookingUrl: input.consultationBookingUrl?.trim() || undefined,
    kybTrack: input.kybTrack,
    regulatoryBody: input.regulatoryBody,
    licenseNumber: input.licenseNumber.trim(),
    coCounselDetails: input.coCounselDetails?.trim() || undefined,
    uploadedDocuments: docs,
    verificationChecklist: {
      registryVerified: false,
      entityTaxMatched: docs.some((d) => d.docType === "business_registration"),
      domainOwnershipVerified: Boolean(domainLower && !COMMON_FREE_WEBMAIL.has(domainLower)),
      principalIdentityVerified: docs.some((d) => d.docType === "principal_id"),
    },
    targetCorridors: input.targetCorridors.length > 0 ? input.targetCorridors : ["CA"],
    estimatedMonthlyCases: input.estimatedMonthlyCases,
    requestedSeats: input.requestedSeats,
    branchCount: input.branchCount,
    selectedPlanTier: input.selectedPlanTier,
    dpaAccepted: input.dpaAccepted,
    zeroTrainingAccepted: input.zeroTrainingAccepted,
    kybStatus: "pending_kyb",
    createdAt: new Date().toISOString(),
  };

  const nextApps = [created, ...getAgencyApplications()];
  writeJsonStorage(STORAGE_KEYS.applications, nextApps);
  appendGovernanceLog({
    actorEmail: created.contactWorkEmail,
    agencyName: created.tradingName,
    actionCode: "kyb.application_submitted",
    detail: `Submitted ${created.regulatoryBody} (${created.licenseNumber}) KYB dossier (${docs.length} verification file${docs.length === 1 ? "" : "s"}) for ${AGENCY_PLAN_SPECS[created.selectedPlanTier].label}.`,
  });

  return created;
}

export function adjudicateAgencyKybApplication(
  applicationId: string,
  decision: "approve" | "request_clarification" | "reject",
  reviewerNotes: string,
  actorEmail: string = "hq.admin@documento.ai",
  overridePlanTier?: AgencyPlanTier
): { updatedApplication: AgencyKybApplication; provisionedTenant?: AgencyTenantRecord } {
  const apps = getAgencyApplications();
  const target = apps.find((a) => a.id === applicationId);
  if (!target) {
    throw new Error("KYB application not found.");
  }

  const nowIso = new Date().toISOString();
  if (decision === "request_clarification" || decision === "reject") {
    if (reviewerNotes.trim().length < 5) {
      throw new Error(
        "Please enter a clear compliance note (at least 5 characters) before requesting clarification or rejecting a dossier."
      );
    }
    const nextStatus: KybStatus =
      decision === "request_clarification" ? "clarification_requested" : "rejected";
    const updatedApp: AgencyKybApplication = {
      ...target,
      kybStatus: nextStatus,
      reviewerNotes: reviewerNotes.trim(),
      reviewedByEmail: actorEmail,
      reviewedAt: nowIso,
    };
    writeJsonStorage(
      STORAGE_KEYS.applications,
      apps.map((a) => (a.id === applicationId ? updatedApp : a))
    );
    appendGovernanceLog({
      actorEmail,
      agencyName: target.tradingName,
      actionCode: `kyb.${nextStatus}`,
      detail: reviewerNotes.trim(),
    });
    if (typeof window !== "undefined") {
      fetch(`/api/backend/agency-platform/super-admin/applications/${applicationId}/decision`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Role": "platform_super_admin",
        },
        body: JSON.stringify({
          decision,
          reviewer_notes: reviewerNotes.trim(),
        }),
      }).catch(() => {});
    }
    return { updatedApplication: updatedApp };
  }

  // Idempotency guard: if already approved & provisioned, return existing tenant cleanly
  const tenants = getAgencyTenants();
  if (target.kybStatus === "approved" && target.provisionedOrganizationId) {
    const existingTenant = tenants.find((t) => t.organizationId === target.provisionedOrganizationId);
    return { updatedApplication: target, provisionedTenant: existingTenant };
  }

  // Approve & Provision Tenant Workspace
  let slug = normalizeAgencySlug(target.requestedSlug);
  if (tenants.some((t) => t.slug === slug)) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;
  }

  const planTier = overridePlanTier || target.selectedPlanTier;
  const spec = AGENCY_PLAN_SPECS[planTier];
  const orgId = `ten-${slug}`;
  const tempPassword =
    target.ownerPassword || `DocPartner!${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const newTenant: AgencyTenantRecord = {
    organizationId: orgId,
    legalEntityName: target.legalEntityName,
    tradingName: target.tradingName,
    slug,
    ownerEmail: target.contactWorkEmail,
    ownerFullName: target.contactFullName,
    temporaryPassword: tempPassword,
    status: "active",
    health: "onboarding",
    planTier,
    mrrUsd: spec.mrrUsd,
    billingStatus: planTier === "pilot_14d" ? "trialing" : "active",
    paymentMethod: planTier === "pilot_14d" ? "trial" : "stripe_card",
    trialEndsAt:
      planTier === "pilot_14d"
        ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        : null,
    onboardingSource: "self_serve",
    kybTrack: target.kybTrack,
    regulatoryBody: target.regulatoryBody,
    licenseNumber: target.licenseNumber,
    hqCity: target.hqCity,
    hqCountry: target.hqCountry,
    seatsUsed: 1,
    seatLimit: Math.max(target.requestedSeats, spec.seatLimit),
    casesActiveCount: 0,
    monthlyCaseQuota: spec.monthlyCaseQuota,
    aiExtractionsUsed30d: 0,
    monthlyAiExtractionQuota: spec.monthlyAiExtractions,
    calculatorLeads30d: 0,
    enabledCorridors: target.targetCorridors,
    featureFlags: {
      ai_lab: true,
      cobranded_calculators: true,
      multi_branch: target.branchCount > 1 || planTier === "growth" || planTier === "enterprise",
      custom_rules: planTier === "growth" || planTier === "enterprise",
    },
    branding: {
      primaryColor: "#063C3D",
      tagline: `Official PR & Visa Assessment Partner — ${target.tradingName}`,
      consultationBookingUrl: target.consultationBookingUrl,
      whatsappNumber: target.contactPhone || undefined,
      setupCompleted: false,
    },
    supportGrantActive: false,
    supportGrantExpiresAt: null,
    supportGrantReason: null,
    lastStaffLoginLabel: "Provisioned just now",
    createdAt: nowIso,
  };

  const updatedApp: AgencyKybApplication = {
    ...target,
    kybStatus: "approved",
    reviewerNotes: reviewerNotes.trim() || "KYB credentials verified and production workspace provisioned.",
    reviewedByEmail: actorEmail,
    reviewedAt: nowIso,
    provisionedOrganizationId: orgId,
    temporaryOwnerPassword: tempPassword,
  };

  writeJsonStorage(STORAGE_KEYS.tenants, [newTenant, ...tenants]);
  writeJsonStorage(
    STORAGE_KEYS.applications,
    apps.map((a) => (a.id === applicationId ? updatedApp : a))
  );
  appendGovernanceLog({
    actorEmail,
    agencyName: newTenant.tradingName,
    actionCode: "platform.agency_provisioned",
    detail: `Verified ${newTenant.regulatoryBody} (${newTenant.licenseNumber}) & provisioned ${spec.label} (${newTenant.slug}).`,
  });

  // Fire-and-forget sync with backend if live
  if (typeof window !== "undefined") {
    fetch(`/api/backend/agency-platform/super-admin/applications/${applicationId}/decision`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Role": "platform_super_admin",
      },
      body: JSON.stringify({
        decision: "approve",
        reviewer_notes: reviewerNotes,
        override_plan_tier: planTier,
      }),
    }).catch(() => {});
  }

  return { updatedApplication: updatedApp, provisionedTenant: newTenant };
}

export function updateAgencyGovernanceLocal(
  organizationId: string,
  patch: {
    planTier?: AgencyPlanTier;
    seatLimit?: number;
    monthlyCaseQuota?: number;
    monthlyAiExtractionQuota?: number;
    status?: "active" | "suspended";
    featureFlags?: Partial<AgencyFeatureFlags>;
    reason?: string;
  },
  actorEmail: string = "hq.admin@documento.ai"
): AgencyTenantRecord {
  const tenants = getAgencyTenants();
  const target = tenants.find((t) => t.organizationId === organizationId);
  if (!target) throw new Error("Agency tenant not found.");

  const nextPlan = patch.planTier ?? target.planTier;
  const spec = AGENCY_PLAN_SPECS[nextPlan];
  const nextStatus = patch.status ?? target.status;

  const updated: AgencyTenantRecord = {
    ...target,
    planTier: nextPlan,
    mrrUsd: patch.planTier ? spec.mrrUsd : target.mrrUsd,
    billingStatus:
      nextStatus === "suspended"
        ? "suspended"
        : nextPlan === "pilot_14d"
          ? "trialing"
          : "active",
    status: nextStatus,
    health:
      nextStatus === "suspended"
        ? "suspended"
        : target.casesActiveCount === 0
          ? "onboarding"
          : "thriving",
    seatLimit: patch.seatLimit ?? target.seatLimit,
    monthlyCaseQuota: patch.monthlyCaseQuota ?? target.monthlyCaseQuota,
    monthlyAiExtractionQuota: patch.monthlyAiExtractionQuota ?? target.monthlyAiExtractionQuota,
    featureFlags: {
      ...target.featureFlags,
      ...(patch.featureFlags || {}),
    },
  };

  writeJsonStorage(
    STORAGE_KEYS.tenants,
    tenants.map((t) => (t.organizationId === organizationId ? updated : t))
  );

  appendGovernanceLog({
    actorEmail,
    agencyName: updated.tradingName,
    actionCode:
      patch.status === "suspended"
        ? "platform.agency_frozen"
        : patch.status === "active" && target.status === "suspended"
          ? "platform.agency_reactivated"
          : "platform.governance_updated",
    detail:
      patch.reason ||
      `Plan: ${AGENCY_PLAN_SPECS[updated.planTier].label} • Seats: ${updated.seatLimit} • Case Quota: ${updated.monthlyCaseQuota}/mo • AI Quota: ${updated.monthlyAiExtractionQuota}/mo`,
  });

  return updated;
}

export function getPublicAgencyBySlug(slug: string): AgencyTenantRecord | null {
  const normalized = normalizeAgencySlug(slug);
  const tenants = getAgencyTenants();
  const match = tenants.find(
    (t) => t.slug === normalized && t.status === "active" && t.featureFlags.cobranded_calculators
  );
  return match || null;
}

export function getAgencyForOrganization(organizationId: string): AgencyTenantRecord | null {
  const tenants = getAgencyTenants();
  const exactTenant = tenants.find((t) => t.organizationId === organizationId);
  if (exactTenant) return exactTenant;

  // If this is a newly signed-up agency in 14-day trial / pending KYB sandbox (`sandbox-<slug>` or `ten-<slug>`),
  // build their own authentic workspace record from their KYB application instead of falling back to Vanguard Legal!
  const cleanSlug = organizationId.replace(/^(sandbox-|ten-)/, "");
  const apps = getAgencyApplications();
  const pendingApp = apps.find(
    (a) => a.requestedSlug === cleanSlug || a.provisionedOrganizationId === organizationId
  );
  if (pendingApp) {
    const spec = AGENCY_PLAN_SPECS[pendingApp.selectedPlanTier] || AGENCY_PLAN_SPECS.pilot_14d;
    const invites = getAgencyTeamInvites(organizationId);
    return {
      organizationId,
      legalEntityName: pendingApp.legalEntityName,
      tradingName: pendingApp.tradingName,
      slug: pendingApp.requestedSlug,
      ownerEmail: pendingApp.contactWorkEmail,
      ownerFullName: pendingApp.contactFullName,
      status: "active",
      health: "onboarding",
      planTier: pendingApp.selectedPlanTier,
      mrrUsd: 0,
      billingStatus: "trialing",
      paymentMethod: "trial",
      trialEndsAt: new Date(new Date(pendingApp.createdAt).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      onboardingSource: "self_serve",
      kybTrack: pendingApp.kybTrack,
      regulatoryBody: pendingApp.regulatoryBody,
      licenseNumber: pendingApp.licenseNumber,
      hqCity: pendingApp.hqCity,
      hqCountry: pendingApp.hqCountry,
      seatsUsed: 1 + invites.length,
      seatLimit: Math.max(pendingApp.requestedSeats, spec.seatLimit),
      casesActiveCount: 0,
      monthlyCaseQuota: spec.monthlyCaseQuota,
      aiExtractionsUsed30d: 0,
      monthlyAiExtractionQuota: spec.monthlyAiExtractions,
      calculatorLeads30d: 0,
      enabledCorridors: pendingApp.targetCorridors,
      featureFlags: {
        ai_lab: true,
        cobranded_calculators: true,
        multi_branch: pendingApp.branchCount > 1,
        custom_rules: true,
      },
      branding: {
        primaryColor: "#063C3D",
        tagline: `PR & Visa Eligibility Desk — ${pendingApp.tradingName}`,
        consultationBookingUrl: pendingApp.consultationBookingUrl,
        whatsappNumber: pendingApp.contactPhone || undefined,
        setupCompleted: Boolean(pendingApp.consultationBookingUrl),
      },
      supportGrantActive: false,
      supportGrantExpiresAt: null,
      supportGrantReason: null,
      lastStaffLoginLabel: "Active now",
      createdAt: pendingApp.createdAt,
    };
  }

  return tenants[0] || null;
}

export function saveAgencyDay0Setup(
  organizationId: string,
  update: {
    tradingName: string;
    tagline: string;
    primaryColor: string;
    cobrandedCalculatorsEnabled: boolean;
    enabledCorridors: string[];
    consultationBookingUrl?: string;
    whatsappNumber?: string;
  }
): AgencyTenantRecord | null {
  const tenants = getAgencyTenants();
  const target = tenants.find((t) => t.organizationId === organizationId);
  if (target) {
    const updated: AgencyTenantRecord = {
      ...target,
      tradingName: update.tradingName.trim() || target.tradingName,
      enabledCorridors: update.enabledCorridors.length > 0 ? update.enabledCorridors : target.enabledCorridors,
      featureFlags: {
        ...target.featureFlags,
        cobranded_calculators: update.cobrandedCalculatorsEnabled,
      },
      branding: {
        primaryColor: update.primaryColor || "#063C3D",
        tagline: update.tagline.trim(),
        consultationBookingUrl: update.consultationBookingUrl?.trim() || target.branding.consultationBookingUrl,
        whatsappNumber: update.whatsappNumber?.trim() || target.branding.whatsappNumber,
        setupCompleted: true,
      },
    };

    writeJsonStorage(
      STORAGE_KEYS.tenants,
      tenants.map((t) => (t.organizationId === organizationId ? updated : t))
    );
    return updated;
  }

  // Also persist setup edits when agency is still in 14-day KYB sandbox
  const cleanSlug = organizationId.replace(/^(sandbox-|ten-)/, "");
  const apps = getAgencyApplications();
  const appTarget = apps.find((a) => a.requestedSlug === cleanSlug);
  if (appTarget) {
    const updatedApp: AgencyKybApplication = {
      ...appTarget,
      tradingName: update.tradingName.trim() || appTarget.tradingName,
      targetCorridors: update.enabledCorridors.length > 0 ? update.enabledCorridors : appTarget.targetCorridors,
      consultationBookingUrl: update.consultationBookingUrl?.trim() || appTarget.consultationBookingUrl || "https://",
      contactPhone: update.whatsappNumber?.trim() || appTarget.contactPhone,
    };
    writeJsonStorage(
      STORAGE_KEYS.applications,
      apps.map((a) => (a.id === appTarget.id ? updatedApp : a))
    );
    return getAgencyForOrganization(organizationId);
  }

  return null;
}

export function toggleBreakGlassSupportGrant(
  organizationId: string,
  enable: boolean,
  reason: string = "Requested technical workflow diagnostics from Documento HQ",
  ownerEmail: string = "firm.owner@partner.com"
): AgencyTenantRecord | null {
  const tenants = getAgencyTenants();
  const target = tenants.find((t) => t.organizationId === organizationId);
  if (!target) return null;

  const expiresAt = enable ? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() : null;
  const updated: AgencyTenantRecord = {
    ...target,
    supportGrantActive: enable,
    supportGrantExpiresAt: expiresAt,
    supportGrantReason: enable ? reason : null,
  };

  writeJsonStorage(
    STORAGE_KEYS.tenants,
    tenants.map((t) => (t.organizationId === organizationId ? updated : t))
  );

  appendGovernanceLog({
    actorEmail: ownerEmail,
    agencyName: updated.tradingName,
    actionCode: enable ? "agency.support_grant_issued" : "agency.support_grant_revoked",
    detail: enable
      ? `Agency Owner issued time-boxed 2-hour diagnostic token: "${reason}"`
      : "Agency Owner revoked diagnostic support token immediately.",
  });

  return updated;
}

export function submitCobrandedCalculatorLead(input: {
  agencySlug: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone?: string;
  calculatorId: string;
  calculatorTitle: string;
  countryCode: string;
  scoreSummary: string;
  scorePayload?: Record<string, unknown>;
}): CalculatorAgencyLeadRecord {
  const agency = getPublicAgencyBySlug(input.agencySlug);
  if (!agency) {
    throw new Error("This partner agency co-branded portal is not currently active.");
  }

  const record: CalculatorAgencyLeadRecord = {
    id: `lead-${Date.now()}`,
    organizationId: agency.organizationId,
    agencySlug: agency.slug,
    applicantName: input.applicantName.trim(),
    applicantEmail: input.applicantEmail.trim().toLowerCase(),
    applicantPhone: input.applicantPhone?.trim() || undefined,
    calculatorId: input.calculatorId,
    calculatorTitle: input.calculatorTitle,
    countryCode: input.countryCode.toUpperCase(),
    scoreSummary: input.scoreSummary.trim(),
    leadStatus: "new_lead",
    createdAt: new Date().toISOString(),
  };

  const leads = getCalculatorAgencyLeads();
  writeJsonStorage(STORAGE_KEYS.leads, [record, ...leads]);

  const tenants = getAgencyTenants();
  writeJsonStorage(
    STORAGE_KEYS.tenants,
    tenants.map((t) =>
      t.organizationId === agency.organizationId
        ? { ...t, calculatorLeads30d: t.calculatorLeads30d + 1 }
        : t
    )
  );

  if (typeof window !== "undefined") {
    fetch(`/api/backend/agency-platform/public-agency/${agency.slug}/calculator-leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicant_name: record.applicantName,
        applicant_email: record.applicantEmail,
        applicant_phone: record.applicantPhone || null,
        calculator_id: record.calculatorId,
        country_code: record.countryCode,
        score_summary: record.scoreSummary,
        score_payload: input.scorePayload || {},
      }),
    }).catch(() => {});
  }

  return record;
}

export function markCalculatorLeadStatus(
  leadId: string,
  status: CalculatorAgencyLeadRecord["leadStatus"]
): void {
  const leads = getCalculatorAgencyLeads();
  writeJsonStorage(
    STORAGE_KEYS.leads,
    leads.map((l) => (l.id === leadId ? { ...l, leadStatus: status } : l))
  );
  if (typeof window !== "undefined") {
    fetch(`/api/backend/agency-platform/current-firm/calculator-leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_status: status }),
    }).catch(() => {});
  }
}

const COBRANDED_SESSION_KEY = "documento_cobranded_agency_slug";

export function clearActiveCobrandedAgency(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(COBRANDED_SESSION_KEY);
  } catch {
    // ignore storage access issues
  }
}

/**
 * Resolves the active co-branded partner agency from explicit prop, URL `?agency=<slug>`,
 * or sticky `sessionStorage` attribution so navigating from `/calculators?agency=<slug>`
 * into any of the 6 individual PR calculators keeps the firm's scorecard submission live.
 */
export function resolveActiveCobrandedAgency(
  explicitSlug?: string | null
): AgencyTenantRecord | null {
  if (explicitSlug) {
    const resolved = getPublicAgencyBySlug(explicitSlug);
    if (resolved && typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(COBRANDED_SESSION_KEY, resolved.slug);
      } catch {
        // ignore
      }
    }
    return resolved;
  }

  if (typeof window === "undefined") return null;

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("clear_agency") === "1") {
      window.sessionStorage.removeItem(COBRANDED_SESSION_KEY);
      return null;
    }
    const querySlug = params.get("agency");
    if (querySlug) {
      const fromQuery = getPublicAgencyBySlug(querySlug);
      if (fromQuery) {
        window.sessionStorage.setItem(COBRANDED_SESSION_KEY, fromQuery.slug);
        return fromQuery;
      }
      window.sessionStorage.removeItem(COBRANDED_SESSION_KEY);
      return null;
    }

    const savedSlug = window.sessionStorage.getItem(COBRANDED_SESSION_KEY);
    if (savedSlug) {
      const fromSession = getPublicAgencyBySlug(savedSlug);
      if (fromSession) return fromSession;
      window.sessionStorage.removeItem(COBRANDED_SESSION_KEY);
    }
  } catch {
    // ignore URL/sessionStorage access errors
  }

  return null;
}

export function withAgencyAttribution(href: string, agencySlug?: string | null): string {
  if (!agencySlug) return href;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}agency=${encodeURIComponent(agencySlug)}`;
}

export function lookupAgencyDossier(query: string): AgencyKybApplication | null {
  const needle = query.trim();
  if (needle.length < 3) return null;
  const apps = getAgencyApplications();
  if (needle.includes("@")) {
    const emailLower = needle.toLowerCase();
    return apps.find((a) => a.contactWorkEmail.toLowerCase() === emailLower) || null;
  }
  const normalizedCode = needle.toUpperCase();
  const bareCode = normalizedCode.replace(/^KYB-/, "");
  return (
    apps.find(
      (a) =>
        a.dossierCode.toUpperCase() === normalizedCode ||
        a.dossierCode.toUpperCase().replace(/^KYB-/, "") === bareCode
    ) || null
  );
}

export function resubmitAgencyKybClarification(
  applicationId: string,
  input: { licenseNumber?: string; coCounselDetails: string; uploadedDocument?: KybUploadedDocument }
): AgencyKybApplication {
  const details = input.coCounselDetails.trim();
  if (details.length < 5) {
    throw new Error("Please enter your updated regulatory or co-counsel clarification details (at least 5 characters).");
  }
  const apps = getAgencyApplications();
  const target = apps.find((a) => a.id === applicationId);
  if (!target) {
    throw new Error("KYB dossier not found.");
  }
  if (target.kybStatus !== "clarification_requested") {
    throw new Error("Only dossiers awaiting clarification can submit a clarification response.");
  }

  const nextDocs = input.uploadedDocument
    ? [...(target.uploadedDocuments || []), input.uploadedDocument]
    : target.uploadedDocuments || [];

  const updated: AgencyKybApplication = {
    ...target,
    licenseNumber: input.licenseNumber?.trim() || target.licenseNumber,
    coCounselDetails: details,
    uploadedDocuments: nextDocs,
    kybStatus: "pending_kyb",
  };

  writeJsonStorage(
    STORAGE_KEYS.applications,
    apps.map((a) => (a.id === applicationId ? updated : a))
  );

  appendGovernanceLog({
    actorEmail: updated.contactWorkEmail,
    agencyName: updated.tradingName,
    actionCode: "kyb.clarification_resubmitted",
    detail: `Submitted clarification response (${updated.licenseNumber}): ${details}`,
  });

  if (typeof window !== "undefined") {
    fetch(`/api/backend/agency-platform/onboarding/${applicationId}/clarification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        license_number: input.licenseNumber?.trim() || null,
        co_counsel_details: details,
      }),
    }).catch(() => {});
  }

  return updated;
}

export function exportPartnerAgenciesCsv(tenants: AgencyTenantRecord[]): string {
  const escapeCsv = (val: string | number | boolean | null | undefined) => {
    const str = val == null ? "" : String(val);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const header = [
    "Organization ID",
    "Trading Name",
    "Legal Entity Name",
    "Workspace Slug",
    "Status",
    "Health",
    "Plan Tier",
    "MRR (USD)",
    "Regulatory Body",
    "License Number",
    "HQ City",
    "HQ Country",
    "Seats Used",
    "Seat Limit",
    "Active Cases (Aggregate)",
    "Monthly Case Quota",
    "AI Extractions (30d)",
    "Monthly AI Quota",
    "Calculator Leads (30d)",
    "Support Grant Active",
  ];
  const rows = tenants.map((t) =>
    [
      t.organizationId,
      t.tradingName,
      t.legalEntityName,
      t.slug,
      t.status,
      t.health,
      AGENCY_PLAN_SPECS[t.planTier].label,
      t.status === "active" ? t.mrrUsd : 0,
      t.regulatoryBody,
      t.licenseNumber,
      t.hqCity,
      t.hqCountry,
      t.seatsUsed,
      t.seatLimit,
      t.casesActiveCount,
      t.monthlyCaseQuota,
      t.aiExtractionsUsed30d,
      t.monthlyAiExtractionQuota,
      t.calculatorLeads30d,
      t.supportGrantActive ? "YES" : "NO",
    ]
      .map(escapeCsv)
      .join(",")
  );
  return [header.join(","), ...rows].join("\n");
}

// ============================================================================
// REAL-WORLD B2B SAAS OPERATIONS: KYB EVIDENCE, TEAM INVITES, SALES DEALS,
// BILLING / WIRE INVOICES, SUPPORT DESK & STATUTORY BROADCASTS
// ============================================================================

const SEED_INVOICES: AgencyBillingInvoice[] = [
  {
    id: "inv-hq-01",
    invoiceNumber: "INV-2026-1101",
    organizationId: "ten-thamesbridge",
    tradingName: "Thamesbridge Mobility",
    planLabel: "Enterprise Multi-Branch",
    amountUsd: 1190,
    paymentMethod: "stripe_card",
    status: "paid",
    dueDate: "2026-11-01",
    paidAt: "2026-11-01T09:05:00Z",
    notes: "Monthly subscription auto-settled via corporate Visa •••• 8821",
  },
  {
    id: "inv-hq-02",
    invoiceNumber: "INV-2026-1102",
    organizationId: "ten-vanguard",
    tradingName: "Vanguard Immigration Law",
    planLabel: "Growth Consultancy",
    amountUsd: 499,
    paymentMethod: "stripe_card",
    status: "paid",
    dueDate: "2026-11-01",
    paidAt: "2026-11-01T09:12:00Z",
    notes: "Monthly subscription auto-settled",
  },
  {
    id: "inv-hq-03",
    invoiceNumber: "INV-2026-1103",
    organizationId: "ten-southerncross",
    tradingName: "Southern Cross Migration",
    planLabel: "Growth Consultancy",
    amountUsd: 499,
    paymentMethod: "stripe_card",
    status: "past_due",
    dueDate: "2026-11-02",
    paidAt: null,
    notes: "Corporate card expired (Amex •••• 4019) — retry dunning active",
  },
  {
    id: "inv-hq-04",
    invoiceNumber: "INV-2026-1104",
    organizationId: "ten-indus",
    tradingName: "Indus PR Pathways",
    planLabel: "Growth Consultancy Upgrade (SWIFT Wire)",
    amountUsd: 499,
    paymentMethod: "wire_invoice",
    status: "pending_wire",
    dueDate: "2026-11-10",
    paidAt: null,
    notes: "Requested seat expansion from 6 -> 18 seats via international bank transfer",
  },
];

const SEED_SUPPORT_TICKETS: AgencySupportTicket[] = [
  {
    id: "tkt-01",
    ticketCode: "SUP-4091",
    organizationId: "ten-indus",
    tradingName: "Indus PR Pathways",
    requesterEmail: "vikram.bedi@induspathways.in",
    category: "billing_seats",
    subject: "Seat cap reached (6/6) — upgrading Chandigarh & Delhi counsellors",
    message:
      "We hit 6/6 seats and 46/50 active cases this week. Our finance team initiated wire INV-2026-1104 — please unlock Growth 18-seat quota once received.",
    breakGlassAttached: false,
    status: "open",
    createdAt: "2026-11-04T06:20:00Z",
    updatedAt: "2026-11-04T06:20:00Z",
  },
  {
    id: "tkt-02",
    ticketCode: "SUP-4092",
    organizationId: "ten-rheinmain",
    tradingName: "RheinMain Relocation",
    requesterEmail: "lukas.weber@rheinmain-relocation.de",
    category: "statutory_rules",
    subject: "Chancenkarte § 20b Anabin H+ degree + Blocked Account €1,091/mo check",
    message:
      "Testing our 14-day pilot with 4 German relocation files — confirming whether Indian 3-year B.Sc + 2-year M.Sc maps to full 4-point qualification recognition.",
    breakGlassAttached: false,
    status: "open",
    createdAt: "2026-11-03T15:10:00Z",
    updatedAt: "2026-11-03T15:10:00Z",
  },
];

const SEED_RULE_BROADCASTS: StatutoryRuleBroadcast[] = [
  {
    id: "rb-01",
    corridorCode: "CA",
    title: "IRCC Express Entry CEC Draw #324 — 517 CRS Cutoff & Proof-of-Funds Synced",
    summary:
      "Updated Canada CRS benchmark advisories and 2026 LICO settlement funds table across all partner workspaces and co-branded calculators.",
    effectiveDate: "2026-11-04",
    publishedByEmail: "hq.admin@documento.ai",
    publishedAt: "2026-11-04T08:00:00Z",
  },
  {
    id: "rb-02",
    corridorCode: "UK",
    title: "UK Home Office Appendix Skilled Occupations Going-Rate Checklists Verified",
    summary:
      "Confirmed £38,700 general floor and PhD/New Entrant Option C–E tradeable salary discounts across Skilled Worker & 5-Year ILR calculators.",
    effectiveDate: "2026-11-01",
    publishedByEmail: "hq.admin@documento.ai",
    publishedAt: "2026-11-01T10:30:00Z",
  },
  {
    id: "rb-03",
    corridorCode: "AU",
    title: "Australia SkillSelect Schedule 6D Subclass 189/190 State Nomination Matrix Live",
    summary:
      "Synchronized +5 Subclass 190 and +15 Subclass 491 state/regional nomination rules and Specialist STEM Masters/PhD checklists.",
    effectiveDate: "2026-10-28",
    publishedByEmail: "hq.admin@documento.ai",
    publishedAt: "2026-10-28T14:15:00Z",
  },
];

export function buildKybUploadedDocMeta(
  docType: KybDocType,
  file: { name: string; size: number; type?: string }
): KybUploadedDocument {
  const hashSeed = `${file.name}-${file.size}-${Date.now()}`;
  let h = 2166136261;
  for (let i = 0; i < hashSeed.length; i++) {
    h ^= hashSeed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hex = (h >>> 0).toString(16).padStart(8, "0");
  return {
    id: `kybdoc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    docType,
    fileName: file.name,
    fileSizeKb: Math.max(1, Math.round(file.size / 1024)),
    mimeType: file.type || "application/pdf",
    sha256Preview: `${hex}...${hex.slice(0, 4)}`,
    uploadedAt: new Date().toISOString(),
  };
}

export function uploadKybDocumentToApplication(
  applicationIdOrSlug: string,
  doc: KybUploadedDocument
): AgencyKybApplication | null {
  const cleanSlug = applicationIdOrSlug.replace(/^(sandbox-|ten-)/, "");
  const apps = getAgencyApplications();
  const target = apps.find(
    (a) => a.id === applicationIdOrSlug || a.requestedSlug === cleanSlug
  );
  if (!target) return null;

  const existingDocs = (target.uploadedDocuments || []).filter((d) => d.docType !== doc.docType);
  const updated: AgencyKybApplication = {
    ...target,
    uploadedDocuments: [...existingDocs, doc],
  };
  writeJsonStorage(
    STORAGE_KEYS.applications,
    apps.map((a) => (a.id === target.id ? updated : a))
  );
  appendGovernanceLog({
    actorEmail: target.contactWorkEmail,
    agencyName: target.tradingName,
    actionCode: "kyb.document_uploaded",
    detail: `Uploaded ${doc.docType.replace(/_/g, " ")}: ${doc.fileName} (${doc.fileSizeKb} KB).`,
  });
  return updated;
}

export function updateKybVerificationChecklist(
  applicationId: string,
  patch: Partial<KybVerificationChecklist>
): AgencyKybApplication | null {
  const apps = getAgencyApplications();
  const target = apps.find((a) => a.id === applicationId);
  if (!target) return null;

  const current: KybVerificationChecklist = target.verificationChecklist || {
    registryVerified: false,
    entityTaxMatched: false,
    domainOwnershipVerified: false,
    principalIdentityVerified: false,
  };
  const updated: AgencyKybApplication = {
    ...target,
    verificationChecklist: { ...current, ...patch },
  };
  writeJsonStorage(
    STORAGE_KEYS.applications,
    apps.map((a) => (a.id === applicationId ? updated : a))
  );
  return updated;
}

export interface SalesLedProvisionInput {
  legalEntityName: string;
  tradingName: string;
  slug?: string;
  ownerFullName: string;
  ownerEmail: string;
  hqCountry: string;
  hqCity: string;
  kybTrack: KybTrack;
  regulatoryBody: string;
  licenseNumber: string;
  enabledCorridors: string[];
  planTier: AgencyPlanTier;
  customMrrUsd?: number;
  customSeatLimit?: number;
  paymentMethod: "stripe_card" | "wire_invoice" | "trial";
  kybVerifiedOnCall: boolean;
  actorEmail?: string;
}

export function provisionSalesLedAgency(input: SalesLedProvisionInput): AgencyTenantRecord {
  if (!input.legalEntityName.trim() || !input.tradingName.trim()) {
    throw new Error("Enter the agency's legal entity name and public brand name.");
  }
  if (!input.ownerEmail.includes("@") || !input.ownerFullName.trim()) {
    throw new Error("Enter the principal owner's name and work email.");
  }
  if (!input.licenseNumber.trim()) {
    throw new Error("Enter the practitioner license or company registration number.");
  }

  const tenants = getAgencyTenants();
  let slug = normalizeAgencySlug(input.slug || input.tradingName);
  if (tenants.some((t) => t.slug === slug)) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;
  }

  const spec = AGENCY_PLAN_SPECS[input.planTier];
  const mrr =
    input.planTier === "pilot_14d" || input.paymentMethod === "trial"
      ? 0
      : input.customMrrUsd !== undefined && input.customMrrUsd >= 0
        ? input.customMrrUsd
        : spec.mrrUsd;
  const seatLimit =
    input.customSeatLimit && input.customSeatLimit >= 1 ? input.customSeatLimit : spec.seatLimit;
  const tempPassword = `DocInvite!${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const nowIso = new Date().toISOString();
  const orgId = `ten-${slug}`;

  const createdTenant: AgencyTenantRecord = {
    organizationId: orgId,
    legalEntityName: input.legalEntityName.trim(),
    tradingName: input.tradingName.trim(),
    slug,
    ownerEmail: input.ownerEmail.trim().toLowerCase(),
    ownerFullName: input.ownerFullName.trim(),
    temporaryPassword: tempPassword,
    status: "active",
    health: "onboarding",
    planTier: input.planTier,
    mrrUsd: mrr,
    billingStatus:
      input.planTier === "pilot_14d" || input.paymentMethod === "trial" ? "trialing" : "active",
    paymentMethod: input.paymentMethod,
    trialEndsAt:
      input.planTier === "pilot_14d" || input.paymentMethod === "trial"
        ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        : null,
    onboardingSource: "hq_sales_invite",
    kybTrack: input.kybTrack,
    regulatoryBody: input.regulatoryBody,
    licenseNumber: input.licenseNumber.trim(),
    hqCity: input.hqCity.trim() || "Toronto",
    hqCountry: input.hqCountry.trim() || "Canada",
    seatsUsed: 1,
    seatLimit,
    casesActiveCount: 0,
    monthlyCaseQuota: spec.monthlyCaseQuota,
    aiExtractionsUsed30d: 0,
    monthlyAiExtractionQuota: spec.monthlyAiExtractions,
    calculatorLeads30d: 0,
    enabledCorridors: input.enabledCorridors.length > 0 ? input.enabledCorridors : ["CA"],
    featureFlags: {
      ai_lab: true,
      cobranded_calculators: input.kybVerifiedOnCall,
      multi_branch: seatLimit >= 10 || input.planTier === "enterprise",
      custom_rules: input.planTier !== "pilot_14d",
    },
    branding: {
      primaryColor: "#063C3D",
      tagline: `Official PR & Visa Assessment Partner — ${input.tradingName.trim()}`,
      setupCompleted: false,
    },
    supportGrantActive: false,
    supportGrantExpiresAt: null,
    supportGrantReason: null,
    lastStaffLoginLabel: "Invited just now",
    createdAt: nowIso,
  };

  writeJsonStorage(STORAGE_KEYS.tenants, [createdTenant, ...tenants]);

  if (input.paymentMethod === "wire_invoice" && mrr > 0) {
    const invoices = getPlatformBillingInvoices();
    const wireInv: AgencyBillingInvoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: `INV-2026-${Math.floor(1200 + Math.random() * 800)}`,
      organizationId: orgId,
      tradingName: createdTenant.tradingName,
      planLabel: `${spec.label} (Sales-Led Wire Deal)`,
      amountUsd: mrr,
      paymentMethod: "wire_invoice",
      status: "pending_wire",
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      paidAt: null,
      notes: "Issued during HQ sales-led agency onboarding",
    };
    writeJsonStorage(STORAGE_KEYS.invoices, [wireInv, ...invoices]);
  }

  appendGovernanceLog({
    actorEmail: input.actorEmail || "hq.admin@documento.ai",
    agencyName: createdTenant.tradingName,
    actionCode: "platform.sales_led_provisioned",
    detail: `Direct-provisioned ${createdTenant.tradingName} (${spec.label} • $${mrr}/mo • ${seatLimit} seats • ${
      input.kybVerifiedOnCall ? "KYB Verified on Call" : "KYB Docs Requested"
    }).`,
  });

  if (typeof window !== "undefined") {
    fetch("/api/backend/agency-platform/super-admin/agencies/provision-direct", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Role": "platform_super_admin",
      },
      body: JSON.stringify({
        legal_entity_name: createdTenant.legalEntityName,
        trading_name: createdTenant.tradingName,
        slug: createdTenant.slug,
        owner_full_name: createdTenant.ownerFullName,
        owner_email: createdTenant.ownerEmail,
        hq_country: createdTenant.hqCountry,
        hq_city: createdTenant.hqCity,
        kyb_track: createdTenant.kybTrack,
        regulatory_body: createdTenant.regulatoryBody,
        license_number: createdTenant.licenseNumber,
        enabled_corridors: createdTenant.enabledCorridors,
        plan_tier: createdTenant.planTier,
        custom_mrr_usd: mrr,
        custom_seat_limit: seatLimit,
      }),
    }).catch(() => {});
  }

  return createdTenant;
}

export function getAgencyTeamInvites(organizationId?: string): AgencyTeamInviteRecord[] {
  const stored = readJsonStorage<AgencyTeamInviteRecord[] | null>(STORAGE_KEYS.teamInvites, null);
  const all = stored ?? [];
  if (!organizationId) return all;
  return all.filter((i) => i.organizationId === organizationId);
}

export function inviteAgencyTeamMember(input: {
  organizationId: string;
  fullName: string;
  email: string;
  role: "case_manager" | "paralegal";
  branchOffice?: string;
}): AgencyTeamInviteRecord {
  const agency = getAgencyForOrganization(input.organizationId);
  if (!agency) {
    throw new Error("Agency workspace not found.");
  }
  if (!input.fullName.trim() || !input.email.includes("@")) {
    throw new Error("Enter staff member's full name and work email.");
  }
  if (agency.seatsUsed >= agency.seatLimit) {
    throw new Error(
      `Seat cap reached (${agency.seatsUsed}/${agency.seatLimit} seats). Request a seat expansion from Documento HQ.`
    );
  }

  const allInvites = getAgencyTeamInvites();
  const normalizedEmail = input.email.trim().toLowerCase();
  if (allInvites.some((i) => i.email.toLowerCase() === normalizedEmail)) {
    throw new Error(`${normalizedEmail} has already been invited to an agency workspace.`);
  }

  const invite: AgencyTeamInviteRecord = {
    id: `inv-staff-${Date.now()}`,
    organizationId: agency.organizationId,
    agencySlug: agency.slug,
    agencyLegalName: agency.legalEntityName,
    fullName: input.fullName.trim(),
    email: normalizedEmail,
    role: input.role,
    branchOffice: input.branchOffice?.trim() || agency.hqCity,
    passcode: `DocTeam!${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    invitedAt: new Date().toISOString(),
  };

  writeJsonStorage(STORAGE_KEYS.teamInvites, [invite, ...allInvites]);

  // Increment seatsUsed on active tenant if provisioned
  const tenants = getAgencyTenants();
  const matchedTenant = tenants.find((t) => t.organizationId === input.organizationId);
  if (matchedTenant) {
    writeJsonStorage(
      STORAGE_KEYS.tenants,
      tenants.map((t) =>
        t.organizationId === input.organizationId ? { ...t, seatsUsed: t.seatsUsed + 1 } : t
      )
    );
  }

  return invite;
}

export function getPlatformBillingInvoices(): AgencyBillingInvoice[] {
  const stored = readJsonStorage<AgencyBillingInvoice[] | null>(STORAGE_KEYS.invoices, null);
  if (!stored) {
    writeJsonStorage(STORAGE_KEYS.invoices, SEED_INVOICES);
    return SEED_INVOICES;
  }
  return stored;
}

export function recordAgencyInvoicePaid(
  invoiceId: string,
  actorEmail: string = "hq.admin@documento.ai"
): AgencyBillingInvoice {
  const all = getPlatformBillingInvoices();
  const target = all.find((inv) => inv.id === invoiceId);
  if (!target) throw new Error("Invoice not found.");

  const updated: AgencyBillingInvoice = {
    ...target,
    status: "paid",
    paidAt: new Date().toISOString(),
  };
  writeJsonStorage(
    STORAGE_KEYS.invoices,
    all.map((inv) => (inv.id === invoiceId ? updated : inv))
  );

  // If this was Indus's Growth wire upgrade or a past-due account, reconcile tenant billing status
  const tenants = getAgencyTenants();
  const tenant = tenants.find((t) => t.organizationId === target.organizationId);
  if (tenant) {
    const isGrowthWireUpgrade =
      target.paymentMethod === "wire_invoice" && target.amountUsd >= 499 && tenant.planTier === "boutique";
    const nextTenant: AgencyTenantRecord = isGrowthWireUpgrade
      ? {
          ...tenant,
          planTier: "growth",
          mrrUsd: target.amountUsd,
          billingStatus: "active",
          seatLimit: Math.max(tenant.seatLimit, 18),
          monthlyCaseQuota: Math.max(tenant.monthlyCaseQuota, 180),
          monthlyAiExtractionQuota: Math.max(tenant.monthlyAiExtractionQuota, 2500),
        }
      : {
          ...tenant,
          billingStatus: "active",
        };
    writeJsonStorage(
      STORAGE_KEYS.tenants,
      tenants.map((t) => (t.organizationId === tenant.organizationId ? nextTenant : t))
    );
  }

  appendGovernanceLog({
    actorEmail,
    agencyName: target.tradingName,
    actionCode: "billing.invoice_settled",
    detail: `Marked ${target.invoiceNumber} ($${target.amountUsd} • ${target.paymentMethod}) as PAID.`,
  });

  return updated;
}

export function extendAgencyTrialDays(
  organizationId: string,
  extraDays: number = 7,
  actorEmail: string = "hq.admin@documento.ai"
): AgencyTenantRecord {
  const tenants = getAgencyTenants();
  const target = tenants.find((t) => t.organizationId === organizationId);
  if (!target) throw new Error("Agency tenant not found.");

  const baseMs = target.trialEndsAt ? new Date(target.trialEndsAt).getTime() : Date.now();
  const nextEndsAt = new Date(Math.max(baseMs, Date.now()) + extraDays * 24 * 60 * 60 * 1000).toISOString();

  const updated: AgencyTenantRecord = {
    ...target,
    trialEndsAt: nextEndsAt,
  };
  writeJsonStorage(
    STORAGE_KEYS.tenants,
    tenants.map((t) => (t.organizationId === organizationId ? updated : t))
  );
  appendGovernanceLog({
    actorEmail,
    agencyName: target.tradingName,
    actionCode: "billing.trial_extended",
    detail: `Extended 14-day pilot by +${extraDays} days (new expiry: ${nextEndsAt.slice(0, 10)}).`,
  });
  return updated;
}

export function computeBillingAndMarginSummary(
  tenants: AgencyTenantRecord[],
  invoices: AgencyBillingInvoice[]
) {
  const activeTenants = tenants.filter((t) => t.status === "active");
  const mrrUsd = activeTenants.reduce((sum, t) => sum + t.mrrUsd, 0);
  const aiRuns30d = activeTenants.reduce((sum, t) => sum + t.aiExtractionsUsed30d, 0);
  const estimatedAiCostUsd = Math.round(aiRuns30d * 0.04 * 100) / 100;
  const grossMarginPct =
    mrrUsd > 0 ? Math.max(0, Math.round(((mrrUsd - estimatedAiCostUsd) / mrrUsd) * 1000) / 10) : 100;
  const pendingReceivablesUsd = invoices
    .filter((i) => i.status === "pending_wire" || i.status === "past_due")
    .reduce((sum, i) => sum + i.amountUsd, 0);
  const pastDueCount = invoices.filter((i) => i.status === "past_due").length;
  const pendingWireCount = invoices.filter((i) => i.status === "pending_wire").length;
  const activeTrialsCount = activeTenants.filter((t) => t.billingStatus === "trialing").length;

  return {
    mrrUsd,
    estimatedAiCostUsd,
    netContributionUsd: Math.round((mrrUsd - estimatedAiCostUsd) * 100) / 100,
    grossMarginPct,
    pendingReceivablesUsd,
    pastDueCount,
    pendingWireCount,
    activeTrialsCount,
  };
}

export function getAgencySupportTickets(organizationId?: string): AgencySupportTicket[] {
  const stored = readJsonStorage<AgencySupportTicket[] | null>(STORAGE_KEYS.tickets, null);
  const all = stored ?? SEED_SUPPORT_TICKETS;
  if (!stored) writeJsonStorage(STORAGE_KEYS.tickets, SEED_SUPPORT_TICKETS);
  if (!organizationId) return all;
  return all.filter((t) => t.organizationId === organizationId);
}

export function createAgencySupportTicket(input: {
  organizationId: string;
  requesterEmail: string;
  category: AgencySupportTicket["category"];
  subject: string;
  message: string;
  attachBreakGlassToken?: boolean;
}): AgencySupportTicket {
  if (!input.subject.trim() || !input.message.trim()) {
    throw new Error("Enter both a subject and details for your support request.");
  }
  const agency = getAgencyForOrganization(input.organizationId);
  const tradingName = agency?.tradingName || "Partner Agency";

  if (input.attachBreakGlassToken && agency) {
    toggleBreakGlassSupportGrant(
      agency.organizationId,
      true,
      `Support Ticket: ${input.subject.trim()}`,
      input.requesterEmail
    );
  }

  const nowIso = new Date().toISOString();
  const ticket: AgencySupportTicket = {
    id: `tkt-${Date.now()}`,
    ticketCode: `SUP-${Math.floor(4100 + Math.random() * 5800)}`,
    organizationId: input.organizationId,
    tradingName,
    requesterEmail: input.requesterEmail,
    category: input.category,
    subject: input.subject.trim(),
    message: input.message.trim(),
    breakGlassAttached: Boolean(input.attachBreakGlassToken),
    status: "open",
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const all = getAgencySupportTickets();
  writeJsonStorage(STORAGE_KEYS.tickets, [ticket, ...all]);
  appendGovernanceLog({
    actorEmail: input.requesterEmail,
    agencyName: tradingName,
    actionCode: "support.ticket_opened",
    detail: `${ticket.ticketCode}: ${ticket.subject}${ticket.breakGlassAttached ? " [2h Break-Glass Attached]" : ""}`,
  });
  return ticket;
}

export function replyAndResolveSupportTicket(
  ticketId: string,
  replyText: string,
  actorEmail: string = "hq.admin@documento.ai"
): AgencySupportTicket {
  if (replyText.trim().length < 5) {
    throw new Error("Enter an official HQ response (at least 5 characters) before resolving.");
  }
  const all = getAgencySupportTickets();
  const target = all.find((t) => t.id === ticketId);
  if (!target) throw new Error("Support ticket not found.");

  const updated: AgencySupportTicket = {
    ...target,
    status: "resolved",
    hqReply: replyText.trim(),
    repliedByEmail: actorEmail,
    updatedAt: new Date().toISOString(),
  };
  writeJsonStorage(
    STORAGE_KEYS.tickets,
    all.map((t) => (t.id === ticketId ? updated : t))
  );
  appendGovernanceLog({
    actorEmail,
    agencyName: target.tradingName,
    actionCode: "support.ticket_resolved",
    detail: `Resolved ${target.ticketCode}: ${replyText.trim()}`,
  });
  return updated;
}

export function getStatutoryRuleBroadcasts(corridorsFilter?: string[]): StatutoryRuleBroadcast[] {
  const stored = readJsonStorage<StatutoryRuleBroadcast[] | null>(STORAGE_KEYS.broadcasts, null);
  const all = stored ?? SEED_RULE_BROADCASTS;
  if (!stored) writeJsonStorage(STORAGE_KEYS.broadcasts, SEED_RULE_BROADCASTS);
  if (!corridorsFilter || corridorsFilter.length === 0) return all;
  return all.filter((b) => corridorsFilter.includes(b.corridorCode) || b.corridorCode === "ALL");
}

export function publishStatutoryRuleBroadcast(input: {
  corridorCode: string;
  title: string;
  summary: string;
  effectiveDate?: string;
  actorEmail?: string;
}): StatutoryRuleBroadcast {
  if (!input.title.trim() || !input.summary.trim()) {
    throw new Error("Enter both a bulletin headline and statutory summary.");
  }
  const item: StatutoryRuleBroadcast = {
    id: `rb-${Date.now()}`,
    corridorCode: input.corridorCode || "ALL",
    title: input.title.trim(),
    summary: input.summary.trim(),
    effectiveDate: input.effectiveDate || new Date().toISOString().slice(0, 10),
    publishedByEmail: input.actorEmail || "hq.admin@documento.ai",
    publishedAt: new Date().toISOString(),
  };
  const all = getStatutoryRuleBroadcasts();
  writeJsonStorage(STORAGE_KEYS.broadcasts, [item, ...all]);
  appendGovernanceLog({
    actorEmail: item.publishedByEmail,
    agencyName: `All ${item.corridorCode} Partner Agencies`,
    actionCode: "rules.statutory_broadcast_published",
    detail: `[${item.corridorCode}] ${item.title}`,
  });
  return item;
}


