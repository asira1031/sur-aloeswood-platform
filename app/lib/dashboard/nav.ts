export type AnyRow = Record<string, any>;
import { COPLANTER_PACKAGE_PRICE, peso as businessPeso } from "@/app/lib/business/rules";

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
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (["PENDING", "PROCESSING", "FOR_REVIEW", "ASSIGNED", "UNREAD", "MAINTENANCE"].includes(value)) {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (["REJECTED", "FAILED", "CANCELLED", "SUSPENDED", "DAMAGED", "CLOSED"].includes(value)) {
    return "border-red-200 bg-red-50 text-red-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
};

export function byDateDesc(a: AnyRow, b: AnyRow) {
  return new Date(b.created_at || b.assigned_at || 0).getTime() - new Date(a.created_at || a.assigned_at || 0).getTime();
}

export const adminLinks = [
  { href: "/admin/coplanters", title: "Co-Planters", desc: "Approve accounts and KYC" },
  { href: "/admin/purchases", title: "Seedling Purchases", desc: "Approve payments and generate AG codes" },
  { href: "/admin/tree-registry", title: "Tree Registry", desc: "DENR tags, GPS, planting details" },
  { href: "/admin/tree-maintenance", title: "Tree Maintenance", desc: "Assign caretakers and optional care plans per tree" },
  { href: "/admin/treasury", title: "Treasury", desc: "Cash-in approvals and wallet crediting" },
  { href: "/admin/finance-distribution", title: "Finance Distribution", desc: "Daily allocation ledger and monthly payout settlement" },
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
  {
    href: "/investor/marketplace",
    title: "Buy Co-Planter Package",
    desc: `Purchase ${businessPeso(COPLANTER_PACKAGE_PRICE)} AG co-planter packages`,
  },
  { href: "/investor/my-trees", title: "My AG Trees", desc: "AG codes, DENR tags, GPS and photos" },
  { href: "/tree", title: "Tree Registry", desc: "Public tree portfolio view" },
  { href: "/investor/timeline", title: "Timeline", desc: "Growth and plantation timeline" },
  { href: "/certificates", title: "Certificates", desc: "Certificate preview cards" },
  { href: "/harvest", title: "Harvest", desc: "Harvest readiness and estimates" },
  { href: "/plantation", title: "Plantation", desc: "Farms and legal documents" },
  { href: "/legalities", title: "Legalities", desc: "Permits, licenses, MOA and certificates" },
  { href: "/investor/wallet", title: "Wallet", desc: "Balance, cash-in, transactions" },
  { href: "/investor/referrals", title: "Referrals", desc: "Referral link and bonuses" },
  { href: "/investor/recovery", title: "Recovery Fund", desc: "Recovery fund ledger" },
  { href: "/investor/support", title: "Support", desc: "Open and track tickets" },
  { href: "/investor/settings", title: "Settings", desc: "Profile and preferences" },
  { href: "/investor/notifications", title: "Notifications", desc: "Messages and alerts" },
];

export const farmerLinks = [
  { href: "/farmer/dashboard/task", title: "Task Queue", desc: "See paid service requests assigned by admin" },
  { href: "/farmer/assigned-trees", title: "Assigned Trees", desc: "Inspect the AG trees connected to your tasks" },
  { href: "/farmer/photo-updates", title: "Submit Photos", desc: "Send customer-visible photo documentation" },
  { href: "/farmer/growth-logs", title: "Growth Logs", desc: "Submit health, height, diameter, and field notes" },
  { href: "/farmer/gps", title: "GPS Updates", desc: "Update farm block or location reference" },
  { href: "/farmer/reports", title: "Reports", desc: "Review submitted work and customer notifications" },
  { href: "/farmer/profile", title: "Profile", desc: "Farmer account information" },
];
