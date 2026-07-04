export type AnyRow = Record<string, any>;

export const peso = (value: any) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const statusClass = (status?: string | null) => {
  const value = String(status || "").toUpperCase();

  if (["ACTIVE", "APPROVED", "PAID", "COMPLETED", "VERIFIED"].includes(value)) {
    return "border-green-300/30 bg-green-400/15 text-green-100";
  }

  if (["PENDING", "OPEN", "PROCESSING", "FOR_REVIEW"].includes(value)) {
    return "border-yellow-300/30 bg-yellow-400/15 text-yellow-100";
  }

  if (["REJECTED", "FAILED", "CANCELLED", "SUSPENDED", "CLOSED"].includes(value)) {
    return "border-red-300/30 bg-red-400/15 text-red-100";
  }

  return "border-white/10 bg-white/10 text-white/75";
};

export function getProfile(profileId: string | null | undefined, profiles: AnyRow[]) {
  return profiles.find((profile) => profile.id === profileId) || null;
}

export function profileName(profile?: AnyRow | null) {
  return profile?.full_name || profile?.email || "Unknown Co-Planter";
}
