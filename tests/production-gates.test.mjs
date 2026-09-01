import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('087 removes every unsafe alternate policy observed in the owner precheck', () => {
  const sql = read('database/087-production-security-final.sql');
  const policies = [["profiles","profiles demo public insert"],["profiles","profiles anon register insert"],["profiles","profiles authenticated insert own"],["profiles","profiles authenticated insert own profile"],["profiles","profiles authenticated own insert"],["profiles","profiles insert own coplanter"],["profiles","profiles update own email auth or admin"],["profiles","sur farmer profiles readable for assignment"],["profiles","profiles select own email auth or admin"],["gardeners","gardeners readable for app"],["gardeners","sur gardeners readable for app"],["gardeners","sur gardeners insert for app sync"],["gardeners","sur gardeners update for app sync"],["gardeners","gardeners update self or admin"],["wallets","wallets authenticated insert own wallet"],["wallets","wallets authenticated own insert"],["wallets","wallets insert own or admin"],["wallets","wallets public signup insert"],["wallet_transactions","wallet tx insert own request or admin"],["support_messages","support messages insert chat owner or admin"],["support_tickets","support tickets update own or admin"],["support_chats","support chats update own or admin"]];
  for (const [table, name] of policies) {
    assert.ok(sql.includes(`drop policy if exists "${name}" on public.${table};`), `${table}: ${name}`);
  }
  assert.ok(sql.includes('Authorized target ONLY: dvidrbhfzzhgwyempgtu'));
  assert.ok(sql.includes('observed_unsafe_policies_removed'));
  assert.ok(sql.includes('covered_tables_rls_enabled'));
  assert.ok(sql.includes("with check (profile_id = public.app_profile_id() and status = 'ADMIN_QUEUE')"));
});

test('caretaker creation requires active Admin, not only a role', () => {
  const source = read('app/api/admin/farmers/route.ts');
  assert.match(source, /account_status[\s\S]*!== "ACTIVE"/);
  assert.match(source, /enforceRateLimit/);
  assert.match(source, /request\.json\(\)\.catch/);
});
test('public signup has distributed rate limiting and auth cleanup', () => {
  for (const path of ['app/api/register/coplanter/route.ts']) {
    const source = read(path);
    assert.match(source, /await enforceDurableRateLimit/);
    assert.match(source, /deleteUser\(authUserId\)/);
  }
});
test('retired caretaker pages use a single source of truth', () => {
  for (const path of ['dashboard','dashboard/task','assigned-trees','growth-logs','photo-updates','reports','gps']) {
    assert.match(read(`app/farmer/${path}/page.tsx`), /redirect\("\/farmer\/daily-care"\)/);
  }
});
test('final migration closes wallet and append-only audit permissions', () => {
  const sql = read('database/087-production-security-final.sql');
  assert.match(sql, /drop policy if exists "wallets owner update"/);
  assert.match(sql, /drop policy if exists "wallet tx owner insert"/);
  assert.match(sql, /revoke insert, update, delete on public.guardian_audit_log from authenticated/);
  assert.match(sql, /guardian_append_audit/);
  assert.match(sql, /security invoker/);
  assert.match(sql, /sur_consume_api_rate_limit/);
});
