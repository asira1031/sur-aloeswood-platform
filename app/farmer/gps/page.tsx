"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { getTreeLabel, type AnyRow } from "@/app/lib/farmer/growth";

export default function FarmerGpsPage() {
  const [email, setEmail] = useState("");
  const [gardener, setGardener] = useState<AnyRow | null>(null);
  const [trees, setTrees] = useState<AnyRow[]>([]);
  const [assignments, setAssignments] = useState<AnyRow[]>([]);
  const [selectedTreeId, setSelectedTreeId] = useState("");
  const [farmId, setFarmId] = useState("");
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

    const [{ data: assignmentRows }, { data: treeRows }] = await Promise.all([
      supabase.from("gardener_assignments").select("id, gardener_id, tree_id, status, assigned_at").eq("gardener_id", gardenerRow.id),
      supabase.from("trees").select("id, tree_id, profile_id, farm_id, qr_code, age_months, height_cm, current_value, harvest_estimate_year, status, created_at"),
    ]);

    const assignedTreeIds = new Set((assignmentRows || []).map((row: AnyRow) => row.tree_id));
    const assignedTrees = (treeRows || []).filter((tree: AnyRow) => assignedTreeIds.has(tree.id));

    setGardener(gardenerRow);
    setAssignments((assignmentRows || []) as AnyRow[]);
    setTrees(assignedTrees as AnyRow[]);
    setSelectedTreeId((assignedTrees[0] as AnyRow | undefined)?.id || "");
    setFarmId((assignedTrees[0] as AnyRow | undefined)?.farm_id || "");
    setLoading(false);
  }

  async function updateTreeFarm() {
    if (!selectedTreeId || !farmId.trim()) {
      setMessage("Select tree and enter farm/location ID.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { error } = await supabase
      .from("trees")
      .update({ farm_id: farmId.trim() })
      .eq("id", selectedTreeId);

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const tree = trees.find((row) => row.id === selectedTreeId);

    await supabase.from("notifications").insert({
      profile_id: tree?.profile_id || null,
      title: "Tree Location Updated",
      message: `A farmer updated the farm/location reference for tree ${getTreeLabel(tree)}.`,
      is_read: false,
    });

    setMessage("Tree farm/location reference updated.");
    await loadData(email);
    setLoading(false);
  }

  const selectedTree = useMemo(() => trees.find((tree) => tree.id === selectedTreeId) || null, [trees, selectedTreeId]);

  return (
    <main className="min-h-screen bg-[#04140d] text-white">
      <section className="border-b border-white/10 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-green-300">SUR ALOESWOOD FARMER</p>
              <h1 className="mt-4 text-4xl font-black md:text-6xl">GPS / Location</h1>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/farmer/dashboard" className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black">Dashboard</Link>
              <Link href="/farmer/assigned-trees" className="rounded-2xl bg-green-500 px-5 py-3 text-sm font-black text-green-950">Assigned Trees</Link>
            </div>
          </div>

          <div className="mt-8 grid gap-3 rounded-3xl border border-white/10 bg-white/10 p-4 md:grid-cols-[1fr_auto]">
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Farmer email" className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
            <button onClick={() => loadData()} disabled={loading} className="rounded-2xl bg-green-500 px-8 py-4 text-sm font-black text-green-950 disabled:bg-slate-500">{loading ? "Loading..." : "Load"}</button>
          </div>

          {message && <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 md:px-10 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Update Location Reference</h2>

          <div className="mt-6 space-y-4">
            <select value={selectedTreeId} onChange={(e) => {
              setSelectedTreeId(e.target.value);
              const nextTree = trees.find((tree) => tree.id === e.target.value);
              setFarmId(nextTree?.farm_id || "");
            }} className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none">
              <option value="">Select assigned tree</option>
              {trees.map((tree) => <option key={tree.id} value={tree.id}>{getTreeLabel(tree)}</option>)}
            </select>

            <input value={farmId} onChange={(e) => setFarmId(e.target.value)} placeholder="Farm / location UUID reference" className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />

            <button onClick={updateTreeFarm} disabled={loading} className="w-full rounded-2xl bg-green-500 px-6 py-4 text-sm font-black text-green-950 disabled:bg-slate-500">
              Update Location Reference
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Selected Tree</h2>

          {!selectedTree ? (
            <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-black/25 p-6 text-sm font-bold text-white/60">Select tree.</div>
          ) : (
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <Info label="Tree" value={getTreeLabel(selectedTree)} />
              <Info label="Farm ID" value={selectedTree.farm_id || "-"} />
              <Info label="QR Code" value={selectedTree.qr_code || "-"} />
              <Info label="Status" value={selectedTree.status || "-"} />
              <Info label="Age Months" value={String(selectedTree.age_months || "-")} />
              <Info label="Height" value={`${selectedTree.height_cm || "-"} cm`} />
            </div>
          )}
        </div>
      </section>
    </main>
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
