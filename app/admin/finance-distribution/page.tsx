"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { settlementStatuses, treasuryAccounts } from "@/app/lib/finance/fee-distribution";
import { supabase } from "@/app/lib/supabase/client";

type AnyRow = Record<string, any>;
type TabKey = "LEDGER" | "PAYOUTS" | "ACCOUNTS";

const beneficiaries = Object.values(treasuryAccounts);
const beneficiaryByKey = new Map(beneficiaries.map((item) => [item.beneficiaryKey, item]));
const sourceTypes = [
  "ALL",
  "WALLET_CASH_IN",
  "WALLET_SEEDLING_PURCHASE",
  "SEEDLING_PURCHASE_APPROVAL",
  "CASHIN_PLATFORM_FEE",
  "WITHDRAWAL_PLATFORM_FEE",
  "MANUAL_PAYMENT",
];

const controlClass =
  "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400";
const lightButtonClass =
  "rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 hover:border-emerald-200 hover:bg-emerald-50 disabled:opacity-60";

const peso = (value: any) =>
  `PHP ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function AdminFinanceDistributionPage() {
  const [rows, setRows] = useState<AnyRow[]>([]);
  const [tab, setTab] = useState<TabKey>("LEDGER");
  const [period, setPeriod] = useState("THIS_MONTH");
  const [beneficiary, setBeneficiary] = useState("ALL");
  const [sourceType, setSourceType] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [settlementInputs, setSettlementInputs] = useState<Record<string, { reference: string; notes: string }>>({});

  useEffect(() => {
    loadAllocations();
  }, []);

  async function loadAllocations() {
    setMessage("");

    const { data, error } = await supabase
      .from("revenue_allocations")
      .select("*")
      .order("earned_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(2000);

    if (error) {
      setMessage(error.message);
      return;
    }

    setRows((data || []) as AnyRow[]);
  }

  const filteredRows = useMemo(() => {
    const now = new Date();
    const keyword = search.trim().toLowerCase();

    return rows.filter((row) => {
      const earned = parseDate(row.earned_date || row.created_at);
      const canonical = beneficiaryFor(row);
      const periodOk = dateInPeriod(earned, period, now, fromDate, toDate);
      const beneficiaryOk = beneficiary === "ALL" || row.beneficiary_key === beneficiary;
      const sourceOk = sourceType === "ALL" || row.source_type === sourceType;
      const statusOk = status === "ALL" || row.settlement_status === status;
      const text = `${row.payment_reference || ""} ${row.customer_name || ""} ${row.customer_email || ""} ${canonical.name} ${canonical.bank} ${canonical.accountName} ${canonical.accountNumber} ${row.source_type || ""}`.toLowerCase();

      return periodOk && beneficiaryOk && sourceOk && statusOk && (!keyword || text.includes(keyword));
    });
  }, [rows, period, beneficiary, sourceType, status, fromDate, toDate, search]);

  const payoutGroups = useMemo(() => {
    const pendingRows = rows.filter((row) => String(row.settlement_status || "").toUpperCase() !== "SETTLED");
    const map = new Map<string, AnyRow[]>();
    const payoutMonths = new Set<string>();

    for (const row of pendingRows) {
      const month = row.payout_month || currentPayoutMonth();
      payoutMonths.add(month);
      const key = `${month}|${row.beneficiary_key}`;
      map.set(key, [...(map.get(key) || []), row]);
    }

    if (payoutMonths.size === 0) payoutMonths.add(currentPayoutMonth());

    const groups = Array.from(payoutMonths).flatMap((month) =>
      beneficiaries.map((beneficiaryAccount) => {
        const key = `${month}|${beneficiaryAccount.beneficiaryKey}`;
        const groupRows = map.get(key) || [];
        return {
          key,
          month,
          beneficiaryKey: beneficiaryAccount.beneficiaryKey,
          beneficiaryName: beneficiaryAccount.recipient,
          purpose: beneficiaryAccount.purpose,
          bank: beneficiaryAccount.accountProvider,
          accountName: beneficiaryAccount.accountName,
          accountNumber: beneficiaryAccount.accountNumber,
          percent: beneficiaryAccount.percent,
          total: groupRows.reduce((sum, row) => sum + Number(row.allocated_amount || 0), 0),
          rows: groupRows,
          status: groupRows.length === 0
            ? "NO_PENDING_ROWS"
            : groupRows.some((row) => row.settlement_status === "ON_HOLD")
              ? "ON_HOLD"
              : "PENDING_SETTLEMENT",
        };
      })
    );

    return groups.sort((a, b) => String(b.month).localeCompare(String(a.month)) || Number(b.percent || 0) - Number(a.percent || 0) || String(a.beneficiaryName).localeCompare(String(b.beneficiaryName)));
  }, [rows]);

  const totals = useMemo(() => {
    const pending = rows.filter((row) => row.settlement_status !== "SETTLED");
    return {
      rowCount: filteredRows.length,
      gross: filteredRows.reduce((sum, row) => sum + Number(row.gross_amount || 0), 0),
      allocated: filteredRows.reduce((sum, row) => sum + Number(row.allocated_amount || 0), 0),
      pending: pending.reduce((sum, row) => sum + Number(row.allocated_amount || 0), 0),
    };
  }, [filteredRows, rows]);

  async function markGroupSettled(group: (typeof payoutGroups)[number]) {
    if (group.rows.length === 0) {
      setMessage(`${group.beneficiaryName} has no pending allocation rows for ${group.month}.`);
      return;
    }

    const input = settlementInputs[group.key] || { reference: "", notes: "" };

    if (!input.reference.trim()) {
      setMessage("Transfer reference is required before marking a payout group settled.");
      return;
    }

    setBusyKey(group.key);
    setMessage("");

    const profileId = safeLocalStorage("sur_profile_id");
    const { error } = await supabase
      .from("revenue_allocations")
      .update({
        settlement_status: "SETTLED",
        settlement_reference: input.reference.trim(),
        settlement_notes: input.notes.trim() || null,
        settled_by: profileId || null,
        settled_at: new Date().toISOString(),
      })
      .in(
        "id",
        group.rows.map((row) => row.id)
      );

    if (error) {
      setMessage(error.message);
      setBusyKey("");
      return;
    }

    setMessage(`${group.beneficiaryName} ${group.month} payout marked settled for monthly manual settlement records.`);
    await loadAllocations();
    setBusyKey("");
  }

  async function updateGroupStatus(group: (typeof payoutGroups)[number], nextStatus: string) {
    if (group.rows.length === 0) {
      setMessage(`${group.beneficiaryName} has no pending allocation rows for ${group.month}.`);
      return;
    }

    setBusyKey(group.key);
    setMessage("");

    const { error } = await supabase
      .from("revenue_allocations")
      .update({ settlement_status: nextStatus })
      .in(
        "id",
        group.rows.map((row) => row.id)
      );

    if (error) {
      setMessage(error.message);
      setBusyKey("");
      return;
    }

    setMessage(`${group.beneficiaryName} group updated to ${nextStatus}.`);
    await loadAllocations();
    setBusyKey("");
  }

  function exportGroup(group: (typeof payoutGroups)[number]) {
    const header = [
      "Date",
      "Payment Reference",
      "Customer",
      "Source Type",
      "Gross Amount",
      "Beneficiary",
      "Percent",
      "Allocated Amount",
      "Settlement Status",
    ];
    const csv = [
      header,
      ...group.rows.map((row) => [
        row.earned_date,
        row.payment_reference,
        row.customer_name || row.customer_email,
        row.source_type,
        row.gross_amount,
        beneficiaryFor(row).name,
        row.allocation_percent,
        row.allocated_amount,
        row.settlement_status,
      ]),
    ]
      .map((line) => line.map(csvCell).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sur-finance-${group.month}-${group.beneficiaryKey}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-[#f3f7f1] text-slate-950">
      <div className="mx-auto w-full max-w-[1580px] px-4 py-4 lg:px-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/25 p-6 shadow-sm lg:p-8">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/forest-bg.jpg')" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/94 via-emerald-900/72 to-slate-950/28" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-emerald-100">SUR Aloeswood Admin</p>
              <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight text-white lg:text-6xl">
                Finance Distribution
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/78 lg:text-base">
                Approved customer payments are recorded into an automatic allocation ledger, then settled through monthly manual distribution.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button onClick={loadAllocations} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm hover:bg-white/90">
                Refresh
              </button>
              <Link href="/admin/dashboard" className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur hover:bg-white/20">
                Dashboard
              </Link>
            </div>
          </div>

          <div className="relative z-10 mt-8 grid gap-3 md:grid-cols-4">
            <HeroStat label="Filtered Rows" value={String(totals.rowCount)} />
            <HeroStat label="Filtered Gross" value={peso(totals.gross)} />
            <HeroStat label="Filtered Allocation" value={peso(totals.allocated)} />
            <HeroStat label="Pending Settlement" value={peso(totals.pending)} />
          </div>
        </section>

        {message && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
            {message}
          </div>
        )}

        <section className="mt-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-950">Allocation Blueprint</h2>
              <p className="mt-1 text-sm text-slate-600">This is the active 60/10/10/10/10 finance distribution used by the ledger.</p>
            </div>
            <span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-emerald-800">
              5 receiving accounts
            </span>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {beneficiaries.map((item, index) => (
              <AllocationCard key={item.beneficiaryKey} item={item} featured={index === 0} />
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-emerald-100 bg-white p-4 shadow-sm lg:p-5">
          <div className="flex flex-wrap gap-2">
            <TabButton active={tab === "LEDGER"} onClick={() => setTab("LEDGER")} label="Daily Allocation Ledger" />
            <TabButton active={tab === "PAYOUTS"} onClick={() => setTab("PAYOUTS")} label="Monthly Payout View" />
            <TabButton active={tab === "ACCOUNTS"} onClick={() => setTab("ACCOUNTS")} label="Receiving Accounts" />
          </div>
        </section>

        {tab === "LEDGER" && (
          <section className="mt-5 rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-2xl font-black">Daily Allocation Ledger</h2>
                <p className="mt-1 text-sm text-slate-600">Internal finance rows only. Customers do not see these allocations.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                <Select value={period} onChange={setPeriod} options={["TODAY", "THIS_WEEK", "THIS_MONTH", "DATE_RANGE", "ALL"]} />
                <input value={fromDate} onChange={(event) => setFromDate(event.target.value)} type="date" className={controlClass} />
                <input value={toDate} onChange={(event) => setToDate(event.target.value)} type="date" className={controlClass} />
                <Select value={beneficiary} onChange={setBeneficiary} options={["ALL", ...beneficiaries.map((item) => item.beneficiaryKey)]} />
                <Select value={sourceType} onChange={setSourceType} options={sourceTypes} />
                <Select value={status} onChange={setStatus} options={["ALL", ...settlementStatuses]} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" className={controlClass} />
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-[1180px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      {["Date", "Reference", "Customer", "Source", "Gross", "Beneficiary", "Percent", "Allocation", "Status"].map((heading) => (
                        <th key={heading} className="px-4 py-3 font-black">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center text-sm font-bold text-slate-500">
                          No allocation rows found.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row) => {
                        const canonical = beneficiaryFor(row);
                        return (
                          <tr key={row.id} className="hover:bg-emerald-50/40">
                            <td className="px-4 py-4 font-bold text-slate-700">{row.earned_date || "-"}</td>
                            <td className="px-4 py-4 font-black text-slate-950">{row.payment_reference || "-"}</td>
                            <td className="px-4 py-4">
                              <p className="font-black text-slate-950">{row.customer_name || "-"}</p>
                              <p className="text-xs font-bold text-slate-500">{row.customer_email || "-"}</p>
                            </td>
                            <td className="px-4 py-4 font-bold text-slate-600">{row.source_type || "-"}</td>
                            <td className="px-4 py-4 font-black">{peso(row.gross_amount)}</td>
                            <td className="px-4 py-4">
                              <p className="font-black">{canonical.name}</p>
                              <p className="text-xs font-bold text-slate-500">{canonical.bank} - {canonical.accountName}</p>
                            </td>
                            <td className="px-4 py-4 font-black">{Number(row.allocation_percent || 0)}%</td>
                            <td className="px-4 py-4 font-black text-emerald-700">{peso(row.allocated_amount)}</td>
                            <td className="px-4 py-4">
                              <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(row.settlement_status)}`}>
                                {row.settlement_status || "PENDING_SETTLEMENT"}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {tab === "PAYOUTS" && (
          <section className="mt-5 grid gap-5 xl:grid-cols-2">
            {payoutGroups.length === 0 ? (
              <div className="rounded-[2rem] border border-emerald-100 bg-white p-8 text-center shadow-sm">
                <h2 className="text-2xl font-black">No Pending Payouts</h2>
                <p className="mt-2 text-sm text-slate-600">All allocation rows are currently settled.</p>
              </div>
            ) : (
              payoutGroups.map((group) => {
                const input = settlementInputs[group.key] || { reference: "", notes: "" };
                return (
                  <article key={group.key} className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">{group.month}</p>
                        <h2 className="mt-2 text-2xl font-black text-slate-950">{group.beneficiaryName}</h2>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{group.purpose}</p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(group.status)}`}>{group.status}</span>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <Info label="Bank" value={group.bank} />
                      <Info label="Account Name" value={group.accountName} />
                      <Info label="Account Number" value={group.accountNumber} />
                      <Info label="Total Pending Amount" value={peso(group.total)} strong />
                    </div>

                    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-black text-slate-950">Included Allocation Rows</p>
                      <div className="mt-3 max-h-44 space-y-2 overflow-auto pr-1">
                        {group.rows.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm font-bold text-slate-500">
                            No pending rows for this beneficiary yet.
                          </div>
                        ) : group.rows.map((row) => (
                          <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 text-sm">
                            <div>
                              <p className="font-black">{row.payment_reference || row.source_id}</p>
                              <p className="text-xs font-bold text-slate-500">{row.customer_name || row.customer_email || "-"} - {row.source_type}</p>
                            </div>
                            <p className="font-black text-emerald-700">{peso(row.allocated_amount)}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <input
                        value={input.reference}
                        onChange={(event) =>
                          setSettlementInputs((current) => ({ ...current, [group.key]: { ...input, reference: event.target.value } }))
                        }
                        placeholder="Transfer reference"
                        className={controlClass}
                      />
                      <input
                        value={input.notes}
                        onChange={(event) =>
                          setSettlementInputs((current) => ({ ...current, [group.key]: { ...input, notes: event.target.value } }))
                        }
                        placeholder="Settlement notes"
                        className={controlClass}
                      />
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <button disabled={group.rows.length === 0} onClick={() => exportGroup(group)} className={lightButtonClass}>Export CSV</button>
                      <button disabled={busyKey === group.key || group.rows.length === 0} onClick={() => updateGroupStatus(group, "READY_FOR_PAYOUT")} className={lightButtonClass}>Ready for Payout</button>
                      <button disabled={busyKey === group.key || group.rows.length === 0} onClick={() => updateGroupStatus(group, "ON_HOLD")} className={lightButtonClass}>Put On Hold</button>
                      <button disabled={busyKey === group.key || group.rows.length === 0} onClick={() => markGroupSettled(group)} className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60">
                        Mark Settled
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </section>
        )}

        {tab === "ACCOUNTS" && (
          <section className="mt-5 grid gap-5 lg:grid-cols-2">
            {beneficiaries.map((item, index) => (
              <AllocationCard key={item.beneficiaryKey} item={item} featured={index === 0} />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function AllocationCard({ item, featured = false }: { item: (typeof beneficiaries)[number]; featured?: boolean }) {
  return (
    <article className={`rounded-[1.6rem] border bg-white p-5 shadow-sm ${featured ? "border-emerald-200 lg:col-span-1" : "border-emerald-100"}`}>
      <p className="text-xs font-black uppercase tracking-[0.32em] text-emerald-700">{item.percent}% Allocation</p>
      <h3 className="mt-3 text-2xl font-black leading-tight text-slate-950">{item.recipient}</h3>
      <p className="mt-3 min-h-10 text-sm leading-6 text-slate-600">{item.purpose}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Info label="Bank" value={item.accountProvider} />
        <Info label="Account Name" value={item.accountName} />
        <Info label="Account Number" value={item.accountNumber} />
      </div>
    </article>
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

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl px-5 py-3 text-sm font-black transition ${
        active ? "bg-emerald-700 text-white shadow-sm" : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-emerald-50"
      }`}
    >
      {label}
    </button>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className={controlClass}>
      {options.map((option) => (
        <option key={option} value={option}>
          {option.replaceAll("_", " ")}
        </option>
      ))}
    </select>
  );
}

function Info({ label, value, strong = false }: { label: string; value: any; strong?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-2 break-words ${strong ? "text-2xl text-emerald-700" : "text-sm text-slate-950"} font-black`}>{value || "-"}</p>
    </div>
  );
}

function statusClass(status?: string | null) {
  const value = String(status || "").toUpperCase();
  if (["SETTLED", "READY_FOR_PAYOUT"].includes(value)) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (["PENDING_SETTLEMENT", "PARTIALLY_SETTLED"].includes(value)) return "border-amber-200 bg-amber-50 text-amber-800";
  if (["FAILED", "ON_HOLD"].includes(value)) return "border-red-200 bg-red-50 text-red-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function parseDate(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function dateInPeriod(date: Date, period: string, now: Date, fromDate: string, toDate: string) {
  if (period === "ALL") return true;
  const dateText = date.toISOString().slice(0, 10);
  const todayText = now.toISOString().slice(0, 10);

  if (period === "TODAY") return dateText === todayText;

  if (period === "THIS_WEEK") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return date >= start;
  }

  if (period === "THIS_MONTH") return dateText.slice(0, 7) === todayText.slice(0, 7);

  if (period === "DATE_RANGE") {
    const fromOk = !fromDate || dateText >= fromDate;
    const toOk = !toDate || dateText <= toDate;
    return fromOk && toOk;
  }

  return true;
}

function currentPayoutMonth() {
  return new Date().toISOString().slice(0, 7);
}

function csvCell(value: any) {
  const text = String(value ?? "");
  return `"${text.replaceAll("\"", "\"\"")}"`;
}

function beneficiaryFor(row: AnyRow) {
  const configured = beneficiaryByKey.get(String(row.beneficiary_key || ""));

  if (configured) {
    return {
      name: configured.recipient,
      purpose: configured.purpose,
      bank: configured.accountProvider,
      accountName: configured.accountName,
      accountNumber: configured.accountNumber,
    };
  }

  return {
    name: row.beneficiary_name || row.beneficiary_key || "-",
    purpose: row.beneficiary_purpose || "-",
    bank: row.bank_name || "-",
    accountName: row.account_name || "-",
    accountNumber: row.account_number || "-",
  };
}

function safeLocalStorage(key: string) {
  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}
