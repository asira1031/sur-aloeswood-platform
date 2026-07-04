"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { formatDate, peso, statusClass, type AnyRow } from "@/app/lib/admin/approvals";

export default function AdminCoPlantersPage() {
  const [profiles, setProfiles] = useState<AnyRow[]>([]);
  const [wallets, setWallets] = useState<AnyRow[]>([]);
  const [memberships, setMemberships] = useState<AnyRow[]>([]);
  const [selected, setSelected] = useState<AnyRow | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("PENDING");
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setMessage("");

    const [{ data: profileRows, error }, { data: walletRows }, { data: membershipRows }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, mobile_number, mobile, address, role, membership_status, wallet_balance, created_at, account_status, kyc_status, referral_code, referred_by")
          .order("created_at", { ascending: false }),
        supabase.from("wallets").select("id, profile_id, balance, updated_at"),
        supabase.from("memberships").select("id, profile_id, membership_plan, annual_fee, status, start_date, expiry_date, created_at"),
      ]);

    if (error) {
      setMessage(error.message);
      return;
    }

    const safeProfiles = (profileRows || []) as AnyRow[];
    setProfiles(safeProfiles);
    setWallets((walletRows || []) as AnyRow[]);
    setMemberships((membershipRows || []) as AnyRow[]);
    setSelected(safeProfiles[0] || null);
  }

  function walletFor(profileId?: string) {
    return wallets.find((wallet) => wallet.profile_id === profileId) || null;
  }

  function membershipFor(profileId?: string) {
    return memberships.find((membership) => membership.profile_id === profileId) || null;
  }

  async function ensureWallet(profile: AnyRow) {
    const existing = walletFor(profile.id);
    if (existing) return existing;

    const { data, error } = await supabase
      .from("wallets")
      .insert({
        profile_id: profile.id,
        balance: Number(profile.wallet_balance || 0),
      })
      .select("id, profile_id, balance, updated_at")
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async function updateProfileStatus(profile: AnyRow, accountStatus: string, kycStatus?: string) {
    setBusyId(profile.id);
    setMessage("");

    try {
      await ensureWallet(profile);

      const updatePayload: AnyRow = {
        account_status: accountStatus,
      };

      if (kycStatus) updatePayload.kyc_status = kycStatus;
      if (accountStatus === "ACTIVE") updatePayload.membership_status = profile.membership_status || "PENDING";

      const { error } = await supabase.from("profiles").update(updatePayload).eq("id", profile.id);
      if (error) throw error;

      await supabase.from("notifications").insert({
        profile_id: profile.id,
        title: `Account ${accountStatus.toLowerCase()}`,
        message: `Your co-planter account is now ${accountStatus}.`,
        is_read: false,
      });

      setMessage(`Co-planter updated to ${accountStatus}.`);
      await loadData();
    } catch (err: any) {
      setMessage(err?.message || "Unable to update co-planter.");
    }

    setBusyId("");
  }

  async function approveKyc(profile: AnyRow) {
    setBusyId(profile.id);
    setMessage("");

    const { error } = await supabase
      .from("profiles")
      .update({
        kyc_status: "APPROVED",
      })
      .eq("id", profile.id);

    if (error) {
      setMessage(error.message);
      setBusyId("");
      return;
    }

    await supabase.from("notifications").insert({
      profile_id: profile.id,
      title: "KYC approved",
      message: "Your KYC verification has been approved.",
      is_read: false,
    });

    setMessage("KYC approved.");
    await loadData();
    setBusyId("");
  }

  async function rejectKyc(profile: AnyRow) {
    setBusyId(profile.id);
    setMessage("");

    const { error } = await supabase
      .from("profiles")
      .update({
        kyc_status: "REJECTED",
      })
      .eq("id", profile.id);

    if (error) {
      setMessage(error.message);
      setBusyId("");
      return;
    }

    await supabase.from("notifications").insert({
      profile_id: profile.id,
      title: "KYC rejected",
      message: "Your KYC verification was rejected. Please contact support or update your profile.",
      is_read: false,
    });

    setMessage("KYC rejected.");
    await loadData();
    setBusyId("");
  }

  const filtered = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return profiles.filter((profile) => {
      const statusOk = filter === "ALL" || String(profile.account_status || "").toUpperCase() === filter;
      const text = JSON.stringify(profile).toLowerCase();
      return statusOk && (!keyword || text.includes(keyword));
    });
  }, [profiles, filter, search]);

  const selectedWallet = selected ? walletFor(selected.id) : null;
  const selectedMembership = selected ? membershipFor(selected.id) : null;

  return (
    <main className="min-h-screen bg-[#04140d] text-white">
      <section className="border-b border-white/10 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-green-300">SUR ALOESWOOD ADMIN</p>
              <h1 className="mt-4 text-4xl font-black md:text-6xl">Co-Planter Approval</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-green-50/80">
                Review registered co-planters, activate accounts, approve KYC, and ensure wallet records exist.
              </p>
            </div>

            <button onClick={loadData} className="rounded-2xl bg-green-500 px-5 py-3 text-sm font-black text-green-950">
              Refresh
            </button>
          </div>

          {message && <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-8 md:grid-cols-4 md:px-10">
        <Metric title="Total Co-Planters" value={String(profiles.length)} />
        <Metric title="Pending" value={String(profiles.filter((p) => String(p.account_status || "").toUpperCase() === "PENDING").length)} />
        <Metric title="Active" value={String(profiles.filter((p) => String(p.account_status || "").toUpperCase() === "ACTIVE").length)} />
        <Metric title="KYC Approved" value={String(profiles.filter((p) => String(p.kyc_status || "").toUpperCase() === "APPROVED").length)} />
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-16 md:px-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-3xl font-black">Co-Planters</h2>
            <div className="flex flex-wrap gap-3">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none" />
              <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none">
                <option value="ALL">All</option>
                <option value="PENDING">Pending</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/25 p-6 text-sm font-bold text-white/60">No co-planters found.</div>
            ) : filtered.map((profile) => (
              <button key={profile.id} onClick={() => setSelected(profile)} className={`w-full rounded-2xl border p-5 text-left ${selected?.id === profile.id ? "border-green-300 bg-green-400/15" : "border-white/10 bg-black/25"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black text-green-200">{profile.full_name || profile.email}</p>
                    <p className="mt-1 text-sm text-white/60">{profile.email}</p>
                    <p className="mt-1 text-xs text-white/45">Referral: {profile.referral_code || "Pending"}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(profile.account_status)}`}>{profile.account_status || "PENDING"}</span>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(profile.kyc_status)}`}>{profile.kyc_status || "PENDING"}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Approval Detail</h2>

          {!selected ? (
            <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-black/25 p-6 text-sm font-bold text-white/60">Select a co-planter.</div>
          ) : (
            <>
              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <Info label="Name" value={selected.full_name || "-"} />
                <Info label="Email" value={selected.email || "-"} />
                <Info label="Mobile" value={selected.mobile || selected.mobile_number || "-"} />
                <Info label="Address" value={selected.address || "-"} />
                <Info label="Account" value={selected.account_status || "PENDING"} />
                <Info label="KYC" value={selected.kyc_status || "PENDING"} />
                <Info label="Membership" value={selected.membership_status || "PENDING"} />
                <Info label="Wallet" value={peso(selectedWallet?.balance ?? selected.wallet_balance)} />
                <Info label="Membership Plan" value={selectedMembership?.membership_plan || "-"} />
                <Info label="Created" value={formatDate(selected.created_at)} />
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <button disabled={busyId === selected.id} onClick={() => updateProfileStatus(selected, "ACTIVE")} className="rounded-2xl bg-green-500 px-6 py-4 text-sm font-black text-green-950 disabled:bg-slate-500">
                  Activate Account
                </button>
                <button disabled={busyId === selected.id} onClick={() => updateProfileStatus(selected, "SUSPENDED")} className="rounded-2xl bg-red-500 px-6 py-4 text-sm font-black text-white disabled:bg-slate-500">
                  Suspend Account
                </button>
                <button disabled={busyId === selected.id} onClick={() => approveKyc(selected)} className="rounded-2xl bg-yellow-400 px-6 py-4 text-sm font-black text-yellow-950 disabled:bg-slate-500">
                  Approve KYC
                </button>
                <button disabled={busyId === selected.id} onClick={() => rejectKyc(selected)} className="rounded-2xl border border-white/10 bg-white/10 px-6 py-4 text-sm font-black disabled:bg-slate-500">
                  Reject KYC
                </button>
              </div>
            </>
          )}
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
