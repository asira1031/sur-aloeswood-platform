-- ONLY dvidrbhfzzhgwyempgtu. New care-payment records; no wallet mutations.
-- Calendar coverage starts at original tree approval/creation and follows replacements.
begin;
set local lock_timeout='5s';
create table if not exists public.sur_care_accounts(
 tree_id uuid primary key references public.sur_trees(id),
 profile_id uuid not null references public.profiles(id),
 plan text not null check(plan in ('SKIP','MONTHLY','ONE_TIME')),
 starts_on date not null,
 paid_months integer not null default 0 check(paid_months>=0),
 updated_at timestamptz not null default now()
);
create table if not exists public.sur_care_payments(
 id uuid primary key default gen_random_uuid(),
 tree_id uuid not null references public.sur_trees(id),
 account_tree_id uuid not null references public.sur_care_accounts(tree_id),
 profile_id uuid not null references public.profiles(id),
 plan text not null check(plan in ('MONTHLY','ONE_TIME')),
 months integer not null check(months between 0 and 120),
 exact_total numeric(14,2) not null check(exact_total>0),
 sender_name text not null, payment_reference text not null,
 payment_date date not null, receipt_path text not null,
 status text not null default 'PENDING' check(status in ('PENDING','APPROVED','REJECTED')),
 review_note text, reviewed_by uuid references public.profiles(id),reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 check((plan='MONTHLY' and months>=1 and exact_total=months*200) or (plan='ONE_TIME' and months=0 and exact_total=5000))
);
create unique index if not exists sur_care_payment_pending on public.sur_care_payments(account_tree_id) where status='PENDING';
create unique index if not exists sur_care_payment_reference on public.sur_care_payments(lower(trim(payment_reference)));

create or replace function public.sur_care_root(p_tree uuid)
returns uuid language plpgsql stable security definer set search_path=public as $$
declare node uuid:=p_tree; parent uuid; owner_id uuid; current_owner uuid; seen uuid[]:='{}';
begin
 loop
  if node=any(seen) then raise exception 'Tree replacement cycle requires admin review'; end if;
  seen:=array_append(seen,node);
  select replaced_tree_id,profile_id into parent,current_owner from public.sur_trees where id=node;
  if not found then raise exception 'Tree not found'; end if;
  if owner_id is null then owner_id:=current_owner; elsif owner_id<>current_owner then raise exception 'Replacement owner mismatch'; end if;
  if parent is null then return node; end if;
  node:=parent;
 end loop;
end $$;
revoke all on function public.sur_care_root(uuid) from public,anon,authenticated;

insert into public.sur_care_accounts(tree_id,profile_id,plan,starts_on,paid_months)
select t.id,t.profile_id,t.care_plan,(t.created_at at time zone 'Asia/Manila')::date,
 case when t.care_plan='MONTHLY' and i.unit_care_price=200 then 1 else 0 end
from public.sur_trees t join public.sur_tree_order_items i on i.id=t.order_item_id
where t.replaced_tree_id is null on conflict(tree_id) do nothing;
create or replace function public.sur_initialize_care_account()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.replaced_tree_id is null then
  insert into public.sur_care_accounts(tree_id,profile_id,plan,starts_on,paid_months)
  select new.id,new.profile_id,new.care_plan,(new.created_at at time zone 'Asia/Manila')::date,
   case when new.care_plan='MONTHLY' and i.unit_care_price=200 then 1 else 0 end
  from public.sur_tree_order_items i where i.id=new.order_item_id;
 else
  perform public.sur_care_root(new.id);
  update public.sur_trees set care_plan=(select plan from public.sur_care_accounts where tree_id=public.sur_care_root(new.id)) where id=new.id;
 end if;
 return new;
end $$;
revoke all on function public.sur_initialize_care_account() from public,anon,authenticated;
drop trigger if exists sur_initialize_care_account on public.sur_trees;
create trigger sur_initialize_care_account after insert on public.sur_trees for each row execute function public.sur_initialize_care_account();

