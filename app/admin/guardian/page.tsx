"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import DeveloperStudio from "./DeveloperStudio";

export default function GuardianPage() {
  const [sql, setSql] = useState("select id, full_name, email, role, account_status\nfrom public.profiles\nlimit 25");
  const [confirmation, setConfirmation] = useState("");
  const [output, setOutput] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  async function send(action: "preview" | "execute") {
    setLoading(true); setOutput(null);
    try {
      const { data } = await supabase.auth.getSession(); const token = data.session?.access_token;
      if (!token) throw new Error("Mag-login ulit bilang active admin.");
      const response = await fetch("/api/guardian/query", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ sql, action, confirmation }) });
      const result = await response.json();
      if (!response.ok) throw Object.assign(new Error(result?.error || "Guardian request failed."), { result });
      setOutput(result);
    } catch (error) { setOutput((error as Error & { result?: unknown }).result || { error: error instanceof Error ? error.message : "Guardian request failed." }); }
    finally { setLoading(false); }
  }
  return <main className="min-h-screen bg-[#eef4ef] px-4 py-6 text-slate-950 lg:px-8"><div className="mx-auto max-w-6xl">
    <section className="rounded-[2rem] bg-[#071f17] p-6 text-white shadow-xl lg:p-10"><p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">SUR development and database gateway</p><div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="text-4xl font-black lg:text-6xl">Guardian</h1><p className="mt-3 max-w-3xl text-white/70">Brainstorm and queue local SUR development work, run fixed verification, and use the audited database bridge for project dvidrbhfzzhgwyempgtu.</p></div><Link href="/admin/dashboard" className="w-fit rounded-2xl border border-white/20 px-5 py-3 text-sm font-black hover:bg-white/10">Back to dashboard</Link></div></section>
    <DeveloperStudio />
    <section className="mt-5 rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-8"><p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-700">Audited SUR public-schema access</p><h2 className="mt-2 text-3xl font-black">SQL Bridge</h2><div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Permanent blocks:</strong> other schemas/projects, DDL, roles/grants, multiple statements, comments, system functions, and secrets. Writes need the exact confirmation.</div><label htmlFor="guardian-sql" className="mt-6 block text-sm font-black">One SQL statement</label><textarea id="guardian-sql" value={sql} onChange={(e) => setSql(e.target.value)} rows={12} spellCheck={false} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-950 p-4 font-mono text-sm leading-6 text-emerald-200 outline-none focus:border-emerald-500"/><label htmlFor="guardian-confirm" className="mt-5 block text-sm font-black">Write confirmation</label><input id="guardian-confirm" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="EXECUTE SUR WRITE" autoComplete="off" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-mono text-sm outline-none focus:border-emerald-500"/><div className="mt-5 flex flex-wrap gap-3"><button disabled={loading || !sql.trim()} onClick={() => send("preview")} className="rounded-2xl border border-emerald-700 px-6 py-3 text-sm font-black text-emerald-800 disabled:opacity-50">Preview policy check</button><button disabled={loading || !sql.trim()} onClick={() => send("execute")} className="rounded-2xl bg-emerald-800 px-6 py-3 text-sm font-black text-white disabled:opacity-50">{loading ? "Guardian checking..." : "Execute through Guardian"}</button></div>{output !== null && <pre className="mt-6 max-h-[34rem] overflow-auto rounded-2xl bg-slate-950 p-5 text-xs leading-6 text-slate-100">{JSON.stringify(output, null, 2)}</pre>}</section>
  </div></main>;
}
