"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const pdfUrl = "/legal/company-profile.pdf";

const legalDocs = [
  {
    group: "DENR / Wildlife",
    title: "Wildlife Culture Permit (WCuP)",
    agency: "DENR Region 12",
    page: 57,
    summary: "Primary DENR wildlife culture authority reference for agarwood plantation legality.",
  },
  {
    group: "Corporate Registration",
    title: "SEC Registration",
    agency: "Securities and Exchange Commission",
    page: 58,
    summary: "Corporate registration record for SUR Aloeswood Corporation.",
  },
  {
    group: "Corporate Registration",
    title: "Certificate of Registration",
    agency: "SEC / BIR reference",
    page: 60,
    summary: "Registration certificate reference used for company verification.",
  },
  {
    group: "Local Permits",
    title: "Business Permit 2026",
    agency: "Local Government Unit",
    page: 62,
    summary: "Current business permit reference for operating compliance.",
  },
  {
    group: "Plantation Rights",
    title: "Plantation Lease Contract",
    agency: "15-year first plantation lease",
    page: 63,
    summary: "Plantation land-use document supporting long-term site operation.",
  },
  {
    group: "Corporate Registration",
    title: "SEC GIS Updated 2026",
    agency: "Securities and Exchange Commission",
    page: 65,
    summary: "Updated General Information Sheet reference for 2026 records.",
  },
  {
    group: "Sister Company",
    title: "SOAR Aloeswood Agriventures Permits",
    agency: "SOAR Aloeswood Agriventures Corporation",
    page: 68,
    summary: "Sister-company permits and legalities reference connected to the group profile.",
  },
  {
    group: "Sister Company",
    title: "SOAR Business Permit 2026",
    agency: "Local Government Unit",
    page: 69,
    summary: "Business permit reference for SOAR Aloeswood Agriventures.",
  },
  {
    group: "Sister Company",
    title: "SOAR SEC Authentication",
    agency: "Securities and Exchange Commission",
    page: 70,
    summary: "SEC authentication reference for SOAR Aloeswood Agriventures.",
  },
  {
    group: "Corporate Registration",
    title: "Information Sheet",
    agency: "Corporate compliance file",
    page: 72,
    summary: "Company information sheet used for due diligence review.",
  },
  {
    group: "Receipts",
    title: "Acknowledgement Receipt",
    agency: "Company payment record",
    page: 73,
    summary: "Receipt reference connected to the company profile legal section.",
  },
  {
    group: "Co-Planter Legal",
    title: "Memorandum of Agreement - Co-Planter",
    agency: "SUR Aloeswood Corporation",
    page: 74,
    summary: "Co-planter MOA pages for terms, rights, responsibilities, and legal agreement review.",
  },
  {
    group: "Co-Planter Legal",
    title: "Tree Planting Certificate",
    agency: "SUR Aloeswood Corporation",
    page: 78,
    summary: "Certificate template/reference for assigned AG tree documentation.",
  },
];

const groups = ["All", ...Array.from(new Set(legalDocs.map((doc) => doc.group)))];

export default function LegalitiesPage() {
  const [group, setGroup] = useState("All");
  const [selectedPage, setSelectedPage] = useState(57);

  const filtered = useMemo(
    () => legalDocs.filter((doc) => group === "All" || doc.group === group),
    [group]
  );

  const selectedDoc = legalDocs.find((doc) => doc.page === selectedPage) || legalDocs[0];

  return (
    <main className="min-h-screen bg-[#f3f7f1] text-slate-950">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-4 lg:px-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/20 p-6 shadow-sm lg:p-8">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/forest-bg.jpg')" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-green-950/92 via-green-900/72 to-green-950/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-emerald-200">Company Profile Legalities</p>
              <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight text-white lg:text-6xl">
                Permits, Licenses, and Co-Planter Legal Papers
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/80 lg:text-base">
                App-ready legal library sourced from Company Profile pages 57 to 78. Use this area for review, co-planter transparency, and admin verification.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/investor/dashboard" className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur hover:bg-white/20">
                Dashboard
              </Link>
              <a href={`${pdfUrl}#page=57`} target="_blank" className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm hover:bg-white/90">
                Open Source PDF
              </a>
            </div>
          </div>

          <div className="relative z-10 mt-8 grid gap-3 md:grid-cols-4">
            <HeroStat label="Source Pages" value="57-78" />
            <HeroStat label="Legal Items" value={String(legalDocs.length)} />
            <HeroStat label="Categories" value={String(groups.length - 1)} />
            <HeroStat label="Source" value="Company Profile" />
          </div>
        </section>

        <section className="grid gap-5 py-5 xl:grid-cols-[0.76fr_1.24fr]">
          <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
            <div>
              <h2 className="text-2xl font-black text-slate-950">Legal Index</h2>
              <p className="mt-1 text-sm text-slate-600">Choose a document to preview the exact source page.</p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {groups.map((item) => (
                <button
                  key={item}
                  onClick={() => setGroup(item)}
                  className={`rounded-full border px-4 py-2 text-xs font-black ${
                    group === item ? "border-emerald-500 bg-emerald-600 text-white" : "border-emerald-100 bg-emerald-50 text-emerald-900"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-3">
              {filtered.map((doc) => (
                <button
                  key={`${doc.title}-${doc.page}`}
                  onClick={() => setSelectedPage(doc.page)}
                  className={`rounded-[1.5rem] border p-4 text-left transition ${
                    selectedPage === doc.page ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100" : "border-slate-200 bg-slate-50 hover:border-emerald-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black uppercase tracking-wide text-emerald-700">{doc.group}</p>
                      <h3 className="mt-2 text-lg font-black text-slate-950">{doc.title}</h3>
                      <p className="mt-1 text-sm font-bold text-slate-500">{doc.agency}</p>
                    </div>
                    <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-black text-emerald-800">
                      Page {doc.page}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{doc.summary}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">{selectedDoc.group}</p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">{selectedDoc.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{selectedDoc.summary}</p>
              </div>
              <a href={`${pdfUrl}#page=${selectedDoc.page}`} target="_blank" className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700">
                Open Page {selectedDoc.page}
              </a>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <Info label="Source" value="Company Profile PDF" />
              <Info label="Page" value={String(selectedDoc.page)} />
              <Info label="Authority / File" value={selectedDoc.agency} />
            </div>

            <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-50">
              <iframe
                key={selectedDoc.page}
                src={`${pdfUrl}#page=${selectedDoc.page}`}
                className="h-[760px] w-full bg-white"
                title={`${selectedDoc.title} preview`}
              />
            </div>
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}
