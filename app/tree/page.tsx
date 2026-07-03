"use client";

import { useEffect, useState } from "react";
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

export default function TreeRegistryPage() {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [trees, setTrees] = useState<Tree[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadTrees(targetEmail?: string) {
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
    if (savedEmail) loadTrees(savedEmail);
  }, []);

  return (
    <main className="min-h-screen bg-[#06140d] px-5 py-8 text-white">
      <section className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950 via-[#0b1d12] to-black p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-yellow-400">
            TREE REGISTRY
          </p>
          <h1 className="mt-3 text-3xl font-black md:text-5xl">
            My AG Tree Portfolio
          </h1>
          <p className="mt-4 max-w-3xl text-sm text-emerald-100 md:text-base">
            View your registered SUR Aloeswood trees, AG codes, DENR tags, GPS location, photos, videos, and plantation status.
          </p>

          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 md:flex-row">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter registered email"
              className="min-h-12 flex-1 rounded-xl border border-white/10 bg-white px-4 font-semibold text-slate-900 outline-none"
            />
            <button
              onClick={() => loadTrees()}
              disabled={loading}
              className="rounded-xl bg-yellow-400 px-6 py-3 font-black text-black hover:bg-yellow-300 disabled:opacity-60"
            >
              {loading ? "Loading..." : "Load My Trees"}
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/investor/marketplace" className="rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black">
              Buy Seedlings
            </Link>
            <Link href="/plantation" className="rounded-xl border border-emerald-500/30 px-5 py-3 font-bold text-emerald-100">
              Plantation Timeline
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

        {!loading && !message && trees.length === 0 && profile && (
          <div className="rounded-2xl border border-emerald-500/20 bg-white/10 p-6">
            <h2 className="text-xl font-bold text-yellow-300">No AG trees yet</h2>
            <p className="mt-2 text-emerald-100">
              Your AG tree codes will appear here after Admin approves your seedling purchase.
            </p>
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {trees.map((tree) => (
            <div key={tree.id} className="overflow-hidden rounded-3xl border border-emerald-500/20 bg-white/10 backdrop-blur">
              <div className="h-44 bg-gradient-to-br from-emerald-800 to-black">
                {tree.latest_photo_url ? (
                  <img src={tree.latest_photo_url} alt="Tree photo" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-5xl">🌳</div>
                )}
              </div>

              <div className="p-5">
                <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">
                  AG Tree Code
                </p>
                <h2 className="mt-1 text-3xl font-black text-yellow-300">
                  {tree.tree_code || "Pending AG Code"}
                </h2>

                <div className="mt-4 space-y-2 text-sm text-emerald-100">
                  <p><b>DENR Tag:</b> {tree.denr_tag_number || "Pending"}</p>
                  <p><b>Species:</b> {tree.species || "Aquilaria Malaccensis"}</p>
                  <p><b>Status:</b> {tree.status || "Pending"}</p>
                  <p><b>GPS:</b> {tree.gps_lat || "—"}, {tree.gps_lng || "—"}</p>
                  <p><b>Planted:</b> {tree.planted_at ? new Date(tree.planted_at).toLocaleDateString() : "Pending"}</p>
                  <p><b>Certificate:</b> {tree.certificate_status || "Pending Verification"}</p>
                </div>

                <div className="mt-4 rounded-2xl bg-black/30 p-4">
                  <p className="text-xs text-emerald-300">Latest Growth Update</p>
                  <p className="mt-1 text-sm text-white">
                    {tree.latest_growth_update || "No growth update yet."}
                  </p>
                </div>

                {tree.latest_video_url && (
                  <Link
                    href={tree.latest_video_url}
                    target="_blank"
                    className="mt-4 block rounded-xl border border-emerald-500/30 px-4 py-3 text-center font-bold text-emerald-100"
                  >
                    View Latest Video
                  </Link>
                )}

                <Link
                  href={`/certificates?tree=${tree.id}`}
                  className="mt-4 block rounded-xl bg-yellow-400 px-4 py-3 text-center font-bold text-black"
                >
                  View Certificate
                </Link>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-xs leading-relaxed text-emerald-300">
          No guaranteed returns. Actual harvest depends on plantation performance, market conditions, inoculation schedule, and applicable laws.
        </p>
      </section>
    </main>
  );
}