# APP MASTER BLUEPRINT

**Application boundary:** Direk Tony client only / repository `asira1031/sur-aloeswood-platform`  
**Blueprint version:** `0.1-DRAFT`  
**Status:** `HOLD — APP DEFINITION IS NOT COMPLETE`  
**Prepared by:** Lyra  
**Prepared:** 2026-08-18  
**Owner approval:** NOT YET PROVIDED

## 1. Authority and classification

This document set is the proposed single source of truth only after explicit owner approval. Until then, it is a structured audit of available evidence.

| Label | Meaning |
|---|---|
| OWNER APPROVED | Explicitly confirmed by the authorized owner |
| EXISTING IMPLEMENTATION | Present in current local source; not automatically intended |
| VERIFIED CURRENT BEHAVIOR | Reproduced by a test or direct observation |
| PROPOSED | Suggested contract awaiting approval |
| CONFLICTING | Available sources disagree |
| UNKNOWN | No authoritative answer available |

No information from SUR Final Apps, rejected sur app, agarwood-platform, or another client may be imported here.

## 2. Application identity and purpose

- Application name: `SUR Aloeswood Platform` — **EXISTING IMPLEMENTATION**; official owner-approved name is **UNKNOWN**.
- Repository: `https://github.com/asira1031/sur-aloeswood-platform` — **VERIFIED CURRENT BEHAVIOR** for local Git remote.
- Business purpose: manage a co-planter participation platform covering account approval, package purchase, tree registry, plantation/caretaker operations, wallet-style ledgers, recovery, support, and reporting — **INFERRED FROM EXISTING IMPLEMENTATION**, not owner approved.
- Legal nature of packages, funds, projections, wallet balances, recovery, and harvest participation: **UNKNOWN / OWNER AND LEGAL DECISION REQUIRED**.
- Production URL last observed: `https://sur-aloeswood-platform.vercel.app` — **HISTORICAL VERIFIED CURRENT BEHAVIOR**, must be reverified for release.

## 3. Target roles

| Role family | Why they use the app | May see/do in current source | Must never do | Status |
|---|---|---|---|---|
| Public visitor | Learn, register, log in | Landing, registration, public plantation/tree/legal pages | Access private records or protected actions | EXISTING IMPLEMENTATION |
| Co-Planter / Investor | Buy packages, view trees, wallet/ledger, care, recovery, support | `/investor/*`, tree/certificate/harvest pages | Access another owner's records; self-approve finance/KYC | EXISTING IMPLEMENTATION; alias is CONFLICTING/UNAPPROVED |
| Farmer / Gardener / Caretaker | Receive assignments and submit field evidence | `/farmer/*`, assigned trees, tasks, growth/photo/GPS updates | Edit unassigned trees; approve own work/payment | EXISTING IMPLEMENTATION; aliases are CONFLICTING/UNAPPROVED |
| Admin | Review accounts, purchases, treasury, registry, maintenance, support, reports | `/admin/*` | Bypass audit, identity, state, or two-key controls | EXISTING IMPLEMENTATION; exact permission matrix UNKNOWN |
| Super Admin | Elevated admin in selected server routes | Selected admin-only API authorization | Unlogged or unilateral protected mutation | EXISTING IMPLEMENTATION; separate authority UNKNOWN |
| Staff | Admin layout currently accepts STAFF | Some `/admin/*` UI access | Protected admin action without explicit server permission | CONFLICTING: layout permits STAFF while selected APIs do not |
| TOH | Explain and diagnose this app | Admin-only read-only chat | Any live mutation, approval, secret access, or deployment | OWNER APPROVED for OpenAI reasoning boundary on 2026-08-18 |

## 4. Product scope observed

The current implementation contains these capability domains. Inclusion in the locked product remains subject to owner approval:

