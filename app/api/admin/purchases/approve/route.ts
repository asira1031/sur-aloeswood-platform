import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildRevenueAllocationRows } from "@/app/lib/finance/fee-distribution";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type AnyRow = Record<string, any>;

function normalizeRole(role?: string | null) {
  return String(role || "").toUpperCase().replace("CO_PLANTER", "COPLANTER");
}

function parseAgNumber(code?: string | null) {
  const match = String(code || "").match(/^AG-(\d{7})$/);
  return match ? Number(match[1]) : 0;
}

function formatAgCode(number: number) {
  return `AG-${String(number).padStart(7, "0")}`;
}

function getNextAgNumbers(existingTrees: AnyRow[], quantity: number) {
  const maxNumber = existingTrees.reduce((max, tree) => Math.max(max, parseAgNumber(tree.tree_code)), 0);
  return Array.from({ length: quantity }, (_, index) => maxNumber + index + 1);
}

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json({ error: "Admin approval service is not configured." }, { status: 500 });
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
    return NextResponse.json({ error: "Admin login is required." }, { status: 401 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const cleanEmail = user.email.toLowerCase().trim();

  const { data: profileByAuthUserId, error: authProfileError } = await admin
    .from("profiles")
    .select("id,email,role,account_status,auth_user_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (authProfileError) {
    return NextResponse.json({ error: authProfileError.message }, { status: 500 });
  }

  const { data: profileByEmail, error: emailProfileError } = profileByAuthUserId
    ? { data: null, error: null }
    : await admin
        .from("profiles")
        .select("id,email,role,account_status,auth_user_id")
        .eq("email", cleanEmail)
        .maybeSingle();

  if (emailProfileError) {
    return NextResponse.json({ error: emailProfileError.message }, { status: 500 });
  }

  const adminProfile = profileByAuthUserId || profileByEmail;

  if (
    !adminProfile ||
    !["ADMIN", "SUPER_ADMIN"].includes(normalizeRole(adminProfile.role)) ||
    String(adminProfile.account_status || "").toUpperCase() !== "ACTIVE"
  ) {
    return NextResponse.json({ error: "Only active admin accounts can approve purchases." }, { status: 403 });
  }

  const body = await request.json();
  const purchaseId = String(body.purchaseId || "").trim();

  if (!purchaseId) {
    return NextResponse.json({ error: "Purchase ID is required." }, { status: 400 });
  }

  const { data: purchase, error: purchaseError } = await admin
    .from("seedling_purchases")
    .select("*")
    .eq("id", purchaseId)
    .maybeSingle();

  if (purchaseError) {
    return NextResponse.json({ error: purchaseError.message }, { status: 500 });
  }

  if (!purchase) {
    return NextResponse.json({ error: "Purchase not found." }, { status: 404 });
  }

  const quantity = Number(purchase.quantity || 0);
  if (!purchase.profile_id || quantity <= 0) {
    return NextResponse.json({ error: "Purchase has missing profile or quantity." }, { status: 400 });
  }

  const { data: treeRegistry, error: treeLoadError } = await admin
    .from("tree_registry")
    .select("id, profile_id, purchase_id, tree_code")
    .order("created_at", { ascending: false });

  if (treeLoadError) {
    return NextResponse.json({ error: treeLoadError.message }, { status: 500 });
  }

  const existingTrees = (treeRegistry || []) as AnyRow[];
  const existingForPurchase = existingTrees.filter((tree) => tree.purchase_id === purchase.id);
  const missingCount = Math.max(0, quantity - existingForPurchase.length);

  if (missingCount > 0) {
    const nextNumbers = getNextAgNumbers(existingTrees, missingCount);
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

    const { error: insertError } = await admin.from("tree_registry").insert(treeRows);
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  const approvedAt = new Date().toISOString();

  const { error: updateError } = await admin
    .from("seedling_purchases")
    .update({ status: "APPROVED", approved_at: approvedAt })
    .eq("id", purchase.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const paymentReference = purchase.payment_reference || purchase.id;

  const { data: existingAllocation, error: existingAllocationError } = await admin
    .from("revenue_allocations")
    .select("id")
    .eq("payment_reference", paymentReference)
    .limit(1);

  if (existingAllocationError) {
    return NextResponse.json(
      { error: `Purchase approved, but finance allocation check failed: ${existingAllocationError.message}` },
      { status: 500 }
    );
  }

  const financeAlreadyLedgered = Boolean(existingAllocation?.length);

  if (!financeAlreadyLedgered) {
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", purchase.profile_id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const revenueAllocationRows = buildRevenueAllocationRows({
      sourceType: "SEEDLING_PURCHASE_APPROVAL",
      sourceId: purchase.id,
      paymentReference,
      profileId: purchase.profile_id,
      customerName: profile?.full_name,
      customerEmail: profile?.email,
      grossAmount: Number(purchase.amount || 0),
      earnedDate: approvedAt,
    });

    const { error: allocationError } = await admin
      .from("revenue_allocations")
      .upsert(revenueAllocationRows, {
        onConflict: "source_type,source_id,beneficiary_key",
        ignoreDuplicates: true,
      });

    if (allocationError) {
      return NextResponse.json(
        { error: `Purchase approved, but finance allocation failed: ${allocationError.message}` },
        { status: 500 }
      );
    }
  }

  await admin.from("notifications").insert({
    profile_id: purchase.profile_id,
    title: "Seedling purchase approved",
    message: `Your seedling purchase was approved. ${quantity} AG tree code(s) were generated.`,
    is_read: false,
  });

  return NextResponse.json({
    ok: true,
    generated_count: missingCount,
    finance_already_ledgered: financeAlreadyLedgered,
    message: financeAlreadyLedgered
      ? `Approved. Generated ${missingCount} new AG tree code(s). Finance ledger already existed for this payment reference.`
      : `Approved. Generated ${missingCount} new AG tree code(s) and recorded automatic allocation ledger.`,
  });
}