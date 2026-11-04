/**
 * Global PR & Skilled Migration Calculators Catalog
 *
 * Country-separated registry used across:
 * - /calculators Global PR Calculators Page (Sovereign Radar, Explorer & Country Sections)
 * - Inline country peer navigation & personalized hero cards across all 6 calculators
 */

export type CalculatorCountryId =
  | "canada"
  | "australia"
  | "new_zealand"
  | "united_kingdom"
  | "germany";

export interface GlobalCalculatorEntry {
  id: string;
  countryId: CalculatorCountryId;
  href: string;
  shortTitle: string;
  fullTitle: string;
  badgeLabel: string;
  authority: string;
  officialUrl: string;
  passMarkSummary: string;
  prTimelineSummary: string;
  description: string;
}

export interface CalculatorCountryGroup {
  countryId: CalculatorCountryId;
  countryName: string;
  isoCode: "CA" | "AU" | "NZ" | "GB" | "DE";
  regionTag: string;
  flagSrc: string;
  heroImageSrc: string;
  landmarkLabel: string;
  capitalCity: string;
  accentColor: string;
  calculators: GlobalCalculatorEntry[];
}

export const CALCULATOR_COUNTRY_GROUPS: CalculatorCountryGroup[] = [
  {
    countryId: "canada",
    countryName: "Canada",
    isoCode: "CA",
    regionTag: "North America • Direct Federal & Provincial PR",
    flagSrc: "/flags/canada.png",
    heroImageSrc: "/countries/canada.jpg",
    landmarkLabel: "Parliament Hill, Ottawa",
    capitalCity: "Ottawa",
    accentColor: "#B91C1C",
    calculators: [
      {
        id: "ca_crs",
        countryId: "canada",
        href: "/crs-calculator",
        shortTitle: "Express Entry CRS Calculator",
        fullTitle: "Canada Express Entry CRS Score Calculator",
        badgeLabel: "Max 1,270 pts",
        authority: "IRCC / Canada.ca Ministerial Instructions (Nov 2026)",
        officialUrl:
          "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/crs-criteria.html",
        passMarkSummary: "Pool-ranked ITA cutoffs (FSW 67/100 entry check)",
        prTimelineSummary: "Direct Permanent Residence (~6 months post-ITA)",
        description:
          "Scores Core Human Capital, Spouse Factors, Skill Transferability, and Additional Points across FSW, CEC, FST, and category-based Express Entry draws.",
      },
      {
        id: "ca_pnp",
        countryId: "canada",
        href: "/pnp-calculator",
        shortTitle: "Provincial Nominee (PNP) Calculator",
        fullTitle: "Canada Provincial Nominee Program (PNP) Points Calculator",
        badgeLabel: "6 Provinces • +600 CRS",
        authority: "OINP, BC PNP, AAIP, SINP, MPNP & PEI PNP (2026)",
        officialUrl:
          "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/provincial-nominees.html",
        passMarkSummary: "EOI ranked (SINP strict 60/110 pass mark)",
        prTimelineSummary: "Adds +600 CRS for Express Entry PR or base PNP PR",
        description:
          "Simultaneously scores Ontario OINP (132), BC PNP SIRS (200), Alberta AAIP (100), Saskatchewan SINP (110), Manitoba MPNP (1,000), and PEI PNP (100).",
      },
    ],
  },
  {
    countryId: "australia",
    countryName: "Australia",
    isoCode: "AU",
    regionTag: "Oceania • SkillSelect General Skilled Migration",
    flagSrc: "/flags/australia.png",
    heroImageSrc: "/countries/australia.jpg",
    landmarkLabel: "Sydney Harbour, NSW",
    capitalCity: "Canberra",
    accentColor: "#0B5CAB",
    calculators: [
      {
        id: "au_skillselect",
        countryId: "australia",
        href: "/calculators/australia-pr",
        shortTitle: "SkillSelect PR Points (189 / 190 / 491)",
        fullTitle: "Australia SkillSelect PR Points Calculator (Subclasses 189, 190 & 491)",
        badgeLabel: "Min 65 Pass Mark",
        authority: "Department of Home Affairs — Schedule 6D (2026)",
        officialUrl:
          "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/skilled-independent-189/points-table",
        passMarkSummary: "65 points statutory minimum (< 45 age limit)",
        prTimelineSummary: "Direct PR (189 / 190) or 3-yr Regional to 191 PR (491)",
        description:
          "Evaluates Migration Regulations 1994 Schedule 6D across Age, English (Competent/Proficient/Superior), 20-pt combined Skilled Work cap, +10 Specialist STEM Research, Regional study, Partner skills, and State Nomination (+5 / +15).",
      },
    ],
  },
  {
    countryId: "new_zealand",
    countryName: "New Zealand",
    isoCode: "NZ",
    regionTag: "Oceania • Direct Skilled Residence",
    flagSrc: "/flags/new-zealand.jpg",
    heroImageSrc: "/countries/new-zealand.jpg",
    landmarkLabel: "Waitematā Harbour, Auckland",
    capitalCity: "Wellington",
    accentColor: "#0F4C5C",
    calculators: [
      {
        id: "nz_smc",
        countryId: "new_zealand",
        href: "/calculators/new-zealand-smc",
        shortTitle: "Skilled Migrant Category (SMC 6-Point)",
        fullTitle: "New Zealand Skilled Migrant Category (SMC) Resident Calculator",
        badgeLabel: "6-Point Pass Mark",
        authority: "Immigration New Zealand (Aug 24, 2026 Standard)",
        officialUrl:
          "https://www.immigration.govt.nz/new-zealand-visas/visas/visa/skilled-migrant-category-resident-visa",
        passMarkSummary: "6 points + Accredited Employer job (≤ 55 age limit)",
        prTimelineSummary: "Immediate Resident Visa -> Permanent Resident after 2 yrs",
        description:
          "Implements the August 24, 2026 INZ framework: Overseas vs. NZ degree points, NZ occupational registration, NZD $35.00/hr median wage multipliers, NZ skilled work top-up, plus the new Skilled Work & Trades pathways.",
      },
    ],
  },
  {
    countryId: "united_kingdom",
    countryName: "United Kingdom",
    isoCode: "GB",
    regionTag: "Europe • Points-Based Sponsorship & ILR Settlement",
    flagSrc: "/flags/uk.png",
    heroImageSrc: "/countries/uk.jpg",
    landmarkLabel: "Westminster & Thames, London",
    capitalCity: "London",
    accentColor: "#1E3A8A",
    calculators: [
      {
        id: "uk_skilled_ilr",
        countryId: "united_kingdom",
        href: "/calculators/uk-skilled-worker",
        shortTitle: "Skilled Worker (70-Pt) & ILR Calculator",
        fullTitle: "UK Skilled Worker (70-Point) & ILR Settlement Calculator",
        badgeLabel: "70 / 70 Pass Mark",
        authority: "UK Home Office — Appendix Skilled Worker (2026)",
        officialUrl: "https://www.gov.uk/skilled-worker-visa",
        passMarkSummary: "50 Mandatory + 20 Tradeable Salary Points (£41,700 std)",
        prTimelineSummary: "Indefinite Leave to Remain (ILR / PR) after 5 continuous yrs",
        description:
          "Validates CoS, RQF Level 6 / ISL eligibility, CEFR B2 English, and Tradeable Options A–F (£41,700 standard down to £33,400 PhD / New Entrant / ISL or £31,300 pre-2024 transitional), plus 5-year ILR settlement readiness.",
      },
    ],
  },
  {
    countryId: "germany",
    countryName: "Germany",
    isoCode: "DE",
    regionTag: "European Union • Job-Search Points & Fast-Track PR",
    flagSrc: "/flags/germany.png",
    heroImageSrc: "/countries/germany.jpg",
    landmarkLabel: "Brandenburg Gate & Reichstag, Berlin",
    capitalCity: "Berlin",
    accentColor: "#A16207",
    calculators: [
      {
        id: "de_chancenkarte_bluecard",
        countryId: "germany",
        href: "/calculators/germany-pr",
        shortTitle: "Chancenkarte (6-Pt) & EU Blue Card PR",
        fullTitle: "Germany Chancenkarte (Opportunity Card) & EU Blue Card PR Calculator",
        badgeLabel: "6-Pt / 21-Mo PR",
        authority: "§ 20b & § 18g AufenthG — Make it in Germany (2026)",
        officialUrl:
          "https://www.make-it-in-germany.com/en/visa-residence/types/job-search-opportunity-card",
        passMarkSummary: "6 points (or Direct Recognition) • Blue Card €50,700 / €45,934.20",
        prTimelineSummary: "Fast-track PR (Niederlassungserlaubnis) in 21 mos (B1) or 27 mos (A1)",
        description:
          "Calculates § 20b AufenthG Chancenkarte points (Partial Recognition, Mangelberuf, Experience, German A2–C2, English C1, Age, Prior Stay) alongside 2026 EU Blue Card thresholds and 21/27-month settlement timelines.",
      },
    ],
  },
];

export const ALL_GLOBAL_CALCULATORS: GlobalCalculatorEntry[] =
  CALCULATOR_COUNTRY_GROUPS.flatMap((g) => g.calculators);

export function getCountryGroupById(
  countryId: CalculatorCountryId
): CalculatorCountryGroup {
  return (
    CALCULATOR_COUNTRY_GROUPS.find((g) => g.countryId === countryId) ??
    CALCULATOR_COUNTRY_GROUPS[0]
  );
}
