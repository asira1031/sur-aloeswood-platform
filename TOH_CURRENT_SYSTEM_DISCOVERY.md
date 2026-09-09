# TOH Current System Discovery

**Discovery date:** 2026-08-18 (Asia/Manila)
**Scope:** `direk tony` / `sur-aloeswood-platform` only
**TOH authority during discovery:** Level 0 — Observe
**Evidence boundary:** Local source code, Git metadata, local configuration structure, prior local build/lint/audit results, and owner-reported SQL execution. No live Supabase or Vercel inspection was performed.

## Evidence and classification rules

This report separates source evidence from assumptions. It uses these classifications:

- **CODE-PROVEN:** directly present in the inspected source or Git metadata.
- **PARTIALLY PROVEN:** some evidence exists, but the complete runtime workflow was not verified.
- **PRESENT BUT UNVERIFIED:** configuration or implementation exists but the live service/result was not inspected.
- **HARDCODED / STATIC:** fixed in source rather than established as owner-approved or database-derived truth.
- **UI ONLY:** visible interface exists without enough evidence of a complete backend workflow.
- **PLACEHOLDER:** intentionally incomplete or demonstration behavior.
- **BROKEN:** failure was reproduced or directly evidenced.
- **NOT IMPLEMENTED:** no implementation was found in the inspected repository.
- **UNKNOWN:** current evidence cannot support a conclusion.

Knowledge provenance labels used below are **OWNER_DEFINED**, **CODE_DERIVED**, **DATABASE_DERIVED**, **RUNTIME_OBSERVED**, **TEST_DERIVED**, **DOCUMENTATION_DERIVED**, and **AI_INFERRED**.

## 1. Application identity

| Item | Current truth | Classification | Provenance |
|---|---|---|---|
| Application name | Package name is `sur-aloeswood-platform`; owner folder name is `direk tony`. Final owner-approved product name is **UNKNOWN**. | CODE-PROVEN / UNKNOWN | CODE_DERIVED / OWNER_DEFINED |
| Purpose | Platform for agarwood/aloeswood co-planters or investors, farmers/caretakers, trees, maintenance, wallets, purchases, recovery, referrals, support, and administration. | PARTIALLY PROVEN | CODE_DERIVED |
| Isolation | This is a different client/application from “SUR Final Apps”; their code, data, rules, credentials, and memory must not be mixed. | CODE-PROVEN policy constraint | OWNER_DEFINED |
| Current local folder | `C:\Users\Lenovo\Desktop\projects\direk tony` | CODE-PROVEN | RUNTIME_OBSERVED |
| Current AI name/role | Buddy exists as a narrow read-only database CLI. TOH is specified but not yet implemented as an application runtime. | CODE-PROVEN / NOT IMPLEMENTED | CODE_DERIVED |

## 2. Source identity

| Item | Current truth | Classification | Provenance |
|---|---|---|---|
| Repository | `https://github.com/asira1031/sur-aloeswood-platform.git` | CODE-PROVEN | Git metadata |
| Branch | `master` | CODE-PROVEN | Git metadata |
| HEAD commit | `597f1c42d3a05c3b82b23ddd84309f2259fc368f` (local discovery baseline) | CODE-PROVEN | Git metadata |
| Worktree | Dirty: security, dependency, Buddy, and workflow hardening changes are uncommitted. | CODE-PROVEN | Git metadata |
| Source freshness versus GitHub | Local HEAD identity is known; whether the remote or a Vercel deployment has a newer commit is **UNKNOWN** in this discovery. | UNKNOWN | Evidence gap |
| Deployment commit | **UNKNOWN** | UNKNOWN | Evidence gap |

Known local modifications at discovery include admin authentication layout, registration APIs, HeyGen API, investor care/recovery flows, security headers, dependency files, and lint configuration. New local artifacts include Buddy documentation/reader, server security helper, and database security hardening SQL.

## 3. Architecture

