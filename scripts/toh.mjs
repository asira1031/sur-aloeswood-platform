import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_RESOURCE = "buddy_app_overview";
const MAX_ROWS = 100;
const SECRET_FIELD = /(password|secret|token|service.?role|api.?key|access.?key|refresh.?key)/i;
const PROTECTED_DOMAINS = [
  "money and wallet balances",
  "asset/tree ownership",
  "identity and authentication",
  "roles, permissions, and RLS",
  "production schema and destructive operations",
  "legal and KYC decisions",
];

loadLocalEnv();

const [command = "status", ...args] = process.argv.slice(2);

await main().catch((error) => {
  console.error(`TOH: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

async function main() {
  switch (command) {
    case "help":
      printHelp();
      return;
    case "status":
      printJson(statusReport());
      return;
    case "map":
      printJson(buildSystemMap());
      return;
    case "refresh":
      refreshSystemModel();
      return;
    case "workflows":
      printJson(loadTohData("workflows.json"));
      return;
    case "trace":
      traceWorkflow(args[0]);
      return;
    case "invariants":
      printJson(invariantReport());
      return;
    case "incidents":
      printJson(loadTohData("incidents.json"));
      return;
    case "gate":
      printJson(evaluateGate(args));
      return;
    case "audit":
      printJson(capabilityAudit());
      return;
    case "reconcile":
      printJson(reconcileLocalModel());
      return;
    case "health":
      printJson(localHealth());
      return;
    case "snapshot":
      printJson(createSnapshot(args[0]));
      return;
    case "compare":
      printJson(compareSnapshots(args[0], args[1]));
      return;
    case "impact":
      printJson(changeImpact(args[0]));
      return;
    case "decay":
      printJson(confidenceDecay());
      return;
    case "incident:add":
      printJson(appendIncident(args));
      return;
    case "proof":
      printJson(proofOfDone());
      return;
    case "selftest":
      selfTest();
      return;
    case "read":
      await readDatabase(args[0] || DEFAULT_RESOURCE, args[1] || "25");
      return;
    case "check":
      await checkDatabase(args[0] || DEFAULT_RESOURCE);
      return;
    case "verify":
      verifyLocal();
      return;
    default:
      throw new Error(`Unknown command: ${command}. Run npm.cmd run toh -- help`);
  }
}

function refreshSystemModel() {
  const outputDirectory = resolve(ROOT, "toh", "generated");
  const output = resolve(outputDirectory, "system-model.json");
  mkdirSync(outputDirectory, { recursive: true });
  const model = {
    ...buildSystemMap(),
    controlPlane: loadTohData("control-plane.json"),
    workflowInventory: loadTohData("workflows.json"),
    invariantInventory: invariantReport(),
    incidentMemory: loadTohData("incidents.json"),
    capabilityAudit: capabilityAudit(),
  };
  writeFileSync(output, `${JSON.stringify(model, null, 2)}\n`, "utf8");
  printJson({ assistant: "TOH", action: "LOCAL_MODEL_REFRESH", output: toRepoPath(output), liveSystemsTouched: false });
}

function traceWorkflow(workflowId) {
  if (!workflowId) throw new Error("Missing workflow id. Run npm.cmd run toh -- workflows");
  const workflow = loadTohData("workflows.json").workflows.find((entry) => entry.id === workflowId);
  if (!workflow) throw new Error(`Unknown workflow: ${workflowId}`);
  const evidence = workflow.evidence.map((path) => ({ path, exists: existsSync(resolve(ROOT, path)) }));
  const sourceProven = evidence.every((entry) => entry.exists);
  printJson({
    assistant: "TOH",
    workflow: workflow.id,
    actors: workflow.actors,
    protectedDomains: workflow.protectedDomains,
    sourceEvidence: evidence,
    expected: workflow.expectedSteps.map((step, index) => ({ order: index + 1, step })),
    actual: workflow.expectedSteps.map((step, index) => ({
      order: index + 1,
      step,
      state: index === 0 && sourceProven ? "SOURCE_PRESENT" : "UNPROVEN_AT_RUNTIME",
    })),
    lastProvenWorkingStep: sourceProven ? "source files are present" : "NONE",
    firstBrokenOrUnprovenStep: sourceProven ? workflow.expectedSteps[0] : "source evidence",
    conclusion: "HOLD",
    confidence: sourceProven ? "SOURCE_ONLY" : "UNKNOWN",
    proofLimit: "A source file is not runtime, database, role, browser, invariant, or deployment proof.",
  });
}

function invariantReport() {
  const inventory = loadTohData("invariants.json");
  const latest = readGenerated("invariant-latest.json");
  const boundedChecks = latest?.decision === "PASS_BOUNDED_VIEW_ONLY" ? Object.keys(latest.invariants || {}).length : 0;
  return {
    ...inventory,
    latestBoundedEvidence: latest,
    summary: {
      total: inventory.invariants.length,
      machineCheckedNow: inventory.invariants.filter((item) => item.runtimeCheck === "LOCAL_MODEL_ONLY").length,
      liveChecksExecuted: boundedChecks,
      status: latest?.decision || "HOLD",
      reason: latest
        ? "Only configured bounded view invariants were checked; protected workflow invariants remain unproven."
        : "Live invariant views and owner-approved rules are not yet available.",
    },
  };
}

function evaluateGate(args) {
  const [actionClass = "UNKNOWN", risk = "UNKNOWN", reversible = "false", idempotent = "false", testAvailable = "false", rootCause = "UNKNOWN"] = args;
  const control = loadTohData("control-plane.json");
  const normalizedDomain = actionClass.toLowerCase();
  const isObserve = normalizedDomain === "observe" || normalizedDomain === "read" || normalizedDomain === "diagnose";
  const protectedDomain = control.protectedDomains.includes(normalizedDomain);
  const checks = {
    writeActionsNotFrozen: !control.authority.writeActionsFrozen,
    authorityAllowsExecution: control.authority.currentLevel >= 3,
    protectedDomain: !protectedDomain,
    lowRisk: risk.toLowerCase() === "low",
    reversible: reversible === "true",
    idempotent: idempotent === "true",
    testAvailable: testAvailable === "true",
    rootCauseConfirmed: rootCause.toLowerCase() === "confirmed",
  };
  let decision = "BLOCK";
  if (isObserve) decision = "PASS";
  else if (protectedDomain) decision = "APPROVAL_REQUIRED";
  else if (control.authority.writeActionsFrozen || control.authority.currentLevel < 3) decision = "BLOCK";
  else if (Object.values(checks).every(Boolean)) decision = "PASS";
  else decision = "HOLD";

  return {
    assistant: "TOH",
    actionClass,
    decision,
    authorityLevel: control.authority.currentLevel,
    writeActionsFrozen: control.authority.writeActionsFrozen,
    checks,
    note: decision === "PASS" && isObserve ? "Read/diagnostic action only; this is not mutation authority." : "AI reasoning never bypasses deterministic authority.",
  };
}

function capabilityAudit() {
  return {
    generatedAt: new Date().toISOString(),
    capabilities: [
      capability("application discovery", "IMPLEMENTED", "TOH_CURRENT_SYSTEM_DISCOVERY.md and local map"),
      capability("regeneratable living system model", "IMPLEMENTED", "toh refresh"),
      capability("workflow inventory and expected-vs-actual trace", "IMPLEMENTED_LOCAL_ONLY", "toh workflows / trace"),
      capability("knowledge provenance", "IMPLEMENTED_LOCAL_ONLY", "discovery and control-plane evidence labels"),
      capability("deterministic authority gate and kill switch", "IMPLEMENTED", "toh gate and control-plane"),
      capability("invariant catalog", "IMPLEMENTED_LOCAL_ONLY", "runtime checks mostly not implemented"),
      capability("incident memory", "IMPLEMENTED_LOCAL_ONLY", "structured historical incidents"),
      capability("bounded RLS database read", "IMPLEMENTED", "allowlisted buddy_ resources"),
      capability("local proof commands", "IMPLEMENTED", "lint/build verifier and proof limits"),
      capability("owner blueprint", "BLOCKED_BY_OWNER_TRUTH", "authoritative product/business/security decisions missing"),
      capability(
        "LLM runtime",
        process.env.OPENAI_API_KEY ? "CONFIGURED" : "IMPLEMENTED_CONFIGURATION_REQUIRED",
        "/admin/toh and /api/toh/chat use the OpenAI Responses API without tools; requires server-only OPENAI_API_KEY",
      ),
      capability("live monitoring and reconciliation", "NOT_IMPLEMENTED", "no authorized health views or scheduler"),
      capability("safe execution", "FROZEN", "authority level 0"),
      capability("autonomous repair", "FROZEN", "write kill switch"),
      capability("production proof of done", "NOT_PROVEN", "deployment and live workflow evidence unavailable"),
    ],
  };
}

function capability(name, status, evidence) {
  return { name, status, evidence };
}

function reconcileLocalModel() {
  const system = buildSystemMap();
  const workflowData = loadTohData("workflows.json");
  const referencedEvidence = workflowData.workflows.flatMap((workflow) =>
    workflow.evidence.map((path) => ({ workflow: workflow.id, path, exists: existsSync(resolve(ROOT, path)) })),
  );
  const sqlText = system.database.localSqlFiles.map((path) => safeRead(resolve(ROOT, path))).join("\n");
  const rpcDefinitions = system.backend.rpcReferences.map((rpc) => ({
    rpc,
    referencedByCode: true,
    localDefinitionFound: new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+(?:public\\.)?${escapeRegex(rpc)}\\b`, "i").test(sqlText),
  }));
  const findings = [
    ...referencedEvidence.filter((item) => !item.exists).map((item) => ({ severity: "HIGH", type: "MISSING_WORKFLOW_EVIDENCE", ...item })),
    ...rpcDefinitions.filter((item) => !item.localDefinitionFound).map((item) => ({ severity: "HIGH", type: "RPC_DEFINITION_NOT_IN_REPOSITORY", rpc: item.rpc })),
  ];
  return {
    assistant: "TOH",
    scope: "local source reconciliation",
    checkedAt: new Date().toISOString(),
    workflowEvidence: referencedEvidence,
    rpcAlignment: rpcDefinitions,
    findingCount: findings.length,
    findings,
    decision: findings.length ? "HOLD" : "PASS_LOCAL_ONLY",
    proofLimit: "This does not inspect the live Supabase schema or deployment.",
  };
}

