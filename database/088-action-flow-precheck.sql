-- READ ONLY. Run only in dvidrbhfzzhgwyempgtu.
-- These results are needed before changing financial functions or KYC storage.
select jsonb_build_object(
 'functions', (select coalesce(jsonb_agg(jsonb_build_object(
   'name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),
   'definition',pg_get_functiondef(p.oid)
 )), '[]'::jsonb) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and (p.proname ilike '%withdraw%' or p.proname ilike '%care%pay%' or p.proname='sur_submit_tree_order')),
 'columns', (select coalesce(jsonb_agg(jsonb_build_object('table',table_name,'column',column_name,'type',data_type,'nullable',is_nullable,'default',column_default)), '[]'::jsonb)
 from information_schema.columns where table_schema='public' and table_name in ('withdrawal_requests','wallets','wallet_transactions')),
 'buckets', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'public',public,'size_limit',file_size_limit,'mime_types',allowed_mime_types)), '[]'::jsonb)
 from storage.buckets where id in ('kyc-docs','sur-payment-proofs','sur-tree-evidence')),
 'storage_policies', (select coalesce(jsonb_agg(jsonb_build_object('name',policyname,'command',cmd,'roles',roles,'using',qual,'check',with_check)), '[]'::jsonb)
 from pg_policies where schemaname='storage' and tablename='objects')
) as action_flow_precheck;