| Layer | Current implementation | Classification |
|---|---|---|
| Web framework | Next.js 16.3.1 App Router | CODE-PROVEN |
| UI runtime | React 19.2.4, TypeScript 5, Tailwind CSS 4 | CODE-PROVEN |
| Backend | Next.js route handlers plus direct browser/server Supabase calls and database RPCs | CODE-PROVEN |
| Database | Supabase Postgres | CODE-PROVEN configuration; live state unverified |
| Authentication | Supabase Auth with profile-based application roles | CODE-PROVEN; live behavior partially proven |
| File storage | Supabase Storage buckets/policies for caretaker updates and farmer resumes | PRESENT BUT UNVERIFIED |
| Hosting | Vercel is documented/implied; exact project, deployment, and environment mapping are **UNKNOWN** | PRESENT BUT UNVERIFIED |
| State model | Primarily Supabase-backed records plus client state; no durable workflow engine found | CODE-PROVEN / NOT IMPLEMENTED |
| Background processing | No queue, worker, cron, or scheduled job implementation found | NOT IMPLEMENTED |

High-level dependency path:

`Browser → Next.js page/component → Supabase client or Next.js API → Supabase Auth/Postgres/RPC/Storage → UI result`

Some privileged API routes use a server-side service-role client. Exact environment availability and live authorization behavior are unverified.

## 4. Routes

### Public and authentication

`/`, `/login`, `/admin-login`, `/admin/login`, `/register`, `/farmer/register`, `/set-password`, `/session-expired`, `/unauthorized`, `/launch`, `/health`, `/test`, `/tree`, `/plantation`, `/harvest`, `/certificates`, `/legalities`.

### Co-planter/investor

`/investor`, `/investor/dashboard`, `/investor/profile`, `/investor/settings`, `/investor/wallet`, `/investor/my-trees`, `/investor/timeline`, `/investor/marketplace`, `/investor/care-services`, `/investor/recovery`, `/investor/referrals`, `/investor/notifications`, `/investor/support`.

### Farmer/caretaker

`/farmer`, `/farmer/dashboard`, `/farmer/dashboard/task`, `/farmer/profile`, `/farmer/assigned-trees`, `/farmer/growth-logs`, `/farmer/photo-updates`, `/farmer/gps`, `/farmer/reports`.

### Administration

`/admin`, `/admin/dashboard`, `/admin/coplanters`, `/admin/coplanters/[profileId]`, `/admin/gardener`, `/admin/purchases`, `/admin/withdrawals`, `/admin/treasury`, `/admin/finance-distribution`, `/admin/tree-registry`, `/admin/tree-maintenance`, `/admin/support`, `/admin/notifications`, `/admin/activity`, `/admin/audit`, `/admin/reports`, `/admin/legal`, `/admin/settings`.

### API routes

| Route | Intended responsibility | Classification |
|---|---|---|
| `/api/register/coplanter` | Co-planter registration | CODE-PROVEN; end-to-end unverified |
| `/api/farmer/register` | Farmer registration | CODE-PROVEN; end-to-end unverified |
| `/api/investor/buy-seedling` | Seedling purchase orchestration | CODE-PROVEN; live transaction unverified |
| `/api/admin/farmers` | Privileged farmer administration | CODE-PROVEN; live authorization unverified |
| `/api/admin/purchases/approve` | Privileged purchase approval | CODE-PROVEN; live transaction unverified |
| `/api/heygen/generate` | Authenticated admin video generation | PRESENT BUT UNVERIFIED |
| `/api/heygen/test` | HeyGen configuration/test surface | PRESENT BUT UNVERIFIED |

## 5. Roles

Role strings found in source include:

- `ADMIN`, `SUPER_ADMIN`, `STAFF`
- `COPLANTER`, with `INVESTOR` used as a related/legacy-facing name
- `FARMER`, `GARDENER`, `CARETAKER`

The exact canonical role enum, allowed transitions, account-approval process, and live population of every role are **UNKNOWN**. Role synonyms increase the chance of inconsistent authorization and should later be reconciled against the owner blueprint and live schema.

## 6. Frontend map

The frontend has separate layouts and navigation for admin, investor, and farmer areas. It includes forms and screens for registration/login, profiles, wallets, trees, purchases, maintenance, recovery, farmer work, photo/growth updates, finance, notifications, support, audit/activity, and legal/reporting views.