function localHealth() {
  const system = buildSystemMap();
  const reconciliation = reconcileLocalModel();
  const control = loadTohData("control-plane.json");
  const checks = [
    healthCheck("discovery-document", existsSync(resolve(ROOT, "TOH_CURRENT_SYSTEM_DISCOVERY.md")), "TOH_CURRENT_SYSTEM_DISCOVERY.md"),
    healthCheck("owner-blueprint", ownerBlueprintReady(), "TOH_OWNER_BLUEPRINT.md remains owner-controlled"),
    healthCheck("write-kill-switch", control.authority.writeActionsFrozen === true, "must remain true at authority level 0"),
    healthCheck("database-reader-credentials", Boolean(readerEmail() && readerPassword()), "configuration only; no connection attempted"),
    healthCheck("workflow-evidence-files", reconciliation.workflowEvidence.every((item) => item.exists), "local source files only"),
    healthCheck("clean-worktree", system.source.worktree === "CLEAN", "uncommitted work can be lost or omitted from deployment"),
    healthCheck("automated-toh-tests", hasTestSuite(), "test files present; use toh:test for execution evidence"),
  ];
  return {
    assistant: "TOH",
    scope: "local configuration and source health",
    status: checks.every((check) => check.passed) ? "HEALTHY_LOCAL_ONLY" : "ATTENTION",
    checks,
    reconciliationFindingCount: reconciliation.findingCount,
    liveDatabaseChecked: false,
    deploymentChecked: false,
    proofLimit: "Health is not production availability or workflow correctness.",
  };
}

