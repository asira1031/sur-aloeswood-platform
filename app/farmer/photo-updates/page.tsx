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
      supabase.from("gardener_assignments").select("*").eq("gardener_id", gardenerRow.id),
      supabase.from("tree_registry").select("id, profile_id, purchase_id, tree_code, denr_tag_number, species, status, gps_lat, gps_lng, farm_id, farm_location_note, planted_at, created_at"),
      supabase.from("tree_growth_logs").select("id, profile_id, tree_id, tree_code, gardener_id, height_cm, diameter_cm, health_status, remarks, notes, photo_url, status, created_at").order("created_at", { ascending: false }),
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
    const tree = trees.find((row) => row.id === selectedTreeId);

    const { error } = await supabase.from("tree_growth_logs").insert({
      profile_id: tree?.profile_id || null,
      tree_id: selectedTreeId,
      tree_code: tree?.tree_code || null,
      gardener_id: gardener?.id || null,
      health_status: "PHOTO_UPDATE",
      remarks: remarks.trim() || "Farmer photo update.",
      notes: remarks.trim() || "Farmer photo update.",
      photo_url: photoUrl.trim(),
      status: "LOGGED",
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    await supabase.from("notifications").insert({
      profile_id: tree?.profile_id || null,
      title: "Tree Photo Update",
      message: `A farmer uploaded a new photo update for tree ${getTreeLabel(tree)}.`,
      is_read: false,
    });

    const assignment = assignments.find((row) => row.tree_id === selectedTreeId);
    if (assignment?.maintenance_order_id) {
      await supabase
        .from("maintenance_orders")
        .update({ work_status: "PHOTO_SUBMITTED", updated_at: new Date().toISOString() })
        .eq("id", assignment.maintenance_order_id);
    }

    setPhotoUrl("");
    setRemarks("");
    setMessage("Photo update submitted.");
    await loadData(email);
    setLoading(false);
  }

  const photoLogs = useMemo(() => logs.filter((log) => Boolean(log.photo_url)), [logs]);

  return (
    <main className="min-h-screen bg-[#f3f7f1] text-slate-950">
      <section className="border-b border-emerald-100 bg-white px-4 py-6 shadow-sm sm:px-6 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-emerald-700">SUR ALOESWOOD FARMER</p>
              <h1 className="mt-4 text-4xl font-black md:text-6xl">Photo Updates</h1>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/farmer/dashboard" className="rounded-2xl border border-emerald-100 bg-white px-5 py-3 text-sm font-black text-emerald-900 hover:bg-emerald-50">Dashboard</Link>
              <Link href="/farmer/growth-logs" className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700">Growth Logs</Link>
            </div>
          </div>

          {message && <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">{message}</div>}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 md:px-10 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
          <h2 className="text-3xl font-black">Submit Photo</h2>

          <div className="mt-6 space-y-4">
            <select value={selectedTreeId} onChange={(e) => setSelectedTreeId(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400">
              <option value="">Select assigned tree</option>
              {trees.map((tree) => <option key={tree.id} value={tree.id}>{getTreeLabel(tree)}</option>)}
            </select>
            <input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="Photo URL" className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400" />
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={5} placeholder="Remarks" className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400" />
            <button onClick={submitPhoto} disabled={loading} className="w-full rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black text-white hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500">Submit Photo Update</button>
          </div>
        </div>

        <div className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
          <h2 className="text-3xl font-black">Photo History</h2>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {photoLogs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm font-bold text-slate-500 md:col-span-2">No photos yet.</div>
            ) : (
              photoLogs.map((log) => (
                <div key={log.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="aspect-video overflow-hidden rounded-xl bg-slate-100">
                    <img src={log.photo_url} alt="Tree update" className="h-full w-full object-cover" />
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{log.remarks || "No remarks"}</p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(log.health_status)}`}>{log.health_status || "PHOTO"}</span>
                    <span className="text-xs font-bold text-slate-500">{formatDate(log.created_at)}</span>
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
