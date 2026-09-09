import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { analyzeGuardianSql, isSurProject, SUR_PROJECT_REF, WRITE_CONFIRMATION } from "@/app/lib/guardian/policy";
import { bearerToken, enforceRateLimit, normalizeRole } from "@/app/lib/security/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rate = enforceRateLimit(req, "guardian-query", 30, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Guardian request limit reached." }, { status: 429 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authHeader = bearerToken(req);
  if (!isSurProject(url)) return NextResponse.json({ error: "Guardian is locked: this is not the SUR project." }, { status: 503 });
  if (!key || !authHeader) return NextResponse.json({ error: "Active SUR admin login is required." }, { status: 401 });

  const db = createClient(url!, key, { global: { headers: { Authorization: authHeader } }, auth: { autoRefreshToken: false, persistSession: false } });
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError || !auth.user?.id) return NextResponse.json({ error: "Active SUR admin login is required." }, { status: 401 });
  const { data: profile } = await db.from("profiles").select("role,account_status").eq("auth_user_id", auth.user.id).maybeSingle();
  if (!profile || !["ADMIN", "SUPER_ADMIN"].includes(normalizeRole(profile.role)) || String(profile.account_status || "").toUpperCase() !== "ACTIVE") {
    return NextResponse.json({ error: "Only an active SUR admin can use Guardian." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const analysis = analyzeGuardianSql(String(body?.sql || ""));
  if (!analysis.allowed) return NextResponse.json({ error: "Guardian blocked this SQL.", analysis }, { status: 400 });
  if (body?.action === "preview") return NextResponse.json({ guardian: "SUR Guardian", projectRef: SUR_PROJECT_REF, analysis, executed: false });
  if (body?.action !== "execute") return NextResponse.json({ error: "Action must be preview or execute." }, { status: 400 });
  if (analysis.kind === "WRITE" && body?.confirmation !== WRITE_CONFIRMATION) return NextResponse.json({ error: `Type ${WRITE_CONFIRMATION} before a write can run.`, analysis }, { status: 400 });

  const { data, error } = await db.rpc("guardian_execute_sql", { p_sql: analysis.normalizedSql, p_confirmation: analysis.kind === "WRITE" ? body.confirmation : null });
  if (error) return NextResponse.json({ error: error.message, code: error.code, analysis }, { status: 400 });
  if (data && typeof data === "object" && "ok" in data && data.ok === false) return NextResponse.json({ error: String(data.error || "Guardian SQL failed."), analysis, result: data }, { status: 400 });
  return NextResponse.json({ guardian: "SUR Guardian", projectRef: SUR_PROJECT_REF, analysis, executed: true, result: data }, { headers: { "Cache-Control": "no-store" } });
}
