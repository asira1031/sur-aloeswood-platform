begin;

alter table public.sur_trees
  add column if not exists nickname text;

alter table public.sur_trees
  drop constraint if exists sur_trees_nickname_length;

alter table public.sur_trees
  add constraint sur_trees_nickname_length
  check (nickname is null or char_length(btrim(nickname)) between 2 and 40);

create or replace function public.sur_rename_own_tree(
  p_tree_id uuid,
  p_nickname text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_clean text := regexp_replace(btrim(coalesce(p_nickname, '')), '\s+', ' ', 'g');
begin
  v_profile_id := public.app_profile_id();
  if v_profile_id is null then
    raise exception 'Authenticated profile not found.';
  end if;
  if char_length(v_clean) < 2 or char_length(v_clean) > 40 then
    raise exception 'Tree nickname must contain 2 to 40 characters.';
  end if;

  update public.sur_trees
  set nickname = v_clean
  where id = p_tree_id
    and profile_id = v_profile_id;

  if not found then
    raise exception 'Tree not found or not owned by the authenticated profile.';
  end if;

  return jsonb_build_object('tree_id', p_tree_id, 'nickname', v_clean);
end;
$$;

revoke all on function public.sur_rename_own_tree(uuid,text) from public;
grant execute on function public.sur_rename_own_tree(uuid,text) to authenticated;

select pg_notify('pgrst', 'reload schema');

commit;

select jsonb_build_object(
  'migration', '085-customer-tree-nickname',
  'nickname_column', exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sur_trees' and column_name = 'nickname'
  ),
  'rename_rpc', to_regprocedure('public.sur_rename_own_tree(uuid,text)') is not null
) as verification;
