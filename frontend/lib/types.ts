export type UserRole = "admin" | "manager" | "bd" | "engineer";
export type ManagerType = "bd_manager" | "engineering_manager";

export interface User {
  id: number;
  email: string;
  full_name: string;
  employee_id: string;
  devsinc_id: string | null;
  role: UserRole;
  manager_type?: ManagerType | null;
  manager_id: number | null;
  tenant_id?: number | null;
  is_active: boolean;
  approval_status: string;
  must_reset_password?: boolean;
  created_at: string;
}

export interface ImportResult {
  created: number;
  skipped: number;
  errors: string[];
}

export interface Lead {
  id: number;
  company: string;
  job_title: string;
  job_source: string;
  technologies: string[];
  primary_tech: string | null;
  jd_invite_sent: boolean;
  jd_invite_sent_at: string | null;
  achieved_at: string | null;
  assigned_engineer_id: number | null;
  assigned_engineer_name: string | null;
  assigned_engineer_devsinc_id: string | null;
  cluster_head_id: number | null;
  cluster_head_name: string | null;
  assigned_by_bd_id: number | null;
  assigned_by_bd_name: string | null;
  profile_id: number | null;
  profile_name: string | null;
  bd_id: number | null;
  bd_name: string | null;
  phase: string;
  type: string;
  status: string;
  interview_number: string | null;
  interview_round: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: number;
  full_name: string;
  linkedin_url: string | null;
  linkedin_verified: boolean;
  github_url: string | null;
  github_present: boolean;
  primary_tech_stack: string | null;
  assigned_engineer_id: number | null;
  assigned_engineer_name: string | null;
  assigned_engineer_devsinc_id: string | null;
  is_active: boolean;
  linked_leads_count: number;
  created_at: string;
  updated_at: string;
}

export interface MonthlyTarget {
  id: number;
  target_start_date: string;
  target_end_date: string | null;
  engineer_id: number;
  engineer_name: string;
  engineer_devsinc_id: string | null;
  lead_target: number;
  tech_stack_focus: string;
  notes: string | null;
  leads_assigned_count: number;
  progress_pct: number;
  created_by_id: number;
  created_at: string;
}

export interface Issue {
  id: number;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  reported_by_id: number;
  reported_by_name: string | null;
  reported_by_role: string;
  assigned_manager_id: number | null;
  assigned_manager_name: string | null;
  related_lead_id: number | null;
  related_profile_id: number | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  comments: { id: number; author_name: string | null; body: string; created_at: string }[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface DashboardKPIs {
  total_leads: number;
  new_today: number;
  qualified: number;
  followups_due: number;
  followups_overdue: number;
  conversion_rate: number;
  revenue_pipeline: number;
}
