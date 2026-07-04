"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { formatDate, settingOptions, statusClass, type AnyRow } from "@/app/lib/settings/preferences";

export default function InvestorSettingsPage() {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<AnyRow | null>(null);
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [notificationMode, setNotificationMode] = useState("ALL");
  const [supportPriority, setSupportPriority] = useState("NORMAL");
  const [themeMode, setThemeMode] = useState("FOREST");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("sur_login_email") || "";
    setEmail(saved);
    if (saved) loadSettings(saved);
  }, []);

  async function loadSettings(targetEmail = email) {
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
      return;
    }

    setProfile(data);
    setFullName(data.full_name || "");
    setMobile(data.mobile || data.mobile_number || "");
    setAddress(data.address || "");
    localStorage.setItem("sur_login_email", cleanEmail);
    localStorage.setItem("sur_profile_id", data.id);
  }

  async function saveProfile() {
    if (!profile) {
      setMessage("Load profile first.");
      return;
    }

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
      return;
    }

    setMessage("Settings saved.");
    await loadSettings(profile.email);
  }

  function saveLocalPreferences() {
    localStorage.setItem("sur_notification_mode", notificationMode);
    localStorage.setItem("sur_support_priority", supportPriority);
    localStorage.setItem("sur_theme_mode", themeMode);
    setMessage("Local preferences saved.");
  }

  function logout() {
    localStorage.removeItem("sur_login_email");
    localStorage.removeItem("sur_profile_id");
    localStorage.removeItem("sur_role");
    window.location.href = "/login";
  }

  return (
    <main className="min-h-screen bg-[#06170f] text-white">
      <section className="border-b border-white/10 bg-gradient-to-r from-green-950 via-emerald-950 to-slate-950 px-6 py-8 lg:px-14">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-green-300">SUR ALOESWOOD CO-PLANTER</p>
            <h1 className="mt-3 text-4xl font-black lg:text-6xl">Settings</h1>
            <p className="mt-3 max-w-3xl text-green-100/80">Manage profile details, local preferences, and account controls.</p>
          </div>
          <Link href="/investor/dashboard" className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black">Dashboard</Link>
        </div>

        <div className="mt-8 grid gap-3 rounded-3xl border border-white/10 bg-white/10 p-4 md:grid-cols-[1fr_auto]">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Registered email" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
          <button onClick={() => loadSettings()} className="rounded-2xl bg-green-500 px-8 py-4 text-sm font-black text-green-950">Load Settings</button>
        </div>

        {message && <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
      </section>

      <section className="grid gap-6 px-6 py-8 lg:grid-cols-[0.8fr_1.2fr] lg:px-14">
        <div className="space-y-6">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6">
            <h2 className="text-2xl font-black">Account Status</h2>
            {!profile ? (
              <Empty text="Load your profile." />
            ) : (
              <div className="mt-5 space-y-3">
                <Info label="Email" value={profile.email || "-"} />
                <Info label="Created" value={formatDate(profile.created_at)} />
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(profile.account_status)}`}>Account: {profile.account_status || "PENDING"}</span>
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(profile.kyc_status)}`}>KYC: {profile.kyc_status || "PENDING"}</span>
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(profile.membership_status)}`}>Membership: {profile.membership_status || "PENDING"}</span>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6">
            <h2 className="text-2xl font-black">Account Controls</h2>
            <div className="mt-5 grid gap-3">
              <Link href="/investor/support" className="rounded-2xl bg-green-500 px-6 py-4 text-center text-sm font-black text-green-950">Open Support</Link>
              <Link href="/investor/notifications" className="rounded-2xl border border-white/10 bg-white/10 px-6 py-4 text-center text-sm font-black">Notifications</Link>
              <button onClick={logout} className="rounded-2xl bg-red-500 px-6 py-4 text-sm font-black text-white">Logout</button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6">
            <h2 className="text-2xl font-black">Profile Settings</h2>
            <div className="mt-5 grid gap-4">
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
              <input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="Mobile" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={4} placeholder="Address" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
              <button onClick={saveProfile} className="rounded-2xl bg-green-500 px-6 py-4 text-sm font-black text-green-950">Save Profile</button>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6">
            <h2 className="text-2xl font-black">Preferences</h2>
            <div className="mt-5 grid gap-4">
              <select value={notificationMode} onChange={(e) => setNotificationMode(e.target.value)} className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none">
                {settingOptions.notificationMode.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select value={supportPriority} onChange={(e) => setSupportPriority(e.target.value)} className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none">
                {settingOptions.supportPriority.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select value={themeMode} onChange={(e) => setThemeMode(e.target.value)} className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none">
                {settingOptions.themeMode.map((item) => <option key={item}>{item}</option>)}
              </select>
              <button onClick={saveLocalPreferences} className="rounded-2xl bg-yellow-400 px-6 py-4 text-sm font-black text-yellow-950">Save Preferences</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 rounded-2xl bg-black/25 px-4 py-3"><span className="text-sm text-white/50">{label}</span><span className="text-right text-sm font-black text-white">{value}</span></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm font-bold text-white/60">{text}</div>;
}
