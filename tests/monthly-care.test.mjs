import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('database/103-monthly-care-ledger.sql');
test('care payment submission cannot grant coverage or mutate wallets',()=>{
 const submit=sql.slice(sql.indexOf('create or replace function public.sur_submit_care_payment'),sql.indexOf('create or replace function public.sur_admin_review_care_payment'));
 assert.doesNotMatch(submit,/update public.sur_care_accounts|update public.wallet|sur_apply_wallet_delta/);
 assert.match(submit,/p_amount is distinct from total/);
 assert.match(submit,/split_part\(p_receipt,'\/',1\)<>auth.uid\(\)::text/);
 assert.match(submit,/bucket_id='sur-payment-proofs' and name=p_receipt/);
 assert.match(submit,/p_plan<>'MONTHLY'/);
});
test('care approvals lock records, reject finalized state and atomically extend calendar coverage',()=>{
 const review=sql.slice(sql.indexOf('create or replace function public.sur_admin_review_care_payment'),sql.indexOf('alter table public.sur_tree_updates'));
 assert.match(review,/not public.app_is_admin\(\)/);
 assert.match(review,/where id=p_payment for update/);
 assert.match(review,/if p.status<>'PENDING'/);
 assert.match(review,/if p_decision='APPROVED' then/);
 assert.match(review,/paid_months=paid_months\+p.months/);
 assert.match(sql,/a.starts_on\+make_interval\(months=>a.paid_months\)/);
 assert.match(sql,/ends<=today\+7/);
});
test('reference locking covers both order and care tables and one pending payment per account',()=>{
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/create trigger sur_guard_maya_reference before insert on public.sur_tree_orders/);
 assert.match(sql,/create trigger sur_guard_maya_reference before insert on public.sur_care_payments/);
 assert.match(sql,/sur_care_payment_pending.*account_tree_id.*status='PENDING'/);
});
test('journal access is server-enforced and confirmed planting is explicit',()=>{
 assert.match(sql,/as restrictive for select to authenticated/);
 assert.match(sql,/sur_can_read_care_update\(tree_id,is_planting_record\)/);
 assert.match(sql,/if u.status<>'APPROVED'/);
 assert.match(sql,/sur_one_planting_record/);
 assert.match(sql,/Tree replacement cycle/);
 assert.match(sql,/Replacement owner mismatch/);
});
test('customer care payment and admin review are reachable and no longer link payment to wallet',()=>{
 assert.match(read('app/investor/care-services/page.tsx'),/CarePaymentPanel key=\{tree.id\}/);
 assert.doesNotMatch(read('app/investor/care-services/page.tsx'),/href="\/investor\/wallet"/);
 assert.match(read('app/components/CarePaymentPanel.tsx'),/rpc\("sur_submit_care_payment"/);
 assert.match(read('app/components/AdminCarePayments.tsx'),/rpc\("sur_admin_review_care_payment"/);
 assert.match(read('app/admin/orders/page.tsx'),/<AdminCarePayments/);
 assert.match(read('app/components/SimpleMyTrees.tsx'),/<CareCoverageNotice/);
});
