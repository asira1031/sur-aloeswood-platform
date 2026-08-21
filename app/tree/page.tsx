"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function TreeVerificationSearchPage() {
  const router = useRouter();
  const [treeId, setTreeId] = useState("");

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = treeId.trim().toUpperCase();
    if (clean) router.push(`/tree/${encodeURIComponent(clean)}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-950 via-[#07150f] to-slate-950 p-3 text-white sm:p-5">
      <section className="min-w-0 w-full max-w-2xl rounded-[1.5rem] border border-white/10 bg-white/[.07] p-5 shadow-2xl sm:rounded-[2rem] sm:p-7 md:p-10">
        <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-300 sm:tracking-[.28em]">SUR Aloeswood public verification</p>
        <h1 className="mt-4 text-3xl font-black sm:text-4xl">Verify a Tree ID</h1>
        <p className="mt-3 text-sm leading-7 text-white/60">Scan the printed QR tag or type the official SUR Tree ID. Public verification never shows customer, payment, contract, caretaker, or private farm details.</p>
        <form onSubmit={search} className="mt-7">
          <label htmlFor="tree-id" className="text-sm font-black">Official Tree ID</label>
          <input id="tree-id" value={treeId} onChange={(event) => setTreeId(event.target.value)} required placeholder="SUR-2026-XXXXXXXXXX" className="mt-2 w-full rounded-2xl border border-white/15 bg-black/25 px-4 py-4 text-base font-black uppercase text-white outline-none placeholder:text-white/25 focus:border-emerald-300 sm:text-lg" />
          <button className="mobile-primary-action mt-4 w-full rounded-2xl bg-emerald-400 px-6 py-4 font-black text-emerald-950">Verify Tree ID</button>
        </form>
        <div className="mt-6 grid gap-3 text-sm font-black sm:flex sm:flex-wrap"><Link href="/login" className="mobile-primary-action inline-flex w-full items-center justify-center rounded-xl border border-white/15 px-4 py-2 sm:w-auto">Customer sign in</Link><Link href="/farmer/daily-care" className="mobile-primary-action inline-flex w-full items-center justify-center rounded-xl border border-white/15 px-4 py-2 sm:w-auto">Caretaker daily care</Link></div>
      </section>
    </main>
  );
}
