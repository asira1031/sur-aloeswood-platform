"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

type LinkedAccount = {
  id: string;
  profile_id: string;
  account_type: string | null;
  provider_name: string | null;
  account_name: string | null;
  account_number: string | null;
  status: string | null;
  created_at: string | null;
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
  created_at: string | null;
};

const peso = (value: number | null | undefined) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
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
  address: "Sitio Morales, Centrala, Surallah, South Cotabato",
  email: "suraloeswoodcorporation@gmail.com",
  mobile: "09498387452",
};

const customerHiddenTransactionTypes = new Set(["PACKAGE_DISTRIBUTION_LEDGER"]);

function isCustomerVisibleTransaction(row: WalletTransaction) {
  return !customerHiddenTransactionTypes.has(normalize(row.transaction_type));
}

export default function InvestorWalletPage() {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [cashInRequests, setCashInRequests] = useState<CashInRequest[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);

  const [cashInAmount, setCashInAmount] = useState("");
  const [cashInReference, setCashInReference] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [selectedPayoutId, setSelectedPayoutId] = useState("");
  const [payoutType, setPayoutType] = useState("BANK");
  const [payoutProvider, setPayoutProvider] = useState("");
  const [payoutName, setPayoutName] = useState("");
  const [payoutNumber, setPayoutNumber] = useState("");

  const [loading, setLoading] = useState(false);
  const [submittingCashIn, setSubmittingCashIn] = useState(false);
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);
  const [savingPayout, setSavingPayout] = useState(false);

  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState<"success" | "error" | "info">("info");

  useEffect(() => {
    const savedEmail = localStorage.getItem("sur_login_email") || "";
    setEmail(savedEmail);

    if (savedEmail) {
      loadWallet(savedEmail);
    }
  }, []);

  function showNotice(message: string, type: "success" | "error" | "info" = "info") {
    setNotice(message);
    setNoticeType(type);
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

    if (profileError) {
      setLoading(false);
      showNotice(profileError.message, "error");
      return;
    }

    if (!profileRow) {
      setProfile(null);
      setWallet(null);
      setLinkedAccounts([]);
      setCashInRequests([]);
      setTransactions([]);
      setLoading(false);
      showNotice("No co-planter profile found for this email.", "error");
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
        .insert({
          profile_id: profileRow.id,
          balance: 0,
        })
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

    const [
      { data: linkedRows, error: linkedError },
      { data: cashinRows, error: cashinError },
      { data: transactionRows, error: transactionError },
    ] =
      await Promise.all([
        supabase
          .from("linked_accounts")
          .select("id, profile_id, account_type, provider_name, account_name, account_number, status, created_at")
          .eq("profile_id", profileRow.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("cashin_requests")
          .select("id, profile_id, amount, reference_no, description, status, created_at")
          .eq("profile_id", profileRow.id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("wallet_transactions")
          .select("id, profile_id, transaction_type, amount, description, status, created_at")
          .eq("profile_id", profileRow.id)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

    if (linkedError || cashinError || transactionError) {
      setLoading(false);
      showNotice(linkedError?.message || cashinError?.message || transactionError?.message || "Unable to load wallet data.", "error");
      return;
    }

    setProfile(profileRow as Profile);
    setWallet(walletRow);
    setLinkedAccounts((linkedRows || []) as LinkedAccount[]);
    setCashInRequests((cashinRows || []) as CashInRequest[]);
    setTransactions(((transactionRows || []) as WalletTransaction[]).filter(isCustomerVisibleTransaction));
    const firstLinked = (linkedRows?.[0] as LinkedAccount | undefined)?.id || "";
    setSelectedPayoutId((current) => (current && linkedRows?.some((row) => row.id === current) ? current : firstLinked));
    setLoading(false);
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

    setSubmittingCashIn(true);

    const { error } = await supabase.from("cashin_requests").insert({
      profile_id: profile.id,
      amount,
      reference_no: reference,
      description: `Investor cash-in submitted from wallet page. Reference: ${reference}. Full payment is sent to the official Maya receiving wallet; after verification this becomes system money in the app.`,
      status: "PENDING",
    });

    setSubmittingCashIn(false);

    if (error) {
      showNotice(error.message, "error");
      return;
    }

    setCashInAmount("");
    setCashInReference("");
    showNotice(`Cash-in request submitted. Once verified, ${peso(amount)} will be credited to your wallet.`, "success");
    await loadWallet(profile.email || email);
  }

  async function submitWithdraw() {
    setNotice("");

    if (!profile || !wallet) {
      showNotice("Load your wallet first.", "error");
      return;
    }

    const amount = Number(withdrawAmount);
    const feeQuote = calculatePlatformFee(amount);
    const selectedPayout = linkedAccounts.find((account) => account.id === selectedPayoutId);
    const approvedPayout = selectedPayout || linkedAccounts.find((account) => normalize(account.status) === "APPROVED") || linkedAccounts[0];

    if (!amount || amount <= 0) {
      showNotice("Enter a valid withdrawal amount.", "error");
      return;
    }

    if (amount > Number(wallet.balance || 0)) {
      showNotice("Insufficient wallet balance.", "error");
      return;
    }

    if (!approvedPayout) {
      showNotice("Add a payout account in Profile/KYC before requesting a withdrawal.", "error");
      return;
    }

    if (normalize(profile.kyc_status) !== "APPROVED") {
      showNotice("KYC approval is required before withdrawal processing.", "error");
      return;
    }

    setSubmittingWithdraw(true);

    const requestReference = `WD-${Date.now()}`;
    const { error } = await supabase.from("wallet_transactions").insert({
      profile_id: profile.id,
      transaction_type: "WITHDRAW_REQUEST",
      amount,
      description: `Withdrawal request ${requestReference}. Payout: ${
        approvedPayout.provider_name || approvedPayout.account_type || "linked account"
      } ${approvedPayout.account_number || ""}. Gross: ${peso(amount)}. Platform fee: ${peso(feeQuote.fee)}. Net payout: ${peso(feeQuote.net)}.`,
      status: "PENDING",
    });

    setSubmittingWithdraw(false);

    if (error) {
      showNotice(error.message, "error");
      return;
    }

    setWithdrawAmount("");
    showNotice(`Withdrawal request submitted. Net payout after platform fee will be ${peso(feeQuote.net)}.`, "success");
    await loadWallet(profile.email || email);
  }

  async function savePayoutMethod() {
    setNotice("");

    if (!profile) {
      showNotice("Load your wallet first.", "error");
      return;
    }

    if (!payoutProvider.trim() || !payoutName.trim() || !payoutNumber.trim()) {
      showNotice("Complete the withdrawal method details first.", "error");
      return;
    }

    setSavingPayout(true);
    const { data, error } = await supabase.from("linked_accounts").insert({
      profile_id: profile.id,
      account_type: payoutType,
      provider_name: payoutProvider.trim(),
      account_name: payoutName.trim(),
      account_number: payoutNumber.trim(),
      status: "PENDING",
    }).select("id, profile_id, account_type, provider_name, account_name, account_number, status, created_at").single();
    setSavingPayout(false);

    if (error) {
      showNotice(error.message, "error");
      return;
    }

    setPayoutProvider("");
    setPayoutName("");
    setPayoutNumber("");
    if (data?.id) setSelectedPayoutId(data.id);
    showNotice("Withdrawal method saved for admin review.", "success");
    await loadWallet(profile.email || email);
  }

  const pendingCashIn = useMemo(
    () =>
      cashInRequests
        .filter((request) => normalize(request.status) === "PENDING")
        .reduce((sum, request) => sum + Number(request.amount || 0), 0),
    [cashInRequests]
  );

  const latestTransactions = transactions.slice(0, 8);
  const selectedPayout = linkedAccounts.find((account) => account.id === selectedPayoutId) || linkedAccounts[0];
  const walletBalance = Number(wallet?.balance || 0);
  const withdrawQuote = calculatePlatformFee(Number(withdrawAmount || 0));
  const canWithdraw = Boolean(profile && wallet && walletBalance > 0 && normalize(profile.kyc_status) === "APPROVED" && selectedPayout);

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
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-white lg:text-6xl">
                Cash-In and Withdrawals
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78 lg:text-base">
                Record manual bank/e-wallet payments, request withdrawals, choose payout methods, and monitor ledger activity.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => loadWallet()}
                disabled={loading}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm hover:bg-white/90 disabled:opacity-60"
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
              <Link
                href="/investor/dashboard"
                className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur hover:bg-white/20"
              >
                Dashboard
              </Link>
            </div>
          </div>

          <div className="relative z-10 mt-8 grid gap-3 md:grid-cols-3">
            <HeroStat label="Available Balance" value={peso(wallet?.balance)} />
            <HeroStat label="Pending Cash-In" value={peso(pendingCashIn)} />
            <HeroStat label="Transaction History" value={`${transactions.length} records`} />
          </div>

          {notice && (
            <div className={`relative z-10 mt-5 rounded-2xl border px-5 py-4 text-sm font-bold ${noticeStyles[noticeType]}`}>
              {notice}
            </div>
          )}
          <div className="relative z-10 mt-5 rounded-2xl border border-white/20 bg-white/15 px-5 py-4 text-sm font-bold leading-7 text-white/82 backdrop-blur">
            This wallet is a ledger and request center. Send 100% of your payment only to the official Maya receiving wallet below. After admin verifies the receipt, the amount becomes system money in your wallet and finance handles manual distribution internally.
          </div>
        </section>

        <section className="py-5">
          <section className="overflow-hidden rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-emerald-700 via-emerald-600 to-green-500 p-5 text-white shadow-sm lg:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-white/70">SUR Wallet</p>
                <h2 className="mt-3 text-4xl font-black">{peso(walletBalance)}</h2>
                <p className="mt-2 text-sm font-bold text-white/75">Available balance for approved wallet transactions.</p>
              </div>
              <div className="rounded-2xl bg-white/18 px-4 py-3 text-right backdrop-blur">
                <p className="text-xs font-black uppercase tracking-wide text-white/65">Account</p>
                <p className="mt-1 max-w-[180px] truncate text-sm font-black">{profile?.full_name || "Not loaded"}</p>
              </div>
            </div>

            <div className="mt-7 grid grid-cols-3 gap-3">
              <WalletAction label="Cash In" detail="Submit reference" />
              <WalletAction label="Withdraw" detail={canWithdraw ? "Ready" : "Needs KYC"} />
              <WalletAction label="History" detail={`${transactions.length + cashInRequests.length} records`} />
            </div>

            <div className="mt-6 rounded-3xl border border-white/20 bg-white/14 p-4 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-white/65">Pending Cash-In</p>
                  <p className="mt-1 text-2xl font-black">{peso(pendingCashIn)}</p>
                </div>
                <Badge value={loading ? "SYNCING" : "LIVE"} />
              </div>
            </div>
          </section>
        </section>

        <section className="grid gap-5 pb-5 lg:grid-cols-[0.92fr_1.08fr]">
          <section className="rounded-[2rem] border border-teal-100 bg-teal-50/75 p-5 shadow-sm lg:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Official Cash-In Account</h2>
                <p className="mt-1 text-sm text-slate-600">Send the payment first, then submit the amount and reference number on the right.</p>
              </div>
              <Badge value="OFFICIAL MAYA" />
            </div>
            <div className="mt-5 grid gap-3">
              <Info label="Payee" value={companyPaymentContact.payee} />
              <Info label="Bank" value={companyPaymentContact.bank} />
              <Info label="Account Name" value={companyPaymentContact.accountName} />
              <Info label="Account Number" value={companyPaymentContact.accountNumber} />
              <Info label="Email" value={companyPaymentContact.email} />
            </div>
            <div className="mt-4 grid gap-3">
              <FlowStep title="1. Send Payment" text="Use the official Maya wallet shown here. Send the full amount and keep the receipt or InstaPay/Maya reference." />
              <FlowStep title="2. Submit Reference" text="Enter the exact amount sent and the payment reference number for admin verification." />
              <FlowStep title="3. Wait For Approval" text="Treasury verifies the receipt, credits your full wallet amount, and records the internal finance allocation for manual settlement." />
            </div>
          </section>

          <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Cash-In / Withdraw</h2>
                <p className="mt-1 text-sm text-slate-600">Submit payments and payout requests from one wallet action center.</p>
              </div>
              <Badge value="WALLET ACTIONS" />
            </div>
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-slate-950">Cash-In</h3>
                    <p className="mt-1 text-xs font-bold leading-5 text-slate-600">Use after sending payment to the official account.</p>
                  </div>
                  <Badge value="TREASURY REVIEW" />
                </div>
                <div className="mt-4 grid gap-3">
                  <input
                    type="number"
                    value={cashInAmount}
                    onChange={(event) => setCashInAmount(event.target.value)}
                    placeholder="Amount sent"
                    className="rounded-2xl border border-emerald-100 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
                  />
                  <input
                    value={cashInReference}
                    onChange={(event) => setCashInReference(event.target.value)}
                    placeholder="Maya / InstaPay receipt reference number"
                    className="rounded-2xl border border-emerald-100 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
                  />
                  <div className="rounded-2xl border border-emerald-100 bg-white/80 p-4 text-emerald-950">
                    <p className="text-xs font-black uppercase tracking-wide opacity-60">Cash-In Credit Preview</p>
                    <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                      <span className="font-bold opacity-70">Wallet Credit After Verification</span>
                      <span className="font-black">{peso(Number(cashInAmount || 0))}</span>
                    </div>
                    <p className="mt-2 text-xs font-bold leading-5 opacity-70">
                      Distribution to SUR/TDI/partners is an internal finance settlement after payment verification.
                    </p>
                  </div>
                  <button
                    onClick={submitCashIn}
                    disabled={submittingCashIn || !profile}
                    className="rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {submittingCashIn ? "Submitting..." : "Submit Cash-In"}
                  </button>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-amber-100 bg-amber-50/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-slate-950">Withdraw</h3>
                    <p className="mt-1 text-xs font-bold leading-5 text-slate-600">Choose a saved payout method or save one here.</p>
                  </div>
                  <Badge value={canWithdraw ? "READY" : "CHECK KYC"} />
                </div>
                <div className="mt-4 grid gap-3">
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(event) => setWithdrawAmount(event.target.value)}
                    placeholder="Withdrawal amount"
                    className="rounded-2xl border border-amber-100 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-amber-400"
                  />
                  {linkedAccounts.length > 0 && (
                    <select
                      value={selectedPayoutId}
                      onChange={(event) => setSelectedPayoutId(event.target.value)}
                      className="rounded-2xl border border-amber-100 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-amber-400"
                    >
                      {linkedAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.provider_name || account.account_type || "Payout"} - {account.account_number || "No account number"} ({account.status || "PENDING"})
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="grid gap-3 md:grid-cols-2">
                    <select
                      value={payoutType}
                      onChange={(event) => setPayoutType(event.target.value)}
                      className="rounded-2xl border border-amber-100 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-amber-400"
                    >
                      <option value="BANK">Bank Account</option>
                      <option value="GCASH">GCash</option>
                      <option value="MAYA">Maya</option>
                      <option value="OTHER">Other</option>
                    </select>
                    <input
                      value={payoutProvider}
                      onChange={(event) => setPayoutProvider(event.target.value)}
                      placeholder="Bank / provider"
                      className="rounded-2xl border border-amber-100 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-amber-400"
                    />
                  </div>
                  <input
                    value={payoutName}
                    onChange={(event) => setPayoutName(event.target.value)}
                    placeholder="Account name"
                    className="rounded-2xl border border-amber-100 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-amber-400"
                  />
                  <input
                    value={payoutNumber}
                    onChange={(event) => setPayoutNumber(event.target.value)}
                    placeholder="Account number / mobile number"
                    className="rounded-2xl border border-amber-100 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-amber-400"
                  />
                  <FeePreview
                    tone="amber"
                    grossLabel="Wallet Deduction"
                    netLabel="Net Payout"
                    gross={withdrawQuote.gross}
                    fee={withdrawQuote.fee}
                    net={withdrawQuote.net}
                  />
                  <div className="grid gap-3 md:grid-cols-2">
                    <button
                      onClick={savePayoutMethod}
                      disabled={savingPayout || !profile}
                      className="rounded-2xl border border-amber-200 bg-white px-6 py-4 text-sm font-black text-amber-950 hover:bg-amber-100 disabled:opacity-60"
                    >
                      {savingPayout ? "Saving..." : "Save Method"}
                    </button>
                    <button
                      onClick={submitWithdraw}
                      disabled={submittingWithdraw || !profile}
                      className="rounded-2xl bg-amber-400 px-6 py-4 text-sm font-black text-amber-950 hover:bg-amber-300 disabled:opacity-60"
                    >
                      {submittingWithdraw ? "Submitting..." : "Request Withdraw"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </section>

        <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
          <h2 className="text-2xl font-black text-slate-950">Transaction History</h2>
          <div className="mt-5 grid gap-3">
            {latestTransactions.length === 0 ? (
              <Empty text="No wallet activity yet." />
            ) : (
              latestTransactions.map((transaction) => (
                <div key={transaction.id} className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{transaction.transaction_type || "Wallet transaction"}</p>
                      <p className="mt-1 text-sm text-slate-600">{transaction.description || "-"}</p>
                      <p className="mt-2 text-xs font-bold text-emerald-700">{formatDate(transaction.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-slate-950">{peso(transaction.amount)}</p>
                      <Badge value={transaction.status || "COMPLETED"} />
                    </div>
                  </div>
                </div>
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

function WalletAction({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/14 p-4 backdrop-blur">
      <p className="text-sm font-black text-white">{label}</p>
      <p className="mt-1 truncate text-xs font-bold text-white/65">{detail}</p>
    </div>
  );
}

function FlowStep({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white bg-white/75 p-4">
      <p className="text-sm font-black text-slate-950">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

function FeePreview({
  tone,
  grossLabel,
  netLabel,
  gross,
  fee,
  net,
}: {
  tone: "emerald" | "amber";
  grossLabel: string;
  netLabel: string;
  gross: number;
  fee: number;
  net: number;
}) {
  const style =
    tone === "emerald"
      ? "border-emerald-100 bg-white/80 text-emerald-950"
      : "border-amber-100 bg-white/80 text-amber-950";

  return (
    <div className={`rounded-2xl border p-4 ${style}`}>
      <p className="text-xs font-black uppercase tracking-wide opacity-60">Platform Fee Preview</p>
      <div className="mt-3 grid gap-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="font-bold opacity-70">{grossLabel}</span>
          <span className="font-black">{peso(gross)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="font-bold opacity-70">Platform Fee to TDI</span>
          <span className="font-black">{peso(fee)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-current/10 pt-2">
          <span className="font-black">{netLabel}</span>
          <span className="font-black">{peso(net)}</span>
        </div>
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
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-5 text-sm font-bold text-slate-500">
      {text}
    </div>
  );
}
