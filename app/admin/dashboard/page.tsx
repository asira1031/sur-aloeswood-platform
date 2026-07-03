"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";

type Profile = {
  id: string;
  full_name: string | null;
  email: string;
  role: string | null;
  kyc_status: string | null;
  account_status: string | null;
  referral_code: string | null;
};

type Purchase = {
  id: string;
  profile_id: string;
  quantity: number;
  amount: number;
  status: string;
  payment_reference: string | null;
  created_at: string;
};

const money = (amount?: number | null) =>
  `₱${Number(amount || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

async function getNextTreeCode() {
  const { data } = await supabase
    .from("tree_registry")
    .select("tree_code")
    .order("created_at", { ascending: false })
    .limit(1);

  const latest = data?.[0]?.tree_code || "AG-0000000";
  const num = Number(latest.replace("AG-", "")) || 0;
  return `AG-${String(num + 1).padStart(7, "0")}`;
}

export default function AdminDashboardPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [message, setMessage] = useState("");

  const loadAdmin = async () => {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    setProfiles(profileData || []);

    const { data: purchaseData } = await supabase
      .from("seedling_purchases")
      .select("*")
      .order("created_at", { ascending: false });

    setPurchases(purchaseData || []);
  };

  useEffect(() => {
    loadAdmin();
  }, []);

  const approveProfile = async (profileId: string) => {
    setMessage("");

    const { error } = await supabase
      .from("profiles")
      .update({
        kyc_status: "APPROVED",
        account_status: "ACTIVE",
      })
      .eq("id", profileId);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Co-planter approved.");
    loadAdmin();
  };

  const createDemoPurchase = async (profileId: string) => {
    setMessage("");

    const { error } = await supabase.from("seedling_purchases").insert({
      profile_id: profileId,
      quantity: 1,
      amount: 14000,
      status: "PENDING",
      payment_reference: `SAC-${new Date().getFullYear()}-${Date.now()}`,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Demo purchase created.");
    loadAdmin();
  };

  const approvePurchaseAndGenerateTrees = async (purchase: Purchase) => {
    setMessage("");

    if (purchase.status === "APPROVED") {
      setMessage("Purchase already approved.");
      return;
    }

    const createdCodes: string[] = [];

    for (let i = 0; i < purchase.quantity; i++) {
      const nextCode = await getNextTreeCode();

      const { error: treeError } = await supabase.from("tree_registry").insert({
        profile_id: purchase.profile_id,
        purchase_id: purchase.id,
        tree_code: nextCode,
        species: "Aquilaria Malaccensis",
        status: "REGISTERED",
      });

      if (treeError) {
        setMessage(treeError.message);
        return;
      }

      createdCodes.push(nextCode);
    }

    const { error: purchaseError } = await supabase
      .from("seedling_purchases")
      .update({
        status: "APPROVED",
        approved_at: new Date().toISOString(),
      })
      .eq("id", purchase.id);

    if (purchaseError) {
      setMessage(purchaseError.message);
      return;
    }

    await supabase.from("wallet_transactions").insert({
      profile_id: purchase.profile_id,
      transaction_type: "SEEDLING_PURCHASE",
      amount: purchase.amount,
      status: "COMPLETED",
      reference_no: purchase.payment_reference,
      description: `Approved seedling purchase. Generated trees: ${createdCodes.join(
        ", "
      )}`,
    });

    setMessage(`Purchase approved. Generated: ${createdCodes.join(", ")}`);
    loadAdmin();
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="border-b border-white/10 bg-gradient-to-r from-slate-950 via-green-950 to-slate-950 px-8 py-8 lg:px-14">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-green-300">
          SUR Aloeswood Admin ERP
        </p>
        <h1 className="mt-3 text-4xl font-black lg:text-6xl">
          Admin Dashboard
        </h1>
        <p className="mt-3 max-w-4xl text-slate-300">
          Approve co-planters, confirm seedling purchases, auto-generate tree
          codes, and monitor legal compliance, wallet activity, recovery fund,
          and plantation operations.
        </p>

        {message && (
          <div className="mt-6 rounded-2xl bg-green-400/15 px-5 py-4 text-sm font-bold text-green-100">
            {message}
          </div>
        )}
      </section>

      <section className="px-8 py-8 lg:px-14">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <Card title="Co-Planters" value={profiles.length.toString()} />
          <Card
            title="Pending KYC"
            value={profiles
              .filter((p) => p.kyc_status !== "APPROVED")
              .length.toString()}
          />
          <Card title="Seedling Orders" value={purchases.length.toString()} />
          <Card
            title="Pending Orders"
            value={purchases
              .filter((p) => p.status !== "APPROVED")
              .length.toString()}
          />
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6">
            <h2 className="text-2xl font-black">Co-Planter Approvals</h2>
            <p className="mt-2 text-sm text-slate-400">
              Approve registered users and activate their accounts.
            </p>

            <div className="mt-6 grid gap-4">
              {profiles.length === 0 ? (
                <Empty text="No co-planters yet." />
              ) : (
                profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="rounded-3xl border border-white/10 bg-black/20 p-5"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-xl font-black">
                          {profile.full_name || "Unnamed Co-Planter"}
                        </p>
                        <p className="text-sm text-slate-400">
                          {profile.email}
                        </p>
                        <p className="mt-2 text-xs font-bold text-green-300">
                          Referral: {profile.referral_code || "Pending"}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge text={profile.kyc_status || "PENDING"} />
                        <Badge text={profile.account_status || "PENDING"} />
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        onClick={() => approveProfile(profile.id)}
                        className="rounded-2xl bg-green-500 px-5 py-3 text-sm font-black text-green-950 hover:bg-green-400"
                      >
                        Approve KYC
                      </button>

                      <button
                        onClick={() => createDemoPurchase(profile.id)}
                        className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-black text-white ring-1 ring-white/15 hover:bg-white/20"
                      >
                        Create ₱14,000 Seedling Order
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6">
            <h2 className="text-2xl font-black">Seedling Sales Approval</h2>
            <p className="mt-2 text-sm text-slate-400">
              Approving a paid purchase automatically creates AG tree codes.
            </p>

            <div className="mt-6 grid gap-4">
              {purchases.length === 0 ? (
                <Empty text="No seedling purchases yet." />
              ) : (
                purchases.map((purchase) => (
                  <div
                    key={purchase.id}
                    className="rounded-3xl border border-white/10 bg-black/20 p-5"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-xl font-black">
                          {purchase.quantity} Seedling
                          {purchase.quantity > 1 ? "s" : ""}
                        </p>
                        <p className="text-sm text-slate-400">
                          Ref: {purchase.payment_reference || "No reference"}
                        </p>
                        <p className="mt-2 font-black text-green-300">
                          {money(purchase.amount)}
                        </p>
                      </div>

                      <Badge text={purchase.status} />
                    </div>

                    <button
                      onClick={() => approvePurchaseAndGenerateTrees(purchase)}
                      className="mt-5 w-full rounded-2xl bg-yellow-400 px-5 py-3 text-sm font-black text-slate-950 hover:bg-yellow-300"
                    >
                      Approve Payment & Generate AG Tree Code
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
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

function Badge({ text }: { text: string }) {
  return (
    <span className="rounded-full bg-green-400/15 px-4 py-2 text-xs font-black text-green-200">
      {text}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/15 bg-black/20 p-8 text-center text-sm font-semibold text-white/60">
      {text}
    </div>
  );
}