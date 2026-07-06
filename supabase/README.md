# SUR Aloeswood Supabase Readiness Notes

This backup app can run against the current practice schema, but the schema should be extended before production use.

## Already Present In Provided Schema
- `profiles`
- `wallets`
- `wallet_transactions`
- `cashin_requests`
- `withdrawal_requests`
- `linked_accounts`
- `seedling_purchases`
- `tree_registry`
- `tree_growth_logs`
- `gardeners`
- `gardener_assignments`
- `support_tickets`
- `notifications`
- `farms`
- `licenses`
- `maintenance_payments`

## Recommended Additions
- `kyc_documents`: government ID, selfie, beneficiary information, e-sign status.
- `support_ticket_messages`: threaded replies instead of notification-only replies.
- `payment_proofs`: receipt image URL, method, sender name, reference, verifier.
- `allocation_ledger`: purchase allocations for plantation, fintech, referral, recovery, platform fee, technical support.
- `platform_fee_ledger`: system/operator revenue separated from buyer/client funds.
- `recovery_termination_requests`: recovery withdrawal requests that terminate the contract and apply the 50/50 plantation-tech policy.
- `service_catalog` and `service_orders`: fertilizer, watering, video requests, gardener services, and status tracking.
- `gardener_payout_requests`: salary/cash-out requests and approval history.
- `certificates`: MOA, co-planter certificate, acknowledgment receipt, DENR references, tree passport files.
- `audit_logs`: admin action, before/after status, actor, timestamp, and notes.

## Production Safety
- Use RLS policies for every table.
- Keep service role keys out of the browser and out of Git.
- Treat wallet values as a platform ledger unless a licensed payment provider is connected.
- Show recovery withdrawals as contract termination, not ordinary wallet withdrawal.
- Show all harvest and target values as projections, not guaranteed returns.
