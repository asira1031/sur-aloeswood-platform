"use client";

import Link from "next/link";
import { ChangeEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { calculatePlatformFee } from "@/app/lib/finance/fee-distribution";
import { supabase } from "@/app/lib/supabase/client";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  mobile?: string | null;
  address?: string | null;
  account_status?: string | null;
  kyc_status?: string | null;
};

type Wallet = {
  id: string;
  profile_id: string;
  balance: number | null;
  updated_at: string | null;
};

type WalletTransaction = {
  id: string;
  profile_id: string;
  transaction_type: string | null;
  amount: number | null;
  description: string | null;
  status: string | null;
  created_at: string | null;
};

type CashInRequest = {
  id: string;
  profile_id: string;
  amount: number | null;
  reference_no: string | null;
  description?: string | null;
  status: string | null;
  payment_channel?: string | null;
  sender_name?: string | null;
  sender_account?: string | null;
  proof_url?: string | null;
  platform_fee?: number | null;
  net_amount?: number | null;
  approved_at?: string | null;
  created_at: string | null;
};

type WithdrawalRequest = {
  id: string;
  profile_id: string;
  amount: number | null;
  platform_fee: number | null;
  net_amount: number | null;
  payout_method: string | null;
  payout_account_name: string | null;
  payout_account_number: string | null;
  status: string | null;
  request_reference: string | null;
  proof_url: string | null;
  requested_at: string | null;
  settled_at: string | null;
};

const CASHIN_BUCKET = "cashin-proofs";

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

const companyPaymentContact = {
  payee: "Janica Maldives",
  bank: "Maya Wallet / PayMaya",
  accountName: "Janica Maldives",
  accountNumber: "09498387452",
  email: "suraloeswoodcorporation@gmail.com",
};

function isCustomerVisibleTransaction(row: WalletTransaction) {
  return !["PACKAGE_DISTRIBUTION_LEDGER", "PLATFORM_FEE"].includes(normalize(row.transaction_type));
}

