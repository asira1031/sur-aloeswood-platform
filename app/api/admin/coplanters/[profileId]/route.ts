import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enforceRateLimit } from "@/app/lib/security/server";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function PATCH(request: NextRequest, context: { params: Promise<{ profileId: string }> }) {
  const rate = enforceRateLimit(request, "admin-coplanter-review", 80, 3_600_000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many account review requests." }, { status: 429 });
  if (url !== "https://dvidrbhfzzhgwyempgtu.supabase.co" || !anon || !service)
    return NextResponse.json({ error: "Admin account review service is not configured." }, { status: 500 });

  const auth = request.headers.get("authorization") || "";
  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Admin login is required." }, { status: 401 });

  const db = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: actor, error: actorError } = await db.from("profiles").select("id,role,account_status").eq("auth_user_id", user.id).maybeSingle();
  if (actorError) return NextResponse.json({ error: actorError.message }, { status: 500 });
  if (!actor || String(actor.role).toUpperCase() !== "ADMIN" || String(actor.account_status).toUpperCase() !== "ACTIVE")
    return NextResponse.json({ error: "Only active admins can review customer accounts." }, { status: 403 });

  const { profileId } = await context.params;
  const body = await request.json().catch(() => null);
  const action = String(body?.action || "").toUpperCase();
  const { data: profile, error } = await db.from("profiles").select("*").eq("id", profileId).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: "Customer profile not found." }, { status: 404 });
  if (!["COPLANTER", "CO_PLANTER", "INVESTOR"].includes(String(profile.role).toUpperCase()))
    return NextResponse.json({ error: "This action is only for customer profiles." }, { status: 409 });

  const now = new Date().toISOString();
  let updates: Record<string, string | null>;
  let title: string;
  let message: string;
  if (action === "APPROVE_KYC") {
    updates = { kyc_status: "APPROVED", account_status: String(profile.account_status).toUpperCase() === "PENDING" ? "ACTIVE" : profile.account_status, kyc_verified_at: now, kyc_updated_at: now };
    title = "KYC approved"; message = "Your KYC verification has been approved. Your submitted documents are now verified.";
  } else if (action === "REJECT_KYC") {
    updates = { kyc_status: "REJECTED", kyc_updated_at: now };
    title = "KYC rejected"; message = "Your KYC verification was rejected. Please update your details or upload clearer documents for review.";
  } else if (action === "SET_ACCOUNT_STATUS") {
    const status = String(body?.accountStatus || "").toUpperCase();
    if (!["ACTIVE", "SUSPENDED", "ARCHIVED"].includes(status)) return NextResponse.json({ error: "Invalid account status." }, { status: 400 });
    updates = { account_status: status }; title = `Account ${status.toLowerCase()}`; message = `Your co-planter account is now ${status}.`;
  } else return NextResponse.json({ error: "Invalid account review action." }, { status: 400 });

  const { error: updateError } = await db.from("profiles").update(updates).eq("id", profile.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  if (action !== "REJECT_KYC") {
    const { data: wallet } = await db.from("wallets").select("id").eq("profile_id", profile.id).maybeSingle();
    if (!wallet) {
      const { error: walletError } = await db.from("wallets").insert({ profile_id: profile.id, balance: Number(profile.wallet_balance || 0) });
      if (walletError) return NextResponse.json({ error: `Account updated; wallet check failed: ${walletError.message}` }, { status: 500 });
    }
  }
  const { error: notifyError } = await db.from("notifications").insert({ profile_id: profile.id, title, message, is_read: false });
  if (notifyError) return NextResponse.json({ error: `Account updated; notification failed: ${notifyError.message}` }, { status: 500 });
  return NextResponse.json({ ok: true, message: title });
}
