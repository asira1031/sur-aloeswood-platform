-- ONLY project dvidrbhfzzhgwyempgtu. Apply after 099.
-- Based on release_gap_precheck supplied 2026-08-28.
-- No balances, allocations, files, or profile values are changed.
begin;
set local lock_timeout='5s';
do $$ begin
 if to_regprocedure('public.sur_admin_review_allocations(uuid[],jsonb,text,text,text)') is null then
  raise exception 'Apply 099-allocation-review-rpc.sql first';
 end if;
end $$;

create or replace function public.app_user_profile_id()
returns uuid language sql stable security definer set search_path=public as $$
 select public.app_profile_id();
$$;
create or replace function public.sur_current_profile_id()
returns uuid language sql stable security definer set search_path=public as $$
 select public.app_profile_id();
$$;
create or replace function public.sur_is_admin()
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles p where p.auth_user_id=auth.uid()
  and upper(coalesce(p.role,''))='ADMIN'
  and upper(coalesce(p.account_status,''))='ACTIVE');
$$;
revoke all on function public.app_user_profile_id() from public,anon;
revoke all on function public.sur_current_profile_id() from public,anon;
revoke all on function public.sur_is_admin() from public,anon;
grant execute on function public.app_user_profile_id() to authenticated;
grant execute on function public.sur_current_profile_id() to authenticated;
grant execute on function public.sur_is_admin() to authenticated;

drop policy if exists "revenue allocations admin write temporary" on public.revenue_allocations;
drop policy if exists "revenue allocations authenticated update temporary" on public.revenue_allocations;
drop policy if exists "revenue allocations authenticated read temporary" on public.revenue_allocations;
alter table public.revenue_allocations enable row level security;
revoke all on public.revenue_allocations from public,anon;
revoke insert,update,delete on public.revenue_allocations from authenticated;
grant select on public.revenue_allocations to authenticated;
drop policy if exists "allocation admin read" on public.revenue_allocations;
create policy "allocation admin read" on public.revenue_allocations
 for select to authenticated using(public.app_is_admin());
drop policy if exists "allocation read boundary" on public.revenue_allocations;
create policy "allocation read boundary" on public.revenue_allocations
 as restrictive for select to authenticated using(public.app_is_admin());
drop policy if exists "allocation direct insert denied" on public.revenue_allocations;
create policy "allocation direct insert denied" on public.revenue_allocations
 as restrictive for insert to authenticated with check(false);
drop policy if exists "allocation direct delete denied" on public.revenue_allocations;
create policy "allocation direct delete denied" on public.revenue_allocations
 as restrictive for delete to authenticated using(false);

-- Invoker trigger protects direct browser updates without blocking the reviewed
-- SECURITY DEFINER KYC resubmission RPC or trusted server registration.
create or replace function public.sur_guard_direct_profile_identity()
returns trigger language plpgsql security invoker set search_path=public as $$
declare field text;
begin
 if current_user in ('anon','authenticated') and not public.app_is_admin() then
  foreach field in array array['id','auth_user_id','email','role','account_status',
   'kyc_status','membership_status','wallet_balance','balance',
   'kyc_id_url','kyc_document_url','valid_id_url','kyc_extra_url',
   'kyc_selfie_url','kyc_photo_url','selfie_url','kyc_submitted_at','kyc_updated_at'] loop
   if (to_jsonb(new)->field) is distinct from (to_jsonb(old)->field) then
    raise exception 'Identity, verification and financial fields require an authorized workflow';
   end if;
  end loop;
  if upper(coalesce(old.kyc_status,''))='APPROVED'
   and (to_jsonb(new)->'full_name') is distinct from (to_jsonb(old)->'full_name') then
   raise exception 'Verified legal name changes require support and KYC resubmission';
  end if;
 end if;
 return new;
end $$;
revoke all on function public.sur_guard_direct_profile_identity() from public,anon,authenticated;
drop trigger if exists sur_guard_direct_profile_identity on public.profiles;
create trigger sur_guard_direct_profile_identity before update on public.profiles
 for each row execute function public.sur_guard_direct_profile_identity();
notify pgrst,'reload schema';
commit;

select jsonb_build_object(
 'migration','101-verified-identity-allocation-boundaries',
 'email_fallback_removed',not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('app_user_profile_id','sur_current_profile_id','sur_is_admin')
  and pg_get_functiondef(p.oid) ilike '%jwt()%'),
 'temporary_finance_policies_removed',not exists(select 1 from pg_policies where schemaname='public'
  and tablename='revenue_allocations' and policyname in ('revenue allocations admin write temporary',
   'revenue allocations authenticated update temporary','revenue allocations authenticated read temporary')),
 'admin_read_boundary',exists(select 1 from pg_policies where schemaname='public'
  and tablename='revenue_allocations' and policyname='allocation read boundary' and permissive='RESTRICTIVE'),
 'kyc_direct_update_guard',exists(select 1 from pg_trigger where tgrelid='public.profiles'::regclass
  and tgname='sur_guard_direct_profile_identity' and tgenabled='O')
) as verification;
