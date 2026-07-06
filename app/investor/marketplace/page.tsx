"use client";

import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import {
  ANNUAL_MAINTENANCE_FEE,
  COPLANTER_PACKAGE_PRICE,
  MAINTENANCE_YEARS,
  PROJECTED_TARGET_VALUE,
  capitalAllocation,
  packagePriceForQuantity,
  peso,
  platformMoneyNotice,
  projectionDisclaimer,
} from "@/app/lib/business/rules";

const PACKAGES = [
  { qty: 1, tag: "Starter" },
  { qty: 5, tag: "Family" },
  { qty: 10, tag: "Growth" },
  { qty: 25, tag: "Estate" },
  { qty: 50, tag: "Network" },
  { qty: 100, tag: "Institutional" },
].map((item) => ({
  ...item,
  price: packagePriceForQuantity(item.qty),
}));

const SEEDLING_MODELS = [
  {
    id: "premium-malaccensis",
    name: "Aquilaria Malaccensis",
    label: "Premium Co-Planter Stock",
    description: "Healthy agarwood seedling for tagged co-planting records.",
    accent: "from-emerald-300 to-lime-200",
  },
  {
    id: "high-yield-ag",
    name: "High-Yield AG Line",
    label: "Plantation Grade",
    description: "Selected for managed growth monitoring and service requests.",
    accent: "from-yellow-300 to-emerald-200",
  },
  {
    id: "denr-ready",
    name: "DENR-Ready Seedling",
    label: "Compliance Focus",
    description: "Designed for registry, DENR tagging, GPS, and certificate flow.",
    accent: "from-sky-300 to-emerald-200",
  },
];

type Row = Record<string, any>;

function statusClass(status?: string | null) {
  const value = String(status || "").toUpperCase();

  if (["APPROVED", "PAID", "COMPLETED"].includes(value)) {
    return "border-emerald-300/30 bg-emerald-400/15 text-emerald-100";
  }

  if (["REJECTED", "FAILED", "CANCELLED"].includes(value)) {
    return "border-red-300/30 bg-red-400/15 text-red-100";
  }

  return "border-yellow-300/30 bg-yellow-400/15 text-yellow-100";
}

