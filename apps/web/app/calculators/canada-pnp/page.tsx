import type { Metadata } from "next";
import { PnpCalculatorTool } from "../../../components/tools/PnpCalculatorTool";

export const metadata: Metadata = {
  title: "Canada PNP Points Calculator (OINP, BC PNP, AAIP, SINP, MPNP, PEI) | Documento",
  description:
    "Canadian Provincial Nominee Program (PNP) EOI and eligibility points calculator covering Ontario OINP, BC PNP, Alberta AAIP, Saskatchewan SINP, Manitoba MPNP, and PEI PNP.",
};

export default function CanadaPnpCalculatorPage() {
  return <PnpCalculatorTool />;
}
