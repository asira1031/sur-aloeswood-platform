"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { formatDate, statusClass, type AnyRow } from "@/app/lib/settings/preferences";

export default function InvestorSupportPage() {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<AnyRow | null>(null);
  const [tickets, setTickets] = useState<AnyRow[]>([]);
  const [subject, setSubject] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("sur_login_email") || "";
    setEmail(saved);
    if (saved) loadSupport(saved);
  }, []);

  async function loadSupport(targetEmail = email) {
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
      setTickets([]);
      return;
    }

    const { data: ticketRows } = await supabase
      .from("support_tickets")
      .select("id, profile_id, subject, message, status, created_at")
      .eq("profile_id", profileRow.id)
      .order("created_at", { ascending: false });

    setProfile(profileRow);
    setTickets((ticketRows || []) as AnyRow[]);
    localStorage.setItem("sur_login_email", cleanEmail);
    localStorage.setItem("sur_profile_id", profileRow.id);
  }

  async function createTicket() {
    if (!profile) {
      setMessage("Load profile first.");
      return;
    }

    if (!subject.trim() || !ticketMessage.trim()) {
      setMessage("Subject and message are required.");
      return;
    }

    const { error } = await supabase.from("support_tickets").insert({
      profile_id: profile.id,
      subject: subject.trim(),
      message: ticketMessage.trim(),
      status: "OPEN",
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.from("notifications").insert({
      profile_id: profile.id,
      title: "Support ticket created",
      message: `Your support ticket "${subject.trim()}" was created.`,
      is_read: false,
    });

    setSubject("");
    setTicketMessage("");
    setMessage("Support ticket submitted.");
    await loadSupport(profile.email);
  }

  return (
    <main className="min-h-screen bg-[#06170f] text-white">
      <section className="border-b border-white/10 bg-gradient-to-r from-green-950 via-emerald-950 to-slate-950 px-6 py-8 lg:px-14">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-green-300">SUR ALOESWOOD CO-PLANTER</p>
            <h1 className="mt-3 text-4xl font-black lg:text-6xl">Support Center</h1>
            <p className="mt-3 max-w-3xl text-green-100/80">Create support tickets for wallet, tree registry, certificates, or plantation concerns.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/investor/dashboard" className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black">Dashboard</Link>
            <Link href="/investor/settings" className="rounded-2xl bg-green-500 px-5 py-3 text-sm font-black text-green-950">Settings</Link>
          </div>
        </div>

        <div className="mt-8 grid gap-3 rounded-3xl border border-white/10 bg-white/10 p-4 md:grid-cols-[1fr_auto]">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Registered email" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
          <button onClick={() => loadSupport()} className="rounded-2xl bg-green-500 px-8 py-4 text-sm font-black text-green-950">Load Support</button>
        </div>

        {message && <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
      </section>

      <section className="grid gap-6 px-6 py-8 lg:grid-cols-[0.85fr_1.15fr] lg:px-14">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6">
          <h2 className="text-2xl font-black">Create Ticket</h2>
          <div className="mt-5 grid gap-4">
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
            <textarea value={ticketMessage} onChange={(e) => setTicketMessage(e.target.value)} rows={6} placeholder="Message" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
            <button onClick={createTicket} className="rounded-2xl bg-green-500 px-6 py-4 text-sm font-black text-green-950">Submit Ticket</button>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6">
          <h2 className="text-2xl font-black">My Support Tickets</h2>
          <div className="mt-5 space-y-3">
            {tickets.length === 0 ? (
              <Empty text="No support tickets yet." />
            ) : tickets.map((ticket) => (
              <div key={ticket.id} className="rounded-2xl bg-black/25 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-green-200">{ticket.subject}</p>
                    <p className="mt-2 text-sm text-white/70">{ticket.message}</p>
                    <p className="mt-3 text-xs text-white/45">{formatDate(ticket.created_at)}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(ticket.status)}`}>{ticket.status || "OPEN"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm font-bold text-white/60">{text}</div>;
}
