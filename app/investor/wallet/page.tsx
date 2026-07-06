"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { peso, platformMoneyNotice } from "@/app/lib/business/rules";

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

type CashinRequest = {
  id: string;
  profile_id: string;
  amount: number | null;
  reference_no: string | null;
  description: string | null;
  status: string | null;
  created_at: string | null;
};

const normalize = (value?: string | null) => String(value || "").toUpperCase();

function badgeClass(status?: string | null) {
  const value = normalize(status);

  if (["ACTIVE", "APPROVED", "PAID", "COMPLETED", "SUCCESS"].includes(value)) {
    return "border-green-300/30 bg-green-400/15 text-green-100";
  }

  if (["REJECTED", "FAILED", "CANCELLED", "SUSPENDED"].includes(value)) {
    return "border-red-300/30 bg-red-400/15 text-red-100";
  }

  return "border-yellow-300/30 bg-yellow-400/15 text-yellow-100";
}

export default function InvestorWalletPage() {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [cashinRequests, setCashinRequests] = useState<CashinRequest[]>([]);

  const [cashInAmount, setCashInAmount] = useState("");
  const [cashInReference, setCashInReference] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const [loading, setLoading] = useState(false);
  const [submittingCashIn, setSubmittingCashIn] = useState(false);
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);

  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState<"success" | "error" | "info">("info");

  const pendingCashIn = useMemo(() => {
    return cashinRequests
      .filter((request) => normalize(request.status) === "PENDING")
      .reduce((sum, request) => sum + Number(request.amount || 0), 0);
  }, [cashinRequests]);

  const pendingWithdraw = useMemo(() => {
    return transactions
      .filter(
        (tx) =>
          normalize(tx.transaction_type) === "WITHDRAW_REQUEST" &&
          normalize(tx.status) === "PENDING"
      )
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  }, [transactions]);

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
      setTransactions([]);
      setCashinRequests([]);
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

    const { data: linkedRows, error: linkedError } = await supabase
      .from("linked_accounts")
      .select("id, profile_id, account_type, provider_name, account_name, account_number, status, created_at")
      .eq("profile_id", profileRow.id)
      .order("created_at", { ascending: false });

    if (linkedError) {
      setLoading(false);
      showNotice(linkedError.message, "error");
      return;
    }

    const { data: transactionRows, error: transactionError } = await supabase
      .from("wallet_transactions")
      .select("id, profile_id, transaction_type, amount, description, status, created_at")
      .eq("profile_id", profileRow.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (transactionError) {
      setLoading(false);
      showNotice(transactionError.message, "error");
      return;
    }

    const { data: cashinRows, error: cashinError } = await supabase
      .from("cashin_requests")
      .select("id, profile_id, amount, reference_no, description, status, created_at")
      .eq("profile_id", profileRow.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (cashinError) {
      setLoading(false);
      showNotice(cashinError.message, "error");
      return;
    }

    setProfile(profileRow as Profile);
    setWallet(walletRow);
    setLinkedAccounts((linkedRows || []) as LinkedAccount[]);
    setTransactions((transactionRows || []) as WalletTransaction[]);
    setCashinRequests((cashinRows || []) as CashinRequest[]);
    setLoading(false);
  }

  async function submitCashIn() {
    setNotice("");

    if (!profile) {
      showNotice("Load your co-planter profile first.", "error");
      return;
    }

    const amount = Number(cashInAmount);

    if (!amount || amount <= 0) {
      showNotice("Enter a valid cash-in amount.", "error");
      return;
    }

    if (!cashInReference.trim()) {
      showNotice("Enter your payment reference number.", "error");
      return;
    }

    setSubmittingCashIn(true);

    const referenceNo = cashInReference.trim();

    const { error } = await supabase.from("cashin_requests").insert({
      profile_id: profile.id,
      amount,
      reference_no: referenceNo,
      description: `Cash-in submitted by co-planter. Admin treasury must verify the buyer-side payment reference before crediting the platform ledger.`,
      status: "PENDING",
    });

    setSubmittingCashIn(false);

    if (error) {
      showNotice(error.message, "error");
      return;
    }

    setCashInAmount("");
    setCashInReference("");
    showNotice("Cash-in request submitted. Admin treasury will verify it.", "success");
    await loadWallet(profile.email || email);
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

    if (linkedAccounts.length === 0) {
      showNotice("No linked payout account found.", "error");
      return;
    }

    setSubmittingWithdraw(true);

    const payout = linkedAccounts[0];

    const { error } = await supabase.from("wallet_transactions").insert({
      profile_id: profile.id,
      transaction_type: "WITHDRAW_REQUEST",
      amount,
      description: `Withdrawal request submitted. Preferred payout: ${
        payout.provider_name || payout.account_type || "linked account"
      } ${payout.account_number || ""}. Reference: WD-${Date.now()}`,
      status: "PENDING",
    });

    setSubmittingWithdraw(false);

    if (error) {
      showNotice(error.message, "error");
      return;
    }

    setWithdrawAmount("");
    showNotice("Withdrawal request submitted. Admin treasury will process it.", "success");
    await loadWallet(profile.email || email);
  }

  return (
    <main className="min-h-screen bg-[#04140d] text-white">
      <section className="border-b border-white/10 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-green-300">
                SUR ALOESWOOD CO-PLANTER
              </p>
              <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">
                Wallet Center
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-green-50/80 md:text-base">
                Load your platform ledger, submit cash-in records, request withdrawals, review payout
                accounts, and monitor wallet transaction activity.
              </p>
              <p className="mt-3 max-w-3xl text-xs leading-6 text-yellow-100/75">{platformMoneyNotice}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/investor/dashboard" className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black hover:bg-white/15">
                Dashboard
              </Link>
              <Link href="/investor/marketplace" className="rounded-2xl bg-green-500 px-5 py-3 text-sm font-black text-green-950 hover:bg-green-400">
                Buy Seedlings
              </Link>
              <Link href="/tree" className="rounded-2xl border border-yellow-300/30 bg-yellow-400/10 px-5 py-3 text-sm font-black text-yellow-100 hover:bg-yellow-400/20">
                My Trees
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-3 rounded-3xl border border-white/10 bg-white/10 p-4 md:grid-cols-[1fr_auto]">
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Registered email"
              className="w-full rounded-2xl border border-white/10 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none"
            />
            <button
              onClick={() => loadWallet()}
              disabled={loading}
              className="rounded-2xl bg-green-500 px-8 py-4 text-sm font-black text-green-950 hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-slate-500"
            >
              {loading ? "Loading..." : "Load Wallet"}
            </button>
          </div>

          {notice && (
            <div
              className={`mt-4 rounded-2xl border px-5 py-4 text-sm font-bold ${
                noticeType === "success"
                  ? "border-green-300/30 bg-green-400/15 text-green-100"
                  : noticeType === "error"
                  ? "border-red-300/30 bg-red-400/15 text-red-100"
                  : "border-yellow-300/30 bg-yellow-400/15 text-yellow-100"
              }`}
            >
              {notice}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-8 md:grid-cols-2 md:px-10 xl:grid-cols-4">
        <Metric title="Available Balance" value={peso(wallet?.balance)} />
        <Metric title="Pending Cash-In" value={peso(pendingCashIn)} />
        <Metric title="Pending Withdraw" value={peso(pendingWithdraw)} />
        <Metric title="Linked Accounts" value={String(linkedAccounts.length)} />
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-8 md:px-10 lg:grid-cols-[1fr_0.85fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Co-Planter Account</h2>
          <div className="mt-6 grid gap-3">
            <InfoRow label="Name" value={profile?.full_name || "Not loaded"} />
            <InfoRow label="Email" value={profile?.email || "Not loaded"} />
            <InfoRow label="Mobile" value={profile?.mobile || "Not loaded"} />
            <InfoRow label="KYC" value={profile?.kyc_status || "Not loaded"} />
            <InfoRow
              label="Last Wallet Update"
              value={wallet?.updated_at ? new Date(wallet.updated_at).toLocaleString() : "Not loaded"}
            />
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Linked Accounts</h2>

          <div className="mt-6 space-y-3">
            {linkedAccounts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/25 p-5 text-sm font-bold text-white/60">
                No linked account found.
              </div>
            ) : (
              linkedAccounts.map((account) => (
                <div key={account.id} className="rounded-2xl border border-white/10 bg-black/25 p-5">
                  <p className="text-lg font-black text-green-200">
                    {account.provider_name || account.account_type || "Payout Account"}
                  </p>
                  <p className="mt-1 text-sm text-white/70">{account.account_name || "No account name"}</p>
                  <p className="text-sm text-white/50">{account.account_number || "No account number"}</p>
                  <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black ${badgeClass(account.status)}`}>
                    {account.status || "PENDING"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-8 md:px-10 lg:grid-cols-2">
        <div className="rounded-3xl border border-green-300/20 bg-green-400/[0.07] p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Submit Cash-In</h2>
          <div className="mt-6 space-y-4">
            <input type="number" value={cashInAmount} onChange={(event) => setCashInAmount(event.target.value)} placeholder="Amount" className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
            <input value={cashInReference} onChange={(event) => setCashInReference(event.target.value)} placeholder="Payment reference / receipt number" className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
            <button onClick={submitCashIn} disabled={submittingCashIn} className="w-full rounded-2xl bg-green-500 px-6 py-4 text-sm font-black text-green-950 hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-slate-500">
              {submittingCashIn ? "Submitting..." : "Submit Cash-In Request"}
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-yellow-300/20 bg-yellow-400/[0.07] p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Request Withdrawal</h2>
          <div className="mt-6 space-y-4">
            <input type="number" value={withdrawAmount} onChange={(event) => setWithdrawAmount(event.target.value)} placeholder="Amount" className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
            <button onClick={submitWithdraw} disabled={submittingWithdraw} className="w-full rounded-2xl bg-yellow-400 px-6 py-4 text-sm font-black text-yellow-950 hover:bg-yellow-300 disabled:cursor-not-allowed disabled:bg-slate-500">
              {submittingWithdraw ? "Submitting..." : "Submit Withdrawal Request"}
            </button>
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
      <p className="mt-3 text-2xl font-black text-green-300">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-black/25 px-4 py-3">
      <p className="text-xs font-bold text-white/50">{label}</p>
      <p className="text-right text-sm font-black text-white">{value}</p>
    </div>
  );
}
