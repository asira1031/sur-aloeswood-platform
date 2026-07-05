import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { COPLANTER_PACKAGE_PRICE } from "@/app/lib/business/rules";
import { buildRevenueAllocationRows, calculateDistribution } from "@/app/lib/finance/fee-distribution";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function normalizeRole(role?: string | null) {
  return String(role || "").toUpperCase().replace("CO_PLANTER", "COPLANTER");
}

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Wallet purchase needs Supabase server keys configured." },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization") || "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user?.id || !user.email) {
    return NextResponse.json({ error: "Login is required before buying a seedling." }, { status: 401 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,email,full_name,role,account_status,kyc_status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const cleanEmail = user.email.toLowerCase().trim();
  const fallbackProfile = profile
    ? null
    : await admin
        .from("profiles")
        .select("id,email,full_name,role,account_status,kyc_status")
        .eq("email", cleanEmail)
        .maybeSingle();

  if (profileError || fallbackProfile?.error) {
    return NextResponse.json({ error: profileError?.message || fallbackProfile?.error?.message }, { status: 500 });
  }

  const buyer = profile || fallbackProfile?.data;

  if (!buyer) {
    return NextResponse.json({ error: "Co-planter profile not found." }, { status: 404 });
  }

  if (normalizeRole(buyer.role) !== "COPLANTER") {
    return NextResponse.json({ error: "Only co-planter accounts can buy seedlings." }, { status: 403 });
  }

  if (String(buyer.account_status || "").toUpperCase() !== "ACTIVE") {
    return NextResponse.json({ error: "Account must be active before buying a seedling." }, { status: 403 });
  }

  const { data: wallet, error: walletError } = await admin
    .from("wallets")
    .select("id,profile_id,balance")
    .eq("profile_id", buyer.id)
    .maybeSingle();

  if (walletError) {
    return NextResponse.json({ error: walletError.message }, { status: 500 });
  }

  if (!wallet) {
    return NextResponse.json({ error: "Wallet not found. Please cash in first." }, { status: 404 });
  }

  const currentBalance = Number(wallet.balance || 0);
  const price = COPLANTER_PACKAGE_PRICE;

  if (currentBalance < price) {
    return NextResponse.json({ error: "Insufficient wallet balance." }, { status: 400 });
  }

  const reference = `WALLET-${Date.now()}`;
  const nextBalance = currentBalance - price;

  const { error: walletUpdateError } = await admin
    .from("wallets")
    .update({ balance: nextBalance, updated_at: new Date().toISOString() })
    .eq("id", wallet.id)
    .eq("balance", currentBalance)
    .select("id")
    .single();

  if (walletUpdateError) {
    return NextResponse.json({ error: walletUpdateError.message }, { status: 500 });
  }

  await admin.from("profiles").update({ wallet_balance: nextBalance }).eq("id", buyer.id);

  const { data: purchase, error: purchaseError } = await admin
    .from("seedling_purchases")
    .insert({
      profile_id: buyer.id,
      quantity: 1,
      amount: price,
      payment_reference: reference,
      status: "PENDING",
    })
    .select("id, profile_id, quantity, amount, payment_reference, status, created_at")
    .single();

  if (purchaseError) {
    await admin.from("wallets").update({ balance: currentBalance, updated_at: new Date().toISOString() }).eq("id", wallet.id);
    await admin.from("profiles").update({ wallet_balance: currentBalance }).eq("id", buyer.id);
    return NextResponse.json({ error: purchaseError.message }, { status: 500 });
  }

  const distribution = calculateDistribution("COPLANTER_PACKAGE", price);
  const transactionRows = [
    {
      profile_id: buyer.id,
      transaction_type: "SEEDLING_PURCHASE",
      amount: price,
      description: `Aquilaria Malaccensis seedling paid from wallet. Reference: ${reference}. Waiting for admin AG tree approval.`,
      status: "PAID",
    },
    ...distribution.shares.map((share) => ({
      profile_id: buyer.id,
      transaction_type: "PACKAGE_DISTRIBUTION_LEDGER",
      amount: share.amount,
      description: `${distribution.rule.label} wallet payment share ${share.percent}% for ${share.recipient}. Settle to ${share.accountProvider} - ${share.accountName} - ${share.accountNumber}. Reference: ${reference}.`,
      status: "LEDGERED",
    })),
  ];

  const { error: txError } = await admin.from("wallet_transactions").insert(transactionRows);

  if (txError) {
    await admin.from("wallets").update({ balance: currentBalance, updated_at: new Date().toISOString() }).eq("id", wallet.id);
    await admin.from("profiles").update({ wallet_balance: currentBalance }).eq("id", buyer.id);
    await admin.from("seedling_purchases").delete().eq("id", purchase.id);
    return NextResponse.json({ error: txError.message }, { status: 500 });
  }

  const revenueAllocationRows = buildRevenueAllocationRows({
    sourceType: "WALLET_SEEDLING_PURCHASE",
    sourceId: purchase.id,
    paymentReference: reference,
    profileId: buyer.id,
    customerName: buyer.full_name,
    customerEmail: buyer.email,
    grossAmount: price,
    earnedDate: purchase.created_at,
  });

  const { error: allocationError } = await admin
    .from("revenue_allocations")
    .upsert(revenueAllocationRows, {
      onConflict: "source_type,source_id,beneficiary_key",
      ignoreDuplicates: true,
    });

  if (allocationError) {
    await admin.from("wallets").update({ balance: currentBalance, updated_at: new Date().toISOString() }).eq("id", wallet.id);
    await admin.from("profiles").update({ wallet_balance: currentBalance }).eq("id", buyer.id);
    await admin.from("seedling_purchases").delete().eq("id", purchase.id);
    await admin.from("wallet_transactions").delete().eq("profile_id", buyer.id).ilike("description", `%${reference}%`);
    return NextResponse.json({ error: `Finance allocation failed: ${allocationError.message}` }, { status: 500 });
  }

  await admin.from("notifications").insert({
    profile_id: buyer.id,
    title: "Seedling purchase paid",
    message: "Your Aquilaria Malaccensis seedling was paid from wallet and is waiting for admin AG tree approval.",
    is_read: false,
  });

  return NextResponse.json({
    ok: true,
    purchase,
    wallet_balance: nextBalance,
    message: "Seedling paid from wallet. Waiting for admin AG tree approval.",
  });
}
