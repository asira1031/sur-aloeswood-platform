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
  return date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
};

export const statusClass = (status?: string | null) => {
  const value = String(status || "").toUpperCase();
  if (["ACTIVE", "APPROVED", "PAID", "COMPLETED", "REGISTERED", "RELEASED"].includes(value)) return "border-green-300/30 bg-green-400/15 text-green-100";
  if (["PENDING", "PROCESSING", "FOR_REVIEW"].includes(value)) return "border-yellow-300/30 bg-yellow-400/15 text-yellow-100";
  if (["REJECTED", "FAILED", "CANCELLED", "SUSPENDED", "TERMINATED"].includes(value)) return "border-red-300/30 bg-red-400/15 text-red-100";
  return "border-white/10 bg-white/10 text-white/75";
};

export function fee(amount: number, rate = 0.02) {
  return Math.round(amount * rate * 100) / 100;
}

export function netAmount(amount: number, rate = 0.02) {
  return Math.max(0, amount - fee(amount, rate));
}

export function recoverySplit(amount: number) {
  return {
    coPlanterShare: Math.round(amount * 0.5 * 100) / 100,
    plantationShare: Math.round(amount * 0.5 * 100) / 100,
  };
}
