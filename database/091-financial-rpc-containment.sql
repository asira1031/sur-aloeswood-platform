-- URGENT CONTAINMENT. Run ONLY in SUR project dvidrbhfzzhgwyempgtu.
-- Does not change balances or delete records.
-- Temporarily disables browser cash-in review until session-based review is hardened.
-- Internal SECURITY DEFINER callers retain their owner's privileges.
begin;

revoke execute on function public.sur_apply_wallet_delta(uuid,numeric,text,text,text)
  from public, anon, authenticated;
revoke execute on function public.sur_create_tdi_fee_allocation(text,uuid,text,uuid,text,text,numeric)
  from public, anon, authenticated;

revoke execute on function public.sur_admin_verify_cashin_by_email(text,uuid)
  from public, anon, authenticated;
revoke execute on function public.sur_admin_reject_cashin_by_email(text,uuid,text)
  from public, anon, authenticated;
revoke execute on function public.sur_admin_verify_cashin(uuid)
  from public, anon, authenticated;
revoke execute on function public.sur_admin_reject_cashin(uuid,text)
  from public, anon, authenticated;

-- Abort rather than reporting success if inherited grants still expose an RPC.
do $$
declare target regprocedure; role_name text;
begin
  foreach target in array array[
    'public.sur_apply_wallet_delta(uuid,numeric,text,text,text)'::regprocedure,
    'public.sur_create_tdi_fee_allocation(text,uuid,text,uuid,text,text,numeric)'::regprocedure,
    'public.sur_admin_verify_cashin_by_email(text,uuid)'::regprocedure,
    'public.sur_admin_reject_cashin_by_email(text,uuid,text)'::regprocedure,
    'public.sur_admin_verify_cashin(uuid)'::regprocedure,
    'public.sur_admin_reject_cashin(uuid,text)'::regprocedure
  ] loop
    foreach role_name in array array['anon','authenticated'] loop
      if has_function_privilege(role_name,target,'EXECUTE') then
        raise exception 'Containment failed: % can execute %',role_name,target;
      end if;
    end loop;
  end loop;
end $$;
commit;

select jsonb_build_object(
  'migration','091-financial-rpc-containment',
  'wallet_direct_calls_blocked',
    not has_function_privilege('anon','public.sur_apply_wallet_delta(uuid,numeric,text,text,text)','EXECUTE')
    and not has_function_privilege('authenticated','public.sur_apply_wallet_delta(uuid,numeric,text,text,text)','EXECUTE'),
  'cashin_review_temporarily_disabled',
    not has_function_privilege('authenticated','public.sur_admin_verify_cashin(uuid)','EXECUTE'),
  'storage_privacy_fixed',false
) as verification;
