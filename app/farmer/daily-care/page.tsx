"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { getAuthenticatedProfile } from "@/app/lib/auth/session";
import { supabase } from "@/app/lib/supabase/client";

type Row = Record<string, unknown>;

const healthOptions = [
  ["HEALTHY", "Healthy"],
  ["NEEDS_ATTENTION", "Needs attention"],
  ["TREATMENT", "Treatment applied"],
  ["DAMAGED", "Damaged"],
  ["REPLACEMENT_REVIEW", "Needs replacement review"],
] as const;

function todayLocal() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export default function CaretakerDailyCarePage() {
  const [assignments, setAssignments] = useState<Row[]>([]);
  const [trees, setTrees] = useState<Row[]>([]);
  const [updates, setUpdates] = useState<Row[]>([]);
  const [selectedTreeId, setSelectedTreeId] = useState("");
  const [observedOn, setObservedOn] = useState(todayLocal());
  const [health, setHealth] = useState("HEALTHY");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setMessage("");
    const profile = await getAuthenticatedProfile();
    if (!profile) {
      setMessage("Your caretaker session could not be verified. Please sign in again.");
      setLoading(false);
      return;
    }

    const assignmentResult = await supabase
      .from("sur_tree_assignments")
      .select("id,tree_id,status,task_title,admin_note,assigned_at,updated_at")
      .eq("caretaker_profile_id", profile.id)
      .in("status", ["ASSIGNED", "IN_PROGRESS"])
      .order("assigned_at", { ascending: false });

    if (assignmentResult.error) {
      setMessage(
        assignmentResult.error.code === "PGRST205"
          ? "Daily Care needs the one-time 082-tree-care-operations setup."
          : "Your task queue is temporarily unavailable. Contact the admin if this continues."
      );
      setLoading(false);
      return;
    }

    const assignmentRows = (assignmentResult.data || []) as Row[];
    const treeIds = assignmentRows.map((row) => String(row.tree_id)).filter(Boolean);
    const [treeResult, updateResult] = await Promise.all([
      treeIds.length
        ? supabase.from("sur_trees").select("id,tree_id,species,care_plan,status,general_location,planted_at,created_at").in("id", treeIds)
        : Promise.resolve({ data: [], error: null }),
      treeIds.length
        ? supabase.from("sur_tree_updates").select("id,tree_id,observed_on,health_status,notes,status,review_note,created_at").in("tree_id", treeIds).order("created_at", { ascending: false }).limit(300)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const treeRows = (treeResult.data || []) as Row[];
    const requestedCode = new URLSearchParams(window.location.search).get("tree")?.trim().toUpperCase() || "";
    const requestedTree = treeRows.find((tree) => String(tree.tree_id).toUpperCase() === requestedCode);

    setAssignments(assignmentRows);
    setTrees(treeRows);
    setUpdates((updateResult.data || []) as Row[]);
    setSelectedTreeId((current) => requestedTree ? String(requestedTree.id) : treeIds.includes(current) ? current : treeIds[0] || "");
    setLoading(false);
  }

  const selectedTree = useMemo(() => trees.find((tree) => String(tree.id) === selectedTreeId) || null, [selectedTreeId, trees]);
  const selectedAssignment = useMemo(() => assignments.find((row) => String(row.tree_id) === selectedTreeId) || null, [assignments, selectedTreeId]);
  const selectedUpdates = useMemo(() => updates.filter((row) => String(row.tree_id) === selectedTreeId), [selectedTreeId, updates]);
  const alreadySubmitted = selectedUpdates.some((row) => String(row.observed_on) === observedOn && ["PENDING_ADMIN_REVIEW", "APPROVED"].includes(String(row.status)));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTree || !selectedAssignment) {
      setMessage("Select an assigned Tree ID first.");
      return;
    }
    if (!photo) {
      setMessage("Take or select one clear original-quality tree photo.");
      return;
    }
    if (photo.size > 15 * 1024 * 1024) {
      setMessage("The original photo is over 15 MB. Use a camera photo up to 15 MB; the app will not reduce its quality.");
      return;
    }
    if (!photo.type.startsWith("image/")) {
      setMessage("The evidence must be an image file.");
      return;
    }
    if (notes.trim().length < 3) {
      setMessage("Add a short field note describing the tree today.");
      return;
    }
    if (alreadySubmitted) {
      setMessage("This Tree ID already has an update pending or approved for that date.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    const { data: authData } = await supabase.auth.getUser();
    const authUserId = authData.user?.id;
    if (!authUserId) {
      setMessage("Your session expired. Sign in again before submitting.");
      setSubmitting(false);
      return;
    }

    const extension = photo.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const photoPath = `${authUserId}/${selectedTree.id}/${observedOn}-${crypto.randomUUID()}.${extension}`;
    const upload = await supabase.storage.from("sur-tree-evidence").upload(photoPath, photo, {
      cacheControl: "3600",
      upsert: false,
      contentType: photo.type,
    });

    if (upload.error) {
      setMessage(upload.error.message);
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.rpc("sur_submit_daily_tree_update", {
      p_tree_id: selectedTree.id,
      p_health_status: health,
      p_notes: notes.trim(),
      p_photo_path: photoPath,
      p_observed_on: observedOn,
    });

    if (error) {
      await supabase.storage.from("sur-tree-evidence").remove([photoPath]);
      setMessage(error.message);
      setSubmitting(false);
      return;
    }

    setMessage("Daily update submitted in original quality. It is waiting for admin review before the customer can see it.");
    setPhoto(null);
    setNotes("");
    setHealth("HEALTHY");
    setObservedOn(todayLocal());
    setSubmitting(false);
    await load();
  }

  return (
    <main className="min-h-screen bg-[#07150f] p-3 text-white sm:p-5 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-[1.5rem] border border-white/10 bg-gradient-to-r from-emerald-950 to-slate-950 p-5 sm:rounded-[2rem] sm:p-7">
          <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-300 sm:tracking-[.25em]">Caretaker workspace</p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">Daily Tree Care</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">Choose the assigned Tree ID, take one clear photo, add today&apos;s field note, and submit when internet is available. The app uploads the original file without compression.</p>
        </header>

        {message && <p aria-live="polite" className="mt-5 rounded-2xl border border-amber-200/25 bg-amber-300/10 p-4 text-sm font-bold text-amber-100">{message}</p>}

        <div className="mt-5 grid gap-5 lg:grid-cols-[.7fr_1.3fr]">
          <section className="min-w-0 rounded-[1.5rem] border border-white/10 bg-white/[.06] p-4 sm:rounded-[2rem] sm:p-5">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="text-xl font-black sm:text-2xl">Assigned Tree IDs</h2><p className="mt-1 text-xs text-white/45">The admin controls this list.</p></div><button onClick={load} className="mobile-primary-action shrink-0 rounded-xl border border-white/15 px-3 py-2 text-xs font-black">{loading ? "Loading…" : "Refresh"}</button></div>
            <div className="mt-5 space-y-3">
              {assignments.length === 0 && !loading ? <Empty text="No active Tree ID assignment. Ask the admin to assign a signed tree." /> : assignments.map((assignment) => {
                const tree = trees.find((row) => row.id === assignment.tree_id);
                const todayDone = updates.some((row) => row.tree_id === assignment.tree_id && String(row.observed_on) === todayLocal() && ["PENDING_ADMIN_REVIEW", "APPROVED"].includes(String(row.status)));
                return <button key={String(assignment.id)} onClick={() => setSelectedTreeId(String(assignment.tree_id))} className={`w-full rounded-2xl border p-4 text-left ${selectedTreeId === String(assignment.tree_id) ? "border-emerald-300 bg-emerald-300/10" : "border-white/10 bg-black/20"}`}>
                  <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-black text-emerald-200">{String(tree?.tree_id || assignment.tree_id)}</p><p className="mt-1 text-xs text-white/45">{String(tree?.species || "Aquilaria malaccensis")}</p></div><span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black ${todayDone ? "bg-emerald-300/15 text-emerald-200" : "bg-amber-300/15 text-amber-100"}`}>{todayDone ? "TODAY SUBMITTED" : "TODAY DUE"}</span></div>
                </button>;
              })}
            </div>
          </section>

          <div className="space-y-5">
            <section className="min-w-0 rounded-[1.5rem] border border-white/10 bg-white/[.06] p-4 sm:rounded-[2rem] sm:p-6">
              {!selectedTree ? <Empty text="Select an assigned Tree ID." /> : <>
                <p className="text-xs font-black uppercase tracking-[.2em] text-white/40">Selected Tree ID</p>
                <h2 className="mt-2 break-words text-2xl font-black text-emerald-300 sm:text-3xl">{String(selectedTree.tree_id)}</h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-2"><Info label="Task" value={String(selectedAssignment?.task_title || "Daily tree care and evidence")} /><Info label="General location" value={String(selectedTree.general_location || "Provided privately by admin")} /></div>
                {Boolean(selectedAssignment?.admin_note) && <p className="mt-4 rounded-2xl bg-sky-300/10 p-4 text-sm font-bold leading-6 text-sky-100">Admin instruction: {String(selectedAssignment?.admin_note)}</p>}

                <form onSubmit={submit} className="mt-6 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-black">Observation date<input type="date" value={observedOn} max={todayLocal()} onChange={(event) => setObservedOn(event.target.value)} required className="mt-2 block w-full rounded-2xl border border-white/15 bg-black/25 px-4 py-3 text-base text-white" /></label>
                    <label className="text-sm font-black">Tree condition<select value={health} onChange={(event) => setHealth(event.target.value)} className="mt-2 block w-full rounded-2xl border border-white/15 bg-[#10251a] px-4 py-3 text-base text-white">{healthOptions.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
                  </div>
                  <label className="block text-sm font-black">Today&apos;s clear field note<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} maxLength={1500} required placeholder="Example: Leaves are green; soil checked; no visible pests." className="mt-2 block w-full rounded-2xl border border-white/15 bg-black/25 px-4 py-3 text-base text-white placeholder:text-white/30" /></label>
                  <label className="block rounded-2xl border border-dashed border-emerald-300/30 bg-emerald-300/10 p-4 text-sm font-black sm:p-5">Original-quality tree photo<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" onChange={(event) => setPhoto(event.target.files?.[0] || null)} required className="mt-3 block w-full text-sm text-white/70 file:mr-3 file:min-h-12 file:rounded-xl file:border-0 file:bg-emerald-400 file:px-4 file:py-2 file:font-black file:text-emerald-950" />{photo && <span className="mt-3 block break-words text-xs text-emerald-200">Selected: {photo.name} · {(photo.size / 1024 / 1024).toFixed(1)} MB</span>}</label>
                  <p className="text-xs leading-6 text-white/45">Submission requires internet. The original image is kept; the app does not reduce photo quality. Maximum 15 MB.</p>
                  {alreadySubmitted && <p className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm font-bold text-amber-100">An update for this Tree ID and date is already pending or approved.</p>}
                  <button disabled={submitting || alreadySubmitted} className="mobile-sticky-action w-full rounded-2xl bg-emerald-400 px-6 py-4 font-black text-emerald-950 disabled:opacity-40 sm:w-auto">{submitting ? "Uploading original photo…" : "Submit for admin review"}</button>
                </form>
              </>}
            </section>

            <section className="min-w-0 rounded-[1.5rem] border border-white/10 bg-white/[.06] p-4 sm:rounded-[2rem] sm:p-6">
              <h2 className="text-2xl font-black">Submission history</h2>
              <div className="mt-5 space-y-3">{selectedUpdates.length === 0 ? <Empty text="No update submitted for this Tree ID yet." /> : selectedUpdates.map((update) => <div key={String(update.id)} className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black">{dateText(String(update.observed_on))}</p><p className="mt-1 text-xs text-white/45">{pretty(String(update.health_status))}</p></div><Status value={String(update.status)} /></div><p className="mt-3 text-sm leading-6 text-white/65">{String(update.notes)}</p>{Boolean(update.review_note) && <p className="mt-3 text-xs font-bold text-amber-100">Admin note: {String(update.review_note)}</p>}</div>)}</div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-black/20 p-4"><p className="text-xs font-black uppercase text-white/35">{label}</p><p className="mt-2 text-sm font-bold leading-6">{value}</p></div>; }
function Status({ value }: { value: string }) { const approved = value === "APPROVED"; const rejected = value === "REJECTED"; const tone = approved ? "bg-emerald-300/15 text-emerald-200" : rejected ? "bg-red-300/15 text-red-200" : "bg-amber-300/15 text-amber-100"; return <span className={`rounded-full px-3 py-1 text-[10px] font-black ${tone}`}>{pretty(value)}</span>; }
function Empty({ text }: { text: string }) { return <p className="rounded-2xl border border-dashed border-white/15 bg-black/15 p-5 text-sm font-bold text-white/50">{text}</p>; }
function pretty(value: string) { return String(value || "PENDING").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function dateText(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }); }
