import type { Metadata } from "next";
import { AgencyOnboardingWizard } from "../../components/agency/AgencyOnboardingWizard";

export const metadata: Metadata = {
  title: "Partner Visa Agency Onboarding & KYB | Documento",
  description:
    "Onboard your licensed immigration law firm or registered visa consultancy onto Documento with isolated tenant boundaries and co-branded 2026 PR calculators.",
};

export default function AgencyOnboardingPage() {
  return <AgencyOnboardingWizard />;
}

