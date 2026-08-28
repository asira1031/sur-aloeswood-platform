-- ONLY SUR dvidrbhfzzhgwyempgtu. No files or financial rows deleted.
-- Deploy the WithdrawalReceipt UI with this migration. Old public URLs stop working.
begin;
update storage.buckets set public=false where id in ('withdrawal-proofs','cashin-proofs');
drop policy if exists "sur withdrawal proof read" on storage.objects;
drop policy if exists "sur withdrawal proof upload" on storage.objects;
drop policy if exists "sur cashin proof read" on storage.objects;
drop policy if exists "sur cashin proof upload" on storage.objects;
drop policy if exists "receipt private read" on storage.objects;
drop policy if exists "receipt admin upload" on storage.objects;
create policy "receipt private read" on storage.objects for select to authenticated
using ((bucket_id='withdrawal-proofs' and (public.app_is_admin() or
  (storage.foldername(name))[1]=public.app_profile_id()::text))
  or (bucket_id='cashin-proofs' and public.app_is_admin()));
create policy "receipt admin upload" on storage.objects for insert to authenticated
with check (bucket_id='withdrawal-proofs' and public.app_is_admin());
drop policy if exists "receipt read boundary" on storage.objects;
create policy "receipt read boundary" on storage.objects as restrictive for select to public
using (bucket_id not in ('withdrawal-proofs','cashin-proofs') or
  (auth.uid() is not null and (public.app_is_admin() or
  (bucket_id='withdrawal-proofs' and (storage.foldername(name))[1]=public.app_profile_id()::text))));
drop policy if exists "receipt insert boundary" on storage.objects;
create policy "receipt insert boundary" on storage.objects as restrictive for insert to public
with check (bucket_id not in ('withdrawal-proofs','cashin-proofs') or
  (bucket_id='withdrawal-proofs' and auth.uid() is not null and public.app_is_admin()));
drop policy if exists "receipt immutable update" on storage.objects;
create policy "receipt immutable update" on storage.objects as restrictive for update to public
using (bucket_id not in ('withdrawal-proofs','cashin-proofs'))
with check (bucket_id not in ('withdrawal-proofs','cashin-proofs'));
drop policy if exists "receipt immutable delete" on storage.objects;
create policy "receipt immutable delete" on storage.objects as restrictive for delete to public
using (bucket_id not in ('withdrawal-proofs','cashin-proofs'));
commit;
select jsonb_build_object('migration','094-private-payout-receipts',
 'withdrawal_bucket_private',exists(select 1 from storage.buckets where id='withdrawal-proofs' and not public),
 'legacy_receipts_not_public',not exists(select 1 from storage.buckets where id='cashin-proofs' and public),
 'receipt_boundaries_present',(select count(*)=4 from pg_policies where schemaname='storage' and tablename='objects'
 and permissive='RESTRICTIVE' and policyname in ('receipt read boundary','receipt insert boundary','receipt immutable update','receipt immutable delete'))
) as verification;
