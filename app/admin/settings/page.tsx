"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { formatDate, getPublicSupportContacts, statusClass, type AnyRow } from "@/app/lib/settings/preferences";

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
    <main className="min-h-screen bg-[#04140d] text-white">
      <section className="border-b border-white/10 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-green-300">SUR ALOESWOOD ADMIN</p>
              <h1 className="mt-4 text-4xl font-black md:text-6xl">Platform Settings</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-green-50/80">
                Manage plantation sites, visible legal documents, support overview, and production readiness settings.
              </p>
            </div>
            <button onClick={loadSettings} className="rounded-2xl bg-green-500 px-5 py-3 text-sm font-black text-green-950">
              Refresh
            </button>
          </div>

          {message && <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-8 md:grid-cols-4 md:px-10">
        <Metric title="Co-Planters" value={String(profiles.length)} />
        <Metric title="Farms" value={String(farms.length)} />
        <Metric title="Legal Docs" value={String(licenses.length)} />
        <Metric title="Open Support" value={String(openTickets.length)} />
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-16 md:px-10 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Add Plantation Site</h2>

          <div className="mt-6 grid gap-4">
            <input value={farmName} onChange={(e) => setFarmName(e.target.value)} placeholder="Farm name" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
            <input value={farmLocation} onChange={(e) => setFarmLocation(e.target.value)} placeholder="Location" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
            <input value={farmGps} onChange={(e) => setFarmGps(e.target.value)} placeholder="GPS coordinates" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
            <input value={farmArea} onChange={(e) => setFarmArea(e.target.value)} type="number" placeholder="Total area" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
            <button onClick={addFarm} className="rounded-2xl bg-green-500 px-6 py-4 text-sm font-black text-green-950">Save Farm</button>
          </div>

          <div className="mt-8 space-y-3">
            {farms.map((farm) => (
              <div key={farm.id} className="rounded-2xl bg-black/25 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-green-200">{farm.farm_name}</p>
                    <p className="text-sm text-white/60">{farm.location || "-"}</p>
                    <p className="text-xs text-white/45">{farm.gps_coordinates || "GPS pending"}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(farm.status)}`}>{farm.status || "ACTIVE"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Legal / DENR Documents</h2>

          <div className="mt-6 grid gap-4">
            <input value={licenseTitle} onChange={(e) => setLicenseTitle(e.target.value)} placeholder="Document title" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
            <input value={licenseType} onChange={(e) => setLicenseType(e.target.value)} placeholder="Document type" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
            <input value={licenseUrl} onChange={(e) => setLicenseUrl(e.target.value)} placeholder="File URL" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
            <input value={licenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)} type="date" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
            <button onClick={addLicense} className="rounded-2xl bg-yellow-400 px-6 py-4 text-sm font-black text-yellow-950">Save Legal Document</button>
          </div>

          <div className="mt-8 space-y-3">
            {licenses.map((doc) => (
              <div key={doc.id} className="rounded-2xl bg-black/25 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-green-200">{doc.title}</p>
                    <p className="text-sm text-white/60">{doc.document_type || "Document"}</p>
                    <p className="text-xs text-white/45">Expiry: {formatDate(doc.expiry_date)}</p>
                  </div>
                  <button onClick={() => toggleLicenseVisibility(doc)} className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-black">
                    {doc.visible_to_coplanters ? "Visible" : "Hidden"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Support Settings</h2>
          <div className="mt-6 space-y-3">
            {getPublicSupportContacts().map((item) => (
              <div key={item.label} className="rounded-2xl bg-black/25 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-white/45">{item.label}</p>
                <p className="mt-2 font-black text-green-200">{item.value}</p>
              </div>
            ))}
            <div className="rounded-2xl bg-black/25 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-white/45">Unread Notifications</p>
              <p className="mt-2 font-black text-green-200">{unreadNotifications.length}</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Production Controls</h2>
          <div className="mt-6 space-y-3 text-sm leading-7 text-white/70">
            <p>Seedling price: ₱14,000 per tree.</p>
            <p>AG tree codes are generated after admin approval.</p>
            <p>Legal documents marked visible appear on the plantation page.</p>
            <p>Support tickets are managed in Admin Support Center.</p>
            <p>No guaranteed returns. Harvest depends on plantation performance, market conditions, and applicable laws.</p>
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
      <p className="mt-3 truncate text-2xl font-black text-green-300">{value}</p>
    </div>
  );
}