export default function InvestorMarketplacePage() {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Row | null>(null);
  const [wallet, setWallet] = useState<Row | null>(null);
  const [purchases, setPurchases] = useState<Row[]>([]);
  const [selectedPackage, setSelectedPackage] = useState(PACKAGES[0]);
  const [selectedModel, setSelectedModel] = useState(SEEDLING_MODELS[0]);
  const [reference, setReference] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const walletBalance = Number(wallet?.balance || 0);
  const canPayFromWallet = walletBalance >= selectedPackage.price;

  const checkoutLabel = useMemo(() => {
    return `${selectedPackage.qty} ${selectedModel.name} seedling${selectedPackage.qty > 1 ? "s" : ""}`;
  }, [selectedPackage.qty, selectedModel.name]);

  useEffect(() => {
    const saved = localStorage.getItem("sur_login_email") || "";
    setEmail(saved);
    if (saved) loadAccount(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const cleanReference = reference.trim();
    const { error } = await supabase.from("seedling_purchases").insert({
      profile_id: profile.id,
      quantity: selectedPackage.qty,
      amount: selectedPackage.price,
      payment_reference: cleanReference,
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
      amount: selectedPackage.price,
      description: `${checkoutLabel} purchase submitted. Model: ${selectedModel.label}. Reference: ${cleanReference}`,
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

    if (!canPayFromWallet) {
      setMessage("Insufficient wallet balance.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { error: walletError } = await supabase
      .from("wallets")
      .update({
        balance: walletBalance - selectedPackage.price,
        updated_at: new Date().toISOString(),
      })
      .eq("profile_id", profile.id);

    if (walletError) {
      setMessage(walletError.message);
      setLoading(false);
      return;
    }

    const { error: purchaseError } = await supabase.from("seedling_purchases").insert({
      profile_id: profile.id,
      quantity: selectedPackage.qty,
      amount: selectedPackage.price,
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
      amount: selectedPackage.price,
      description: `${checkoutLabel} paid from wallet. Model: ${selectedModel.label}.`,
      status: "PAID",
    });

    setMessage("Purchase paid from wallet.");
    await loadAccount(profile.email || email);
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#03110b] text-white">
      <section className="relative overflow-hidden border-b border-white/10">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: "url('/forest-bg.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#03110b] via-[#062416]/95 to-[#0b1f18]/80" />

        <div className="relative mx-auto max-w-7xl px-6 py-8 md:px-10 lg:py-12">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-emerald-300">
                SUR ALOESWOOD MARKETPLACE
              </p>
              <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">
                Agarwood Seedling Marketplace
              </h1>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/investor/dashboard" className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black hover:bg-white/15">
                Dashboard
              </Link>
              <Link href="/investor/wallet" className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black text-emerald-950 hover:bg-emerald-300">
                Wallet
              </Link>
            </div>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.08] p-6 shadow-2xl backdrop-blur">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-yellow-200">
                Co-Planter Package
              </p>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-emerald-50/85">
                Choose an agarwood seedling model, select package quantity, record buyer-side payment reference,
                and let admin verify the purchase before tree codes and plantation records are finalized.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <Metric label="Price / Package" value={peso(COPLANTER_PACKAGE_PRICE)} />
                <Metric label="Target Scenario" value={peso(PROJECTED_TARGET_VALUE)} />
                <Metric label="Maintenance" value={`${peso(ANNUAL_MAINTENANCE_FEE)} / year`} />
              </div>

              <div className="mt-6 grid gap-3 rounded-3xl border border-white/10 bg-black/25 p-4 md:grid-cols-[1fr_auto]">
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Registered co-planter email"
                  className="w-full rounded-2xl border border-white/10 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none"
                />
                <button
                  onClick={() => loadAccount()}
                  disabled={loading}
                  className="rounded-2xl bg-emerald-400 px-8 py-4 text-sm font-black text-emerald-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-500"
                >
                  {loading ? "Loading..." : "Load Account"}
                </button>
              </div>

              {message && (
                <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">
                  {message}
                </div>
              )}
            </div>

            <div className="relative overflow-hidden rounded-[2rem] border border-emerald-300/20 bg-emerald-300/10 p-5 shadow-2xl">
              <div className="absolute right-6 top-6 rounded-full border border-yellow-300/30 bg-yellow-300/15 px-4 py-2 text-xs font-black uppercase tracking-wide text-yellow-100">
                Live Stock Model
              </div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-black/30">
                <Image
                  src="/agarwood-marketplace-hero.png"
                  alt="Agarwood seedling model"
                  fill
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover"
                />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-black/30 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-emerald-100/55">Selected Model</p>
                  <p className="mt-2 text-xl font-black text-emerald-100">{selectedModel.name}</p>
                </div>
                <div className="rounded-2xl bg-black/30 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-emerald-100/55">Selected Quantity</p>
                  <p className="mt-2 text-xl font-black text-yellow-200">{selectedPackage.qty} seedling(s)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 md:px-10 xl:grid-cols-[1fr_0.9fr]">
        <div className="space-y-6">
          <Panel title="Choose Seedling Model" subtitle="Marketplace display only; admin still verifies payment and tree registry.">
            <div className="grid gap-4 md:grid-cols-3">
              {SEEDLING_MODELS.map((model) => (
                <button
                  key={model.id}
                  onClick={() => setSelectedModel(model)}
                  className={`overflow-hidden rounded-3xl border text-left transition ${
                    selectedModel.id === model.id
                      ? "border-emerald-300 bg-emerald-300/15"
                      : "border-white/10 bg-black/25 hover:border-emerald-300/40"
                  }`}
                >
                  <div className={`h-2 bg-gradient-to-r ${model.accent}`} />
                  <div className="p-5">
                    <p className="text-xs font-black uppercase tracking-wide text-yellow-200">{model.label}</p>
                    <h3 className="mt-3 text-xl font-black text-white">{model.name}</h3>
                    <p className="mt-3 text-sm leading-6 text-white/65">{model.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Select Package Quantity" subtitle={`Each co-planter package is ${peso(COPLANTER_PACKAGE_PRICE)}.`}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PACKAGES.map((item) => (
                <button
                  key={item.qty}
                  onClick={() => setSelectedPackage(item)}
                  className={`rounded-3xl border p-5 text-left transition ${
                    selectedPackage.qty === item.qty
                      ? "border-yellow-300 bg-yellow-300/15"
                      : "border-white/10 bg-black/25 hover:border-yellow-300/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-white/45">{item.tag}</p>
                      <p className="mt-2 text-4xl font-black text-white">{item.qty}</p>
                      <p className="text-sm font-bold text-white/55">seedling(s)</p>
                    </div>
                    <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-100">
                      AG
                    </span>
                  </div>
                  <p className="mt-5 text-xl font-black text-emerald-300">{peso(item.price)}</p>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Package Allocation" subtitle="Shown for transparency based on the co-planter program mechanics.">
            <div className="grid gap-3 md:grid-cols-2">
              {capitalAllocation.map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-sm font-black text-yellow-100">{item.label}</p>
                  <p className="mt-2 text-2xl font-black text-emerald-300">{peso(item.amount)}</p>
                  <p className="mt-2 text-xs leading-5 text-white/55">{item.note}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <div className="sticky top-6 rounded-[2rem] border border-white/10 bg-white/[0.07] p-6 shadow-2xl backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300">Checkout</p>
            <h2 className="mt-3 text-3xl font-black">Purchase Summary</h2>

            <div className="mt-6 rounded-3xl border border-white/10 bg-black/25 p-5">
              <p className="text-sm font-bold text-white/55">{checkoutLabel}</p>
              <p className="mt-3 text-4xl font-black text-emerald-300">{peso(selectedPackage.price)}</p>
              <p className="mt-3 text-sm leading-6 text-white/60">
                Annual inoculation and maintenance fund: {peso(ANNUAL_MAINTENANCE_FEE)} per year for {MAINTENANCE_YEARS} years.
              </p>
            </div>

            <div className="mt-5 grid gap-3 rounded-3xl border border-white/10 bg-black/25 p-4">
              <Info label="Loaded Co-Planter" value={profile?.full_name || profile?.email || "Not loaded"} />
              <Info label="Wallet Balance" value={peso(walletBalance)} />
              <Info label="Wallet Pay Status" value={canPayFromWallet ? "Available" : "Needs more credits"} />
            </div>

            <div className="mt-5 space-y-4">
              <input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Payment reference / receipt number"
                className="w-full rounded-2xl border border-white/10 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none"
              />
              <button
                onClick={submitForApproval}
                disabled={loading}
                className="w-full rounded-2xl bg-yellow-300 px-6 py-4 text-sm font-black text-yellow-950 hover:bg-yellow-200 disabled:cursor-not-allowed disabled:bg-slate-500"
              >
                Submit for Admin Approval
              </button>
              <button
                onClick={payFromWallet}
                disabled={loading || !canPayFromWallet}
                className="w-full rounded-2xl bg-emerald-400 px-6 py-4 text-sm font-black text-emerald-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-500"
              >
                Pay From Wallet
              </button>
            </div>

            <div className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-black/25 p-4 text-xs leading-6 text-white/65">
              <p>{platformMoneyNotice}</p>
              <p>{projectionDisclaimer}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16 md:px-10">
        <Panel title="My Purchase Records" subtitle="Newest seedling purchase requests and wallet-paid orders.">
          <div className="grid gap-3">
            {purchases.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/25 p-6 text-sm font-bold text-white/60">
                No purchases yet.
              </div>
            ) : (
              purchases.map((purchase) => (
                <div key={purchase.id} className="rounded-2xl border border-white/10 bg-black/25 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black text-emerald-100">{purchase.quantity || "-"} Seedling(s)</p>
                      <p className="mt-1 text-sm text-white/60">Ref: {purchase.payment_reference || "-"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-emerald-300">{peso(purchase.total_amount || purchase.amount)}</p>
                      <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClass(purchase.status)}`}>
                        {purchase.status || "PENDING"}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </section>
    </main>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
      <div className="mb-5">
        <h2 className="text-2xl font-black md:text-3xl">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-white/60">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-white/45">{label}</p>
      <p className="mt-2 text-lg font-black text-emerald-200">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/[0.06] px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-white/45">{label}</p>
      <p className="text-right text-sm font-black text-white">{value}</p>
    </div>
  );
}
