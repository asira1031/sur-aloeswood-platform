import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { bearerToken, enforceRateLimit, normalizeRole } from "@/app/lib/security/server";

export const runtime = "nodejs";

type Finding = {
  key: string;
  type: "MISSING_ZERO_WALLET" | "STALE_ORDER" | "STALE_KYC" | "STALE_CARE_UPDATE" | "STALE_WITHDRAWAL";
  severity: "LOW" | "MEDIUM" | "HIGH";
  sensitive: boolean;
  title: string;
  detail: string;
  targetId: string;
  targetTable: string;
  profileId?: string;
  createdAt?: string;
  reviewHref: string;
  allowedActions: string[];
};

async function adminContext(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = bearerToken(req);
  if (url !== "https://dvidrbhfzzhgwyempgtu.supabase.co" || !anon || !service || !token) return null;
  const userDb = createClient(url, anon, { global: { headers: { Authorization: token } }, auth: { autoRefreshToken: false, persistSession: false } });
  const { data: auth } = await userDb.auth.getUser();
  if (!auth.user?.id) return null;
  const db = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: profile } = await db.from("profiles").select("id,role,account_status").eq("auth_user_id", auth.user.id).maybeSingle();
  if (!profile || !["ADMIN", "SUPER_ADMIN"].includes(normalizeRole(profile.role)) || String(profile.account_status || "").toUpperCase() !== "ACTIVE") return null;
  return { db, userId: auth.user.id };
}

const olderThan = (value: unknown, hours: number) => {
  const time = new Date(String(value || "")).getTime();
  return Number.isFinite(time) && Date.now() - time >= hours * 3_600_000;
};
const upper = (value: unknown) => String(value || "").toUpperCase();

