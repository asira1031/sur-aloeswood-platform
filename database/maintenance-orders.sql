-- SUR Aloeswood paid tree maintenance orders.
-- Run once in Supabase SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists public.maintenance_orders (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  tree_id uuid not null references public.tree_registry(id) on delete cascade,
  tree_code text,
  service_type text not null,
  plan_type text not null,
  amount numeric not null default 0,
  payment_status text not null default 'PENDING_PAYMENT',
  work_status text not null default 'PENDING_PAYMENT',
  payment_reference text,
  customer_note text,
  admin_note text,
  assigned_gardener_id uuid,
  paid_at timestamptz,
  assigned_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists maintenance_orders_profile_idx on public.maintenance_orders(profile_id);
create index if not exists maintenance_orders_tree_idx on public.maintenance_orders(tree_id);
create index if not exists maintenance_orders_payment_status_idx on public.maintenance_orders(payment_status);
create index if not exists maintenance_orders_work_status_idx on public.maintenance_orders(work_status);

alter table public.maintenance_orders enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'maintenance_orders'
      and policyname = 'maintenance orders admin select'
  ) then
    create policy "maintenance orders admin select"
      on public.maintenance_orders
      for select
      to authenticated
      using (public.app_is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'maintenance_orders'
      and policyname = 'maintenance orders admin insert'
  ) then
    create policy "maintenance orders admin insert"
      on public.maintenance_orders
      for insert
      to authenticated
      with check (public.app_is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'maintenance_orders'
      and policyname = 'maintenance orders admin update'
  ) then
    create policy "maintenance orders admin update"
      on public.maintenance_orders
      for update
      to authenticated
      using (public.app_is_admin())
      with check (public.app_is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'maintenance_orders'
      and policyname = 'maintenance orders owner select'
  ) then
    create policy "maintenance orders owner select"
      on public.maintenance_orders
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.profiles p
          where p.id = maintenance_orders.profile_id
            and p.auth_user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'maintenance_orders'
      and policyname = 'maintenance orders owner insert'
  ) then
    create policy "maintenance orders owner insert"
      on public.maintenance_orders
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.profiles p
          where p.id = maintenance_orders.profile_id
            and p.auth_user_id = auth.uid()
        )
      );
  end if;
end $$;
