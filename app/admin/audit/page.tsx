"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { findProfile, formatDate, peso, profileName, statusClass, type AnyRow } from "@/app/lib/admin/activity";

export default function AdminAuditPage() {
  const [profiles, setProfiles] = useState<AnyRow[]>([]);
  const [wallets, setWallets] = useState<AnyRow[]>([]);
  const [transactions, setTransactions] = useState<AnyRow[]>([]);
  const [purchases, setPurchases] = useState<AnyRow[]>([]);
  const [memberships, setMemberships] = useState<AnyRow[]>([]);
  const [maintenance, setMaintenance] = useState<AnyRow[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadAudit();
  }, []);

  async function loadAudit() {
    setMessage("");

    const [
      { data: profileRows, error },
      { data: walletRows },
      { data: txRows },
      { data: purchaseRows },
      { data: membershipRows },
      { data: maintenanceRows },
    ] = await Promise.all([
      supabase.from("profiles").select("*").limit(1000),
      supabase.from("wallets").select("*").limit(1000),
      supabase.from("wallet_transactions").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("seedling_purchases").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("memberships").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("maintenance_payments").select("*").order("created_at", { ascending: false }).limit(1000),
    ]);

    if (error) {
      setMessage(error.message);
      return;
    }

    setProfiles((profileRows || []) as AnyRow[]);
    setWallets((walletRows || []) as AnyRow[]);
    setTransactions((txRows || []) as AnyRow[]);
    setPurchases((purchaseRows || []) as AnyRow[]);
    setMemberships((membershipRows || []) as AnyRow[]);
    setMaintenance((maintenanceRows || []) as AnyRow[]);
  }

  const totalWalletBalance = wallets.reduce((sum, row) => sum + Number(row.balance || 0), 0);
  const totalWalletTx = transactions.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const purchaseVolume = purchases.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const membershipVolume = memberships.reduce((sum, row) => sum + Number(row.annual_fee || 0), 0);
  const maintenanceVolume = maintenance.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const auditRows = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return [
      ...transactions.map((row) => ({ kind: "WALLET", amount: row.amount, label: row.transaction_type, row })),
      ...purchases.map((row) => ({ kind: "PURCHASE", amount: row.amount, label: `${row.quantity || 1} Seedling`, row })),
      ...memberships.map((row) => ({ kind: "MEMBERSHIP", amount: row.annual_fee, label: row.membership_plan, row })),
      ...maintenance.map((row) => ({ kind: "MAINTENANCE", amount: row.amount, label: `Year ${row.year_no}`, row })),
    ]
      .filter((item) => {
        const profile = findProfile(item.row.profile_id, profiles);
        const text = `${item.kind} ${JSON.stringify(item.row)} ${profile?.full_name || ""} ${profile?.email || ""}`.toLowerCase();
        return !keyword || text.includes(keyword);
      })
      .sort((a, b) => new Date(b.row.created_at || 0).getTime() - new Date(a.row.created_at || 0).getTime());
  }, [transactions, purchases, memberships, maintenance, profiles, search]);

  return (
    <main className="min-h-screen bg-[#04140d] text-white">
      <section className="border-b border-white/10 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-green-300">SUR ALOESWOOD ADMIN</p>
              <h1 className="mt-4 text-4xl font-black md:text-6xl">Audit Center</h1>
            </div>
            <button onClick={loadAudit} className="rounded-2xl bg-green-500 px-5 py-3 text-sm font-black text-green-950">Refresh</button>
          </div>
          {message && <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-8 md:grid-cols-2 md:px-10 xl:grid-cols-5">
        <Metric title="Wallet Balance" value={peso(totalWalletBalance)} />
        <Metric title="Wallet Tx Total" value={peso(totalWalletTx)} />
        <Metric title="Purchases" value={peso(purchaseVolume)} />
        <Metric title="Memberships" value={peso(membershipVolume)} />
        <Metric title="Maintenance" value={peso(maintenanceVolume)} />
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16 md:px-10">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-3xl font-black">Financial Audit Ledger</h2>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none" />
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-green-100/70">
                <tr>
                  <th className="py-3">Date</th>
                  <th>Type</th>
                  <th>Profile</th>
                  <th>Email</th>
                  <th>Label</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.length === 0 ? (
                  <tr><td colSpan={7} className="py-10 text-sm font-bold text-white/55">No audit rows found.</td></tr>
                ) : auditRows.map((item) => {
                  const profile = findProfile(item.row.profile_id, profiles);
                  return (
                    <tr key={`${item.kind}-${item.row.id}`} className="border-b border-white/5 align-top">
                      <td className="py-4 text-sm text-white/70">{formatDate(item.row.created_at)}</td>
                      <td className="py-4 text-sm font-black text-green-200">{item.kind}</td>
                      <td className="py-4 text-sm font-black">{profileName(profile)}</td>
                      <td className="py-4 text-sm text-white/70">{profile?.email || "-"}</td>
                      <td className="py-4 text-sm text-white/70">{item.label || "-"}</td>
                      <td className="py-4 text-sm font-black text-green-300">{peso(item.amount)}</td>
                      <td className="py-4"><span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(item.row.status)}`}>{item.row.status || "LOGGED"}</span></td>
                    </tr>
                  );
                })}
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
