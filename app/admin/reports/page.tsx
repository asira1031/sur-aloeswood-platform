"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { estimateHarvestReadiness, formatDate, getOwner, getTreeCode, peso, type AnyRow } from "@/app/lib/tree/utils";

export default function AdminReportsPage() {
  const [profiles, setProfiles] = useState<AnyRow[]>([]);
  const [wallets, setWallets] = useState<AnyRow[]>([]);
  const [transactions, setTransactions] = useState<AnyRow[]>([]);
  const [trees, setTrees] = useState<AnyRow[]>([]);
  const [purchases, setPurchases] = useState<AnyRow[]>([]);
  const [farms, setFarms] = useState<AnyRow[]>([]);
  const [growthLogs, setGrowthLogs] = useState<AnyRow[]>([]);
  const [licenses, setLicenses] = useState<AnyRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    setLoading(true);
    setMessage("");

    const [
      { data: profileRows, error: profileError },
      { data: walletRows },
      { data: txRows },
      { data: treeRows },
      { data: purchaseRows },
      { data: farmRows },
      { data: logRows },
      { data: licenseRows },
    ] = await Promise.all([
      supabase.from("profiles").select("*").limit(1000),
      supabase.from("wallets").select("*").limit(1000),
      supabase.from("wallet_transactions").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("tree_registry").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("seedling_purchases").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("farms").select("*").limit(1000),
      supabase.from("tree_growth_logs").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("licenses").select("*").limit(1000),
    ]);

    setLoading(false);

    if (profileError) {
      setMessage(profileError.message);
      return;
    }

    setProfiles((profileRows || []) as AnyRow[]);
    setWallets((walletRows || []) as AnyRow[]);
    setTransactions((txRows || []) as AnyRow[]);
    setTrees((treeRows || []) as AnyRow[]);
    setPurchases((purchaseRows || []) as AnyRow[]);
    setFarms((farmRows || []) as AnyRow[]);
    setGrowthLogs((logRows || []) as AnyRow[]);
    setLicenses((licenseRows || []) as AnyRow[]);
  }

  const totalWalletBalance = wallets.reduce((sum, wallet) => sum + Number(wallet.balance || 0), 0);
  const pendingWithdraw = transactions.filter((tx) => String(tx.transaction_type || "").toUpperCase() === "WITHDRAW_REQUEST" && String(tx.status || "").toUpperCase() === "PENDING");
  const paidPurchases = purchases.filter((row) => ["PAID", "APPROVED", "COMPLETED"].includes(String(row.status || "").toUpperCase()));
  const purchaseVolume = paidPurchases.reduce((sum, row) => sum + Number(row.total_amount || row.amount || 0), 0);
  const harvestReady = trees.filter((tree) => estimateHarvestReadiness(tree) === "READY");
  const needsAttention = trees.filter((tree) => ["DAMAGED", "SICK", "NEEDS_ATTENTION", "ATTENTION"].includes(String(tree.status || tree.health_status || "").toUpperCase()));
  const activeLicenses = licenses.filter((license) => ["ACTIVE", "VALID", "APPROVED", "ISSUED", "VERIFIED"].includes(String(license.status || license.license_status || license.verification_status || "").toUpperCase()));

  const filteredTrees = useMemo(() => {
    const keyword = search.toLowerCase().trim();
    return trees
      .filter((tree) => {
        const owner = getOwner(tree, profiles);
        const text = `${JSON.stringify(tree)} ${owner?.full_name || ""} ${owner?.email || ""}`.toLowerCase();
        return !keyword || text.includes(keyword);
      })
      .slice(0, 80);
  }, [trees, profiles, search]);

  return (
    <main className="min-h-screen bg-[#f3f7f1] text-slate-950">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-4 lg:px-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/20 p-6 shadow-sm lg:p-8">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/forest-bg.jpg')" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-green-950/90 via-green-900/66 to-green-950/18" />
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-white/75">SUR Aloeswood Admin</p>
              <h1 className="mt-4 text-4xl font-black text-white lg:text-6xl">Reports Center</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/78 lg:text-base">Operational reporting across co-planters, wallets, purchases, trees, plantations, legal, and harvest readiness.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={loadReports} disabled={loading} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm hover:bg-white/90 disabled:opacity-60">{loading ? "Loading..." : "Refresh"}</button>
              <Link href="/admin/dashboard" className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur hover:bg-white/20">Dashboard</Link>
              <Link href="/admin/treasury" className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur hover:bg-white/20">Treasury</Link>
            </div>
          </div>
          {message && <div className="relative z-10 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">{message}</div>}
        </section>

        <section className="grid gap-4 py-5 md:grid-cols-2 xl:grid-cols-4">
          <Metric title="Co-Planters" value={String(profiles.length)} />
          <Metric title="Wallet Balance" value={peso(totalWalletBalance)} />
          <Metric title="Purchase Volume" value={peso(purchaseVolume)} />
          <Metric title="Trees" value={String(trees.length)} />
          <Metric title="Farm Blocks" value={String(farms.length)} />
          <Metric title="Harvest Ready" value={String(harvestReady.length)} />
          <Metric title="Needs Attention" value={String(needsAttention.length)} />
          <Metric title="Active Licenses" value={String(activeLicenses.length)} />
        </section>

        <section className="grid gap-5 pb-5 lg:grid-cols-3">
          <ReportCard title="Treasury Queue">
            <Info label="Pending Withdraw" value={`${pendingWithdraw.length} / ${peso(pendingWithdraw.reduce((sum, row) => sum + Number(row.amount || 0), 0))}`} />
            <Info label="Wallet Transactions" value={String(transactions.length)} />
            <Info label="Wallet Balance" value={peso(totalWalletBalance)} />
          </ReportCard>
          <ReportCard title="Tree Operations">
            <Info label="Total Trees" value={String(trees.length)} />
            <Info label="Harvest Ready" value={String(harvestReady.length)} />
            <Info label="Growth Logs" value={String(growthLogs.length)} />
          </ReportCard>
          <ReportCard title="Compliance">
            <Info label="Licenses" value={String(licenses.length)} />
            <Info label="Active / Valid" value={String(activeLicenses.length)} />
            <Info label="Farm Blocks" value={String(farms.length)} />
          </ReportCard>
        </section>

        <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-700">Tree Report</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Tree Ownership Summary</h2>
            </div>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search owner, tree code, status" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-emerald-400" />
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="py-3">Tree</th><th>Owner</th><th>Email</th><th>Status</th><th>Stage</th><th>Harvest</th><th>Created</th></tr>
              </thead>
              <tbody>
                {filteredTrees.length === 0 ? (
                  <tr><td colSpan={7} className="py-10 text-sm font-bold text-slate-500">No tree reports found.</td></tr>
                ) : filteredTrees.map((tree) => {
                  const owner = getOwner(tree, profiles);
                  return (
                    <tr key={tree.id} className="border-b border-slate-100 align-top">
                      <td className="py-4 text-sm font-black text-emerald-700">{getTreeCode(tree)}</td>
                      <td className="py-4 text-sm font-black text-slate-950">{owner?.full_name || "Unassigned"}</td>
                      <td className="py-4 text-sm text-slate-600">{owner?.email || "-"}</td>
                      <td className="py-4 text-sm text-slate-600">{tree.status || tree.health_status || "-"}</td>
                      <td className="py-4 text-sm text-slate-600">{tree.stage || "-"}</td>
                      <td className="py-4 text-sm font-black text-emerald-700">{estimateHarvestReadiness(tree)}</td>
                      <td className="py-4 text-sm text-slate-600">{formatDate(tree.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return <div className="rounded-[1.5rem] border border-emerald-100 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-wide text-slate-500">{title}</p><p className="mt-3 truncate text-2xl font-black text-emerald-800">{value}</p></div>;
}

function ReportCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6"><h2 className="text-2xl font-black text-slate-950">{title}</h2><div className="mt-5 grid gap-3">{children}</div></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-sm font-black text-slate-950">{value}</p></div>;
}
