-- SUR Aloeswood final blueprint core
-- Apply after production-rls-repair.sql. Safe to re-run.
begin;

create extension if not exists pgcrypto;

-- Self-contained identity helpers. These are safe to replace and prevent this
-- migration from depending on older repair files having already been applied.
create or replace function public.app_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and upper(coalesce(p.role, '')) in ('ADMIN', 'SUPER_ADMIN')
      and upper(coalesce(p.account_status, '')) = 'ACTIVE'
  );
$$;

create or replace function public.app_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.profiles p
  where p.auth_user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.app_is_admin() from public;
revoke all on function public.app_profile_id() from public;
grant execute on function public.app_is_admin() to authenticated;
grant execute on function public.app_profile_id() to authenticated;

create table if not exists public.sur_app_settings (
  key text primary key,
  value jsonb not null,
  version integer not null default 1,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

insert into public.sur_app_settings(key, value) values
  ('commerce', '{"tree_price":25000,"monthly_care":200,"one_time_care":5000,"currency":"PHP","payment_channel":"MAYA_QR"}'),
  ('valuation', '{"gross_min":200000,"gross_max":300000,"guaranteed":false}'),
  ('withdrawal', '{"minimum":100,"maximum":50000,"fee_mode":"ACTUAL_EXTERNAL_FEE"}'),
  ('support', '{"response_days_min":1,"response_days_max":3,"sender_label":"Agarwood Support Team","max_file_mb":10}'),
  ('features', '{"email_notifications":false,"sms_notifications":false,"gps":false,"refunds":false,"cancellations":false}')
on conflict (key) do update set value=excluded.value, version=public.sur_app_settings.version+1, updated_at=now();

create table if not exists public.sur_tree_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique default ('SUR-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  profile_id uuid not null references public.profiles(id),
  status text not null default 'PENDING_VERIFICATION' check (status in ('PENDING_VERIFICATION','MANUAL_REVIEW','APPROVED','REJECTED')),
  payment_channel text not null default 'MAYA_QR' check (payment_channel='MAYA_QR'),
  sender_name text not null,
  payment_reference text not null,
  payment_date date not null,
  receipt_path text not null,
  exact_total numeric(14,2) not null check (exact_total>0),
  submitted_total numeric(14,2) not null check (submitted_total>0),
  review_reason text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (payment_channel, payment_reference)
);

create table if not exists public.sur_tree_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.sur_tree_orders(id) on delete restrict,
  quantity integer not null check (quantity>0),
  species text not null default 'Aquilaria malaccensis',
  unit_tree_price numeric(14,2) not null default 25000 check (unit_tree_price=25000),
  care_plan text not null check (care_plan in ('SKIP','MONTHLY','ONE_TIME')),
  unit_care_price numeric(14,2) not null check (unit_care_price in (0,200,5000)),
  line_total numeric(14,2) generated always as ((unit_tree_price+unit_care_price)*quantity) stored,
  created_at timestamptz not null default now()
);

create table if not exists public.sur_trees (
  id uuid primary key default gen_random_uuid(),
  tree_id text not null unique,
  profile_id uuid not null references public.profiles(id),
  order_item_id uuid not null references public.sur_tree_order_items(id),
  species text not null default 'Aquilaria malaccensis',
  care_plan text not null check (care_plan in ('SKIP','MONTHLY','ONE_TIME')),
  status text not null default 'AWAITING_CUSTOMER_SIGNATURE',
  qr_token_hash text not null unique,
  farm_site text,
  general_location text,
  caretaker_profile_id uuid references public.profiles(id),
  activated_at timestamptz,
  planted_at timestamptz,
  replaced_tree_id uuid references public.sur_trees(id),
  created_at timestamptz not null default now()
);

