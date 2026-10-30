"use client";

import React, { useState, useMemo } from "react";

export interface ImmigrationPathway {
  id: string;
  code: string;
  title: string;
  country: string;
  countryCode: "US" | "UK" | "CA" | "AU" | "DE";
  flag: string;
  governingBody: string;
  category: "Employment & Skilled Worker" | "Nonimmigrant Talent" | "Permanent Residence" | "Multinational Transfer" | "Study & Student Permits" | "Family & Sponsorship" | "Visitor & Temporary Resident";
  status: "Available" | "Planned";
  applicantProfile: string;
  statutoryBasis: string;
  formSupport: string;
  caseNeeds: string[];
  documentWorkflows: string[];
  documentoFeatures: string[];
  summary: string;
}

export const VERIFIED_PATHWAYS: ImmigrationPathway[] = [
  // --- CANADA (Priority 1 Jurisdiction) ---
  {
    id: "ca-super-visa",
    code: "Super Visa",
    title: "Canadian Super Visa (Parents & Grandparents)",
    country: "Canada",
    countryCode: "CA",
    flag: "🇨🇦",
    governingBody: "IRCC (Immigration, Refugees and Citizenship Canada)",
    category: "Family & Sponsorship",
    status: "Available",
    applicantProfile: "Parents and grandparents of Canadian citizens or permanent residents seeking extended stays up to 5 consecutive years.",
    statutoryBasis: "IRPA § 15; IRPR ss. 179-193; Super Visa Ministerial Instructions.",
    formSupport: "IMM 5257 (Application for Visitor Visa), IMM 5404, IMM 5707 (Family Information).",
    summary: "5-year multi-entry stay with mandatory private medical insurance verification and host child LICO financial threshold calculation.",
    caseNeeds: [
      "Invitation letter from child/grandchild with statutory undertaking of support",
      "Host child/grandchild proof of income meeting statutory LICO minimum threshold",
      "Prepaid 365-day emergency medical insurance ($100k+ CAD) from approved carrier",
      "Upfront immigration medical examination (IME) cleared with no inadmissibility",
    ],
    documentWorkflows: [
      "Host child CRA Notice of Assessment (NOA) Line 15000 tax validator",
      "Canadian insurance underwriter policy binder and coverage audit",
      "eMedical upfront medical assessment summary sheet indexing",
      "Proof of parental relationship (birth certificates and lineage documents)",
    ],
    documentoFeatures: [
      "Automated LICO benchmark calculator by household family size",
      "Insurance policy term and deductible compliance inspector",
      "Statutory refusal history declaration cross-checks",
    ],
  },
  {
    id: "ca-study-permit",
    code: "Study Permit",
    title: "Canada Study Permit (DLI & SDS Stream)",
    country: "Canada",
    countryCode: "CA",
    flag: "🇨🇦",
    governingBody: "IRCC (Immigration, Refugees and Citizenship Canada)",
    category: "Study & Student Permits",
    status: "Available",
    applicantProfile: "International students admitted to a Canadian Designated Learning Institution (DLI) pursuing degree, diploma, or certificate programs.",
    statutoryBasis: "IRPR Part 12, Division 2, ss. 211-222; National Cap Ministerial Instructions.",
    formSupport: "IMM 1294 (Application for Study Permit Outside Canada), IMM 5645, PAL Certificate.",
    summary: "Full DLI acceptance verification, Provincial Attestation Letter (PAL) allocation validation, and living funds GIC checking.",
    caseNeeds: [
      "Official Letter of Acceptance (LOA) from Canadian Designated Learning Institution",
      "Provincial Attestation Letter (PAL) confirming allocation under national study cap",
      "Proof of financial sufficiency (tuition + C$20,635 minimum annual living costs)",
      "Statement of purpose explaining academic progression and nonimmigrant intent",
    ],
    documentWorkflows: [
      "DLI acceptance letter and DLI number cross-verification",
      "Guaranteed Investment Certificate (GIC) and wire receipt parsing",
      "Language test scorecard audit (IELTS, CELPIP, PTE, TEF)",
      "Educational credential evaluations and academic transcripts",
    ],
    documentoFeatures: [
      "Provincial Attestation Letter (PAL) exemption rule checker",
      "Living funds minimum threshold validator (IRCC revised benchmarks)",
      "Study permit expiration watch and extension alert tracker",
    ],
  },
  {
    id: "ca-sowp",
    code: "SOWP",
    title: "Spousal Open Work Permit (SOWP)",
    country: "Canada",
    countryCode: "CA",
    flag: "🇨🇦",
    governingBody: "IRCC (Immigration, Refugees and Citizenship Canada)",
    category: "Employment & Skilled Worker",
    status: "Available",
    applicantProfile: "Spouses and common-law partners of full-time international students (master's/doctoral) or high-skilled foreign workers in Canada.",
    statutoryBasis: "IRPR s. 205(c)(ii); Exemption Code C41 / C42; 2024 Spousal Eligibility Reforms.",
    formSupport: "IMM 5710 (Application for Work Permit Inside Canada / Change Conditions).",
    summary: "Open work authorization tied to principal spouse's valid status in qualifying graduate study program or TEER 0, 1, 2, 3 employment.",
    caseNeeds: [
      "Proof of principal spouse's valid Canadian study permit or work permit",
      "Evidence principal spouse is enrolled in qualifying master's/doctoral program or employed in qualifying TEER",
      "Proof of genuine marriage or continuous 12-month cohabitation as common-law partners",
      "Principal spouse's proof of income (pay stubs, employment contract, tax filings)",
    ],
    documentWorkflows: [
      "Marriage certificates and certified legal translations",
      "Co-habitation evidence (joint lease agreements, joint bank accounts, utility bills)",
      "Principal spouse's university enrollment confirmation or employment letter",
    ],
    documentoFeatures: [
      "TEER occupation code and graduate study eligibility matrix",
      "Bona fide relationship timeline and photo metadata indexer",
      "Maintained status protection tracker during permit processing",
    ],
  },
  {
    id: "ca-pgwp",
    code: "PGWP",
    title: "Post-Graduation Work Permit (PGWP)",
    country: "Canada",
    countryCode: "CA",
    flag: "🇨🇦",
    governingBody: "IRCC (Immigration, Refugees and Citizenship Canada)",
    category: "Employment & Skilled Worker",
    status: "Available",
    applicantProfile: "Graduates of eligible Canadian public and degree-granting post-secondary institutions seeking open Canadian work experience.",
    statutoryBasis: "IRPR s. 205(c)(ii); Exemption Code C43; PGWP Language and CIP Alignment Rules.",
    formSupport: "IMM 5710 (Application to Change Conditions, Extend Stay or Remain as Worker).",
    summary: "Up to 3-year open work permit with 180-day filing clock, graduation verification, and language proficiency compliance.",
    caseNeeds: [
      "Official letter of degree completion and final academic transcripts from eligible DLI",
      "Continuous full-time student status maintenance proof across each academic semester",
      "Application submitted within strictly 180 days of formal written program completion",
      "Language test results meeting field-specific benchmark (CLB 7 for university grads)",
    ],
    documentWorkflows: [
      "Official institutional completion letter and degree parchment inspection",
      "Academic transcript semester-by-semester full-time enrollment audit",
      "Passport validity alignment checking to ensure full eligible duration granted",
    ],
    documentoFeatures: [
      "180-day post-completion statutory deadline countdown watch",
      "Maintained work authorization clearance between study completion and decision",
      "Field of study CIP code eligibility and language requirement checker",
    ],
  },
  {
    id: "ca-trv",
    code: "Visitor Visa",
    title: "Canada Visitor Visa (Temporary Resident Visa / TRV)",
    country: "Canada",
    countryCode: "CA",
    flag: "🇨🇦",
    governingBody: "IRCC (Immigration, Refugees and Citizenship Canada)",
    category: "Visitor & Temporary Resident",
    status: "Available",
    applicantProfile: "Tourists, business visitors, and family members seeking temporary entry authorization to Canada for up to 6 months.",
    statutoryBasis: "IRPA s. 20; IRPR Part 9, ss. 179-193 (Temporary Resident Status).",
    formSupport: "IMM 5257 (Application for Visitor Visa), IMM 5645 / IMM 5707.",
    summary: "Single and multi-entry visitor visa packaging with ties to home country verification and financial capacity assessment.",
    caseNeeds: [
      "Proof of financial funds adequate for proposed duration and departure expenses",
      "Ties to country of origin establishing nonimmigrant intent (employment, property, family)",
      "Clear travel itinerary, flight bookings, and hotel or Canadian host invitation letter",
      "Biometrics collection and police clearance certificates where required",
    ],
    documentWorkflows: [
      "Bank statement 6-month transaction and liquidity audit",
      "Employment letter with approved leave of absence verification",
      "Host invitation letter and host Canadian immigration status proof",
    ],
    documentoFeatures: [
      "Dual nonimmigrant intent risk factor evaluation checklist",
      "Financial self-sufficiency conversion against Canadian living costs",
      "Prior refusal history disclosure tracker across 5-Eyes databases",
    ],
  },
  {
    id: "ca-ee",
    code: "Express Entry",
    title: "Canada Express Entry (FSWP & PNP)",
    country: "Canada",
    countryCode: "CA",
    flag: "🇨🇦",
    governingBody: "IRCC (Immigration, Refugees and Citizenship Canada)",
    category: "Permanent Residence",
    status: "Available",
    applicantProfile: "Skilled professionals seeking Canadian permanent residence through the Federal Skilled Worker Program (FSWP) or Provincial Nominee Programs (PNP).",
    statutoryBasis: "IRPA s. 12(2); IRPR ss. 75-87; NOC 2021 TEER Matrix.",
    formSupport: "Express Entry Profile & Post-ITA e-APR (electronic Application for PR).",
    summary: "CRS point scoring simulator, NOC/TEER classification validation, and post-ITA 60-day evidence checklist.",
    caseNeeds: [
      "Comprehensive Ranking System (CRS) score optimization across human capital factors",
      "Language test benchmarks (IELTS / CELPIP / TEF / TCF meeting CLB 7+ requirements)",
      "Educational Credential Assessment (ECA) report (WES, ICAS, CES)",
      "Proof of funds or valid Canadian job offer with provincial nomination alignment",
    ],
    documentWorkflows: [
      "Official language score sheets with test date validity tracking (2-year validity)",
      "ECA credential reports mapped to Canadian equivalency levels",
      "Reference letters verifying full-time skilled work experience under specific NOC/TEER codes",
      "Police certificates, medical examination receipts, and settlement fund bank letters",
    ],
    documentoFeatures: [
      "Automated NOC/TEER job duty cross-examination against reference letter texts",
      "Post-ITA 60-day filing clock with countdown notifications for urgent police certificates",
      "Settlement funds currency exchange rate converter and financial compliance flags",
    ],
  },

  // --- UNITED STATES (Priority 2 Jurisdiction) ---
  {
    id: "us-eb1a",
    code: "EB-1A",
    title: "EB-1A Extraordinary Ability",
    country: "United States",
    countryCode: "US",
    flag: "🇺🇸",
    governingBody: "USCIS (Department of Homeland Security)",
    category: "Permanent Residence",
    status: "Available",
    applicantProfile: "Individuals with extraordinary ability in sciences, arts, education, business, or athletics demonstrated by sustained acclaim.",
    statutoryBasis: "INA § 203(b)(1)(A); 8 CFR § 204.5(h); Kazarian two-part evaluation.",
    formSupport: "Form I-140 (Immigrant Petition for Alien Workers) & I-485 supplement.",
    summary: "10-criteria statutory evaluation engine, citation extraction, and Kazarian final merits assessment tracking.",
    caseNeeds: [
      "Satisfy at least 3 of 10 regulatory criteria or major one-time international prize",
      "Document sustained national or international acclaim and peer recognized impact",
      "Demonstrate substantial prospective benefit to the United States",
    ],
    documentWorkflows: [
      "Peer-reviewed journal publications and citation count verification",
      "Original scientific patents, licensing agreements, and commercial adoption reports",
      "Leading or critical role letters from distinguished institutional employers",
      "Independent peer recommendation letters and jury evaluation records",
    ],
    documentoFeatures: [
      "10-criteria statutory checklist engine with versioned USCIS policy memos",
      "Automated cross-exhibit date and biographic anomaly detection",
      "Kazarian two-stage analysis scorecard for supervising attorney review",
    ],
  },
  {
    id: "us-eb2-niw",
    code: "EB-2 NIW",
    title: "EB-2 National Interest Waiver (NIW)",
    country: "United States",
    countryCode: "US",
    flag: "🇺🇸",
    governingBody: "USCIS (Department of Homeland Security)",
    category: "Permanent Residence",
    status: "Available",
    applicantProfile: "Advanced degree professionals or exceptional ability individuals whose proposed endeavor has substantial merit and national importance.",
    statutoryBasis: "INA § 203(b)(1)(B); Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016).",
    formSupport: "Form I-140 (Immigrant Petition) with National Interest Waiver request.",
    summary: "Dhanasar 3-prong analytical matrix, proposed endeavor roadmap, and waiver justification evidence.",
    caseNeeds: [
      "Proof of Advanced Degree or Exceptional Ability (3 of 6 criteria)",
      "Prong 1: Proposed endeavor has substantial merit and national importance",
      "Prong 2: Beneficiary is well positioned to advance the proposed endeavor",
      "Prong 3: On balance, beneficial to the U.S. to waive the job offer and PERM",
    ],
    documentWorkflows: [
      "Academic credentials, foreign credential evaluations, and official transcripts",
      "Detailed proposed endeavor statement and technical whitepapers",
      "Letters of support from U.S. government stakeholders, industry leaders, and academics",
    ],
    documentoFeatures: [
      "Dhanasar 3-prong matrix evidence organizer with strength indicators",
      "Credential evaluation cross-verification with diploma metadata",
      "Support letter argument alignment tracker",
    ],
  },
  {
    id: "us-o1a",
    code: "O-1A",
    title: "O-1A Extraordinary Ability Nonimmigrant",
    country: "United States",
    countryCode: "US",
    flag: "🇺🇸",
    governingBody: "USCIS (Department of Homeland Security)",
    category: "Nonimmigrant Talent",
    status: "Available",
    applicantProfile: "Top-tier professionals in science, technology, education, or business seeking temporary nonimmigrant employment authorization.",
    statutoryBasis: "INA § 101(a)(15)(O)(i); 8 CFR § 214.2(o); Form I-129 O/P Supplement.",
    formSupport: "Form I-129 (Petition for a Nonimmigrant Worker) & O-Supplement.",
    summary: "Petitioner/agent itinerary tracking, advisory opinion letters, and nonimmigrant petition assembly.",
    caseNeeds: [
      "Qualifying U.S. petitioner or agent contract with detailed itinerary",
      "Peer group or labor organization advisory consultation opinion letter",
      "Evidence satisfying at least 3 of 8 regulatory evidentiary criteria",
    ],
    documentWorkflows: [
      "Petitioner support agreements, offer letters, and agent representation contracts",
      "Advisory opinion letters from recognized industry peer organizations",
      "Critical employment letters and compensation benchmarking evidence",
    ],
    documentoFeatures: [
      "Form I-129 field mapping with biographic integrity checks",
      "Advisory opinion tracking queue with expiration watches",
      "Dual waiting-state indicator (waiting on petitioner vs peer advisory)",
    ],
  },
  {
    id: "us-h1b",
    code: "H-1B",
    title: "H-1B Specialty Occupation Worker",
    country: "United States",
    countryCode: "US",
    flag: "🇺🇸",
    governingBody: "USCIS & Department of Labor (DOL)",
    category: "Employment & Skilled Worker",
    status: "Available",
    applicantProfile: "Foreign professionals with bachelor's degree or higher in a specific specialty occupation sponsored by a U.S. employer.",
    statutoryBasis: "INA § 101(a)(15)(H)(i)(b); 8 CFR § 214.2(h)(4); 20 CFR § 655.",
    formSupport: "Form ETA-9035 (LCA), Form I-129 (H Supplement), Form I-797.",
    summary: "Certified LCA wage level benchmarking, specialty occupation degree alignment, and cap-subject / cap-exempt petition tracking.",
    caseNeeds: [
      "Certified Labor Condition Application (LCA) with prevailing wage determination",
      "Specialty occupation job description requiring specific degree coursework",
      "Foreign academic degree evaluation matching U.S. 4-year bachelor's equivalent",
    ],
    documentWorkflows: [
      "Form ETA-9035 certified LCA and prevailing wage notice postings",
      "Detailed employer support letter and organizational position hierarchy",
      "University diplomas, official course transcripts, and credential evaluations",
    ],
    documentoFeatures: [
      "DOL SOC code and prevailing wage level wage tier validator",
      "Cap-subject lottery registration vs cap-exempt institution profile builder",
      "Public access file (PAF) compliance documentation compiler",
    ],
  },
  {
    id: "us-l1a",
    code: "L-1A",
    title: "L-1A Intracompany Transferee Executive/Manager",
    country: "United States",
    countryCode: "US",
    flag: "🇺🇸",
    governingBody: "USCIS (Department of Homeland Security)",
    category: "Multinational Transfer",
    status: "Available",
    applicantProfile: "Executives or managers transferring from a qualifying foreign entity to an affiliated U.S. branch, subsidiary, or parent company.",
    statutoryBasis: "INA § 101(a)(15)(L); 8 CFR § 214.2(l); Form I-129 L-Supplement.",
    formSupport: "Form I-129 (L-1A Supplement) or Form I-129S (Blanket L Petition).",
    summary: "Corporate relationship mapping, managerial organizational charts, and 1-year qualifying foreign employment audit.",
    caseNeeds: [
      "Qualifying corporate relationship (parent, branch, subsidiary, or affiliate)",
      "Continuous 1 year of full-time foreign employment within the 3 years preceding entry",
      "Managerial (personnel or functional) or executive capacity duties in both entities",
    ],
    documentWorkflows: [
      "Corporate stock certificates, articles of incorporation, and ownership ledgers",
      "Foreign and U.S. organizational charts with subordinate staff descriptions",
      "Foreign tax filings, payroll records, and employee W-2/equivalent records",
    ],
    documentoFeatures: [
      "Organizational tier analyzer verifying managerial vs non-managerial lines",
      "1-year foreign employment continuous timeline calculator",
      "Multi-entity document repository maintaining parent and affiliate corporate filings",
    ],
  },
  {
    id: "us-i485",
    code: "I-485 AOS",
    title: "Form I-485 Adjustment of Status (Green Card)",
    country: "United States",
    countryCode: "US",
    flag: "🇺🇸",
    governingBody: "USCIS (Department of Homeland Security)",
    category: "Permanent Residence",
    status: "Available",
    applicantProfile: "Foreign nationals present in the U.S. who were inspected and admitted or paroled and have an immediately available immigrant visa.",
    statutoryBasis: "INA § 245; 8 CFR Part 245; USCIS Visa Bulletin.",
    formSupport: "Form I-485, Form I-765 (EAD), Form I-131 (Advance Parole), Form I-693 (Medical).",
    summary: "Adjustment of status bundle packaging, medical exam sealed envelope tracking, and concurrent I-765/I-131 work/travel authorization.",
    caseNeeds: [
      "Approved or concurrently filed underlying immigrant petition (I-140, I-130)",
      "Continuous lawful nonimmigrant status maintenance proof since last admission",
      "Report of Medical Examination and Vaccination Record (Form I-693) by civil surgeon",
    ],
    documentWorkflows: [
      "Form I-94 arrival/departure records and historical entry stamps",
      "Civil surgeon Form I-693 medical and immunization certificate",
      "Affidavit of Support (Form I-864) with IRS tax transcripts and W-2s",
    ],
    documentoFeatures: [
      "USCIS Visa Bulletin priority date final action vs filing cutoff tracker",
      "INA § 245(k) 180-day status violation safe-harbor calculator",
      "Combo card (EAD / Advance Parole) expiration countdown watches",
    ],
  },

  // --- UNITED KINGDOM (Priority 4 Jurisdiction) ---
  {
    id: "uk-gtv",
    code: "UK GTV",
    title: "UK Global Talent Visa",
    country: "United Kingdom",
    countryCode: "UK",
    flag: "🇬🇧",
    governingBody: "Home Office / UK Visas and Immigration (UKVI)",
    category: "Employment & Skilled Worker",
    status: "Available",
    applicantProfile: "Leaders or emerging leaders in digital technology, academia, research, arts, or culture seeking UK settlement pathways.",
    statutoryBasis: "UK Immigration Rules Appendix Global Talent; Endorsing Bodies (Tech Nation, Royal Society, British Academy, UKRI).",
    formSupport: "Stage 1 Endorsement Application & Stage 2 UKVI Visa Application.",
    summary: "Two-stage endorsement tracking, 10-piece evidence dossier builder, and reference letter verification.",
    caseNeeds: [
      "Stage 1 Endorsement from designated endorsing body (e.g. Tech Nation / British Academy)",
      "Mandatory Criterion: Proof of leading talent or exceptional promise in digital technology",
      "At least 2 Optional Criteria (innovation, sector contributions, significant revenue/academic impact)",
      "Strict limit of 10 supporting documents (maximum 3 A4 pages per exhibit)",
    ],
    documentWorkflows: [
      "3 letters of recommendation from senior figures in recognized digital tech organizations",
      "Proof of product innovation, open-source adoption, or technical IP ownership",
      "Evidence of business impact, commercial growth, or leading advisory roles",
    ],
    documentoFeatures: [
      "Stage 1 vs Stage 2 dual-milestone pipeline tracker",
      "10-document limit enforcement engine with page-length guardrails",
      "Tech Nation criteria checklist mapping each exhibit to specific requirements",
    ],
  },
  {
    id: "uk-skilled",
    code: "UK Skilled Worker",
    title: "UK Skilled Worker Visa",
    country: "United Kingdom",
    countryCode: "UK",
    flag: "🇬🇧",
    governingBody: "Home Office / UK Visas and Immigration (UKVI)",
    category: "Employment & Skilled Worker",
    status: "Available",
    applicantProfile: "Sponsored professionals with qualifying job offers from licensed UK sponsors meeting SOC 2020 salary thresholds.",
    statutoryBasis: "UK Immigration Rules Appendix Skilled Worker; April 2024 Revised Salary Thresholds.",
    formSupport: "Certificate of Sponsorship (CoS), UKVI Digital Visa Application.",
    summary: "Defined CoS tracking, minimum salary threshold validator (£38,700 benchmark), and B1 English qualification check.",
    caseNeeds: [
      "Valid Certificate of Sponsorship (CoS) reference number from licensed UK sponsor",
      "Job offer at appropriate skill level (RQF 3+) meeting general or going-rate salary",
      "English language proficiency at level B1 on CEFR scale (SELT or qualifying degree)",
    ],
    documentWorkflows: [
      "Sponsor Certificate of Sponsorship assignment and job description statement",
      "SELT English language test result certificate or Ecctis degree verification",
      "Proof of personal maintenance savings held in bank account for 28 consecutive days",
    ],
    documentoFeatures: [
      "Going-rate salary vs general £38,700 threshold compliance validator",
      "28-day financial evidence calculation clock",
      "Immigration Health Surcharge (IHS) and biometric fee calculator",
    ],
  },

  // --- AUSTRALIA (Roadmap Pilot) ---
  {
    id: "au-gti",
    code: "AU Subclass 858",
    title: "Australia Global Talent Visa (Subclass 858)",
    country: "Australia",
    countryCode: "AU",
    flag: "🇦🇺",
    governingBody: "Department of Home Affairs (Australia)",
    category: "Employment & Skilled Worker",
    status: "Planned",
    applicantProfile: "Highly skilled individuals with internationally recognized achievements in target priority sectors.",
    statutoryBasis: "Migration Act 1958; Migration Regulations 1994 Subclass 858; Target Sector Policy Notices.",
    formSupport: "Expression of Interest (EOI) & Form 47GT / Form 1000 Nominee.",
    summary: "Roadmap Pilot: Expression of Interest (EOI) builder, Australian nominator verification, and Fair Work high-income threshold analyzer.",
    caseNeeds: [
      "International record of exceptional and outstanding achievement in a target priority sector",
      "Nomination by an Australian citizen, permanent resident, or peak Australian industry body",
      "Ability to earn above the Fair Work High Income Threshold (FWHIT)",
    ],
    documentWorkflows: [
      "Form 1000 nomination dossier from peak Australian body or Australian citizen peer",
      "Salary benchmark documentation and contracts demonstrating FWHIT earning capacity",
      "International awards, conference keynotes, and commercial product deliverables",
    ],
    documentoFeatures: [
      "Target sector criteria tagging (Digital Technology, Health Industries, Renewable Energy)",
      "FWHIT financial benchmark tracking module (under active development)",
    ],
  },
  {
    id: "au-subclass482",
    code: "AU Subclass 482",
    title: "Australia Temporary Skill Shortage (Subclass 482 - TSS)",
    country: "Australia",
    countryCode: "AU",
    flag: "🇦🇺",
    governingBody: "Department of Home Affairs (Australia)",
    category: "Employment & Skilled Worker",
    status: "Planned",
    applicantProfile: "Skilled workers nominated by an approved Australian sponsor to fill vacancies where Australian workers cannot be sourced.",
    statutoryBasis: "Migration Regulations 1994, Schedule 2, Subclass 482; TSMIT salary requirements.",
    formSupport: "Sponsorship, Nomination, and Visa Application Forms.",
    summary: "Roadmap Pilot: Standard Business Sponsorship (SBS) tracking, nomination approval watch, and TSMIT salary threshold validation.",
    caseNeeds: [
      "Approved Australian Standard Business Sponsor and approved job nomination",
      "Minimum 2 years of full-time relevant work experience in the nominated occupation",
      "Salary meeting or exceeding the Temporary Skilled Migration Income Threshold (TSMIT)",
    ],
    documentWorkflows: [
      "Employer sponsorship approval notice and nomination reference",
      "Employment contracts meeting market salary rate requirements",
      "Skills assessments and formal professional reference letters",
    ],
    documentoFeatures: [
      "TSMIT statutory salary threshold compliance verification (pilot module)",
      "Labour Market Testing (LMT) advertising proof indexer (in development)",
    ],
  },

  // --- GERMANY (Roadmap Pilot) ---
  {
    id: "de-bluecard",
    code: "DE Blue Card",
    title: "Germany EU Blue Card & Chancenkarte",
    country: "Germany",
    countryCode: "DE",
    flag: "🇩🇪",
    governingBody: "BAMF / Federal Foreign Office (Germany)",
    category: "Employment & Skilled Worker",
    status: "Planned",
    applicantProfile: "University graduates and skilled specialists with qualifying job offers in Germany or points-based Opportunity Card applicants.",
    statutoryBasis: "Aufenthaltsgesetz (AufenthG) § 18b, § 20a; Fachkräfteeinwanderungsgesetz (FEG).",
    formSupport: "Antrag auf Erteilung eines Aufenthaltstitels (Residence Permit Application).",
    summary: "Roadmap Pilot: Anabin degree database integration, BAMF salary threshold calculator, and Chancenkarte points scorecard.",
    caseNeeds: [
      "Recognized German university degree or comparable foreign tertiary degree (Anabin H+)",
      "Binding employment contract or job offer meeting BAMF statutory minimum gross salary",
      "German statutory health insurance proof and accommodation documentation",
    ],
    documentWorkflows: [
      "Anabin database statement of comparability and university accreditation documents",
      "Bilingual employment contract with detailed job description (Erklärung zum Beschäftigungsverhältnis)",
      "Professional practice authorization (Berufsausübungserlaubnis) for regulated professions",
    ],
    documentoFeatures: [
      "BAMF annual minimum salary threshold validator (standard vs shortage occupation tiers)",
      "Chancenkarte (Opportunity Card) points scoring simulator (language, age, experience)",
    ],
  },
];