alter table public.sur_care_accounts enable row level security;
alter table public.sur_care_payments enable row level security;
revoke all on public.sur_care_accounts,public.sur_care_payments from public,anon,authenticated;
grant select on public.sur_care_accounts,public.sur_care_payments to authenticated;
drop policy if exists "care accounts owner read" on public.sur_care_accounts;
create policy "care accounts owner read" on public.sur_care_accounts for select to authenticated using(profile_id=public.app_profile_id() or public.app_is_admin());
drop policy if exists "care payments owner read" on public.sur_care_payments;
create policy "care payments owner read" on public.sur_care_payments for select to authenticated using(profile_id=public.app_profile_id() or public.app_is_admin());

create or replace function public.sur_care_quote(p_tree uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare a public.sur_care_accounts%rowtype; today date:=(now() at time zone 'Asia/Manila')::date; due integer:=0; ends date;
begin
 if auth.uid() is null or not exists(select 1 from public.sur_trees where id=p_tree and (profile_id=public.app_profile_id() or public.app_is_admin())) then raise exception 'Tree access denied'; end if;
 select * into strict a from public.sur_care_accounts where tree_id=public.sur_care_root(p_tree);
 ends:=(a.starts_on+make_interval(months=>a.paid_months))::date;
 while (a.starts_on+make_interval(months=>a.paid_months+due))::date<=today loop due:=due+1; end loop;
 return jsonb_build_object('account_tree_id',a.tree_id,'plan',a.plan,'starts_on',a.starts_on,'paid_months',a.paid_months,
 'covered_until',ends,'minimum_months',greatest(1,due),'monthly_price',200,'one_time_price',5000,
 'access',a.plan='ONE_TIME' or (a.plan='MONTHLY' and ends>today),
 'warning',a.plan='MONTHLY' and ends<=today+7,
 'pending',exists(select 1 from public.sur_care_payments where account_tree_id=a.tree_id and status='PENDING'));
end $$;

-- Shared reference lock prevents reuse between tree purchases and care payments.
create or replace function public.sur_guard_maya_reference()
returns trigger language plpgsql security definer set search_path=public as $$
declare ref text:=lower(trim(new.payment_reference));
begin
 if ref is null or length(ref) not between 3 and 120 then raise exception 'Valid Maya reference required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('SUR-MAYA:'||ref,0));
 if exists(select 1 from public.sur_tree_orders where lower(trim(payment_reference))=ref)
 or exists(select 1 from public.sur_care_payments where lower(trim(payment_reference))=ref)
 then raise exception 'Maya reference already submitted. Check history or contact support'; end if;
 return new;
end $$;
revoke all on function public.sur_guard_maya_reference() from public,anon,authenticated;
drop trigger if exists sur_guard_maya_reference on public.sur_tree_orders;
create trigger sur_guard_maya_reference before insert on public.sur_tree_orders for each row execute function public.sur_guard_maya_reference();
drop trigger if exists sur_guard_maya_reference on public.sur_care_payments;
create trigger sur_guard_maya_reference before insert on public.sur_care_payments for each row execute function public.sur_guard_maya_reference();

create or replace function public.sur_submit_care_payment(p_tree uuid,p_plan text,p_months integer,p_sender text,p_reference text,p_date date,p_receipt text,p_amount numeric)
returns uuid language plpgsql security definer set search_path=public as $$
declare a public.sur_care_accounts%rowtype; profile uuid:=public.app_profile_id(); total numeric; payment uuid; q jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=profile and upper(account_status)='ACTIVE') then raise exception 'Active account required'; end if;
 if not exists(select 1 from public.sur_trees where id=p_tree and profile_id=profile and upper(status) not in ('SOLD','DEAD','REPLACED','TERMINATED')) then raise exception 'Eligible owned tree required'; end if;
 select * into strict a from public.sur_care_accounts where tree_id=public.sur_care_root(p_tree) for update;
 if p_plan is null or p_plan not in ('MONTHLY','ONE_TIME') or a.plan='ONE_TIME' or (a.plan='MONTHLY' and p_plan<>'MONTHLY') then raise exception 'Care plan is locked'; end if;
 q:=public.sur_care_quote(p_tree);
 if (q->>'pending')::boolean then raise exception 'A care payment is already awaiting review'; end if;
 if p_plan='MONTHLY' and (p_months is null or p_months not between (q->>'minimum_months')::integer and 120) then raise exception 'Pay the outstanding months first (maximum 120 months per submission)'; end if;
 if p_plan='ONE_TIME' and p_months is distinct from 0 then raise exception 'One-time care has no monthly quantity'; end if;
 total:=case when p_plan='MONTHLY' then p_months*200 else 5000 end;
 if p_amount is distinct from total then raise exception 'Send the exact amount. Contact support for overpayment'; end if;
 if p_sender is null or length(trim(p_sender)) not between 2 and 150 or p_date is null or p_date>(now() at time zone 'Asia/Manila')::date then raise exception 'Valid sender name and payment date required'; end if;
 if p_receipt is null or split_part(p_receipt,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='sur-payment-proofs' and name=p_receipt) then raise exception 'Upload your own payment receipt first'; end if;
 insert into public.sur_care_payments(tree_id,account_tree_id,profile_id,plan,months,exact_total,sender_name,payment_reference,payment_date,receipt_path)
 values(p_tree,a.tree_id,profile,p_plan,p_months,total,trim(p_sender),trim(p_reference),p_date,p_receipt) returning id into payment;
 insert into public.sur_operation_audit(actor_profile_id,action,resource_type,resource_id,new_value)
 values(profile,'CARE_PAYMENT_SUBMITTED','CARE_PAYMENT',payment::text,jsonb_build_object('total',total,'months',p_months));
 return payment;
