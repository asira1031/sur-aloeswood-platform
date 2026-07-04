"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { adminLinks, byDateDesc, formatDate, peso, statusClass, type AnyRow } from "@/app/lib/dashboard/nav";

export default function AdminDashboardPage() {
  const [profiles, setProfiles] = useState<AnyRow[]>([]);
  const [purchases, setPurchases] = useState<AnyRow[]>([]);
  const [trees, setTrees] = useState<AnyRow[]>([]);
  const [cashins, setCashins] = useState<AnyRow[]>([]);
  const [tickets, setTickets] = useState<AnyRow[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setMessage("");

    const [
      { data: profileRows },
      { data: purchaseRows },
      { data: treeRows },
      { data: cashinRows },
      { data: ticketRows, error },
    ] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, role, account_status, kyc_status, membership_status, created_at").limit(1000),
      supabase.from("seedling_purchases").select("id, profile_id, quantity, amount, status, payment_reference, created_at, approved_at").order("created_at", { ascending: false }).limit(200),
      supabase.from("tree_registry").select("id, profile_id, purchase_id, tree_code, status, denr_tag_number, gps_lat, gps_lng, planted_at, created_at").order("created_at", { ascending: false }).limit(300),
      supabase.from("cashin_requests").select("id, profile_id, amount, reference_no, status, created_at").order("created_at", { ascending: false }).limit(200),
      supabase.from("support_tickets").select("id, profile_id, subject, message, status, created_at").order("created_at", { ascending: false }).limit(200),
    ]);

    if (error) {
      setMessage(error.message);
      return;
    }

    setProfiles((profileRows || []) as AnyRow[]);
    setPurchases((purchaseRows || []) as AnyRow[]);
    setTrees((treeRows || []) as AnyRow[]);
    setCashins((cashinRows || []) as AnyRow[]);
    setTickets((ticketRows || []) as AnyRow[]);
  }

  const pendingAccounts = profiles.filter((p) => String(p.account_status || "").toUpperCase() === "PENDING").length;
  const pendingKyc = profiles.filter((p) => String(p.kyc_status || "").toUpperCase() === "PENDING").length;
  const pendingPurchases = purchases.filter((p) => String(p.status || "").toUpperCase() === "PENDING").length;
  const pendingCashins = cashins.filter((c) => String(c.status || "").toUpperCase() === "PENDING").length;
  const openTickets = tickets.filter((t) => String(t.status || "").toUpperCase() === "OPEN").length;
  const totalCashin = cashins.filter((c) => String(c.status || "").toUpperCase() === "APPROVED").reduce((s, c) => s + Number(c.amount || 0), 0);

  const latestActivity = useMemo(() => [
    ...purchases.map((r) => ({ kind: "Purchase", title: `${r.quantity || 1} seedling(s)`, status: r.status, created_at: r.created_at, href: "/admin/purchases" })),
    ...cashins.map((r) => ({ kind: "Cash-In", title: peso(r.amount), status: r.status, created_at: r.created_at, href: "/admin/treasury" })),
    ...tickets.map((r) => ({ kind: "Support", title: r.subject, status: r.status, created_at: r.created_at, href: "/admin/support" })),
    ...trees.map((r) => ({ kind: "Tree", title: r.tree_code || "Pending AG", status: r.status, created_at: r.created_at, href: "/admin/tree-registry" })),
  ].sort(byDateDesc).slice(0, 10), [purchases, cashins, tickets, trees]);

  return (
    <main className="min-h-screen bg-[#04140d] text-white">
      <section className="border-b border-white/10 bg-gradient-to-r from-green-950 via-emerald-950 to-slate-950 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-green-300">SUR ALOESWOOD ADMIN</p>
              <h1 className="mt-4 text-4xl font-black md:text-6xl">Command Dashboard</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-green-50/80">Open every admin module from here.</p>
            </div>
            <button onClick={loadDashboard} className="rounded-2xl bg-green-500 px-5 py-3 text-sm font-black text-green-950">Refresh</button>
          </div>
          {message && <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-8 md:grid-cols-2 xl:grid-cols-6 md:px-10">
        <Metric title="Co-Planters" value={String(profiles.length)} />
        <Metric title="Pending Accounts" value={String(pendingAccounts)} />
        <Metric title="Pending KYC" value={String(pendingKyc)} />
        <Metric title="Pending Purchases" value={String(pendingPurchases)} />
        <Metric title="Pending Cash-In" value={String(pendingCashins)} />
        <Metric title="Approved Cash-In" value={peso(totalCashin)} />
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-16 md:px-10 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Admin Modules</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {adminLinks.map((link) => (
              <Link key={link.href} href={link.href} className="rounded-2xl border border-white/10 bg-black/25 p-5 transition hover:border-green-300/50 hover:bg-green-400/10">
                <p className="text-lg font-black text-green-200">{link.title}</p>
                <p className="mt-2 text-sm leading-6 text-white/60">{link.desc}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
            <h2 className="text-3xl font-black">Priority Queue</h2>
            <div className="mt-5 grid gap-3">
              <Queue href="/admin/coplanters" label="Account Approval" value={pendingAccounts} />
              <Queue href="/admin/coplanters" label="KYC Review" value={pendingKyc} />
              <Queue href="/admin/purchases" label="Seedling Purchases" value={pendingPurchases} />
              <Queue href="/admin/treasury" label="Cash-In Requests" value={pendingCashins} />
              <Queue href="/admin/support" label="Open Support Tickets" value={openTickets} />
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
            <h2 className="text-3xl font-black">Latest Activity</h2>
            <div className="mt-5 space-y-3">
              {latestActivity.map((item, idx) => (
                <Link key={`${item.kind}-${idx}`} href={item.href} className="block rounded-2xl bg-black/25 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-green-200">{item.kind}: {item.title}</p>
                      <p className="mt-1 text-xs text-white/45">{formatDate(item.created_at)}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(item.status)}`}>{item.status || "LOGGED"}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl"><p className="text-xs font-black uppercase tracking-wide text-green-100/60">{title}</p><p className="mt-3 truncate text-xl font-black text-green-300">{value}</p></div>;
}

function Queue({ href, label, value }: { href: string; label: string; value: number }) {
  return <Link href={href} className="flex items-center justify-between rounded-2xl bg-black/25 p-4"><span className="font-black text-white">{label}</span><span className="rounded-full bg-yellow-400 px-3 py-1 text-xs font-black text-yellow-950">{value}</span></Link>;
}
