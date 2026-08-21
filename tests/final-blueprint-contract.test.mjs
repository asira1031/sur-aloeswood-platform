import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFileSync(resolve(ROOT, path), "utf8");

test("final tree commerce values match the approved blueprint", () => {
  const rules = read("app/lib/business/rules.ts");
  const migration = read("database/080-final-blueprint-core.sql");

  assert.match(rules, /COPLANTER_PACKAGE_PRICE\s*=\s*25000/);
  assert.match(rules, /MONTHLY_TREE_CARE_FEE\s*=\s*200/);
  assert.match(rules, /ONE_TIME_TREE_CARE_FEE\s*=\s*5000/);
  assert.match(migration, /care_plan in \('SKIP','MONTHLY','ONE_TIME'\)/);
  assert.match(migration, /payment_channel='MAYA_QR'/);
});

test("contract signing is owner-bound, legal-name-bound, and audited", () => {
  const sql = read("database/081-secure-contract-signing.sql");

  assert.match(sql, /revoke update on public\.sur_contracts from authenticated/i);
  assert.match(sql, /c\.profile_id = v_profile_id/i);
  assert.match(sql, /lower\(v_signature\) <> lower\(v_legal_name\)/i);
  assert.match(sql, /CUSTOMER_CONTRACT_SIGNED/);
  assert.match(sql, /ACTIVE_AWAITING_FARM_ASSIGNMENT/);
  assert.match(sql, /CONTRACT-SIGN:/);
});

test("customers can sign only through the secure RPC", () => {
  const screen = read("app/components/ContractSigning.tsx");

  assert.match(screen, /supabase\.rpc\("sur_sign_tree_contract"/);
  assert.doesNotMatch(screen, /\.from\("sur_contracts"\)[\s\S]{0,160}\.update\(/);
  assert.match(screen, /must exactly match the legal name/i);
  assert.match(screen, /no guaranteed buyer, sale date, market price, or profit/i);
});

test("admin rejection uses the audited RPC and private receipt links", () => {
  const screen = read("app/admin/orders/page.tsx");

  assert.match(screen, /supabase\.rpc\("sur_admin_reject_tree_order"/);
  assert.match(screen, /createSignedUrl\(receiptPath, 600\)/);
  assert.doesNotMatch(screen, /\.from\("sur_tree_orders"\)[\s\S]{0,180}\.update\(/);
});

test("caretaker evidence is assignment-bound and customer-visible only after approval", () => {
  const sql = read("database/082-tree-care-operations.sql");

  assert.match(sql, /caretaker_profile_id = v_profile_id/i);
  assert.match(sql, /t\.id = public\.sur_tree_updates\.tree_id/i);
  assert.match(sql, /status = 'APPROVED'[\s\S]*t\.profile_id = public\.app_profile_id\(\)/i);
  assert.match(sql, /v_photo not like auth\.uid\(\)::text \|\| '\/%'/i);
  assert.match(sql, /TREE_UPDATE_[^']*'/i);
  assert.match(sql, /sur evidence caretaker upload/i);
});

test("daily care uploads the original image and submits through an audited RPC", () => {
  const screen = read("app/farmer/daily-care/page.tsx");

  assert.match(screen, /sur-tree-evidence/);
  assert.match(screen, /supabase\.rpc\("sur_submit_daily_tree_update"/);
  assert.match(screen, /upsert:\s*false/);
  assert.match(screen, /does not reduce photo quality/i);
  assert.doesNotMatch(screen, /(document\.createElement\(["']canvas|toDataURL|getContext\(["']2d|resizeImage)/i);
});

test("customer care updates are grouped weekly or monthly", () => {
  const screen = read("app/investor/my-trees/page.tsx");

  assert.match(screen, /"WEEKLY" \| "MONTHLY"/);
  assert.match(screen, /\.eq\("status", "APPROVED"\)/);
  assert.match(screen, /groupUpdates\(selectedApprovedUpdates, updatePeriod\)/);
  assert.doesNotMatch(screen, /gps_lat|gps_lng/i);
});

test("physical QR tags expose only the privacy-safe public Tree ID lookup", () => {
  const sql = read("database/083-public-tree-qr.sql");
  const printer = read("app/admin/tree-tags/page.tsx");
  const publicSearch = read("app/tree/page.tsx");

  assert.match(sql, /sur_public_tree_lookup/);
  assert.match(sql, /grant execute[^;]*to anon, authenticated/i);
  assert.doesNotMatch(sql, /jsonb_build_object\([\s\S]*'(profile_id|legal_name|caretaker_profile_id|farm_site|payment_reference)'/i);
  assert.match(printer, /errorCorrectionLevel:\s*"H"/);
  assert.match(printer, /\/tree\/\$\{encodeURIComponent/);
  assert.doesNotMatch(publicSearch, /profiles|gps_lat|gps_lng|tree_registry/i);
});

test("global phone safeguards preserve zoom, safe areas, and horizontal fit", () => {
  const globalCss = read("app/globals.css");
  const layout = read("app/layout.tsx");

  assert.match(globalCss, /-webkit-text-size-adjust:\s*100%/);
  assert.match(globalCss, /min-width:\s*320px/);
  assert.match(globalCss, /overflow-x:\s*clip/);
  assert.match(globalCss, /env\(safe-area-inset-bottom\)/);
  assert.match(globalCss, /@media \(max-width:\s*640px\)[\s\S]*input,[\s\S]*select,[\s\S]*textarea[\s\S]*font-size:\s*16px/);
  assert.match(layout, /width:\s*"device-width"/);
  assert.match(layout, /viewportFit:\s*"cover"/);
  assert.doesNotMatch(layout, /userScalable:\s*false|maximumScale:\s*1/);
});

test("critical phone workflows have full-width touch actions and readable controls", () => {
  const checkout = read("app/components/TreeCheckout.tsx");
  const contract = read("app/components/ContractSigning.tsx");
  const dailyCare = read("app/farmer/daily-care/page.tsx");
  const adminOrders = read("app/admin/orders/page.tsx");
  const publicTree = read("app/components/PublicTreeRecord.tsx");

  assert.match(checkout, /mobile-sticky-action/);
  assert.match(checkout, /text-3xl[\s\S]*sm:text-4xl/);
  assert.match(contract, /mobile-sticky-action/);
  assert.match(contract, /h-6 w-6/);
  assert.match(dailyCare, /mobile-sticky-action/);
  assert.match(dailyCare, /capture="environment"/);
  assert.match(adminOrders, /mobile-primary-action w-full/);
  assert.match(publicTree, /sm:w-auto/);

  for (const source of [checkout, contract, dailyCare]) {
    assert.doesNotMatch(source, /min-w-\[[0-9]+px\]/);
  }
});
