"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { peso, statusClass, type AnyRow } from "@/app/lib/coplanting/ui";

export default function RecoveryPage() {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<AnyRow | null>(null);
  const [transactions, setTransactions] = useState<AnyRow[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("sur_login_email") || "";
    setEmail(saved);
    if (saved) loadRecovery(saved);
  }, []);

  async function loadRecovery(targetEmail = email) {
    setMessage("");
    const cleanEmail = targetEmail.toLowerCase().trim();

    const { data: profileRow, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, account_status, kyc_status")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (error || !profileRow) {
      setMessage(error?.message || "Profile not found.");
      setProfile(null);
      setTransactions([]);
      return;
    }

    const { data: txRows } = await supabase
      .from("wallet_transactions")
      .select("id, profile_id, transaction_type, amount, description, status, created_at")
      .eq("profile_id", profileRow.id)
      .ilike("description", "%recovery%")
      .order("created_at", { ascending: false });

    setProfile(profileRow);
    setTransactions((txRows || []) as AnyRow[]);
    localStorage.setItem("sur_login_email", cleanEmail);
  }

  const recoveryTotal = useMemo(() => Math.min(50000, transactions.filter((t) => String(t.status || "").toUpperCase() !== "REJECTED").reduce((s, t) => s + Math.abs(Number(t.amount || 0)), 0)), [transactions]);

  return (
    <main className="min-h-screen bg-[#06170f] text-white">
      <section className="border-b border-white/10 bg-gradient-to-r from-green-950 via-emerald-950 to-slate-950 px-6 py-8 lg:px-14">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-green-300">SUR Aloeswood</p>
            <h1 className="mt-3 text-4xl font-black lg:text-6xl">Recovery Fund</h1>
            <p className="mt-3 max-w-3xl text-green-100/80">Recovery fund allocation is ₱2,000 from each new paid co-planter. Maximum benefit is ₱50,000.</p>
          </div>
          <Link href="/investor/dashboard" className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black">Dashboard</Link>
        </div>

        <div className="mt-8 grid gap-3 rounded-3xl border border-white/10 bg-white/10 p-4 md:grid-cols-[1fr_auto]">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Registered email" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
          <button onClick={() => loadRecovery()} className="rounded-2xl bg-green-500 px-8 py-4 text-sm font-black text-green-950">Load</button>
        </div>

        {message && <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
      </section>

      <section className="grid gap-5 px-6 py-8 md:grid-cols-3 lg:px-14">
        <Card title="Recovery Benefit" value={peso(recoveryTotal)} />
        <Card title="Maximum Benefit" value={peso(50000)} />
        <Card title="Status" value={profile ? "Loaded" : "Not Loaded"} />
      </section>

      <section className="px-6 pb-16 lg:px-14">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6">
          <h2 className="text-2xl font-black">Recovery Ledger</h2>
          <div className="mt-5 space-y-3">
            {transactions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm font-bold text-white/60">No recovery fund records yet.</div>
            ) : transactions.map((tx) => (
              <div key={tx.id} className="rounded-2xl bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-green-200">{tx.transaction_type}</p>
                    <p className="text-sm text-white/60">{tx.description || "-"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-green-300">{peso(tx.amount)}</p>
                    <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClass(tx.status)}`}>{tx.status || "PENDING"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 text-xs leading-6 text-green-100/65">No guaranteed investment wording. Recovery fund eligibility depends on platform rules, approval status, actual paid co-planters, and applicable laws.</p>
        </div>
      </section>
    </main>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6"><p className="text-sm font-bold text-green-200/80">{title}</p><p className="mt-3 text-2xl font-black">{value}</p></div>;
}
