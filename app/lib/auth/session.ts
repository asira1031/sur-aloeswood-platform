import { supabase } from "@/app/lib/supabase/client";

export type SurSession = {
  id: string;
  email: string;
  full_name?: string | null;
  role?: string | null;
  account_status?: string | null;
};

export type SurProfile = SurSession & {
  kyc_status?: string | null;
};

export function saveSurSession(profile: SurSession) {
  if (typeof window === "undefined") return;

  localStorage.setItem("sur_profile_id", profile.id);
  localStorage.setItem("sur_login_email", profile.email);
  localStorage.setItem("sur_profile_name", profile.full_name || "");
  localStorage.setItem("sur_profile_role", profile.role || "COPLANTER");
  localStorage.setItem("sur_account_status", profile.account_status || "");
}

export function clearSurSession() {
  if (typeof window === "undefined") return;

  localStorage.removeItem("sur_profile_id");
  localStorage.removeItem("sur_login_email");
  localStorage.removeItem("sur_profile_name");
  localStorage.removeItem("sur_profile_role");
  localStorage.removeItem("sur_account_status");
}

export function getRoleRoute(role?: string | null) {
  const value = String(role || "").toUpperCase();

  if (["ADMIN", "SUPER_ADMIN", "STAFF"].includes(value)) return "/admin/dashboard";
  if (["FARMER", "GARDENER", "CARETAKER"].includes(value)) return "/farmer/dashboard";
  return "/investor/dashboard";
}

export async function getAuthenticatedProfile(): Promise<SurProfile | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user?.email) {
  clearSurSession();
  return null;
}
  const email = authData.user.email.toLowerCase().trim();

  const { data: profileByAuthUserId } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,account_status,kyc_status")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();

  if (profileByAuthUserId) {
    saveSurSession(profileByAuthUserId);
    return profileByAuthUserId;
  }

  const { data: profileByEmail } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,account_status,kyc_status")
    .eq("email", email)
    .maybeSingle();

  if (profileByEmail) {
    saveSurSession(profileByEmail);
    return profileByEmail;
  }

  clearSurSession();
  return null;
}
