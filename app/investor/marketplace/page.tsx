"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase/client";

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  account_status: string | null;
  kyc_status: string | null;
};

type Wallet = {
  balance: number | null;
  recovery_balance?: number | null;
  harvest_balance?: number | null;
};

type Purchase = {
  id: string;
  profile_id: string;
  quantity: number | null;
  unit_price: number | null;
  total_amount: number | null;
  status: string | null;
  payment_status: string | null;
  species: string | null;
  created_at: string | null;
};

const SEEDLING_PRICE = 14000;
const SPECIES = "Aquilaria Malaccensis";

const money = (amount?: number | null) =>
  `₱${Number(amount || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function CoPlanterMarketplacePage() {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const total = useMemo(() => quantity * SEEDLING_PRICE, [quantity]);

  async function loadMarketplace(targetEmail?: string) {
    setLoading(true);
    setMessage("");

    const cleanEmail = (targetEmail || email).toLowerCase().trim();

    if (!cleanEmail) {
      setMessage("Enter your registered email first.");
      setLoading(false);
      return;
    }

    localStorage.setItem("sur_login_email", cleanEmail);

    const { data: foundProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id,email,full_name,account_status,kyc_status")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (profileError || !foundProfile) {
      setProfile(null);
      setWallet(null);
      setPurchases([]);
      setMessage(profileError?.message || "Profile not found.");
      setLoading(false);
      return;
    }

    setProfile(foundProfile);

    const { data: walletData } = await supabase
      .from("wallets")
      .select("balance,recovery_balance,harvest_balance")
      .eq("profile_id", foundProfile.id)
      .maybeSingle();

    setWallet(walletData || null);

    const { data: purchaseData } = await supabase
      .from("seedling_purchases")
      .select("*")
      .eq("profile_id", foundProfile.id)
      .order("created_at", { ascending: false });

    setPurchases(purchaseData || []);
    setLoading(false);
  }

  async function submitPurchase() {
    setSubmitting(true);
    setMessage("");

    if (!profile) {
      setMessage("Load your Co-Planter profile first.");
      setSubmitting(false);
      return;
    }

    const payload = {
      profile_id: profile.id,
      species: SPECIES,
      quantity,
      unit_price: SEEDLING_PRICE,
      total_amount: total,
      status: "PENDING",
      payment_status: "PENDING",
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("seedling_purchases").insert(payload);

    if (error) {
      setMessage(error.message);
      setSubmitting(false);
      return;
    }

    setMessage(
      "Seedling purchase request submitted. AG tree codes will be generated only after Admin approves payment."
    );

    setQuantity(1);
    await loadMarketplace(profile.email);
    setSubmitting(false);
  }

  useEffect(() => {
    const savedEmail = localStorage.getItem("sur_login_email") || "";
    setEmail(savedEmail);
    if (savedEmail) loadMarketplace(savedEmail);
  }, []);

  return (
    <main className="min-h-screen bg-[#06140d] px-5 py-8 text-white">
      <section className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950 via-[#0b1d12] to-black p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-yellow-400">
            SEEDLING MARKETPLACE
          </p>
          <h1 className="mt-3 text-3xl font-black md:text-5xl">
            Buy Aloeswood Seedlings
          </h1>
          <p className="mt-4 max-w-3xl text-sm text-emerald-100 md:text-base">
            Reserve Aquilaria Malaccensis seedlings at ₱14,000 per tree. Each approved
            seedling purchase receives one sequential AG tree code after Admin payment approval.
          </p>

          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 md:flex-row">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter registered email"
              className="min-h-12 flex-1 rounded-xl border border-white/10 bg-white px-4 font-semibold text-slate-900 outline-none"
            />
            <button
              onClick={() => loadMarketplace()}
              disabled={loading}
              className="rounded-xl bg-yellow-400 px-6 py-3 font-black text-black hover:bg-yellow-300 disabled:opacity-60"
            >
              {loading ? "Loading..." : "Load Marketplace"}
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/tree" className="rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black">
              My AG Trees
            </Link>
            <Link href="/plantation" className="rounded-xl border border-emerald-500/30 px-5 py-3 font-bold text-emerald-100">
              Plantation Timeline
            </Link>
            <Link href="/certificates" className="rounded-xl border border-emerald-500/30 px-5 py-3 font-bold text-emerald-100">
              Certificates
            </Link>
            <Link href="/harvest" className="rounded-xl border border-emerald-500/30 px-5 py-3 font-bold text-emerald-100">
              Harvest
            </Link>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-5 text-yellow-100">
            {message}
          </div>
        )}

        {profile && (
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-emerald-500/20 bg-white/10 p-5 md:col-span-1">
              <p className="text-sm text-emerald-200">Loaded Co-Planter</p>
              <h2 className="text-xl font-black">{profile.full_name || profile.email}</h2>
              <p className="text-sm text-white/60">{profile.email}</p>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-white/10 p-5">
              <p className="text-sm text-emerald-200">Wallet Balance</p>
              <h2 className="text-2xl font-black text-yellow-300">{money(wallet?.balance)}</h2>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-white/10 p-5">
              <p className="text-sm text-emerald-200">Account Status</p>
              <h2 className="text-2xl font-black text-yellow-300">
                {profile.account_status || "Pending"}
              </h2>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-emerald-500/20 bg-white/10 p-6">
            <div className="rounded-3xl bg-gradient-to-br from-emerald-800 via-emerald-950 to-black p-6">
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-yellow-300">
                Premium Seedling
              </p>
              <h2 className="mt-3 text-3xl font-black">{SPECIES}</h2>
              <p className="mt-4 text-emerald-100">
                Plantation-managed aloeswood seedling with AG tree code, DENR tag display,
                GPS location display, growth monitoring, photo updates, video updates,
                certificate preview, and harvest timeline after approval and registration.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <Mini title="Price" value="₱14,000" />
                <Mini title="Code Format" value="AG-0000001" />
                <Mini title="Harvest Estimate" value="3–5 Years" />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-yellow-500/20 bg-white/10 p-6">
            <h2 className="text-2xl font-black text-yellow-300">Purchase Request</h2>
            <p className="mt-2 text-sm text-emerald-100">
              This creates a pending purchase request only. Admin approval will handle AG code
              generation and tree registration.
            </p>

            <label className="mt-5 block text-sm font-bold text-emerald-100">Quantity</label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
              className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-white px-4 font-semibold text-slate-900 outline-none"
            />

            <div className="mt-5 rounded-2xl bg-black/30 p-4">
              <div className="flex justify-between text-sm text-emerald-100">
                <span>Unit Price</span>
                <span>{money(SEEDLING_PRICE)}</span>
              </div>
              <div className="mt-3 flex justify-between text-xl font-black text-yellow-300">
                <span>Total</span>
                <span>{money(total)}</span>
              </div>
            </div>

            <button
              onClick={submitPurchase}
              disabled={submitting || !profile}
              className="mt-5 w-full rounded-xl bg-yellow-400 px-5 py-4 font-black text-black hover:bg-yellow-300 disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit Purchase Request"}
            </button>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-emerald-500/20 bg-white/10 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-yellow-300">My Seedling Purchase Requests</h2>
              <p className="mt-1 text-sm text-emerald-100">
                Pending purchases wait for Admin payment approval before AG code generation.
              </p>
            </div>
            <span className="rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-black text-emerald-100">
              {purchases.length} Requests
            </span>
          </div>

          <div className="mt-5 grid gap-4">
            {purchases.length === 0 ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-black/20 p-6">
                <h3 className="text-xl font-bold text-yellow-300">No purchase requests yet</h3>
                <p className="mt-2 text-emerald-100">
                  Submit a seedling purchase request to start your Co-Planter journey.
                </p>
              </div>
            ) : (
              purchases.map((purchase) => (
                <div key={purchase.id} className="rounded-2xl border border-white/10 bg-black/25 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-black text-yellow-300">
                        {purchase.quantity || 0} Seedling(s)
                      </p>
                      <p className="text-sm text-emerald-100">
                        {purchase.species || SPECIES}
                      </p>
                    </div>
                    <span className="rounded-full bg-yellow-400/15 px-4 py-2 text-sm font-black text-yellow-200">
                      {purchase.status || "PENDING"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm text-emerald-100 md:grid-cols-4">
                    <p><b>Unit:</b> {money(purchase.unit_price)}</p>
                    <p><b>Total:</b> {money(purchase.total_amount)}</p>
                    <p><b>Payment:</b> {purchase.payment_status || "PENDING"}</p>
                    <p><b>Date:</b> {purchase.created_at ? new Date(purchase.created_at).toLocaleDateString() : "—"}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-yellow-500/20 bg-yellow-500/10 p-5 text-sm text-yellow-100">
          No guaranteed returns. Actual harvest depends on plantation performance,
          market conditions, inoculation schedule, and applicable laws.
        </div>
      </section>
    </main>
  );
}

function Mini({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/30 p-4">
      <p className="text-xs text-emerald-200">{title}</p>
      <p className="mt-1 text-lg font-black text-yellow-300">{value}</p>
    </div>
  );
}