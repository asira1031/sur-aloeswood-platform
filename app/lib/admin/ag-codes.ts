import { COPLANTER_PACKAGE_PRICE, peso as formatPeso } from "@/app/lib/business/rules";

export type AnyRow = Record<string, any>;

export const SEEDLING_PRICE = COPLANTER_PACKAGE_PRICE;

export const peso = formatPeso;

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
  if (["APPROVED", "ACTIVE", "PAID", "COMPLETED", "REGISTERED"].includes(value)) {
    return "border-green-300/30 bg-green-400/15 text-green-100";
  }
  if (["PENDING", "PROCESSING", "FOR_REVIEW", "ASSIGNED"].includes(value)) {
    return "border-yellow-300/30 bg-yellow-400/15 text-yellow-100";
  }
  if (["REJECTED", "FAILED", "CANCELLED", "SUSPENDED"].includes(value)) {
    return "border-red-300/30 bg-red-400/15 text-red-100";
  }
  return "border-white/10 bg-white/10 text-white/75";
};

export function getProfile(profileId: string | null | undefined, profiles: AnyRow[]) {
  return profiles.find((profile) => profile.id === profileId) || null;
}

export function parseAgNumber(code?: string | null) {
  const match = String(code || "").match(/^AG-(\d{7})$/);
  return match ? Number(match[1]) : 0;
}

export function formatAgCode(number: number) {
  return `AG-${String(number).padStart(7, "0")}`;
}

export function getNextAgNumbers(existingTrees: AnyRow[], quantity: number) {
  const maxNumber = existingTrees.reduce((max, tree) => Math.max(max, parseAgNumber(tree.tree_code)), 0);
  return Array.from({ length: quantity }, (_, index) => maxNumber + index + 1);
}
