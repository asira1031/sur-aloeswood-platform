export type AnyRow = Record<string, any>;
import { COPLANTER_PACKAGE_PRICE } from "@/app/lib/business/rules";

export const SEEDLING_PRICE = COPLANTER_PACKAGE_PRICE;

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

  if (["ACTIVE", "APPROVED", "REGISTERED", "GROWING", "HEALTHY", "PAID", "COMPLETED"].includes(value)) {
    return "border-green-300/30 bg-green-400/15 text-green-100";
  }

  if (["PENDING", "PROCESSING", "FOR_REVIEW", "ASSIGNED", "MAINTENANCE"].includes(value)) {
    return "border-yellow-300/30 bg-yellow-400/15 text-yellow-100";
  }

  if (["REJECTED", "FAILED", "CANCELLED", "DAMAGED", "SICK", "SUSPENDED"].includes(value)) {
    return "border-red-300/30 bg-red-400/15 text-red-100";
  }

  return "border-white/10 bg-white/10 text-white/75";
};

export function latestLogForTree(treeId: string, logs: AnyRow[]) {
  return logs.find((log) => log.tree_id === treeId) || null;
}

export function logsForTree(treeId: string, logs: AnyRow[]) {
  return logs.filter((log) => log.tree_id === treeId);
}

export function treeDisplayCode(tree: AnyRow) {
  return tree.tree_code || "Pending AG Code";
}

export function harvestEstimateText(tree: AnyRow) {
  if (!tree.planted_at) return "3 to 5 years after planting, subject to plantation performance.";
  const planted = new Date(tree.planted_at);
  if (Number.isNaN(planted.getTime())) return "3 to 5 years, subject to plantation performance.";
  const start = planted.getFullYear() + 3;
  const end = planted.getFullYear() + 5;
  return `${start} to ${end}, subject to inoculation schedule and plantation performance.`;
}
