import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Recovery Center is active-admin-only and locked to the SUR database", () => {
  const source = read("app/api/admin/recovery/route.ts");
  assert.match(source, /dvidrbhfzzhgwyempgtu/);
  assert.match(source, /auth\.getUser\(\)/);
  assert.match(source, /\.eq\("auth_user_id", auth\.user\.id\)/);
  assert.match(source, /String\(profile\.account_status/);
});

test("Recovery Center never auto-approves money, KYC, withdrawal, or ownership", () => {
  const source = read("app/api/admin/recovery/route.ts");
  assert.doesNotMatch(source, /sur_admin_approve_tree_order/);
  assert.doesNotMatch(source, /sur_admin_settle_withdrawal/);
  assert.doesNotMatch(source, /kyc_status:\s*"APPROVED"/);
  assert.doesNotMatch(source, /owner_profile_id\s*:/);
  assert.match(source, /TOH cannot approve it/);
  assert.match(source, /TOH cannot move money/);
});

test("zero-wallet repair is confirmed, zero-only, verified, idempotent, and audited", () => {
  const source = read("app/api/admin/recovery/route.ts");
  assert.match(source, /confirmation !== "CREATE ZERO WALLET"/);
  assert.match(source, /Number\(profile\.wallet_balance \|\| 0\) !== 0/);
  assert.match(source, /insert\(\{ profile_id: profile\.id, balance: 0 \}\)/);
  assert.match(source, /idempotency_key: idempotencyKey/);
  assert.match(source, /VERIFIED_SUCCESS/);
});

test("recovery evidence is append-only for authenticated admins", () => {
  const sql = read("database/104-toh-recovery-center.sql");
  assert.match(sql, /sur_recovery_events/);
  assert.match(sql, /idempotency_key text not null unique/);
  assert.match(sql, /grant select on public\.sur_recovery_events to authenticated/);
  assert.doesNotMatch(sql, /grant (insert|update|delete)/i);
});
