"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
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
  const [registryRows, setRegistryRows] = useState<AnyRow[]>([]);
  const [trees, setTrees] = useState<AnyRow[]>([]);
  const [profiles, setProfiles] = useState<AnyRow[]>([]);
  const [documents, setDocuments] = useState<AnyRow[]>([]);
  const [logs, setLogs] = useState<AnyRow[]>([]);
  const [orders, setOrders] = useState<AnyRow[]>([]);
  const [assignments, setAssignments] = useState<AnyRow[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [selectedTreeId, setSelectedTreeId] = useState("");
  const [search, setSearch] = useState("");
  const [denrTag, setDenrTag] = useState("");
  const [gpsLat, setGpsLat] = useState("");
  const [gpsLng, setGpsLng] = useState("");
  const [plantedAt, setPlantedAt] = useState("");
  const [verificationNote, setVerificationNote] = useState("");
  const [paperType, setPaperType] = useState(requiredPapers[0]);
  const [paperFile, setPaperFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [documentsReady, setDocumentsReady] = useState(true);

  useEffect(() => {
    void loadRegistry();
  }, []);

  async function loadRegistry() {
    setMessage("");

    const [rpcResult, registryResult, treeResult, profileResult, documentResult, logResult, orderResult, assignmentResult] = await Promise.all([
      supabase.rpc("admin_tree_registry_records"),
      supabase
        .from("admin_tree_registry_verification_view")
        .select("*")
        .order("tree_created_at", { ascending: false }),
      supabase
        .from("tree_registry")
        .select("id, profile_id, purchase_id, tree_code, denr_tag_number, species, status, gps_lat, gps_lng, planted_at, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, full_name, email, mobile, mobile_number, role, account_status, membership_status, created_at")
        .limit(2000),
      supabase
        .from("tree_documents")
        .select("id, tree_id, profile_id, document_type, file_name, file_url, uploaded_at")
        .order("uploaded_at", { ascending: false }),
      supabase
        .from("tree_growth_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(3000),
      supabase
        .from("maintenance_orders")
        .select("*")
        .limit(3000),
      supabase
        .from("gardener_assignments")
        .select("*")
        .limit(3000),
    ]);

    const safeRegistryRows = ((rpcResult.data || registryResult.data || []) as AnyRow[]);
    const safeTrees =
      treeResult.error || !(treeResult.data || []).length
        ? safeRegistryRows.map(registryRowToTree)
        : ((treeResult.data || []) as AnyRow[]);
    const safeProfiles =
      profileResult.error || !(profileResult.data || []).length
        ? buildProfilesFromRegistryRows(safeRegistryRows)
        : ((profileResult.data || []) as AnyRow[]);

    if (treeResult.error && !safeRegistryRows.length) {
      setMessage(`${treeResult.error.message}. Run the admin_tree_registry_records SQL so Tree Registry can read owner records safely.`);
      return;
    }

    if (rpcResult.error && registryResult.error) {
      setMessage(`${rpcResult.error.message}. ${registryResult.error.message}. Direct tree_registry fallback is active.`);
    }

    setRegistryRows(safeRegistryRows);
    setTrees(safeTrees);
    setProfiles(safeProfiles);
    setLogs((logResult.data || []) as AnyRow[]);
    setOrders((orderResult.data || []) as AnyRow[]);
    setAssignments((assignmentResult.data || []) as AnyRow[]);

    if (documentResult.error) {
      setDocumentsReady(false);
      setDocuments([]);
    } else {
      setDocumentsReady(true);
      setDocuments((documentResult.data || []) as AnyRow[]);
    }

    const owners = buildTreeOwners(safeTrees, safeProfiles, safeRegistryRows);
    const nextOwnerId = selectedOwnerId || owners[0]?.id || "";
    const nextTree =
      safeTrees.find((tree) => String(tree.profile_id || "") === String(nextOwnerId)) ||
      safeTrees[0] ||
      null;

    setSelectedOwnerId(nextOwnerId);
    selectTree(nextTree);
  }

  function selectOwner(ownerId: string) {
    setSelectedOwnerId(ownerId);
    const firstTree = trees.find((tree) => String(tree.profile_id || "") === String(ownerId)) || null;
    selectTree(firstTree);
  }

  function selectTree(tree: AnyRow | null) {
    setSelectedTreeId(tree?.id || "");
    setDenrTag(tree?.denr_tag_number || "");
    setGpsLat(tree?.gps_lat || "");
    setGpsLng(tree?.gps_lng || "");
    setPlantedAt(tree?.planted_at || "");
    setVerificationNote("");
  }

  async function saveRegistryOnly() {
    const selectedTree = trees.find((tree) => String(tree.id) === String(selectedTreeId));
    if (!selectedTree) {
      setMessage("Select an AG tree first.");
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
        status: selectedTree.status || "PENDING_PLANTING",
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
      message: `${selectedTree.tree_code} registry details were updated by admin.`,
      is_read: false,
    });

    setMessage("Registry details saved.");
    await loadRegistry();
    setLoading(false);
  }

  async function verifyTagAndCertify() {
    const selectedTree = trees.find((tree) => String(tree.id) === String(selectedTreeId));
    if (!selectedTree) {
      setMessage("Select an AG tree first.");
      return;
    }

    if (!denrTag.trim()) {
      setMessage("DENR/tag number is required before certification.");
      return;
    }

    if (!plantedAt) {
      setMessage("Planted date is required before certification.");
      return;
    }

    setLoading(true);
    setMessage("");

    const now = new Date().toISOString();
    const note = verificationNote.trim() || "Admin verified caretaker tag proof and certified this AG tree record.";

    const { error: treeError } = await supabase
      .from("tree_registry")
      .update({
        denr_tag_number: denrTag.trim(),
        gps_lat: gpsLat.trim() || null,
        gps_lng: gpsLng.trim() || null,
        planted_at: plantedAt,
        status: "REGISTERED",
        species: selectedTree.species || "Aquilaria Malaccensis",
      })
      .eq("id", selectedTree.id);

    if (treeError) {
      setMessage(treeError.message);
      setLoading(false);
      return;
    }

    await supabase
      .from("tree_growth_logs")
      .update({
        status: "VERIFIED",
        verified_at: now,
        admin_verification_note: note,
      })
      .or(`tree_id.eq.${selectedTree.id},tree_code.eq.${selectedTree.tree_code}`);

    await supabase
      .from("maintenance_orders")
      .update({
        work_status: "VERIFIED",
        verified_at: now,
        admin_verification_note: note,
        updated_at: now,
      })
      .eq("tree_id", selectedTree.id);

    const relatedOrderIds = orders
      .filter((order) => String(order.tree_id || "") === String(selectedTree.id))
      .map((order) => order.id)
      .filter(Boolean);

    if (relatedOrderIds.length > 0) {
      await supabase
        .from("gardener_assignments")
        .update({
          status: "VERIFIED",
          verified_at: now,
          admin_verification_note: note,
          updated_at: now,
        })
        .in("maintenance_order_id", relatedOrderIds);
    }

    await supabase.from("notifications").insert({
      profile_id: selectedTree.profile_id,
      title: `${selectedTree.tree_code} certified`,
      message: `${selectedTree.tree_code} has been verified and certified with tag ${denrTag.trim()}.`,
      is_read: false,
      created_at: now,
    });

    setMessage(`${selectedTree.tree_code} verified, tagged, and certified.`);
    await loadRegistry();
    setLoading(false);
  }

  async function uploadPaper() {
    const selectedTree = trees.find((tree) => String(tree.id) === String(selectedTreeId));
    if (!selectedTree) {
      setMessage("Select an AG tree before uploading papers.");
      return;
    }

    if (!documentsReady) {
      setMessage("Tree documents table is not ready.");
      return;
    }

    if (!paperFile) {
      setMessage("Choose a document file first.");
      return;
    }

    setUploading(true);
    setMessage("");

    const safeTreeCode = String(selectedTree.tree_code || selectedTree.id).replace(/[^a-zA-Z0-9._-]/g, "-");
    const safeFileName = paperFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const filePath = `${safeTreeCode}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("tree-papers")
      .upload(filePath, paperFile, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      setUploading(false);
      setMessage(`${uploadError.message}. Check tree-papers bucket and policies.`);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("tree-papers").getPublicUrl(filePath);

    const { error: insertError } = await supabase.from("tree_documents").insert({
      tree_id: selectedTree.id,
      profile_id: selectedTree.profile_id,
      document_type: paperType,
      file_name: paperFile.name,
      file_url: publicUrlData.publicUrl,
      uploaded_at: new Date().toISOString(),
    });

    if (insertError) {
      setUploading(false);
      setMessage(insertError.message);
      return;
    }

    setPaperFile(null);
    setUploading(false);
    setMessage("Tree legal paper uploaded.");
    await loadRegistry();
  }

  const treeOwners = useMemo(() => {
    const owners = buildTreeOwners(trees, profiles, registryRows);
    const keyword = search.toLowerCase().trim();

    return owners.filter((owner) => {
      const text = `${owner.full_name} ${owner.email} ${owner.role}`.toLowerCase();
      return !keyword || text.includes(keyword);
    });
  }, [trees, profiles, registryRows, search]);

  const selectedOwner = treeOwners.find((owner) => String(owner.id) === String(selectedOwnerId)) || null;
  const selectedTrees = trees.filter((tree) => String(tree.profile_id || "") === String(selectedOwnerId));
  const selectedTree = trees.find((tree) => String(tree.id) === String(selectedTreeId)) || selectedTrees[0] || null;
  const selectedRegistryRow = selectedTree
    ? registryRows.find((row) => String(row.tree_id || "") === String(selectedTree.id) || String(row.tree_code || "") === String(selectedTree.tree_code))
    : null;
  const selectedDocuments = documents.filter((document) => String(document.tree_id || "") === String(selectedTree?.id || ""));
  const completedPapers = new Set(selectedDocuments.map((document) => String(document.document_type || "")));
  const selectedLogs = logs.filter((log) => {
    if (!selectedTree) return false;
    return String(log.tree_id || "") === String(selectedTree.id) || String(log.tree_code || "") === String(selectedTree.tree_code);
  });
  const latestLog = selectedLogs[0] || null;
  const hasProof = Boolean(latestLog?.photo_url || latestLog?.serial_photo_url || latestLog?.submitted_denr_tag_number);
  const taggedCount = trees.filter((tree) => Boolean(tree.denr_tag_number && tree.planted_at)).length;
  const pendingVerifyCount = trees.filter((tree) => {
    const status = String(tree.status || "").toUpperCase();
    return status.includes("PENDING") || status === "REGISTERED" && !tree.denr_tag_number;
  }).length;

  return (
    <main className="min-h-screen bg-[#f3f7f1] text-slate-950">
      <div className="mx-auto w-full max-w-[1700px] px-4 py-4 lg:px-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/20 p-6 shadow-sm lg:p-8">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/forest-bg.jpg')" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-green-950/92 via-green-900/70 to-green-950/22" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10" />

          <div className="relative z-10 flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-green-200">SUR Aloeswood Admin</p>
              <h1 className="mt-4 text-4xl font-black text-white lg:text-6xl">Tree Registry</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/80">
                Official AG tree verification, certification, ownership, tag records, and legal documents after customer seedling purchase.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={loadRegistry} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm hover:bg-white/90">
                Refresh
              </button>
              <Link href="/admin/purchases" className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur">
                Seedling Lists
              </Link>
              <Link href="/admin/tree-maintenance" className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur">
                Maintenance
              </Link>
            </div>
          </div>

          <div className="relative z-10 mt-8 grid gap-3 md:grid-cols-4">
            <Metric title="Tree Owners" value={String(treeOwners.length)} />
            <Metric title="AG Trees" value={String(trees.length)} />
            <Metric title="Certified / Tagged" value={String(taggedCount)} />
            <Metric title="Pending Verification" value={String(pendingVerifyCount)} />
          </div>

          {message && (
            <div className="relative z-10 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
              {message}
            </div>
          )}
        </section>

        <section className="grid gap-4 py-5 xl:grid-cols-[0.82fr_0.9fr_1.18fr_1.1fr]">
          <Panel title="Tree Owners" subtitle="Shows every profile that owns an AG tree, regardless of role.">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search owner, email, role"
              className="mb-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
            />
            <div className="max-h-[720px] space-y-3 overflow-auto pr-1">
              {treeOwners.length === 0 ? (
                <Empty text="No tree owners found. Check tree_registry/profile RLS or admin session." />
              ) : (
                treeOwners.map((owner) => {
                  const selected = String(owner.id) === String(selectedOwnerId);
                  return (
                    <button
                      key={owner.id}
                      onClick={() => selectOwner(owner.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selected ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-200"
                      }`}
                    >
                      <p className="text-base font-black text-slate-950">{owner.full_name || owner.email || "Unnamed Owner"}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{owner.email || "No email"}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge value={`${owner.tree_count} TREE${owner.tree_count === 1 ? "" : "S"}`} />
                        <Badge value={owner.role || "OWNER"} />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </Panel>

          <Panel title="AG Tree Records" subtitle="Automatic tree records generated after seedling purchase.">
            <div className="max-h-[760px] space-y-3 overflow-auto pr-1">
              {!selectedOwner ? (
                <Empty text="Select a tree owner first." />
              ) : selectedTrees.length === 0 ? (
                <Empty text="No AG trees assigned to this owner." />
              ) : (
                selectedTrees.map((tree) => {
                  const registryRow = registryRows.find((row) => String(row.tree_id || "") === String(tree.id));
                  return (
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
                        <span>Purchase: {registryRow?.payment_reference || tree.purchase_id || "-"}</span>
                        <span>Caretaker: {registryRow?.caretaker_name || "Unassigned"}</span>
                        <span>Tag: {tree.denr_tag_number || "Pending verification"}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </Panel>

          <Panel title="Verification & Certification" subtitle="Compare caretaker field proof, then certify the official tree record.">
            {!selectedTree ? (
              <Empty text="Select an AG tree first." />
            ) : (
              <>
                <div className="grid gap-3">
                  <Info label="Owner" value={selectedOwner?.full_name || selectedRegistryRow?.owner_name || "-"} />
                  <Info label="Owner Email" value={selectedOwner?.email || selectedRegistryRow?.owner_email || "-"} />
                  <Info label="AG Code" value={selectedTree.tree_code || "-"} />
                  <Info label="Seedling Status" value={selectedRegistryRow?.seedling_status || selectedTree.status || "-"} />
                  <Info label="Caretaker" value={selectedRegistryRow?.caretaker_name || "Unassigned"} />
                  <Info label="Caretaker Email" value={selectedRegistryRow?.caretaker_email || "-"} />
                </div>

                <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <p className="text-sm font-black text-blue-950">Caretaker Tag Proof</p>
                  {latestLog ? (
                    <div className="mt-3 space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <Info label="Log Status" value={latestLog.status || "-"} />
                        <Info label="Submitted Tag / Serial" value={latestLog.submitted_denr_tag_number || "Missing"} />
                      </div>
                      <p className="text-sm font-bold leading-6 text-blue-900">
                        {latestLog.remarks || latestLog.notes || latestLog.caretaker_notes || "No caretaker notes."}
                      </p>
                      <div className="grid gap-3 md:grid-cols-2">
                        {latestLog.photo_url ? (
                          <a href={latestLog.photo_url} target="_blank" className="overflow-hidden rounded-2xl border border-blue-100 bg-white">
                            <img src={latestLog.photo_url} alt="Tree proof" className="max-h-72 w-full object-contain" />
                          </a>
                        ) : (
                          <Empty text="No tree photo submitted." />
                        )}
                        {latestLog.serial_photo_url ? (
                          <a href={latestLog.serial_photo_url} target="_blank" className="overflow-hidden rounded-2xl border border-blue-100 bg-white">
                            <img src={latestLog.serial_photo_url} alt="Tag proof" className="max-h-72 w-full object-contain" />
                          </a>
                        ) : (
                          <Empty text="No visible tag photo submitted." />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <Empty text="No caretaker proof yet. Seedling List / Maintenance handles the operational follow-up." />
                    </div>
                  )}
                </div>

                <div className="mt-5 grid gap-3">
                  <input value={denrTag} onChange={(event) => setDenrTag(event.target.value)} placeholder="Final DENR / Tag Number" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input value={gpsLat} onChange={(event) => setGpsLat(event.target.value)} placeholder="GPS Latitude" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400" />
                    <input value={gpsLng} onChange={(event) => setGpsLng(event.target.value)} placeholder="GPS Longitude" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400" />
                  </div>
                  <input value={plantedAt} onChange={(event) => setPlantedAt(event.target.value)} type="date" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400" />
                  <textarea
                    value={verificationNote}
                    onChange={(event) => setVerificationNote(event.target.value)}
                    rows={4}
                    placeholder="Admin verification note"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
                  />

                  <button onClick={verifyTagAndCertify} disabled={loading} className="rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60">
                    {loading ? "Certifying..." : "Verify Tag & Certify Tree"}
                  </button>

                  <button onClick={saveRegistryOnly} disabled={loading} className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-black text-slate-800 hover:bg-slate-100 disabled:opacity-60">
                    Save Registry Only
                  </button>
                </div>
              </>
            )}
          </Panel>

          <Panel title="Legal Papers" subtitle="Certification and legal document archive per AG tree.">
            {!selectedTree ? (
              <Empty text="Select an AG tree before uploading papers." />
            ) : (
              <>
                {!documentsReady && (
                  <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
                    Tree documents table is not ready.
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
                    {uploading ? "Uploading..." : "Upload Legal Paper"}
                  </button>
                </div>

                <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                  <p className="text-sm font-black text-amber-950">Required Legal Checklist</p>
                  <div className="mt-3 space-y-2">
                    {requiredPapers.map((paper) => (
                      <div key={paper} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
                        <span className="text-xs font-bold text-slate-700">{paper}</span>
                        <Badge value={completedPapers.has(paper) ? "READY" : "PENDING"} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {selectedDocuments.length === 0 ? (
                    <Empty text="No legal papers uploaded for this tree yet." />
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

function buildTreeOwners(trees: AnyRow[], profiles: AnyRow[], registryRows: AnyRow[]) {
  const profileMap = new Map(profiles.map((profile) => [String(profile.id), profile]));
  const registryMap = new Map<string, AnyRow>();

  for (const row of registryRows) {
    const key = String(row.profile_id || "");
    if (key && !registryMap.has(key)) registryMap.set(key, row);
  }

  const owners = new Map<string, AnyRow>();

  for (const tree of trees) {
    const id = String(tree.profile_id || "");
    if (!id) continue;

    const profile = profileMap.get(id) || {};
    const registry = registryMap.get(id) || {};
    const existing = owners.get(id);

    owners.set(id, {
      id,
      full_name: profile.full_name || registry.owner_name || existing?.full_name || "Unknown Tree Owner",
      email: profile.email || registry.owner_email || existing?.email || "",
      role: profile.role || registry.role || existing?.role || "TREE_OWNER",
      account_status: profile.account_status || existing?.account_status || "",
      membership_status: profile.membership_status || existing?.membership_status || "",
      tree_count: (existing?.tree_count || 0) + 1,
    });
  }

  return Array.from(owners.values()).sort((a, b) => String(a.full_name || "").localeCompare(String(b.full_name || "")));
}

function registryRowToTree(row: AnyRow) {
  return {
    id: row.tree_id || row.id,
    profile_id: row.profile_id,
    purchase_id: row.purchase_id,
    tree_code: row.tree_code,
    denr_tag_number: row.denr_tag_number,
    species: row.species || "Aquilaria Malaccensis",
    status: row.tree_status || row.status,
    gps_lat: row.gps_lat,
    gps_lng: row.gps_lng,
    planted_at: row.planted_at,
    created_at: row.tree_created_at || row.created_at,
  };
}

function buildProfilesFromRegistryRows(rows: AnyRow[]) {
  const profiles = new Map<string, AnyRow>();

  for (const row of rows) {
    const id = String(row.profile_id || "");
    if (!id || profiles.has(id)) continue;

    profiles.set(id, {
      id,
      full_name: row.owner_name || "Unknown Tree Owner",
      email: row.owner_email || "",
      role: row.owner_role || row.role || "TREE_OWNER",
      account_status: row.owner_account_status || row.account_status || "",
      membership_status: row.owner_membership_status || row.membership_status || "",
    });
  }

  return Array.from(profiles.values());
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="min-h-[680px] rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm">
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
      <p className="mt-2 break-words text-sm font-black text-slate-950">{value || "-"}</p>
    </div>
  );
}

function Badge({ value }: { value: string }) {
  const status = String(value || "PENDING").toUpperCase();
  const style = ["ACTIVE", "APPROVED", "READY", "REGISTERED", "GROWING", "VERIFIED", "ADMIN", "COPLANTER"].includes(status) || status.includes("TREE")
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
