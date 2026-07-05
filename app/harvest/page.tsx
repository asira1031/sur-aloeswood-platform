"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { formatDate, harvestEstimateText, latestLogForTree, statusClass, treeDisplayCode, type AnyRow } from "@/app/lib/coplanting/live";

export default function HarvestPage() {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<AnyRow | null>(null);
  const [trees, setTrees] = useState<AnyRow[]>([]);
  const [logs, setLogs] = useState<AnyRow[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("sur_login_email") || "";
    setEmail(saved);
    if (saved) loadHarvest(saved);
  }, []);

  async function loadHarvest(targetEmail = email) {
    setMessage("");
    const cleanEmail = targetEmail.toLowerCase().trim();

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (profileError || !profileRow) {
      setMessage(profileError?.message || "Profile not found.");
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
    localStorage.setItem("sur_login_email", cleanEmail);
  }

  const harvestReady = useMemo(() => trees.filter((tree) => String(tree.status || "").toUpperCase() === "HARVEST_READY"), [trees]);
  const growing = useMemo(() => trees.filter((tree) => String(tree.status || "").toUpperCase() !== "HARVEST_READY"), [trees]);

  return (
    <main className="min-h-screen bg-[#06170f] text-white">
      <section className="border-b border-white/10 bg-gradient-to-r from-green-950 via-emerald-950 to-slate-950 px-6 py-8 lg:px-14">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-green-300">SUR ALOESWOOD CO-PLANTER</p>
            <h1 className="mt-3 text-4xl font-black lg:text-6xl">Harvest Timeline</h1>
            <p className="mt-3 max-w-3xl text-green-100/80">
              Harvest estimates are 3 to 5 years, subject to plantation performance and inoculation schedule.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/investor/my-trees" className="rounded-2xl bg-green-500 px-5 py-3 text-sm font-black text-green-950">My Trees</Link>
            <Link href="/certificates" className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black">Certificates</Link>
          </div>
        </div>

        {message && <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
      </section>

      <section className="grid gap-5 px-6 py-8 md:grid-cols-4 lg:px-14">
        <Metric title="Co-Planter" value={profile?.full_name || "Not loaded"} />
        <Metric title="Total AG Trees" value={String(trees.length)} />
        <Metric title="Growing" value={String(growing.length)} />
        <Metric title="Harvest Ready" value={String(harvestReady.length)} />
      </section>

      <section className="px-6 pb-16 lg:px-14">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Harvest Readiness</h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {trees.length === 0 ? (
              <div className="md:col-span-2 xl:col-span-3">
                <Empty text="No AG trees yet." />
              </div>
            ) : trees.map((tree) => {
              const latest = latestLogForTree(tree.id, logs);
              return (
                <div key={tree.id} className="rounded-3xl border border-white/10 bg-black/25 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-2xl font-black text-yellow-300">{treeDisplayCode(tree)}</p>
                      <p className="mt-1 text-sm text-white/60">{tree.species || "Aquilaria Malaccensis"}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(tree.status)}`}>{tree.status || "REGISTERED"}</span>
                  </div>

                  <div className="mt-5 space-y-3">
                    <Info label="Planted" value={formatDate(tree.planted_at)} />
                    <Info label="Harvest Window" value={harvestEstimateText(tree)} />
                    <Info label="Latest Health" value={latest?.health_status || "No update yet"} />
                    <Info label="Latest Update" value={latest?.remarks || "No growth update yet"} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8 rounded-[2rem] border border-yellow-300/20 bg-yellow-400/10 p-6">
          <h2 className="text-2xl font-black text-yellow-200">Harvest Disclaimer</h2>
          <p className="mt-3 max-w-5xl text-sm leading-7 text-yellow-50/80">
            No guaranteed returns. Actual harvest depends on plantation performance, inoculation schedule, weather, disease risk,
            market conditions, buyer demand, compliance requirements, and applicable laws.
          </p>
        </div>
      </section>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5"><p className="text-xs font-black uppercase tracking-wide text-green-100/60">{title}</p><p className="mt-3 truncate text-xl font-black text-green-300">{value}</p></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-black/25 p-4"><p className="text-xs font-bold uppercase tracking-wide text-white/45">{label}</p><p className="mt-2 text-sm font-black text-white">{value}</p></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm font-bold text-white/60">{text}</div>;
}
