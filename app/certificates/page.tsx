"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase/client";

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
};

type CertificateTree = {
  id: string;
  profile_id: string;
  tree_code: string | null;
  denr_tag_number: string | null;
  species: string | null;
  status: string | null;
  planted_at: string | null;
  gps_lat: string | number | null;
  gps_lng: string | number | null;
  certificate_status?: string | null;
  certificate_no?: string | null;
  latest_photo_url?: string | null;
  created_at?: string | null;
};

export default function CertificatesPage() {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [trees, setTrees] = useState<CertificateTree[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadCertificates(targetEmail?: string) {
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
    if (savedEmail) loadCertificates(savedEmail);
  }, []);

  return (
    <main className="min-h-screen bg-[#06140d] px-5 py-8 text-white">
      <section className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950 via-[#0b1d12] to-black p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-yellow-400">
            TREE CERTIFICATES
          </p>
          <h1 className="mt-3 text-3xl font-black md:text-5xl">
            Co-Planter Certificate Center
          </h1>
          <p className="mt-4 max-w-3xl text-sm text-emerald-100 md:text-base">
            Preview your tree certificate records with AG codes, DENR tags,
            species, GPS location, and plantation registration status.
          </p>

          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 md:flex-row">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter registered email"
              className="min-h-12 flex-1 rounded-xl border border-white/10 bg-white px-4 font-semibold text-slate-900 outline-none"
            />
            <button
              onClick={() => loadCertificates()}
              disabled={loading}
              className="rounded-xl bg-yellow-400 px-6 py-3 font-black text-black hover:bg-yellow-300 disabled:opacity-60"
            >
              {loading ? "Loading..." : "Load Certificates"}
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/tree" className="rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black">
              Back to Tree Registry
            </Link>
            <Link href="/investor/marketplace" className="rounded-xl border border-emerald-500/30 px-5 py-3 font-bold text-emerald-100">
              Buy Seedlings
            </Link>
            <Link href="/harvest" className="rounded-xl border border-emerald-500/30 px-5 py-3 font-bold text-emerald-100">
              Harvest Timeline
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
            <h2 className="text-xl font-bold text-yellow-300">No certificates yet</h2>
            <p className="mt-2 text-emerald-100">
              Certificate previews will appear after your approved seedlings are registered as AG trees.
            </p>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {trees.map((tree) => (
            <div
              key={tree.id}
              className="overflow-hidden rounded-3xl border border-yellow-500/20 bg-[#f8f0d0] text-[#1d1604] shadow-2xl"
            >
              <div className="border-b border-yellow-700/20 bg-gradient-to-r from-yellow-500 to-yellow-200 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.3em]">
                  SUR ALOESWOOD PLANTATION
                </p>
                <h2 className="mt-2 text-2xl font-black">Tree Ownership Certificate</h2>
              </div>

              <div className="p-6">
                <div className="rounded-2xl border-2 border-yellow-700/30 bg-white/50 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-yellow-800">
                    AG Tree Code
                  </p>
                  <h3 className="mt-1 text-4xl font-black text-emerald-900">
                    {tree.tree_code || "Pending AG Code"}
                  </h3>

                  <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
                    <p><b>Co-Planter:</b> {profile?.full_name || profile?.email || "Co-Planter"}</p>
                    <p><b>Certificate No:</b> {tree.certificate_no || `CERT-${tree.tree_code || "PENDING"}`}</p>
                    <p><b>DENR Tag:</b> {tree.denr_tag_number || "Pending"}</p>
                    <p><b>Species:</b> {tree.species || "Aquilaria Malaccensis"}</p>
                    <p><b>Status:</b> {tree.status || "Pending"}</p>
                    <p><b>Certificate:</b> {tree.certificate_status || "Preview / Pending Verification"}</p>
                    <p><b>Planted:</b> {tree.planted_at ? new Date(tree.planted_at).toLocaleDateString() : "Pending"}</p>
                    <p><b>GPS:</b> {tree.gps_lat || "—"}, {tree.gps_lng || "—"}</p>
                  </div>

                  <div className="mt-6 rounded-xl border border-emerald-900/20 bg-emerald-900/10 p-4 text-sm">
                    This certificate preview confirms the tree registry details available in the platform.
                    Final certificate release is subject to Admin verification and plantation records.
                  </div>
                </div>

                <button
                  disabled
                  className="mt-5 w-full rounded-xl bg-emerald-900 px-5 py-3 font-bold text-yellow-100 opacity-70"
                >
                  Download Certificate — Coming next phase
                </button>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-xs leading-relaxed text-emerald-300">
          No guaranteed returns. Actual harvest depends on plantation performance,
          market conditions, inoculation schedule, and applicable laws.
        </p>
      </section>
    </main>
  );
}