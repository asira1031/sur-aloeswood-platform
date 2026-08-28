-- Run ONLY in SUR project dvidrbhfzzhgwyempgtu.
-- Exact two owner-approved stale allocations: PHP 50 + PHP 500.
-- Preserve amounts, references and records. Never update customer wallets.
-- Requires the updated finance UI, which excludes VOID from payable groups.
begin;

-- Find the status check by its column, not an assumed constraint name.
do $$
declare c record; status_att smallint; found_count integer:=0;
begin
 select attnum into status_att from pg_attribute
 where attrelid='public.revenue_allocations'::regclass and attname='settlement_status';
 for c in select conname from pg_constraint
 where conrelid='public.revenue_allocations'::regclass and contype='c'
 and conkey=array[status_att]::smallint[] loop
   found_count:=found_count+1;
   execute format('alter table public.revenue_allocations drop constraint %I',c.conname);
 end loop;
 if found_count<>1 then raise exception 'Unexpected status constraints; reconciliation rolled back'; end if;
end $$;
alter table public.revenue_allocations add constraint revenue_allocations_settlement_status_check
check (settlement_status in ('PENDING_SETTLEMENT','READY_FOR_PAYOUT','PARTIALLY_SETTLED','SETTLED','ON_HOLD','FAILED','VOID'));

do $$
declare target record; allocation public.revenue_allocations%rowtype;
 withdrawal public.withdrawal_requests%rowtype;
 marker constant text:='[SUR-098] VOID: fee created for rejected withdrawal; no payout due; original amount retained; customer balance unchanged.';
begin
 for target in select * from (values
 ('6e7b3a76-4f6e-4793-a7d5-90219e896c0f'::uuid,'426db990-1c47-4970-9d28-7db2298daf00'::uuid,50::numeric),
 ('75b920d9-c975-4e83-a9fe-0959e2374553'::uuid,'824eafa0-5b98-466f-a78a-f835ed9a64d9'::uuid,500::numeric)
 ) as targets(allocation_id,withdrawal_id,expected_amount) loop
  select * into withdrawal from public.withdrawal_requests where id=target.withdrawal_id for update;
  if not found then raise exception 'Withdrawal missing: %',target.withdrawal_id; end if;
  if upper(withdrawal.status) is distinct from 'REJECTED' then raise exception 'Withdrawal no longer rejected'; end if;
  select * into allocation from public.revenue_allocations where id=target.allocation_id for update;
  if not found then raise exception 'Allocation missing: %',target.allocation_id; end if;
  if allocation.source_id is distinct from target.withdrawal_id
    or allocation.source_type is distinct from 'WITHDRAWAL_PLATFORM_FEE'
    or allocation.allocated_amount is distinct from target.expected_amount
  then raise exception 'Allocation identity or amount changed'; end if;
  if allocation.settlement_status='VOID' and position(marker in coalesce(allocation.settlement_notes,''))>0 then continue; end if;
  if allocation.settlement_status<>'PENDING_SETTLEMENT'
    or allocation.settled_at is not null or allocation.settled_by is not null
    or nullif(trim(allocation.settlement_reference),'') is not null
  then raise exception 'Allocation has settlement activity; manual review required'; end if;
  update public.revenue_allocations
  set settlement_status='VOID',settlement_notes=concat_ws(E'\n',nullif(settlement_notes,''),marker||' Recorded at '||clock_timestamp()::text)
  where id=target.allocation_id;
 end loop;
end $$;
commit;

select jsonb_build_object('migration','098-void-rejected-withdrawal-fees',
 'voided_count',count(*) filter(where settlement_status='VOID'),
 'preserved_original_amount',sum(allocated_amount),
 'customer_balances_changed',false,
 'allocations',jsonb_agg(jsonb_build_object('id',id,'status',settlement_status,'amount',allocated_amount,'notes',settlement_notes))) as verification
from public.revenue_allocations where id in
('6e7b3a76-4f6e-4793-a7d5-90219e896c0f'::uuid,'75b920d9-c975-4e83-a9fe-0959e2374553'::uuid);
