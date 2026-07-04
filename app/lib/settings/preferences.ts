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

  if (["ACTIVE", "APPROVED", "OPEN", "ENABLED", "READ"].includes(value)) {
    return "border-green-300/30 bg-green-400/15 text-green-100";
  }

  if (["PENDING", "PROCESSING", "UNREAD", "FOR_REVIEW"].includes(value)) {
    return "border-yellow-300/30 bg-yellow-400/15 text-yellow-100";
  }

  if (["SUSPENDED", "REJECTED", "CLOSED", "DISABLED"].includes(value)) {
    return "border-red-300/30 bg-red-400/15 text-red-100";
  }

  return "border-white/10 bg-white/10 text-white/75";
};

export const settingOptions = {
  supportPriority: ["NORMAL", "HIGH", "URGENT"],
  notificationMode: ["ALL", "IMPORTANT_ONLY", "OFF"],
  themeMode: ["FOREST", "DARK", "GOLD"],
};

export function getPublicSupportContacts() {
  return [
    { label: "Support Email", value: "support@sur-aloeswood.com" },
    { label: "Operations Desk", value: "Plantation Operations" },
    { label: "Wallet Desk", value: "Treasury / Cash-In Review" },
  ];
}