Observed characteristics:

- Role-specific page groups and layouts are **CODE-PROVEN**.
- Loading, error, empty, modal, form-validation, and responsive states exist inconsistently across individual pages; complete coverage is **UNKNOWN**.
- Several business actions are performed directly from client components through Supabase or RPC calls.
- `/health` and `/test` exist, but their names alone do not prove operational health checks or automated tests. Treat them as **UI ONLY / PRESENT BUT UNVERIFIED**.
- Some screens may contain static or demonstration data. Each must be verified individually before being treated as operational truth.
- No browser E2E evidence currently proves complete role journeys or mobile behavior.

## 7. Backend map

Backend behavior is distributed among Next.js API routes, Supabase clients/helpers, and database RPCs.

RPC names referenced by application code:

- `admin_tree_registry_records`
- `create_maintenance_order_with_wallet`
- `farmer_caretaker_assignment_tasks`
- `pay_maintenance_order_with_wallet`
- `purchase_seedling_with_wallet`
- `request_recovery_termination`
- `sur_admin_reject_cashin_by_email`
- `sur_admin_reject_withdrawal_by_email`
- `sur_admin_settle_withdrawal_by_email`
- `sur_admin_verify_cashin_by_email`
- `sur_request_withdrawal`
- `sur_submit_cashin_request`

Local security helpers provide bearer-token extraction, normalized roles, and an in-memory per-instance IP rate limiter. This limiter is useful but not distributed across Vercel instances and does not persist through restarts.

No conventional Next.js Server Actions, message queues, worker processes, webhook framework, retry orchestrator, or durable background-job subsystem was established by discovery.

## 8. Database map

Local SQL references or defines these important data areas:

- profiles and application roles
- wallets and wallet transactions
- cash-in and withdrawal requests
- seedling purchases
- tree registry and growth logs
- farms
- gardeners/caretakers and assignments
- maintenance orders
- notifications
- support chats, messages, and tickets
- revenue allocations
- storage objects/buckets for caretaker updates and farmer resumes

Local SQL files include `farms.sql`, `farm-workflow.sql`, `maintenance-orders.sql`, storage policy migrations, `production-rls-repair.sql`, and `security-hardening.sql`.

The hardening migration locally defines or references transactional/security functions including:

- `app_profile_sensitive_fields_unchanged`
- `create_maintenance_order_with_wallet`
- `pay_maintenance_order_with_wallet`
- `request_recovery_termination`

The owner reported successfully running the supplied hardening SQL. That makes application status **PARTIALLY PROVEN**, not independently database-proven. Exact live columns, constraints, indexes, triggers, functions, grants, policies, migration order, and schema version remain **UNKNOWN** until authorized read-only schema evidence is collected.

Buddy successfully returned a read-only aggregate of `total_trees: 18` through a `buddy_*` resource during prior owner-operated testing. This proves that the gateway could read that exposed result at that time; it does not prove the entire live schema or all workflows.

## 9. Security/RLS map

### Code/local-SQL evidence

- Supabase Auth is the identity provider.
- Browser access depends on the anon key and RLS.
- Privileged server routes can use a service-role credential.
- Admin client-side localStorage trust was removed from the local hardening changes.
- Registration was changed locally to avoid overwriting an existing user's password and to create pending/unconfirmed accounts.
- HeyGen generation now requires admin authentication, validates input/configuration, and applies local rate limiting.
- Security headers and a Content Security Policy are configured locally.
- Local SQL attempts to prevent profile privilege escalation, restrict wallet/transaction mutation, narrow notification inserts, and move financial/maintenance/recovery changes into transactional RPCs.

### Security truth status

- Live RLS policies and grants: **PRESENT BUT UNVERIFIED**.
- Service-role secret storage in Vercel: **UNKNOWN**.
- Buddy design: read-only allowlisted `buddy_*` views using a dedicated authenticated user, anon key, RLS, result limits, and output redaction — **CODE-PROVEN**.
- Buddy account password strength/rotation: previously exposed weak credential should be rotated — **KNOWN WEAKNESS**.
- No unrestricted live database or dashboard access was used for this discovery.

