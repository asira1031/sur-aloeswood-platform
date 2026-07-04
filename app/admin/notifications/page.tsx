"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { findProfile, formatDate, profileName, statusClass, type AnyRow } from "@/app/lib/admin/activity";

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<AnyRow[]>([]);
  const [profiles, setProfiles] = useState<AnyRow[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setMessage("");

    const [{ data: noticeRows, error }, { data: profileRows }] = await Promise.all([
      supabase.from("notifications").select("id, profile_id, title, message, is_read, created_at").order("created_at", { ascending: false }).limit(1000),
      supabase.from("profiles").select("id, full_name, email, role, account_status").limit(1000),
    ]);

    if (error) {
      setMessage(error.message);
      return;
    }

    setNotifications((noticeRows || []) as AnyRow[]);
    setProfiles((profileRows || []) as AnyRow[]);
  }

  async function markRead(row: AnyRow, read: boolean) {
    const { error } = await supabase.from("notifications").update({ is_read: read }).eq("id", row.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadData();
  }

  const filtered = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return notifications.filter((row) => {
      const profile = findProfile(row.profile_id, profiles);
      const statusOk = filter === "ALL" || (filter === "READ" ? row.is_read : !row.is_read);
      const text = `${JSON.stringify(row)} ${profile?.full_name || ""} ${profile?.email || ""}`.toLowerCase();
      return statusOk && (!keyword || text.includes(keyword));
    });
  }, [notifications, profiles, search, filter]);

  return (
    <main className="min-h-screen bg-[#04140d] text-white">
      <section className="border-b border-white/10 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-green-300">SUR ALOESWOOD ADMIN</p>
              <h1 className="mt-4 text-4xl font-black md:text-6xl">Notifications</h1>
            </div>
            <button onClick={loadData} className="rounded-2xl bg-green-500 px-5 py-3 text-sm font-black text-green-950">Refresh</button>
          </div>
          {message && <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-8 md:grid-cols-3 md:px-10">
        <Metric title="Total" value={String(notifications.length)} />
        <Metric title="Unread" value={String(notifications.filter((n) => !n.is_read).length)} />
        <Metric title="Read" value={String(notifications.filter((n) => n.is_read).length)} />
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16 md:px-10">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-3xl font-black">Notification Center</h2>
            <div className="flex flex-wrap gap-3">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none" />
              <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none">
                <option value="ALL">All</option>
                <option value="UNREAD">Unread</option>
                <option value="READ">Read</option>
              </select>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/25 p-6 text-sm font-bold text-white/60">No notifications found.</div>
            ) : filtered.map((row) => {
              const profile = findProfile(row.profile_id, profiles);
              return (
                <div key={row.id} className="rounded-2xl border border-white/10 bg-black/25 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black text-green-200">{row.title || "Notification"}</p>
                      <p className="mt-1 text-sm text-white/60">{profileName(profile)} • {profile?.email || "-"}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(row.is_read ? "READ" : "UNREAD")}`}>
                      {row.is_read ? "READ" : "UNREAD"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-white/70">{row.message || "-"}</p>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs font-bold text-white/50">{formatDate(row.created_at)}</p>
                    <button onClick={() => markRead(row, !row.is_read)} className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-black">
                      Mark {row.is_read ? "Unread" : "Read"}
                    </button>
                  </div>
                </div>
              );
            })}
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
