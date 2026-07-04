"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { getRoleRoute, saveSurSession } from "../lib/auth/session";

type Profile = {
  id: string;
  full_name: string | null;
  email: string;
  role: string | null;
  account_status: string | null;
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogin() {
    setMessage("");
    setLoading(true);

    const cleanEmail = email.toLowerCase().trim();

    if (!cleanEmail) {
      setMessage("Enter your registered email.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, account_status")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    if (!data) {
      setMessage("Profile not found. Please register first.");
      setLoading(false);
      return;
    }

    const profile = data as Profile;

    saveSurSession({
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role,
      account_status: profile.account_status,
    });

    window.location.href = getRoleRoute(profile.role);
  }

  return (
    <main className="min-h-screen bg-[#06170f] p-6 text-white">
      <section className="mx-auto flex min-h-screen max-w-xl flex-col justify-center">
        <p className="text-xs font-black uppercase tracking-[0.35em] text-green-300">
          SUR ALOESWOOD
        </p>

        <h1 className="mt-4 text-4xl font-black">Login</h1>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.06] p-6">
          <label className="text-sm font-black text-green-100">Registered Email</label>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleLogin();
            }}
            className="mt-3 w-full rounded-2xl bg-white px-5 py-4 font-bold text-slate-900 outline-none"
            placeholder="email@example.com"
          />

          {message && (
            <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 p-4 text-sm font-bold text-yellow-100">
              {message}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="mt-5 w-full rounded-2xl bg-green-500 px-6 py-4 font-black text-green-950 disabled:bg-slate-500"
          >
            {loading ? "Checking..." : "Login"}
          </button>

          <a href="/register" className="mt-5 block text-center text-sm font-bold text-green-200">
            Create account
          </a>
        </div>
      </section>
    </main>
  );
}
