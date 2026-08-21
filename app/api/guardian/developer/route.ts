import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { buildPlan, GUARDIAN_PROJECT_NAME, GUARDIAN_PROJECT_ROOT, isLocalGuardianRequest, normalizeBrief, safeSlug, validateBrief } from "@/app/lib/guardian/developer";
import { isSurProject } from "@/app/lib/guardian/policy";
import { bearerToken, enforceRateLimit, normalizeRole } from "@/app/lib/security/server";

export const runtime = "nodejs";
const runFile = promisify(execFile);

async function authorize(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authHeader = bearerToken(request);
  if (!isSurProject(url) || !key || !authHeader) return null;
  const db = createClient(url!, key, { global: { headers: { Authorization: authHeader } }, auth: { autoRefreshToken: false, persistSession: false } });
  const { data: auth, error } = await db.auth.getUser();
  if (error || !auth.user?.id || !auth.user.email) return null;
  const columns = "id,email,role,account_status";
  const { data: linked } = await db.from("profiles").select(columns).eq("auth_user_id", auth.user.id).maybeSingle();
  const { data: byEmail } = linked ? { data: null } : await db.from("profiles").select(columns).eq("email", auth.user.email.toLowerCase().trim()).maybeSingle();
  const profile = linked || byEmail;
  if (!profile || !["ADMIN", "SUPER_ADMIN"].includes(normalizeRole(profile.role)) || String(profile.account_status || "").toUpperCase() !== "ACTIVE") return null;
  return { id: auth.user.id, profileId: profile.id, email: auth.user.email };
}

export async function POST(request: NextRequest) {
  if (!isLocalGuardianRequest(request)) return NextResponse.json({ error: "Guardian Developer Studio is available on localhost in development only." }, { status: 403 });
  const rate = enforceRateLimit(request, "guardian-developer", 40, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Guardian Developer Studio request limit reached." }, { status: 429 });
  const actor = await authorize(request);
  if (!actor) return NextResponse.json({ error: "Active SUR admin login is required." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const action = String(body?.action || "");

  if (action === "plan" || action === "save-brief") {
    const brief = normalizeBrief(body?.brief);
    const errors = validateBrief(brief);
    if (errors.length) return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
    const plan = buildPlan(brief);
    if (action === "plan") return NextResponse.json({ guardian: "Developer Studio", project: GUARDIAN_PROJECT_NAME, localOnly: true, saved: false, brief, plan });

    const requestDirectory = resolve(GUARDIAN_PROJECT_ROOT, ".guardian", "requests");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const path = resolve(requestDirectory, `${stamp}-${safeSlug(brief.name)}.json`);
    if (relative(GUARDIAN_PROJECT_ROOT, path).startsWith("..")) return NextResponse.json({ error: "Guardian path boundary rejected the request." }, { status: 400 });
    await mkdir(requestDirectory, { recursive: true });
    await writeFile(path, JSON.stringify({ version: 1, createdAt: new Date().toISOString(), actor: { authUserId: actor.id, profileId: actor.profileId }, brief, plan, status: "READY_FOR_CODEX" }, null, 2), { encoding: "utf8", flag: "wx" });
    return NextResponse.json({ guardian: "Developer Studio", project: GUARDIAN_PROJECT_NAME, localOnly: true, saved: true, job: relative(GUARDIAN_PROJECT_ROOT, path), status: "READY_FOR_CODEX", plan });
  }

  if (action === "verify") {
    const workflow = String(body?.workflow || "");
    const workflows: Record<string, { file: string; args: string[]; timeout: number }> = {
      security: { file: process.execPath, args: ["--test", "tests/guardian-security.test.mjs", "tests/security-contract.test.mjs"], timeout: 120_000 },
      lint: { file: process.platform === "win32" ? "npm.cmd" : "npm", args: ["run", "lint", "--", "app/admin/guardian/page.tsx", "app/api/guardian", "app/lib/guardian"], timeout: 180_000 },
    };
    const selected = workflows[workflow];
    if (!selected) return NextResponse.json({ error: "Unknown verification workflow." }, { status: 400 });
    try {
      const { stdout, stderr } = await runFile(selected.file, selected.args, { cwd: GUARDIAN_PROJECT_ROOT, timeout: selected.timeout, maxBuffer: 1_000_000, windowsHide: true });
      return NextResponse.json({ guardian: "Developer Studio", project: GUARDIAN_PROJECT_NAME, workflow, passed: true, output: `${stdout}${stderr}`.trim().slice(-30_000) });
    } catch (error) {
      const result = error as Error & { stdout?: string; stderr?: string };
      return NextResponse.json({ error: "Verification failed.", workflow, passed: false, output: `${result.stdout || ""}${result.stderr || ""}`.trim().slice(-30_000) }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "Unknown Guardian Developer Studio action." }, { status: 400 });
}
