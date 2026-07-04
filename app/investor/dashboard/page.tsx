"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";

type AnyRow = Record<string, any>;

const SEEDLING_PRICE = 14000;

const money = (amount?: number | null) =>
  `₱${Number(amount || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value?: string | null) => {
  if (!value) return "Pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

function statusClass(status?: string | null) {
  const value = String(status || "").toUpperCase();
  if (["ACTIVE", "APPROVED", "REGISTERED", "HEALTHY", "GROWING", "PAID"].includes(value)) {
    return "bg-green-400/15 text-green-100 ring-green-300/30";
  }
  if (["PENDING", "PROCESSING", "ASSIGNED", "FOR_REVIEW"].includes(value)) {
    return "bg-yellow-400/15 text-yellow-100 ring-yellow-300/30";
  }
  if (["REJECTED", "FAILED", "SICK", "DAMAGED", "CANCELLED"].includes(value)) {
    return "bg-red-400/15 text-red-100 ring-red-300/30";
  }
  return "bg-white/10 text-white/75 ring-white/10";
}

export default function InvestorDashboardPage() {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<AnyRow | null>(null);
  const [wallet, setWallet] = useState<AnyRow | null>(null);
  const [trees, setTrees] = useState<AnyRow[]>([]);
  const [growthLogs, setGrowthLogs] = useState<AnyRow[]>([]);
  const [transactions, setTransactions] = useState<AnyRow[]>([]);
  const [purchases, setPurchases] = useState<AnyRow[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const totalTreeValue = useMemo(() => trees.length * SEEDLING_PRICE, [trees.length]);
  const pendingPurchases = purchases.filter((p) => String(p.status || "").toUpperCase() === "PENDING").length;
  const approvedPurchases = purchases.filter((p) => String(p.status || "").toUpperCase() === "APPROVED").length;

  useEffect(() => {
    const savedEmail = localStorage.getItem("sur_login_email") || "";
    setEmail(savedEmail);
    if (savedEmail) loadDashboard(savedEmail);
  }, []);

  async function loadDashboard(targetEmail = email) {
    setLoading(true);
    setMessage("");

    const cleanEmail = targetEmail.toLowerCase().trim();

    if (!cleanEmail) {
      setMessage("Enter your registered email first.");
      setLoading(false);
      return;
    }

    const { data: foundProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, referral_code, kyc_status, account_status, membership_status, wallet_balance, role")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (profileError || !foundProfile) {
      setProfile(null);
      setMessage(profileError?.message || "Profile not found.");
      setLoading(false);
      return;
    }

    const [{ data: walletData }, { data: treeData }, { data: purchaseData }, { data: txData }] = await Promise.all([
      supabase.from("wallets").select("id, profile_id, balance, updated_at").eq("profile_id", foundProfile.id).maybeSingle(),
      supabase
        .from("tree_registry")
        .select("id, profile_id, purchase_id, tree_code, denr_tag_number, species, status, gps_lat, gps_lng, planted_at, created_at")
        .eq("profile_id", foundProfile.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("seedling_purchases")
        .select("id, profile_id, quantity, amount, status, payment_reference, created_at, approved_at")
        .eq("profile_id", foundProfile.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("wallet_transactions")
        .select("id, profile_id, transaction_type, amount, description, status, created_at")
        .eq("profile_id", foundProfile.id)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

    const treeIds = (treeData || []).map((tree: AnyRow) => tree.id);

    let logs: AnyRow[] = [];
    if (treeIds.length > 0) {
      const { data: logData } = await supabase
        .from("tree_growth_logs")
        .select("id, tree_id, height_cm, diameter_cm, health_status, remarks, photo_url, created_at")
        .in("tree_id", treeIds)
        .order("created_at", { ascending: false });
      logs = (logData || []) as AnyRow[];
    }

    setProfile(foundProfile);
    setWallet(walletData || null);
    setTrees((treeData || []) as AnyRow[]);
    setPurchases((purchaseData || []) as AnyRow[]);
    setTransactions((txData || []) as AnyRow[]);
    setGrowthLogs(logs);
    localStorage.setItem("sur_login_email", cleanEmail);
    localStorage.setItem("sur_profile_id", foundProfile.id);
    setLoading(false);
  }

  function latestLog(treeId: string) {
    return growthLogs.find((log) => log.tree_id === treeId) || null;
  }

  const referralLink =
    typeof window !== "undefined" && profile?.referral_code
      ? `${window.location.origin}/register?ref=${profile.referral_code}`
      : "";

  return (
    <main className="min-h-screen bg-[#06170f] text-white">
      <section className="border-b border-white/10 bg-gradient-to-r from-green-950 via-emerald-950 to-slate-950 px-6 py-8 lg:px-14">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-green-300">SUR Aloeswood Co-Planter Portal</p>
            <h1 className="mt-3 text-4xl font-black lg:text-6xl">My Plantation Dashboard</h1>
            <p className="mt-3 max-w-3xl text-green-100/80">
              Monitor wallet, AG tree codes, DENR tags, GPS location, growth updates, certificates, and plantation progress.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/investor/marketplace" className="rounded-2xl bg-green-500 px-6 py-4 text-center font-black text-green-950">
              Buy Seedlings
            </Link>
            <Link href="/tree" className="rounded-2xl bg-white/10 px-6 py-4 text-center font-black text-white ring-1 ring-white/20">
              My Trees
            </Link>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur lg:flex-row">
          <input
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              localStorage.setItem("sur_login_email", e.target.value);
            }}
            placeholder="Enter registered email to load dashboard"
            className="min-h-14 flex-1 rounded-2xl border border-white/10 bg-white px-5 font-semibold text-slate-900 outline-none"
          />
          <button
            onClick={() => loadDashboard()}
            disabled={loading}
            className="rounded-2xl bg-green-500 px-8 py-4 font-black text-green-950 hover:bg-green-400 disabled:bg-slate-500"
          >
            {loading ? "Loading..." : "Load Dashboard"}
          </button>
        </div>

        {message && <div className="mt-4 rounded-2xl bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
      </section>

      <section className="px-6 py-8 lg:px-14">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <Card title="Wallet Balance" value={money(wallet?.balance ?? profile?.wallet_balance)} />
          <Card title="Registered AG Trees" value={String(trees.length)} />
          <Card title="Estimated Tree Value" value={money(totalTreeValue)} />
          <Card title="Pending Purchases" value={String(pendingPurchases)} />
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">My AG Trees</h2>
                <p className="mt-1 text-sm text-green-100/70">AG codes appear here after admin approval.</p>
              </div>
              <span className="rounded-full bg-green-400/15 px-4 py-2 text-sm font-black text-green-200">{trees.length} Trees</span>
            </div>

            <div className="mt-6 grid gap-4">
              {trees.length === 0 ? (
                <Empty text="No tree registry yet. Once your purchase is approved, AG codes will appear here automatically." />
              ) : (
                trees.map((tree) => {
                  const log = latestLog(tree.id);
                  return (
                    <div key={tree.id} className="overflow-hidden rounded-3xl border border-white/10 bg-black/20">
                      {log?.photo_url && (
                        <div className="h-52 bg-black/30">
                          <img src={log.photo_url} alt="Latest tree update" className="h-full w-full object-cover" />
                        </div>
                      )}

                      <div className="p-5">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.25em] text-green-300">AG Tree Code</p>
                            <p className="mt-1 text-3xl font-black text-yellow-300">{tree.tree_code || "Pending AG Code"}</p>
                            <p className="mt-1 text-sm text-white/70">{tree.species || "Aquilaria Malaccensis"}</p>
                          </div>

                          <span className={`rounded-full px-4 py-2 text-sm font-black ring-1 ${statusClass(tree.status)}`}>
                            {tree.status || "REGISTERED"}
                          </span>
                        </div>

                        <div className="mt-5 grid gap-3 text-sm text-white/75 md:grid-cols-3">
                          <Info label="DENR Tag" value={tree.denr_tag_number || "Pending"} />
                          <Info label="GPS" value={tree.gps_lat && tree.gps_lng ? `${tree.gps_lat}, ${tree.gps_lng}` : "Pending"} />
                          <Info label="Planted Date" value={formatDate(tree.planted_at)} />
                        </div>

                        <div className="mt-4 rounded-2xl bg-black/30 p-4">
                          <p className="text-xs font-bold uppercase tracking-wide text-green-300">Latest Growth Update</p>
                          <p className="mt-2 text-sm text-white/80">{log?.remarks || "No growth update yet."}</p>
                          <div className="mt-3 grid gap-2 text-xs font-bold text-white/55 md:grid-cols-3">
                            <span>Height: {log?.height_cm || "-"} cm</span>
                            <span>Diameter: {log?.diameter_cm || "-"} cm</span>
                            <span>Health: {log?.health_status || "-"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6">
              <h2 className="text-2xl font-black">Co-Planter Profile</h2>
              <div className="mt-5 space-y-3 text-sm">
                <Info label="Name" value={profile?.full_name || "Not loaded"} />
                <Info label="Email" value={profile?.email || "Not loaded"} />
                <Info label="KYC" value={profile?.kyc_status || "Pending"} />
                <Info label="Account" value={profile?.account_status || "Pending"} />
                <Info label="Membership" value={profile?.membership_status || "Pending"} />
                <Info label="Referral Code" value={profile?.referral_code || "Pending"} />
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6">
              <h2 className="text-2xl font-black">Referral Link</h2>
              <p className="mt-2 text-sm text-white/70">Share this after your account is approved.</p>
              <div className="mt-4 break-all rounded-2xl bg-black/30 p-4 text-sm text-green-200">
                {referralLink || "Load your profile first."}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6">
              <h2 className="text-2xl font-black">Purchase Summary</h2>
              <div className="mt-5 space-y-3 text-sm">
                <Info label="Approved Purchases" value={String(approvedPurchases)} />
                <Info label="Pending Purchases" value={String(pendingPurchases)} />
                <Info label="Seedling Price" value={money(SEEDLING_PRICE)} />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.06] p-6">
          <h2 className="text-2xl font-black">Wallet Transactions</h2>
          <div className="mt-5 grid gap-3">
            {transactions.length === 0 ? (
              <Empty text="No wallet transactions yet." />
            ) : (
              transactions.map((tx) => (
                <div key={tx.id} className="flex flex-col justify-between gap-3 rounded-2xl bg-black/20 px-5 py-4 md:flex-row md:items-center">
                  <div>
                    <p className="font-black">{tx.transaction_type}</p>
                    <p className="text-sm text-white/60">{tx.description || "No description"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-green-300">{money(tx.amount)}</p>
                    <p className="text-xs text-white/50">{tx.status}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <p className="mt-8 text-xs leading-relaxed text-green-200/70">
          Disclaimer: No guaranteed returns. Actual harvest depends on plantation performance, market conditions, inoculation schedule, and applicable laws.
        </p>
      </section>
    </main>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-xl">
      <p className="text-sm font-bold text-green-200/80">{title}</p>
      <p className="mt-3 text-3xl font-black">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-black/20 px-4 py-3">
      <span className="text-white/50">{label}</span>
      <span className="text-right font-bold text-white">{value}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/15 bg-black/20 p-8 text-center text-sm font-semibold text-white/60">
      {text}
    </div>
  );
}
