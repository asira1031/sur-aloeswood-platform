-- SUR Aloeswood dual-mode caretaker evidence access
-- Allows an ACTIVE, verified gardeners record to upload evidence while the
-- same profiles row remains the customer's ownership and wallet identity.
-- Safe to re-run after 082-tree-care-operations.sql.
begin;

drop policy if exists "sur evidence caretaker upload" on storage.objects;
create policy "sur evidence caretaker upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'sur-tree-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.profiles p
      join public.gardeners g
        on lower(trim(g.email)) = lower(trim(p.email))
      where p.auth_user_id = auth.uid()
        and upper(coalesce(p.account_status, '')) = 'ACTIVE'
        and upper(coalesce(g.status, '')) in ('ACTIVE', 'APPROVED')
    )
  );

notify pgrst, 'reload schema';
commit;

select jsonb_build_object(
  'migration', '086-dual-mode-caretaker-evidence',
  'evidence_bucket', exists(select 1 from storage.buckets where id = 'sur-tree-evidence'),
  'upload_policy', exists(
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'sur evidence caretaker upload'
  )
) as verification;
