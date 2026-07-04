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
      supabase.from("trees").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("seedling_purchases").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("farms").select("*").limit(1000),
      supabase.from("tree_growth_logs").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("licenses").select("*").limit(1000),
    ]);

    if (profileError) {
      setMessage(profileError.message);
      setLoading(false);
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
    setLoading(false);
  }

  const totalWalletBalance = wallets.reduce((sum, wallet) => sum + Number(wallet.balance || 0), 0);

  const pendingCashIn = transactions.filter(
    (tx) => String(tx.transaction_type || "").toUpperCase() === "CASH_IN_REQUEST" && String(tx.status || "").toUpperCase() === "PENDING"
  );

  const pendingWithdraw = transactions.filter(
    (tx) => String(tx.transaction_type || "").toUpperCase() === "WITHDRAW_REQUEST" && String(tx.status || "").toUpperCase() === "PENDING"
  );

  const paidPurchases = purchases.filter((row) =>
    ["PAID", "APPROVED", "COMPLETED"].includes(String(row.status || "").toUpperCase())
  );

  const purchaseVolume = paidPurchases.reduce(
    (sum, row) => sum + Number(row.total_amount || row.amount || 0),
    0
  );

  const harvestReady = trees.filter((tree) => estimateHarvestReadiness(tree) === "READY");
  const needsAttention = trees.filter((tree) =>
    ["DAMAGED", "SICK", "NEEDS_ATTENTION", "ATTENTION"].includes(
      String(tree.status || tree.health_status || "").toUpperCase()
    )
  );

  const activeLicenses = licenses.filter((license) =>
    ["ACTIVE", "VALID", "APPROVED", "ISSUED", "VERIFIED"].includes(
      String(license.status || license.license_status || license.verification_status || "").toUpperCase()
    )
  );

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
    <main className="min-h-screen bg-[#04140d] text-white">
      <section className="border-b border-white/10 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-green-300">
                SUR ALOESWOOD ADMIN
              </p>
              <h1 className="mt-4 text-4xl font-black md:text-6xl">Reports Center</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-green-50/80">
                Live operational reporting across co-planters, wallets, purchases, trees, plantations, legal, and harvest.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/admin/dashboard" className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black">
                Dashboard
              </Link>
              <Link href="/admin/treasury" className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black">
                Treasury
              </Link>
              <button onClick={loadReports} disabled={loading} className="rounded-2xl bg-green-500 px-5 py-3 text-sm font-black text-green-950 disabled:bg-slate-500">
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>
          </div>

          {message && (
            <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">
              {message}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-8 md:grid-cols-2 md:px-10 xl:grid-cols-4">
        <Metric title="Co-Planters" value={String(profiles.length)} />
        <Metric title="Wallet Balance" value={peso(totalWalletBalance)} />
        <Metric title="Purchase Volume" value={peso(purchaseVolume)} />
        <Metric title="Trees" value={String(trees.length)} />
        <Metric title="Farm Blocks" value={String(farms.length)} />
        <Metric title="Harvest Ready" value={String(harvestReady.length)} />
        <Metric title="Needs Attention" value={String(needsAttention.length)} />
        <Metric title="Active Licenses" value={String(activeLicenses.length)} />
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-8 md:px-10 lg:grid-cols-3">
        <ReportCard title="Treasury Queue">
          <Info label="Pending Cash-In" value={`${pendingCashIn.length} / ${peso(pendingCashIn.reduce((s, r) => s + Number(r.amount || 0), 0))}`} />
          <Info label="Pending Withdraw" value={`${pendingWithdraw.length} / ${peso(pendingWithdraw.reduce((s, r) => s + Number(r.amount || 0), 0))}`} />
          <Info label="Wallet Transactions" value={String(transactions.length)} />
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

      <section className="mx-auto max-w-7xl px-6 pb-16 md:px-10">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-green-300">Tree Report</p>
              <h2 className="mt-2 text-3xl font-black">Tree Ownership Summary</h2>
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search owner, tree code, status..."
              className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none"
            />
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-green-100/70">
                <tr>
                  <th className="py-3">Tree</th>
                  <th>Owner</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Stage</th>
                  <th>Harvest</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrees.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-sm font-bold text-white/55">
                      No tree reports found.
                    </td>
                  </tr>
                ) : (
                  filteredTrees.map((tree) => {
                    const owner = getOwner(tree, profiles);
                    return (
                      <tr key={tree.id} className="border-b border-white/5 align-top">
                        <td className="py-4 text-sm font-black text-green-200">{getTreeCode(tree)}</td>
                        <td className="py-4 text-sm font-black">{owner?.full_name || "Unassigned"}</td>
                        <td className="py-4 text-sm text-white/70">{owner?.email || "-"}</td>
                        <td className="py-4 text-sm text-white/70">{tree.status || tree.health_status || "-"}</td>
                        <td className="py-4 text-sm text-white/70">{tree.stage || "-"}</td>
                        <td className="py-4 text-sm font-black text-green-300">{estimateHarvestReadiness(tree)}</td>
                        <td className="py-4 text-sm text-white/70">{formatDate(tree.created_at)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl">
      <p className="text-xs font-black uppercase tracking-wide text-green-100/60">{title}</p>
      <p className="mt-3 truncate text-xl font-black text-green-300">{value}</p>
    </div>
  );
}

function ReportCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
      <h2 className="text-2xl font-black">{title}</h2>
      <div className="mt-5 grid gap-3">{children}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/25 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-white/45">{label}</p>
      <p className="mt-2 text-sm font-black text-white">{value}</p>
    </div>
  );
}
