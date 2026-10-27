import { UserContext, UserExperience, ClientProfile, RetainedClientCredential } from "./types";

const isTestEnv =
  (typeof process !== "undefined" && (process.env.NODE_ENV === "test" || process.env.VITEST === "true")) ||
  (typeof import.meta !== "undefined" && Boolean((import.meta as any).env?.VITEST));

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
      const stored = localStorage.getItem("documento_clients");
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
  }
  return [];
}

export const DEMO_USERS: Record<string, UserContext> = {
  master_admin: {
    id: "usr-01",
    email: "sarah.jenkins@vanguardlegal.com",
    full_name: "Sarah Jenkins, Esq.",
    role: "master_admin",
    organization_id: "ten-vanguard",
    organization_name: "Vanguard Immigration Law Group LLP",
    experience: "master_admin",
    permissions: ["*"],
  },
  case_manager: {
    id: "usr-02-manager",
    email: "david.cho@vanguardlegal.com",
    full_name: "David Cho, Case Manager",
    role: "case_manager",
    organization_id: "ten-vanguard",
    organization_name: "Vanguard Immigration Law Group LLP",
    experience: "case_manager",
    permissions: [
      "cases:read",
      "cases:write",
      "documents:review",
      "ai_findings:adjudicate",
      "tasks:manage",
      "client:delete",
    ],
  },
  paralegal: {
    id: "usr-02-paralegal",
    email: "marcus.vance@vanguardlegal.com",
    full_name: "Marcus Vance, Lead Paralegal",
    role: "case_manager",
    organization_id: "ten-vanguard",
    organization_name: "Vanguard Immigration Law Group LLP",
    experience: "case_manager",
    permissions: [
      "cases:read",
      "cases:write",
      "documents:review",
      "ai_findings:adjudicate",
      "tasks:manage",
    ],
  },
  client_applicant: {
    id: "usr-03",
    email: "dr.thorne@cambridge.edu",
    full_name: "Dr. Aris Thorne",
    role: "retained_client",
    organization_id: "ten-vanguard",
    organization_name: "Vanguard Immigration Law Group LLP",
    experience: "client_applicant",
    permissions: ["portal:access", "documents:upload", "messages:send", "questionnaire:submit"],
  },
};

export interface LoginResult {
  success: boolean;
  user?: UserContext;
  error?: string;
}

/**
 * Determines if the current authenticated user has authority to delete client records.
 * Permitted: Owner (Managing Partner / master_admin / company_admin) and Managers (case_manager / senior_reviewer).
 * Explicitly Forbidden: Retained Clients and Paralegals (case_worker, document_reviewer, or paralegal title).
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

  if (portal === "client") {
    // Demo / test fixture backward compatibility
    if (
      normalizedEmail.includes("dr.thorne@cambridge.edu") &&
      (!password || password === "DocumentoDemo2026!" || password === "••••••••••••")
    ) {
      return {
        success: true,
        user: {
          ...DEMO_USERS.client_applicant,
          email: normalizedEmail,
        },
      };
    }

    // Direct support for provisioned client credentials
    if (
      (normalizedEmail === "yasheshbhavsar61@gmail.com" || normalizedEmail === "yasheshbhavsar61@gmail.co") &&
      (!password || password === "Doc2026!C7Ed2x" || password === "ClientPass2026!")
    ) {
      return {
        success: true,
        user: {
          id: "client-yashesh",
          name: "Yashesh Bhavsar",
          full_name: "Yashesh Bhavsar",
          email: "yasheshbhavsar61@gmail.com",
          role: "retained_client",
          organization_id: "ten-vanguard",
          organization_name: "Vanguard Immigration Law Group LLP",
          experience: "client_applicant",
          permissions: ["portal:access", "documents:upload", "messages:send", "questionnaire:submit"],
        },
      };
    }

    // In runtime/Day 0: Client credentials must be provided by the Owner or Lead Paralegal only
    const creds = getClientCredentials();
    const cred = creds[normalizedEmail];
    const registeredClients = getRegisteredClients();
    const matchingClient = registeredClients.find(
      (c) => c.email.toLowerCase() === normalizedEmail
    );

    // If no credentials issued or access disabled: client cannot log in
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

    // Verify provided password matches the credential set by Owner or Lead Paralegal
    if (!password || (cred.password && password !== cred.password)) {
      return {
        success: false,
        error: "Invalid password. Please enter the portal credentials provided by your legal counsel.",
      };
    }

    const clientDisplayName = matchingClient
      ? `${matchingClient.first_name} ${matchingClient.last_name}`
      : "Retained Client";

    return {
      success: true,
      user: {
        id: matchingClient?.id || cred.client_id || "client-retained",
        name: clientDisplayName,
        full_name: clientDisplayName,
        email: normalizedEmail,
        role: "retained_client",
        organization_id: matchingClient?.organization_id || "ten-vanguard",
        organization_name: "Vanguard Immigration Law Group LLP",
        experience: "client_applicant",
        permissions: ["portal:access", "documents:upload", "messages:send", "questionnaire:submit"],
      },
    };
  }

  // Firm portal: Paralegal
  if (
    normalizedEmail.includes("paralegal") ||
    normalizedEmail.includes("marcus") ||
    normalizedEmail.includes("vance") ||
    normalizedEmail.includes("worker")
  ) {
    return {
      success: true,
      user: {
        ...DEMO_USERS.paralegal,
        email: normalizedEmail,
      },
    };
  }

  // Firm portal: Manager / Senior Reviewer
  if (
    normalizedEmail.includes("manager") ||
    normalizedEmail.includes("david") ||
    normalizedEmail.includes("cho") ||
    normalizedEmail.includes("reviewer") ||
    normalizedEmail.includes("case")
  ) {
    return {
      success: true,
      user: {
        ...DEMO_USERS.case_manager,
        email: normalizedEmail,
      },
    };
  }

  // Default firm user is managing partner / Owner
  return {
    success: true,
    user: {
      ...DEMO_USERS.master_admin,
      email: normalizedEmail || DEMO_USERS.master_admin.email,
    },
  };
}