function createSnapshot(label) {
  const safeLabel = normalizeLabel(label);
  const excluded = [resolve(ROOT, ".git"), resolve(ROOT, ".next"), resolve(ROOT, "node_modules"), resolve(ROOT, "toh", "generated")];
  const files = walk(ROOT).filter((file) =>
    !excluded.some((directory) => file.startsWith(directory)) && !file.endsWith(".zip") && !file.endsWith(".env.local"),
  );
  const snapshot = {
    assistant: "TOH",
    label: safeLabel,
    capturedAt: new Date().toISOString(),
    source: gitIdentity(),
    files: Object.fromEntries(files.map((file) => [toRepoPath(file), hashFile(file)]).sort(([a], [b]) => a.localeCompare(b))),
    liveSystemsTouched: false,
  };
  writeGenerated(`snapshots/${safeLabel}.json`, snapshot);
  return { ...snapshot, files: { count: files.length }, output: `toh/generated/snapshots/${safeLabel}.json` };
}

function compareSnapshots(beforeLabel, afterLabel) {
  const before = readSnapshot(beforeLabel);
  const after = readSnapshot(afterLabel);
  const paths = new Set([...Object.keys(before.files), ...Object.keys(after.files)]);
  const difference = { added: [], removed: [], changed: [] };
  for (const path of [...paths].sort()) {
    if (!(path in before.files)) difference.added.push(path);
    else if (!(path in after.files)) difference.removed.push(path);
    else if (before.files[path] !== after.files[path]) difference.changed.push(path);
  }
  return {
    assistant: "TOH",
    before: { label: before.label, capturedAt: before.capturedAt, headCommit: before.source.headCommit },
    after: { label: after.label, capturedAt: after.capturedAt, headCommit: after.source.headCommit },
    difference,
    equal: Object.values(difference).every((items) => items.length === 0),
    proofLimit: "File equality does not prove runtime, database, role, browser, or deployment equality.",
  };
}

