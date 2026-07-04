"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { formatAgCode, formatDate, getNextAgNumbers, getProfile, peso, statusClass, type AnyRow } from "@/app/lib/admin/ag-codes";

export default function AdminPurchasesPage() {
  const [purchases, setPurchases] = useState<AnyRow[]>([]);
  const [profiles, setProfiles] = useState<AnyRow[]>([]);
  const [treeRegistry, setTreeRegistry] = useState<AnyRow[]>([]);
  const [selected, setSelected] = useState<AnyRow | null>(null);
  const [filter, setFilter] = useState("PENDING");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setMessage("");
    const [{ data: purchaseRows, error }, { data: profileRows }, { data: treeRows }] = await Promise.all([
      supabase.from("seedling_purchases").select("id, profile_id, quantity, amount, status, payment_reference, created_at, approved_at").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, email, mobile, mobile_number, account_status, kyc_status, membership_status").limit(1000),
      supabase.from("tree_registry").select("id, profile_id, purchase_id, tree_code, denr_tag_number, species, status, gps_lat, gps_lng, planted_at, created_at").order("created_at", { ascending: false }),
    ]);
    if (error) { setMessage(error.message); return; }
    const safePurchases = (purchaseRows || []) as AnyRow[];
    setPurchases(safePurchases);
    setProfiles((profileRows || []) as AnyRow[]);
    setTreeRegistry((treeRows || []) as AnyRow[]);
    setSelected(safePurchases[0] || null);
  }

  async function approvePurchase(purchase: AnyRow) {
    setBusyId(purchase.id);
    setMessage("");
    const quantity = Number(purchase.quantity || 0);
    if (!purchase.profile_id || quantity <= 0) { setMessage("Purchase has missing profile or quantity."); setBusyId(""); return; }
    const existingForPurchase = treeRegistry.filter((tree) => tree.purchase_id === purchase.id);
    const missingCount = Math.max(0, quantity - existingForPurchase.length);
    if (missingCount > 0) {
      const nextNumbers = getNextAgNumbers(treeRegistry, missingCount);
      const treeRows = nextNumbers.map((num) => ({
        profile_id: purchase.profile_id,
        purchase_id: purchase.id,
        tree_code: formatAgCode(num),
        denr_tag_number: null,
        species: "Aquilaria Malaccensis",
        status: "REGISTERED",
        gps_lat: null,
        gps_lng: null,
        planted_at: null,
      }));
      const { error: insertError } = await supabase.from("tree_registry").insert(treeRows);
      if (insertError) { setMessage(insertError.message); setBusyId(""); return; }
    }
    const { error: updateError } = await supabase.from("seedling_purchases").update({ status: "APPROVED", approved_at: new Date().toISOString() }).eq("id", purchase.id);
    if (updateError) { setMessage(updateError.message); setBusyId(""); return; }
    await supabase.from("notifications").insert({
      profile_id: purchase.profile_id,
      title: "Seedling purchase approved",
      message: `Your seedling purchase was approved. ${quantity} AG tree code(s) were generated.`,
      is_read: false,
    });
    setMessage(`Approved. Generated ${missingCount} new AG tree code(s).`);
    await loadData();
    setBusyId("");
  }

  async function rejectPurchase(purchase: AnyRow) {
    setBusyId(purchase.id); setMessage("");
    const { error } = await supabase.from("seedling_purchases").update({ status: "REJECTED" }).eq("id", purchase.id);
    if (error) { setMessage(error.message); setBusyId(""); return; }
    await supabase.from("notifications").insert({ profile_id: purchase.profile_id, title: "Seedling purchase rejected", message: `Your seedling purchase reference ${purchase.payment_reference || purchase.id} was rejected. Please contact support.`, is_read: false });
    setMessage("Purchase rejected.");
    await loadData();
    setBusyId("");
  }

  const filtered = useMemo(() => {
    const keyword = search.toLowerCase().trim();
    return purchases.filter((purchase) => {
      const profile = getProfile(purchase.profile_id, profiles);
      const statusOk = filter === "ALL" || String(purchase.status || "").toUpperCase() === filter;
      const text = `${JSON.stringify(purchase)} ${profile?.full_name || ""} ${profile?.email || ""}`.toLowerCase();
      return statusOk && (!keyword || text.includes(keyword));
    });
  }, [purchases, profiles, filter, search]);

  const selectedProfile = selected ? getProfile(selected.profile_id, profiles) : null;
  const selectedTrees = selected ? treeRegistry.filter((tree) => tree.purchase_id === selected.id) : [];

  return (
    <main className="min-h-screen bg-[#04140d] text-white">
      <section className="border-b border-white/10 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-green-300">SUR ALOESWOOD ADMIN</p>
              <h1 className="mt-4 text-4xl font-black md:text-6xl">Seedling Purchase Approval</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-green-50/80">Approve payments and automatically generate sequential AG tree codes.</p>
            </div>
            <button onClick={loadData} className="rounded-2xl bg-green-500 px-5 py-3 text-sm font-black text-green-950">Refresh</button>
          </div>
          {message && <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-8 md:grid-cols-4 md:px-10">
        <Metric title="Total Purchases" value={String(purchases.length)} />
        <Metric title="Pending" value={String(purchases.filter((p) => String(p.status || "").toUpperCase() === "PENDING").length)} />
        <Metric title="Approved" value={String(purchases.filter((p) => String(p.status || "").toUpperCase() === "APPROVED").length)} />
        <Metric title="Registered Trees" value={String(treeRegistry.length)} />
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-16 md:px-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-3xl font-black">Purchases</h2>
            <div className="flex flex-wrap gap-3">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none" />
              <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none">
                <option value="ALL">All</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 bg-black/25 p-6 text-sm font-bold text-white/60">No purchases found.</div> : filtered.map((purchase) => {
              const profile = getProfile(purchase.profile_id, profiles);
              const generatedCount = treeRegistry.filter((tree) => tree.purchase_id === purchase.id).length;
              return <button key={purchase.id} onClick={() => setSelected(purchase)} className={`w-full rounded-2xl border p-5 text-left ${selected?.id === purchase.id ? "border-green-300 bg-green-400/15" : "border-white/10 bg-black/25"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-lg font-black text-green-200">{profile?.full_name || profile?.email || "Unknown Co-Planter"}</p><p className="mt-1 text-sm text-white/60">{purchase.quantity || 0} seedling(s) • {peso(purchase.amount)}</p><p className="mt-1 text-xs text-white/45">Ref: {purchase.payment_reference || "-"}</p></div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(purchase.status)}`}>{purchase.status || "PENDING"}</span>
                </div>
                <div className="mt-4 grid gap-2 text-xs font-bold text-white/55 md:grid-cols-2"><span>Created: {formatDate(purchase.created_at)}</span><span>AG Codes: {generatedCount}/{purchase.quantity || 0}</span></div>
              </button>;
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
            <h2 className="text-3xl font-black">Approval Detail</h2>
            {!selected ? <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-black/25 p-6 text-sm font-bold text-white/60">Select a purchase.</div> : <>
              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <Info label="Co-Planter" value={selectedProfile?.full_name || "-"} />
                <Info label="Email" value={selectedProfile?.email || "-"} />
                <Info label="Quantity" value={String(selected.quantity || 0)} />
                <Info label="Amount" value={peso(selected.amount)} />
                <Info label="Payment Reference" value={selected.payment_reference || "-"} />
                <Info label="Status" value={selected.status || "PENDING"} />
              </div>
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-5">
                <p className="text-xs font-black uppercase tracking-wide text-green-100/60">AG Codes Generated</p>
                <div className="mt-4 flex flex-wrap gap-2">{selectedTrees.length === 0 ? <span className="text-sm font-bold text-white/55">No AG codes yet.</span> : selectedTrees.map((tree) => <span key={tree.id} className="rounded-full bg-yellow-400 px-4 py-2 text-xs font-black text-yellow-950">{tree.tree_code}</span>)}</div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <button disabled={busyId === selected.id || String(selected.status || "").toUpperCase() === "APPROVED"} onClick={() => approvePurchase(selected)} className="rounded-2xl bg-green-500 px-6 py-4 text-sm font-black text-green-950 disabled:bg-slate-500">Approve + Generate AG Codes</button>
                <button disabled={busyId === selected.id || String(selected.status || "").toUpperCase() === "APPROVED"} onClick={() => rejectPurchase(selected)} className="rounded-2xl bg-red-500 px-6 py-4 text-sm font-black text-white disabled:bg-slate-500">Reject Purchase</button>
              </div>
            </>}
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl"><p className="text-xs font-black uppercase tracking-wide text-green-100/60">{title}</p><p className="mt-3 truncate text-2xl font-black text-green-300">{value}</p></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-black/25 p-4"><p className="text-xs font-bold uppercase tracking-wide text-white/45">{label}</p><p className="mt-2 break-words text-sm font-black text-white">{value}</p></div>;
}
