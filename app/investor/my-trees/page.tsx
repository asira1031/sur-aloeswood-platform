"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import {
  formatDate,
  harvestEstimateText,
  latestLogForTree,
  logsForTree,
  peso,
  SEEDLING_PRICE,
  statusClass,
  treeDisplayCode,
  type AnyRow,
} from "@/app/lib/coplanting/live";

export default function CoPlanterMyTreesPage() {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<AnyRow | null>(null);
  const [trees, setTrees] = useState<AnyRow[]>([]);
  const [logs, setLogs] = useState<AnyRow[]>([]);
  const [selectedTreeId, setSelectedTreeId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sur_login_email") || "";
    setEmail(saved);
    if (saved) loadTrees(saved);
  }, []);

  async function loadTrees(targetEmail = email) {
    setLoading(true);
    setMessage("");

    const cleanEmail = targetEmail.toLowerCase().trim();

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, account_status, kyc_status, membership_status, referral_code")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (profileError || !profileRow) {
      setMessage(profileError?.message || "Profile not found.");
      setProfile(null);
      setTrees([]);
      setLogs([]);
      setLoading(false);
      return;
    }

    const { data: treeRows, error: treeError } = await supabase
      .from("tree_registry")
      .select("id, profile_id, purchase_id, tree_code, denr_tag_number, species, status, gps_lat, gps_lng, planted_at, created_at")
      .eq("profile_id", profileRow.id)
      .order("created_at", { ascending: false });

    if (treeError) {
      setMessage(treeError.message);
      setLoading(false);
      return;
    }

    const treeIds = (treeRows || []).map((tree: AnyRow) => tree.id);
    let logRows: AnyRow[] = [];

    if (treeIds.length > 0) {
      const { data } = await supabase
        .from("tree_growth_logs")
        .select("id, tree_id, height_cm, diameter_cm, health_status, remarks, photo_url, created_at")
        .in("tree_id", treeIds)
        .order("created_at", { ascending: false });

      logRows = (data || []) as AnyRow[];
    }

    setProfile(profileRow);
    setTrees((treeRows || []) as AnyRow[]);
    setLogs(logRows);
    setSelectedTreeId((treeRows?.[0] as AnyRow | undefined)?.id || "");
    localStorage.setItem("sur_login_email", cleanEmail);
    localStorage.setItem("sur_profile_id", profileRow.id);
    setLoading(false);
  }

  const selectedTree = useMemo(() => trees.find((tree) => tree.id === selectedTreeId) || null, [trees, selectedTreeId]);
  const selectedLogs = useMemo(() => selectedTree ? logsForTree(selectedTree.id, logs) : [], [selectedTree, logs]);
  const totalValue = trees.length * SEEDLING_PRICE;

  return (
    <main className="min-h-screen bg-[#06170f] text-white">
      <section className="border-b border-white/10 bg-gradient-to-r from-green-950 via-emerald-950 to-slate-950 px-6 py-8 lg:px-14">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-green-300">SUR ALOESWOOD CO-PLANTER</p>
            <h1 className="mt-3 text-4xl font-black lg:text-6xl">My AG Trees</h1>
            <p className="mt-3 max-w-3xl text-green-100/80">
              Live co-planter tree portfolio with AG codes, DENR tags, GPS, photo updates, and growth monitoring.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/investor/dashboard" className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black">Dashboard</Link>
            <Link href="/investor/marketplace" className="rounded-2xl bg-green-500 px-5 py-3 text-sm font-black text-green-950">Buy Seedlings</Link>
          </div>
        </div>

        <div className="mt-8 grid gap-3 rounded-3xl border border-white/10 bg-white/10 p-4 md:grid-cols-[1fr_auto]">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Registered email" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
          <button onClick={() => loadTrees()} disabled={loading} className="rounded-2xl bg-green-500 px-8 py-4 text-sm font-black text-green-950 disabled:bg-slate-500">{loading ? "Loading..." : "Load Trees"}</button>
        </div>

        {message && <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
      </section>

      <section className="grid gap-5 px-6 py-8 md:grid-cols-4 lg:px-14">
        <Metric title="Co-Planter" value={profile?.full_name || "Not loaded"} />
        <Metric title="AG Trees" value={String(trees.length)} />
        <Metric title="Portfolio Value" value={peso(totalValue)} />
        <Metric title="Growth Logs" value={String(logs.length)} />
      </section>

      <section className="grid gap-6 px-6 pb-16 lg:grid-cols-[1fr_0.9fr] lg:px-14">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Tree Cards</h2>

          <div className="mt-6 grid gap-4">
            {trees.length === 0 ? (
              <Empty text="No AG trees yet. Approved seedling purchases will appear here." />
            ) : trees.map((tree) => {
              const latest = latestLogForTree(tree.id, logs);

              return (
                <button
                  key={tree.id}
                  onClick={() => setSelectedTreeId(tree.id)}
                  className={`overflow-hidden rounded-3xl border text-left ${selectedTreeId === tree.id ? "border-yellow-300 bg-yellow-400/10" : "border-white/10 bg-black/20"}`}
                >
                  {latest?.photo_url && (
                    <div className="h-52 bg-black/30">
                      <img src={latest.photo_url} alt="Tree latest update" className="h-full w-full object-cover" />
                    </div>
                  )}

                  <div className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.25em] text-green-300">AG Tree Code</p>
                        <h3 className="mt-1 text-3xl font-black text-yellow-300">{treeDisplayCode(tree)}</h3>
                        <p className="mt-1 text-sm text-white/70">{tree.species || "Aquilaria Malaccensis"}</p>
                      </div>

                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(tree.status)}`}>{tree.status || "REGISTERED"}</span>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      <Info label="DENR Tag" value={tree.denr_tag_number || "Pending"} />
                      <Info label="GPS" value={tree.gps_lat && tree.gps_lng ? `${tree.gps_lat}, ${tree.gps_lng}` : "Pending"} />
                      <Info label="Planted" value={formatDate(tree.planted_at)} />
                    </div>

                    <div className="mt-4 rounded-2xl bg-black/25 p-4">
                      <p className="text-xs font-black uppercase tracking-wide text-green-200/70">Latest Growth</p>
                      <p className="mt-2 text-sm text-white/75">{latest?.remarks || "No growth update yet."}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
            <h2 className="text-3xl font-black">Selected Tree</h2>

            {!selectedTree ? (
              <Empty text="Select a tree." />
            ) : (
              <div className="mt-6 space-y-3">
                <Info label="AG Code" value={treeDisplayCode(selectedTree)} />
                <Info label="DENR Tag" value={selectedTree.denr_tag_number || "Pending"} />
                <Info label="Species" value={selectedTree.species || "Aquilaria Malaccensis"} />
                <Info label="Status" value={selectedTree.status || "REGISTERED"} />
                <Info label="GPS Latitude" value={selectedTree.gps_lat || "Pending"} />
                <Info label="GPS Longitude" value={selectedTree.gps_lng || "Pending"} />
                <Info label="Planted" value={formatDate(selectedTree.planted_at)} />
                <Info label="Harvest Estimate" value={harvestEstimateText(selectedTree)} />
                <Link href={`/certificates?tree=${selectedTree.id}`} className="block rounded-2xl bg-yellow-400 px-5 py-4 text-center text-sm font-black text-yellow-950">Open Certificate Preview</Link>
              </div>
            )}
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
            <h2 className="text-3xl font-black">Growth Timeline</h2>

            <div className="mt-6 space-y-4">
              {selectedLogs.length === 0 ? (
                <Empty text="No growth timeline yet." />
              ) : selectedLogs.map((log) => (
                <div key={log.id} className="rounded-2xl border border-white/10 bg-black/25 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-green-200">{formatDate(log.created_at)}</p>
                      <p className="mt-2 text-sm text-white/70">{log.remarks || "No remarks"}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(log.health_status)}`}>{log.health_status || "LOGGED"}</span>
                  </div>

                  <div className="mt-4 grid gap-2 text-xs font-bold text-white/60 md:grid-cols-3">
                    <span>Height: {log.height_cm || "-"} cm</span>
                    <span>Diameter: {log.diameter_cm || "-"} cm</span>
                    <span>Photo: {log.photo_url ? "Available" : "None"}</span>
                  </div>

                  {log.photo_url && (
                    <a href={log.photo_url} target="_blank" className="mt-3 block text-sm font-black text-yellow-300">
                      View Photo →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pb-12 lg:px-14">
        <p className="text-xs leading-6 text-green-100/60">
          Disclaimer: No guaranteed returns. Actual harvest depends on plantation performance, market conditions, inoculation schedule, and applicable laws.
        </p>
      </section>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5">
      <p className="text-xs font-black uppercase tracking-wide text-green-100/60">{title}</p>
      <p className="mt-3 truncate text-xl font-black text-green-300">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-black/25 px-4 py-3">
      <span className="text-sm text-white/50">{label}</span>
      <span className="text-right text-sm font-black text-white">{value}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm font-bold text-white/60">{text}</div>;
}
