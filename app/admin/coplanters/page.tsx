"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { formatDate, peso, type AnyRow } from "@/app/lib/admin/approvals";

export default function AdminCoPlantersPage() {
  const [profiles, setProfiles] = useState<AnyRow[]>([]);
  const [wallets, setWallets] = useState<AnyRow[]>([]);
  const [memberships, setMemberships] = useState<AnyRow[]>([]);
  const [linkedAccounts, setLinkedAccounts] = useState<AnyRow[]>([]);
  const [selected, setSelected] = useState<AnyRow | null>(null);
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("ALL");
  const [kycFilter, setKycFilter] = useState("ALL");
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setMessage("");

    const [{ data: profileRows, error }, { data: walletRows }, { data: membershipRows }, { data: linkedRows }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .in("role", ["COPLANTER", "INVESTOR", "ADMIN"])
          .order("created_at", { ascending: false }),
        supabase.from("wallets").select("id, profile_id, balance, updated_at"),
        supabase.from("memberships").select("id, profile_id, membership_plan, annual_fee, status, start_date, expiry_date, created_at"),
        supabase
          .from("linked_accounts")
          .select("id, profile_id, account_type, provider_name, account_name, account_number, status, created_at")
          .order("created_at", { ascending: false }),
      ]);

    if (error) {
      setMessage(error.message);
      return;
    }

    const safeProfiles = (profileRows || []) as AnyRow[];
    setProfiles(safeProfiles);
    setWallets((walletRows || []) as AnyRow[]);
    setMemberships((membershipRows || []) as AnyRow[]);
    setLinkedAccounts((linkedRows || []) as AnyRow[]);
    const urlProfileId =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("profile")
        : null;
    setSelected(
      (current) =>
        safeProfiles.find((profile) => profile.id === urlProfileId) ||
        safeProfiles.find((profile) => profile.id === current?.id) ||
        safeProfiles.find((profile) => getKycFiles(profile).length > 0) ||
        safeProfiles[0] ||
        null
    );
  }

  function walletFor(profileId?: string) {
    return wallets.find((wallet) => wallet.profile_id === profileId) || null;
  }

  function membershipFor(profileId?: string) {
    return memberships.find((membership) => membership.profile_id === profileId) || null;
  }

  function linkedFor(profileId?: string) {
    return linkedAccounts.filter((account) => account.profile_id === profileId);
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

      await notifyProfile(profile.id, `Account ${accountStatus.toLowerCase()}`, `Your co-planter account is now ${accountStatus}.`);

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
        kyc_verified_at: new Date().toISOString(),
        kyc_updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    if (error) {
      setMessage(error.message);
      setBusyId("");
      return;
    }

    await notifyProfile(profile.id, "KYC approved", "Your KYC verification has been approved.");

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
        kyc_updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    if (error) {
      setMessage(error.message);
      setBusyId("");
      return;
    }

    await notifyProfile(
      profile.id,
      "KYC rejected",
      "Your KYC verification was rejected. Please upload clearer documents or update your profile details."
    );

    setMessage("KYC rejected.");
    await loadData();
    setBusyId("");
  }

  async function notifyProfile(profileId: string, title: string, body: string) {
    await supabase.from("notifications").insert({
      profile_id: profileId,
      title,
      message: body,
      is_read: false,
    });
  }

  const filtered = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return profiles.filter((profile) => {
      const accountOk = accountFilter === "ALL" || String(profile.account_status || "").toUpperCase() === accountFilter;
      const kycOk = kycFilter === "ALL" || getKycViewStatus(profile) === kycFilter;
      const text = JSON.stringify(profile).toLowerCase();
      return accountOk && kycOk && (!keyword || text.includes(keyword));
    });
  }, [accountFilter, kycFilter, profiles, search]);

  const selectedWallet = selected ? walletFor(selected.id) : null;
  const selectedMembership = selected ? membershipFor(selected.id) : null;
  const selectedLinkedAccounts = selected ? linkedFor(selected.id) : [];
  const selectedKycFiles = selected ? getKycFiles(selected) : [];
  const pendingKyc = profiles.filter((profile) => getKycViewStatus(profile) === "PENDING").length;
  const submittedKyc = profiles.filter((profile) => getKycViewStatus(profile) === "SUBMITTED").length;
  const approvedKyc = profiles.filter((profile) => getKycViewStatus(profile) === "APPROVED").length;
  const activeAccounts = profiles.filter((profile) => String(profile.account_status || "").toUpperCase() === "ACTIVE").length;

  return (
    <main className="min-h-screen bg-[#f3f7f1] text-slate-950">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-4 lg:px-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/20 p-6 shadow-sm lg:p-8">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/forest-bg.jpg')" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-green-950/90 via-green-900/66 to-green-950/18" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-white/75">Admin KYC Command</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-white lg:text-6xl">
                Co-Planter Verification
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78 lg:text-base">
                Review uploaded IDs, selfie photos, profile details, payout references, and KYC decisions in one clean workspace.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={loadData}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm hover:bg-white/90"
              >
                Refresh
              </button>
              <Link
                href="/admin/dashboard"
                className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur hover:bg-white/20"
              >
                Dashboard
              </Link>
            </div>
          </div>

          <div className="relative z-10 mt-8 grid gap-3 md:grid-cols-4">
            <HeroStat label="Pending KYC" value={String(pendingKyc)} />
            <HeroStat label="Submitted Files" value={String(submittedKyc)} />
            <HeroStat label="KYC Approved" value={String(approvedKyc)} />
            <HeroStat label="Active Accounts" value={String(activeAccounts)} />
          </div>

          {message && (
            <div className="relative z-10 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
              {message}
            </div>
          )}
        </section>

        <section className="grid gap-4 py-5 md:grid-cols-4">
          <Metric tone="white" title="Total Records" value={String(profiles.length)} detail="Profiles visible to admin" />
          <Metric tone="forest" title="Needs Review" value={String(submittedKyc)} detail="Uploaded KYC documents" />
          <Metric tone="gold" title="Approved KYC" value={String(approvedKyc)} detail="Verified identities" />
          <Metric tone="mist" title="Linked Accounts" value={String(linkedAccounts.length)} detail="Payout references" />
        </section>

        <section className="grid gap-5 pb-8 lg:grid-cols-[0.92fr_1.08fr]">
          <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-950">KYC Queue</h2>
                <p className="mt-1 text-sm text-slate-600">Select a co-planter to review uploaded documents.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 xl:max-w-xl">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search"
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
                />
                <select
                  value={accountFilter}
                  onChange={(event) => setAccountFilter(event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
                >
                  <option value="ALL">All accounts</option>
                  <option value="PENDING">Pending</option>
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
                <select
                  value={kycFilter}
                  onChange={(event) => setKycFilter(event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
                >
                  <option value="ALL">All KYC</option>
                  <option value="PENDING">Pending only</option>
                  <option value="SUBMITTED">Submitted files</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {filtered.length === 0 ? (
                <Empty text="No co-planters found." />
              ) : (
                filtered.map((profile) => {
                  const isSelected = selected?.id === profile.id;
                  const files = getKycFiles(profile);
                  return (
                    <button
                      key={profile.id}
                      onClick={() => setSelected(profile)}
                      className={`w-full rounded-2xl border p-5 text-left transition ${
                        isSelected ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:border-emerald-200"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-black text-slate-950">{profile.full_name || profile.email}</p>
                          <p className="mt-1 text-sm font-bold text-slate-600">{profile.email}</p>
                          <p className="mt-1 text-xs font-bold text-slate-500">
                            {files.length} KYC file{files.length === 1 ? "" : "s"} uploaded
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Badge value={profile.account_status || "PENDING"} />
                          <Badge value={getKycViewStatus(profile)} />
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Verification Detail</h2>
                <p className="mt-1 text-sm text-slate-600">Approve only when ID, selfie, and profile details match.</p>
              </div>
              {selected && <Badge value={getKycViewStatus(selected)} />}
            </div>

            {!selected ? (
              <div className="mt-6">
                <Empty text="Select a co-planter to review KYC." />
              </div>
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
                  <Info label="KYC Submitted" value={formatDate(firstText(selected, ["kyc_submitted_at", "kyc_updated_at", "updated_at"]))} />
                  <Info label="KYC Verified" value={formatDate(selected.kyc_verified_at)} />
                  <Info label="Created" value={formatDate(selected.created_at)} />
                </div>

                <div className="mt-6 rounded-[1.5rem] border border-teal-100 bg-teal-50/75 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-slate-950">Uploaded KYC Documents</h3>
                      <p className="mt-1 text-sm text-slate-600">Open each document and compare with the profile details.</p>
                    </div>
                    <Badge value={selectedKycFiles.length > 0 ? "FILES READY" : "NO FILES"} />
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {selectedKycFiles.length === 0 ? (
                      <div className="md:col-span-2">
                        <Empty text="No uploaded KYC documents found for this co-planter yet." />
                      </div>
                    ) : (
                      selectedKycFiles.map((file) => <KycPreview key={file.label} label={file.label} url={file.url} />)
                    )}
                  </div>
                </div>

                <div className="mt-6 rounded-[1.5rem] border border-amber-100 bg-amber-50/75 p-5">
                  <h3 className="text-lg font-black text-slate-950">Payout References</h3>
                  <div className="mt-4 space-y-3">
                    {selectedLinkedAccounts.length === 0 ? (
                      <Empty text="No linked payout account submitted." />
                    ) : (
                      selectedLinkedAccounts.map((account) => (
                        <div key={account.id} className="rounded-2xl border border-white bg-white/80 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-black text-slate-950">{account.account_type}</p>
                              <p className="mt-1 text-sm text-slate-600">{account.provider_name || "-"}</p>
                              <p className="mt-1 text-sm text-slate-600">
                                {account.account_name || "-"} - {account.account_number || "-"}
                              </p>
                            </div>
                            <Badge value={account.status || "PENDING"} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  <button
                    disabled={busyId === selected.id}
                    onClick={() => updateProfileStatus(selected, "ACTIVE")}
                    className="rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    Activate / Restore Account
                  </button>
                  <button
                    disabled={busyId === selected.id}
                    onClick={() => updateProfileStatus(selected, "SUSPENDED")}
                    className="rounded-2xl bg-red-600 px-6 py-4 text-sm font-black text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    Suspend Account
                  </button>
                  <button
                    disabled={busyId === selected.id || selectedKycFiles.length === 0}
                    onClick={() => approveKyc(selected)}
                    className="rounded-2xl bg-amber-400 px-6 py-4 text-sm font-black text-amber-950 hover:bg-amber-300 disabled:opacity-60"
                  >
                    Approve KYC
                  </button>
                  <button
                    disabled={busyId === selected.id}
                    onClick={() => rejectKyc(selected)}
                    className="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm font-black text-red-800 hover:bg-red-100 disabled:opacity-60"
                  >
                    Reject KYC
                  </button>
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

function Metric({
  tone,
  title,
  value,
  detail,
}: {
  tone: "gold" | "forest" | "white" | "mist";
  title: string;
  value: string;
  detail: string;
}) {
  const styles = {
    gold: "border-amber-100 bg-gradient-to-br from-white via-amber-50 to-yellow-50 text-amber-900",
    forest: "border-emerald-100 bg-gradient-to-br from-white via-emerald-50 to-green-50 text-emerald-900",
    white: "border-slate-200 bg-white text-slate-950",
    mist: "border-teal-100 bg-gradient-to-br from-white via-teal-50 to-emerald-50 text-teal-900",
  }[tone];

  return (
    <div className={`rounded-[1.5rem] border p-5 shadow-sm ${styles}`}>
      <p className="text-xs font-black uppercase tracking-wide opacity-65">{title}</p>
      <p className="mt-3 truncate text-3xl font-black">{value}</p>
      <p className="mt-2 text-sm opacity-70">{detail}</p>
    </div>
  );
}

function Badge({ value }: { value: string }) {
  const status = String(value || "PENDING").toUpperCase();
  const style =
    status === "APPROVED" || status === "ACTIVE" || status === "FILES READY"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "REJECTED" || status === "SUSPENDED" || status === "NO FILES"
        ? "border-red-200 bg-red-50 text-red-800"
        : status === "SUBMITTED"
          ? "border-blue-200 bg-blue-50 text-blue-800"
          : "border-amber-200 bg-amber-50 text-amber-800";

  return <span className={`rounded-full border px-3 py-1 text-xs font-black ${style}`}>{status}</span>;
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

function getKycViewStatus(profile: AnyRow) {
  const status = String(profile.kyc_status || "PENDING").toUpperCase();
  if (status === "APPROVED" || status === "REJECTED") return status;
  if (getKycFiles(profile).length > 0) return "SUBMITTED";
  return "PENDING";
}

function getKycFiles(profile: AnyRow) {
  return [
    { label: "Valid ID", url: firstText(profile, ["kyc_id_url", "kyc_document_url", "valid_id_url", "id_document_url", "government_id_url"]) },
    { label: "Selfie / Photo", url: firstText(profile, ["kyc_selfie_url", "selfie_url", "kyc_photo_url", "face_photo_url"]) },
    { label: "Extra Document", url: firstText(profile, ["kyc_extra_url", "proof_of_address_url", "supporting_document_url"]) },
  ].filter((file) => file.url);
}

function firstText(row: AnyRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function KycPreview({ label, url }: { label: string; url: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white bg-white/90 shadow-sm">
      {isImageUrl(url) ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={label} className="h-60 w-full object-cover" />
        </a>
      ) : isPdfUrl(url) ? (
        <iframe src={url} title={label} className="h-60 w-full bg-slate-100" />
      ) : (
        <div className="flex h-60 items-center justify-center bg-slate-100 text-sm font-black text-slate-600">Document file</div>
      )}
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-950">{label}</p>
          <p className="mt-1 truncate text-xs font-bold text-slate-500">{url}</p>
        </div>
        <a href={url} target="_blank" rel="noreferrer" className="shrink-0 rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white">
          Open
        </a>
      </div>
    </div>
  );
}

function isImageUrl(url: string) {
  return /\.(png|jpe?g|webp|gif|bmp|avif|heic|heif)(\?|#|$)/i.test(url);
}

function isPdfUrl(url: string) {
  return /\.pdf(\?|#|$)/i.test(url);
}
