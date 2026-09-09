# Business Rule Registry

**Version:** `0.1-DRAFT`  
**Status:** `HOLD — FINANCIAL AND OPERATIONAL RULES NOT OWNER APPROVED`

All numeric rules below are **EXISTING IMPLEMENTATION**, not authoritative owner approval.

| Rule ID | Existing rule | Workflow/role | Conditions/output | Forbidden behavior | Authority status |
|---|---|---|---|---|---|
| BR-PKG-001 | Package price is PHP 25,000 per quantity | Purchase; Co-Planter | Total = price × quantity | Client-only price trust or inconsistent server value | OWNER APPROVAL REQUIRED |
| BR-ALLOC-001 | PHP 10,000 plantation allocation | Purchase approval; Admin | Allocation ledger record | Allocation without approved purchase | OWNER APPROVAL REQUIRED |
| BR-ALLOC-002 | PHP 10,000 fintech allocation | Purchase approval; Admin | Allocation ledger record | Duplicate allocation | OWNER APPROVAL REQUIRED |
| BR-ALLOC-003 | PHP 5,000 marketing/network allocation | Purchase approval; Admin | Current constant exists | Silent mismatch with detailed allocation list | CONFLICT REVIEW REQUIRED |
| BR-REF-001 | PHP 3,000 direct referral incentive | Referral/purchase | Code note says after full payment, qualification, and KYC approval | Credit without qualification/idempotency | OWNER APPROVAL REQUIRED |
| BR-REC-001 | PHP 2,000 recovery-fund allocation | Purchase/recovery | Recovery pool allocation | Treat as immediately withdrawable cash without policy | OWNER APPROVAL REQUIRED |
| BR-REC-002 | Recovery withdrawal minimum PHP 25,000; maximum PHP 50,000 | Recovery; Co-Planter/Admin | Eligibility and settlement output UNKNOWN | Approval outside owner-approved eligibility | OWNER APPROVAL REQUIRED |
| BR-REC-003 | Approved recovery withdrawal terminates package participation and references a 50/50 plantation-tech policy | Recovery/termination | Ownership/status and settlement changes | Partial termination or double settlement | LEGAL/OWNER APPROVAL REQUIRED |
| BR-MNT-001 | Maintenance fee PHP 1,500 annually for four years; total PHP 6,000 | Maintenance; Co-Planter/Admin/Farmer | Valid ownership and payment | Order for unowned tree or duplicate charge | OWNER APPROVAL REQUIRED |
| BR-HRV-001 | Harvest share 70% Co-Planter / 30% company | Harvest | Applies under conditions currently UNKNOWN | Present projection as guaranteed return | LEGAL/OWNER APPROVAL REQUIRED |
| BR-PRJ-001 | Projected target value PHP 450,000 | Portfolio/harvest projections | Estimate only; depends on performance, prices, costs, tax, law | Guarantee outcome or represent as deposit/savings/lending | LEGAL/OWNER APPROVAL REQUIRED |
| BR-WAL-001 | Platform records ledger activity; actual funds use external approved payment channels | Wallet/cash-in | Ledger is not automatically proof of external settlement | False claim that app moved external funds | OWNER APPROVAL REQUIRED |
| BR-APP-001 | Only authorized admin may approve protected requests | All approvals | Valid UID, active role, valid transition, audit | Client-side approval or self-approval | PROPOSED |
| BR-IDEM-001 | Retry must not duplicate debit, credit, tree, allocation, or notification | All financial workflows | Stable idempotency key and unique constraint | Repeating side effects on retry | PROPOSED |
| BR-OWN-001 | Tree actions require authoritative ownership or active assignment | Tree/care/recovery | Auth profile matches owner/assignment | Email-only or client-provided ownership trust | PROPOSED |

## Missing authoritative rule dimensions

For every monetary rule the owner must still define currency, taxes, fees, rounding, payment channel, settlement timing, eligibility, expiry, refunds/reversals, dispute handling, cancellation, admin authority, two-key thresholds, idempotency period, audit retention, and legal wording.

## Rule conflicts

- The constants total PHP 25,000 through plantation + fintech + marketing, while the displayed `capitalAllocation` replaces the PHP 5,000 marketing amount with PHP 3,000 referral + PHP 2,000 recovery. Whether these are two views of the same allocation or separate accounting events is **UNKNOWN**.
- Recovery minimum PHP 25,000, recovery allocation PHP 2,000, maximum PHP 50,000, and the 50/50 termination wording do not form a complete eligibility/settlement formula. This is a **BUSINESS RULE CONFLICT / GAP**.
- Harvest and projected values lack authoritative dates, maturity conditions, cost/tax treatment, and legal review.

# HOLD — BUSINESS RULES ARE NOT AUTHORITATIVE
