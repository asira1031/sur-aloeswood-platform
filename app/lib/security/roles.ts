export type AppRole = "ADMIN" | "FARMER" | "GARDENER" | "INVESTOR" | "COPLANTER" | "UNKNOWN";

export function normalizeRole(role?: string | null): AppRole {
  const value = String(role || "").toUpperCase();

  if (value === "ADMIN" || value === "SUPER_ADMIN") return "ADMIN";
  if (value === "FARMER") return "FARMER";
  if (value === "GARDENER") return "GARDENER";
  if (value === "COPLANTER" || value === "CO_PLANTER" || value === "INVESTOR") return "COPLANTER";

  return "UNKNOWN";
}

export function dashboardForRole(role?: string | null) {
  const normalized = normalizeRole(role);

  if (normalized === "ADMIN") return "/admin/dashboard";
  if (normalized === "FARMER" || normalized === "GARDENER") return "/farmer/dashboard";
  if (normalized === "COPLANTER" || normalized === "INVESTOR") return "/investor/dashboard";

  return "/login";
}

export function canAccessRoute(pathname: string, role?: string | null) {
  const normalized = normalizeRole(role);

  if (pathname.startsWith("/admin")) return normalized === "ADMIN";
  if (pathname.startsWith("/farmer")) return normalized === "FARMER" || normalized === "GARDENER";
  if (pathname.startsWith("/investor")) return normalized === "COPLANTER" || normalized === "INVESTOR";

  return true;
}
