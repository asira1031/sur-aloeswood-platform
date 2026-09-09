"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabase/client";

type Brief = { name: string; purpose: string; users: string; behavior: string; data: string; restrictions: string };
const emptyBrief: Brief = { name: "", purpose: "", users: "", behavior: "", data: "", restrictions: "" };

export default function DeveloperStudio() {
  const [brief, setBrief] = useState<Brief>(emptyBrief);
  const [result, setResult] = useState<unknown>(null);
  const [busy, setBusy] = useState("");
  const change = (key: keyof Brief, value: string) => setBrief((current) => ({ ...current, [key]: value }));

  async function request(action: "plan" | "save-brief" | "verify", workflow?: "security" | "lint") {
    setBusy(workflow || action); setResult(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Mag-login ulit bilang active admin.");
      const response = await fetch("/api/guardian/developer", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action, brief, workflow }) });
      const payload = await response.json();
      if (!response.ok) throw Object.assign(new Error(payload?.error || "Developer Studio request failed."), { payload });
      setResult(payload);
    } catch (error) {
      setResult((error as Error & { payload?: unknown }).payload || { error: error instanceof Error ? error.message : "Developer Studio request failed." });
    } finally { setBusy(""); }
  }

  return <section className="mt-5 rounded-[2rem] border border-sky-100 bg-white p-5 shadow-sm lg:p-8">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.25em] text-sky-700">Local-only development control plane</p><h2 className="mt-2 text-3xl font-black">Developer Studio</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Brainstorm → structured brief → Codex build handoff → fixed security/lint verification. Production receives no shell or filesystem authority.</p></div><span className="w-fit rounded-full bg-sky-100 px-4 py-2 text-xs font-black text-sky-800">LOCAL DEV ONLY</span></div>
    <div className="mt-6 grid gap-4 lg:grid-cols-2"><Field label="Feature name" value={brief.name} onChange={(v) => change("name", v)} placeholder="Customer appointment workflow"/><Field label="Target users" value={brief.users} onChange={(v) => change("users", v)} placeholder="Co-planter and admin"/><Area label="Purpose" value={brief.purpose} onChange={(v) => change("purpose", v)} placeholder="Anong problem ang sosolusyunan?"/><Area label="Expected behavior" value={brief.behavior} onChange={(v) => change("behavior", v)} placeholder="Step-by-step na gusto mong mangyari"/><Area label="Data involved" value={brief.data} onChange={(v) => change("data", v)} placeholder="Tables/fields kung alam; puwedeng blank"/><Area label="Restrictions" value={brief.restrictions} onChange={(v) => change("restrictions", v)} placeholder="Ano ang bawal mabago o mangyari?"/></div>
    <div className="mt-5 flex flex-wrap gap-3"><button disabled={!!busy} onClick={() => request("plan")} className="rounded-2xl border border-sky-700 px-5 py-3 text-sm font-black text-sky-800 disabled:opacity-50">{busy === "plan" ? "Planning..." : "Build plan"}</button><button disabled={!!busy} onClick={() => request("save-brief")} className="rounded-2xl bg-sky-700 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{busy === "save-brief" ? "Saving..." : "Queue for Codex"}</button><button disabled={!!busy} onClick={() => request("verify", "security")} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white disabled:opacity-50">Run security tests</button><button disabled={!!busy} onClick={() => request("verify", "lint")} className="rounded-2xl bg-slate-700 px-5 py-3 text-sm font-black text-white disabled:opacity-50">Run Guardian lint</button></div>
    {result !== null && <pre className="mt-6 max-h-[32rem] overflow-auto rounded-2xl bg-slate-950 p-5 text-xs leading-6 text-slate-100">{JSON.stringify(result, null, 2)}</pre>}
  </section>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="text-sm font-black">{label}<input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={500} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-sky-500"/></label>; }
function Area({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="text-sm font-black">{label}<textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={4} maxLength={3000} className="mt-2 w-full resize-y rounded-2xl border border-slate-300 p-4 font-normal leading-6 outline-none focus:border-sky-500"/></label>; }