function changeImpact(requestedPath) {
  if (!requestedPath) throw new Error("Missing repository path. Example: npm.cmd run toh -- impact app/investor/wallet/page.tsx");
  const target = resolve(ROOT, requestedPath);
  if (!target.startsWith(ROOT) || !existsSync(target) || statSync(target).isDirectory()) throw new Error(`Invalid file path: ${requestedPath}`);
  const repoPath = toRepoPath(target);
  const stem = repoPath.replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, "");
  const alias = `@/${stem}`;
  const basename = stem.split("/").at(-1);
  const references = walk(resolve(ROOT, "app")).filter((file) => {
    if (!/\.(ts|tsx)$/.test(file) || file === target) return false;
    const source = safeRead(file);
    return source.includes(alias) || Boolean(basename && source.includes(`/${basename}`));
  }).map(toRepoPath);
  const domains = inferProtectedDomain(repoPath, safeRead(target));
  return {
    assistant: "TOH",
    target: repoPath,
    directReferences: [...new Set(references)].sort(),
    inferredProtectedDomains: domains,
    risk: domains.length ? "HIGH" : references.length > 3 ? "MEDIUM" : "LOW_OR_UNKNOWN",
    requiredChecks: ["source review", "lint", "build", "targeted test", ...(domains.length ? ["owner approval", "database/role/invariant verification", "rollback plan"] : [])],
    confidence: references.length ? "CODE_DERIVED" : "LIMITED_STATIC_ANALYSIS",
    proofLimit: "Dynamic references, database dependencies, and deployed consumers may not be visible to static text analysis.",
  };
}

function confidenceDecay() {
  const model = readGenerated("system-model.json");
  const current = gitIdentity();
  if (!model) return { assistant: "TOH", status: "STALE", reasons: ["No generated system model"], action: "Run toh refresh" };
  const reasons = [];
  if (model.source?.headCommit !== current.headCommit) reasons.push("Git HEAD changed after model generation");
  if (current.worktree === "DIRTY") reasons.push("Worktree contains uncommitted changes");
  const ageMs = Date.now() - Date.parse(model.generatedAt);
  if (!Number.isFinite(ageMs) || ageMs > 86400000) reasons.push("System model is older than 24 hours");
  return {
    assistant: "TOH",
    status: reasons.length ? "DECAYED" : "CURRENT_LOCAL_ONLY",
    generatedAt: model.generatedAt,
    currentHead: current.headCommit,
    reasons,
    action: reasons.length ? "Run toh refresh and reverify affected evidence" : "None for local source",
    liveDeploymentConfidence: "UNKNOWN",
  };
}

function appendIncident(args) {
  const [workflow, confidence, symptom, rootCause] = args;
  if (![workflow, confidence, symptom, rootCause].every(Boolean)) {
    throw new Error('Usage: npm.cmd run toh -- incident:add <workflow> <confidence> "<symptom>" "<root-cause>"');
  }
  const allowed = ["CONFIRMED", "HIGH_CONFIDENCE", "LIKELY", "UNKNOWN", "CONTRADICTORY"];
  if (!allowed.includes(confidence)) throw new Error(`Invalid confidence. Use: ${allowed.join(", ")}`);
  const data = loadTohData("incidents.json");
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const incident = {
    id: `INC-${date}-${String(data.incidents.length + 1).padStart(3, "0")}`,
    symptom: symptom.slice(0, 500),
    workflow: workflow.slice(0, 100),
    rootCause: rootCause.slice(0, 1000),
    confidence,
    fix: "UNRESOLVED",
    result: "OPEN",
    preventionRule: "PENDING_ROOT_CAUSE_VERIFICATION",
    provenance: "OWNER_DEFINED",
    createdAt: new Date().toISOString(),
  };
  data.incidents.push(incident);
  atomicWrite(resolve(ROOT, "toh", "incidents.json"), data);
  return { assistant: "TOH", action: "LOCAL_INCIDENT_RECORDED", incident, liveSystemsTouched: false };
}

