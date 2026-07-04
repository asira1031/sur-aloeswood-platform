"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { formatDate, getProfile, statusClass, type AnyRow } from "@/app/lib/admin/ag-codes";

export default function AdminTreeRegistryPage() {
  const [trees, setTrees] = useState<AnyRow[]>([]);
  const [profiles, setProfiles] = useState<AnyRow[]>([]);
  const [selected, setSelected] = useState<AnyRow | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [denrTag, setDenrTag] = useState("");
  const [gpsLat, setGpsLat] = useState("");
  const [gpsLng, setGpsLng] = useState("");
  const [plantedAt, setPlantedAt] = useState("");
  const [treeStatus, setTreeStatus] = useState("REGISTERED");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadTrees(); }, []);

  async function loadTrees() {
    setMessage("");
    const [{ data: treeRows, error }, { data: profileRows }] = await Promise.all([
      supabase.from("tree_registry").select("id, profile_id, purchase_id, tree_code, denr_tag_number, species, status, gps_lat, gps_lng, planted_at, created_at").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, email, mobile, mobile_number, account_status, kyc_status").limit(1000),
    ]);
    if (error) { setMessage(error.message); return; }
    const safeTrees = (treeRows || []) as AnyRow[];
    setTrees(safeTrees);
    setProfiles((profileRows || []) as AnyRow[]);
    selectTree(safeTrees[0] || null);
  }

  function selectTree(tree: AnyRow | null) {
    setSelected(tree);
    setDenrTag(tree?.denr_tag_number || "");
    setGpsLat(tree?.gps_lat || "");
    setGpsLng(tree?.gps_lng || "");
    setPlantedAt(tree?.planted_at || "");
    setTreeStatus(tree?.status || "REGISTERED");
  }

  async function saveTree() {
    if (!selected) { setMessage("Select tree first."); return; }
    setLoading(true); setMessage("");
    const { error } = await supabase.from("tree_registry").update({
      denr_tag_number: denrTag.trim() || null,
      gps_lat: gpsLat.trim() || null,
      gps_lng: gpsLng.trim() || null,
      planted_at: plantedAt || null,
      status: treeStatus,
      species: selected.species || "Aquilaria Malaccensis",
    }).eq("id", selected.id);
    if (error) { setMessage(error.message); setLoading(false); return; }
    await supabase.from("notifications").insert({ profile_id: selected.profile_id, title: "Tree registry updated", message: `Your tree ${selected.tree_code} registry details were updated.`, is_read: false });
    setMessage("Tree registry updated.");
    await loadTrees();
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const keyword = search.toLowerCase().trim();
    return trees.filter((tree) => {
      const profile = getProfile(tree.profile_id, profiles);
      const statusOk = status === "ALL" || String(tree.status || "").toUpperCase() === status;
      const text = `${JSON.stringify(tree)} ${profile?.full_name || ""} ${profile?.email || ""}`.toLowerCase();
      return statusOk && (!keyword || text.includes(keyword));
    });
  }, [trees, profiles, search, status]);

  const selectedProfile = selected ? getProfile(selected.profile_id, profiles) : null;

  return (
    <main className="min-h-screen bg-[#04140d] text-white">
      <section className="border-b border-white/10 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div><p className="text-xs font-black uppercase tracking-[0.35em] text-green-300">SUR ALOESWOOD ADMIN</p><h1 className="mt-4 text-4xl font-black md:text-6xl">Tree Registry</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-green-50/80">Manage AG tree registry details, DENR tags, GPS coordinates, planting dates, and status.</p></div>
            <button onClick={loadTrees} className="rounded-2xl bg-green-500 px-5 py-3 text-sm font-black text-green-950">Refresh</button>
          </div>
          {message && <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-8 md:grid-cols-4 md:px-10">
        <Metric title="Total Trees" value={String(trees.length)} />
        <Metric title="Registered" value={String(trees.filter((t) => String(t.status || "").toUpperCase() === "REGISTERED").length)} />
        <Metric title="Active" value={String(trees.filter((t) => String(t.status || "").toUpperCase() === "ACTIVE").length)} />
        <Metric title="DENR Tagged" value={String(trees.filter((t) => Boolean(t.denr_tag_number)).length)} />
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-16 md:px-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-3xl font-black">AG Trees</h2><div className="flex flex-wrap gap-3"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none" /><select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none"><option value="ALL">All</option><option value="REGISTERED">Registered</option><option value="ACTIVE">Active</option><option value="GROWING">Growing</option><option value="HARVEST_READY">Harvest Ready</option><option value="DAMAGED">Damaged</option></select></div></div>
          <div className="mt-6 space-y-3">{filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 bg-black/25 p-6 text-sm font-bold text-white/60">No trees found.</div> : filtered.map((tree) => { const profile = getProfile(tree.profile_id, profiles); return <button key={tree.id} onClick={() => selectTree(tree)} className={`w-full rounded-2xl border p-5 text-left ${selected?.id === tree.id ? "border-green-300 bg-green-400/15" : "border-white/10 bg-black/25"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-2xl font-black text-yellow-300">{tree.tree_code || "Pending AG Code"}</p><p className="mt-1 text-sm text-white/60">{profile?.full_name || profile?.email || "Unknown Co-Planter"}</p><p className="mt-1 text-xs text-white/45">{tree.species || "Aquilaria Malaccensis"}</p></div><span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(tree.status)}`}>{tree.status || "REGISTERED"}</span></div><div className="mt-4 grid gap-2 text-xs font-bold text-white/55 md:grid-cols-3"><span>DENR: {tree.denr_tag_number || "Pending"}</span><span>GPS: {tree.gps_lat && tree.gps_lng ? `${tree.gps_lat}, ${tree.gps_lng}` : "Pending"}</span><span>Planted: {formatDate(tree.planted_at)}</span></div></button>; })}</div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Tree Detail</h2>
          {!selected ? <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-black/25 p-6 text-sm font-bold text-white/60">Select tree.</div> : <>
            <div className="mt-6 grid gap-3 md:grid-cols-2"><Info label="AG Code" value={selected.tree_code || "-"} /><Info label="Co-Planter" value={selectedProfile?.full_name || "-"} /><Info label="Email" value={selectedProfile?.email || "-"} /><Info label="Species" value={selected.species || "Aquilaria Malaccensis"} /><Info label="Purchase ID" value={selected.purchase_id || "-"} /><Info label="Created" value={formatDate(selected.created_at)} /></div>
            <div className="mt-6 grid gap-4"><input value={denrTag} onChange={(e) => setDenrTag(e.target.value)} placeholder="DENR Tag Number" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" /><div className="grid gap-4 md:grid-cols-2"><input value={gpsLat} onChange={(e) => setGpsLat(e.target.value)} placeholder="GPS Latitude" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" /><input value={gpsLng} onChange={(e) => setGpsLng(e.target.value)} placeholder="GPS Longitude" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" /></div><input value={plantedAt} onChange={(e) => setPlantedAt(e.target.value)} type="date" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" /><select value={treeStatus} onChange={(e) => setTreeStatus(e.target.value)} className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none"><option>REGISTERED</option><option>ACTIVE</option><option>GROWING</option><option>MAINTENANCE</option><option>HARVEST_READY</option><option>DAMAGED</option></select><button onClick={saveTree} disabled={loading} className="rounded-2xl bg-green-500 px-6 py-4 text-sm font-black text-green-950 disabled:bg-slate-500">Save Tree Registry</button></div>
          </>}
        </div>
      </section>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: string }) { return <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl"><p className="text-xs font-black uppercase tracking-wide text-green-100/60">{title}</p><p className="mt-3 truncate text-2xl font-black text-green-300">{value}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-black/25 p-4"><p className="text-xs font-bold uppercase tracking-wide text-white/45">{label}</p><p className="mt-2 break-words text-sm font-black text-white">{value}</p></div>; }
