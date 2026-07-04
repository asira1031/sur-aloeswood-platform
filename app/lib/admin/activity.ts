export type AnyRow = Record<string, any>;

export const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-PH");
};

export const peso = (value: any) =>
  `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const pick = (row: AnyRow, keys: string[], fallback = "-") => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value);
  }
  return fallback;
};

export const statusClass = (status?: string | null) => {
  const value = String(status || "").toUpperCase();
  if (["APPROVED", "PAID", "COMPLETED", "ACTIVE", "READ"].includes(value)) return "border-green-300/30 bg-green-400/15 text-green-100";
  if (["PENDING", "OPEN", "UNREAD", "PROCESSING"].includes(value)) return "border-yellow-300/30 bg-yellow-400/15 text-yellow-100";
  if (["REJECTED", "FAILED", "CANCELLED", "SUSPENDED"].includes(value)) return "border-red-300/30 bg-red-400/15 text-red-100";
  return "border-white/10 bg-white/10 text-white/75";
};

export function profileName(profile: AnyRow | null) {
  return profile?.full_name || profile?.email || "Unknown";
}

export function findProfile(profileId: string | null | undefined, profiles: AnyRow[]) {
  return profiles.find((p) => p.id === profileId) || null;
}
