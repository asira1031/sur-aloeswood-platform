-- ONLY dvidrbhfzzhgwyempgtu. Review and run manually; no historic data changes.
begin;
set local lock_timeout = '5s';
create or replace function public.sur_admin_review_allocations(
 p_ids uuid[], p_expected jsonb, p_status text, p_reference text, p_notes text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.revenue_allocations%rowtype; n integer:=0; actor uuid;
begin
 if auth.uid() is null or not public.app_is_admin() then raise exception 'Active admin required'; end if;
 actor:=public.app_profile_id();
 if actor is null then raise exception 'Admin profile required'; end if;
 if p_ids is null or cardinality(p_ids) not between 1 and 2000
    or array_position(p_ids,null) is not null
    or cardinality(p_ids)<>(select count(distinct id) from unnest(p_ids) id)
 then raise exception 'Select unique allocation IDs'; end if;
 if p_status is null or p_status not in ('READY_FOR_PAYOUT','ON_HOLD','SETTLED') then raise exception 'Invalid transition'; end if;
 if p_expected is null or jsonb_typeof(p_expected)<>'object' then raise exception 'Expected states required'; end if;
 if length(coalesce(p_reference,''))>200 or length(coalesce(p_notes,''))>1000 then raise exception 'Reference or notes too long'; end if;
 if p_status='SETTLED' and nullif(trim(p_reference),'') is null then raise exception 'Transfer reference required'; end if;
 -- Deterministic row locking serializes overlapping requests. Validate ALL before writing ANY.
 for r in select * from public.revenue_allocations where id=any(p_ids) order by id for update loop
  n:=n+1;
  if r.settlement_status not in ('PENDING_SETTLEMENT','READY_FOR_PAYOUT')
     or (p_expected->r.id::text->>'status') is distinct from r.settlement_status
     or (p_expected->r.id::text->>'amount')::numeric is distinct from r.allocated_amount
  then raise exception 'Allocation changed or finalized. Refresh before retrying'; end if;
 end loop;
 if n<>cardinality(p_ids) then raise exception 'Allocation missing. Refresh before retrying'; end if;
 update public.revenue_allocations set settlement_status=p_status,
  settlement_reference=case when p_status='SETTLED' then trim(p_reference) else settlement_reference end,
  settlement_notes=coalesce(nullif(trim(p_notes),''),settlement_notes),
  settled_by=case when p_status='SETTLED' then actor else settled_by end,
  settled_at=case when p_status='SETTLED' then now() else settled_at end
 where id=any(p_ids);
 insert into public.sur_operation_audit(actor_profile_id,action,resource_type,resource_id,new_value)
 values(actor,'ALLOCATION_REVIEW','REVENUE_ALLOCATION_GROUP',p_ids[1]::text,
 jsonb_build_object('ids',p_ids,'status',p_status,'reference',p_reference));
 return jsonb_build_object('updated',n,'status',p_status);
end $$;
revoke all on function public.sur_admin_review_allocations(uuid[],jsonb,text,text,text) from public,anon;
grant execute on function public.sur_admin_review_allocations(uuid[],jsonb,text,text,text) to authenticated;
-- Browser callers must use the checked RPC; trusted owner functions retain access.
revoke insert,update,delete on public.revenue_allocations from public,anon,authenticated;
alter table public.revenue_allocations enable row level security;
drop policy if exists "allocation direct update denied" on public.revenue_allocations;
create policy "allocation direct update denied" on public.revenue_allocations
 as restrictive for update to authenticated using (false) with check (false);
notify pgrst,'reload schema';
commit;
select jsonb_build_object('migration','099-allocation-review-rpc',
 'review_rpc',to_regprocedure('public.sur_admin_review_allocations(uuid[],jsonb,text,text,text)') is not null,
 'direct_update_blocked',not has_table_privilege('authenticated','public.revenue_allocations','UPDATE')) as verification;
