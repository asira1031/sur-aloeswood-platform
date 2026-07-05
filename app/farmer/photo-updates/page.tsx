"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { formatDate, getTreeLabel, statusClass, type AnyRow } from "@/app/lib/farmer/growth";

export default function FarmerPhotoUpdatesPage() {
  const [email, setEmail] = useState("");
  const [gardener, setGardener] = useState<AnyRow | null>(null);
  const [trees, setTrees] = useState<AnyRow[]>([]);
  const [assignments, setAssignments] = useState<AnyRow[]>([]);
  const [logs, setLogs] = useState<AnyRow[]>([]);
  const [selectedTreeId, setSelectedTreeId] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [remarks, setRemarks] = useState("");
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

    const { data: gardenerRow } = await supabase
      .from("gardeners")
      .select("id, full_name, email, mobile, status, created_at")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (!gardenerRow) {
      setMessage("Gardener profile not found.");
      setLoading(false);
      return;
    }

    const [{ data: assignmentRows }, { data: treeRows }, { data: logRows }] = await Promise.all([
      supabase.from("gardener_assignments").select("id, gardener_id, tree_id, status, assigned_at").eq("gardener_id", gardenerRow.id),
      supabase.from("trees").select("id, tree_id, profile_id, farm_id, qr_code, age_months, height_cm, current_value, harvest_estimate_year, status, created_at"),
      supabase.from("tree_growth_logs").select("id, tree_id, height_cm, diameter_cm, health_status, remarks, photo_url, created_at").order("created_at", { ascending: false }),
    ]);

    const assignedTreeIds = new Set((assignmentRows || []).map((row: AnyRow) => row.tree_id));
    const assignedTrees = (treeRows || []).filter((tree: AnyRow) => assignedTreeIds.has(tree.id));

    setGardener(gardenerRow);
    setAssignments((assignmentRows || []) as AnyRow[]);
    setTrees(assignedTrees as AnyRow[]);
    setLogs((logRows || []) as AnyRow[]);
    setSelectedTreeId((assignedTrees[0] as AnyRow | undefined)?.id || "");
    setLoading(false);
  }

  async function submitPhoto() {
    if (!selectedTreeId || !photoUrl.trim()) {
      setMessage("Select tree and enter photo URL.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { error } = await supabase.from("tree_growth_logs").insert({
      tree_id: selectedTreeId,
      health_status: "PHOTO_UPDATE",
      remarks: remarks.trim() || "Farmer photo update.",
      photo_url: photoUrl.trim(),
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const tree = trees.find((row) => row.id === selectedTreeId);

    await supabase.from("notifications").insert({
      profile_id: tree?.profile_id || null,
      title: "Tree Photo Update",
      message: `A farmer uploaded a new photo update for tree ${getTreeLabel(tree)}.`,
      is_read: false,
    });

    setPhotoUrl("");
    setRemarks("");
    setMessage("Photo update submitted.");
    await loadData(email);
    setLoading(false);
  }

  const photoLogs = useMemo(() => logs.filter((log) => Boolean(log.photo_url)), [logs]);

  return (
    <main className="min-h-screen bg-[#04140d] text-white">
      <section className="border-b border-white/10 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-green-300">SUR ALOESWOOD FARMER</p>
              <h1 className="mt-4 text-4xl font-black md:text-6xl">Photo Updates</h1>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/farmer/dashboard" className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black">Dashboard</Link>
              <Link href="/farmer/growth-logs" className="rounded-2xl bg-green-500 px-5 py-3 text-sm font-black text-green-950">Growth Logs</Link>
            </div>
          </div>

          {message && <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 md:px-10 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Submit Photo</h2>

          <div className="mt-6 space-y-4">
            <select value={selectedTreeId} onChange={(e) => setSelectedTreeId(e.target.value)} className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none">
              <option value="">Select assigned tree</option>
              {trees.map((tree) => <option key={tree.id} value={tree.id}>{getTreeLabel(tree)}</option>)}
            </select>
            <input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="Photo URL" className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={5} placeholder="Remarks" className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
            <button onClick={submitPhoto} disabled={loading} className="w-full rounded-2xl bg-green-500 px-6 py-4 text-sm font-black text-green-950 disabled:bg-slate-500">Submit Photo Update</button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Photo History</h2>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {photoLogs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/25 p-6 text-sm font-bold text-white/60 md:col-span-2">No photos yet.</div>
            ) : (
              photoLogs.map((log) => (
                <div key={log.id} className="rounded-2xl border border-white/10 bg-black/25 p-5">
                  <div className="aspect-video overflow-hidden rounded-xl bg-black/40">
                    <img src={log.photo_url} alt="Tree update" className="h-full w-full object-cover" />
                  </div>
                  <p className="mt-3 text-sm text-white/70">{log.remarks || "No remarks"}</p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(log.health_status)}`}>{log.health_status || "PHOTO"}</span>
                    <span className="text-xs font-bold text-white/50">{formatDate(log.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
