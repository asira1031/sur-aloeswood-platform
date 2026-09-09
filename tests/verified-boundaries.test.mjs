import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../database/101-verified-identity-allocation-boundaries.sql',import.meta.url),'utf8');
test('observed permissive allocation policies are removed and reads admin-bound',()=>{
 for(const name of ['revenue allocations admin write temporary','revenue allocations authenticated update temporary','revenue allocations authenticated read temporary'])
  assert.ok(sql.includes(`drop policy if exists "${name}"`));
 assert.match(sql,/as restrictive for select to authenticated using\(public.app_is_admin\(\)\)/);
 assert.match(sql,/as restrictive for insert to authenticated with check\(false\)/);
 assert.match(sql,/as restrictive for delete to authenticated using\(false\)/);
});
test('legacy identity functions no longer authenticate with email fallback',()=>{
 const definitions=sql.slice(sql.indexOf('create or replace function'),sql.indexOf('revoke all on function'));
 assert.doesNotMatch(definitions,/auth.jwt|lower\(p.email/);
 assert.match(definitions,/p.auth_user_id=auth.uid\(\)/);
});
test('direct profile mutation cannot swap KYC proof or financial identity',()=>{
 assert.match(sql,/security invoker/);
 for(const field of ['auth_user_id','kyc_id_url','kyc_selfie_url','wallet_balance','full_name']) assert.ok(sql.includes(`'${field}'`));
 assert.match(sql,/before update on public.profiles/);
 assert.match(sql,/current_user in \('anon','authenticated'\)/);
});
