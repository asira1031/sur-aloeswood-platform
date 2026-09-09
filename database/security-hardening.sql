-- Direk Tony security hardening migration.
-- Review and run manually in Supabase SQL Editor. This file is never auto-applied.

begin;

-- Prevent profile owners from changing authorization and account-control fields.
create or replace function public.app_profile_sensitive_fields_unchanged(
  p_profile_id uuid,
  p_auth_user_id uuid,
  p_role text,
  p_account_status text,
  p_kyc_status text,
  p_membership_status text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles existing
    where existing.id = p_profile_id
      and existing.auth_user_id is not distinct from p_auth_user_id
      and existing.role is not distinct from p_role
      and existing.account_status is not distinct from p_account_status
      and existing.kyc_status is not distinct from p_kyc_status
      and existing.membership_status is not distinct from p_membership_status
  );
$$;

revoke all on function public.app_profile_sensitive_fields_unchanged(uuid, uuid, text, text, text, text) from public;
grant execute on function public.app_profile_sensitive_fields_unchanged(uuid, uuid, text, text, text, text) to authenticated;

drop policy if exists "profiles owner update" on public.profiles;
create policy "profiles owner update safe fields"
  on public.profiles
  for update
  to authenticated
  using (auth_user_id = auth.uid())
  with check (
    auth_user_id = auth.uid()
    and public.app_profile_sensitive_fields_unchanged(
      id,
      auth_user_id,
      role,
      account_status,
      kyc_status,
      membership_status
    )
  );

-- Wallet balances may only change through transactional database functions.
drop policy if exists "wallets owner update" on public.wallets;
drop policy if exists "wallet tx owner insert" on public.wallet_transactions;

-- Users may create notifications only for their own profile.
drop policy if exists "notifications authenticated insert" on public.notifications;
create policy "notifications owner insert"
  on public.notifications
  for insert
  to authenticated
  with check (profile_id = public.app_profile_id() or public.app_is_admin());

-- Gardener creation must go through authenticated/admin server routes.
drop policy if exists "gardeners public insert" on public.gardeners;

