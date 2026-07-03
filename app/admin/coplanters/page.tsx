"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";

type Coplanter = {
  id: string;
  full_name: string | null;
  email: string;
  mobile: string | null;
  address: string | null;
  referral_code: string | null;
  referred_by: string | null;
  kyc_status: string | null;
  account_status: string | null;
  role: string | null;
};

export default function AdminCoplantersPage() {
  const [loading, setLoading] = useState(true);
  const [coplanters, setCoplanters] = useState<Coplanter[]>([]);
  const [message, setMessage] = useState("");

  async function loadCoplanters() {
    setLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setCoplanters(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadCoplanters();
  }, []);

  async function approveKYC(id: string) {
    const { error } = await supabase
      .from("profiles")
      .update({
        kyc_status: "APPROVED",
        account_status: "ACTIVE",
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    loadCoplanters();
  }

  async function rejectKYC(id: string) {
    const { error } = await supabase
      .from("profiles")
      .update({
        kyc_status: "REJECTED",
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    loadCoplanters();
  }

  async function suspendAccount(id: string) {
    const { error } = await supabase
      .from("profiles")
      .update({
        account_status: "SUSPENDED",
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    loadCoplanters();
  }

  return (
    <main className="min-h-screen bg-[#06170f] text-white">

      <section className="border-b border-white/10 bg-gradient-to-r from-slate-950 via-green-950 to-slate-950 px-10 py-8">

        <p className="text-sm font-black uppercase tracking-[0.35em] text-green-300">
          SUR ALOESWOOD ADMIN
        </p>

        <h1 className="mt-4 text-5xl font-black">
          Co-Planter Management
        </h1>

        <p className="mt-3 max-w-4xl text-slate-300">
          Review registrations, approve KYC, activate accounts,
          monitor referrals and wallet eligibility.
        </p>

      </section>

      <section className="p-10">

        {message && (
          <div className="mb-6 rounded-2xl bg-red-500/20 p-4 font-bold text-red-200">
            {message}
          </div>
        )}

        <div className="grid grid-cols-4 gap-5 mb-8">

          <Card
            title="Total Co-Planters"
            value={String(coplanters.length)}
          />

          <Card
            title="Pending KYC"
            value={String(
              coplanters.filter(
                c => c.kyc_status !== "APPROVED"
              ).length
            )}
          />

          <Card
            title="Approved"
            value={String(
              coplanters.filter(
                c => c.account_status === "ACTIVE"
              ).length
            )}
          />

          <Card
            title="Suspended"
            value={String(
              coplanters.filter(
                c => c.account_status === "SUSPENDED"
              ).length
            )}
          />

        </div>
                <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06]">

          <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
            <div>
              <h2 className="text-2xl font-black">
                Registered Co-Planters
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Approve, reject, or suspend co-planter accounts.
              </p>
            </div>

            <button
              onClick={loadCoplanters}
              className="rounded-2xl bg-green-500 px-5 py-3 text-sm font-black text-green-950 hover:bg-green-400"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-10 text-center font-bold text-slate-400">
              Loading co-planters...
            </div>
          ) : coplanters.length === 0 ? (
            <div className="p-10 text-center font-bold text-slate-400">
              No co-planters registered yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="bg-black/30 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Mobile</th>
                    <th className="px-6 py-4">Referral</th>
                    <th className="px-6 py-4">KYC</th>
                    <th className="px-6 py-4">Account</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/10">
                  {coplanters.map((c) => (
                    <tr key={c.id} className="hover:bg-white/[0.04]">
                      <td className="px-6 py-5">
                        <div className="font-black">
                          {c.full_name || "Unnamed"}
                        </div>
                        <div className="mt-1 max-w-xs truncate text-xs text-slate-500">
                          {c.address || "No address"}
                        </div>
                      </td>

                      <td className="px-6 py-5 text-slate-300">
                        {c.email}
                      </td>

                      <td className="px-6 py-5 text-slate-300">
                        {c.mobile || "—"}
                      </td>

                      <td className="px-6 py-5">
                        <div className="font-bold text-green-300">
                          {c.referral_code || "Pending"}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Referred by: {c.referred_by || "None"}
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <StatusBadge status={c.kyc_status || "PENDING"} />
                      </td>

                      <td className="px-6 py-5">
                        <StatusBadge status={c.account_status || "PENDING"} />
                      </td>

                      <td className="px-6 py-5">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => approveKYC(c.id)}
                            className="rounded-xl bg-green-500 px-4 py-2 text-xs font-black text-green-950 hover:bg-green-400"
                          >
                            Approve
                          </button>

                          <button
                            onClick={() => rejectKYC(c.id)}
                            className="rounded-xl bg-yellow-400 px-4 py-2 text-xs font-black text-slate-950 hover:bg-yellow-300"
                          >
                            Reject
                          </button>

                          <button
                            onClick={() => suspendAccount(c.id)}
                            className="rounded-xl bg-red-500 px-4 py-2 text-xs font-black text-white hover:bg-red-400"
                          >
                            Suspend
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
              </section>
    </main>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6">
      <p className="text-sm font-bold text-slate-400">{title}</p>
      <p className="mt-3 text-4xl font-black">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();

  const className =
    normalized === "APPROVED" || normalized === "ACTIVE"
      ? "bg-green-400/15 text-green-200"
      : normalized === "REJECTED" || normalized === "SUSPENDED"
      ? "bg-red-400/15 text-red-200"
      : "bg-yellow-400/15 text-yellow-200";

  return (
    <span className={`rounded-full px-4 py-2 text-xs font-black ${className}`}>
      {status}
    </span>
  );
}