"use client";

import Link from "next/link";
import { useState } from "react";
import { saveSurSession } from "@/app/lib/auth/session";

const ADMIN_WHITELIST = [
  "asira1031@gmail.com",
  "direktny1@gmail.com",
  "ymbcareerdevelopment@gmail.com",
  "rozendalerepolidon424@gmail.com",
  "donnabelabaloscabrido72@gmail.com",
];

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  function login() {
    const cleanEmail = email.toLowerCase().trim();

    if (!cleanEmail) {
      setMessage("Please enter your admin email.");
      return;
    }

    if (!ADMIN_WHITELIST.includes(cleanEmail)) {
      setMessage("This email is not authorized for Admin access.");
      return;
    }

    saveSurSession({
      id: `admin-${cleanEmail}`,
      email: cleanEmail,
      full_name: "SUR Administrator",
      role: "ADMIN",
      account_status: "ACTIVE",
    });

    window.location.href = "/admin/dashboard";
  }

  return (
    <main className="min-h-screen bg-[#06170f] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">
        <p className="text-xs font-black uppercase tracking-[0.35em] text-green-300">
          SUR ALOESWOOD
        </p>

        <h1 className="mt-4 text-4xl font-black">
          Admin Login
        </h1>

        <p className="mt-2 text-sm text-white/70">
          Authorized administrators only.
        </p>

        <input
          className="mt-8 w-full rounded-2xl bg-white px-5 py-4 font-bold text-slate-900 outline-none"
          placeholder="Admin Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") login();
          }}
        />

        {message && (
          <div className="mt-4 rounded-2xl bg-red-500/20 p-4 text-sm font-bold text-red-100">
            {message}
          </div>
        )}

        <button
          onClick={login}
          className="mt-6 w-full rounded-2xl bg-green-600 py-4 font-black hover:bg-green-700"
        >
          Login as Admin
        </button>

        <div className="mt-6 flex justify-between text-sm font-bold">
          <Link href="/">Home</Link>
          <Link href="/login">Co-Planter Login</Link>
        </div>
      </div>
    </main>
  );
}