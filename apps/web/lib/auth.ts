import { UserContext, ClientProfile, RetainedClientCredential } from "./types";
import {
  getAgencyApplications,
  getAgencyForOrganization,
  getAgencyTeamInvites,
  getAgencyTenants,
  purgeLegacyDemoStorageOnce,
} from "./agencyPlatformStore";

purgeLegacyDemoStorageOnce();

export const PLATFORM_HQ_OPERATOR_EMAIL = "hq.admin@documento.ai";
export const PLATFORM_HQ_BOOTSTRAP_USER: UserContext = {
  id: "usr-hq-01",
  email: PLATFORM_HQ_OPERATOR_EMAIL,
  full_name: "Documento HQ • Platform Governance",
  role: "platform_super_admin",
  organization_id: "ten-documento-hq",
  organization_name: "Documento Platform Control Plane",
  experience: "platform_super_admin",
  permissions: [
    "platform:agencies:read",
    "platform:agencies:manage",
    "platform:kyb:review",
    "platform:quotas:manage",
    "platform:billing:read",
    "platform:support:grant_audit",
  ],
};

export function getClientCredentials(): Record<string, RetainedClientCredential> {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("documento_client_credentials");
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
  }
  return {};
}

export function setClientCredential(cred: RetainedClientCredential): void {
  const all = getClientCredentials();
  all[cred.email.toLowerCase()] = cred;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("documento_client_credentials", JSON.stringify(all));
    } catch {
      // ignore
    }
  }
}

export function revokeClientCredential(email: string): void {
  const all = getClientCredentials();
  if (all[email.toLowerCase()]) {
    all[email.toLowerCase()].portal_access_enabled = false;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("documento_client_credentials", JSON.stringify(all));
      } catch {
        // ignore
      }
    }
  }
}

export function getRegisteredClients(): ClientProfile[] {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("documento_clients_v3_clean") || localStorage.getItem("documento_clients");
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
  }
  return [];
}

export interface LoginResult {
  success: boolean;
  user?: UserContext;
  error?: string;
}

/**
 * Determines if the current authenticated user has authority to delete client records.
 * Permitted: Owner (Managing Partner / master_admin / company_admin) and Managers (case_manager / senior_reviewer).
 * Explicitly Forbidden: Retained Clients and Paralegals (case_worker, document_reviewer, or paralegal title/experience).
 */
export function canDeleteClient(user?: UserContext | null): boolean {
  if (!user) return false;

  // 1. Retained clients can NEVER delete client profiles
  if (
    user.role === "retained_client" ||
    user.role === "applicant" ||
    user.experience === "client_applicant"
  ) {
    return false;
  }

  // 2. Paralegals can NEVER delete client profiles
  const isParalegalTitle =
    user.experience === "paralegal" ||
    (user.full_name || user.name || "").toLowerCase().includes("paralegal") ||
    (user.email || "").toLowerCase().includes("paralegal");
  if (
    user.role === "case_worker" ||
    user.role === "document_reviewer" ||
    isParalegalTitle
  ) {
    return false;
  }

  // 3. Owners and Managers
  if (
    user.role === "master_admin" ||
    user.role === "company_admin" ||
    user.role === "organization_admin" ||
    user.role === "senior_reviewer" ||
    user.role === "case_manager" ||
    user.experience === "master_admin" ||
    (user.permissions &&
      (user.permissions.includes("*") ||
        user.permissions.includes("client:delete")))
  ) {
    return true;
  }

  return false;
}

