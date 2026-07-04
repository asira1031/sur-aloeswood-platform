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

  if (["ACTIVE", "APPROVED", "ASSIGNED", "COMPLETED", "HEALTHY", "DONE"].includes(value)) {
    return "border-green-300/30 bg-green-400/15 text-green-100";
  }

  if (["PENDING", "IN_PROGRESS", "REVIEW", "FOR_REVIEW"].includes(value)) {
    return "border-yellow-300/30 bg-yellow-400/15 text-yellow-100";
  }

  if (["REJECTED", "FAILED", "CANCELLED", "DAMAGED", "SICK"].includes(value)) {
    return "border-red-300/30 bg-red-400/15 text-red-100";
  }

  return "border-white/10 bg-white/10 text-white/75";
};

export function getFarmerName(row: AnyRow) {
  return pick(row, ["full_name", "name", "gardener_name", "farmer_name", "email"]);
}

export function getTreeLabel(row: AnyRow) {
  return pick(row, ["tree_code", "code", "name", "tree_name", "tree_id", "id"]);
}

export function getAssignmentTree(assignment: AnyRow, trees: AnyRow[]) {
  const treeId = assignment.tree_id || assignment.tree_registry_id;
  const treeCode = assignment.tree_code || assignment.code;

  return (
    trees.find((tree) => tree.id === treeId || tree.tree_code === treeCode || tree.code === treeCode) ||
    null
  );
}

export function getAssignmentProfile(assignment: AnyRow, profiles: AnyRow[]) {
  const ownerId = assignment.profile_id || assignment.owner_profile_id || assignment.coplanter_profile_id;
  const ownerEmail = assignment.email || assignment.owner_email;

  return profiles.find((profile) => profile.id === ownerId || profile.email === ownerEmail) || null;
}
