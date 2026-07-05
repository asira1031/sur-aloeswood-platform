"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import LogoutButton from "@/app/components/LogoutButton";
import { farmerLinks, formatDate, statusClass, type AnyRow } from "@/app/lib/dashboard/nav";

const cardStyles = [
  "border-emerald-100 bg-white",
  "border-lime-100 bg-lime-50/75",
  "border-amber-100 bg-amber-50/75",
  "border-teal-100 bg-teal-50/75",
  "border-slate-200 bg-slate-50",
  "border-green-100 bg-emerald-50/75",
];

export default function FarmerDashboardPage() {
  const [email, setEmail] = useState("");
  const [farmer, setFarmer] = useState<AnyRow | null>(null);
  const [assignments, setAssignments] = useState<AnyRow[]>([]);
  const [trees, setTrees] = useState<AnyRow[]>([]);
  const [logs, setLogs] = useState<AnyRow[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function bootstrap() {
      const saved = localStorage.getItem("sur_login_email") || "";
      const { data } = await supabase.auth.getUser();
      const authEmail = data.user?.email?.toLowerCase().trim() || "";
      const preferredEmail = authEmail || saved;

      setEmail(preferredEmail);
      if (preferredEmail) {
        loadDashboard(preferredEmail);
      } else {
        setMessage("Login first to load the farmer dashboard.");
      }
    }

    bootstrap();
  }, []);

  async function loadDashboard(targetEmail = email) {
    setLoading(true);
    setMessage("");
    const cleanEmail = targetEmail.toLowerCase().trim();

    if (!cleanEmail) {
      setLoading(false);
      setMessage("Login first to load the farmer dashboard.");
      return;
    }

    const { data: farmerRow, error } = await supabase
      .from("gardeners")
      .select("id, full_name, email, mobile, status, created_at")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (error || !farmerRow) {
      setLoading(false);
      setMessage(error?.message || "Farmer not found.");
      setFarmer(null);
      setAssignments([]);
      return;
    }

    const { data: assignmentRows } = await supabase
      .from("gardener_assignments")
      .select("id, gardener_id, tree_id, status, assigned_at")
      .eq("gardener_id", farmerRow.id)
      .order("assigned_at", { ascending: false });

    const treeIds = (assignmentRows || []).map((assignment: AnyRow) => assignment.tree_id).filter(Boolean);
    let treeRows: AnyRow[] = [];
    let logRows: AnyRow[] = [];

    if (treeIds.length > 0) {
      const [{ data: treeData }, { data: logData }] = await Promise.all([
        supabase
          .from("tree_registry")
          .select("id, profile_id, purchase_id, tree_code, denr_tag_number, species, status, gps_lat, gps_lng, planted_at, created_at")
          .in("id", treeIds),
        supabase
          .from("tree_growth_logs")
          .select("id, tree_id, height_cm, diameter_cm, health_status, remarks, photo_url, created_at")
          .in("tree_id", treeIds)
          .order("created_at", { ascending: false }),
      ]);
      treeRows = (treeData || []) as AnyRow[];
      logRows = (logData || []) as AnyRow[];
    }

    setFarmer(farmerRow);
    setAssignments((assignmentRows || []) as AnyRow[]);
    setTrees(treeRows);
    setLogs(logRows);
    localStorage.setItem("sur_login_email", cleanEmail);
    setLoading(false);
  }

  function treeFor(id: string) {
    return trees.find((tree) => tree.id === id) || null;
  }

  const active = assignments.filter((assignment) =>
    ["ASSIGNED", "IN_PROGRESS", "ACTIVE"].includes(String(assignment.status || "").toUpperCase())
  ).length;
  const completed = assignments.filter((assignment) => String(assignment.status || "").toUpperCase() === "COMPLETED").length;

  return (
    <main className="min-h-screen bg-[#f3f7f1] text-slate-950">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-4 lg:px-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/20 p-6 shadow-sm lg:p-8">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/forest-bg.jpg')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-green-950/90 via-green-900/66 to-green-950/18" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-white/75">
                SUR Aloeswood Field Operations
              </p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-white lg:text-6xl">
                {farmer?.full_name ? `Welcome, ${farmer.full_name}` : "Farmer Work Center"}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78 lg:text-base">
                Review assigned AG trees, field tasks, GPS updates, photo reports, and growth logs.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => loadDashboard()}
                disabled={loading}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm hover:bg-white/90 disabled:opacity-60"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
              <Link href="/farmer/dashboard/task" className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur hover:bg-white/20">
                Tasks
              </Link>
              <LogoutButton className="rounded-2xl border border-red-300/25 bg-red-500/15 px-5 py-3 text-sm font-black text-white backdrop-blur hover:bg-red-500/25 disabled:opacity-60" />
            </div>
          </div>

          <div className="relative z-10 mt-8 grid gap-3 md:grid-cols-3">
            <HeroStat label="Assigned Trees" value={String(assignments.length)} />
            <HeroStat label="Active Tasks" value={String(active)} />
            <HeroStat label="Completed" value={String(completed)} />
          </div>

          {message && (
            <div className="relative z-10 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
              {message}
            </div>
          )}
        </section>

        <section className="grid gap-4 py-5 md:grid-cols-4">
          <Metric tone="white" title="Farmer" value={farmer?.full_name || "Not loaded"} detail="Current field profile" />
          <Metric tone="forest" title="Assigned Trees" value={String(assignments.length)} detail="Trees under care" />
          <Metric tone="gold" title="Active Tasks" value={String(active)} detail="Needs field work" />
          <Metric tone="mist" title="Completed" value={String(completed)} detail="Finished assignments" />
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h2 className="text-2xl font-black text-slate-950">Farmer Tools</h2>
            <p className="mt-1 text-sm text-slate-600">Field workspaces for tree care, photos, GPS, and growth reporting.</p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {farmerLinks.map((link, index) => (
                <Link key={link.href} href={link.href} className={`group rounded-[1.6rem] border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${cardStyles[index % cardStyles.length]}`}>
                  <div className="h-1.5 w-14 rounded-full bg-emerald-600" />
                  <div className="mt-5 flex items-start justify-between gap-4">
                    <p className="text-lg font-black text-slate-950">{link.title}</p>
                    <span className="rounded-full px-3 py-1 text-sm font-black text-emerald-700">›</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{link.desc}</p>
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
              <h2 className="text-2xl font-black text-slate-950">Assigned Tree Queue</h2>
              <div className="mt-5 space-y-3">
                {assignments.slice(0, 8).map((assignment) => {
                  const tree = treeFor(assignment.tree_id);
                  return (
                    <Link key={assignment.id} href="/farmer/assigned-trees" className="block rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-slate-950">{tree?.tree_code || "Tree assignment"}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {tree?.denr_tag_number || "DENR pending"} - Assigned {formatDate(assignment.assigned_at)}
                          </p>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(assignment.status)}`}>
                          {assignment.status || "ASSIGNED"}
                        </span>
                      </div>
                    </Link>
                  );
                })}
                {assignments.length === 0 && <Empty text="No assignments yet." />}
              </div>
            </section>

            <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
              <h2 className="text-2xl font-black text-slate-950">Recent Growth Logs</h2>
              <div className="mt-5 space-y-3">
                {logs.slice(0, 5).map((log) => (
                  <Link key={log.id} href="/farmer/growth-logs" className="block rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
                    <p className="font-black text-slate-950">{log.health_status || "Growth Update"}</p>
                    <p className="mt-1 text-sm text-slate-600">{log.remarks || "-"}</p>
                    <p className="mt-2 text-xs text-slate-500">{formatDate(log.created_at)}</p>
                  </Link>
                ))}
                {logs.length === 0 && <Empty text="No growth logs yet." />}
              </div>
            </section>
          </div>
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
      <p className="mt-3 truncate text-2xl font-black">{value}</p>
      <p className="mt-2 text-sm opacity-70">{detail}</p>
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
