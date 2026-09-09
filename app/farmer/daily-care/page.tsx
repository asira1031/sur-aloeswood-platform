"use client";

import Image from "next/image";
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

const carePeriods = [
  ["MORNING", "Morning"],
  ["AFTERNOON", "Afternoon"],
  ["EVENING", "Evening"],
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
  const [carePeriod, setCarePeriod] = useState("MORNING");
  const [startedAt, setStartedAt] = useState("");
  const [taskDone, setTaskDone] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [profileId, setProfileId] = useState("");
  const [problemOpen, setProblemOpen] = useState(false);
  const [problem, setProblem] = useState("");
  const [reporting, setReporting] = useState(false);

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
    setProfileId(profile.id);

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
        ? supabase.from("sur_tree_updates").select("id,tree_id,observed_on,care_period,started_at,task_done,health_status,notes,photo_path,status,review_note,created_at").in("tree_id", treeIds).order("created_at", { ascending: false }).limit(300)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (treeResult.error || updateResult.error) { setMessage("Tree records or submitted reports could not load. Please retry."); setLoading(false); return; }
    const treeRows = (treeResult.data || []) as Row[];
    const requestedCode = new URLSearchParams(window.location.search).get("tree")?.trim().toUpperCase() || "";
    const requestedTree = treeRows.find((tree) => String(tree.tree_id).toUpperCase() === requestedCode);

    setAssignments(assignmentRows);
    setTrees(treeRows);
    const updateRows = (updateResult.data || []) as Row[];
    const updatesWithPhotos = await Promise.all(updateRows.map(async (row) => {
      if (!row.photo_path) return row;
      const { data } = await supabase.storage.from("sur-tree-evidence").createSignedUrl(String(row.photo_path), 900);
      return { ...row, photo_url: data?.signedUrl || "" };
    }));
    setUpdates(updatesWithPhotos);
    setSelectedTreeId((current) => requestedTree ? String(requestedTree.id) : treeIds.includes(current) ? current : treeIds[0] || "");
    setLoading(false);
  }

  const selectedTree = useMemo(() => trees.find((tree) => String(tree.id) === selectedTreeId) || null, [selectedTreeId, trees]);
  const selectedAssignment = useMemo(() => assignments.find((row) => String(row.tree_id) === selectedTreeId) || null, [assignments, selectedTreeId]);
  const selectedUpdates = useMemo(() => updates.filter((row) => String(row.tree_id) === selectedTreeId), [selectedTreeId, updates]);
  const alreadySubmitted = selectedUpdates.some((row) => String(row.observed_on) === observedOn && String(row.care_period) === carePeriod && ["PENDING_ADMIN_REVIEW", "APPROVED"].includes(String(row.status)));

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
    if (!startedAt) {
      setMessage("Enter what time you started this care task.");
      return;
    }
    if (taskDone.trim().length < 3) {
      setMessage("Tell Admin what care task you completed.");
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
    if (alreadySubmitted) {
      setMessage(`The ${carePeriod.toLowerCase()} report for this Tree ID is already pending or approved.`);
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
    const photoPath = `${authUserId}/${selectedTree.id}/${observedOn}-${carePeriod.toLowerCase()}-${crypto.randomUUID()}.${extension}`;
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
      p_care_period: carePeriod,
      p_started_at: startedAt,
      p_task_done: taskDone.trim(),
    });

    if (error) {
      await supabase.storage.from("sur-tree-evidence").remove([photoPath]);
      setMessage(error.message);
      setSubmitting(false);
      return;
    }

    const successMessage = "Daily update submitted in original quality. It is waiting for admin review before the customer can see it.";
    setPhoto(null);
    setNotes("");
    setTaskDone("");
    setStartedAt("");
    setHealth("HEALTHY");
    setObservedOn(todayLocal());
    setSubmitting(false);
    await load();
    setMessage(successMessage);
  }

  async function reportProblem() {
    const clean = problem.trim();
    if (!clean || !profileId || reporting) return;
    setReporting(true);
    setMessage("");
    const subject = selectedTree ? `Caretaker problem · ${String(selectedTree.tree_id)}` : "Caretaker problem";
    const { data: chats, error: findError } = await supabase.from("support_chats").select("id").eq("profile_id", profileId).order("updated_at", { ascending: false }).limit(1);
    if (findError) { setMessage("Problem reporting is temporarily unavailable."); setReporting(false); return; }
    let chatId = chats?.[0]?.id as string | undefined;
    if (!chatId) {
      const { data, error } = await supabase.from("support_chats").insert({ profile_id: profileId, subject, status: "ADMIN_QUEUE", channel: "CARETAKER", escalated_at: new Date().toISOString() }).select("id").single();
      if (error) { setMessage(error.message); setReporting(false); return; }
      chatId = String(data.id);
    }
    const { error } = await supabase.from("support_messages").insert({ chat_id: chatId, profile_id: profileId, sender_role: "CUSTOMER", body: `${subject}\n\n${clean}` });
    if (error) { setMessage(error.message); setReporting(false); return; }
    const { error: queueError } = await supabase.from("support_chats").update({ status: "ADMIN_QUEUE", updated_at: new Date().toISOString() }).eq("id", chatId);
    setProblem(""); setProblemOpen(false); setReporting(false);
    setMessage(queueError ? "Report saved, but the Admin queue could not refresh. Do not resend." : "Problem sent to Agarwood Support. Admin can now review it.");
  }

  return (
    <main className="sur-page min-h-screen bg-[#f4f1e7] p-3 text-[#10271f] sm:p-5 lg:p-8">
      <div className="sur-page-content mx-auto max-w-6xl">
        <header className="sur-page-hero rounded-[1.5rem] bg-[#073d2e] p-5 text-white shadow-xl shadow-[#073d2e]/10 sm:rounded-[2rem] sm:p-7">
          <p className="text-xs font-black uppercase tracking-[.16em] text-[#9ee7c5] sm:tracking-[.25em]">My Care Work</p>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><h1 className="text-3xl font-black sm:text-4xl">Today&apos;s tree care</h1><p className="mt-2 text-sm text-white/70">Open a task, record the work, then send it to Admin.</p></div>
            <div className="flex flex-wrap gap-2"><div className="w-fit rounded-2xl bg-white/10 px-4 py-3 text-sm font-black"><span className="text-[#9ee7c5]">{assignments.length}</span> active {assignments.length === 1 ? "task" : "tasks"}</div><button type="button" onClick={() => setProblemOpen(true)} className="rounded-2xl border border-white/20 px-4 py-3 text-sm font-black">Report a Problem</button></div>
          </div>
        </header>

        {message && <p aria-live="polite" className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-900">{message}</p>}

        <div className="mt-5 grid gap-5 md:grid-cols-[minmax(240px,.75fr)_minmax(0,1.25fr)]">
          <section className="sur-panel min-w-0 rounded-[1.5rem] border border-[#ded8ca] bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-5">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#08745b]">Task list</p><h2 className="mt-1 text-xl font-black sm:text-2xl">Today&apos;s Tasks</h2><p className="mt-1 text-xs text-[#718078]">Choose one task to begin.</p></div><button onClick={load} className="mobile-primary-action shrink-0 rounded-xl border border-[#d5ddd8] bg-[#f7f9f7] px-3 py-2 text-xs font-black">{loading ? "Loading…" : "Refresh"}</button></div>
            <div className="mt-5 space-y-3">
              {assignments.length === 0 && !loading ? <Empty text="No active Tree ID assignment. Ask the admin to assign a signed tree." /> : assignments.map((assignment) => {
                const tree = trees.find((row) => row.id === assignment.tree_id);
                const todayCount = updates.filter((row) => row.tree_id === assignment.tree_id && String(row.observed_on) === todayLocal() && ["PENDING_ADMIN_REVIEW", "APPROVED"].includes(String(row.status))).length;
                return <button key={String(assignment.id)} onClick={() => setSelectedTreeId(String(assignment.tree_id))} className={`w-full rounded-2xl border p-4 text-left transition ${selectedTreeId === String(assignment.tree_id) ? "border-[#08745b] bg-[#eaf6ef] shadow-sm" : "border-[#e4dfd3] bg-[#faf9f5] hover:border-[#9cc9b5]"}`}>
                  <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-black text-[#073d2e]">{String(assignment.task_title || "Daily tree care")}</p><p className="mt-1 text-xs font-bold text-[#718078]">Record {String(tree?.tree_id || assignment.tree_id).replace(/^SUR-\d{4}-/i, "")}</p></div><span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black ${todayCount === 3 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{todayCount}/3 TODAY</span></div>
                  <p className="mt-3 text-xs text-[#617169]">Tap to open task →</p>
                </button>;
              })}
            </div>
          </section>

          <div className="space-y-5">
            <section className="sur-panel min-w-0 rounded-[1.5rem] border border-[#ded8ca] bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-6">
              {!selectedTree ? <Empty text="Select an assigned Tree ID." /> : <>
                <p className="text-xs font-black uppercase tracking-[.2em] text-[#08745b]">Daily report</p>
                <h2 className="mt-2 break-words text-2xl font-black text-[#073d2e] sm:text-3xl">{String(selectedAssignment?.task_title || "Add care update")}</h2>
                <p className="mt-2 text-sm font-bold text-[#718078]">Record {String(selectedTree.tree_id).replace(/^SUR-\d{4}-/i, "")} · {String(selectedTree.general_location || "Location provided by Admin")}</p>
                {Boolean(selectedAssignment?.admin_note) && <p className="mt-4 rounded-2xl bg-sky-50 p-4 text-sm font-bold leading-6 text-sky-900">Admin note: {String(selectedAssignment?.admin_note)}</p>}

                <form onSubmit={submit} className="mt-6 space-y-4">
                  <fieldset><legend className="text-sm font-black">When did you do the task?</legend><div className="mt-2 grid grid-cols-3 gap-2">{carePeriods.map(([value,label])=><button key={value} aria-pressed={carePeriod===value} type="button" onClick={()=>setCarePeriod(value)} className={`rounded-2xl border px-2 py-3 text-sm font-black ${carePeriod===value?"border-[#08745b] bg-[#eaf6ef] text-[#073d2e]":"border-[#d8d4c8] bg-white text-[#617169]"}`}>{label}</button>)}</div></fieldset>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-black">Date<input type="date" value={observedOn} max={todayLocal()} onChange={(event) => setObservedOn(event.target.value)} required className="mt-2 block w-full rounded-2xl border border-[#d8d4c8] bg-[#faf9f5] px-4 py-3 text-base" /></label>
                    <label className="text-sm font-black">Start time<input type="time" value={startedAt} onChange={(event)=>setStartedAt(event.target.value)} required className="mt-2 block w-full rounded-2xl border border-[#d8d4c8] bg-[#faf9f5] px-4 py-3 text-base" /></label>
                  </div>
                  <label className="block text-sm font-black">What task did you complete?<textarea value={taskDone} onChange={(event) => setTaskDone(event.target.value)} rows={3} maxLength={500} required placeholder="Example: Watered the tree and removed weeds around it." className="mt-2 block w-full rounded-2xl border border-[#d8d4c8] bg-[#faf9f5] px-4 py-3 text-base placeholder:text-[#9aa49f]" /></label>
                  <label className="text-sm font-black">Tree condition<select value={health} onChange={(event) => setHealth(event.target.value)} className="mt-2 block w-full rounded-2xl border border-[#d8d4c8] bg-[#faf9f5] px-4 py-3 text-base">{healthOptions.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
                  <label className="block rounded-2xl border border-dashed border-[#8bbca6] bg-[#edf8f1] p-4 text-sm font-black sm:p-5">📷 Add today&apos;s tree photo<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" onChange={(event) => setPhoto(event.target.files?.[0] || null)} required className="mt-3 block w-full text-sm text-[#617169] file:mr-3 file:min-h-12 file:rounded-xl file:border-0 file:bg-[#08745b] file:px-4 file:py-2 file:font-black file:text-white" />{photo && <span className="mt-3 block break-words text-xs text-[#08745b]">Selected: {photo.name} · {(photo.size / 1024 / 1024).toFixed(1)} MB</span>}</label>
                  <label className="block text-sm font-black">Notes <span className="font-normal text-[#718078]">(optional)</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} maxLength={1500} placeholder="Add anything Admin should know." className="mt-2 block w-full rounded-2xl border border-[#d8d4c8] bg-[#faf9f5] px-4 py-3 text-base placeholder:text-[#9aa49f]" /></label>
                  <p className="text-xs leading-6 text-[#718078]">Internet is needed only when you submit. Original photo quality will be kept.</p>
                  {alreadySubmitted && <p className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm font-bold text-amber-900">An update for this Tree ID and date is already pending or approved.</p>}
                  <button disabled={submitting || alreadySubmitted} className="mobile-primary-action w-full rounded-2xl bg-[#073d2e] px-6 py-4 font-black text-white shadow-lg disabled:opacity-40 sm:w-auto">{submitting ? "Sending report…" : "Send Daily Report"}</button>
                </form>
              </>}
            </section>

            <section className="sur-panel min-w-0 rounded-[1.5rem] border border-[#ded8ca] bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-6">
              <h2 className="text-2xl font-black">Recent reports</h2>
              <div className="mt-5 space-y-3">{selectedUpdates.length === 0 ? <Empty text="No report submitted for this tree yet." /> : selectedUpdates.map((update) => <ReportCard key={String(update.id)} update={update} onCorrect={() => { setObservedOn(String(update.observed_on)); setHealth(String(update.health_status)); setNotes(String(update.notes)); window.scrollTo({ top: 0, behavior: "smooth" }); }} />)}</div>
            </section>
          </div>
        </div>
        {problemOpen && <div className="fixed inset-0 z-50 grid place-items-end bg-black/45 p-0 sm:place-items-center sm:p-5" onMouseDown={() => setProblemOpen(false)}><section role="dialog" aria-modal="true" aria-label="Report a caretaker problem" onMouseDown={(event) => event.stopPropagation()} className="w-full rounded-t-[2rem] bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-[2rem] sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#08745b]">Agarwood Support</p><h2 className="mt-1 text-2xl font-black">Report a Problem</h2></div><button type="button" onClick={() => setProblemOpen(false)} className="grid h-10 w-10 place-items-center rounded-full bg-[#f1eee5] text-xl" aria-label="Close">×</button></div><p className="mt-3 text-sm leading-6 text-[#617169]">Tell Admin what stopped you from completing this tree task.</p><textarea value={problem} onChange={(event) => setProblem(event.target.value)} rows={5} maxLength={1500} placeholder="Example: The tree tag is damaged, or I cannot upload today’s photo." className="mt-4 w-full rounded-2xl border border-[#d8d4c8] bg-[#faf9f5] p-4 text-base outline-none focus:border-[#08745b]"/><button type="button" onClick={() => void reportProblem()} disabled={reporting || problem.trim().length < 3} className="mt-4 w-full rounded-2xl bg-[#073d2e] px-5 py-4 font-black text-white disabled:opacity-40">{reporting ? "Sending…" : "Send to Admin"}</button></section></div>}
      </div>
    </main>
  );
}

function Status({ value }: { value: string }) { const approved = value === "APPROVED"; const rejected = value === "REJECTED"; const tone = approved ? "bg-emerald-100 text-emerald-800" : rejected ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"; return <span className={`rounded-full px-3 py-1 text-[10px] font-black ${tone}`}>{pretty(value)}</span>; }
function ReportCard({ update, onCorrect }: { update: Row; onCorrect: () => void }) { const rejected = String(update.status) === "REJECTED"; return <article className={`overflow-hidden rounded-2xl border ${rejected ? "border-red-200 bg-red-50" : "border-[#e4dfd3] bg-[#faf9f5]"}`}>{Boolean(update.photo_url) && <div className="relative h-44 w-full sm:h-52"><Image unoptimized fill sizes="(max-width: 768px) 100vw, 640px" src={String(update.photo_url)} alt={`Submitted tree on ${dateText(String(update.observed_on))}`} className="object-cover"/></div>}<div className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black">{pretty(String(update.care_period))} · {timeText(String(update.started_at))}</p><p className="mt-1 text-xs text-[#718078]">{dateText(String(update.observed_on))} · {pretty(String(update.health_status))}</p></div><Status value={String(update.status)} /></div><p className="mt-3 text-sm font-black leading-6 text-[#243d33]">{String(update.task_done)}</p>{Boolean(update.notes) && <p className="mt-2 text-sm leading-6 text-[#52655c]">{String(update.notes)}</p>}{Boolean(update.review_note) && <div className="mt-3 rounded-xl bg-white/80 p-3 text-xs font-bold leading-5 text-red-800"><span className="block text-[10px] uppercase tracking-[.14em]">Admin correction</span>{String(update.review_note)}</div>}{rejected && <button type="button" onClick={onCorrect} className="mt-4 w-full rounded-xl bg-red-700 px-4 py-3 text-sm font-black text-white">Correct and Resubmit</button>}</div></article>; }
function Empty({ text }: { text: string }) { return <p className="rounded-2xl border border-dashed border-[#d8d4c8] bg-[#faf9f5] p-5 text-sm font-bold text-[#718078]">{text}</p>; }
function pretty(value: string) { return String(value || "PENDING").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function dateText(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }); }
function timeText(value: string) { if (!value) return "No time"; const [hour,minute]=value.split(":").map(Number); if(Number.isNaN(hour)) return value; return new Date(2000,0,1,hour,minute||0).toLocaleTimeString("en-PH",{hour:"numeric",minute:"2-digit"}); }
