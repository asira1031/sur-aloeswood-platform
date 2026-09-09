import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('withdrawal uploads no longer generate public URLs',()=>{
 assert.doesNotMatch(read('app/admin/treasury/page.tsx'),/getPublicUrl/);
 for (const file of ['app/admin/treasury/page.tsx','app/investor/wallet/page.tsx']) assert.match(read(file),/WithdrawalReceipt/);
});
test('receipt links require exact project and short-lived signing',()=>{
 const source=read('app/components/WithdrawalReceipt.tsx');
 assert.match(source,/old.origin !== "https:\/\/dvidrbhfzzhgwyempgtu.supabase.co"/);
 assert.match(source,/createSignedUrl\(path, 120\)/);
});
test('storage migration closes public receipts and adds restrictive boundaries',()=>{
 const source=read('database/094-private-payout-receipts.sql');
 assert.match(source,/set public=false/);
 assert.match(source,/as restrictive for insert/);
 assert.match(source,/as restrictive for select/);
 assert.match(source,/as restrictive for update/);
 assert.match(source,/as restrictive for delete/);
});
