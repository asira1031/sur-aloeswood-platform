"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
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

type Row = Record<string, any>;

const SEEDLING_PRODUCT = {
  name: "Aquilaria Malaccensis",
  species: "Aquilaria Malaccensis",
  quantity: 1,
  price: COPLANTER_PACKAGE_PRICE,
  description:
    "Official SUR approved seedling for AG tree registration, DENR tagging, GPS records, certificate flow, and plantation monitoring.",
};

const PRODUCT_SLIDES = [
  {
    src: "/agarwood-plant-seedling.png",
    fallback: "/agarwood-seedlings-hero.png",
    alt: "Agarwood seedling in nursery bag",
    label: "Available seedling",
  },
  {
    src: "/agarwood-seedlings-hero.png",
    fallback: "/forest-bg.jpg",
    alt: "Aquilaria Malaccensis seedlings",
    label: "Seedling nursery",
  },
  {
    src: "/agarwood-workers.png",
    fallback: "/agarwood-seedlings-hero.png",
    alt: "SUR Aloeswood nursery team holding seedlings",
    label: "Nursery team",
  },
] as const;

function normalizeRole(role?: string | null) {
  return String(role || "").toUpperCase().replace("CO_PLANTER", "COPLANTER");
}

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
  const [messageTone, setMessageTone] = useState<"info" | "error" | "success">("info");
  const [loading, setLoading] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);

  const walletBalance = Number(wallet?.balance || profile?.wallet_balance || 0);
  const isCoplanter = normalizeRole(profile?.role) === "COPLANTER";
  const canPayFromWallet = Boolean(profile && wallet && isCoplanter && walletBalance >= SEEDLING_PRODUCT.price);

  const payStatus = useMemo(() => {
    if (!profile) return "Login required";
    if (!isCoplanter) return "Co-Planter account required";
    if (!wallet) return "Wallet not found";
    if (walletBalance < SEEDLING_PRODUCT.price) return "Needs more wallet balance";
    return "Available";
  }, [isCoplanter, profile, wallet, walletBalance]);

  useEffect(() => {
    loadAccount();

    const timer = window.setInterval(() => {
      setSlideIndex((current) => (current + 1) % PRODUCT_SLIDES.length);
    }, 5200);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setNotice(text: string, tone: "info" | "error" | "success" = "info") {
    setMessage(text);
    setMessageTone(tone);
  }

  function showPreviousSlide() {
    setSlideIndex((current) => (current - 1 + PRODUCT_SLIDES.length) % PRODUCT_SLIDES.length);
  }

  function showNextSlide() {
    setSlideIndex((current) => (current + 1) % PRODUCT_SLIDES.length);
  }

  async function loadAccount(targetEmail?: string) {
    setLoading(true);
    setNotice("");

    const { data: sessionData } = await supabase.auth.getSession();
    const authUser = sessionData.session?.user || null;
    const savedEmail = targetEmail || authUser?.email || localStorage.getItem("sur_login_email") || "";
    const cleanEmail = savedEmail.toLowerCase().trim();

    if (!authUser && !cleanEmail) {
      setProfile(null);
      setWallet(null);
      setPurchases([]);
      setEmail("");
      setNotice("Login first to load your co-planter account.", "error");
      setLoading(false);
      return;
    }

    setEmail(cleanEmail);

    const { data: profileByAuthUserId, error: authProfileError } = authUser
      ? await supabase.from("profiles").select("*").eq("auth_user_id", authUser.id).maybeSingle()
      : { data: null, error: null };

    if (authProfileError) {
      setNotice(authProfileError.message, "error");
      setLoading(false);
      return;
    }

    const { data: profileByEmail, error: emailProfileError } = profileByAuthUserId
      ? { data: null, error: null }
      : await supabase.from("profiles").select("*").eq("email", cleanEmail).maybeSingle();

    if (emailProfileError) {
      setNotice(emailProfileError.message, "error");
      setLoading(false);
      return;
    }

    const profileRow = profileByAuthUserId || profileByEmail;

    if (!profileRow) {
      setProfile(null);
      setWallet(null);
      setPurchases([]);
      setNotice("Profile not found. Please login again or contact admin support.", "error");
      setLoading(false);
      return;
    }

    localStorage.setItem("sur_login_email", String(profileRow.email || cleanEmail).toLowerCase().trim());
    localStorage.setItem("sur_profile_id", profileRow.id);
    localStorage.setItem("sur_profile_role", profileRow.role || "");
    localStorage.setItem("sur_account_status", profileRow.account_status || "");

    const [{ data: walletRow, error: walletError }, { data: purchaseRows, error: purchaseError }] = await Promise.all([
      supabase.from("wallets").select("*").eq("profile_id", profileRow.id).maybeSingle(),
      supabase
        .from("seedling_purchases")
        .select("*")
        .eq("profile_id", profileRow.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (walletError) {
      setNotice(walletError.message, "error");
      setLoading(false);
      return;
    }

    if (purchaseError) {
      setNotice(purchaseError.message, "error");
      setLoading(false);
      return;
    }

    setProfile(profileRow);
    setWallet(walletRow || null);
    setPurchases((purchaseRows || []) as Row[]);
    setLoading(false);
  }

  async function payFromWallet() {
    setNotice("");

    if (!profile) {
      setNotice("Login first before buying a seedling.", "error");
      return;
    }

    if (!isCoplanter) {
      setNotice("Only Co-Planter accounts can buy seedlings. Please login using a customer/co-planter account.", "error");
      return;
    }

    if (!wallet) {
      setNotice("Wallet not found. Please cash in or ask admin to create the wallet record.", "error");
      return;
    }

    if (walletBalance < SEEDLING_PRODUCT.price) {
      setNotice(`Insufficient wallet balance. Required: ${peso(SEEDLING_PRODUCT.price)}. Current: ${peso(walletBalance)}.`, "error");
      return;
    }

    setLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setNotice("Please login again before buying a seedling. Your secure session is missing.", "error");
      setLoading(false);
      return;
    }

    const response = await fetch("/api/investor/buy-seedling", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setNotice(result?.error || "Unable to complete wallet purchase.", "error");
      setLoading(false);
      return;
    }

    setNotice(result?.message || "Seedling paid from wallet. Waiting for admin AG tree approval.", "success");
    await loadAccount(profile.email || email);
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#03110b] text-white">
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-cover bg-center opacity-25" style={{ backgroundImage: "url('/forest-bg.jpg')" }} />
        <div className="absolute inset-0 bg-gradient-to-br from-[#03110b] via-[#062416]/95 to-[#0b1f18]/80" />

        <div className="relative mx-auto max-w-7xl px-5 py-8 md:px-8 lg:py-12">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-emerald-300">
                SUR ALOESWOOD MARKETPLACE
              </p>
              <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight md:text-6xl">
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

          <div className="mt-10 grid gap-6 lg:grid-cols-[0.78fr_1.22fr] lg:items-stretch">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.08] p-6 shadow-2xl backdrop-blur">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-yellow-200">Official Seedling</p>

              <p className="mt-4 max-w-3xl text-base leading-8 text-emerald-50/85 md:text-lg">
                SUR currently sells one agarwood species in the investor app: Aquilaria Malaccensis.
                Purchases are paid using wallet balance only, then admin proceeds with AG tree registration and plantation records.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <Metric label="Seedling Price" value={peso(SEEDLING_PRODUCT.price)} />
                <Metric label="Target Scenario" value={peso(PROJECTED_TARGET_VALUE)} />
                <Metric label="Maintenance" value={`${peso(ANNUAL_MAINTENANCE_FEE)} / year`} />
              </div>

              {message && (
                <div
                  className={`mt-5 rounded-2xl border px-5 py-4 text-sm font-bold ${
                    messageTone === "error"
                      ? "border-red-300/30 bg-red-400/15 text-red-100"
                      : messageTone === "success"
                        ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-100"
                        : "border-yellow-300/30 bg-yellow-400/15 text-yellow-100"
                  }`}
                >
                  {message}
                </div>
              )}
            </div>

            <div className="relative overflow-hidden rounded-[2rem] border border-emerald-300/20 bg-emerald-300/10 p-5 shadow-2xl">
              <div className="absolute right-6 top-6 z-20 rounded-full border border-yellow-300/30 bg-yellow-300/15 px-4 py-2 text-xs font-black uppercase tracking-wide text-yellow-100 backdrop-blur">
                Growth Reference
              </div>

              <HeroImage />

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

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-8 md:px-8 xl:grid-cols-[1.12fr_0.88fr]">
        <div className="space-y-6">
          <Panel title="Aquilaria Malaccensis" subtitle="Only this species is available for investor purchase at this stage.">
            <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
              <ProductSlideshow
                slideIndex={slideIndex}
                onPrevious={showPreviousSlide}
                onNext={showNextSlide}
                onSelect={setSlideIndex}
              />

              <div className="grid content-start gap-4">
                <div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-200">
                    Available Seedling
                  </p>

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
              <Info label="Logged-in Name" value={profile?.full_name || profile?.email || "Not loaded"} />
              <Info label="Role" value={profile?.role || "Not loaded"} />
              <Info label="Wallet Balance" value={peso(walletBalance)} />
              <Info label="Wallet Pay Status" value={payStatus} />
            </div>

            <div className="mt-5 space-y-3">
              <button
                onClick={payFromWallet}
                disabled={loading || !canPayFromWallet}
                className="w-full rounded-2xl bg-emerald-400 px-6 py-4 text-sm font-black text-emerald-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-500"
              >
                {loading ? "Processing..." : "Pay With Wallet Money"}
              </button>

              <button
                onClick={() => loadAccount()}
                disabled={loading}
                className="w-full rounded-2xl border border-white/10 bg-white/10 px-6 py-4 text-sm font-black text-white hover:bg-white/15 disabled:opacity-60"
              >
                Refresh Wallet
              </button>
            </div>

            <div className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-black/25 p-4 text-xs leading-6 text-white/65">
              <p>{platformMoneyNotice}</p>
              <p>{projectionDisclaimer}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16 md:px-8">
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

function HeroImage() {
  const [src, setSrc] = useState<string>("/agarwood-growth-stages.png");

  return (
    <div className="relative h-[230px] overflow-hidden rounded-[1.5rem] bg-[#071810] md:h-[280px] xl:h-[330px]">
      <img
        src={src}
        alt="Aquilaria Malaccensis growth stages"
        onError={() => setSrc("/agarwood-seedlings-hero.png")}
        className="h-full w-full object-contain"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent p-4">
        <p className="text-sm font-black text-white">Aquilaria Malaccensis growth reference</p>
      </div>
    </div>
  );
}

function ProductSlideshow({
  slideIndex,
  onPrevious,
  onNext,
  onSelect,
}: {
  slideIndex: number;
  onPrevious: () => void;
  onNext: () => void;
  onSelect: (index: number) => void;
}) {
  const slide = PRODUCT_SLIDES[slideIndex];
  const [imageSrc, setImageSrc] = useState<string>(slide.src);

  useEffect(() => {
    setImageSrc(slide.src);
  }, [slide.src]);

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-emerald-300/20 bg-black">
      <div className="relative flex h-[330px] w-full items-center justify-center overflow-hidden bg-black sm:h-[370px] lg:h-[410px]">
        <img
          key={slide.src}
          src={imageSrc}
          alt={slide.alt}
          onError={() => setImageSrc(slide.fallback)}
          className="max-h-full max-w-full object-contain"
        />
      </div>

      <div className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/55 px-4 py-2 text-xs font-black uppercase tracking-wide text-white backdrop-blur">
        {slide.label}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between bg-gradient-to-t from-black/80 via-black/25 to-transparent px-4 pb-4 pt-16">
        <button
          type="button"
          onClick={onPrevious}
          aria-label="Previous image"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/55 text-lg font-black text-white backdrop-blur hover:bg-black/70"
        >
          {"<"}
        </button>

        <div className="flex items-center gap-2">
          {PRODUCT_SLIDES.map((item, index) => (
            <button
              key={item.src}
              type="button"
              onClick={() => onSelect(index)}
              aria-label={`Show image ${index + 1}`}
              className={`h-2.5 rounded-full transition-all ${
                slideIndex === index ? "w-9 bg-emerald-300" : "w-2.5 bg-white/55 hover:bg-white/80"
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={onNext}
          aria-label="Next image"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/55 text-lg font-black text-white backdrop-blur hover:bg-black/70"
        >
          {">"}
        </button>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
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
    <div className="flex min-h-[54px] items-center justify-between gap-4 rounded-2xl bg-white/[0.06] px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-white/45">{label}</p>
      <p className="max-w-[58%] break-words text-right text-sm font-black text-white">{value}</p>
    </div>
  );
}