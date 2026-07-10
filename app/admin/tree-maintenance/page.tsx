"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/app/lib/supabase/client";

type AnyRow = Record<string, any>;

type MaintenanceRecord = {
  order_id: string;
  order_created_at: string | null;
  payment_reference: string;
  service_type: string;
  payment_status: string;
  work_status: string;
  amount: number | null;
  customer_note: string | null;
  admin_note: string | null;
  paid_at: string | null;
  assigned_at: string | null;
  tree_id: string;
  tree_code: string;
  tree_status: string;
  denr_tag_number: string | null;
  owner_profile_id: string;
  owner_name: string;
  owner_email: string;
  assignment_id: string | null;
  assignment_status: string | null;
  gardener_id: string | null;
  caretaker_name: string | null;
  caretaker_email: string | null;
  latest_log_id: string | null;
  latest_log_status: string | null;
  photo_url: string | null;
  serial_photo_url: string | null;
  submitted_denr_tag_number: string | null;
  latest_log_created_at: string | null;
};

const prices: Record<string, number> = {
  ARTICLE_VI_MONTHLY: 200,
  ARTICLE_VI_ONE_TIME: 5000,
  PHOTO_DOCUMENTATION: 150,
  TREE_GUARD: 250,
  SOIL_PREMIUM: 450,
  TREE_PLANTING_ASSIGNMENT: 0,
};

