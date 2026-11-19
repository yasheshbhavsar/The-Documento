import type { Metadata } from "next";
import { CrsCalculatorTool } from "../../../components/tools/CrsCalculatorTool";

export const metadata: Metadata = {
  title: "Canada Express Entry CRS Score Calculator | Documento",
  description:
    "Official Canada.ca / IRCC Comprehensive Ranking System (CRS) calculator supporting the Nov 2026 Labour Market Integration standard (1,270 max) and Mar 2025 baseline (1,200 max).",
};

export default function CanadaCrsCalculatorPage() {
  return <CrsCalculatorTool />;
}
