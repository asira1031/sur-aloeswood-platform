"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { formatDate, type AnyRow } from "@/app/lib/admin/approvals";

export default function AdminCoPlantersPage() {
  const [profiles, setProfiles] = useState<AnyRow[]>([]);
  const [search, setSearch] = useState("");
  const [queueFilter, setQueueFilter] = useState("NEEDS_ACTION");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setMessage("");

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .in("role", ["COPLANTER", "INVESTOR"])
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setProfiles((data || []) as AnyRow[]);
  }

  const needsAction = profiles.filter((profile) => getKycQueueStatus(profile) === "NEEDS_ACTION");
  const completed = profiles.filter((profile) => getKycQueueStatus(profile) === "COMPLETED");
  const noFiles = profiles.filter((profile) => getKycQueueStatus(profile) === "NO_FILES");

  const filtered = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return profiles.filter((profile) => {
      const queueOk = queueFilter === "ALL" || getKycQueueStatus(profile) === queueFilter;
      const text = JSON.stringify(profile).toLowerCase();
      return queueOk && (!keyword || text.includes(keyword));
    });
  }, [profiles, queueFilter, search]);

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
                Co-Planter KYC Queue
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78 lg:text-base">
                Review each co-planter from a dedicated page so approved and rejected records leave the active work list.
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
            <HeroStat label="Needs Action" value={String(needsAction.length)} />
            <HeroStat label="Completed" value={String(completed.length)} />
            <HeroStat label="No Files Yet" value={String(noFiles.length)} />
            <HeroStat label="Total" value={String(profiles.length)} />
          </div>

          {message && (
            <div className="relative z-10 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
              {message}
            </div>
          )}
        </section>

        <section className="grid gap-4 py-5 md:grid-cols-3">
          <QueueCard
            active={queueFilter === "NEEDS_ACTION"}
            title="Needs Review"
            value={String(needsAction.length)}
            detail="Uploaded KYC files waiting for admin decision"
            onClick={() => setQueueFilter("NEEDS_ACTION")}
          />
          <QueueCard
            active={queueFilter === "COMPLETED"}
            title="Completed"
            value={String(completed.length)}
            detail="Approved or rejected KYC records"
            onClick={() => setQueueFilter("COMPLETED")}
          />
          <QueueCard
            active={queueFilter === "NO_FILES"}
            title="No Files"
            value={String(noFiles.length)}
            detail="Co-planters without uploaded KYC documents"
            onClick={() => setQueueFilter("NO_FILES")}
          />
        </section>

        <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-950">Co-Planter Cards</h2>
              <p className="mt-1 text-sm text-slate-600">Open a card to inspect documents, approve, or reject on its own page.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto] lg:w-[520px]">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, email, mobile"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
              />
              <select
                value={queueFilter}
                onChange={(event) => setQueueFilter(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
              >
                <option value="NEEDS_ACTION">Needs Review</option>
                <option value="COMPLETED">Completed</option>
                <option value="NO_FILES">No Files</option>
                <option value="ALL">All</option>
              </select>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {filtered.length === 0 ? (
              <div className="lg:col-span-2">
                <Empty text="No co-planters in this list." />
              </div>
            ) : (
              filtered.map((profile) => (
                <CoPlanterCard key={profile.id} profile={profile} />
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function CoPlanterCard({ profile }: { profile: AnyRow }) {
  const files = getKycFiles(profile);
  const status = getKycViewStatus(profile);
  const queue = getKycQueueStatus(profile);

  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-xl font-black text-slate-950">{profile.full_name || profile.email}</p>
          <p className="mt-1 break-all text-sm font-bold text-slate-600">{profile.email || "-"}</p>
          <p className="mt-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            Created {formatDate(profile.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Badge value={profile.account_status || "PENDING"} />
          <Badge value={status} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Info label="KYC Files" value={String(files.length)} />
        <Info label="Queue" value={queue.replaceAll("_", " ")} />
        <Info label="Mobile" value={profile.mobile || profile.mobile_number || "-"} />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-600">
          {queue === "NEEDS_ACTION"
            ? "Decision needed."
            : queue === "COMPLETED"
              ? "Already decided."
              : "Waiting for customer upload."}
        </p>
        <Link
          href={`/admin/coplanters/${profile.id}`}
          className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700"
        >
          Review KYC
        </Link>
      </div>
    </article>
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

function QueueCard({
  title,
  value,
  detail,
  active,
  onClick,
}: {
  title: string;
  value: string;
  detail: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[1.5rem] border p-5 text-left shadow-sm transition ${
        active ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-200"
      }`}
    >
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-3 text-3xl font-black text-slate-950">{value}</p>
      <p className="mt-2 text-sm font-bold text-slate-600">{detail}</p>
    </button>
  );
}

function Badge({ value }: { value: string }) {
  const status = String(value || "PENDING").toUpperCase();
  const style =
    status === "APPROVED" || status === "ACTIVE" || status === "SUBMITTED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "REJECTED" || status === "SUSPENDED"
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-amber-200 bg-amber-50 text-amber-800";

  return <span className={`rounded-full border px-3 py-1 text-xs font-black ${style}`}>{status}</span>;
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