export function authenticateUser(
  email: string,
  portal: "firm" | "client",
  password?: string
): LoginResult {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return {
      success: false,
      error: "Please enter your registered email address.",
    };
  }

  if (portal === "client") {
    const creds = getClientCredentials();
    const cred = creds[normalizedEmail];
    const registeredClients = getRegisteredClients();
    const matchingClient = registeredClients.find(
      (c) => c.email.toLowerCase() === normalizedEmail
    );

    if (!cred || !cred.portal_access_enabled) {
      if (cred && !cred.portal_access_enabled) {
        return {
          success: false,
          error:
            "Access denied. Retained client portal access has been disabled by your legal team. Please contact the firm Owner or Lead Paralegal.",
        };
      }
      if (matchingClient) {
        return {
          success: false,
          error:
            "Access denied. Portal credentials have not been issued for your account. Please contact your law firm's Owner or Lead Paralegal to obtain your login credentials.",
        };
      }
      return {
        success: false,
        error:
          "Access denied. No retained client account found with this email. Your law firm's Owner or Lead Paralegal must retain your profile and provide your portal credentials before you can sign in.",
      };
    }

    const expectedPassword = cred.password || cred.temporary_password;
    if (!password || !expectedPassword || password !== expectedPassword) {
      return {
        success: false,
        error: "Invalid password. Please enter the portal credentials provided by your legal counsel.",
      };
    }

    const resolvedOrgId =
      matchingClient?.organization_id || cred.organization_id || "org-unassigned";
    const resolvedAgency = getAgencyForOrganization(resolvedOrgId);
    const resolvedOrgName =
      matchingClient?.organization_name ||
      cred.organization_name ||
      resolvedAgency?.legalEntityName ||
      "Partner Immigration Practice";

    const clientDisplayName = matchingClient
      ? `${matchingClient.first_name} ${matchingClient.last_name}`.trim()
      : cred.client_name || "Retained Client";

    return {
      success: true,
      user: {
        id: matchingClient?.id || cred.client_id || `client-${normalizedEmail}`,
        name: clientDisplayName,
        full_name: clientDisplayName,
        email: normalizedEmail,
        role: "retained_client",
        organization_id: resolvedOrgId,
        organization_name: resolvedOrgName,
        experience: "client_applicant",
        permissions: ["portal:access", "documents:upload", "messages:send", "questionnaire:submit"],
        agency_slug: resolvedAgency?.slug,
      },
    };
  }

  // 1. Documento HQ Platform Super-Admin Control Plane (strict passphrase check)
  if (normalizedEmail === PLATFORM_HQ_OPERATOR_EMAIL) {
    const expectedSuperAdminPassword =
      process.env.NEXT_PUBLIC_SUPER_ADMIN_PASSWORD ||
      (process.env.NODE_ENV !== "production" ? "DocumentoHQ2026!" : "");
    if (!password || !expectedSuperAdminPassword || password !== expectedSuperAdminPassword) {
      return {
        success: false,
        error: "Invalid HQ operator passphrase. Enter your authorized Documento HQ Control Plane password.",
      };
    }
    return {
      success: true,
      user: {
        ...PLATFORM_HQ_BOOTSTRAP_USER,
        email: normalizedEmail,
      },
    };
  }

  // 2. Provisioned B2B Partner Agencies (Owner account + Emergency Freeze enforcement)
  const partnerTenants = getAgencyTenants();
  const matchedAgency = partnerTenants.find(
    (t) => t.ownerEmail.toLowerCase() === normalizedEmail
  );
  if (matchedAgency) {
    if (matchedAgency.status === "suspended") {
      return {
        success: false,
        error:
          "Workspace Frozen: This agency tenant has been suspended by Documento Platform Governance. Active sessions are revoked.",
      };
    }
    if (!password || (matchedAgency.temporaryPassword && password !== matchedAgency.temporaryPassword)) {
      return {
        success: false,
        error: "Invalid agency owner password. Please enter the password you created during signup or your invite passcode.",
      };
    }
    return {
      success: true,
      user: {
        id: `usr-owner-${matchedAgency.slug}`,
        email: normalizedEmail,
        full_name: matchedAgency.ownerFullName,
        role: "master_admin",
        organization_id: matchedAgency.organizationId,
        organization_name: matchedAgency.legalEntityName,
        experience: "master_admin",
        permissions: ["*"],
        agency_slug: matchedAgency.slug,
      },
    };
  }

  // 3. Invited Agency Team Staff (Case Managers & Paralegals — strict passcode check)
  const teamInvites = getAgencyTeamInvites();
  const matchedInvite = teamInvites.find((i) => i.email.toLowerCase() === normalizedEmail);
  if (matchedInvite) {
    const parentTenant = partnerTenants.find((t) => t.organizationId === matchedInvite.organizationId);
    if (parentTenant && parentTenant.status === "suspended") {
      return {
        success: false,
        error:
          "Workspace Frozen: This agency tenant has been suspended by Documento Platform Governance. Active sessions are revoked.",
      };
    }
    if (!password || password !== matchedInvite.passcode) {
      return {
        success: false,
        error: "Invalid staff passcode. Please enter the team invite passcode issued by your Managing Partner.",
      };
    }
    const isParalegal = matchedInvite.role === "paralegal";
    return {
      success: true,
      user: {
        id: matchedInvite.id,
        email: normalizedEmail,
        full_name: matchedInvite.fullName,
        role: isParalegal ? "case_worker" : "case_manager",
        organization_id: matchedInvite.organizationId,
        organization_name: matchedInvite.agencyLegalName,
        experience: isParalegal ? "paralegal" : "case_manager",
        permissions: [
          "cases:read",
          "cases:write",
          "documents:review",
          "ai_findings:adjudicate",
          "tasks:manage",
          ...(!isParalegal ? ["client:delete"] : []),
        ],
        agency_slug: matchedInvite.agencySlug,
      },
    };
  }

  // 4. Self-Serve Agency Owners currently in 14-Day Trial / Pending KYB Sandbox
  const pendingApps = getAgencyApplications();
  const matchedPendingApp = pendingApps.find(
    (a) => a.contactWorkEmail.toLowerCase() === normalizedEmail && a.kybStatus !== "approved"
  );
  if (matchedPendingApp) {
    if (matchedPendingApp.kybStatus === "rejected") {
      return {
        success: false,
        error:
          "KYB Verification Declined: Your agency application could not be verified. Please contact Documento Compliance Support.",
      };
    }
    if (!password || (matchedPendingApp.ownerPassword && password !== matchedPendingApp.ownerPassword)) {
      return {
        success: false,
        error: "Incorrect password for your agency account.",
      };
    }
    return {
      success: true,
      user: {
        id: `usr-sandbox-${matchedPendingApp.requestedSlug}`,
        email: normalizedEmail,
        full_name: matchedPendingApp.contactFullName,
        role: "master_admin",
        organization_id: `sandbox-${matchedPendingApp.requestedSlug}`,
        organization_name: matchedPendingApp.legalEntityName,
        experience: "master_admin",
        permissions: ["*"],
        agency_slug: matchedPendingApp.requestedSlug,
        is_sandbox_agency: true,
      },
    };
  }

  return {
    success: false,
    error:
      "No agency or staff account found for this email. Register your agency via Partner Onboarding or request a team invite from your Managing Partner.",
  };
}
