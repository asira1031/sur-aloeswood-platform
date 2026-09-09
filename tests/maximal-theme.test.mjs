import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

test('visual theme excludes recovery tools and has no data or access authority', () => {
  const source=readFileSync('app/components/SurVisualTheme.tsx','utf8');
  assert.match(source,/toh\|guardian\|recovery/);
  assert.doesNotMatch(source,/supabase|fetch\(|localStorage|\.rpc\(/);
  assert.match(readFileSync('app/layout.tsx','utf8'),/<SurVisualTheme>\{children\}<\/SurVisualTheme>/);
});
test('maximal theme assets are local and do not replace payment or tree QR', () => {
  for(const name of ['sur-botanical-maximal-v1.png','sur-tree-records-maximal-v1.png']) assert.ok(existsSync('public/app-assets/'+name));
  const modal=readFileSync('app/components/BuyTreeModal.tsx','utf8');
  assert.match(modal,/<MayaPaymentQr amount=\{total\}/);
  assert.match(modal,/aria-pressed=\{plan===option.id\}/);
});
test('theme keeps reduced motion, keyboard focus and semantic danger colors', () => {
  const css=readFileSync('app/maximal-theme.css','utf8');
  assert.match(css,/prefers-reduced-motion/);
  assert.match(css,/:focus-visible/);
  assert.doesNotMatch(css,/\.bg-red-\d+\s*\{/);
});
