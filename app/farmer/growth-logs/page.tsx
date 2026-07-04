"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { formatDate, getLogsForTree, getTreeLabel, pick, statusClass, type AnyRow } from "@/app/lib/farmer/growth";

export default function FarmerGrowthLogsPage() {
  const [email, setEmail] = useState("");
  const [gardener, setGardener] = useState<AnyRow | null>(null);
  const [assignments, setAssignments] = useState<AnyRow[]>([]);
  const [trees, setTrees] = useState<AnyRow[]>([]);
  const [logs, setLogs] = useState<AnyRow[]>([]);
  const [selectedTreeId, setSelectedTreeId] = useState("");
  const [height, setHeight] = useState("");
  const [diameter, setDiameter] = useState("");
  const [health, setHealth] = useState("HEALTHY");
  const [remarks, setRemarks] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sur_login_email") || "";
    setEmail(saved);
    if (saved) loadData(saved);
  }, []);

  async function loadData(targetEmail = email) {
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

    const [{ data: assignmentRows, error: assignmentError }, { data: treeRows }, { data: logRows }] =
      await Promise.all([
        supabase
          .from("gardener_assignments")
          .select("id, gardener_id, tree_id, status, assigned_at")
          .eq("gardener_id", gardenerRow.id)
          .order("assigned_at", { ascending: false }),
        supabase.from("trees").select("id, tree_id, profile_id, farm_id, qr_code, age_months, height_cm, current_value, harvest_estimate_year, status, created_at"),
        supabase.from("tree_growth_logs").select("id, tree_id, height_cm, diameter_cm, health_status, remarks, photo_url, created_at").order("created_at", { ascending: false }),
      ]);

    if (assignmentError) {
      setMessage(assignmentError.message);
      setLoading(false);
      return;
    }

    const assignedTreeIds = new Set((assignmentRows || []).map((row: AnyRow) => row.tree_id));
    const assignedTrees = (treeRows || []).filter((tree: AnyRow) => assignedTreeIds.has(tree.id));

    setGardener(gardenerRow);
    setAssignments((assignmentRows || []) as AnyRow[]);
    setTrees(assignedTrees as AnyRow[]);
    setLogs((logRows || []) as AnyRow[]);
    setSelectedTreeId((assignedTrees[0] as AnyRow | undefined)?.id || "");
    localStorage.setItem("sur_login_email", cleanEmail);
    localStorage.setItem("sur_gardener_id", gardenerRow.id);
    setLoading(false);
  }

  async function submitLog() {
    if (!selectedTreeId) {
      setMessage("Select a tree first.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { error } = await supabase.from("tree_growth_logs").insert({
      tree_id: selectedTreeId,
      height_cm: height ? Number(height) : null,
      diameter_cm: diameter ? Number(diameter) : null,
      health_status: health,
      remarks: remarks.trim() || null,
      photo_url: photoUrl.trim() || null,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const selectedTree = trees.find((tree) => tree.id === selectedTreeId);

    await supabase.from("notifications").insert({
      profile_id: selectedTree?.profile_id || null,
      title: "Tree Growth Update",
      message: `A farmer submitted a growth log for tree ${getTreeLabel(selectedTree)}.`,
      is_read: false,
    });

    setHeight("");
    setDiameter("");
    setHealth("HEALTHY");
    setRemarks("");
    setPhotoUrl("");
    setMessage("Growth log submitted.");
    await loadData(email);
    setLoading(false);
  }

  const selectedTree = trees.find((tree) => tree.id === selectedTreeId) || null;
  const selectedLogs = useMemo(() => getLogsForTree(selectedTree, logs), [selectedTree, logs]);

  return (
    <main className="min-h-screen bg-[#04140d] text-white">
      <section className="border-b border-white/10 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-green-300">SUR ALOESWOOD FARMER</p>
              <h1 className="mt-4 text-4xl font-black md:text-6xl">Growth Logs</h1>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/farmer/dashboard" className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black">Dashboard</Link>
              <Link href="/farmer/dashboard/task" className="rounded-2xl bg-green-500 px-5 py-3 text-sm font-black text-green-950">Tasks</Link>
            </div>
          </div>

          <div className="mt-8 grid gap-3 rounded-3xl border border-white/10 bg-white/10 p-4 md:grid-cols-[1fr_auto]">
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Farmer email" className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
            <button onClick={() => loadData()} disabled={loading} className="rounded-2xl bg-green-500 px-8 py-4 text-sm font-black text-green-950 disabled:bg-slate-500">
              {loading ? "Loading..." : "Load"}
            </button>
          </div>

          {message && <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-8 md:grid-cols-3 md:px-10">
        <Metric title="Gardener" value={gardener?.full_name || "Not loaded"} />
        <Metric title="Assigned Trees" value={String(trees.length)} />
        <Metric title="Growth Logs" value={String(logs.length)} />
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-16 md:px-10 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Submit Growth Log</h2>

          <div className="mt-6 space-y-4">
            <select value={selectedTreeId} onChange={(e) => setSelectedTreeId(e.target.value)} className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none">
              <option value="">Select assigned tree</option>
              {trees.map((tree) => (
                <option key={tree.id} value={tree.id}>{getTreeLabel(tree)}</option>
              ))}
            </select>

            <input value={height} onChange={(e) => setHeight(e.target.value)} type="number" placeholder="Height cm" className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
            <input value={diameter} onChange={(e) => setDiameter(e.target.value)} type="number" placeholder="Diameter cm" className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
            <select value={health} onChange={(e) => setHealth(e.target.value)} className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none">
              <option>HEALTHY</option>
              <option>GROWING</option>
              <option>NEEDS_ATTENTION</option>
              <option>DAMAGED</option>
              <option>SICK</option>
            </select>
            <input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="Photo URL" className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={5} placeholder="Remarks" className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />

            <button onClick={submitLog} disabled={loading} className="w-full rounded-2xl bg-green-500 px-6 py-4 text-sm font-black text-green-950 disabled:bg-slate-500">
              Submit Log
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Selected Tree Logs</h2>

          <div className="mt-6 space-y-3">
            {selectedLogs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/25 p-6 text-sm font-bold text-white/60">No logs for selected tree.</div>
            ) : (
              selectedLogs.map((log) => (
                <div key={log.id} className="rounded-2xl border border-white/10 bg-black/25 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black text-green-200">{formatDate(log.created_at)}</p>
                      <p className="mt-2 text-sm text-white/70">{log.remarks || "No remarks"}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(log.health_status)}`}>{log.health_status || "LOGGED"}</span>
                  </div>
                  <div className="mt-4 grid gap-2 text-xs font-bold text-white/60 md:grid-cols-3">
                    <span>Height: {log.height_cm || "-"} cm</span>
                    <span>Diameter: {log.diameter_cm || "-"} cm</span>
                    <span>Photo: {log.photo_url ? "Available" : "None"}</span>
                  </div>
                  {log.photo_url && <a href={log.photo_url} target="_blank" className="mt-3 block text-sm font-black text-green-200">Open Photo →</a>}
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
