export type SurSession = {
  id: string;
  email: string;
  full_name?: string | null;
  role?: string | null;
  account_status?: string | null;
};

export function saveSurSession(profile: SurSession) {
  localStorage.setItem("sur_profile_id", profile.id);
  localStorage.setItem("sur_login_email", profile.email);
  localStorage.setItem("sur_profile_name", profile.full_name || "");
  localStorage.setItem("sur_profile_role", profile.role || "COPLANTER");
  localStorage.setItem("sur_account_status", profile.account_status || "");
}

export function clearSurSession() {
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
