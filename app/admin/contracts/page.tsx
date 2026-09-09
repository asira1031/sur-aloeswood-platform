"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase/client";
import { AdminPage, Drawer, FilterBar, Info, Panel, Recommended, SearchBox, StatusPill, dateText, pretty, primaryButton, type Row, upper } from "@/app/admin/_components/AdminV2";

const tabs = ["TO_SEND", "AWAITING_CUSTOMER", "AWAITING_NOTARY", "COMPLETE"];

export default function AdminContractsPage() {
  const [contracts, setContracts] = useState<Row[]>([]), [trees, setTrees] = useState<Row[]>([]), [profiles, setProfiles] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row | null>(null), [tab, setTab] = useState("TO_SEND"), [search, setSearch] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { void load(); }, []);

  async function load() {
    setBusy(true);
    const [c, t, p] = await Promise.all([
      supabase.from("sur_contracts").select("id,tree_id,profile_id,version,legal_name,status,customer_signed_at,customer_signature,farm_signed_copy_path,template_path,identity_document_path,sent_at,notarization_status,notarized_copy_path,notarized_copy_sha256,notarized_at,created_at").order("created_at", { ascending: false }).limit(3000),
      supabase.from("sur_trees").select("id,tree_id,species,care_plan,status").limit(3000),
      supabase.from("profiles").select("id,full_name,email,kyc_status,kyc_id_url,valid_id_url").limit(3000),
    ]);
    setContracts((c.data || []) as Row[]); setTrees((t.data || []) as Row[]); setProfiles((p.data || []) as Row[]);
    if (c.error || t.error || p.error) setNotice("Some contract records could not load. Apply migration 106, then refresh.");
    setBusy(false);
  }

  const rows = useMemo(() => contracts.filter((contract) => {
    const tree = trees.find((item) => item.id === contract.tree_id), profile = profiles.find((item) => item.id === contract.profile_id);
    return stage(contract) === tab && `${profile?.full_name} ${profile?.email} ${tree?.tree_id} ${contract.status}`.toLowerCase().includes(search.toLowerCase().trim());
  }), [contracts, profiles, search, tab, trees]);

  async function sendContract(contract: Row) {
    if (!window.confirm("Send this frozen contract version to the verified customer?")) return;
    setBusy(true); setNotice("");
    const result = await supabase.rpc("sur_admin_send_tree_contract", { p_contract_id: contract.id });
    setNotice(result.error?.message || "Contract sent. The customer can now review and sign it.");
    if (!result.error) { setSelected(null); await load(); } setBusy(false);
  }

  async function fileFinalCopy(contract: Row, file: File) {
    if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) { setNotice("Upload the returned notarized contract as a PDF."); return; }
    if (file.size > 20 * 1024 * 1024) { setNotice("Final contract PDF must be 20MB or smaller."); return; }
    if (!window.confirm("Confirm that this is the completed notarized copy returned by the notary.")) return;
    setBusy(true); setNotice("");
    try {
      const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      const sha256 = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
      const path = `${contract.id}/final-notarized-${Date.now()}.pdf`;
      const upload = await supabase.storage.from("sur-contract-documents").upload(path, file, { contentType: "application/pdf", upsert: false });
      if (upload.error) throw upload.error;
      const result = await supabase.rpc("sur_admin_finalize_notarized_contract", { p_contract_id: contract.id, p_document_path: path, p_sha256: sha256 });
      if (result.error) { await supabase.storage.from("sur-contract-documents").remove([path]); throw result.error; }
      setNotice("Final notarized copy filed. Admin and customer now share the same protected PDF."); setSelected(null); await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Final contract upload failed."); }
    setBusy(false);
  }

  async function openFinal(contract: Row) {
    const path = String(contract.notarized_copy_path || contract.farm_signed_copy_path || ""); if (!path) return;
    const result = await supabase.storage.from("sur-contract-documents").createSignedUrl(path, 300);
    if (result.error) { setNotice(result.error.message); return; } window.open(result.data.signedUrl, "_blank", "noopener,noreferrer");
  }

  const next = contracts.find((contract) => stage(contract) !== "COMPLETE"), selectedTree = selected ? trees.find((tree) => tree.id === selected.tree_id) : null, selectedProfile = selected ? profiles.find((profile) => profile.id === selected.profile_id) : null;
  return <AdminPage eyebrow="Contracts" title="Customer contract queue" detail="Send one frozen contract per Tree ID, wait for the verified customer signature, then file the returned notarized PDF as the final shared copy.">
    {notice && <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">{notice}</p>}
    <Recommended title={next ? actionLabel(stage(next)) : "Contract queue is clear"} detail={next ? "Open the oldest contract and complete only its current step." : "No customer contract currently needs Admin action."}/>
    <section className="mt-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><FilterBar values={tabs} selected={tab} onChange={setTab}/><SearchBox value={search} onChange={setSearch} placeholder="Customer or Tree ID"/></div>
      <div className="mt-4 space-y-3">{rows.map((contract) => { const tree = trees.find((item) => item.id === contract.tree_id), profile = profiles.find((item) => item.id === contract.profile_id); return <button key={String(contract.id)} onClick={() => setSelected(contract)} className="flex w-full items-center gap-3 rounded-[1.4rem] border border-[#d9d4c5] bg-white p-4 text-left shadow-sm hover:border-[#9bc5b3]"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eaf6ef] text-xl">📄</span><span className="min-w-0 flex-1"><b className="block truncate">{String(profile?.full_name || "Customer")}</b><small className="mt-1 block truncate text-[#718078]">{String(tree?.tree_id || "Tree ID")} · {dateText(contract.created_at)}</small></span><StatusPill value={actionLabel(stage(contract))}/></button>; })}{!busy && rows.length === 0 && <Panel><p className="text-sm font-bold text-[#718078]">No contracts in this step.</p></Panel>}</div>
    </section>
    <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} eyebrow="Per-tree contract" title={String(selectedTree?.tree_id || "Contract")}>{selected && <>
      <Panel><Info label="Customer" value={String(selectedProfile?.full_name || selected.legal_name)}/><Info label="KYC" value={pretty(selectedProfile?.kyc_status)}/><Info label="Valid ID" value={selected.identity_document_path ? "Verified ID snapshot attached" : "Will attach when sent"}/><Info label="Version" value={String(selected.version)}/><Info label="Status" value={<StatusPill value={selected.status}/>}/></Panel>
      <Panel><h3 className="text-lg font-black">Contract copy</h3><p className="mt-2 text-sm leading-6 text-[#718078]">The dummy is only for workflow testing. Replace it with the lawyer-approved PDF before public rollout.</p><a href={String(selected.template_path || "/legal/sur-tree-agreement-dummy-v1.pdf")} target="_blank" rel="noreferrer" className={`${primaryButton} mt-4 inline-flex`}>Open frozen template</a></Panel>
      {stage(selected) === "TO_SEND" && <Panel><h3 className="text-lg font-black">1. Send to customer</h3><p className="mt-2 text-sm leading-6 text-[#718078]">The system checks approved KYC, freezes the legal name and ID reference, then opens customer signing.</p><button disabled={busy} onClick={() => void sendContract(selected)} className={`${primaryButton} mt-4`}>Send contract</button></Panel>}
      {stage(selected) === "AWAITING_CUSTOMER" && <Panel><h3 className="text-lg font-black">2. Waiting for customer</h3><Info label="Sent" value={dateText(selected.sent_at)}/><p className="mt-2 text-sm leading-6 text-[#718078]">Customer must sign using the exact approved legal name.</p></Panel>}
      {stage(selected) === "AWAITING_NOTARY" && <Panel><h3 className="text-lg font-black">3. File notarized copy</h3><Info label="Customer signed" value={dateText(selected.customer_signed_at)}/><p className="mt-2 text-sm leading-6 text-[#718078]">Arrange lawful notarization outside the app. Upload only the completed PDF returned by the notary.</p><label className={`${primaryButton} mt-4 inline-flex cursor-pointer`}>Upload final PDF<input type="file" accept="application/pdf" className="hidden" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void fileFinalCopy(selected, file); event.target.value = ""; }}/></label></Panel>}
      {stage(selected) === "COMPLETE" && <Panel><h3 className="text-lg font-black">Final shared copy</h3><Info label="Filed" value={dateText(selected.notarized_at)}/><Info label="SHA-256" value={<span className="break-all text-xs">{String(selected.notarized_copy_sha256 || "—")}</span>}/><button onClick={() => void openFinal(selected)} className={`${primaryButton} mt-4`}>Open protected PDF</button></Panel>}
      <Link href="/admin/tree" className="text-sm font-black text-[#08745b]">Return to Tree queue</Link>
    </>}</Drawer>
  </AdminPage>;
}

function stage(contract: Row) { const status = upper(contract.status); if (status === "FINAL_NOTARIZED" || upper(contract.notarization_status) === "COMPLETE") return "COMPLETE"; if (status === "CUSTOMER_SIGNED" || upper(contract.notarization_status) === "AWAITING_NOTARY") return "AWAITING_NOTARY"; if (status === "CUSTOMER_SIGNATURE_PENDING" && contract.sent_at) return "AWAITING_CUSTOMER"; return "TO_SEND"; }
function actionLabel(value: string) { return value === "TO_SEND" ? "Send contract" : value === "AWAITING_CUSTOMER" ? "Waiting for customer" : value === "AWAITING_NOTARY" ? "Upload notarized copy" : "Complete"; }