end $$;

create or replace function public.sur_admin_review_care_payment(p_payment uuid,p_decision text,p_note text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.sur_care_payments%rowtype; a public.sur_care_accounts%rowtype;
begin
 if auth.uid() is null or not public.app_is_admin() then raise exception 'Active admin required'; end if;
 if p_decision is null or p_decision not in ('APPROVED','REJECTED') or p_note is null or length(trim(p_note)) not between 3 and 1000 then raise exception 'Decision and clear review note required'; end if;
 select * into strict p from public.sur_care_payments where id=p_payment for update;
 if p.status<>'PENDING' then raise exception 'Already reviewed. Refresh history'; end if;
 select * into strict a from public.sur_care_accounts where tree_id=p.account_tree_id for update;
 if p_decision='APPROVED' then
  if a.plan='ONE_TIME' or (a.plan='MONTHLY' and p.plan<>'MONTHLY') then raise exception 'Plan changed; review manually'; end if;
  update public.sur_care_accounts set plan=p.plan,paid_months=paid_months+p.months,updated_at=now() where tree_id=a.tree_id;
  update public.sur_trees t set care_plan=p.plan where t.profile_id=p.profile_id and public.sur_care_root(t.id)=a.tree_id;
 end if;
 update public.sur_care_payments set status=p_decision,review_note=trim(p_note),reviewed_by=public.app_profile_id(),reviewed_at=now() where id=p.id;
 insert into public.sur_operation_audit(actor_profile_id,action,resource_type,resource_id,new_value,reason,request_key)
 values(public.app_profile_id(),'CARE_PAYMENT_'||p_decision,'CARE_PAYMENT',p.id::text,jsonb_build_object('months',p.months,'total',p.exact_total),p_note,'CARE-REVIEW:'||p.id);
 return jsonb_build_object('status',p_decision,'payment_id',p.id);
end $$;
revoke all on function public.sur_care_quote(uuid) from public,anon;
revoke all on function public.sur_submit_care_payment(uuid,text,integer,text,text,date,text,numeric) from public,anon;
revoke all on function public.sur_admin_review_care_payment(uuid,text,text) from public,anon;
grant execute on function public.sur_care_quote(uuid) to authenticated;
grant execute on function public.sur_submit_care_payment(uuid,text,integer,text,text,date,text,numeric) to authenticated;
grant execute on function public.sur_admin_review_care_payment(uuid,text,text) to authenticated;

alter table public.sur_tree_updates add column if not exists is_planting_record boolean not null default false;
create unique index if not exists sur_one_planting_record on public.sur_tree_updates(tree_id) where is_planting_record;
create or replace function public.sur_confirm_planting_record(p_update uuid)
returns void language plpgsql security definer set search_path=public as $$
declare u public.sur_tree_updates%rowtype;
begin
 if auth.uid() is null or not public.app_is_admin() then raise exception 'Active admin required'; end if;
 select * into strict u from public.sur_tree_updates where id=p_update for update;
 if u.status<>'APPROVED' then raise exception 'Approve the planting evidence first'; end if;
 if u.is_planting_record then return; end if;
 update public.sur_tree_updates set is_planting_record=true where id=u.id;
 update public.sur_trees set planted_at=coalesce(planted_at,u.observed_on::timestamp at time zone 'Asia/Manila') where id=u.tree_id;
 insert into public.sur_operation_audit(actor_profile_id,action,resource_type,resource_id,new_value,request_key)
 values(public.app_profile_id(),'PLANTING_CONFIRMED','TREE_UPDATE',u.id::text,jsonb_build_object('observed_on',u.observed_on),'PLANTING:'||u.tree_id);
end $$;
revoke all on function public.sur_confirm_planting_record(uuid) from public,anon;
grant execute on function public.sur_confirm_planting_record(uuid) to authenticated;
create or replace function public.sur_can_read_care_update(p_tree uuid,p_planting boolean)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare a public.sur_care_accounts%rowtype;
begin
 if auth.uid() is null or not exists(select 1 from public.sur_trees where id=p_tree and profile_id=public.app_profile_id()) then return false; end if;
 select * into a from public.sur_care_accounts where tree_id=public.sur_care_root(p_tree);
 return p_planting or a.plan='ONE_TIME' or (a.plan='MONTHLY' and (a.starts_on+make_interval(months=>a.paid_months))::date>(now() at time zone 'Asia/Manila')::date);
end $$;
revoke all on function public.sur_can_read_care_update(uuid,boolean) from public,anon;
grant execute on function public.sur_can_read_care_update(uuid,boolean) to authenticated;
drop policy if exists "updates customer approved read" on public.sur_tree_updates;
create policy "updates customer approved read" on public.sur_tree_updates for select to authenticated
 using(status='APPROVED' and public.sur_can_read_care_update(tree_id,is_planting_record));
drop policy if exists "care update read boundary" on public.sur_tree_updates;
create policy "care update read boundary" on public.sur_tree_updates as restrictive for select to authenticated
 using(public.app_is_admin() or caretaker_profile_id=public.app_profile_id() or (status='APPROVED' and public.sur_can_read_care_update(tree_id,is_planting_record)));
-- Existing evidence policy joins sur_tree_updates; its RLS now also enforces coverage.
notify pgrst,'reload schema';
commit;
select jsonb_build_object('migration','103-monthly-care-ledger',
 'care_accounts',to_regclass('public.sur_care_accounts') is not null,
 'payment_rpc',to_regprocedure('public.sur_submit_care_payment(uuid,text,integer,text,text,date,text,numeric)') is not null,
 'review_rpc',to_regprocedure('public.sur_admin_review_care_payment(uuid,text,text)') is not null,
 'coverage_guard',to_regprocedure('public.sur_can_read_care_update(uuid,boolean)') is not null) as verification;
