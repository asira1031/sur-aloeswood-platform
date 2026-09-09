"use client";

import Link from "next/link";
import WithdrawalReceipt from "@/app/components/WithdrawalReceipt";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { getAuthenticatedProfile, type SurProfile } from "@/app/lib/auth/session";
import { calculatePlatformFee } from "@/app/lib/finance/fee-distribution";
import { supabase } from "@/app/lib/supabase/client";

type Wallet = { id: string; profile_id: string; balance: number | null; updated_at: string | null };
type Withdrawal = {
  id: string; amount: number | null; platform_fee: number | null; net_amount: number | null;
  payout_method: string | null; payout_account_number: string | null; status: string | null;
  request_reference: string | null; requested_at: string | null; proof_url: string | null; receipt_url: string | null;
};
type Transaction = {
  id: string; transaction_type: string | null; amount: number | null;
  description: string | null; status: string | null; created_at: string | null;
};
type HistoryItem = { id: string; title: string; detail: string; amount: number; status: string; date: string | null; kind: "credit" | "debit" };

const peso = (value: number | null | undefined) => `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDate = (value: string | null) => value ? new Date(value).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—";
const normalize = (value: string | null | undefined) => String(value || "").toUpperCase();

export default function WalletPage() {
  const [profile, setProfile] = useState<SurProfile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("MAYA");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  async function load() {
    setLoading(true);
    const activeProfile = await getAuthenticatedProfile();
    if (!activeProfile) { setNotice({ text: "Please sign in again.", error: true }); setLoading(false); return; }
    setProfile(activeProfile);
    setAccountName((current) => current || activeProfile.full_name || "");

    const [walletResult, withdrawalResult, transactionResult] = await Promise.all([
      supabase.from("wallets").select("id,profile_id,balance,updated_at").eq("profile_id", activeProfile.id).maybeSingle(),
      supabase.from("withdrawal_requests").select("id,amount,platform_fee,net_amount,payout_method,payout_account_number,status,request_reference,requested_at,proof_url,receipt_url").eq("profile_id", activeProfile.id).order("requested_at", { ascending: false }).limit(100),
      supabase.from("wallet_transactions").select("id,transaction_type,amount,description,status,created_at").eq("profile_id", activeProfile.id).order("created_at", { ascending: false }).limit(100),
    ]);
    if (walletResult.error || withdrawalResult.error || transactionResult.error) {
      setNotice({ text: walletResult.error?.message || withdrawalResult.error?.message || transactionResult.error?.message || "Wallet is temporarily unavailable.", error: true });
    } else {
      setWallet(walletResult.data as Wallet | null);
      setWithdrawals((withdrawalResult.data || []) as Withdrawal[]);
      setTransactions(((transactionResult.data || []) as Transaction[]).filter((row) => !["PACKAGE_DISTRIBUTION_LEDGER", "PLATFORM_FEE"].includes(normalize(row.transaction_type))));
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function submitWithdrawal() {
    if(submitting)return;
    setNotice(null);
    const requested = Number(amount);
    if (!profile || !wallet) return setNotice({ text: "Your wallet is not ready yet.", error: true });
    if (!Number.isFinite(requested) || requested < 100) return setNotice({ text: "Minimum withdrawal is ₱100.", error: true });
    if (requested > 50000) return setNotice({ text: "Maximum withdrawal is ₱50,000 per request.", error: true });
    if (requested > Number(wallet.balance || 0)) return setNotice({ text: "Your balance is not enough for this withdrawal.", error: true });
    if (normalize(profile.kyc_status) !== "APPROVED") return setNotice({ text: "KYC approval is required before withdrawal.", error: true });
    if (!accountName.trim() || !accountNumber.trim()) return setNotice({ text: "Complete your payout name and account number.", error: true });
    setSubmitting(true);
    try {
    const { error } = await supabase.rpc("sur_request_withdrawal", {
      p_amount: requested, p_payout_method: method,
      p_payout_account_name: accountName.trim(), p_payout_account_number: accountNumber.trim(), p_notes: null,
    });
    if (error) setNotice({ text: error.code === "PGRST202" ? "Withdrawals are temporarily unavailable. Please contact Support; no request was confirmed." : error.message, error: true });
    else {
      setAmount(""); setAccountNumber("");
      setNotice({ text: "Withdrawal submitted. Admin will process your payout.", error: false });
      await load();
    }
    } catch {
      setNotice({ text: "Connection interrupted. Refresh transaction history before retrying to avoid a duplicate request.", error: true });
    } finally {
      setSubmitting(false);
    }
  }

  const quote = calculatePlatformFee(Number(amount || 0));
  const exceedsWithdrawalLimit = Number(amount || 0) > 50000;
  const history = useMemo<HistoryItem[]>(() => [
    ...withdrawals.map((row) => ({ id: `w-${row.id}`, title: "Withdrawal", detail: `${row.payout_method || "Payout"} • ${row.request_reference || row.payout_account_number || "Request"}`, amount: Number(row.amount || 0), status: row.status || "PENDING", date: row.requested_at, kind: "debit" as const })),
    ...transactions.map((row) => ({ id: `t-${row.id}`, title: friendlyType(row.transaction_type), detail: row.description || "Wallet transaction", amount: Number(row.amount || 0), status: row.status || "COMPLETED", date: row.created_at, kind: Number(row.amount || 0) < 0 ? "debit" as const : "credit" as const })),
  ].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()), [withdrawals, transactions]);

  return (
    <main className="min-h-screen bg-[#f5f1e7] bg-cover bg-fixed bg-center px-4 py-5 text-[#082e25] sm:px-6 lg:py-8" style={{ backgroundImage: "url('/sur-bg-app-light-v1.png')" }}>
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-5 flex items-center justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[.24em] text-[#08745b]">My account</p><h1 className="mt-1 text-3xl font-black sm:text-4xl">Wallet</h1></div>
          <Link href="/investor/my-trees" className="rounded-full border border-[#d8d2c3] bg-white px-4 py-2.5 text-sm font-black shadow-sm">← My Trees</Link>
        </header>

        {notice && <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-bold ${notice.error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{notice.text}</div>}

        <section className="grid gap-5 lg:grid-cols-[.82fr_1.18fr]">
          <div className="relative min-h-[245px] overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0a5946] via-[#073d30] to-[#03251e] p-6 text-white shadow-xl shadow-[#073d30]/15 sm:p-8">
            <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full border-[35px] border-white/[.045]" />
            <div className="absolute -bottom-28 -left-16 h-64 w-64 rounded-full border-[42px] border-[#d9a93e]/10" />
            <div className="relative flex h-full min-h-[185px] flex-col justify-between">
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-[10px] font-black uppercase tracking-[.26em] text-emerald-200">SUR Aloeswood</p><p className="mt-1 text-xs font-bold text-white/60">Member Wallet</p></div>
                <div className="h-8 w-11 rounded-lg bg-gradient-to-br from-[#f6d479] to-[#bb8120] shadow-inner"><div className="mx-auto h-full w-px bg-black/15" /></div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[.18em] text-white/55">Available balance</p>
                <p className="mt-2 break-words text-4xl font-black tracking-tight sm:text-5xl">{loading ? "—" : peso(wallet?.balance)}</p>
              </div>
              <div className="flex items-end justify-between gap-4"><p className="max-w-[70%] truncate text-xs font-black uppercase tracking-[.16em] text-white/75">{profile?.full_name || "SUR Member"}</p><span className="text-lg font-black italic text-[#e1b750]">SUR</span></div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-[#e1dccf] bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-2xl font-black">Withdraw funds</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Amount"><input type="number" min="1" max="50000" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="₱0.00" className="input" /></Field>
              <Field label="Payout method"><select value={method} onChange={(e) => setMethod(e.target.value)} className="input"><option value="MAYA">Maya</option><option value="GCASH">GCash</option><option value="BANK">Bank account</option></select></Field>
              <Field label="Account name"><input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Legal account name" className="input" /></Field>
              <Field label="Account / mobile number"><input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Enter payout number" className="input" /></Field>
            </div>
            {exceedsWithdrawalLimit && <div role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700">Maximum withdrawal is ₱50,000 per request.</div>}
            <div className="mt-4 grid grid-cols-3 rounded-2xl bg-[#f6f4ed] p-4 text-center">
              <Quote label="Withdraw" value={peso(quote.gross)} /><Quote label="Fee" value={peso(quote.fee)} /><Quote label="You receive" value={peso(quote.net)} strong />
            </div>
            <button onClick={submitWithdrawal} disabled={submitting || loading || exceedsWithdrawalLimit} className="mt-5 w-full rounded-2xl bg-[#dda93e] px-5 py-4 font-black text-[#1f1a0b] transition hover:bg-[#e8b94f] disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Submitting…" : "Submit withdrawal"}</button>
          </div>
        </section>

        {withdrawals.some(row => row.proof_url || row.receipt_url) && <section className="mt-5 rounded-2xl bg-white p-5"><h2 className="font-bold">Payout receipts</h2>{withdrawals.filter(row => row.proof_url || row.receipt_url).map(row => <div key={row.id} className="border-b py-3"><p>{row.request_reference} · {peso(row.amount)}</p><WithdrawalReceipt value={row.proof_url || row.receipt_url || ""} /></div>)}</section>}
        <section className="mt-5 rounded-[2rem] border border-[#e1dccf] bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-end justify-between"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#08745b]">Activity</p><h2 className="mt-1 text-2xl font-black">Transaction history</h2></div><button onClick={() => void load()} className="text-sm font-black text-[#08745b]">Refresh</button></div>
          <div className="mt-5 divide-y divide-[#ece8dd]">
            {!history.length ? <p className="py-10 text-center text-sm font-bold text-[#76847f]">No transactions yet.</p> : history.map((item) => <div key={item.id} className="flex items-center justify-between gap-4 py-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-black">{item.title}</p><Status value={item.status} /></div><p className="mt-1 truncate text-sm text-[#6b7b76]">{item.detail}</p><p className="mt-1 text-xs font-bold text-[#8a9792]">{formatDate(item.date)}</p></div><p className={`shrink-0 font-black ${item.kind === "credit" ? "text-[#08745b]" : "text-[#263c35]"}`}>{item.kind === "credit" && item.amount > 0 ? "+" : ""}{peso(Math.abs(item.amount))}</p></div>)}
          </div>
        </section>
      </div>
      <style jsx>{`.input{width:100%;border:1px solid #ded9cd;border-radius:1rem;background:#faf9f5;padding:.9rem 1rem;font-size:.9rem;font-weight:700;outline:none}.input:focus{border-color:#08745b;box-shadow:0 0 0 3px rgba(8,116,91,.1)}`}</style>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="grid gap-2 text-xs font-black uppercase tracking-[.12em] text-[#526962]"><span>{label}</span>{children}</label>; }
function Quote({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className="px-1"><p className="text-[10px] font-black uppercase tracking-wide text-[#78847f]">{label}</p><p className={`mt-1 text-sm sm:text-base ${strong ? "font-black text-[#08745b]" : "font-bold"}`}>{value}</p></div>; }
function Status({ value }: { value: string }) { const ready = ["APPROVED", "COMPLETED", "SETTLED", "PAID"].includes(normalize(value)); return <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wide ${ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{value.replaceAll("_", " ")}</span>; }
function friendlyType(value: string | null) { return String(value || "Transaction").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); }
