"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { formatDate, type AnyRow } from "@/app/lib/dashboard/nav";

type RegisterForm = {
  fullName: string;
  email: string;
  mobile: string;
  status: string;
};

const initialForm: RegisterForm = {
  fullName: "",
  email: "",
  mobile: "",
  status: "ACTIVE",
};

export default function AdminGardenerPage() {
  const [gardeners, setGardeners] = useState<AnyRow[]>([]);
  const [profiles, setProfiles] = useState<AnyRow[]>([]);
  const [assignments, setAssignments] = useState<AnyRow[]>([]);
  const [form, setForm] = useState<RegisterForm>(initialForm);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [selectedFarmerId, setSelectedFarmerId] = useState<string | null>(null);
  const [showRegistration, setShowRegistration] = useState(false);

  useEffect(() => {
    loadFarmers();
  }, []);

  async function loadFarmers() {
    setLoading(true);
    setMessage("");

    const [{ data: gardenerRows, error }, { data: profileRows }, { data: assignmentRows }] = await Promise.all([
      supabase
        .from("gardeners")
        .select("id, full_name, email, mobile, status, resume_url, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, full_name, email, role, account_status, kyc_status, membership_status, created_at")
        .in("role", ["FARMER", "GARDENER", "CARETAKER"])
        .order("created_at", { ascending: false }),
      supabase
        .from("gardener_assignments")
        .select("id, gardener_id, tree_id, status, assigned_at")
        .order("assigned_at", { ascending: false }),
    ]);

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setGardeners((gardenerRows || []) as AnyRow[]);
    setProfiles((profileRows || []) as AnyRow[]);
    setAssignments((assignmentRows || []) as AnyRow[]);
    const searchParams =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const urlFarmerId = searchParams?.get("farmer");
    const urlEmail = searchParams?.get("email")?.toLowerCase();
    const urlFarmer =
      gardenerRows?.find((gardener) => gardener.id === urlFarmerId) ||
      gardenerRows?.find((gardener) => String(gardener.email || "").toLowerCase() === urlEmail);
    setSelectedFarmerId((current) => urlFarmer?.id || current || gardenerRows?.[0]?.id || null);
    setLoading(false);
  }

  function updateForm(key: keyof RegisterForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function registerFarmer() {
    setMessage("");

    const cleanEmail = form.email.toLowerCase().trim();
    const cleanName = form.fullName.trim();
    const cleanMobile = form.mobile.trim();

    if (!cleanName || !cleanEmail) {
      setMessage("Complete farmer name and email.");
      return;
    }

    if (!resumeFile) {
      setMessage("Resume/CV photo is required before sending farmer registration.");
      return;
    }

    if (!resumeFile.type.startsWith("image/")) {
      setMessage("Resume/CV must be an image file.");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setMessage("Admin login is required before registering a farmer.");
      return;
    }

    setSaving(true);

    const safeFileName = resumeFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const filePath = `resumes/${Date.now()}-${cleanEmail}-${safeFileName}`;
    const { error: uploadError } = await supabase.storage
      .from("farmer-resumes")
      .upload(filePath, resumeFile, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      setSaving(false);
      setMessage(`${uploadError.message}. Please make sure the farmer-resumes storage bucket and policies are ready.`);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("farmer-resumes").getPublicUrl(filePath);

    const response = await fetch("/api/admin/farmers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        fullName: cleanName,
        email: cleanEmail,
        mobile: cleanMobile,
        resumeUrl: publicUrlData.publicUrl,
        status: form.status,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setSaving(false);
      setMessage(result.error || "Unable to register farmer.");
      return;
    }

    setForm(initialForm);
    setResumeFile(null);
    setShowRegistration(false);
    setSaving(false);
    setMessage(result.message || "Farmer registration link sent. They can set their password from email, then login to Farmer app.");
    await loadFarmers();
  }

  async function copyRegistrationLink() {
    const link = typeof window !== "undefined" ? `${window.location.origin}/farmer/register` : "/farmer/register";

    if (!navigator.clipboard) {
      setMessage(`Farmer registration link: ${link}`);
      return;
    }

    await navigator.clipboard.writeText(link);
    setMessage("Farmer registration link copied. Send this link to the farmer.");
  }

  async function updateFarmerStatus(row: AnyRow, status: string) {
    setMessage("");

    const [{ error: gardenerError }, { error: profileError }] = await Promise.all([
      supabase.from("gardeners").update({ status }).eq("id", row.id),
      supabase.from("profiles").update({ account_status: status }).eq("email", row.email),
    ]);

    if (gardenerError || profileError) {
      setMessage(gardenerError?.message || profileError?.message || "Unable to update status.");
      return;
    }

    setMessage(`Farmer updated to ${status}.`);
    await loadFarmers();
  }

  function profileFor(email?: string | null) {
    return profiles.find((profile) => String(profile.email || "").toLowerCase() === String(email || "").toLowerCase()) || null;
  }

  function assignmentCount(gardenerId?: string | null) {
    return assignments.filter((assignment) => assignment.gardener_id === gardenerId).length;
  }

  const filteredFarmers = useMemo(() => {
    const keyword = search.toLowerCase().trim();
    return gardeners.filter((gardener) => {
      const text = `${gardener.full_name || ""} ${gardener.email || ""} ${gardener.mobile || ""}`.toLowerCase();
      return !keyword || text.includes(keyword);
    });
  }, [gardeners, search]);

  const selectedFarmer = gardeners.find((gardener) => gardener.id === selectedFarmerId) || filteredFarmers[0] || null;
  const activeFarmers = gardeners.filter((gardener) => String(gardener.status || "").toUpperCase() === "ACTIVE").length;

  return (
    <main className="min-h-screen bg-[#f3f7f1] text-slate-950">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-4 lg:px-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/20 p-6 shadow-sm lg:p-8">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/forest-bg.jpg')" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-green-950/90 via-green-900/66 to-green-950/18" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-white/75">Admin Farmer Access</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-white lg:text-6xl">
                Farmer Registration
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78 lg:text-base">
                Send farmer registration links here only. Farmers set their own password, then login from the public login page and route directly to the Farmer app.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowRegistration(true)}
                className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-green-950 shadow-sm hover:bg-emerald-400"
              >
                Farmer Registration Link
              </button>
              <button
                onClick={loadFarmers}
                disabled={loading}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm hover:bg-white/90 disabled:opacity-60"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
              <Link
                href="/admin/dashboard"
                className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur hover:bg-white/20"
              >
                Dashboard
              </Link>
            </div>
          </div>

          <div className="relative z-10 mt-8 grid gap-3 md:grid-cols-3">
            <HeroStat label="Registered Farmers" value={String(gardeners.length)} />
            <HeroStat label="Active Farmers" value={String(activeFarmers)} />
            <HeroStat label="Assignments" value={String(assignments.length)} />
          </div>

          {message && (
            <div className="relative z-10 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
              {message}
            </div>
          )}
        </section>

        <section className="grid gap-5 py-5 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Farmer Accounts</h2>
                <p className="mt-1 text-sm text-slate-600">Select an account to review farmer details, resume photo, and access status.</p>
              </div>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search farmers"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
              />
            </div>

            <div className="mt-5 space-y-3">
              {filteredFarmers.length === 0 ? (
                <Empty text="No farmer accounts found." />
              ) : (
                filteredFarmers.map((gardener) => {
                  const profile = profileFor(gardener.email);
                  const isSelected = gardener.id === selectedFarmer?.id && !showRegistration;
                  return (
                    <button
                      key={gardener.id}
                      onClick={() => {
                        setSelectedFarmerId(gardener.id);
                        setShowRegistration(false);
                      }}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        isSelected
                          ? "border-emerald-400 bg-emerald-50 shadow-sm"
                          : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/50"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-lg font-black text-slate-950">{gardener.full_name || gardener.email}</p>
                          <p className="mt-1 text-sm font-bold text-slate-600">{gardener.email}</p>
                          <p className="mt-1 text-xs font-bold text-slate-500">
                            Created {formatDate(gardener.created_at)} - {assignmentCount(gardener.id)} assignment(s)
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Badge value={gardener.status || "PENDING"} />
                          <Badge value={profile?.role || "FARMER"} />
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
            {showRegistration ? (
              <RegistrationPanel
                copyRegistrationLink={copyRegistrationLink}
                close={() => setShowRegistration(false)}
              />
            ) : (
              <FarmerDetails
                farmer={selectedFarmer}
                profile={profileFor(selectedFarmer?.email)}
                assignments={assignmentCount(selectedFarmer?.id)}
                updateFarmerStatus={updateFarmerStatus}
              />
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

function Badge({ value }: { value: string }) {
  const status = String(value || "PENDING").toUpperCase();
  const style = status === "ACTIVE" || status === "APPROVED" || status === "FARMER"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : status === "SUSPENDED" || status === "REJECTED"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-amber-200 bg-amber-50 text-amber-800";

  return <span className={`rounded-full border px-3 py-1 text-xs font-black ${style}`}>{status}</span>;
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-black text-slate-950">{value || "Not provided"}</p>
    </div>
  );
}

function FarmerDetails({
  farmer,
  profile,
  assignments,
  updateFarmerStatus,
}: {
  farmer: AnyRow | null;
  profile: AnyRow | null;
  assignments: number;
  updateFarmerStatus: (row: AnyRow, status: string) => Promise<void>;
}) {
  if (!farmer) {
    return <Empty text="Select a farmer account to view details." />;
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Farmer Details</p>
          <h2 className="mt-3 text-3xl font-black text-slate-950">{farmer.full_name || farmer.email}</h2>
          <p className="mt-2 text-sm font-bold text-slate-600">{farmer.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge value={farmer.status || "PENDING"} />
          <Badge value={profile?.role || "FARMER"} />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <DetailItem label="Mobile" value={String(farmer.mobile || "")} />
        <DetailItem label="Assignments" value={`${assignments} tree assignment(s)`} />
        <DetailItem label="Account Status" value={String(profile?.account_status || farmer.status || "PENDING")} />
        <DetailItem label="Created" value={formatDate(farmer.created_at)} />
      </div>

      <div className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-slate-950">Resume/CV Photo</p>
            <p className="mt-1 text-xs font-bold text-slate-500">Submitted during admin farmer registration.</p>
          </div>
          {farmer.resume_url ? (
            <a
              href={farmer.resume_url}
              target="_blank"
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700"
            >
              Open Photo
            </a>
          ) : (
            <Badge value="NO PHOTO" />
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={() => updateFarmerStatus(farmer, "ACTIVE")}
          className="rounded-xl border border-emerald-200 bg-white px-4 py-3 text-xs font-black text-emerald-800 hover:bg-emerald-50"
        >
          Activate
        </button>
        <button
          onClick={() => updateFarmerStatus(farmer, "SUSPENDED")}
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-black text-red-800 hover:bg-red-100"
        >
          Suspend
        </button>
        <Link
          href="/admin/tree-registry"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-black text-amber-800 hover:bg-amber-100"
        >
          Assign Trees
        </Link>
      </div>
    </div>
  );
}

function RegistrationPanel({
  copyRegistrationLink,
  close,
}: {
  copyRegistrationLink: () => Promise<void>;
  close: () => void;
}) {
  const registrationLink = typeof window !== "undefined" ? `${window.location.origin}/farmer/register` : "/farmer/register";

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Registration Link</p>
          <h2 className="mt-3 text-3xl font-black text-slate-950">Farmer Registration</h2>
          <p className="mt-2 text-sm text-slate-600">
            Send this link to the farmer. The farmer will open the page, fill their details, upload resume photo, and create login access.
          </p>
        </div>
        <button
          onClick={close}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"
        >
          Close
        </button>
      </div>

      <div className="mt-5 grid gap-4">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5">
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Link to send</p>
          <p className="mt-3 break-all rounded-2xl border border-emerald-100 bg-white px-4 py-4 text-sm font-black text-slate-950">
            {registrationLink}
          </p>
        </div>
        <button
          onClick={copyRegistrationLink}
          className="rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          Copy Farmer Registration Link
        </button>
        <a
          href={registrationLink}
          target="_blank"
          className="rounded-2xl border border-emerald-100 bg-white px-6 py-4 text-center text-sm font-black text-emerald-900 hover:bg-emerald-50"
        >
          Open Registration Page
        </a>
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm font-bold leading-6 text-amber-900">
          After the farmer submits, their account will appear in this list for admin review and assignment.
        </div>
      </div>
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
