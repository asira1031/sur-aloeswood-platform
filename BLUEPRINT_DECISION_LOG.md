# Blueprint Decision Log

**Version:** `0.1-DRAFT`  
**Status:** OWNER REVIEW REQUIRED

## Confirmed decisions

| Decision ID | Decision | Source | Classification |
|---|---|---|---|
| DEC-001 | Direk Tony is a separate client application from SUR Final Apps, rejected sur app, and agarwood-platform | Owner clarification in current work session | OWNER APPROVED |
| DEC-002 | Supabase access by Buddy/TOH is read-only through the application gateway; no Supabase website changes by TOH | Owner instruction | OWNER APPROVED |
| DEC-003 | TOH may use OpenAI for admin-only reasoning with no mutation tools; questions and bounded context may be sent to OpenAI | Owner approval on 2026-08-18 | OWNER APPROVED |
| DEC-004 | TOH remains observe/diagnose only and must not claim production mutations | TOH control plane and owner-approved implementation | OWNER APPROVED / EXISTING IMPLEMENTATION |

## Decisions required from owner

| Decision ID | Required decision | Why it blocks the blueprint | Current evidence |
|---|---|---|---|
| DEC-101 | Official app name and one-sentence business purpose | Controls product scope and user promise | UNKNOWN; current branding says SUR Aloeswood |
| DEC-102 | Canonical end-user name: Co-Planter, Investor, or both | Prevents inconsistent labels and authorization | CONFLICTING aliases in source |
| DEC-103 | Canonical field role: Farmer, Gardener, Caretaker, or distinct roles | Prevents assignment/RLS ambiguity | CONFLICTING aliases in source |
| DEC-104 | STAFF permissions and whether STAFF may enter admin workspace | Current layout/API behavior differs | CONFLICTING |
| DEC-105 | Required vs demo/placeholder routes | Prevents Builder from preserving/removing the wrong pages | UNKNOWN |
| DEC-106 | Package price and full allocation policy | Financial contract cannot rely on code constants | EXISTING IMPLEMENTATION only |
| DEC-107 | Referral, recovery, maintenance, harvest, projection, withdrawal rules | Protected financial/legal behavior | EXISTING IMPLEMENTATION only |
| DEC-108 | Canonical statuses and legal transitions for all critical workflows | Required for state machines and concurrency | PARTIAL/CONFLICTING |
| DEC-109 | Exact approval authority and two-key requirements | Prevents unilateral protected action | UNKNOWN |
| DEC-110 | Approved visual system and reference screens | Builder must not redesign arbitrarily | UNKNOWN |
| DEC-111 | Language, accessibility, device/browser requirements | Controls UX and acceptance tests | UNKNOWN |
| DEC-112 | KYC/document requirements and retention | Legal/privacy/security requirement | UNKNOWN |
| DEC-113 | Notification channels and blocking behavior | Controls workflow completion semantics | UNKNOWN |
| DEC-114 | Production branch, staging, backup, rollback, and migration policy | Required for release validity | UNKNOWN |
| DEC-115 | Authoritative live database project/schema/RPC/RLS version | Local SQL is incomplete production proof | UNKNOWN |

## Conflict register

| Conflict ID | Conflict | Sources | Required resolution |
|---|---|---|---|
| CON-001 | `STAFF` enters admin layout but selected protected APIs accept only ADMIN/SUPER_ADMIN | `app/admin/layout.tsx`; server API routes | Owner-approved permission matrix plus server enforcement |
| CON-002 | Co-Planter and Investor labels/roles are normalized inconsistently | Security/session/navigation files | Choose canonical name and migration/compatibility rule |
| CON-003 | Farmer/Gardener/Caretaker may be aliases or distinct operational roles | Role helpers, layouts, tables, UI labels | Define canonical roles and assignment relationships |
| CON-004 | Source references RPCs whose definitions are absent from inspected repository SQL | Application `.rpc()` calls vs `database/*.sql` | Obtain authoritative migrations/signatures or remove unauthorized dependencies after blueprint lock |
| CON-005 | Storage SQL permits broad public/anonymous access for some uploads while identity contract expects strict actor ownership | Resume/caretaker storage SQL | Owner/security review of bucket privacy and upload ownership |
| CON-006 | Direct client-side Supabase operations coexist with protected server routes | Page code and API routes | Select one authoritative backend path per protected workflow |

## Decision protocol

Every owner answer must record decision ID, exact wording, approver, date, blueprint version, affected requirements, and exceptions. Secrets and customer-specific records must never be entered here.
