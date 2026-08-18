# TOH Operations

## Normal read-only cycle

```powershell
npm.cmd run toh -- status
npm.cmd run toh -- refresh
npm.cmd run toh -- health
npm.cmd run toh -- reconcile
npm.cmd run toh:test
npm.cmd run toh -- verify
npm.cmd run toh -- proof
```

`status`, `map`, `health`, `reconcile`, and `audit` do not connect to Supabase. `refresh` writes only the local generated model. Only the explicit `read` command contacts Supabase, and it can only select from configured `buddy_*` resources.

## Investigating a workflow

```powershell
npm.cmd run toh -- workflows
npm.cmd run toh -- trace seedling-purchase
npm.cmd run toh -- incidents
npm.cmd run toh -- invariants
```

The trace deliberately marks runtime steps unproven until database, role, browser, invariant, and deployment evidence exists.

## Deterministic gate

Arguments are:

`action-class risk reversible idempotent test-available root-cause`

```powershell
npm.cmd run toh -- gate observe low true true true confirmed
npm.cmd run toh -- gate financial high false false false unknown
```

Observation can pass. Protected changes require approval. With authority level 0 and `writeActionsFrozen: true`, no mutation can pass.

## Incident protocol

1. Preserve the exact symptom and timestamp.
2. Identify the workflow and affected role.
3. Run the workflow trace.
4. Gather runtime evidence without mutation.
5. Identify the last proven step and first broken/unproven step.
6. Record hypotheses and eliminate them with tests.
7. Do not call a symptom the root cause.
8. Gate the minimum proposed action.
9. For protected domains, wait for owner approval and a recovery plan.
10. Verify source, build, tests, database, role, browser, invariants, regression, and deployment as applicable.
11. Add a structured incident record and prevention rule.

## Proof language

TOH may say only what evidence proves:

- `SOURCE PRESENT` means code exists.
- `BUILD PASSED` means compilation/build passed.
- `TEST PASSED` means only the named tests passed.
- `READ OBSERVED` means the bounded read returned data at that time.
- `DEPLOYED AND VERIFIED` requires deployment identity plus runtime verification.
- `WORKFLOW COMPLETE` requires all expected downstream steps and visible results.

Never treat one of these as proof of all the others.

## Before/after and impact

```powershell
npm.cmd run toh -- snapshot before-change
npm.cmd run toh -- impact app/investor/wallet/page.tsx
# make an authorized local change
npm.cmd run toh -- snapshot after-change
npm.cmd run toh -- compare before-change after-change
npm.cmd run toh -- decay
```

Snapshots hash local source and exclude `.env.local`, generated output, dependencies, build output, Git internals, and archives. Static impact is conservative and does not replace live dependency evidence.
