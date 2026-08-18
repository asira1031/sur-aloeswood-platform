# TOH Implementation Status

**Application:** Direk Tony / `sur-aloeswood-platform` only
**Current authority:** Level 0 — Observe
**Production writes:** Frozen
**Last reviewed:** 2026-08-18

This matrix prevents “TOH is finished” from meaning more than the evidence proves.

| Spec area | Current implementation | Status | Evidence / remaining gate |
|---|---|---|---|
| Phase 0 identity | Local repo, branch, commit, framework, DB/auth type, roles, and unknowns recorded | Implemented locally | `TOH_CURRENT_SYSTEM_DISCOVERY.md`, `toh map` |
| Phase 1 full system read | Source routes/APIs/RPC references/SQL files mapped; live schema/runtime not read | Partial | Live evidence still unauthorized/unavailable |
| Phase 2 truth classification | Classification and provenance rules documented | Implemented locally | Discovery document |
| Phase 3 living system model | Regeneratable JSON model | Implemented locally | `toh refresh`, `toh/generated/system-model.json` |
| Phase 4 owner blueprint | Fill-up blueprint exists | Waiting for owner | `TOH_OWNER_BLUEPRINT.md` contains required owner inputs |
| Blueprint lock | Owner-dependent work is held when blueprint is incomplete | Implemented as policy/gate | `toh health`, control plane |
| Phase 5 LLM reasoning | Admin-only OpenAI Responses API route plus deterministic no-key fallback | Implemented; configuration required | Owner approved OpenAI on 2026-08-18; add server-only `OPENAI_API_KEY`; no tools exposed |
| Phase 6 anti-malfunction | Local reconciliation finds source/RPC drift | Partial | Live state checks and containment are not implemented |
| Phase 7 expected vs actual | Workflow trace emits expected steps and runtime-unproven boundary | Implemented locally | `toh trace <workflow>` |
| Phase 8 root cause | Incident protocol and confidence vocabulary documented | Partial | No runtime evidence collector or hypothesis executor |
| Phase 9 invariants | Structured invariant catalog with honest runtime status | Partial | Live read-only invariant views/checks are missing |
| Phase 10 logic gate | Deterministic gate evaluates protected domain and safety conditions | Implemented | `toh gate`; writes remain frozen |
| Phase 11 authority levels | Level 0 control plane and protected-domain handling | Implemented | `toh/control-plane.json` |
| Phase 12 durable workflow spine | Expected workflow definitions only | Not implemented in production | Would require approved schema/state-machine changes |
| Phase 13 idempotency | Required by gates/invariants | Partial policy only | Critical live functions/constraints are not fully present in repo |
| Phase 14 reconciliation | Local source/RPC reconciliation | Partial | Live database/workflow reconciliation missing |
| Phase 15 proactive monitoring | Manual local health command | Partial | Scheduler, live health views, telemetry, dedup alerts missing |
| Phase 16 incident commander | Runbook and structured memory | Partial | No automated detection/containment/affected-user analysis |
| Phase 17 safe builder | Existing engineering workflow plus authority gate | Partial | Owner blueprint and broader tests missing |
| Phase 18 intent-to-code | Blueprint template translates owner decisions into domains | Partial | Requires completed owner input |
| Phase 19 self-cleanup | Lint identifies debt | Partial | No dependency-aware cleanup engine |
| Phase 20 anti-patch | Root-cause rule in operating procedure | Policy implemented | Requires case-by-case evidence |
| Phase 21 complexity governor | Minimum-change rule documented in TOH specification | Policy only | No automated architecture metric |
| Phase 22 change impact | Protected domains/workflow actors modeled | Partial | Automated dependency graph is limited to local route/RPC evidence |
| Phase 23 before/after | Local secret-excluding source snapshots and comparison | Implemented locally | Runtime/database/deployment before-after still needs authorized evidence |
| Phase 24 test orchestration | TOH/security tests, lint/build verifier, and GitHub CI quality gate | Partial | App integration/role/E2E/database tests remain incomplete |
| Phase 25 synthetic users | None | Not implemented | Needs isolated staging and test accounts |
| Phase 26 failure simulation | None | Not implemented | Needs safe isolated environment |
| Phase 27 proof of done | Proof contract and proof-limit outputs | Implemented locally | Production proof still unavailable |
| Phase 28 incident memory | Three structured historical incidents | Implemented locally | Needs durable append/review workflow and version links |
| Phase 29 provenance | Evidence priority and labels | Implemented locally | Automated per-belief provenance is partial |
| Phase 30 confidence decay | Local model detects commit, dirty-worktree, and evidence-age decay | Implemented locally | Deployment/schema version comparison still unavailable |
| Phase 31 teacher mode | Plain-language docs, proof explanations, and `/admin/toh` interface | Implemented locally | Authenticated runtime verification still requires an active admin session |
| Phase 32 autonomy budget | Authority and protected-domain control plane | Implemented locally | Owner has not approved higher levels |
| Phase 33 two-key protection | Protected mutations cannot pass Level 0 | Partial | No production approval ledger or second human key |
| Phase 34 kill switch | `writeActionsFrozen: true` enforced by TOH gate and no write commands exist | Implemented | Tests verify protected writes cannot pass |
| Phase 35 Swiss-cheese defense | Multiple local layers: discovery, gate, tests, model, invariants, reconciliation, incidents | Partial | Database constraints, role tests, monitoring, recovery, and deployment proof incomplete |

## Current completion boundary

The local read-only TOH foundation is implemented and tested. A full production Technical Operating Intelligence is **not yet complete** because the following require external truth or explicit authority:

1. Completed and owner-confirmed blueprint.
2. Authoritative live Supabase schema/RLS/RPC evidence.
3. Vercel project/deployment identity and staging environment.
4. A server-only `OPENAI_API_KEY` in local/Vercel environment and an owner-controlled usage budget.
5. Approved production schema for workflow state, idempotency, incidents, invariants, audit, and approvals.
6. Isolated synthetic test users and a staging environment.
7. Monitoring/alert destination and incident ownership.

TOH must not invent these inputs or silently promote itself beyond Level 0.
