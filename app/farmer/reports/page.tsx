"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { formatDate, getTreeLabel, pick, statusClass, type AnyRow } from "@/app/lib/farmer/reports";

export default function FarmerReportsPage() {
  const [email, setEmail] = useState("");
  const [gardener, setGardener] = useState<AnyRow | null>(null);
  const [assignments, setAssignments] = useState<AnyRow[]>([]);
  const [trees, setTrees] = useState<AnyRow[]>([]);
  const [logs, setLogs] = useState<AnyRow[]>([]);
  const [notifications, setNotifications] = useState<AnyRow[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sur_login_email") || "";
    setEmail(saved);
    if (saved) loadReports(saved);
  }, []);

  async function loadReports(targetEmail = email) {
    setLoading(true);
    setMessage("");

    const cleanEmail = targetEmail.toLowerCase().trim();

    const { data: gardenerRow, error: gardenerError } = await supabase
      .from("gardeners")
      .select("id, full_name, email, mobile, status, created_at")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (gardenerError) {
      setMessage(gardenerError.message);
      setLoading(false);
      return;
    }

    if (!gardenerRow) {
      setMessage("Gardener profile not found.");
      setGardener(null);
      setAssignments([]);
      setTrees([]);
      setLogs([]);
      setLoading(false);
      return;
    }

    const [{ data: assignmentRows }, { data: treeRows }, { data: logRows }, { data: notificationRows }] =
      await Promise.all([
        supabase.from("gardener_assignments").select("id, gardener_id, tree_id, status, assigned_at").eq("gardener_id", gardenerRow.id),
        supabase.from("trees").select("id, tree_id, profile_id, farm_id, qr_code, age_months, height_cm, current_value, harvest_estimate_year, status, created_at"),
        supabase.from("tree_growth_logs").select("id, tree_id, height_cm, diameter_cm, health_status, remarks, photo_url, created_at").order("created_at", { ascending: false }),
        supabase.from("notifications").select("id, profile_id, title, message, is_read, created_at").order("created_at", { ascending: false }).limit(100),
      ]);

    const assignedTreeIds = new Set((assignmentRows || []).map((row: AnyRow) => row.tree_id));
    const assignedTrees = (treeRows || []).filter((tree: AnyRow) => assignedTreeIds.has(tree.id));
    const assignedLogs = (logRows || []).filter((log: AnyRow) => assignedTreeIds.has(log.tree_id));

    setGardener(gardenerRow);
    setAssignments((assignmentRows || []) as AnyRow[]);
    setTrees(assignedTrees as AnyRow[]);
    setLogs(assignedLogs as AnyRow[]);
    setNotifications((notificationRows || []) as AnyRow[]);
    localStorage.setItem("sur_login_email", cleanEmail);
    localStorage.setItem("sur_gardener_id", gardenerRow.id);
    setLoading(false);
  }

  const completedAssignments = assignments.filter((a) => ["COMPLETED", "DONE"].includes(String(a.status || "").toUpperCase()));
  const inProgressAssignments = assignments.filter((a) => ["IN_PROGRESS", "STARTED"].includes(String(a.status || "").toUpperCase()));
  const healthyLogs = logs.filter((log) => ["HEALTHY", "GROWING"].includes(String(log.health_status || "").toUpperCase()));
  const attentionLogs = logs.filter((log) => ["NEEDS_ATTENTION", "DAMAGED", "SICK"].includes(String(log.health_status || "").toUpperCase()));
  const photoCount = logs.filter((log) => Boolean(log.photo_url)).length;

  const latestTreeReports = useMemo(() => {
    return trees.map((tree) => {
      const treeLogs = logs.filter((log) => log.tree_id === tree.id);
      return {
        tree,
        latestLog: treeLogs[0] || null,
        logCount: treeLogs.length,
      };
    });
  }, [trees, logs]);

  return (
    <main className="min-h-screen bg-[#04140d] text-white">
      <section className="border-b border-white/10 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-green-300">SUR ALOESWOOD FARMER</p>
              <h1 className="mt-4 text-4xl font-black md:text-6xl">Farmer Reports</h1>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/farmer/dashboard" className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black">Dashboard</Link>
              <Link href="/farmer/profile" className="rounded-2xl bg-green-500 px-5 py-3 text-sm font-black text-green-950">Profile</Link>
            </div>
          </div>

          {message && <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-8 md:grid-cols-2 md:px-10 xl:grid-cols-4">
        <Metric title="Assigned Trees" value={String(trees.length)} />
        <Metric title="Completed Tasks" value={String(completedAssignments.length)} />
        <Metric title="In Progress" value={String(inProgressAssignments.length)} />
        <Metric title="Photo Updates" value={String(photoCount)} />
        <Metric title="Growth Logs" value={String(logs.length)} />
        <Metric title="Healthy Logs" value={String(healthyLogs.length)} />
        <Metric title="Needs Attention" value={String(attentionLogs.length)} />
        <Metric title="Notifications" value={String(notifications.length)} />
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-16 md:px-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Tree Report Summary</h2>

          <div className="mt-6 space-y-3">
            {latestTreeReports.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/25 p-6 text-sm font-bold text-white/60">No tree reports found.</div>
            ) : (
              latestTreeReports.map(({ tree, latestLog, logCount }) => (
                <div key={tree.id} className="rounded-2xl border border-white/10 bg-black/25 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black text-green-200">{getTreeLabel(tree)}</p>
                      <p className="mt-1 text-sm text-white/60">Logs: {logCount}</p>
                      <p className="mt-2 text-sm text-white/70">{latestLog?.remarks || "No latest remarks"}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(latestLog?.health_status || tree.status)}`}>
                      {latestLog?.health_status || tree.status || "NO LOG"}
                    </span>
                  </div>
                  <p className="mt-3 text-xs font-bold text-white/50">Latest: {formatDate(latestLog?.created_at)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Recent Notifications</h2>

          <div className="mt-6 space-y-3">
            {notifications.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/25 p-6 text-sm font-bold text-white/60">No notifications.</div>
            ) : (
              notifications.slice(0, 12).map((notification) => (
                <div key={notification.id} className="rounded-2xl border border-white/10 bg-black/25 p-5">
                  <p className="text-lg font-black text-green-200">{notification.title || "Notification"}</p>
                  <p className="mt-2 text-sm text-white/70">{notification.message || "-"}</p>
                  <p className="mt-3 text-xs font-bold text-white/50">{formatDate(notification.created_at)}</p>
                </div>
              ))
            )}
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
