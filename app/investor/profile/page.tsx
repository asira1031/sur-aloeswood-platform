"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { formatDate, type AnyRow } from "@/app/lib/coplanting/ui";

const requiredProfileFields = [
  { key: "full_name", label: "Legal name" },
  { key: "mobile", label: "Mobile number" },
  { key: "address", label: "Current address" },
];

const KYC_BUCKET = "kyc-documents";

export default function ProfilePage() {
  const [profile, setProfile] = useState<AnyRow | null>(null);
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [validIdFile, setValidIdFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sur_login_email") || "";
    if (saved) loadProfile(saved);
  }, []);

  async function loadProfile(targetEmail = localStorage.getItem("sur_login_email") || "") {
    setLoading(true);
    setMessage("");

    const cleanEmail = targetEmail.toLowerCase().trim();

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (error || !data) {
      setMessage(error?.message || "Profile not found.");
      setProfile(null);
      setLoading(false);
      return;
    }

    setProfile(data);
    setFullName(data.full_name || "");
    setMobile(data.mobile || data.mobile_number || "");
    setAddress(data.address || "");
    localStorage.setItem("sur_login_email", cleanEmail);
    localStorage.setItem("sur_profile_id", data.id);
    setLoading(false);
  }

  async function saveProfile() {
    if (!profile) {
      setMessage("Load profile first.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        mobile: mobile.trim(),
        mobile_number: mobile.trim(),
        address: address.trim(),
        kyc_status: String(profile.kyc_status || "").toUpperCase() === "REJECTED" ? "PENDING" : profile.kyc_status,
      })
      .eq("id", profile.id);

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setMessage("Profile saved. Admin can now review your KYC status.");
    await loadProfile(profile.email);
  }

  async function uploadKycDocuments() {
    if (!profile) {
      setMessage("Load profile first.");
      return;
    }

    if (!validIdFile && !selfieFile) {
      setMessage("Choose at least one KYC file to upload.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const updates: AnyRow = {
        kyc_status: String(profile.kyc_status || "").toUpperCase() === "APPROVED" ? "APPROVED" : "PENDING",
        kyc_submitted_at: new Date().toISOString(),
      };

      if (validIdFile) {
        updates.kyc_id_url = await uploadProfileFile(profile.id, "valid-id", validIdFile);
      }

      if (selfieFile) {
        updates.kyc_selfie_url = await uploadProfileFile(profile.id, "selfie", selfieFile);
      }

      const { error } = await supabase.from("profiles").update(updates).eq("id", profile.id);
      if (error) throw error;

      setValidIdFile(null);
      setSelfieFile(null);
      setMessage("KYC documents uploaded. Admin can inspect them for verification.");
      await loadProfile(profile.email);
    } catch (err: any) {
      setMessage(err?.message || "Unable to upload KYC documents.");
      setLoading(false);
    }
  }

  async function uploadProfileFile(profileId: string, kind: string, file: File) {
    const extension = file.name.split(".").pop() || "jpg";
    const path = `${profileId}/${kind}-${Date.now()}.${extension}`;
    const { error } = await supabase.storage.from(KYC_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });

    if (error) throw error;

    const { data } = supabase.storage.from(KYC_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  const completion = useMemo(() => {
    if (!profile) return 0;
    const hasName = Boolean(fullName.trim());
    const hasMobile = Boolean(mobile.trim());
    const hasAddress = Boolean(address.trim());
    return [hasName, hasMobile, hasAddress].filter(Boolean).length;
  }, [address, fullName, mobile, profile]);

  const kycStatus = String(profile?.kyc_status || "PENDING").toUpperCase();
  const accountStatus = String(profile?.account_status || "PENDING").toUpperCase();
  const currentKycFiles = profile ? getKycFiles(profile) : [];

  return (
    <main className="min-h-screen bg-[#f3f7f1] text-slate-950">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-4 lg:px-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/20 p-6 shadow-sm lg:p-8">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/forest-bg.jpg')" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-green-950/90 via-green-900/66 to-green-950/18" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-white/75">Investor Verification</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-white lg:text-6xl">
                KYC and Profile
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78 lg:text-base">
                Keep your legal profile, contact details, and payout account ready for admin review.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => loadProfile()}
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
            <HeroStat label="KYC Status" value={kycStatus} />
            <HeroStat label="Account Status" value={accountStatus} />
            <HeroStat label="Readiness" value={`${completion}/3`} />
          </div>

          {message && (
            <div className="relative z-10 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
              {message}
            </div>
          )}
        </section>

        <section className="grid gap-5 py-5 lg:grid-cols-[0.82fr_1.18fr]">
          <div className="space-y-5">
            <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-950">Verification Status</h2>
                  <p className="mt-1 text-sm text-slate-600">Admin approval depends on complete and matching profile details.</p>
                </div>
                <Badge value={kycStatus} />
              </div>

              <div className="mt-5 grid gap-3">
                {requiredProfileFields.map((field) => {
                  const value = field.key === "mobile" ? mobile : field.key === "address" ? address : fullName;
                  return <Checklist key={field.key} label={field.label} done={Boolean(value.trim())} />;
                })}
              </div>
            </section>

            <section className="rounded-[2rem] border border-amber-100 bg-amber-50/75 p-5 shadow-sm lg:p-6">
              <h2 className="text-2xl font-black text-slate-950">Account Record</h2>
              {profile ? (
                <div className="mt-5 space-y-3">
                  <Info label="Name" value={profile.full_name || "-"} />
                  <Info label="Email" value={profile.email || "-"} />
                  <Info label="Created" value={formatDate(profile.created_at)} />
                  <Info label="Referral Code" value={profile.referral_code || "Pending"} />
                </div>
              ) : (
                <Empty text="Load your profile to see account status." />
              )}
            </section>
          </div>

          <div className="space-y-5">
            <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
              <h2 className="text-2xl font-black text-slate-950">Legal Profile Details</h2>
              <p className="mt-1 text-sm text-slate-600">These values are what admin sees during KYC review.</p>
              <div className="mt-5 grid gap-4">
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Legal full name"
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
                />
                <input
                  value={mobile}
                  onChange={(event) => setMobile(event.target.value)}
                  placeholder="Mobile number"
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
                />
                <textarea
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  rows={4}
                  placeholder="Complete address"
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
                />
                <button
                  onClick={saveProfile}
                  disabled={loading || !profile}
                  className="rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  Save KYC Details
                </button>
              </div>
            </section>

            <section className="rounded-[2rem] border border-teal-100 bg-teal-50/75 p-5 shadow-sm lg:p-6">
              <h2 className="text-2xl font-black text-slate-950">KYC Document Upload</h2>
              <p className="mt-1 text-sm text-slate-600">Upload a clear valid ID and selfie/photo for admin inspection.</p>

              <div className="mt-5 grid gap-4">
                <label className="rounded-2xl border border-dashed border-teal-200 bg-white/80 p-4">
                  <span className="text-sm font-black text-slate-950">Valid ID photo</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(event) => setValidIdFile(event.target.files?.[0] || null)}
                    className="mt-3 block w-full text-sm font-bold text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-sm file:font-black file:text-white"
                  />
                </label>

                <label className="rounded-2xl border border-dashed border-teal-200 bg-white/80 p-4">
                  <span className="text-sm font-black text-slate-950">Selfie or verification photo</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(event) => setSelfieFile(event.target.files?.[0] || null)}
                    className="mt-3 block w-full text-sm font-bold text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-sm file:font-black file:text-white"
                  />
                </label>

                <button
                  onClick={uploadKycDocuments}
                  disabled={loading || !profile}
                  className="rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  Upload KYC for Review
                </button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {currentKycFiles.length === 0 ? (
                  <Empty text="No KYC files uploaded yet." />
                ) : (
                  currentKycFiles.map((file) => <KycFile key={file.label} label={file.label} url={file.url} />)
                )}
              </div>
            </section>

          </div>
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
  const status = String(value || "PENDING").toUpperCase();
  const style = status === "APPROVED" || status === "ACTIVE"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : status === "REJECTED" || status === "SUSPENDED"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-amber-200 bg-amber-50 text-amber-800";

  return <span className={`rounded-full border px-3 py-1 text-xs font-black ${style}`}>{status}</span>;
}