function proofOfDone() {
  const verification = readGenerated("verification-latest.json");
  const tests = readGenerated("tests-latest.json");
  const browserEvidence = readGenerated("browser-latest.json");
  const deploymentEvidence = readGenerated("deployment-latest.json");
  const source = gitIdentity();
  const currentSourceDeployed = deploymentEvidence?.latestProductionDeployment?.state === "success"
    && deploymentEvidence.latestProductionDeployment.sha === source.headCommit
    && source.worktree === "CLEAN";
  const gates = {
    SOURCE: true,
    BUILD: verification?.passed === true && verification.results?.some((item) => item.check === "build" && item.passed),
    TEST: tests?.passed === true,
    DATABASE: false,
    ROLE: false,
    BROWSER: browserEvidence?.passed === true,
    INVARIANT: invariantReport().summary.liveChecksExecuted > 0,
    REGRESSION: tests?.passed === true,
    DEPLOYMENT: currentSourceDeployed,
  };
  const missing = Object.entries(gates).filter(([, passed]) => !passed).map(([name]) => name);
  return {
    assistant: "TOH",
    decision: missing.length ? "NOT_PROVEN_COMPLETE" : "PROVEN_COMPLETE",
    gates,
    missing,
    localHealth: localHealth().status,
    deploymentEvidence: {
      productionObserved: deploymentEvidence?.latestProductionDeployment?.state === "success",
      deployedCommit: deploymentEvidence?.latestProductionDeployment?.sha || "UNKNOWN",
      currentHead: source.headCommit,
      worktree: source.worktree,
      currentWorktreeDeployed: currentSourceDeployed,
    },
    note: missing.length ? "Do not say DONE for the production application." : "All configured evidence gates passed.",
  };
}

function selfTest() {
  const started = Date.now();
  const result = spawnSync(process.execPath, ["--test", "tests/toh.test.mjs", "tests/security-contract.test.mjs"], { cwd: ROOT, encoding: "utf8", shell: false });
  const report = {
    assistant: "TOH",
    generatedAt: new Date().toISOString(),
    suite: "TOH and security contracts",
    passed: result.status === 0,
    exitCode: result.status,
    durationMs: Date.now() - started,
    proofLimit: "These tests cover the TOH control plane and selected source security contracts, not live workflows.",
    outputTail: `${result.stdout || ""}\n${result.stderr || ""}`.trim().split(/\r?\n/).slice(-40),
  };
  writeGenerated("tests-latest.json", report);
  printJson(report);
  if (!report.passed) process.exitCode = 1;
}

