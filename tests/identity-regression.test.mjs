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
test('customer and caretaker pages bind identity to the authenticated user, never localStorage email',()=>{
 for(const file of ['app/investor/notifications/page.tsx','app/investor/referrals/page.tsx']) {
  assert.match(read(file),/getAuthenticatedProfile/);
  assert.doesNotMatch(read(file),/sur_login_email|\.eq\("email"/);
 }
 for(const file of ['app/farmer/layout.tsx','app/farmer/profile/page.tsx']) {
  assert.match(read(file),/auth_user_id/);
  assert.doesNotMatch(read(file),/\.eq\("email"/);
 }
 const profileSource=read('app/farmer/profile/page.tsx');
 const updatePayload=profileSource.match(/\.update\(\{([\s\S]*?)\}\)\s*\.eq/)?.[1]||'';
 assert.doesNotMatch(updatePayload,/\bstatus\s*:/);
});
test('legacy identity-by-email pages redirect to authenticated modern workflows',()=>{
 assert.match(read('app/certificates/page.tsx'),/redirect\("\/legalities"\)/);
 assert.match(read('app/investor/timeline/page.tsx'),/redirect\("\/investor\/care-services"\)/);
 assert.match(read('app/harvest/page.tsx'),/redirect\("\/investor\/my-trees"\)/);
});
test('sensitive admin account actions cross an authenticated server boundary',()=>{
 const gardenerPage=read('app/admin/gardener/page.tsx');
 const coplanterPage=read('app/admin/coplanters/[profileId]/page.tsx');
 assert.match(gardenerPage,/fetch\("\/api\/admin\/farmers"/);
 assert.doesNotMatch(gardenerPage,/from\("profiles"\)\.update/);
 assert.match(coplanterPage,/fetch\(`\/api\/admin\/coplanters\/\$\{profile\.id\}`/);
 assert.doesNotMatch(coplanterPage,/from\("profiles"\)\s*\.update/);
 for(const file of ['app/api/admin/farmers/route.ts','app/api/admin/coplanters/[profileId]/route.ts']) {
  const source=read(file);
  assert.match(source,/auth\.getUser\(\)/);
  assert.match(source,/\.eq\("auth_user_id", user\.id\)/);
  assert.match(source,/account_status/);
 }
});
test('caretaker document origin is restricted and invalid purchase JSON is handled',()=>{
 assert.match(read('app/api/caretaker/apply/route.ts'),/url !== "https:\/\/dvidrbhfzzhgwyempgtu.supabase.co"/);
 assert.match(read('app/api/caretaker/apply/route.ts'),/resumeUrl.startsWith\(user.id/);
 assert.match(read('app/api/admin/purchases/approve/route.ts'),/status: 410/);
 assert.doesNotMatch(read('app/api/admin/purchases/approve/route.ts'),/createClient|\.insert|\.update/);
});
