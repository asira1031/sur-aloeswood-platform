# Six-Checker Blueprint Review

**Blueprint reviewed:** `0.1-DRAFT`  
**Review status:** `FAIL / HOLD` until human review and owner decisions are complete.

## AI Checker 1 — Target user / zero assistance

**Result: PARTIAL**

Strengths: role dashboards, module labels, loading/access guards, status surfaces, and common workflow pages exist. Gaps: duplicate login routes, ambiguous Co-Planter/Investor and Farmer/Gardener/Caretaker labels, unapproved financial/legal wording, incomplete empty/error contracts, and no evidence that a real user completed each workflow without assistance.

Required proof: moderated or recorded task tests for registration, login, purchase, wallet request, tree view, care order, farmer evidence, admin review, support, and session recovery on phone and desktop.

## AI Checker 2 — Real-world behavior

**Result: FAIL / HIGH RISK**

Repeated clicks, retries, slow connections, multiple tabs, stale approvals, interrupted multi-record writes, and external-provider failure lack comprehensive idempotency and recovery contracts. Current in-memory rate limiting is instance-local. Registration compensation and admin purchase approval atomicity require explicit design.

## AI Checker 3 — Hidden technical guardian

**Result: FAIL / HOLD**

The source has security hardening, role guards, RLS SQL, headers, tests, and read-only TOH boundaries. However, live schema/RLS/migration alignment is unverified; referenced RPC definitions are missing locally; role rules conflict; critical workflow transaction boundaries are incomplete; monitoring and durable audit evidence are insufficient.

## Human Checker 1 — Product/business

**Result: NOT PERFORMED**

Must confirm product purpose, customer promise, complete scope, role meaning, pricing/allocation, referrals, recovery/termination, maintenance, harvest/projection, approvals, settlement, tax/fees, exceptions, and legal wording.

Reviewer: `UNKNOWN`  
Decision/date: `PENDING`

## Human Checker 2 — UI/UX

**Result: NOT PERFORMED**

Must approve representative page layouts, navigation, labels, visual tokens, responsive behavior, accessibility, language, feedback, loading, empty, error, confirmation, and destructive/protected-action patterns.

Reviewer: `UNKNOWN`  
Decision/date: `PENDING`

## Human Checker 3 — Principal full-stack engineer

**Result: NOT PERFORMED**

Must review architecture, authoritative backend paths, auth/RLS, service-role scope, schema, PK/FK/unique/index/check constraints, RPC security, transaction/ACID/idempotency, storage, logs, monitoring, backups, migrations, environment compatibility, and rollback.

Reviewer: `UNKNOWN`  
Decision/date: `PENDING`

## Cross-check findings

| Finding ID | Severity | Finding | Required resolution |
|---|---|---|---|
| REV-001 | Critical | Financial rules are code-derived, not owner approved | Product/legal owner decision |
| REV-002 | Critical | Canonical roles and STAFF permissions conflict | Owner/security matrix |
| REV-003 | Critical | Live RPC/schema/RLS state is unverified | Authorized read-only technical evidence |
| REV-004 | Critical | Protected multi-record transitions lack universal atomic/idempotent contract | Engineer-reviewed backend/database design after lock |
| REV-005 | High | Storage privacy/upload rules are incomplete or broad | Security/legal storage decision |
| REV-006 | High | Required vs demo routes unknown | Product scope decision |
| REV-007 | High | Visual/responsive/accessibility standard unapproved | UI/UX approval |
| REV-008 | High | Release, staging, rollback, backup, and monitoring contracts incomplete | Engineering/operations approval |

# SIX-CHECKER RESULT: HOLD
