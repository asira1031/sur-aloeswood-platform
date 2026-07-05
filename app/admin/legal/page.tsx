"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { formatDate, pick, statusClass, type AnyRow } from "@/app/lib/tree/utils";

const complianceGroups = [
  "All Documents",
  "DENR / CITES",
  "Business Permits",
  "Tax / Receipts",
  "Co-Planter Legal",
  "Plantation Records",
];

function legalStatus(row: AnyRow | null) {
  if (!row) return "PENDING";
  return String(row.status || row.license_status || row.verification_status || "ACTIVE").toUpperCase();
}

function legalTitle(row: AnyRow | null) {
  if (!row) return "-";
  return pick(row, ["title", "name", "license_name", "certificate_name", "permit_name", "document_type", "id"], "-");
}

function legalReference(row: AnyRow | null) {
  if (!row) return "-";
  return pick(row, ["license_number", "certificate_number", "permit_number", "reference_no", "document_no"], "-");
}

function legalFile(row: AnyRow | null) {
  if (!row) return "";
  return pick(row, ["file_url", "document_url", "license_url", "permit_url", "url"], "");
}

function legalType(row: AnyRow | null) {
  if (!row) return "Document";
  return pick(row, ["document_type", "type", "category", "license_type"], "Document");
}

function expiryDate(row: AnyRow | null) {
  if (!row) return "";
  return row.expires_at || row.expiry_date || row.valid_until || "";
}

function daysUntil(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / 86400000);
}

function isGroupMatch(row: AnyRow, group: string) {
  if (group === "All Documents") return true;
  const text = `${legalTitle(row)} ${legalType(row)} ${legalReference(row)}`.toLowerCase();
  if (group === "DENR / CITES") return text.includes("denr") || text.includes("cites") || text.includes("wildlife");
  if (group === "Business Permits") return text.includes("business") || text.includes("mayor") || text.includes("permit") || text.includes("bir");
  if (group === "Tax / Receipts") return text.includes("tax") || text.includes("receipt") || text.includes("collection");
  if (group === "Co-Planter Legal") return text.includes("moa") || text.includes("agreement") || text.includes("certificate") || text.includes("co-planter");
  return text.includes("plantation") || text.includes("tree") || text.includes("gps") || text.includes("registry");
}

