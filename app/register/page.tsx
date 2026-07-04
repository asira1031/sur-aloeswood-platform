"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";

function makeReferralCode(name: string) {
  const prefix = String(name || "SUR").replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4).padEnd(4, "X");
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}${rand}`;
}

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [linkedType, setLinkedType] = useState("GCASH");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [referredBy, setReferredBy] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const referralFromUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("ref") || "";
  }, []);

  async function register() {
    setMessage("");
    const cleanEmail = email.toLowerCase().trim();

    if (!fullName.trim() || !cleanEmail) {
      setMessage("Full name and email are required.");
      return;
    }

    setBusy(true);
    const referralCode = makeReferralCode(fullName);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .insert({
        full_name: fullName.trim(),
        email: cleanEmail,
        mobile_number: mobile.trim() || null,
        mobile: mobile.trim() || null,
        address: address.trim() || null,
        role: "COPLANTER",
        account_status: "PENDING",
        kyc_status: "PENDING",
        membership_status: "PENDING",
        wallet_balance: 0,
        referral_code: referralCode,
        referred_by: referredBy.trim() || referralFromUrl || null,
      })
      .select("id, full_name, email, referral_code")
      .maybeSingle();

    if (profileError || !profile) {
      setMessage(profileError?.message || "Registration failed.");
      setBusy(false);
      return;
    }

    await supabase.from("wallets").insert({ profile_id: profile.id, balance: 0 });

    if (accountName.trim() || accountNumber.trim()) {
      await supabase.from("linked_accounts").insert({
        profile_id: profile.id,
        account_type: linkedType,
        provider_name: linkedType,
        account_name: accountName.trim() || fullName.trim(),
        account_number: accountNumber.trim() || null,
        status: "PENDING",
      });
    }

    await supabase.from("notifications").insert({
      profile_id: profile.id,
      title: "Registration submitted",
      message: "Your co-planter account was created and is pending admin approval.",
      is_read: false,
    });

    localStorage.setItem("sur_login_email", profile.email);
    localStorage.setItem("sur_profile_id", profile.id);
    setMessage(`Registration submitted. Referral code: ${profile.referral_code}.`);
    setBusy(false);
  }

  return (
    <main className="min-h-screen bg-[#06170f] px-6 py-10 text-white lg:px-14">
      <section className="mx-auto max-w-5xl">
        <p className="text-sm font-black uppercase tracking-[0.3em] text-green-300">SUR ALOESWOOD</p>
        <h1 className="mt-3 text-4xl font-black lg:text-6xl">Create Co-Planter Account</h1>
        <p className="mt-3 max-w-3xl text-green-100/80">Register as a co-planter. Your account, KYC and linked account start as pending for admin review.</p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
            <h2 className="text-2xl font-black">Profile Details</h2>
            <div className="mt-5 grid gap-4">
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
              <input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="Mobile number" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={4} placeholder="Address" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
              <input value={referredBy || referralFromUrl} onChange={(e) => setReferredBy(e.target.value)} placeholder="Referral code optional" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
              <h2 className="text-2xl font-black">Linked Account</h2>
              <div className="mt-5 grid gap-4">
                <select value={linkedType} onChange={(e) => setLinkedType(e.target.value)} className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none">
                  <option>GCASH</option>
                  <option>MAYA</option>
                  <option>BANK</option>
                </select>
                <input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Account name" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
                <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Account number" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
              <h2 className="text-2xl font-black">Rules</h2>
              <div className="mt-4 space-y-2 text-sm leading-6 text-white/70">
                <p>Account starts as PENDING.</p>
                <p>KYC starts as PENDING.</p>
                <p>Wallet is created automatically.</p>
                <p>Seedling price is ₱14,000 per tree.</p>
                <p>No guaranteed returns.</p>
              </div>
            </div>
          </div>
        </div>

        {message && <div className="mt-6 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}

        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={register} disabled={busy} className="rounded-2xl bg-green-500 px-8 py-4 text-sm font-black text-green-950 disabled:bg-slate-500">{busy ? "Submitting..." : "Create Account"}</button>
          <Link href="/login" className="rounded-2xl border border-white/10 bg-white/10 px-8 py-4 text-sm font-black">Back to Login</Link>
        </div>
      </section>
    </main>
  );
}
