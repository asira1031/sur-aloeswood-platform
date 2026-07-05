"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { formatAgCode, formatDate, getNextAgNumbers, getProfile, peso, statusClass, type AnyRow } from "@/app/lib/admin/ag-codes";

function firstValue(row: AnyRow | null, keys: string[]) {
  if (!row) return "";
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return "";
}

function dateOnly(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function paymentScreenshotUrl(purchase: AnyRow | null) {
  return firstValue(purchase, [
    "payment_screenshot_url",
    "payment_proof_url",
    "proof_url",
    "receipt_url",
    "screenshot_url",
    "payment_image_url",
  ]);
}

function paymentDateValue(purchase: AnyRow | null) {
  return firstValue(purchase, [
    "payment_date",
    "paid_at",
    "proof_date",
    "receipt_date",
    "transaction_date",
    "payment_created_at",
  ]);
}

export default function AdminPurchasesPage() {
  const [purchases, setPurchases] = useState<AnyRow[]>([]);
  const [profiles, setProfiles] = useState<AnyRow[]>([]);
  const [treeRegistry, setTreeRegistry] = useState<AnyRow[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [selectedPurchaseId, setSelectedPurchaseId] = useState("");
  const [filter, setFilter] = useState("PENDING");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setMessage("");

    const [{ data: purchaseRows, error }, { data: profileRows }, { data: treeRows }] = await Promise.all([
      supabase.from("seedling_purchases").select("*").order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, full_name, email, mobile, mobile_number, account_status, kyc_status, membership_status, role")
        .limit(1000),
      supabase
        .from("tree_registry")
        .select("id, profile_id, purchase_id, tree_code, denr_tag_number, species, status, gps_lat, gps_lng, planted_at, created_at")
        .order("created_at", { ascending: false }),
    ]);

    if (error) {
      setMessage(error.message);
      return;
    }

    const safePurchases = (purchaseRows || []) as AnyRow[];
    const safeProfiles = (profileRows || []) as AnyRow[];
    setPurchases(safePurchases);
    setProfiles(safeProfiles);
    setTreeRegistry((treeRows || []) as AnyRow[]);

    const firstProfileId = selectedProfileId || safePurchases[0]?.profile_id || "";
    setSelectedProfileId(firstProfileId);
    const firstPurchase = safePurchases.find((purchase) => purchase.profile_id === firstProfileId) || safePurchases[0] || null;
    setSelectedPurchaseId(firstPurchase?.id || "");
  }

  function selectProfile(profileId: string) {
    setSelectedProfileId(profileId);
    const firstPurchase = purchases.find((purchase) => purchase.profile_id === profileId) || null;
    setSelectedPurchaseId(firstPurchase?.id || "");
  }

  async function approvePurchase(purchase: AnyRow) {
    setBusyId(purchase.id);
    setMessage("");

    const quantity = Number(purchase.quantity || 0);
    if (!purchase.profile_id || quantity <= 0) {
      setMessage("Purchase has missing profile or quantity.");
      setBusyId("");
      return;
    }

    const existingForPurchase = treeRegistry.filter((tree) => tree.purchase_id === purchase.id);
    const missingCount = Math.max(0, quantity - existingForPurchase.length);

    if (missingCount > 0) {
      const nextNumbers = getNextAgNumbers(treeRegistry, missingCount);
      const treeRows = nextNumbers.map((num) => ({
        profile_id: purchase.profile_id,
        purchase_id: purchase.id,
        tree_code: formatAgCode(num),
        denr_tag_number: null,
        species: "Aquilaria Malaccensis",
        status: "REGISTERED",
        gps_lat: null,
        gps_lng: null,
        planted_at: null,
      }));

      const { error: insertError } = await supabase.from("tree_registry").insert(treeRows);
      if (insertError) {
        setMessage(insertError.message);
        setBusyId("");
        return;
      }
    }

    const { error: updateError } = await supabase
      .from("seedling_purchases")
      .update({ status: "APPROVED", approved_at: new Date().toISOString() })
      .eq("id", purchase.id);

    if (updateError) {
      setMessage(updateError.message);
      setBusyId("");
      return;
    }

    await supabase.from("notifications").insert({
      profile_id: purchase.profile_id,
      title: "Seedling purchase approved",
      message: `Your seedling purchase was approved. ${quantity} AG tree code(s) were generated.`,
      is_read: false,
    });

    setMessage(`Approved. Generated ${missingCount} new AG tree code(s).`);
    await loadData();
    setBusyId("");
  }

  async function rejectPurchase(purchase: AnyRow) {
    setBusyId(purchase.id);
    setMessage("");

    const { error } = await supabase.from("seedling_purchases").update({ status: "REJECTED" }).eq("id", purchase.id);
    if (error) {
      setMessage(error.message);
      setBusyId("");
      return;
    }

    await supabase.from("notifications").insert({
      profile_id: purchase.profile_id,
      title: "Seedling purchase rejected",
      message: `Your seedling purchase reference ${purchase.payment_reference || purchase.id} was rejected. Please contact support.`,
      is_read: false,
    });

    setMessage("Purchase rejected.");
    await loadData();
    setBusyId("");
  }

  const accounts = useMemo(() => {
    const purchaseProfileIds = new Set(purchases.map((purchase) => String(purchase.profile_id || "")));
    return profiles
      .filter((profile) => purchaseProfileIds.has(String(profile.id)))
      .filter((profile) => {
        const keyword = search.toLowerCase().trim();
        const text = `${profile.full_name || ""} ${profile.email || ""}`.toLowerCase();
        return !keyword || text.includes(keyword);
      });
  }, [profiles, purchases, search]);

  const selectedProfile = getProfile(selectedProfileId, profiles);
  const profilePurchases = purchases.filter((purchase) => {
    const statusOk = filter === "ALL" || String(purchase.status || "").toUpperCase() === filter;
    return purchase.profile_id === selectedProfileId && statusOk;
  });

  const selectedPurchase =
    purchases.find((purchase) => purchase.id === selectedPurchaseId) ||
    profilePurchases[0] ||
    null;

  const selectedTrees = selectedPurchase ? treeRegistry.filter((tree) => tree.purchase_id === selectedPurchase.id) : [];
  const requestDate = dateOnly(selectedPurchase?.created_at);
  const screenshotDate = dateOnly(paymentDateValue(selectedPurchase));
  const hasDateMismatch = Boolean(requestDate && screenshotDate && requestDate !== screenshotDate);
  const hasScreenshot = Boolean(paymentScreenshotUrl(selectedPurchase));
  const pendingReviewCount = purchases.filter((purchase) => String(purchase.status || "").toUpperCase() === "PENDING").length;

  return (
    <main className="min-h-screen bg-[#f3f7f1] text-slate-950">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-4 lg:px-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/20 p-6 shadow-sm lg:p-8">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/forest-bg.jpg')" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-green-950/92 via-green-900/70 to-green-950/22" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10" />

          <div className="relative z-10 flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-green-200">SUR ALOESWOOD ADMIN</p>
              <h1 className="mt-4 text-4xl font-black text-white lg:text-6xl">Seedling Purchase Approval</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/80">
                Review co-planter purchases, verify payment proof, check request-vs-payment dates, then approve and generate AG tree records.
              </p>
            </div>
            <button onClick={loadData} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm hover:bg-white/90">
              Refresh
            </button>
          </div>

          <div className="relative z-10 mt-8 grid gap-3 md:grid-cols-4">
            <Metric title="Accounts" value={String(accounts.length)} />
            <Metric title="Pending Review" value={String(pendingReviewCount)} />
            <Metric title="Approved" value={String(purchases.filter((p) => String(p.status || "").toUpperCase() === "APPROVED").length)} />
            <Metric title="Registered Trees" value={String(treeRegistry.length)} />
          </div>

          {message && (
            <div className="relative z-10 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
              {message}
            </div>
          )}
        </section>

        <section className="grid gap-4 py-5 xl:grid-cols-[0.9fr_1fr_1.2fr]">
          <Panel title="Co-Planter Accounts" subtitle="Select who submitted the seedling request.">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search account"
              className="mb-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
            />
            <div className="space-y-3">
              {accounts.length === 0 ? (
                <Empty text="No purchase accounts found." />
              ) : (
                accounts.map((profile) => {
                  const profilePurchaseCount = purchases.filter((purchase) => purchase.profile_id === profile.id).length;
                  const profilePending = purchases.filter(
                    (purchase) => purchase.profile_id === profile.id && String(purchase.status || "").toUpperCase() === "PENDING"
                  ).length;
                  const selected = profile.id === selectedProfileId;

                  return (
                    <button
                      key={profile.id}
                      onClick={() => selectProfile(profile.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selected ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-200"
                      }`}
                    >
                      <p className="text-base font-black text-slate-950">{profile.full_name || profile.email}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{profile.email}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge value={`${profilePurchaseCount} REQUEST${profilePurchaseCount === 1 ? "" : "S"}`} />
                        {profilePending > 0 && <Badge value={`${profilePending} PENDING`} tone="red" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </Panel>

          <Panel title="Purchase / Tree List" subtitle="Select a request to review generated or pending tree records.">
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="mb-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
            >
              <option value="ALL">All requests</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>

            <div className="space-y-3">
              {!selectedProfile ? (
                <Empty text="Select a co-planter account first." />
              ) : profilePurchases.length === 0 ? (
                <Empty text="No purchase request under this filter." />
              ) : (
                profilePurchases.map((purchase) => {
                  const generatedTrees = treeRegistry.filter((tree) => tree.purchase_id === purchase.id);
                  const screenshot = paymentScreenshotUrl(purchase);
                  const requestOnly = dateOnly(purchase.created_at);
                  const proofOnly = dateOnly(paymentDateValue(purchase));
                  const mismatch = Boolean(requestOnly && proofOnly && requestOnly !== proofOnly);
                  const selected = purchase.id === selectedPurchase?.id;

                  return (
                    <button
                      key={purchase.id}
                      onClick={() => setSelectedPurchaseId(purchase.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selected ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-black text-slate-950">{purchase.quantity || 0} Seedling(s)</p>
                          <p className="mt-1 text-xs font-bold text-slate-500">{peso(purchase.amount)} - Ref: {purchase.payment_reference || "-"}</p>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(purchase.status)}`}>
                          {purchase.status || "PENDING"}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge value={`Trees ${generatedTrees.length}/${purchase.quantity || 0}`} />
                        {!screenshot && <Badge value="NO SCREENSHOT" tone="red" />}
                        {mismatch && <Badge value="DATE CHECK" tone="red" />}
                      </div>

                      {generatedTrees.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {generatedTrees.map((tree) => (
                            <span key={tree.id} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">
                              {tree.tree_code}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </Panel>

          <Panel title="Approval Detail" subtitle="Payment screenshot, date reader, and approval actions.">
            {!selectedPurchase ? (
              <Empty text="Select a purchase request first." />
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Info label="Co-Planter" value={selectedProfile?.full_name || "-"} />
                  <Info label="Email" value={selectedProfile?.email || "-"} />
                  <Info label="Quantity" value={String(selectedPurchase.quantity || 0)} />
                  <Info label="Amount" value={peso(selectedPurchase.amount)} />
                  <Info label="Payment Reference" value={selectedPurchase.payment_reference || "-"} />
                  <Info label="Request Date" value={requestDate || formatDate(selectedPurchase.created_at)} />
                  <Info label="Payment Screenshot Date" value={screenshotDate || "No payment date recorded"} />
                  <Info label="Approved At" value={formatDate(selectedPurchase.approved_at)} />
                </div>

                <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-950">Payment Screenshot</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">Admin must compare the screenshot against request details before approval.</p>
                    </div>
                    {!hasScreenshot && <Badge value="MISSING" tone="red" />}
                    {hasDateMismatch && <Badge value="DATE MISMATCH" tone="red" />}
                    {!hasDateMismatch && screenshotDate && <Badge value="DATE OK" />}
                  </div>

                  {hasDateMismatch && (
                    <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-800">
                      Double check needed: payment screenshot date is {screenshotDate}, but request date is {requestDate}.
                    </div>
                  )}

                  {!screenshotDate && (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-900">
                      Payment date reader needs a payment date field from the submitted proof. Add `payment_date` in the database to enable automatic date matching.
                    </div>
                  )}

                  {hasScreenshot ? (
                    <a href={paymentScreenshotUrl(selectedPurchase)} target="_blank" className="mt-4 block overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <img
                        src={paymentScreenshotUrl(selectedPurchase)}
                        alt="Payment proof screenshot"
                        className="max-h-[420px] w-full object-contain"
                      />
                    </a>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500">
                      No payment screenshot attached to this request.
                    </div>
                  )}
                </div>

                <div className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50/70 p-4">
                  <p className="text-sm font-black text-slate-950">Generated AG Trees</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedTrees.length === 0 ? (
                      <span className="text-sm font-bold text-slate-500">No AG codes yet. Approval will generate missing tree codes.</span>
                    ) : (
                      selectedTrees.map((tree) => (
                        <span key={tree.id} className="rounded-full bg-amber-100 px-4 py-2 text-xs font-black text-amber-900">
                          {tree.tree_code}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button
                    disabled={busyId === selectedPurchase.id || String(selectedPurchase.status || "").toUpperCase() === "APPROVED"}
                    onClick={() => approvePurchase(selectedPurchase)}
                    className="rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black text-white hover:bg-emerald-700 disabled:bg-slate-400"
                  >
                    Approve + Generate AG Codes
                  </button>
                  <button
                    disabled={busyId === selectedPurchase.id || String(selectedPurchase.status || "").toUpperCase() === "APPROVED"}
                    onClick={() => rejectPurchase(selectedPurchase)}
                    className="rounded-2xl bg-red-600 px-6 py-4 text-sm font-black text-white hover:bg-red-700 disabled:bg-slate-400"
                  >
                    Reject Purchase
                  </button>
                </div>
              </>
            )}
          </Panel>
        </section>
      </div>
    </main>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="min-h-[680px] rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm">
      <h2 className="text-2xl font-black text-slate-950">{title}</h2>
      <p className="mt-1 text-sm font-medium text-slate-500">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/16 p-4 backdrop-blur">
      <p className="text-xs font-black uppercase tracking-wide text-white/65">{title}</p>
      <p className="mt-2 truncate text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-black text-slate-950">{value || "-"}</p>
    </div>
  );
}

function Badge({ value, tone = "green" }: { value: string; tone?: "green" | "red" | "amber" }) {
  const style = tone === "red"
    ? "border-red-200 bg-red-50 text-red-800"
    : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return <span className={`rounded-full border px-3 py-1 text-xs font-black ${style}`}>{value}</span>;
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">
      {text}
    </div>
  );
}
