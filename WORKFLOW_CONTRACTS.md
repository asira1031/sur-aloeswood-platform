# Workflow Contracts

**Version:** `0.1-DRAFT`  
**Status:** Critical chains reconstructed from source; owner approval and live verification required.

## Common step contract

Every protected step requires authenticated UID, active authorized role, authoritative record relationship, server validation, legal state transition, idempotency where side effects exist, atomic database effects, and audit evidence. Failure must produce no false success and no invalid partial state.

## WF-REG-COP-001 — Co-Planter registration

`FORM → VALIDATED → AUTH_CREATED → PROFILE_PENDING → ADMIN_REVIEW → ACTIVE or REJECTED`

| Step | Actor/state/action | Frontend effect | Backend/database effect | Permission/evidence | Failure/recovery |
|---|---|---|---|---|---|
| REG-C01 | Public enters required fields | Inline validation | None | Public; rate-limit evidence | Retain non-secret fields |
| REG-C02 | Public submits valid form | Disable submit/loading | Server validates and checks duplicates | Registration endpoint | Explain field/duplicate error safely |
| REG-C03 | Server creates identity | Processing | Auth account and profile relationship | Service credential boundary | Compensate partial profile/auth failure; exact policy UNKNOWN |
| REG-C04 | Server creates pending profile/wallet | Pending message | Profile/wallet/notification creation | Unique auth UID/email | No orphan wallet/profile |
| REG-C05 | Admin reviews | Queue/detail feedback | Valid state transition plus audit | Authorized admin | Reject stale/duplicate review |
| REG-C06 | User logs in | Role destination | Active status/role checked | Session + server/RLS | Pending/blocked routed safely |

Legal states and required KYC before activation remain **OWNER DECISION REQUIRED**.

## WF-REG-FAR-001 — Farmer registration

`FORM → RESUME_UPLOAD → AUTH/PROFILE_PENDING → GARDENER_RECORD → ADMIN_REVIEW → ACTIVE/REJECTED`

- Required identity/contact fields, resume file types/size/privacy, reviewer, retention, and deletion are UNKNOWN.
- Anonymous/public upload policies in existing SQL require security resolution before lock.
- Duplicate submission must not create multiple auth/profile/gardener records.

## WF-BUY-001 — Package purchase

`READY → SUBMITTING → PAYMENT/LEDGER_PROCESSING → PURCHASE_PENDING → ADMIN_REVIEW → APPROVED → TREES/ALLOCATIONS CREATED → VISIBLE`

| Step | Actor/action | Expected state/effect | Authoritative path | Required proof |
|---|---|---|---|---|
| BUY-S01 | Co-Planter selects quantity | Valid price preview | Server recomputes price | Rule version and quantity |
| BUY-S02 | User confirms | One disabled/loading submission | `POST /api/investor/buy-seedling` → purchase RPC | UID, active role, idempotency key |
| BUY-S03 | Backend validates balance/eligibility | Atomic debit + purchase record or no change | `purchase_seedling_with_wallet` definition missing locally | Transaction/ledger consistency |
| BUY-S04 | Admin reviews pending purchase | Approve/reject only from legal state | Admin approval route | Admin UID, previous/new state |
| BUY-S05 | Approval creates exact quantity trees and allocations | Approved result visible | Current route performs multiple DB writes | Atomicity/idempotency currently unproven |
| BUY-S06 | Owner sees result | Dashboard/tree/ledger refresh | RLS-owned records | End-to-end role/browser evidence |

Provisional allowed transitions: `PENDING → APPROVED|REJECTED`; any direct `PENDING → COMPLETED` or repeated approval is `CONTRACT VIOLATION`. Exact states require owner approval.

## WF-CASH-001 — Cash-in

`DRAFT → SUBMITTED/PENDING → ADMIN_VERIFICATION → APPROVED or REJECTED → LEDGER_VISIBLE`

- Submission requires amount/channel/reference/proof rules, all owner-defined.
- Approval must atomically update request, wallet, transaction ledger, and audit evidence.
- External payment confirmation source is UNKNOWN; the application ledger must not be presented as external-funds proof.
- Duplicate reference and repeated approval must be blocked.

