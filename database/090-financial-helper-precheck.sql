  -- READ ONLY. Run ONLY in SUR project dvidrbhfzzhgwyempgtu.
  -- Returns code/grants/policies, never customer rows or secret keys.
  select jsonb_build_object(
    'functions', (select jsonb_agg(jsonb_build_object(
      'name', p.proname, 'signature', pg_get_function_identity_arguments(p.oid),
      'security_definer', p.prosecdef,
      'authenticated_execute', has_function_privilege('authenticated',p.oid,'EXECUTE'),
      'anon_execute', has_function_privilege('anon',p.oid,'EXECUTE'),
      'definition', pg_get_functiondef(p.oid)))
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in (
        'sur_apply_wallet_delta','sur_platform_fee','sur_create_tdi_fee_allocation',
        'sur_current_profile_id','app_is_admin',
        'sur_admin_verify_cashin_by_email','sur_admin_reject_cashin_by_email',
        'sur_admin_verify_cashin','sur_admin_reject_cashin')),
    'buckets', (select jsonb_agg(jsonb_build_object('id',id,'public',public,
      'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types))
      from storage.buckets where id in ('withdrawal-proofs','kyc-docs')),
    'storage_policies', (select jsonb_agg(to_jsonb(p)) from pg_policies p
      where schemaname='storage' and tablename='objects'),
    'financial_triggers', (select jsonb_agg(pg_get_triggerdef(t.oid))
      from pg_trigger t join pg_class c on c.oid=t.tgrelid
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and not t.tgisinternal
      and c.relname in ('wallets','wallet_transactions','withdrawal_requests','cashin_requests'))
  ) as financial_helper_precheck;