## 10. Workflow inventory

| Workflow | Current path | Status |
|---|---|---|
| Co-planter registration | Public form → registration API → Supabase Auth/profile → pending approval/UI | PARTIALLY PROVEN |
| Farmer registration | Farmer form → registration API → Supabase Auth/profile/resume storage → admin review | PARTIALLY PROVEN |
| Login/session routing | Supabase Auth → profile role → role layout/dashboard | PARTIALLY PROVEN |
| Seedling purchase | Investor UI/API → wallet/purchase RPC/data → admin approval → tree/financial effects | PARTIALLY PROVEN; full downstream chain unverified |
| Cash-in | Investor wallet → `sur_submit_cashin_request` → admin verification RPC → wallet/result | PARTIALLY PROVEN |
| Withdrawal | Investor wallet → request RPC → admin settle/reject RPC → wallet/result | PARTIALLY PROVEN |
| Maintenance order | Investor care services → transactional create/pay RPC → order/wallet transaction → admin/farmer handling | PARTIALLY PROVEN |
| Recovery/termination | Investor recovery → transactional recovery RPC → status/financial effects | PARTIALLY PROVEN |
| Farmer task execution | Assignment task RPC → dashboard task → growth/photo/status updates | PARTIALLY PROVEN |
| Tree monitoring | Tree registry/assignments → growth logs/photos/GPS/timeline → investor/admin views | PARTIALLY PROVEN |
| Support | Investor/admin support screens → chats/messages/tickets | PRESENT BUT UNVERIFIED |
| Notifications | Application events/admin UI → notification records → role UI | PRESENT BUT UNVERIFIED |
| HeyGen video | Admin request → authenticated API → HeyGen provider → returned video/status | PRESENT BUT UNVERIFIED |
| Buddy database read | CLI → Supabase Auth → allowlisted `buddy_*` view → redacted bounded output | CODE-PROVEN for tested overview read |

None of the critical workflows has a repository-proven durable workflow spine recording every completed/pending/failed step. A successful single API/RPC response must not yet be interpreted as complete end-to-end success.

## 11. Business rules

The following constants are **HARDCODED / STATIC** and **CODE_DERIVED**. They are not yet owner-approved blueprint truth:

| Rule | Value found in code |
|---|---:|
| Package price | ₱25,000 |
| Plantation allocation | ₱10,000 |
| Fintech allocation | ₱10,000 |
| Marketing/network allocation | ₱5,000 |
| Direct referral | ₱3,000 |
| Recovery | ₱2,000 |
| Withdrawal minimum | ₱25,000 |
| Withdrawal maximum | ₱50,000 |
| Annual maintenance | ₱1,500 for 4 years |
| Harvest split | 70/30 |
| Projected target | ₱450,000 |

The authoritative meaning, eligibility, timing, rounding, exceptions, approval requirements, and legal basis for these rules are **UNKNOWN** until the owner blueprint is created. Financial behavior is protected and must not be changed from these observations alone.

## 12. Existing tests

- No unit, integration, database, permission, role, browser E2E, responsive, or regression test suite was found: **NOT IMPLEMENTED**.
- `npm run build` previously passed locally after hardening: **TEST_DERIVED**, but it is compilation/build evidence only.
- `npm run lint` previously passed with 0 errors and 161 warnings: **TEST_DERIVED**, with significant remaining warning debt.
- `npm audit` previously reported 0 vulnerabilities after dependency updates: **TEST_DERIVED** and time-sensitive.
- `/test` and `/api/heygen/test` are not substitutes for automated tests.
- No deployed-browser, multi-role, or live-database verification has established end-to-end correctness.

## 13. Existing monitoring

