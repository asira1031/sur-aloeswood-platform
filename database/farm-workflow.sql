-- SUR Aloeswood connected farm workflow.
-- Run once in Supabase SQL Editor after maintenance-orders.sql and farms.sql.

alter table if exists public.gardener_assignments
  add column if not exists gardener_id uuid;

alter table if exists public.gardener_assignments
  add column if not exists tree_id uuid;

alter table if exists public.gardener_assignments
  add column if not exists status text default 'ASSIGNED';

alter table if exists public.gardener_assignments
  add column if not exists assigned_at timestamptz default now();

alter table if exists public.gardener_assignments
  add column if not exists maintenance_order_id uuid references public.maintenance_orders(id) on delete set null;

alter table if exists public.gardener_assignments
  add column if not exists profile_id uuid references public.profiles(id) on delete set null;

alter table if exists public.gardener_assignments
  add column if not exists tree_code text;

alter table if exists public.gardener_assignments
  add column if not exists task_type text;

alter table if exists public.gardener_assignments
  add column if not exists notes text;

alter table if exists public.gardener_assignments
  add column if not exists updated_at timestamptz default now();

create index if not exists gardener_assignments_order_idx on public.gardener_assignments(maintenance_order_id);
create index if not exists gardener_assignments_profile_idx on public.gardener_assignments(profile_id);
create index if not exists gardener_assignments_tree_idx on public.gardener_assignments(tree_id);

alter table if exists public.tree_growth_logs
  add column if not exists profile_id uuid references public.profiles(id) on delete set null;

alter table if exists public.tree_growth_logs
  add column if not exists tree_code text;

alter table if exists public.tree_growth_logs
  add column if not exists gardener_id uuid;

alter table if exists public.tree_growth_logs
  add column if not exists notes text;

alter table if exists public.tree_growth_logs
  add column if not exists status text default 'LOGGED';

create index if not exists tree_growth_logs_profile_idx on public.tree_growth_logs(profile_id);
create index if not exists tree_growth_logs_gardener_idx on public.tree_growth_logs(gardener_id);

-- Make sure farmer app can read assigned tree_registry records and write logs.
alter table public.gardener_assignments enable row level security;
alter table public.tree_growth_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gardener_assignments'
      and policyname = 'gardener assignments admin all'
  ) then
    create policy "gardener assignments admin all"
      on public.gardener_assignments
      for all
      to authenticated
      using (public.app_is_admin())
      with check (public.app_is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gardener_assignments'
      and policyname = 'gardener assignments farmer select'
  ) then
    create policy "gardener assignments farmer select"
      on public.gardener_assignments
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.gardeners g
          where g.id = gardener_assignments.gardener_id
            and lower(g.email) = lower((auth.jwt() ->> 'email'))
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tree_growth_logs'
      and policyname = 'tree growth logs admin all'
  ) then
    create policy "tree growth logs admin all"
      on public.tree_growth_logs
      for all
      to authenticated
      using (public.app_is_admin())
      with check (public.app_is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tree_growth_logs'
      and policyname = 'tree growth logs farmer insert'
  ) then
    create policy "tree growth logs farmer insert"
      on public.tree_growth_logs
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.gardeners g
          where g.id = tree_growth_logs.gardener_id
            and lower(g.email) = lower((auth.jwt() ->> 'email'))
        )
      );
  end if;
end $$;
