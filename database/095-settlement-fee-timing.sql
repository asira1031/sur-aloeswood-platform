-- ONLY SUR dvidrbhfzzhgwyempgtu. No historic ledger rows changed.
-- Prospective fix: fees allocated only when a withdrawal becomes SETTLED.
begin;
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

create or replace function public.sur_withdrawal_fee_allocation_trigger()
returns trigger language plpgsql security definer set search_path=public
as $$
declare p public.profiles%rowtype;
begin
 if upper(coalesce(new.status,'')) <> 'SETTLED' then return new; end if;
 if TG_OP='UPDATE' then
   if upper(coalesce(old.status,''))='SETTLED' then return new; end if;
 end if;
 select * into p from public.profiles where id=new.profile_id;
 perform public.sur_create_tdi_fee_allocation(
   'WITHDRAWAL_PLATFORM_FEE',new.id,new.request_reference,new.profile_id,
   p.full_name,p.email,new.platform_fee);
 return new;
end $$;
drop trigger if exists trg_sur_withdrawal_fee_allocations on public.withdrawal_requests;
create trigger trg_sur_withdrawal_fee_allocations
after insert or update of status on public.withdrawal_requests
for each row execute function public.sur_withdrawal_fee_allocation_trigger();
revoke all on function public.sur_withdrawal_fee_allocation_trigger() from public,anon,authenticated;
commit;
select jsonb_build_object('migration','095-settlement-fee-timing',
 'request_no_longer_allocates_fee',position('sur_create_tdi_fee_allocation' in pg_get_functiondef('public.sur_request_withdrawal(numeric,text,text,text,text)'::regprocedure))=0,
 'historic_rows_unchanged',true) as verification;
-- Read-only reconciliation list: review, do NOT automatically delete or reverse.
select r.id as withdrawal_id,r.status,a.id as allocation_id,a.allocated_amount,a.settlement_status
from public.withdrawal_requests r join public.revenue_allocations a
on a.source_id=r.id and a.source_type='WITHDRAWAL_PLATFORM_FEE'
where upper(coalesce(r.status,'')) <> 'SETTLED';