function readSnapshot(label) {
  const safeLabel = normalizeLabel(label);
  const path = resolve(ROOT, "toh", "generated", "snapshots", `${safeLabel}.json`);
  if (!existsSync(path)) throw new Error(`Snapshot not found: ${safeLabel}`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function normalizeLabel(label) {
  if (!label || !/^[a-z0-9][a-z0-9_-]{0,49}$/i.test(label)) throw new Error("Snapshot label must be 1-50 letters, numbers, hyphens, or underscores.");
  return label;
}

function hashFile(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function inferProtectedDomain(path, source) {
  const text = `${path}\n${source}`.toLowerCase();
  const patterns = {
    financial: /(wallet|cashin|withdraw|payment|price|revenue|transaction|amount)/,
    ownership: /(tree_registry|ownership|owner_id|assigned.tree|recovery)/,
    identity: /(profile|email|kyc|identity)/,
    authentication: /(auth\.|login|password|session)/,
    permissions: /(role|admin|rls|policy|permission)/,
    legal: /(legal|certificate|agreement|termination)/,
  };
  return Object.entries(patterns).flatMap(([domain, pattern]) => pattern.test(text) ? [domain] : []);
}

function writeGenerated(filename, value) {
  const path = resolve(ROOT, "toh", "generated", filename);
  atomicWrite(path, value);
}

function readGenerated(filename) {
  const path = resolve(ROOT, "toh", "generated", filename);
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
}

function atomicWrite(path, value) {
  mkdirSync(resolve(path, ".."), { recursive: true });
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(temporary, path);
}

function ownerBlueprintReady() {
  const file = resolve(ROOT, "TOH_OWNER_BLUEPRINT.md");
  if (!existsSync(file)) return false;
  const content = safeRead(file);
  return !content.includes("OWNER INPUT REQUIRED");
}

function healthCheck(id, passed, evidence) {
  return { id, passed, evidence };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function loadTohData(filename) {
  return JSON.parse(readFileSync(resolve(ROOT, "toh", filename), "utf8"));
}

function statusReport() {
  const configuredResources = getAllowedResources();
  return {
    assistant: "TOH",
    application: "sur-aloeswood-platform (owner-approved product name unknown)",
    mode: "read-only",
    authorityLevel: 0,
    authorityLabel: "OBSERVE",
    killSwitch: "WRITE_ACTIONS_FROZEN",
    liveMutationAvailable: false,
    llmRuntimeAvailable: Boolean(process.env.OPENAI_API_KEY),
    databaseGateway: {
      credentials: "anon key with RLS enforcement",
      authenticatedReaderConfigured: Boolean(readerEmail() && readerPassword()),
      allowedResources: configuredResources,
      maxRows: MAX_ROWS,
      connected: false,
      note: "Status validates local configuration only and does not query Supabase.",
    },
    protectedDomains: PROTECTED_DOMAINS,
    discoveryDocument: existsSync(resolve(ROOT, "TOH_CURRENT_SYSTEM_DISCOVERY.md")),
  };
}

function buildSystemMap() {
  const appRoot = resolve(ROOT, "app");
  const files = walk(appRoot);
  const pages = files.filter((file) => /(^|\\|\/)page\.tsx?$/.test(file));
  const layouts = files.filter((file) => /(^|\\|\/)layout\.tsx?$/.test(file));
  const apiRoutes = files.filter((file) => /(^|\\|\/)route\.ts$/.test(file));
  const sourceFiles = files.filter((file) => /\.(ts|tsx)$/.test(file));
  const rpcNames = new Set();
  const roles = new Set();

  for (const file of sourceFiles) {
    const content = safeRead(file);
    for (const match of content.matchAll(/\.rpc\(\s*["'`]([^"'`]+)["'`]/g)) rpcNames.add(match[1]);
    for (const match of content.matchAll(/["'`](SUPER_ADMIN|ADMIN|STAFF|COPLANTER|INVESTOR|FARMER|GARDENER|CARETAKER)["'`]/g)) {
      roles.add(match[1]);
    }
  }

  const sqlFiles = existsSync(resolve(ROOT, "database"))
    ? walk(resolve(ROOT, "database")).filter((file) => file.endsWith(".sql"))
    : [];

  return {
    assistant: "TOH",
    generatedAt: new Date().toISOString(),
    evidence: "local source only",
    classification: "CODE-PROVEN unless marked UNKNOWN",
    source: gitIdentity(),
    architecture: {
      framework: packageInfo().dependencies?.next || "UNKNOWN",
      react: packageInfo().dependencies?.react || "UNKNOWN",
      database: "Supabase Postgres (live schema unverified)",
      auth: "Supabase Auth (live behavior unverified)",
      hosting: "Vercel implied; project and deployment UNKNOWN",
    },
    frontend: {
      pages: pages.map(toRoute).sort(),
      layouts: layouts.map(toRepoPath).sort(),
      pageCount: pages.length,
    },
    backend: {
      apiRoutes: apiRoutes.map(toApiRoute).sort(),
      rpcReferences: [...rpcNames].sort(),
      backgroundJobs: "NOT IMPLEMENTED / not found",
    },
    database: {
      localSqlFiles: sqlFiles.map(toRepoPath).sort(),
      liveSchema: "UNKNOWN",
    },
    roles: [...roles].sort(),
    operations: {
      automatedTests: hasTestSuite() ? "PRESENT BUT UNVERIFIED" : "NOT IMPLEMENTED / not found",
      monitoring: "NOT IMPLEMENTED / not found",
      incidentMemory: "NOT IMPLEMENTED / not found",
    },
    security: {
      liveWrites: "BLOCKED BY TOH",
      protectedDomains: PROTECTED_DOMAINS,
      environmentNames: envNames(),
      environmentValuesExposed: false,
    },
    unknowns: [
      "owner-approved product name and blueprint",
      "production URL and deployed commit",
      "staging environment",
      "live schema, policies, grants, functions, and migration alignment",
      "complete runtime workflow health",
    ],
  };
}

async function readDatabase(resource, requestedLimit) {
  const rows = await queryResource(resource, requestedLimit);
  printJson({ assistant: "TOH", mode: "read-only", resource, rowCount: rows.length, rows: redact(rows) });
}

async function queryResource(resource, requestedLimit) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const email = readerEmail();
  const password = readerPassword();
  const allowed = new Set(getAllowedResources());

  if (!url || !anonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.");
  if (!email || !password) throw new Error("Missing TOH_READER_EMAIL/TOH_READER_PASSWORD (or legacy BUDDY credentials).");
  if (!resource.startsWith("buddy_") || !allowed.has(resource)) throw new Error(`Resource is not allowlisted: ${resource}`);

  const limit = Math.min(Math.max(Number.parseInt(requestedLimit, 10) || 25, 1), MAX_ROWS);
  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });

  try {
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) throw new Error(`Authentication failed: ${signInError.message}`);
    const { data, error } = await supabase.from(resource).select("*").limit(limit);
    if (error) throw new Error(`Read failed (${error.code || "unknown"}): ${error.message}`);
    return data || [];
  } finally {
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  }
}

async function checkDatabase(resource) {
  const rows = await queryResource(resource, String(MAX_ROWS));
  const duplicateIds = duplicates(rows.map((row) => row.id).filter(Boolean));
  const duplicateTreeCodes = duplicates(rows.map((row) => row.tree_code).filter(Boolean));
  const missingEssentialFields = rows.flatMap((row, index) => {
    const missing = ["id", "tree_code", "status"].filter((field) => !row[field]);
    return missing.length ? [{ row: index + 1, id: row.id || null, missing }] : [];
  });
  const findings = [
    ...duplicateIds.map((value) => ({ severity: "CRITICAL", invariant: "TREE-ID-UNIQUE", value })),
    ...duplicateTreeCodes.map((value) => ({ severity: "CRITICAL", invariant: "TREE-CODE-UNIQUE", value })),
    ...missingEssentialFields.map((item) => ({ severity: "HIGH", invariant: "TREE-ESSENTIAL-FIELDS", ...item })),
  ];
  const report = {
    assistant: "TOH",
    generatedAt: new Date().toISOString(),
    mode: "read-only",
    resource,
    rowsChecked: rows.length,
    maxRows: MAX_ROWS,
    invariants: {
      uniqueId: duplicateIds.length === 0,
      uniqueTreeCode: duplicateTreeCodes.length === 0,
      essentialFieldsPresent: missingEssentialFields.length === 0,
    },
    findingCount: findings.length,
    findings,
    decision: findings.length ? "VIOLATION_FOUND" : "PASS_BOUNDED_VIEW_ONLY",
    liveMutationPerformed: false,
    proofLimit: "Checks only the returned allowlisted rows. It does not prove unreturned rows, ownership, wallet, roles, RLS, RPCs, or workflow completeness.",
  };
  writeGenerated("invariant-latest.json", report);
  printJson(report);
}

function duplicates(values) {
  const seen = new Set();
  const duplicate = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicate.add(value);
    seen.add(value);
  }
  return [...duplicate].sort();
}

function verifyLocal() {
  const checks = [
    ["lint", ["run", "lint"]],
    ["build", ["run", "build"]],
  ];
  const results = [];

  for (const [name, npmArgs] of checks) {
    const started = Date.now();
    const executable = process.platform === "win32" ? "cmd.exe" : "npm";
    const commandArgs = process.platform === "win32" ? ["/d", "/s", "/c", "npm.cmd", ...npmArgs] : npmArgs;
    const result = spawnSync(executable, commandArgs, { cwd: ROOT, encoding: "utf8", shell: false });
    results.push({
      check: name,
      passed: result.status === 0,
      exitCode: result.status,
      durationMs: Date.now() - started,
      executionError: result.error?.message || null,
      outputTail: redactText(`${result.stdout || ""}\n${result.stderr || ""}`).trim().split(/\r?\n/).slice(-20),
    });
    if (result.status !== 0) break;
  }

  const passed = results.length === checks.length && results.every((result) => result.passed);
  const report = {
    assistant: "TOH",
    generatedAt: new Date().toISOString(),
    verificationScope: "local lint and production build",
    passed,
    proofLimit: "Does not prove live database, roles, browser workflows, or deployment.",
    results,
  };
  writeGenerated("verification-latest.json", report);
  printJson(report);
  if (!passed) process.exitCode = 1;
}

function gitIdentity() {
  const run = (...args) => {
    try {
      return execFileSync("git", ["-c", `safe.directory=${ROOT.replaceAll("\\", "/")}`, "-C", ROOT, ...args], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      return "UNKNOWN";
    }
  };
  const status = run("status", "--porcelain");
  return {
    repository: run("remote", "get-url", "origin"),
    branch: run("branch", "--show-current"),
    headCommit: run("rev-parse", "HEAD"),
    worktree: status === "UNKNOWN" ? "UNKNOWN" : status ? "DIRTY" : "CLEAN",
  };
}

function loadLocalEnv() {
  const envFile = resolve(ROOT, ".env.local");
  if (!existsSync(envFile)) return;
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const name = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[name]) process.env[name] = value;
  }
}

function packageInfo() {
  return JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
}

function readerEmail() {
  return process.env.TOH_READER_EMAIL?.trim() || process.env.BUDDY_EMAIL?.trim();
}

function readerPassword() {
  return process.env.TOH_READER_PASSWORD || process.env.BUDDY_PASSWORD;
}

function getAllowedResources() {
  return (process.env.TOH_READ_RESOURCES || process.env.BUDDY_READ_RESOURCES || DEFAULT_RESOURCE)
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.startsWith("buddy_"));
}

function walk(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") return [];
    return entry.isDirectory() ? walk(path) : statSync(path).isFile() ? [path] : [];
  });
}

