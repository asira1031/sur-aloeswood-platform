"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase/client";
import {
  clearSurSession,
  getRoleRoute,
  saveSurSession,
} from "@/app/lib/auth/session";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  const handleLogin = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setMessage("");

    const cleanEmail = email.toLowerCase().trim();

    if (!cleanEmail || !password) {
      setMessage("Please enter your email and password.");
      return;
    }

    setLoading(true);
    clearSurSession();

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (signInError) {
      setLoading(false);
      setMessage(signInError.message || "Invalid email or password.");
      return;
    }

    const authEmail = signInData.user?.email?.toLowerCase().trim() || cleanEmail;
    const candidateEmails = Array.from(new Set([cleanEmail, authEmail].filter(Boolean)));

    const { data: profileByAuthUserId, error: authProfileError } = await supabase
      .from("profiles")
      .select("id,email,full_name,role,account_status,kyc_status")
      .eq("auth_user_id", signInData.user.id)
      .maybeSingle();

    if (authProfileError) {
      await supabase.auth.signOut();
      clearSurSession();
      setLoading(false);
      setMessage(authProfileError.message);
      return;
    }

    const { data: profiles, error: profileError } = profileByAuthUserId
      ? { data: [], error: null }
      : await supabase
          .from("profiles")
          .select("id,email,full_name,role,account_status,kyc_status")
          .in("email", candidateEmails);

    const profile =
      profileByAuthUserId ||
      profiles?.find((row) => String(row.email || "").toLowerCase().trim() === authEmail) ||
      profiles?.find((row) => String(row.email || "").toLowerCase().trim() === cleanEmail) ||
      null;

    setLoading(false);

    if (profileError) {
      await supabase.auth.signOut();
      clearSurSession();
      setMessage(profileError.message);
      return;
    }

    if (!profile) {
      await supabase.auth.signOut();
      clearSurSession();
      setMessage(`Account profile not found for ${candidateEmails.join(" / ")}. Please contact admin support.`);
      return;
    }

    const accountStatus = String(profile.account_status || "PENDING").toUpperCase();

    if (["PENDING", "UNDER_REVIEW"].includes(accountStatus)) {
      await supabase.auth.signOut();
      clearSurSession();
      setMessage("Your account is pending admin approval. Please login again after review.");
      return;
    }

    if (["SUSPENDED", "BLOCKED", "REJECTED"].includes(accountStatus)) {
      await supabase.auth.signOut();
      clearSurSession();
      setMessage("Your account cannot access the platform right now. Please contact support.");
      return;
    }

    saveSurSession(profile);
    router.push(getRoleRoute(profile.role));
  };

  const handleForgotPassword = async () => {
    setMessage("");
    const cleanEmail = email.toLowerCase().trim();

    if (!cleanEmail) {
      setMessage("Enter your email first, then click Forgot password.");
      return;
    }

    setResettingPassword(true);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id,email,account_status")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (profileError) {
      setResettingPassword(false);
      setMessage(profileError.message);
      return;
    }

    if (!profile) {
      setResettingPassword(false);
      setMessage("No account profile found for this email.");
      return;
    }

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/login`
        : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo,
    });

    setResettingPassword(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Password reset link sent. Please check your email inbox.");
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-green-950 text-white">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/forest-bg.jpg')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-green-950/85 via-green-950/55 to-blue-950/45" />

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
              Co-Planter Management Platform
            </p>
          </div>
        </Link>

        <Link
          href="/register"
          className="rounded-full bg-green-600 px-6 py-3 font-bold text-white shadow-lg hover:bg-green-700"
        >
          Register
        </Link>
      </nav>

      <section className="relative z-10 mx-auto grid min-h-[80vh] max-w-7xl items-center gap-12 px-8 lg:grid-cols-2 lg:px-16">
        <div>
          <p className="inline-flex rounded-full bg-white/15 px-5 py-2 text-sm font-bold text-green-100 backdrop-blur">
            Secure Access Portal
          </p>

          <h2 className="mt-6 text-5xl font-black leading-tight lg:text-7xl">
            Welcome back,
            <span className="block text-green-300">Co-Planter.</span>
          </h2>

          <p className="mt-6 max-w-xl text-lg leading-8 text-green-50/90">
            Access your wallet, tree portfolio, digital certificates, plantation
            monitoring, referral records, recovery fund, and support center.
          </p>
        </div>

        <div className="rounded-[2rem] border border-white/20 bg-white/95 p-8 text-slate-900 shadow-2xl backdrop-blur-xl">
          <h3 className="text-3xl font-black text-blue-950">
            Login to Platform
          </h3>
          <p className="mt-2 text-slate-500">
            Use one secure login for Admin, Co-Planter, and Farmer access.
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleLogin}>
            <div>
              <label className="text-sm font-bold text-slate-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 outline-none focus:border-green-600"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 outline-none focus:border-green-600"
              />
            </div>

            {message && (
              <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-green-600 px-6 py-4 text-lg font-black text-white shadow-xl hover:bg-green-700 disabled:bg-slate-400"
            >
              {loading ? "Signing In..." : "Login to Dashboard"}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between text-sm font-semibold">
            <Link href="/register" className="text-green-700 hover:underline">
              Create account
            </Link>
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={resettingPassword}
              className="text-slate-500 hover:underline disabled:opacity-60"
            >
              {resettingPassword ? "Sending..." : "Forgot password?"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