async function detect(db: SupabaseClient): Promise<{ findings: Finding[]; warnings: string[]; setupReady: boolean }> {
  const [profiles, wallets, orders, updates, withdrawals, setup] = await Promise.all([
    db.from("profiles").select("id,full_name,email,role,account_status,kyc_status,wallet_balance,created_at").limit(3000),
    db.from("wallets").select("id,profile_id,balance").limit(3000),
    db.from("sur_tree_orders").select("id,profile_id,order_no,status,created_at").order("created_at", { ascending: false }).limit(2000),
    db.from("sur_tree_updates").select("id,tree_id,caretaker_profile_id,status,created_at").order("created_at", { ascending: false }).limit(3000),
    db.from("withdrawal_requests").select("id,profile_id,request_reference,status,amount,requested_at").order("requested_at", { ascending: false }).limit(2000),
    db.from("sur_recovery_events").select("id").limit(1),
  ]);
  const warnings = [profiles, wallets, orders, updates, withdrawals]
    .map((result) => result.error?.message).filter((value): value is string => Boolean(value));
  const findings: Finding[] = [];
  const walletOwners = new Set((wallets.data || []).map((row) => String(row.profile_id)));

  for (const profile of profiles.data || []) {
    const role = normalizeRole(profile.role);
    const activeCustomer = ["COPLANTER", "INVESTOR", "CUSTOMER"].includes(role) && upper(profile.account_status) === "ACTIVE";
    if (activeCustomer && !walletOwners.has(String(profile.id)) && Number(profile.wallet_balance || 0) === 0) {
      findings.push({ key: `MISSING_ZERO_WALLET:${profile.id}`, type: "MISSING_ZERO_WALLET", severity: "HIGH", sensitive: true,
        title: "Active customer has no wallet record", detail: `${profile.full_name || profile.email || "Customer"} needs a verified zero-balance wallet shell. No money will be credited.`,
        targetId: profile.id, targetTable: "profiles", profileId: profile.id, createdAt: profile.created_at, reviewHref: "/admin/treasury", allowedActions: ["VERIFY", "CREATE_ZERO_WALLET", "ESCALATE"] });
    }
    if (["PENDING", "UNDER_REVIEW", "SUBMITTED"].includes(upper(profile.kyc_status)) && olderThan(profile.created_at, 72)) {
      findings.push({ key: `STALE_KYC:${profile.id}`, type: "STALE_KYC", severity: "MEDIUM", sensitive: true,
        title: "KYC waiting over 72 hours", detail: `${profile.full_name || profile.email || "Customer"} needs a human KYC decision. TOH cannot approve it.`,
        targetId: profile.id, targetTable: "profiles", profileId: profile.id, createdAt: profile.created_at, reviewHref: `/admin/coplanters/${profile.id}`, allowedActions: ["VERIFY", "SEND_REMINDER", "ESCALATE"] });
    }
  }
  for (const row of orders.data || []) if (["PENDING", "PENDING_VERIFICATION", "MANUAL_REVIEW"].includes(upper(row.status)) && olderThan(row.created_at, 24)) {
    findings.push({ key: `STALE_ORDER:${row.id}`, type: "STALE_ORDER", severity: "HIGH", sensitive: true, title: "Payment order waiting over 24 hours",
      detail: `Order ${row.order_no || row.id} requires Admin payment review. No automatic approval is allowed.`, targetId: row.id, targetTable: "sur_tree_orders", profileId: row.profile_id,
      createdAt: row.created_at, reviewHref: "/admin/orders", allowedActions: ["VERIFY", "SEND_REMINDER", "ESCALATE"] });
  }
  for (const row of updates.data || []) if (["PENDING", "PENDING_REVIEW", "PENDING_ADMIN_REVIEW", "SUBMITTED"].includes(upper(row.status)) && olderThan(row.created_at, 48)) {
    findings.push({ key: `STALE_CARE_UPDATE:${row.id}`, type: "STALE_CARE_UPDATE", severity: "MEDIUM", sensitive: false, title: "Care update waiting over 48 hours",
      detail: "Caretaker evidence needs Admin review before the customer can see it.", targetId: row.id, targetTable: "sur_tree_updates", profileId: row.caretaker_profile_id,
      createdAt: row.created_at, reviewHref: "/admin/care-operations", allowedActions: ["VERIFY", "SEND_REMINDER", "ESCALATE"] });
  }
  for (const row of withdrawals.data || []) if (["PENDING", "PENDING_REVIEW", "PENDING_VERIFICATION"].includes(upper(row.status)) && olderThan(row.requested_at, 24)) {
    findings.push({ key: `STALE_WITHDRAWAL:${row.id}`, type: "STALE_WITHDRAWAL", severity: "HIGH", sensitive: true, title: "Withdrawal waiting over 24 hours",
      detail: `Withdrawal ${row.request_reference || row.id} needs manual settlement or rejection. TOH cannot move money.`, targetId: row.id, targetTable: "withdrawal_requests", profileId: row.profile_id,
      createdAt: row.requested_at, reviewHref: "/admin/withdrawals", allowedActions: ["VERIFY", "ESCALATE"] });
  }
  return { findings: findings.sort((a, b) => (a.severity === "HIGH" ? -1 : 1) - (b.severity === "HIGH" ? -1 : 1)), warnings, setupReady: !setup.error };
}

async function record(db: SupabaseClient, event: Record<string, unknown>) {
  const { error } = await db.from("sur_recovery_events").insert(event);
  if (error) throw new Error(error.code === "42P01" || error.code === "PGRST205" ? "Run database/104-toh-recovery-center.sql once before using recovery actions." : error.message);
}

