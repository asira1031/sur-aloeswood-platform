"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { findProfile, formatDate, profileName, statusClass, type AnyRow } from "@/app/lib/admin/activity";

type ViewMode = "COPLANTER" | "GARDENER";

function normalizeRole(role?: string | null) {
  return String(role || "").toUpperCase().replace("CO_PLANTER", "COPLANTER");
}

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<AnyRow[]>([]);
  const [profiles, setProfiles] = useState<AnyRow[]>([]);
  const [gardeners, setGardeners] = useState<AnyRow[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [mode, setMode] = useState<ViewMode>("COPLANTER");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setMessage("");

    const [{ data: noticeRows, error }, { data: profileRows }, { data: gardenerRows }] = await Promise.all([
      supabase
        .from("notifications")
        .select("id, profile_id, title, message, is_read, created_at")
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("profiles")
        .select("id, full_name, email, role, account_status, kyc_status, membership_status, created_at")
        .limit(1000),
      supabase
        .from("gardeners")
        .select("id, full_name, email, mobile, status, created_at")
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);

    if (error) {
      setMessage(error.message);
      return;
    }

    setNotifications((noticeRows || []) as AnyRow[]);
    setProfiles((profileRows || []) as AnyRow[]);
    setGardeners((gardenerRows || []) as AnyRow[]);
  }

  async function markRead(row: AnyRow, read: boolean) {
    const { error } = await supabase.from("notifications").update({ is_read: read }).eq("id", row.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadData();
  }

  const coPlanterProfiles = useMemo(
    () =>
      profiles.filter((profile) => {
        const role = normalizeRole(profile.role);
        return ["COPLANTER", "INVESTOR"].includes(role);
      }),
    [profiles]
  );

  const farmerProfiles = useMemo(
    () =>
      profiles.filter((profile) => {
        const role = normalizeRole(profile.role);
        return ["FARMER", "GARDENER", "CARETAKER"].includes(role);
      }),
    [profiles]
  );

  function relatedNotices(profileId?: string | null) {
    return notifications.filter((row) => row.profile_id === profileId);
  }

  const listItems = useMemo(() => {
    const keyword = search.toLowerCase().trim();
    const base =
      mode === "COPLANTER"
        ? coPlanterProfiles.map((profile) => ({
            id: profile.id,
            name: profile.full_name || profile.email,
            email: profile.email,
            status: profile.account_status || profile.kyc_status || "PENDING",
            subStatus: profile.kyc_status || profile.membership_status || "PENDING",
            created_at: profile.created_at,
            href: `/admin/coplanters?profile=${profile.id}`,
            notices: relatedNotices(profile.id),
          }))
        : [
            ...gardeners.map((gardener) => {
              const profile = profiles.find((row) => String(row.email || "").toLowerCase() === String(gardener.email || "").toLowerCase());
              return {
                id: gardener.id,
                name: gardener.full_name || gardener.email,
                email: gardener.email,
                status: gardener.status || profile?.account_status || "PENDING",
                subStatus: profile?.role || "FARMER",
                created_at: gardener.created_at,
                href: `/admin/gardener?farmer=${gardener.id}`,
                notices: relatedNotices(profile?.id),
              };
            }),
            ...farmerProfiles
              .filter((profile) => !gardeners.some((gardener) => String(gardener.email || "").toLowerCase() === String(profile.email || "").toLowerCase()))
              .map((profile) => ({
                id: profile.id,
                name: profile.full_name || profile.email,
                email: profile.email,
                status: profile.account_status || "PENDING",
                subStatus: profile.role || "FARMER",
                created_at: profile.created_at,
                href: `/admin/gardener?email=${encodeURIComponent(profile.email || "")}`,
                notices: relatedNotices(profile.id),
              })),
          ];

    return base
      .filter((item) => {
        const unread = item.notices.some((notice) => !notice.is_read);
        const statusOk = filter === "ALL" || (filter === "UNREAD" ? unread : !unread);
        const text = `${item.name || ""} ${item.email || ""} ${item.status || ""} ${item.notices.map((n) => `${n.title} ${n.message}`).join(" ")}`.toLowerCase();
        return statusOk && (!keyword || text.includes(keyword));
      })
      .sort((a, b) => {
        const aTime = new Date(a.notices[0]?.created_at || a.created_at || 0).getTime();
        const bTime = new Date(b.notices[0]?.created_at || b.created_at || 0).getTime();
        return bTime - aTime;
      });
  }, [coPlanterProfiles, farmerProfiles, filter, gardeners, mode, notifications, profiles, search]);

  const selectedNotifications = useMemo(() => {
    const profileIds = new Set(
      (mode === "COPLANTER" ? coPlanterProfiles : farmerProfiles).map((profile) => profile.id)
    );
    return notifications.filter((notice) => profileIds.has(notice.profile_id));
  }, [coPlanterProfiles, farmerProfiles, mode, notifications]);

  const unreadCount = selectedNotifications.filter((notice) => !notice.is_read).length;
  const coPlanterUnread = notifications.filter((notice) => coPlanterProfiles.some((profile) => profile.id === notice.profile_id) && !notice.is_read).length;
  const gardenerUnread = notifications.filter((notice) => farmerProfiles.some((profile) => profile.id === notice.profile_id) && !notice.is_read).length;

  return (
    <main className="min-h-screen bg-[#f3f7f1] text-slate-950">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-4 lg:px-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/20 p-6 shadow-sm lg:p-8">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/forest-bg.jpg')" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-green-950/90 via-green-900/66 to-green-950/18" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-white/75">Admin Notification Center</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-white lg:text-6xl">
                Notification Queue
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78 lg:text-base">
                Review co-planter and farmer alerts, then open the exact account card that needs admin action.
              </p>
            </div>

            <button
              onClick={loadData}
              className="w-fit rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm hover:bg-white/90"
            >
              Refresh
            </button>
          </div>

          <div className="relative z-10 mt-8 grid gap-3 md:grid-cols-3">
            <HeroStat label="Total Notices" value={String(notifications.length)} />
            <HeroStat label="Selected Unread" value={String(unreadCount)} />
            <HeroStat label="Request Cards" value={String(listItems.length)} />
          </div>

          {message && (
            <div className="relative z-10 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
              {message}
            </div>
          )}
        </section>

        <section className="grid gap-4 py-5 md:grid-cols-2">
          <button
            onClick={() => setMode("COPLANTER")}
            className={`rounded-[1.5rem] border p-5 text-left shadow-sm transition ${
              mode === "COPLANTER" ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-200"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Co-Planter</p>
                <p className="mt-2 text-3xl font-black text-slate-950">{coPlanterProfiles.length}</p>
                <p className="mt-1 text-sm font-bold text-slate-500">Account, KYC, purchase, wallet, and tree notifications</p>
              </div>
              {coPlanterUnread > 0 && <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-black text-white">{coPlanterUnread}</span>}
            </div>
          </button>

          <button
            onClick={() => setMode("GARDENER")}
            className={`rounded-[1.5rem] border p-5 text-left shadow-sm transition ${
              mode === "GARDENER" ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-200"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Gardener / Farmer</p>
                <p className="mt-2 text-3xl font-black text-slate-950">{gardeners.length || farmerProfiles.length}</p>
                <p className="mt-1 text-sm font-bold text-slate-500">Registration, task, growth log, GPS, and report notifications</p>
              </div>
              {gardenerUnread > 0 && <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-black text-white">{gardenerUnread}</span>}
            </div>
          </button>
        </section>

        <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-950">
                {mode === "COPLANTER" ? "Co-Planter Requests" : "Gardener Requests"}
              </h2>
              <p className="mt-1 text-sm text-slate-600">Click a request card to open the matching admin workspace.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:max-w-lg">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search requests"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
              />
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
              >
                <option value="ALL">All</option>
                <option value="UNREAD">Unread only</option>
                <option value="READ">No unread</option>
              </select>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            {listItems.length === 0 ? (
              <Empty text="No request cards found." />
            ) : (
              listItems.map((item) => {
                const unread = item.notices.filter((notice) => !notice.is_read).length;
                const latestNotice = item.notices[0];
                return (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <Link href={item.href} className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="break-words text-lg font-black text-slate-950">{item.name || item.email}</p>
                            <p className="mt-1 text-sm font-bold text-slate-600">{item.email || "-"}</p>
                            <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                              {latestNotice ? `${latestNotice.title || "Notification"}: ${latestNotice.message || "-"}` : "No notifications yet, but this account is in the request list."}
                            </p>
                            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-400">
                              {latestNotice ? formatDate(latestNotice.created_at) : formatDate(item.created_at)}
                            </p>
                          </div>
                          <div className="flex flex-wrap justify-end gap-2">
                            <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(item.status)}`}>{item.status || "PENDING"}</span>
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">
                              {item.subStatus || mode}
                            </span>
                            {unread > 0 && <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-black text-white">{unread} UNREAD</span>}
                          </div>
                        </div>
                      </Link>

                      {latestNotice && (
                        <button
                          onClick={() => markRead(latestNotice, !latestNotice.is_read)}
                          className="w-fit rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                        >
                          Mark {latestNotice.is_read ? "Unread" : "Read"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/16 p-4 backdrop-blur">
      <p className="text-xs font-black uppercase tracking-wide text-white/65">{label}</p>
      <p className="mt-2 truncate text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">
      {text}
    </div>
  );
}
