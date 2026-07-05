"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { formatDate, getProfile, peso, profileName, statusClass, type AnyRow } from "@/app/lib/admin/approvals";
import { calculateDistribution } from "@/app/lib/finance/fee-distribution";

export default function AdminTreasuryPage() {
  const [profiles, setProfiles] = useState<AnyRow[]>([]);
  const [wallets, setWallets] = useState<AnyRow[]>([]);
  const [cashins, setCashins] = useState<AnyRow[]>([]);
  const [transactions, setTransactions] = useState<AnyRow[]>([]);
  const [selected, setSelected] = useState<AnyRow | null>(null);
  const [filter, setFilter] = useState("PENDING");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadTreasury();
  }, []);

  async function loadTreasury() {
    setMessage("");

    const [{ data: profileRows }, { data: walletRows }, { data: cashinRows, error }, { data: txRows }] =
      await Promise.all([
        supabase.from("profiles").select("id, full_name, email, wallet_balance, account_status, kyc_status").limit(1000),
        supabase.from("wallets").select("id, profile_id, balance, updated_at"),
        supabase.from("cashin_requests").select("id, profile_id, amount, reference_no, description, status, created_at").order("created_at", { ascending: false }),
        supabase.from("wallet_transactions").select("id, profile_id, transaction_type, amount, description, status, created_at").order("created_at", { ascending: false }).limit(500),
      ]);

    if (error) {
      setMessage(error.message);
      return;
    }

    const safeCashins = (cashinRows || []) as AnyRow[];
    setProfiles((profileRows || []) as AnyRow[]);
    setWallets((walletRows || []) as AnyRow[]);
    setCashins(safeCashins);
    setTransactions((txRows || []) as AnyRow[]);
    setSelected((current) => safeCashins.find((row) => row.id === current?.id) || safeCashins[0] || null);
  }

  function walletFor(profileId?: string) {
    return wallets.find((wallet) => wallet.profile_id === profileId) || null;
  }

  async function approveCashin(row: AnyRow) {
    setBusyId(row.id);
    setMessage("");

    const amount = Number(row.amount || 0);
    if (!row.profile_id || amount <= 0) {
      setMessage("Cash-in request has missing profile or invalid amount.");
      setBusyId("");
      return;
    }

    let wallet = walletFor(row.profile_id);

    if (!wallet) {
      const { data: createdWallet, error: walletCreateError } = await supabase
        .from("wallets")
        .insert({ profile_id: row.profile_id, balance: 0 })
        .select("id, profile_id, balance, updated_at")
        .maybeSingle();

      if (walletCreateError) {
        setMessage(walletCreateError.message);
        setBusyId("");
        return;
      }

      wallet = createdWallet;
    }

    const walletId = wallet?.id;
    if (!walletId) {
      setMessage("Wallet not found.");
      setBusyId("");
      return;
    }

    const newBalance = Number(wallet?.balance || 0) + amount;
    const { error: walletError } = await supabase
      .from("wallets")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("id", walletId);

    if (walletError) {
      setMessage(walletError.message);
      setBusyId("");
      return;
    }

    await supabase.from("profiles").update({ wallet_balance: newBalance }).eq("id", row.profile_id);

    const distribution = calculateDistribution("COPLANTER_PACKAGE", amount);
    const reference = row.reference_no || row.id;
    const ledgerRows = [
      {
        profile_id: row.profile_id,
        transaction_type: "CASH_IN",
        amount,
        description: row.description || `Cash-in approved: ${reference}. Co-planter package distribution ledger recorded for admin settlement.`,
        status: "APPROVED",
      },
      ...distribution.shares.map((share) => ({
        profile_id: row.profile_id,
        transaction_type: "PACKAGE_DISTRIBUTION_LEDGER",
        amount: share.amount,
        description: `${distribution.rule.label} share ${share.percent}% for ${share.recipient}. Settle to ${share.accountProvider} - ${share.accountName} - ${share.accountNumber}. Reference: ${reference}.`,
        status: "APPROVED",
      })),
    ];

    const { error: txError } = await supabase.from("wallet_transactions").insert(ledgerRows);

    if (txError) {
      setMessage(txError.message);
      setBusyId("");
      return;
    }

    const { error: cashinError } = await supabase.from("cashin_requests").update({ status: "APPROVED" }).eq("id", row.id);

    if (cashinError) {
      setMessage(cashinError.message);
      setBusyId("");
      return;
    }

    await supabase.from("notifications").insert({
      profile_id: row.profile_id,
      title: "Cash-in approved",
      message: `Your cash-in request of ${peso(amount)} was approved.`,
      is_read: false,
    });

    setMessage("Cash-in approved, wallet credited, and co-planter package distribution ledger recorded for admin settlement.");
    await loadTreasury();
    setBusyId("");
  }

  async function rejectCashin(row: AnyRow) {
    setBusyId(row.id);
    setMessage("");

    const { error } = await supabase.from("cashin_requests").update({ status: "REJECTED" }).eq("id", row.id);

    if (error) {
      setMessage(error.message);
      setBusyId("");
      return;
    }

    await supabase.from("notifications").insert({
      profile_id: row.profile_id,
      title: "Cash-in rejected",
      message: `Your cash-in request reference ${row.reference_no || row.id} was rejected. Please contact support.`,
      is_read: false,
    });

    setMessage("Cash-in rejected.");
    await loadTreasury();
    setBusyId("");
  }

  const filtered = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return cashins.filter((row) => {
      const profile = getProfile(row.profile_id, profiles);
      const statusOk = filter === "ALL" || String(row.status || "").toUpperCase() === filter;
      const text = `${JSON.stringify(row)} ${profile?.full_name || ""} ${profile?.email || ""}`.toLowerCase();
      return statusOk && (!keyword || text.includes(keyword));
    });
  }, [cashins, profiles, filter, search]);

  const walletTotal = wallets.reduce((sum, row) => sum + Number(row.balance || 0), 0);
  const pendingTotal = cashins.filter((row) => String(row.status || "").toUpperCase() === "PENDING").reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const approvedCashinTotal = cashins.filter((row) => String(row.status || "").toUpperCase() === "APPROVED").reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const selectedProfile = selected ? getProfile(selected.profile_id, profiles) : null;
  const selectedWallet = selected ? walletFor(selected.profile_id) : null;
  const selectedDistribution = selected ? calculateDistribution("COPLANTER_PACKAGE", Number(selected.amount || 0)) : null;

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
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-white lg:text-6xl">
                Treasury Center
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78 lg:text-base">
                Verify real bank or e-wallet payments sent to the owner's approved account, then record wallet credit and automatic SUR/TDI ledger allocation.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button onClick={loadTreasury} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm hover:bg-white/90">
                Refresh
              </button>
              <Link href="/admin/dashboard" className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur hover:bg-white/20">
                Dashboard
              </Link>
            </div>
          </div>

          <div className="relative z-10 mt-8 grid gap-3 md:grid-cols-4">
            <HeroStat label="Wallet Balances" value={peso(walletTotal)} />
            <HeroStat label="Pending Cash-In" value={peso(pendingTotal)} />
            <HeroStat label="Approved Cash-In" value={peso(approvedCashinTotal)} />
            <HeroStat label="Wallet TX" value={String(transactions.length)} />
          </div>

          {message && (
            <div className="relative z-10 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
              {message}
            </div>
          )}

          <div className="relative z-10 mt-5 rounded-2xl border border-white/20 bg-white/15 px-5 py-4 text-sm font-bold leading-7 text-white/82 backdrop-blur">
            This platform is a ledger and approval system. Real funds are sent manually through the owner's confirmed bank or e-wallet account. Once admin verifies payment, the app records wallet credit and the co-planter package split for admin settlement.
          </div>
        </section>

        <section className="grid gap-5 py-5 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Cash-In Requests</h2>
                <p className="mt-1 text-sm text-slate-600">Customer already paid through the real owner bank/e-wallet. Select a request to verify the receipt and record the ledger.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400" />
                <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400">
                  <option value="ALL">All</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {filtered.length === 0 ? (
                <Empty text="No cash-in requests found." />
              ) : (
                filtered.map((row) => {
                  const profile = getProfile(row.profile_id, profiles);
                  return (
                    <button
                      key={row.id}
                      onClick={() => setSelected(row)}
                      className={`w-full rounded-2xl border p-5 text-left transition ${
                        selected?.id === row.id ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:border-emerald-200"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-black text-slate-950">{profileName(profile)}</p>
                          <p className="mt-1 text-sm font-bold text-slate-600">{profile?.email || "-"}</p>
                          <p className="mt-1 text-xs font-bold text-slate-400">Ref: {row.reference_no || "-"}</p>
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

          <section className="space-y-5">
            <div className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
              <h2 className="text-2xl font-black text-slate-950">Cash-In Detail</h2>

              {!selected ? (
                <div className="mt-5"><Empty text="Select cash-in request." /></div>
              ) : (
                <>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <Info label="Co-Planter" value={profileName(selectedProfile)} />
                    <Info label="Email" value={selectedProfile?.email || "-"} />
                    <Info label="Amount" value={peso(selected.amount)} />
                    <Info label="Reference" value={selected.reference_no || "-"} />
                    <Info label="Status" value={selected.status || "PENDING"} />
                  <Info label="Wallet Before" value={peso(selectedWallet?.balance)} />
                  <Info label="Description" value={selected.description || "-"} />
                  <Info label="Created" value={formatDate(selected.created_at)} />
                </div>

                <div className="mt-5 rounded-3xl border border-amber-100 bg-amber-50/80 p-4">
                  <p className="text-sm font-black text-slate-950">Co-Planter Package Distribution</p>
                  <p className="mt-1 text-xs font-bold leading-6 text-slate-600">
                    Approval credits the customer wallet and records the admin settlement split. Real transfers remain manual until gateway split payout is configured.
                  </p>
                  <div className="mt-4 grid gap-3">
                    {selectedDistribution?.shares.map((share) => (
                      <div key={`${share.recipient}-${share.percent}`} className="rounded-2xl border border-amber-100 bg-white p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-slate-950">{share.recipient}</p>
                            <p className="mt-1 text-xs font-bold text-slate-500">
                              {share.accountProvider} - {share.accountName} - {share.accountNumber}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-amber-700">{share.percent}%</p>
                            <p className="mt-1 text-sm font-black text-slate-950">{peso(share.amount)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <button disabled={busyId === selected.id || String(selected.status || "").toUpperCase() === "APPROVED"} onClick={() => approveCashin(selected)} className="rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60">
                      Approve + Credit Wallet
                    </button>
                    <button disabled={busyId === selected.id || String(selected.status || "").toUpperCase() === "APPROVED"} onClick={() => rejectCashin(selected)} className="rounded-2xl bg-red-600 px-6 py-4 text-sm font-black text-white hover:bg-red-700 disabled:opacity-60">
                      Reject Cash-In
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
              <h2 className="text-2xl font-black text-slate-950">Recent Wallet Transactions</h2>
              <div className="mt-5 space-y-3">
                {transactions.length === 0 ? (
                  <Empty text="No transactions yet." />
                ) : (
                  transactions.slice(0, 8).map((tx) => {
                    const profile = getProfile(tx.profile_id, profiles);
                    return (
                      <div key={tx.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-slate-950">{tx.transaction_type}</p>
                            <p className="text-sm font-bold text-slate-500">{profileName(profile)}</p>
                            <p className="text-xs text-slate-500">{tx.description || "-"}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-emerald-700">{peso(tx.amount)}</p>
                            <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClass(tx.status)}`}>
                              {tx.status || "APPROVED"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
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
