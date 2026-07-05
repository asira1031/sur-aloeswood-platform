"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase/client";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type Tree = {
  id: string;
  profile_id: string | null;
  tree_code: string;
  denr_tag_number: string | null;
  species: string | null;
  status: string | null;
  gps_lat: string | null;
  gps_lng: string | null;
  planted_at: string | null;
};

type MaintenanceOrder = Record<string, any>;
type GrowthLog = Record<string, any>;

const maintenanceServices = [
  {
    key: "ARTICLE_VI_MONTHLY",
    title: "Monthly Maintenance",
    detail: "Article VI optional contribution for continued plantation care and monitoring.",
    amount: 200,
    plan: "MONTHLY_200",
    billing: "PHP 200 per month for 60 months",
    tone: "from-emerald-700 to-green-500",
  },
  {
    key: "ARTICLE_VI_ONE_TIME",
    title: "One-Time All-in Maintenance",
    detail: "Article VI all-in package satisfying the optional maintenance contribution.",
    amount: 5000,
    plan: "ONE_TIME_5000",
    billing: "PHP 5,000 one-time",
    tone: "from-amber-500 to-yellow-300",
  },
  {
    key: "PHOTO_DOCUMENTATION",
    title: "Photo Documentation",
    detail: "Request updated tree photos from the assigned farmer or caretaker.",
    amount: 150,
    plan: "PHOTO_150",
    billing: "PHP 150 per request",
    tone: "from-teal-700 to-cyan-500",
  },
  {
    key: "TREE_GUARD",
    title: "Tree Guard",
    detail: "Request protection support for a selected AG tree.",
    amount: 250,
    plan: "TREE_GUARD_250",
    billing: "PHP 250 per request",
    tone: "from-lime-700 to-emerald-500",
  },
  {
    key: "SOIL_PREMIUM",
    title: "Soil Premium",
    detail: "Request soil care review and field recommendation for the selected AG tree.",
    amount: 450,
    plan: "SOIL_PREMIUM_450",
    billing: "PHP 450 per request",
    tone: "from-stone-700 to-amber-600",
  },
];