export default function AdminLegalPage() {
  const [licenses, setLicenses] = useState<AnyRow[]>([]);
  const [trees, setTrees] = useState<AnyRow[]>([]);
  const [registry, setRegistry] = useState<AnyRow[]>([]);
  const [selected, setSelected] = useState<AnyRow | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [group, setGroup] = useState("All Documents");
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadLegal();
  }, []);

  async function loadLegal() {
    setLoading(true);
    setMessage("");

    const [
      { data: licenseRows, error: licenseError },
      { data: treeRows },
      { data: registryRows },
    ] = await Promise.all([
      supabase.from("licenses").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("trees").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("tree_registry").select("*").order("created_at", { ascending: false }).limit(1000),
    ]);

    setLoading(false);

    if (licenseError) {
      setMessage(licenseError.message);
      return;
    }

    const safeLicenses = (licenseRows || []) as AnyRow[];
    setLicenses(safeLicenses);
    setTrees((treeRows || []) as AnyRow[]);
    setRegistry((registryRows || []) as AnyRow[]);
    setSelected((current) => safeLicenses.find((row) => row.id === current?.id) || safeLicenses[0] || null);
  }

  async function updateLicense(row: AnyRow, nextStatus: string) {
    if (!row.id) return;

    setBusyId(row.id);
    setMessage("");

    const payload: AnyRow = { status: nextStatus };
    if ("updated_at" in row) payload.updated_at = new Date().toISOString();

    const { error } = await supabase.from("licenses").update(payload).eq("id", row.id);

    if (error) {
      setMessage(error.message);
      setBusyId("");
      return;
    }

    setMessage(`Legal record updated to ${nextStatus}.`);
    await loadLegal();
    setBusyId("");
  }

  async function toggleVisibility(row: AnyRow) {
    if (!row.id || !("visible_to_coplanters" in row)) {
      setMessage("This legal table needs visible_to_coplanters column to control investor visibility.");
      return;
    }

    setBusyId(row.id);
    setMessage("");

    const { error } = await supabase
      .from("licenses")
      .update({ visible_to_coplanters: !row.visible_to_coplanters })
      .eq("id", row.id);

    if (error) {
      setMessage(error.message);
      setBusyId("");
      return;
    }

    setMessage(row.visible_to_coplanters ? "Document hidden from co-planters." : "Document visible to co-planters.");
    await loadLegal();
    setBusyId("");
  }

  const filtered = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return licenses.filter((license) => {
      const currentStatus = legalStatus(license);
      const statusOk = status === "ALL" || currentStatus === status;
      const groupOk = isGroupMatch(license, group);
      const searchOk = !keyword || JSON.stringify(license).toLowerCase().includes(keyword);
      return statusOk && groupOk && searchOk;
    });
  }, [licenses, search, status, group]);

  const activeCount = licenses.filter((row) =>
    ["ACTIVE", "VALID", "APPROVED", "ISSUED", "VERIFIED"].includes(legalStatus(row))
  ).length;

  const expiredCount = licenses.filter((row) =>
    ["EXPIRED", "REVOKED", "REJECTED", "INVALID"].includes(legalStatus(row))
  ).length;

  const pendingCount = licenses.filter((row) => ["PENDING", "UNDER_REVIEW", "DRAFT"].includes(legalStatus(row))).length;
  const expiringSoon = licenses.filter((row) => {
    const days = daysUntil(expiryDate(row));
    return days !== null && days >= 0 && days <= 60;
  }).length;
  const missingFileCount = licenses.filter((row) => !legalFile(row)).length;
  const visibleCount = licenses.filter((row) => row.visible_to_coplanters).length;
  const registryWithDenr = registry.filter((row) => row.denr_tag_number).length;

  return (
    <main className="min-h-screen bg-[#f3f7f1] text-slate-950">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-4 lg:px-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/20 p-6 shadow-sm lg:p-8">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/forest-bg.jpg')" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-green-950/92 via-green-900/70 to-green-950/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-white/75">SUR Aloeswood Admin</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-white lg:text-6xl">
                Legal Compliance
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/80 lg:text-base">
                View permits, DENR/CITES files, co-planter legal papers, expiry risks, and tree registry compliance in one readable workspace.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/admin/dashboard" className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur hover:bg-white/20">
                Dashboard
              </Link>
              <Link href="/admin/tree-registry" className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur hover:bg-white/20">
                Tree Registry
              </Link>
              <button
                onClick={loadLegal}
                disabled={loading}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm hover:bg-white/90 disabled:opacity-60"
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>
          </div>

          <div className="relative z-10 mt-8 grid gap-3 md:grid-cols-4">
            <HeroStat label="Legal Records" value={String(licenses.length)} />
            <HeroStat label="Valid / Active" value={String(activeCount)} />
            <HeroStat label="Needs Attention" value={String(expiredCount + pendingCount + expiringSoon + missingFileCount)} />
            <HeroStat label="Visible to Co-Planters" value={String(visibleCount)} />
          </div>

          {message && (
            <div className="relative z-10 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
              {message}
            </div>
          )}
        </section>

        <section className="grid gap-4 py-5 md:grid-cols-2 xl:grid-cols-5">
          <Metric tone="forest" title="Expired / Invalid" value={String(expiredCount)} detail="Immediate legal review" />
          <Metric tone="gold" title="Expiring 60 Days" value={String(expiringSoon)} detail="Renewal watchlist" />
          <Metric tone="mist" title="Missing Files" value={String(missingFileCount)} detail="Needs document URL" />
          <Metric tone="white" title="Registry Records" value={String(registry.length)} detail="Tree legal registry" />
          <Metric tone="forest" title="DENR Tagged" value={`${registryWithDenr}/${registry.length}`} detail="Tree tag coverage" />
        </section>

        <section className="grid gap-5 pb-8 xl:grid-cols-[0.9fr_1.25fr_0.85fr]">
          <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
            <div className="flex flex-col gap-3">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Legal Library</h2>
                <p className="mt-1 text-sm text-slate-600">Search by permit, agency, reference number, or document type.</p>
              </div>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search legal documents"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
              />
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
              >
                <option value="ALL">All status</option>
                <option value="ACTIVE">Active</option>
                <option value="VALID">Valid</option>
                <option value="PENDING">Pending</option>
                <option value="EXPIRED">Expired</option>
                <option value="REVOKED">Revoked</option>
              </select>
            </div>

            <div className="mt-5 grid gap-2">
              {complianceGroups.map((item) => (
                <button
                  key={item}
                  onClick={() => setGroup(item)}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm font-black transition ${
                    group === item ? "border-emerald-400 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-200"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="mt-5 space-y-3">
              {filtered.length === 0 ? (
                <Empty text="No legal records found." />
              ) : (
                filtered.map((row, index) => {
                  const currentStatus = legalStatus(row);
                  const days = daysUntil(expiryDate(row));
                  const needsAttention = ["EXPIRED", "REVOKED", "REJECTED", "INVALID", "PENDING"].includes(currentStatus) || (days !== null && days <= 60) || !legalFile(row);

                  return (
                    <button
                      key={row.id || index}
                      onClick={() => setSelected(row)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selected?.id === row.id ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-base font-black text-slate-950">{legalTitle(row)}</p>
                          <p className="mt-1 text-xs font-bold text-slate-500">{legalType(row)} - {legalReference(row)}</p>
                          <p className="mt-2 text-xs font-bold text-slate-400">Expires: {formatDate(expiryDate(row))}</p>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(currentStatus)}`}>
                          {currentStatus}
                        </span>
                      </div>
                      {needsAttention && (
                        <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-black text-red-800">
                          Needs review
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Document Viewer</h2>
                <p className="mt-1 text-sm text-slate-600">Readable legal detail with preview and quick status actions.</p>
              </div>
              {selected && <Badge value={legalStatus(selected)} />}
            </div>

            {!selected ? (
              <div className="mt-6">
                <Empty text="Select a legal document to view." />
              </div>
            ) : (
              <>
                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  <Info label="Document" value={legalTitle(selected)} />
                  <Info label="Type" value={legalType(selected)} />
                  <Info label="Reference" value={legalReference(selected)} />
                  <Info label="Authority" value={pick(selected, ["issuer", "issuing_authority", "agency", "authority"], "-")} />
                  <Info label="Issued" value={formatDate(selected.issued_at || selected.issue_date || selected.created_at)} />
                  <Info label="Expires" value={formatDate(expiryDate(selected))} />
                </div>

                <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-950">Legal File</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">Open this file for manual verification and reading.</p>
                    </div>
                    {legalFile(selected) ? (
                      <a href={legalFile(selected)} target="_blank" className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700">
                        Open Document
                      </a>
                    ) : (
                      <Badge value="NO FILE" tone="red" />
                    )}
                  </div>

                  {legalFile(selected) ? (
                    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      {String(legalFile(selected)).toLowerCase().includes(".pdf") ? (
                        <iframe src={legalFile(selected)} className="h-[460px] w-full" title="Legal document preview" />
                      ) : (
                        <img src={legalFile(selected)} alt="Legal document preview" className="max-h-[460px] w-full object-contain" />
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500">
                      Add a document URL in Admin Settings so this legal paper can be viewed here.
                    </div>
                  )}
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-5">
                  <button disabled={busyId === selected.id} onClick={() => updateLicense(selected, "ACTIVE")} className="rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-60">
                    Active
                  </button>
                  <button disabled={busyId === selected.id} onClick={() => updateLicense(selected, "VALID")} className="rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-60">
                    Valid
                  </button>
                  <button disabled={busyId === selected.id} onClick={() => updateLicense(selected, "PENDING")} className="rounded-2xl bg-amber-400 px-4 py-3 text-xs font-black text-amber-950 hover:bg-amber-300 disabled:opacity-60">
                    Pending
                  </button>
                  <button disabled={busyId === selected.id} onClick={() => updateLicense(selected, "EXPIRED")} className="rounded-2xl bg-red-600 px-4 py-3 text-xs font-black text-white hover:bg-red-700 disabled:opacity-60">
                    Expired
                  </button>
                  <button disabled={busyId === selected.id} onClick={() => toggleVisibility(selected)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-800 hover:bg-slate-50 disabled:opacity-60">
                    {selected.visible_to_coplanters ? "Hide" : "Show"}
                  </button>
                </div>

                <details className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <summary className="cursor-pointer text-sm font-black text-slate-800">Raw record for audit</summary>
                  <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap text-xs text-slate-600">
                    {JSON.stringify(selected, null, 2)}
                  </pre>
                </details>
              </>
            )}
          </section>

          <section className="space-y-5">
            <Panel title="Compliance Checklist">
              <ChecklistItem title="DENR / CITES document visible" good={licenses.some((row) => isGroupMatch(row, "DENR / CITES") && legalFile(row))} />
              <ChecklistItem title="Business permit recorded" good={licenses.some((row) => isGroupMatch(row, "Business Permits"))} />
              <ChecklistItem title="No expired legal records" good={expiredCount === 0} />
              <ChecklistItem title="No missing file URLs" good={missingFileCount === 0} />
              <ChecklistItem title="Co-planter visible papers ready" good={visibleCount > 0} />
              <ChecklistItem title="Tree registry has DENR tags" good={registry.length > 0 && registryWithDenr === registry.length} />
            </Panel>

            <Panel title="Tree Registry Compliance">
              <Info label="Tree Records" value={String(trees.length)} />
              <Info label="Registry Records" value={String(registry.length)} />
              <Info label="DENR Tagged" value={`${registryWithDenr}/${registry.length}`} />
              <Info label="Missing DENR Tags" value={String(Math.max(registry.length - registryWithDenr, 0))} />
              <Link href="/admin/tree-registry" className="mt-4 block rounded-2xl bg-emerald-600 px-5 py-4 text-center text-sm font-black text-white hover:bg-emerald-700">
                Open Tree Registry
              </Link>
            </Panel>

            <Panel title="Visibility">
              <p className="text-sm leading-6 text-slate-600">
                Documents marked visible appear on the public plantation/legal area for co-planter review.
              </p>
              <div className="mt-4 grid gap-3">
                <Info label="Visible Documents" value={String(visibleCount)} />
                <Info label="Hidden / Internal" value={String(Math.max(licenses.length - visibleCount, 0))} />
              </div>
              <Link href="/admin/settings" className="mt-4 block rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-center text-sm font-black text-emerald-900 hover:bg-emerald-100">
                Add Legal Document
              </Link>
            </Panel>
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

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black text-slate-950">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function ChecklistItem({ title, good }: { title: string; good: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="text-sm font-bold text-slate-700">{title}</span>
      <Badge value={good ? "READY" : "CHECK"} tone={good ? "green" : "red"} />
    </div>
  );
}

function Badge({ value, tone = "green" }: { value: string; tone?: "green" | "red" | "amber" }) {
  const normalized = String(value || "PENDING").toUpperCase();
  const autoTone =
    tone === "red" || ["EXPIRED", "REVOKED", "REJECTED", "INVALID", "NO FILE", "CHECK"].includes(normalized)
      ? "border-red-200 bg-red-50 text-red-800"
      : tone === "amber" || ["PENDING", "UNDER_REVIEW", "DRAFT"].includes(normalized)
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return <span className={`rounded-full border px-3 py-1 text-xs font-black ${autoTone}`}>{normalized}</span>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-black text-slate-950">{value || "-"}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">
      {text}
    </div>
  );
}
