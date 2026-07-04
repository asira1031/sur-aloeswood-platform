"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { farmerLinks, formatDate, statusClass, type AnyRow } from "@/app/lib/dashboard/nav";

export default function FarmerDashboardPage() {
  const [email, setEmail] = useState("");
  const [farmer, setFarmer] = useState<AnyRow | null>(null);
  const [assignments, setAssignments] = useState<AnyRow[]>([]);
  const [trees, setTrees] = useState<AnyRow[]>([]);
  const [logs, setLogs] = useState<AnyRow[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("sur_login_email") || "";
    setEmail(saved || "farmer@test.com");
    loadDashboard(saved || "farmer@test.com");
  }, []);

  async function loadDashboard(targetEmail = email) {
    setMessage("");
    const cleanEmail = targetEmail.toLowerCase().trim();

    const { data: farmerRow, error } = await supabase
      .from("gardeners")
      .select("id, full_name, email, mobile, status, created_at")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (error || !farmerRow) {
      setMessage(error?.message || "Farmer not found.");
      setFarmer(null);
      setAssignments([]);
      return;
    }

    const { data: assignmentRows } = await supabase
      .from("gardener_assignments")
      .select("id, gardener_id, tree_id, status, assigned_at")
      .eq("gardener_id", farmerRow.id)
      .order("assigned_at", { ascending: false });

    const treeIds = (assignmentRows || []).map((a: AnyRow) => a.tree_id).filter(Boolean);
    let treeRows: AnyRow[] = [];
    let logRows: AnyRow[] = [];

    if (treeIds.length > 0) {
      const [{ data: treeData }, { data: logData }] = await Promise.all([
        supabase.from("tree_registry").select("id, profile_id, purchase_id, tree_code, denr_tag_number, species, status, gps_lat, gps_lng, planted_at, created_at").in("id", treeIds),
        supabase.from("tree_growth_logs").select("id, tree_id, height_cm, diameter_cm, health_status, remarks, photo_url, created_at").in("tree_id", treeIds).order("created_at", { ascending: false }),
      ]);
      treeRows = (treeData || []) as AnyRow[];
      logRows = (logData || []) as AnyRow[];
    }

    setFarmer(farmerRow);
    setAssignments((assignmentRows || []) as AnyRow[]);
    setTrees(treeRows);
    setLogs(logRows);
    localStorage.setItem("sur_login_email", cleanEmail);
  }

  function treeFor(id: string) {
    return trees.find((tree) => tree.id === id) || null;
  }

  const active = assignments.filter((a) => ["ASSIGNED", "IN_PROGRESS", "ACTIVE"].includes(String(a.status || "").toUpperCase())).length;
  const completed = assignments.filter((a) => String(a.status || "").toUpperCase() === "COMPLETED").length;

  return (
    <main className="min-h-screen bg-[#06170f] text-white">
      <section className="border-b border-white/10 bg-gradient-to-r from-green-950 via-emerald-950 to-slate-950 px-6 py-8 lg:px-14">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-green-300">SUR ALOESWOOD FARMER</p>
            <h1 className="mt-3 text-4xl font-black lg:text-6xl">Farmer Work Center</h1>
            <p className="mt-3 max-w-3xl text-green-100/80">Open all farmer tools from here.</p>
          </div>
          <Link href="/farmer/dashboard/task" className="rounded-2xl bg-green-500 px-5 py-3 text-sm font-black text-green-950">Open Tasks</Link>
        </div>

        <div className="mt-8 grid gap-3 rounded-3xl border border-white/10 bg-white/10 p-4 md:grid-cols-[1fr_auto]">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Farmer email" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
          <button onClick={() => loadDashboard()} className="rounded-2xl bg-green-500 px-8 py-4 text-sm font-black text-green-950">Load Farmer</button>
        </div>
        {message && <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
      </section>

      <section className="grid gap-5 px-6 py-8 md:grid-cols-4 lg:px-14">
        <Metric title="Farmer" value={farmer?.full_name || "Not loaded"} />
        <Metric title="Assigned Trees" value={String(assignments.length)} />
        <Metric title="Active Tasks" value={String(active)} />
        <Metric title="Completed" value={String(completed)} />
      </section>

      <section className="grid gap-6 px-6 pb-16 lg:grid-cols-[1.1fr_0.9fr] lg:px-14">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Farmer Features</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {farmerLinks.map((link) => (
              <Link key={link.href} href={link.href} className="rounded-2xl border border-white/10 bg-black/25 p-5 transition hover:border-green-300/50 hover:bg-green-400/10">
                <p className="text-lg font-black text-green-200">{link.title}</p>
                <p className="mt-2 text-sm leading-6 text-white/60">{link.desc}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
            <h2 className="text-3xl font-black">Assigned Tree Queue</h2>
            <div className="mt-5 space-y-3">
              {assignments.slice(0, 8).map((a) => {
                const tree = treeFor(a.tree_id);
                return (
                  <Link key={a.id} href="/farmer/assigned-trees" className="block rounded-2xl bg-black/25 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-yellow-300">{tree?.tree_code || "Tree assignment"}</p>
                        <p className="mt-1 text-xs text-white/45">{tree?.denr_tag_number || "DENR pending"} • Assigned {formatDate(a.assigned_at)}</p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(a.status)}`}>{a.status || "ASSIGNED"}</span>
                    </div>
                  </Link>
                );
              })}
              {assignments.length === 0 && <Empty text="No assignments yet." />}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
            <h2 className="text-3xl font-black">Recent Growth Logs</h2>
            <div className="mt-5 space-y-3">
              {logs.slice(0, 5).map((log) => (
                <Link key={log.id} href="/farmer/growth-logs" className="block rounded-2xl bg-black/25 p-4">
                  <p className="font-black text-green-200">{log.health_status || "Growth Update"}</p>
                  <p className="mt-1 text-sm text-white/60">{log.remarks || "-"}</p>
                  <p className="mt-2 text-xs text-white/45">{formatDate(log.created_at)}</p>
                </Link>
              ))}
              {logs.length === 0 && <Empty text="No growth logs yet." />}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5"><p className="text-xs font-black uppercase tracking-wide text-green-100/60">{title}</p><p className="mt-3 truncate text-xl font-black text-green-300">{value}</p></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm font-bold text-white/60">{text}</div>;
}
