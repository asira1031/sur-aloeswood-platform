"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";

type Profile = {
  id: string;
  full_name: string | null;
  email: string;
  referral_code: string | null;
  kyc_status: string | null;
  account_status: string | null;
};

type Wallet = {
  balance: number | null;
  recovery_balance: number | null;
  harvest_balance: number | null;
};

type Tree = {
  id: string;
  tree_code: string;
  denr_tag_number: string | null;
  species: string | null;
  status: string | null;
  gps_lat: string | null;
  gps_lng: string | null;
  planted_at: string | null;
};

type Tx = {
  id: string;
  transaction_type: string;
  amount: number;
  status: string | null;
  description: string | null;
  created_at: string;
};

const money = (amount?: number | null) =>
  `₱${Number(amount || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function InvestorDashboardPage() {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [trees, setTrees] = useState<Tree[]>([]);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [message, setMessage] = useState("");

  const totalTreeValue = useMemo(() => trees.length * 14000, [trees.length]);

  const loadDashboard = async () => {
    setMessage("");

    if (!email) {
      setMessage("Enter your registered email first.");
      return;
    }

    const cleanEmail = email.toLowerCase().trim();

    const { data: foundProfile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (profileError || !foundProfile) {
      setMessage(profileError?.message || "Profile not found.");
      return;
    }

    setProfile(foundProfile);

    const { data: walletData } = await supabase
      .from("wallets")
      .select("*")
      .eq("profile_id", foundProfile.id)
      .maybeSingle();

    setWallet(walletData || null);

    const { data: treeData } = await supabase
      .from("tree_registry")
      .select("*")
      .eq("profile_id", foundProfile.id)
      .order("created_at", { ascending: false });

    setTrees(treeData || []);

    const { data: txData } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("profile_id", foundProfile.id)
      .order("created_at", { ascending: false })
      .limit(8);

    setTransactions(txData || []);
  };

  useEffect(() => {
    const savedEmail = localStorage.getItem("sur_login_email");
    if (savedEmail) setEmail(savedEmail);
  }, []);

  const referralLink =
    typeof window !== "undefined" && profile?.referral_code
      ? `${window.location.origin}/register?ref=${profile.referral_code}`
      : "";

  return (
    <main className="min-h-screen bg-[#06170f] text-white">
      <section className="border-b border-white/10 bg-gradient-to-r from-green-950 via-emerald-950 to-slate-950 px-8 py-8 lg:px-14">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-green-300">
              SUR Aloeswood Co-Planter Portal
            </p>
            <h1 className="mt-3 text-4xl font-black lg:text-6xl">
              My Plantation Dashboard
            </h1>
            <p className="mt-3 max-w-3xl text-green-100/80">
              Monitor wallet, tree ownership, DENR tags, recovery fund,
              maintenance, certificates, and plantation updates.
            </p>
          </div>

          <Link
            href="/login"
            className="rounded-2xl bg-white/10 px-6 py-4 text-center font-black text-white ring-1 ring-white/20 hover:bg-white/20"
          >
            Switch Account
          </Link>
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
            onClick={loadDashboard}
            className="rounded-2xl bg-green-500 px-8 py-4 font-black text-green-950 hover:bg-green-400"
          >
            Load Dashboard
          </button>
        </div>

        {message && (
          <div className="mt-4 rounded-2xl bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">
            {message}
          </div>
        )}
      </section>

      <section className="px-8 py-8 lg:px-14">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <Card title="Wallet Balance" value={money(wallet?.balance)} />
          <Card
            title="Recovery Fund"
            value={money(wallet?.recovery_balance)}
          />
          <Card title="Harvest Balance" value={money(wallet?.harvest_balance)} />
          <Card title="Estimated Tree Value" value={money(totalTreeValue)} />
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">My Trees</h2>
                <p className="mt-1 text-sm text-green-100/70">
                  Automatic tree codes like AG-0000125 appear here after admin
                  approval.
                </p>
              </div>
              <span className="rounded-full bg-green-400/15 px-4 py-2 text-sm font-black text-green-200">
                {trees.length} Trees
              </span>
            </div>

            <div className="mt-6 grid gap-4">
              {trees.length === 0 ? (
                <Empty text="No tree registry yet. Once your purchase is approved, tree codes will appear here automatically." />
              ) : (
                trees.map((tree) => (
                  <div
                    key={tree.id}
                    className="rounded-3xl border border-white/10 bg-black/20 p-5"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-2xl font-black text-green-300">
                          {tree.tree_code}
                        </p>
                        <p className="mt-1 text-sm text-white/70">
                          {tree.species || "Aquilaria Malaccensis"}
                        </p>
                      </div>

                      <span className="rounded-full bg-blue-400/15 px-4 py-2 text-sm font-black text-blue-200">
                        {tree.status || "REGISTERED"}
                      </span>
                    </div>

                    <div className="mt-5 grid gap-3 text-sm text-white/75 md:grid-cols-3">
                      <Info label="DENR Tag" value={tree.denr_tag_number || "Pending"} />
                      <Info label="GPS" value={tree.gps_lat && tree.gps_lng ? `${tree.gps_lat}, ${tree.gps_lng}` : "Pending"} />
                      <Info label="Planted Date" value={tree.planted_at || "Pending"} />
                    </div>
                  </div>
                ))
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
                <Info label="Referral Code" value={profile?.referral_code || "Pending"} />
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6">
              <h2 className="text-2xl font-black">Referral Link</h2>
              <p className="mt-2 text-sm text-white/70">
                Share this after your account is approved.
              </p>
              <div className="mt-4 break-all rounded-2xl bg-black/30 p-4 text-sm text-green-200">
                {referralLink || "Load your profile first."}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6">
              <h2 className="text-2xl font-black">Legal Center</h2>
              <p className="mt-2 text-sm text-white/70">
                SEC, BIR, Business Permit, DENR WCuP, lease contracts, and
                company profile will be listed here.
              </p>
              <div className="mt-4 grid gap-2 text-sm">
                {[
                  "SEC Registration",
                  "BIR Certificate",
                  "Business Permit 2026",
                  "DENR Wildlife Culture Permit",
                  "Company Profile PDF",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl bg-black/20 px-4 py-3 font-bold text-white/80"
                  >
                    {item}
                  </div>
                ))}
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
                <div
                  key={tx.id}
                  className="flex flex-col justify-between gap-3 rounded-2xl bg-black/20 px-5 py-4 md:flex-row md:items-center"
                >
                  <div>
                    <p className="font-black">{tx.transaction_type}</p>
                    <p className="text-sm text-white/60">
                      {tx.description || "No description"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-green-300">
                      {money(tx.amount)}
                    </p>
                    <p className="text-xs text-white/50">{tx.status}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
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