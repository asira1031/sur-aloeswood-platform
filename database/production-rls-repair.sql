-- SUR Aloeswood production RLS repair
-- Run once in Supabase SQL Editor after schema changes.
-- Goal: fix registration/profile RLS errors while keeping finance allocations admin-only.

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

alter table public.profiles
  add column if not exists auth_user_id uuid;

create or replace function public.app_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and upper(coalesce(p.role, '')) = 'ADMIN'
      and upper(coalesce(p.account_status, 'ACTIVE')) = 'ACTIVE'
  );
$$;

create or replace function public.app_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.profiles p
  where p.auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.app_user_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

grant execute on function public.app_is_admin() to anon, authenticated;
grant execute on function public.app_profile_id() to anon, authenticated;
grant execute on function public.app_user_email() to anon, authenticated;

-- Repair active profiles with missing wallets.
insert into public.wallets (profile_id, balance, updated_at)
select p.id, coalesce(p.wallet_balance, 0), now()
from public.profiles p
where upper(coalesce(p.account_status, '')) = 'ACTIVE'
  and not exists (
    select 1 from public.wallets w where w.profile_id = p.id
  );

-- Keep profile wallet_balance aligned when wallet row exists.
update public.profiles p
set wallet_balance = coalesce(w.balance, 0)
from public.wallets w
where w.profile_id = p.id
  and coalesce(p.wallet_balance, 0) <> coalesce(w.balance, 0);

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.notifications enable row level security;
alter table public.cashin_requests enable row level security;
alter table public.withdrawal_requests enable row level security;
alter table public.seedling_purchases enable row level security;
alter table public.tree_registry enable row level security;
alter table public.tree_growth_logs enable row level security;
alter table public.gardeners enable row level security;
alter table public.gardener_assignments enable row level security;
alter table public.maintenance_orders enable row level security;
alter table public.support_chats enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_tickets enable row level security;
alter table public.revenue_allocations enable row level security;

drop policy if exists "profiles admin all" on public.profiles;
drop policy if exists "profiles owner select" on public.profiles;
drop policy if exists "profiles owner update" on public.profiles;
drop policy if exists "profiles authenticated insert own" on public.profiles;
drop policy if exists "profiles anon register insert" on public.profiles;

create policy "profiles admin all"
  on public.profiles
  for all
  to authenticated
  using (public.app_is_admin())
  with check (public.app_is_admin());

create policy "profiles owner select"
  on public.profiles
  for select
  to authenticated
  using (auth_user_id = auth.uid());

create policy "profiles owner update"
  on public.profiles
  for update
  to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

create policy "profiles authenticated insert own"
  on public.profiles
  for insert
  to authenticated
  with check (
    auth_user_id = auth.uid()
    and upper(coalesce(role, 'COPLANTER')) in ('COPLANTER', 'INVESTOR', 'FARMER', 'GARDENER', 'CARETAKER')
  );

-- Public registration fallback. API routes should still use service role.
create policy "profiles anon register insert"
  on public.profiles
  for insert
  to anon
  with check (
    upper(coalesce(role, 'COPLANTER')) in ('COPLANTER', 'INVESTOR')
    and upper(coalesce(account_status, 'PENDING')) in ('PENDING', 'ACTIVE')
  );

drop policy if exists "wallets admin all" on public.wallets;
drop policy if exists "wallets owner select" on public.wallets;
drop policy if exists "wallets owner update" on public.wallets;
drop policy if exists "wallets owner insert" on public.wallets;

create policy "wallets admin all"
  on public.wallets
  for all
  to authenticated
  using (public.app_is_admin())
  with check (public.app_is_admin());

create policy "wallets owner select"
  on public.wallets
  for select
  to authenticated
  using (profile_id = public.app_profile_id());

create policy "wallets owner update"
  on public.wallets
  for update
  to authenticated
  using (profile_id = public.app_profile_id())
  with check (profile_id = public.app_profile_id());

create policy "wallets owner insert"
  on public.wallets
  for insert
  to authenticated
  with check (profile_id = public.app_profile_id() or public.app_is_admin());

drop policy if exists "wallet tx admin all" on public.wallet_transactions;
drop policy if exists "wallet tx owner select" on public.wallet_transactions;
drop policy if exists "wallet tx owner insert" on public.wallet_transactions;

create policy "wallet tx admin all"
  on public.wallet_transactions
  for all
  to authenticated
  using (public.app_is_admin())
  with check (public.app_is_admin());

create policy "wallet tx owner select"
  on public.wallet_transactions
  for select
  to authenticated
  using (profile_id = public.app_profile_id());

create policy "wallet tx owner insert"
  on public.wallet_transactions
  for insert
  to authenticated
  with check (profile_id = public.app_profile_id() or public.app_is_admin());

drop policy if exists "notifications admin all" on public.notifications;
drop policy if exists "notifications owner select" on public.notifications;
drop policy if exists "notifications owner update" on public.notifications;
drop policy if exists "notifications authenticated insert" on public.notifications;

