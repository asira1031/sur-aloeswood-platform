"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import {
  formatDate,
  settingOptions,
  statusClass,
  type AnyRow,
} from "@/app/lib/settings/preferences";

type ThemeMode = "FOREST" | "LIGHT" | "GOLD";
type DensityMode = "COMFORTABLE" | "COMPACT";

const themeCards: Array<{
  value: ThemeMode;
  title: string;
  description: string;
  swatch: string;
}> = [
  {
    value: "FOREST",
    title: "Forest",
    description: "Plantation green, calm panels, premium organic feel.",
    swatch: "from-emerald-700 via-emerald-400 to-lime-200",
  },
  {
    value: "LIGHT",
    title: "Clean",
    description: "Bright workspace for daily account review.",
    swatch: "from-slate-900 via-slate-400 to-white",
  },
  {
    value: "GOLD",
    title: "Gold",
    description: "Warm investor tone with gold accent controls.",
    swatch: "from-amber-600 via-amber-300 to-emerald-200",
  },
];

export default function InvestorSettingsPage() {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<AnyRow | null>(null);
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [notificationMode, setNotificationMode] = useState("ALL");
  const [supportPriority, setSupportPriority] = useState("NORMAL");
  const [themeMode, setThemeMode] = useState<ThemeMode>("FOREST");
  const [dashboardDensity, setDashboardDensity] = useState<DensityMode>("COMFORTABLE");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("sur_login_email") || "";
    const savedNotification = localStorage.getItem("sur_notification_mode");
    const savedPriority = localStorage.getItem("sur_support_priority");
    const savedTheme = localStorage.getItem("sur_theme_mode") as ThemeMode | null;
    const savedDensity = localStorage.getItem("sur_dashboard_density") as DensityMode | null;

    setEmail(saved);
    if (savedNotification) setNotificationMode(savedNotification);
    if (savedPriority) setSupportPriority(savedPriority);
    if (savedTheme && themeCards.some((theme) => theme.value === savedTheme)) setThemeMode(savedTheme);
    if (savedDensity === "COMFORTABLE" || savedDensity === "COMPACT") setDashboardDensity(savedDensity);
    if (saved) loadSettings(saved);
  }, []);

  async function loadSettings(targetEmail = email) {
    setMessage("");
    const cleanEmail = targetEmail.toLowerCase().trim();

    if (!cleanEmail) {
      setMessage("Enter the registered email you used for your co-planter account.");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, full_name, email, mobile_number, mobile, address, role, membership_status, wallet_balance, created_at, account_status, kyc_status, referral_code, referred_by"
      )
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

    setMessage("Profile saved.");
    await loadSettings(profile.email);
  }

  function saveLocalPreferences() {
    localStorage.setItem("sur_notification_mode", notificationMode);
    localStorage.setItem("sur_support_priority", supportPriority);
    localStorage.setItem("sur_theme_mode", themeMode);
    localStorage.setItem("sur_dashboard_density", dashboardDensity);
    setMessage("Dashboard preferences saved.");
  }

  function logout() {
    localStorage.removeItem("sur_login_email");
    localStorage.removeItem("sur_profile_id");
    localStorage.removeItem("sur_role");
    window.location.href = "/login";
  }

  return (
    <main className="min-h-screen bg-[#f3f7f1] text-slate-950">
      <section className="px-4 py-4 lg:px-6">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/20 p-6 shadow-sm lg:p-8">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/forest-bg.jpg')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-green-950/88 via-green-900/60 to-green-950/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-white/70">
                Account Preferences
              </p>
              <h1 className="mt-4 text-4xl font-black text-white lg:text-6xl">
                Settings
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78 lg:text-base">
                Manage your profile details, dashboard design, notification style, and support defaults.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 hover:bg-white/90" href="/investor/dashboard">
                Dashboard
              </Link>
              <Link className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur hover:bg-white/20" href="/investor/support">
                Support
              </Link>
              <button
                onClick={logout}
                className="rounded-2xl border border-red-200/50 bg-red-500/90 px-5 py-3 text-sm font-black text-white backdrop-blur hover:bg-red-600"
              >
                Logout
              </button>
            </div>
          </div>

          {message && (
            <div className="relative z-10 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
              {message}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 px-4 pb-5 md:grid-cols-3 lg:px-6">
        <StatusCard label="Account" value={profile?.account_status || "PENDING"} />
        <StatusCard label="KYC" value={profile?.kyc_status || "PENDING"} />
        <StatusCard label="Member Since" value={formatDate(profile?.created_at)} plain />
      </section>

      <section className="grid gap-5 px-4 pb-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-6">
        <div className="space-y-5">
          <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-2xl font-black">Profile Details</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  These details help admin support verify your account.
                </p>
              </div>
              <Badge value={profile?.membership_status || "PENDING"} />
            </div>

            <div className="mt-5 grid gap-4">
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Full name"
                className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500"
              />
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  value={mobile}
                  onChange={(event) => setMobile(event.target.value)}
                  placeholder="Mobile"
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500"
                />
                <input
                  value={profile?.email || email}
                  readOnly
                  placeholder="Email"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-bold text-slate-500 outline-none"
                />
              </div>
              <textarea
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                rows={4}
                placeholder="Address"
                className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500"
              />
              <button
                onClick={saveProfile}
                className="rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black text-white hover:bg-emerald-700"
              >
                Save Profile
              </button>
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
            <h2 className="text-2xl font-black">Dashboard Design</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Pick the dashboard look that feels best for your daily review.
            </p>

            <div className="mt-5 grid gap-3">
              {themeCards.map((theme) => (
                <button
                  key={theme.value}
                  onClick={() => setThemeMode(theme.value)}
                  className={`grid gap-4 rounded-2xl border p-4 text-left transition md:grid-cols-[88px_1fr] ${
                    themeMode === theme.value
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-slate-200 bg-white hover:border-emerald-200"
                  }`}
                >
                  <span className={`h-16 rounded-2xl bg-gradient-to-br ${theme.swatch}`} />
                  <span>
                    <span className="block text-lg font-black text-slate-950">{theme.title}</span>
                    <span className="mt-1 block text-sm leading-6 text-slate-500">{theme.description}</span>
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {settingOptions.dashboardDensity.map((item) => (
                <button
                  key={item}
                  onClick={() => setDashboardDensity(item as DensityMode)}
                  className={`rounded-2xl border px-5 py-4 text-left text-sm font-black ${
                    dashboardDensity === item
                      ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {item === "COMFORTABLE" ? "Comfortable Cards" : "Compact Cards"}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
            <h2 className="text-2xl font-black">Notifications & Support</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Set how this device remembers your dashboard support defaults.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Notification Mode">
                <select
                  value={notificationMode}
                  onChange={(event) => setNotificationMode(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500"
                >
                  {settingOptions.notificationMode.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </Field>
              <Field label="Support Priority">
                <select
                  value={supportPriority}
                  onChange={(event) => setSupportPriority(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500"
                >
                  {settingOptions.supportPriority.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </Field>
            </div>

            <button
              onClick={saveLocalPreferences}
              className="mt-5 w-full rounded-2xl bg-amber-400 px-6 py-4 text-sm font-black text-amber-950 hover:bg-amber-300"
            >
              Save Dashboard Preferences
            </button>
          </section>
        </div>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function StatusCard({
  label,
  value,
  plain,
}: {
  label: string;
  value: string;
  plain?: boolean;
}) {
  return (
    <div className="rounded-[1.5rem] border border-emerald-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-3">
        {plain ? <p className="text-xl font-black text-slate-950">{value}</p> : <Badge value={value} />}
      </div>
    </div>
  );
}

function Badge({ value }: { value?: string | null }) {
  const display = value || "PENDING";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClass(display)}`}>
      {display}
    </span>
  );
}
