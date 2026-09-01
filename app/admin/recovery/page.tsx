"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/app/lib/supabase/client";

type Finding = { key:string; type:string; severity:string; sensitive:boolean; title:string; detail:string; createdAt?:string; reviewHref:string; allowedActions:string[] };
type History = { id:string; case_key:string; case_type:string; action:string; outcome:string; detail?:string; created_at:string };

export default function RecoveryCenterPage() {
  const [findings,setFindings]=useState<Finding[]>([]),[history,setHistory]=useState<History[]>([]);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(""),[message,setMessage]=useState("");
  const [setupReady,setSetupReady]=useState(true),[checkedAt,setCheckedAt]=useState("");

  async function request(path:string,options?:RequestInit){
    const {data}=await supabase.auth.getSession(); const token=data.session?.access_token;
    if(!token) throw new Error("Mag-login ulit bilang active admin.");
    const response=await fetch(path,{...options,headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`,...options?.headers}});
    const result=await response.json(); if(!response.ok) throw new Error(result.error||"Recovery request failed."); return result;
  }
  async function scan(){setLoading(true);setMessage("");try{const result=await request("/api/admin/recovery");setFindings(result.findings||[]);setHistory(result.history||[]);setSetupReady(Boolean(result.setupReady));setCheckedAt(result.checkedAt||"");if(result.warnings?.length)setMessage("Some records could not be checked. Open Guardian before repairing anything.");}catch(error){setMessage(error instanceof Error?error.message:"Recovery scan failed.");}finally{setLoading(false);}}
  useEffect(()=>{
    // Initial authenticated recovery scan; later scans are explicit Admin actions.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  async function act(item:Finding,action:string){
    let confirmation="";
    if(action==="CREATE_ZERO_WALLET") { confirmation=window.prompt("Type CREATE ZERO WALLET. This creates an empty wallet only; it does not add money.")||""; if(!confirmation)return; }
    if(action==="ESCALATE"&&!window.confirm("Record this case for technical review?"))return;
    if(action==="SEND_REMINDER"&&!window.confirm("Send one in-app pending-review notice?"))return;
    setBusy(`${item.key}:${action}`);setMessage("");
    try{const result=await request("/api/admin/recovery",{method:"POST",body:JSON.stringify({caseKey:item.key,action,confirmation,idempotencyKey:crypto.randomUUID()})});setMessage(result.message||"Action completed.");await scan();}
    catch(error){setMessage(error instanceof Error?error.message:"Recovery action failed.");}finally{setBusy("");}
  }

  const high=findings.filter(x=>x.severity==="HIGH").length;
  return <main className="min-h-screen bg-[#f4f1e7] px-4 py-5 text-[#10271f] sm:px-6 lg:px-8"><div className="mx-auto max-w-[1380px]">
    <header className="rounded-[2rem] bg-[#073d2e] p-6 text-white shadow-xl sm:p-8"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-black uppercase tracking-[.24em] text-[#bfe6d5]">TOH Recovery Guard</p><h1 className="mt-3 text-3xl font-black sm:text-5xl">Problems you can act on</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-white/75">TOH checks. You decide sensitive actions. Every repair must be verified and recorded.</p></div><button onClick={()=>void scan()} disabled={loading} className="w-fit rounded-2xl bg-[#dda93e] px-5 py-3 text-sm font-black text-[#211906] disabled:opacity-60">{loading?"Checking…":"Check again"}</button></div></header>
    {!setupReady&&<div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-950">Developer setup needed once: run <code>database/104-toh-recovery-center.sql</code>. Scanning works, but repair history and actions stay locked.</div>}
    {message&&<div className="mt-4 rounded-2xl border border-emerald-200 bg-white p-4 text-sm font-bold text-[#0b5a43]">{message}</div>}
    <section className="mt-5 grid gap-3 sm:grid-cols-3"><Metric label="Needs attention" value={String(findings.length)}/><Metric label="High priority" value={String(high)}/><Metric label="Last checked" value={checkedAt?new Date(checkedAt).toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit"}):"—"}/></section>
    <section className="mt-5 space-y-4">{findings.map(item=><article key={item.key} className="rounded-[1.75rem] border border-[#ded8c7] bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap gap-2"><Badge tone={item.severity==="HIGH"?"red":"amber"}>{item.severity}</Badge>{item.sensitive&&<Badge tone="slate">ADMIN DECISION</Badge>}</div><h2 className="mt-3 text-xl font-black">{item.title}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[#63746c]">{item.detail}</p>{item.createdAt&&<p className="mt-2 text-xs font-bold text-[#87938d]">Waiting since {new Date(item.createdAt).toLocaleString("en-PH")}</p>}</div><div className="flex flex-wrap gap-2 lg:max-w-md lg:justify-end"><Link href={item.reviewHref} className="rounded-xl border border-[#9fb8ac] px-4 py-2.5 text-sm font-black text-[#073d2e]">Open review</Link>{item.allowedActions.includes("VERIFY")&&<button onClick={()=>void act(item,"VERIFY")} disabled={Boolean(busy)} className="rounded-xl border border-[#9fb8ac] px-4 py-2.5 text-sm font-black">Verify</button>}{item.allowedActions.includes("SEND_REMINDER")&&<button onClick={()=>void act(item,"SEND_REMINDER")} disabled={Boolean(busy)||!setupReady} className="rounded-xl bg-[#e7f3ec] px-4 py-2.5 text-sm font-black text-[#0b5a43] disabled:opacity-40">Send notice</button>}{item.allowedActions.includes("CREATE_ZERO_WALLET")&&<button onClick={()=>void act(item,"CREATE_ZERO_WALLET")} disabled={Boolean(busy)||!setupReady} className="rounded-xl bg-[#dda93e] px-4 py-2.5 text-sm font-black text-[#211906] disabled:opacity-40">Safe repair</button>}{item.allowedActions.includes("ESCALATE")&&<button onClick={()=>void act(item,"ESCALATE")} disabled={Boolean(busy)||!setupReady} className="rounded-xl bg-[#7d2d2d] px-4 py-2.5 text-sm font-black text-white disabled:opacity-40">Escalate</button>}</div></div></article>)}{!loading&&!findings.length&&<div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-8 text-center"><h2 className="text-2xl font-black text-emerald-900">No recovery problem found</h2><p className="mt-2 text-sm text-emerald-800">This is a current scan, not a guarantee that every live workflow has been tested.</p></div>}</section>
    <section className="mt-5 rounded-[2rem] border border-[#ded8c7] bg-white p-5 shadow-sm sm:p-7"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#167553]">Append-only evidence</p><h2 className="mt-2 text-2xl font-black">Recovery history</h2></div><Link href="/admin/toh" className="text-sm font-black text-[#0b5a43]">Ask TOH</Link></div><div className="mt-5 space-y-2">{history.map(row=><div key={row.id} className="rounded-2xl bg-[#f7f5ee] p-4 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{row.action.replaceAll("_"," ")}</strong><Badge tone={row.outcome==="VERIFIED_SUCCESS"?"green":row.outcome==="ESCALATED"?"red":"slate"}>{row.outcome.replaceAll("_"," ")}</Badge></div><p className="mt-1 text-[#687970]">{row.detail||row.case_type} · {new Date(row.created_at).toLocaleString("en-PH")}</p></div>)}{!history.length&&<p className="text-sm text-[#718078]">No recovery action recorded yet.</p>}</div></section>
  </div></main>;
}
function Metric({label,value}:{label:string;value:string}){return <div className="rounded-[1.5rem] border border-[#ded8c7] bg-white p-5"><p className="text-xs font-black uppercase tracking-[.14em] text-[#718078]">{label}</p><p className="mt-2 text-3xl font-black text-[#073d2e]">{value}</p></div>}
function Badge({children,tone}:{children:ReactNode;tone:"red"|"amber"|"green"|"slate"}){const c={red:"bg-red-100 text-red-800",amber:"bg-amber-100 text-amber-900",green:"bg-emerald-100 text-emerald-800",slate:"bg-slate-100 text-slate-700"}[tone];return <span className={`rounded-full px-3 py-1 text-[11px] font-black ${c}`}>{children}</span>}