export function DocumentoCoverageExplorer() {
  const [selectedCountry, setSelectedCountry] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "Available" | "Planned">("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedPathwayId, setSelectedPathwayId] = useState<string>("ca-super-visa");

  const filteredPathways = useMemo(() => {
    return VERIFIED_PATHWAYS.filter((p) => {
      const matchesCountry = selectedCountry === "ALL" || p.countryCode === selectedCountry;
      const matchesStatus = statusFilter === "ALL" || p.status === statusFilter;
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        p.title.toLowerCase().includes(query) ||
        p.code.toLowerCase().includes(query) ||
        p.country.toLowerCase().includes(query) ||
        p.statutoryBasis.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query);

      return matchesCountry && matchesStatus && matchesSearch;
    });
  }, [selectedCountry, statusFilter, searchQuery]);

  const activePathway = useMemo(() => {
    // If the currently selected pathway is in the filtered list, display it;
    // otherwise immediately select the first pathway in the filtered list so detail always matches filter
    const foundInFiltered = filteredPathways.find((p) => p.id === selectedPathwayId);
    return foundInFiltered || filteredPathways[0] || VERIFIED_PATHWAYS[0];
  }, [selectedPathwayId, filteredPathways]);

  const stats = useMemo(() => {
    const available = VERIFIED_PATHWAYS.filter((p) => p.status === "Available");
    const planned = VERIFIED_PATHWAYS.filter((p) => p.status === "Planned");
    const countries = new Set(available.map((p) => p.country));
    return {
      availableCount: available.length,
      plannedCount: planned.length,
      activeJurisdictionsCount: countries.size,
    };
  }, []);

  return (
    <section
      id="coverage"
      style={{
        padding: "96px 24px",
        scrollMarginTop: "80px",
        background: "transparent",
      }}
    >
      <div style={{ maxWidth: "1240px", margin: "0 auto" }}>
        {/* Minimal Section Header */}
        <div className="animate-on-scroll" style={{ textAlign: "center", maxWidth: "760px", margin: "0 auto 32px auto" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "4px 12px",
              borderRadius: "20px",
              background: "#DDEFE8",
              border: "1px solid #B9DED4",
              fontSize: "12px",
              fontWeight: 650,
              color: "#063C3D",
              marginBottom: "14px",
            }}
          >
            <span>Pathway Coverage</span>
          </div>

          <h2
            style={{
              fontSize: "clamp(26px, 3.6vw, 38px)",
              fontWeight: 700,
              color: "#063C3D",
              lineHeight: 1.25,
              letterSpacing: "-0.02em",
              margin: "0 0 10px 0",
              fontFamily: "var(--font-display, Inter, sans-serif)",
            }}
          >
            Explicit pathway coverage. Zero exaggerated claims.
          </h2>

          <p style={{ fontSize: "15px", color: "#445451", lineHeight: 1.55, margin: "0 0 20px 0" }}>
            Operational, code-verified immigration workflows distinguished from planned expansion jurisdictions.
          </p>

          {/* Minimal Inline Scope Counter */}
          <div
            suppressHydrationWarning
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
              rowGap: "8px",
              columnGap: "14px",
              fontSize: "12.5px",
              color: "#445451",
            }}
          >
            <span style={{ fontWeight: 650, color: "#063C3D" }}>
              3 Active Jurisdictions
            </span>
            <span style={{ color: "#B0C0BC" }}>•</span>
            <span style={{ fontWeight: 650, color: "#0D6866" }}>
              6 Operational Pathways &amp; Dedicated Visa Suites ({stats.availableCount} Available Workflows)
            </span>
            <span style={{ color: "#B0C0BC" }}>•</span>
            <span style={{ fontWeight: 650, color: "#8A5A10" }}>
              2 Roadmap Pathways &amp; Pilot Jurisdictions
            </span>
          </div>
        </div>

        {/* Minimal Filter Toolbar */}
        <div
          className="animate-on-scroll delay-100"
          style={{
            background: "#FFFFFF",
            borderRadius: "12px",
            border: "1px solid #DCE5E1",
            padding: "14px 18px",
            marginBottom: "24px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          {/* Search Box */}
          <div style={{ position: "relative", flex: "1 1 260px", maxWidth: "380px" }}>
            <input
              type="text"
              placeholder="Search visa name, code, or country..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 34px",
                borderRadius: "6px",
                border: "1px solid #DCE5E1",
                background: "#FAFCFB",
                fontSize: "13px",
                color: "#172322",
                outline: "none",
              }}
            />
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#6E7F7C"
              strokeWidth="2"
              style={{ position: "absolute", left: "11px", top: "10px" }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: "8px",
                  top: "8px",
                  background: "none",
                  border: "none",
                  color: "#6E7F7C",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              style={{
                padding: "5px 11px",
                borderRadius: "6px",
                border: "1px solid",
                borderColor: statusFilter === "ALL" ? "#0D6866" : "#DCE5E1",
                background: statusFilter === "ALL" ? "#0D6866" : "#FFFFFF",
                color: statusFilter === "ALL" ? "#FFFFFF" : "#445451",
                fontSize: "12px",
                fontWeight: statusFilter === "ALL" ? 650 : 500,
                cursor: "pointer",
              }}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("Available")}
              style={{
                padding: "5px 11px",
                borderRadius: "6px",
                border: "1px solid",
                borderColor: statusFilter === "Available" ? "#0D6866" : "#DCE5E1",
                background: statusFilter === "Available" ? "#0D6866" : "#FFFFFF",
                color: statusFilter === "Available" ? "#FFFFFF" : "#176B50",
                fontSize: "12px",
                fontWeight: statusFilter === "Available" ? 650 : 500,
                cursor: "pointer",
              }}
            >
              Available Now ({stats.availableCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("Planned")}
              style={{
                padding: "5px 11px",
                borderRadius: "6px",
                border: "1px solid",
                borderColor: statusFilter === "Planned" ? "#8A5A10" : "#DCE5E1",
                background: statusFilter === "Planned" ? "#8A5A10" : "#FFFFFF",
                color: statusFilter === "Planned" ? "#FFFFFF" : "#8A5A10",
                fontSize: "12px",
                fontWeight: statusFilter === "Planned" ? 650 : 500,
                cursor: "pointer",
              }}
            >
              Roadmap / Planned ({stats.plannedCount})
            </button>
          </div>

          {/* Clean Country Region Filter (No duplicate text, clean labels) */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
            {[
              { code: "ALL", label: "All Regions" },
              { code: "CA", label: "Canada" },
              { code: "US", label: "United States" },
              { code: "UK", label: "United Kingdom" },
              { code: "AU", label: "Australia" },
              { code: "DE", label: "Germany" },
            ].map((c) => {
              const isSelected = selectedCountry === c.code;
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setSelectedCountry(c.code)}
                  style={{
                    padding: "4px 9px",
                    borderRadius: "4px",
                    border: "none",
                    background: isSelected ? "#0D6866" : "transparent",
                    color: isSelected ? "#FFFFFF" : "#6E7F7C",
                    fontSize: "12px",
                    fontWeight: isSelected ? 700 : 550,
                    cursor: "pointer",
                    transition: "all 0.12s ease",
                  }}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Empty State */}
        {filteredPathways.length === 0 && (
          <div
            style={{
              padding: "40px 20px",
              textAlign: "center",
              background: "#FFFFFF",
              borderRadius: "12px",
              border: "1px dashed #DCE5E1",
              marginBottom: "24px",
            }}
          >
            <p style={{ fontSize: "14px", color: "#6E7F7C", margin: "0 0 12px 0" }}>
              No immigration pathways match the current search or filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCountry("ALL");
                setStatusFilter("ALL");
                setSearchQuery("");
              }}
              style={{
                background: "#0D6866",
                color: "#FFFFFF",
                border: "none",
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* Clean Two-Column Layout */}
        {filteredPathways.length > 0 && (
          <div
            className="animate-on-scroll delay-150"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
              gap: "20px",
              alignItems: "start",
            }}
          >
            {/* Left: Compact Pathway List with Clean Scroll */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                maxHeight: "720px",
                overflowY: "auto",
                paddingRight: "4px",
                scrollbarWidth: "thin",
              }}
            >
              {filteredPathways.map((p) => {
                const isSelected = activePathway?.id === p.id;
                const isAvailable = p.status === "Available";
                return (
                  <div
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedPathwayId(p.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedPathwayId(p.id);
                      }
                    }}
                    style={{
                      background: isSelected ? "#F1F6F4" : "#FFFFFF",
                      border: "1px solid",
                      borderColor: isSelected ? "#0D6866" : "#DCE5E1",
                      borderLeft: isSelected ? "4px solid #0D6866" : "1px solid #DCE5E1",
                      borderRadius: "8px",
                      padding: "11px 14px",
                      cursor: "pointer",
                      boxShadow: isSelected ? "0 2px 8px rgba(13, 104, 102, 0.08)" : "none",
                      transition: "all 0.12s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "3px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#063C3D" }}>
                          {p.country} • {p.code}
                        </span>
                      </div>

                      <span
                        style={{
                          fontSize: "10.5px",
                          fontWeight: 650,
                          padding: "2px 7px",
                          borderRadius: "4px",
                          background: isAvailable ? "#EAF6F0" : "#FEF7EA",
                          color: isAvailable ? "#176B50" : "#8A5A10",
                        }}
                      >
                        {isAvailable ? "Available" : "Planned"}
                      </span>
                    </div>

                    <div style={{ fontSize: "13px", fontWeight: 650, color: "#172322", lineHeight: 1.35 }}>
                      {p.title}
                    </div>

                    <div style={{ fontSize: "11.5px", color: "#6E7F7C", marginTop: "3px" }}>
                      {p.category}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right: Selected Pathway Scope Detail */}
            {activePathway && (
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #DCE5E1",
                  borderRadius: "12px",
                  padding: "22px 24px",
                  boxShadow: "0 4px 16px rgba(6, 60, 61, 0.04)",
                  position: "sticky",
                  top: "84px",
                  maxHeight: "720px",
                  overflowY: "auto",
                  scrollbarWidth: "thin",
                }}
              >
                {/* Header */}
                <div style={{ borderBottom: "1px solid #DCE5E1", paddingBottom: "14px", marginBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap", marginBottom: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#0D6866", textTransform: "uppercase" }}>
                        {activePathway.country} • {activePathway.governingBody}
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: "6px",
                        background: activePathway.status === "Available" ? "#EAF6F0" : "#FEF7EA",
                        color: activePathway.status === "Available" ? "#176B50" : "#8A5A10",
                        border: `1px solid ${activePathway.status === "Available" ? "#B9DED4" : "#F6D8A6"}`,
                      }}
                    >
                      {activePathway.status === "Available" ? "Available in Current Release" : "Planned Roadmap Scope"}
                    </span>
                  </div>

                  <h3
                    style={{
                      fontSize: "18px",
                      fontWeight: 700,
                      color: "#063C3D",
                      margin: "0 0 6px 0",
                    }}
                  >
                    {activePathway.title}
                  </h3>

                  <p style={{ fontSize: "13px", color: "#445451", lineHeight: 1.5, margin: 0 }}>
                    {activePathway.summary}
                  </p>
                </div>

                {/* Scope & Metadata */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                  <div style={{ fontSize: "12px", color: "#445451", lineHeight: 1.45 }}>
                    <strong style={{ color: "#063C3D" }}>Statutory Authority:</strong> {activePathway.statutoryBasis}
                  </div>
                  <div style={{ fontSize: "12px", color: "#445451", lineHeight: 1.45 }}>
                    <strong style={{ color: "#063C3D" }}>Official Forms:</strong> {activePathway.formSupport}
                  </div>
                </div>

                {/* Key Case Needs */}
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#063C3D", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
                    Scope Included in Documento
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    {activePathway.caseNeeds.map((need, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "6px", fontSize: "12.5px", color: "#172322", lineHeight: 1.4 }}>
                        <span style={{ color: "#0D6866", fontWeight: 700 }}>•</span>
                        <span>{need}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Document Workflows */}
                <div style={{ marginBottom: "20px" }}>
                  <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#063C3D", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
                    Handled Evidence Workflows
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    {activePathway.documentWorkflows.map((flow, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "6px", fontSize: "12px", color: "#445451", lineHeight: 1.4 }}>
                        <span style={{ color: "#176B50" }}>✓</span>
                        <span>{flow}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom CTA */}
                <div
                  style={{
                    borderTop: "1px solid #DCE5E1",
                    paddingTop: "14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  <div style={{ fontSize: "12px", color: "#6E7F7C" }}>
                    {activePathway.status === "Available"
                      ? "Supported in active workspace docket."
                      : "Pilot watchlist; contact team for roadmap timeline."}
                  </div>

                  <a
                    href="#pathway-finder"
                    style={{
                      background: "#0D6866",
                      color: "#FFFFFF",
                      padding: "8px 14px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: 650,
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span>Check Case Eligibility</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
