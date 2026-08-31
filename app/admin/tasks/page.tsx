"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import {
  AdminPage, Drawer, FilterBar, Info, Panel, Recommended, SearchBox,
  StatusPill, dangerButton, dateText, pretty, primaryButton, upper, type Row,
} from "@/app/admin/_components/AdminV2";

type Group = { key: string; treeId: string; date: string; tree: Row | null; customer: Row | null; caretaker: Row | null; updates: Row[] };

export default function AdminTasksPage() {
  const [updates, setUpdates] = useState<Row[]>([]);
  const [trees, setTrees] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Group | null>(null);
  const [filter, setFilter] = useState("FOR_REVIEW");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, []);

  async function load() {
    setLoading(true); setNotice("");
    const [updateResult, treeResult, profileResult] = await Promise.all([
      supabase.from("sur_tree_updates").select("id,tree_id,caretaker_profile_id,observed_on,care_period,started_at,task_done,health_status,notes,photo_path,status,is_planting_record,review_note,created_at").order("created_at", { ascending: false }).limit(2000),
      supabase.from("sur_trees").select("id,tree_id,profile_id,caretaker_profile_id,planted_at,status,species").limit(3000),
      supabase.from("profiles").select("id,full_name,email,role").limit(3000),
    ]);
    const rows = (updateResult.data || []) as Row[];
    const withPhotos = await Promise.all(rows.map(async (row) => {
      if (!row.photo_path) return row;
      const signed = await supabase.storage.from("sur-tree-evidence").createSignedUrl(String(row.photo_path), 900);
      return { ...row, photo_url: signed.data?.signedUrl || "" };
    }));
    setUpdates(withPhotos); setTrees((treeResult.data || []) as Row[]); setProfiles((profileResult.data || []) as Row[]);
    if (updateResult.error || treeResult.error || profileResult.error) setNotice("Some task records are unavailable. Refresh once before reviewing reports.");
    setLoading(false);
  }

  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    for (const update of updates) {
      const key = `${update.tree_id}-${update.observed_on}`;
      const tree = trees.find((row) => row.id === update.tree_id) || null;
      const current = map.get(key) || {
        key, treeId: String(tree?.tree_id || update.tree_id), date: String(update.observed_on), tree,
        customer: profiles.find((row) => row.id === tree?.profile_id) || null,
        caretaker: profiles.find((row) => row.id === update.caretaker_profile_id) || null, updates: [],
      };
      current.updates.push(update); map.set(key, current);
    }
    return [...map.values()];
  }, [updates, trees, profiles]);

  const visible = groups.filter((group) => {
    const statuses = group.updates.map((row) => upper(row.status));
    const statusOk = filter === "FOR_REVIEW" ? statuses.includes("PENDING_ADMIN_REVIEW") : filter === "RETURNED" ? statuses.includes("REJECTED") : statuses.every((status) => status === "APPROVED");
    const text = `${group.treeId} ${group.customer?.full_name} ${group.customer?.email} ${group.caretaker?.full_name}`.toLowerCase();
    return statusOk && text.includes(search.toLowerCase().trim());
  });
  const pending = updates.filter((row) => upper(row.status) === "PENDING_ADMIN_REVIEW").length;

  async function review(id: unknown, decision: "APPROVED" | "REJECTED") {
    const note = window.prompt(decision === "APPROVED" ? "Approval note:" : "Required correction reason:", decision === "APPROVED" ? "Photo and task details verified." : "Please submit corrected evidence.");
    if (!note) return;
    setLoading(true);
    const result = await supabase.rpc("sur_admin_review_tree_update", { p_update_id: id, p_decision: decision, p_note: note });
    setNotice(result.error?.message || `Report ${decision === "APPROVED" ? "approved" : "returned for correction"}.`);
    if (!result.error) { setSelected(null); await load(); }
    setLoading(false);
  }

  return <AdminPage eyebrow="Tasks" title="Caretaker reports" detail="One daily card per customer and Tree ID. Open it to review QR tagging or Morning, Afternoon, and Evening evidence.">
    {notice && <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">{notice}</p>}
    <Recommended title={pending ? "Review the oldest caretaker report" : "Task review queue is clear"} detail={pending ? `${pending} report${pending === 1 ? " is" : "s are"} waiting. QR tagging must be verified before regular daily care.` : "No report currently needs an Admin decision."} />
    <section className="mt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><FilterBar values={["FOR_REVIEW", "RETURNED", "HISTORY"]} selected={filter} onChange={setFilter} /><SearchBox value={search} onChange={setSearch} placeholder="Customer, caretaker, or Tree ID" /></div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {visible.map((group) => <TaskCard key={group.key} group={group} onOpen={() => setSelected(group)} />)}
        {!loading && visible.length === 0 && <Panel><p className="text-sm font-bold text-[#718078]">No matching task record.</p></Panel>}
      </div>
    </section>
    <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} eyebrow={selected?.tree?.planted_at ? "Daily care review" : "First caretaker task"} title={selected?.treeId || "Task details"}>
      {selected && <><Panel><Info label="Customer" value={String(selected.customer?.full_name || "Unknown")} /><Info label="Caretaker" value={String(selected.caretaker?.full_name || "Unknown")} /><Info label="Date" value={dateText(selected.date)} /><Info label="Progress" value={`${selected.updates.length}/${selected.tree?.planted_at ? "3" : "1"} submitted`} /></Panel>
        {selected.updates.map((update) => <Report key={String(update.id)} update={update} isTagging={!selected.tree?.planted_at} loading={loading} onReview={review} />)}
      </>}
    </Drawer>
  </AdminPage>;
}

