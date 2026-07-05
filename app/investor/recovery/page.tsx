"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import {
  RECOVERY_FUND_ALLOCATION,
  RECOVERY_FUND_WITHDRAWAL_MINIMUM,
  recoveryTerminationNotice,
} from "@/app/lib/business/rules";
import { formatDate, peso, statusClass, type AnyRow } from "@/app/lib/coplanting/ui";

export default function RecoveryPage() {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<AnyRow | null>(null);
  const [trees, setTrees] = useState<AnyRow[]>([]);
  const [transactions, setTransactions] = useState<AnyRow[]>([]);
  const [selectedTree, setSelectedTree] = useState<AnyRow | null>(null);
  const [message, setMessage] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sur_login_email") || "";
    const requestedTreeId = new URLSearchParams(window.location.search).get("tree") || "";
    setEmail(saved);
    if (saved) loadRecovery(saved, requestedTreeId);
  }, []);

  async function loadRecovery(targetEmail = email, targetTreeId = "") {
    setMessage("");
    const cleanEmail = targetEmail.toLowerCase().trim();

    const { data: profileRow, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, account_status, kyc_status")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (error || !profileRow) {
      setMessage(error?.message || "Profile not found.");
      setProfile(null);
      setTransactions([]);
      setTrees([]);
      return;
    }

    const [{ data: txRows }, { data: treeRows }] = await Promise.all([
      supabase
        .from("wallet_transactions")
        .select("id, profile_id, transaction_type, amount, description, status, created_at")
        .eq("profile_id", profileRow.id)
        .in("transaction_type", [
          "RECOVERY_TERMINATION_REQUEST",
          "SYSTEM_MONEY_RECOVERY_HOLD",
          "RECOVERY_TERMINATION_COPLANTER_SHARE",
          "RECOVERY_TERMINATION_PLANTATION_SHARE",
        ])
        .order("created_at", { ascending: false }),
      supabase
        .from("tree_registry")
        .select("id, tree_code, denr_tag_number, status, planted_at")
        .eq("profile_id", profileRow.id)
        .order("created_at", { ascending: false }),
    ]);

    setProfile(profileRow);
    setTransactions((txRows || []) as AnyRow[]);
    const loadedTrees = (treeRows || []) as AnyRow[];
    setTrees(loadedTrees);
    const requestedTree = targetTreeId ? loadedTrees.find((tree) => tree.id === targetTreeId) : null;
    setSelectedTree(requestedTree || loadedTrees[0] || null);
    localStorage.setItem("sur_login_email", cleanEmail);
    localStorage.setItem("sur_profile_id", profileRow.id);
  }

  function openConfirm() {
    setMessage("");

    if (!profile) {
      setMessage("Login first to request Recovery Fund withdrawal.");
      return;
    }

    if (!selectedTree) {
      setMessage("Select an active AG tree first.");
      return;
    }

    if (String(profile.kyc_status || "").toUpperCase() !== "APPROVED") {
      setMessage("KYC approval is required before contract termination request.");
      return;
    }

    if (hasPendingRecovery(selectedTree.id)) {
      setMessage("This tree already has a pending Recovery Fund request.");
      return;
    }

    if (String(selectedTree.status || "").toUpperCase() === "TERMINATED") {
      setMessage("This tree is already terminated.");
      return;
    }

    if (!reachedMinimum) {
      setMessage(`Recovery Fund withdrawal unlocks at ${peso(RECOVERY_FUND_WITHDRAWAL_MINIMUM)}. Current active fund is ${peso(recoveryBalance)}.`);
      return;
    }

    setShowConfirm(true);
  }

  async function submitTerminationRequest() {
    if (!profile || !selectedTree) return;

    setSubmitting(true);
    const requestAmount = RECOVERY_FUND_ALLOCATION;
    const reference = `RF-${Date.now()}`;
    const treeLabel = selectedTree.tree_code || "AG Tree";
    const treeReference = `TREE_ID:${selectedTree.id}. TREE_CODE:${treeLabel}.`;
    const { error } = await supabase.from("wallet_transactions").insert([
      {
        profile_id: profile.id,
        transaction_type: "RECOVERY_TERMINATION_REQUEST",
        amount: requestAmount,
        description: `Recovery Fund termination request ${reference}. ${treeReference} Customer accepted contract termination notice before submission.`,
        status: "PENDING",
      },
      {
        profile_id: profile.id,
        transaction_type: "SYSTEM_MONEY_RECOVERY_HOLD",
        amount: requestAmount,
        description: `System money hold for ${reference}. ${treeReference} Pending admin approval; real payout remains manual settlement through approved payment channels.`,
        status: "PENDING",
      },
    ]);
    setSubmitting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.from("notifications").insert({
      profile_id: profile.id,
      title: "Recovery Fund request submitted",
      message: `Your Recovery Fund request for ${treeLabel} is now recorded in system money and pending admin review.`,
      is_read: false,
    });

    setSelectedTree(null);
    setShowConfirm(false);
    setMessage("Per-tree Recovery Fund termination request submitted for admin review.");
    await loadRecovery(profile.email || email, selectedTree.id);
  }

  function transactionTreeId(transaction: AnyRow) {
    const match = String(transaction.description || "").match(/TREE_ID:([0-9a-f-]+)/i);
    return match?.[1] || "";
  }

  function hasPendingRecovery(treeId: string) {
    return transactions.some(
      (tx) =>
        transactionTreeId(tx) === treeId &&
        String(tx.transaction_type || "").toUpperCase() === "RECOVERY_TERMINATION_REQUEST" &&
        String(tx.status || "").toUpperCase() === "PENDING"
    );
  }

  function recoveryRequestFor(treeId: string) {
    return transactions.find(
      (tx) =>
        transactionTreeId(tx) === treeId &&
        String(tx.transaction_type || "").toUpperCase() === "RECOVERY_TERMINATION_REQUEST"
    );
  }

  const activeTrees = trees.filter((tree) => String(tree.status || "").toUpperCase() !== "TERMINATED");
  const recoveryBalance = activeTrees.length * RECOVERY_FUND_ALLOCATION;
  const reachedMinimum = recoveryBalance >= RECOVERY_FUND_WITHDRAWAL_MINIMUM;
  const isWithdrawable = reachedMinimum && String(profile?.kyc_status || "").toUpperCase() === "APPROVED";
  const selectedStatus = String(selectedTree?.status || "").toUpperCase();
  const selectedTerminated = selectedStatus === "TERMINATED";
  const selectedPending = selectedTree ? hasPendingRecovery(selectedTree.id) : false;
  const selectedRequest = selectedTree ? recoveryRequestFor(selectedTree.id) : null;
  const requestPreview = selectedTree ? RECOVERY_FUND_ALLOCATION : 0;
  const withdrawDisabled = !profile || !selectedTree || !isWithdrawable || selectedTerminated || selectedPending;
  const allTrees = trees;

  return (
    <main className="min-h-screen bg-[#080708] px-4 py-5 text-white lg:px-7">
      <section className="relative overflow-hidden rounded-[2rem] border border-red-500/20 bg-[#160406] p-6 shadow-2xl lg:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(185,28,28,0.32),transparent_34%),linear-gradient(135deg,#120406,#050505_62%,#000)]" />
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.35em] text-red-300">Contract Termination Center</p>
            <h1 className="mt-4 max-w-4xl text-4xl font-black lg:text-6xl">Recovery Fund Vault</h1>
            <p className="mt-4 max-w-3xl text-sm font-bold leading-7 text-white/68">
              Each AG tree adds {peso(RECOVERY_FUND_ALLOCATION)} to the Recovery Fund. Withdrawal unlocks only when the active fund reaches {peso(RECOVERY_FUND_WITHDRAWAL_MINIMUM)} or more.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/investor/wallet" className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-black">
              Wallet
            </Link>
            <Link href="/investor/dashboard" className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white">
              Dashboard
            </Link>
          </div>
        </div>

        <div className="relative z-10 mt-7 grid gap-3 md:grid-cols-4">
          <Stat label="Active Recovery" value={peso(recoveryBalance)} />
          <Stat label="Per Tree Balance" value={peso(RECOVERY_FUND_ALLOCATION)} />
          <Stat label="Active Trees" value={String(activeTrees.length)} />
          <Stat label="Minimum To Withdraw" value={peso(RECOVERY_FUND_WITHDRAWAL_MINIMUM)} />
        </div>

        {message && (
          <div className="relative z-10 mt-5 rounded-2xl border border-red-300/30 bg-red-500/12 px-5 py-4 text-sm font-black leading-7 text-red-100">
            {message}
          </div>
        )}
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[0.88fr_1.12fr]">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl lg:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-red-300">Tree List</p>
              <h2 className="mt-2 text-2xl font-black">Per-Tree Recovery Balance</h2>
            </div>
            <span className="rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs font-black text-white/60">
              {allTrees.length} records
            </span>
          </div>

          <div className="mt-5 grid max-h-[620px] gap-3 overflow-y-auto pr-1">
            {allTrees.length === 0 ? (
              <Empty text="No AG tree records available." />
            ) : allTrees.map((tree) => {
              const isTerminated = String(tree.status || "").toUpperCase() === "TERMINATED";
              const isPending = hasPendingRecovery(tree.id);
              return (
                <button
                  key={tree.id}
                  onClick={() => setSelectedTree(tree)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    selectedTree?.id === tree.id
                      ? "border-red-300 bg-red-500/15"
                      : isTerminated
                        ? "border-red-900/60 bg-red-950/20 hover:border-red-500/50"
                        : "border-white/10 bg-black/35 hover:border-red-400/45"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-red-100">{tree.tree_code || "AG Tree"}</p>
                      <p className="mt-1 text-xs font-bold text-white/45">{tree.denr_tag_number || "DENR pending"}</p>
                      <p className="mt-2 text-sm font-black text-white">{peso(RECOVERY_FUND_ALLOCATION)}</p>
                      <p className="mt-1 text-xs font-bold text-white/40">
                        {isTerminated ? "Recorded balance settled through termination" : "Available per-tree recovery balance"}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(tree.status)}`}>{tree.status || "REGISTERED"}</span>
                      {isPending && <p className="mt-2 text-xs font-black text-red-200">PENDING</p>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl lg:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-red-300">Tree Details</p>
              <h2 className="mt-2 text-2xl font-black">{selectedTree?.tree_code || "Select a tree"}</h2>
              <p className="mt-2 text-sm font-bold leading-7 text-white/58">
                Details, current recovery status, source of fund, and termination audit trail for the selected AG tree.
              </p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-black ${selectedTree ? statusClass(selectedTree.status) : "border-white/15 bg-white/10 text-white/55"}`}>
              {selectedTree?.status || "NO TREE SELECTED"}
            </span>
          </div>

          {!selectedTree ? (
            <div className="mt-5">
              <Empty text="Select one tree from the list to view recovery balance and withdrawal controls." />
            </div>
          ) : (
            <>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <Detail label="Recovery Balance" value={selectedTerminated ? peso(0) : peso(RECOVERY_FUND_ALLOCATION)} tone="red" />
                <Detail label="Recorded Value" value={peso(RECOVERY_FUND_ALLOCATION)} tone="dark" />
                <Detail label="Request Status" value={selectedPending ? "PENDING REVIEW" : selectedTerminated ? "TERMINATED" : "AVAILABLE"} tone="dark" />
                <Detail label="DENR Tag" value={selectedTree.denr_tag_number || "Pending"} tone="dark" />
                <Detail label="Planted Date" value={formatDate(selectedTree.planted_at)} tone="dark" />
                <Detail label="System Money" value={selectedRequest ? String(selectedRequest.status || "PENDING") : "No hold"} tone="dark" />
                <Detail label="Withdrawal Gate" value={reachedMinimum ? "UNLOCKED" : `${peso(RECOVERY_FUND_WITHDRAWAL_MINIMUM - recoveryBalance)} gap`} tone="dark" />
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-red-200/70">Source of Fund</p>
                  <p className="mt-2 text-sm font-bold leading-7 text-red-50">
                    This tree's recovery value is {peso(RECOVERY_FUND_ALLOCATION)}. The vault total increases when another approved tree is registered and reaches withdrawable status at {peso(RECOVERY_FUND_WITHDRAWAL_MINIMUM)}.
                  </p>
                </div>
                <div className="rounded-2xl border border-red-500/20 bg-black/35 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-red-200/70">Termination Rule</p>
                  <p className="mt-2 text-sm font-bold leading-7 text-white/62">
                    If approved, only this selected tree is terminated. The tree remains in the record as terminated and becomes an admin/plantation-held asset.
                  </p>
                </div>
              </div>

              {selectedTerminated && (
                <div className="mt-5 rounded-2xl border border-red-500/35 bg-red-950/30 p-4">
                  <p className="text-sm font-black leading-7 text-red-100">
                    This tree is already terminated. Keep future sale or transfer records visible here so the plantation cannot sell the same tree without an audit trail.
                  </p>
                </div>
              )}

              {selectedRequest && (
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/35 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-white/40">Latest Recovery Record</p>
                      <p className="mt-2 text-sm font-bold leading-7 text-white/62">{selectedRequest.description || "-"}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(selectedRequest.status)}`}>{selectedRequest.status || "PENDING"}</span>
                  </div>
                </div>
              )}

              <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
                <div className="rounded-2xl border border-red-400/25 bg-black/35 p-4">
                  <p className="text-sm font-black leading-7 text-red-100">{recoveryTerminationNotice}</p>
                </div>
                <button
                  onClick={openConfirm}
                  disabled={withdrawDisabled}
                  className="rounded-2xl bg-red-600 px-6 py-4 text-sm font-black text-white hover:bg-red-500 disabled:bg-white/10 disabled:text-white/35"
                >
                  {reachedMinimum ? "Withdraw This Tree" : "Minimum Not Reached"}
                </button>
              </div>
            </>
          )}
        </section>
      </section>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <section className="w-full max-w-xl rounded-[2rem] border border-red-500/40 bg-[#120407] p-6 shadow-2xl">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-red-300">Final Confirmation</p>
            <h2 className="mt-4 text-3xl font-black">Terminate Contract?</h2>
            <p className="mt-3 text-sm font-bold leading-7 text-white/65">
              You are requesting {peso(requestPreview)} for {selectedTree?.tree_code || "the selected tree"}. If approved, this specific tree contract will be terminated and removed from active AG tree records.
            </p>
            <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-sm font-black leading-7 text-red-100">{recoveryTerminationNotice}</p>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button onClick={() => setShowConfirm(false)} className="rounded-2xl border border-white/15 bg-white/10 px-6 py-4 text-sm font-black text-white">
                Cancel
              </button>
              <button onClick={submitTerminationRequest} disabled={submitting} className="rounded-2xl bg-red-600 px-6 py-4 text-sm font-black text-white hover:bg-red-500 disabled:opacity-60">
                {submitting ? "Submitting..." : "Accept and Submit"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-white/40">{label}</p>
      <p className="mt-2 text-sm font-black text-white">{value}</p>
    </div>
  );
}

function Detail({ label, value, tone }: { label: string; value: string; tone: "red" | "dark" }) {
  const style = tone === "red" ? "border-red-500/25 bg-red-500/10 text-red-100" : "border-white/10 bg-black/35 text-white";
  return (
    <div className={`rounded-2xl border p-4 ${style}`}>
      <p className="text-xs font-black uppercase tracking-wide opacity-55">{label}</p>
      <p className="mt-2 break-words text-lg font-black">{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-black/35 p-5 text-sm font-bold text-white/45">{text}</div>;
}
