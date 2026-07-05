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
import { taskActionLabel, nextTaskStatus, taskStatus } from "@/app/lib/farmer/tasks";

export default function FarmerTaskPage() {
  const [email, setEmail] = useState("");
  const [farmer, setFarmer] = useState<AnyRow | null>(null);
  const [assignments, setAssignments] = useState<AnyRow[]>([]);
  const [trees, setTrees] = useState<AnyRow[]>([]);
  const [selected, setSelected] = useState<AnyRow | null>(null);
  const [note, setNote] = useState("");
  const [height, setHeight] = useState("");
  const [diameter, setDiameter] = useState("");
  const [health, setHealth] = useState("HEALTHY");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("sur_login_email") || "";
    setEmail(saved);
    if (saved) loadTasks(saved);
  }, []);

  async function loadTasks(targetEmail = email) {
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

    localStorage.setItem("sur_login_email", cleanEmail);
    if (farmerId) localStorage.setItem("sur_farmer_id", farmerId);

    const safeAssignments = (assignmentRows || []) as AnyRow[];

    setFarmer(gardenerRow || { email: cleanEmail });
    setAssignments(safeAssignments);
    setTrees((treeRows || []) as AnyRow[]);
    setSelected(safeAssignments[0] || null);
    setLoading(false);
  }

  async function advanceTask(row: AnyRow) {
    setBusyId(row.id);
    setMessage("");

    const next = nextTaskStatus(row.status);

    const { error } = await supabase
      .from("gardener_assignments")
      .update({
        status: next,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (error) {
      setMessage(error.message);
      setBusyId("");
      return;
    }

    setMessage(`Task updated to ${next}.`);
    await loadTasks(email);
    setBusyId("");
  }

  async function submitGrowthLog() {
    if (!selected) {
      setMessage("Select task first.");
      return;
    }

    const tree = getAssignmentTree(selected, trees);

    setLoading(true);
    setMessage("");

    const { error } = await supabase.from("tree_growth_logs").insert({
      profile_id: selected.profile_id || selected.owner_profile_id || null,
      tree_id: selected.tree_id || tree?.id || null,
      tree_code: selected.tree_code || tree?.tree_code || tree?.code || null,
      gardener_id: farmer?.id || farmer?.profile_id || null,
      height_cm: height ? Number(height) : null,
      diameter_cm: diameter ? Number(diameter) : null,
      health_status: health,
      notes: note.trim() || "Farmer field update.",
      status: "LOGGED",
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setNote("");
    setHeight("");
    setDiameter("");
    setHealth("HEALTHY");
    setMessage("Growth log submitted.");
    setLoading(false);
  }

  const groups = useMemo(() => {
    return {
      assigned: assignments.filter((a) => taskStatus(a.status) === "ASSIGNED"),
      progress: assignments.filter((a) => taskStatus(a.status) === "IN_PROGRESS"),
      completed: assignments.filter((a) => taskStatus(a.status) === "COMPLETED"),
    };
  }, [assignments]);

  return (
    <main className="min-h-screen bg-[#04140d] text-white">
      <section className="border-b border-white/10 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-green-300">SUR ALOESWOOD FARMER</p>
              <h1 className="mt-4 text-4xl font-black md:text-6xl">Task Center</h1>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/farmer/dashboard" className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black">Dashboard</Link>
              <Link href="/farmer/assigned-trees" className="rounded-2xl bg-green-500 px-5 py-3 text-sm font-black text-green-950">Assigned Trees</Link>
            </div>
          </div>

          {message && <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-8 md:grid-cols-3 md:px-10">
        <Metric title="Assigned" value={String(groups.assigned.length)} />
        <Metric title="In Progress" value={String(groups.progress.length)} />
        <Metric title="Completed" value={String(groups.completed.length)} />
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-16 md:px-10 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Tasks</h2>

          <div className="mt-6 space-y-3">
            {assignments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/25 p-6 text-sm font-bold text-white/60">No tasks found.</div>
            ) : (
              assignments.map((assignment) => {
                const tree = getAssignmentTree(assignment, trees);
                const status = taskStatus(assignment.status);

                return (
                  <button key={assignment.id} onClick={() => setSelected(assignment)} className={`w-full rounded-2xl border p-5 text-left ${selected?.id === assignment.id ? "border-green-300 bg-green-400/15" : "border-white/10 bg-black/25"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-black text-green-200">{tree ? getTreeLabel(tree) : pick(assignment, ["tree_code", "tree_id", "id"])}</p>
                        <p className="mt-1 text-sm text-white/60">{pick(assignment, ["task_type", "assignment_type", "title"], "Tree Care Task")}</p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(status)}`}>{status}</span>
                    </div>
                    <p className="mt-3 text-xs font-bold text-white/50">Created: {formatDate(assignment.created_at)}</p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
            <h2 className="text-3xl font-black">Selected Task</h2>

            {!selected ? (
              <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-black/25 p-6 text-sm font-bold text-white/60">Select a task.</div>
            ) : (
              <>
                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  <Info label="Task" value={pick(selected, ["task_type", "assignment_type", "title"], "Tree Care Task")} />
                  <Info label="Status" value={taskStatus(selected.status)} />
                  <Info label="Due" value={formatDate(selected.due_date || selected.scheduled_at)} />
                  <Info label="Notes" value={pick(selected, ["notes", "description", "remarks"], "No notes")} />
                </div>

                <button disabled={busyId === selected.id || taskStatus(selected.status) === "COMPLETED"} onClick={() => advanceTask(selected)} className="mt-5 w-full rounded-2xl bg-green-500 px-6 py-4 text-sm font-black text-green-950 disabled:bg-slate-500">
                  {taskActionLabel(selected.status)}
                </button>
              </>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
            <h2 className="text-3xl font-black">Submit Growth Log</h2>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <input value={height} onChange={(e) => setHeight(e.target.value)} placeholder="Height cm" type="number" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
              <input value={diameter} onChange={(e) => setDiameter(e.target.value)} placeholder="Diameter cm" type="number" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
              <select value={health} onChange={(e) => setHealth(e.target.value)} className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none md:col-span-2">
                <option>HEALTHY</option>
                <option>GROWING</option>
                <option>NEEDS_ATTENTION</option>
                <option>DAMAGED</option>
                <option>SICK</option>
              </select>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Field notes..." rows={4} className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none md:col-span-2" />
            </div>

            <button onClick={submitGrowthLog} disabled={loading || !selected} className="mt-5 w-full rounded-2xl bg-green-500 px-6 py-4 text-sm font-black text-green-950 disabled:bg-slate-500">
              Submit Growth Log
            </button>
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/25 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-white/45">{label}</p>
      <p className="mt-2 text-sm font-black text-white">{value}</p>
    </div>
  );
}