- Persistent application telemetry: **NOT IMPLEMENTED / not found**.
- Error tracking provider: **NOT IMPLEMENTED / not found**.
- Scheduled health/invariant/reconciliation checks: **NOT IMPLEMENTED**.
- Deployment drift monitoring: **NOT IMPLEMENTED**.
- Schema/migration drift monitoring: **NOT IMPLEMENTED**.
- Alert deduplication/severity routing: **NOT IMPLEMENTED**.
- Operational logging is mainly ordinary application/server console behavior: **PARTIALLY PROVEN**.
- `/health` is not evidence of a complete monitoring system: **UI ONLY / unverified**.

## 14. Existing incidents

No structured incident registry or durable incident-memory system was found: **NOT IMPLEMENTED**.

Known historical observations from this setup session:

1. Local PowerShell blocked `npm.ps1`; using `npm.cmd` avoided the execution-policy wrapper issue.
2. Buddy initially received `PGRST205` because `public.buddy_app_overview` was absent from the PostgREST schema cache. After owner-side SQL work, the read completed and later exposed a tree aggregate.
3. A SQL query referenced a nonexistent `health_status` column; this showed schema/query mismatch, not database health failure.
4. Local app behavior differed from a live Vercel instance; the exact deployment/source/config drift was not conclusively established.
5. The initial audit identified authorization, registration, wallet mutation, and RLS risks; local hardening was implemented and the owner reported successful SQL execution.

These are **HISTORICAL** notes, not yet normalized incident records with verified root cause, affected versions, blast radius, regression tests, and prevention rules.

## 15. Existing TOH/AI capability

### Buddy currently provides

- a named CLI assistant;
- authenticated, allowlisted, bounded read access to `buddy_*` database resources;
- secret-like output redaction;
- no service-role credential use;
- no database write command.

### Buddy/TOH currently does not provide

- an LLM runtime embedded in the application;
- application graph generation or persistence;
- autonomous diagnosis or repair;
- runtime logs/telemetry access;
- incident memory;
- invariant evaluation;
- monitoring or scheduled reconciliation;
- deterministic action gates;
- approval workflow or two-key enforcement;
- write authority.

Therefore, describing current Buddy as a full application AI would be inaccurate. Current Buddy is a **CODE-PROVEN read-only gateway/tool**. TOH is presently a **specification plus this discovery document**, not an activated autonomous system.

## 16. Protected areas

The following are Level 4/5 domains and require explicit owner approval, deterministic checks, before/after evidence, and a recovery plan before mutation:

- money, wallet balances, cash-in, withdrawals, distributions, and transaction history;
- tree/asset ownership, registry, assignments, and recovery/termination;
- identity, passwords, sessions, authentication, account confirmation, and KYC;
- roles, permissions, RLS, grants, service-role credentials, and admin powers;
- production schemas, migrations, triggers, functions, and destructive database operations;
- legal records, certificates, agreements, and compliance decisions;
- production deployment, domain, environment variables, and external-provider secrets;
- deletion, bulk correction, or irreversible operations.

TOH currently remains read-only for live systems.

## 17. Known weaknesses

- No automated test suite or browser E2E coverage.
- 161 lint warnings remained after the last passing lint run.
- The local rate limiter is in memory, instance-local, and unsuitable as the only production abuse defense.
- Live database schema/RLS/RPC alignment with source migrations is unverified.
- Multiple RPCs used by the app do not have definitions visible in the inspected repository.
- Heavy client-side Supabase usage increases reliance on perfectly correct RLS.
- Role aliases (`COPLANTER`/`INVESTOR`, `FARMER`/`GARDENER`/`CARETAKER`) can create authorization inconsistency.
- No durable workflow state, idempotency framework, reconciliation engine, or invariant checks were found.
- No monitoring, alerting, deployment/schema drift detection, or formal incident memory.
- Some routes surface raw operational errors and may reveal more detail than intended.
- Exact Vercel/Supabase environment matching is unverified.
- Buddy's previously shared weak password should be rotated and never committed or pasted again.
- The worktree contains important uncommitted changes, creating loss/deployment ambiguity.
- Business constants are not yet separated into an owner-approved authoritative blueprint.

## 18. Unknowns

