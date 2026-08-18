import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFileSync(resolve(ROOT, path), "utf8");

test("public registration endpoints retain abuse controls and do not overwrite auth passwords", () => {
  for (const path of ["app/api/register/coplanter/route.ts", "app/api/farmer/register/route.ts"]) {
    const source = read(path);
    assert.match(source, /enforceRateLimit/);
    assert.doesNotMatch(source, /updateUserById\s*\([^)]*password/s);
  }
});

test("HeyGen generation remains authenticated and admin-only", () => {
  const source = read("app/api/heygen/generate/route.ts");
  assert.match(source, /bearerToken\s*\(/);
  assert.match(source, /normalizeRole/);
  assert.match(source, /SUPER_ADMIN/);
  assert.match(source, /status:\s*401/);
  assert.match(source, /status:\s*403/);
});

test("admin layout verifies a real Supabase session instead of trusting localStorage role flags", () => {
  const source = read("app/admin/layout.tsx");
  const sessionHelper = read("app/lib/auth/session.ts");
  assert.match(source, /getAuthenticatedProfile\s*\(/);
  assert.match(sessionHelper, /auth\.getUser\s*\(/);
  assert.doesNotMatch(source, /localStorage\.getItem\([^)]*(admin|role)/i);
});

test("financial hardening revokes anonymous RPC execution and direct wallet transaction insertion", () => {
  const sql = read("database/security-hardening.sql");
  assert.match(sql, /drop policy if exists "wallet tx owner insert"/i);
  assert.match(sql, /revoke all on function public\.create_maintenance_order_with_wallet[\s\S]*from public, anon/i);
  assert.match(sql, /revoke all on function public\.pay_maintenance_order_with_wallet[\s\S]*from public, anon/i);
  assert.match(sql, /revoke all on function public\.request_recovery_termination[\s\S]*from public, anon/i);
});

test("application security headers remain configured", () => {
  const source = read("next.config.ts");
  for (const header of ["Content-Security-Policy", "Strict-Transport-Security", "X-Content-Type-Options", "Referrer-Policy"]) {
    assert.match(source, new RegExp(header));
  }
  assert.match(source, /process\.env\.NODE_ENV\s*===\s*["']development["']/);
  assert.match(source, /isDev\s*\?\s*["'] 'unsafe-eval'["']\s*:\s*["']["']/);
});

test("TOH chat remains authenticated, admin-only, bounded, and tool-free", () => {
  const source = read("app/api/toh/chat/route.ts");
  assert.match(source, /bearerToken\s*\(/);
  assert.match(source, /auth\.getUser\s*\(/);
  assert.match(source, /ADMIN/);
  assert.match(source, /SUPER_ADMIN/);
  assert.match(source, /enforceRateLimit\([^,]+,\s*["']toh-chat["'],\s*20/);
  assert.match(source, /question\.length\s*>\s*4_000/);
  assert.match(source, /store:\s*false/);
  assert.match(source, /deterministicTohAnswer/);
  assert.doesNotMatch(source, /tools\s*:/);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE/);
  assert.doesNotMatch(source, /\.insert\s*\(|\.update\s*\(|\.upsert\s*\(|\.delete\s*\(|\.rpc\s*\(/);
});

test("TOH page sends the current admin session token without exposing an API key", () => {
  const source = read("app/admin/toh/page.tsx");
  assert.match(source, /getSession\s*\(/);
  assert.match(source, /Authorization:\s*`Bearer \$\{token\}`/);
  assert.doesNotMatch(source, /OPENAI_API_KEY/);
});