const standardServiceAmounts: Record<string, number> = {
  ARTICLE_VI_MONTHLY: 200,
  ARTICLE_VI_ONE_TIME: 5000,
  PHOTO_DOCUMENTATION: 150,
  TREE_GUARD: 250,
  SOIL_PREMIUM: 450,
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const peso = (value: any) =>
  `PHP ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function CareServicesPage() {
  const searchParams = useSearchParams();
  const requestedTreeId = searchParams.get("tree") || "";

  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Record<string, any> | null>(null);
  const [trees, setTrees] = useState<Tree[]>([]);
  const [orders, setOrders] = useState<MaintenanceOrder[]>([]);
  const [logs, setLogs] = useState<GrowthLog[]>([]);
  const [selectedTreeId, setSelectedTreeId] = useState(requestedTreeId);
  const [selectedService, setSelectedService] = useState(maintenanceServices[0].key);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem("sur_login_email") || "";
    setEmail(savedEmail);
    if (savedEmail) void loadData(savedEmail);
  }, []);

  async function loadData(targetEmail = email) {
    const cleanEmail = targetEmail.toLowerCase().trim();
    if (!cleanEmail) {
      setMessage("Login email not found. Please login again.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (profileError || !profileRow) {
      setLoading(false);
      setMessage(profileError?.message || "Profile not found.");
      return;
    }

    const [{ data: walletRow }, { data: treeRows, error: treeError }, orderResult] = await Promise.all([
      supabase.from("wallets").select("id, profile_id, balance, updated_at").eq("profile_id", profileRow.id).maybeSingle(),
      supabase
        .from("tree_registry")
        .select("id, profile_id, tree_code, denr_tag_number, species, status, gps_lat, gps_lng, planted_at")
        .eq("profile_id", profileRow.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("maintenance_orders")
        .select("*")
        .eq("profile_id", profileRow.id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    setLoading(false);

    if (treeError) {
      setMessage(treeError.message);
      return;
    }

    if (orderResult.error) {
      setMessage(`${orderResult.error.message}. Run the maintenance_orders SQL first so paid maintenance orders can be recorded.`);
    }

    const safeTrees = (treeRows || []) as Tree[];
    const treeIds = safeTrees.map((tree) => tree.id);
    let logRows: GrowthLog[] = [];

    if (treeIds.length > 0) {
      const { data } = await supabase
        .from("tree_growth_logs")
        .select("id, profile_id, tree_id, tree_code, gardener_id, height_cm, diameter_cm, health_status, remarks, notes, photo_url, status, created_at")
        .in("tree_id", treeIds)
        .order("created_at", { ascending: false });

      logRows = (data || []) as GrowthLog[];
    }

    setProfile(profileRow as Profile);
    setWallet(walletRow || null);
    setTrees(safeTrees);
    setOrders(normalizeMaintenanceOrders((orderResult.data || []) as MaintenanceOrder[]));
    setLogs(logRows);
    setSelectedTreeId((current) => {
      if (current && safeTrees.some((tree) => tree.id === current)) return current;
      return safeTrees[0]?.id || "";
    });
  }

  async function submitRequest() {
    setMessage("");

    if (!profile) {
      setMessage("Load your profile first.");
      return;
    }

    if (!selectedTree) {
      setMessage("Select an AG tree first.");
      return;
    }

    const service = maintenanceServices.find((item) => item.key === selectedService) || maintenanceServices[0];
    const amount = Number(service.amount || 0);
    const walletBalance = Number(wallet?.balance || 0);
    const shouldPayNow = amount > 0 && walletBalance >= amount;
    const reference = `MAINT-${Date.now()}`;

    setSubmitting(true);

    if (shouldPayNow && wallet?.id) {
      const nextBalance = walletBalance - amount;
      const { error: walletError } = await supabase
        .from("wallets")
        .update({ balance: nextBalance, updated_at: new Date().toISOString() })
        .eq("id", wallet.id);

      if (walletError) {
        setSubmitting(false);
        setMessage(walletError.message);
        return;
      }

      await supabase.from("profiles").update({ wallet_balance: nextBalance }).eq("id", profile.id);
      await supabase.from("wallet_transactions").insert({
        profile_id: profile.id,
        transaction_type: "MAINTENANCE_PAYMENT",
        amount,
        description: `${service.title} payment for ${selectedTree.tree_code}. Reference: ${reference}.`,
        status: "APPROVED",
      });
    }

    const paymentStatus = amount <= 0 ? "FOR_QUOTE" : shouldPayNow ? "PAID" : "PENDING_PAYMENT";
    const workStatus = paymentStatus === "PAID" ? "READY_FOR_ASSIGNMENT" : paymentStatus;
    const { error } = await supabase.from("maintenance_orders").insert({
      profile_id: profile.id,
      tree_id: selectedTree.id,
      tree_code: selectedTree.tree_code,
      service_type: service.key,
      plan_type: service.plan,
      amount,
      payment_status: paymentStatus,
      work_status: workStatus,
      payment_reference: reference,
      customer_note: note.trim() || null,
    });

    setSubmitting(false);

    if (error) {
      setMessage(`${error.message}. Run the maintenance_orders SQL first so paid maintenance orders can be recorded.`);
      return;
    }

    setNote("");
    setMessage(
      paymentStatus === "PAID"
        ? "Maintenance order paid from wallet and sent to admin for caretaker assignment."
        : paymentStatus === "FOR_QUOTE"
          ? "Maintenance request sent for admin quotation before payment."
          : `Maintenance order created. Please cash-in or keep enough wallet balance to pay ${peso(amount)} before assignment.`
    );
    await loadData(profile.email || email);
  }

  async function payExistingOrder(order: MaintenanceOrder) {
    setMessage("");

    if (!profile) {
      setMessage("Load your profile first.");
      return;
    }

    const amount = getOrderAmount(order);
    const walletBalance = Number(wallet?.balance || 0);

    if (amount <= 0) {
      setMessage("This request is still waiting for admin quotation.");
      return;
    }

    if (!wallet?.id || walletBalance < amount) {
      setMessage(`Wallet balance is not enough. Please cash-in at least ${peso(amount)} before paying this order.`);
      return;
    }

    setSubmitting(true);
    const nextBalance = walletBalance - amount;

    const { error: walletError } = await supabase
      .from("wallets")
      .update({ balance: nextBalance, updated_at: new Date().toISOString() })
      .eq("id", wallet.id);

    if (walletError) {
      setSubmitting(false);
      setMessage(walletError.message);
      return;
    }

    await supabase.from("profiles").update({ wallet_balance: nextBalance }).eq("id", profile.id);
    await supabase.from("wallet_transactions").insert({
      profile_id: profile.id,
      transaction_type: "MAINTENANCE_PAYMENT",
      amount,
      description: `${serviceTitle(order.service_type)} payment for ${order.tree_code || selectedTree?.tree_code || "AG Tree"}. Reference: ${order.payment_reference || order.id}.`,
      status: "APPROVED",
    });

    const { error } = await supabase
      .from("maintenance_orders")
      .update({
        payment_status: "PAID",
        work_status: "READY_FOR_ASSIGNMENT",
        paid_at: new Date().toISOString(),
        amount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    if (error) {
      setSubmitting(false);
      setMessage(error.message);
      return;
    }

    await supabase.from("notifications").insert({
      profile_id: profile.id,
      title: "Maintenance payment received",
      message: `${serviceTitle(order.service_type)} for ${order.tree_code || selectedTree?.tree_code || "your AG tree"} is now paid and ready for admin assignment.`,
      is_read: false,
    });

    setSubmitting(false);
    setMessage("Maintenance quote paid from wallet and sent to admin for caretaker assignment.");
    await loadData(profile.email || email);
  }

  const selectedTree = useMemo(
    () => trees.find((tree) => tree.id === selectedTreeId) || null,
    [trees, selectedTreeId]
  );
  const selectedServiceItem = maintenanceServices.find((item) => item.key === selectedService) || maintenanceServices[0];
  const treeOrders = orders.filter((order) => order.tree_id === selectedTree?.id);
  const selectedLogs = logs.filter((log) => log.tree_id === selectedTree?.id);
  const latestPhoto = selectedLogs.find((log) => Boolean(log.photo_url));
  const canPayNow = Number(wallet?.balance || 0) >= Number(selectedServiceItem.amount || 0);

  return (
    <main className="min-h-screen bg-[#f3f7f1] text-slate-950">
      <div className="mx-auto w-full max-w-[1480px] px-4 py-4 lg:px-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/20 p-6 shadow-sm lg:p-8">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/forest-bg.jpg')" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-green-950/92 via-green-900/68 to-green-950/22" />
          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-emerald-200">SUR Care Services</p>
              <h1 className="mt-4 text-4xl font-black text-white lg:text-6xl">Tree Maintenance Orders</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78">
                Select one AG tree, choose a maintenance service, then pay through your SUR wallet before admin assigns a farmer or caretaker.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => loadData()} disabled={loading} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm disabled:opacity-60">
                {loading ? "Loading..." : "Refresh"}
              </button>
              <Link href="/investor/wallet" className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur">
                Wallet
              </Link>
              <Link href="/investor/my-trees" className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur">
                My AG Trees
              </Link>
            </div>
          </div>

          <div className="relative z-10 mt-8 grid gap-3 md:grid-cols-4">
            <HeroStat label="Wallet Balance" value={peso(wallet?.balance)} />
            <HeroStat label="AG Trees" value={String(trees.length)} />
            <HeroStat label="Maintenance Orders" value={String(orders.length)} />
            <HeroStat label="Caretaker Updates" value={String(logs.length)} />
          </div>
        </section>

        {message && (
          <div className="mt-5 rounded-2xl border border-emerald-100 bg-white px-5 py-4 text-sm font-bold text-emerald-900">
            {message}
          </div>
        )}

        <section className="mt-5 grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
          <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Select AG Tree</h2>
                <p className="mt-1 text-sm text-slate-600">Maintenance orders are always attached to one tree.</p>
              </div>
              <Badge value={`${trees.length} TREES`} />
            </div>
            <div className="mt-5 grid gap-3">
              {trees.length === 0 ? (
                <Empty text="No AG trees found for this account." />
              ) : (
                trees.map((tree) => (
                  <button
                    key={tree.id}
                    onClick={() => setSelectedTreeId(tree.id)}
                    className={`rounded-2xl border p-4 text-left ${selectedTreeId === tree.id ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100" : "border-slate-200 bg-slate-50 hover:border-emerald-200"}`}
                  >
                    <p className="font-black text-slate-950">{tree.tree_code}</p>
                    <p className="mt-1 text-sm text-slate-600">{tree.denr_tag_number || "No DENR tag yet"}</p>
                    <p className="mt-2 text-xs font-bold uppercase tracking-wide text-emerald-700">{tree.status || "REGISTERED"}</p>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Care Services</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">Request, pay, track assignment, and view caretaker submissions for the selected tree.</p>
              </div>
              <Link href="/investor/my-trees" className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-black text-emerald-900 hover:bg-emerald-100">
                View in My AG Trees
              </Link>
            </div>
            {selectedTree ? (
              <div className="mt-5 grid gap-5">
                {latestPhoto?.photo_url && (
                  <div className="overflow-hidden rounded-[1.5rem] border border-emerald-100 bg-slate-950">
                    <img src={latestPhoto.photo_url} alt="Latest caretaker submission" className="h-72 w-full object-cover" />
                    <div className="border-t border-white/10 bg-slate-950 px-5 py-4 text-white">
                      <p className="text-sm font-black">Latest Caretaker Photo</p>
                      <p className="mt-1 text-xs font-bold text-white/60">{latestPhoto.remarks || latestPhoto.notes || "No remarks"} - {formatDate(latestPhoto.created_at)}</p>
                    </div>
                  </div>
                )}

                <section className="grid gap-3 rounded-[1.5rem] border border-emerald-100 bg-emerald-50/70 p-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-white bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Fixed Monthly</p>
                    <p className="mt-2 text-xl font-black text-slate-950">PHP 200.00</p>
                    <p className="mt-2 text-xs font-bold leading-5 text-slate-500">Article VI monthly contribution. Current order pays one billing period.</p>
                  </div>
                  <div className="rounded-2xl border border-white bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-amber-700">Fixed One-Time</p>
                    <p className="mt-2 text-xl font-black text-slate-950">PHP 5,000.00</p>
                    <p className="mt-2 text-xs font-bold leading-5 text-slate-500">All-in optional maintenance package for the selected AG tree.</p>
                  </div>
                  <div className="rounded-2xl border border-white bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Admin Quoted</p>
                    <p className="mt-2 text-xl font-black text-slate-950">Set by Admin</p>
                    <p className="mt-2 text-xs font-bold leading-5 text-slate-500">Photo documentation, tree guard, and soil premium now have fixed starting prices for smoother ordering.</p>
                  </div>
                </section>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {maintenanceServices.map((service) => (
                    <button
                      key={service.key}
                      onClick={() => setSelectedService(service.key)}
                      className={`rounded-[1.25rem] border p-4 text-left transition hover:-translate-y-0.5 ${selectedService === service.key ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100" : "border-slate-200 bg-white hover:border-emerald-200"}`}
                    >
                      <div className={`h-2 rounded-full bg-gradient-to-r ${service.tone}`} />
                      <p className="mt-4 min-h-10 text-sm font-black leading-5 text-slate-950">{service.title}</p>
                      <p className="mt-2 min-h-20 text-xs leading-5 text-slate-600">{service.detail}</p>
                      <p className="mt-4 text-xs font-black text-emerald-700">{service.amount > 0 ? peso(service.amount) : service.billing}</p>
                    </button>
                  ))}
                </div>

                <div className="grid gap-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
                  <Info label="Selected Tree" value={selectedTree.tree_code} />
                  <Info label="DENR Tag" value={selectedTree.denr_tag_number || "Pending"} />
                  <Info label="Selected Service" value={selectedServiceItem.title} />
                  <Info label="Payment" value={selectedServiceItem.amount > 0 ? `${peso(selectedServiceItem.amount)} - ${canPayNow ? "Wallet ready" : "Needs wallet balance"}` : "Admin quote required"} />
                </div>

                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Optional note for admin, farmer, or caretaker"
                  rows={5}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
                />

                <div className="rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm font-bold leading-6 text-amber-900">
                  Paid orders can be assigned by admin after payment. If wallet balance is not enough, cash-in first from Wallet, then recreate/pay the order or ask admin to verify manual payment.
                </div>

                <button onClick={submitRequest} disabled={submitting} className="rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60">
                  {submitting ? "Processing..." : selectedServiceItem.amount > 0 && canPayNow ? "Pay from Wallet and Submit" : "Create Maintenance Order"}
                </button>

                <div className="grid gap-5 xl:grid-cols-2">
                  <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-lg font-black text-slate-950">Order History</h3>
                    <p className="mt-1 text-xs font-bold text-slate-500">Payment and assignment status for this tree.</p>
                    <div className="mt-3 grid gap-3">
                      {treeOrders.length === 0 ? (
                        <Empty text="No maintenance orders yet for this tree." />
                      ) : treeOrders.map((order) => (
                        <div key={order.id} className="rounded-2xl border border-white bg-white p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-black text-slate-950">{serviceTitle(order.service_type)}</p>
                              <p className="mt-1 text-xs font-bold text-slate-500">{formatDate(order.created_at)} - {order.payment_reference || "No reference"}</p>
                            </div>
                            <Badge value={order.payment_status || "PENDING"} />
                          </div>
                          <p className="mt-3 text-sm font-bold text-slate-600">{peso(getOrderAmount(order))} - {order.work_status || "PENDING"}</p>
                          {String(order.payment_status || "").toUpperCase() === "FOR_QUOTE" && (
                            <p className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">
                              Waiting for admin price quote.
                            </p>
                          )}
                          {String(order.payment_status || "").toUpperCase() === "PENDING_PAYMENT" && getOrderAmount(order) > 0 && (
                            <button
                              onClick={() => payExistingOrder(order)}
                              disabled={submitting || Number(wallet?.balance || 0) < getOrderAmount(order)}
                              className="mt-4 w-full rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                              {Number(wallet?.balance || 0) >= getOrderAmount(order) ? `Pay ${peso(getOrderAmount(order))} from Wallet` : "Cash-in Required"}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/70 p-4">
                    <h3 className="text-lg font-black text-slate-950">Caretaker Submissions</h3>
                    <p className="mt-1 text-xs font-bold text-slate-500">Photos, growth logs, and field remarks submitted by farmer/caretaker.</p>
                    <div className="mt-3 grid gap-3">
                      {selectedLogs.length === 0 ? (
                        <Empty text="No caretaker submissions yet for this tree." />
                      ) : selectedLogs.map((log) => (
                        <div key={log.id} className="overflow-hidden rounded-2xl border border-white bg-white">
                          {log.photo_url && (
                            <img src={log.photo_url} alt="Caretaker submitted update" className="h-44 w-full object-cover" />
                          )}
                          <div className="p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="font-black text-slate-950">{log.health_status || "FIELD UPDATE"}</p>
                                <p className="mt-1 text-xs font-bold text-slate-500">{formatDate(log.created_at)}</p>
                              </div>
                              <Badge value={log.status || "LOGGED"} />
                            </div>
                            <p className="mt-3 text-sm leading-6 text-slate-600">{log.remarks || log.notes || "No remarks."}</p>
                            <div className="mt-3 grid gap-2 text-xs font-bold text-slate-500 sm:grid-cols-2">
                              <span>Height: {log.height_cm || "-"} cm</span>
                              <span>Diameter: {log.diameter_cm || "-"} cm</span>
                            </div>
                            {log.photo_url && (
                              <a href={log.photo_url} target="_blank" className="mt-3 inline-flex text-xs font-black text-emerald-700">
                                Open full photo
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            ) : (
              <Empty text="Select a tree to request a care service." />
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/16 p-4 backdrop-blur">
      <p className="text-xs font-black uppercase tracking-wide text-white/65">{label}</p>
      <p className="mt-2 truncate text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function Badge({ value }: { value: string }) {
  const status = String(value || "").toUpperCase();
  const style = status.includes("PAID") || status.includes("READY") || status.includes("APPROVED") || status.includes("TREE")
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : status.includes("REJECTED") || status.includes("FAILED")
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-amber-200 bg-amber-50 text-amber-800";

  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${style}`}>{value}</span>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">
      {text}
    </div>
  );
}

function serviceTitle(value?: string | null) {
  return maintenanceServices.find((service) => service.key === value)?.title || String(value || "Maintenance");
}

function getOrderAmount(order: MaintenanceOrder) {
  const status = String(order.payment_status || "").toUpperCase();
  const serviceAmount = standardServiceAmounts[String(order.service_type || "")];
  if (serviceAmount && status !== "PAID") return serviceAmount;
  return Number(order.amount || 0);
}

function normalizeMaintenanceOrders(rows: MaintenanceOrder[]) {
  return rows.map((order) => {
    const amount = getOrderAmount(order);
    return amount === Number(order.amount || 0) ? order : { ...order, amount };
  });
}
