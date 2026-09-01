"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { supabase } from "@/app/lib/supabase/client";

type TreeRecord = {
  id: string;
  tree_id: string;
  species: string;
  care_plan: string;
  status: string;
  general_location: string | null;
  planted_at: string | null;
  activated_at: string | null;
};

type ContractRecord = {
  id: string;
  version: string;
  legal_name: string;
  status: string;
  customer_signed_at: string | null;
  customer_signature: string | null;
  farm_signed_copy_path: string | null;
  template_path: string | null;
  identity_document_path: string | null;
  sent_at: string | null;
  notarization_status: string | null;
  notarized_copy_path: string | null;
  notarized_at: string | null;
  created_at: string;
  tree: TreeRecord | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

export default function ContractSigning({ contractId }: { contractId: string }) {
  const [contract, setContract] = useState<ContractRecord | null>(null);
  const [signature, setSignature] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [saleAccepted, setSaleAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadContract();
  }, [contractId]);

  async function loadContract() {
    setLoading(true);
    const { data, error } = await supabase
      .from("sur_contracts")
      .select("id,version,legal_name,status,customer_signed_at,customer_signature,farm_signed_copy_path,template_path,identity_document_path,sent_at,notarization_status,notarized_copy_path,notarized_at,created_at,sur_trees(id,tree_id,species,care_plan,status,general_location,planted_at,activated_at)")
      .eq("id", contractId)
      .maybeSingle();

    if (error || !data) {
      setContract(null);
      setMessage(error?.message || "Contract not found or you do not have access to it.");
      setLoading(false);
      return;
    }

    const normalized = {
      ...data,
      tree: one(data.sur_trees),
    } as ContractRecord;
    setContract(normalized);
    setSignature(normalized.customer_signature || "");
    setMessage("");
    setLoading(false);
  }

  async function sign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contract) return;

    const typed = signature.trim().replace(/\s+/g, " ");
    const expected = contract.legal_name.trim().replace(/\s+/g, " ");
    if (typed.toLocaleLowerCase() !== expected.toLocaleLowerCase()) {
      setMessage("Your typed signature must exactly match the legal name shown on this contract.");
      return;
    }

    if (!termsAccepted || !riskAccepted || !saleAccepted) {
      setMessage("Read and accept all three acknowledgements before signing.");
      return;
    }

    setSubmitting(true);
    setMessage("");
    const { error } = await supabase.rpc("sur_sign_tree_contract", {
      p_contract_id: contract.id,
      p_signature: typed,
      p_terms_accepted: termsAccepted,
      p_risk_accepted: riskAccepted,
      p_external_sale_accepted: saleAccepted,
    });
    setSubmitting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Contract signed. Your tree is now active and waiting for farm assignment.");
    await loadContract();
  }

  async function openFinalCopy() {
    if (!contract?.notarized_copy_path) return;
    const result = await supabase.storage.from("sur-contract-documents").createSignedUrl(contract.notarized_copy_path, 300);
    if (result.error) { setMessage(result.error.message); return; }
    window.open(result.data.signedUrl, "_blank", "noopener,noreferrer");
  }

  if (loading) {
    return <StateCard title="Opening your contract" text="Verifying ownership and loading the official tree record…" />;
  }

  if (!contract) {
    return <StateCard title="Contract unavailable" text={message || "Please return to My Agarwood or contact support."} />;
  }

  const pending = contract.status === "CUSTOMER_SIGNATURE_PENDING";

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-4 text-slate-950 print:bg-white print:p-0 sm:px-5 sm:py-7 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 grid gap-3 print:hidden sm:mb-5 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
          <Link href="/investor/my-trees" className="mobile-primary-action inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black sm:w-auto">← My Agarwood</Link>
          <button onClick={() => window.print()} className="mobile-primary-action w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black sm:w-auto">Print / Save as PDF</button>
        </div>

        <article className="min-w-0 rounded-[1.5rem] bg-white p-4 shadow-sm print:rounded-none print:shadow-none sm:rounded-[2rem] sm:p-6 md:p-10">
          <header className="border-b border-slate-200 pb-7">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-700 sm:tracking-[.25em]">SUR Aloeswood Platform</p>
                <h1 className="mt-3 text-2xl font-black leading-tight sm:text-3xl md:text-4xl">Per-Tree Agreement Acknowledgement</h1>
                <p className="mt-2 text-sm text-slate-500">Contract version {contract.version}</p>
              </div>
              <Status value={contract.status} />
            </div>
          </header>

          <section className="grid gap-3 border-b border-slate-200 py-7 sm:grid-cols-2">
            <Info label="Customer legal name" value={contract.legal_name} />
            <Info label="Official Tree ID" value={contract.tree?.tree_id || "Not available"} />
            <Info label="Species" value={contract.tree?.species || "Aquilaria malaccensis"} />
            <Info label="Care plan" value={pretty(contract.tree?.care_plan || "SKIP")} />
          </section>

          <section className="border-b border-slate-200 py-7">
            <h2 className="text-2xl font-black">Plain-language agreement summary</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              This screen records the customer&apos;s acknowledgement for the single Tree ID above. The official legal library and final signed copies remain the controlling documents.
            </p>
            <ol className="mt-5 space-y-4 text-sm leading-7 text-slate-700">
              <Clause number="1" title="What you bought">One agarwood tree package. SUR and its farm partners handle private farm selection, planting, physical QR tagging, and operational care.</Clause>
              <Clause number="2" title="Tree identity">This agreement belongs only to the Tree ID shown above. It does not grant access to private farm, caretaker, or other customer information.</Clause>
              <Clause number="3" title="Care coverage">Skip may later move to monthly or one-time care. Monthly stays monthly and must catch up missed coverage from month one. One-time care stays one-time until the tree is sold.</Clause>
              <Clause number="4" title="Risk and replacement">Tree health and survival are not guaranteed. Farm or caretaker fault may lead to replacement under the approved report. Natural disasters may not be replaceable. Existing paid care coverage follows an approved replacement tree.</Clause>
              <Clause number="5" title="Future sale">There is no guaranteed buyer, sale date, market price, or profit. Agarwood prices move up and down. Any sale amount, percentage distribution, referral entry, or future fund entry follows the signed legal agreement and approved external sale records.</Clause>
              <Clause number="6" title="Money records">Maya payments, banking, and withdrawals happen through approved external channels. The app shows verified balances, transaction history, receipts, and status; it is not itself a bank.</Clause>
              <Clause number="7" title="Support and documents">Questions, corrections, identity files, certificates, DENR copies, and transaction proof are handled through Agarwood Support Team and the applicable legal workflow.</Clause>
            </ol>
            <a href={contract.template_path || "/legal/sur-tree-agreement-dummy-v1.pdf"} target="_blank" rel="noreferrer" className="mt-5 inline-flex rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black">Open exact contract copy</a>
          </section>

          {pending ? (
            <form onSubmit={sign} className="py-7">
              <h2 className="text-2xl font-black">Sign this Tree ID</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">Read each statement. Your signature is accepted only when it matches the approved legal name exactly.</p>

              <div className="mt-5 space-y-3">
                <Check checked={termsAccepted} onChange={setTermsAccepted}>I reviewed this per-tree agreement summary and understand that the official legal documents control.</Check>
                <Check checked={riskAccepted} onChange={setRiskAccepted}>I understand the tree, market, timing, replacement, and natural-disaster risks are not guaranteed.</Check>
                <Check checked={saleAccepted} onChange={setSaleAccepted}>I understand future sale and distribution are handled externally and recorded only after approved documents and receipts.</Check>
              </div>

              <label className="mt-6 block text-sm font-black" htmlFor="legal-signature">Type your legal name</label>
              <input
                id="legal-signature"
                value={signature}
                onChange={(event) => setSignature(event.target.value)}
                autoComplete="name"
                required
                placeholder={contract.legal_name}
                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-base font-bold outline-none focus:border-emerald-600"
              />
              <p className="mt-2 text-xs text-slate-500">Must match: <b>{contract.legal_name}</b></p>

              {message && <p aria-live="polite" className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">{message}</p>}

              <button disabled={submitting} className="mobile-sticky-action mt-6 w-full rounded-2xl bg-emerald-700 px-7 py-4 font-black text-white disabled:opacity-50 sm:w-auto">
                {submitting ? "Signing securely…" : "Sign and activate this tree"}
              </button>
            </form>
          ) : (
            <section className="py-7">
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
                <p className="text-xs font-black uppercase tracking-[.2em] text-emerald-700">Customer signature recorded</p>
                <p className="mt-3 text-2xl font-black">{contract.customer_signature || contract.legal_name}</p>
                <p className="mt-2 text-sm font-bold text-emerald-900/65">Signed {dateTime(contract.customer_signed_at)}</p>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-600">Your Tree ID is active. The farm and admin can now continue assignment, QR tagging, planting, and approved update workflows.</p>
              {contract.notarization_status === "AWAITING_NOTARY" && <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">Your signature is complete. Admin is arranging notarization and will upload the final shared copy here.</p>}
              {contract.notarized_copy_path && <button type="button" onClick={() => void openFinalCopy()} className="mt-4 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white">Open final notarized PDF</button>}
              {message && <p className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-900">{message}</p>}
            </section>
          )}

          <footer className="border-t border-slate-200 pt-6 text-xs leading-6 text-slate-500">
            Contract record ID: {contract.id}<br />
            Created: {dateTime(contract.created_at)}
          </footer>
        </article>
      </div>
    </main>
  );
}

function Clause({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[2rem_1fr] gap-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 font-black text-emerald-800">{number}</span>
      <div><b>{title}.</b> {children}</div>
    </li>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (value: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-2xl border border-slate-200 p-4 text-sm font-bold leading-6">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-6 w-6 shrink-0 accent-emerald-700" />
      <span>{children}</span>
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-400">{label}</p><p className="mt-2 font-black">{value}</p></div>;
}

function Status({ value }: { value: string }) {
  const signed = value.includes("SIGNED");
  return <span className={`rounded-full px-4 py-2 text-xs font-black ${signed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{pretty(value)}</span>;
}

function StateCard({ title, text }: { title: string; text: string }) {
  return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-3 sm:p-5"><div className="w-full max-w-xl rounded-[1.5rem] bg-white p-5 text-center shadow-sm sm:rounded-[2rem] sm:p-8"><h1 className="text-2xl font-black sm:text-3xl">{title}</h1><p className="mt-3 text-sm leading-7 text-slate-600">{text}</p><Link href="/investor/my-trees" className="mobile-primary-action mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-emerald-700 px-5 py-3 font-black text-white sm:w-auto">Return to My Agarwood</Link></div></main>;
}

function pretty(value: string) {
  return String(value).replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateTime(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}
