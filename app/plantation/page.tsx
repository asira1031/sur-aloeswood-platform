"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase/client";

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
};

type Tree = {
  id: string;
  profile_id: string;
  tree_code: string | null;
  denr_tag_number: string | null;
  species: string | null;
  status: string | null;
  gps_lat: string | number | null;
  gps_lng: string | number | null;
  planted_at: string | null;
  latest_photo_url?: string | null;
  latest_video_url?: string | null;
  latest_growth_update?: string | null;
  certificate_status?: string | null;
  created_at?: string | null;
};

const timeline = [
  "Seedling Purchase Request",
  "Payment Review",
  "Admin Approval",
  "AG Code Generation",
  "Tree Registry",
  "DENR Tagging",
  "GPS Plotting",
  "Growth Monitoring",
  "Photo / Video Updates",
  "Inoculation Schedule",
  "Harvest Planning",
];

export default function PlantationPage() {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [trees, setTrees] = useState<Tree[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const stats = useMemo(() => {
    const total = trees.length;
    const planted = trees.filter((t) => Boolean(t.planted_at)).length;
    const gps = trees.filter((t) => Boolean(t.gps_lat && t.gps_lng)).length;
    const tagged = trees.filter((t) => Boolean(t.denr_tag_number)).length;
    return { total, planted, gps, tagged };
  }, [trees]);

  async function loadPlantation(targetEmail?: string) {
    setLoading(true);
    setMessage("");

    const cleanEmail = (targetEmail || email).toLowerCase().trim();

    if (!cleanEmail) {
      setMessage("Enter your registered email first.");
      setLoading(false);
      return;
    }

    localStorage.setItem("sur_login_email", cleanEmail);

    const { data: foundProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id,email,full_name")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (profileError || !foundProfile) {
      setProfile(null);
      setTrees([]);
      setMessage(profileError?.message || "Profile not found.");
      setLoading(false);
      return;
    }

    setProfile(foundProfile);

    const { data: treeData, error: treeError } = await supabase
      .from("tree_registry")
      .select("*")
      .eq("profile_id", foundProfile.id)
      .order("created_at", { ascending: false });

    if (treeError) {
      setTrees([]);
      setMessage(treeError.message);
      setLoading(false);
      return;
    }

    setTrees(treeData || []);
    setLoading(false);
  }

  useEffect(() => {
    const savedEmail = localStorage.getItem("sur_login_email") || "";
    setEmail(savedEmail);
    if (savedEmail) loadPlantation(savedEmail);
  }, []);

  return (
    <main className="min-h-screen bg-[#06140d] px-5 py-8 text-white">
      <section className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950 via-[#0b1d12] to-black p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-yellow-400">
            PLANTATION TIMELINE
          </p>
          <h1 className="mt-3 text-3xl font-black md:text-5xl">
            SUR Aloeswood Plantation Journey
          </h1>
          <p className="mt-4 max-w-3xl text-sm text-emerald-100 md:text-base">
            Track your Co-Planter journey from seedling purchase to AG code registration,
            DENR tagging, GPS plotting, growth updates, inoculation, and harvest planning.
          </p>

          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 md:flex-row">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter registered email"
              className="min-h-12 flex-1 rounded-xl border border-white/10 bg-white px-4 font-semibold text-slate-900 outline-none"
            />
            <button
              onClick={() => loadPlantation()}
              disabled={loading}
              className="rounded-xl bg-yellow-400 px-6 py-3 font-black text-black hover:bg-yellow-300 disabled:opacity-60"
            >
              {loading ? "Loading..." : "Load Timeline"}
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/tree" className="rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black">
              My AG Trees
            </Link>
            <Link href="/investor/marketplace" className="rounded-xl border border-emerald-500/30 px-5 py-3 font-bold text-emerald-100">
              Buy Seedlings
            </Link>
            <Link href="/certificates" className="rounded-xl border border-emerald-500/30 px-5 py-3 font-bold text-emerald-100">
              Certificates
            </Link>
            <Link href="/harvest" className="rounded-xl border border-emerald-500/30 px-5 py-3 font-bold text-emerald-100">
              Harvest
            </Link>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-5 text-yellow-100">
            {message}
          </div>
        )}

        {profile && (
          <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-white/10 p-5">
            <p className="text-sm text-emerald-200">Loaded Co-Planter</p>
            <h2 className="text-xl font-black">{profile.full_name || profile.email}</h2>
            <p className="text-sm text-white/60">{profile.email}</p>
          </div>
        )}

        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Stat title="Registered Trees" value={stats.total.toString()} />
          <Stat title="Planted Trees" value={stats.planted.toString()} />
          <Stat title="GPS Tagged" value={stats.gps.toString()} />
          <Stat title="DENR Tagged" value={stats.tagged.toString()} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-3xl border border-emerald-500/20 bg-white/10 p-6">
            <h2 className="text-2xl font-black text-yellow-300">Platform Timeline</h2>
            <div className="mt-6 space-y-4">
              {timeline.map((item, index) => (
                <div key={item} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-400 font-black text-black">
                    {index + 1}
                  </div>
                  <div className="rounded-2xl bg-black/25 p-4">
                    <p className="font-black">{item}</p>
                    <p className="mt-1 text-sm text-emerald-100/80">
                      {index < 4
                        ? "Handled after purchase and Admin payment approval."
                        : index < 9
                          ? "Updated through plantation and registry records."
                          : "Subject to plantation performance and applicable laws."}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-500/20 bg-white/10 p-6">
            <h2 className="text-2xl font-black text-yellow-300">My Plantation Records</h2>

            {trees.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-black/20 p-6">
                <h3 className="text-xl font-bold text-yellow-300">No plantation records yet</h3>
                <p className="mt-2 text-emerald-100">
                  Plantation records will appear once Admin approves your seedling purchase and registers your AG trees.
                </p>
              </div>
            ) : (
              <div className="mt-6 grid gap-4">
                {trees.map((tree) => (
                  <div key={tree.id} className="rounded-2xl border border-white/10 bg-black/25 p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">AG Code</p>
                        <h3 className="text-2xl font-black text-yellow-300">
                          {tree.tree_code || "Pending AG Code"}
                        </h3>
                      </div>
                      <span className="rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-bold text-emerald-100">
                        {tree.status || "Pending"}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm text-emerald-100 md:grid-cols-2">
                      <p><b>DENR Tag:</b> {tree.denr_tag_number || "Pending"}</p>
                      <p><b>Species:</b> {tree.species || "Aquilaria Malaccensis"}</p>
                      <p><b>GPS:</b> {tree.gps_lat || "—"}, {tree.gps_lng || "—"}</p>
                      <p><b>Planted:</b> {tree.planted_at ? new Date(tree.planted_at).toLocaleDateString() : "Pending"}</p>
                    </div>

                    <div className="mt-4 rounded-xl bg-black/30 p-4 text-sm">
                      <p className="text-emerald-300">Latest Growth Update</p>
                      <p className="mt-1">{tree.latest_growth_update || "No growth update yet."}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-yellow-500/20 bg-yellow-500/10 p-5 text-sm text-yellow-100">
          No guaranteed returns. Actual harvest depends on plantation performance,
          market conditions, inoculation schedule, and applicable laws.
        </div>
      </section>
    </main>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl border border-emerald-500/20 bg-white/10 p-5">
      <p className="text-sm text-emerald-200">{title}</p>
      <p className="mt-2 text-3xl font-black text-yellow-300">{value}</p>
    </div>
  );
}