"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { findProfile, formatDate, peso, profileName, statusClass, type AnyRow } from "@/app/lib/admin/activity";

export default function AdminActivityPage() {
  const [profiles, setProfiles] = useState<AnyRow[]>([]);
  const [tickets, setTickets] = useState<AnyRow[]>([]);
  const [transactions, setTransactions] = useState<AnyRow[]>([]);
  const [purchases, setPurchases] = useState<AnyRow[]>([]);
  const [cashins, setCashins] = useState<AnyRow[]>([]);
  const [notifications, setNotifications] = useState<AnyRow[]>([]);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("ALL");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadActivity();
  }, []);

  async function loadActivity() {
    setMessage("");

    const [
      { data: profileRows, error },
      { data: ticketRows },
      { data: txRows },
      { data: purchaseRows },
      { data: cashinRows },
      { data: noticeRows },
    ] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, role, account_status").limit(1000),
      supabase.from("support_tickets").select("id, profile_id, subject, message, status, created_at").order("created_at", { ascending: false }).limit(300),
      supabase.from("wallet_transactions").select("id, profile_id, transaction_type, amount, description, status, created_at").order("created_at", { ascending: false }).limit(300),
      supabase.from("seedling_purchases").select("id, profile_id, quantity, amount, status, payment_reference, created_at, approved_at").order("created_at", { ascending: false }).limit(300),
      supabase.from("cashin_requests").select("id, profile_id, amount, reference_no, description, status, created_at").order("created_at", { ascending: false }).limit(300),
      supabase.from("notifications").select("id, profile_id, title, message, is_read, created_at").order("created_at", { ascending: false }).limit(300),
    ]);

    if (error) {
      setMessage(error.message);
      return;
    }

    setProfiles((profileRows || []) as AnyRow[]);
    setTickets((ticketRows || []) as AnyRow[]);
    setTransactions((txRows || []) as AnyRow[]);
    setPurchases((purchaseRows || []) as AnyRow[]);
    setCashins((cashinRows || []) as AnyRow[]);
    setNotifications((noticeRows || []) as AnyRow[]);
  }

  const activityRows = useMemo(() => {
    return [
      ...tickets.map((row) => ({ kind: "SUPPORT", title: row.subject, amount: null, row })),
      ...transactions.map((row) => ({ kind: "WALLET", title: row.transaction_type, amount: row.amount, row })),
      ...purchases.map((row) => ({ kind: "PURCHASE", title: `${row.quantity || 1} seedling purchase`, amount: row.amount, row })),
      ...cashins.map((row) => ({ kind: "CASHIN", title: row.reference_no || "Cash-in request", amount: row.amount, row })),
      ...notifications.map((row) => ({ kind: "NOTICE", title: row.title || "Notification", amount: null, row })),
    ].sort((a, b) => new Date(b.row.created_at || 0).getTime() - new Date(a.row.created_at || 0).getTime());
  }, [tickets, transactions, purchases, cashins, notifications]);

  const filtered = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return activityRows.filter((item) => {
      const profile = findProfile(item.row.profile_id, profiles);
      const kindOk = kind === "ALL" || item.kind === kind;
      const text = `${item.kind} ${JSON.stringify(item.row)} ${profile?.full_name || ""} ${profile?.email || ""}`.toLowerCase();
      return kindOk && (!keyword || text.includes(keyword));
    });
  }, [activityRows, profiles, search, kind]);

  return (
    <main className="min-h-screen bg-[#04140d] text-white">
      <section className="border-b border-white/10 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-green-300">SUR ALOESWOOD ADMIN</p>
              <h1 className="mt-4 text-4xl font-black md:text-6xl">Activity Center</h1>
            </div>
            <button onClick={loadActivity} className="rounded-2xl bg-green-500 px-5 py-3 text-sm font-black text-green-950">Refresh</button>
          </div>
          {message && <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-8 md:grid-cols-5 md:px-10">
        <Metric title="Support" value={String(tickets.length)} />
        <Metric title="Wallet TX" value={String(transactions.length)} />
        <Metric title="Purchases" value={String(purchases.length)} />
        <Metric title="Cash-In" value={String(cashins.length)} />
        <Metric title="Notices" value={String(notifications.length)} />
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16 md:px-10">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-3xl font-black">Activity Feed</h2>
            <div className="flex flex-wrap gap-3">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none" />
              <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none">
                <option value="ALL">All</option>
                <option value="SUPPORT">Support</option>
                <option value="WALLET">Wallet</option>
                <option value="PURCHASE">Purchase</option>
                <option value="CASHIN">Cash-In</option>
                <option value="NOTICE">Notice</option>
              </select>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/25 p-6 text-sm font-bold text-white/60">No activity found.</div>
            ) : filtered.slice(0, 200).map((item) => {
              const profile = findProfile(item.row.profile_id, profiles);
              return (
                <div key={`${item.kind}-${item.row.id}`} className="rounded-2xl border border-white/10 bg-black/25 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black text-green-200">{item.title}</p>
                      <p className="mt-1 text-sm text-white/60">{item.kind} • {profileName(profile)} • {profile?.email || "-"}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(item.row.status || (item.row.is_read ? "READ" : "UNREAD"))}`}>
                      {item.row.status || (item.row.is_read === undefined ? "LOGGED" : item.row.is_read ? "READ" : "UNREAD")}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-white/70">{item.row.description || item.row.message || item.row.payment_reference || item.row.reference_no || "-"}</p>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs font-bold text-white/50">{formatDate(item.row.created_at)}</p>
                    {item.amount !== null && <p className="text-sm font-black text-green-300">{peso(item.amount)}</p>}
                  </div>
                </div>
              );
            })}
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
