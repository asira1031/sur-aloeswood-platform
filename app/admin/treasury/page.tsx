"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { formatDate, getProfile, peso, profileName, statusClass, type AnyRow } from "@/app/lib/admin/approvals";

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
    setSelected(safeCashins[0] || null);
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
        .insert({
          profile_id: row.profile_id,
          balance: 0,
        })
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
  .update({
    balance: newBalance,
    updated_at: new Date().toISOString(),
  })
  .eq("id", walletId);

    if (walletError) {
      setMessage(walletError.message);
      setBusyId("");
      return;
    }

    await supabase
      .from("profiles")
      .update({
        wallet_balance: newBalance,
      })
      .eq("id", row.profile_id);

    const { error: txError } = await supabase.from("wallet_transactions").insert({
      profile_id: row.profile_id,
      transaction_type: "CASH_IN",
      amount,
      description: row.description || `Cash-in approved: ${row.reference_no || row.id}`,
      status: "APPROVED",
    });

    if (txError) {
      setMessage(txError.message);
      setBusyId("");
      return;
    }

    const { error: cashinError } = await supabase
      .from("cashin_requests")
      .update({
        status: "APPROVED",
      })
      .eq("id", row.id);

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

    setMessage("Cash-in approved and wallet credited.");
    await loadTreasury();
    setBusyId("");
  }

  async function rejectCashin(row: AnyRow) {
    setBusyId(row.id);
    setMessage("");

    const { error } = await supabase
      .from("cashin_requests")
      .update({
        status: "REJECTED",
      })
      .eq("id", row.id);

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

  return (
    <main className="min-h-screen bg-[#04140d] text-white">
      <section className="border-b border-white/10 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-green-300">SUR ALOESWOOD ADMIN</p>
              <h1 className="mt-4 text-4xl font-black md:text-6xl">Treasury Center</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-green-50/80">
                Approve co-planter cash-in requests, credit wallets, and monitor wallet transactions.
              </p>
            </div>

            <button onClick={loadTreasury} className="rounded-2xl bg-green-500 px-5 py-3 text-sm font-black text-green-950">
              Refresh
            </button>
          </div>

          {message && <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-8 md:grid-cols-4 md:px-10">
        <Metric title="Wallet Balances" value={peso(walletTotal)} />
        <Metric title="Pending Cash-In" value={peso(pendingTotal)} />
        <Metric title="Approved Cash-In" value={peso(approvedCashinTotal)} />
        <Metric title="Wallet TX" value={String(transactions.length)} />
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-16 md:px-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-3xl font-black">Cash-In Requests</h2>
            <div className="flex flex-wrap gap-3">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none" />
              <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none">
                <option value="ALL">All</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/25 p-6 text-sm font-bold text-white/60">No cash-in requests found.</div>
            ) : filtered.map((row) => {
              const profile = getProfile(row.profile_id, profiles);

              return (
                <button key={row.id} onClick={() => setSelected(row)} className={`w-full rounded-2xl border p-5 text-left ${selected?.id === row.id ? "border-green-300 bg-green-400/15" : "border-white/10 bg-black/25"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black text-green-200">{profileName(profile)}</p>
                      <p className="mt-1 text-sm text-white/60">{profile?.email || "-"}</p>
                      <p className="mt-1 text-xs text-white/45">Ref: {row.reference_no || "-"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-green-300">{peso(row.amount)}</p>
                      <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClass(row.status)}`}>{row.status || "PENDING"}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
            <h2 className="text-3xl font-black">Cash-In Detail</h2>

            {!selected ? (
              <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-black/25 p-6 text-sm font-bold text-white/60">Select cash-in request.</div>
            ) : (
              <>
                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  <Info label="Co-Planter" value={profileName(selectedProfile)} />
                  <Info label="Email" value={selectedProfile?.email || "-"} />
                  <Info label="Amount" value={peso(selected.amount)} />
                  <Info label="Reference" value={selected.reference_no || "-"} />
                  <Info label="Status" value={selected.status || "PENDING"} />
                  <Info label="Wallet Before" value={peso(selectedWallet?.balance)} />
                  <Info label="Description" value={selected.description || "-"} />
                  <Info label="Created" value={formatDate(selected.created_at)} />
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  <button disabled={busyId === selected.id || String(selected.status || "").toUpperCase() === "APPROVED"} onClick={() => approveCashin(selected)} className="rounded-2xl bg-green-500 px-6 py-4 text-sm font-black text-green-950 disabled:bg-slate-500">
                    Approve + Credit Wallet
                  </button>
                  <button disabled={busyId === selected.id || String(selected.status || "").toUpperCase() === "APPROVED"} onClick={() => rejectCashin(selected)} className="rounded-2xl bg-red-500 px-6 py-4 text-sm font-black text-white disabled:bg-slate-500">
                    Reject Cash-In
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
            <h2 className="text-3xl font-black">Recent Wallet Transactions</h2>
            <div className="mt-5 space-y-3">
              {transactions.slice(0, 8).map((tx) => {
                const profile = getProfile(tx.profile_id, profiles);
                return (
                  <div key={tx.id} className="rounded-2xl bg-black/25 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-green-200">{tx.transaction_type}</p>
                        <p className="text-sm text-white/60">{profileName(profile)}</p>
                        <p className="text-xs text-white/45">{tx.description || "-"}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-green-300">{peso(tx.amount)}</p>
                        <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClass(tx.status)}`}>{tx.status || "APPROVED"}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {transactions.length === 0 && <div className="rounded-2xl border border-dashed border-white/10 bg-black/25 p-6 text-sm font-bold text-white/60">No transactions yet.</div>}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl">
      <p className="text-xs font-black uppercase tracking-wide text-green-100/60">{title}</p>
      <p className="mt-3 truncate text-2xl font-black text-green-300">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/25 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-white/45">{label}</p>
      <p className="mt-2 break-words text-sm font-black text-white">{value}</p>
    </div>
  );
}
