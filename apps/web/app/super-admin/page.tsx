import type { Metadata } from "next";
import { SuperAdminControlPlane } from "../../components/admin/SuperAdminControlPlane";
import { DashboardErrorBoundary } from "../../components/common/DashboardErrorBoundary";

export const metadata: Metadata = {
  title: "Documento HQ Super-Admin Control Plane | Partner Agency Governance",
  description:
    "Zero-PII partner visa agency oversight, Two-Track KYB verification queue, SaaS quota governance, and tenant security controls.",
};

export default function SuperAdminPage() {
  return (
    <DashboardErrorBoundary
      sectionTitle="Super-Admin Control Plane"
      sectionDescription="Platform operations and partner agency governance control plane."
    >
      <SuperAdminControlPlane />
    </DashboardErrorBoundary>
  );
}

