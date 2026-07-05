-- SUR Aloeswood caretaker field photo storage.
-- Safer setup: private bucket, authenticated access only.
-- Run once in Supabase SQL Editor.

insert into storage.buckets (id, name, public)
values ('caretaker-updates', 'caretaker-updates', false)
on conflict (id) do update set public = false;

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
