import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFileSync(resolve(ROOT, path), "utf8");

test("Guardian is SUR-only, admin-authenticated, confirmed, and audited", () => {
  const route = read("app/api/guardian/query/route.ts");
  const policy = read("app/lib/guardian/policy.ts");
  const sql = read("database/guardian-gateway.sql");
  assert.match(policy, /dvidrbhfzzhgwyempgtu/);
  assert.match(route, /bearerToken\s*\(/);
  assert.match(route, /auth\.getUser\s*\(/);
  assert.match(route, /SUPER_ADMIN/);
  assert.match(route, /WRITE_CONFIRMATION/);
  assert.match(sql, /security invoker/i);
  assert.match(sql, /guardian_audit_log/i);
  assert.match(sql, /revoke all[\s\S]*from public, anon/i);
  assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE/);
});
