"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";

function makeReferralCode(fullName: string) {
  const base = fullName
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 4)
    .toUpperCase();

  const random = Math.floor(100000 + Math.random() * 900000);
  return `${base || "SUR"}${random}`;
}

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [referredBy, setReferredBy] = useState("");

  const [accountType, setAccountType] = useState("GCash");
  const [providerName, setProviderName] = useState("GCash");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  const [agree, setAgree] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const referralCode = useMemo(() => makeReferralCode(fullName), [fullName]);

  const handleRegister = async () => {
    setMessage("");

    if (!fullName || !email || !mobile || !address) {
      setMessage("Please complete your personal information.");
      return;
    }

    if (!accountName || !accountNumber) {
      setMessage("Please add your Bank / GCash / Maya account.");
      return;
    }

    if (!agree) {
      setMessage("Please confirm the co-planter agreement.");
      return;
    }
setLoading(true);

const cleanEmail = email.toLowerCase().trim();

const { data: existing } = await supabase
  .from("profiles")
  .select("id")
  .eq("email", cleanEmail)
  .maybeSingle();

if (existing) {
  setLoading(false);
  setMessage("Email already registered. Please login.");
  return;
}

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .insert({
        full_name: fullName,
        email: cleanEmail,
        mobile,
        address,
        role: "COPLANTER",
        kyc_status: "PENDING",
        account_status: "PENDING",
        referral_code: referralCode,
        referred_by: referredBy || null,
      })
      .select()
      .single();

    if (profileError || !profile) {
      setLoading(false);
      setMessage(profileError?.message || "Unable to create profile.");
      return;
    }

    const { error: walletError } = await supabase.from("wallets").insert({
      profile_id: profile.id,
      balance: 0,
      recovery_balance: 0,
      harvest_balance: 0,
    });

    if (walletError) {
      setLoading(false);
      setMessage(walletError.message);
      return;
    }

    const { error: linkedError } = await supabase
      .from("linked_accounts")
      .insert({
        profile_id: profile.id,
        account_type: accountType,
        provider_name: providerName,
        account_name: accountName,
        account_number: accountNumber,
        status: "PENDING",
      });

    setLoading(false);

    if (linkedError) {
      setMessage(linkedError.message);
      return;
    }

    setMessage(
      `Registration successful. Your referral code is ${referralCode}. Please login after admin approval.`
    );

    setFullName("");
    setEmail("");
    setMobile("");
    setAddress("");
    setReferredBy("");
    setAccountName("");
    setAccountNumber("");
    setAgree(false);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-green-950 text-white">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/forest-bg.jpg')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-green-950/90 via-green-950/65 to-blue-950/60" />

      <nav className="relative z-10 flex items-center justify-between px-8 py-6 lg:px-16">
        <Link href="/" className="flex items-center gap-4">
          <img
            src="/agarwood.png"
            alt="SUR Aloeswood"
            className="h-14 w-14 rounded-2xl object-cover shadow-lg"
          />
          <div>
            <h1 className="text-2xl font-black tracking-wide">
              SUR ALOESWOOD
            </h1>
            <p className="text-sm font-semibold text-green-200">
              Fintech Co-Planter Platform
            </p>
          </div>
        </Link>

        <Link
          href="/login"
          className="rounded-full border border-white/40 bg-white/15 px-6 py-3 font-bold text-white shadow-lg backdrop-blur hover:bg-white/25"
        >
          Login
        </Link>
      </nav>

      <section className="relative z-10 mx-auto grid max-w-7xl gap-10 px-8 pb-16 lg:grid-cols-[0.9fr_1.1fr] lg:px-16">
        <div className="pt-10">
          <p className="inline-flex rounded-full bg-white/15 px-5 py-2 text-sm font-bold text-green-100 backdrop-blur">
            Official Co-Planter Registration
          </p>

          <h2 className="mt-6 text-5xl font-black leading-tight lg:text-7xl">
            Start your
            <span className="block text-green-300">Agarwood journey.</span>
          </h2>

          <p className="mt-6 max-w-xl text-lg leading-8 text-green-50/90">
            Register for wallet access, tree monitoring, referral tracking,
            digital certificates, recovery fund, maintenance payments, and
            plantation updates.
          </p>

          <div className="mt-8 rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur">
            <p className="text-sm font-bold text-green-200">
              Program Reminder
            </p>
            <p className="mt-2 text-sm leading-7 text-white/85">
              This is a co-planting and plantation management platform. It is
              not a deposit-taking, savings, lending, or guaranteed investment
              program.
            </p>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/20 bg-white/95 p-8 text-slate-900 shadow-2xl backdrop-blur-xl">
          <h3 className="text-3xl font-black text-blue-950">
            Create Co-Planter Account
          </h3>
          <p className="mt-2 text-slate-500">
            Complete personal details and linked payment account.
          </p>

          <form className="mt-8 space-y-6">
            <div>
              <h4 className="mb-4 text-lg font-black text-green-800">
                1. Personal Information
              </h4>

              <div className="grid gap-4 md:grid-cols-2">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full name"
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-4 outline-none focus:border-green-600"
                />

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-4 outline-none focus:border-green-600"
                />

                <input
                  type="text"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="Mobile number"
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-4 outline-none focus:border-green-600"
                />

                <input
                  type="text"
                  value={referredBy}
                  onChange={(e) => setReferredBy(e.target.value)}
                  placeholder="Referral code optional"
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-4 outline-none focus:border-green-600"
                />
              </div>

              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Complete address"
                className="mt-4 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 outline-none focus:border-green-600"
              />
            </div>

            <div>
              <h4 className="mb-4 text-lg font-black text-green-800">
                2. Linked Bank / GCash / Maya
              </h4>

              <div className="grid gap-4 md:grid-cols-2">
                <select
                  value={accountType}
                  onChange={(e) => {
                    setAccountType(e.target.value);
                    setProviderName(e.target.value);
                  }}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-4 outline-none focus:border-green-600"
                >
                  <option>GCash</option>
                  <option>Maya</option>
                  <option>Bank</option>
                </select>

                <input
                  type="text"
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                  placeholder="Provider name e.g. BDO, BPI, GCash"
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-4 outline-none focus:border-green-600"
                />

                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Account name"
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-4 outline-none focus:border-green-600"
                />

                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="Account number / mobile number"
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-4 outline-none focus:border-green-600"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
              <label className="flex gap-3 text-sm font-semibold text-green-900">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  I confirm that I am applying as a SUR Aloeswood Co-Planter
                  and understand that returns depend on actual plantation
                  performance, harvest results, market conditions, and
                  applicable laws.
                </span>
              </label>
            </div>

            {message && (
              <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">
                {message}
              </div>
            )}

            <button
              type="button"
              onClick={handleRegister}
              disabled={loading}
              className="w-full rounded-2xl bg-green-600 px-6 py-4 text-lg font-black text-white shadow-xl hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {loading ? "Creating Account..." : "Create Co-Planter Account"}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="font-bold text-green-700">
              Login here
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}