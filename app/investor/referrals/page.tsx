"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { statusClass, type AnyRow } from "@/app/lib/coplanting/ui";

export default function ReferralsPage() {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<AnyRow | null>(null);
  const [referrals, setReferrals] = useState<AnyRow[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("sur_login_email") || "";
    setEmail(saved);
    if (saved) loadReferrals(saved);
  }, []);

  async function loadReferrals(targetEmail = email) {
    setMessage("");
    const cleanEmail = targetEmail.toLowerCase().trim();

    const { data: profileRow, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, referral_code, account_status, kyc_status")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (error || !profileRow) {
      setMessage(error?.message || "Profile not found.");
      setProfile(null);
      setReferrals([]);
      return;
    }

    const { data: referralRows } = await supabase
      .from("profiles")
      .select("id, full_name, email, account_status, kyc_status, membership_status, created_at, referred_by")
      .eq("referred_by", profileRow.referral_code || profileRow.email)
      .order("created_at", { ascending: false });

    setProfile(profileRow);
    setReferrals((referralRows || []) as AnyRow[]);
    localStorage.setItem("sur_login_email", cleanEmail);
  }

  const qualified = useMemo(() => referrals.filter((r) => String(r.account_status).toUpperCase() === "ACTIVE" && String(r.kyc_status).toUpperCase() === "APPROVED"), [referrals]);
  const referralLink = typeof window !== "undefined" && profile?.referral_code ? `${window.location.origin}/register?ref=${profile.referral_code}` : "";

  return (
    <main className="min-h-screen bg-[#06170f] text-white">
      <section className="border-b border-white/10 bg-gradient-to-r from-green-950 via-emerald-950 to-slate-950 px-6 py-8 lg:px-14">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-green-300">SUR Aloeswood</p>
            <h1 className="mt-3 text-4xl font-black lg:text-6xl">Referral Center</h1>
            <p className="mt-3 max-w-3xl text-green-100/80">₱3,000 referral bonus is only after referred co-planter is paid, approved, and KYC-approved.</p>
          </div>
          <Link href="/investor/dashboard" className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black">Dashboard</Link>
        </div>

        {message && <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
      </section>

      <section className="grid gap-5 px-6 py-8 md:grid-cols-3 lg:px-14">
        <Card title="Referral Code" value={profile?.referral_code || "Pending"} />
        <Card title="Total Referrals" value={String(referrals.length)} />
        <Card title="Qualified Bonus" value={`₱${(qualified.length * 3000).toLocaleString("en-PH")}`} />
      </section>

      <section className="grid gap-6 px-6 pb-16 lg:grid-cols-[0.8fr_1.2fr] lg:px-14">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6">
          <h2 className="text-2xl font-black">Referral Link</h2>
          <div className="mt-4 break-all rounded-2xl bg-black/30 p-4 text-sm text-green-200">{referralLink || "Load your profile first."}</div>
          <button onClick={() => navigator.clipboard?.writeText(referralLink)} className="mt-4 w-full rounded-2xl bg-green-500 px-6 py-4 text-sm font-black text-green-950">Copy Link</button>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6">
          <h2 className="text-2xl font-black">Referred Co-Planters</h2>
          <div className="mt-5 space-y-3">
            {referrals.length === 0 ? <Empty text="No referrals yet." /> : referrals.map((ref) => (
              <div key={ref.id} className="rounded-2xl bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-green-200">{ref.full_name || ref.email}</p>
                    <p className="text-sm text-white/60">{ref.email}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(ref.account_status)}`}>{ref.account_status || "PENDING"}</span>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(ref.kyc_status)}`}>{ref.kyc_status || "PENDING"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6"><p className="text-sm font-bold text-green-200/80">{title}</p><p className="mt-3 text-2xl font-black">{value}</p></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm font-bold text-white/60">{text}</div>;
}
