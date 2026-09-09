"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";

type Row = Record<string, unknown>;
type LogRow = Row & { id?: unknown; source?: unknown; created_at?: unknown; error_message?: unknown; outcome?: unknown };
type PackageSummary = { key: string; name: string; price: number; sold: number; total: number };
const money = (value: unknown) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(Number(value || 0));
const upper = (value: unknown) => String(value || "").toUpperCase();
const packageName: Record<string, string> = { SKIP: "Tree Only", MONTHLY: "Tree + Monthly Care", ONE_TIME: "Tree + One-Time Care" };

export default function AdminDashboardPage() {
  const [profiles, setProfiles] = useState<Row[]>([]);
  const [gardeners, setGardeners] = useState<Row[]>([]);
  const [orders, setOrders] = useState<Row[]>([]);
  const [contracts, setContracts] = useState<Row[]>([]);
  const [updates, setUpdates] = useState<Row[]>([]);
  const [withdrawals, setWithdrawals] = useState<Row[]>([]);
  const [tickets, setTickets] = useState<Row[]>([]);
  const [recoveryLogs, setRecoveryLogs] = useState<LogRow[]>([]);
  const [guardianLogs, setGuardianLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => { void loadDashboard(); }, []);

  async function loadDashboard() {
    setLoading(true); setNotice("");
    const results = await Promise.all([
      supabase.from("profiles").select("id,role,account_status,kyc_status").limit(2000),
      supabase.from("gardeners").select("id,status").limit(2000),
      supabase.from("sur_tree_orders").select("id,status,exact_total,submitted_total,created_at,sur_tree_order_items(quantity,care_plan,tree_price,care_price,line_total)").order("created_at", { ascending: false }).limit(1000),
      supabase.from("sur_contracts").select("id,status").limit(1000),
      supabase.from("sur_tree_updates").select("id,status").limit(2000),
      supabase.from("withdrawal_requests").select("id,status,amount").limit(1000),
      supabase.from("support_tickets").select("id,status").limit(1000),
      supabase.from("sur_recovery_events").select("id,case_type,action,outcome,detail,created_at").order("created_at", { ascending: false }).limit(10),
      supabase.from("guardian_audit_log").select("id,statement_kind,succeeded,affected_rows,error_message,created_at").order("created_at", { ascending: false }).limit(10),
    ]);
    const coreLabels = ["Accounts", "Caretakers", "Tree payments", "Contracts", "Caretaker reports", "Withdrawals", "Support"];
    const unavailable = results.slice(0, 7).map((result, index) => result.error ? coreLabels[index] : "").filter(Boolean);
    setProfiles((results[0].data || []) as Row[]); setGardeners((results[1].data || []) as Row[]); setOrders((results[2].data || []) as Row[]);
    setContracts((results[3].data || []) as Row[]); setUpdates((results[4].data || []) as Row[]);
    setWithdrawals((results[5].data || []) as Row[]); setTickets((results[6].data || []) as Row[]);
    setRecoveryLogs((results[7].data || []) as Row[]); setGuardianLogs((results[8].data || []) as Row[]);
    setNotice(unavailable.length ? `${unavailable.join(", ")} information is temporarily unavailable. Other dashboard information is still safe to use.` : ""); setLoading(false);
  }

  const customers = profiles.filter((p) => ["COPLANTER", "INVESTOR", "CUSTOMER"].includes(upper(p.role)));
  const activeCustomers = customers.filter((p) => upper(p.account_status) === "ACTIVE");
  const activeCaretakers = gardeners.filter((g) => ["ACTIVE", "APPROVED"].includes(upper(g.status)));
  const pendingKyc = customers.filter((p) => ["PENDING", "UNDER_REVIEW", "SUBMITTED"].includes(upper(p.kyc_status))).length;
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
    <section className="mt-5 grid gap-4 md:grid-cols-3"><SummaryCard label="Packages sold" value={String(totalPackages)} detail={`${money(totalSales)} approved sales`} href="/admin/tree"/><SummaryCard label="Customers" value={String(activeCustomers.length)} detail={`${customers.length} total accounts`} href="/admin/accounts"/><SummaryCard label="Caretakers" value={String(activeCaretakers.length)} detail={`${gardeners.length} total caretaker records`} href="/admin/accounts"/></section>
    <section className="mt-5 rounded-[2rem] border border-[#ded8c7] bg-white p-5 shadow-sm sm:p-7"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#167553]">Approved sales</p><h2 className="mt-2 text-2xl font-black">Packages and prices</h2></div><p className="text-sm font-bold text-[#65756e]">Pending and rejected payments are excluded.</p></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[660px] border-separate border-spacing-y-2 text-left"><thead className="text-xs font-black uppercase tracking-[.12em] text-[#718078]"><tr><th className="px-4 py-2">Package</th><th className="px-4 py-2">Price</th><th className="px-4 py-2">Sold</th><th className="px-4 py-2 text-right">Total</th></tr></thead><tbody>{packages.map((item) => <tr key={item.key} className="bg-[#f7f5ee] font-bold"><td className="rounded-l-2xl px-4 py-4">{item.name}</td><td className="px-4 py-4">{money(item.price)}</td><td className="px-4 py-4">{item.sold}</td><td className="rounded-r-2xl px-4 py-4 text-right font-black text-[#0b5a43]">{money(item.total)}</td></tr>)}{!loading && packages.length === 0 && <tr><td colSpan={4} className="rounded-2xl bg-[#f7f5ee] px-4 py-8 text-center text-sm text-[#718078]">No approved package sales yet.</td></tr>}</tbody></table></div></section>
    <section className="mt-5 rounded-[2rem] border border-[#ded8c7] bg-white p-5 shadow-sm sm:p-7"><p className="text-xs font-black uppercase tracking-[.18em] text-[#a57417]">Needs your attention</p><h2 className="mt-2 text-2xl font-black">What should I do next?</h2><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Action href="/admin/tree" label="Payments to verify" count={pendingOrders}/><Action href="/admin/accounts" label="Customer identity reviews" count={pendingKyc}/><Action href="/admin/tree" label="Contracts awaiting action" count={pendingContracts}/><Action href="/admin/tasks" label="Caretaker reports to review" count={pendingUpdates}/><Action href="/admin/tree" label="Payout requests" count={pendingWithdrawals}/><Action href="/admin/support" label="Support conversations" count={openSupport}/></div></section>
    <section className="mt-5 rounded-[2rem] border border-[#ded8c7] bg-white p-5 shadow-sm sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#167553]">TOH & Guardian activity</p><h2 className="mt-2 text-2xl font-black">What the system checked and recovered</h2></div><span className="rounded-full bg-emerald-100 px-3 py-1.5 text-[10px] font-black text-emerald-800">LIVE LOG</span></div><div className="mt-5 space-y-3">{[...recoveryLogs.map(row=>({...row,source:"TOH"})),...guardianLogs.map(row=>({...row,source:"Guardian"}))].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,8).map(row=><article key={`${row.source}-${row.id}`} className="rounded-2xl border border-[#dbe5df] bg-[#f7faf8] p-4"><div className="flex items-start justify-between gap-3"><div><b>{simpleLog(row)}</b><p className="mt-1 text-sm text-[#687970]">{String(row.source)} · {logTime(row.created_at)}</p></div><span className={`rounded-full px-3 py-1 text-[10px] font-black ${row.error_message||row.outcome==="FAILED"?"bg-red-100 text-red-800":"bg-emerald-100 text-emerald-800"}`}>{row.error_message||row.outcome==="FAILED"?"Needs attention":"Checked"}</span></div><details className="mt-3"><summary className="cursor-pointer text-xs font-black text-[#167553]">View technical details</summary><pre className="mt-2 overflow-auto rounded-xl bg-[#e9efeb] p-3 text-[11px] text-[#52655c]">{JSON.stringify(row,null,2)}</pre></details></article>)}{!loading&&recoveryLogs.length===0&&guardianLogs.length===0&&<p className="rounded-2xl border border-dashed border-[#dbe5df] p-5 text-sm font-bold text-[#718078]">No TOH or Guardian activity has been recorded yet.</p>}</div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Link href="/health" className="rounded-2xl border border-[#dbe5df] bg-[#f7faf8] p-5"><b className="block">Check system health</b><span className="mt-2 block text-sm text-[#687970]">See whether important app services are reachable.</span></Link><Link href="/admin/recovery" className="rounded-2xl border border-[#e5d5a9] bg-[#fff9e8] p-5"><b className="block">Open safe recovery</b><span className="mt-2 block text-sm text-[#68501b]">Review a stuck workflow before taking action.</span></Link></div><details className="mt-4 rounded-2xl border border-[#dbe5df] bg-white p-4"><summary className="cursor-pointer text-sm font-black text-[#53665d]">Developer assistance</summary><Link href="/admin/guardian" className="mt-3 inline-flex rounded-xl border border-[#cdd9d2] px-4 py-2.5 text-sm font-black text-[#073d2e]">Open technical assistant</Link></details></section>
  </div></main>;
}

