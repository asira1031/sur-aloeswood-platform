"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";

type PublicRecord = {
  found: boolean;
  tree_id: string;
  species: string;
  status: string;
  registered_on: string;
  planted_on: string | null;
  qr_verified: boolean;
  privacy: string;
};

export default function PublicTreeRecord({ treeId }: { treeId: string }) {
  const [record, setRecord] = useState<PublicRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function verify() {
      const { data, error } = await supabase.rpc("sur_public_tree_lookup", { p_tree_id: treeId });
      if (error) setMessage(error.code === "PGRST202" ? "QR verification setup is pending." : "This Tree ID could not be verified right now.");
      else if (!data) setMessage("Tree ID not found. Check the printed code or contact Agarwood Support Team.");
      else setRecord(data as PublicRecord);
      setLoading(false);
    }
    void verify();
  }, [treeId]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-950 via-[#07150f] to-slate-950 p-3 text-white sm:p-5">
      <article className="min-w-0 w-full max-w-2xl rounded-[1.5rem] border border-white/10 bg-white/[.07] p-5 shadow-2xl backdrop-blur sm:rounded-[2rem] sm:p-7 md:p-10">
        <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-300 sm:tracking-[.28em]">SUR Aloeswood public verification</p>
        {loading ? (
          <><h1 className="mt-4 text-3xl font-black">Checking Tree ID…</h1><p className="mt-3 text-sm text-white/55">Reading the privacy-safe registry record.</p></>
        ) : !record ? (
          <><h1 className="mt-4 text-3xl font-black">Tree not verified</h1><p className="mt-3 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm font-bold text-amber-100">{message}</p></>
        ) : (
          <>
            <div className="mt-5 flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="text-xs font-black uppercase text-white/40">Official Tree ID</p><h1 className="mt-2 break-words text-3xl font-black text-emerald-300 sm:text-4xl">{record.tree_id}</h1></div><span className="shrink-0 rounded-full bg-emerald-300/15 px-4 py-2 text-xs font-black text-emerald-200">QR VERIFIED</span></div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2"><Info label="Species" value={record.species} /><Info label="Public status" value={pretty(record.status)} /><Info label="Registered" value={dateText(record.registered_on)} /><Info label="Planted" value={record.planted_on ? dateText(record.planted_on) : "Waiting for approved update"} /></div>
            <p className="mt-5 rounded-2xl bg-sky-300/10 p-4 text-sm font-bold leading-7 text-sky-100/75">{record.privacy}</p>
            <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap"><Link href={`/farmer/daily-care?tree=${encodeURIComponent(record.tree_id)}`} className="mobile-primary-action inline-flex w-full items-center justify-center rounded-2xl bg-emerald-400 px-5 py-3 text-center text-sm font-black text-emerald-950 sm:w-auto">Open caretaker task</Link><Link href="/login" className="mobile-primary-action inline-flex w-full items-center justify-center rounded-2xl border border-white/15 px-5 py-3 text-center text-sm font-black sm:w-auto">Customer/admin sign in</Link></div>
          </>
        )}
        <p className="mt-7 border-t border-white/10 pt-5 text-xs leading-6 text-white/35">A QR match confirms only that the Tree ID exists in SUR Aloeswood. It does not guarantee growth, sale timing, price, or profit.</p>
      </article>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-black/20 p-4"><p className="text-xs font-black uppercase text-white/35">{label}</p><p className="mt-2 font-black">{value}</p></div>; }
function pretty(value: string) { return String(value).replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function dateText(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }); }