- Owner-approved application/product name and complete intended user experience.
- Exact GitHub remote freshness and whether another branch contains newer authoritative work.
- Vercel project name, team, production URL, preview/staging setup, deployment commit, and environment mapping.
- Supabase project display name; only project ref `dvidrbhfzzhgwyempgtu` is known from local configuration/context.
- Exact live database schema, constraints, indexes, triggers, RLS policies, grants, and RPC definitions.
- Whether every local migration was applied, in what order, and against which environment.
- Exact production account counts, role distribution, current workflow states, and affected records.
- Canonical role vocabulary and approval/status transition rules.
- Which UI views are production workflows versus demos/placeholders.
- Full legal/KYC/business rules and owner-authorized financial definitions.
- HeyGen production use, credential health, avatar/voice choices, quota, and failure handling.
- Production logs, historical failures, support backlog, integration failure rates, and user impact.
- Backup/restore, disaster recovery, rollback, secret rotation, and incident-response procedures.

## 19. Evidence gaps

To convert unknowns into verified truth later, TOH would need separately authorized read-only evidence for:

1. GitHub branch/commit comparison and protected-branch/deployment linkage.
2. Vercel project identity, domains, current deployment commit, build status, and environment names (never secret values in reports).
3. Supabase schema catalog, RLS/grants, functions/RPC signatures, migration history, storage policies, and safe aggregate workflow state.
4. Owner interviews/decisions for the product, UX, visual, business, technical, security, data, and change blueprints.
5. Controlled local/staging role personas and end-to-end browser journeys.
6. Reproducible automated tests for financial, identity, ownership, permission, and farmer workflows.
7. Runtime logs and structured incidents with timestamps, affected workflows/users, root causes, fixes, and prevention rules.
8. Before/after evidence tying local source, database migration, deployed commit, and observable behavior together.

No gap should be filled by importing assumptions or memory from another client application.

## 20. Current-vs-target gap

| Target TOH capability | Current state | Gap classification |
|---|---|---|
| Verified application identity | Local source identity known; production identity incomplete | PARTIALLY PROVEN |
| Living application graph | This static discovery is the first map; no regeneratable graph engine | NOT IMPLEMENTED |
| Owner blueprint and blueprint lock | No authoritative blueprint found | NOT IMPLEMENTED |
| Controlled LLM reasoning | No application LLM runtime | NOT IMPLEMENTED |
| Expected-vs-actual/root-cause engine | Manual engineering analysis only | NOT IMPLEMENTED |
| Machine-checkable invariants | No invariant catalog/runner | NOT IMPLEMENTED |
| Logic gates and autonomy budget | Defined by TOH specification, not enforced in code | NOT IMPLEMENTED |
| Durable workflows and idempotency | Transactional RPCs exist for some actions; no universal workflow spine | PARTIALLY PROVEN |
| Reconciliation and proactive monitoring | None found | NOT IMPLEMENTED |
| Incident commander and memory | No structured implementation | NOT IMPLEMENTED |
| Intent-to-code/safe builder | Human-guided coding is possible; blueprint/test gates absent | PARTIALLY PROVEN |
| Change impact/before-after evidence | Performed manually, not systematized | PARTIALLY PROVEN |
| Test orchestration and synthetic users | No real test suite/personas | NOT IMPLEMENTED |
| Proof-of-done contract | Build/lint/audit evidence exists; database/role/browser/deployment proof incomplete | PARTIALLY PROVEN |
| Teacher mode | Can be provided conversationally; not embedded in app records/UI | PARTIALLY PROVEN |
| Two-key protection and kill switch | Policy described only; no technical enforcement | NOT IMPLEMENTED |

## Discovery conclusion and stop gate

The application has a substantial Next.js/Supabase feature surface and recent local security hardening, but production truth, complete workflow behavior, business authority, tests, monitoring, and deployment alignment are not yet fully established. Buddy is currently a constrained read-only database gateway, not a full TOH intelligence.

Per the first-execution rule, TOH stops here. No Goal Mode, redesign, autonomous repair, live database mutation, or deployment change is authorized by this discovery. The next phase requires the owner's explicit direction and should begin by resolving identity/evidence gaps and creating the owner blueprint before implementation.
