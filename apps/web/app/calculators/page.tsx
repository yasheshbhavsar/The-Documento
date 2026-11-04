import type { Metadata } from "next";
import { PrCalculatorsHubView } from "../../components/tools/PrCalculatorsHubView";

export const metadata: Metadata = {
  title: "Global PR & Skilled Migration Calculators (Canada, Australia, NZ, UK, Germany) | Documento",
  description:
    "Country-separated Permanent Residence (PR) and skilled migration points calculators across Canada (Express Entry CRS & PNP), Australia (SkillSelect 189/190/491), New Zealand (SMC 6-Point), United Kingdom (Skilled Worker 70-Point & ILR), and Germany (Chancenkarte & EU Blue Card).",
};

export default function CalculatorsHubPage() {
  return <PrCalculatorsHubView />;
}
