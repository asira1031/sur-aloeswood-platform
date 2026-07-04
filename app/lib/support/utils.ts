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
  if (["OPEN", "ACTIVE", "UNREAD", "PENDING"].includes(value)) return "border-yellow-300/30 bg-yellow-400/15 text-yellow-100";
  if (["RESOLVED", "CLOSED", "READ", "DONE"].includes(value)) return "border-green-300/30 bg-green-400/15 text-green-100";
  if (["REJECTED", "FAILED", "CANCELLED"].includes(value)) return "border-red-300/30 bg-red-400/15 text-red-100";
  return "border-white/10 bg-white/10 text-white/75";
};

export function getProfile(row: AnyRow, profiles: AnyRow[]) {
  return profiles.find((profile) => profile.id === row.profile_id) || null;
}
