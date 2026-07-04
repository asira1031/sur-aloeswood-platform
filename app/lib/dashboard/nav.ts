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

  if (["ACTIVE", "APPROVED", "PAID", "COMPLETED", "REGISTERED", "OPEN", "READ"].includes(value)) {
    return "border-green-300/30 bg-green-400/15 text-green-100";
  }

  if (["PENDING", "PROCESSING", "FOR_REVIEW", "ASSIGNED", "UNREAD", "MAINTENANCE"].includes(value)) {
    return "border-yellow-300/30 bg-yellow-400/15 text-yellow-100";
  }

  if (["REJECTED", "FAILED", "CANCELLED", "SUSPENDED", "DAMAGED", "CLOSED"].includes(value)) {
    return "border-red-300/30 bg-red-400/15 text-red-100";
  }

  return "border-white/10 bg-white/10 text-white/75";
};

export function byDateDesc(a: AnyRow, b: AnyRow) {
  return new Date(b.created_at || b.assigned_at || 0).getTime() - new Date(a.created_at || a.assigned_at || 0).getTime();
}

export const adminLinks = [
  { href: "/admin/coplanters", title: "Co-Planters", desc: "Approve accounts and KYC" },
  { href: "/admin/purchases", title: "Seedling Purchases", desc: "Approve payments and generate AG codes" },
  { href: "/admin/tree-registry", title: "Tree Registry", desc: "DENR tags, GPS, planting details" },
  { href: "/admin/treasury", title: "Treasury", desc: "Cash-in approvals and wallet crediting" },
  { href: "/admin/gardener", title: "Gardeners", desc: "Farmer and gardener management" },
  { href: "/admin/support", title: "Support", desc: "Customer tickets and replies" },
  { href: "/admin/notifications", title: "Notifications", desc: "System messages and read status" },
  { href: "/admin/activity", title: "Activity", desc: "Platform activity feed" },
  { href: "/admin/audit", title: "Audit", desc: "Financial and operational audit" },
  { href: "/admin/legal", title: "Legal", desc: "DENR and compliance documents" },
  { href: "/admin/reports", title: "Reports", desc: "Analytics and summaries" },
  { href: "/admin/settings", title: "Settings", desc: "Platform configuration" },
];

export const investorLinks = [
  { href: "/investor/marketplace", title: "Buy Seedlings", desc: "Purchase ₱14,000 AG seedlings" },
  { href: "/investor/my-trees", title: "My AG Trees", desc: "AG codes, DENR tags, GPS and photos" },
  { href: "/tree", title: "Tree Registry", desc: "Public tree portfolio view" },
  { href: "/investor/timeline", title: "Timeline", desc: "Growth and plantation timeline" },
  { href: "/certificates", title: "Certificates", desc: "Certificate preview cards" },
  { href: "/harvest", title: "Harvest", desc: "Harvest readiness and estimates" },
  { href: "/plantation", title: "Plantation", desc: "Farms and legal documents" },
  { href: "/investor/wallet", title: "Wallet", desc: "Balance, cash-in, transactions" },
  { href: "/investor/referrals", title: "Referrals", desc: "Referral link and bonuses" },
  { href: "/investor/recovery", title: "Recovery Fund", desc: "Recovery fund ledger" },
  { href: "/investor/support", title: "Support", desc: "Open and track tickets" },
  { href: "/investor/settings", title: "Settings", desc: "Profile and preferences" },
  { href: "/investor/notifications", title: "Notifications", desc: "Messages and alerts" },
];

export const farmerLinks = [
  { href: "/farmer/assigned-trees", title: "Assigned Trees", desc: "Trees assigned for care" },
  { href: "/farmer/dashboard/task", title: "Tasks", desc: "Start and finish field tasks" },
  { href: "/farmer/growth-logs", title: "Growth Logs", desc: "Upload growth measurements" },
  { href: "/farmer/photo-updates", title: "Photo Updates", desc: "Upload latest tree photos" },
  { href: "/farmer/gps", title: "GPS Updates", desc: "Update tree location" },
  { href: "/farmer/reports", title: "Reports", desc: "Field reports and concerns" },
  { href: "/farmer/profile", title: "Profile", desc: "Farmer account information" },
];
