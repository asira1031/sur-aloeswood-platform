"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";

type Row = Record<string, unknown>;

export default function AdminCareOperationsPage() {
  const [trees, setTrees] = useState<Row[]>([]);
  const [assignments, setAssignments] = useState<Row[]>([]);
  const [caretakers, setCaretakers] = useState<Row[]>([]);
  const [updates, setUpdates] = useState<Row[]>([]);
  const [selectedTreeId, setSelectedTreeId] = useState("");
  const [caretakerId, setCaretakerId] = useState("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setMessage("");

    const [treeResult, assignmentResult, caretakerResult, updateResult, gardenerResult] = await Promise.all([
      supabase.from("sur_trees").select("id,tree_id,profile_id,species,care_plan,status,general_location,caretaker_profile_id,activated_at,planted_at,created_at").order("created_at", { ascending: false }),
      supabase.from("sur_tree_assignments").select("id,tree_id,caretaker_profile_id,status,task_title,admin_note,assigned_at,updated_at"),
      supabase.from("profiles").select("id,full_name,email,role,account_status").eq("account_status", "ACTIVE").order("full_name"),
      supabase.from("sur_tree_updates").select("id,tree_id,caretaker_profile_id,observed_on,care_period,started_at,task_done,health_status,notes,photo_path,status,is_planting_record,review_note,reviewed_at,created_at").order("created_at", { ascending: false }).limit(500),
      supabase.from("gardeners").select("email,status").in("status", ["ACTIVE", "APPROVED"]),
    ]);

    const setupError = [assignmentResult.error, updateResult.error].find((error) => error?.code === "PGRST205");
    if (setupError) {
      setMessage("Care Operations needs the one-time 082-tree-care-operations migration.");
    } else if (treeResult.error || assignmentResult.error || caretakerResult.error || updateResult.error || gardenerResult.error) {
      setMessage("Care Operations could not load. Run Guardian verification before assigning or reviewing work.");
    }

    const treeRows = (treeResult.data || []) as Row[];
    const updateRows = await Promise.all(
      ((updateResult.data || []) as Row[]).map(async (row) => {
        const path = String(row.photo_path || "");
        if (!path) return row;
        const { data } = await supabase.storage.from("sur-tree-evidence").createSignedUrl(path, 600);
        return { ...row, photo_url: data?.signedUrl || "" };
      })
    );

    setTrees(treeRows);
    setAssignments((assignmentResult.data || []) as Row[]);
    const approvedEmails = new Set((gardenerResult.data || []).map(row => String(row.email).trim().toLowerCase()));
    setCaretakers(((caretakerResult.data || []) as Row[]).filter(row => approvedEmails.has(String(row.email).trim().toLowerCase())));
    setUpdates(updateRows);
    setSelectedTreeId((current) => treeRows.some((tree) => tree.id === current) ? current : String(treeRows[0]?.id || ""));
    setLoading(false);
  }

  const selectedTree = useMemo(() => trees.find((tree) => String(tree.id) === selectedTreeId) || null, [selectedTreeId, trees]);
  const selectedAssignment = useMemo(() => assignments.find((row) => String(row.tree_id) === selectedTreeId) || null, [assignments, selectedTreeId]);
  const selectedUpdates = useMemo(() => updates.filter((row) => String(row.tree_id) === selectedTreeId), [selectedTreeId, updates]);
  const pendingUpdates = updates.filter((row) => row.status === "PENDING_ADMIN_REVIEW").length;

  useEffect(() => {
    setCaretakerId(String(selectedAssignment?.caretaker_profile_id || selectedTree?.caretaker_profile_id || ""));
    setLocation(String(selectedTree?.general_location || ""));
    setNote(String(selectedAssignment?.admin_note || ""));
  }, [selectedAssignment, selectedTree]);

  async function assign() {
    if (!selectedTree || !caretakerId) {
      setMessage("Select a tree and an active caretaker.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.rpc("sur_admin_assign_tree_caretaker", {
      p_tree_id: selectedTree.id,
      p_caretaker_profile_id: caretakerId,
      p_general_location: location,
      p_note: note,
    });
    setLoading(false);
    setMessage(error?.message || "Caretaker assigned. The Tree ID is now in the caretaker's daily task queue.");
    if (!error) { await load(); setMessage("Caretaker assigned successfully."); }
  }

  async function confirmPlanting(id: unknown) {
    if (!window.confirm("Confirm this approved evidence proves the tree was planted on its observation date? This record will also be visible to customers without paid care.")) return;
    setLoading(true);
    try {
      const result = await supabase.rpc("sur_confirm_planting_record", {p_update:id});
      if(result.error) throw new Error(result.error.message);
      await load();
    } catch(e) { setMessage(e instanceof Error ? e.message : "Could not confirm planting. Refresh and retry."); }
    finally { setLoading(false); }
  }

  async function review(updateId: unknown, decision: "APPROVED" | "REJECTED") {
    const reviewNote = window.prompt(
      decision === "APPROVED" ? "Approval note:" : "Required rejection/correction note:",
      decision === "APPROVED" ? "Photo and field note verified." : "Please submit corrected evidence."
    );
    if (!reviewNote) return;

    setLoading(true);
    const { error } = await supabase.rpc("sur_admin_review_tree_update", {
      p_update_id: updateId,
      p_decision: decision,
      p_note: reviewNote,
    });
    setLoading(false);
    setMessage(error?.message || `Daily update ${decision.toLowerCase()}.`);
    if (!error) { await load(); setMessage(`Daily update ${decision.toLowerCase()}.`); }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-3 text-slate-950 sm:p-5 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-[1.5rem] bg-gradient-to-r from-emerald-950 to-slate-950 p-5 text-white sm:rounded-[2rem] sm:p-7">
          <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-300 sm:tracking-[.25em]">Admin backend</p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">Tree Care Operations</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">Assign a signed Tree ID to an active caretaker, then verify each original-quality daily photo before it becomes customer-visible.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Metric label="Signed/active trees" value={String(trees.filter((tree) => String(tree.status) !== "AWAITING_CUSTOMER_SIGNATURE").length)} />
            <Metric label="Assigned trees" value={String(assignments.filter((row) => row.status !== "CLOSED").length)} />
            <Metric label="Updates to review" value={String(pendingUpdates)} warn={pendingUpdates > 0} />
          </div>
        </header>

        {message && <p aria-live="polite" className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">{message}</p>}

        <div className="mt-5 grid gap-5 lg:grid-cols-[.72fr_1.28fr]">
          <section className="min-w-0 rounded-[1.5rem] bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><h2 className="text-xl font-black sm:text-2xl">Tree IDs</h2><p className="mt-1 text-xs text-slate-500">Customer signature is required before assignment.</p></div>
              <button onClick={load} className="mobile-primary-action shrink-0 rounded-xl border px-3 py-2 text-xs font-black">{loading ? "Loading…" : "Refresh"}</button>
            </div>
            <div className="mt-5 max-h-[720px] space-y-3 overflow-auto">
              {trees.length === 0 && !loading ? <Empty text="No official Tree IDs yet." /> : trees.map((tree) => {
                const assignment = assignments.find((row) => row.tree_id === tree.id);
                const caretaker = caretakers.find((row) => row.id === assignment?.caretaker_profile_id);
                return <button key={String(tree.id)} onClick={() => setSelectedTreeId(String(tree.id))} className={`w-full rounded-2xl border p-4 text-left ${selectedTreeId === String(tree.id) ? "border-emerald-500 bg-emerald-50" : "border-slate-200"}`}>
                  <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-black">{String(tree.tree_id)}</p><p className="mt-1 text-xs text-slate-500">{String(tree.species)}</p></div><Status value={String(tree.status)} /></div>
                  <p className="mt-3 text-xs font-bold text-slate-600">Caretaker: {String(caretaker?.full_name || "Unassigned")}</p>
                </button>;
              })}
            </div>
          </section>

          <div className="space-y-5">
            <section className="min-w-0 rounded-[1.5rem] bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-6">
              {!selectedTree ? <Empty text="Select a Tree ID." /> : <>
                <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="text-xs font-black uppercase text-slate-400">Selected Tree ID</p><h2 className="mt-2 break-words text-2xl font-black text-emerald-800 sm:text-3xl">{String(selectedTree.tree_id)}</h2></div><Status value={String(selectedTree.status)} /></div>
                {String(selectedTree.status) === "AWAITING_CUSTOMER_SIGNATURE" && <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">Assignment is locked until the customer signs the per-tree contract.</p>}
                <div className="mt-5 grid gap-3 sm:grid-cols-2"><Info label="Care plan" value={pretty(String(selectedTree.care_plan))} /><Info label="Current assignment" value={pretty(String(selectedAssignment?.status || "UNASSIGNED"))} /></div>
                <label className="mt-5 block text-sm font-black">Active farm/caretaker</label>
                <select value={caretakerId} onChange={(event) => setCaretakerId(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base font-bold">
                  <option value="">Select caretaker</option>
                  {caretakers.map((person) => <option key={String(person.id)} value={String(person.id)}>{String(person.full_name)} · {String(person.role)}</option>)}
                </select>
                <label className="mt-4 block text-sm font-black">General customer-visible location</label>
                <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Example: Quezon Province" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-base font-bold" />
                <label className="mt-4 block text-sm font-black">Private admin instruction</label>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Tree ID task instruction only; do not expose private farm details." className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-base font-bold" />
                <button disabled={loading || String(selectedTree.status) === "AWAITING_CUSTOMER_SIGNATURE"} onClick={assign} className="mobile-primary-action mt-5 w-full rounded-2xl bg-emerald-700 px-6 py-3 font-black text-white disabled:opacity-40 sm:w-auto">Assign caretaker</button>
              </>}
            </section>

            <section className="min-w-0 rounded-[1.5rem] bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-6">
              <h2 className="text-2xl font-black">Daily evidence</h2>
              <p className="mt-2 text-sm text-slate-500">Only approved evidence is visible to the customer.</p>
              <div className="mt-5 space-y-4">
                {selectedUpdates.length === 0 ? <Empty text="No daily update for this Tree ID yet." /> : selectedUpdates.map((update) => <div key={String(update.id)} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black">{pretty(String(update.care_period))} · {String(update.started_at || "No time").slice(0,5)}</p><p className="mt-1 text-xs font-bold text-slate-500">{dateText(String(update.observed_on))} · {pretty(String(update.health_status))}</p></div><Status value={String(update.status)} /></div>
                  <p className="mt-3 text-sm font-black leading-6 text-slate-800">Task: {String(update.task_done)}</p>
                  {Boolean(update.notes) && <p className="mt-2 text-sm leading-6 text-slate-700">Notes: {String(update.notes)}</p>}
                  {Boolean(update.photo_url) && <a href={String(update.photo_url)} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-xl bg-sky-50 px-3 py-2 text-xs font-black text-sky-800">Open original photo (10-minute link)</a>}
                  {update.status === "PENDING_ADMIN_REVIEW" && <div className="mt-4 grid gap-2 sm:flex"><button onClick={() => review(update.id, "APPROVED")} className="mobile-primary-action w-full rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white sm:w-auto">Approve</button><button onClick={() => review(update.id, "REJECTED")} className="mobile-primary-action w-full rounded-xl border border-red-200 px-4 py-2 text-xs font-black text-red-700 sm:w-auto">Request correction</button></div>}
                  {update.status === "APPROVED" && (update.is_planting_record ? <p className="mt-3 text-sm font-bold text-emerald-700">Confirmed planting record</p> : <button disabled={loading} onClick={() => void confirmPlanting(update.id)} className="mt-3 rounded-xl border px-4 py-3 text-sm font-bold">Confirm as planting evidence</button>)}
                  {Boolean(update.review_note) && <p className="mt-3 text-xs font-bold text-amber-800">Admin note: {String(update.review_note)}</p>}
                </div>)}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function Metric({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) { return <div className={`rounded-2xl border p-4 ${warn ? "border-amber-300/40 bg-amber-300/10" : "border-white/15 bg-white/10"}`}><p className="text-xs font-black uppercase text-white/55">{label}</p><p className={`mt-2 text-2xl font-black ${warn ? "text-amber-200" : "text-emerald-300"}`}>{value}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-400">{label}</p><p className="mt-2 font-black">{value}</p></div>; }
function Status({ value }: { value: string }) { const tone = value.includes("APPROVED") || value.startsWith("ACTIVE") || value === "IN_PROGRESS" ? "bg-emerald-100 text-emerald-800" : value.includes("REJECT") ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"; return <span className={`rounded-full px-3 py-1 text-[10px] font-black ${tone}`}>{pretty(value)}</span>; }
function Empty({ text }: { text: string }) { return <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">{text}</p>; }
function pretty(value: string) { return String(value || "PENDING").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function dateText(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }); }
