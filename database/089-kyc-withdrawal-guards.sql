-- ONLY dvidrbhfzzhgwyempgtu. Manually confirm SQL Editor project.
-- Apply with updated app code; legacy public KYC URLs will stop working.
-- Does not delete documents or change existing balances.
begin;
set local lock_timeout='5s';
update storage.buckets set public=false where id='kyc-docs';
drop policy if exists "sur kyc docs read" on storage.objects;
drop policy if exists "sur kyc docs upload" on storage.objects;
drop policy if exists "sur kyc docs update" on storage.objects;
drop policy if exists "sur kyc private read" on storage.objects;
drop policy if exists "sur kyc private upload" on storage.objects;
create policy "sur kyc private read" on storage.objects for select to authenticated
using(bucket_id='kyc-docs' and (public.app_is_admin() or (storage.foldername(name))[1]=public.app_profile_id()::text));
create policy "sur kyc private upload" on storage.objects for insert to authenticated
with check(bucket_id='kyc-docs' and (storage.foldername(name))[1]=public.app_profile_id()::text);
CREATE OR REPLACE FUNCTION public.sur_request_withdrawal(p_amount numeric, p_payout_method text, p_payout_account_name text, p_payout_account_number text, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_profile public.profiles%rowtype;
  v_balance numeric := 0;
  v_fee numeric;
  v_net numeric;
  v_request_id uuid;
  v_tx_id uuid;
  v_reference text;
begin
  if auth.uid() is null then raise exception 'Login required'; end if;
  if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount < 100 or p_amount > 50000 or p_amount <> round(p_amount,2) then raise exception 'Amount must be PHP 100 to 50000, with at most two decimals'; end if;
  if upper(coalesce(p_payout_method,'')) not in ('MAYA','GCASH','BANK') or nullif(trim(p_payout_account_name),'') is null or nullif(trim(p_payout_account_number),'') is null then raise exception 'Valid payout details required'; end if;
  select *
  into v_profile
  from public.profiles
  where auth_user_id = auth.uid()
  limit 1;

  if not found then
    raise exception 'Login profile not found.';
  end if;

  if upper(coalesce(v_profile.account_status,'')) <> 'ACTIVE' then raise exception 'Active account required'; end if;
  perform 1 from public.wallets where profile_id=v_profile.id for update;
  if (select count(*) from public.wallets where profile_id=v_profile.id) <> 1 then raise exception 'Wallet requires admin reconciliation'; end if;
  if upper(coalesce(v_profile.kyc_status, '')) <> 'APPROVED' then
    raise exception 'KYC approval is required before withdrawal.';
  end if;

  select coalesce(balance, 0)
  into v_balance
  from public.wallets
  where profile_id = v_profile.id
  order by updated_at desc nulls last
  limit 1;

  if coalesce(v_balance, 0) < p_amount then
    raise exception 'Insufficient wallet balance.';
  end if;

  v_fee := public.sur_platform_fee(p_amount);
  v_net := p_amount - v_fee;
  v_reference := 'WD-' || extract(epoch from now())::bigint || '-' || substr(gen_random_uuid()::text, 1, 8);

  v_tx_id := public.sur_apply_wallet_delta(
    v_profile.id,
    -p_amount,
    'WITHDRAW_REQUEST',
    'Withdrawal requested. Gross ' || p_amount || ', platform fee ' || v_fee || ', net payout ' || v_net || '. Reference: ' || v_reference,
    'PENDING_REVIEW'
  );

  insert into public.withdrawal_requests (
    profile_id, amount, platform_fee, net_amount, payout_method, payout_account_name,
    payout_account_number, status, request_reference, admin_notes, wallet_transaction_id, requested_at
  )
  values (
    v_profile.id, p_amount, v_fee, v_net, p_payout_method, p_payout_account_name,
    p_payout_account_number, 'PENDING_REVIEW', v_reference, p_notes, v_tx_id, now()
  )
  returning id into v_request_id;

  perform public.sur_create_tdi_fee_allocation(
    'WITHDRAWAL_PLATFORM_FEE', v_request_id, v_reference, v_profile.id,
    v_profile.full_name, v_profile.email, v_fee
  );

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'notifications') then
    insert into public.notifications (profile_id, title, message, is_read, created_at)
    values (
      v_profile.id,
      'Withdrawal request received',
      'Your withdrawal is pending admin settlement. Reference: ' || v_reference,
      false,
      now()
    );
  end if;

  return jsonb_build_object('withdrawal_request_id', v_request_id, 'request_reference', v_reference, 'status', 'PENDING_REVIEW');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.sur_admin_settle_withdrawal(p_withdrawal_request_id uuid, p_settlement_reference text, p_proof_url text, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r public.withdrawal_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'Login required'; end if;
  if not public.app_is_admin() then
    raise exception 'Only active admin accounts can settle withdrawals.';
  end if;

  select *
  into r
  from public.withdrawal_requests
  where id = p_withdrawal_request_id
  for update;

  if not found then
    raise exception 'Withdrawal request not found.';
  end if;

  if upper(coalesce(r.status, '')) = 'SETTLED' then
    return jsonb_build_object('status', 'ALREADY_SETTLED');
  end if;

  if nullif(trim(coalesce(p_settlement_reference, '')), '') is null then
    raise exception 'Settlement reference is required.';
  end if;

  if nullif(trim(coalesce(p_proof_url, '')), '') is null then
    raise exception 'Withdrawal settlement proof is required.';
  end if;

  if upper(coalesce(r.status,'')) <> 'PENDING_REVIEW' then raise exception 'Only pending requests can be processed'; end if;
  update public.withdrawal_requests
  set status = 'SETTLED',
      settlement_reference = p_settlement_reference,
      proof_url = p_proof_url,
      receipt_url = p_proof_url,
      admin_notes = p_notes,
      settled_by = public.sur_current_profile_id(),
      settled_at = now()
  where id = r.id;

  update public.wallet_transactions
  set status = 'SETTLED',
      description = coalesce(description, '') || ' Settlement reference: ' || p_settlement_reference
  where id = r.wallet_transaction_id;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'notifications') then
    insert into public.notifications (profile_id, title, message, is_read, created_at)
    values (
      r.profile_id,
      'Withdrawal settled',
      'Your withdrawal has been sent. Settlement reference: ' || p_settlement_reference,
      false,
      now()
    );
  end if;

  return jsonb_build_object('status', 'SETTLED', 'proof_url', p_proof_url);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.sur_admin_reject_withdrawal(p_withdrawal_request_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r public.withdrawal_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'Login required'; end if;
  if not public.app_is_admin() then
    raise exception 'Only active admin accounts can reject withdrawals.';
  end if;

  select *
  into r
  from public.withdrawal_requests
  where id = p_withdrawal_request_id
  for update;

  if not found then
    raise exception 'Withdrawal request not found.';
  end if;

  if upper(coalesce(r.status, '')) in ('SETTLED', 'REJECTED') then
    return jsonb_build_object('status', r.status);
  end if;

  if upper(coalesce(r.status,'')) <> 'PENDING_REVIEW' then raise exception 'Only pending requests can be rejected'; end if;
  perform public.sur_apply_wallet_delta(
    r.profile_id,
    r.amount,
    'WITHDRAW_REFUND',
    'Withdrawal rejected and reserved amount returned. Reference: ' || coalesce(r.request_reference, r.id::text),
    'COMPLETED'
  );

  if upper(coalesce(r.status,'')) <> 'PENDING_REVIEW' then raise exception 'Only pending requests can be processed'; end if;
  update public.withdrawal_requests
  set status = 'REJECTED',
      admin_notes = p_reason,
      rejected_at = now()
  where id = r.id;

  update public.wallet_transactions
  set status = 'REJECTED'
  where id = r.wallet_transaction_id;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'notifications') then
    insert into public.notifications (profile_id, title, message, is_read, created_at)
    values (
      r.profile_id,
      'Withdrawal rejected',
      'Your withdrawal was rejected and the reserved wallet amount was returned.',
      false,
      now()
    );
  end if;

  return jsonb_build_object('status', 'REJECTED_REFUNDED');
end;
$function$
;

revoke all on function public.sur_admin_settle_withdrawal_by_email(text,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.sur_admin_reject_withdrawal_by_email(text,uuid,text) from public,anon,authenticated;
revoke all on function public.customer_resubmit_withdrawal_request(uuid,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.admin_review_withdrawal_request_guarded(uuid,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.sur_request_withdrawal(numeric,text,text,text,text) from public,anon;
grant execute on function public.sur_request_withdrawal(numeric,text,text,text,text) to authenticated;
revoke all on function public.sur_admin_settle_withdrawal(uuid,text,text,text) from public,anon;
grant execute on function public.sur_admin_settle_withdrawal(uuid,text,text,text) to authenticated;
revoke all on function public.sur_admin_reject_withdrawal(uuid,text) from public,anon;
grant execute on function public.sur_admin_reject_withdrawal(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
select jsonb_build_object('migration','089-kyc-withdrawal-guards','kyc_private',exists(select 1 from storage.buckets where id='kyc-docs' and not public),'legacy_email_settlement_blocked',not has_function_privilege('authenticated','public.sur_admin_settle_withdrawal_by_email(text,uuid,text,text,text)','EXECUTE')) as verification;
