"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { formatDate, netAmount, peso, recoverySplit, statusClass, type AnyRow } from "@/app/lib/production/finance";

export default function AdminWithdrawalsPage() {
  const [requests, setRequests] = useState<AnyRow[]>([]);
  const [profiles, setProfiles] = useState<AnyRow[]>([]);
  const [wallets, setWallets] = useState<AnyRow[]>([]);
  const [terminatedTrees, setTerminatedTrees] = useState<AnyRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedTerminatedTreeId, setSelectedTerminatedTreeId] = useState("");
  const [filter, setFilter] = useState("PENDING");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setMessage("");
    const [{ data: txRows, error }, { data: profileRows }, { data: walletRows }, { data: terminatedRows }] = await Promise.all([
      supabase.from("wallet_transactions").select("id, profile_id, transaction_type, amount, description, status, created_at").in("transaction_type", ["WITHDRAW_REQUEST", "RECOVERY_TERMINATION_REQUEST"]).order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, email, account_status, kyc_status").limit(1000),
      supabase.from("wallets").select("id, profile_id, balance, updated_at"),
      supabase
        .from("tree_registry")
        .select("id, profile_id, purchase_id, tree_code, denr_tag_number, species, status, gps_lat, gps_lng, planted_at, created_at")
        .eq("status", "TERMINATED")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    if (error) {
      setMessage(error.message);
      return;
    }
    const safeRows = (txRows || []) as AnyRow[];
    setRequests(safeRows);
    setProfiles((profileRows || []) as AnyRow[]);
    setWallets((walletRows || []) as AnyRow[]);
    setTerminatedTrees((terminatedRows || []) as AnyRow[]);
    setSelectedId((current) => current || safeRows[0]?.id || "");
    setSelectedTerminatedTreeId((current) => current || terminatedRows?.[0]?.id || "");
  }

  function profileFor(id: string) {
    return profiles.find((profile) => profile.id === id) || null;
  }

  function walletFor(id: string) {
    return wallets.find((wallet) => wallet.profile_id === id) || null;
  }

  function transactionTreeId(row: AnyRow) {
    const match = String(row.description || "").match(/TREE_ID:([0-9a-f-]+)/i);
    return match?.[1] || "";
  }

  async function syncSystemMoneyHold(row: AnyRow, status: "APPROVED" | "REJECTED") {
    const treeId = transactionTreeId(row);
    if (!treeId) return;

    await supabase
      .from("wallet_transactions")
      .update({ status })
      .eq("profile_id", row.profile_id)
      .eq("transaction_type", "SYSTEM_MONEY_RECOVERY_HOLD")
      .ilike("description", `%TREE_ID:${treeId}%`);
  }

  async function approve(row: AnyRow) {
    setBusyId(row.id);
    setMessage("");

    const wallet = walletFor(row.profile_id);
    const amount = Number(row.amount || 0);

    if (!wallet || amount <= 0) {
      setMessage("Wallet not found or invalid amount.");
      setBusyId("");
      return;
    }

    if (Number(wallet.balance || 0) < amount) {
      setMessage("Insufficient wallet balance.");
      setBusyId("");
      return;
    }

    const newBalance = Number(wallet.balance || 0) - amount;
    const isRecovery = row.transaction_type === "RECOVERY_TERMINATION_REQUEST";

    const { error: walletError } = await supabase.from("wallets").update({ balance: newBalance, updated_at: new Date().toISOString() }).eq("id", wallet.id);
    if (walletError) {
      setMessage(walletError.message);
      setBusyId("");
      return;
    }

    await supabase.from("profiles").update({ wallet_balance: newBalance }).eq("id", row.profile_id);
    await supabase.from("wallet_transactions").update({ status: "APPROVED" }).eq("id", row.id);

    if (isRecovery) {
      const treeId = transactionTreeId(row);
      if (treeId) {
        await supabase.from("tree_registry").update({ status: "TERMINATED" }).eq("id", treeId);
      }
      await syncSystemMoneyHold(row, "APPROVED");

      const split = recoverySplit(amount);
      await supabase.from("wallet_transactions").insert([
        { profile_id: row.profile_id, transaction_type: "RECOVERY_TERMINATION_COPLANTER_SHARE", amount: split.coPlanterShare, description: `50% co-planter recovery termination share from ${peso(amount)}${treeId ? ` for TREE_ID:${treeId}` : ""}`, status: "APPROVED" },
        { profile_id: row.profile_id, transaction_type: "RECOVERY_TERMINATION_PLANTATION_SHARE", amount: split.plantationShare, description: `50% plantation recovery termination share from ${peso(amount)}${treeId ? ` for TREE_ID:${treeId}` : ""}`, status: "APPROVED" },
      ]);
    } else {
      await supabase.from("wallet_transactions").insert({
        profile_id: row.profile_id,
        transaction_type: "WITHDRAW_APPROVED",
        amount: netAmount(amount),
        description: `Withdrawal approved. Gross ${peso(amount)}.`,
        status: "APPROVED",
      });
    }

    await supabase.from("notifications").insert({
      profile_id: row.profile_id,
      title: isRecovery ? "Recovery termination approved" : "Withdrawal approved",
      message: isRecovery ? `Recovery termination approved for ${peso(amount)}. The selected tree has been removed from active AG tree records.` : `Withdrawal approved for ${peso(amount)}.`,
      is_read: false,
    });

    setMessage(isRecovery ? "Recovery approved, wallet deducted, and selected tree terminated." : "Request approved and wallet deducted.");
    await loadData();
    setBusyId("");
  }

  async function reject(row: AnyRow) {
    setBusyId(row.id);
    setMessage("");
    const isRecovery = row.transaction_type === "RECOVERY_TERMINATION_REQUEST";
    const { error } = await supabase.from("wallet_transactions").update({ status: "REJECTED" }).eq("id", row.id);
    if (error) {
      setMessage(error.message);
      setBusyId("");
      return;
    }
    if (isRecovery) {
      await syncSystemMoneyHold(row, "REJECTED");
    }
    await supabase.from("notifications").insert({
      profile_id: row.profile_id,
      title: isRecovery ? "Recovery request rejected" : "Withdrawal request rejected",
      message: isRecovery ? "Your Recovery Fund request was rejected. The selected tree remains active." : "Your request was rejected. Please contact support.",
      is_read: false,
    });
    setMessage("Request rejected.");
    await loadData();
    setBusyId("");
  }

  const filtered = useMemo(() => requests.filter((row) => filter === "ALL" || String(row.status || "").toUpperCase() === filter), [requests, filter]);
  const selected = requests.find((row) => row.id === selectedId) || filtered[0] || null;
  const pendingCount = requests.filter((row) => String(row.status || "").toUpperCase() === "PENDING").length;
  const recoveryCount = requests.filter((row) => row.transaction_type === "RECOVERY_TERMINATION_REQUEST").length;
  const pendingAmount = requests
    .filter((row) => String(row.status || "").toUpperCase() === "PENDING")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const selectedProfile = selected ? profileFor(selected.profile_id) : null;
  const selectedWallet = selected ? walletFor(selected.profile_id) : null;
  const selectedIsRecovery = selected?.transaction_type === "RECOVERY_TERMINATION_REQUEST";
  const selectedSplit = recoverySplit(Number(selected?.amount || 0));
  const selectedTerminatedTree = terminatedTrees.find((tree) => tree.id === selectedTerminatedTreeId) || terminatedTrees[0] || null;
  const selectedTerminatedProfile = selectedTerminatedTree ? profileFor(selectedTerminatedTree.profile_id) : null;
  const selectedTerminatedRecovery = selectedTerminatedTree
    ? requests.find((row) => row.transaction_type === "RECOVERY_TERMINATION_REQUEST" && transactionTreeId(row) === selectedTerminatedTree.id)
    : null;

  return (
    <main className="min-h-screen bg-[#f3f7f1] text-slate-950">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-4 lg:px-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/20 p-6 shadow-sm lg:p-8">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/forest-bg.jpg')" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-green-950/90 via-green-900/66 to-green-950/18" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-white/75">SUR Aloeswood Admin</p>
              <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight text-white lg:text-6xl">
                Withdrawal & Recovery
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/78 lg:text-base">
                Process withdrawals, recovery fund termination, wallet deductions, and 50/50 recovery ledger records.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button onClick={loadData} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm hover:bg-white/90">
                Refresh
              </button>
              <Link href="/admin/dashboard" className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur hover:bg-white/20">
                Dashboard
              </Link>
            </div>
          </div>

          <div className="relative z-10 mt-8 grid gap-3 md:grid-cols-4">
            <HeroStat label="Requests" value={String(requests.length)} />
            <HeroStat label="Pending" value={String(pendingCount)} />
            <HeroStat label="Pending Amount" value={peso(pendingAmount)} />
            <HeroStat label="Recovery Cases" value={String(recoveryCount)} />
          </div>

          {message && (
            <div className="relative z-10 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
              {message}
            </div>
          )}
        </section>

        <section className="grid gap-5 py-5 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Requests</h2>
                <p className="mt-1 text-sm text-slate-600">Select a withdrawal or recovery request.</p>
              </div>
              <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400">
                <option value="ALL">All</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            <div className="mt-5 space-y-3">
              {filtered.length === 0 ? (
                <Empty text="No requests found." />
              ) : (
                filtered.map((row) => {
                  const profile = profileFor(row.profile_id);
                  return (
                    <button
                      key={row.id}
                      onClick={() => setSelectedId(row.id)}
                      className={`w-full rounded-2xl border p-5 text-left transition ${
                        selected?.id === row.id ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:border-emerald-200"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-lg font-black text-slate-950">{profile?.full_name || profile?.email || "Unknown"}</p>
                          <p className="mt-1 text-sm font-bold text-slate-600">{row.transaction_type}</p>
                          <p className="mt-2 line-clamp-2 text-sm text-slate-500">{row.description || "-"}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-emerald-700">{peso(row.amount)}</p>
                          <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClass(row.status)}`}>
                            {row.status || "PENDING"}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
            <h2 className="text-2xl font-black text-slate-950">Request Detail</h2>

            {!selected ? (
              <div className="mt-5"><Empty text="Select a request." /></div>
            ) : (
              <>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <Info label="Co-Planter" value={selectedProfile?.full_name || selectedProfile?.email || "Unknown"} />
                  <Info label="Email" value={selectedProfile?.email || "-"} />
                  <Info label="Amount" value={peso(selected.amount)} />
                  <Info label="Wallet Balance" value={peso(selectedWallet?.balance)} />
                  <Info label="Created" value={formatDate(selected.created_at)} />
                  <Info label="Net / Split" value={selectedIsRecovery ? `50/50: ${peso(selectedSplit.coPlanterShare)} / ${peso(selectedSplit.plantationShare)}` : peso(netAmount(Number(selected.amount || 0)))} />
                </div>

                {selectedIsRecovery && (
                  <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-bold leading-6 text-red-800">
                    Recovery fund approval is treated as voluntary contract termination. Verify legal status before approving.
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-3">
                  <button disabled={busyId === selected.id || String(selected.status).toUpperCase() === "APPROVED"} onClick={() => approve(selected)} className="rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60">
                    Approve + Deduct
                  </button>
                  <button disabled={busyId === selected.id || String(selected.status).toUpperCase() === "APPROVED"} onClick={() => reject(selected)} className="rounded-2xl bg-red-600 px-6 py-4 text-sm font-black text-white hover:bg-red-700 disabled:opacity-60">
                    Reject
                  </button>
                </div>
              </>
            )}
          </section>
        </section>

        <section className="grid gap-5 pb-8 lg:grid-cols-[0.88fr_1.12fr]">
          <section className="rounded-[2rem] border border-red-100 bg-white p-5 shadow-sm lg:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Terminated Tree Records</h2>
                <p className="mt-1 text-sm text-slate-600">Admin/plantation-held trees after approved recovery termination.</p>
              </div>
              <span className="rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-black text-red-800">
                {terminatedTrees.length} records
              </span>
            </div>

            <div className="mt-5 grid max-h-[560px] gap-3 overflow-y-auto pr-1">
              {terminatedTrees.length === 0 ? (
                <Empty text="No terminated recovery trees yet." />
              ) : terminatedTrees.map((tree) => {
                const profile = profileFor(tree.profile_id);
                return (
                  <button
                    key={tree.id}
                    onClick={() => setSelectedTerminatedTreeId(tree.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selectedTerminatedTree?.id === tree.id ? "border-red-300 bg-red-50" : "border-slate-200 bg-slate-50 hover:border-red-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-950">{tree.tree_code || "AG Tree"}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">{profile?.full_name || profile?.email || "Former co-planter"}</p>
                        <p className="mt-2 text-sm font-black text-red-700">Admin/Plantation Held</p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(tree.status)}`}>{tree.status || "TERMINATED"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-[2rem] border border-red-100 bg-white p-5 shadow-sm lg:p-6">
            <h2 className="text-2xl font-black text-slate-950">Terminated Tree Detail</h2>
            {!selectedTerminatedTree ? (
              <div className="mt-5"><Empty text="Select a terminated tree." /></div>
            ) : (
              <>
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <Info label="Tree Code" value={selectedTerminatedTree.tree_code || "AG Tree"} />
                  <Info label="Former Co-Planter" value={selectedTerminatedProfile?.full_name || selectedTerminatedProfile?.email || "Unknown"} />
                  <Info label="Status" value="TERMINATED - ADMIN HELD" />
                  <Info label="DENR Tag" value={selectedTerminatedTree.denr_tag_number || "Pending"} />
                  <Info label="Planted Date" value={formatDate(selectedTerminatedTree.planted_at)} />
                  <Info label="Recovery Request" value={selectedTerminatedRecovery?.status || "Record retained"} />
                </div>

                <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-bold leading-7 text-red-800">
                  This tree must stay visible even after termination. If admin/plantation later sells, transfers, or reassigns it, the sale record should be attached here so the same tree cannot disappear from audit.
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Sale / Transfer Indicator</p>
                    <p className="mt-2 text-lg font-black text-slate-950">No sale record attached</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">Future marketplace or admin sale module should update this tree record instead of creating an invisible side record.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Termination Source</p>
                    <p className="mt-2 text-sm font-bold leading-6 text-slate-700">{selectedTerminatedRecovery?.description || "Terminated tree retained from recovery approval."}</p>
                  </div>
                </div>
              </>
            )}
          </section>
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">
      {text}
    </div>
  );
}
