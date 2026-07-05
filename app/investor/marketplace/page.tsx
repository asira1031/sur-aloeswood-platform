"use client";

import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import {
  ANNUAL_MAINTENANCE_FEE,
  COPLANTER_PACKAGE_PRICE,
  MAINTENANCE_YEARS,
  PROJECTED_TARGET_VALUE,
  peso,
  platformMoneyNotice,
  projectionDisclaimer,
} from "@/app/lib/business/rules";

const SEEDLING_PRODUCT = {
  name: "Aquilaria Malaccensis",
  species: "Aquilaria Malaccensis",
  quantity: 1,
  price: COPLANTER_PACKAGE_PRICE,
  description: "Official SUR agarwood seedling for AG tree registration, DENR tagging, GPS records, certificate flow, and plantation monitoring.",
};

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
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const walletBalance = Number(wallet?.balance || 0);
  const canPayFromWallet = walletBalance >= SEEDLING_PRODUCT.price;

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
      setMessage("Login first to load your co-planter account.");
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

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setMessage("Please login again before buying a seedling.");
      setLoading(false);
      return;
    }

    const response = await fetch("/api/investor/buy-seedling", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error || "Unable to complete wallet purchase.");
      setLoading(false);
      return;
    }

    setMessage(result.message || "Seedling paid from wallet. Waiting for admin AG tree approval.");
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
                Aquilaria Malaccensis Marketplace
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
                Official Seedling
              </p>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-emerald-50/85">
                SUR currently sells one agarwood species in the investor app: Aquilaria Malaccensis. Purchases are paid using wallet balance only, then admin proceeds with AG tree registration and plantation records.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <Metric label="Seedling Price" value={peso(SEEDLING_PRODUCT.price)} />
                <Metric label="Target Scenario" value={peso(PROJECTED_TARGET_VALUE)} />
                <Metric label="Maintenance" value={`${peso(ANNUAL_MAINTENANCE_FEE)} / year`} />
              </div>

              {message && (
                <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">
                  {message}
                </div>
              )}
            </div>

            <div className="relative overflow-hidden rounded-[2rem] border border-emerald-300/20 bg-emerald-300/10 p-5 shadow-2xl">
              <div className="absolute right-6 top-6 rounded-full border border-yellow-300/30 bg-yellow-300/15 px-4 py-2 text-xs font-black uppercase tracking-wide text-yellow-100">
                Live Seedling
              </div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-black/30">
                <Image
                  src="/agarwood-marketplace-hero.png"
                  alt="Aquilaria Malaccensis seedling"
                  fill
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover"
                />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-black/30 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-emerald-100/55">Species</p>
                  <p className="mt-2 text-xl font-black text-emerald-100">{SEEDLING_PRODUCT.species}</p>
                </div>
                <div className="rounded-2xl bg-black/30 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-emerald-100/55">Payment</p>
                  <p className="mt-2 text-xl font-black text-yellow-200">Wallet only</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 md:px-10 xl:grid-cols-[1fr_0.82fr]">
        <div className="space-y-6">
          <Panel title="Aquilaria Malaccensis" subtitle="Only this species is available for investor purchase at this stage.">
            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="relative min-h-[320px] overflow-hidden rounded-[1.5rem] border border-emerald-300/20 bg-black/25">
                <Image
                  src="/agarwood-marketplace-hero.png"
                  alt="Aquilaria Malaccensis"
                  fill
                  sizes="(min-width: 1024px) 38vw, 100vw"
                  className="object-cover"
                />
              </div>
              <div className="grid content-start gap-4">
                <div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-200">Available Seedling</p>
                  <h2 className="mt-3 text-3xl font-black text-white">{SEEDLING_PRODUCT.name}</h2>
                  <p className="mt-3 text-sm leading-7 text-white/68">{SEEDLING_PRODUCT.description}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Info label="Quantity" value="1 seedling" />
                  <Info label="Payment" value="Wallet money only" />
                  <Info label="Price" value={peso(SEEDLING_PRODUCT.price)} />
                  <Info label="Status After Payment" value="Waiting admin AG tree approval" />
                </div>
              </div>
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <div className="sticky top-6 rounded-[2rem] border border-white/10 bg-white/[0.07] p-6 shadow-2xl backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300">Checkout</p>
            <h2 className="mt-3 text-3xl font-black">Wallet Checkout</h2>

            <div className="mt-6 rounded-3xl border border-white/10 bg-black/25 p-5">
              <p className="text-sm font-bold text-white/55">{SEEDLING_PRODUCT.name}</p>
              <p className="mt-3 text-4xl font-black text-emerald-300">{peso(SEEDLING_PRODUCT.price)}</p>
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
              <button
                onClick={payFromWallet}
                disabled={loading || !canPayFromWallet}
                className="w-full rounded-2xl bg-emerald-400 px-6 py-4 text-sm font-black text-emerald-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-500"
              >
                {loading ? "Loading wallet..." : "Pay With Wallet Money"}
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
