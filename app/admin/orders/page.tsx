"use client";

import { useEffect, useState } from "react";
import { peso } from "@/app/lib/business/rules";
import { supabase } from "@/app/lib/supabase/client";

type Row = Record<string, unknown>;

const FINAL_STATUSES = new Set(["APPROVED", "REJECTED"]);

export default function AdminOrdersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const receiptPath = String(selected?.receipt_path || "");

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadReceipt() {
      setReceiptUrl("");
      if (!receiptPath) return;

      const { data, error } = await supabase.storage
        .from("sur-payment-proofs")
        .createSignedUrl(receiptPath, 600);

      if (!cancelled) {
        if (error) setMessage(`Receipt is protected but could not be opened: ${error.message}`);
        else setReceiptUrl(data.signedUrl);
      }
    }

    void loadReceipt();
    return () => {
      cancelled = true;
    };
  }, [receiptPath]);

  async function load() {
    setBusy(true);
    const { data, error } = await supabase
      .from("sur_tree_orders")
      .select("*, sur_tree_order_items(*)")
      .order("created_at", { ascending: false })
      .limit(200);
    setBusy(false);

    if (error) {
      setMessage(
        error.code === "PGRST205"
          ? "One-time setup is pending. Apply database/080-final-blueprint-core.sql, then refresh this page."
          : "Order queue is temporarily unavailable. Check Guardian/PMS before processing payments."
      );
      return;
    }

    setMessage("");
    setRows(data || []);
    setSelected((current) =>
      (data || []).find((row) => row.id === current?.id) || (data || [])[0] || null
    );
  }

  async function approve() {
    if (!selected) return;
    const reason = window.prompt(
      "Approval note / verification evidence:",
      "Verified against official Maya transaction."
    );
    if (!reason) return;

    setBusy(true);
    const { data, error } = await supabase.rpc("sur_admin_approve_tree_order", {
      p_order_id: selected.id,
      p_reason: reason,
    });
    setBusy(false);
    setMessage(
      error?.message ||
        `Approved. ${String((data as { tree_count?: number })?.tree_count || 0)} tree records and contracts created.`
    );
    if (!error) await load();
  }

  async function reject() {
    if (!selected) return;
    const reason = window.prompt("Required rejection reason:");
    if (!reason) return;

    setBusy(true);
    const { error } = await supabase.rpc("sur_admin_reject_tree_order", {
      p_order_id: selected.id,
      p_reason: reason,
    });
    setBusy(false);
    setMessage(error?.message || "Order rejected with an audited reason.");
    if (!error) await load();
  }

  const selectedStatus = String(selected?.status || "");
  const isFinal = FINAL_STATUSES.has(selectedStatus);
  const underpaid = Number(selected?.submitted_total || 0) < Number(selected?.exact_total || 0);

  return (
    <main className="min-h-screen bg-slate-100 p-3 text-slate-950 sm:p-5 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-[1.5rem] bg-emerald-950 p-5 text-white sm:rounded-[2rem] sm:p-7">
          <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-300 sm:tracking-[.25em]">Admin Action Center</p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">Maya Tree Orders</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70">
            Open the protected receipt and verify it against the official Maya transaction. Approval creates one Tree ID and one customer-signature contract per tree.
          </p>
        </header>

        {message && (
          <p aria-live="polite" className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
            {message}
          </p>
        )}

        <div className="mt-5 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
          <section className="min-w-0 rounded-[1.5rem] bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-2xl font-black">Queue</h2>
                <p className="mt-1 text-xs text-slate-500">Newest submissions appear first.</p>
              </div>
              <button onClick={load} className="mobile-primary-action shrink-0 rounded-xl border px-4 py-2 text-sm font-black">
                {busy ? "Loading…" : "Refresh"}
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {rows.length === 0 && !busy ? (
                <p className="rounded-2xl border border-dashed p-5 text-sm font-bold text-slate-500">No tree orders yet.</p>
              ) : (
                rows.map((row) => (
                  <button
                    key={String(row.id)}
                    onClick={() => setSelected(row)}
                    className={`w-full rounded-2xl border p-4 text-left ${selected?.id === row.id ? "border-emerald-500 bg-emerald-50" : "bg-white"}`}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <span className="font-black">{String(row.order_no)}</span>
                      <span className="text-xs font-black text-amber-700">{String(row.status).replaceAll("_", " ")}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      Exact {peso(Number(row.exact_total))} · Sent {peso(Number(row.submitted_total))}
                    </p>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="min-w-0 rounded-[1.5rem] bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-6">
            {!selected ? (
              <p className="text-slate-500">Select an order.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase text-slate-400">Selected order</p>
                    <h2 className="mt-1 text-2xl font-black">{String(selected.order_no)}</h2>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black">
                    {selectedStatus.replaceAll("_", " ")}
                  </span>
                </div>

                {underpaid && (
                  <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
                    Underpayment detected. This order cannot be approved.
                  </p>
                )}

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <Info label="Sender" value={String(selected.sender_name)} />
                  <Info label="Maya reference" value={String(selected.payment_reference)} />
                  <Info label="Payment date" value={String(selected.payment_date)} />
                  <Info label="Exact / submitted" value={`${peso(Number(selected.exact_total))} / ${peso(Number(selected.submitted_total))}`} />
                </div>

                <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4">
                  <p className="text-xs font-black uppercase text-sky-700">Protected payment proof</p>
                  {receiptUrl ? (
                    <a href={receiptUrl} target="_blank" rel="noreferrer" className="mobile-primary-action mt-2 inline-flex w-full items-center justify-center rounded-xl bg-sky-700 px-4 py-2 text-center text-sm font-black text-white sm:w-auto">
                      Open receipt (10-minute link)
                    </a>
                  ) : (
                    <p className="mt-2 text-sm font-bold text-sky-900">Preparing the private receipt…</p>
                  )}
                </div>

                <h3 className="mt-6 font-black">Items</h3>
                <div className="mt-3 space-y-2">
                  {((selected.sur_tree_order_items as Row[]) || []).map((item) => (
                    <div key={String(item.id)} className="rounded-2xl bg-slate-50 p-4 text-sm">
                      <b>{String(item.quantity)} tree(s)</b> · {String(item.care_plan).replaceAll("_", " ")} · {peso(Number(item.line_total))}
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
                  <button disabled={busy || isFinal || underpaid} onClick={approve} className="mobile-primary-action w-full rounded-2xl bg-emerald-700 px-6 py-3 font-black text-white disabled:opacity-40 sm:w-auto">
                    Approve & create trees
                  </button>
                  <button disabled={busy || isFinal} onClick={reject} className="mobile-primary-action w-full rounded-2xl border border-red-200 px-6 py-3 font-black text-red-700 disabled:opacity-40 sm:w-auto">
                    Reject with reason
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-2 break-words font-black">{value}</p>
    </div>
  );
}
