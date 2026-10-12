import { UserContext, UserExperience } from "./types";

export const DEMO_USERS: Record<UserExperience, UserContext> = {
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
    id: "usr-02",
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

export function authenticateUser(email: string, portal: "firm" | "client"): LoginResult {
  const normalizedEmail = email.trim().toLowerCase();

  if (portal === "client") {
    // Client portal
    return {
      success: true,
      user: {
        ...DEMO_USERS.client_applicant,
        email: normalizedEmail || DEMO_USERS.client_applicant.email,
      },
    };
  }

  // Firm portal
  if (normalizedEmail.includes("marcus") || normalizedEmail.includes("paralegal") || normalizedEmail.includes("case")) {
    return {
      success: true,
      user: {
        ...DEMO_USERS.case_manager,
        email: normalizedEmail,
      },
    };
  }

  // Default firm user is managing partner
  return {
    success: true,
    user: {
      ...DEMO_USERS.master_admin,
      email: normalizedEmail || DEMO_USERS.master_admin.email,
    },
  };
}