function TaskCard({ group, onOpen }: { group: Group; onOpen: () => void }) {
  const approved = group.updates.filter((row) => upper(row.status) === "APPROVED").length;
  const firstTag = !group.tree?.planted_at;
  const cardStatus = group.updates.some((row) => upper(row.status) === "PENDING_ADMIN_REVIEW") ? "FOR_REVIEW" : group.updates.some((row) => upper(row.status) === "REJECTED") ? "RETURNED" : "COMPLETE";
  return <button onClick={onOpen} className="overflow-hidden rounded-[1.6rem] border border-[#d9d4c5] bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="bg-gradient-to-r from-[#073d2e] to-[#57937a] p-5 text-white"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-white/65">{firstTag ? "QR tagging" : "Daily care"}</p><h2 className="mt-2 text-xl font-black">{group.treeId}</h2></div><StatusPill value={cardStatus} /></div></div><div className="p-5"><b className="block">Customer: {String(group.customer?.full_name || "Unknown")}</b><p className="mt-2 text-sm text-[#718078]">Caretaker: {String(group.caretaker?.full_name || "Unknown")} · {dateText(group.date)}</p><div className="mt-4 flex items-center justify-between"><span className="text-sm font-black">{firstTag ? `${group.updates.length} tagging submission` : `${group.updates.length}/3 submitted`}</span><span className="text-xs font-bold text-[#08745b]">{approved} approved →</span></div></div></button>;
}

function Report({ update, isTagging, loading, onReview }: { update: Row; isTagging: boolean; loading: boolean; onReview: (id: unknown, decision: "APPROVED" | "REJECTED") => Promise<void> }) {
  return <Panel><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#08745b]">{isTagging ? "QR Tagging" : pretty(update.care_period)}</p><h3 className="mt-2 text-xl font-black">{String(update.started_at || "").slice(0, 5) || "Submission"}</h3></div><StatusPill value={update.status} /></div>{Boolean(update.photo_url) && <div className="relative mt-4 h-56 overflow-hidden rounded-2xl bg-[#eaf6ef]"><Image unoptimized fill src={String(update.photo_url)} alt="Caretaker evidence" className="object-cover" /></div>}<Info label="Task completed" value={String(update.task_done || update.notes || "—")} /><Info label="Tree condition" value={pretty(update.health_status)} />{Boolean(update.notes) && <Info label="Notes" value={String(update.notes)} />}{Boolean(update.review_note) && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900">Admin note: {String(update.review_note)}</p>}{upper(update.status) === "PENDING_ADMIN_REVIEW" && <div className="mt-4 flex flex-col gap-2 sm:flex-row"><button disabled={loading} onClick={() => void onReview(update.id, "APPROVED")} className={primaryButton}>Approve</button><button disabled={loading} onClick={() => void onReview(update.id, "REJECTED")} className={dangerButton}>Return for correction</button></div>}</Panel>;
}
