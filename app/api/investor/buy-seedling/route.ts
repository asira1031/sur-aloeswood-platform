import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { COPLANTER_PACKAGE_PRICE } from "@/app/lib/business/rules";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type WalletSeedlingPurchaseResult = {
  purchase_id: string;
  tree_codes: string[];
  next_wallet_balance: number;
  message: string;
};

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json(
      { error: "Wallet purchase needs Supabase public keys configured." },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization") || "";

  if (!authHeader) {
    return NextResponse.json(
      { error: "Login is required before buying a seedling." },
      { status: 401 }
    );
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.id || !user.email) {
    return NextResponse.json(
      { error: "Login is required before buying a seedling." },
      { status: 401 }
    );
  }

  const reference = `WALLET-${Date.now()}`;

  const { data, error } = await supabase.rpc("purchase_seedling_with_wallet", {
    p_profile_id: null,
    p_quantity: 1,
    p_unit_price: COPLANTER_PACKAGE_PRICE,
    p_reference: reference,
  });

  if (error) {
    return NextResponse.json(
      {
        error: error.message || "Wallet purchase failed.",
      },
      { status: 400 }
    );
  }

  const result = Array.isArray(data)
    ? (data[0] as WalletSeedlingPurchaseResult | undefined)
    : (data as WalletSeedlingPurchaseResult | undefined);

  if (!result?.purchase_id) {
    return NextResponse.json(
      { error: "Wallet purchase did not return a completed purchase record." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    purchase: {
      id: result.purchase_id,
      payment_reference: reference,
      status: "APPROVED",
      quantity: 1,
      amount: COPLANTER_PACKAGE_PRICE,
    },
    tree_codes: result.tree_codes || [],
    wallet_balance: Number(result.next_wallet_balance || 0),
    message:
      result.message ||
      "Seedling paid from wallet. AG code generated automatically. Planting task is pending caretaker completion.",
  });
}