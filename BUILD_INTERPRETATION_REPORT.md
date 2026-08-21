# Build Interpretation Report

**Builder status:** `HOLD — DO NOT CODE`  
**Blueprint version:** `0.1-DRAFT`  
**Purpose:** Comprehension gate only. This report does not authorize implementation.

## Interpretation matrix

| Requirement ID | Builder interpretation | Expected area | Frontend behavior | Backend/database effect | Verification | Match status |
|---|---|---|---|---|---|---|
| BP-ID-001 | Build only the Direk Tony app; never import another client's truth | Entire repository/docs | Correct client branding/data | Correct project/environment only | Repo/deployment identity check | MATCH |
| BP-ROLE-001 | Enforce canonical roles on server and RLS | Auth/layout/APIs/RLS | Show only permitted modules | UID/profile/role authorization | Role matrix integration/E2E | UNKNOWN — owner role matrix missing |
| BP-PAGE-001 | Preserve/build only owner-required pages | App routes/navigation | Complete loading/empty/error/responsive states | Required data only | Page inventory acceptance | PARTIAL — required scope unknown |
| BP-BUY-001 | Package purchase is once-only, server-priced, atomic, and auditable | Marketplace/API/RPC/tables | Disabled duplicate submit; canonical result | Ledger + purchase transaction | Concurrency/idempotency tests | UNKNOWN — rules/RPC missing |
| BP-APPROVE-001 | Admin approval follows legal states and creates exact downstream records once | Admin API/database | Stale/repeat approval blocked | Atomic transition/tree/allocation/audit | Retry/rollback/state tests | PARTIAL/CONFLICT |
| BP-CASH-001 | Cash-in approval cannot falsely imply external settlement | Wallet/treasury/backend | Pending/verified/settled distinctions | Request + ledger atomicity | External proof and retry tests | UNKNOWN |
| BP-WITH-001 | Withdrawal reserves balance and settles once | Wallet/admin/backend | Clear status and errors | Reservation/ledger/settlement transaction | Concurrent withdrawal tests | UNKNOWN |
| BP-MNT-001 | Only owner can order; only assigned farmer can update; completion requires evidence | Care/admin/farmer/RPC/storage | Legal step-by-step states | Order/payment/assignment/evidence relationships | Multi-role E2E/RLS tests | PARTIAL |
| BP-REC-001 | Recovery is protected legal/financial termination | Recovery/admin/database | Explicit consent/status | Settlement + participation/ownership effects | Legal/rule/state tests | UNKNOWN — do not build |
| BP-STO-001 | Uploads are private-by-default and relationship-authorized | Upload UI/storage policies | Type/size/progress/retry | Evidence row + controlled object access | Cross-user/security tests | CONFLICT |
| BP-AUD-001 | Critical transitions write safe durable audit evidence | All protected services | Reference/status visible as allowed | Immutable audit/event record | Completeness/no-secret tests | PARTIAL |
| BP-DEP-001 | Release versions must align | CI/Vercel/migrations | Correct build/environment | Compatible schema/RPC version | Commit/deploy/migration proof | UNKNOWN |
| BP-TOH-001 | TOH diagnoses only and has no mutation tools | Admin TOH/API | Evidence-labeled answer | No app DB mutation | Security contracts/API tests | MATCH locally |

## Unauthorized implementation rule

Any code, table, RPC, route, UI action, provider integration, business constant, state transition, role permission, or deployment change without a locked requirement ID is `UNAUTHORIZED IMPLEMENTATION` and must be held for owner decision.

## Traceability format required after lock

```text
LOCKED REQUIREMENT ID
→ IMPLEMENTATION FILES
→ BACKEND/API/RPC
→ DATABASE/STORAGE OBJECTS
→ TESTS
→ RUNTIME/ROLE/BROWSER/DEPLOYMENT EVIDENCE
```

## Comprehension result

Critical requirements include `PARTIAL`, `CONFLICT`, and `UNKNOWN`. Therefore the Builder has no authority to start implementation.

# HOLD — DO NOT CODE
