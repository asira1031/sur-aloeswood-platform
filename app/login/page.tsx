"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setMessage("");

    if (!email) {
      setMessage("Please enter your email.");
      return;
    }

    setLoading(true);

    const cleanEmail = email.toLowerCase().trim();

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", cleanEmail)
      .maybeSingle();

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (!profile) {
      setMessage("Account not found. Please register first.");
      return;
    }

    const role = String(profile.role || "COPLANTER").toUpperCase();

    if (role === "ADMIN") {
      router.push("/admin/dashboard");
      return;
    }

    if (role === "GARDENER" || role === "FARMER") {
      router.push("/farmer/dashboard");
      return;
    }

    router.push("/investor/dashboard");
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
              Fintech Co-Planter Platform
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
            monitoring, referral earnings, recovery fund, and support center.
          </p>
        </div>

        <div className="rounded-[2rem] border border-white/20 bg-white/95 p-8 text-slate-900 shadow-2xl backdrop-blur-xl">
          <h3 className="text-3xl font-black text-blue-950">
            Login to Platform
          </h3>
          <p className="mt-2 text-slate-500">
            Enter your registered email address.
          </p>

          <form className="mt-8 space-y-5">
            <div>
              <label className="text-sm font-bold text-slate-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 outline-none focus:border-green-600"
              />
            </div>

            {message && (
              <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {message}
              </div>
            )}

            <button
              type="button"
              onClick={handleLogin}
              disabled={loading}
              className="w-full rounded-2xl bg-green-600 px-6 py-4 text-lg font-black text-white shadow-xl hover:bg-green-700 disabled:bg-slate-400"
            >
              {loading ? "Checking Account..." : "Login to Dashboard"}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between text-sm font-semibold">
            <Link href="/register" className="text-green-700 hover:underline">
              Create account
            </Link>
            <span className="text-slate-400">Password phase next</span>
          </div>
        </div>
      </section>
    </main>
  );
}