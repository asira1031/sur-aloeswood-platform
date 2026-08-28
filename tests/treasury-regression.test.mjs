import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
test('legacy withdrawal page redirects instead of debiting wallets', () => {
  const source = read('app/admin/withdrawals/page.tsx');
  assert.match(source, /redirect\("\/admin\/treasury"\)/);
  assert.doesNotMatch(source, /supabase|\.update\(/);
});
test('treasury uses session-authorized withdrawal RPCs', () => {
  const source = read('app/admin/treasury/page.tsx');
  assert.match(source, /rpc\("sur_admin_settle_withdrawal"/);
  assert.match(source, /rpc\("sur_admin_reject_withdrawal"/);
  assert.doesNotMatch(source, /sur_admin_(settle|reject)_withdrawal_by_email/);
  assert.match(source, /normalize\(row.status\) !== "PENDING_REVIEW"/);
});
