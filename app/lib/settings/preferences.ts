export type AnyRow = Record<string, any>;

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

  if (["ACTIVE", "APPROVED", "OPEN", "ENABLED", "READ", "RESOLVED"].includes(value)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (["PENDING", "PROCESSING", "UNREAD", "FOR_REVIEW", "ADMIN_QUEUE", "AI_ASSISTING"].includes(value)) {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (["SUSPENDED", "REJECTED", "CLOSED", "DISABLED"].includes(value)) {
    return "border-red-200 bg-red-50 text-red-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
};

export const settingOptions = {
  supportPriority: ["NORMAL", "HIGH", "URGENT"],
  notificationMode: ["ALL", "IMPORTANT_ONLY", "OFF"],
  themeMode: ["FOREST", "LIGHT", "GOLD"],
  dashboardDensity: ["COMFORTABLE", "COMPACT"],
};

export function getPublicSupportContacts() {
  return [
    { label: "Support Email", value: "support@sur-aloeswood.com" },
    { label: "Operations Desk", value: "Plantation Operations" },
    { label: "Wallet Desk", value: "Treasury / Cash-In Review" },
  ];
}
