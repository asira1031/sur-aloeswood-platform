-- SUR Aloeswood plantation farms database.
-- Run once in Supabase SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists public.farms (
  id uuid primary key default gen_random_uuid(),
  farm_name text not null,
  location text,
  gps_coordinates text,
  total_area numeric,
  status text not null default 'ACTIVE',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Existing farms tables may have been created before these columns existed.
alter table public.farms add column if not exists farm_name text;
alter table public.farms add column if not exists location text;
alter table public.farms add column if not exists gps_coordinates text;
alter table public.farms add column if not exists total_area numeric;
alter table public.farms add column if not exists status text not null default 'ACTIVE';
alter table public.farms add column if not exists notes text;
alter table public.farms add column if not exists created_at timestamptz not null default now();
alter table public.farms add column if not exists updated_at timestamptz not null default now();

create index if not exists farms_status_idx on public.farms(status);
create index if not exists farms_created_at_idx on public.farms(created_at desc);

alter table public.farms enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'farms'
      and policyname = 'farms public active select'
  ) then
    create policy "farms public active select"
      on public.farms
      for select
      to anon, authenticated
      using (status = 'ACTIVE' or public.app_is_admin());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'farms'
      and policyname = 'farms admin insert'
  ) then
    create policy "farms admin insert"
      on public.farms
      for insert
      to authenticated
      with check (public.app_is_admin());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'farms'
      and policyname = 'farms admin update'
  ) then
    create policy "farms admin update"
      on public.farms
      for update
      to authenticated
      using (public.app_is_admin())
      with check (public.app_is_admin());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'farms'
      and policyname = 'farms admin delete'
  ) then
    create policy "farms admin delete"
      on public.farms
      for delete
      to authenticated
      using (public.app_is_admin());
  end if;
end $$;

-- Keep tree/location records ready for farm assignment.
alter table if exists public.tree_registry
  add column if not exists farm_id uuid references public.farms(id) on delete set null;

alter table if exists public.tree_registry
  add column if not exists farm_location_note text;

create index if not exists tree_registry_farm_id_idx on public.tree_registry(farm_id);

-- Some farmer pages still read the legacy public.trees table.
-- Keep this non-breaking: only add the column if the table exists and has no farm_id yet.
do $$
begin
  if to_regclass('public.trees') is not null then
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'trees'
        and column_name = 'farm_id'
    ) then
      alter table public.trees add column farm_id text;
    end if;
  end if;
end $$;

-- Real default plantation site from SUR company profile address.
insert into public.farms (farm_name, location, gps_coordinates, total_area, status, notes)
select
  'SUR Aloeswood Main Plantation',
  'Sitio Morales, Centrala, Surallah, South Cotabato',
  null,
  null,
  'ACTIVE',
  'Primary plantation site record. GPS and total area should be filled once verified by admin.'
where not exists (
  select 1
  from public.farms
  where lower(farm_name) = lower('SUR Aloeswood Main Plantation')
);
