"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { formatDate, statusClass, type AnyRow } from "@/app/lib/admin/ag-codes";

const requiredPapers = [
  "Co-Planter Certificate",
  "Memorandum of Agreement (MOA)",
  "Official Payment / Collection Receipt",
  "SUR Aloeswood Reference Number",
  "DENR Tag / Tree Identification Record",
  "GPS and Plantation Location Record",
  "Planting / Monitoring Record",
  "Harvest and Profit Sharing Record",
];

export default function AdminTreeRegistryPage() {
  const [trees, setTrees] = useState<AnyRow[]>([]);
  const [profiles, setProfiles] = useState<AnyRow[]>([]);
  const [documents, setDocuments] = useState<AnyRow[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [selectedTreeId, setSelectedTreeId] = useState("");
  const [search, setSearch] = useState("");
  const [denrTag, setDenrTag] = useState("");
  const [gpsLat, setGpsLat] = useState("");
  const [gpsLng, setGpsLng] = useState("");
  const [plantedAt, setPlantedAt] = useState("");
  const [treeStatus, setTreeStatus] = useState("REGISTERED");
  const [paperType, setPaperType] = useState(requiredPapers[0]);
  const [paperFile, setPaperFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [documentsReady, setDocumentsReady] = useState(true);

  useEffect(() => {
    loadRegistry();
  }, []);

  async function loadRegistry() {
    setMessage("");

    const [{ data: treeRows, error }, { data: profileRows }, documentResult] = await Promise.all([
      supabase
        .from("tree_registry")
        .select("id, profile_id, purchase_id, tree_code, denr_tag_number, species, status, gps_lat, gps_lng, planted_at, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, full_name, email, mobile, mobile_number, role, account_status, kyc_status, membership_status, created_at")
        .limit(1000),
      supabase
        .from("tree_documents")
        .select("id, tree_id, profile_id, document_type, file_name, file_url, uploaded_at")
        .order("uploaded_at", { ascending: false }),
    ]);

    if (error) {
      setMessage(error.message);
      return;
    }

    const safeTrees = (treeRows || []) as AnyRow[];
    const safeProfiles = (profileRows || []) as AnyRow[];
    setTrees(safeTrees);
    setProfiles(safeProfiles);

    if (documentResult.error) {
      setDocumentsReady(false);
      setDocuments([]);
    } else {
      setDocumentsReady(true);
      setDocuments((documentResult.data || []) as AnyRow[]);
    }

    const firstProfileId = selectedProfileId || safeTrees[0]?.profile_id || safeProfiles[0]?.id || "";
    setSelectedProfileId(firstProfileId);

    const firstTree = safeTrees.find((tree) => tree.profile_id === firstProfileId) || safeTrees[0] || null;
    selectTree(firstTree);
  }

  function selectTree(tree: AnyRow | null) {
    setSelectedTreeId(tree?.id || "");
    setDenrTag(tree?.denr_tag_number || "");
    setGpsLat(tree?.gps_lat || "");
    setGpsLng(tree?.gps_lng || "");
    setPlantedAt(tree?.planted_at || "");
    setTreeStatus(tree?.status || "REGISTERED");
  }

  function selectProfile(profileId: string) {
    setSelectedProfileId(profileId);
    const firstTree = trees.find((tree) => tree.profile_id === profileId) || null;
    selectTree(firstTree);
  }

  async function saveTree() {
    const selectedTree = trees.find((tree) => tree.id === selectedTreeId);
    if (!selectedTree) {
      setMessage("Select tree first.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { error } = await supabase
      .from("tree_registry")
      .update({
        denr_tag_number: denrTag.trim() || null,
        gps_lat: gpsLat.trim() || null,
        gps_lng: gpsLng.trim() || null,
        planted_at: plantedAt || null,
        status: treeStatus,
        species: selectedTree.species || "Aquilaria Malaccensis",
      })
      .eq("id", selectedTree.id);

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    await supabase.from("notifications").insert({
      profile_id: selectedTree.profile_id,
      title: "Tree registry updated",
      message: `Your tree ${selectedTree.tree_code} registry details were updated.`,
      is_read: false,
    });

    setMessage("Tree registry updated.");
    await loadRegistry();
    setLoading(false);
  }

  async function uploadPaper() {
    const selectedTree = trees.find((tree) => tree.id === selectedTreeId);
    if (!selectedTree) {
      setMessage("Select tree first.");
      return;
    }

    if (!documentsReady) {
      setMessage("Tree document table is not ready yet. Run the SQL for tree_documents first.");
      return;
    }

    if (!paperFile) {
      setMessage("Choose a paper file to upload.");
      return;
    }

    setUploading(true);
    setMessage("");

    const safeFileName = paperFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const safeTreeCode = String(selectedTree.tree_code || selectedTree.id).replace(/[^a-zA-Z0-9._-]/g, "-");
    const filePath = `${safeTreeCode}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("tree-papers")
      .upload(filePath, paperFile, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      setUploading(false);
      setMessage(`${uploadError.message}. Please make sure the tree-papers storage bucket and policies are ready.`);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("tree-papers").getPublicUrl(filePath);
    const { error: insertError } = await supabase.from("tree_documents").insert({
      tree_id: selectedTree.id,
      profile_id: selectedTree.profile_id,
      document_type: paperType,
      file_name: paperFile.name,
      file_url: publicUrlData.publicUrl,
    });

    if (insertError) {
      setUploading(false);
      setMessage(insertError.message);
      return;
    }

    setPaperFile(null);
    setUploading(false);
    setMessage("Tree paper uploaded.");
    await loadRegistry();
  }

  const coPlanters = useMemo(() => {
    const treeProfileIds = new Set(trees.map((tree) => String(tree.profile_id || "")));
    return profiles
      .filter((profile) => {
        const role = String(profile.role || "").toUpperCase();
        return treeProfileIds.has(String(profile.id)) || ["COPLANTER", "INVESTOR"].includes(role);
      })
      .filter((profile) => {
        const keyword = search.toLowerCase().trim();
        const text = `${profile.full_name || ""} ${profile.email || ""}`.toLowerCase();
        return !keyword || text.includes(keyword);
      });
  }, [profiles, trees, search]);

  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) || null;
  const selectedTrees = trees.filter((tree) => tree.profile_id === selectedProfileId);
  const selectedTree = trees.find((tree) => tree.id === selectedTreeId) || selectedTrees[0] || null;
  const selectedDocuments = documents.filter((document) => document.tree_id === selectedTree?.id);
  const completedPapers = new Set(selectedDocuments.map((document) => String(document.document_type || "")));

  return (
    <main className="min-h-screen bg-[#f3f7f1] text-slate-950">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-4 lg:px-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/20 p-6 shadow-sm lg:p-8">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/forest-bg.jpg')" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-green-950/92 via-green-900/70 to-green-950/22" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10" />

          <div className="relative z-10 flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-green-200">SUR ALOESWOOD ADMIN</p>
              <h1 className="mt-4 text-4xl font-black text-white lg:text-6xl">Tree Registry</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/80">
                Select a co-planter, review assigned AG trees, update tree registry details, and keep legal papers attached per tree.
              </p>
            </div>
            <button
              onClick={loadRegistry}
              className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm hover:bg-white/90"
            >
              Refresh
            </button>
          </div>

          <div className="relative z-10 mt-8 grid gap-3 md:grid-cols-4">
            <Metric title="Co-Planters" value={String(coPlanters.length)} />
            <Metric title="Total Trees" value={String(trees.length)} />
            <Metric title="DENR Tagged" value={String(trees.filter((tree) => Boolean(tree.denr_tag_number)).length)} />
            <Metric title="Tree Papers" value={String(documents.length)} />
          </div>

          {message && (
            <div className="relative z-10 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
              {message}
            </div>
          )}
        </section>

        <section className="grid gap-4 py-5 xl:grid-cols-[0.95fr_0.9fr_1.05fr_1.1fr]">
          <Panel title="Co-Planters" subtitle="First select the account owner.">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search co-planter"
              className="mb-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
            />
            <div className="space-y-3">
              {coPlanters.length === 0 ? (
                <Empty text="No co-planters found." />
              ) : (
                coPlanters.map((profile) => {
                  const count = trees.filter((tree) => tree.profile_id === profile.id).length;
                  const selected = profile.id === selectedProfileId;
                  return (
                    <button
                      key={profile.id}
                      onClick={() => selectProfile(profile.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selected ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-200"
                      }`}
                    >
                      <p className="text-base font-black text-slate-950">{profile.full_name || profile.email}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{profile.email}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge value={`${count} TREE${count === 1 ? "" : "S"}`} />
                        <Badge value={profile.kyc_status || "KYC"} />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </Panel>

          <Panel title="AG Trees" subtitle="Trees assigned to selected co-planter.">
            <div className="space-y-3">
              {!selectedProfile ? (
                <Empty text="Select a co-planter first." />
              ) : selectedTrees.length === 0 ? (
                <Empty text="No AG trees assigned to this co-planter." />
              ) : (
                selectedTrees.map((tree) => (
                  <button
                    key={tree.id}
                    onClick={() => selectTree(tree)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selectedTree?.id === tree.id
                        ? "border-emerald-400 bg-emerald-50"
                        : "border-slate-200 bg-white hover:border-emerald-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-black text-slate-950">{tree.tree_code || "Pending AG Code"}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">{tree.species || "Aquilaria Malaccensis"}</p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(tree.status)}`}>
                        {tree.status || "REGISTERED"}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs font-bold text-slate-500">
                      <span>DENR: {tree.denr_tag_number || "Pending"}</span>
                      <span>Planted: {formatDate(tree.planted_at)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </Panel>

          <Panel title="Tree Details" subtitle="Registry and legality checklist.">
            {!selectedTree ? (
              <Empty text="Select an AG tree first." />
            ) : (
              <>
                <div className="grid gap-3">
                  <Info label="Co-Planter" value={selectedProfile?.full_name || "-"} />
                  <Info label="AG Code" value={selectedTree.tree_code || "-"} />
                  <Info label="Purchase ID" value={selectedTree.purchase_id || "-"} />
                  <Info label="Species" value={selectedTree.species || "Aquilaria Malaccensis"} />
                </div>

                <div className="mt-5 grid gap-3">
                  <input value={denrTag} onChange={(event) => setDenrTag(event.target.value)} placeholder="DENR Tag Number" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input value={gpsLat} onChange={(event) => setGpsLat(event.target.value)} placeholder="GPS Latitude" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400" />
                    <input value={gpsLng} onChange={(event) => setGpsLng(event.target.value)} placeholder="GPS Longitude" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400" />
                  </div>
                  <input value={plantedAt} onChange={(event) => setPlantedAt(event.target.value)} type="date" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400" />
                  <select value={treeStatus} onChange={(event) => setTreeStatus(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400">
                    <option>REGISTERED</option>
                    <option>ACTIVE</option>
                    <option>GROWING</option>
                    <option>MAINTENANCE</option>
                    <option>HARVEST_READY</option>
                    <option>DAMAGED</option>
                  </select>
                  <button onClick={saveTree} disabled={loading} className="rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60">
                    {loading ? "Saving..." : "Save Tree Registry"}
                  </button>
                </div>

                <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                  <p className="text-sm font-black text-amber-950">Required Papers Per Tree</p>
                  <div className="mt-3 space-y-2">
                    {requiredPapers.map((paper) => (
                      <div key={paper} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
                        <span className="text-xs font-bold text-slate-700">{paper}</span>
                        <Badge value={completedPapers.has(paper) ? "READY" : "PENDING"} />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </Panel>

          <Panel title="Tree Papers" subtitle="Upload and view documents for the selected AG tree.">
            {!selectedTree ? (
              <Empty text="Select an AG tree before uploading papers." />
            ) : (
              <>
                {!documentsReady && (
                  <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
                    The tree document table is not ready yet. Run the SQL I will send so upload/view can work.
                  </div>
                )}

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                  <select value={paperType} onChange={(event) => setPaperType(event.target.value)} className="w-full rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none">
                    {requiredPapers.map((paper) => <option key={paper}>{paper}</option>)}
                  </select>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(event) => setPaperFile(event.target.files?.[0] || null)}
                    className="mt-3 block w-full text-sm font-bold text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-sm file:font-black file:text-white"
                  />
                  {paperFile && <p className="mt-2 text-xs font-black text-emerald-700">Selected: {paperFile.name}</p>}
                  <button onClick={uploadPaper} disabled={uploading || !documentsReady} className="mt-4 w-full rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60">
                    {uploading ? "Uploading..." : "Upload Paper"}
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {selectedDocuments.length === 0 ? (
                    <Empty text="No papers uploaded for this tree yet." />
                  ) : (
                    selectedDocuments.map((document) => (
                      <a key={document.id} href={document.file_url} target="_blank" className="block rounded-2xl border border-slate-200 bg-white p-4 hover:border-emerald-200">
                        <p className="text-sm font-black text-slate-950">{document.document_type}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">{document.file_name || "Open file"}</p>
                        <p className="mt-2 text-xs font-bold text-emerald-700">Uploaded {formatDate(document.uploaded_at)}</p>
                      </a>
                    ))
                  )}
                </div>
              </>
            )}
          </Panel>
        </section>
      </div>
    </main>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="min-h-[620px] rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm">
      <h2 className="text-2xl font-black text-slate-950">{title}</h2>
      <p className="mt-1 text-sm font-medium text-slate-500">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/16 p-4 backdrop-blur">
      <p className="text-xs font-black uppercase tracking-wide text-white/65">{title}</p>
      <p className="mt-2 truncate text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function Badge({ value }: { value: string }) {
  const status = String(value || "PENDING").toUpperCase();
  const style = ["ACTIVE", "APPROVED", "READY"].includes(status) || status.includes("TREE")
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : ["SUSPENDED", "REJECTED", "DAMAGED"].includes(status)
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-amber-200 bg-amber-50 text-amber-800";

  return <span className={`rounded-full border px-3 py-1 text-xs font-black ${style}`}>{status}</span>;
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">
      {text}
    </div>
  );
}
