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
    async function bootstrap() {
      const saved = localStorage.getItem("sur_login_email") || "";
      const { data } = await supabase.auth.getUser();
      const authEmail = data.user?.email?.toLowerCase().trim() || "";
      const preferredEmail = saved || authEmail;

      setEmail(preferredEmail);
      if (preferredEmail) loadTrees(preferredEmail);
    }

    bootstrap();
  }, []);

  async function loadTrees(targetEmail = email) {
    setLoading(true);
    setMessage("");

    const cleanEmail = targetEmail.toLowerCase().trim();

    if (!cleanEmail) {
      setMessage("Login first, or enter the registered co-planter email.");
      setLoading(false);
      return;
    }

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
  const selectedLatestLog = selectedTree ? latestLogForTree(selectedTree.id, logs) : null;
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

        {message && <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
      </section>

      <section className="grid gap-5 px-6 py-8 md:grid-cols-4 lg:px-14">
        <Metric title="Co-Planter" value={profile?.full_name || "Not loaded"} />
        <Metric title="AG Trees" value={String(trees.length)} />
        <Metric title="Portfolio Value" value={peso(totalValue)} />
        <Metric title="Growth Logs" value={String(logs.length)} />
      </section>

      <section className="grid gap-6 px-6 pb-16 lg:grid-cols-[0.58fr_1fr] lg:px-14">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">Tree Cards</h2>
              <p className="mt-1 text-xs font-bold text-white/50">Compact list. Select a tree to view full details.</p>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-green-200">{trees.length}</span>
          </div>

          <div className="mt-6 grid gap-4">
            {trees.length === 0 ? (
              <Empty text="No AG trees yet. Approved seedling purchases will appear here." />
            ) : trees.map((tree) => (
                <button
                  key={tree.id}
                  onClick={() => setSelectedTreeId(tree.id)}
                  className={`rounded-2xl border p-4 text-left transition ${selectedTreeId === tree.id ? "border-yellow-300 bg-yellow-400/10 shadow-[0_0_0_1px_rgba(253,224,71,0.25)]" : "border-white/10 bg-black/20 hover:border-green-300/40 hover:bg-white/[0.08]"}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-black text-yellow-300">{treeDisplayCode(tree)}</p>
                      <p className="mt-1 truncate text-xs font-bold text-white/55">{tree.denr_tag_number || "DENR pending"}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-black ${statusClass(tree.status)}`}>{tree.status || "REGISTERED"}</span>
                  </div>
                </button>
              ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
            <h2 className="text-3xl font-black">Selected Tree</h2>

            {!selectedTree ? (
              <Empty text="Select a tree." />
            ) : (
              <div className="mt-6 space-y-3">
                {selectedLatestLog?.photo_url && (
                  <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/30">
                    <img src={selectedLatestLog.photo_url} alt="Selected tree latest update" className="h-64 w-full object-cover" />
                  </div>
                )}
                <div className="rounded-3xl border border-yellow-300/20 bg-yellow-400/10 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-yellow-200/80">Selected AG Tree</p>
                  <h3 className="mt-2 break-words text-4xl font-black text-yellow-300">{treeDisplayCode(selectedTree)}</h3>
                  <p className="mt-2 text-sm font-bold text-white/65">{selectedTree.species || "Aquilaria Malaccensis"}</p>
                </div>
                <Info label="AG Code" value={treeDisplayCode(selectedTree)} />
                <Info label="DENR Tag" value={selectedTree.denr_tag_number || "Pending"} />
                <Info label="Species" value={selectedTree.species || "Aquilaria Malaccensis"} />
                <Info label="Status" value={selectedTree.status || "REGISTERED"} />
                <Info label="GPS Latitude" value={selectedTree.gps_lat || "Pending"} />
                <Info label="GPS Longitude" value={selectedTree.gps_lng || "Pending"} />
                <Info label="Planted" value={formatDate(selectedTree.planted_at)} />
                <Info label="Harvest Estimate" value={harvestEstimateText(selectedTree)} />
                <div className="grid gap-3 md:grid-cols-3">
                  <ActionCard
                    href={`/investor/recovery?tree=${selectedTree.id}`}
                    title="Recovery Vault"
                    detail="Per-tree fund and termination request"
                    tone="red"
                  />
                  <ActionCard
                    href={`/certificates?tree=${selectedTree.id}`}
                    title="Tree Documents"
                    detail="Certificate, DENR tag, and legal records"
                    tone="gold"
                  />
                  <ActionCard
                    href={`/investor/care-services?tree=${selectedTree.id}`}
                    title="Care Services"
                    detail="Tree guard, soil care, photos, and field work"
                    tone="green"
                  />
                </div>
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

function ActionCard({
  href,
  title,
  detail,
  tone,
}: {
  href: string;
  title: string;
  detail: string;
  tone: "red" | "gold" | "green";
}) {
  const styles = {
    red: "border-red-300/25 bg-red-500/12 text-red-100 hover:border-red-300/45",
    gold: "border-yellow-300/25 bg-yellow-400/12 text-yellow-100 hover:border-yellow-300/45",
    green: "border-green-300/25 bg-green-500/12 text-green-100 hover:border-green-300/45",
  }[tone];

  return (
    <Link href={href} className={`rounded-2xl border p-4 transition hover:-translate-y-0.5 ${styles}`}>
      <p className="text-sm font-black">{title}</p>
      <p className="mt-2 text-xs font-bold leading-5 text-white/60">{detail}</p>
      <p className="mt-4 text-xs font-black uppercase tracking-wide">Open</p>
    </Link>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm font-bold text-white/60">{text}</div>;
}
