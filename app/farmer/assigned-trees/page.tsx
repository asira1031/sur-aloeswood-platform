"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import {
  formatDate,
  getAssignmentTree,
  getTreeLabel,
  pick,
  statusClass,
  type AnyRow,
} from "@/app/lib/farmer/assignments";

export default function FarmerAssignedTreesPage() {
  const [email, setEmail] = useState("");
  const [farmer, setFarmer] = useState<AnyRow | null>(null);
  const [assignments, setAssignments] = useState<AnyRow[]>([]);
  const [trees, setTrees] = useState<AnyRow[]>([]);
  const [selected, setSelected] = useState<AnyRow | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("sur_login_email") || "";
    setEmail(saved);
    if (saved) loadAssignedTrees(saved);
  }, []);

  async function loadAssignedTrees(targetEmail = email) {
    setLoading(true);
    setMessage("");

    const cleanEmail = targetEmail.toLowerCase().trim();

    const { data: gardenerRow } = await supabase
      .from("gardeners")
      .select("*")
      .or(`email.eq.${cleanEmail},farmer_email.eq.${cleanEmail},gardener_email.eq.${cleanEmail}`)
      .maybeSingle();

    const farmerId = gardenerRow?.id || gardenerRow?.profile_id || gardenerRow?.farmer_profile_id || gardenerRow?.gardener_profile_id;

    const [{ data: assignmentRows, error: assignmentError }, { data: treeRows }] = await Promise.all([
      farmerId
        ? supabase
            .from("gardener_assignments")
            .select("*")
            .or(`gardener_id.eq.${farmerId},farmer_id.eq.${farmerId},gardener_profile_id.eq.${farmerId},farmer_profile_id.eq.${farmerId}`)
            .order("created_at", { ascending: false })
        : supabase.from("gardener_assignments").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("trees").select("*").order("created_at", { ascending: false }).limit(1000),
    ]);

    if (assignmentError) {
      setMessage(assignmentError.message);
      setLoading(false);
      return;
    }

    const safeAssignments = (assignmentRows || []) as AnyRow[];

    setFarmer(gardenerRow || { email: cleanEmail });
    setAssignments(safeAssignments);
    setTrees((treeRows || []) as AnyRow[]);
    setSelected(safeAssignments[0] || null);
    setLoading(false);
  }

  const filteredAssignments = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return assignments.filter((assignment) => {
      const tree = getAssignmentTree(assignment, trees);
      const text = `${JSON.stringify(assignment)} ${JSON.stringify(tree || {})}`.toLowerCase();
      return !keyword || text.includes(keyword);
    });
  }, [assignments, trees, search]);

  const selectedTree = selected ? getAssignmentTree(selected, trees) : null;

  return (
    <main className="min-h-screen bg-[#04140d] text-white">
      <section className="border-b border-white/10 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-green-300">SUR ALOESWOOD FARMER</p>
              <h1 className="mt-4 text-4xl font-black md:text-6xl">Assigned Trees</h1>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/farmer/dashboard" className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black">Dashboard</Link>
              <Link href="/farmer/dashboard/task" className="rounded-2xl bg-green-500 px-5 py-3 text-sm font-black text-green-950">Tasks</Link>
            </div>
          </div>

          {message && <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-8 md:grid-cols-3 md:px-10">
        <Metric title="Farmer" value={farmer ? pick(farmer, ["full_name", "name", "email"]) : "Not loaded"} />
        <Metric title="Assignments" value={String(assignments.length)} />
        <Metric title="Trees Loaded" value={String(trees.length)} />
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-16 md:px-10 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-3xl font-black">Assigned Tree List</h2>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none" />
          </div>

          <div className="mt-6 space-y-3">
            {filteredAssignments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/25 p-6 text-sm font-bold text-white/60">No assigned trees found.</div>
            ) : (
              filteredAssignments.map((assignment) => {
                const tree = getAssignmentTree(assignment, trees);
                const status = assignment.status || tree?.status || "ASSIGNED";

                return (
                  <button key={assignment.id} onClick={() => setSelected(assignment)} className={`w-full rounded-2xl border p-5 text-left ${selected?.id === assignment.id ? "border-green-300 bg-green-400/15" : "border-white/10 bg-black/25"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-black text-green-200">{tree ? getTreeLabel(tree) : pick(assignment, ["tree_code", "tree_id", "id"])}</p>
                        <p className="mt-1 text-sm text-white/60">{tree?.location || tree?.farm_id || "No location"}</p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(status)}`}>{status}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Tree Details</h2>

          {!selected ? (
            <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-black/25 p-6 text-sm font-bold text-white/60">Select an assignment.</div>
          ) : (
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <Info label="Tree" value={selectedTree ? getTreeLabel(selectedTree) : pick(selected, ["tree_code", "tree_id", "id"])} />
              <Info label="Task" value={pick(selected, ["task_type", "assignment_type", "title"], "Tree Care Task")} />
              <Info label="Status" value={pick(selected, ["status"], "ASSIGNED")} />
              <Info label="Location" value={pick(selectedTree || {}, ["location", "farm_id", "farm_code"], "-")} />
              <Info label="Stage" value={pick(selectedTree || {}, ["stage"], "-")} />
              <Info label="Health" value={pick(selectedTree || {}, ["health_status", "status"], "-")} />
              <Info label="Created" value={formatDate(selected.created_at)} />
              <Info label="Due" value={formatDate(selected.due_date || selected.scheduled_at)} />
            </div>
          )}

          {selectedTree && (
            <details className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-5">
              <summary className="cursor-pointer text-sm font-black text-green-200">Raw Tree Record</summary>
              <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap text-xs text-white/65">{JSON.stringify(selectedTree, null, 2)}</pre>
            </details>
          )}
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/25 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-white/45">{label}</p>
      <p className="mt-2 text-sm font-black text-white">{value}</p>
    </div>
  );
}
