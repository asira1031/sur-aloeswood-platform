"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { getAuthenticatedProfile, type SurProfile } from "@/app/lib/auth/session";
import { formatDate, statusClass, type AnyRow } from "@/app/lib/coplanting/ui";

export default function NotificationsPage() {
  const [profile, setProfile] = useState<SurProfile | null>(null);
  const [notifications, setNotifications] = useState<AnyRow[]>([]);
  const [message, setMessage] = useState("");

  const loadNotifications = useCallback(async () => {
    setMessage("");
    const profileRow = await getAuthenticatedProfile();
    if (!profileRow) {
      setMessage("Please sign in again.");
      setProfile(null);
      setNotifications([]);
      return;
    }

    const { data: noticeRows } = await supabase
      .from("notifications")
      .select("id, profile_id, title, message, is_read, created_at")
      .eq("profile_id", profileRow.id)
      .order("created_at", { ascending: false });

    setProfile(profileRow);
    setNotifications((noticeRows || []) as AnyRow[]);
  }, []);

  useEffect(() => {
    // Initial authenticated data load; the callback resolves asynchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadNotifications();
  }, [loadNotifications]);

  async function markRead(row: AnyRow, isRead: boolean) {
    if (!profile) return;
    const { error } = await supabase.from("notifications").update({ is_read: isRead }).eq("id", row.id).eq("profile_id", profile.id);
    if (error) { setMessage("The notification could not be updated. Please retry."); return; }
    await loadNotifications();
  }

  return (
    <main className="min-h-screen bg-[#06170f] text-white">
      <section className="border-b border-white/10 bg-gradient-to-r from-green-950 via-emerald-950 to-slate-950 px-6 py-8 lg:px-14">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-green-300">SUR Aloeswood</p>
            <h1 className="mt-3 text-4xl font-black lg:text-6xl">Notifications</h1>
          </div>
          <Link href="/investor/dashboard" className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black">Dashboard</Link>
        </div>

        {message && <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
      </section>

      <section className="grid gap-5 px-6 py-8 md:grid-cols-3 lg:px-14">
        <Card title="Total Notices" value={String(notifications.length)} />
        <Card title="Unread" value={String(notifications.filter((n) => !n.is_read).length)} />
        <Card title="Read" value={String(notifications.filter((n) => n.is_read).length)} />
      </section>

      <section className="px-6 pb-16 lg:px-14">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6">
          <h2 className="text-2xl font-black">Notification Inbox</h2>
          <div className="mt-5 space-y-3">
            {notifications.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-center text-sm font-bold text-white/60"><Image src="/app-assets/empty-notifications-v1.png" alt="" width={160} height={160} className="mx-auto mb-3 h-28 w-28 object-contain sm:h-36 sm:w-36" />No notifications yet.</div>
            ) : notifications.map((notice) => (
              <div key={notice.id} className="rounded-2xl bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-green-200">{notice.title || "Notification"}</p>
                    <p className="mt-2 text-sm text-white/70">{notice.message || "-"}</p>
                    <p className="mt-3 text-xs text-white/45">{formatDate(notice.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClass(notice.is_read ? "READ" : "UNREAD")}`}>{notice.is_read ? "READ" : "UNREAD"}</span>
                    <button onClick={() => markRead(notice, !notice.is_read)} className="mt-3 block rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-black">Mark {notice.is_read ? "Unread" : "Read"}</button>
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
