import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('active wallet workflows do not query or offer cash-in',()=>{
 for (const path of ['app/admin/treasury/page.tsx','app/admin/activity/page.tsx','app/investor/wallet/page.tsx','app/lib/dashboard/nav.ts','app/lib/settings/preferences.ts','app/lib/launch/checklist.ts']) {
  const source=readFileSync(new URL('../'+path,import.meta.url),'utf8');
  assert.doesNotMatch(source,/cash.?in/i,path);
 }
});
