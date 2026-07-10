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

type QueueKey = "active" | "uploaded" | "completed";

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
  const [verificationNote, setVerificationNote] = useState("");
  const [queue, setQueue] = useState<QueueKey>("active");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    void loadRecords();
  }, []);

  async function loadRecords() {
    setLoading(true);
    setMessage("");

    const [orderResult, gardenerResult, farmerProfileResult, assignmentResult, logResult] = await Promise.all([
      supabase
        .from("maintenance_orders")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("gardeners")
        .select("id, full_name, email, mobile, status, resume_url, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, full_name, email, mobile, mobile_number, role, account_status, auth_user_id, created_at")
        .in("role", ["FARMER", "GARDENER", "CARETAKER"])
        .order("created_at", { ascending: false }),
      supabase
        .from("gardener_assignments")
        .select("*")
        .order("assigned_at", { ascending: false, nullsFirst: false }),
      supabase
        .from("tree_growth_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(3000),
    ]);

    if (orderResult.error || gardenerResult.error || farmerProfileResult.error || assignmentResult.error || logResult.error) {
      setRecords([]);
      setMessage(orderResult.error?.message || gardenerResult.error?.message || farmerProfileResult.error?.message || assignmentResult.error?.message || logResult.error?.message || "Unable to load maintenance data.");
      setLoading(false);
      return;
    }

    const orders = (orderResult.data || []) as AnyRow[];
    const safeGardeners = mergeGardenersWithProfiles((gardenerResult.data || []) as AnyRow[], (farmerProfileResult.data || []) as AnyRow[]);
    const assignments = (assignmentResult.data || []) as AnyRow[];
    const logs = (logResult.data || []) as AnyRow[];

    const treeIds = unique(orders.map((order) => order.tree_id).filter(Boolean));
    const profileIds = unique(orders.map((order) => order.profile_id).filter(Boolean));

    const [treeResult, profileResult] = await Promise.all([
      treeIds.length
        ? supabase
            .from("tree_registry")
            .select("id, profile_id, purchase_id, tree_code, denr_tag_number, species, status, gps_lat, gps_lng, planted_at, created_at")
            .in("id", treeIds)
        : Promise.resolve({ data: [], error: null }),
      profileIds.length
        ? supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", profileIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (treeResult.error || profileResult.error) {
      setRecords([]);
      setMessage(treeResult.error?.message || profileResult.error?.message || "Unable to load tree/profile data.");
      setLoading(false);
      return;
    }

    const trees = (treeResult.data || []) as AnyRow[];
    const profiles = (profileResult.data || []) as AnyRow[];
    const safeRecords = orders.map((order) => {
      const tree = trees.find((row) => row.id === order.tree_id) || {};
      const owner = profiles.find((row) => row.id === (order.profile_id || tree.profile_id)) || {};
      const assignment =
        assignments.find((row) => String(row.maintenance_order_id || "") === String(order.id || "")) ||
        assignments.find((row) => String(row.tree_id || "") === String(order.tree_id || "") && String(row.task_type || row.service_type || "") === String(order.service_type || ""));
      const gardener = safeGardeners.find((row) => row.id === (assignment?.gardener_id || order.assigned_gardener_id)) || {};
      const latestLog =
        logs.find((log) => String(log.maintenance_order_id || "") === String(order.id || "")) ||
        logs.find((log) => String(log.tree_id || "") === String(order.tree_id || "")) ||
        logs.find((log) => String(log.tree_code || "") === String(tree.tree_code || order.tree_code || ""));

      return mapDirectRecord(order, tree, owner, assignment, gardener, latestLog);
    });

    setRecords(safeRecords);
    setGardeners(safeGardeners);
    setSelectedOwnerId((current) => current || safeRecords[0]?.owner_profile_id || "");
    setSelectedTreeId((current) => current || safeRecords[0]?.tree_id || "");
    setSelectedOrderId((current) => current || safeRecords[0]?.order_id || "");
    setSelectedGardenerId((current) => current || safeGardeners[0]?.id || "");
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

    const now = new Date().toISOString();
    const realGardener = await ensureGardenerRecord(selectedGardener);

    if (!realGardener?.id) {
      setMessage("Unable to prepare caretaker record. Check farmer/gardener database sync.");
      setSaving(false);
      return;
    }

    const payload = {
      gardener_id: realGardener.id,
      tree_id: selectedOrder.tree_id,
      maintenance_order_id: selectedOrder.order_id,
      profile_id: selectedOrder.owner_profile_id,
      tree_code: selectedOrder.tree_code,
      task_type: selectedOrder.service_type,
      notes: adminNote.trim() || selectedOrder.customer_note || null,
      status: "ASSIGNED",
      assigned_at: now,
      updated_at: now,
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
        assigned_gardener_id: realGardener.id,
        work_status: "ASSIGNED",
        admin_note: adminNote.trim() || null,
        assigned_at: now,
        updated_at: now,
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
      message: `${selectedOrder.tree_code} ${serviceLabel(selectedOrder.service_type)} has been assigned to ${realGardener.full_name || realGardener.email}.`,
      is_read: false,
    });

    setMessage(`${selectedOrder.tree_code} assigned to ${realGardener.full_name || realGardener.email}.`);
    setSelectedGardenerId(realGardener.id);
    setAdminNote("");
    await loadRecords();
    setSaving(false);
  }

  async function ensureGardenerRecord(row: AnyRow) {
    if (!String(row.id || "").startsWith("profile:")) return row;

    const email = String(row.email || "").toLowerCase().trim();
    if (!email) return null;

    const { data: existing, error: existingError } = await supabase
      .from("gardeners")
      .select("id, full_name, email, mobile, status, resume_url, created_at")
      .eq("email", email)
      .maybeSingle();

    if (existingError) {
      setMessage(existingError.message);
      return null;
    }

    if (existing?.id) return existing;

    const payload = {
      full_name: row.full_name || row.profile_name || email,
      email,
      mobile: row.mobile || row.mobile_number || null,
      status: "ACTIVE",
    };

    const { data: created, error: createError } = await supabase
      .from("gardeners")
      .insert(payload)
      .select("id, full_name, email, mobile, status, resume_url, created_at")
      .single();

    if (createError) {
      setMessage(createError.message);
      return null;
    }

    return created;
  }

  async function verifyProofAndComplete() {
    if (!selectedOrder) {
      setMessage("Select a maintenance order first.");
      return;
    }

    if (!selectedOrder.latest_log_id) {
      setMessage("No caretaker proof log found yet.");
      return;
    }

    if (!hasCompleteProof(selectedOrder)) {
      setMessage("Proof is incomplete. Tree photo, tag photo, and visible tag serial are required before completion.");
      return;
    }

    setVerifying(true);
    setMessage("");

    const now = new Date().toISOString();
    const cleanTag = String(selectedOrder.submitted_denr_tag_number || "").trim();

    const { error: logError } = await supabase
      .from("tree_growth_logs")
      .update({ status: "APPROVED" })
      .eq("id", selectedOrder.latest_log_id);

    if (logError) {
      setMessage(logError.message);
      setVerifying(false);
      return;
    }

    if (selectedOrder.assignment_id) {
      const { error: assignmentError } = await supabase
        .from("gardener_assignments")
        .update({ status: "COMPLETED", updated_at: now })
        .eq("id", selectedOrder.assignment_id);

      if (assignmentError) {
        setMessage(assignmentError.message);
        setVerifying(false);
        return;
      }
    }

    const { error: orderError } = await supabase
      .from("maintenance_orders")
      .update({
        work_status: "COMPLETED",
        admin_note: verificationNote.trim() || selectedOrder.admin_note || null,
        updated_at: now,
      })
      .eq("id", selectedOrder.order_id);

    if (orderError) {
      setMessage(orderError.message);
      setVerifying(false);
      return;
    }

    const treeUpdate: AnyRow = {
      status: selectedOrder.tree_status === "PENDING_PLANTING" ? "REGISTERED" : selectedOrder.tree_status || "REGISTERED",
      denr_tag_number: selectedOrder.denr_tag_number || cleanTag,
    };

    if (!selectedOrder.denr_tag_number && cleanTag) treeUpdate.denr_tag_number = cleanTag;
    if (!selectedOrder.tree_status || selectedOrder.tree_status === "PENDING_PLANTING") treeUpdate.planted_at = new Date().toISOString().slice(0, 10);

    await supabase.from("tree_registry").update(treeUpdate).eq("id", selectedOrder.tree_id);

    await supabase.from("notifications").insert({
      profile_id: selectedOrder.owner_profile_id,
      title: "Caretaker proof verified",
      message: `${selectedOrder.tree_code} ${serviceLabel(selectedOrder.service_type)} was verified by admin. Submitted tag: ${cleanTag}.`,
      is_read: false,
    });

    setMessage(`${selectedOrder.tree_code} proof verified and sent back to customer caretaker submissions.`);
    setQueue("completed");
    setVerificationNote("");
    await loadRecords();
    setVerifying(false);
  }

  async function returnForResubmission() {
    if (!selectedOrder) {
      setMessage("Select a maintenance order first.");
      return;
    }

    if (!selectedOrder.assignment_id) {
      setMessage("No caretaker assignment found for this order.");
      return;
    }

    setVerifying(true);
    setMessage("");

    const now = new Date().toISOString();

    await supabase.from("tree_growth_logs").update({ status: "NEEDS_RESUBMISSION" }).eq("id", selectedOrder.latest_log_id || "");

    const { error: assignmentError } = await supabase
      .from("gardener_assignments")
      .update({ status: "ASSIGNED", updated_at: now })
      .eq("id", selectedOrder.assignment_id);

    if (assignmentError) {
      setMessage(assignmentError.message);
      setVerifying(false);
      return;
    }

    const { error: orderError } = await supabase
      .from("maintenance_orders")
      .update({
        work_status: "ASSIGNED",
        admin_note: verificationNote.trim() || "Returned for proof resubmission.",
        updated_at: now,
      })
      .eq("id", selectedOrder.order_id);

    if (orderError) {
      setMessage(orderError.message);
      setVerifying(false);
      return;
    }

    await supabase.from("notifications").insert({
      profile_id: selectedOrder.owner_profile_id,
      title: "Caretaker proof needs resubmission",
      message: `${selectedOrder.tree_code} proof was returned for resubmission. Admin note: ${verificationNote.trim() || "Please submit complete tree photo, tag photo, and visible tag serial."}`,
      is_read: false,
    });

    setMessage(`${selectedOrder.tree_code} returned for caretaker resubmission.`);
    setVerificationNote("");
    await loadRecords();
    setVerifying(false);
  }

  const queueRecords = useMemo(() => records.filter((record) => recordQueue(record) === queue), [records, queue]);

  const filteredOwners = useMemo(() => {
    const keyword = search.toLowerCase().trim();
    const owners = new Map<string, MaintenanceRecord>();

    for (const record of queueRecords) {
      if (!record.owner_profile_id) continue;
      if (!owners.has(record.owner_profile_id)) owners.set(record.owner_profile_id, record);
    }

    return Array.from(owners.values()).filter((record) => {
      const text = `${record.owner_name} ${record.owner_email} ${record.tree_code} ${record.payment_reference}`.toLowerCase();
      return !keyword || text.includes(keyword);
    });
  }, [queueRecords, search]);

  const ownerRecords = queueRecords.filter((record) => record.owner_profile_id === selectedOwnerId);
  const treeRecords = ownerRecords.filter((record) => record.tree_id);
  const uniqueTrees = uniqueBy(treeRecords, "tree_id");
  const selectedTreeRecords = queueRecords.filter((record) => record.tree_id === selectedTreeId);
  const selectedOrder = queueRecords.find((record) => record.order_id === selectedOrderId) || selectedTreeRecords[0] || queueRecords[0] || null;
  const selectedGardener = gardeners.find((gardener) => gardener.id === selectedGardenerId) || null;
  const activeCount = records.filter((record) => recordQueue(record) === "active").length;
  const uploadedCount = records.filter((record) => recordQueue(record) === "uploaded").length;
  const completedCount = records.filter((record) => recordQueue(record) === "completed").length;
  const proofReviewCount = uploadedCount;

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
                Paid customer care requests become caretaker assignments. This page reads orders, trees, assignments, and active gardeners directly.
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
            <HeroStat label="Active Queue" value={String(activeCount)} />
            <HeroStat label="Uploaded Tasks" value={String(uploadedCount)} />
            <HeroStat label="Active Gardeners" value={String(gardeners.length)} />
            <HeroStat label="Completed" value={String(completedCount)} />
          </div>

          {message && <div className="relative z-10 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">{message}</div>}
        </section>

        <section className="mt-5 grid gap-3 md:grid-cols-3">
          <QueueButton title="For Assignment" detail="Paid care requests and active caretaker work." count={activeCount} active={queue === "active"} onClick={() => setQueue("active")} />
          <QueueButton title="Uploaded Tasks" detail="Caretaker submissions waiting for admin verification." count={uploadedCount} active={queue === "uploaded"} onClick={() => setQueue("uploaded")} />
          <QueueButton title="Completed" detail="Verified submissions already sent back to customer." count={completedCount} active={queue === "completed"} onClick={() => setQueue("completed")} />
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[0.8fr_0.9fr_1.3fr]">
          <Panel title="1. Customers" subtitle={queueSubtitle(queue)}>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search owner, email, AG code, reference" className={controlClass} />
            <div className="mt-4 max-h-[650px] space-y-3 overflow-auto pr-1">
              {filteredOwners.length === 0 ? (
                <Empty text="No maintenance records found." />
              ) : filteredOwners.map((owner) => {
                const orderCount = queueRecords.filter((record) => record.owner_profile_id === owner.owner_profile_id).length;
                const isSelected = selectedOwnerId === owner.owner_profile_id;
                return (
                  <button key={owner.owner_profile_id} onClick={() => {
                    const first = queueRecords.find((record) => record.owner_profile_id === owner.owner_profile_id);
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

          <Panel title="2. AG Trees / Orders" subtitle={queue === "uploaded" ? "Select an uploaded caretaker task to verify." : queue === "completed" ? "Completed tasks are kept here for record review." : "Select one order to assign."}>
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
                            setSelectedGardenerId(order.gardener_id || gardeners[0]?.id || "");
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

          <Panel title="3. Assign / Review" subtitle={queue === "uploaded" ? "Verify caretaker submission, return it, or send it back to customer as completed." : queue === "completed" ? "Review completed caretaker submissions already sent back to customer." : "Create or update one caretaker task for the selected order."}>
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

                {(selectedOrder.latest_log_id || selectedOrder.photo_url || selectedOrder.serial_photo_url || selectedOrder.submitted_denr_tag_number) && (
                  <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-black text-slate-950">Caretaker Proof Review</h3>
                        <p className="mt-1 text-xs font-bold text-slate-500">
                          Admin verifies the submitted tree photo, tag close-up, and visible serial before completion.
                        </p>
                      </div>
                      <Badge value={proofLabel(selectedOrder)} />
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <Info label="Tree Photo" value={selectedOrder.photo_url ? "Submitted" : "Missing"} />
                      <Info label="Tag Photo" value={selectedOrder.serial_photo_url ? "Submitted" : "Missing"} />
                      <Info label="Visible Tag" value={selectedOrder.submitted_denr_tag_number || "Missing"} />
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {selectedOrder.photo_url ? (
                        <a href={selectedOrder.photo_url} target="_blank" className="overflow-hidden rounded-2xl border border-emerald-100 bg-white" rel="noreferrer">
                          <img src={selectedOrder.photo_url} alt="Submitted tree proof" className="h-56 w-full object-cover" />
                          <p className="px-4 py-3 text-xs font-black text-emerald-800">Open tree photo</p>
                        </a>
                      ) : (
                        <Empty text="Tree photo missing." />
                      )}

                      {selectedOrder.serial_photo_url ? (
                        <a href={selectedOrder.serial_photo_url} target="_blank" className="overflow-hidden rounded-2xl border border-emerald-100 bg-white" rel="noreferrer">
                          <img src={selectedOrder.serial_photo_url} alt="Submitted tag proof" className="h-56 w-full object-cover" />
                          <p className="px-4 py-3 text-xs font-black text-emerald-800">Open tag photo</p>
                        </a>
                      ) : (
                        <Empty text="Tag close-up photo missing." />
                      )}
                    </div>

                    <textarea
                      value={verificationNote}
                      onChange={(event) => setVerificationNote(event.target.value)}
                      rows={3}
                      placeholder="Admin verification note or resubmission reason"
                      className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
                    />

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <button
                        onClick={verifyProofAndComplete}
                        disabled={verifying || !hasCompleteProof(selectedOrder)}
                        className="rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500"
                      >
                        {verifying ? "Verifying..." : "Verify Proof + Mark Completed"}
                      </button>
                      <button
                        onClick={returnForResubmission}
                        disabled={verifying || !selectedOrder.assignment_id}
                        className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm font-black text-amber-900 hover:bg-amber-100 disabled:opacity-60"
                      >
                        Return for Resubmission
                      </button>
                    </div>
                  </section>
                )}

                {queue !== "completed" && (
                  <>
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
                  </>
                )}
              </div>
            )}
          </Panel>
        </section>
      </div>
    </main>
  );
}

const controlClass = "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400";

function mapDirectRecord(order: AnyRow, tree: AnyRow, owner: AnyRow, assignment: AnyRow = {}, gardener: AnyRow = {}, latestLog: AnyRow = {}): MaintenanceRecord {
  return {
    order_id: order.id,
    order_created_at: order.created_at || null,
    payment_reference: order.payment_reference || order.reference_no || "",
    service_type: order.service_type || "MAINTENANCE",
    payment_status: order.payment_status || "PENDING",
    work_status: order.work_status || "PENDING",
    amount: order.amount ?? prices[order.service_type] ?? null,
    customer_note: order.customer_note || order.notes || null,
    admin_note: order.admin_note || null,
    paid_at: order.paid_at || null,
    assigned_at: order.assigned_at || assignment.assigned_at || null,
    tree_id: order.tree_id || tree.id || "",
    tree_code: tree.tree_code || order.tree_code || "AG tree",
    tree_status: tree.status || "PENDING",
    denr_tag_number: tree.denr_tag_number || null,
    owner_profile_id: order.profile_id || tree.profile_id || "",
    owner_name: owner.full_name || "Unknown owner",
    owner_email: owner.email || "",
    assignment_id: assignment.id || null,
    assignment_status: assignment.status || null,
    gardener_id: assignment.gardener_id || order.assigned_gardener_id || null,
    caretaker_name: gardener.full_name || null,
    caretaker_email: gardener.email || null,
    latest_log_id: latestLog.id || null,
    latest_log_status: latestLog.status || null,
    photo_url: latestLog.photo_url || null,
    serial_photo_url: latestLog.serial_photo_url || null,
    submitted_denr_tag_number: latestLog.submitted_denr_tag_number || null,
    latest_log_created_at: latestLog.created_at || null,
  };
}

function normalize(value?: string | null) {
  return String(value || "").toUpperCase();
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function uniqueBy<T extends Record<string, any>>(rows: T[], key: string) {
  const map = new Map<string, T>();
  for (const row of rows) {
    const id = String(row[key] || "");
    if (id && !map.has(id)) map.set(id, row);
  }
  return Array.from(map.values());
}

function mergeGardenersWithProfiles(gardenerRows: AnyRow[], profileRows: AnyRow[]) {
  const byEmail = new Map<string, AnyRow>();

  for (const gardener of gardenerRows) {
    const email = String(gardener.email || "").toLowerCase().trim();
    if (!email) continue;
    if (normalize(gardener.status || "ACTIVE") !== "ACTIVE") continue;
    byEmail.set(email, {
      ...gardener,
      source: "gardeners",
      sync_status: "READY",
    });
  }

  for (const profile of profileRows) {
    const email = String(profile.email || "").toLowerCase().trim();
    if (!email) continue;
    if (normalize(profile.account_status || "ACTIVE") !== "ACTIVE") continue;

    const existing = byEmail.get(email);
    if (existing) {
      byEmail.set(email, {
        ...existing,
        profile_id: profile.id,
        profile_role: profile.role,
        profile_status: profile.account_status,
        auth_user_id: profile.auth_user_id,
        full_name: existing.full_name || profile.full_name,
        mobile: existing.mobile || profile.mobile || profile.mobile_number || null,
        sync_status: "READY",
      });
      continue;
    }

    byEmail.set(email, {
      id: `profile:${profile.id}`,
      profile_id: profile.id,
      full_name: profile.full_name || email,
      email,
      mobile: profile.mobile || profile.mobile_number || null,
      status: "ACTIVE",
      created_at: profile.created_at || null,
      source: "profiles",
      profile_role: profile.role,
      profile_status: profile.account_status,
      auth_user_id: profile.auth_user_id,
      sync_status: "PROFILE_ONLY_AUTO_SYNC_ON_ASSIGN",
    });
  }

  return Array.from(byEmail.values()).sort((a, b) => {
    const aReady = a.source === "gardeners" ? 0 : 1;
    const bReady = b.source === "gardeners" ? 0 : 1;
    if (aReady !== bReady) return aReady - bReady;
    return String(a.full_name || a.email || "").localeCompare(String(b.full_name || b.email || ""));
  });
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

function isCompletedRecord(record: MaintenanceRecord) {
  return normalize(record.assignment_status) === "COMPLETED" || normalize(record.work_status) === "COMPLETED" || ["APPROVED", "VERIFIED"].includes(normalize(record.latest_log_status));
}

function isUploadedRecord(record: MaintenanceRecord) {
  return normalize(record.assignment_status) === "PENDING_ADMIN_REVIEW" || normalize(record.work_status) === "PENDING_ADMIN_REVIEW" || normalize(record.latest_log_status) === "PENDING_ADMIN_REVIEW";
}

function recordQueue(record: MaintenanceRecord): QueueKey {
  if (isCompletedRecord(record)) return "completed";
  if (isUploadedRecord(record) || needsProofReview(record)) return "uploaded";
  return "active";
}

function queueSubtitle(queue: QueueKey) {
  if (queue === "uploaded") return "Customers with caretaker submissions waiting for admin verification.";
  if (queue === "completed") return "Customers with verified caretaker submissions already returned to customer records.";
  return "Customers with paid requests, ready assignments, or active caretaker work.";
}

function proofLabel(record: MaintenanceRecord) {
  if (hasCompleteProof(record)) return record.latest_log_status || "PENDING_ADMIN_REVIEW";
  if (needsProofReview(record)) return "MISSING PROOF";
  return "AWAITING PROOF";
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

function QueueButton({ title, detail, count, active, onClick }: { title: string; detail: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-[1.5rem] border p-5 text-left shadow-sm transition ${active ? "border-emerald-400 bg-emerald-600 text-white ring-2 ring-emerald-100" : "border-emerald-100 bg-white text-slate-950 hover:border-emerald-300"}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`text-xs font-black uppercase tracking-wide ${active ? "text-emerald-50" : "text-emerald-700"}`}>{title}</p>
          <p className={`mt-2 text-xs font-bold leading-5 ${active ? "text-white/75" : "text-slate-500"}`}>{detail}</p>
        </div>
        <span className={`rounded-2xl px-4 py-2 text-xl font-black ${active ? "bg-white text-emerald-700" : "bg-emerald-50 text-emerald-800"}`}>{count}</span>
      </div>
    </button>
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
