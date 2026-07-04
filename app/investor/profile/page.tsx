"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { formatDate, statusClass, type AnyRow } from "@/app/lib/coplanting/ui";

export default function ProfilePage() {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<AnyRow | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<AnyRow[]>([]);
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [providerName, setProviderName] = useState("");
  const [accountType, setAccountType] = useState("GCASH");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sur_login_email") || "";
    setEmail(saved);
    if (saved) loadProfile(saved);
  }, []);

  async function loadProfile(targetEmail = email) {
    setLoading(true);
    setMessage("");

    const cleanEmail = targetEmail.toLowerCase().trim();

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, mobile_number, mobile, address, role, membership_status, wallet_balance, created_at, account_status, kyc_status, referral_code, referred_by")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (error || !data) {
      setMessage(error?.message || "Profile not found.");
      setProfile(null);
      setLinkedAccounts([]);
      setLoading(false);
      return;
    }

    const { data: accounts } = await supabase
      .from("linked_accounts")
      .select("id, profile_id, account_type, provider_name, account_name, account_number, status, created_at")
      .eq("profile_id", data.id)
      .order("created_at", { ascending: false });

    setProfile(data);
    setFullName(data.full_name || "");
    setMobile(data.mobile || data.mobile_number || "");
    setAddress(data.address || "");
    setLinkedAccounts((accounts || []) as AnyRow[]);
    localStorage.setItem("sur_login_email", cleanEmail);
    localStorage.setItem("sur_profile_id", data.id);
    setLoading(false);
  }

  async function saveProfile() {
    if (!profile) {
      setMessage("Load profile first.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        mobile: mobile.trim(),
        mobile_number: mobile.trim(),
        address: address.trim(),
      })
      .eq("id", profile.id);

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setMessage("Profile updated.");
    await loadProfile(profile.email);
  }

  async function addLinkedAccount() {
    if (!profile) {
      setMessage("Load profile first.");
      return;
    }

    if (!accountName.trim() || !accountNumber.trim()) {
      setMessage("Complete account name and number.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { error } = await supabase.from("linked_accounts").insert({
      profile_id: profile.id,
      account_type: accountType,
      provider_name: providerName.trim() || accountType,
      account_name: accountName.trim(),
      account_number: accountNumber.trim(),
      status: "PENDING",
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setProviderName("");
    setAccountName("");
    setAccountNumber("");
    setMessage("Linked account submitted for review.");
    await loadProfile(profile.email);
  }

  return (
    <main className="min-h-screen bg-[#06170f] text-white">
      <section className="border-b border-white/10 bg-gradient-to-r from-green-950 via-emerald-950 to-slate-950 px-6 py-8 lg:px-14">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-green-300">SUR Aloeswood</p>
            <h1 className="mt-3 text-4xl font-black lg:text-6xl">Co-Planter Profile</h1>
          </div>
          <Link href="/investor/dashboard" className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black">Dashboard</Link>
        </div>

        <div className="mt-8 grid gap-3 rounded-3xl border border-white/10 bg-white/10 p-4 md:grid-cols-[1fr_auto]">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Registered email" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
          <button onClick={() => loadProfile()} disabled={loading} className="rounded-2xl bg-green-500 px-8 py-4 text-sm font-black text-green-950 disabled:bg-slate-500">{loading ? "Loading..." : "Load Profile"}</button>
        </div>

        {message && <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
      </section>

      <section className="grid gap-6 px-6 py-8 lg:grid-cols-[0.8fr_1.2fr] lg:px-14">
        <div className="space-y-6">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6">
            <h2 className="text-2xl font-black">Account Status</h2>
            {profile ? (
              <div className="mt-5 space-y-3">
                <Info label="Name" value={profile.full_name || "-"} />
                <Info label="Email" value={profile.email || "-"} />
                <Info label="Role" value="Co-Planter" />
                <Info label="Created" value={formatDate(profile.created_at)} />
                <div className="flex flex-wrap gap-2 pt-2">
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(profile.account_status)}`}>Account: {profile.account_status || "PENDING"}</span>
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(profile.kyc_status)}`}>KYC: {profile.kyc_status || "PENDING"}</span>
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(profile.membership_status)}`}>Membership: {profile.membership_status || "PENDING"}</span>
                </div>
              </div>
            ) : <Empty text="Load your profile." />}
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6">
            <h2 className="text-2xl font-black">Linked Accounts</h2>
            <div className="mt-5 space-y-3">
              {linkedAccounts.length === 0 ? <Empty text="No linked accounts yet." /> : linkedAccounts.map((account) => (
                <div key={account.id} className="rounded-2xl bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-green-200">{account.account_type}</p>
                      <p className="text-sm text-white/70">{account.provider_name || "-"}</p>
                      <p className="text-sm text-white/70">{account.account_name || "-"} • {account.account_number || "-"}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(account.status)}`}>{account.status || "PENDING"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6">
            <h2 className="text-2xl font-black">Edit Profile</h2>
            <div className="mt-5 grid gap-4">
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
              <input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="Mobile number" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={4} placeholder="Address" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
              <button onClick={saveProfile} disabled={loading || !profile} className="rounded-2xl bg-green-500 px-6 py-4 text-sm font-black text-green-950 disabled:bg-slate-500">Save Profile</button>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6">
            <h2 className="text-2xl font-black">Add Bank / GCash / Maya</h2>
            <div className="mt-5 grid gap-4">
              <select value={accountType} onChange={(e) => setAccountType(e.target.value)} className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none">
                <option>GCASH</option>
                <option>MAYA</option>
                <option>BANK</option>
              </select>
              <input value={providerName} onChange={(e) => setProviderName(e.target.value)} placeholder="Provider name" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
              <input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Account name" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
              <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Account number" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
              <button onClick={addLinkedAccount} disabled={loading || !profile} className="rounded-2xl bg-yellow-400 px-6 py-4 text-sm font-black text-yellow-950 disabled:bg-slate-500">Submit Linked Account</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 rounded-2xl bg-black/20 px-4 py-3"><span className="text-white/50">{label}</span><span className="text-right font-bold">{value}</span></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm font-bold text-white/60">{text}</div>;
}
