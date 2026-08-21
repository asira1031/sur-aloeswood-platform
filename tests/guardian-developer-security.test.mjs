import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFileSync(resolve(ROOT, path), "utf8");

test("Developer Studio is local-only, admin-authenticated, path-bounded, and command-allowlisted", () => {
  const route = read("app/api/guardian/developer/route.ts");
  const policy = read("app/lib/guardian/developer.ts");
  assert.match(policy, /NODE_ENV\s*===\s*["']development["']/);
  assert.match(policy, /localhost/);
  assert.match(route, /bearerToken\s*\(/);
  assert.match(route, /auth\.getUser\s*\(/);
  assert.match(route, /ADMIN/);
  assert.match(route, /SUPER_ADMIN/);
  assert.match(route, /relative\(GUARDIAN_PROJECT_ROOT, path\)/);
  assert.match(route, /const workflows:/);
  assert.doesNotMatch(route, /body\?\.(command|cmd|path|file)/);
  assert.doesNotMatch(route, /shell:\s*true/);
  assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE/);
  assert.doesNotMatch(route, /git\s+(push|commit)|vercel\s+deploy/);
});

test("Developer Studio runtime artifacts are gitignored", () => {
  assert.match(read(".gitignore"), /\/\.guardian\//);
});
