"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { formatDate, getProfile, pick, statusClass, type AnyRow } from "@/app/lib/support/utils";

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<AnyRow[]>([]);
  const [profiles, setProfiles] = useState<AnyRow[]>([]);
  const [notifications, setNotifications] = useState<AnyRow[]>([]);
  const [selected, setSelected] = useState<AnyRow | null>(null);
  const [reply, setReply] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadSupport();
  }, []);

  async function loadSupport() {
    setMessage("");

    const [{ data: ticketRows, error: ticketError }, { data: profileRows }, { data: notificationRows }] =
      await Promise.all([
        supabase.from("support_tickets").select("id, profile_id, subject, message, status, created_at").order("created_at", { ascending: false }).limit(500),
        supabase.from("profiles").select("id, full_name, email, mobile, mobile_number, role, account_status, kyc_status").limit(1000),
        supabase.from("notifications").select("id, profile_id, title, message, is_read, created_at").order("created_at", { ascending: false }).limit(500),
      ]);

    if (ticketError) {
      setMessage(ticketError.message);
      return;
    }

    const safeTickets = (ticketRows || []) as AnyRow[];
    setTickets(safeTickets);
    setProfiles((profileRows || []) as AnyRow[]);
    setNotifications((notificationRows || []) as AnyRow[]);
    setSelected(safeTickets[0] || null);
  }

  async function updateTicket(row: AnyRow, nextStatus: string) {
    setBusyId(row.id);
    setMessage("");

    const { error } = await supabase
      .from("support_tickets")
      .update({ status: nextStatus })
      .eq("id", row.id);

    if (error) {
      setMessage(error.message);
      setBusyId("");
      return;
    }

    await supabase.from("notifications").insert({
      profile_id: row.profile_id,
      title: `Support ticket ${nextStatus.toLowerCase()}`,
      message: `Your ticket "${row.subject}" is now ${nextStatus}.`,
      is_read: false,
    });

    setMessage(`Ticket updated to ${nextStatus}.`);
    await loadSupport();
    setBusyId("");
  }

  async function sendReply() {
    if (!selected || !reply.trim()) {
      setMessage("Select ticket and write a reply.");
      return;
    }

    setBusyId(selected.id);
    setMessage("");

    const { error } = await supabase.from("notifications").insert({
      profile_id: selected.profile_id,
      title: `Support reply: ${selected.subject}`,
      message: reply.trim(),
      is_read: false,
    });

    if (error) {
      setMessage(error.message);
      setBusyId("");
      return;
    }

    setReply("");
    setMessage("Reply sent as notification.");
    await loadSupport();
    setBusyId("");
  }

  const filtered = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return tickets.filter((ticket) => {
      const profile = getProfile(ticket, profiles);
      const statusOk = filter === "ALL" || String(ticket.status || "").toUpperCase() === filter;
      const text = `${JSON.stringify(ticket)} ${profile?.full_name || ""} ${profile?.email || ""}`.toLowerCase();
      return statusOk && (!keyword || text.includes(keyword));
    });
  }, [tickets, profiles, search, filter]);

  const openCount = tickets.filter((t) => String(t.status || "").toUpperCase() === "OPEN").length;
  const resolvedCount = tickets.filter((t) => ["RESOLVED", "CLOSED"].includes(String(t.status || "").toUpperCase())).length;
  const unreadNotifications = notifications.filter((n) => !n.is_read).length;
  const selectedProfile = selected ? getProfile(selected, profiles) : null;

  return (
    <main className="min-h-screen bg-[#04140d] text-white">
      <section className="border-b border-white/10 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-green-300">SUR ALOESWOOD ADMIN</p>
              <h1 className="mt-4 text-4xl font-black md:text-6xl">Support Center</h1>
            </div>
            <button onClick={loadSupport} className="rounded-2xl bg-green-500 px-5 py-3 text-sm font-black text-green-950">Refresh</button>
          </div>
          {message && <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-8 md:grid-cols-4 md:px-10">
        <Metric title="Tickets" value={String(tickets.length)} />
        <Metric title="Open" value={String(openCount)} />
        <Metric title="Resolved" value={String(resolvedCount)} />
        <Metric title="Unread Notices" value={String(unreadNotifications)} />
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-16 md:px-10 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-3xl font-black">Tickets</h2>
            <div className="flex flex-wrap gap-3">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none" />
              <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none">
                <option value="ALL">All</option>
                <option value="OPEN">Open</option>
                <option value="PENDING">Pending</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/25 p-6 text-sm font-bold text-white/60">No tickets found.</div>
            ) : (
              filtered.map((ticket) => {
                const profile = getProfile(ticket, profiles);
                return (
                  <button key={ticket.id} onClick={() => setSelected(ticket)} className={`w-full rounded-2xl border p-5 text-left ${selected?.id === ticket.id ? "border-green-300 bg-green-400/15" : "border-white/10 bg-black/25"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-black text-green-200">{ticket.subject}</p>
                        <p className="mt-1 text-sm text-white/60">{profile?.full_name || "Unknown"} • {profile?.email || "-"}</p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(ticket.status)}`}>{ticket.status || "OPEN"}</span>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm text-white/70">{ticket.message}</p>
                    <p className="mt-3 text-xs font-bold text-white/50">{formatDate(ticket.created_at)}</p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
            <h2 className="text-3xl font-black">Ticket Detail</h2>

            {!selected ? (
              <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-black/25 p-6 text-sm font-bold text-white/60">Select ticket.</div>
            ) : (
              <>
                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  <Info label="Subject" value={selected.subject} />
                  <Info label="Status" value={selected.status || "OPEN"} />
                  <Info label="Customer" value={selectedProfile?.full_name || "-"} />
                  <Info label="Email" value={selectedProfile?.email || "-"} />
                  <Info label="Created" value={formatDate(selected.created_at)} />
                  <Info label="Role" value={selectedProfile?.role || "-"} />
                </div>

                <div className="mt-5 rounded-2xl bg-black/25 p-5">
                  <p className="text-sm leading-7 text-white/75">{selected.message}</p>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <button disabled={busyId === selected.id} onClick={() => updateTicket(selected, "OPEN")} className="rounded-2xl bg-yellow-400 px-4 py-3 text-xs font-black text-yellow-950 disabled:bg-slate-500">Open</button>
                  <button disabled={busyId === selected.id} onClick={() => updateTicket(selected, "PENDING")} className="rounded-2xl bg-yellow-400 px-4 py-3 text-xs font-black text-yellow-950 disabled:bg-slate-500">Pending</button>
                  <button disabled={busyId === selected.id} onClick={() => updateTicket(selected, "RESOLVED")} className="rounded-2xl bg-green-500 px-4 py-3 text-xs font-black text-green-950 disabled:bg-slate-500">Resolved</button>
                  <button disabled={busyId === selected.id} onClick={() => updateTicket(selected, "CLOSED")} className="rounded-2xl bg-green-500 px-4 py-3 text-xs font-black text-green-950 disabled:bg-slate-500">Closed</button>
                </div>
              </>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
            <h2 className="text-3xl font-black">Reply</h2>
            <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={6} placeholder="Type admin reply..." className="mt-6 w-full rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
            <button disabled={!selected || busyId === selected?.id} onClick={sendReply} className="mt-4 w-full rounded-2xl bg-green-500 px-6 py-4 text-sm font-black text-green-950 disabled:bg-slate-500">Send Reply Notification</button>
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl">
      <p className="text-xs font-black uppercase tracking-wide text-green-100/60">{title}</p>
      <p className="mt-3 truncate text-xl font-black text-green-300">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/25 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-white/45">{label}</p>
      <p className="mt-2 text-sm font-black text-white">{value}</p>
    </div>
  );
}
