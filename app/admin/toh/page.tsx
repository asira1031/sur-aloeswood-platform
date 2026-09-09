"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";

type TohReply = {
  answer: string;
  classification: string;
  evidence?: string[];
  mode: string;
  model?: string;
  modelConfigured: boolean;
};

const suggestions = [
  "Ano ang current proven status ng app?",
  "Paano mag-diagnose ng login o role redirect problem?",
  "Ano lang ang proven tungkol sa tree records?",
  "Paano ko malalaman kung updated ang Vercel deployment?",
];

export default function TohPage() {
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<TohReply | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function askToh(event: FormEvent) {
    event.preventDefault();
    const value = question.trim();
    if (!value) return;

    setLoading(true);
    setMessage("");
    setReply(null);

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setLoading(false);
      setMessage("Mag-login ulit bilang active admin para makausap si TOH.");
      return;
    }

    try {
      const response = await fetch("/api/toh/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: value }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Hindi makasagot si TOH ngayon.");
      setReply(result as TohReply);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Hindi makasagot si TOH ngayon.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f3f7f1] px-4 py-6 text-slate-950 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <section className="overflow-hidden rounded-[2rem] bg-[#06261a] p-6 text-white shadow-xl lg:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-emerald-200">Admin-only intelligence</p>
              <h1 className="mt-4 text-4xl font-black lg:text-6xl">Ask TOH</h1>
              <p className="mt-4 max-w-2xl leading-7 text-white/75">
                Read-only diagnosis at paliwanag para sa Direk Tony app. Walang Supabase write, approval, payout, deployment, o automatic repair.
              </p>
            </div>
            <Link href="/admin/dashboard" className="w-fit rounded-2xl border border-white/20 px-5 py-3 text-sm font-black hover:bg-white/10">
              Back to dashboard
            </Link>
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
          <strong>Safe use:</strong> Huwag maglagay ng password, API key, access token, customer record, wallet detail, o KYC document. Ang tanong at bounded app context ay mapapadala sa OpenAI kapag configured ang server key.
        </section>

        <section className="mt-5 rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-8">
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => setQuestion(suggestion)} className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-left text-xs font-bold text-emerald-900 hover:bg-emerald-100">
                {suggestion}
              </button>
            ))}
          </div>

          <form onSubmit={askToh} className="mt-6">
            <label htmlFor="toh-question" className="text-sm font-black">Tanong para kay TOH</label>
            <textarea
              id="toh-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={4000}
              rows={6}
              placeholder="Halimbawa: Admin login gumagana pero mali ang redirect. Ano ang una nating iche-check?"
              className="mt-2 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
            <div className="mt-3 flex items-center justify-between gap-4">
              <span className="text-xs text-slate-500">{question.length}/4000</span>
              <button disabled={loading || !question.trim()} className="rounded-2xl bg-emerald-700 px-6 py-3 text-sm font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
                {loading ? "Nag-a-analyze..." : "Ask TOH"}
              </button>
            </div>
          </form>

          {message && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{message}</div>}

          {reply && (
            <article className="mt-6 rounded-[1.6rem] border border-emerald-200 bg-emerald-50/60 p-5 lg:p-7">
              <div className="flex flex-wrap gap-2 text-xs font-black uppercase tracking-wide">
                <span className="rounded-full bg-emerald-800 px-3 py-1 text-white">{reply.classification}</span>
                <span className="rounded-full bg-white px-3 py-1 text-slate-700">{reply.mode}</span>
                <span className="rounded-full bg-white px-3 py-1 text-slate-700">{reply.modelConfigured ? reply.model || "AI configured" : "Evidence mode — no AI key"}</span>
              </div>
              <p className="mt-5 whitespace-pre-wrap text-base leading-8 text-slate-900">{reply.answer}</p>
              {reply.evidence?.length ? (
                <div className="mt-5 border-t border-emerald-200 pt-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Evidence boundary</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                    {reply.evidence.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              ) : null}
            </article>
          )}
        </section>
      </div>
    </main>
  );
}
