"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { investorLinks, formatDate, peso, statusClass, type AnyRow } from "@/app/lib/dashboard/nav";

const SEEDLING_PRICE = 14000;

export default function InvestorDashboardPage() {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<AnyRow | null>(null);
  const [wallet, setWallet] = useState<AnyRow | null>(null);
  const [trees, setTrees] = useState<AnyRow[]>([]);
  const [logs, setLogs] = useState<AnyRow[]>([]);
  const [purchases, setPurchases] = useState<AnyRow[]>([]);
  const [notifications, setNotifications] = useState<AnyRow[]>([]);
  const [tickets, setTickets] = useState<AnyRow[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sur_login_email") || "";
    setEmail(saved);
    if (saved) loadDashboard(saved);
  }, []);

  async function loadDashboard(targetEmail = email) {
    setLoading(true);
    setMessage("");
    const cleanEmail = targetEmail.toLowerCase().trim();

    const { data: profileRow, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, account_status, kyc_status, membership_status, wallet_balance, referral_code, created_at")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (error || !profileRow) {
      setMessage(error?.message || "Profile not found.");
      setProfile(null);
      setLoading(false);
      return;
    }

    const [{ data: walletRow }, { data: treeRows }, { data: purchaseRows }, { data: noticeRows }, { data: ticketRows }] = await Promise.all([
      supabase.from("wallets").select("id, profile_id, balance, updated_at").eq("profile_id", profileRow.id).maybeSingle(),
      supabase.from("tree_registry").select("id, profile_id, purchase_id, tree_code, denr_tag_number, species, status, gps_lat, gps_lng, planted_at, created_at").eq("profile_id", profileRow.id).order("created_at", { ascending: false }),
      supabase.from("seedling_purchases").select("id, profile_id, quantity, amount, status, payment_reference, created_at, approved_at").eq("profile_id", profileRow.id).order("created_at", { ascending: false }).limit(100),
      supabase.from("notifications").select("id, profile_id, title, message, is_read, created_at").eq("profile_id", profileRow.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("support_tickets").select("id, profile_id, subject, message, status, created_at").eq("profile_id", profileRow.id).order("created_at", { ascending: false }).limit(50),
    ]);

    const treeIds = (treeRows || []).map((tree: AnyRow) => tree.id);
    let logRows: AnyRow[] = [];
    if (treeIds.length > 0) {
      const { data } = await supabase.from("tree_growth_logs").select("id, tree_id, height_cm, diameter_cm, health_status, remarks, photo_url, created_at").in("tree_id", treeIds).order("created_at", { ascending: false });
      logRows = (data || []) as AnyRow[];
    }

    setProfile(profileRow);
    setWallet(walletRow || null);
    setTrees((treeRows || []) as AnyRow[]);
    setLogs(logRows);
    setPurchases((purchaseRows || []) as AnyRow[]);
    setNotifications((noticeRows || []) as AnyRow[]);
    setTickets((ticketRows || []) as AnyRow[]);
    localStorage.setItem("sur_login_email", cleanEmail);
    localStorage.setItem("sur_profile_id", profileRow.id);
    setLoading(false);
  }

  const pendingPurchases = purchases.filter((p) => String(p.status || "").toUpperCase() === "PENDING").length;
  const unread = notifications.filter((n) => !n.is_read).length;
  const openTickets = tickets.filter((t) => String(t.status || "").toUpperCase() === "OPEN").length;
  const portfolioValue = trees.length * SEEDLING_PRICE;
  const referralLink = typeof window !== "undefined" && profile?.referral_code ? `${window.location.origin}/register?ref=${profile.referral_code}` : "";

  return (
    <main className="min-h-screen bg-[#06170f] text-white">
      <section className="border-b border-white/10 bg-gradient-to-r from-green-950 via-emerald-950 to-slate-950 px-6 py-8 lg:px-14">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-green-300">SUR ALOESWOOD CO-PLANTER</p>
            <h1 className="mt-3 text-4xl font-black lg:text-6xl">Co-Planter Dashboard</h1>
            <p className="mt-3 max-w-3xl text-green-100/80">Open every co-planter feature from this dashboard.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/investor/marketplace" className="rounded-2xl bg-green-500 px-5 py-3 text-sm font-black text-green-950">Buy Seedlings</Link>
            <Link href="/investor/settings" className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black">Settings</Link>
          </div>
        </div>

        <div className="mt-8 grid gap-3 rounded-3xl border border-white/10 bg-white/10 p-4 md:grid-cols-[1fr_auto]">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Registered email" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
          <button onClick={() => loadDashboard()} disabled={loading} className="rounded-2xl bg-green-500 px-8 py-4 text-sm font-black text-green-950 disabled:bg-slate-500">{loading ? "Loading..." : "Load Dashboard"}</button>
        </div>
        {message && <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
      </section>

      <section className="grid gap-5 px-6 py-8 md:grid-cols-2 xl:grid-cols-6 lg:px-14">
        <Metric title="Wallet" value={peso(wallet?.balance ?? profile?.wallet_balance)} />
        <Metric title="AG Trees" value={String(trees.length)} />
        <Metric title="Portfolio" value={peso(portfolioValue)} />
        <Metric title="Pending Purchases" value={String(pendingPurchases)} />
        <Metric title="Unread" value={String(unread)} />
        <Metric title="Open Support" value={String(openTickets)} />
      </section>

      <section className="grid gap-6 px-6 pb-16 lg:grid-cols-[1.15fr_0.85fr] lg:px-14">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Open Features</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {investorLinks.map((link) => (
              <Link key={link.href} href={link.href} className="rounded-2xl border border-white/10 bg-black/25 p-5 transition hover:border-green-300/50 hover:bg-green-400/10">
                <p className="text-lg font-black text-green-200">{link.title}</p>
                <p className="mt-2 text-sm leading-6 text-white/60">{link.desc}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
            <h2 className="text-3xl font-black">Account</h2>
            <div className="mt-5 space-y-3">
              <Info label="Name" value={profile?.full_name || "Not loaded"} />
              <Info label="Email" value={profile?.email || "-"} />
              <Info label="Account" value={profile?.account_status || "PENDING"} />
              <Info label="KYC" value={profile?.kyc_status || "PENDING"} />
              <Info label="Membership" value={profile?.membership_status || "PENDING"} />
              <Info label="Referral" value={profile?.referral_code || "Pending"} />
            </div>
            <div className="mt-4 break-all rounded-2xl bg-black/25 p-4 text-xs font-bold text-green-200">{referralLink || "Referral link appears after profile load."}</div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
            <h2 className="text-3xl font-black">Recent AG Trees</h2>
            <div className="mt-5 space-y-3">
              {trees.slice(0, 5).map((tree) => (
                <Link key={tree.id} href="/investor/my-trees" className="block rounded-2xl bg-black/25 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-yellow-300">{tree.tree_code || "Pending AG Code"}</p>
                      <p className="mt-1 text-xs text-white/45">{tree.denr_tag_number || "DENR pending"} • {formatDate(tree.planted_at)}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(tree.status)}`}>{tree.status || "REGISTERED"}</span>
                  </div>
                </Link>
              ))}
              {trees.length === 0 && <Empty text="No AG trees yet." />}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
            <h2 className="text-3xl font-black">Latest Growth Updates</h2>
            <div className="mt-5 space-y-3">
              {logs.slice(0, 5).map((log) => (
                <div key={log.id} className="rounded-2xl bg-black/25 p-4">
                  <p className="font-black text-green-200">{log.health_status || "Growth Update"}</p>
                  <p className="mt-1 text-sm text-white/60">{log.remarks || "-"}</p>
                  <p className="mt-2 text-xs text-white/45">{formatDate(log.created_at)}</p>
                </div>
              ))}
              {logs.length === 0 && <Empty text="No growth updates yet." />}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5"><p className="text-xs font-black uppercase tracking-wide text-green-100/60">{title}</p><p className="mt-3 truncate text-xl font-black text-green-300">{value}</p></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 rounded-2xl bg-black/25 px-4 py-3"><span className="text-sm text-white/50">{label}</span><span className="text-right text-sm font-black text-white">{value}</span></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm font-bold text-white/60">{text}</div>;
}
