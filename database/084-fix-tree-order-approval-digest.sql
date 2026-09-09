-- Repair existing SUR installations where pgcrypto lives in the extensions schema.
begin;

create extension if not exists pgcrypto with schema extensions;

alter function public.sur_admin_approve_tree_order(uuid, text)
  set search_path = public, extensions;

-- Replace the unqualified digest call while preserving the installed function body.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.sur_admin_approve_tree_order(uuid,text)'::regprocedure
  ) into v_definition;

  if position('extensions.digest' in v_definition) = 0 then
    v_definition := replace(
      v_definition,
      'digest(gen_random_uuid()::text,''sha256'')',
      'extensions.digest(gen_random_uuid()::text,''sha256''::text)'
    );
    execute v_definition;
  end if;
end
$$;

select jsonb_build_object(
  'migration', '084-fix-tree-order-approval-digest',
  'function_fixed', position(
    'extensions.digest' in pg_get_functiondef(
      'public.sur_admin_approve_tree_order(uuid,text)'::regprocedure
    )
  ) > 0
) as verification;

commit;
