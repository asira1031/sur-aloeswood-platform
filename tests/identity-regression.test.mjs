import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('profile identity and purchase approval never fall back to email',()=>{
 for(const file of ['app/lib/auth/session.ts','app/api/guardian/developer/route.ts']) {
  assert.doesNotMatch(read(file),/profileByEmail|byEmail/);
  assert.match(read(file),/\.eq\("auth_user_id"/);
 }
});
test('admin requires active status, including unknown statuses',()=>{
 assert.match(read('app/admin/layout.tsx'),/toUpperCase\(\) !== "ACTIVE"/);
});
test('caretaker document origin is restricted and invalid purchase JSON is handled',()=>{
 assert.match(read('app/api/caretaker/apply/route.ts'),/document.origin !== "https:\/\/dvidrbhfzzhgwyempgtu.supabase.co"/);
 assert.match(read('app/api/admin/purchases/approve/route.ts'),/status: 410/);
 assert.doesNotMatch(read('app/api/admin/purchases/approve/route.ts'),/createClient|\.insert|\.update/);
});