function SummaryCard({ label, value, detail, href }: { label: string; value: string; detail: string; href: string }) { return <Link href={href} className="rounded-[1.75rem] border border-[#ded8c7] bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><p className="text-xs font-black uppercase tracking-[.16em] text-[#687a72]">{label}</p><p className="mt-3 text-4xl font-black text-[#073d2e]">{value}</p><p className="mt-2 text-sm font-bold text-[#7b877f]">{detail}</p></Link>; }
function Action({ href, label, count }: { href: string; label: string; count: number }) { return <Link href={href} className="flex min-h-24 items-center justify-between gap-4 rounded-2xl border border-[#dbe5df] bg-[#f7faf8] p-5 transition hover:border-[#9dcbb7] hover:bg-[#edf7f1]"><span className="font-black">{label}</span><span className={`grid h-10 min-w-10 place-items-center rounded-full px-3 text-sm font-black ${count ? "bg-[#dda93e] text-[#211906]" : "bg-[#dfe9e4] text-[#5d7067]"}`}>{count}</span></Link>; }
function simpleLog(row: Row) { if (row.source === "TOH") return row.outcome === "RECOVERED" ? "A stalled workflow was safely recovered" : `Recovery check: ${String(row.action || row.case_type || "completed")}`; if (row.error_message) return "Guardian found an operation that needs attention"; return `Guardian checked a ${String(row.statement_kind || "database").toLowerCase()} operation`; }
function logTime(value: unknown) { const date = new Date(String(value || "")); return Number.isNaN(date.getTime()) ? "Recent" : date.toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