export default function InvestorWalletPage() {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [cashInRequests, setCashInRequests] = useState<CashInRequest[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);

  const [cashInAmount, setCashInAmount] = useState("");
  const [cashInReference, setCashInReference] = useState("");
  const [paymentChannel, setPaymentChannel] = useState("Maya");
  const [senderName, setSenderName] = useState("");
  const [senderAccount, setSenderAccount] = useState("");
  const [cashInProof, setCashInProof] = useState<File | null>(null);

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("GCASH");
  const [payoutName, setPayoutName] = useState("");
  const [payoutNumber, setPayoutNumber] = useState("");

  const [loading, setLoading] = useState(false);
  const [submittingCashIn, setSubmittingCashIn] = useState(false);
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState<"success" | "error" | "info">("info");

  useEffect(() => {
    const savedEmail = localStorage.getItem("sur_login_email") || "";
    setEmail(savedEmail);
    if (savedEmail) loadWallet(savedEmail);
  }, []);

  function showNotice(message: string, type: "success" | "error" | "info" = "info") {
    setNotice(message);
    setNoticeType(type);
  }

  function onCashInProofChange(event: ChangeEvent<HTMLInputElement>) {
    setCashInProof(event.target.files?.[0] || null);
  }

  async function loadWallet(targetEmail = email) {
    setLoading(true);
    setNotice("");

    const cleanEmail = targetEmail.toLowerCase().trim();
    if (!cleanEmail) {
      setLoading(false);
      showNotice("Enter your registered email first.", "error");
      return;
    }

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, mobile, address, account_status, kyc_status")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (profileError || !profileRow) {
      setProfile(null);
      setWallet(null);
      setCashInRequests([]);
      setWithdrawalRequests([]);
      setTransactions([]);
      setLoading(false);
      showNotice(profileError?.message || "No co-planter profile found for this email.", "error");
      return;
    }

    localStorage.setItem("sur_login_email", cleanEmail);
    localStorage.setItem("sur_profile_id", profileRow.id);

    let walletRow: Wallet | null = null;
    const { data: foundWallet, error: walletError } = await supabase
      .from("wallets")
      .select("id, profile_id, balance, updated_at")
      .eq("profile_id", profileRow.id)
      .maybeSingle();

    if (walletError) {
      setLoading(false);
      showNotice(walletError.message, "error");
      return;
    }

    if (!foundWallet) {
      const { data: createdWallet, error: createWalletError } = await supabase
        .from("wallets")
        .insert({ profile_id: profileRow.id, balance: 0 })
        .select("id, profile_id, balance, updated_at")
        .single();

      if (createWalletError) {
        setLoading(false);
        showNotice(createWalletError.message, "error");
        return;
      }
      walletRow = createdWallet as Wallet;
    } else {
      walletRow = foundWallet as Wallet;
    }

    const [cashins, withdrawals, tx] = await Promise.all([
      supabase
        .from("cashin_requests")
        .select("id, profile_id, amount, reference_no, description, status, payment_channel, sender_name, sender_account, proof_url, platform_fee, net_amount, approved_at, created_at")
        .eq("profile_id", profileRow.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("withdrawal_requests")
        .select("id, profile_id, amount, platform_fee, net_amount, payout_method, payout_account_name, payout_account_number, status, request_reference, proof_url, requested_at, settled_at")
        .eq("profile_id", profileRow.id)
        .order("requested_at", { ascending: false })
        .limit(100),
      supabase
        .from("wallet_transactions")
        .select("id, profile_id, transaction_type, amount, description, status, created_at")
        .eq("profile_id", profileRow.id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (cashins.error || withdrawals.error || tx.error) {
      setLoading(false);
      showNotice(cashins.error?.message || withdrawals.error?.message || tx.error?.message || "Unable to load wallet data.", "error");
      return;
    }

    setProfile(profileRow as Profile);
    setWallet(walletRow);
    setCashInRequests((cashins.data || []) as CashInRequest[]);
    setWithdrawalRequests((withdrawals.data || []) as WithdrawalRequest[]);
    setTransactions(((tx.data || []) as WalletTransaction[]).filter(isCustomerVisibleTransaction));
    setLoading(false);
  }

  async function uploadCashInProof(profileId: string, file: File) {
    const ext = file.name.split(".").pop() || "jpg";
    const safeRef = cashInReference.trim().replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 48);
    const path = `${profileId}/${Date.now()}-${safeRef || "cashin-proof"}.${ext}`;

    const { error: uploadError } = await supabase.storage.from(CASHIN_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(CASHIN_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  async function submitCashIn() {
    setNotice("");

    if (!profile) {
      showNotice("Load your co-planter profile first.", "error");
      return;
    }

    const amount = Number(cashInAmount);
    const reference = cashInReference.trim();

    if (!amount || amount <= 0) {
      showNotice("Enter a valid cash-in amount.", "error");
      return;
    }

    if (!reference) {
      showNotice("Enter your payment reference number.", "error");
      return;
    }

    if (!senderName.trim() || !senderAccount.trim()) {
      showNotice("Enter sender name and sender account/mobile number.", "error");
      return;
    }

    if (!cashInProof) {
      showNotice("Upload the payment screenshot first.", "error");
      return;
    }

    setSubmittingCashIn(true);

    try {
      const proofUrl = await uploadCashInProof(profile.id, cashInProof);
      const { error } = await supabase.rpc("sur_submit_cashin_request", {
        p_amount: amount,
        p_reference_no: reference,
        p_payment_channel: paymentChannel,
        p_sender_name: senderName.trim(),
        p_sender_account: senderAccount.trim(),
        p_proof_url: proofUrl,
      });

      if (error) throw error;

      setCashInAmount("");
      setCashInReference("");
      setSenderName("");
      setSenderAccount("");
      setCashInProof(null);
      showNotice("Cash-in proof submitted. Admin will verify the real payment before wallet credit.", "success");
      await loadWallet(profile.email || email);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Cash-in submission failed.", "error");
    } finally {
      setSubmittingCashIn(false);
    }
  }

  async function submitWithdraw() {
    setNotice("");

    if (!profile || !wallet) {
      showNotice("Load your wallet first.", "error");
      return;
    }

    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0) {
      showNotice("Enter a valid withdrawal amount.", "error");
      return;
    }

    if (amount > Number(wallet.balance || 0)) {
      showNotice("Insufficient wallet balance.", "error");
      return;
    }

    if (normalize(profile.kyc_status) !== "APPROVED") {
      showNotice("KYC approval is required before withdrawal processing.", "error");
      return;
    }

    if (!payoutName.trim() || !payoutNumber.trim()) {
      showNotice("Enter payout account name and account number/mobile number.", "error");
      return;
    }

    setSubmittingWithdraw(true);

    try {
      const { error } = await supabase.rpc("sur_request_withdrawal", {
        p_amount: amount,
        p_payout_method: payoutMethod,
        p_payout_account_name: payoutName.trim(),
        p_payout_account_number: payoutNumber.trim(),
        p_notes: null,
      });

      if (error) throw error;

      setWithdrawAmount("");
      setPayoutName("");
      setPayoutNumber("");
      showNotice("Withdrawal request submitted. Wallet amount is reserved while admin manually sends payout.", "success");
      await loadWallet(profile.email || email);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Withdrawal request failed.", "error");
    } finally {
      setSubmittingWithdraw(false);
    }
  }

  const pendingCashIn = useMemo(
    () =>
      cashInRequests
        .filter((request) => ["PENDING", "PENDING_VERIFICATION"].includes(normalize(request.status)))
        .reduce((sum, request) => sum + Number(request.amount || 0), 0),
    [cashInRequests]
  );

  const pendingWithdrawal = useMemo(
    () =>
      withdrawalRequests
        .filter((request) => ["PENDING", "PENDING_REVIEW"].includes(normalize(request.status)))
        .reduce((sum, request) => sum + Number(request.amount || 0), 0),
    [withdrawalRequests]
  );

  const walletBalance = Number(wallet?.balance || 0);
  const withdrawQuote = calculatePlatformFee(Number(withdrawAmount || 0));
  const canWithdraw = Boolean(profile && wallet && walletBalance > 0 && normalize(profile.kyc_status) === "APPROVED");

  return (
    <main className="min-h-screen bg-[#f3f7f1] text-slate-950">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-4 lg:px-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/20 p-6 shadow-sm lg:p-8">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/forest-bg.jpg')" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-green-950/90 via-green-900/66 to-green-950/18" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-white/75">Investor Wallet Center</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-white lg:text-6xl">Cash-In and Withdrawals</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78 lg:text-base">
                Submit payment proof, request withdrawals, and track wallet history. Cash-in is credited only after admin verifies the real payment.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button onClick={() => loadWallet()} disabled={loading} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm hover:bg-white/90 disabled:opacity-60">
                {loading ? "Loading..." : "Refresh"}
              </button>
              <Link href="/investor/dashboard" className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur hover:bg-white/20">
                Dashboard
              </Link>
            </div>
          </div>

          <div className="relative z-10 mt-8 grid gap-3 md:grid-cols-4">
            <HeroStat label="Available Balance" value={peso(wallet?.balance)} />
            <HeroStat label="Pending Cash-In" value={peso(pendingCashIn)} />
            <HeroStat label="Pending Withdraw" value={peso(pendingWithdrawal)} />
            <HeroStat label="History" value={`${transactions.length} records`} />
          </div>

          {notice && <div className={`relative z-10 mt-5 rounded-2xl border px-5 py-4 text-sm font-bold ${noticeStyles[noticeType]}`}>{notice}</div>}
        </section>

        <section className="grid gap-5 py-5 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[2rem] border border-teal-100 bg-teal-50/75 p-5 shadow-sm lg:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Official Cash-In Account</h2>
                <p className="mt-1 text-sm text-slate-600">Send real payment here first. Screenshot and reference are required.</p>
              </div>
              <Badge value="OFFICIAL MAYA" />
            </div>
            <div className="mt-5 grid gap-3">
              <Info label="Payee" value={companyPaymentContact.payee} />
              <Info label="Bank / Wallet" value={companyPaymentContact.bank} />
              <Info label="Account Name" value={companyPaymentContact.accountName} />
              <Info label="Account Number" value={companyPaymentContact.accountNumber} />
              <Info label="Email" value={companyPaymentContact.email} />
            </div>
            <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold leading-7 text-amber-900">
              Screenshot alone is not treated as money. Admin will compare your proof against the real Maya/GCash/bank transaction before wallet credit.
            </div>
          </section>

          <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
            <h2 className="text-2xl font-black text-slate-950">Cash-In / Withdraw</h2>
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-slate-950">Cash-In</h3>
                    <p className="mt-1 text-xs font-bold leading-5 text-slate-600">Manual admin verification before wallet credit.</p>
                  </div>
                  <Badge value="MANUAL CHECK" />
                </div>
                <div className="mt-4 grid gap-3">
                  <input type="number" value={cashInAmount} onChange={(event) => setCashInAmount(event.target.value)} placeholder="Amount sent" className="rounded-2xl border border-emerald-100 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400" />
                  <input value={cashInReference} onChange={(event) => setCashInReference(event.target.value)} placeholder="Maya / GCash / bank reference number" className="rounded-2xl border border-emerald-100 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400" />
                  <select value={paymentChannel} onChange={(event) => setPaymentChannel(event.target.value)} className="rounded-2xl border border-emerald-100 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400">
                    <option value="Maya">Maya</option>
                    <option value="GCash">GCash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="InstaPay">InstaPay</option>
                    <option value="Other">Other</option>
                  </select>
                  <input value={senderName} onChange={(event) => setSenderName(event.target.value)} placeholder="Sender name shown on receipt" className="rounded-2xl border border-emerald-100 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400" />
                  <input value={senderAccount} onChange={(event) => setSenderAccount(event.target.value)} placeholder="Sender mobile/account number" className="rounded-2xl border border-emerald-100 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400" />
                  <label className="rounded-2xl border border-dashed border-emerald-300 bg-white px-5 py-4 text-sm font-black text-emerald-900">
                    Payment screenshot / receipt
                    <input type="file" accept="image/*,application/pdf" onChange={onCashInProofChange} className="mt-3 block w-full text-sm font-bold text-slate-700" />
                  </label>
                  <button onClick={submitCashIn} disabled={submittingCashIn || !profile} className="rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60">
                    {submittingCashIn ? "Submitting..." : "Submit Cash-In For Verification"}
                  </button>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-amber-100 bg-amber-50/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-slate-950">Withdraw</h3>
                    <p className="mt-1 text-xs font-bold leading-5 text-slate-600">No saved method. Enter payout details per request.</p>
                  </div>
                  <Badge value={canWithdraw ? "READY" : "CHECK KYC"} />
                </div>
                <div className="mt-4 grid gap-3">
                  <input type="number" value={withdrawAmount} onChange={(event) => setWithdrawAmount(event.target.value)} placeholder="Withdrawal amount" className="rounded-2xl border border-amber-100 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-amber-400" />
                  <select value={payoutMethod} onChange={(event) => setPayoutMethod(event.target.value)} className="rounded-2xl border border-amber-100 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-amber-400">
                    <option value="GCASH">GCash</option>
                    <option value="MAYA">Maya</option>
                    <option value="BANK">Bank Account</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <input value={payoutName} onChange={(event) => setPayoutName(event.target.value)} placeholder="Payout account name" className="rounded-2xl border border-amber-100 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-amber-400" />
                  <input value={payoutNumber} onChange={(event) => setPayoutNumber(event.target.value)} placeholder="Payout account number / mobile" className="rounded-2xl border border-amber-100 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-amber-400" />
                  <FeePreview gross={withdrawQuote.gross} fee={withdrawQuote.fee} net={withdrawQuote.net} />
                  <button onClick={submitWithdraw} disabled={submittingWithdraw || !profile} className="rounded-2xl bg-amber-400 px-6 py-4 text-sm font-black text-amber-950 hover:bg-amber-300 disabled:opacity-60">
                    {submittingWithdraw ? "Submitting..." : "Request Withdraw"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </section>

        <section className="grid gap-5 pb-5 lg:grid-cols-2">
          <HistorySection title="Cash-In Requests" empty="No cash-in requests yet.">
            {cashInRequests.map((request) => (
              <HistoryCard key={request.id} title={request.reference_no || "Cash-in"} amount={peso(request.amount)} status={request.status || "PENDING"} date={request.created_at} description={`${request.payment_channel || "Payment"} from ${request.sender_name || "sender"} ${request.sender_account || ""}`} proofUrl={request.proof_url} />
            ))}
          </HistorySection>

          <HistorySection title="Withdraw Requests" empty="No withdrawal requests yet.">
            {withdrawalRequests.map((request) => (
              <HistoryCard key={request.id} title={request.request_reference || "Withdrawal"} amount={peso(request.amount)} status={request.status || "PENDING"} date={request.requested_at} description={`${request.payout_method || "Payout"} - Net payout ${peso(request.net_amount)}`} proofUrl={request.proof_url} />
            ))}
          </HistorySection>
        </section>

        <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
          <h2 className="text-2xl font-black text-slate-950">Transaction History</h2>
          <div className="mt-5 grid gap-3">
            {transactions.length === 0 ? (
              <Empty text="No wallet activity yet." />
            ) : (
              transactions.map((transaction) => (
                <HistoryCard key={transaction.id} title={transaction.transaction_type || "Wallet transaction"} amount={peso(transaction.amount)} status={transaction.status || "COMPLETED"} date={transaction.created_at} description={transaction.description || "-"} />
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

const noticeStyles = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-red-200 bg-red-50 text-red-900",
  info: "border-amber-200 bg-amber-50 text-amber-900",
};

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/16 p-4 backdrop-blur">
      <p className="text-xs font-black uppercase tracking-wide text-white/65">{label}</p>
      <p className="mt-2 truncate text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function FeePreview({ gross, fee, net }: { gross: number; fee: number; net: number }) {
  return (
    <div className="rounded-2xl border border-amber-100 bg-white/80 p-4 text-amber-950">
      <p className="text-xs font-black uppercase tracking-wide opacity-60">Platform Fee Preview</p>
      <div className="mt-3 grid gap-2 text-sm">
        <div className="flex items-center justify-between gap-3"><span className="font-bold opacity-70">Wallet Deduction</span><span className="font-black">{peso(gross)}</span></div>
        <div className="flex items-center justify-between gap-3"><span className="font-bold opacity-70">Platform Fee to TDI</span><span className="font-black">{peso(fee)}</span></div>
        <div className="flex items-center justify-between gap-3 border-t border-current/10 pt-2"><span className="font-black">Net Payout</span><span className="font-black">{peso(net)}</span></div>
      </div>
    </div>
  );
}

function Badge({ value }: { value: string }) {
  const status = normalize(value);
  const style = status.includes("APPROVED") || status.includes("ACTIVE") || status.includes("READY") || status.includes("COMPLETED")
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : status.includes("REJECTED") || status.includes("FAILED") || status.includes("SUSPENDED")
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-amber-200 bg-amber-50 text-amber-800";

  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${style}`}>{value}</span>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function HistorySection({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
      <h2 className="text-2xl font-black text-slate-950">{title}</h2>
      <div className="mt-5 grid gap-3">{hasItems ? children : <Empty text={empty} />}</div>
    </section>
  );
}

function HistoryCard({ title, amount, status, date, description, proofUrl }: { title: string; amount: string; status: string; date?: string | null; description: string; proofUrl?: string | null }) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-black text-slate-950">{title}</p>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
          <p className="mt-2 text-xs font-bold text-emerald-700">{formatDate(date)}</p>
          {proofUrl && <a href={proofUrl} target="_blank" className="mt-2 inline-flex text-xs font-black text-emerald-700 underline">View proof</a>}
        </div>
        <div className="text-right">
          <p className="text-lg font-black text-slate-950">{amount}</p>
          <Badge value={status} />
        </div>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-5 text-sm font-bold text-slate-500">{text}</div>;
}
