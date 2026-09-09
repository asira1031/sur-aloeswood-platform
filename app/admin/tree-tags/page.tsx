"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/app/lib/supabase/client";

type Row = Record<string, unknown>;

export default function AdminTreeTagsPage() {
  const [trees, setTrees] = useState<Row[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("sur_trees")
      .select("id,tree_id,species,status,created_at,planted_at")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.code === "PGRST205" ? "Tree Tags needs the one-time 080 setup." : error.message);
      setLoading(false);
      return;
    }

    const rows = (data || []) as Row[];
    setTrees(rows);
    setSelectedIds(rows.map((row) => String(row.id)));

    const origin = window.location.origin;
    const entries = await Promise.all(rows.map(async (row) => {
      const id = String(row.id);
      const url = `${origin}/tree/${encodeURIComponent(String(row.tree_id))}`;
      const image = await QRCode.toDataURL(url, {
        errorCorrectionLevel: "H",
        margin: 2,
        width: 480,
        color: { dark: "#052e16", light: "#ffffff" },
      });
      return [id, image] as const;
    }));
    setQrImages(Object.fromEntries(entries));
    setMessage("");
    setLoading(false);
  }

  function toggle(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  const selectedTrees = trees.filter((tree) => selectedIds.includes(String(tree.id)));

  return (
    <main className="min-h-screen bg-slate-100 p-3 text-slate-950 print:bg-white print:p-0 sm:p-5 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-[1.5rem] bg-emerald-950 p-5 text-white print:hidden sm:rounded-[2rem] sm:p-7">
          <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-300 sm:tracking-[.25em]">Admin physical operations</p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">Printable Tree QR Tags</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">The farm or caretaker prints and attaches one tag per Tree ID. Scanning shows only a privacy-safe public verification record.</p>
          <div className="mt-5 grid gap-3 sm:flex sm:flex-wrap">
            <button onClick={() => window.print()} disabled={selectedTrees.length === 0} className="mobile-primary-action w-full rounded-2xl bg-emerald-400 px-5 py-3 font-black text-emerald-950 disabled:opacity-40 sm:w-auto">Print {selectedTrees.length} selected tag{selectedTrees.length === 1 ? "" : "s"}</button>
            <button onClick={() => setSelectedIds(trees.map((tree) => String(tree.id)))} className="mobile-primary-action w-full rounded-2xl border border-white/15 px-5 py-3 text-sm font-black sm:w-auto">Select all</button>
            <button onClick={() => setSelectedIds([])} className="mobile-primary-action w-full rounded-2xl border border-white/15 px-5 py-3 text-sm font-black sm:w-auto">Clear</button>
            <button onClick={load} className="mobile-primary-action w-full rounded-2xl border border-white/15 px-5 py-3 text-sm font-black sm:w-auto">{loading ? "Loading…" : "Refresh"}</button>
          </div>
        </header>

        {message && <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900 print:hidden">{message}</p>}

        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 print:mt-0 print:grid-cols-2">
          {trees.length === 0 && !loading ? <p className="rounded-2xl border border-dashed bg-white p-6 font-bold text-slate-500 print:hidden">No official Tree ID is ready for printing.</p> : trees.map((tree) => {
            const id = String(tree.id);
            const selected = selectedIds.includes(id);
            return <article key={id} className={`${selected ? "" : "print:hidden"} break-inside-avoid rounded-[1.5rem] border-2 border-emerald-900 bg-white p-5 shadow-sm print:rounded-xl print:shadow-none`}>
              <label className="mb-4 flex min-h-12 items-center gap-3 text-xs font-black text-slate-500 print:hidden"><input type="checkbox" checked={selected} onChange={() => toggle(id)} className="h-6 w-6 accent-emerald-700" /> Include in print</label>
              <div className="text-center">
                <p className="text-xs font-black uppercase tracking-[.22em] text-emerald-800">SUR Aloeswood Verified Tree</p>
                {qrImages[id] ? <img src={qrImages[id]} alt={`QR code for ${String(tree.tree_id)}`} className="mx-auto mt-4 aspect-square w-64 max-w-full" /> : <div className="mx-auto mt-4 aspect-square w-64 max-w-full animate-pulse rounded-xl bg-slate-100" />}
                <h2 className="mt-3 break-words text-2xl font-black text-emerald-950">{String(tree.tree_id)}</h2>
                <p className="mt-1 text-sm font-bold text-slate-600">{String(tree.species)}</p>
                <p className="mt-4 border-t border-slate-200 pt-3 text-xs font-bold leading-5 text-slate-500">Scan to verify this Tree ID. Customer, payment, caretaker, contract, and private farm details are not public.</p>
                <Link href={`/tree/${encodeURIComponent(String(tree.tree_id))}`} target="_blank" className="mt-4 inline-flex text-xs font-black text-emerald-700 print:hidden">Test public record →</Link>
              </div>
            </article>;
          })}
        </section>
      </div>
    </main>
  );
}
