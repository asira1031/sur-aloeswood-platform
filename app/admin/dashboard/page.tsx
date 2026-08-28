"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";

type Row = Record<string, unknown>;
type PackageSummary = { key: string; name: string; price: number; sold: number; total: number };
const money = (value: unknown) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(Number(value || 0));
const upper = (value: unknown) => String(value || "").toUpperCase();
const packageName: Record<string, string> = { SKIP: "Tree Only", MONTHLY: "Tree + Monthly Care", ONE_TIME: "Tree + One-Time Care" };

export default function AdminDashboardPage() {
  const [profiles, setProfiles] = useState<Row[]>([]);
  const [orders, setOrders] = useState<Row[]>([]);
  const [contracts, setContracts] = useState<Row[]>([]);
  const [updates, setUpdates] = useState<Row[]>([]);
  const [withdrawals, setWithdrawals] = useState<Row[]>([]);
  const [tickets, setTickets] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => { void loadDashboard(); }, []);

  async function loadDashboard() {
    setLoading(true); setNotice("");
    const results = await Promise.all([
      supabase.from("profiles").select("id,role,account_status,kyc_status").limit(2000),
      supabase.from("sur_tree_orders").select("id,status,exact_total,submitted_total,created_at,sur_tree_order_items(quantity,care_plan,tree_price,care_price,line_total)").order("created_at", { ascending: false }).limit(1000),
      supabase.from("sur_contracts").select("id,status").limit(1000),
      supabase.from("sur_tree_updates").select("id,status").limit(2000),
      supabase.from("withdrawal_requests").select("id,status,amount").limit(1000),
      supabase.from("support_tickets").select("id,status").limit(1000),
    ]);
    const errors = results.map((result) => result.error?.message).filter(Boolean);
    setProfiles((results[0].data || []) as Row[]); setOrders((results[1].data || []) as Row[]);
    setContracts((results[2].data || []) as Row[]); setUpdates((results[3].data || []) as Row[]);
    setWithdrawals((results[4].data || []) as Row[]); setTickets((results[5].data || []) as Row[]);
    setNotice(errors.length ? "Some dashboard records could not be loaded. Refresh or check TOH Guardian." : ""); setLoading(false);
  }

  const customers = profiles.filter((p) => ["COPLANTER", "INVESTOR", "CUSTOMER"].includes(upper(p.role)));
  const caretakers = profiles.filter((p) => ["FARMER", "CARETAKER", "GARDENER"].includes(upper(p.role)));
  const activeCustomers = customers.filter((p) => upper(p.account_status) === "ACTIVE");
  const activeCaretakers = caretakers.filter((p) => upper(p.account_status) === "ACTIVE");
  const pendingKyc = profiles.filter((p) => ["PENDING", "UNDER_REVIEW", "SUBMITTED"].includes(upper(p.kyc_status))).length;
  const approvedOrders = orders.filter((o) => upper(o.status) === "APPROVED");

  const packages = useMemo<PackageSummary[]>(() => {
    const grouped = new Map<string, PackageSummary>();
    for (const order of approvedOrders) for (const item of (order.sur_tree_order_items || []) as Row[]) {
      const plan = upper(item.care_plan) || "SKIP"; const quantity = Math.max(0, Number(item.quantity || 0));
      const lineTotal = Number(item.line_total || 0); const unitPrice = quantity > 0 ? lineTotal / quantity : Number(item.tree_price || 0) + Number(item.care_price || 0);
      const current = grouped.get(plan) || { key: plan, name: packageName[plan] || plan.replaceAll("_", " "), price: unitPrice, sold: 0, total: 0 };
      current.sold += quantity; current.total += lineTotal || unitPrice * quantity; if (!current.price && unitPrice) current.price = unitPrice; grouped.set(plan, current);
    }
    return ["SKIP", "MONTHLY", "ONE_TIME"].map((plan) => grouped.get(plan)).filter((item): item is PackageSummary => Boolean(item));
  }, [approvedOrders]);

  const totalPackages = packages.reduce((sum, item) => sum + item.sold, 0);
  const totalSales = packages.reduce((sum, item) => sum + item.total, 0);
  const pendingOrders = orders.filter((o) => ["PENDING", "PENDING_VERIFICATION", "MANUAL_REVIEW"].includes(upper(o.status))).length;
  const pendingContracts = contracts.filter((c) => ["DRAFT", "PENDING", "CUSTOMER_SIGNATURE_PENDING", "AWAITING_CUSTOMER_SIGNATURE"].includes(upper(c.status))).length;
  const pendingUpdates = updates.filter((u) => ["PENDING", "PENDING_REVIEW", "SUBMITTED"].includes(upper(u.status))).length;
  const pendingWithdrawals = withdrawals.filter((w) => ["PENDING", "PENDING_REVIEW", "PENDING_VERIFICATION"].includes(upper(w.status))).length;
  const openSupport = tickets.filter((t) => ["OPEN", "PENDING", "CUSTOMER_REPLY"].includes(upper(t.status))).length;

  return <main className="min-h-screen bg-[#f4f1e7] px-4 py-5 text-[#10271f] sm:px-6 lg:px-8"><div className="mx-auto w-full max-w-[1380px]">
    <header className="overflow-hidden rounded-[2rem] bg-[#073d2e] p-6 text-white shadow-xl sm:p-8"><div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-black uppercase tracking-[.24em] text-[#bfe6d5]">SUR Aloeswood Admin</p><h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Today&apos;s control center</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">Sales, people, and requests that need your decision—without searching through unnecessary pages.</p></div><button onClick={() => void loadDashboard()} disabled={loading} className="w-fit rounded-2xl bg-[#dda93e] px-5 py-3 text-sm font-black text-[#211906] disabled:opacity-60">{loading ? "Loading…" : "Refresh data"}</button></div></header>
    {notice && <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">{notice}</p>}
    <section className="mt-5 grid gap-4 md:grid-cols-3"><SummaryCard label="Packages sold" value={String(totalPackages)} detail={`${money(totalSales)} approved sales`} href="/admin/orders"/><SummaryCard label="Customers" value={String(activeCustomers.length)} detail={`${customers.length} total accounts`} href="/admin/coplanters"/><SummaryCard label="Caretakers" value={String(activeCaretakers.length)} detail={`${caretakers.length} total accounts`} href="/admin/care-operations"/></section>
    <section className="mt-5 rounded-[2rem] border border-[#ded8c7] bg-white p-5 shadow-sm sm:p-7"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#167553]">Approved sales</p><h2 className="mt-2 text-2xl font-black">Packages and prices</h2></div><p className="text-sm font-bold text-[#65756e]">Pending and rejected payments are excluded.</p></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[660px] border-separate border-spacing-y-2 text-left"><thead className="text-xs font-black uppercase tracking-[.12em] text-[#718078]"><tr><th className="px-4 py-2">Package</th><th className="px-4 py-2">Price</th><th className="px-4 py-2">Sold</th><th className="px-4 py-2 text-right">Total</th></tr></thead><tbody>{packages.map((item) => <tr key={item.key} className="bg-[#f7f5ee] font-bold"><td className="rounded-l-2xl px-4 py-4">{item.name}</td><td className="px-4 py-4">{money(item.price)}</td><td className="px-4 py-4">{item.sold}</td><td className="rounded-r-2xl px-4 py-4 text-right font-black text-[#0b5a43]">{money(item.total)}</td></tr>)}{!loading && packages.length === 0 && <tr><td colSpan={4} className="rounded-2xl bg-[#f7f5ee] px-4 py-8 text-center text-sm text-[#718078]">No approved package sales yet.</td></tr>}</tbody></table></div></section>
    <section className="mt-5 rounded-[2rem] border border-[#ded8c7] bg-white p-5 shadow-sm sm:p-7"><p className="text-xs font-black uppercase tracking-[.18em] text-[#a57417]">Needs your attention</p><h2 className="mt-2 text-2xl font-black">Pending actions</h2><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Action href="/admin/orders" label="Payments to verify" count={pendingOrders}/><Action href="/admin/coplanters" label="KYC to review" count={pendingKyc}/><Action href="/admin/legal" label="Contracts awaiting action" count={pendingContracts}/><Action href="/admin/care-operations" label="Care updates to review" count={pendingUpdates}/><Action href="/admin/withdrawals" label="Withdrawals to process" count={pendingWithdrawals}/><Action href="/admin/support" label="Open support conversations" count={openSupport}/></div></section>
  </div></main>;
}

function SummaryCard({ label, value, detail, href }: { label: string; value: string; detail: string; href: string }) { return <Link href={href} className="rounded-[1.75rem] border border-[#ded8c7] bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><p className="text-xs font-black uppercase tracking-[.16em] text-[#687a72]">{label}</p><p className="mt-3 text-4xl font-black text-[#073d2e]">{value}</p><p className="mt-2 text-sm font-bold text-[#7b877f]">{detail}</p></Link>; }
function Action({ href, label, count }: { href: string; label: string; count: number }) { return <Link href={href} className="flex min-h-24 items-center justify-between gap-4 rounded-2xl border border-[#dbe5df] bg-[#f7faf8] p-5 transition hover:border-[#9dcbb7] hover:bg-[#edf7f1]"><span className="font-black">{label}</span><span className={`grid h-10 min-w-10 place-items-center rounded-full px-3 text-sm font-black ${count ? "bg-[#dda93e] text-[#211906]" : "bg-[#dfe9e4] text-[#5d7067]"}`}>{count}</span></Link>; }
