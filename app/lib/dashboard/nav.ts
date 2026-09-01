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
  { href: "/admin/operations", title: "Operations Center", desc: "Daily runbook, safety stops and PMS schedule" },
  { href: "/admin/orders", title: "Tree Orders", desc: "Verify exact Maya orders and create per-tree contracts" },
  { href: "/admin/tree-tags", title: "Tree QR Tags", desc: "Print privacy-safe physical QR labels for official Tree IDs" },
  { href: "/admin/guardian", title: "Guardian SQL", desc: "SUR-only guarded database query and repair gateway" },
  { href: "/admin/toh", title: "TOH Intelligence", desc: "Read-only app diagnosis and verified technical guidance" },
  { href: "/admin/recovery", title: "Recovery Center", desc: "Detect stuck work, verify outcomes, repair safe cases, and escalate sensitive cases" },
  { href: "/admin/coplanters", title: "Co-Planters", desc: "Approve accounts and KYC" },
  { href: "/admin/tree-registry", title: "Tree Registry", desc: "Tree IDs, QR tags, planting and general farm location" },
  { href: "/admin/care-operations", title: "Care Operations", desc: "Assign signed Tree IDs and approve daily caretaker evidence" },
  { href: "/admin/treasury", title: "Treasury", desc: "Withdrawal review and payout records" },
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
  { href: "/investor/my-trees", title: "My Agarwood", desc: "Tree IDs, QR tags, contracts and approved updates" },
  { href: "/tree", title: "Tree Registry", desc: "Public tree portfolio view" },
  { href: "/investor/timeline", title: "Timeline", desc: "Growth and plantation timeline" },
  { href: "/certificates", title: "Certificates", desc: "Certificate preview cards" },
  { href: "/harvest", title: "Harvest", desc: "Harvest readiness and estimates" },
  { href: "/plantation", title: "Plantation", desc: "Farms and legal documents" },
  { href: "/legalities", title: "Legalities", desc: "Permits, licenses, MOA and certificates" },
  { href: "/investor/wallet", title: "Wallet", desc: "Balance, withdrawals, transactions" },
  { href: "/investor/referrals", title: "Referrals", desc: "Referral link and bonuses" },
  { href: "/investor/support", title: "Support", desc: "Open and track tickets" },
  { href: "/investor/settings", title: "Settings", desc: "Profile and preferences" },
  { href: "/investor/notifications", title: "Notifications", desc: "Messages and alerts" },
];

export const farmerLinks = [
  { href: "/farmer/daily-care", title: "Daily Tree Care", desc: "Submit one original-quality daily update for each assigned Tree ID" },
  { href: "/farmer/dashboard/task", title: "Previous Task Queue", desc: "Legacy paid service assignments and earlier proof records" },
  { href: "/farmer/assigned-trees", title: "Assigned Trees", desc: "Inspect the AG trees connected to your tasks" },
  { href: "/farmer/photo-updates", title: "Submit Photos", desc: "Send customer-visible photo documentation" },
  { href: "/farmer/growth-logs", title: "Growth Logs", desc: "Submit health, height, diameter, and field notes" },
  { href: "/farmer/reports", title: "Reports", desc: "Review submitted work and customer notifications" },
  { href: "/farmer/profile", title: "Profile", desc: "Farmer account information" },
];