-- Creates a maintenance request and, when funds are sufficient, pays atomically.
create or replace function public.create_maintenance_order_with_wallet(
  p_tree_id uuid,
  p_service_type text,
  p_plan_type text,
  p_amount numeric,
  p_customer_note text,
  p_reference text
)
returns table(order_id uuid, payment_status text, next_wallet_balance numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.app_profile_id();
  v_tree_code text;
  v_wallet public.wallets%rowtype;
  v_order_id uuid;
  v_payment_status text;
  v_work_status text;
  v_next_balance numeric;
begin
  if auth.uid() is null or v_profile_id is null then
    raise exception 'Authentication required';
  end if;

  if p_amount < 0 or p_amount > 1000000 then
    raise exception 'Invalid maintenance amount';
  end if;

  select tr.tree_code into v_tree_code
  from public.tree_registry tr
  where tr.id = p_tree_id and tr.profile_id = v_profile_id;

  if v_tree_code is null then
    raise exception 'Tree not found or access denied';
  end if;

  select * into v_wallet
  from public.wallets w
  where w.profile_id = v_profile_id
  for update;

  if p_amount <= 0 then
    v_payment_status := 'FOR_QUOTE';
    v_work_status := 'FOR_QUOTE';
    v_next_balance := coalesce(v_wallet.balance, 0);
  elsif v_wallet.id is not null and coalesce(v_wallet.balance, 0) >= p_amount then
    v_next_balance := v_wallet.balance - p_amount;
    update public.wallets set balance = v_next_balance, updated_at = now() where id = v_wallet.id;
    update public.profiles set wallet_balance = v_next_balance where id = v_profile_id;
    insert into public.wallet_transactions(profile_id, transaction_type, amount, description, status)
    values (v_profile_id, 'MAINTENANCE_PAYMENT', p_amount, 'Maintenance payment. Reference: ' || p_reference, 'APPROVED');
    v_payment_status := 'PAID';
    v_work_status := 'READY_FOR_ASSIGNMENT';
  else
    v_payment_status := 'PENDING_PAYMENT';
    v_work_status := 'PENDING_PAYMENT';
    v_next_balance := coalesce(v_wallet.balance, 0);
  end if;

  insert into public.maintenance_orders(
    profile_id, tree_id, tree_code, service_type, plan_type, amount,
    payment_status, work_status, payment_reference, customer_note
  ) values (
    v_profile_id, p_tree_id, v_tree_code, p_service_type, p_plan_type, p_amount,
    v_payment_status, v_work_status, p_reference, nullif(trim(p_customer_note), '')
  ) returning id into v_order_id;

  return query select v_order_id, v_payment_status, v_next_balance;
end;
$$;

create or replace function public.pay_maintenance_order_with_wallet(p_order_id uuid)
returns table(order_id uuid, payment_status text, next_wallet_balance numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.app_profile_id();
  v_order public.maintenance_orders%rowtype;
  v_wallet public.wallets%rowtype;
  v_next_balance numeric;
begin
  if auth.uid() is null or v_profile_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_order
  from public.maintenance_orders mo
  where mo.id = p_order_id and mo.profile_id = v_profile_id
  for update;

  if v_order.id is null then raise exception 'Order not found or access denied'; end if;
  if v_order.payment_status = 'PAID' then raise exception 'Order is already paid'; end if;
  if coalesce(v_order.amount, 0) <= 0 then raise exception 'Order is waiting for a valid quotation'; end if;

  select * into v_wallet
  from public.wallets w
  where w.profile_id = v_profile_id
  for update;

  if v_wallet.id is null or coalesce(v_wallet.balance, 0) < v_order.amount then
    raise exception 'Wallet balance is not enough';
  end if;

  v_next_balance := v_wallet.balance - v_order.amount;
  update public.wallets set balance = v_next_balance, updated_at = now() where id = v_wallet.id;
  update public.profiles set wallet_balance = v_next_balance where id = v_profile_id;
  update public.maintenance_orders
  set payment_status = 'PAID', work_status = 'READY_FOR_ASSIGNMENT', paid_at = now(), updated_at = now()
  where id = v_order.id;
  insert into public.wallet_transactions(profile_id, transaction_type, amount, description, status)
  values (v_profile_id, 'MAINTENANCE_PAYMENT', v_order.amount, 'Maintenance payment. Reference: ' || coalesce(v_order.payment_reference, v_order.id::text), 'APPROVED');
  insert into public.notifications(profile_id, title, message, is_read)
  values (v_profile_id, 'Maintenance payment received', 'Your maintenance request is paid and ready for assignment.', false);

  return query select v_order.id, 'PAID'::text, v_next_balance;
end;
$$;

create or replace function public.request_recovery_termination(
  p_tree_id uuid,
  p_reference text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.app_profile_id();
  v_tree_code text;
  v_request_id uuid;
  v_amount constant numeric := 2000;
  v_description text;
begin
  if auth.uid() is null or v_profile_id is null then
    raise exception 'Authentication required';
  end if;

  select tr.tree_code into v_tree_code
  from public.tree_registry tr
  where tr.id = p_tree_id
    and tr.profile_id = v_profile_id
    and upper(coalesce(tr.status, '')) <> 'TERMINATED';

  if v_tree_code is null then
    raise exception 'Tree not found or access denied';
  end if;

  if exists (
    select 1 from public.wallet_transactions wt
    where wt.profile_id = v_profile_id
      and wt.transaction_type = 'RECOVERY_TERMINATION_REQUEST'
      and wt.status = 'PENDING'
      and wt.description like '%TREE_ID:' || p_tree_id::text || '.%'
  ) then
    raise exception 'A recovery request for this tree is already pending';
  end if;

  v_description := 'Recovery Fund termination request ' || left(p_reference, 80)
    || '. TREE_ID:' || p_tree_id::text || '. TREE_CODE:' || v_tree_code
    || '. Customer accepted contract termination notice before submission.';

  insert into public.wallet_transactions(profile_id, transaction_type, amount, description, status)
  values (v_profile_id, 'RECOVERY_TERMINATION_REQUEST', v_amount, v_description, 'PENDING')
  returning id into v_request_id;

  insert into public.wallet_transactions(profile_id, transaction_type, amount, description, status)
  values (
    v_profile_id,
    'SYSTEM_MONEY_RECOVERY_HOLD',
    v_amount,
    'System money hold for ' || left(p_reference, 80) || '. TREE_ID:' || p_tree_id::text
      || '. Pending admin approval; real payout remains manual.',
    'PENDING'
  );

  insert into public.notifications(profile_id, title, message, is_read)
  values (v_profile_id, 'Recovery Fund request submitted', 'Your Recovery Fund request is pending admin review.', false);

  return v_request_id;
end;
$$;

revoke all on function public.create_maintenance_order_with_wallet(uuid, text, text, numeric, text, text) from public, anon;
revoke all on function public.pay_maintenance_order_with_wallet(uuid) from public, anon;
revoke all on function public.request_recovery_termination(uuid, text) from public, anon;
grant execute on function public.create_maintenance_order_with_wallet(uuid, text, text, numeric, text, text) to authenticated;
grant execute on function public.pay_maintenance_order_with_wallet(uuid) to authenticated;
grant execute on function public.request_recovery_termination(uuid, text) to authenticated;

commit;
