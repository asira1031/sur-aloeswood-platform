-- READ ONLY. Run ONLY in project dvidrbhfzzhgwyempgtu.
-- No personal records, tokens, object names, or payment references are returned.
select jsonb_build_object(
 'identity_functions',(select jsonb_agg(jsonb_build_object('name',p.proname,'definition',pg_get_functiondef(p.oid)))
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
  and p.proname in ('sur_is_admin','sur_current_profile_id','app_user_profile_id','app_profile_id','app_is_admin')),
 'policies',(select jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename,'name',policyname,'roles',roles,'command',cmd,'using',qual,'check',with_check))
  from pg_policies where (schemaname='public' and tablename in ('profiles','revenue_allocations','sur_trees','sur_tree_updates','sur_tree_orders')) or (schemaname='storage' and tablename='objects')),
 'profile_triggers',(select jsonb_agg(pg_get_triggerdef(oid)) from pg_trigger where tgrelid='public.profiles'::regclass and not tgisinternal),
 'care_columns',(select jsonb_agg(jsonb_build_object('table',table_name,'column',column_name,'type',data_type))
  from information_schema.columns where table_schema='public' and (table_name like '%care%payment%' or table_name like '%coverage%' or table_name in ('sur_trees','sur_tree_order_items'))),
 'buckets',(select jsonb_agg(jsonb_build_object('id',id,'public',public)) from storage.buckets
  where id in ('kyc-docs','farmer-resumes','caretaker-updates','sur-tree-evidence','sur-payment-proofs','withdrawal-proofs')),
 'identity_duplicates',(select count(*) from (select auth_user_id from public.profiles where auth_user_id is not null group by auth_user_id having count(*)>1) d),
 'care_plan_counts',(select jsonb_agg(x) from (select care_plan,count(*) from public.sur_trees group by care_plan) x),
 'allocation_review_rpc',to_regprocedure('public.sur_admin_review_allocations(uuid[],jsonb,text,text,text)') is not null
) as release_gap_precheck;
