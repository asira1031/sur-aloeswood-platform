"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { formatDate, pick, statusClass, type AnyRow } from "@/app/lib/tree/utils";

export default function AdminLegalPage() {
  const [licenses, setLicenses] = useState<AnyRow[]>([]);
  const [trees, setTrees] = useState<AnyRow[]>([]);
  const [registry, setRegistry] = useState<AnyRow[]>([]);
  const [selected, setSelected] = useState<AnyRow | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
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

    if (licenseError) {
      setMessage(licenseError.message);
      setLoading(false);
      return;
    }

    setLicenses((licenseRows || []) as AnyRow[]);
    setTrees((treeRows || []) as AnyRow[]);
    setRegistry((registryRows || []) as AnyRow[]);
    setSelected((licenseRows || [])[0] || null);
    setLoading(false);
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

  const filtered = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return licenses.filter((license) => {
      const currentStatus = String(
        license.status || license.license_status || license.verification_status || "ACTIVE"
      ).toUpperCase();

      const statusOk = status === "ALL" || currentStatus === status;
      const searchOk = !keyword || JSON.stringify(license).toLowerCase().includes(keyword);

      return statusOk && searchOk;
    });
  }, [licenses, search, status]);

  const activeCount = licenses.filter((row) =>
    ["ACTIVE", "VALID", "APPROVED", "ISSUED", "VERIFIED"].includes(
      String(row.status || row.license_status || row.verification_status || "").toUpperCase()
    )
  ).length;

  const expiredCount = licenses.filter((row) =>
    ["EXPIRED", "REVOKED", "REJECTED", "INVALID"].includes(
      String(row.status || row.license_status || row.verification_status || "").toUpperCase()
    )
  ).length;

  return (
    <main className="min-h-screen bg-[#04140d] text-white">
      <section className="border-b border-white/10 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-green-300">
                SUR ALOESWOOD ADMIN
              </p>
              <h1 className="mt-4 text-4xl font-black md:text-6xl">Legal Compliance</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-green-50/80">
                Admin legal records, license status, tree registry verification, and compliance monitoring.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/admin/dashboard" className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black">
                Dashboard
              </Link>
              <Link href="/admin/tree-registry" className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black">
                Tree Registry
              </Link>
              <button
                onClick={loadLegal}
                disabled={loading}
                className="rounded-2xl bg-green-500 px-5 py-3 text-sm font-black text-green-950 disabled:bg-slate-500"
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>
          </div>

          {message && (
            <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">
              {message}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-8 md:grid-cols-2 md:px-10 xl:grid-cols-4">
        <Metric title="Legal Records" value={String(licenses.length)} />
        <Metric title="Active / Valid" value={String(activeCount)} />
        <Metric title="Expired / Invalid" value={String(expiredCount)} />
        <Metric title="Registry Records" value={String(registry.length)} />
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-16 md:px-10 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Legal Records</h2>

          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search license, permit, reference..."
              className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none"
            />
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none"
            >
              <option value="ALL">All</option>
              <option value="ACTIVE">Active</option>
              <option value="VALID">Valid</option>
              <option value="PENDING">Pending</option>
              <option value="EXPIRED">Expired</option>
              <option value="REVOKED">Revoked</option>
            </select>
          </div>

          <div className="mt-5 space-y-3">
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/25 p-6 text-sm font-bold text-white/60">
                No legal records found.
              </div>
            ) : (
              filtered.map((row, index) => {
                const currentStatus = row.status || row.license_status || row.verification_status || "ACTIVE";

                return (
                  <button
                    key={row.id || index}
                    onClick={() => setSelected(row)}
                    className={`w-full rounded-2xl border p-5 text-left ${
                      selected?.id === row.id ? "border-green-300 bg-green-400/15" : "border-white/10 bg-black/25"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-black text-green-200">
                          {pick(row, ["title", "name", "license_name", "certificate_name", "permit_name", "id"])}
                        </p>
                        <p className="mt-1 text-sm text-white/60">
                          {pick(row, ["license_number", "certificate_number", "permit_number", "reference_no"], "No reference")}
                        </p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(currentStatus)}`}>
                        {currentStatus}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-white/60">
                      <span>Issued: {formatDate(row.issued_at || row.issue_date || row.created_at)}</span>
                      <span>Expires: {formatDate(row.expires_at || row.expiry_date)}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
            <h2 className="text-3xl font-black">Legal Detail</h2>

            {!selected ? (
              <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-black/25 p-6 text-sm font-bold text-white/60">
                Select a legal record.
              </div>
            ) : (
              <>
                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  <Info label="Name" value={pick(selected, ["title", "name", "license_name", "certificate_name", "permit_name", "id"])} />
                  <Info label="Reference" value={pick(selected, ["license_number", "certificate_number", "permit_number", "reference_no"], "-")} />
                  <Info label="Status" value={pick(selected, ["status", "license_status", "verification_status"], "ACTIVE")} />
                  <Info label="Authority" value={pick(selected, ["issuer", "issuing_authority", "agency", "authority"], "-")} />
                  <Info label="Issued" value={formatDate(selected.issued_at || selected.issue_date || selected.created_at)} />
                  <Info label="Expires" value={formatDate(selected.expires_at || selected.expiry_date)} />
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-4">
                  <button disabled={busyId === selected.id} onClick={() => updateLicense(selected, "ACTIVE")} className="rounded-2xl bg-green-500 px-4 py-3 text-xs font-black text-green-950 disabled:bg-slate-500">
                    Active
                  </button>
                  <button disabled={busyId === selected.id} onClick={() => updateLicense(selected, "VALID")} className="rounded-2xl bg-green-500 px-4 py-3 text-xs font-black text-green-950 disabled:bg-slate-500">
                    Valid
                  </button>
                  <button disabled={busyId === selected.id} onClick={() => updateLicense(selected, "PENDING")} className="rounded-2xl bg-yellow-400 px-4 py-3 text-xs font-black text-yellow-950 disabled:bg-slate-500">
                    Pending
                  </button>
                  <button disabled={busyId === selected.id} onClick={() => updateLicense(selected, "EXPIRED")} className="rounded-2xl bg-red-500 px-4 py-3 text-xs font-black text-white disabled:bg-slate-500">
                    Expired
                  </button>
                </div>

                <details className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-5">
                  <summary className="cursor-pointer text-sm font-black text-green-200">Raw Legal Record</summary>
                  <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap text-xs text-white/65">
                    {JSON.stringify(selected, null, 2)}
                  </pre>
                </details>
              </>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
            <h2 className="text-3xl font-black">Compliance Summary</h2>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <Info label="Trees" value={String(trees.length)} />
              <Info label="Registry Records" value={String(registry.length)} />
              <Info label="Unverified Trees" value={String(Math.max(trees.length - registry.length, 0))} />
              <Info label="Legal Pending" value={String(licenses.length - activeCount - expiredCount)} />
            </div>
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
      <p className="mt-3 truncate text-xl font-black text-green-300">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/25 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-white/45">{label}</p>
      <p className="mt-2 text-sm font-black text-white">{value}</p>
    </div>
  );
}
