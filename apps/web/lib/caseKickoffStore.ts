export const CASE_KICKOFF_STORAGE_KEY = "documento_case_kickoff_v1";

export interface CaseKickoffRecord {
  caseId: string;
  caseNumber: string;
  clientId: string;
  step1CredentialsShared: boolean;
  step2ChecklistDispatched: boolean;
  step3RetainerConfigured: boolean;
  step4InitialDocsOrWorkspace: boolean;
  assignedOfficer?: string;
  dispatchedChecklistCount?: number;
  intakeQuestionnaireEnabled?: boolean;
  retainerInvoiceNumber?: string;
  retainerAmountLabel?: string;
  retainerMode?: "issued" | "paid" | "skipped";
  uploadedInitialDocCount?: number;
  completedAt?: string | null;
  updatedAt: string;
}

export interface PathwayKickoffTemplateItem {
  code: string;
  title: string;
  category: string;
  citation: string;
  description: string;
  mandatory: boolean;
}

export interface PathwayKickoffDefaults {
  currency: "USD" | "CAD" | "GBP" | "AUD" | "EUR";
  suggestedRetainerAmount: number;
  representationFormLabel: string;
  items: PathwayKickoffTemplateItem[];
}

function readAllKickoffRecords(): Record<string, CaseKickoffRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CASE_KICKOFF_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAllKickoffRecords(records: Record<string, CaseKickoffRecord>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CASE_KICKOFF_STORAGE_KEY, JSON.stringify(records));
    window.dispatchEvent(new CustomEvent("documento-kickoff-updated"));
  } catch {
    // Ignore storage quota errors
  }
}

export function initCaseKickoffRecord(params: {
  caseId: string;
  caseNumber: string;
  clientId: string;
  assignedOfficer?: string;
}): CaseKickoffRecord {
  const all = readAllKickoffRecords();
  if (all[params.caseId]) {
    return all[params.caseId];
  }
  const fresh: CaseKickoffRecord = {
    caseId: params.caseId,
    caseNumber: params.caseNumber,
    clientId: params.clientId,
    step1CredentialsShared: false,
    step2ChecklistDispatched: false,
    step3RetainerConfigured: false,
    step4InitialDocsOrWorkspace: false,
    assignedOfficer: params.assignedOfficer,
    intakeQuestionnaireEnabled: true,
    uploadedInitialDocCount: 0,
    completedAt: null,
    updatedAt: new Date().toISOString(),
  };
  all[params.caseId] = fresh;
  writeAllKickoffRecords(all);
  return fresh;
}

export function getCaseKickoffRecord(caseId: string): CaseKickoffRecord | null {
  const all = readAllKickoffRecords();
  return all[caseId] || null;
}

export function updateCaseKickoffRecord(
  caseId: string,
  patch: Partial<Omit<CaseKickoffRecord, "caseId">> & { caseNumber?: string; clientId?: string }
): CaseKickoffRecord {
  const all = readAllKickoffRecords();
  const existing = all[caseId] || {
    caseId,
    caseNumber: patch.caseNumber || "CASE",
    clientId: patch.clientId || "",
    step1CredentialsShared: false,
    step2ChecklistDispatched: false,
    step3RetainerConfigured: false,
    step4InitialDocsOrWorkspace: false,
    intakeQuestionnaireEnabled: true,
    uploadedInitialDocCount: 0,
    completedAt: null,
    updatedAt: new Date().toISOString(),
  };

  const merged: CaseKickoffRecord = {
    ...existing,
    ...patch,
    caseId,
    updatedAt: new Date().toISOString(),
  };

  const allFourDone =
    merged.step1CredentialsShared &&
    merged.step2ChecklistDispatched &&
    merged.step3RetainerConfigured &&
    merged.step4InitialDocsOrWorkspace;

  if (allFourDone && !merged.completedAt) {
    merged.completedAt = new Date().toISOString();
  }

  all[caseId] = merged;
  writeAllKickoffRecords(all);
  return merged;
}

export function getCaseKickoffProgress(caseId: string): {
  record: CaseKickoffRecord | null;
  completedCount: number;
  totalSteps: 4;
  isComplete: boolean;
  nextStepIndex: 1 | 2 | 3 | 4;
} {
  const rec = getCaseKickoffRecord(caseId);
  if (!rec) {
    return {
      record: null,
      completedCount: 0,
      totalSteps: 4,
      isComplete: false,
      nextStepIndex: 1,
    };
  }
  const flags = [
    rec.step1CredentialsShared,
    rec.step2ChecklistDispatched,
    rec.step3RetainerConfigured,
    rec.step4InitialDocsOrWorkspace,
  ];
  const completedCount = flags.filter(Boolean).length;
  const isComplete = Boolean(rec.completedAt) || completedCount === 4;
  const firstPendingIdx = flags.findIndex((f) => !f);
  const nextStepIndex = (firstPendingIdx === -1 ? 4 : firstPendingIdx + 1) as 1 | 2 | 3 | 4;

  return {
    record: rec,
    completedCount,
    totalSteps: 4,
    isComplete,
    nextStepIndex,
  };
}

