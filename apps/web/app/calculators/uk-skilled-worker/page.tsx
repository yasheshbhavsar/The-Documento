import type { Metadata } from "next";
import { UkSkilledWorkerTool } from "../../../components/tools/UkSkilledWorkerTool";

export const metadata: Metadata = {
  title: "UK 70-Point Skilled Worker & 5-Year ILR Calculator (2026) | The Documento",
  description:
    "Calculate your UK Skilled Worker 70-point visa eligibility (50 mandatory + 20 tradeable salary/PhD/ISL/New Entrant points) and 5-year Indefinite Leave to Remain (ILR) settlement readiness.",
};

export default function UkSkilledWorkerPage() {
  return <UkSkilledWorkerTool />;
}

