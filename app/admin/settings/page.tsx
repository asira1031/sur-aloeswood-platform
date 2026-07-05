"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { formatDate, getPublicSupportContacts, statusClass, type AnyRow } from "@/app/lib/settings/preferences";
import {
  COPLANTER_PACKAGE_PRICE,
  peso,
  projectionDisclaimer,
} from "@/app/lib/business/rules";

export default function AdminSettingsPage() {
  const [profiles, setProfiles] = useState<AnyRow[]>([]);
  const [licenses, setLicenses] = useState<AnyRow[]>([]);
  const [farms, setFarms] = useState<AnyRow[]>([]);
  const [tickets, setTickets] = useState<AnyRow[]>([]);
  const [notifications, setNotifications] = useState<AnyRow[]>([]);
  const [message, setMessage] = useState("");

  const [farmName, setFarmName] = useState("");
  const [farmLocation, setFarmLocation] = useState("");
  const [farmGps, setFarmGps] = useState("");
  const [farmArea, setFarmArea] = useState("");

  const [licenseTitle, setLicenseTitle] = useState("");
  const [licenseType, setLicenseType] = useState("");
  const [licenseUrl, setLicenseUrl] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setMessage("");

    const [
      { data: profileRows },
      { data: licenseRows, error: licenseError },
      { data: farmRows },
      { data: ticketRows },
      { data: noticeRows },
    ] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, role, account_status, kyc_status, membership_status, created_at").limit(1000),
      supabase.from("licenses").select("id, title, document_type, file_url, status, visible_to_coplanters, expiry_date, created_at").order("created_at", { ascending: false }),
      supabase.from("farms").select("id, farm_name, location, gps_coordinates, total_area, status, created_at").order("created_at", { ascending: false }),
      supabase.from("support_tickets").select("id, profile_id, subject, message, status, created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("notifications").select("id, profile_id, title, message, is_read, created_at").order("created_at", { ascending: false }).limit(100),
    ]);

    if (licenseError) {
      setMessage(licenseError.message);
      return;
    }

    setProfiles((profileRows || []) as AnyRow[]);
    setLicenses((licenseRows || []) as AnyRow[]);
    setFarms((farmRows || []) as AnyRow[]);
    setTickets((ticketRows || []) as AnyRow[]);
    setNotifications((noticeRows || []) as AnyRow[]);
  }

  async function addFarm() {
    if (!farmName.trim()) {
      setMessage("Farm name is required.");
      return;
    }

    const { error } = await supabase.from("farms").insert({
      farm_name: farmName.trim(),
      location: farmLocation.trim() || null,
      gps_coordinates: farmGps.trim() || null,
      total_area: farmArea ? Number(farmArea) : null,
      status: "ACTIVE",
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setFarmName("");
    setFarmLocation("");
    setFarmGps("");
    setFarmArea("");
    setMessage("Farm added.");
    await loadSettings();
  }

  async function addLicense() {
    if (!licenseTitle.trim()) {
      setMessage("Document title is required.");
      return;
    }

    const { error } = await supabase.from("licenses").insert({
      title: licenseTitle.trim(),
      document_type: licenseType.trim() || "DOCUMENT",
      file_url: licenseUrl.trim() || null,
      status: "ACTIVE",
      visible_to_coplanters: true,
      expiry_date: licenseExpiry || null,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setLicenseTitle("");
    setLicenseType("");
    setLicenseUrl("");
    setLicenseExpiry("");
    setMessage("Legal document added.");
    await loadSettings();
  }

  async function toggleLicenseVisibility(row: AnyRow) {
    const { error } = await supabase
      .from("licenses")
      .update({ visible_to_coplanters: !row.visible_to_coplanters })
      .eq("id", row.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadSettings();
  }

  const openTickets = useMemo(() => tickets.filter((t) => String(t.status || "").toUpperCase() === "OPEN"), [tickets]);
  const unreadNotifications = useMemo(() => notifications.filter((n) => !n.is_read), [notifications]);

  return (
    <main className="min-h-screen bg-[#f3f7f1] text-slate-950">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-4 lg:px-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/20 p-6 shadow-sm lg:p-8">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/forest-bg.jpg')" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-green-950/90 via-green-900/66 to-green-950/18" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10" />

          <div className="relative z-10 flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-white/75">SUR Aloeswood Admin</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-white lg:text-6xl">Platform Settings</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/78 lg:text-base">
                Manage plantation sites, visible legal documents, support overview, and production readiness settings.
              </p>
            </div>
            <button onClick={loadSettings} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm hover:bg-white/90">
              Refresh
            </button>
          </div>

          <div className="relative z-10 mt-8 grid gap-3 md:grid-cols-4">
            <HeroStat label="Co-Planters" value={String(profiles.length)} />
            <HeroStat label="Farms" value={String(farms.length)} />
            <HeroStat label="Legal Docs" value={String(licenses.length)} />
            <HeroStat label="Open Support" value={String(openTickets.length)} />
          </div>

          {message && (
            <div className="relative z-10 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
              {message}
            </div>
          )}
        </section>

        <section className="grid gap-5 py-5 md:grid-cols-4">
          <Metric tone="white" title="Co-Planters" value={String(profiles.length)} detail="Registered accounts" />
          <Metric tone="forest" title="Farms" value={String(farms.length)} detail="Plantation sites" />
          <Metric tone="gold" title="Legal Docs" value={String(licenses.length)} detail="Visible compliance" />
          <Metric tone="mist" title="Open Support" value={String(openTickets.length)} detail="Needs response" />
        </section>

        <section className="grid gap-6 pb-16 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
          <h2 className="text-2xl font-black text-slate-950">Add Plantation Site</h2>

          <div className="mt-6 grid gap-4">
            <input value={farmName} onChange={(e) => setFarmName(e.target.value)} placeholder="Farm name" className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400" />
            <input value={farmLocation} onChange={(e) => setFarmLocation(e.target.value)} placeholder="Location" className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400" />
            <input value={farmGps} onChange={(e) => setFarmGps(e.target.value)} placeholder="GPS coordinates" className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400" />
            <input value={farmArea} onChange={(e) => setFarmArea(e.target.value)} type="number" placeholder="Total area" className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400" />
            <button onClick={addFarm} className="rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black text-white hover:bg-emerald-700">Save Farm</button>
          </div>

          <div className="mt-8 space-y-3">
            {farms.map((farm) => (
              <div key={farm.id} className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">{farm.farm_name}</p>
                    <p className="text-sm font-bold text-slate-600">{farm.location || "-"}</p>
                    <p className="text-xs font-bold text-slate-500">{farm.gps_coordinates || "GPS pending"}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(farm.status)}`}>{farm.status || "ACTIVE"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

          <div className="rounded-[2rem] border border-amber-100 bg-amber-50/75 p-5 shadow-sm lg:p-6">
          <h2 className="text-2xl font-black text-slate-950">Legal / DENR Documents</h2>

          <div className="mt-6 grid gap-4">
            <input value={licenseTitle} onChange={(e) => setLicenseTitle(e.target.value)} placeholder="Document title" className="rounded-2xl border border-amber-100 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-amber-400" />
            <input value={licenseType} onChange={(e) => setLicenseType(e.target.value)} placeholder="Document type" className="rounded-2xl border border-amber-100 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-amber-400" />
            <input value={licenseUrl} onChange={(e) => setLicenseUrl(e.target.value)} placeholder="File URL" className="rounded-2xl border border-amber-100 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-amber-400" />
            <input value={licenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)} type="date" className="rounded-2xl border border-amber-100 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-amber-400" />
            <button onClick={addLicense} className="rounded-2xl bg-amber-400 px-6 py-4 text-sm font-black text-amber-950 hover:bg-amber-300">Save Legal Document</button>
          </div>

          <div className="mt-8 space-y-3">
            {licenses.map((doc) => (
              <div key={doc.id} className="rounded-2xl border border-white bg-white/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">{doc.title}</p>
                    <p className="text-sm font-bold text-slate-600">{doc.document_type || "Document"}</p>
                    <p className="text-xs font-bold text-slate-500">Expiry: {formatDate(doc.expiry_date)}</p>
                  </div>
                  <button onClick={() => toggleLicenseVisibility(doc)} className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-black text-amber-900">
                    {doc.visible_to_coplanters ? "Visible" : "Hidden"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

          <div className="rounded-[2rem] border border-teal-100 bg-teal-50/75 p-5 shadow-sm lg:p-6">
          <h2 className="text-2xl font-black text-slate-950">Support Settings</h2>
          <div className="mt-6 space-y-3">
            {getPublicSupportContacts().map((item) => (
              <div key={item.label} className="rounded-2xl border border-white bg-white/80 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{item.label}</p>
                <p className="mt-2 font-black text-slate-950">{item.value}</p>
              </div>
            ))}
            <div className="rounded-2xl border border-white bg-white/80 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Unread Notifications</p>
              <p className="mt-2 font-black text-slate-950">{unreadNotifications.length}</p>
            </div>
          </div>
        </div>

          <div className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
          <h2 className="text-2xl font-black text-slate-950">Production Controls</h2>
          <div className="mt-6 space-y-3 text-sm font-bold leading-7 text-slate-600">
            <p>Co-Planter package price: {peso(COPLANTER_PACKAGE_PRICE)} per package.</p>
            <p>AG tree codes are generated after admin approval.</p>
            <p>Legal documents marked visible appear on the plantation page.</p>
            <p>Support tickets are managed in Admin Support Center.</p>
            <p>{projectionDisclaimer}</p>
          </div>
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
