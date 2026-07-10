"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";

type AnyRow = Record<string, any>;

type EvidenceItem = {
  id: string;
  category: "CUSTOMER" | "CARETAKER" | "TREE" | "FINANCE" | "SYSTEM";
  action: string;
  title: string;
  description: string;
  status: string;
  actor: string;
  actorEmail: string;
  amount?: number | null;
  treeCode?: string;
  reference?: string;
  evidenceUrl?: string;
  sourceLabel: string;
  sourceHref: string;
  createdAt: string;
  raw: AnyRow;
};

const categories = [
  { key: "ALL", title: "All Evidence", detail: "Complete operational audit trail." },
  { key: "CUSTOMER", title: "Customer", detail: "Cash-in, withdrawal, support, purchase, requests, and selling activity." },
  { key: "CARETAKER", title: "Caretaker", detail: "Assigned work, submitted proof, completed task, and field updates." },
  { key: "TREE", title: "Tree Registry", detail: "AG code, registry, DENR, GPS, planting, and certificate movement." },
  { key: "FINANCE", title: "Finance", detail: "Wallet movement, revenue allocation, settlement, fees, and payouts." },
  { key: "SYSTEM", title: "System Notices", detail: "Notifications, alerts, and platform messages." },
];

export default function AdminActivityPage() {
  const [profiles, setProfiles] = useState<AnyRow[]>([]);
  const [tickets, setTickets] = useState<AnyRow[]>([]);
  const [walletTx, setWalletTx] = useState<AnyRow[]>([]);
  const [purchases, setPurchases] = useState<AnyRow[]>([]);
  const [cashins, setCashins] = useState<AnyRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<AnyRow[]>([]);
  const [notifications, setNotifications] = useState<AnyRow[]>([]);
  const [orders, setOrders] = useState<AnyRow[]>([]);
  const [assignments, setAssignments] = useState<AnyRow[]>([]);
  const [growthLogs, setGrowthLogs] = useState<AnyRow[]>([]);
  const [trees, setTrees] = useState<AnyRow[]>([]);
  const [allocations, setAllocations] = useState<AnyRow[]>([]);
  const [loadIssues, setLoadIssues] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadEvidence();
  }, []);

  async function safeLoad(label: string, query: any) {
    const { data, error } = await query;
    if (error) return { rows: [] as AnyRow[], issue: `${label}: ${error.message}` };
    return { rows: (data || []) as AnyRow[], issue: "" };
  }

  async function loadEvidence() {
    setLoading(true);
    setLoadIssues([]);

    const [
      profileResult,
      ticketResult,
      walletResult,
      purchaseResult,
      cashinResult,
      withdrawalResult,
      notificationResult,
      orderResult,
      assignmentResult,
      growthLogResult,
      treeResult,
      allocationResult,
    ] = await Promise.all([
      safeLoad(
        "profiles",
        supabase
          .from("profiles")
          .select("id, full_name, email, role, account_status")
          .limit(2000)
      ),
      safeLoad(
        "support_tickets",
        supabase
          .from("support_tickets")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(400)
      ),
      safeLoad(
        "wallet_transactions",
        supabase
          .from("wallet_transactions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500)
      ),
      safeLoad(
        "seedling_purchases",
        supabase
          .from("seedling_purchases")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500)
      ),
      safeLoad(
        "cashin_requests",
        supabase
          .from("cashin_requests")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500)
      ),
      safeLoad(
        "withdrawal_requests",
        supabase
          .from("withdrawal_requests")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500)
      ),
      safeLoad(
        "notifications",
        supabase
          .from("notifications")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500)
      ),
      safeLoad(
        "maintenance_orders",
        supabase
          .from("maintenance_orders")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500)
      ),
      safeLoad(
        "gardener_assignments",
        supabase
          .from("gardener_assignments")
          .select("*")
          .order("assigned_at", { ascending: false })
          .limit(500)
      ),
      safeLoad(
        "tree_growth_logs",
        supabase
          .from("tree_growth_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500)
      ),
      safeLoad(
        "tree_registry",
        supabase
          .from("tree_registry")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(700)
      ),
      safeLoad(
        "revenue_allocations",
        supabase
          .from("revenue_allocations")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(700)
      ),
    ]);

    setProfiles(profileResult.rows);
    setTickets(ticketResult.rows);
    setWalletTx(walletResult.rows);
    setPurchases(purchaseResult.rows);
    setCashins(cashinResult.rows);
    setWithdrawals(withdrawalResult.rows);
    setNotifications(notificationResult.rows);
    setOrders(orderResult.rows);
    setAssignments(assignmentResult.rows);
    setGrowthLogs(growthLogResult.rows);
    setTrees(treeResult.rows);
    setAllocations(allocationResult.rows);

    setLoadIssues(
      [
        profileResult.issue,
        ticketResult.issue,
        walletResult.issue,
        purchaseResult.issue,
        cashinResult.issue,
        withdrawalResult.issue,
        notificationResult.issue,
        orderResult.issue,
        assignmentResult.issue,
        growthLogResult.issue,
        treeResult.issue,
        allocationResult.issue,
      ].filter(Boolean)
    );

    setLoading(false);
  }

  const evidenceRows = useMemo(() => {
    const rows: EvidenceItem[] = [];

    for (const row of cashins) {
      const profile = profileFor(row.profile_id, profiles);
      rows.push({
        id: `cashin-${row.id}`,
        category: "CUSTOMER",
        action: "Cash-in",
        title: `Cash-in ${row.status || "request"}`,
        description: row.description || `Cash-in reference ${row.reference_no || row.id}`,
        status: row.status || "PENDING",
        actor: profileName(profile),
        actorEmail: profile?.email || "",
        amount: numberOrNull(row.amount),
        reference: row.reference_no || row.id,
        evidenceUrl: proofUrl(row),
        sourceLabel: "Treasury",
        sourceHref: "/admin/treasury",
        createdAt: row.created_at || row.updated_at,
        raw: row,
      });
    }

    for (const row of withdrawals) {
      const profile = profileFor(row.profile_id, profiles);
      rows.push({
        id: `withdrawal-${row.id}`,
        category: "CUSTOMER",
        action: "Withdrawal",
        title: `Withdrawal ${row.status || "request"}`,
        description: row.description || row.reason || row.notes || `Withdrawal request ${row.id}`,
        status: row.status || "PENDING",
        actor: profileName(profile),
        actorEmail: profile?.email || "",
        amount: numberOrNull(row.amount),
        reference: row.reference_no || row.payment_reference || row.id,
        evidenceUrl: proofUrl(row),
        sourceLabel: "Withdrawals",
        sourceHref: "/admin/withdrawals",
        createdAt: row.created_at || row.updated_at,
        raw: row,
      });
    }

    for (const row of tickets) {
      const profile = profileFor(row.profile_id, profiles);
      rows.push({
        id: `support-${row.id}`,
        category: "CUSTOMER",
        action: "Support",
        title: row.subject || "Support message",
        description: row.message || row.last_message || "Support activity",
        status: row.status || "OPEN",
        actor: profileName(profile),
        actorEmail: profile?.email || "",
        reference: row.ticket_no || row.id,
        sourceLabel: "Support",
        sourceHref: "/admin/support",
        createdAt: row.created_at || row.updated_at,
        raw: row,
      });
    }

    for (const row of purchases) {
      const profile = profileFor(row.profile_id, profiles);
      const relatedTrees = trees.filter((tree) => tree.purchase_id === row.id);
      rows.push({
        id: `purchase-${row.id}`,
        category: "CUSTOMER",
        action: "Seedling purchase",
        title: `${row.quantity || 1} seedling(s) bought`,
        description:
          relatedTrees.length > 0
            ? `AG code(s): ${relatedTrees.map((tree) => tree.tree_code).join(", ")}`
            : "Seedling purchase recorded. AG code pending or not loaded.",
        status: row.status || "PENDING",
        actor: profileName(profile),
        actorEmail: profile?.email || "",
        amount: numberOrNull(row.amount),
        treeCode: relatedTrees.map((tree) => tree.tree_code).filter(Boolean).join(", "),
        reference: row.payment_reference || row.id,
        evidenceUrl: proofUrl(row),
        sourceLabel: "Seedling List",
        sourceHref: "/admin/purchases",
        createdAt: row.created_at || row.approved_at,
        raw: row,
      });
    }

    for (const row of orders) {
      const profile = profileFor(row.profile_id, profiles);
      const tree = treeFor(row.tree_id, trees);
      rows.push({
        id: `order-${row.id}`,
        category: "CARETAKER",
        action: "Maintenance order",
        title: serviceLabel(row.service_type),
        description: row.customer_note || row.admin_note || `Work status: ${row.work_status || "PENDING"}`,
        status: row.work_status || row.payment_status || "PENDING",
        actor: profileName(profile),
        actorEmail: profile?.email || "",
        amount: numberOrNull(row.amount),
        treeCode: row.tree_code || tree?.tree_code,
        reference: row.payment_reference || row.id,
        sourceLabel: "Tree Maintenance",
        sourceHref: "/admin/tree-maintenance",
        createdAt: row.created_at || row.updated_at,
        raw: row,
      });
    }

    for (const row of assignments) {
      const profile = profileFor(row.profile_id, profiles);
      const tree = treeFor(row.tree_id, trees);
      rows.push({
        id: `assignment-${row.id}`,
        category: "CARETAKER",
        action: "Caretaker task",
        title: `${serviceLabel(row.task_type)} assigned`,
        description: row.notes || `Assigned task for ${row.tree_code || tree?.tree_code || "AG tree"}`,
        status: row.status || "ASSIGNED",
        actor: profileName(profile),
        actorEmail: profile?.email || "",
        treeCode: row.tree_code || tree?.tree_code,
        reference: row.maintenance_order_id || row.id,
        sourceLabel: "Tree Maintenance",
        sourceHref: "/admin/tree-maintenance",
        createdAt: row.assigned_at || row.updated_at,
        raw: row,
      });
    }

    for (const row of growthLogs) {
      const profile = profileFor(row.profile_id, profiles);
      rows.push({
        id: `growth-${row.id}`,
        category: "CARETAKER",
        action: "Field evidence",
        title: `${row.health_status || row.status || "Tree update"} submitted`,
        description: row.notes || row.message || "Caretaker submitted field update/evidence.",
        status: row.status || row.health_status || "LOGGED",
        actor: row.caretaker_name || row.gardener_name || profileName(profile),
        actorEmail: profile?.email || "",
        treeCode: row.tree_code,
        reference: row.id,
        evidenceUrl: proofUrl(row),
        sourceLabel: "Caretaker Evidence",
        sourceHref: "/admin/activity",
        createdAt: row.created_at || row.updated_at,
        raw: row,
      });
    }

    for (const row of trees) {
      const profile = profileFor(row.profile_id, profiles);
      rows.push({
        id: `tree-${row.id}`,
        category: "TREE",
        action: "Tree registry",
        title: `${row.tree_code || "AG code"} registry`,
        description: `Species: ${row.species || "Aquilaria Malaccensis"} | DENR: ${row.denr_tag_number || "Pending"} | GPS: ${row.gps_lat || "-"}, ${row.gps_lng || "-"}`,
        status: row.status || "REGISTERED",
        actor: profileName(profile),
        actorEmail: profile?.email || "",
        treeCode: row.tree_code,
        reference: row.purchase_id || row.id,
        sourceLabel: "Tree Registry",
        sourceHref: "/admin/tree-registry",
        createdAt: row.created_at || row.planted_at,
        raw: row,
      });
    }

    for (const row of walletTx) {
      const profile = profileFor(row.profile_id, profiles);
      rows.push({
        id: `wallet-${row.id}`,
        category: "FINANCE",
        action: "Wallet movement",
        title: row.transaction_type || "Wallet transaction",
        description: row.description || "Wallet transaction recorded.",
        status: row.status || "COMPLETED",
        actor: profileName(profile),
        actorEmail: profile?.email || "",
        amount: numberOrNull(row.amount),
        reference: row.reference_no || row.payment_reference || row.id,
        sourceLabel: "Wallet Audit",
        sourceHref: "/admin/audit",
        createdAt: row.created_at || row.updated_at,
        raw: row,
      });
    }

    for (const row of allocations) {
      const profile = profileFor(row.profile_id, profiles);
      rows.push({
        id: `allocation-${row.id}`,
        category: "FINANCE",
        action: "Revenue allocation",
        title: `${row.beneficiary_name || row.beneficiary_key} allocation`,
        description: `${row.allocation_percent || 0}% allocation from ${row.source_type || "source"} | ${row.beneficiary_purpose || "Monthly manual settlement"}`,
        status: row.settlement_status || "PENDING_SETTLEMENT",
        actor: row.customer_name || profileName(profile),
        actorEmail: row.customer_email || profile?.email || "",
        amount: numberOrNull(row.allocated_amount),
        reference: row.payment_reference || row.id,
        sourceLabel: "Finance Distribution",
        sourceHref: "/admin/finance-distribution",
        createdAt: row.created_at || row.earned_date,
        raw: row,
      });
    }

    for (const row of notifications) {
      const profile = profileFor(row.profile_id, profiles);
      rows.push({
        id: `notice-${row.id}`,
        category: "SYSTEM",
        action: "Notification",
        title: row.title || "System notification",
        description: row.message || "Notification recorded.",
        status: row.is_read ? "READ" : "UNREAD",
        actor: profileName(profile),
        actorEmail: profile?.email || "",
        reference: row.id,
        sourceLabel: "Notifications",
        sourceHref: "/admin/notifications",
        createdAt: row.created_at || row.updated_at,
        raw: row,
      });
    }

    return rows.sort((a, b) => dateTime(b.createdAt) - dateTime(a.createdAt));
  }, [allocations, assignments, cashins, growthLogs, notifications, orders, profiles, purchases, tickets, trees, walletTx, withdrawals]);

  const filtered = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return evidenceRows.filter((item) => {
      const categoryOk = kind === "ALL" || item.category === kind;
      const statusOk = statusFilter === "ALL" || normalized(item.status).includes(statusFilter);
      const text = `${item.category} ${item.action} ${item.title} ${item.description} ${item.status} ${item.actor} ${item.actorEmail} ${item.treeCode || ""} ${item.reference || ""}`.toLowerCase();

      return categoryOk && statusOk && (!keyword || text.includes(keyword));
    });
  }, [evidenceRows, kind, search, statusFilter]);

  const selected = evidenceRows.find((item) => item.id === selectedId) || filtered[0] || null;
  const selectedCategory = categories.find((category) => category.key === kind) || categories[0];

  function countFor(category: string) {
    if (category === "ALL") return evidenceRows.length;
    return evidenceRows.filter((item) => item.category === category).length;
  }

  const statusOptions = useMemo(() => {
    const values = new Set<string>();
    evidenceRows.forEach((item) => {
      const value = normalized(item.status);
      if (value) values.add(value);
    });
    return Array.from(values).sort();
  }, [evidenceRows]);

  return (
    <main className="min-h-screen bg-[#f3f7f1] text-slate-950">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-4 lg:px-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/20 p-6 shadow-sm lg:p-8">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/forest-bg.jpg')" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-green-950/92 via-green-900/70 to-green-950/22" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-emerald-100">SUR Aloeswood Admin</p>
              <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight text-white lg:text-6xl">Evidence Logs</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/80 lg:text-base">
                One searchable audit trail for customer money movement, support, seedling purchases, caretaker work, tree registry updates, field proof, and finance allocation.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button onClick={loadEvidence} disabled={loading} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm hover:bg-white/90 disabled:opacity-60">
                {loading ? "Refreshing..." : "Refresh"}
              </button>
              <Link href="/admin/dashboard" className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur hover:bg-white/20">
                Dashboard
              </Link>
            </div>
          </div>

          <div className="relative z-10 mt-8 grid gap-3 md:grid-cols-5">
            <HeroStat label="Evidence Rows" value={String(evidenceRows.length)} />
            <HeroStat label="Customer" value={String(countFor("CUSTOMER"))} />
            <HeroStat label="Caretaker" value={String(countFor("CARETAKER"))} />
            <HeroStat label="Tree" value={String(countFor("TREE"))} />
            <HeroStat label="Finance" value={String(countFor("FINANCE"))} />
          </div>

          {loadIssues.length > 0 && (
            <div className="relative z-10 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold leading-6 text-amber-900">
              Some evidence sources are not ready yet: {loadIssues.join(" | ")}
            </div>
          )}
        </section>

        <section className="grid gap-5 py-5 xl:grid-cols-[0.32fr_0.88fr_0.8fr]">
          <aside className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
            <h2 className="text-2xl font-black text-slate-950">Categories</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Evidence type filter.</p>

            <div className="mt-5 space-y-3">
              {categories.map((category) => (
                <button
                  key={category.key}
                  onClick={() => setKind(category.key)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    kind === category.key
                      ? "border-emerald-400 bg-emerald-50 shadow-sm"
                      : "border-slate-200 bg-slate-50 hover:border-emerald-200 hover:bg-emerald-50/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-950">{category.title}</p>
                      <p className="mt-1 text-xs font-bold leading-5 text-slate-500">{category.detail}</p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">
                      {countFor(category.key)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-950">{selectedCategory.title}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">{selectedCategory.detail}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name, AG code, ref, status"
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
                />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
                >
                  <option value="ALL">All statuses</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5 max-h-[760px] space-y-3 overflow-auto pr-1">
              {filtered.length === 0 ? (
                <Empty text="No evidence logs found." />
              ) : (
                filtered.slice(0, 300).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selected?.id === item.id
                        ? "border-emerald-400 bg-emerald-50 shadow-sm"
                        : "border-slate-200 bg-slate-50 hover:border-emerald-200 hover:bg-emerald-50/60"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-black text-slate-950">{item.title}</p>
                        <p className="mt-1 text-xs font-black uppercase tracking-wide text-emerald-700">
                          {item.category} - {item.action}
                        </p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(item.status)}`}>
                        {item.status || "LOGGED"}
                      </span>
                    </div>

                    <p className="mt-3 line-clamp-2 text-sm font-bold leading-6 text-slate-600">{item.description}</p>

                    <div className="mt-4 grid gap-2 text-xs font-bold text-slate-500 md:grid-cols-2">
                      <span>{item.actor || "Unknown actor"}</span>
                      <span>{formatDate(item.createdAt)}</span>
                      {item.treeCode && <span>AG: {item.treeCode}</span>}
                      {item.reference && <span>Ref: {item.reference}</span>}
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
            <h2 className="text-2xl font-black text-slate-950">Evidence Detail</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Source, proof, and raw audit payload.</p>

            {!selected ? (
              <div className="mt-5">
                <Empty text="Select an evidence log first." />
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50 p-5">
                  <p className="text-xs font-black uppercase tracking-wide text-emerald-700">{selected.category}</p>
                  <h3 className="mt-2 text-2xl font-black text-slate-950">{selected.title}</h3>
                  <p className="mt-3 text-sm font-bold leading-6 text-slate-700">{selected.description}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge value={selected.status || "LOGGED"} />
                    {selected.treeCode && <Badge value={selected.treeCode} />}
                    {selected.amount !== null && selected.amount !== undefined && <Badge value={peso(selected.amount)} />}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Info label="Actor / Owner" value={selected.actor || "-"} />
                  <Info label="Email" value={selected.actorEmail || "-"} />
                  <Info label="Action" value={selected.action} />
                  <Info label="Time" value={formatDate(selected.createdAt)} />
                  <Info label="Reference" value={selected.reference || "-"} />
                  <Info label="Source" value={selected.sourceLabel} />
                </div>

                {selected.evidenceUrl ? (
                  <a href={selected.evidenceUrl} target="_blank" className="block overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-50">
                    <div className="border-b border-slate-200 px-4 py-3 text-sm font-black text-slate-950">Open Evidence / Photo / Proof</div>
                    {isImageUrl(selected.evidenceUrl) ? (
                      <img src={selected.evidenceUrl} alt="Evidence proof" className="max-h-[360px] w-full object-contain" />
                    ) : (
                      <div className="p-5 text-sm font-bold text-emerald-700">Evidence file available. Click to open.</div>
                    )}
                  </a>
                ) : (
                  <Empty text="No attached evidence file for this log." />
                )}

                <Link href={selected.sourceHref} className="block rounded-2xl bg-emerald-600 px-5 py-4 text-center text-sm font-black text-white hover:bg-emerald-700">
                  View Source Page
                </Link>

                <details className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                  <summary className="cursor-pointer text-sm font-black text-slate-950">Raw Record</summary>
                  <pre className="mt-4 max-h-[320px] overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-600">
                    {JSON.stringify(selected.raw, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

function profileFor(profileId: string | null | undefined, profiles: AnyRow[]) {
  if (!profileId) return null;
  return profiles.find((profile) => String(profile.id) === String(profileId)) || null;
}

function treeFor(treeId: string | null | undefined, trees: AnyRow[]) {
  if (!treeId) return null;
  return trees.find((tree) => String(tree.id) === String(treeId)) || null;
}

function profileName(profile: AnyRow | null) {
  if (!profile) return "Unknown account";
  return profile.full_name || profile.email || "Unknown account";
}

function numberOrNull(value: any) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : null;
}

function proofUrl(row: AnyRow) {
  const keys = [
    "photo_url",
    "proof_url",
    "payment_screenshot_url",
    "payment_proof_url",
    "receipt_url",
    "screenshot_url",
    "file_url",
    "evidence_url",
    "attachment_url",
  ];

  for (const key of keys) {
    const value = row[key];
    if (value && String(value).trim()) return String(value);
  }

  return "";
}

function dateTime(value: string | null | undefined) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function peso(value: any) {
  return `PHP ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function serviceLabel(value?: string | null) {
  return String(value || "Task").replaceAll("_", " ");
}

function normalized(value: string | null | undefined) {
  return String(value || "").toUpperCase().trim();
}

function statusClass(value: string | null | undefined) {
  const status = normalized(value);

  if (
    status.includes("APPROVED") ||
    status.includes("ACTIVE") ||
    status.includes("PAID") ||
    status.includes("COMPLETED") ||
    status.includes("READY") ||
    status.includes("SETTLED") ||
    status.includes("LOGGED")
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (
    status.includes("REJECTED") ||
    status.includes("FAILED") ||
    status.includes("CANCELLED") ||
    status.includes("SUSPENDED") ||
    status.includes("DAMAGED")
  ) {
    return "border-red-200 bg-red-50 text-red-800";
  }

  if (status.includes("UNREAD") || status.includes("PENDING") || status.includes("ASSIGNED") || status.includes("HOLD")) {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function isImageUrl(url: string) {
  const clean = url.toLowerCase().split("?")[0];
  return clean.endsWith(".jpg") || clean.endsWith(".jpeg") || clean.endsWith(".png") || clean.endsWith(".webp") || clean.endsWith(".heic") || clean.endsWith(".heif");
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/16 p-4 backdrop-blur">
      <p className="text-xs font-black uppercase tracking-wide text-white/65">{label}</p>
      <p className="mt-2 truncate text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-black text-slate-950">{value || "-"}</p>
    </div>
  );
}

function Badge({ value }: { value: string }) {
  return <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(value)}`}>{value}</span>;
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">
      {text}
    </div>
  );
}