export default function AdminTreeMaintenancePage() {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [gardeners, setGardeners] = useState<AnyRow[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [selectedTreeId, setSelectedTreeId] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedGardenerId, setSelectedGardenerId] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadRecords();
  }, []);

  async function loadRecords() {
    setLoading(true);
    setMessage("");

    const [recordResult, gardenerResult] = await Promise.all([
      supabase.rpc("admin_tree_maintenance_records"),
      supabase.from("gardeners").select("id, full_name, email, mobile, status, created_at").order("created_at", { ascending: false }),
    ]);

    if (recordResult.error) {
      setRecords([]);
      setMessage(`${recordResult.error.message}. Run admin-tree-maintenance-rpc.sql in Supabase.`);
      setLoading(false);
      return;
    }

    const safeRecords = ((recordResult.data || []) as AnyRow[]).map(mapRecord);
    const safeGardeners = ((gardenerResult.data || []) as AnyRow[]);

    setRecords(safeRecords);
    setGardeners(safeGardeners);
    setSelectedOwnerId((current) => current || safeRecords[0]?.owner_profile_id || "");
    setSelectedTreeId((current) => current || safeRecords[0]?.tree_id || "");
    setSelectedOrderId((current) => current || safeRecords[0]?.order_id || "");
    setSelectedGardenerId((current) => current || safeGardeners.find((g) => String(g.status || "").toUpperCase() === "ACTIVE")?.id || safeGardeners[0]?.id || "");
    setLoading(false);
  }

  async function assignCaretaker() {
    if (!selectedOrder) {
      setMessage("Select a maintenance order first.");
      return;
    }

    if (!selectedGardener) {
      setMessage("Select a caretaker first.");
      return;
    }

    setSaving(true);
    setMessage("");

    const payload = {
      gardener_id: selectedGardener.id,
      tree_id: selectedOrder.tree_id,
      maintenance_order_id: selectedOrder.order_id,
      profile_id: selectedOrder.owner_profile_id,
      tree_code: selectedOrder.tree_code,
      task_type: selectedOrder.service_type,
      notes: adminNote.trim() || selectedOrder.customer_note || null,
      status: "ASSIGNED",
      assigned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const assignmentResult = selectedOrder.assignment_id
      ? await supabase.from("gardener_assignments").update(payload).eq("id", selectedOrder.assignment_id)
      : await supabase.from("gardener_assignments").insert(payload);

    if (assignmentResult.error) {
      setMessage(assignmentResult.error.message);
      setSaving(false);
      return;
    }

    const { error: orderError } = await supabase
      .from("maintenance_orders")
      .update({
        assigned_gardener_id: selectedGardener.id,
        work_status: "ASSIGNED",
        admin_note: adminNote.trim() || null,
        assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedOrder.order_id);

    if (orderError) {
      setMessage(orderError.message);
      setSaving(false);
      return;
    }

    await supabase.from("notifications").insert({
      profile_id: selectedOrder.owner_profile_id,
      title: "Tree maintenance assigned",
      message: `${selectedOrder.tree_code} ${serviceLabel(selectedOrder.service_type)} has been assigned to ${selectedGardener.full_name || selectedGardener.email}.`,
      is_read: false,
    });

    setMessage(`${selectedOrder.tree_code} assigned to ${selectedGardener.full_name || selectedGardener.email}.`);
    setAdminNote("");
    await loadRecords();
    setSaving(false);
  }

  const filteredOwners = useMemo(() => {
    const keyword = search.toLowerCase().trim();
    const owners = new Map<string, MaintenanceRecord>();

    for (const record of records) {
      if (!record.owner_profile_id) continue;
      if (!owners.has(record.owner_profile_id)) owners.set(record.owner_profile_id, record);
    }

    return Array.from(owners.values()).filter((record) => {
      const text = `${record.owner_name} ${record.owner_email} ${record.tree_code} ${record.payment_reference}`.toLowerCase();
      return !keyword || text.includes(keyword);
    });
  }, [records, search]);

  const ownerRecords = records.filter((record) => record.owner_profile_id === selectedOwnerId);
  const treeRecords = ownerRecords.filter((record) => record.tree_id);
  const uniqueTrees = uniqueBy(treeRecords, "tree_id");
  const selectedTreeRecords = records.filter((record) => record.tree_id === selectedTreeId);
  const selectedOrder = records.find((record) => record.order_id === selectedOrderId) || selectedTreeRecords[0] || records[0] || null;
  const selectedGardener = gardeners.find((gardener) => gardener.id === selectedGardenerId) || null;
  const paidCount = records.filter((record) => normalize(record.payment_status) === "PAID").length;
  const readyCount = records.filter((record) => ["PAID", "READY_FOR_ASSIGNMENT"].includes(normalize(record.payment_status)) || normalize(record.work_status) === "READY_FOR_ASSIGNMENT").length;
  const assignedCount = records.filter((record) => record.assignment_id).length;
  const proofReviewCount = records.filter((record) => normalize(record.assignment_status) === "PENDING_ADMIN_REVIEW" || normalize(record.latest_log_status) === "PENDING_ADMIN_REVIEW").length;

  return (
    <main className="min-h-screen bg-[#eef6ef] text-slate-950">
      <div className="mx-auto max-w-[1500px] px-4 py-4 lg:px-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/25 p-6 shadow-sm lg:p-8">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/forest-bg.jpg')" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/94 via-emerald-900/75 to-slate-950/30" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-emerald-100">SUR Aloeswood Admin</p>
              <h1 className="mt-4 text-4xl font-black text-white lg:text-6xl">Tree Maintenance</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/78">
                Paid customer care requests become caretaker assignments. This page reads maintenance orders and assignment records directly.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={loadRecords} disabled={loading} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm disabled:opacity-60">
                {loading ? "Refreshing..." : "Refresh"}
              </button>
              <Link href="/admin/purchases" className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur">Seedling List</Link>
              <Link href="/admin/dashboard" className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur">Dashboard</Link>
            </div>
          </div>

          <div className="relative z-10 mt-8 grid gap-3 md:grid-cols-4">
            <HeroStat label="Maintenance Orders" value={String(records.length)} />
            <HeroStat label="Paid / Ready" value={String(Math.max(paidCount, readyCount))} />
            <HeroStat label="Assigned Tasks" value={String(assignedCount)} />
            <HeroStat label="Proof Review" value={String(proofReviewCount)} />
          </div>

          {message && <div className="relative z-10 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">{message}</div>}
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[0.8fr_0.9fr_1.3fr]">
          <Panel title="1. Customers" subtitle="Owners with maintenance orders.">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search owner, email, AG code, reference" className={controlClass} />
            <div className="mt-4 max-h-[650px] space-y-3 overflow-auto pr-1">
              {filteredOwners.length === 0 ? (
                <Empty text="No maintenance records found. Run the RPC SQL if database has rows." />
              ) : filteredOwners.map((owner) => {
                const orderCount = records.filter((record) => record.owner_profile_id === owner.owner_profile_id).length;
                const isSelected = selectedOwnerId === owner.owner_profile_id;
                return (
                  <button key={owner.owner_profile_id} onClick={() => {
                    const first = records.find((record) => record.owner_profile_id === owner.owner_profile_id);
                    setSelectedOwnerId(owner.owner_profile_id);
                    setSelectedTreeId(first?.tree_id || "");
                    setSelectedOrderId(first?.order_id || "");
                  }} className={`w-full rounded-2xl border p-4 text-left ${isSelected ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100" : "border-slate-200 bg-white hover:border-emerald-200"}`}>
                    <p className="text-lg font-black text-slate-950">{owner.owner_name || "Unknown owner"}</p>
                    <p className="mt-1 text-sm font-bold text-slate-600">{owner.owner_email || "-"}</p>
                    <p className="mt-3 text-xs font-black text-emerald-700">{orderCount} maintenance order(s)</p>
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel title="2. AG Trees / Orders" subtitle="Select one order to assign.">
            {uniqueTrees.length === 0 ? (
              <Empty text="Select a customer with records." />
            ) : (
              <div className="max-h-[710px] space-y-3 overflow-auto pr-1">
                {uniqueTrees.map((tree) => {
                  const orders = records.filter((record) => record.tree_id === tree.tree_id);
                  const isSelected = selectedTreeId === tree.tree_id;
                  return (
                    <div key={tree.tree_id} className={`rounded-2xl border p-4 ${isSelected ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
                      <button onClick={() => {
                        setSelectedTreeId(tree.tree_id);
                        setSelectedOrderId(orders[0]?.order_id || "");
                      }} className="w-full text-left">
                        <p className="text-lg font-black text-slate-950">{tree.tree_code}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">{tree.denr_tag_number || "DENR pending"} - {tree.tree_status}</p>
                      </button>
                      <div className="mt-3 space-y-2">
                        {orders.map((order) => (
                          <button key={order.order_id} onClick={() => {
                            setSelectedTreeId(order.tree_id);
                            setSelectedOrderId(order.order_id);
                          }} className={`w-full rounded-xl border px-3 py-2 text-left text-xs font-black ${selectedOrderId === order.order_id ? "border-emerald-300 bg-white text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
                            <div className="flex justify-between gap-2">
                              <span>{serviceLabel(order.service_type)}</span>
                              <span>{order.payment_status}</span>
                            </div>
                            <p className="mt-1 text-slate-500">{money(order.amount)} - {order.work_status}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel title="3. Assign / Review" subtitle="Create or update one caretaker task for the selected order.">
            {!selectedOrder ? (
              <Empty text="Select an order first." />
            ) : (
              <div className="space-y-5">
                <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-2xl font-black text-slate-950">{selectedOrder.tree_code}</p>
                      <p className="mt-1 text-sm font-bold text-slate-600">{selectedOrder.owner_name} - {selectedOrder.owner_email}</p>
                    </div>
                    <Badge value={selectedOrder.payment_status || "PENDING"} />
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <Info label="Service" value={serviceLabel(selectedOrder.service_type)} />
                    <Info label="Amount" value={money(selectedOrder.amount)} />
                    <Info label="Work Status" value={selectedOrder.work_status || "-"} />
                    <Info label="Assignment" value={selectedOrder.assignment_status || "Not assigned"} />
                    <Info label="Caretaker" value={selectedOrder.caretaker_name || "Unassigned"} />
                    <Info label="Latest Proof" value={proofLabel(selectedOrder)} />
                  </div>
                </div>

                {needsProofReview(selectedOrder) && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
                    This task has proof issues. Tree photo, tag photo, and visible tag serial are required before final completion.
                  </div>
                )}

                <div>
                  <label className="text-xs font-black uppercase tracking-wide text-slate-500">Farmer / Caretaker</label>
                  <select value={selectedGardenerId} onChange={(event) => setSelectedGardenerId(event.target.value)} className={`mt-2 w-full ${controlClass}`}>
                    <option value="">Select caretaker</option>
                    {gardeners.map((gardener) => (
                      <option key={gardener.id} value={gardener.id}>
                        {gardener.full_name || gardener.email} - {gardener.email}
                      </option>
                    ))}
                  </select>
                </div>

                <textarea value={adminNote} onChange={(event) => setAdminNote(event.target.value)} rows={5} placeholder="Admin note for caretaker" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400" />

                <button onClick={assignCaretaker} disabled={saving || !selectedGardenerId} className="w-full rounded-2xl bg-emerald-600 px-6 py-5 text-base font-black text-white shadow-sm hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500">
                  {saving ? "Saving..." : selectedOrder.assignment_id ? "Update Caretaker Assignment" : "Assign Caretaker"}
                </button>
              </div>
            )}
          </Panel>
        </section>
      </div>
    </main>
  );
}

const controlClass = "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400";

function mapRecord(row: AnyRow): MaintenanceRecord {
  return {
    order_id: row.order_id,
    order_created_at: row.order_created_at || null,
    payment_reference: row.payment_reference || "",
    service_type: row.service_type || "MAINTENANCE",
    payment_status: row.payment_status || "PENDING",
    work_status: row.work_status || "PENDING",
    amount: row.amount ?? prices[row.service_type] ?? null,
    customer_note: row.customer_note || null,
    admin_note: row.admin_note || null,
    paid_at: row.paid_at || null,
    assigned_at: row.assigned_at || null,
    tree_id: row.tree_id || "",
    tree_code: row.tree_code || "AG tree",
    tree_status: row.tree_status || "PENDING",
    denr_tag_number: row.denr_tag_number || null,
    owner_profile_id: row.owner_profile_id || "",
    owner_name: row.owner_name || "Unknown owner",
    owner_email: row.owner_email || "",
    assignment_id: row.assignment_id || null,
    assignment_status: row.assignment_status || null,
    gardener_id: row.gardener_id || null,
    caretaker_name: row.caretaker_name || null,
    caretaker_email: row.caretaker_email || null,
    latest_log_id: row.latest_log_id || null,
    latest_log_status: row.latest_log_status || null,
    photo_url: row.photo_url || null,
    serial_photo_url: row.serial_photo_url || null,
    submitted_denr_tag_number: row.submitted_denr_tag_number || null,
    latest_log_created_at: row.latest_log_created_at || null,
  };
}

function normalize(value?: string | null) {
  return String(value || "").toUpperCase();
}

function uniqueBy<T extends Record<string, any>>(rows: T[], key: string) {
  const map = new Map<string, T>();
  for (const row of rows) {
    const id = String(row[key] || "");
    if (id && !map.has(id)) map.set(id, row);
  }
  return Array.from(map.values());
}

function serviceLabel(value?: string | null) {
  return String(value || "Maintenance").replaceAll("_", " ");
}

function money(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return `PHP ${Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function hasCompleteProof(record: MaintenanceRecord) {
  return Boolean(record.photo_url && record.serial_photo_url && record.submitted_denr_tag_number);
}

function needsProofReview(record: MaintenanceRecord) {
  return ["COMPLETED", "DONE", "SUBMITTED", "PENDING_ADMIN_REVIEW"].includes(normalize(record.assignment_status)) && !hasCompleteProof(record);
}

function proofLabel(record: MaintenanceRecord) {
  if (hasCompleteProof(record)) return record.latest_log_status || "PENDING_ADMIN_REVIEW";
  if (needsProofReview(record)) return "MISSING PROOF";
  return "AWAITING PROOF";
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/16 p-4 backdrop-blur">
      <p className="text-xs font-black uppercase tracking-wide text-white/65">{label}</p>
      <p className="mt-2 truncate text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
      <h2 className="text-2xl font-black text-slate-950">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white bg-white p-3">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 break-words text-xs font-black text-slate-950">{value || "-"}</p>
    </div>
  );
}

function Badge({ value }: { value: string }) {
  const status = normalize(value);
  const style =
    status.includes("PAID") || status.includes("ASSIGNED") || status.includes("READY")
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status.includes("MISSING") || status.includes("FAILED") || status.includes("REJECTED")
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-amber-200 bg-amber-50 text-amber-800";

  return <span className={`rounded-full border px-3 py-1 text-xs font-black ${style}`}>{String(value || "-").toUpperCase()}</span>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">{text}</div>;
}
