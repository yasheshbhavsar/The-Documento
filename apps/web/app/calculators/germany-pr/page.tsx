import type { Metadata } from "next";
import { GermanyPrCalculatorTool } from "../../../components/tools/GermanyPrCalculatorTool";

export const metadata: Metadata = {
  title: "Germany Chancenkarte (6-Pt) & EU Blue Card PR Calculator (2026) | The Documento",
  description:
    "Calculate your Germany Chancenkarte (Opportunity Card § 20b AufenthG 6-point grid) score and 2026 EU Blue Card fast-track permanent residence (21 or 27 months) eligibility.",
};

export default function GermanyPrCalculatorPage() {
  return <GermanyPrCalculatorTool />;
}

