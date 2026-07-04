"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { formatDate, harvestEstimateText, logsForTree, statusClass, treeDisplayCode, type AnyRow } from "@/app/lib/coplanting/live";

export default function CoPlanterTimelinePage() {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<AnyRow | null>(null);
  const [trees, setTrees] = useState<AnyRow[]>([]);
  const [logs, setLogs] = useState<AnyRow[]>([]);
  const [selectedTreeId, setSelectedTreeId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("sur_login_email") || "";
    setEmail(saved);
    if (saved) loadTimeline(saved);
  }, []);

  async function loadTimeline(targetEmail = email) {
    setMessage("");
    const cleanEmail = targetEmail.toLowerCase().trim();

    const { data: profileRow, error } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (error || !profileRow) {
      setMessage(error?.message || "Profile not found.");
      setProfile(null);
      setTrees([]);
      setLogs([]);
      return;
    }

    const { data: treeRows } = await supabase
      .from("tree_registry")
      .select("id, profile_id, purchase_id, tree_code, denr_tag_number, species, status, gps_lat, gps_lng, planted_at, created_at")
      .eq("profile_id", profileRow.id)
      .order("created_at", { ascending: false });

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
  }

  const selectedTree = useMemo(() => trees.find((tree) => tree.id === selectedTreeId) || null, [trees, selectedTreeId]);
  const treeLogs = useMemo(() => selectedTree ? logsForTree(selectedTree.id, logs) : [], [selectedTree, logs]);

  return (
    <main className="min-h-screen bg-[#06170f] text-white">
      <section className="border-b border-white/10 bg-gradient-to-r from-green-950 via-emerald-950 to-slate-950 px-6 py-8 lg:px-14">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-green-300">SUR ALOESWOOD CO-PLANTER</p>
            <h1 className="mt-3 text-4xl font-black lg:text-6xl">Tree Timeline</h1>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/investor/my-trees" className="rounded-2xl bg-green-500 px-5 py-3 text-sm font-black text-green-950">My Trees</Link>
            <Link href="/harvest" className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black">Harvest</Link>
          </div>
        </div>

        <div className="mt-8 grid gap-3 rounded-3xl border border-white/10 bg-white/10 p-4 md:grid-cols-[1fr_auto]">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Registered email" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
          <button onClick={() => loadTimeline()} className="rounded-2xl bg-green-500 px-8 py-4 text-sm font-black text-green-950">Load Timeline</button>
        </div>

        {message && <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
      </section>

      <section className="grid gap-6 px-6 py-8 lg:grid-cols-[0.75fr_1.25fr] lg:px-14">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6">
          <h2 className="text-3xl font-black">Choose AG Tree</h2>

          <div className="mt-6 space-y-3">
            {trees.length === 0 ? (
              <Empty text="No AG trees yet." />
            ) : trees.map((tree) => (
              <button key={tree.id} onClick={() => setSelectedTreeId(tree.id)} className={`w-full rounded-2xl border p-5 text-left ${selectedTreeId === tree.id ? "border-yellow-300 bg-yellow-400/10" : "border-white/10 bg-black/20"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-black text-yellow-300">{treeDisplayCode(tree)}</p>
                    <p className="mt-1 text-sm text-white/60">{tree.species || "Aquilaria Malaccensis"}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(tree.status)}`}>{tree.status || "REGISTERED"}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6">
          <h2 className="text-3xl font-black">Live Timeline</h2>

          {!selectedTree ? (
            <div className="mt-6"><Empty text="Select tree." /></div>
          ) : (
            <div className="mt-6">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
                <p className="text-3xl font-black text-yellow-300">{treeDisplayCode(selectedTree)}</p>
                <p className="mt-2 text-sm text-white/70">{harvestEstimateText(selectedTree)}</p>
              </div>

              <div className="mt-8 space-y-5">
                <TimelineItem title="Tree Registered" date={formatDate(selectedTree.created_at)} detail="AG tree code created after approved seedling purchase." status="COMPLETED" />
                <TimelineItem title="Planting Date" date={formatDate(selectedTree.planted_at)} detail="Planting date appears after Admin / plantation team updates the tree registry." status={selectedTree.planted_at ? "COMPLETED" : "PENDING"} />
                {treeLogs.map((log) => (
                  <TimelineItem
                    key={log.id}
                    title={log.health_status || "Growth Update"}
                    date={formatDate(log.created_at)}
                    detail={log.remarks || "Growth monitoring update posted by farmer."}
                    status={log.health_status || "LOGGED"}
                    photo={log.photo_url}
                  />
                ))}
                <TimelineItem title="Harvest Window" date={harvestEstimateText(selectedTree)} detail="Harvest estimate is not guaranteed and depends on plantation performance, market conditions, inoculation schedule, and applicable laws." status="PENDING" />
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function TimelineItem({ title, date, detail, status, photo }: { title: string; date: string; detail: string; status: string; photo?: string | null }) {
  return (
    <div className="relative border-l border-green-300/30 pl-6">
      <div className="absolute -left-2 top-1 h-4 w-4 rounded-full bg-green-400" />
      <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xl font-black text-green-200">{title}</p>
            <p className="mt-1 text-xs font-bold text-white/50">{date}</p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(status)}`}>{status}</span>
        </div>
        <p className="mt-3 text-sm leading-6 text-white/70">{detail}</p>
        {photo && <a href={photo} target="_blank" className="mt-3 block text-sm font-black text-yellow-300">Open Photo →</a>}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm font-bold text-white/60">{text}</div>;
}
