"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase/client";
import { formatDate, peso, type AnyRow } from "@/app/lib/admin/approvals";

export default function AdminCoPlanterKycDetailPage() {
  const params = useParams<{ profileId: string }>();
  const router = useRouter();
  const profileId = params?.profileId;

  const [profile, setProfile] = useState<AnyRow | null>(null);
  const [wallet, setWallet] = useState<AnyRow | null>(null);
  const [membership, setMembership] = useState<AnyRow | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<AnyRow[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profileId) loadData(profileId);
  }, [profileId]);

  async function loadData(targetProfileId: string) {
    setLoading(true);
    setMessage("");

    const [{ data: profileRow, error }, { data: walletRows }, { data: membershipRows }, { data: linkedRows }] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", targetProfileId).maybeSingle(),
        supabase.from("wallets").select("id, profile_id, balance, updated_at").eq("profile_id", targetProfileId),
        supabase
          .from("memberships")
          .select("id, profile_id, membership_plan, annual_fee, status, start_date, expiry_date, created_at")
          .eq("profile_id", targetProfileId)
          .order("created_at", { ascending: false }),
        supabase
          .from("linked_accounts")
          .select("id, profile_id, account_type, provider_name, account_name, account_number, status, created_at")
          .eq("profile_id", targetProfileId)
          .order("created_at", { ascending: false }),
      ]);

    if (error || !profileRow) {
      setMessage(error?.message || "Co-planter profile not found.");
      setProfile(null);
      setLoading(false);
      return;
    }

    setProfile(profileRow as AnyRow);
    setWallet(((walletRows || []) as AnyRow[])[0] || null);
    setMembership(((membershipRows || []) as AnyRow[])[0] || null);
    setLinkedAccounts((linkedRows || []) as AnyRow[]);
    setLoading(false);
  }

  async function ensureWallet(targetProfile: AnyRow) {
    if (wallet) return wallet;

    const { data, error } = await supabase
      .from("wallets")
      .insert({
        profile_id: targetProfile.id,
        balance: Number(targetProfile.wallet_balance || 0),
      })
      .select("id, profile_id, balance, updated_at")
      .maybeSingle();

    if (error) throw error;
    setWallet(data as AnyRow);
    return data;
  }

  async function approveKyc() {
    if (!profile) return;
    setBusy(true);
    setMessage("");

    try {
      await ensureWallet(profile);

      const { error } = await supabase
        .from("profiles")
        .update({
          kyc_status: "APPROVED",
          account_status: String(profile.account_status || "").toUpperCase() === "PENDING" ? "ACTIVE" : profile.account_status,
          kyc_verified_at: new Date().toISOString(),
          kyc_updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (error) throw error;

      await notifyProfile(
        profile.id,
        "KYC approved",
        "Your KYC verification has been approved. Your submitted documents are now verified."
      );

      setMessage("KYC approved. This record is now completed and will leave the Needs Review list.");
      await loadData(profile.id);
    } catch (err: any) {
      setMessage(err?.message || "Unable to approve KYC.");
    }

    setBusy(false);
  }

  async function rejectKyc() {
    if (!profile) return;
    setBusy(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          kyc_status: "REJECTED",
          kyc_updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (error) throw error;

      await notifyProfile(
        profile.id,
        "KYC rejected",
        "Your KYC verification was rejected. Please update your details or upload clearer documents for review."
      );

      setMessage("KYC rejected. This record is now completed and will leave the Needs Review list.");
      await loadData(profile.id);
    } catch (err: any) {
      setMessage(err?.message || "Unable to reject KYC.");
    }

    setBusy(false);
  }

  async function setAccountStatus(accountStatus: string) {
    if (!profile) return;
    setBusy(true);
    setMessage("");

    try {
      await ensureWallet(profile);

      const { error } = await supabase
        .from("profiles")
        .update({
          account_status: accountStatus,
          membership_status: accountStatus === "ACTIVE" ? profile.membership_status || "PENDING" : profile.membership_status,
        })
        .eq("id", profile.id);

      if (error) throw error;

      await notifyProfile(
        profile.id,
        `Account ${accountStatus.toLowerCase()}`,
        `Your co-planter account is now ${accountStatus}.`
      );

      setMessage(`Account updated to ${accountStatus}.`);
      await loadData(profile.id);
    } catch (err: any) {
      setMessage(err?.message || "Unable to update account.");
    }

    setBusy(false);
  }

  async function notifyProfile(profileId: string, title: string, body: string) {
    await supabase.from("notifications").insert({
      profile_id: profileId,
      title,
      message: body,
      is_read: false,
    });
  }

  const kycFiles = useMemo(() => (profile ? getKycFiles(profile) : []), [profile]);
  const kycStatus = profile ? getKycViewStatus(profile) : "PENDING";
  const queueStatus = profile ? getKycQueueStatus(profile) : "NO_FILES";

  return (
    <main className="min-h-screen bg-[#f3f7f1] text-slate-950">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-4 lg:px-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/20 p-6 shadow-sm lg:p-8">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/forest-bg.jpg')" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-green-950/90 via-green-900/66 to-green-950/18" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-white/75">KYC Review Detail</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-white lg:text-6xl">
                {profile?.full_name || "Co-Planter Review"}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78 lg:text-base">
                Inspect uploaded identity documents, approve or reject KYC, and notify the co-planter.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => profileId && loadData(profileId)}
                disabled={loading || busy}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm hover:bg-white/90 disabled:opacity-60"
              >
                Refresh
              </button>
              <Link
                href="/admin/coplanters"
                className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur hover:bg-white/20"
              >
                Back to List
              </Link>
              <Link
                href="/admin/dashboard"
                className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur hover:bg-white/20"
              >
                Dashboard
              </Link>
            </div>
          </div>

          <div className="relative z-10 mt-8 grid gap-3 md:grid-cols-4">
            <HeroStat label="KYC Status" value={kycStatus} />
            <HeroStat label="Queue" value={queueStatus.replaceAll("_", " ")} />
            <HeroStat label="Files" value={String(kycFiles.length)} />
            <HeroStat label="Account" value={String(profile?.account_status || "PENDING").toUpperCase()} />
          </div>

          {message && (
            <div className="relative z-10 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
              {message}
            </div>
          )}
        </section>

        {loading ? (
          <section className="py-5">
            <Empty text="Loading KYC review..." />
          </section>
        ) : !profile ? (
          <section className="py-5">
            <Empty text="Profile not found." />
          </section>
        ) : (
          <section className="grid gap-5 py-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-5">
              <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black text-slate-950">Co-Planter Profile</h2>
                    <p className="mt-1 text-sm text-slate-600">Compare these details against the uploaded documents.</p>
                  </div>
                  <Badge value={kycStatus} />
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <Info label="Name" value={profile.full_name || "-"} />
                  <Info label="Email" value={profile.email || "-"} />
                  <Info label="Mobile" value={profile.mobile || profile.mobile_number || "-"} />
                  <Info label="Address" value={profile.address || "-"} />
                  <Info label="Role" value={profile.role || "-"} />
                  <Info label="Account" value={profile.account_status || "PENDING"} />
                  <Info label="Membership" value={profile.membership_status || "PENDING"} />
                  <Info label="Wallet" value={peso(wallet?.balance ?? profile.wallet_balance)} />
                  <Info label="KYC Submitted" value={formatDate(profile.kyc_submitted_at || profile.kyc_updated_at)} />
                  <Info label="KYC Verified" value={formatDate(profile.kyc_verified_at)} />
                </div>
              </section>

              <section className="rounded-[2rem] border border-amber-100 bg-amber-50/75 p-5 shadow-sm lg:p-6">
                <h2 className="text-2xl font-black text-slate-950">Payout References</h2>
                <div className="mt-5 space-y-3">
                  {linkedAccounts.length === 0 ? (
                    <Empty text="No linked payout account submitted." />
                  ) : (
                    linkedAccounts.map((account) => (
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
              </section>
            </div>

            <div className="space-y-5">
              <section className="rounded-[2rem] border border-teal-100 bg-white p-5 shadow-sm lg:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black text-slate-950">Uploaded KYC Documents</h2>
                    <p className="mt-1 text-sm text-slate-600">Open each document before making a decision.</p>
                  </div>
                  <Badge value={kycFiles.length > 0 ? "FILES READY" : "NO FILES"} />
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {kycFiles.length === 0 ? (
                    <div className="md:col-span-2">
                      <Empty text="No KYC files uploaded yet. This record should stay out of the Needs Review list." />
                    </div>
                  ) : (
                    kycFiles.map((file) => <KycPreview key={file.label} label={file.label} url={file.url} />)
                  )}
                </div>
              </section>

              <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
                <h2 className="text-2xl font-black text-slate-950">Admin Decision</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Approving or rejecting moves this co-planter out of the active Needs Review list.
                </p>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <button
                    disabled={busy || kycFiles.length === 0}
                    onClick={approveKyc}
                    className="rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    Approve KYC
                  </button>
                  <button
                    disabled={busy}
                    onClick={rejectKyc}
                    className="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm font-black text-red-800 hover:bg-red-100 disabled:opacity-60"
                  >
                    Reject KYC
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => setAccountStatus("ACTIVE")}
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm font-black text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                  >
                    Activate Account
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => setAccountStatus("SUSPENDED")}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-sm font-black text-slate-800 hover:bg-slate-100 disabled:opacity-60"
                  >
                    Suspend Account
                  </button>
                </div>

                <button
                  onClick={() => router.push("/admin/coplanters")}
                  className="mt-4 w-full rounded-2xl bg-slate-950 px-6 py-4 text-sm font-black text-white hover:bg-slate-800"
                >
                  Return to KYC List
                </button>
              </section>
            </div>
          </section>
        )}
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
  const status = String(value || "PENDING").toUpperCase();
  const style =
    status === "APPROVED" || status === "ACTIVE" || status === "FILES READY"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "REJECTED" || status === "SUSPENDED" || status === "NO FILES"
        ? "border-red-200 bg-red-50 text-red-800"
        : status === "SUBMITTED" || status === "NEEDS_ACTION"
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

function getKycQueueStatus(profile: AnyRow) {
  const status = String(profile.kyc_status || "PENDING").toUpperCase();
  if (status === "APPROVED" || status === "REJECTED") return "COMPLETED";
  if (getKycFiles(profile).length > 0) return "NEEDS_ACTION";
  return "NO_FILES";
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
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {isImageUrl(url) ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={label} className="h-72 w-full object-cover" />
        </a>
      ) : isPdfUrl(url) ? (
        <iframe src={url} title={label} className="h-72 w-full bg-slate-100" />
      ) : (
        <div className="flex h-72 items-center justify-center bg-slate-100 text-sm font-black text-slate-600">Document file</div>
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
