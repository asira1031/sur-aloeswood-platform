import { supabase } from "@/app/lib/supabase/client";
import { dashboardForRole, normalizeRole } from "@/app/lib/security/roles";

export type SessionProfile = {
  id: string;
  email: string;
  full_name?: string | null;
  role?: string | null;
  account_status?: string | null;
  kyc_status?: string | null;
};

export async function getProfileByEmail(email: string) {
  const cleanEmail = email.toLowerCase().trim();

  if (!cleanEmail) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, account_status, kyc_status, membership_status")
    .eq("email", cleanEmail)
    .maybeSingle();

  if (error || !data) return null;

  return data as SessionProfile;
}

export function getStoredEmail() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("sur_login_email") || "";
}

export function setStoredSession(profile: SessionProfile) {
  if (typeof window === "undefined") return;
  localStorage.setItem("sur_login_email", profile.email);
  localStorage.setItem("sur_profile_id", profile.id);
  localStorage.setItem("sur_role", normalizeRole(profile.role));
}

export function clearStoredSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("sur_login_email");
  localStorage.removeItem("sur_profile_id");
  localStorage.removeItem("sur_role");
}

export async function resolveRedirectForEmail(email: string) {
  const profile = await getProfileByEmail(email);
  if (!profile) return "/login";
  setStoredSession(profile);
  return dashboardForRole(profile.role);
}
