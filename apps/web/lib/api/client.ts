import { RoleCode } from "../types";

export interface ApiResponse<T> {
  data: T;
  isLiveBackend: boolean;
}

export const API_BASE_URL = typeof window !== "undefined" ? "/api/backend" : "http://localhost:8000/api/v1";

export const DEMO_ORG_ID = "11111111-1111-1111-1111-111111111111";
export const DEMO_USERS = {
  master_admin: {
    id: "22222222-2222-2222-2222-222222222222",
    email: "elena.vance@leximmigration.com",
    name: "Elena Vance (Managing Partner)",
    role: "master_admin" as RoleCode,
  },
  case_manager: {
    id: "33333333-3333-3333-3333-333333333333",
    email: "sarah.jenkins@leximmigration.com",
    name: "Sarah Jenkins, Esq. (Senior Reviewer)",
    role: "case_manager" as RoleCode,
  },
  client_applicant: {
    id: "44444444-4444-4444-4444-444444444444",
    email: "elena.rostova@stanford.edu",
    name: "Dr. Elena Rostova (Applicant)",
    role: "retained_client" as RoleCode,
  },
};

export class NetworkError extends Error {
  statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "NetworkError";
    this.statusCode = statusCode;
  }
}

let currentAccessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  currentAccessToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      localStorage.setItem("documento_access_token", token);
    } else {
      localStorage.removeItem("documento_access_token");
    }
  }
}

export function getAccessToken(): string | null {
  if (currentAccessToken) return currentAccessToken;
  if (typeof window !== "undefined") {
    return localStorage.getItem("documento_access_token");
  }
  return null;
}

export function fallbackResponse<T>(data: T, endpointContext?: string): ApiResponse<T> {
  if (process.env.NODE_ENV === "production") {
    throw new NetworkError(
      `Documento Production API unavailable for ${endpointContext || "request"}. Silent in-memory mock fallback is strictly disabled in production to protect database integrity.`
    );
  }
  return { data, isLiveBackend: false };
}

export function fallbackData<T>(data: T, endpointContext?: string): T {
  if (process.env.NODE_ENV === "production") {
    throw new NetworkError(
      `Documento Production API unavailable for ${endpointContext || "request"}. Silent in-memory mock fallback is strictly disabled in production to protect database integrity.`
    );
  }
  return data;
}

export function getAuthHeaders(role: RoleCode = "company_admin"): Record<string, string> {
  const token = getAccessToken();
  let resolvedOrgId: string | undefined;
  let resolvedUserId: string | undefined;
  let resolvedRole: string = role;

  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("documento_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.organization_id) resolvedOrgId = String(parsed.organization_id);
        if (parsed?.id) resolvedUserId = String(parsed.id);
        if (parsed?.role) resolvedRole = parsed.role;
      }
    } catch {
      // ignore storage parse error
    }
  }

  if (token && (!resolvedOrgId || !resolvedUserId)) {
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const raw = typeof atob === "function" ? atob(base64) : Buffer.from(base64, "base64").toString("binary");
        const jsonPayload = decodeURIComponent(
          raw.split("").map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")
        );
        const payload = JSON.parse(jsonPayload);
        if (payload?.sub) resolvedUserId = String(payload.sub);
        if (payload?.org_id) resolvedOrgId = String(payload.org_id);
        if (payload?.roles && Array.isArray(payload.roles) && payload.roles.length > 0) {
          resolvedRole = payload.roles[0];
        }
      }
    } catch {
      // ignore JWT parse failure
    }
  }

  if (!resolvedOrgId) {
    resolvedOrgId = DEMO_ORG_ID;
  }
  if (!resolvedUserId) {
    const user =
      role === "retained_client" || role === "applicant"
        ? DEMO_USERS.client_applicant
        : role === "master_admin" || role === "company_admin" || role === "organization_admin"
          ? DEMO_USERS.master_admin
          : DEMO_USERS.case_manager;
    resolvedUserId = user.id;
  }

  const headers: Record<string, string> = {
    "X-Organization-Id": resolvedOrgId,
    "X-User-Id": resolvedUserId,
    "X-User-Role": resolvedRole,
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}
