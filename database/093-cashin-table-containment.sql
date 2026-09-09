-- SUR ONLY: dvidrbhfzzhgwyempgtu. Apply after 091.
-- No records deleted or balances changed.
-- Cash-in creation and direct edits remain paused, including for browser admins.
-- Existing owner/admin history stays readable. Does not fix receipt storage.
begin;
alter table public.cashin_requests enable row level security;
revoke all on table public.cashin_requests from public, anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.cashin_requests from authenticated;
grant select on table public.cashin_requests to authenticated;

-- Replace only this table's policies, using the exact live table identity.
do $$
declare rule record;
begin
  for rule in select policyname from pg_policies
    where schemaname='public' and tablename='cashin_requests'
  loop
    execute format('drop policy %I on public.cashin_requests',rule.policyname);
  end loop;
end $$;

create policy "cashin scoped history" on public.cashin_requests
for select to authenticated
using (profile_id=public.app_profile_id() or public.app_is_admin());

-- Restrictive policies also defend against accidental permissive policies later.
create policy "cashin history boundary" on public.cashin_requests
as restrictive for select to public
using (auth.uid() is not null and
  (profile_id=public.app_profile_id() or public.app_is_admin()));
create policy "cashin insert paused" on public.cashin_requests
as restrictive for insert to public with check (false);
create policy "cashin update paused" on public.cashin_requests
as restrictive for update to public using (false) with check (false);
create policy "cashin delete paused" on public.cashin_requests
as restrictive for delete to public using (false);
commit;

select jsonb_build_object(
 'migration','093-cashin-table-containment',
 'rls_enabled',(select relrowsecurity from pg_class where oid='public.cashin_requests'::regclass),
 'open_policies_removed',not exists(select 1 from pg_policies
   where schemaname='public' and tablename='cashin_requests' and policyname like '%open%'),
 'restrictive_guards_present',(select count(*)=4 from pg_policies
   where schemaname='public' and tablename='cashin_requests'
   and permissive='RESTRICTIVE' and policyname in
   ('cashin history boundary','cashin insert paused','cashin update paused','cashin delete paused')),
 'cashin_creation_and_review_paused',true,
 'storage_privacy_fixed',false
) as verification;
