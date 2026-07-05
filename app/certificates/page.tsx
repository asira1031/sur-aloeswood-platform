"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import {
  formatDate,
  harvestEstimateText,
  latestLogForTree,
  statusClass,
  treeDisplayCode,
  type AnyRow,
} from "@/app/lib/coplanting/live";

export default function CertificatesPage() {
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
    if (saved) loadCertificates(saved);
  }, []);

  async function loadCertificates(targetEmail = email) {
    setLoading(true);
    setMessage("");

    const cleanEmail = targetEmail.toLowerCase().trim();

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, account_status, kyc_status, membership_status")
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
    setLoading(false);
  }

  const selectedTree = useMemo(() => trees.find((tree) => tree.id === selectedTreeId) || null, [trees, selectedTreeId]);
  const latestLog = selectedTree ? latestLogForTree(selectedTree.id, logs) : null;

  return (
    <main className="min-h-screen bg-[#06170f] text-white">
      <section className="border-b border-white/10 bg-gradient-to-r from-green-950 via-emerald-950 to-slate-950 px-6 py-8 lg:px-14">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-green-300">SUR ALOESWOOD CO-PLANTER</p>
            <h1 className="mt-3 text-4xl font-black lg:text-6xl">Tree Certificates</h1>
            <p className="mt-3 max-w-3xl text-green-100/80">
              Certificate preview for registered AG trees. Final issuance remains subject to admin verification.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/investor/my-trees" className="rounded-2xl bg-green-500 px-5 py-3 text-sm font-black text-green-950">My Trees</Link>
            <Link href="/investor/timeline" className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black">Timeline</Link>
          </div>
        </div>

        {message && <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
      </section>

      <section className="grid gap-6 px-6 py-8 lg:grid-cols-[0.8fr_1.2fr] lg:px-14">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Registered Trees</h2>
          <div className="mt-6 space-y-3">
            {trees.length === 0 ? (
              <Empty text="No AG trees yet." />
            ) : trees.map((tree) => (
              <button
                key={tree.id}
                onClick={() => setSelectedTreeId(tree.id)}
                className={`w-full rounded-2xl border p-5 text-left ${selectedTreeId === tree.id ? "border-yellow-300 bg-yellow-400/10" : "border-white/10 bg-black/20"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-2xl font-black text-yellow-300">{treeDisplayCode(tree)}</p>
                    <p className="mt-1 text-sm text-white/60">{tree.species || "Aquilaria Malaccensis"}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(tree.status)}`}>{tree.status || "REGISTERED"}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-yellow-300/20 bg-gradient-to-br from-white/[0.09] via-green-950/30 to-black p-6 shadow-2xl">
          <div className="rounded-[1.5rem] border border-yellow-300/30 bg-[#f8f1d8] p-6 text-slate-950">
            <p className="text-center text-xs font-black uppercase tracking-[0.35em] text-green-900">SUR ALOESWOOD CORPORATION</p>
            <h2 className="mt-4 text-center text-3xl font-black md:text-5xl">Tree Certificate</h2>
            <p className="mt-2 text-center text-sm font-bold text-slate-600">Certificate of Co-Planting Participation</p>

            {!selectedTree ? (
              <div className="mt-8 rounded-2xl border border-dashed border-slate-400 p-8 text-center font-bold text-slate-500">
                Select a tree to preview certificate.
              </div>
            ) : (
              <>
                <div className="mx-auto mt-8 max-w-2xl rounded-3xl border-4 border-double border-yellow-700/50 bg-white/70 p-6">
                  <p className="text-center text-sm text-slate-600">This certifies that</p>
                  <p className="mt-2 text-center text-3xl font-black text-green-950">{profile?.full_name || profile?.email || "Co-Planter"}</p>
                  <p className="mt-4 text-center text-sm leading-7 text-slate-700">
                    is recorded as co-planter for one SUR Aloeswood tree under the plantation management program.
                  </p>

                  <div className="mt-6 grid gap-3 text-sm md:grid-cols-2">
                    <CertInfo label="AG Tree Code" value={treeDisplayCode(selectedTree)} />
                    <CertInfo label="DENR Tag" value={selectedTree.denr_tag_number || "Pending"} />
                    <CertInfo label="Species" value={selectedTree.species || "Aquilaria Malaccensis"} />
                    <CertInfo label="Status" value={selectedTree.status || "REGISTERED"} />
                    <CertInfo label="GPS" value={selectedTree.gps_lat && selectedTree.gps_lng ? `${selectedTree.gps_lat}, ${selectedTree.gps_lng}` : "Pending"} />
                    <CertInfo label="Planted" value={formatDate(selectedTree.planted_at)} />
                    <CertInfo label="Harvest Estimate" value={harvestEstimateText(selectedTree)} />
                    <CertInfo label="Latest Health" value={latestLog?.health_status || "No update yet"} />
                  </div>
                </div>

                <p className="mt-6 text-center text-xs leading-6 text-slate-600">
                  This is a platform certificate preview. Final certificate issuance may require admin verification, DENR tag confirmation, and plantation record validation.
                </p>
              </>
            )}
          </div>

          <p className="mt-6 text-xs leading-6 text-green-100/60">
            Disclaimer: No guaranteed returns. Actual harvest depends on plantation performance, market conditions, inoculation schedule, and applicable laws.
          </p>
        </div>
      </section>
    </main>
  );
}

function CertInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-300 bg-white/75 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-black text-slate-950">{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm font-bold text-white/60">{text}</div>;
}
