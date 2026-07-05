"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { getAuthenticatedProfile } from "@/app/lib/auth/session";
import {
  formatDate,
  getAssignmentTree,
  getTreeLabel,
  pick,
  statusClass,
  type AnyRow,
} from "@/app/lib/farmer/assignments";
import { taskActionLabel, nextTaskStatus, taskStatus } from "@/app/lib/farmer/tasks";

const CARETAKER_UPLOAD_BUCKET = "caretaker-updates";

function requiresPhotoEvidence(task: AnyRow | null) {
  const label = String(pick(task || {}, ["task_type", "assignment_type", "title"], "")).toUpperCase();
  return label.includes("PHOTO");
}

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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function boot() {
      const saved = localStorage.getItem("sur_login_email") || "";
      const profile = saved ? null : await getAuthenticatedProfile();
      const targetEmail = saved || profile?.email || "";
      if (!mounted) return;
      setEmail(targetEmail);
      if (targetEmail) loadTasks(targetEmail);
    }

    boot();

    return () => {
      mounted = false;
    };
  }, []);

  async function loadTasks(targetEmail = email) {
    setLoading(true);
    setMessage("");

    const cleanEmail = targetEmail.toLowerCase().trim();

    const { data: gardenerRow } = await supabase
      .from("gardeners")
      .select("*")
      .eq("email", cleanEmail)
      .maybeSingle();

    const farmerId = gardenerRow?.id;

    const [{ data: assignmentRows, error: assignmentError }, { data: treeRows }] = await Promise.all([
      farmerId
        ? supabase
            .from("gardener_assignments")
            .select("*")
            .eq("gardener_id", farmerId)
            .order("assigned_at", { ascending: false })
        : supabase.from("gardener_assignments").select("*").eq("gardener_id", "00000000-0000-0000-0000-000000000000").limit(0),
      supabase.from("tree_registry").select("id, profile_id, purchase_id, tree_code, denr_tag_number, species, status, gps_lat, gps_lng, farm_id, farm_location_note, planted_at, created_at").order("created_at", { ascending: false }).limit(1000),
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
    const tree = getAssignmentTree(row, trees);

    if (next === "COMPLETED" && requiresPhotoEvidence(row)) {
      const treeId = row.tree_id || tree?.id || "";
      const treeCode = row.tree_code || tree?.tree_code || "";
      let photoCheckQuery = supabase
        .from("tree_growth_logs")
        .select("id, photo_url")
        .eq("gardener_id", farmer?.id || farmer?.profile_id || "")
        .not("photo_url", "is", null)
        .limit(1);

      photoCheckQuery = treeId ? photoCheckQuery.eq("tree_id", treeId) : photoCheckQuery.eq("tree_code", treeCode);

      const { data: photoLogs, error: photoCheckError } = await photoCheckQuery;

      if (photoCheckError) {
        setMessage(photoCheckError.message);
        setBusyId("");
        return;
      }

      if (!photoLogs?.length) {
        setMessage("Submit the required photo proof first before completing this Photo Documentation task.");
        setBusyId("");
        return;
      }
    }

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

    if (row.maintenance_order_id) {
      await supabase
        .from("maintenance_orders")
        .update({
          work_status: next === "COMPLETED" ? "COMPLETED" : next,
          completed_at: next === "COMPLETED" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.maintenance_order_id);
    }

    await supabase.from("notifications").insert({
      profile_id: row.profile_id || tree?.profile_id || null,
      title: next === "COMPLETED" ? "Tree maintenance completed" : "Tree maintenance updated",
      message: `${tree ? getTreeLabel(tree) : row.tree_code || "AG tree"} maintenance task is now ${next}.`,
      is_read: false,
    });

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
    const photoRequired = requiresPhotoEvidence(selected);

    if (photoRequired && !photoFile) {
      setMessage("This photo documentation task requires a camera/photo proof before submission.");
      return;
    }

    setLoading(true);
    setMessage("");

    let photoUrl = "";

    try {
      if (photoFile) {
        photoUrl = await uploadCaretakerPhoto(selected, tree, photoFile);
      }
    } catch (err: any) {
      setMessage(err?.message || "Unable to upload field photo.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("tree_growth_logs").insert({
      profile_id: selected.profile_id || selected.owner_profile_id || null,
      tree_id: selected.tree_id || tree?.id || null,
      tree_code: selected.tree_code || tree?.tree_code || tree?.code || null,
      gardener_id: farmer?.id || farmer?.profile_id || null,
      height_cm: height ? Number(height) : null,
      diameter_cm: diameter ? Number(diameter) : null,
      health_status: health,
      remarks: note.trim() || "Farmer field update.",
      notes: note.trim() || "Farmer field update.",
      photo_url: photoUrl || null,
      status: "LOGGED",
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    if (selected.maintenance_order_id) {
      await supabase
        .from("maintenance_orders")
        .update({
          work_status: photoRequired ? "PHOTO_SUBMITTED" : "FIELD_UPDATE_SUBMITTED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", selected.maintenance_order_id);
    }

    if (photoRequired) {
      await supabase
        .from("gardener_assignments")
        .update({
          status: "COMPLETED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", selected.id);

      if (selected.maintenance_order_id) {
        await supabase
          .from("maintenance_orders")
          .update({
            work_status: "COMPLETED",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", selected.maintenance_order_id);
      }
    }

    await supabase.from("notifications").insert({
      profile_id: selected.profile_id || tree?.profile_id || null,
      title: "Tree field update submitted",
      message: `A farmer submitted a ${health.toLowerCase()} field update for ${tree ? getTreeLabel(tree) : selected.tree_code || "your AG tree"}.`,
      is_read: false,
    });

    setNote("");
    setHeight("");
    setDiameter("");
    setHealth("HEALTHY");
    setPhotoFile(null);
    setMessage(photoRequired ? "Photo proof submitted and task completed." : photoUrl ? "Field report and photo submitted." : "Field report submitted.");
    setLoading(false);
    await loadTasks(email);
  }

  async function uploadCaretakerPhoto(assignment: AnyRow, tree: AnyRow | null, file: File) {
    const extension = file.name.split(".").pop() || "jpg";
    const safeTreeCode = String(assignment.tree_code || tree?.tree_code || assignment.tree_id || "tree").replace(/[^a-zA-Z0-9-]/g, "-");
    const path = `${assignment.id}/${safeTreeCode}-${Date.now()}.${extension}`;
    const { error } = await supabase.storage.from(CARETAKER_UPLOAD_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });

    if (error) {
      throw new Error(`${error.message}. Run database/caretaker-updates-storage.sql in Supabase if the upload bucket is not ready.`);
    }

    const { data, error: signedUrlError } = await supabase.storage
      .from(CARETAKER_UPLOAD_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 365);

    if (signedUrlError || !data?.signedUrl) {
      throw new Error(signedUrlError?.message || "Unable to create field photo access link.");
    }

    return data.signedUrl;
  }

  const groups = useMemo(() => {
    return {
      assigned: assignments.filter((a) => taskStatus(a.status) === "ASSIGNED"),
      progress: assignments.filter((a) => taskStatus(a.status) === "IN_PROGRESS"),
      completed: assignments.filter((a) => taskStatus(a.status) === "COMPLETED"),
    };
  }, [assignments]);

  return (
    <main className="min-h-screen bg-[#f3f7f1] text-slate-950">
      <section className="border-b border-emerald-100 bg-white px-4 py-6 shadow-sm sm:px-6 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-emerald-700">SUR ALOESWOOD FARMER</p>
              <h1 className="mt-4 text-4xl font-black md:text-6xl">Task Center</h1>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/farmer/dashboard" className="rounded-2xl border border-emerald-100 bg-white px-5 py-3 text-sm font-black text-emerald-900 hover:bg-emerald-50">Dashboard</Link>
              <Link href="/farmer/assigned-trees" className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700">Assigned Trees</Link>
            </div>
          </div>

          {message && <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">{message}</div>}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-8 md:grid-cols-3 md:px-10">
        <Metric title="Assigned" value={String(groups.assigned.length)} />
        <Metric title="In Progress" value={String(groups.progress.length)} />
        <Metric title="Completed" value={String(groups.completed.length)} />
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-16 md:px-10 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
          <h2 className="text-3xl font-black">Tasks</h2>

          <div className="mt-6 space-y-3">
            {assignments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm font-bold text-slate-500">No tasks found.</div>
            ) : (
              assignments.map((assignment) => {
                const tree = getAssignmentTree(assignment, trees);
                const status = taskStatus(assignment.status);

                return (
                  <button key={assignment.id} onClick={() => setSelected(assignment)} className={`w-full rounded-2xl border p-5 text-left ${selected?.id === assignment.id ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100" : "border-slate-200 bg-slate-50"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-black text-emerald-800">{tree ? getTreeLabel(tree) : pick(assignment, ["tree_code", "tree_id", "id"])}</p>
                        <p className="mt-1 text-sm text-slate-600">{pick(assignment, ["task_type", "assignment_type", "title"], "Tree Care Task")}</p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(status)}`}>{status}</span>
                    </div>
                    <p className="mt-3 text-xs font-bold text-slate-500">Assigned: {formatDate(assignment.assigned_at || assignment.updated_at)}</p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
            <h2 className="text-3xl font-black">Selected Task</h2>

            {!selected ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm font-bold text-slate-500">Select a task.</div>
            ) : (
              <>
                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  <Info label="Task" value={pick(selected, ["task_type", "assignment_type", "title"], "Tree Care Task")} />
                  <Info label="Status" value={taskStatus(selected.status)} />
                  <Info label="Due" value={formatDate(selected.due_date || selected.scheduled_at)} />
                  <Info label="Notes" value={pick(selected, ["notes", "description", "remarks"], "No notes")} />
                </div>

                <button disabled={busyId === selected.id || taskStatus(selected.status) === "COMPLETED"} onClick={() => advanceTask(selected)} className="mt-5 w-full rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black text-white hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500">
                  {taskActionLabel(selected.status)}
                </button>
              </>
            )}
          </div>

          <div className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
            <h2 className="text-3xl font-black">Submit Field Report</h2>
            <p className="mt-2 text-sm font-bold text-slate-600">Use your phone camera or upload an existing photo, then submit notes for admin and co-planter review.</p>
            {selected && requiresPhotoEvidence(selected) && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-black text-amber-900">
                Photo proof is required for this selected task.
              </div>
            )}

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <input value={height} onChange={(e) => setHeight(e.target.value)} placeholder="Height cm" type="number" className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400" />
              <input value={diameter} onChange={(e) => setDiameter(e.target.value)} placeholder="Diameter cm" type="number" className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400" />
              <select value={health} onChange={(e) => setHealth(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400 md:col-span-2">
                <option>HEALTHY</option>
                <option>GROWING</option>
                <option>NEEDS_ATTENTION</option>
                <option>DAMAGED</option>
                <option>SICK</option>
              </select>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Field notes..." rows={4} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400 md:col-span-2" />
              <label className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 p-5 md:col-span-2">
                <span className="block text-sm font-black text-slate-950">
                  Field photo / camera proof {selected && requiresPhotoEvidence(selected) ? "(required)" : "(optional)"}
                </span>
                <span className="mt-1 block text-xs font-bold text-slate-500">On mobile, this can open the camera. On desktop, choose an image file.</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => setPhotoFile(event.target.files?.[0] || null)}
                  className="mt-4 block w-full text-sm font-bold text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-sm file:font-black file:text-white"
                />
                {photoFile && <span className="mt-3 block text-sm font-black text-emerald-800">Selected: {photoFile.name}</span>}
              </label>
            </div>

            <button onClick={submitGrowthLog} disabled={loading || !selected} className="mt-5 w-full rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black text-white hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500">
              {loading ? "Submitting..." : "Submit Report to Admin & Customer"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-emerald-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-emerald-700">{title}</p>
      <p className="mt-3 truncate text-xl font-black text-emerald-700">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}
