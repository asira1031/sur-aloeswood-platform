export type AnyRow = Record<string, any>;

export const pick = (row: AnyRow, keys: string[], fallback = "-") => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value);
  }
  return fallback;
};

export const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
};

export const statusClass = (status?: string | null) => {
  const value = String(status || "").toUpperCase();
  if (["OPEN", "ACTIVE", "UNREAD", "PENDING", "ADMIN_QUEUE", "AI_ASSISTING"].includes(value)) return "border-amber-200 bg-amber-50 text-amber-800";
  if (["RESOLVED", "CLOSED", "READ", "DONE"].includes(value)) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (["REJECTED", "FAILED", "CANCELLED"].includes(value)) return "border-red-200 bg-red-50 text-red-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
};

export function getProfile(row: AnyRow, profiles: AnyRow[]) {
  return profiles.find((profile) => profile.id === row.profile_id) || null;
}
