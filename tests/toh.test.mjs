import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

function run(...args) {
  return spawnSync(process.execPath, [resolve(ROOT, "scripts", "toh.mjs"), ...args], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env },
  });
}

function json(result) {
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("status enforces read-only authority and never prints environment values", () => {
  const result = run("status");
  const output = json(result);
  assert.equal(output.assistant, "TOH");
  assert.equal(output.mode, "read-only");
  assert.equal(output.authorityLevel, 0);
  assert.equal(output.killSwitch, "WRITE_ACTIONS_FROZEN");
  assert.equal(output.liveMutationAvailable, false);
  assert.doesNotMatch(result.stdout, /eyJ[A-Za-z0-9_-]{20,}/);
});

test("map is derived from this repository and records proof gaps", () => {
  const output = json(run("map"));
  assert.match(output.source.repository, /sur-aloeswood-platform/);
  assert.ok(output.frontend.pages.includes("/investor/wallet"));
  assert.ok(output.frontend.pages.includes("/investor/marketplace"));
  assert.ok(output.backend.rpcReferences.includes("sur_submit_tree_order"));
  assert.ok(output.backend.rpcReferences.includes("sur_admin_approve_tree_order"));
  assert.equal(output.operations.automatedTests, "PRESENT BUT UNVERIFIED");
  assert.equal(output.database.liveSchema, "UNKNOWN");
});

test("workflow trace distinguishes source presence from runtime proof", () => {
  const output = json(run("trace", "seedling-purchase"));
  assert.equal(output.workflow, "seedling-purchase");
  assert.equal(output.conclusion, "HOLD");
  assert.equal(output.firstBrokenOrUnprovenStep, "purchase-intent");
  assert.ok(output.actual.every((step) => ["SOURCE_PRESENT", "UNPROVEN_AT_RUNTIME"].includes(step.state)));
});

test("authority gate permits observation but protects financial mutation", () => {
  const observe = json(run("gate", "observe", "low", "true", "true", "true", "confirmed"));
  assert.equal(observe.decision, "PASS");
  const financial = json(run("gate", "financial", "low", "true", "true", "true", "confirmed"));
  assert.equal(financial.decision, "APPROVAL_REQUIRED");
  assert.equal(financial.writeActionsFrozen, true);
});

test("database reader rejects a non-allowlisted resource before network access", () => {
  const result = run("read", "profiles", "1");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Resource is not allowlisted/);
});

test("invariant report never claims unexecuted live checks passed", () => {
  const output = json(run("invariants"));
  assert.ok(output.summary.liveChecksExecuted >= 0);
  assert.ok(["HOLD", "PASS_BOUNDED_VIEW_ONLY", "VIOLATION_FOUND"].includes(output.summary.status));
  assert.ok(output.invariants.some((item) => item.id === "FIN-001"));
  assert.match(output.summary.reason, /(bounded|not yet available)/i);
});

test("refresh persists a regeneratable local model without touching live systems", () => {
  const output = json(run("refresh"));
  const modelPath = resolve(ROOT, output.output);
  assert.equal(output.liveSystemsTouched, false);
  assert.equal(existsSync(modelPath), true);
  const model = JSON.parse(readFileSync(modelPath, "utf8"));
  assert.equal(model.controlPlane.authority.writeActionsFrozen, true);
  assert.ok(model.workflowInventory.workflows.length >= 8);
});

test("local reconciliation reports missing RPC source instead of assuming live truth", () => {
  const output = json(run("reconcile"));
  assert.equal(output.decision, "HOLD");
  assert.ok(output.rpcAlignment.some((item) => item.rpc === "sur_submit_tree_order"));
  assert.ok(output.findings.every((finding) => finding.severity === "HIGH"));
  assert.equal(output.proofLimit.includes("live Supabase"), true);
});

test("health reports owner blueprint and dirty-worktree attention honestly", () => {
  const output = json(run("health"));
  assert.equal(output.status, "ATTENTION");
  assert.equal(output.liveDatabaseChecked, false);
  assert.equal(output.deploymentChecked, false);
  assert.equal(output.checks.find((check) => check.id === "owner-blueprint")?.passed, false);
});

test("capability audit reports TOH configuration honestly and keeps autonomous repair frozen", () => {
  const output = json(run("audit"));
  const statuses = Object.fromEntries(output.capabilities.map((item) => [item.name, item.status]));
  assert.equal(statuses["LLM runtime"], "IMPLEMENTED_CONFIGURATION_REQUIRED");
  assert.equal(statuses["autonomous repair"], "FROZEN");
  assert.equal(statuses["production proof of done"], "NOT_PROVEN");
});

test("before and after snapshots are comparable and exclude live secrets", () => {
  const before = json(run("snapshot", "test-before"));
  const after = json(run("snapshot", "test-after"));
  assert.equal(before.liveSystemsTouched, false);
  assert.equal(after.liveSystemsTouched, false);
  const comparison = json(run("compare", "test-before", "test-after"));
  assert.equal(comparison.equal, true);
  const snapshotText = readFileSync(resolve(ROOT, before.output), "utf8");
  assert.doesNotMatch(snapshotText, /\.env\.local/);
});

test("change impact marks wallet code as protected and requires approval", () => {
  const output = json(run("impact", "app/investor/wallet/page.tsx"));
  assert.equal(output.risk, "HIGH");
  assert.ok(output.inferredProtectedDomains.includes("financial"));
  assert.ok(output.requiredChecks.includes("owner approval"));
});

test("confidence decay and proof evaluator refuse broad production claims", () => {
  const decay = json(run("decay"));
  assert.ok(["DECAYED", "CURRENT_LOCAL_ONLY"].includes(decay.status));
  assert.equal(decay.liveDeploymentConfidence, "UNKNOWN");
  const proof = json(run("proof"));
  assert.equal(proof.decision, "NOT_PROVEN_COMPLETE");
  assert.ok(proof.missing.includes("DATABASE"));
  assert.ok(proof.missing.includes("DEPLOYMENT"));
});