create policy "notifications admin all"
  on public.notifications
  for all
  to authenticated
  using (public.app_is_admin())
  with check (public.app_is_admin());

create policy "notifications owner select"
  on public.notifications
  for select
  to authenticated
  using (profile_id = public.app_profile_id());

create policy "notifications owner update"
  on public.notifications
  for update
  to authenticated
  using (profile_id = public.app_profile_id() or public.app_is_admin())
  with check (profile_id = public.app_profile_id() or public.app_is_admin());

create policy "notifications authenticated insert"
  on public.notifications
  for insert
  to authenticated
  with check (true);

drop policy if exists "cashin admin all" on public.cashin_requests;
drop policy if exists "cashin owner select" on public.cashin_requests;
drop policy if exists "cashin owner insert" on public.cashin_requests;

create policy "cashin admin all"
  on public.cashin_requests
  for all
  to authenticated
  using (public.app_is_admin())
  with check (public.app_is_admin());

create policy "cashin owner select"
  on public.cashin_requests
  for select
  to authenticated
  using (profile_id = public.app_profile_id());

create policy "cashin owner insert"
  on public.cashin_requests
  for insert
  to authenticated
  with check (profile_id = public.app_profile_id());

drop policy if exists "withdrawals admin all" on public.withdrawal_requests;
drop policy if exists "withdrawals owner select" on public.withdrawal_requests;
drop policy if exists "withdrawals owner insert" on public.withdrawal_requests;

create policy "withdrawals admin all"
  on public.withdrawal_requests
  for all
  to authenticated
  using (public.app_is_admin())
  with check (public.app_is_admin());

create policy "withdrawals owner select"
  on public.withdrawal_requests
  for select
  to authenticated
  using (profile_id = public.app_profile_id());

create policy "withdrawals owner insert"
  on public.withdrawal_requests
  for insert
  to authenticated
  with check (profile_id = public.app_profile_id());

drop policy if exists "seedling purchases admin all" on public.seedling_purchases;
drop policy if exists "seedling purchases owner select" on public.seedling_purchases;
drop policy if exists "seedling purchases owner insert" on public.seedling_purchases;

create policy "seedling purchases admin all"
  on public.seedling_purchases
  for all
  to authenticated
  using (public.app_is_admin())
  with check (public.app_is_admin());

create policy "seedling purchases owner select"
  on public.seedling_purchases
  for select
  to authenticated
  using (profile_id = public.app_profile_id());

create policy "seedling purchases owner insert"
  on public.seedling_purchases
  for insert
  to authenticated
  with check (profile_id = public.app_profile_id());

drop policy if exists "tree registry admin all" on public.tree_registry;
drop policy if exists "tree registry owner select" on public.tree_registry;
drop policy if exists "tree registry farmer select assigned" on public.tree_registry;

create policy "tree registry admin all"
  on public.tree_registry
  for all
  to authenticated
  using (public.app_is_admin())
  with check (public.app_is_admin());

create policy "tree registry owner select"
  on public.tree_registry
  for select
  to authenticated
  using (profile_id = public.app_profile_id());

create policy "tree registry farmer select assigned"
  on public.tree_registry
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.gardeners g
      join public.gardener_assignments ga on ga.gardener_id = g.id
      where ga.tree_id = tree_registry.id
        and lower(g.email) = public.app_user_email()
    )
  );

drop policy if exists "gardeners admin all" on public.gardeners;
drop policy if exists "gardeners own select" on public.gardeners;
drop policy if exists "gardeners own update" on public.gardeners;
drop policy if exists "gardeners public insert" on public.gardeners;

create policy "gardeners admin all"
  on public.gardeners
  for all
  to authenticated
  using (public.app_is_admin())
  with check (public.app_is_admin());

create policy "gardeners own select"
  on public.gardeners
  for select
  to authenticated
  using (lower(email) = public.app_user_email());

create policy "gardeners own update"
  on public.gardeners
  for update
  to authenticated
  using (lower(email) = public.app_user_email())
  with check (lower(email) = public.app_user_email());

create policy "gardeners public insert"
  on public.gardeners
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "gardener assignments admin all" on public.gardener_assignments;
drop policy if exists "gardener assignments farmer select" on public.gardener_assignments;
drop policy if exists "gardener assignments farmer update" on public.gardener_assignments;

create policy "gardener assignments admin all"
  on public.gardener_assignments
  for all
  to authenticated
  using (public.app_is_admin())
  with check (public.app_is_admin());

create policy "gardener assignments farmer select"
  on public.gardener_assignments
  for select
  to authenticated
  using (
    exists (
      select 1 from public.gardeners g
      where g.id = gardener_assignments.gardener_id
        and lower(g.email) = public.app_user_email()
    )
  );

create policy "gardener assignments farmer update"
  on public.gardener_assignments
  for update
  to authenticated
  using (
    exists (
      select 1 from public.gardeners g
      where g.id = gardener_assignments.gardener_id
        and lower(g.email) = public.app_user_email()
    )
  )
  with check (
    exists (
      select 1 from public.gardeners g
      where g.id = gardener_assignments.gardener_id
        and lower(g.email) = public.app_user_email()
    )
  );

