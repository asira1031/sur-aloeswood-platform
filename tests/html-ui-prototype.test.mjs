import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PROTOTYPE = resolve(ROOT, "SUR_HTML_UI_PROTOTYPE");
const read = (name) => readFileSync(resolve(PROTOTYPE, name), "utf8");

test("standalone prototype covers every approved user-facing screen", () => {
  const htmlFiles = readdirSync(PROTOTYPE).filter((name) => name.endsWith(".html"));

  assert.equal(htmlFiles.length, 66); // 65 app screens plus the all-pages catalog.
  assert.ok(htmlFiles.includes("all-pages.html"));
  assert.ok(htmlFiles.includes("index.html"));
  assert.ok(htmlFiles.includes("investor-marketplace.html"));
  assert.ok(htmlFiles.includes("farmer-daily-care.html"));
  assert.ok(htmlFiles.includes("admin-dashboard.html"));
});

test("every screen is mobile-first, standalone, and free of live credentials", () => {
  const htmlFiles = readdirSync(PROTOTYPE).filter((name) => name.endsWith(".html"));

  for (const name of htmlFiles) {
    const html = read(name);
    assert.match(html, /width=device-width, initial-scale=1, viewport-fit=cover/);
    assert.match(html, /styles\.css/);
    assert.doesNotMatch(html, /(SUPABASE_SERVICE_ROLE_KEY|HEYGEN_API_KEY)\s*[:=]|sk-[A-Za-z0-9_-]{20,}|eyJhbGciOiJ[A-Za-z0-9_-]{20,}/i);
  }
});

test("catalog links resolve to generated HTML files", () => {
  const catalog = read("all-pages.html");
  const links = [...catalog.matchAll(/href="([^"]+\.html)"/g)].map((match) => match[1]);

  assert.ok(links.length >= 65);
  for (const href of links) assert.ok(existsSync(resolve(PROTOTYPE, href)), `Missing catalog target: ${href}`);
});

test("shared CSS enforces phone readability and safe-area navigation", () => {
  const css = read("styles.css");

  assert.match(css, /min-width:320px/);
  assert.match(css, /font-size:16px/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /@media\(min-width:980px\)/);
  assert.doesNotMatch(css, /user-scalable=no|maximum-scale=1/i);
});
