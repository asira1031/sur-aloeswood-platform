-- SUR Aloeswood secure per-tree contract signing and order rejection
-- Apply after 080-final-blueprint-core.sql. Safe to re-run.
begin;

-- Customers must never update arbitrary contract columns directly. Signing is
-- performed only by the audited SECURITY DEFINER function below.
drop policy if exists "contracts owner sign" on public.sur_contracts;
revoke update on public.sur_contracts from authenticated;

create or replace function public.sur_sign_tree_contract(
  p_contract_id uuid,
  p_signature text,
  p_terms_accepted boolean,
  p_risk_accepted boolean,
  p_external_sale_accepted boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.app_profile_id();
  v_contract public.sur_contracts%rowtype;
  v_tree public.sur_trees%rowtype;
  v_signature text := trim(regexp_replace(coalesce(p_signature, ''), '\s+', ' ', 'g'));
  v_legal_name text;
begin
  if auth.uid() is null or v_profile_id is null then
    raise exception 'Authentication required';
  end if;

  if not coalesce(p_terms_accepted, false)
     or not coalesce(p_risk_accepted, false)
     or not coalesce(p_external_sale_accepted, false) then
    raise exception 'All contract acknowledgements are required';
  end if;

  if length(v_signature) < 2 or length(v_signature) > 200 then
    raise exception 'Enter your complete legal name';
  end if;

  select * into v_contract
  from public.sur_contracts c
  where c.id = p_contract_id
    and c.profile_id = v_profile_id
  for update;

  if v_contract.id is null then
    raise exception 'Contract not found or access denied';
  end if;

  if v_contract.status <> 'CUSTOMER_SIGNATURE_PENDING' then
    raise exception 'This contract is no longer awaiting your signature';
  end if;

  select trim(regexp_replace(coalesce(p.full_name, ''), '\s+', ' ', 'g'))
  into v_legal_name
  from public.profiles p
  where p.id = v_profile_id;

  if lower(v_signature) <> lower(v_legal_name)
     or lower(v_signature) <> lower(trim(regexp_replace(v_contract.legal_name, '\s+', ' ', 'g'))) then
    raise exception 'Signature must exactly match your verified legal name';
  end if;

  select * into v_tree
  from public.sur_trees t
  where t.id = v_contract.tree_id
    and t.profile_id = v_profile_id
  for update;

  if v_tree.id is null then
    raise exception 'Tree record not found or access denied';
  end if;

  update public.sur_contracts
  set status = 'CUSTOMER_SIGNED',
      customer_signature = v_signature,
      customer_signed_at = now()
  where id = v_contract.id;

  update public.sur_trees
  set status = 'ACTIVE_AWAITING_FARM_ASSIGNMENT',
      activated_at = coalesce(activated_at, now())
  where id = v_tree.id;

  insert into public.sur_operation_audit(
    actor_profile_id, action, resource_type, resource_id, old_value,
    new_value, reason, request_key
  ) values (
    v_profile_id,
    'CUSTOMER_CONTRACT_SIGNED',
    'TREE_CONTRACT',
    v_contract.id::text,
    jsonb_build_object('status', v_contract.status),
    jsonb_build_object(
      'status', 'CUSTOMER_SIGNED',
      'tree_id', v_tree.tree_id,
      'version', v_contract.version,
      'acknowledgements', jsonb_build_object(
        'terms', true,
        'risk', true,
        'external_sale', true
      )
    ),
    'Customer signed with the legal name stored on the approved profile.',
    'CONTRACT-SIGN:' || v_contract.id::text
  );

  return jsonb_build_object(
    'contract_id', v_contract.id,
    'tree_id', v_tree.tree_id,
    'contract_status', 'CUSTOMER_SIGNED',
    'tree_status', 'ACTIVE_AWAITING_FARM_ASSIGNMENT',
    'signed_at', now()
  );
end;
$$;

create or replace function public.sur_admin_reject_tree_order(
  p_order_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.sur_tree_orders%rowtype;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if not public.app_is_admin() then
    raise exception 'Active admin required';
  end if;

  if length(v_reason) < 5 or length(v_reason) > 500 then
    raise exception 'A clear rejection reason is required';
  end if;

  select * into v_order
  from public.sur_tree_orders
  where id = p_order_id
  for update;

  if v_order.id is null then
    raise exception 'Order not found';
  end if;

  if v_order.status not in ('PENDING_VERIFICATION', 'MANUAL_REVIEW') then
    raise exception 'Order is already finalized';
  end if;

  update public.sur_tree_orders
  set status = 'REJECTED',
      review_reason = v_reason,
      reviewed_by = public.app_profile_id(),
      reviewed_at = now()
  where id = v_order.id;

  insert into public.sur_operation_audit(
    actor_profile_id, action, resource_type, resource_id, old_value,
    new_value, reason, request_key
  ) values (
    public.app_profile_id(),
    'ORDER_REJECTED',
    'TREE_ORDER',
    v_order.id::text,
    jsonb_build_object('status', v_order.status),
    jsonb_build_object('status', 'REJECTED'),
    v_reason,
    'REJECT:' || v_order.id::text
  );

  return jsonb_build_object('order_id', v_order.id, 'status', 'REJECTED');
end;
$$;

revoke all on function public.sur_sign_tree_contract(uuid,text,boolean,boolean,boolean) from public, anon;
revoke all on function public.sur_admin_reject_tree_order(uuid,text) from public, anon;
grant execute on function public.sur_sign_tree_contract(uuid,text,boolean,boolean,boolean) to authenticated;
grant execute on function public.sur_admin_reject_tree_order(uuid,text) to authenticated;

notify pgrst, 'reload schema';

commit;

select jsonb_build_object(
  'migration', '081-secure-contract-signing',
  'signing_rpc', to_regprocedure('public.sur_sign_tree_contract(uuid,text,boolean,boolean,boolean)') is not null,
  'rejection_rpc', to_regprocedure('public.sur_admin_reject_tree_order(uuid,text)') is not null
) as verification;
