/**
 * Dynamic Statutory Representation Forms and Regulatory Citations by Corridor
 */

export interface JurisdictionRepresentationInfo {
  code: string;
  formName: string;
  checkboxLabel: string;
  recordedBadge: string;
  statutoryCitation: string;
  authorityDescription: string;
  formsListEntry: string;
}

export function getJurisdictionRepresentationInfo(jurisdiction?: string | null): JurisdictionRepresentationInfo {
  const jur = (jurisdiction || "").toLowerCase();

  if (jur.includes("canada") || jur.includes("ircc")) {
    return {
      code: "IMM_5476",
      formName: 'IMM 5476 "Use of a Representative"',
      checkboxLabel: "Record IMM 5476 Use of a Representative for applicant",
      recordedBadge: "✓ IMM 5476 Use of a Representative Recorded",
      statutoryCitation: "IRPA s. 91 / IRPR Part 2",
      authorityDescription: "Statutory representative declaration under IRCC & Immigration and Refugee Protection Act",
      formsListEntry: "IMM 5476 (Use of a Representative)",
    };
  }

  if (jur.includes("united kingdom") || jur.includes("home office") || jur === "uk" || jur === "gb") {
    return {
      code: "UKVI_REP",
      formName: "Statutory Legal Representation Disclosure",
      checkboxLabel: "Record Statutory Legal Representation Disclosure for applicant",
      recordedBadge: "✓ Statutory Legal Representation Disclosure Recorded",
      statutoryCitation: "Immigration Act 1971 / OISC Regulatory Scheme",
      authorityDescription: "Regulated legal representation authorization under UKVI and Immigration Act standards",
      formsListEntry: "Statutory Legal Representation Disclosure",
    };
  }

  if (jur.includes("australia") || jur.includes("home affairs") || jur === "au") {
    return {
      code: "FORM_956",
      formName: "Form 956 Appointment of Representative",
      checkboxLabel: "Record Form 956 Appointment of Representative for applicant",
      recordedBadge: "✓ Form 956 Appointment of Representative Recorded",
      statutoryCitation: "Migration Act 1958 Part 3",
      authorityDescription: "Statutory representative appointment under Department of Home Affairs regulations",
      formsListEntry: "Form 956 (Appointment of Representative)",
    };
  }

  if (jur.includes("germany") || jur.includes("bamf") || jur === "de") {
    return {
      code: "GER_VOLLMACHT",
      formName: "Statutory Representation Authorization (Vollmacht)",
      checkboxLabel: "Record Statutory Legal Representation Authorization (Vollmacht) for applicant",
      recordedBadge: "✓ Statutory Legal Representation Authorization Recorded",
      statutoryCitation: "§ 14 VwVfG / § 81 AufenthG",
      authorityDescription: "Formal administrative power of attorney under German Aufenthaltsgesetz",
      formsListEntry: "Statutory Representation Authorization (Vollmacht)",
    };
  }

  // Default: United States (USCIS)
  return {
    code: "USCIS_G28",
    formName: "Form G-28 Notice of Entry of Appearance as Attorney",
    checkboxLabel: "Record Form G-28 Legal Representation Agreement for applicant",
    recordedBadge: "✓ Form G-28 Legal Representation Recorded",
    statutoryCitation: "8 CFR § 292.1 / § 292.4",
    authorityDescription: "DHS authorized legal representative authority under 8 CFR § 292.1",
    formsListEntry: "Form G-28 (Notice of Attorney Representation)",
  };
}
