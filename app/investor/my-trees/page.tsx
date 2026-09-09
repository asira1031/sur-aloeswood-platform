"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { getAuthenticatedProfile, type SurProfile } from "@/app/lib/auth/session";
import { supabase } from "@/app/lib/supabase/client";
import SimpleMyTrees from "@/app/components/SimpleMyTrees";

type Row = Record<string, unknown>;

type Contract = {
  id: string;
  version: string;
  legal_name: string;
  status: string;
  customer_signed_at: string | null;
  farm_signed_copy_path: string | null;
};

type Tree = Row & {
  id: string;
  tree_id: string;
  species: string;
  care_plan: string;
  status: string;
  general_location: string | null;
  planted_at: string | null;
  activated_at: string | null;
  created_at: string;
  contract: Contract | null;
};

function cleanContract(value: unknown): Contract | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return null;
  return row as Contract;
}

export default function MyAgarwoodPage() {
  return <SimpleMyTrees />;
}

function LegacyMyAgarwoodPage() {
  const [profile, setProfile] = useState<SurProfile | null>(null);
  const [trees, setTrees] = useState<Tree[]>([]);
  const [legacyTrees, setLegacyTrees] = useState<Row[]>([]);
  const [orders, setOrders] = useState<Row[]>([]);
  const [approvedUpdates, setApprovedUpdates] = useState<Row[]>([]);
  const [updatePeriod, setUpdatePeriod] = useState<"WEEKLY" | "MONTHLY">("WEEKLY");
  const [selectedTreeId, setSelectedTreeId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadPortfolio();
  }, []);

  async function loadPortfolio() {
    setLoading(true);
    setMessage("");

    const activeProfile = await getAuthenticatedProfile();
    if (!activeProfile) {
      setMessage("Your signed-in profile could not be verified. Please sign in again.");
      setLoading(false);
      return;
    }
    setProfile(activeProfile);

    const [treeResult, orderResult, legacyResult, updateResult] = await Promise.all([
      supabase
        .from("sur_trees")
        .select("id,tree_id,species,care_plan,status,general_location,planted_at,activated_at,created_at,replaced_tree_id,sur_contracts(id,version,legal_name,status,customer_signed_at,farm_signed_copy_path)")
        .eq("profile_id", activeProfile.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("sur_tree_orders")
        .select("id,order_no,status,exact_total,submitted_total,review_reason,created_at")
        .eq("profile_id", activeProfile.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("tree_registry")
        .select("id,tree_code,denr_tag_number,species,status,planted_at,created_at")
        .eq("profile_id", activeProfile.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("sur_tree_updates")
        .select("id,tree_id,observed_on,health_status,notes,photo_path,status,created_at")
        .eq("status", "APPROVED")
        .order("observed_on", { ascending: false })
        .limit(500),
    ]);

    if (treeResult.error) {
      setMessage(
        treeResult.error.code === "PGRST205"
          ? "My Agarwood is waiting for the one-time database setup. Please contact Agarwood Support Team."
          : "My Agarwood is temporarily unavailable. Your records are safe; please try again or contact support."
      );
    }

    const normalizedTrees = (treeResult.data || []).map((row) => ({
      ...row,
      contract: cleanContract(row.sur_contracts),
    })) as Tree[];

    setTrees(normalizedTrees);
    setOrders((orderResult.data || []) as Row[]);
    setLegacyTrees((legacyResult.data || []) as Row[]);
    const updatesWithLinks = await Promise.all(
      ((updateResult.data || []) as Row[]).map(async (row) => {
        const path = String(row.photo_path || "");
        if (!path) return row;
        const { data } = await supabase.storage.from("sur-tree-evidence").createSignedUrl(path, 600);
        return { ...row, photo_url: data?.signedUrl || "" };
      })
    );
    setApprovedUpdates(updatesWithLinks);
    setSelectedTreeId((current) =>
      normalizedTrees.some((tree) => tree.id === current)
        ? current
        : normalizedTrees[0]?.id || ""
    );
    setLoading(false);
  }

  const selectedTree = useMemo(
    () => trees.find((tree) => tree.id === selectedTreeId) || null,
    [selectedTreeId, trees]
  );
  const signatureCount = trees.filter(
    (tree) => tree.contract?.status === "CUSTOMER_SIGNATURE_PENDING"
  ).length;
  const activeCount = trees.filter((tree) => tree.status.startsWith("ACTIVE")).length;
  const pendingOrderCount = orders.filter((order) =>
    ["PENDING_VERIFICATION", "MANUAL_REVIEW"].includes(String(order.status))
  ).length;
  const selectedApprovedUpdates = approvedUpdates.filter((row) => String(row.tree_id) === selectedTreeId);
  const updateGroups = groupUpdates(selectedApprovedUpdates, updatePeriod);

  return (
    <main className="min-h-screen bg-[#07150f] text-white">
      <header className="border-b border-white/10 bg-gradient-to-br from-emerald-950 via-[#07150f] to-slate-950 px-4 py-7 sm:px-5 sm:py-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[.18em] text-emerald-300 sm:tracking-[.28em]">Your tree records</p>
              <h1 className="mt-3 text-3xl font-black sm:text-4xl lg:text-6xl">My Agarwood</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">
                Follow each Tree ID from payment approval to customer signature, farm assignment, planting, care, and eventual sale updates.
              </p>
            </div>
            <div className="grid w-full gap-3 sm:flex sm:w-auto sm:flex-wrap">
              <Link href="/investor/dashboard" className="mobile-primary-action inline-flex w-full items-center justify-center rounded-2xl border border-white/15 px-5 py-3 text-sm font-black sm:w-auto">Dashboard</Link>
              <Link href="/investor/marketplace" className="mobile-primary-action inline-flex w-full items-center justify-center rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black text-emerald-950 sm:w-auto">Buy a tree</Link>
            </div>
          </div>

          {message && (
            <p aria-live="polite" className="mt-5 rounded-2xl border border-amber-200/25 bg-amber-300/10 p-4 text-sm font-bold text-amber-100">
              {message}
            </p>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-3 py-5 sm:px-5 sm:py-7 lg:px-12">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Official Tree IDs" value={String(trees.length)} />
          <Metric label="Needs your signature" value={String(signatureCount)} warn={signatureCount > 0} />
          <Metric label="Active trees" value={String(activeCount)} />
          <Metric label="Orders in review" value={String(pendingOrderCount)} />
        </section>

        {signatureCount > 0 && (
          <section className="mt-5 rounded-[1.5rem] border border-amber-300/30 bg-amber-300/10 p-4 sm:rounded-[2rem] sm:p-6">
            <p className="text-xs font-black uppercase tracking-[.2em] text-amber-200">Your next action</p>
            <h2 className="mt-2 text-2xl font-black">Sign each approved tree contract</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-amber-50/75">
              The farm workflow starts only after the matching legal name signs the per-tree agreement. Open a tree below and choose Review & sign.
            </p>
          </section>
        )}

        <section className="mt-5 grid gap-5 lg:grid-cols-[.72fr_1.28fr]">
          <div className="min-w-0 rounded-[1.5rem] border border-white/10 bg-white/[.06] p-4 sm:rounded-[2rem] sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-2xl font-black">Official Tree IDs</h2>
                <p className="mt-1 text-xs text-white/45">One record and one contract per approved tree.</p>
              </div>
              <button onClick={loadPortfolio} className="mobile-primary-action shrink-0 rounded-xl border border-white/15 px-3 py-2 text-xs font-black">
                {loading ? "Loading…" : "Refresh"}
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {trees.length === 0 && !loading ? (
                <Empty asset="/app-assets/empty-my-trees-v1.png" text="No approved Tree ID yet. You may continue browsing while an order is being verified." />
              ) : (
                trees.map((tree) => (
                  <button
                    key={tree.id}
                    onClick={() => setSelectedTreeId(tree.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${selectedTreeId === tree.id ? "border-emerald-300 bg-emerald-300/10" : "border-white/10 bg-black/20 hover:border-white/25"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-black text-emerald-200">{tree.tree_id}</p>
                        <p className="mt-1 text-xs font-bold text-white/45">{tree.species}</p>
                      </div>
                      <Status value={tree.contract?.status || tree.status} />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="min-w-0 rounded-[1.5rem] border border-white/10 bg-white/[.06] p-4 sm:rounded-[2rem] sm:p-6">
            {!selectedTree ? (
              <Empty text="Select an official Tree ID to see its next step." />
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[.2em] text-white/40">Official Tree ID</p>
                    <h2 className="mt-2 break-words text-3xl font-black text-emerald-300">{selectedTree.tree_id}</h2>
                  </div>
                  <Status value={selectedTree.status} />
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <Info label="Species" value={selectedTree.species} />
                  <Info label="Care plan" value={label(selectedTree.care_plan)} />
                  <Info label="General location" value={selectedTree.general_location || "Assigned privately by the farm"} />
                  <Info label="Planted" value={dateText(selectedTree.planted_at) || "Waiting for farm update"} />
                  <Info label="Activated" value={dateText(selectedTree.activated_at) || "After your signature"} />
                  <Info label="QR tag" value="Prepared and attached by the farm/caretaker" />
                </div>

                <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-[.2em] text-white/40">Per-tree contract</p>
                      <h3 className="mt-2 text-xl font-black">{selectedTree.contract?.version || "Waiting for contract"}</h3>
                      <p className="mt-2 text-sm text-white/55">Legal name: {selectedTree.contract?.legal_name || profile?.full_name || "Not available"}</p>
                    </div>
                    <Status value={selectedTree.contract?.status || "PENDING"} />
                  </div>

                  {selectedTree.contract && (
                    <div className="mt-5 grid gap-3 sm:flex sm:flex-wrap">
                      <Link href={`/investor/contracts/${selectedTree.contract.id}`} className="mobile-primary-action inline-flex w-full items-center justify-center rounded-2xl bg-emerald-400 px-5 py-3 text-center text-sm font-black text-emerald-950 sm:w-auto">
                        {selectedTree.contract.status === "CUSTOMER_SIGNATURE_PENDING" ? "Review & sign" : "View contract record"}
                      </Link>
                      {selectedTree.contract.customer_signed_at && (
                        <span className="self-center text-xs font-bold text-white/45">Signed {dateText(selectedTree.contract.customer_signed_at)}</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-5 rounded-3xl bg-sky-400/10 p-5 text-sm leading-7 text-sky-100/75">
                  Farm details are private. You will see the Tree ID, species, important dates, official documents, and approved updates that belong to your tree—never another customer&apos;s farm data.
                </div>
              </>
            )}
          </div>
        </section>

        <section className="mt-5 min-w-0 rounded-[1.5rem] border border-white/10 bg-white/[.06] p-4 sm:rounded-[2rem] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">Approved care updates</h2>
              <p className="mt-2 text-sm leading-7 text-white/50">Daily caretaker evidence is shown here only after admin review, automatically grouped for easier reading.</p>
            </div>
            <div className="flex rounded-xl border border-white/10 bg-black/20 p-1">
              {(["WEEKLY", "MONTHLY"] as const).map((period) => (
                <button key={period} onClick={() => setUpdatePeriod(period)} className={`rounded-lg px-4 py-2 text-xs font-black ${updatePeriod === period ? "bg-emerald-400 text-emerald-950" : "text-white/55"}`}>{period === "WEEKLY" ? "Weekly" : "Monthly"}</button>
              ))}
            </div>
          </div>

          {!selectedTree ? (
            <div className="mt-5"><Empty text="Select an official Tree ID to read its care updates." /></div>
          ) : updateGroups.length === 0 ? (
            <div className="mt-5"><Empty text="No admin-approved caretaker update for this Tree ID yet." /></div>
          ) : (
            <div className="mt-5 space-y-4">
              {updateGroups.map((group) => (
                <div key={group.key} className="rounded-3xl border border-white/10 bg-black/20 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="font-black text-emerald-200">{group.label}</p><p className="mt-1 text-xs text-white/40">{group.rows.length} approved daily update{group.rows.length === 1 ? "" : "s"}</p></div>
                    <Status value={String(group.rows[0]?.health_status || "APPROVED")} />
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {group.rows.map((update) => (
                      <div key={String(update.id)} className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
                        <p className="text-xs font-black uppercase text-white/40">{dateText(String(update.observed_on))}</p>
                        <p className="mt-2 text-sm font-bold text-emerald-100">{label(String(update.health_status))}</p>
                        <p className="mt-2 text-sm leading-6 text-white/60">{String(update.notes)}</p>
                        {Boolean(update.photo_url) && <a href={String(update.photo_url)} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-black text-sky-300">View original photo (10-minute link) →</a>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-5 min-w-0 rounded-[1.5rem] border border-white/10 bg-white/[.06] p-4 sm:rounded-[2rem] sm:p-6">
          <h2 className="text-2xl font-black">Order status</h2>
          <p className="mt-2 text-sm text-white/50">You can keep browsing while the admin verifies your Maya payment.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {orders.length === 0 ? (
              <Empty text="No Maya tree order submitted yet." />
            ) : (
              orders.map((order) => (
                <div key={String(order.id)} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{String(order.order_no)}</p>
                      <p className="mt-1 text-xs text-white/45">Submitted {dateText(String(order.created_at))}</p>
                    </div>
                    <Status value={String(order.status)} />
                  </div>
                  {Boolean(order.review_reason) && <p className="mt-3 text-xs font-bold text-amber-100/75">Admin note: {String(order.review_reason)}</p>}
                </div>
              ))
            )}
          </div>
        </section>

        {legacyTrees.length > 0 && (
          <section className="mt-5 min-w-0 rounded-[1.5rem] border border-white/10 bg-white/[.04] p-4 sm:rounded-[2rem] sm:p-6">
            <h2 className="text-2xl font-black">Previous tree records</h2>
            <p className="mt-2 text-sm leading-7 text-white/50">These records are preserved from the earlier registry. Contact support if one needs conversion to the new per-tree contract workflow.</p>
            <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {legacyTrees.map((tree) => (
                <div key={String(tree.id)} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="font-black text-emerald-200">{String(tree.tree_code || tree.id)}</p>
                  <p className="mt-2 text-xs text-white/50">{String(tree.species || "Aquilaria malaccensis")}</p>
                  <div className="mt-3"><Status value={String(tree.status || "REGISTERED")} /></div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Metric({ label: metricLabel, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-3xl border p-5 ${warn ? "border-amber-300/30 bg-amber-300/10" : "border-white/10 bg-white/[.06]"}`}>
      <p className="text-xs font-black uppercase tracking-wide text-white/45">{metricLabel}</p>
      <p className={`mt-3 text-3xl font-black ${warn ? "text-amber-200" : "text-emerald-300"}`}>{value}</p>
    </div>
  );
}

function Info({ label: infoLabel, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/20 p-4">
      <p className="text-xs font-black uppercase text-white/35">{infoLabel}</p>
      <p className="mt-2 text-sm font-bold leading-6 text-white/85">{value}</p>
    </div>
  );
}

function Status({ value }: { value: string }) {
  const normalized = String(value || "PENDING").toUpperCase();
  const tone = normalized.includes("SIGNED") || normalized.startsWith("ACTIVE") || normalized === "APPROVED"
    ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200"
    : normalized.includes("REJECT") || normalized.includes("DEAD")
      ? "border-red-300/25 bg-red-300/10 text-red-200"
      : "border-amber-300/25 bg-amber-300/10 text-amber-100";
  return <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black ${tone}`}>{label(normalized)}</span>;
}

function label(value: string) {
  return String(value || "Pending").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateText(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

function groupUpdates(rows: Row[], period: "WEEKLY" | "MONTHLY") {
  const groups = new Map<string, { key: string; label: string; rows: Row[]; time: number }>();

  for (const row of rows) {
    const date = new Date(`${String(row.observed_on)}T00:00:00`);
    if (Number.isNaN(date.getTime())) continue;

    let key: string;
    let groupLabel: string;
    let time: number;

    if (period === "MONTHLY") {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      groupLabel = date.toLocaleDateString("en-PH", { year: "numeric", month: "long" });
      time = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
    } else {
      const monday = new Date(date);
      const day = monday.getDay() || 7;
      monday.setDate(monday.getDate() - day + 1);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      key = monday.toISOString().slice(0, 10);
      groupLabel = `${monday.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}–${sunday.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}`;
      time = monday.getTime();
    }

    const group = groups.get(key) || { key, label: groupLabel, rows: [], time };
    group.rows.push(row);
    groups.set(key, group);
  }

  return Array.from(groups.values())
    .map((group) => ({ ...group, rows: group.rows.sort((a, b) => String(b.observed_on).localeCompare(String(a.observed_on))) }))
    .sort((a, b) => b.time - a.time);
}

function Empty({ text, asset }: { text: string; asset?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-black/15 p-5 text-center text-sm font-bold text-white/50">
      {asset && <Image src={asset} alt="" width={180} height={180} className="mx-auto mb-3 h-32 w-32 object-contain sm:h-36 sm:w-36" />}
      <p>{text}</p>
    </div>
  );
}
