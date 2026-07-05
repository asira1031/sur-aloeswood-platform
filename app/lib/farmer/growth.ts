export type AnyRow = Record<string, any>;

export const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
};

export const pick = (row: AnyRow, keys: string[], fallback = "-") => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value);
  }
  return fallback;
};

export const statusClass = (status?: string | null) => {
  const value = String(status || "").toUpperCase();
  if (["HEALTHY", "ACTIVE", "GROWING", "COMPLETED", "LOGGED"].includes(value)) return "border-green-300/30 bg-green-400/15 text-green-100";
  if (["NEEDS_ATTENTION", "SICK", "DAMAGED", "FAILED"].includes(value)) return "border-red-300/30 bg-red-400/15 text-red-100";
  return "border-yellow-300/30 bg-yellow-400/15 text-yellow-100";
};

export function getTreeLabel(tree: AnyRow | null | undefined) {
  if (!tree) return "-";
  return pick(tree, ["tree_code", "denr_tag_number", "tree_id", "qr_code", "id"]);
}

export function getTreeByAssignment(assignment: AnyRow, trees: AnyRow[]) {
  return trees.find((tree) => tree.id === assignment.tree_id || tree.tree_id === assignment.tree_id) || null;
}

export function getLogsForTree(tree: AnyRow | null, logs: AnyRow[]) {
  if (!tree) return [];
  return logs.filter((log) => log.tree_id === tree.id).slice(0, 50);
}
