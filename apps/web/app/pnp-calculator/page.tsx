import type { Metadata } from "next";
import { PnpCalculatorTool } from "../../components/tools/PnpCalculatorTool";

export const metadata: Metadata = {
  title: "Canada PNP Points Calculator (OINP, BC PNP, AAIP, SINP, MPNP, PEI) | Documento",
  description:
    "Official 2026 Canadian Provincial Nominee Program (PNP) EOI and eligibility points calculator in Documento's editorial legal theme — covering Ontario OINP (Oct 5, 2026 132-pt grid), BC PNP SIRS (200 pts), Alberta AAIP (100 pts), Saskatchewan SINP (60/110 pass mark), Manitoba MPNP (1,000 pts + Risk Assessment), and PEI PNP (100 pts).",
};

export default function PnpCalculatorPage() {
  return <PnpCalculatorTool />;
}