export function getPathwayKickoffDefaults(
  jurisdiction: string,
  visaCategory: string
): PathwayKickoffTemplateItem[] {
  return getPathwayKickoffConfig(jurisdiction, visaCategory).items;
}

export function getPathwayKickoffConfig(
  jurisdiction: string,
  visaCategory: string
): PathwayKickoffDefaults {
  const jur = (jurisdiction || "").toLowerCase();
  const cat = (visaCategory || "").toLowerCase();

  if (jur.includes("canada") || jur.includes("ircc") || jur === "ca") {
    const isStudy = cat.includes("study");
    return {
      currency: "CAD",
      suggestedRetainerAmount: isStudy ? 1800 : 3200,
      representationFormLabel: "IRCC Use of Representative Form (IMM 5476)",
      items: isStudy
        ? [
            {
              code: "CA-ID-PASSPORT",
              title: "Valid Passport Biodata & Stamped Pages",
              category: "identity_passport",
              citation: "IRPR s. 52(1)",
              description: "Color scan of unexpired passport bio-page plus all prior visas and entry/exit stamps.",
              mandatory: true,
            },
            {
              code: "CA-IMM5476",
              title: "Signed IRCC Use of Representative (IMM 5476)",
              category: "government_correspondence",
              citation: "IRPA s. 91",
              description: "Executed IMM 5476 authorizing regulated counsel representation on the IRCC file.",
              mandatory: true,
            },
            {
              code: "CA-DLI-PAL",
              title: "DLI Letter of Acceptance & Provincial Attestation Letter (PAL)",
              category: "educational_records",
              citation: "IRPR s. 219",
              description: "Official Designated Learning Institution LOA and provincial attestation quota letter.",
              mandatory: true,
            },
            {
              code: "CA-POF-GIC",
              title: "Guaranteed Investment Certificate (GIC) & Tuition Receipt",
              category: "financial_evidence",
              citation: "IRPR s. 220",
              description: "Proof of CAD $20,635+ living funds / GIC certificate and first-year tuition payment.",
              mandatory: true,
            },
          ]
        : [
            {
              code: "CA-ID-PASSPORT",
              title: "Valid Passport Biodata & Civil Identity Docs",
              category: "identity_passport",
              citation: "IRPR R10(1)(c)",
              description: "Unexpired passport bio-page and civil status records for principal applicant and family.",
              mandatory: true,
            },
            {
              code: "CA-IMM5476",
              title: "Signed IRCC Use of Representative (IMM 5476)",
              category: "government_correspondence",
              citation: "IRPA s. 91",
              description: "Executed IMM 5476 designating counsel for Express Entry / PNP representation.",
              mandatory: true,
            },
            {
              code: "CA-LANG-ECA",
              title: "IELTS / CELPIP / TEF Report & ECA Credential Evaluation",
              category: "educational_records",
              citation: "IRPA s. 10.3",
              description: "Valid language test result (< 2 years) and WES/ICES Educational Credential Assessment.",
              mandatory: true,
            },
            {
              code: "CA-NOC-REF",
              title: "TEER / NOC Employer Reference Letters & T4 / Paystubs",
              category: "employment_records",
              citation: "IRPR s. 75 / s. 87.1",
              description: "Company-letterhead reference letters listing duties, hours/week, salary, and dates.",
              mandatory: true,
            },
          ],
    };
  }

  if (jur.includes("united kingdom") || jur.includes("home office") || jur === "uk" || jur === "gb") {
    return {
      currency: "GBP",
      suggestedRetainerAmount: 2200,
      representationFormLabel: "Home Office Legal Authority & Client Care Letter",
      items: [
        {
          code: "UK-ID-PASSPORT",
          title: "Valid Passport & Current UK BRP / eVisa Share Code",
          category: "identity_passport",
          citation: "Immigration Rules Part 1",
          description: "Clear color scan of current passport bio-page and any prior UK visa vignettes.",
          mandatory: true,
        },
        {
          code: "UK-COS-CAS",
          title: "Certificate of Sponsorship (CoS) / CAS / Endorsement Letter",
          category: "employment_records",
          citation: "Appendix Skilled Worker SW 5.1",
          description: "Sponsor-assigned CoS reference document, SOC 2020 occupation code, and salary schedule.",
          mandatory: true,
        },
        {
          code: "UK-FIN-28DAY",
          title: "28-Day Bank Maintenance Statement (or Sponsor A-Rated Cert)",
          category: "financial_evidence",
          citation: "Appendix Finance FIN 2.1",
          description: "Official bank statement held for 28 consecutive days ending within 31 days of application.",
          mandatory: true,
        },
        {
          code: "UK-LANG-TB",
          title: "Approved SELT English Certificate / Ecctis & TB Clearance",
          category: "police_medical",
          citation: "Appendix English Language / Appendix T",
          description: "UKVI SELT or degree certificate plus IOM Tuberculosis certificate where applicable.",
          mandatory: true,
        },
      ],
    };
  }

  if (jur.includes("australia") || jur.includes("home affairs") || jur === "au") {
    return {
      currency: "AUD",
      suggestedRetainerAmount: 3000,
      representationFormLabel: "Form 956 — Appointment of Registered Migration Agent / Legal Practitioner",
      items: [
        {
          code: "AU-ID-PASSPORT",
          title: "Valid Passport Biodata & National Identity Card",
          category: "identity_passport",
          citation: "Migration Regulations 1994 Sch 2",
          description: "High-resolution color scan of passport bio-page and birth/marriage civil records.",
          mandatory: true,
        },
        {
          code: "AU-FORM-956",
          title: "Signed Form 956 Representation Authorization",
          category: "government_correspondence",
          citation: "Migration Act 1958 Part 3",
          description: "Signed Form 956 authorizing ImmiAccount representation and department correspondence.",
          mandatory: true,
        },
        {
          code: "AU-SKILLS-COE",
          title: "Skills Assessment / CoE & OSHC Health Cover Policy",
          category: "educational_records",
          citation: "Schedule 2 / Schedule 6D",
          description: "Positive ACS/EA/VETASSESS skills outcome or Confirmation of Enrolment + OSHC certificate.",
          mandatory: true,
        },
        {
          code: "AU-ENG-AFP",
          title: "IELTS / PTE Academic Score & Police Clearance (AFP / PCC)",
          category: "police_medical",
          citation: "PIC 4001 / Competent English",
          description: "Valid English test report and national police certificates for 12+ month residence countries.",
          mandatory: true,
        },
      ],
    };
  }

  if (jur.includes("germany") || jur.includes("bamf") || jur === "de") {
    return {
      currency: "EUR",
      suggestedRetainerAmount: 1950,
      representationFormLabel: "Signed Power of Attorney (Vollmacht § 14 VwVfG)",
      items: [
        {
          code: "DE-ID-PASSPORT",
          title: "Valid Biometric Passport (Issued Within Last 10 Years)",
          category: "identity_passport",
          citation: "§ 3 AufenthG",
          description: "Color scan of passport bio-page with at least 2 blank visa pages.",
          mandatory: true,
        },
        {
          code: "DE-VOLLMACHT",
          title: "Signed Counsel Power of Attorney (Vollmacht)",
          category: "government_correspondence",
          citation: "§ 14 VwVfG",
          description: "Executed representation mandate for German mission / Ausländerbehörde filings.",
          mandatory: true,
        },
        {
          code: "DE-ANABIN-ZAB",
          title: "Degree Diploma, Transcripts & Anabin H+ / ZAB Printout",
          category: "educational_records",
          citation: "§ 20a / § 20b AufenthG",
          description: "University degree certificate alongside Anabin H+ institution & degree equivalence proof.",
          mandatory: true,
        },
        {
          code: "DE-SPERRKONTO",
          title: "Sperrkonto Blocked Account Confirmation & Language Proof (A1 / B2)",
          category: "financial_evidence",
          citation: "§ 5 Abs. 1 Nr. 1 AufenthG",
          description: "Blocked account confirmation (€1,091/month) or employment contract + Goethe/IELTS certificate.",
          mandatory: true,
        },
      ],
    };
  }

  // Default: United States (USCIS / Consular)
  return {
    currency: "USD",
    suggestedRetainerAmount: 3500,
    representationFormLabel: "Form G-28 — Notice of Entry of Appearance as Attorney",
    items: [
      {
        code: "US-ID-PASSPORT",
        title: "Unexpired Passport Biodata, US Visas & Most Recent Form I-94",
        category: "identity_passport",
        citation: "8 CFR § 103.2(b)",
        description: "Clear scan of passport bio-page, prior US visa stamps, and CBP I-94 travel history.",
        mandatory: true,
      },
      {
        code: "US-FORM-G28",
        title: "Signed Form G-28 Notice of Entry of Appearance",
        category: "government_correspondence",
        citation: "8 CFR § 292.4(a)",
        description: "Executed Form G-28 authorizing counsel to appear before USCIS / Department of State.",
        mandatory: true,
      },
      {
        code: "US-EDU-CV",
        title: "Comprehensive Curriculum Vitae, Degree Diplomas & Transcripts",
        category: "educational_records",
        citation: "8 CFR § 204.5 / § 214.2",
        description: "Updated CV/resume, academic diplomas, transcripts, and credential evaluation if foreign.",
        mandatory: true,
      },
      {
        code: "US-EMP-EVIDENCE",
        title: "Employer Support / Experience Letters & Pathway Evidentiary Exhibits",
        category: "employment_records",
        citation: "INA § 203(b) / § 101(a)(15)",
        description: "Signed employment verification, LCA / I-20 / scholarly or extraordinary ability exhibits.",
        mandatory: true,
      },
    ],
  };
}

