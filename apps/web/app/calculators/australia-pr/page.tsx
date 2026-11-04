import type { Metadata } from "next";
import { AustraliaSkillSelectTool } from "../../../components/tools/AustraliaSkillSelectTool";

export const metadata: Metadata = {
  title: "Australia SkillSelect PR Points Calculator (189 / 190 / 491) | Documento",
  description:
    "Official Australia Migration Regulations 1994 Schedule 6D General Skilled Migration (GSM) PR points calculator for Subclasses 189, 190, and 491 — enforcing the 65-point pass mark, age-45 limit, and 20-point combined employment cap.",
};

export default function AustraliaPrCalculatorPage() {
  return <AustraliaSkillSelectTool />;
}

