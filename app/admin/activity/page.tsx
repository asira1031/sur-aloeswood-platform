"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { findProfile, formatDate, peso, profileName, statusClass, type AnyRow } from "@/app/lib/admin/activity";

const categories = [
  { key: "ALL", title: "All Activity", detail: "Everything" },
  { key: "SUPPORT", title: "Support", detail: "Tickets and replies" },
  { key: "WALLET", title: "Wallet TX", detail: "Ledger movement" },
  { key: "PURCHASE", title: "Purchases", detail: "Seedling requests" },
  { key: "CASHIN", title: "Cash-In", detail: "Treasury requests" },
  { key: "NOTICE", title: "Notices", detail: "System alerts" },
];

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
      ...tickets.map((row) => ({ kind: "SUPPORT", title: row.subject, amount: null, row, href: "/admin/support" })),
      ...transactions.map((row) => ({ kind: "WALLET", title: row.transaction_type, amount: row.amount, row, href: "/admin/audit" })),
      ...purchases.map((row) => ({ kind: "PURCHASE", title: `${row.quantity || 1} seedling purchase`, amount: row.amount, row, href: "/admin/purchases" })),
      ...cashins.map((row) => ({ kind: "CASHIN", title: row.reference_no || "Cash-in request", amount: row.amount, row, href: "/admin/treasury" })),
      ...notifications.map((row) => ({ kind: "NOTICE", title: row.title || "Notification", amount: null, row, href: "/admin/notifications" })),
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

  function countFor(key: string) {
    if (key === "ALL") return activityRows.length;
    return activityRows.filter((row) => row.kind === key).length;
  }

  const selectedCategory = categories.find((category) => category.key === kind) || categories[0];

  return (
    <main className="min-h-screen bg-[#f3f7f1] text-slate-950">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-4 lg:px-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/20 p-6 shadow-sm lg:p-8">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/forest-bg.jpg')" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-green-950/90 via-green-900/66 to-green-950/18" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-white/75">SUR Aloeswood Admin</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-white lg:text-6xl">
                Activity Center
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78 lg:text-base">
                Categorized operational history for support, wallet, purchase, cash-in, and system notices.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button onClick={loadActivity} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm hover:bg-white/90">
                Refresh
              </button>
              <Link href="/admin/dashboard" className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur hover:bg-white/20">
                Dashboard
              </Link>
            </div>
          </div>

          <div className="relative z-10 mt-8 grid gap-3 md:grid-cols-3">
            <HeroStat label="Total Activity" value={String(activityRows.length)} />
            <HeroStat label="Selected View" value={selectedCategory.title} />
            <HeroStat label="Visible Items" value={String(filtered.length)} />
          </div>

          {message && (
            <div className="relative z-10 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
              {message}
            </div>
          )}
        </section>

        <section className="grid gap-5 py-5 lg:grid-cols-[0.36fr_1fr]">
          <aside className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
            <h2 className="text-2xl font-black text-slate-950">Categories</h2>
            <p className="mt-1 text-sm text-slate-600">Filter activity by workspace.</p>

            <div className="mt-5 grid gap-3">
              {categories.map((category) => (
                <button
                  key={category.key}
                  onClick={() => setKind(category.key)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    kind === category.key
                      ? "border-emerald-400 bg-emerald-50 shadow-sm"
                      : "border-slate-200 bg-slate-50 hover:border-emerald-200 hover:bg-emerald-50/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-950">{category.title}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{category.detail}</p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">
                      {countFor(category.key)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-950">{selectedCategory.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{selectedCategory.detail}</p>
              </div>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search activity"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
              />
            </div>

            <div className="mt-5 space-y-3">
              {filtered.length === 0 ? (
                <Empty text="No activity found." />
              ) : (
                filtered.slice(0, 200).map((item) => {
                  const profile = findProfile(item.row.profile_id, profiles);
                  const status = item.row.status || (item.row.is_read === undefined ? "LOGGED" : item.row.is_read ? "READ" : "UNREAD");
                  return (
                    <Link key={`${item.kind}-${item.row.id}`} href={item.href} className="block rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:border-emerald-200 hover:bg-emerald-50/60">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-black text-slate-950">{item.title}</p>
                          <p className="mt-1 text-sm font-bold text-slate-600">
                            {item.kind} - {profileName(profile)} - {profile?.email || "-"}
                          </p>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(status)}`}>
                          {status}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{item.row.description || item.row.message || item.row.payment_reference || item.row.reference_no || "-"}</p>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{formatDate(item.row.created_at)}</p>
                        {item.amount !== null && <p className="text-sm font-black text-emerald-700">{peso(item.amount)}</p>}
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/16 p-4 backdrop-blur">
      <p className="text-xs font-black uppercase tracking-wide text-white/65">{label}</p>
      <p className="mt-2 truncate text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">
      {text}
    </div>
  );
}