create table if not exists public.sur_contracts (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null unique references public.sur_trees(id),
  profile_id uuid not null references public.profiles(id),
  version text not null,
  legal_name text not null,
  status text not null default 'CUSTOMER_SIGNATURE_PENDING',
  customer_signed_at timestamptz,
  customer_signature text,
  farm_signed_copy_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.sur_operation_audit (
  id bigserial primary key,
  actor_user_id uuid default auth.uid(),
  actor_profile_id uuid references public.profiles(id),
  action text not null,
  resource_type text not null,
  resource_id text not null,
  old_value jsonb,
  new_value jsonb,
  reason text,
  request_key text unique,
  created_at timestamptz not null default now()
);

alter table public.sur_app_settings enable row level security;
alter table public.sur_tree_orders enable row level security;
alter table public.sur_tree_order_items enable row level security;
alter table public.sur_trees enable row level security;
alter table public.sur_contracts enable row level security;
alter table public.sur_operation_audit enable row level security;

drop policy if exists "settings read" on public.sur_app_settings;
create policy "settings read" on public.sur_app_settings for select to authenticated using (true);
drop policy if exists "settings admin" on public.sur_app_settings;
create policy "settings admin" on public.sur_app_settings for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());

drop policy if exists "orders owner read" on public.sur_tree_orders;
create policy "orders owner read" on public.sur_tree_orders for select to authenticated using (profile_id=public.app_profile_id() or public.app_is_admin());
drop policy if exists "orders admin" on public.sur_tree_orders;
create policy "orders admin" on public.sur_tree_orders for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());
drop policy if exists "items owner read" on public.sur_tree_order_items;
create policy "items owner read" on public.sur_tree_order_items for select to authenticated using (exists(select 1 from public.sur_tree_orders o where o.id=order_id and (o.profile_id=public.app_profile_id() or public.app_is_admin())));
drop policy if exists "trees role read" on public.sur_trees;
create policy "trees role read" on public.sur_trees for select to authenticated using (profile_id=public.app_profile_id() or caretaker_profile_id=public.app_profile_id() or public.app_is_admin());
drop policy if exists "trees admin" on public.sur_trees;
create policy "trees admin" on public.sur_trees for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());
drop policy if exists "contracts owner read" on public.sur_contracts;
create policy "contracts owner read" on public.sur_contracts for select to authenticated using (profile_id=public.app_profile_id() or public.app_is_admin());
drop policy if exists "contracts owner sign" on public.sur_contracts;
create policy "contracts owner sign" on public.sur_contracts for update to authenticated using (profile_id=public.app_profile_id() and status='CUSTOMER_SIGNATURE_PENDING') with check (profile_id=public.app_profile_id());
drop policy if exists "contracts admin" on public.sur_contracts;
create policy "contracts admin" on public.sur_contracts for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());
drop policy if exists "audit admin read" on public.sur_operation_audit;
create policy "audit admin read" on public.sur_operation_audit for select to authenticated using (public.app_is_admin());

-- PostgREST needs base table privileges before RLS can evaluate row access.
-- RLS remains the authority; these grants do not make another user's rows visible.
grant select on public.sur_app_settings to authenticated;
grant select, update on public.sur_tree_orders to authenticated;
grant select on public.sur_tree_order_items to authenticated;
grant select, update on public.sur_trees to authenticated;
grant select, update on public.sur_contracts to authenticated;
grant select on public.sur_operation_audit to authenticated;