## WF-WITH-001 — Withdrawal

`DRAFT → PENDING → ADMIN_REVIEW → APPROVED/REJECTED → SETTLED/FAILED`

- Eligibility, min/max, available-balance reservation, fees, payout channel, settlement proof, cancellation, and reversal are UNKNOWN.
- Approval without actual settlement evidence must not display `COMPLETED`.
- Concurrent withdrawals must not overspend a balance.

## WF-MNT-001 — Maintenance/care order

`ELIGIBLE → ORDER_PENDING → PAID → ASSIGNED → IN_PROGRESS → EVIDENCE_SUBMITTED → REVIEWED → COMPLETED`

| Step | Actor | Required relationship/effect | Failure rule |
|---|---|---|---|
| MNT-S01 | Co-Planter | Owns selected tree; sees approved price/term | Block unowned/ineligible tree |
| MNT-S02 | Backend | Atomic wallet transaction + order | No debit without order; idempotent retry |
| MNT-S03 | Admin | Assign active qualified farmer | No assignment to unauthorized/inactive actor |
| MNT-S04 | Farmer | Views only assigned work | RLS/UID relationship required |
| MNT-S05 | Farmer | Submits valid photo/growth/GPS evidence | No unassigned update; safe retry |
| MNT-S06 | Admin | Reviews evidence and legal transition | Cannot skip required evidence |
| MNT-S07 | Co-Planter | Sees reviewed result | No premature completed state |

`PENDING → COMPLETED` and `UNPAID → ASSIGNED` are provisional `CONTRACT VIOLATION`s.

## WF-REC-001 — Recovery/termination

`ELIGIBILITY_CHECK → REQUESTED → ADMIN_REVIEW → APPROVED/REJECTED → SETTLED → OWNERSHIP/PARTICIPATION_UPDATED`

This workflow is financial, ownership, and legal. Required formula, eligibility, consent text, cooling-off/cancellation, two-key approval, settlement source, ownership outcome, certificate impact, tax/fees, and reversals are UNKNOWN. No implementation version may be considered authoritative until legal/owner approval.

## WF-FIELD-001 — Farmer tree update

`ASSIGNED → TASK_OPEN → UPDATE_DRAFT → EVIDENCE_UPLOADED → SUBMITTED → ADMIN_VISIBLE → OWNER_VISIBLE → REVIEWED`

- Assignment must relate authenticated farmer/gardener profile to the exact tree/order.
- Accepted evidence types, file size, geolocation precision, consent, privacy, review requirements, and retention are UNKNOWN.
- Network retry must not create duplicate growth logs or orphan files.
- Owner-visible status must distinguish submitted from reviewed.

## WF-SUP-001 — Support

`OPEN → REPLIED → WAITING_USER/WAITING_SUPPORT → RESOLVED → CLOSED`

Owner/agent visibility, attachments, SLA, reopen rule, notification channel, retention, and escalation are UNKNOWN. A notification failure should be recorded; whether it blocks state completion is an owner decision.

## WF-TOH-001 — TOH diagnosis

`ADMIN_AUTHENTICATED → QUESTION_VALIDATED → DETERMINISTIC or OPENAI_REASONING → ANSWER_DISPLAYED`

- Active ADMIN/SUPER_ADMIN only in server route.
- Maximum question length 4,000; rate limit 20/hour per current instance-local key.
- No model tools, Supabase mutation, deployment, or autonomous repair.
- No-key mode returns deterministic evidence guidance.
- Provider failure returns an error and changes no application data.
- Questions must exclude secrets and unnecessary customer/financial/KYC data.

## Notification and evidence contract

Each critical transition should record workflow ID, actor UID, record ID, previous state, new state, rule/version, timestamp, result, idempotency identity, and safe error classification. Notification delivery should be separately recorded and must not silently substitute for workflow completion.

# HOLD — CANONICAL STATES AND OWNER RULES ARE INCOMPLETE
