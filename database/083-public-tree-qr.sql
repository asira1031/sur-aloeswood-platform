-- SUR Aloeswood privacy-safe public Tree ID verification for physical QR tags
-- Apply after 082-tree-care-operations.sql. Safe to re-run.
begin;

create or replace function public.sur_public_tree_lookup(p_tree_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'found', true,
    'tree_id', t.tree_id,
    'species', t.species,
    'status', case
      when t.status = 'AWAITING_CUSTOMER_SIGNATURE' then 'REGISTRATION_PENDING'
      when t.status like 'ACTIVE%' then 'ACTIVE'
      when t.status = 'PLANTED_ACTIVE' then 'PLANTED_ACTIVE'
      else t.status
    end,
    'registered_on', t.created_at::date,
    'planted_on', t.planted_at,
    'qr_verified', true,
    'privacy', 'Customer, caretaker, contract, payment, and farm details are private.'
  )
  from public.sur_trees t
  where upper(t.tree_id) = upper(trim(p_tree_id))
  limit 1;
$$;

revoke all on function public.sur_public_tree_lookup(text) from public;
grant execute on function public.sur_public_tree_lookup(text) to anon, authenticated;

notify pgrst, 'reload schema';

commit;

select jsonb_build_object(
  'migration', '083-public-tree-qr',
  'lookup_rpc', to_regprocedure('public.sur_public_tree_lookup(text)') is not null
) as verification;
