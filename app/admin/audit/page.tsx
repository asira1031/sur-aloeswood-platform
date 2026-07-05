"use client";

import Link from "next/link";
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
  const [kind, setKind] = useState("ALL");
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
        const kindOk = kind === "ALL" || item.kind === kind;
        const text = `${item.kind} ${JSON.stringify(item.row)} ${profile?.full_name || ""} ${profile?.email || ""}`.toLowerCase();
        return kindOk && (!keyword || text.includes(keyword));
      })
      .sort((a, b) => new Date(b.row.created_at || 0).getTime() - new Date(a.row.created_at || 0).getTime());
  }, [transactions, purchases, memberships, maintenance, profiles, search, kind]);

  return (
    <main className="min-h-screen bg-[#f3f7f1] text-slate-950">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-4 lg:px-6">
        <Hero title="Audit Center" subtitle="Financial ledger review across wallets, purchases, memberships, and maintenance records." action={loadAudit} message={message} />

        <section className="grid gap-4 py-5 md:grid-cols-2 xl:grid-cols-5">
          <Metric title="Wallet Balance" value={peso(totalWalletBalance)} />
          <Metric title="Wallet Tx Total" value={peso(totalWalletTx)} />
          <Metric title="Purchases" value={peso(purchaseVolume)} />
          <Metric title="Memberships" value={peso(membershipVolume)} />
          <Metric title="Maintenance" value={peso(maintenanceVolume)} />
        </section>

        <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-950">Financial Audit Ledger</h2>
              <p className="mt-1 text-sm text-slate-600">Searchable audit trail for finance review.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search ledger" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-emerald-400" />
              <select value={kind} onChange={(event) => setKind(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-emerald-400">
                <option value="ALL">All</option>
                <option value="WALLET">Wallet</option>
                <option value="PURCHASE">Purchase</option>
                <option value="MEMBERSHIP">Membership</option>
                <option value="MAINTENANCE">Maintenance</option>
              </select>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
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
                  <tr><td colSpan={7} className="py-10 text-sm font-bold text-slate-500">No audit rows found.</td></tr>
                ) : auditRows.map((item) => {
                  const profile = findProfile(item.row.profile_id, profiles);
                  return (
                    <tr key={`${item.kind}-${item.row.id}`} className="border-b border-slate-100 align-top">
                      <td className="py-4 text-sm text-slate-600">{formatDate(item.row.created_at)}</td>
                      <td className="py-4 text-sm font-black text-emerald-700">{item.kind}</td>
                      <td className="py-4 text-sm font-black text-slate-950">{profileName(profile)}</td>
                      <td className="py-4 text-sm text-slate-600">{profile?.email || "-"}</td>
                      <td className="py-4 text-sm text-slate-600">{item.label || "-"}</td>
                      <td className="py-4 text-sm font-black text-emerald-700">{peso(item.amount)}</td>
                      <td className="py-4"><span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(item.row.status)}`}>{item.row.status || "LOGGED"}</span></td>
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

function Hero({ title, subtitle, action, message }: { title: string; subtitle: string; action: () => void; message: string }) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/20 p-6 shadow-sm lg:p-8">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/forest-bg.jpg')" }} />
      <div className="absolute inset-0 bg-gradient-to-r from-green-950/90 via-green-900/66 to-green-950/18" />
      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.32em] text-white/75">SUR Aloeswood Admin</p>
          <h1 className="mt-4 text-4xl font-black text-white lg:text-6xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/78 lg:text-base">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={action} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm hover:bg-white/90">Refresh</button>
          <Link href="/admin/dashboard" className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur hover:bg-white/20">Dashboard</Link>
        </div>
      </div>
      {message && <div className="relative z-10 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">{message}</div>}
    </section>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-emerald-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-3 truncate text-2xl font-black text-emerald-800">{value}</p>
    </div>
  );
}
