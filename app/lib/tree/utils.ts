export type AnyRow = Record<string, any>;

export const peso = (value: any) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const pick = (row: AnyRow, keys: string[], fallback = "-") => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }
  return fallback;
};

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

  if (["ACTIVE", "HEALTHY", "APPROVED", "VERIFIED", "GROWING", "COMPLETED", "VALID", "ISSUED", "PAID", "READY"].includes(value)) {
    return "border-green-300/30 bg-green-400/15 text-green-100";
  }

  if (["PENDING", "ASSIGNED", "REVIEW", "FOR_REVIEW", "MAINTENANCE", "PROCESSING"].includes(value)) {
    return "border-yellow-300/30 bg-yellow-400/15 text-yellow-100";
  }

  if (["REJECTED", "DAMAGED", "SICK", "FAILED", "INACTIVE", "EXPIRED", "REVOKED"].includes(value)) {
    return "border-red-300/30 bg-red-400/15 text-red-100";
  }

  return "border-white/10 bg-white/10 text-white/75";
};

export function estimateHarvestReadiness(tree: AnyRow) {
  const stage = String(tree.stage || "").toUpperCase();
  const status = String(tree.status || tree.health_status || "").toUpperCase();
  const age = Number(tree.age_years || tree.tree_age_years || 0);

  if (["HARVEST_READY", "READY", "MATURE"].includes(stage)) return "READY";
  if (age >= 7 && ["ACTIVE", "HEALTHY", "GROWING", "APPROVED"].includes(status)) return "READY";
  if (["DAMAGED", "SICK", "NEEDS_ATTENTION", "REJECTED"].includes(status)) return "NOT_READY";

  return "GROWING";
}

export function getOwner(row: AnyRow, profiles: AnyRow[]) {
  const ownerId = row.profile_id || row.owner_profile_id || row.coplanter_id || row.user_id || row.investor_id;
  const ownerEmail = row.email || row.owner_email || row.user_email || row.investor_email;

  return profiles.find((profile) => profile.id === ownerId || profile.email === ownerEmail) || null;
}

export function getTreeCode(tree: AnyRow) {
  return pick(tree, ["tree_code", "code", "name", "tree_name", "id"]);
}
