"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";

type AnyRow = Record<string, any>;

type Owner = {
  id: string;
  name: string;
  email: string;
};

export default function AdminSeedlingListsPage() {
  const [rows, setRows] = useState<AnyRow[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [selectedTreeId, setSelectedTreeId] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    void loadRows();
  }, []);

  async function loadRows() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("admin_seedling_list_view")
      .select("*")
      .order("tree_created_at", { ascending: false });

    if (error) {
      setRows([]);
      setMessage(`${error.message}. Run the admin_seedling_list_view SQL first.`);
      setLoading(false);
      return;
    }

    const nextRows = (data || []) as AnyRow[];
    setRows(nextRows);

    const first = nextRows[0] || null;
    setSelectedOwnerId((current) => current || first?.profile_id || "");
    setSelectedTreeId((current) => current || first?.tree_id || "");

    setLoading(false);
  }

  async function sendCaretakerAlert(row: AnyRow | null) {
    if (!row) return;

    if (!row.caretaker_profile_id) {
      setMessage("No linked caretaker profile found. Assign or repair caretaker profile first.");
      return;
    }

    setSending(true);
    setMessage("");

    const { error } = await supabase.from("notifications").insert({
      profile_id: row.caretaker_profile_id,
      title: `Action needed for ${row.tree_code}`,
      message:
        row.seedling_status === "CARETAKER_DONE_NEEDS_ADMIN_VERIFY"
          ? `${row.tree_code} is marked complete but admin still needs visible tag/photo proof before tagging.`
          : `${row.tree_code} is pending attachment. Please submit tree photo, visible tag photo, and matching AG code.`,
      is_read: false,
      created_at: new Date().toISOString(),
    });

    if (error) {
      setMessage(error.message);
      setSending(false);
      return;
    }

    setMessage(`Alert sent to ${row.caretaker_name || "caretaker"} for ${row.tree_code}.`);
    setSending(false);
  }

  const owners = useMemo(() => {
    const map = new Map<string, Owner>();

    rows.forEach((row) => {
      const id = String(row.profile_id || "");
      if (!id) return;

      if (!map.has(id)) {
        map.set(id, {
          id,
          name: row.owner_name || "Unknown Owner",
          email: row.owner_email || "No email",
        });
      }
    });

    const keyword = search.toLowerCase().trim();

    return Array.from(map.values())
      .filter((owner) => {
        if (!keyword) return true;

        const ownerRows = rows.filter((row) => String(row.profile_id || "") === owner.id);
        const text = [
          owner.name,
          owner.email,
          ...ownerRows.map((row) => row.tree_code),
          ...ownerRows.map((row) => row.payment_reference),
        ]
          .join(" ")
          .toLowerCase();

        return text.includes(keyword);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, search]);

  const selectedOwner = owners.find((owner) => owner.id === selectedOwnerId) || owners[0] || null;
  const ownerRows = selectedOwner ? rows.filter((row) => String(row.profile_id || "") === selectedOwner.id) : [];
  const selectedRow = rows.find((row) => String(row.tree_id || "") === String(selectedTreeId)) || ownerRows[0] || rows[0] || null;

  const stats = {
    owners: owners.length,
    agCodes: rows.length,
    tagged: rows.filter((row) => row.seedling_status === "TAGGED").length,
    pending: rows.filter((row) => row.seedling_status !== "TAGGED").length,
  };

  return (
    <main className="min-h-screen bg-[#f3f7f1] text-slate-950">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-4 lg:px-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/20 p-6 shadow-sm lg:p-8">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/forest-bg.jpg')" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-green-950/92 via-green-900/70 to-green-950/22" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-emerald-100">SUR Aloeswood Admin</p>
              <h1 className="mt-4 text-4xl font-black text-white lg:text-6xl">Seedling Lists</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/80">
                Live AG code ownership, caretaker attachment, and tagging readiness.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={loadRows}
                disabled={loading}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-60"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
              <Link href="/admin/tree-maintenance" className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur">
                Tree Maintenance
              </Link>
              <Link href="/admin/tree-registry" className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur">
                Tree Registry
              </Link>
              <Link href="/admin/dashboard" className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur">
                Dashboard
              </Link>
            </div>
          </div>

          <div className="relative z-10 mt-8 grid gap-3 md:grid-cols-4">
            <HeroStat label="Owners" value={String(stats.owners)} />
            <HeroStat label="AG Codes" value={String(stats.agCodes)} />
            <HeroStat label="Tagged" value={String(stats.tagged)} />
            <HeroStat label="Pending" value={String(stats.pending)} />
          </div>

          {message && (
            <div className="relative z-10 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
              {message}
            </div>
          )}
        </section>

        <section className="grid gap-5 py-5 xl:grid-cols-[0.35fr_0.45fr_0.8fr]">
          <Panel title="Owners" subtitle="Co-planters with seedling purchases and AG codes.">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search owner, email, AG code, reference"
              className={controlClass}
            />

            <div className="mt-5 max-h-[720px] space-y-3 overflow-auto pr-1">
              {owners.length === 0 ? (
                <Empty text="No seedling owners found. If SQL has rows, run the admin_seedling_list_view SQL and refresh." />
              ) : (
                owners.map((owner) => {
                  const ownerAgRows = rows.filter((row) => String(row.profile_id || "") === owner.id);
                  const pending = ownerAgRows.filter((row) => row.seedling_status !== "TAGGED").length;
                  const selected = selectedOwner?.id === owner.id;

                  return (
                    <button
                      key={owner.id}
                      onClick={() => {
                        setSelectedOwnerId(owner.id);
                        setSelectedTreeId(ownerAgRows[0]?.tree_id || "");
                      }}
                      className={`w-full rounded-2xl border p-4 text-left ${
                        selected ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:border-emerald-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-black text-slate-950">{owner.name}</p>
                          <p className="mt-1 text-xs font-bold text-slate-500">{owner.email}</p>
                        </div>
                        {pending > 0 && <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-amber-950">{pending}</span>}
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <MiniMetric label="AG Codes" value={String(ownerAgRows.length)} />
                        <MiniMetric label="Pending" value={String(pending)} />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </Panel>

          <Panel title="AG Code List" subtitle="Select an AG code to inspect assignment and tagging status.">
            {!selectedOwner ? (
              <Empty text="Select an owner first." />
            ) : ownerRows.length === 0 ? (
              <Empty text="No AG codes under this owner." />
            ) : (
              <div className="max-h-[760px] space-y-3 overflow-auto pr-1">
                {ownerRows.map((row) => {
                  const selected = String(selectedRow?.tree_id || "") === String(row.tree_id || "");

                  return (
                    <button
                      key={row.tree_id}
                      onClick={() => setSelectedTreeId(row.tree_id)}
                      className={`w-full rounded-2xl border p-4 text-left ${
                        selected ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xl font-black text-slate-950">{row.tree_code}</p>
                          <p className="mt-1 text-xs font-bold text-slate-500">{row.tree_status || "NO STATUS"}</p>
                        </div>
                        <Badge status={row.seedling_status} />
                      </div>

                      <p className="mt-3 text-xs font-bold leading-5 text-slate-600">
                        Caretaker: {row.caretaker_name || "Unassigned"}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel title="Seedling Detail" subtitle="Owner, purchase, caretaker, and next action.">
            {!selectedRow ? (
              <Empty text="Select an AG code first." />
            ) : (
              <div className="space-y-5">
                <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-emerald-700">AG Code</p>
                      <h2 className="mt-2 text-3xl font-black text-slate-950">{selectedRow.tree_code}</h2>
                      <p className="mt-2 text-sm font-bold text-slate-600">
                        {selectedRow.owner_name} - {selectedRow.owner_email}
                      </p>
                    </div>
                    <Badge status={selectedRow.seedling_status} />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Info label="Owner" value={selectedRow.owner_name} />
                  <Info label="Owner Email" value={selectedRow.owner_email} />
                  <Info label="Purchase Status" value={selectedRow.purchase_status || "-"} />
                  <Info label="Payment Reference" value={selectedRow.payment_reference || "-"} />
                  <Info label="Tree Status" value={selectedRow.tree_status || "-"} />
                  <Info label="DENR / Tag Number" value={selectedRow.denr_tag_number || "Pending"} />
                  <Info label="Planted At" value={formatDate(selectedRow.planted_at)} />
                  <Info label="Caretaker" value={`${selectedRow.caretaker_name || "Unassigned"} ${selectedRow.caretaker_email ? `(${selectedRow.caretaker_email})` : ""}`} />
                  <Info label="Work Status" value={selectedRow.work_status || "-"} />
                  <Info label="Assignment Status" value={selectedRow.assignment_status || "-"} />
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <button
                    onClick={() => sendCaretakerAlert(selectedRow)}
                    disabled={sending}
                    className="rounded-2xl bg-amber-400 px-4 py-4 text-sm font-black text-amber-950 hover:bg-amber-300 disabled:opacity-60"
                  >
                    {sending ? "Sending..." : "Alert Caretaker"}
                  </button>
                  <Link href="/admin/tree-maintenance" className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-center text-sm font-black text-emerald-800">
                    Open Tree Maintenance
                  </Link>
                  <Link href="/admin/tree-registry" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-sm font-black text-slate-800">
                    Verify / Tag
                  </Link>
                </div>

                <details className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                  <summary className="cursor-pointer text-sm font-black text-slate-950">Raw Row</summary>
                  <pre className="mt-4 max-h-[360px] overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-600">
                    {JSON.stringify(selectedRow, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </Panel>
        </section>
      </div>
    </main>
  );
}

const controlClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400";

function formatDate(value: any) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusLabel(status: string) {
  if (status === "TAGGED") return "TAGGED";
  if (status === "CARETAKER_DONE_NEEDS_ADMIN_VERIFY") return "NEEDS ADMIN VERIFY";
  if (status === "CARETAKER_ASSIGNED") return "CARETAKER ASSIGNED";
  if (status === "NEEDS_CARETAKER") return "NEEDS CARETAKER";
  return status || "PENDING";
}

function statusClass(status: string) {
  if (status === "TAGGED") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "CARETAKER_DONE_NEEDS_ADMIN_VERIFY") return "border-blue-200 bg-blue-50 text-blue-800";
  if (status === "CARETAKER_ASSIGNED") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "NEEDS_CARETAKER") return "border-red-200 bg-red-50 text-red-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
      <h2 className="text-2xl font-black text-slate-950">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </section>
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

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white bg-white px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-black text-slate-950">{value || "-"}</p>
    </div>
  );
}

function Badge({ status }: { status: string }) {
  return <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(status)}`}>{statusLabel(status)}</span>;
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">
      {text}
    </div>
  );
}