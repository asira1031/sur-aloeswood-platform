import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('tree verification uses QR encoder rather than decorative checkerboard',()=>{
 assert.match(read('app/components/TreeIdentityQr.tsx'),/QRCode.toDataURL/);
 assert.doesNotMatch(read('app/components/SimpleMyTrees.tsx'),/repeating-conic-gradient/);
});
test('selected tree is passed to legal documents query',()=>{
 assert.match(read('app/components/SimpleMyTrees.tsx'),/treeId=\{tree.id\}/);
 assert.match(read('app/legalities/page.tsx'),/query.eq\("tree_id", treeId\)/);
});
test('failed care queries are not reported as an empty journal',()=>{
 assert.match(read('app/investor/care-services/page.tsx'),/if\(updateResult.error\)/);
 assert.match(read('app/farmer/daily-care/page.tsx'),/treeResult.error \|\| updateResult.error/);
});
test('support distinguishes message persistence from queue update',()=>{
 assert.match(read('app/investor/support/page.tsx'),/queueError/);
 assert.match(read('app/farmer/daily-care/page.tsx'),/queueError/);
});
