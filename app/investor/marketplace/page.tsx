"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase/client";

const PRICE_PER_SEEDLING = 14000;

const money = (amount: number) =>
  `₱${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function MarketplacePage() {
  const [email, setEmail] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [paymentReference, setPaymentReference] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const total = quantity * PRICE_PER_SEEDLING;

  const submitPurchase = async () => {
    setMessage("");

    if (!email || !paymentReference) {
      setMessage("Enter registered email and payment reference.");
      return;
    }

    setLoading(true);

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (!profile) {
      setLoading(false);
      setMessage("Profile not found.");
      return;
    }

    const { error } = await supabase.from("seedling_purchases").insert({
      profile_id: profile.id,
      quantity,
      amount: total,
      status: "PENDING",
      payment_reference: paymentReference,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Purchase submitted. Wait for admin approval.");
    setPaymentReference("");
  };

  return (
    <main className="min-h-screen bg-[#06170f] px-8 py-8 text-white lg:px-14">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-green-300">
            SUR Aloeswood Marketplace
          </p>
          <h1 className="mt-3 text-5xl font-black">Buy Seedlings</h1>
          <p className="mt-3 max-w-3xl text-green-100/80">
            Purchase Aquilaria Malaccensis seedlings for co-planting. Once admin
            approves payment, AG tree codes will be automatically generated.
          </p>
        </div>

        <Link
          href="/investor/dashboard"
          className="rounded-2xl bg-white/10 px-6 py-4 font-black ring-1 ring-white/15"
        >
          Dashboard
        </Link>
      </div>

      <section className="mt-10 grid gap-8 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-8">
          <h2 className="text-3xl font-black">Seedling Package</h2>
          <p className="mt-2 text-white/70">
            One seedling includes planting support, monitoring setup, ownership
            tracking, and future certificate generation.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[1, 5, 10, 25, 50, 100].map((q) => (
              <button
                key={q}
                onClick={() => setQuantity(q)}
                className={`rounded-3xl border p-6 text-left ${
                  quantity === q
                    ? "border-green-300 bg-green-400/20"
                    : "border-white/10 bg-black/20"
                }`}
              >
                <p className="text-3xl font-black">{q}</p>
                <p className="mt-1 text-sm text-white/60">
                  Seedling{q > 1 ? "s" : ""}
                </p>
                <p className="mt-4 font-black text-green-300">
                  {money(q * PRICE_PER_SEEDLING)}
                </p>
              </button>
            ))}
          </div>

          <div className="mt-8 rounded-3xl bg-black/25 p-6">
            <p className="text-sm text-white/60">Selected Quantity</p>
            <p className="mt-2 text-4xl font-black">{quantity} Seedling(s)</p>
            <p className="mt-4 text-sm text-white/60">Total Amount</p>
            <p className="text-5xl font-black text-green-300">
              {money(total)}
            </p>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-8">
          <h2 className="text-3xl font-black">Submit Payment</h2>
          <p className="mt-2 text-white/70">
            Enter the payment reference from GCash, Maya, bank transfer, or
            acknowledgement receipt.
          </p>

          <div className="mt-8 space-y-4">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Registered email"
              className="w-full rounded-2xl border border-white/10 bg-white px-5 py-4 font-semibold text-slate-900 outline-none"
            />

            <input
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="Payment reference / receipt no."
              className="w-full rounded-2xl border border-white/10 bg-white px-5 py-4 font-semibold text-slate-900 outline-none"
            />

            {message && (
              <div className="rounded-2xl bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">
                {message}
              </div>
            )}

            <button
              onClick={submitPurchase}
              disabled={loading}
              className="w-full rounded-2xl bg-green-500 px-6 py-4 text-lg font-black text-green-950 hover:bg-green-400 disabled:bg-slate-500"
            >
              {loading ? "Submitting..." : "Submit Purchase for Approval"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}