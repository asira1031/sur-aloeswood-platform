"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAuthenticatedProfile } from "@/app/lib/auth/session";
import { supabase } from "@/app/lib/supabase/client";

type Contract = { id: string; status: string; version: string; created_at: string };

export default function LegalitiesPage() {
  const [contract, setContract] = useState<Contract | null>(null);
  const [error, setError] = useState("");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void loadContract(); }, []);

  async function loadContract() {
    const profile = await getAuthenticatedProfile();
    if (!profile) { setLoading(false); return; }
    const treeId = new URLSearchParams(window.location.search).get("tree");
    let query = supabase.from("sur_contracts").select("id,status,version,created_at").eq("profile_id", profile.id).order("created_at", { ascending: false });
    if (treeId) query = query.eq("tree_id", treeId);
    const { data, error: loadError } = await query;
    if (loadError) setError("Contracts could not load. Please retry.");
    setContracts(data || []);
    setContract(data?.[0] || null);
    setLoading(false);
  }

  return <main className="min-h-screen bg-[#f7f3e8] text-[#12231c]">
    <header className="border-b border-[#0b3d2e]/10 bg-[#f7f3e8]"><div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between px-4 md:min-h-20 md:px-6"><Link href="/investor/my-trees" className="text-sm font-black text-[#0b3d2e]">← My Trees</Link><span className="text-xs font-black uppercase tracking-[.18em] text-[#64756d]">SUR Aloeswood</span></div></header>
    <section className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12"><p className="text-xs font-black uppercase tracking-[.16em] text-[#167553]">Documents</p><h1 className="mt-2 font-serif text-4xl font-black tracking-[-.03em] text-[#0b3d2e] md:text-5xl">Legals</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#64756d]">Open the company legal compilation or review your customer contract.</p>
      {error && <p role="alert" className="mt-4 text-red-700">{error}</p>}
      {contracts.length > 1 && <label className="mt-4 block">Choose contract<select className="ml-3 rounded border p-3" value={contract?.id || ""} onChange={event => setContract(contracts.find(item => item.id === event.target.value) || null)}>{contracts.map((item,index) => <option key={item.id} value={item.id}>Contract {index+1} — {pretty(item.status)} — {item.id.slice(0,8)}</option>)}</select></label>}
      <div className="mt-8 grid gap-4 md:grid-cols-2"><DocumentCard title="Legal Compilation" description="Company permits, registrations, licenses, and supporting legal documents in one PDF." meta="Company legal file" href="/legal/company-profile.pdf" label="Open PDF" external/><DocumentCard title="Customer Contract" description="Your tree ownership agreement and customer contract record." meta={loading?"Checking contract…":contract?pretty(contract.status):"Not available yet"} href={contract?`/investor/contracts/${contract.id}`:""} label="Open Contract" disabled={!contract||loading} badge={contract?.status==="CUSTOMER_SIGNATURE_PENDING"?"Action required":undefined}/></div>
    </section>
  </main>;
}

function DocumentCard({title,description,meta,href,label,external=false,disabled=false,badge}:{title:string;description:string;meta:string;href:string;label:string;external?:boolean;disabled?:boolean;badge?:string}){return <article className="flex min-h-72 flex-col rounded-[1.75rem] border border-[#dbe5df] bg-white p-6 shadow-[0_18px_45px_rgba(15,48,36,.08)] md:p-8"><div className="flex items-start justify-between gap-4"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#e7f5ed] text-2xl text-[#0b3d2e]">▤</div>{badge&&<span className="rounded-full bg-red-50 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-red-700">{badge}</span>}</div><h2 className="mt-6 text-2xl font-black text-[#0b3d2e]">{title}</h2><p className="mt-3 text-sm leading-6 text-[#64756d]">{description}</p><p className="mt-4 text-xs font-black uppercase tracking-[.1em] text-[#8a9891]">{meta}</p>{disabled?<span className="mt-auto block cursor-not-allowed rounded-2xl bg-[#edf0ed] px-5 py-4 text-center text-sm font-black text-[#8a9891]">{label}</span>:<Link href={href} target={external?"_blank":undefined} className="mt-auto block rounded-2xl bg-[#0b3d2e] px-5 py-4 text-center text-sm font-black text-white transition hover:bg-[#145b45]">{label}</Link>}</article>}
function pretty(value:string){return value.replaceAll("_"," ").toLowerCase().replace(/(^|\s)\S/g,letter=>letter.toUpperCase())}
