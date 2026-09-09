# Identity and Authorization Contract

**Version:** `0.1-DRAFT`  
**Status:** Role matrix and live RLS require owner/security approval.

## Identity guard

Every protected action must satisfy:

```text
AUTHENTICATED SUPABASE UID
= PROFILE.auth_user_id
= EXPECTED OWNER OR ACTIVE ASSIGNMENT
+ AUTHORIZED ACTIVE ROLE
+ LEGAL WORKFLOW STATE
= ALLOW
```

Otherwise: `BLOCK`.

Email, URL parameters, localStorage role flags, form-supplied profile IDs, hidden buttons, and client-side filters are not authorization.

## Role normalization gap

| Raw value | Current normalization | Blueprint issue |
|---|---|---|
| ADMIN, SUPER_ADMIN | Often treated as ADMIN; selected APIs preserve both | Exact difference UNKNOWN |
| STAFF | Accepted by admin layout but not selected protected APIs | CONFLICTING |
| COPLANTER, CO_PLANTER, INVESTOR | Often treated as Co-Planter | Canonical role/label UNKNOWN |
| FARMER, GARDENER, CARETAKER | Sometimes grouped, sometimes separate | Canonical role/relationship UNKNOWN |

## Provisional permission matrix

`R` read, `C` create/request, `T` protected transition, `U` safe update, `—` forbidden. This is **PROPOSED**, not locked.

| Resource/action | Public | Co-Planter | Farmer | Admin | Super Admin | Staff | TOH |
|---|---:|---:|---:|---:|---:|---:|---:|
| Public content | R | R | R | R | R | R | R bounded context |
| Own profile | C registration | R/U safe | R/U safe | R/T | R/T | UNKNOWN | — |
| Role/KYC/account status | — | R own | R own | T | T | UNKNOWN | — |
| Own wallet/ledger | — | R/C request | — | R/T | R/T | UNKNOWN | — |
| Other user's wallet | — | — | — | R/T by duty | R/T by duty | UNKNOWN | — |
| Own trees | Public subset only | R | R only if assigned | R/T | R/T | UNKNOWN | — |
| Tree ownership mutation | — | — | — | T with approval | T with approval | — pending decision | — |
| Farmer assignments | — | R relevant | R assigned | C/T | C/T | UNKNOWN | — |
| Field evidence | Public subset UNKNOWN | R own tree | C/R assigned | R/T review | R/T | UNKNOWN | — |
| Support | — | C/R own | C/R own | R/U/T | R/U/T | UNKNOWN | — |
| Legal/settings | R published | R published | R published | C/U/T | C/U/T | UNKNOWN | — |
| TOH chat | — | — | — | C question/R answer | C/R | — | Produces answer only |

## Server-side rules

- Each protected API obtains the bearer token from the request and verifies it with `auth.getUser()`.
- Profile role/status must be loaded server-side using authenticated UID.
- Service-role access, where unavoidable for public registration or admin orchestration, must be server-only and narrowly scoped.
- Protected state transitions must not be exposed through direct client table updates.
- RLS remains defense in depth even when a server route authorizes the user.
- Authorization errors use 401/403 without revealing whether another user's record exists.

## Security controls

| Control | Contract | Current evidence/status |
|---|---|---|
| Input validation | Allowlisted fields, length/type/range/MIME checks server-side | Partial |
| SQL injection | Parameterized Supabase queries/RPCs; no constructed SQL from input | Existing SDK pattern; RPC internals unverified |
| XSS | React escaping; sanitize any rich content; CSP defense | Security headers present; content inventory incomplete |
| CSRF | Bearer-token APIs and same-origin controls; reassess cookie endpoints if added | Partial |
| CORS | Default same-origin unless explicitly approved | No broad policy observed |
| Rate limiting | Durable distributed limits for public/auth/provider/protected endpoints | Current in-memory limiter is insufficient alone |
| Secrets | Server-only environment; never client bundle/log/report | Partial; formal rotation policy UNKNOWN |
| Uploads | MIME/size/signature, actor relationship, private-by-default, malware policy | Incomplete/conflicting storage SQL |
| Error exposure | Generic external errors; structured safe server logs | Partial |
| Audit | Actor, action, workflow, record, before/after state, result, time | Durable system incomplete |
| Session | Expiry, refresh, logout, revoked/blocked status, multi-tab behavior | Partially implemented; full tests missing |

## Two-key protected actions proposed

Owner must decide thresholds and approvers. Candidates: withdrawal settlement, recovery termination, ownership transfer, KYC override, role/Super Admin grant, destructive data change, RLS/grant migration, production deployment, secret rotation, and bulk correction.

## Logging prohibition

Never log passwords, API keys, access/refresh tokens, service-role keys, full payment proofs, unnecessary identity/KYC data, or unrestricted model prompts containing sensitive data.

# HOLD — CANONICAL ROLES, STAFF ACCESS, AND LIVE RLS ARE UNRESOLVED
