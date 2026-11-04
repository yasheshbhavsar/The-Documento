import type { Metadata } from "next";
import { NewZealandSmcTool } from "../../../components/tools/NewZealandSmcTool";

export const metadata: Metadata = {
  title: "New Zealand Skilled Migrant Category (SMC 6-Point) Calculator | Documento",
  description:
    "Official August 24, 2026 Immigration New Zealand Skilled Migrant Category (SMC) Resident Visa calculator — covering the 6-Point System, NZD $35.00/hr median wage multipliers, and the new Skilled Work Experience & Trades pathways.",
};

export default function NewZealandSmcPage() {
  return <NewZealandSmcTool />;
}

