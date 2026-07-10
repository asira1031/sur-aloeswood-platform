"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/app/lib/supabase/client";

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

export default function FarmerAssignedTreesPage() {
  const [email, setEmail] = useState("");
  const [caretaker, setCaretaker] = useState<AnyRow | null>(null);
  const [tasks, setTasks] = useState<CaretakerTask[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
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
    if (nextEmail) await loadAssignedTrees(nextEmail);
  }

  async function loadAssignedTrees(targetEmail = email) {
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
      setSelectedId(mapped[0]?.task_key || "");
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
    setSelectedId(enriched[0]?.task_key || "");
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

  const filteredTasks = useMemo(() => {
    const keyword = search.toLowerCase().trim();
    if (!keyword) return tasks;

    return tasks.filter((task) => {
      return `${task.tree_code} ${task.owner_name} ${task.owner_email} ${task.service_type} ${task.assignment_status} ${task.latest_log_status}`.toLowerCase().includes(keyword);
    });
  }, [tasks, search]);

  const selected = tasks.find((task) => task.task_key === selectedId) || filteredTasks[0] || null;
  const assignedCount = tasks.filter((task) => normalizeStatus(task.assignment_status) === "ASSIGNED").length;
  const reviewCount = tasks.filter((task) => needsProofReview(task)).length;
  const validProofCount = tasks.filter((task) => hasCompleteProof(task)).length;

  return (
    <main className="min-h-screen bg-[#eef6ef] text-slate-950">
      <section className="border-b border-emerald-100 bg-white px-4 py-6 shadow-sm sm:px-6 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-emerald-700">SUR ALOESWOOD FARMER</p>
              <h1 className="mt-4 text-4xl font-black md:text-6xl">Assigned AG Trees</h1>
              <p className="mt-3 max-w-3xl text-sm font-semibold text-slate-600">
                Every caretaker task comes from an assigned AG tree in gardener assignments.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => loadAssignedTrees(email)} className="rounded-2xl border border-emerald-100 bg-white px-5 py-3 text-sm font-black text-emerald-900 hover:bg-emerald-50">
                {loading ? "Loading..." : "Refresh"}
              </button>
              <Link href="/farmer/dashboard" className="rounded-2xl border border-emerald-100 bg-white px-5 py-3 text-sm font-black text-emerald-900 hover:bg-emerald-50">Dashboard</Link>
              <Link href="/farmer/dashboard/task" className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700">Task Center</Link>
            </div>
          </div>

          {message && <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">{message}</div>}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-8 md:grid-cols-4 md:px-10">
        <Metric title="Caretaker" value={caretaker?.full_name || caretaker?.email || "Not loaded"} />
        <Metric title="Assigned Trees" value={String(tasks.length)} />
        <Metric title="Open Work" value={String(assignedCount)} />
        <Metric title="Needs Proof Review" value={String(reviewCount)} />
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-16 md:px-10 lg:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Assigned Tree List" subtitle="AG trees assigned to this caretaker account.">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search AG code, owner, service..." className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400" />

          <div className="mt-5 space-y-3">
            {filteredTasks.length === 0 ? (
              <Empty text="No assigned trees found for this caretaker email." />
            ) : (
              filteredTasks.map((task) => (
                <button key={task.task_key} onClick={() => setSelectedId(task.task_key)} className={`w-full rounded-2xl border p-5 text-left transition ${selected?.task_key === task.task_key ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100" : "border-slate-200 bg-slate-50 hover:border-emerald-200"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xl font-black text-slate-950">{task.tree_code}</p>
                      <p className="mt-1 text-sm font-bold text-slate-600">{task.owner_name}</p>
                      <p className="text-xs font-bold text-slate-400">{task.service_type}</p>
                    </div>
                    <Badge value={proofLabel(task)} tone={proofTone(task)} />
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <SmallInfo label="Assignment" value={task.assignment_status} />
                    <SmallInfo label="Payment" value={task.payment_status} />
                  </div>
                  {needsProofReview(task) && (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-black text-amber-900">
                      Completed but missing tree photo, tag photo, or visible tag serial. Needs resubmission or admin review.
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </Panel>

        <Panel title="Tree Assignment Details" subtitle="Owner, AG code, service, payment, and latest proof status.">
          {!selected ? (
            <Empty text="Select an assigned AG tree." />
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2">
                <Info label="AG Code" value={selected.tree_code} />
                <Info label="Tree Status" value={selected.tree_status} />
                <Info label="Owner" value={selected.owner_name} />
                <Info label="Owner Email" value={selected.owner_email} />
                <Info label="Service" value={selected.service_type} />
                <Info label="Amount" value={formatMoney(selected.amount)} />
                <Info label="Payment Status" value={selected.payment_status} />
                <Info label="Assignment Status" value={selected.assignment_status} />
                <Info label="Work Status" value={selected.work_status} />
                <Info label="Assigned Date" value={formatDate(selected.assigned_at)} />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Latest Proof</p>
                    <p className="mt-1 text-lg font-black text-slate-950">{proofLabel(selected)}</p>
                  </div>
                  <Badge value={selected.latest_log_status || "NO_PROOF"} tone={proofTone(selected)} />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <SmallInfo label="Tree Photo" value={selected.photo_url ? "Uploaded" : "Missing"} />
                  <SmallInfo label="Tag Photo" value={selected.serial_photo_url ? "Uploaded" : "Missing"} />
                  <SmallInfo label="Tag Serial" value={selected.submitted_denr_tag_number || "Missing"} />
                </div>
                {selected.latest_log_created_at && <p className="mt-4 text-xs font-bold text-slate-500">Last submitted: {formatDate(selected.latest_log_created_at)}</p>}
              </div>

              <div className="flex flex-wrap gap-3">
                {selected.photo_url && <a href={selected.photo_url} target="_blank" className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white">Open Tree Photo</a>}
                {selected.serial_photo_url && <a href={selected.serial_photo_url} target="_blank" className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white">Open Tag Photo</a>}
                <Link href="/farmer/dashboard/task" className="rounded-2xl border border-emerald-100 bg-white px-5 py-3 text-sm font-black text-emerald-900">Submit / Re-submit Proof</Link>
              </div>
            </div>
          )}
        </Panel>
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

function proofTone(task: CaretakerTask) {
  if (hasCompleteProof(task)) return "green";
  if (needsProofReview(task)) return "amber";
  return "slate";
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

function formatMoney(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return `PHP ${Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
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
    red: "border-red-200 bg-red-50 text-red-800",
    slate: "border-slate-200 bg-slate-100 text-slate-700",
  };

  return <span className={`rounded-full border px-3 py-1 text-xs font-black ${styles[tone] || styles.slate}`}>{String(value || "-").toUpperCase()}</span>;
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm font-bold text-slate-500">
      {text}
    </div>
  );
}
