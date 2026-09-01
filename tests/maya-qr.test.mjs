import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('SUR QR is the exact owner-approved image, not a regenerated payment code',()=>{
 const bytes=readFileSync(new URL('../public/sur-maya-payment-qr.png',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'18ed60b2f5373d84ca80d7bb08d2226dbf5097d158762170f34fb2d8d8a9eff8');
});
test('both payment flows share the exact QR and their computed total',()=>{
 for(const p of ['app/components/TreeCheckout.tsx','app/components/CarePaymentPanel.tsx']) assert.match(read(p),/<MayaPaymentQr amount=\{total\}/);
 const s=read('app/components/MayaPaymentQr.tsx');
 assert.match(s,/unoptimized/);
 assert.match(s,/download="SUR-Maya-QR.png"/);
 assert.match(s,/does not automatically set the amount/);
 assert.match(s,/Check the recipient/);
 assert.doesNotMatch(s,/fetch\(|\.rpc\(|\.insert\(/);
});
