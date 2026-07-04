"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import {
  formatDate,
  getAssignmentTree,
  getFarmerName,
  getTreeLabel,
  pick,
  statusClass,
  type AnyRow,
} from "@/app/lib/farmer/assignments";

export default function FarmerDashboardPage() {
  const [email, setEmail] = useState("");
  const [farmer, setFarmer] = useState<AnyRow | null>(null);
  const [assignments, setAssignments] = useState<AnyRow[]>([]);
  const [trees, setTrees] = useState<AnyRow[]>([]);
  const [logs, setLogs] = useState<AnyRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("sur_login_email") || "";
    setEmail(saved);
    if (saved) loadDashboard(saved);
  }, []);

  async function loadDashboard(targetEmail = email) {
    setLoading(true);
    setMessage("");

    const cleanEmail = targetEmail.toLowerCase().trim();

    if (!cleanEmail) {
      setMessage("Enter farmer email.");
      setLoading(false);
      return;
    }

    const { data: gardenerRow, error: gardenerError } = await supabase
      .from("gardeners")
      .select("*")
      .or(`email.eq.${cleanEmail},farmer_email.eq.${cleanEmail},gardener_email.eq.${cleanEmail}`)
      .maybeSingle();

    if (gardenerError) {
      setMessage(gardenerError.message);
      setLoading(false);
      return;
    }

    const farmerId = gardenerRow?.id || gardenerRow?.profile_id || gardenerRow?.farmer_profile_id || gardenerRow?.gardener_profile_id;

    const [{ data: assignmentRows, error: assignmentError }, { data: treeRows }, { data: logRows }] =
      await Promise.all([
        farmerId
          ? supabase
              .from("gardener_assignments")
              .select("*")
              .or(`gardener_id.eq.${farmerId},farmer_id.eq.${farmerId},gardener_profile_id.eq.${farmerId},farmer_profile_id.eq.${farmerId}`)
              .order("created_at", { ascending: false })
          : supabase.from("gardener_assignments").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("trees").select("*").order("created_at", { ascending: false }).limit(1000),
        supabase.from("tree_growth_logs").select("*").order("created_at", { ascending: false }).limit(300),
      ]);

    if (assignmentError) {
      setMessage(assignmentError.message);
      setLoading(false);
      return;
    }

    localStorage.setItem("sur_login_email", cleanEmail);
    if (farmerId) localStorage.setItem("sur_farmer_id", farmerId);

    setFarmer(gardenerRow || { email: cleanEmail });
    setAssignments((assignmentRows || []) as AnyRow[]);
    setTrees((treeRows || []) as AnyRow[]);
    setLogs((logRows || []) as AnyRow[]);
    setLoading(false);
  }

  const filteredAssignments = useMemo(() => {
    const keyword = query.toLowerCase().trim();

    return assignments.filter((assignment) => {
      const tree = getAssignmentTree(assignment, trees);
      const text = `${JSON.stringify(assignment)} ${JSON.stringify(tree || {})}`.toLowerCase();
      return !keyword || text.includes(keyword);
    });
  }, [assignments, trees, query]);

  const assignedCount = assignments.filter((a) => String(a.status || "ASSIGNED").toUpperCase() === "ASSIGNED").length;
  const inProgressCount = assignments.filter((a) => String(a.status || "").toUpperCase() === "IN_PROGRESS").length;
  const completedCount = assignments.filter((a) => ["COMPLETED", "DONE"].includes(String(a.status || "").toUpperCase())).length;

  return (
    <main className="min-h-screen bg-[#04140d] text-white">
      <section className="border-b border-white/10 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-green-300">SUR ALOESWOOD FARMER</p>
              <h1 className="mt-4 text-4xl font-black md:text-6xl">Farmer Dashboard</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-green-50/80">
                Assigned trees, active work, field logs, and plantation task monitoring.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/farmer/dashboard/task" className="rounded-2xl bg-green-500 px-5 py-3 text-sm font-black text-green-950">
                Tasks
              </Link>
              <Link href="/farmer/assigned-trees" className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black">
                Assigned Trees
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-3 rounded-3xl border border-white/10 bg-white/10 p-4 md:grid-cols-[1fr_auto]">
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Farmer email" className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
            <button onClick={() => loadDashboard()} disabled={loading} className="rounded-2xl bg-green-500 px-8 py-4 text-sm font-black text-green-950 disabled:bg-slate-500">
              {loading ? "Loading..." : "Load Dashboard"}
            </button>
          </div>

          {message && <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-8 md:grid-cols-2 md:px-10 xl:grid-cols-4">
        <Metric title="Farmer" value={farmer ? getFarmerName(farmer) : "Not loaded"} />
        <Metric title="Assigned" value={String(assignedCount)} />
        <Metric title="In Progress" value={String(inProgressCount)} />
        <Metric title="Completed" value={String(completedCount)} />
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-16 md:px-10 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-3xl font-black">Assignments</h2>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search assignments..." className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none" />
          </div>

          <div className="mt-6 grid gap-3">
            {filteredAssignments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/25 p-6 text-sm font-bold text-white/60">No assignments found.</div>
            ) : (
              filteredAssignments.map((assignment) => {
                const tree = getAssignmentTree(assignment, trees);
                const status = assignment.status || "ASSIGNED";

                return (
                  <div key={assignment.id} className="rounded-2xl border border-white/10 bg-black/25 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xl font-black text-green-200">{tree ? getTreeLabel(tree) : pick(assignment, ["tree_code", "tree_id", "id"])}</p>
                        <p className="mt-1 text-sm text-white/60">{pick(assignment, ["task_type", "assignment_type", "title"], "Tree Care Task")}</p>
                        <p className="mt-3 text-sm leading-6 text-white/70">{pick(assignment, ["notes", "description", "remarks"], "No notes")}</p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(status)}`}>{status}</span>
                    </div>
                    <div className="mt-4 grid gap-2 text-xs font-bold text-white/55 md:grid-cols-3">
                      <span>Created: {formatDate(assignment.created_at)}</span>
                      <span>Due: {formatDate(assignment.due_date || assignment.scheduled_at)}</span>
                      <span>Tree Status: {tree?.status || tree?.health_status || "-"}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Recent Field Logs</h2>

          <div className="mt-6 space-y-3">
            {logs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/25 p-6 text-sm font-bold text-white/60">No growth logs yet.</div>
            ) : (
              logs.slice(0, 10).map((log, index) => (
                <div key={log.id || index} className="rounded-2xl border border-white/10 bg-black/25 p-5">
                  <p className="text-lg font-black text-green-200">{pick(log, ["title", "log_type", "activity_type"], "Field Log")}</p>
                  <p className="mt-2 text-sm leading-6 text-white/70">{pick(log, ["notes", "description", "remarks", "growth_notes", "health_notes"], "No notes")}</p>
                  <p className="mt-3 text-xs font-bold text-white/50">{formatDate(log.created_at || log.log_date)}</p>
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