1. Public marketing and onboarding.
2. Co-planter registration, login, session, approval, and profile management.
3. Farmer registration, resume upload, approval, profile, assignments, and reporting.
4. Package purchase using an application wallet ledger.
5. Admin purchase approval, AG/tree-code generation, registry creation, and allocation records.
6. Cash-in and withdrawal request handling.
7. Tree portfolio, registry, growth timeline, GPS, photos, certificates, harvest projections, and plantation records.
8. Annual maintenance/care services and farmer assignment.
9. Recovery/termination request handling.
10. Referral, support, notifications, audit, activity, legal, settings, and reports.
11. HeyGen video generation.
12. Admin-only TOH read-only technical intelligence.

## 5. Non-negotiable provisional principles

These are **PROPOSED** until owner approval unless already enforced by security code:

- Server authorization and RLS, not UI hiding, govern protected access.
- A financial balance change must have one authoritative ledger transaction.
- Protected actions must be authenticated, role-authorized, validated, auditable, and idempotent.
- Tree ownership must resolve to the authenticated profile through an authoritative relationship.
- No false success, silent failure, or partial critical transaction.
- Secrets and unnecessary personal data must not be logged.
- Existing code values are observations, not automatically approved business rules.
- Deployment is valid only when source commit, server code, environment identity, and database migration state are compatible.

## 6. Cross-document contract

| Concern | Authoritative draft artifact |
|---|---|
| Pages and actionable controls | `PAGE_ELEMENT_INVENTORY.md` |
| Workflows, states, frontend/backend effects | `WORKFLOW_CONTRACTS.md` |
| Prices, allocations, eligibility, timing | `BUSINESS_RULE_REGISTRY.md` |
| Tables, relationships, RLS, transactions | `DATABASE_CONTRACT.md` |
| UID, roles, ownership, security | `IDENTITY_AUTHORIZATION_CONTRACT.md` |
| Visual, responsive, feedback, error behavior | `UI_UX_CONTRACT.md` |
| Six review perspectives | `SIX_CHECKER_REVIEW.md` |
| Decisions and contradictions | `BLUEPRINT_DECISION_LOG.md` |
| Builder comprehension | `BUILD_INTERPRETATION_REPORT.md` |

## 7. Critical unresolved decisions

1. Official application name, legal/business purpose, and primary customer promise.
2. Canonical role vocabulary and exact permission matrix, especially STAFF and role aliases.
3. Whether every current route is required production scope or a demo/placeholder.
4. Authoritative financial rules, approval rights, fees/taxes, timing, reversals, and exceptions.
5. Canonical state machines for accounts, KYC, purchases, cash-in, withdrawals, maintenance, recovery, assignments, and trees.
6. Authoritative live schema, RPC definitions, migrations, RLS, grants, and storage rules.
7. Approved branding, layouts, responsive behavior, accessibility, and languages.
8. Evidence retention, privacy, legal/KYC requirements, notification channels, and audit retention.
9. Staging, backups, rollback, monitoring, release branch, and deployment approval process.
10. Which two humans must approve high-risk financial, ownership, identity, legal, and production actions.

## 8. Final gate status

- [ ] App purpose is owner approved.
- [ ] Roles and permissions are owner approved.
- [x] Existing pages are inventoried.
- [ ] Required pages and elements are owner approved.
- [x] Critical workflows are drafted from source.
- [ ] Business rules are authoritative.
- [ ] Live database contract is verified and owner approved.
- [ ] Identity/authorization rules are complete and approved.
- [ ] UI/UX design is approved.
- [x] Error behavior requirements are proposed.
- [x] AI six-checker review is drafted.
- [ ] Human checker reviews are complete.
- [ ] Critical contradictions and UNKNOWNs are resolved.
- [ ] Owner approves the blueprint.
- [ ] Builder interpretation has no critical PARTIAL/CONFLICT/UNKNOWN.

# HOLD — APP DEFINITION IS NOT COMPLETE

No Builder implementation is authorized by this draft.
