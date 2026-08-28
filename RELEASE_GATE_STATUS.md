# SUR release gates — 2026-08-27

## Product correction — 2026-08-28

There is NO cash-in product flow. Do not restore cash-in creation or review.
091 and 093 were applied according to owner-supplied verification outputs.
Legacy cash-in access remains blocked; historical records/migrations are retained.
Removed remaining Treasury cash-in UI, RPCs, queries, activity feed dependency,
and navigation/checklist references. Finance ledger source filters are historical
classifications only, not a funding feature. Withdrawal receipt privacy remains open.

This is a partial remediation, not production approval. No live database mutation,
Git push, or production deployment was performed during this remediation.

## Verified locally

- Production build and TypeScript passed (77 routes).
- ESLint error-only check passed; this does not certify zero warnings.
- `npm test`: 41 passed, 0 failed. These are primarily source/contract checks,
  not authenticated end-to-end tests.
- Active-admin guard and registration failure cleanup were strengthened.
- Customer dashboard/settings and six legacy caretaker pages redirect to canonical flows.
- Admin caretaker assignment selection now includes approved dual-mode accounts.

## Owner-reported database verification

The owner supplied successful verification output for 087 and 089 on SUR.
089 reports KYC storage private and the legacy email-based withdrawal settlement
blocked. These are owner-supplied checks, not independent authenticated E2E proof.
Only project dvidrbhfzzhgwyempgtu is authorized; never FarmConnect.

The registration/application code returns 503 if the shared limiter is absent
or unavailable.
The verification JSON checks object/policy presence, not comprehensive RLS correctness.
Earlier permissive SQL scripts must not be run afterwards.

## Remaining release gates

1. Inspect deployed policies/grants and verify cross-user denial, wallet protection,
   support message permissions, Guardian restrictions, and migration compatibility.
2. Test API malformed inputs, unauthorized access, duplicate requests, shared rate
   limits, and compensating cleanup failures; registration is not fully atomic.
3. Legacy admin commerce/tree routes still exist and need migration/retirement.
4. Review remaining lint warnings and misleading fallback UI states.
5. Authenticated E2E: signup, approval, purchase, contract, assignment, photo submission,
   rejection, resubmission, customer-visible approved update, and withdrawal.
6. Actual phone/tablet/desktop browser checks for all three roles are still pending.
7. Review dirty-worktree files and secrets before making a scoped backup commit/push.
8. Verify target Git/Vercel/Supabase identities, deploy preview, test, then production.

Do not infer that the live database has changed or all eight gates passed from local tests.

## Repeat audit — 2026-08-28

- Retired the legacy direct-wallet-debit withdrawal UI; it redirects to treasury.
- Treasury settlement/rejection now use session-authenticated RPCs from 089,
  not revoked email-based variants. Only pending-review requests enable actions.
- Added proof file type/size checks and preserved success messages after refresh.
- 48 source/contract tests passed; these do not prove payment correctness.
- NEED LIVE EVIDENCE: run read-only 090-financial-helper-precheck.sql. Financial
  helper execute grants, cash-in email RPC authority, withdrawal storage policies,
  and triggers remain unverified. Do not change these based on guessed signatures.
- Known unresolved functional gaps: monthly-care button routes to wallet rather
  than a completed care-payment flow; care entitlement enforcement, failed KYC
  upload recovery, and real planting-date/age semantics still need remediation.
- No deployment or database mutation performed in this audit.
