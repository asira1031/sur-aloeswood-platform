"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { calculatePlatformFee } from "@/app/lib/finance/fee-distribution";

type AnyRow = Record<string, any>;

const peso = (value: number | null | undefined) =>
  `PHP ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const normalize = (value?: string | null) => String(value || "").toUpperCase();
const WITHDRAWAL_BUCKET = "withdrawal-proofs";

function profileName(profile?: AnyRow | null) {
  return profile?.full_name || profile?.email || "Unknown Co-Planter";
}

export default function AdminTreasuryPage() {
  const [profiles, setProfiles] = useState<AnyRow[]>([]);
  const [wallets, setWallets] = useState<AnyRow[]>([]);
  const [cashins, setCashins] = useState<AnyRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<AnyRow[]>([]);
  const [transactions, setTransactions] = useState<AnyRow[]>([]);
  const [selectedCashin, setSelectedCashin] = useState<AnyRow | null>(null);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<AnyRow | null>(null);
  const [filter, setFilter] = useState("PENDING_VERIFICATION");
  const [tab, setTab] = useState<"CASHIN" | "WITHDRAW">("CASHIN");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [settlementReference, setSettlementReference] = useState("");
  const [settlementNotes, setSettlementNotes] = useState("");
  const [withdrawalProof, setWithdrawalProof] = useState<File | null>(null);

  useEffect(() => {
    loadTreasury();
  }, []);

  async function loadTreasury() {
    setMessage("");

    const [profileResult, walletResult, cashinResult, withdrawalResult, txResult] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, wallet_balance, account_status, kyc_status").limit(1000),
      supabase.from("wallets").select("id, profile_id, balance, updated_at"),
      supabase
        .from("cashin_requests")
        .select("id, profile_id, amount, reference_no, description, status, payment_channel, sender_name, sender_account, proof_url, platform_fee, net_amount, approved_at, rejected_at, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("withdrawal_requests")
        .select("id, profile_id, amount, platform_fee, net_amount, payout_method, payout_account_name, payout_account_number, status, request_reference, settlement_reference, proof_url, receipt_url, admin_notes, requested_at, settled_at, rejected_at")
        .order("requested_at", { ascending: false }),
      supabase.from("wallet_transactions").select("id, profile_id, transaction_type, amount, description, status, created_at").order("created_at", { ascending: false }).limit(500),
    ]);

    if (profileResult.error || walletResult.error || cashinResult.error || withdrawalResult.error || txResult.error) {
      setMessage(profileResult.error?.message || walletResult.error?.message || cashinResult.error?.message || withdrawalResult.error?.message || txResult.error?.message || "Unable to load treasury.");
      return;
    }

    const cashinRows = (cashinResult.data || []) as AnyRow[];
    const withdrawalRows = (withdrawalResult.data || []) as AnyRow[];
    setProfiles((profileResult.data || []) as AnyRow[]);
    setWallets((walletResult.data || []) as AnyRow[]);
    setCashins(cashinRows);
    setWithdrawals(withdrawalRows);
    setTransactions((txResult.data || []) as AnyRow[]);
    setSelectedCashin((current) => cashinRows.find((row) => row.id === current?.id) || cashinRows[0] || null);
    setSelectedWithdrawal((current) => withdrawalRows.find((row) => row.id === current?.id) || withdrawalRows[0] || null);
  }

  function getProfile(profileId?: string) {
    return profiles.find((profile) => profile.id === profileId) || null;
  }

  function getWallet(profileId?: string) {
    return wallets.find((wallet) => wallet.profile_id === profileId) || null;
  }

  async function verifyCashin(row: AnyRow) {
    setBusyId(row.id);
    setMessage("");

    if (!row.proof_url) {
      setMessage("Cannot verify cash-in without payment proof photo.");
      setBusyId("");
      return;
    }

    const { error } = await supabase.rpc("sur_admin_verify_cashin", {
      p_cashin_request_id: row.id,
    });

    if (error) {
      setMessage(error.message);
      setBusyId("");
      return;
    }

    setMessage("Cash-in verified. Wallet credited and TDI platform fee allocation recorded.");
    await loadTreasury();
    setBusyId("");
  }

  async function rejectCashin(row: AnyRow) {
    setBusyId(row.id);
    setMessage("");

    const reason = window.prompt("Reason for rejecting this cash-in?", "Unable to verify real payment.");
    if (reason === null) {
      setBusyId("");
      return;
    }

    const { error } = await supabase.rpc("sur_admin_reject_cashin", {
      p_cashin_request_id: row.id,
      p_reason: reason,
    });

    if (error) {
      setMessage(error.message);
      setBusyId("");
      return;
    }

    setMessage("Cash-in rejected and customer was notified.");
    await loadTreasury();
    setBusyId("");
  }

  function onWithdrawalProofChange(event: ChangeEvent<HTMLInputElement>) {
    setWithdrawalProof(event.target.files?.[0] || null);
  }

  async function uploadWithdrawalProof(row: AnyRow, file: File) {
    const ext = file.name.split(".").pop() || "jpg";
    const safeRef = String(row.request_reference || row.id).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 60);
    const path = `${row.profile_id}/${Date.now()}-${safeRef}.${ext}`;

    const { error: uploadError } = await supabase.storage.from(WITHDRAWAL_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(WITHDRAWAL_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  async function settleWithdrawal(row: AnyRow) {
    setBusyId(row.id);
    setMessage("");

    if (!settlementReference.trim()) {
      setMessage("Settlement reference is required.");
      setBusyId("");
      return;
    }

    if (!withdrawalProof) {
      setMessage("Upload the withdrawal settlement screenshot first.");
      setBusyId("");
      return;
    }

    try {
      const proofUrl = await uploadWithdrawalProof(row, withdrawalProof);
      const { error } = await supabase.rpc("sur_admin_settle_withdrawal", {
        p_withdrawal_request_id: row.id,
        p_settlement_reference: settlementReference.trim(),
        p_proof_url: proofUrl,
        p_notes: settlementNotes.trim() || null,
      });

      if (error) throw error;

      setSettlementReference("");
      setSettlementNotes("");
      setWithdrawalProof(null);
      setMessage("Withdrawal settled. Proof saved and customer was notified.");
      await loadTreasury();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to settle withdrawal.");
    } finally {
      setBusyId("");
    }
  }

  async function rejectWithdrawal(row: AnyRow) {
    setBusyId(row.id);
    setMessage("");

    const reason = window.prompt("Reason for rejecting this withdrawal?", "Unable to process payout.");
    if (reason === null) {
      setBusyId("");
      return;
    }

    const { error } = await supabase.rpc("sur_admin_reject_withdrawal", {
      p_withdrawal_request_id: row.id,
      p_reason: reason,
    });

    if (error) {
      setMessage(error.message);
      setBusyId("");
      return;
    }

    setMessage("Withdrawal rejected. Reserved wallet amount was returned to customer.");
    await loadTreasury();
    setBusyId("");
  }

  const filteredCashins = useMemo(() => {
    const keyword = search.toLowerCase().trim();
    return cashins.filter((row) => {
      const profile = getProfile(row.profile_id);
      const status = normalize(row.status);
      const statusOk = filter === "ALL" || status === filter || (filter === "PENDING_VERIFICATION" && status === "PENDING");
      const text = `${JSON.stringify(row)} ${profile?.full_name || ""} ${profile?.email || ""}`.toLowerCase();
      return statusOk && (!keyword || text.includes(keyword));
    });
  }, [cashins, profiles, filter, search]);

  const filteredWithdrawals = useMemo(() => {
    const keyword = search.toLowerCase().trim();
    return withdrawals.filter((row) => {
      const profile = getProfile(row.profile_id);
      const status = normalize(row.status);
      const statusOk = filter === "ALL" || status === filter || (filter === "PENDING_VERIFICATION" && status === "PENDING_REVIEW");
      const text = `${JSON.stringify(row)} ${profile?.full_name || ""} ${profile?.email || ""}`.toLowerCase();
      return statusOk && (!keyword || text.includes(keyword));
    });
  }, [withdrawals, profiles, filter, search]);

  const walletTotal = wallets.reduce((sum, row) => sum + Number(row.balance || 0), 0);
  const pendingCashinTotal = cashins.filter((row) => ["PENDING", "PENDING_VERIFICATION"].includes(normalize(row.status))).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const pendingWithdrawTotal = withdrawals.filter((row) => ["PENDING", "PENDING_REVIEW"].includes(normalize(row.status))).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const selected = tab === "CASHIN" ? selectedCashin : selectedWithdrawal;
  const selectedProfile = selected ? getProfile(selected.profile_id) : null;
  const selectedWallet = selected ? getWallet(selected.profile_id) : null;
  const feeQuote = selected ? calculatePlatformFee(Number(selected.amount || 0)) : null;

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
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-white lg:text-6xl">Treasury Center</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78 lg:text-base">
                Manual cash-in verification, withdrawal checking, wallet credit control, and TDI platform fee ledger.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={loadTreasury} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm hover:bg-white/90">Refresh</button>
              <Link href="/admin/dashboard" className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur hover:bg-white/20">Dashboard</Link>
            </div>
          </div>

          <div className="relative z-10 mt-8 grid gap-3 md:grid-cols-4">
            <HeroStat label="Wallet Balances" value={peso(walletTotal)} />
            <HeroStat label="Pending Cash-In" value={peso(pendingCashinTotal)} />
            <HeroStat label="Pending Withdraw" value={peso(pendingWithdrawTotal)} />
            <HeroStat label="Wallet TX" value={String(transactions.length)} />
          </div>

          {message && <div className="relative z-10 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">{message}</div>}
        </section>

        <section className="grid gap-5 py-5 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-950">{tab === "CASHIN" ? "Cash-In Verification" : "Withdrawal Review"}</h2>
                <p className="mt-1 text-sm text-slate-600">Open proof photo first before approval. Screenshot alone does not move money unless admin verifies.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setTab("CASHIN")} className={`rounded-2xl px-4 py-3 text-xs font-black ${tab === "CASHIN" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"}`}>Cash-In</button>
                <button onClick={() => setTab("WITHDRAW")} className={`rounded-2xl px-4 py-3 text-xs font-black ${tab === "WITHDRAW" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"}`}>Withdraw</button>
              </div>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, ref, sender" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400" />
              <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400">
                <option value="PENDING_VERIFICATION">Pending</option>
                <option value="ALL">All</option>
                <option value="APPROVED">Approved</option>
                <option value="SETTLED">Settled</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            <div className="mt-5 space-y-3">
              {(tab === "CASHIN" ? filteredCashins : filteredWithdrawals).length === 0 ? (
                <Empty text="No records found." />
              ) : (
                (tab === "CASHIN" ? filteredCashins : filteredWithdrawals).map((row) => {
                  const profile = getProfile(row.profile_id);
                  const active = selected?.id === row.id;
                  return (
                    <button key={row.id} onClick={() => tab === "CASHIN" ? setSelectedCashin(row) : setSelectedWithdrawal(row)} className={`w-full rounded-2xl border p-5 text-left transition ${active ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:border-emerald-200"}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-black text-slate-950">{profileName(profile)}</p>
                          <p className="mt-1 text-sm font-bold text-slate-600">{profile?.email || "-"}</p>
                          <p className="mt-1 text-xs font-bold text-slate-400">Ref: {row.reference_no || row.request_reference || "-"}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-emerald-700">{peso(row.amount)}</p>
                          <Badge value={row.status || "PENDING"} />
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
            <h2 className="text-2xl font-black text-slate-950">{tab === "CASHIN" ? "Cash-In Detail" : "Withdrawal Detail"}</h2>
            {!selected ? (
              <div className="mt-5"><Empty text="Select a record first." /></div>
            ) : (
              <>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <Info label="Customer" value={profileName(selectedProfile)} />
                  <Info label="Email" value={selectedProfile?.email || "-"} />
                  <Info label="Amount" value={peso(selected.amount)} />
                  <Info label="Wallet Balance" value={peso(selectedWallet?.balance)} />
                  <Info label="Status" value={selected.status || "PENDING"} />
                  <Info label="Date" value={formatDate(selected.created_at || selected.requested_at)} />
                  {tab === "CASHIN" ? (
                    <>
                      <Info label="Channel" value={selected.payment_channel || "-"} />
                      <Info label="Reference" value={selected.reference_no || "-"} />
                      <Info label="Sender Name" value={selected.sender_name || "-"} />
                      <Info label="Sender Account" value={selected.sender_account || "-"} />
                    </>
                  ) : (
                    <>
                      <Info label="Payout Method" value={selected.payout_method || "-"} />
                      <Info label="Payout Account" value={`${selected.payout_account_name || "-"} / ${selected.payout_account_number || "-"}`} />
                    </>
                  )}
                </div>

                <div className="mt-5 rounded-3xl border border-amber-100 bg-amber-50/80 p-4">
                  <p className="text-sm font-black text-slate-950">Platform Fee to TDI</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <Info label="Gross" value={peso(feeQuote?.gross)} />
                    <Info label="TDI Fee" value={peso(feeQuote?.fee)} />
                    <Info label={tab === "CASHIN" ? "Wallet Credit" : "Net Payout"} value={peso(feeQuote?.net)} />
                  </div>
                </div>

                <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-black text-slate-950">{tab === "CASHIN" ? "Payment Proof Photo" : "Settlement Proof Photo"}</p>
                  {selected.proof_url ? (
                    <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      {String(selected.proof_url).toLowerCase().includes(".pdf") ? (
                        <a href={selected.proof_url} target="_blank" className="block p-5 text-sm font-black text-emerald-700 underline">Open PDF proof</a>
                      ) : (
                        <a href={selected.proof_url} target="_blank">
                          <img src={selected.proof_url} alt="Payment proof" className="max-h-[420px] w-full object-contain" />
                        </a>
                      )}
                    </div>
                  ) : (
                    <Empty text="No proof uploaded yet." />
                  )}
                </div>

                {tab === "CASHIN" && (
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <button disabled={busyId === selected.id || normalize(selected.status) === "APPROVED"} onClick={() => verifyCashin(selected)} className="rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60">
                      Verify Proof + Credit Wallet
                    </button>
                    <button disabled={busyId === selected.id || normalize(selected.status) === "APPROVED"} onClick={() => rejectCashin(selected)} className="rounded-2xl bg-red-600 px-6 py-4 text-sm font-black text-white hover:bg-red-700 disabled:opacity-60">
                      Reject Cash-In
                    </button>
                  </div>
                )}

                {tab === "WITHDRAW" && (
                  <div className="mt-5 rounded-3xl border border-amber-100 bg-amber-50/80 p-4">
                    <p className="text-sm font-black text-slate-950">Manual Settlement</p>
                    <p className="mt-1 text-xs font-bold leading-6 text-slate-600">
                      Send the real payout outside the app, then upload the proof screenshot and settlement reference.
                    </p>
                    <div className="mt-4 grid gap-3">
                      <input
                        value={settlementReference}
                        onChange={(event) => setSettlementReference(event.target.value)}
                        placeholder="Bank / GCash / Maya transfer reference"
                        className="rounded-2xl border border-amber-100 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-amber-400"
                      />
                      <textarea
                        value={settlementNotes}
                        onChange={(event) => setSettlementNotes(event.target.value)}
                        placeholder="Admin settlement notes"
                        className="min-h-24 rounded-2xl border border-amber-100 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-amber-400"
                      />
                      <label className="rounded-2xl border border-dashed border-amber-300 bg-white px-5 py-4 text-sm font-black text-amber-900">
                        Withdrawal payout screenshot
                        <input type="file" accept="image/*,application/pdf" onChange={onWithdrawalProofChange} className="mt-3 block w-full text-sm font-bold text-slate-700" />
                      </label>
                      <div className="grid gap-3 md:grid-cols-2">
                        <button disabled={busyId === selected.id || normalize(selected.status) === "SETTLED"} onClick={() => settleWithdrawal(selected)} className="rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60">
                          Upload Proof + Mark Settled
                        </button>
                        <button disabled={busyId === selected.id || normalize(selected.status) === "SETTLED"} onClick={() => rejectWithdrawal(selected)} className="rounded-2xl bg-red-600 px-6 py-4 text-sm font-black text-white hover:bg-red-700 disabled:opacity-60">
                          Reject + Return Balance
                        </button>
                      </div>
                    </div>
                  </div>
                )}
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

function Badge({ value }: { value: string }) {
  const status = normalize(value);
  const style = status.includes("APPROVED") || status.includes("SETTLED") || status.includes("COMPLETED")
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : status.includes("REJECTED") || status.includes("FAILED")
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-amber-200 bg-amber-50 text-amber-800";
  return <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-black ${style}`}>{value}</span>;
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
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">{text}</div>;
}