function Checklist({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
      <span className="text-sm font-black text-slate-950">{label}</span>
      <span className={`rounded-full px-3 py-1 text-xs font-black ${done ? "bg-emerald-600 text-white" : "bg-amber-300 text-amber-950"}`}>
        {done ? "Ready" : "Needed"}
      </span>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white bg-white/80 p-4">
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

function getKycFiles(profile: AnyRow) {
  return [
    { label: "Valid ID", url: firstText(profile, ["kyc_id_url", "kyc_document_url", "valid_id_url", "id_document_url"]) },
    { label: "Selfie", url: firstText(profile, ["kyc_selfie_url", "selfie_url", "kyc_photo_url", "face_photo_url"]) },
  ].filter((file) => file.url);
}

function firstText(row: AnyRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function KycFile({ label, url }: { label: string; url: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white bg-white/80">
      {isImageUrl(url) ? (
        <img src={url} alt={label} className="h-44 w-full object-cover" />
      ) : (
        <div className="flex h-44 items-center justify-center bg-slate-100 text-sm font-black text-slate-600">Document file</div>
      )}
      <div className="flex items-center justify-between gap-3 p-4">
        <p className="text-sm font-black text-slate-950">{label}</p>
        <a href={url} target="_blank" rel="noreferrer" className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white">
          View
        </a>
      </div>
    </div>
  );
}

function isImageUrl(url: string) {
  return /\.(png|jpe?g|webp|gif|bmp|avif)(\?|#|$)/i.test(url);
}
