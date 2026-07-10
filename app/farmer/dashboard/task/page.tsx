"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/app/lib/supabase/client";

const CARETAKER_UPLOAD_BUCKET = "caretaker-updates";

type AnyRow = Record<string, any>;

type CaretakerTask = {
  task_key: string;
  assignment_id: string;
  assignment_status: string;
  assigned_at: string | null;
  gardener_id: string;
  caretaker_name: string;
  caretaker_email: string;
  tree_id: string;
  tree_code: string;
  tree_status: string;
  owner_profile_id: string;
  owner_name: string;
  owner_email: string;
  maintenance_order_id: string | null;
  service_type: string;
  payment_status: string;
  work_status: string;
  amount: number | null;
  latest_log_id: string | null;
  latest_log_status: string | null;
  photo_url: string | null;
  serial_photo_url: string | null;
  submitted_denr_tag_number: string | null;
  latest_log_created_at: string | null;
};

export default function FarmerTaskPage() {
  const [email, setEmail] = useState("");
  const [caretaker, setCaretaker] = useState<AnyRow | null>(null);
  const [tasks, setTasks] = useState<CaretakerTask[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [typedAgCode, setTypedAgCode] = useState("");
  const [visibleTag, setVisibleTag] = useState("");
  const [notes, setNotes] = useState("");
  const [health, setHealth] = useState("HEALTHY");
  const [treePhoto, setTreePhoto] = useState<File | null>(null);
  const [serialPhoto, setSerialPhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void boot();
  }, []);

  async function boot() {
    const { data } = await supabase.auth.getUser();
    const authEmail = data.user?.email?.toLowerCase().trim();
    const savedEmail = localStorage.getItem("sur_login_email")?.toLowerCase().trim();
    const nextEmail = authEmail || savedEmail || "";

    setEmail(nextEmail);
    if (nextEmail) await loadTasks(nextEmail);
  }

  async function loadTasks(targetEmail = email) {
    const cleanEmail = targetEmail.toLowerCase().trim();
    if (!cleanEmail) {
      setMessage("Login email not found. Please login again.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { data: gardenerRow, error: gardenerError } = await supabase
      .from("gardeners")
      .select("*")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (gardenerError) {
      setMessage(gardenerError.message);
      setLoading(false);
      return;
    }

    if (!gardenerRow?.id) {
      setCaretaker({ email: cleanEmail });
      setTasks([]);
      setMessage(`No caretaker record found for ${cleanEmail}.`);
      setLoading(false);
      return;
    }

    const { data: rpcRows, error: rpcError } = await supabase.rpc("farmer_caretaker_assignment_tasks", {
      caretaker_email_input: cleanEmail,
    });

    if (!rpcError && rpcRows) {
      const mapped = ((rpcRows || []) as AnyRow[]).map(mapRpcTask);
      setCaretaker(gardenerRow);
      setTasks(mapped);
      setSelectedKey((current) => current || mapped[0]?.task_key || "");
      localStorage.setItem("sur_login_email", cleanEmail);
      setLoading(false);
      return;
    }

    const { data: assignmentRows, error: assignmentError } = await supabase
      .from("gardener_assignments")
      .select("*")
      .eq("gardener_id", gardenerRow.id)
      .order("assigned_at", { ascending: false, nullsFirst: false });

    if (assignmentError) {
      setMessage(assignmentError.message);
      setLoading(false);
      return;
    }

    const enriched = await enrichAssignments(gardenerRow, (assignmentRows || []) as AnyRow[]);
    setCaretaker(gardenerRow);
    setTasks(enriched);
    setSelectedKey((current) => current || enriched[0]?.task_key || "");
    localStorage.setItem("sur_login_email", cleanEmail);
    setLoading(false);
  }

  async function enrichAssignments(gardenerRow: AnyRow, assignments: AnyRow[]): Promise<CaretakerTask[]> {
    if (!assignments.length) return [];

    const treeIds = unique(assignments.map((row) => row.tree_id).filter(Boolean));
    const orderIds = unique(assignments.map((row) => row.maintenance_order_id).filter(Boolean));

    const [treeResult, orderResult] = await Promise.all([
      treeIds.length
        ? supabase
            .from("tree_registry")
            .select("id, profile_id, purchase_id, tree_code, denr_tag_number, species, status, gps_lat, gps_lng, planted_at, created_at")
            .in("id", treeIds)
        : Promise.resolve({ data: [], error: null }),
      orderIds.length
        ? supabase
            .from("maintenance_orders")
            .select("*")
            .in("id", orderIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const trees = ((treeResult.data || []) as AnyRow[]);
    const orders = ((orderResult.data || []) as AnyRow[]);
    const ownerIds = unique(trees.map((tree) => tree.profile_id).filter(Boolean));

    const [ownerResult, logResult] = await Promise.all([
      ownerIds.length
        ? supabase.from("profiles").select("id, full_name, email").in("id", ownerIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("tree_growth_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(3000),
    ]);

    const owners = ((ownerResult.data || []) as AnyRow[]);
    const logs = ((logResult.data || []) as AnyRow[]);

    return assignments.map((assignment) => {
      const tree = trees.find((row) => row.id === assignment.tree_id) || {};
      const owner = owners.find((row) => row.id === tree.profile_id) || {};
      const order = orders.find((row) => row.id === assignment.maintenance_order_id) || {};
      const latestLog = logs.find((log) => {
        return (
          String(log.tree_id || "") === String(tree.id || assignment.tree_id || "") ||
          String(log.tree_code || "") === String(tree.tree_code || assignment.tree_code || "") ||
          String(log.maintenance_order_id || "") === String(assignment.maintenance_order_id || "")
        );
      }) || {};

      return {
        task_key: `${assignment.id}-${assignment.maintenance_order_id || "no-order"}`,
        assignment_id: assignment.id,
        assignment_status: assignment.status || "ASSIGNED",
        assigned_at: assignment.assigned_at || assignment.created_at || null,
        gardener_id: gardenerRow.id,
        caretaker_name: gardenerRow.full_name || gardenerRow.name || "Caretaker",
        caretaker_email: gardenerRow.email || "",
        tree_id: tree.id || assignment.tree_id || "",
        tree_code: tree.tree_code || assignment.tree_code || "AG tree",
        tree_status: tree.status || "PENDING",
        owner_profile_id: tree.profile_id || assignment.profile_id || "",
        owner_name: owner.full_name || "Unknown owner",
        owner_email: owner.email || "",
        maintenance_order_id: assignment.maintenance_order_id || order.id || null,
        service_type: order.service_type || assignment.service_type || assignment.task_type || "TREE_CARE",
        payment_status: order.payment_status || assignment.payment_status || "-",
        work_status: order.work_status || assignment.status || "-",
        amount: order.amount ?? assignment.amount ?? null,
        latest_log_id: latestLog.id || null,
        latest_log_status: latestLog.status || null,
        photo_url: latestLog.photo_url || null,
        serial_photo_url: latestLog.serial_photo_url || null,
        submitted_denr_tag_number: latestLog.submitted_denr_tag_number || null,
        latest_log_created_at: latestLog.created_at || null,
      };
    });
  }

  async function startWork(task: CaretakerTask) {
    setBusy(true);
    setMessage("");

    const next = "IN_PROGRESS";
    const { error } = await supabase
      .from("gardener_assignments")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", task.assignment_id);

    if (error) {
      setMessage(error.message);
      setBusy(false);
      return;
    }

    if (task.maintenance_order_id) {
      await supabase
        .from("maintenance_orders")
        .update({ work_status: next, updated_at: new Date().toISOString() })
        .eq("id", task.maintenance_order_id);
    }

    setMessage(`${task.tree_code} moved to IN_PROGRESS.`);
    await loadTasks(email);
    setBusy(false);
  }

  async function submitProof() {
    const task = selected;
    if (!task) {
      setMessage("Select a task first.");
      return;
    }

    const cleanTypedCode = typedAgCode.trim().toUpperCase();
    const expectedCode = task.tree_code.trim().toUpperCase();

    if (cleanTypedCode !== expectedCode) {
      setMessage(`AG code mismatch. Type exactly ${task.tree_code}.`);
      return;
    }

    if (!treePhoto) {
      setMessage("Tree or seedling photo is required.");
      return;
    }

    if (!serialPhoto) {
      setMessage("Tag or serial close-up photo is required.");
      return;
    }

    if (!visibleTag.trim()) {
      setMessage("Visible tag or serial number is required.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const treePhotoUrl = await uploadCaretakerPhoto(task, treePhoto, "tree");
      const serialPhotoUrl = await uploadCaretakerPhoto(task, serialPhoto, "tag");
      const now = new Date().toISOString();
      const cleanTag = visibleTag.trim();

      const { error: logError } = await supabase.from("tree_growth_logs").insert({
        tree_id: task.tree_id,
        tree_code: task.tree_code,
        profile_id: task.owner_profile_id,
        gardener_id: task.gardener_id,
        maintenance_order_id: task.maintenance_order_id,
        health_status: health,
        photo_url: treePhotoUrl,
        serial_photo_url: serialPhotoUrl,
        submitted_denr_tag_number: cleanTag,
        remarks: notes.trim() || "Caretaker proof submitted for admin review.",
        notes: notes.trim() || "Caretaker proof submitted for admin review.",
        status: "PENDING_ADMIN_REVIEW",
      });

      if (logError) throw new Error(logError.message);

      const assignmentUpdate = {
        status: "PENDING_ADMIN_REVIEW",
        proof_photo_url: treePhotoUrl,
        serial_photo_url: serialPhotoUrl,
        submitted_denr_tag_number: cleanTag,
        updated_at: now,
      };

      const { error: assignmentError } = await supabase
        .from("gardener_assignments")
        .update(assignmentUpdate)
        .eq("id", task.assignment_id);

      if (assignmentError) {
        await supabase
          .from("gardener_assignments")
          .update({ status: "PENDING_ADMIN_REVIEW", updated_at: now })
          .eq("id", task.assignment_id);
      }

      if (task.maintenance_order_id) {
        const orderUpdate = {
          work_status: "PENDING_ADMIN_REVIEW",
          proof_photo_url: treePhotoUrl,
          serial_photo_url: serialPhotoUrl,
          submitted_denr_tag_number: cleanTag,
          updated_at: now,
        };

        const { error: orderError } = await supabase
          .from("maintenance_orders")
          .update(orderUpdate)
          .eq("id", task.maintenance_order_id);

        if (orderError) {
          await supabase
            .from("maintenance_orders")
            .update({ work_status: "PENDING_ADMIN_REVIEW", updated_at: now })
            .eq("id", task.maintenance_order_id);
        }
      }

      await supabase.from("notifications").insert({
        profile_id: task.owner_profile_id,
        title: "Caretaker proof submitted",
        message: `${task.caretaker_name} submitted tree photo, tag photo, and visible tag ${cleanTag} for ${task.tree_code}. Admin review is pending.`,
        is_read: false,
      });

      setTypedAgCode("");
      setVisibleTag("");
      setNotes("");
      setHealth("HEALTHY");
      setTreePhoto(null);
      setSerialPhoto(null);
      setMessage(`${task.tree_code} proof submitted for admin review.`);
      await loadTasks(email);
    } catch (error: any) {
      setMessage(error?.message || "Unable to submit proof.");
    }

    setBusy(false);
  }

  async function uploadCaretakerPhoto(task: CaretakerTask, file: File, kind: "tree" | "tag") {
    const extension = file.name.split(".").pop() || "jpg";
    const safeCode = task.tree_code.replace(/[^a-zA-Z0-9-]/g, "-");
    const path = `${task.assignment_id}/${safeCode}-${kind}-${Date.now()}.${extension}`;

    const { error } = await supabase.storage.from(CARETAKER_UPLOAD_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });

    if (error) throw new Error(error.message);

    const { data, error: signedError } = await supabase.storage
      .from(CARETAKER_UPLOAD_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 365);

    if (signedError || !data?.signedUrl) {
      throw new Error(signedError?.message || "Unable to create photo access link.");
    }

    return data.signedUrl;
  }

  const selected = tasks.find((task) => task.task_key === selectedKey) || tasks[0] || null;

  const grouped = useMemo(() => {
    return {
      assigned: tasks.filter((task) => normalizeStatus(task.assignment_status) === "ASSIGNED"),
      progress: tasks.filter((task) => normalizeStatus(task.assignment_status) === "IN_PROGRESS"),
      review: tasks.filter((task) => normalizeStatus(task.assignment_status) === "PENDING_ADMIN_REVIEW" || needsProofReview(task)),
      validProof: tasks.filter((task) => hasCompleteProof(task)),
    };
  }, [tasks]);

  return (
    <main className="min-h-screen bg-[#eef6ef] text-slate-950">
      <section className="border-b border-emerald-100 bg-white px-4 py-6 shadow-sm sm:px-6 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-emerald-700">SUR ALOESWOOD FARMER</p>
              <h1 className="mt-4 text-4xl font-black md:text-6xl">Task Center</h1>
              <p className="mt-3 max-w-3xl text-sm font-semibold text-slate-600">
                Each task is an assigned AG tree from gardener assignments. Proof is required before admin can verify completion.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => loadTasks(email)} className="rounded-2xl border border-emerald-100 bg-white px-5 py-3 text-sm font-black text-emerald-900 hover:bg-emerald-50">
                {loading ? "Loading..." : "Refresh"}
              </button>
              <Link href="/farmer/dashboard" className="rounded-2xl border border-emerald-100 bg-white px-5 py-3 text-sm font-black text-emerald-900 hover:bg-emerald-50">Dashboard</Link>
              <Link href="/farmer/assigned-trees" className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700">Assigned Trees</Link>
            </div>
          </div>

          {message && <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">{message}</div>}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-8 md:grid-cols-4 md:px-10">
        <Metric title="Assigned" value={String(grouped.assigned.length)} />
        <Metric title="In Progress" value={String(grouped.progress.length)} />
        <Metric title="Needs Review" value={String(grouped.review.length)} />
        <Metric title="With Complete Proof" value={String(grouped.validProof.length)} />
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-16 md:px-10 lg:grid-cols-[0.85fr_1.15fr]">
        <Panel title="Assigned AG Tree Tasks" subtitle="Select one AG tree assignment to start work or submit proof.">
          <div className="space-y-3">
            {tasks.length === 0 ? (
              <Empty text="No tasks found from gardener assignments." />
            ) : (
              tasks.map((task) => (
                <button key={task.task_key} onClick={() => setSelectedKey(task.task_key)} className={`w-full rounded-2xl border p-5 text-left transition ${selected?.task_key === task.task_key ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100" : "border-slate-200 bg-slate-50 hover:border-emerald-200"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xl font-black text-slate-950">{task.tree_code}</p>
                      <p className="mt-1 text-sm font-bold text-slate-600">{task.owner_name}</p>
                      <p className="text-xs font-bold text-slate-400">{task.service_type}</p>
                    </div>
                    <Badge value={task.assignment_status} tone={statusTone(task)} />
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <SmallInfo label="Payment" value={task.payment_status} />
                    <SmallInfo label="Proof" value={proofLabel(task)} />
                  </div>
                  {needsProofReview(task) && (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-black text-amber-900">
                      Completed but missing required proof. Re-submit tree photo, tag photo, and visible tag serial.
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Selected Task" subtitle="Task state and owner details.">
            {!selected ? (
              <Empty text="Select a task." />
            ) : (
              <div className="space-y-5">
                <div className="grid gap-3 md:grid-cols-2">
                  <Info label="AG Code" value={selected.tree_code} />
                  <Info label="Service" value={selected.service_type} />
                  <Info label="Owner" value={selected.owner_name} />
                  <Info label="Owner Email" value={selected.owner_email} />
                  <Info label="Assignment Status" value={selected.assignment_status} />
                  <Info label="Work Status" value={selected.work_status} />
                  <Info label="Payment Status" value={selected.payment_status} />
                  <Info label="Latest Proof" value={proofLabel(selected)} />
                </div>

                <div className="flex flex-wrap gap-3">
                  {normalizeStatus(selected.assignment_status) === "ASSIGNED" && (
                    <button disabled={busy} onClick={() => startWork(selected)} className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:bg-slate-300">
                      Start Work
                    </button>
                  )}
                  <a href="#submit-proof" className="rounded-2xl border border-emerald-100 bg-white px-5 py-3 text-sm font-black text-emerald-900">
                    Submit Proof
                  </a>
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Latest Proof Status" subtitle="Admin needs both photos and the visible tag serial before true completion.">
            {!selected ? (
              <Empty text="Select a task." />
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <SmallInfo label="Tree Photo" value={selected.photo_url ? "Uploaded" : "Missing"} />
                  <SmallInfo label="Tag Photo" value={selected.serial_photo_url ? "Uploaded" : "Missing"} />
                  <SmallInfo label="Visible Tag" value={selected.submitted_denr_tag_number || "Missing"} />
                </div>
                {selected.photo_url && <a href={selected.photo_url} target="_blank" className="inline-block rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white">Open Tree Photo</a>}
                {selected.serial_photo_url && <a href={selected.serial_photo_url} target="_blank" className="ml-3 inline-block rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white">Open Tag Photo</a>}
              </div>
            )}
          </Panel>

          <Panel title="Submit Proof" subtitle="Strict proof submission for admin review." id="submit-proof">
            {!selected ? (
              <Empty text="Select a task." />
            ) : (
              <div className="grid gap-4">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
                  Type the exact AG code: <span className="font-black">{selected.tree_code}</span>
                </div>
                <input value={typedAgCode} onChange={(event) => setTypedAgCode(event.target.value)} placeholder="Type AG code exactly" className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400" />
                <input value={visibleTag} onChange={(event) => setVisibleTag(event.target.value)} placeholder="Visible tag / serial number on plant" className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400" />
                <select value={health} onChange={(event) => setHealth(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400">
                  <option>HEALTHY</option>
                  <option>GROWING</option>
                  <option>NEEDS_ATTENTION</option>
                  <option>DAMAGED</option>
                  <option>SICK</option>
                </select>
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes optional..." rows={4} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400" />

                <FileInput label="Tree / seedling photo" file={treePhoto} onChange={setTreePhoto} />
                <FileInput label="Tag / serial close-up photo" file={serialPhoto} onChange={setSerialPhoto} />

                <button disabled={busy} onClick={submitProof} className="rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black text-white hover:bg-emerald-700 disabled:bg-slate-300">
                  {busy ? "Submitting..." : "Submit Proof for Admin Review"}
                </button>
              </div>
            )}
          </Panel>
        </div>
      </section>
    </main>
  );
}

function mapRpcTask(row: AnyRow): CaretakerTask {
  return {
    task_key: `${row.assignment_id}-${row.maintenance_order_id || "no-order"}`,
    assignment_id: row.assignment_id,
    assignment_status: row.assignment_status || "ASSIGNED",
    assigned_at: row.assigned_at || null,
    gardener_id: row.gardener_id || "",
    caretaker_name: row.caretaker_name || "Caretaker",
    caretaker_email: row.caretaker_email || "",
    tree_id: row.tree_id || "",
    tree_code: row.tree_code || "AG tree",
    tree_status: row.tree_status || "PENDING",
    owner_profile_id: row.owner_profile_id || "",
    owner_name: row.owner_name || "Unknown owner",
    owner_email: row.owner_email || "",
    maintenance_order_id: row.maintenance_order_id || null,
    service_type: row.service_type || "TREE_CARE",
    payment_status: row.payment_status || "-",
    work_status: row.work_status || row.assignment_status || "-",
    amount: row.amount ?? null,
    latest_log_id: row.latest_log_id || null,
    latest_log_status: row.latest_log_status || null,
    photo_url: row.photo_url || null,
    serial_photo_url: row.serial_photo_url || null,
    submitted_denr_tag_number: row.submitted_denr_tag_number || null,
    latest_log_created_at: row.latest_log_created_at || null,
  };
}

function unique(values: any[]) {
  return Array.from(new Set(values.map((value) => String(value)).filter(Boolean)));
}

function normalizeStatus(status?: string | null) {
  return String(status || "ASSIGNED").toUpperCase();
}

function hasCompleteProof(task: CaretakerTask) {
  return Boolean(task.photo_url && task.serial_photo_url && task.submitted_denr_tag_number);
}

function needsProofReview(task: CaretakerTask) {
  const status = normalizeStatus(task.assignment_status);
  return ["COMPLETED", "DONE", "SUBMITTED", "PENDING_ADMIN_REVIEW"].includes(status) && !hasCompleteProof(task);
}

function proofLabel(task: CaretakerTask) {
  if (hasCompleteProof(task)) return task.latest_log_status || "PENDING_ADMIN_REVIEW";
  if (needsProofReview(task)) return "MISSING PROOF";
  return "AWAITING PROOF";
}

function statusTone(task: CaretakerTask) {
  if (needsProofReview(task)) return "amber";
  if (hasCompleteProof(task)) return "green";
  if (normalizeStatus(task.assignment_status) === "ASSIGNED") return "slate";
  if (normalizeStatus(task.assignment_status) === "IN_PROGRESS") return "blue";
  return "slate";
}

function formatMoney(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return `PHP ${Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Panel({ title, subtitle, children, id }: { title: string; subtitle: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
      <h2 className="text-2xl font-black text-slate-950">{title}</h2>
      <p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-emerald-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-emerald-700">{title}</p>
      <p className="mt-3 truncate text-xl font-black text-emerald-900">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 break-words text-sm font-black text-slate-950">{value || "-"}</p>
    </div>
  );
}

function SmallInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 break-words text-xs font-black text-slate-900">{value || "-"}</p>
    </div>
  );
}

function Badge({ value, tone = "slate" }: { value: string; tone?: string }) {
  const styles: Record<string, string> = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    blue: "border-sky-200 bg-sky-50 text-sky-800",
    slate: "border-slate-200 bg-slate-100 text-slate-700",
  };

  return <span className={`rounded-full border px-3 py-1 text-xs font-black ${styles[tone] || styles.slate}`}>{String(value || "-").toUpperCase()}</span>;
}

function FileInput({ label, file, onChange }: { label: string; file: File | null; onChange: (file: File | null) => void }) {
  return (
    <label className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 p-5">
      <span className="block text-sm font-black text-slate-950">{label}</span>
      <span className="mt-1 block text-xs font-bold text-slate-500">Use camera on mobile or choose an image file.</span>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
        className="mt-4 block w-full text-sm font-bold text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-sm file:font-black file:text-white"
      />
      {file && <span className="mt-3 block text-sm font-black text-emerald-800">Selected: {file.name}</span>}
    </label>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm font-bold text-slate-500">
      {text}
    </div>
  );
}
