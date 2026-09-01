-- ONLY dvidrbhfzzhgwyempgtu. Deploy the matching private-upload/view code with this migration.
-- Legacy public resume links stop working. Admin can still open preserved files through signed links.
begin;
set local lock_timeout='5s';
update storage.buckets set public=false,file_size_limit=10485760,
 allowed_mime_types=array['image/jpeg','image/png','image/webp'] where id='farmer-resumes';
update storage.buckets set public=false where id='caretaker-updates';
drop policy if exists "farmer resumes anon upload" on storage.objects;
drop policy if exists "farmer resumes public read" on storage.objects;
drop policy if exists "caretaker updates authenticated insert" on storage.objects;
drop policy if exists "caretaker updates authenticated upload" on storage.objects;
drop policy if exists "caretaker updates authenticated read" on storage.objects;
drop policy if exists "caretaker updates authenticated update" on storage.objects;
drop policy if exists "private resume upload" on storage.objects;
create policy "private resume upload" on storage.objects for insert to authenticated with check(
 bucket_id='farmer-resumes' and (public.app_is_admin() or (
 (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.profiles p
 where p.auth_user_id=auth.uid() and upper(coalesce(p.account_status,''))='ACTIVE'
 and upper(coalesce(p.kyc_status,''))='APPROVED'))));
drop policy if exists "private resume read" on storage.objects;
create policy "private resume read" on storage.objects for select to authenticated using(
 (bucket_id='farmer-resumes' and (public.app_is_admin() or (storage.foldername(name))[1]=auth.uid()::text))
 or (bucket_id='caretaker-updates' and public.app_is_admin()));
-- Restrictive boundaries stop future or unrelated permissive policies reopening these buckets.
drop policy if exists "caretaker document read boundary" on storage.objects;
create policy "caretaker document read boundary" on storage.objects as restrictive for select to public using(
 bucket_id not in ('farmer-resumes','caretaker-updates') or
 (auth.uid() is not null and (public.app_is_admin() or
 (bucket_id='farmer-resumes' and (storage.foldername(name))[1]=auth.uid()::text))));
drop policy if exists "caretaker document insert boundary" on storage.objects;
create policy "caretaker document insert boundary" on storage.objects as restrictive for insert to public with check(
 bucket_id not in ('farmer-resumes','caretaker-updates') or (bucket_id='farmer-resumes'
 and auth.uid() is not null and (public.app_is_admin() or ((storage.foldername(name))[1]=auth.uid()::text
 and exists(select 1 from public.profiles p where p.auth_user_id=auth.uid()
 and upper(coalesce(p.account_status,''))='ACTIVE' and upper(coalesce(p.kyc_status,''))='APPROVED')))));
drop policy if exists "caretaker document immutable update" on storage.objects;
create policy "caretaker document immutable update" on storage.objects as restrictive for update to public
 using(bucket_id not in ('farmer-resumes','caretaker-updates')) with check(bucket_id not in ('farmer-resumes','caretaker-updates'));
drop policy if exists "caretaker document immutable delete" on storage.objects;
create policy "caretaker document immutable delete" on storage.objects as restrictive for delete to public
 using(bucket_id not in ('farmer-resumes','caretaker-updates'));
commit;
select jsonb_build_object('migration','102-private-caretaker-resumes',
 'resumes_private',exists(select 1 from storage.buckets where id='farmer-resumes' and not public),
 'legacy_evidence_private',exists(select 1 from storage.buckets where id='caretaker-updates' and not public),
 'anonymous_upload_removed',not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='farmer resumes anon upload'),
 'read_boundary_present',exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='caretaker document read boundary' and permissive='RESTRICTIVE')
) as verification;
