import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync(new URL('../app/farmer/layout.tsx',import.meta.url),'utf8');
test('caretaker profile lookup is user-ID bound and account state fails closed',()=>{
 assert.match(s,/\.eq\("auth_user_id", authData.user!\.id\)/);
 assert.match(s,/status !== "ACTIVE"/);
 assert.match(s,/verifiedPath !== pathname/);
});
test('public caretaker signup renders without a workspace gate',()=>{
 const publicReturn=s.indexOf('if (pathname === "/farmer/register") return <>{children}</>');
 assert.ok(publicReturn>0);
 assert.ok(publicReturn<s.indexOf('if (checking || !allowed ||'));
 assert.match(s,/verifyFarmerAccess\(\).catch/);
});