function safeRead(file) {
  try { return readFileSync(file, "utf8"); } catch { return ""; }
}

function toRepoPath(file) {
  return relative(ROOT, file).replaceAll("\\", "/");
}

function toRoute(file) {
  let route = toRepoPath(file).replace(/^app/, "").replace(/\/page\.tsx?$/, "");
  route = route.replace(/\/\([^/]+\)/g, "");
  return route || "/";
}

function toApiRoute(file) {
  return toRepoPath(file).replace(/^app/, "").replace(/\/route\.ts$/, "") || "/";
}

function hasTestSuite() {
  return walk(ROOT).some((file) =>
    /(^|\\|\/)__tests__(\\|\/)|\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file) && !file.includes("node_modules"),
  );
}

function envNames() {
  const envFile = resolve(ROOT, ".env.local");
  if (!existsSync(envFile)) return [];
  return readFileSync(envFile, "utf8").split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    return match ? [match[1]] : [];
  });
}

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, SECRET_FIELD.test(key) ? "[REDACTED]" : redact(entry)]));
}

function redactText(value) {
  return value.replace(/(password|secret|token|service.?role|api.?key)\s*[:=]\s*\S+/gi, "$1=[REDACTED]");
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function printHelp() {
  console.log(`TOH — Direk Tony application intelligence (read-only v1)

Commands:
  npm.cmd run toh -- status
  npm.cmd run toh -- map
  npm.cmd run toh -- refresh
  npm.cmd run toh -- workflows
  npm.cmd run toh -- trace seedling-purchase
  npm.cmd run toh -- invariants
  npm.cmd run toh -- incidents
  npm.cmd run toh -- gate financial high false false false unknown
  npm.cmd run toh -- audit
  npm.cmd run toh -- reconcile
  npm.cmd run toh -- health
  npm.cmd run toh -- snapshot before-change
  npm.cmd run toh -- compare before-change after-change
  npm.cmd run toh -- impact app/investor/wallet/page.tsx
  npm.cmd run toh -- decay
  npm.cmd run toh -- incident:add wallet CONFIRMED "symptom" "root cause"
  npm.cmd run toh -- proof
  npm.cmd run toh -- selftest
  npm.cmd run toh -- read buddy_app_overview 25
  npm.cmd run toh -- check buddy_app_overview
  npm.cmd run toh -- verify

Safety:
  TOH v1 has no insert, update, upsert, delete, RPC, storage-write,
  auth-admin, deployment, or production-schema mutation command.
  Database reads require an authenticated reader, RLS, a buddy_ prefix,
  an explicit allowlist, a 100-row maximum, and secret-field redaction.`);
}