export async function GET(req: NextRequest) {
  const context = await adminContext(req);
  if (!context) return NextResponse.json({ error: "Active SUR admin login is required." }, { status: 401 });
  const scan = await detect(context.db);
  const history = scan.setupReady ? await context.db.from("sur_recovery_events").select("id,case_key,case_type,action,outcome,detail,created_at").order("created_at", { ascending: false }).limit(50) : { data: [] };
  return NextResponse.json({ assistant: "TOH Recovery Guard", ...scan, history: history.data || [], checkedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const rate = enforceRateLimit(req, "admin-recovery-action", 40, 3_600_000);
  if (!rate.allowed) return NextResponse.json({ error: "Recovery action limit reached." }, { status: 429 });
  const context = await adminContext(req);
  if (!context) return NextResponse.json({ error: "Active SUR admin login is required." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const caseKey = String(body?.caseKey || "");
  const action = String(body?.action || "").toUpperCase();
  const scan = await detect(context.db);
  const finding = scan.findings.find((item) => item.key === caseKey);

  if (action === "VERIFY") return NextResponse.json({ ok: true, resolved: !finding, finding: finding || null, message: finding ? "Problem still exists." : "Verified: problem is no longer present." });
  if (!finding || !finding.allowedActions.includes(action)) return NextResponse.json({ error: "Recovery case changed or action is not allowed. Run Verify again." }, { status: 409 });
  if (!scan.setupReady) return NextResponse.json({ error: "Run database/104-toh-recovery-center.sql once before using recovery actions." }, { status: 503 });

  const idempotencyKey = String(body?.idempotencyKey || "");
  if (!idempotencyKey || idempotencyKey.length < 16) return NextResponse.json({ error: "A valid idempotency key is required." }, { status: 400 });

  try {
    if (action === "ESCALATE") {
      await record(context.db, { case_key: finding.key, case_type: finding.type, target_table: finding.targetTable, target_id: finding.targetId, action, outcome: "ESCALATED", actor_user_id: context.userId, detail: "Admin escalated this case for technical review.", before_state: finding, idempotency_key: idempotencyKey });
      return NextResponse.json({ ok: true, outcome: "ESCALATED", message: "Case recorded for technical review." });
    }
    if (action === "SEND_REMINDER") {
      if (!finding.profileId) return NextResponse.json({ error: "No verified recipient is attached to this case." }, { status: 409 });
      const { error } = await context.db.from("notifications").insert({ profile_id: finding.profileId, title: "Agarwood Support update", message: "Your request is still under review. No action is required unless Agarwood Support contacts you.", is_read: false });
      if (error) throw new Error(error.message);
      await record(context.db, { case_key: finding.key, case_type: finding.type, target_table: finding.targetTable, target_id: finding.targetId, action, outcome: "VERIFIED_SUCCESS", actor_user_id: context.userId, detail: "One in-app pending-review reminder sent.", before_state: finding, after_state: { notification_sent: true }, idempotency_key: idempotencyKey });
      return NextResponse.json({ ok: true, outcome: "VERIFIED_SUCCESS", message: "Customer notification sent and recorded." });
    }
    if (action === "CREATE_ZERO_WALLET") {
      if (body?.confirmation !== "CREATE ZERO WALLET") return NextResponse.json({ error: "Type CREATE ZERO WALLET to confirm this financial-structure repair." }, { status: 400 });
      const { data: profile } = await context.db.from("profiles").select("id,role,account_status,wallet_balance").eq("id", finding.targetId).maybeSingle();
      const { data: existing } = await context.db.from("wallets").select("id,balance").eq("profile_id", finding.targetId).maybeSingle();
      if (!profile || existing || upper(profile.account_status) !== "ACTIVE" || !["COPLANTER", "INVESTOR", "CUSTOMER"].includes(normalizeRole(profile.role)) || Number(profile.wallet_balance || 0) !== 0)
        return NextResponse.json({ error: "Safety check failed. No wallet was created." }, { status: 409 });
      const { data: wallet, error } = await context.db.from("wallets").insert({ profile_id: profile.id, balance: 0 }).select("id,profile_id,balance").single();
      if (error) throw new Error(error.message);
      const verified = wallet.profile_id === profile.id && Number(wallet.balance) === 0;
      await record(context.db, { case_key: finding.key, case_type: finding.type, target_table: "wallets", target_id: wallet.id, action, outcome: verified ? "VERIFIED_SUCCESS" : "VERIFIED_FAILURE", actor_user_id: context.userId, detail: "Created a zero-balance wallet shell; no funds credited.", before_state: finding, after_state: wallet, idempotency_key: idempotencyKey });
      return NextResponse.json({ ok: verified, outcome: verified ? "VERIFIED_SUCCESS" : "VERIFIED_FAILURE", message: verified ? "Zero-balance wallet created and verified." : "Wallet creation could not be verified." });
    }
    return NextResponse.json({ error: "Unsupported recovery action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Recovery action failed.";
    return NextResponse.json({ error: message }, { status: message.includes("idempotency") || message.includes("duplicate") ? 409 : 500 });
  }
}
