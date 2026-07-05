"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase/client";
import { getRoleRoute, saveSurSession } from "@/app/lib/auth/session";

export default function SetPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const { data } = await supabase.auth.getSession();

      if (!mounted) return;

      setEmail(data.session?.user.email || "");
      setLoading(false);

      if (!data.session?.user.email) {
        setMessage("Open this page from the registration email so we can verify your account.");
      }
    }

    loadSession();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!email) {
      setMessage("Registration session not found. Please open the latest email invite.");
      return;
    }

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setSaving(true);

    const { error: passwordError } = await supabase.auth.updateUser({ password });

    if (passwordError) {
      setSaving(false);
      setMessage(passwordError.message);
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id,email,full_name,role,account_status,kyc_status")
      .eq("email", cleanEmail)
      .maybeSingle();

    setSaving(false);

    if (profileError) {
      setMessage(profileError.message);
      return;
    }

    if (!profile) {
      setMessage("Password saved, but profile was not found. Please contact admin.");
      return;
    }

    saveSurSession(profile);
    router.push(getRoleRoute(profile.role));
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-green-950 text-white">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/forest-bg.jpg')" }} />
      <div className="absolute inset-0 bg-gradient-to-r from-green-950/88 via-green-950/58 to-blue-950/42" />

      <nav className="relative z-10 flex items-center justify-between px-6 py-5 lg:px-14">
        <Link href="/" className="flex items-center gap-3">
          <img src="/agarwood.png" alt="SUR Aloeswood" className="h-12 w-12 rounded-2xl object-cover shadow-lg" />
          <div>
            <h1 className="text-xl font-black tracking-wide">SUR ALOESWOOD</h1>
            <p className="text-xs font-bold text-green-200">Farmer Account Setup</p>
          </div>
        </Link>
        <Link href="/login" className="rounded-full bg-white px-5 py-3 text-sm font-black text-green-950 shadow-sm">
          Login
        </Link>
      </nav>

      <section className="relative z-10 mx-auto flex min-h-[78vh] max-w-6xl items-center px-6 py-8 lg:px-14">
        <div className="w-full max-w-xl rounded-[2rem] border border-white/20 bg-white/95 p-7 text-slate-950 shadow-2xl backdrop-blur-xl lg:p-9">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-700">Secure Farmer Invite</p>
          <h2 className="mt-4 text-4xl font-black text-blue-950">Set your password</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Create your password once. After this, you can login from the main platform and it will open your Farmer dashboard.
          </p>

          <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="text-sm font-bold text-slate-700">Verified email</label>
              <input
                value={loading ? "Checking registration session..." : email}
                readOnly
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-bold text-slate-700 outline-none"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">New password</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 outline-none focus:border-green-600"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 outline-none focus:border-green-600"
              />
            </div>

            {message && (
              <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || saving || !email}
              className="w-full rounded-2xl bg-green-600 px-6 py-4 text-lg font-black text-white shadow-xl hover:bg-green-700 disabled:bg-slate-400"
            >
              {saving ? "Saving..." : "Save Password"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
