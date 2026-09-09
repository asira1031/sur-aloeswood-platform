-- READ ONLY. ONLY project dvidrbhfzzhgwyempgtu.
-- Needed to harden callers without guessing their identity or fee behavior.
select jsonb_build_object(
 'functions', (select jsonb_agg(jsonb_build_object(
   'signature',p.oid::regprocedure::text,
   'definition',pg_get_functiondef(p.oid),
   'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),
   'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE')))
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.prokind='f' and (
     p.proname in ('sur_is_admin','sur_is_admin_email','app_profile_id',
       'sur_admin_profile_id_by_email','sur_cashin_fee_allocation_trigger',
       'sur_withdrawal_fee_allocation_trigger','sync_withdrawal_wallet_ledger_status')
     or p.prosrc ilike '%sur_apply_wallet_delta%'
     or p.prosrc ilike '%sur_create_tdi_fee_allocation%')),
 'policies', (select jsonb_agg(to_jsonb(p)) from pg_policies p
   where schemaname='public' and tablename in ('cashin_requests','wallets','wallet_transactions','profiles'))
) as financial_followup;
