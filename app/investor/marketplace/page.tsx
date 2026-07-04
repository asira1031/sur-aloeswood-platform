"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";

const PACKAGES = [
  { qty: 1, price: 14000 },
  { qty: 5, price: 70000 },
  { qty: 10, price: 140000 },
  { qty: 25, price: 350000 },
  { qty: 50, price: 700000 },
  { qty: 100, price: 1400000 },
];

type Row = Record<string, any>;

const peso = (v: any) =>
  `₱${Number(v || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function InvestorMarketplacePage() {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Row | null>(null);
  const [wallet, setWallet] = useState<Row | null>(null);
  const [purchases, setPurchases] = useState<Row[]>([]);
  const [selected, setSelected] = useState(PACKAGES[0]);
  const [reference, setReference] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sur_login_email") || "";
    setEmail(saved);
    if (saved) loadAccount(saved);
  }, []);

  async function loadAccount(targetEmail = email) {
    setLoading(true);
    setMessage("");

    const cleanEmail = targetEmail.toLowerCase().trim();
    if (!cleanEmail) {
      setMessage("Enter registered email.");
      setLoading(false);
      return;
    }

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (profileError) {
      setMessage(profileError.message);
      setLoading(false);
      return;
    }

    if (!profileRow) {
      setMessage("Profile not found.");
      setProfile(null);
      setWallet(null);
      setPurchases([]);
      setLoading(false);
      return;
    }

    localStorage.setItem("sur_login_email", cleanEmail);
    localStorage.setItem("sur_profile_id", profileRow.id);

    const { data: walletRow } = await supabase
      .from("wallets")
      .select("*")
      .eq("profile_id", profileRow.id)
      .maybeSingle();

    const { data: purchaseRows } = await supabase
      .from("seedling_purchases")
      .select("*")
      .eq("profile_id", profileRow.id)
      .order("created_at", { ascending: false })
      .limit(50);

    setProfile(profileRow);
    setWallet(walletRow || null);
    setPurchases((purchaseRows || []) as Row[]);
    setLoading(false);
  }

  async function submitForApproval() {
    if (!profile) {
      setMessage("Load profile first.");
      return;
    }

    if (!reference.trim()) {
      setMessage("Enter payment reference.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { error } = await supabase.from("seedling_purchases").insert({
      profile_id: profile.id,
      quantity: selected.qty,
      amount: selected.price,
      total_amount: selected.price,
      payment_reference: reference.trim(),
      status: "PENDING",
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    await supabase.from("wallet_transactions").insert({
      profile_id: profile.id,
      transaction_type: "SEEDLING_PURCHASE_REQUEST",
      amount: selected.price,
      description: `${selected.qty} seedling purchase submitted. Reference: ${reference.trim()}`,
      status: "PENDING",
    });

    setReference("");
    setMessage("Purchase submitted for admin approval.");
    await loadAccount(profile.email || email);
    setLoading(false);
  }

  async function payFromWallet() {
    if (!profile || !wallet) {
      setMessage("Load wallet first.");
      return;
    }

    const balance = Number(wallet.balance || 0);
    if (balance < selected.price) {
      setMessage("Insufficient wallet balance.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { error: walletError } = await supabase
      .from("wallets")
      .update({ balance: balance - selected.price, updated_at: new Date().toISOString() })
      .eq("profile_id", profile.id);

    if (walletError) {
      setMessage(walletError.message);
      setLoading(false);
      return;
    }

    const { error: purchaseError } = await supabase.from("seedling_purchases").insert({
      profile_id: profile.id,
      quantity: selected.qty,
      amount: selected.price,
      total_amount: selected.price,
      payment_reference: `WALLET-${Date.now()}`,
      status: "PAID",
    });

    if (purchaseError) {
      setMessage(purchaseError.message);
      setLoading(false);
      return;
    }

    await supabase.from("wallet_transactions").insert({
      profile_id: profile.id,
      transaction_type: "SEEDLING_PURCHASE",
      amount: selected.price,
      description: `${selected.qty} seedling purchase paid from wallet.`,
      status: "PAID",
    });

    setMessage("Purchase paid from wallet.");
    await loadAccount(profile.email || email);
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#04140d] text-white">
      <section className="border-b border-white/10 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-green-300">SUR ALOESWOOD MARKETPLACE</p>
              <h1 className="mt-4 text-4xl font-black md:text-6xl">Buy Seedlings</h1>
            </div>
            <div className="flex gap-3">
              <Link href="/investor/dashboard" className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black">Dashboard</Link>
              <Link href="/investor/wallet" className="rounded-2xl bg-green-500 px-5 py-3 text-sm font-black text-green-950">Wallet</Link>
            </div>
          </div>

          <div className="mt-8 grid gap-3 rounded-3xl border border-white/10 bg-white/10 p-4 md:grid-cols-[1fr_auto]">
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Registered email" className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
            <button onClick={() => loadAccount()} disabled={loading} className="rounded-2xl bg-green-500 px-8 py-4 text-sm font-black text-green-950 disabled:bg-slate-500">{loading ? "Loading..." : "Load"}</button>
          </div>

          {message && <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 md:px-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
          <h2 className="text-3xl font-black">Seedling Packages</h2>
          <p className="mt-2 text-sm text-white/70">Wallet balance: {peso(wallet?.balance)}</p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {PACKAGES.map((item) => (
              <button key={item.qty} onClick={() => setSelected(item)} className={`rounded-3xl border p-5 text-left ${selected.qty === item.qty ? "border-green-300 bg-green-400/15" : "border-white/10 bg-black/25"}`}>
                <p className="text-3xl font-black">{item.qty}</p>
                <p className="mt-1 text-sm text-white/70">Seedling(s)</p>
                <p className="mt-4 text-lg font-black text-green-300">{peso(item.price)}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
          <h2 className="text-3xl font-black">Checkout</h2>
          <p className="mt-3 text-4xl font-black text-green-300">{peso(selected.price)}</p>
          <div className="mt-6 space-y-4">
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Payment reference / receipt number" className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
            <button onClick={submitForApproval} disabled={loading} className="w-full rounded-2xl bg-yellow-400 px-6 py-4 text-sm font-black text-yellow-950 disabled:bg-slate-500">Submit for Admin Approval</button>
            <button onClick={payFromWallet} disabled={loading} className="w-full rounded-2xl bg-green-500 px-6 py-4 text-sm font-black text-green-950 disabled:bg-slate-500">Pay From Wallet</button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16 md:px-10">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
          <h2 className="text-3xl font-black">My Purchases</h2>
          <div className="mt-6 grid gap-3">
            {purchases.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/25 p-6 text-sm font-bold text-white/60">No purchases yet.</div>
            ) : purchases.map((purchase) => (
              <div key={purchase.id} className="rounded-2xl border border-white/10 bg-black/25 p-5">
                <p className="text-lg font-black text-green-200">{purchase.quantity || "-"} Seedling(s)</p>
                <p className="mt-1 text-sm text-white/70">{peso(purchase.total_amount || purchase.amount)}</p>
                <p className="mt-1 text-sm text-white/60">Ref: {purchase.payment_reference || "-"}</p>
                <p className="mt-3 inline-flex rounded-full border border-yellow-300/30 bg-yellow-400/15 px-3 py-1 text-xs font-black text-yellow-100">{purchase.status || "PENDING"}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
