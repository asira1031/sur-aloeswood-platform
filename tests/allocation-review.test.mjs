import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../'+p, import.meta.url),'utf8');
test('allocation UI uses checked RPC and never trusts local actor identity',()=>{
 const s=read('app/admin/finance-distribution/page.tsx');
 assert.match(s,/rpc\("sur_admin_review_allocations"/);
 assert.doesNotMatch(s,/\.update\(|safeLocalStorage|settled_by:/);
 assert.match(s,/p_expected:/);
 assert.match(s,/finally/);
});
test('allocation review validates all rows under deterministic locks before mutation',()=>{
 const s=read('database/099-allocation-review-rpc.sql');
 assert.match(s,/auth.uid\(\) is null or not public.app_is_admin\(\)/);
 assert.match(s,/order by id for update/);
 assert.match(s,/is distinct from r.settlement_status/);
 assert.match(s,/is distinct from r.allocated_amount/);
 assert.match(s,/n<>cardinality\(p_ids\)/);
 assert.ok(s.indexOf('if n<>')<s.indexOf('update public.revenue_allocations'));
 assert.match(s,/revoke insert,update,delete/);
 assert.match(s,/insert into public.sur_operation_audit/);
});
