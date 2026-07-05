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

const services = [
  {
    key: "TREE_GUARD",
    title: "Tree Guard",
    detail: "Request physical protection support for a selected AG tree.",
    tone: "from-emerald-700 to-green-500",
  },
  {
    key: "SOIL_PREMIUM",
    title: "Soil Premium",
    detail: "Request soil care review and field recommendation from the team.",
    tone: "from-amber-500 to-yellow-300",
  },
  {
    key: "PHOTO_DOCUMENTATION",
    title: "Photo Documentation",
    detail: "Request updated plantation photos for monitoring and records.",
    tone: "from-teal-700 to-cyan-500",
  },
  {
    key: "CUSTOM_VIDEO",
    title: "Customized Video",
    detail: "Request a short field video update for your AG tree.",
    tone: "from-slate-800 to-slate-600",
  },
  {
    key: "MAINTENANCE_REVIEW",
    title: "Maintenance Review",
    detail: "Ask the farmer/caretaker team to inspect care requirements.",
    tone: "from-lime-700 to-emerald-500",
  },
  {
    key: "PLANTATION_VISIT",
    title: "Plantation Visit",
    detail: "Request admin coordination for a scheduled site visit.",
    tone: "from-stone-700 to-amber-600",
  },
];

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

export default function CareServicesPage() {
  const searchParams = useSearchParams();
  const requestedTreeId = searchParams.get("tree") || "";

  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [trees, setTrees] = useState<Tree[]>([]);
  const [selectedTreeId, setSelectedTreeId] = useState(requestedTreeId);
  const [selectedService, setSelectedService] = useState(services[0].key);
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

    const { data: treeRows, error: treeError } = await supabase
      .from("tree_registry")
      .select("id, profile_id, tree_code, denr_tag_number, species, status, gps_lat, gps_lng, planted_at")
      .eq("profile_id", profileRow.id)
      .order("created_at", { ascending: false });

    setLoading(false);

    if (treeError) {
      setMessage(treeError.message);
      return;
    }

    const safeTrees = (treeRows || []) as Tree[];
    setProfile(profileRow as Profile);
    setTrees(safeTrees);
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

    const service = services.find((item) => item.key === selectedService) || services[0];
    setSubmitting(true);

    const { error } = await supabase.from("support_tickets").insert({
      profile_id: profile.id,
      subject: `Care Service Request - ${service.title}`,
      message: [
        `Service: ${service.title}`,
        `Tree Code: ${selectedTree.tree_code}`,
        `DENR Tag: ${selectedTree.denr_tag_number || "N/A"}`,
        `Tree ID: ${selectedTree.id}`,
        `Client Note: ${note.trim() || "No additional note."}`,
        "Pricing: For admin quotation and approval.",
      ].join("\n"),
      status: "OPEN",
    });

    setSubmitting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setNote("");
    setMessage("Care service request sent to admin support queue.");
  }

  const selectedTree = useMemo(
    () => trees.find((tree) => tree.id === selectedTreeId) || null,
    [trees, selectedTreeId]
  );

  return (
    <main className="min-h-screen bg-[#f3f7f1] text-slate-950">
      <div className="mx-auto w-full max-w-[1480px] px-4 py-4 lg:px-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/20 p-6 shadow-sm lg:p-8">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/forest-bg.jpg')" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-green-950/92 via-green-900/68 to-green-950/22" />
          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-emerald-200">SUR Care Services</p>
              <h1 className="mt-4 text-4xl font-black text-white lg:text-6xl">Farmer and Caretaker Requests</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78">
                Request optional services for a specific AG tree. Admin will review, quote, and coordinate the work before anything is charged.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => loadData()} disabled={loading} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm disabled:opacity-60">
                {loading ? "Loading..." : "Refresh"}
              </button>
              <Link href="/investor/my-trees" className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur">
                My AG Trees
              </Link>
            </div>
          </div>
        </section>

        {message && (
          <div className="mt-5 rounded-2xl border border-emerald-100 bg-white px-5 py-4 text-sm font-bold text-emerald-900">
            {message}
          </div>
        )}

        <section className="mt-5 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Select AG Tree</h2>
                <p className="mt-1 text-sm text-slate-600">Requests are attached to one tree for clean records.</p>
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
            <h2 className="text-2xl font-black text-slate-950">Request Service</h2>
            {selectedTree ? (
              <div className="mt-5 grid gap-5">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {services.map((service) => (
                    <button
                      key={service.key}
                      onClick={() => setSelectedService(service.key)}
                      className={`rounded-[1.5rem] border p-4 text-left ${selectedService === service.key ? "border-emerald-400 ring-2 ring-emerald-100" : "border-slate-200 hover:border-emerald-200"}`}
                    >
                      <div className={`h-2 rounded-full bg-gradient-to-r ${service.tone}`} />
                      <p className="mt-4 font-black text-slate-950">{service.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{service.detail}</p>
                    </button>
                  ))}
                </div>
                <div className="grid gap-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
                  <Info label="Selected Tree" value={selectedTree.tree_code} />
                  <Info label="DENR Tag" value={selectedTree.denr_tag_number || "Pending"} />
                  <Info label="Species" value={selectedTree.species || "Aquilaria Malaccensis"} />
                  <Info label="Planted" value={formatDate(selectedTree.planted_at)} />
                </div>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Optional note for admin, farmer, or caretaker"
                  rows={5}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
                />
                <button onClick={submitRequest} disabled={submitting} className="rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60">
                  {submitting ? "Sending..." : "Send Care Service Request"}
                </button>
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

function Badge({ value }: { value: string }) {
  return <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">{value}</span>;
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
