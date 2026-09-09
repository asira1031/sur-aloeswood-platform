-- READ ONLY. ONLY SUR project dvidrbhfzzhgwyempgtu.
-- No balance changes. Exact two owner-reported stale allocations only.
select jsonb_build_object(
 'columns',(select jsonb_agg(jsonb_build_object('name',column_name,'type',data_type,'udt',udt_name,'nullable',is_nullable))
 from information_schema.columns where table_schema='public' and table_name='revenue_allocations'),
 'constraints',(select jsonb_agg(pg_get_constraintdef(oid)) from pg_constraint where conrelid='public.revenue_allocations'::regclass),
 'status_enum_values',(select jsonb_agg(e.enumlabel order by e.enumsortorder)
 from pg_attribute a join pg_enum e on e.enumtypid=a.atttypid
 where a.attrelid='public.revenue_allocations'::regclass and a.attname='settlement_status'),
 'triggers',(select jsonb_agg(jsonb_build_object('trigger',pg_get_triggerdef(t.oid),'function',pg_get_functiondef(t.tgfoid)))
 from pg_trigger t where t.tgrelid='public.revenue_allocations'::regclass and not t.tgisinternal),
 'targets',(select jsonb_agg(jsonb_build_object('allocation_id',a.id,'source_type',a.source_type,
 'withdrawal_id',r.id,'withdrawal_status',r.status,'allocated_amount',a.allocated_amount,
 'settlement_status',a.settlement_status))
 from public.revenue_allocations a left join public.withdrawal_requests r on r.id=a.source_id
 where a.id in ('6e7b3a76-4f6e-4793-a7d5-90219e896c0f'::uuid,'75b920d9-c975-4e83-a9fe-0959e2374553'::uuid))
) as allocation_reconciliation_precheck;
