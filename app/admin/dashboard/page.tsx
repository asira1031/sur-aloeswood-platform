"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import LogoutButton from "@/app/components/LogoutButton";
import {
  adminLinks,
  byDateDesc,
  formatDate,
  peso,
  statusClass,
  type AnyRow,
} from "@/app/lib/dashboard/nav";

const cardStyles = [
  "border-emerald-100 bg-white",
  "border-amber-100 bg-amber-50/75",
  "border-teal-100 bg-teal-50/75",
  "border-slate-200 bg-slate-50",
  "border-lime-100 bg-lime-50/75",
  "border-yellow-100 bg-yellow-50/75",
];

export default function AdminDashboardPage() {
  const [profiles, setProfiles] = useState<AnyRow[]>([]);
  const [purchases, setPurchases] = useState<AnyRow[]>([]);
  const [trees, setTrees] = useState<AnyRow[]>([]);
  const [cashins, setCashins] = useState<AnyRow[]>([]);
  const [tickets, setTickets] = useState<AnyRow[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setMessage("");

    const [
      { data: profileRows },
      { data: purchaseRows },
      { data: treeRows },
      { data: cashinRows },
      { data: ticketRows, error },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, role, account_status, kyc_status, membership_status, created_at")
        .limit(1000),
      supabase
        .from("seedling_purchases")
        .select("id, profile_id, quantity, amount, status, payment_reference, created_at, approved_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("tree_registry")
        .select("id, profile_id, purchase_id, tree_code, status, denr_tag_number, gps_lat, gps_lng, planted_at, created_at")
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("cashin_requests")
        .select("id, profile_id, amount, reference_no, status, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("support_tickets")
        .select("id, profile_id, subject, message, status, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    setLoading(false);

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
  const totalCashin = cashins
    .filter((c) => String(c.status || "").toUpperCase() === "APPROVED")
    .reduce((sum, cashin) => sum + Number(cashin.amount || 0), 0);

  const latestActivity = useMemo(
    () =>
      [
        ...purchases.map((row) => ({
          kind: "Purchase",
          title: `${row.quantity || 1} package(s)`,
          status: row.status,
          created_at: row.created_at,
          href: "/admin/purchases",
        })),
        ...cashins.map((row) => ({
          kind: "Cash-In",
          title: peso(row.amount),
          status: row.status,
          created_at: row.created_at,
          href: "/admin/treasury",
        })),
        ...tickets.map((row) => ({
          kind: "Support",
          title: row.subject,
          status: row.status,
          created_at: row.created_at,
          href: "/admin/support",
        })),
        ...trees.map((row) => ({
          kind: "Tree",
          title: row.tree_code || "Pending AG",
          status: row.status,
          created_at: row.created_at,
          href: "/admin/tree-registry",
        })),
      ]
        .sort(byDateDesc)
        .slice(0, 10),
    [purchases, cashins, tickets, trees]
  );

  return (
    <main className="min-h-screen bg-[#f3f7f1] text-slate-950">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-4 lg:px-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/20 p-6 shadow-sm lg:p-8">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/forest-bg.jpg')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-green-950/90 via-green-900/66 to-green-950/18" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-white/75">
                SUR Aloeswood Admin
              </p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-white lg:text-6xl">
                Command Dashboard
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78 lg:text-base">
                Review approvals, treasury movement, AG tree records, support queues, and operations activity.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={loadDashboard}
                disabled={loading}
                className="w-fit rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm hover:bg-white/90 disabled:opacity-60"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
              <LogoutButton className="w-fit rounded-2xl border border-red-300/25 bg-red-500/15 px-5 py-3 text-sm font-black text-white backdrop-blur hover:bg-red-500/25 disabled:opacity-60" />
            </div>
          </div>

          <div className="relative z-10 mt-8 grid gap-3 md:grid-cols-3">
            <HeroStat label="Co-Planters" value={String(profiles.length)} />
            <HeroStat label="Pending Reviews" value={String(pendingAccounts + pendingKyc)} />
            <HeroStat label="Approved Cash-In" value={peso(totalCashin)} />
          </div>

          {message && (
            <div className="relative z-10 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
              {message}
            </div>
          )}
        </section>

        <section className="grid gap-4 py-5 md:grid-cols-2 xl:grid-cols-6">
          <Metric tone="white" title="Co-Planters" value={String(profiles.length)} detail="Total account records" />
          <Metric tone="forest" title="Pending Accounts" value={String(pendingAccounts)} detail="Need activation review" />
          <Metric tone="gold" title="Pending KYC" value={String(pendingKyc)} detail="Identity checks" />
          <Metric tone="mist" title="Pending Purchases" value={String(pendingPurchases)} detail="Payment approvals" />
          <Metric tone="forest" title="Pending Cash-In" value={String(pendingCashins)} detail="Treasury queue" />
          <Metric tone="gold" title="Open Support" value={String(openTickets)} detail="Customer tickets" />
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div>
            <h2 className="text-2xl font-black text-slate-950">Admin Modules</h2>
            <p className="mt-1 text-sm text-slate-600">Operational workspaces for approvals, treasury, compliance, and plantation records.</p>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {adminLinks.map((link, index) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`group rounded-[1.6rem] border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${cardStyles[index % cardStyles.length]}`}
                >
                  <div className="h-1.5 w-14 rounded-full bg-emerald-600" />
                  <div className="mt-5 flex items-start justify-between gap-4">
                    <p className="text-lg font-black text-slate-950">{link.title}</p>
                    <span className="rounded-full px-3 py-1 text-sm font-black text-emerald-700">›</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{link.desc}</p>
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
              <h2 className="text-2xl font-black text-slate-950">Priority Queue</h2>
              <p className="mt-1 text-sm text-slate-600">Items that need admin attention first.</p>
              <div className="mt-5 grid gap-3">
                <Queue href="/admin/coplanters" label="Account Approval" value={pendingAccounts} />
                <Queue href="/admin/coplanters" label="KYC Review" value={pendingKyc} />
                <Queue href="/admin/purchases" label="Package Purchases" value={pendingPurchases} />
                <Queue href="/admin/treasury" label="Cash-In Requests" value={pendingCashins} />
                <Queue href="/admin/support" label="Open Support Tickets" value={openTickets} />
              </div>
            </section>

            <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
              <h2 className="text-2xl font-black text-slate-950">Latest Activity</h2>
              <div className="mt-5 space-y-3">
                {latestActivity.map((item, index) => (
                  <Link key={`${item.kind}-${index}`} href={item.href} className="block rounded-2xl border border-emerald-100 bg-emerald-50/65 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-950">
                          {item.kind}: {item.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{formatDate(item.created_at)}</p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(item.status)}`}>
                        {item.status || "LOGGED"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </div>
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

function Metric({
  tone,
  title,
  value,
  detail,
}: {
  tone: "gold" | "forest" | "white" | "mist";
  title: string;
  value: string;
  detail: string;
}) {
  const styles = {
    gold: "border-amber-100 bg-gradient-to-br from-white via-amber-50 to-yellow-50 text-amber-900",
    forest: "border-emerald-100 bg-gradient-to-br from-white via-emerald-50 to-green-50 text-emerald-900",
    white: "border-slate-200 bg-white text-slate-950",
    mist: "border-teal-100 bg-gradient-to-br from-white via-teal-50 to-emerald-50 text-teal-900",
  }[tone];

  return (
    <div className={`rounded-[1.5rem] border p-5 shadow-sm ${styles}`}>
      <p className="text-xs font-black uppercase tracking-wide opacity-65">{title}</p>
      <p className="mt-3 truncate text-3xl font-black">{value}</p>
      <p className="mt-2 text-sm opacity-70">{detail}</p>
    </div>
  );
}

function Queue({ href, label, value }: { href: string; label: string; value: number }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
      <span className="font-black text-slate-950">{label}</span>
      <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-amber-950">{value}</span>
    </Link>
  );
}
