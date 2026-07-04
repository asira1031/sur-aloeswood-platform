"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { formatDate, statusClass, type AnyRow } from "@/app/lib/coplanting/live";

export default function PlantationPage() {
  const [farms, setFarms] = useState<AnyRow[]>([]);
  const [licenses, setLicenses] = useState<AnyRow[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadPlantation();
  }, []);

  async function loadPlantation() {
    setMessage("");

    const [{ data: farmRows, error: farmError }, { data: licenseRows }] = await Promise.all([
      supabase.from("farms").select("id, farm_name, location, gps_coordinates, total_area, status, created_at").order("created_at", { ascending: false }),
      supabase.from("licenses").select("id, title, document_type, file_url, status, visible_to_coplanters, expiry_date, created_at").eq("visible_to_coplanters", true).order("created_at", { ascending: false }),
    ]);

    if (farmError) {
      setMessage(farmError.message);
      return;
    }

    setFarms((farmRows || []) as AnyRow[]);
    setLicenses((licenseRows || []) as AnyRow[]);
  }

  return (
    <main className="min-h-screen bg-[#06170f] text-white">
      <section className="border-b border-white/10 bg-gradient-to-r from-green-950 via-emerald-950 to-slate-950 px-6 py-10 lg:px-14">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-green-300">SUR ALOESWOOD</p>
            <h1 className="mt-3 text-4xl font-black lg:text-6xl">Plantation Timeline</h1>
            <p className="mt-3 max-w-3xl text-green-100/80">
              View plantation locations, legal documents, and co-planting milestones.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/investor/dashboard" className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black">Dashboard</Link>
            <Link href="/tree" className="rounded-2xl bg-green-500 px-5 py-3 text-sm font-black text-green-950">Tree Registry</Link>
          </div>
        </div>

        {message && <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
      </section>

      <section className="grid gap-6 px-6 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-14">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Plantation Sites</h2>
          <div className="mt-6 grid gap-4">
            {farms.length === 0 ? (
              <Empty text="No plantation sites found." />
            ) : farms.map((farm) => (
              <div key={farm.id} className="rounded-3xl border border-white/10 bg-black/25 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-2xl font-black text-green-200">{farm.farm_name}</p>
                    <p className="mt-1 text-sm text-white/60">{farm.location || "Location pending"}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(farm.status)}`}>{farm.status || "ACTIVE"}</span>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <Info label="GPS" value={farm.gps_coordinates || "Pending"} />
                  <Info label="Total Area" value={farm.total_area ? `${farm.total_area} ha` : "Pending"} />
                  <Info label="Created" value={formatDate(farm.created_at)} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Legal / DENR Documents</h2>
          <div className="mt-6 space-y-3">
            {licenses.length === 0 ? (
              <Empty text="No visible legal documents yet." />
            ) : licenses.map((doc) => (
              <div key={doc.id} className="rounded-2xl border border-white/10 bg-black/25 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black text-green-200">{doc.title}</p>
                    <p className="mt-1 text-sm text-white/60">{doc.document_type || "Document"}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(doc.status)}`}>{doc.status || "ACTIVE"}</span>
                </div>
                <p className="mt-3 text-xs font-bold text-white/50">Expiry: {formatDate(doc.expiry_date)}</p>
                {doc.file_url && <a href={doc.file_url} target="_blank" className="mt-3 block text-sm font-black text-yellow-300">Open Document →</a>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-16 lg:px-14">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Platform Timeline</h2>
          <div className="mt-8 space-y-5">
            <Timeline title="Registration" detail="Co-planter creates account and submits profile." />
            <Timeline title="Payment Submission" detail="Co-planter submits seedling purchase with payment reference." />
            <Timeline title="Admin Approval" detail="Admin verifies payment and approves purchase." />
            <Timeline title="AG Code Generation" detail="One sequential AG tree code is created per approved seedling." />
            <Timeline title="Tree Monitoring" detail="Farmer updates growth, photo, health, and field remarks." />
            <Timeline title="Harvest Window" detail="Estimated 3 to 5 years depending on plantation performance and inoculation schedule." />
          </div>
        </div>
      </section>
    </main>
  );
}

function Timeline({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="relative border-l border-green-300/30 pl-6">
      <div className="absolute -left-2 top-1 h-4 w-4 rounded-full bg-green-400" />
      <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
        <p className="text-xl font-black text-green-200">{title}</p>
        <p className="mt-2 text-sm leading-6 text-white/70">{detail}</p>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-black/25 p-4"><p className="text-xs font-bold uppercase tracking-wide text-white/45">{label}</p><p className="mt-2 text-sm font-black text-white">{value}</p></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm font-bold text-white/60">{text}</div>;
}
