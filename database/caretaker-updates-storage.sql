-- SUR Aloeswood caretaker field photo storage.
-- Private bucket for farmer/caretaker proof photos.
-- Run once in Supabase SQL Editor.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'caretaker-updates',
  'caretaker-updates',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'caretaker updates authenticated read'
  ) then
    create policy "caretaker updates authenticated read"
      on storage.objects
      for select
      to authenticated
      using (bucket_id = 'caretaker-updates');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'caretaker updates authenticated upload'
  ) then
    create policy "caretaker updates authenticated upload"
      on storage.objects
      for insert
      to authenticated
      with check (bucket_id = 'caretaker-updates');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'caretaker updates authenticated update'
  ) then
    create policy "caretaker updates authenticated update"
      on storage.objects
      for update
      to authenticated
      using (bucket_id = 'caretaker-updates')
      with check (bucket_id = 'caretaker-updates');
  end if;
end $$;
