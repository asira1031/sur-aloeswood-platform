import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('legacy approval cannot perform partial writes',()=>{
 const s=read('app/api/admin/purchases/approve/route.ts');
 assert.match(s,/410/);assert.doesNotMatch(s,/supabase|createClient/);
});
test('tree age requires planting and treasury displays stored payout amounts',()=>{
 assert.match(read('app/components/SimpleMyTrees.tsx'),/growthStart=tree\?\.planted_at\|\|null/);
 assert.match(read('app/admin/treasury/page.tsx'),/net: selected.net_amount/);
});
test('KYC recovery checks session and object ownership before pending status',()=>{
 const s=read('database/096-kyc-resubmission.sql');
 assert.match(s,/auth_user_id=auth.uid\(\) for update/);
 assert.match(s,/bucket_id='kyc-docs' and name=object_path/);
 assert.match(s,/kyc_status='PENDING'/);
});
test('prospective fee allocation only happens at settlement',()=>{
 const s=read('database/095-settlement-fee-timing.sql');
 const request=s.slice(0,s.indexOf('create or replace function public.sur_withdrawal_fee_allocation_trigger'));
 assert.doesNotMatch(request,/perform public.sur_create_tdi_fee_allocation/);
 assert.match(s,/new.status,''\)\) <> 'SETTLED'/);
});
