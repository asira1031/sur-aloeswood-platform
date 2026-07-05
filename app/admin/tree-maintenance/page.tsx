"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { formatDate, type AnyRow } from "@/app/lib/dashboard/nav";

const controlClass =
  "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400";

const peso = (value: any) =>
  `PHP ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const standardServiceAmounts: Record<string, number> = {
  ARTICLE_VI_MONTHLY: 200,
  ARTICLE_VI_ONE_TIME: 5000,
  PHOTO_DOCUMENTATION: 150,
  TREE_GUARD: 250,
  SOIL_PREMIUM: 450,
};

export default function AdminTreeMaintenancePage() {
  const [profiles, setProfiles] = useState<AnyRow[]>([]);
  const [trees, setTrees] = useState<AnyRow[]>([]);
  const [gardeners, setGardeners] = useState<AnyRow[]>([]);
  const [assignments, setAssignments] = useState<AnyRow[]>([]);
  const [orders, setOrders] = useState<AnyRow[]>([]);
  const [wallets, setWallets] = useState<AnyRow[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [selectedTreeId, setSelectedTreeId] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedGardenerId, setSelectedGardenerId] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [quoteAmount, setQuoteAmount] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadMaintenance();
  }, []);

  useEffect(() => {
    const selected = orders.find((order) => order.id === selectedOrderId);
    const amount = Number(selected?.amount || 0);
    setQuoteAmount(amount > 0 ? String(amount) : "");
  }, [orders, selectedOrderId]);

  async function loadMaintenance() {
    setLoading(true);
    setMessage("");

    const [{ data: profileRows, error }, { data: treeRows }, { data: gardenerRows }, { data: assignmentRows }, { data: walletRows }, orderResult] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, role, account_status, kyc_status, membership_status, created_at")
          .in("role", ["COPLANTER", "INVESTOR"])
          .order("created_at", { ascending: false }),
        supabase
          .from("tree_registry")
          .select("id, profile_id, purchase_id, tree_code, denr_tag_number, species, status, gps_lat, gps_lng, planted_at, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("gardeners")
          .select("id, full_name, email, mobile, status, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("gardener_assignments")
          .select("id, gardener_id, tree_id, status, assigned_at")
          .order("assigned_at", { ascending: false }),
        supabase.from("wallets").select("id, profile_id, balance, updated_at"),
        supabase
          .from("maintenance_orders")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1000),
      ]);

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (orderResult.error) {
      setMessage(`${orderResult.error.message}. Run the maintenance_orders SQL first before using paid maintenance assignment.`);
    }

    const safeProfiles = (profileRows || []) as AnyRow[];
    const safeTrees = (treeRows || []) as AnyRow[];
    const safeGardeners = (gardenerRows || []) as AnyRow[];
    const safeAssignments = (assignmentRows || []) as AnyRow[];
    const safeWallets = (walletRows || []) as AnyRow[];
    const safeOrders = normalizeMaintenanceOrders((orderResult.data || []) as AnyRow[]);
    const firstProfileId = selectedProfileId || safeProfiles.find((profile) => safeTrees.some((tree) => tree.profile_id === profile.id))?.id || safeProfiles[0]?.id || "";
    const firstTreeId = selectedTreeId || safeTrees.find((tree) => tree.profile_id === firstProfileId)?.id || "";
    const firstOrderId = selectedOrderId || safeOrders.find((order) => order.tree_id === firstTreeId && isOrderAssignable(order))?.id || safeOrders.find((order) => order.tree_id === firstTreeId)?.id || "";

    setProfiles(safeProfiles);
    setTrees(safeTrees);
    setGardeners(safeGardeners);
    setAssignments(safeAssignments);
    setWallets(safeWallets);
    setOrders(safeOrders);
    setSelectedProfileId(firstProfileId);
    setSelectedTreeId(firstTreeId);
    setSelectedOrderId(firstOrderId);
    setSelectedGardenerId((current) => current || safeGardeners.find((gardener) => String(gardener.status || "").toUpperCase() === "ACTIVE")?.id || safeGardeners[0]?.id || "");
  }

  function selectProfile(profileId: string) {
    const firstTree = trees.find((tree) => tree.profile_id === profileId);
    const firstTreeOrder = orders.find((order) => order.tree_id === firstTree?.id && isOrderAssignable(order)) || orders.find((order) => order.tree_id === firstTree?.id);
    setSelectedProfileId(profileId);
    setSelectedTreeId(firstTree?.id || "");
    setSelectedOrderId(firstTreeOrder?.id || "");
    setMessage("");
  }

  function selectTree(treeId: string) {
    const firstOrder = orders.find((order) => order.tree_id === treeId && isOrderAssignable(order)) || orders.find((order) => order.tree_id === treeId);
    setSelectedTreeId(treeId);
    setSelectedOrderId(firstOrder?.id || "");
    setMessage("");
  }

  async function markOrderPaid(order: AnyRow) {
    setSaving(true);
    setMessage("");

    const charged = await chargeMaintenanceOrder(order);
    if (!charged.ok) {
      setSaving(false);
      setMessage(charged.message);
      return;
    }

    setMessage(`Maintenance payment deducted from wallet. New customer wallet balance: ${peso(charged.nextBalance)}.`);
    await loadMaintenance();
    setSaving(false);
  }

  async function chargeMaintenanceOrder(order: AnyRow) {
    if (!selectedProfile) {
      return { ok: false, message: "Select a co-planter before charging this order.", nextBalance: 0 };
    }

    if (String(order.payment_status || "").toUpperCase() === "PAID") {
      return { ok: true, message: "Order already paid.", nextBalance: Number(walletForProfile(selectedProfile.id)?.balance || 0) };
    }

    const wallet = walletForProfile(selectedProfile.id);
    const amount = getOrderAmount(order);
    const balance = Number(wallet?.balance || 0);

    if (!wallet?.id) {
      return { ok: false, message: "No wallet found for this co-planter. Create or repair the wallet before charging this order.", nextBalance: balance };
    }

    if (amount <= 0) {
      return { ok: false, message: "This order has no valid price yet.", nextBalance: balance };
    }

    if (balance < amount) {
      return { ok: false, message: `Insufficient customer wallet balance. Wallet has ${peso(balance)} but this service costs ${peso(amount)}.`, nextBalance: balance };
    }

    const nextBalance = balance - amount;
    const { error: walletError } = await supabase
      .from("wallets")
      .update({ balance: nextBalance, updated_at: new Date().toISOString() })
      .eq("id", wallet.id);

    if (walletError) {
      return { ok: false, message: walletError.message, nextBalance: balance };
    }

    await supabase.from("profiles").update({ wallet_balance: nextBalance }).eq("id", selectedProfile.id);
    await supabase.from("wallet_transactions").insert({
      profile_id: selectedProfile.id,
      transaction_type: "MAINTENANCE_PAYMENT",
      amount,
      description: `${serviceLabel(order.service_type)} payment deducted by admin for ${order.tree_code || selectedTree?.tree_code || "AG Tree"}. Reference: ${order.payment_reference || order.id}.`,
      status: "APPROVED",
    });

    const { error } = await supabase
      .from("maintenance_orders")
      .update({
        payment_status: "PAID",
        work_status: "READY_FOR_ASSIGNMENT",
        paid_at: new Date().toISOString(),
        amount,
        admin_note: adminNote.trim() || order.admin_note || null,
      })
      .eq("id", order.id);

    if (error) {
      return { ok: false, message: error.message, nextBalance };
    }

    return { ok: true, message: "Maintenance order charged.", nextBalance };
  }

  async function saveQuote(order: AnyRow) {
    setMessage("");

    if (!selectedProfile || !selectedTree) {
      setMessage("Select a co-planter and AG tree first.");
      return;
    }

    const amount = Number(quoteAmount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("Enter a valid quote amount before saving.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("maintenance_orders")
      .update({
        amount,
        payment_status: "PENDING_PAYMENT",
        work_status: "PENDING_PAYMENT",
        admin_note: adminNote.trim() || order.admin_note || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    if (error) {
      setSaving(false);
      setMessage(error.message);
      return;
    }

    await supabase.from("notifications").insert({
      profile_id: selectedProfile.id,
      title: "Maintenance quote ready",
      message: `${serviceLabel(order.service_type)} for ${selectedTree.tree_code || "your AG tree"} is quoted at ${peso(amount)}. You can pay it from Care Services using your SUR wallet.`,
      is_read: false,
    });

    setSaving(false);
    setMessage(`Quote saved at ${peso(amount)}. Co-planter can now pay from wallet.`);
    await loadMaintenance();
  }

  async function assignCaretaker() {
    setMessage("");

    if (!selectedProfile || !selectedTree) {
      setMessage("Select a co-planter and AG tree first.");
      return;
    }

    if (!selectedOrder) {
      setMessage("Select a maintenance order first.");
      return;
    }

    if (!selectedGardener) {
      setMessage("Select a farmer/caretaker before assigning maintenance.");
      return;
    }

    setSaving(true);

    let orderForAssignment = selectedOrder;
    if (!isOrderAssignable(selectedOrder)) {
      const charged = await chargeMaintenanceOrder(selectedOrder);
      if (!charged.ok) {
        setSaving(false);
        setMessage(charged.message);
        return;
      }
      orderForAssignment = { ...selectedOrder, payment_status: "PAID", work_status: "READY_FOR_ASSIGNMENT", amount: getOrderAmount(selectedOrder) };
    }

    const existingAssignment = assignmentForTree(selectedTree.id);
    const assignmentPayload = {
      gardener_id: selectedGardener.id,
      tree_id: selectedTree.id,
      maintenance_order_id: orderForAssignment.id,
      profile_id: selectedProfile.id,
      tree_code: selectedTree.tree_code || null,
      task_type: orderForAssignment.service_type || "MAINTENANCE",
      notes: adminNote.trim() || orderForAssignment.customer_note || null,
      status: `ASSIGNED_${orderForAssignment.service_type || "MAINTENANCE"}`,
      assigned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const assignmentResult = existingAssignment
      ? await supabase.from("gardener_assignments").update(assignmentPayload).eq("id", existingAssignment.id)
      : await supabase.from("gardener_assignments").insert(assignmentPayload);

    if (assignmentResult.error) {
      setSaving(false);
      setMessage(assignmentResult.error.message);
      return;
    }

    const { error: orderError } = await supabase
      .from("maintenance_orders")
      .update({
        assigned_gardener_id: selectedGardener.id,
        work_status: "ASSIGNED",
        admin_note: adminNote.trim() || null,
        assigned_at: new Date().toISOString(),
      })
      .eq("id", selectedOrder.id);

    if (orderError) {
      setSaving(false);
      setMessage(orderError.message);
      return;
    }

    await supabase.from("notifications").insert({
      profile_id: selectedProfile.id,
      title: "Tree maintenance assigned",
      message: `${selectedTree.tree_code || "Your AG tree"} paid maintenance order ${orderForAssignment.payment_reference || orderForAssignment.id} has been assigned to ${selectedGardener.full_name || selectedGardener.email}.`,
      is_read: false,
    });

    setAdminNote("");
    setSaving(false);
    setMessage(`${selectedTree.tree_code || "AG Tree"} maintenance order assigned to ${selectedGardener.full_name || selectedGardener.email}.`);
    await loadMaintenance();
  }

  function assignmentForTree(treeId?: string | null) {
    return assignments.find((assignment) => assignment.tree_id === treeId) || null;
  }

  function gardenerForAssignment(assignment?: AnyRow | null) {
    if (!assignment) return null;
    return gardeners.find((gardener) => gardener.id === assignment.gardener_id) || null;
  }

  function walletForProfile(profileId?: string | null) {
    return wallets.find((wallet) => wallet.profile_id === profileId) || null;
  }

  const filteredProfiles = useMemo(() => {
    const keyword = search.toLowerCase().trim();
    return profiles.filter((profile) => {
      const profileTrees = trees.filter((tree) => tree.profile_id === profile.id);
      const profileOrders = orders.filter((order) => order.profile_id === profile.id);
      const text = `${profile.full_name || ""} ${profile.email || ""} ${profile.role || ""} ${profileTrees.map((tree) => tree.tree_code).join(" ")} ${profileOrders.map((order) => order.payment_reference).join(" ")}`.toLowerCase();
      return !keyword || text.includes(keyword);
    });
  }, [profiles, search, trees, orders]);

  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) || filteredProfiles[0] || null;
  const selectedTrees = trees.filter((tree) => tree.profile_id === selectedProfile?.id);
  const selectedTree = trees.find((tree) => tree.id === selectedTreeId) || selectedTrees[0] || null;
  const selectedTreeOrders = orders.filter((order) => order.tree_id === selectedTree?.id);
  const selectedOrder = orders.find((order) => order.id === selectedOrderId) || selectedTreeOrders[0] || null;
  const selectedGardener = gardeners.find((gardener) => gardener.id === selectedGardenerId) || null;
  const selectedWallet = walletForProfile(selectedProfile?.id);
  const activeGardeners = gardeners.filter((gardener) => String(gardener.status || "").toUpperCase() === "ACTIVE");
  const selectedAssignment = assignmentForTree(selectedTree?.id);
  const assignedGardener = gardenerForAssignment(selectedAssignment);
  const paidOrders = orders.filter(isOrderAssignable).length;
  const pendingPaymentOrders = orders.filter((order) => String(order.payment_status || "").toUpperCase() === "PENDING_PAYMENT").length;

  return (
    <main className="min-h-screen bg-[#f3f7f1] text-slate-950">
      <div className="mx-auto w-full max-w-[1580px] px-4 py-4 lg:px-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/25 p-6 shadow-sm lg:p-8">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/forest-bg.jpg')" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/94 via-emerald-900/70 to-slate-950/24" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-emerald-100">Admin Tree Maintenance</p>
              <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight text-white lg:text-6xl">
                Paid Maintenance Assignment
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/78 lg:text-base">
                Select a co-planter, choose one AG tree, verify the paid maintenance order, then assign a farmer or caretaker. Unpaid orders stay blocked from assignment.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button onClick={loadMaintenance} disabled={loading} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm hover:bg-white/90 disabled:opacity-60">
                {loading ? "Refreshing..." : "Refresh"}
              </button>
              <Link href="/investor/care-services" className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur hover:bg-white/20">
                Customer Order Page
              </Link>
              <Link href="/admin/dashboard" className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur hover:bg-white/20">
                Dashboard
              </Link>
            </div>
          </div>

          <div className="relative z-10 mt-8 grid gap-3 md:grid-cols-4">
            <HeroStat label="Maintenance Orders" value={String(orders.length)} />
            <HeroStat label="Paid / Assignable" value={String(paidOrders)} />
            <HeroStat label="Pending Payment" value={String(pendingPaymentOrders)} />
            <HeroStat label="Assignments" value={String(assignments.length)} />
          </div>

          {message && (
            <div className="relative z-10 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
              {message}
            </div>
          )}
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-3">
          <Panel title="1. Co-Planters" subtitle="Select the customer account with maintenance orders.">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search co-planter, tree, or reference" className={controlClass} />
            <div className="mt-4 max-h-[620px] space-y-3 overflow-auto pr-1">
              {filteredProfiles.length === 0 ? (
                <Empty text="No co-planter accounts found." />
              ) : filteredProfiles.map((profile) => {
                const treeCount = trees.filter((tree) => tree.profile_id === profile.id).length;
                const orderCount = orders.filter((order) => order.profile_id === profile.id).length;
                const selected = selectedProfile?.id === profile.id;
                return (
                  <button
                    key={profile.id}
                    onClick={() => selectProfile(profile.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${selected ? "border-emerald-400 bg-emerald-50 shadow-sm" : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/50"}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-black text-slate-950">{profile.full_name || profile.email}</p>
                        <p className="mt-1 text-sm font-bold text-slate-600">{profile.email}</p>
                      </div>
                      <Badge value={`${orderCount} ORDER${orderCount === 1 ? "" : "S"}`} />
                    </div>
                    <p className="mt-3 text-xs font-bold text-slate-500">{treeCount} tree(s) - KYC: {profile.kyc_status || "PENDING"}</p>
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel title="2. AG Trees" subtitle="Choose the specific tree and paid order.">
            {!selectedProfile ? (
              <Empty text="Select a co-planter first." />
            ) : selectedTrees.length === 0 ? (
              <Empty text="No AG trees found for this co-planter." />
            ) : (
              <div className="max-h-[690px] space-y-3 overflow-auto pr-1">
                {selectedTrees.map((tree) => {
                  const assignment = assignmentForTree(tree.id);
                  const caretaker = gardenerForAssignment(assignment);
                  const treeOrders = orders.filter((order) => order.tree_id === tree.id);
                  const selected = selectedTree?.id === tree.id;
                  return (
                    <button
                      key={tree.id}
                      onClick={() => selectTree(tree.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${selected ? "border-amber-300 bg-amber-50 shadow-sm" : "border-slate-200 bg-white hover:border-amber-200 hover:bg-amber-50/50"}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-black text-slate-950">{tree.tree_code || "Pending AG Code"}</p>
                          <p className="mt-1 text-sm font-bold text-slate-600">{tree.denr_tag_number || "DENR pending"}</p>
                        </div>
                        <Badge value={`${treeOrders.length} ORDER${treeOrders.length === 1 ? "" : "S"}`} />
                      </div>
                      <div className="mt-3 grid gap-2 text-xs font-bold text-slate-500 sm:grid-cols-2">
                        <span>Planted: {formatDate(tree.planted_at)}</span>
                        <span>Caretaker: {caretaker?.full_name || caretaker?.email || "Unassigned"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel title="3. Charge & Assign" subtitle="Select a paid or payable order, then assign it to a caretaker in one action.">
            {!selectedTree ? (
              <Empty text="Select an AG tree first." />
            ) : (
              <div className="space-y-4">
                <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/75 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Selected Tree</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">{selectedTree.tree_code || "AG Tree"}</h2>
                  <p className="mt-2 text-sm font-bold text-slate-600">{selectedProfile?.full_name || selectedProfile?.email}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Info label="DENR Tag" value={selectedTree.denr_tag_number || "Pending"} />
                    <Info label="Current Caretaker" value={assignedGardener?.full_name || assignedGardener?.email || "Unassigned"} />
                    <Info label="Customer Wallet" value={peso(selectedWallet?.balance)} />
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Care Service Pricing</p>
                  <div className="mt-3 grid gap-2 text-xs font-bold text-slate-600 sm:grid-cols-2">
                    <span className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-800">Monthly Maintenance: PHP 200.00</span>
                    <span className="rounded-xl bg-amber-50 px-3 py-2 text-amber-800">One-Time All-in: PHP 5,000.00</span>
                    <span className="rounded-xl bg-cyan-50 px-3 py-2 text-cyan-800">Photo Documentation: PHP 150.00</span>
                    <span className="rounded-xl bg-lime-50 px-3 py-2 text-lime-800">Tree Guard: PHP 250.00</span>
                    <span className="rounded-xl bg-stone-50 px-3 py-2 text-stone-800 sm:col-span-2">Soil Premium: PHP 450.00</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-wide text-slate-500">Maintenance Order</label>
                  <select value={selectedOrder?.id || ""} onChange={(event) => setSelectedOrderId(event.target.value)} className={`mt-2 w-full ${controlClass}`}>
                    <option value="">Select paid order</option>
                    {selectedTreeOrders.map((order) => (
                      <option key={order.id} value={order.id}>
                        {serviceLabel(order.service_type)} - {orderAmountLabel(order)} - {order.payment_status || "PENDING"} - {order.payment_reference || order.id}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedOrder ? (
                  <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-black text-slate-950">{serviceLabel(selectedOrder.service_type)}</p>
                        <p className="mt-1 text-sm font-bold text-slate-600">{selectedOrder.payment_reference || selectedOrder.id}</p>
                      </div>
                      <Badge value={selectedOrder.payment_status || "PENDING"} />
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <Info label={isQuotedService(selectedOrder.service_type) ? "Quote Amount" : "Amount"} value={orderAmountLabel(selectedOrder)} />
                      <Info label="Work Status" value={selectedOrder.work_status || "PENDING"} />
                      <Info label="Created" value={formatDate(selectedOrder.created_at)} />
                      <Info label="Paid At" value={formatDate(selectedOrder.paid_at)} />
                    </div>
                    {selectedOrder.customer_note && (
                      <p className="mt-3 rounded-2xl border border-white bg-white px-4 py-3 text-sm font-bold text-slate-600">{selectedOrder.customer_note}</p>
                    )}
                    {shouldQuoteOrder(selectedOrder) && (
                      <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                        <p className="text-xs font-black uppercase tracking-wide text-amber-700">Admin Quote Required</p>
                        <p className="mt-2 text-sm font-bold leading-6 text-amber-900">
                          Set the service price after field review. The co-planter will see a Pay from Wallet button after this quote is saved.
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                          <input
                            type="number"
                            min="1"
                            step="0.01"
                            value={quoteAmount}
                            onChange={(event) => setQuoteAmount(event.target.value)}
                            placeholder="Quote amount"
                            className={controlClass}
                          />
                          <button onClick={() => saveQuote(selectedOrder)} disabled={saving} className="rounded-2xl bg-amber-500 px-5 py-3 text-sm font-black text-slate-950 hover:bg-amber-400 disabled:opacity-60">
                            Save Quote
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <Empty text="No maintenance order found for this tree yet." />
                )}

                <div>
                  <label className="text-xs font-black uppercase tracking-wide text-slate-500">Farmer / Caretaker</label>
                  <select value={selectedGardenerId} onChange={(event) => setSelectedGardenerId(event.target.value)} className={`mt-2 w-full ${controlClass}`}>
                    <option value="">Select caretaker</option>
                    {(activeGardeners.length ? activeGardeners : gardeners).map((gardener) => (
                      <option key={gardener.id} value={gardener.id}>
                        {gardener.full_name || gardener.email} - {gardener.status || "ACTIVE"}
                      </option>
                    ))}
                  </select>
                </div>

                <textarea
                  value={adminNote}
                  onChange={(event) => setAdminNote(event.target.value)}
                  rows={5}
                  placeholder="Admin note or manual payment reference"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
                />

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm font-bold leading-6 text-emerald-900">
                  Flow: Assign Caretaker will charge the customer's SUR wallet first when the order is still pending, then create or update the caretaker task.
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button onClick={() => selectedOrder && markOrderPaid(selectedOrder)} disabled={saving || !selectedOrder || isOrderAssignable(selectedOrder)} className="rounded-2xl border border-emerald-200 bg-white px-6 py-4 text-sm font-black text-emerald-800 hover:bg-emerald-50 disabled:opacity-60">
                    Charge Wallet Only
                  </button>
                  <button onClick={assignCaretaker} disabled={saving || !selectedOrder || shouldQuoteOrder(selectedOrder)} className="rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60">
                    {saving ? "Processing..." : isOrderAssignable(selectedOrder) ? "Assign Caretaker" : "Charge & Assign Caretaker"}
                  </button>
                </div>
              </div>
            )}
          </Panel>
        </section>
      </div>
    </main>
  );
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
      <p className="mt-1 break-words text-xs font-black text-slate-950">{value}</p>
    </div>
  );
}

function Badge({ value }: { value: string }) {
  const status = String(value || "").toUpperCase();
  const style =
    status.includes("PAID") || status.includes("READY") || status.includes("APPROVED") || status.includes("ORDER")
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status.includes("TERMINATED") || status.includes("REJECTED") || status.includes("SUSPENDED") || status.includes("FAILED")
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-amber-200 bg-amber-50 text-amber-800";

  return <span className={`rounded-full border px-3 py-1 text-xs font-black ${style}`}>{value}</span>;
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-5 text-sm font-bold text-slate-500">
      {text}
    </div>
  );
}

function serviceLabel(value?: string | null) {
  return String(value || "Maintenance").replaceAll("_", " ");
}

function isQuotedService(value?: string | null) {
  return !standardServiceAmounts[String(value || "")];
}

function getOrderAmount(order: AnyRow) {
  const paymentStatus = String(order.payment_status || "").toUpperCase();
  const fixedAmount = standardServiceAmounts[String(order.service_type || "")];
  if (fixedAmount && paymentStatus !== "PAID") return fixedAmount;
  return Number(order.amount || 0);
}

function orderAmountLabel(order: AnyRow) {
  if (isQuotedService(order.service_type) && Number(order.amount || 0) <= 0) return "Admin quote";
  return peso(getOrderAmount(order));
}

function normalizeMaintenanceOrders(rows: AnyRow[]) {
  return rows.map((order) => {
    const amount = getOrderAmount(order);
    return amount === Number(order.amount || 0) ? order : { ...order, amount };
  });
}

function isOrderAssignable(order: AnyRow) {
  const paymentStatus = String(order.payment_status || "").toUpperCase();
  const workStatus = String(order.work_status || "").toUpperCase();
  return paymentStatus === "PAID" && workStatus !== "COMPLETED" && workStatus !== "CANCELLED";
}

function shouldQuoteOrder(order: AnyRow) {
  const paymentStatus = String(order.payment_status || "").toUpperCase();
  return isQuotedService(order.service_type) && (paymentStatus === "FOR_QUOTE" || Number(order.amount || 0) <= 0);
}
