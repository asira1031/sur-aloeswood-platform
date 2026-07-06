"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { saveSurSession } from "@/app/lib/auth/session";

type Profile = {
  id: string;
  full_name: string | null;
  email: string;
  role: string | null;
  account_status: string | null;
};

const ADMIN_WHITELIST = [
  "asira1031@gmail.com",
  "direktny1@gmail.com",
  "ymbcareerdevelopment@gmail.com",
  "rozendalerepolidon424@gmail.com",
  "donnabelabaloscabrido72@gmail.com",
];

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function loginWhitelistedAdmin(cleanEmail: string) {
    saveSurSession({
      id: `local-admin-${cleanEmail}`,
      email: cleanEmail,
      full_name: "SUR Administrator",
      role: "admin",
      account_status: "ACTIVE",
    });

    window.location.href = "/admin/dashboard";
  }

  async function handleLogin() {
    setMessage("");
    setLoading(true);

    const cleanEmail = email.toLowerCase().trim();

    if (!cleanEmail) {
      setMessage("Enter your admin email.");
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
      if (ADMIN_WHITELIST.includes(cleanEmail)) {
        loginWhitelistedAdmin(cleanEmail);
        return;
      }

      setMessage("Admin profile not found.");
      setLoading(false);
      return;
    }

    const profile = data as Profile;
    const role = String(profile.role || "").toLowerCase();
    const status = String(profile.account_status || "").toLowerCase();

    if (!["admin", "super_admin", "administrator"].includes(role)) {
      if (ADMIN_WHITELIST.includes(cleanEmail)) {
        loginWhitelistedAdmin(cleanEmail);
        return;
      }

      setMessage("This email is not authorized for Admin access.");
      setLoading(false);
      return;
    }

    if (status === "suspended") {
      setMessage("This admin account is suspended.");
      setLoading(false);
      return;
    }

    saveSurSession({
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role,
      account_status: profile.account_status,
    });

    window.location.href = "/admin/dashboard";
  }

  return (
    <main className="min-h-screen bg-[#06170f] p-6 text-white">
      <section className="mx-auto flex min-h-screen max-w-xl flex-col justify-center">
        <p className="text-xs font-black uppercase tracking-[0.35em] text-green-300">
          SUR ALOESWOOD
        </p>

        <h1 className="mt-4 text-4xl font-black">Admin Login</h1>
        <p className="mt-3 text-sm font-semibold text-white/60">
          Authorized admin access only.
        </p>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.06] p-6">
          <label className="text-sm font-black text-green-100">
            Admin Email
          </label>

          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleLogin();
            }}
            className="mt-3 w-full rounded-2xl bg-white px-5 py-4 font-bold text-slate-900 outline-none"
            placeholder="admin@example.com"
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
            {loading ? "Checking..." : "Login as Admin"}
          </button>

          <div className="mt-5 flex justify-between text-sm font-bold">
            <Link href="/" className="text-green-200 hover:text-white">
              Back Home
            </Link>
            <Link href="/login" className="text-green-200 hover:text-white">
              Co-Planter Login
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}