create or replace function public.sur_submit_tree_order(
  p_items jsonb, p_sender_name text, p_reference text, p_payment_date date,
  p_receipt_path text, p_submitted_total numeric
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_profile uuid; v_order uuid; v_exact numeric; v_item jsonb; v_qty int; v_plan text; v_care numeric;
begin
  v_profile:=public.app_profile_id();
  if v_profile is null then raise exception 'Authenticated profile required'; end if;
  if coalesce(trim(p_sender_name),'')='' or coalesce(trim(p_reference),'')='' or coalesce(trim(p_receipt_path),'')='' then raise exception 'Complete Maya payment proof is required'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Cart is empty'; end if;
  v_exact:=0;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty:=greatest(1,coalesce((v_item->>'quantity')::int,1)); v_plan:=upper(coalesce(v_item->>'care_plan','SKIP'));
    if v_plan not in ('SKIP','MONTHLY','ONE_TIME') then raise exception 'Invalid care plan'; end if;
    v_care:=case v_plan when 'MONTHLY' then 200 when 'ONE_TIME' then 5000 else 0 end;
    v_exact:=v_exact+((25000+v_care)*v_qty);
  end loop;
  insert into public.sur_tree_orders(profile_id,sender_name,payment_reference,payment_date,receipt_path,exact_total,submitted_total,status)
  values(v_profile,trim(p_sender_name),trim(p_reference),p_payment_date,trim(p_receipt_path),v_exact,p_submitted_total,case when p_submitted_total=v_exact then 'PENDING_VERIFICATION' else 'MANUAL_REVIEW' end)
  returning id into v_order;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty:=greatest(1,coalesce((v_item->>'quantity')::int,1)); v_plan:=upper(coalesce(v_item->>'care_plan','SKIP'));
    v_care:=case v_plan when 'MONTHLY' then 200 when 'ONE_TIME' then 5000 else 0 end;
    insert into public.sur_tree_order_items(order_id,quantity,care_plan,unit_care_price) values(v_order,v_qty,v_plan,v_care);
  end loop;
  insert into public.sur_operation_audit(actor_profile_id,action,resource_type,resource_id,new_value,request_key)
  values(v_profile,'ORDER_SUBMITTED','TREE_ORDER',v_order::text,jsonb_build_object('exact_total',v_exact,'submitted_total',p_submitted_total),'ORDER:'||v_order);
  return jsonb_build_object('order_id',v_order,'exact_total',v_exact,'status',case when p_submitted_total=v_exact then 'PENDING_VERIFICATION' else 'MANUAL_REVIEW' end);
exception when unique_violation then raise exception 'This Maya reference number was already submitted';
end $$;

create or replace function public.sur_admin_approve_tree_order(p_order_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_order public.sur_tree_orders%rowtype; v_item public.sur_tree_order_items%rowtype; i int; v_tree uuid; v_code text; v_count int:=0;
begin
  if not public.app_is_admin() then raise exception 'Active admin required'; end if;
  select * into v_order from public.sur_tree_orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status not in ('PENDING_VERIFICATION','MANUAL_REVIEW') then raise exception 'Order already finalized'; end if;
  if v_order.submitted_total<v_order.exact_total then raise exception 'Underpayment cannot be approved'; end if;
  for v_item in select * from public.sur_tree_order_items where order_id=p_order_id loop
    for i in 1..v_item.quantity loop
      v_code:='SUR-'||to_char(now(),'YYYY')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
      insert into public.sur_trees(tree_id,profile_id,order_item_id,species,care_plan,qr_token_hash)
      values(v_code,v_order.profile_id,v_item.id,v_item.species,v_item.care_plan,encode(extensions.digest(gen_random_uuid()::text,'sha256'::text),'hex')) returning id into v_tree;
      insert into public.sur_contracts(tree_id,profile_id,version,legal_name)
      select v_tree,v_order.profile_id,'SUR-TREE-2026-01',p.full_name from public.profiles p where p.id=v_order.profile_id;
      v_count:=v_count+1;
    end loop;
  end loop;
  update public.sur_tree_orders set status='APPROVED',review_reason=p_reason,reviewed_by=public.app_profile_id(),reviewed_at=now() where id=p_order_id;
  insert into public.sur_operation_audit(actor_profile_id,action,resource_type,resource_id,new_value,reason,request_key)
  values(public.app_profile_id(),'ORDER_APPROVED','TREE_ORDER',p_order_id::text,jsonb_build_object('tree_count',v_count),p_reason,'APPROVE:'||p_order_id);
  return jsonb_build_object('order_id',p_order_id,'status','APPROVED','tree_count',v_count);
end $$;

grant execute on function public.sur_submit_tree_order(jsonb,text,text,date,text,numeric) to authenticated;
grant execute on function public.sur_admin_approve_tree_order(uuid,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('sur-payment-proofs','sur-payment-proofs',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "payment proof owner upload" on storage.objects;
create policy "payment proof owner upload" on storage.objects for insert to authenticated with check (bucket_id='sur-payment-proofs' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "payment proof owner read" on storage.objects;
create policy "payment proof owner read" on storage.objects for select to authenticated using (bucket_id='sur-payment-proofs' and ((storage.foldername(name))[1]=auth.uid()::text or public.app_is_admin()));

-- Make new tables and RPCs immediately visible to the Supabase REST API.
notify pgrst, 'reload schema';

commit;

select jsonb_build_object(
  'migration','080-final-blueprint-core',
  'orders',to_regclass('public.sur_tree_orders') is not null,
  'trees',to_regclass('public.sur_trees') is not null,
  'contracts',to_regclass('public.sur_contracts') is not null
) as verification;
