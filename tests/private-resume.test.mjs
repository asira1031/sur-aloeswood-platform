import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('anonymous caretaker signup is retired in favor of verified account application',()=>{
 const s=read('app/api/farmer/register/route.ts');
 assert.match(s,/status:410/);assert.doesNotMatch(s,/createClient|\.insert\(|\.upload\(/);
 assert.match(read('app/farmer/register/page.tsx'),/href="\/register"/);
});
test('private resumes are scoped to session owner and checked for existence',()=>{
 const s=read('app/api/caretaker/apply/route.ts');
 assert.match(s,/resumeUrl.startsWith\(user.id/);
 assert.match(s,/userClient.storage.from\("farmer-resumes"\).info\(resumeUrl\)/);
 assert.match(s,/\.eq\("auth_user_id", user.id\)/);
 assert.doesNotMatch(read('app/investor/profile/page.tsx'),/getPublicUrl/);
 assert.match(read('app/investor/profile/page.tsx'),/finally\{setApplying\(false\)\}/);
});
test('admin resume viewing signs existing private objects rather than using public URLs',()=>{
 assert.match(read('app/components/PrivateResumeLink.tsx'),/createSignedUrl\(path,120\)/);
 assert.match(read('app/admin/gardener/page.tsx'),/PrivateResumeLink value=/);
 assert.doesNotMatch(read('app/admin/gardener/page.tsx'),/getPublicUrl|href=\{farmer.resume_url\}/);
});
test('resume storage removes anonymous upload and has restrictive read and immutable boundaries',()=>{
 const s=read('database/102-private-caretaker-resumes.sql');
 assert.match(s,/set public=false/);
 assert.match(s,/drop policy if exists "farmer resumes anon upload"/);
 for(const cmd of ['select','insert','update','delete']) assert.ok(s.includes(`as restrictive for ${cmd}`));
 assert.doesNotMatch(s,/delete from storage.objects/i);
});
