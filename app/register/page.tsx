"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { saveSurSession } from "../lib/auth/session";

function makeReferralCode(fullName: string) {
  const prefix = fullName.replace(/[^a-zA-Z]/g, "").slice(0, 4).toUpperCase() || "SUR";
  return `${prefix}${Math.floor(100000 + Math.random() * 900000)}`;
}

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [referredBy, setReferredBy] = useState("");
  const [providerName, setProviderName] = useState("GCash");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleRegister() {
    setMessage("");
    setLoading(true);

    const cleanEmail = email.toLowerCase().trim();

    if (!fullName.trim() || !cleanEmail || !mobile.trim()) {
      setMessage("Full name, email, and mobile are required.");
      setLoading(false);
      return;
    }

    const { data: existing, error: existingError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (existingError) {
      setMessage(existingError.message);
      setLoading(false);
      return;
    }

    if (existing) {
      setMessage("Email is already registered. Please login.");
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .insert({
        full_name: fullName.trim(),
        email: cleanEmail,
        mobile,
        mobile_number: mobile,
        address,
        role: "COPLANTER",
        membership_status: "PENDING",
        account_status: "PENDING",
        kyc_status: "PENDING",
        wallet_balance: 0,
        referral_code: makeReferralCode(fullName),
        referred_by: referredBy.trim() || null,
      })
      .select("id, full_name, email, role, account_status")
      .single();

    if (profileError) {
      setMessage(profileError.message);
      setLoading(false);
      return;
    }

    await supabase.from("wallets").insert({
      profile_id: profile.id,
      balance: 0,
    });

    if (accountName.trim() && accountNumber.trim()) {
      await supabase.from("linked_accounts").insert({
        profile_id: profile.id,
        account_type: "PAYOUT",
        provider_name: providerName,
        account_name: accountName.trim(),
        account_number: accountNumber.trim(),
        status: "PENDING",
      });
    }

    saveSurSession({
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role,
      account_status: profile.account_status,
    });

    window.location.href = "/investor/dashboard";
  }

  return (
    <main className="min-h-screen bg-[#06170f] p-6 text-white">
      <section className="mx-auto max-w-3xl py-10">
        <p className="text-xs font-black uppercase tracking-[0.35em] text-green-300">
          SUR ALOESWOOD
        </p>

        <h1 className="mt-4 text-4xl font-black">Register Co-Planter</h1>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.06] p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Full Name" value={fullName} setValue={setFullName} />
            <Field label="Email" value={email} setValue={setEmail} />
            <Field label="Mobile" value={mobile} setValue={setMobile} />
            <Field label="Referred By" value={referredBy} setValue={setReferredBy} />
          </div>

          <label className="mt-4 block text-sm font-black text-green-100">Address</label>
          <textarea
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            className="mt-3 w-full rounded-2xl bg-white px-5 py-4 font-bold text-slate-900 outline-none"
            rows={3}
          />

          <h2 className="mt-8 text-2xl font-black">Payout Account</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-black text-green-100">Provider</label>
              <select
                value={providerName}
                onChange={(event) => setProviderName(event.target.value)}
                className="mt-3 w-full rounded-2xl bg-white px-5 py-4 font-bold text-slate-900 outline-none"
              >
                <option>GCash</option>
                <option>Maya</option>
                <option>Bank</option>
              </select>
            </div>
            <Field label="Account Name" value={accountName} setValue={setAccountName} />
            <Field label="Account Number" value={accountNumber} setValue={setAccountNumber} />
          </div>

          {message && (
            <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 p-4 text-sm font-bold text-yellow-100">
              {message}
            </div>
          )}

          <button
            onClick={handleRegister}
            disabled={loading}
            className="mt-6 w-full rounded-2xl bg-green-500 px-6 py-4 font-black text-green-950 disabled:bg-slate-500"
          >
            {loading ? "Creating..." : "Create Account"}
          </button>

          <a href="/login" className="mt-5 block text-center text-sm font-bold text-green-200">
            Already registered? Login
          </a>
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  setValue,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-sm font-black text-green-100">{label}</label>
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="mt-3 w-full rounded-2xl bg-white px-5 py-4 font-bold text-slate-900 outline-none"
      />
    </div>
  );
}