drop policy if exists "maintenance orders admin all" on public.maintenance_orders;
drop policy if exists "maintenance orders owner select" on public.maintenance_orders;
drop policy if exists "maintenance orders owner insert" on public.maintenance_orders;
drop policy if exists "maintenance orders owner update" on public.maintenance_orders;
drop policy if exists "maintenance orders farmer update assigned" on public.maintenance_orders;

create policy "maintenance orders admin all"
  on public.maintenance_orders
  for all
  to authenticated
  using (public.app_is_admin())
  with check (public.app_is_admin());

create policy "maintenance orders owner select"
  on public.maintenance_orders
  for select
  to authenticated
  using (profile_id = public.app_profile_id());

create policy "maintenance orders owner insert"
  on public.maintenance_orders
  for insert
  to authenticated
  with check (profile_id = public.app_profile_id());

create policy "maintenance orders owner update"
  on public.maintenance_orders
  for update
  to authenticated
  using (profile_id = public.app_profile_id())
  with check (profile_id = public.app_profile_id());

create policy "maintenance orders farmer update assigned"
  on public.maintenance_orders
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.gardeners g
      join public.gardener_assignments ga on ga.gardener_id = g.id
      where ga.maintenance_order_id = maintenance_orders.id
        and lower(g.email) = public.app_user_email()
    )
  )
  with check (
    exists (
      select 1
      from public.gardeners g
      join public.gardener_assignments ga on ga.gardener_id = g.id
      where ga.maintenance_order_id = maintenance_orders.id
        and lower(g.email) = public.app_user_email()
    )
  );

drop policy if exists "tree growth logs admin all" on public.tree_growth_logs;
drop policy if exists "tree growth logs owner select" on public.tree_growth_logs;
drop policy if exists "tree growth logs farmer insert" on public.tree_growth_logs;
drop policy if exists "tree growth logs farmer select assigned" on public.tree_growth_logs;

create policy "tree growth logs admin all"
  on public.tree_growth_logs
  for all
  to authenticated
  using (public.app_is_admin())
  with check (public.app_is_admin());

create policy "tree growth logs owner select"
  on public.tree_growth_logs
  for select
  to authenticated
  using (profile_id = public.app_profile_id());

create policy "tree growth logs farmer select assigned"
  on public.tree_growth_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.gardeners g
      join public.gardener_assignments ga on ga.gardener_id = g.id
      where ga.tree_id = tree_growth_logs.tree_id
        and lower(g.email) = public.app_user_email()
    )
  );

create policy "tree growth logs farmer insert"
  on public.tree_growth_logs
  for insert
  to authenticated
  with check (
    public.app_is_admin()
    or profile_id = public.app_profile_id()
    or exists (
      select 1
      from public.gardeners g
      join public.gardener_assignments ga on ga.gardener_id = g.id
      where ga.tree_id = tree_growth_logs.tree_id
        and lower(g.email) = public.app_user_email()
    )
  );

drop policy if exists "support chats admin all" on public.support_chats;
drop policy if exists "support chats owner all" on public.support_chats;
drop policy if exists "support messages admin all" on public.support_messages;
drop policy if exists "support messages owner all" on public.support_messages;
drop policy if exists "support tickets admin all" on public.support_tickets;
drop policy if exists "support tickets owner all" on public.support_tickets;

create policy "support chats admin all"
  on public.support_chats
  for all
  to authenticated
  using (public.app_is_admin())
  with check (public.app_is_admin());

create policy "support chats owner all"
  on public.support_chats
  for all
  to authenticated
  using (profile_id = public.app_profile_id())
  with check (profile_id = public.app_profile_id());

create policy "support messages admin all"
  on public.support_messages
  for all
  to authenticated
  using (public.app_is_admin())
  with check (public.app_is_admin());

create policy "support messages owner all"
  on public.support_messages
  for all
  to authenticated
  using (profile_id = public.app_profile_id())
  with check (profile_id = public.app_profile_id());

create policy "support tickets admin all"
  on public.support_tickets
  for all
  to authenticated
  using (public.app_is_admin())
  with check (public.app_is_admin());

create policy "support tickets owner all"
  on public.support_tickets
  for all
  to authenticated
  using (profile_id = public.app_profile_id())
  with check (profile_id = public.app_profile_id());

drop policy if exists "revenue allocations admin all" on public.revenue_allocations;
drop policy if exists "revenue allocations block investors" on public.revenue_allocations;

create policy "revenue allocations admin all"
  on public.revenue_allocations
  for all
  to authenticated
  using (public.app_is_admin())
  with check (public.app_is_admin());

-- No investor policy for revenue_allocations by design.

select
  'RLS repair complete' as status,
  (select count(*) from public.profiles where upper(coalesce(account_status, '')) = 'ACTIVE') as active_profiles,
  (select count(*) from public.profiles p where upper(coalesce(p.account_status, '')) = 'ACTIVE' and not exists (select 1 from public.wallets w where w.profile_id = p.id)) as active_profiles_missing_wallets;
