export type UserExperience =
  | "master_admin"
  | "case_manager"
  | "client_applicant"
  | "paralegal"
  | "platform_super_admin";

export type RoleCode =
  | "master_admin"
  | "company_admin"
  | "senior_reviewer"
  | "case_manager"
  | "document_reviewer"
  | "finance_staff"
  | "retained_client"
  | "organization_admin"
  | "case_worker"
  | "applicant"
  | "platform_super_admin"
  | "platform_ops";

export interface UserContext {
  id: string;
  email: string;
  full_name: string;
  name?: string;
  role: RoleCode;
  organization_id: string;
  organization_name: string;
  experience: UserExperience;
  permissions: string[];
  agency_slug?: string;
  is_sandbox_agency?: boolean;
}

export type ClientEngagementType = "consultation" | "preliminary_assessment" | "retained";

export interface ClientDependant {
  id: string;
  primary_client_id?: string;
  relationship_type: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  nationality: string;
  is_authorized_to_view_case: boolean;
  created_at: string;
}

export interface ClientConsent {
  id: string;
  client_id?: string;
  consent_type: string;
  granted: boolean;
  granted_at: string;
  revoked_at?: string;
  ip_address?: string;
  document_hash?: string;
  notes?: string;
}

export interface ClientProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  nationality: string;
  date_of_birth?: string;
  organization_id: string;
  aadhaar_number_masked?: string;
  pan_number?: string;
  voter_id?: string;
  passport_ecr_status?: "ECR" | "NON_ECR";
  created_at: string;
  dependants?: ClientDependant[];
  consents?: ClientConsent[];
  dependants_count?: number;
  cases_count?: number;
  portal_credentials_provided?: boolean;
  portal_access_enabled?: boolean;
  credentials_provisioned_at?: string;
  credentials_provisioned_by?: string;
  portal_temporary_password?: string;
  organization_name?: string;
  assigned_caseworker?: string;
  assigned_caseworker_id?: string;
}

export interface RetainedClientCredential {
  client_id?: string;
  client_name?: string;
  organization_id?: string;
  organization_name?: string;
  email: string;
  password?: string;
  portal_access_enabled: boolean;
  provisioned_by: string; // "Owner" | "Lead Paralegal"
  provisioned_at: string;
  temporary_password?: string;
  last_login_at?: string;
}

export interface DuplicateCandidate {
  client_id: string;
  client_name: string;
  client_email: string;
  match_type: string;
  confidence: "high" | "medium" | "low";
  score: number;
  details: string;
}

export interface ClientProfileData {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  date_of_birth?: string;
  nationality: string;
  passport_verified: boolean;
  aadhaar_number_masked?: string;
  pan_number?: string;
  voter_id?: string;
  passport_ecr_status?: "ECR" | "NON_ECR";
  dependants: Array<{
    id: string;
    relationship_type: string;
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    nationality: string;
    is_authorized_to_view_case: boolean;
  }>;
  cases: Array<{
    id: string;
    case_number: string;
    title: string;
    jurisdiction: string;
    visa_category: string;
    status: string;
  }>;
  completeness_score: number;
}

export interface TeamMemberCapacity {
  id: string;
  name: string;
  email?: string;
  role: string;
  active_cases: number;
  max_capacity: number;
  open_reviews: number;
}

export interface StaffWorkloadItem {
  user_id: string;
  invite_id?: string;
  is_owner?: boolean;
  full_name: string;
  email: string;
  roles: string[];
  branch_office?: string;
  assigned_cases: number;
  pending_tasks: number;
  nominal_capacity: number;
  utilization_pct: number;
  status: "normal" | "overloaded";
  login_enabled?: boolean;
  passcode?: string;
  invited_at?: string;
  open_reviews?: number;
  branch_id?: string | null;
  team_id?: string | null;
}

export interface OffboardMemberResponse {
  user_id: string;
  organization_id: string;
  membership_status: string;
  user_status: string;
  transferred_cases_count: number;
  transferred_to_user_id?: string;
  sessions_revoked_count: number;
  offboarded_at: string;
}
