# Database Contract

**Version:** `0.1-DRAFT`  
**Status:** Local source model only; live Supabase schema has not been authoritatively inspected for this blueprint.

## Contract principles

- UUID/auth UID relationships must be explicit; email is not a durable ownership key.
- Foreign keys, unique constraints, checks, indexes, RLS, and transaction boundaries enforce the locked workflow.
- Client-provided role, owner ID, price, balance, approval status, or allocation is never authoritative.
- Financial and multi-record approval workflows require atomic database functions/transactions and idempotency.
- Migrations must be ordered, versioned, repeatable, and linked to the release commit.
- No customer-specific record is hardcoded into schema or source.

## Core relation registry

Columns below are minimum intended relationships inferred from current usage; exact live definitions are `UNKNOWN` unless present in repository SQL.

| DB ID / relation | Purpose and key relationships | Required constraints/indexes | RLS/owner rule | Status |
|---|---|---|---|---|
| DB-PROF-001 `profiles` | App identity; PK `id`; unique `auth_user_id`; email; role/status/KYC | Unique auth UID; normalized email where used; status/role checks | Owner select/safe update; admin protected access | PARTIAL local SQL |
| DB-WAL-001 `wallets` | One wallet per profile | Unique profile FK; non-invalid numeric balance | Owner read; mutation only authoritative server/RPC | Live definition UNKNOWN |
| DB-WTX-001 `wallet_transactions` | Immutable ledger entries | FK wallet/profile/workflow; unique idempotency/reference; amount/type checks; time index | Owner read; no direct client insert | PARTIAL hardening SQL |
| DB-CASH-001 `cashin_requests` | Cash-in workflow | Profile FK; unique payment reference policy; status checks/index | Owner create/read; admin transition | Live definition UNKNOWN |
| DB-WITH-001 `withdrawal_requests` | Withdrawal workflow | Profile FK; amount/status; reservation/settlement identity | Owner create/read; admin/server transition | Live definition UNKNOWN |
| DB-PUR-001 `seedling_purchases` | Package purchase | Profile FK; quantity/amount/rule version; unique idempotency; status | Owner read/create through authority; admin review | Live definition UNKNOWN |
| DB-TREE-001 `tree_registry` | Authoritative registered tree/ownership | Unique tree code; profile/purchase/farm FKs; DENR uniqueness policy; status checks | Owner read; assigned farmer read; admin mutation | PARTIAL local SQL/RLS |
| DB-GROW-001 `tree_growth_logs` | Field evidence/history | Tree/profile/gardener/assignment FKs; captured time; dedupe identity | Owner/admin read; assigned farmer insert | PARTIAL local SQL |
| DB-FARM-001 `farms` | Plantation sites | PK; status; searchable location; uniqueness policy UNKNOWN | Public active read currently; admin mutation | Local table SQL present |
| DB-GARD-001 `gardeners` | Farmer operational profile | Profile/auth relationship unique; active status | Own read/update safe fields; admin management | Live definition UNKNOWN |
| DB-ASGN-001 `gardener_assignments` | Farmer-to-tree/order assignment | Farmer/tree/order FKs; unique active assignment policy; indexes | Assigned farmer read/update bounded fields | PARTIAL local SQL |
| DB-MNT-001 `maintenance_orders` | Paid care workflow | Profile/tree FKs; price/rule version; payment/work statuses; idempotency | Owner read; admin/farmer bounded access | Table/RLS local SQL present |
| DB-ALLOC-001 `revenue_allocations` | Purchase allocation ledger | Purchase/profile/type FKs; unique purchase+type+version | Admin/server only mutation; audited reads | Live definition UNKNOWN |
| DB-NOT-001 `notifications` | In-app messages | Recipient profile; workflow/record relation; read timestamp | Recipient read/update read-state; controlled create | PARTIAL RLS SQL |
| DB-SUPT-001 `support_tickets` | Support lifecycle | Owner profile; status/assignment/timestamps | Owner and support/admin access | PARTIAL RLS SQL |
| DB-SUPC-001 `support_chats` | Support conversation container | Owner/ticket relation | Owner/admin only | PARTIAL RLS SQL |
| DB-SUPM-001 `support_messages` | Support messages | Chat/ticket/actor relation; immutable timestamp | Conversation participant/admin | PARTIAL RLS SQL |

## Referenced RPC contract gaps

The source-derived model previously identified nine application RPC references without definitions in inspected repository SQL. Known examples include `purchase_seedling_with_wallet` and `farmer_caretaker_assignment_tasks`. Each RPC requires an authoritative signature, security-definer/search-path review, grants, validation, transaction semantics, idempotency, expected errors, and migration source before blueprint lock.

Local SQL currently includes definitions for:

- `app_is_admin`
- `app_profile_id`
- `app_user_email`
- `app_profile_sensitive_fields_unchanged`
- `create_maintenance_order_with_wallet`
- `pay_maintenance_order_with_wallet`
- `request_recovery_termination`

Presence in local SQL does not prove application to production.

## Storage contract

| Storage ID | Observed use | Required contract | Status |
|---|---|---|---|
| STO-RESUME-001 | Farmer resumes | Private bucket, approved MIME/size, applicant-scoped write, authorized reviewer read, retention/delete policy, malware handling | Existing SQL permits public/anon patterns; SECURITY DECISION REQUIRED |
| STO-CARE-001 | Caretaker photos/updates | Assignment-scoped upload/read, image MIME/size, metadata/evidence FK, orphan cleanup, signed URL/retention | Existing authenticated policies; exact ownership/privacy incomplete |
| STO-LEGAL-001 | Legal/compliance documents | Admin upload, approved publication state, private/public classification, version/expiry, signed URLs | UNKNOWN |
| STO-PAY-001 | Payment proofs if used | Owner upload, finance reviewer access, MIME/size, retention/redaction | UNKNOWN |

## Transaction and concurrency requirements

- Purchase: debit + purchase + allocation + tree creation semantics must be defined; current multi-request admin approval risks partial state unless wrapped transactionally.
- Cash-in: request transition + wallet credit + ledger + audit must be atomic and once-only.
- Withdrawal/recovery: balance reservation, settlement, ledger, ownership/status effects must prevent double spending and repeat settlement.
- Maintenance: payment + order and assignment/status transitions require idempotent functions and legal transition checks.
- Registration: auth/profile/wallet/gardener creation requires an explicit compensation or retry design.

## Required live evidence before lock

Schema catalog, PK/FK/unique/check/index definitions, triggers, RLS policies, grants, functions and signatures, storage buckets/policies, migration history, extensions, and safe aggregate integrity checks from the explicitly authorized production/staging project.

# HOLD — LIVE DATABASE CONTRACT AND MIGRATION ALIGNMENT UNKNOWN
