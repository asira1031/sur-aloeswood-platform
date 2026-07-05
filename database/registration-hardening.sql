-- SUR Aloeswood registration hardening.
-- Run once in Supabase SQL Editor if registration reports missing profile/wallet columns or RLS policy issues.

create extension if not exists "pgcrypto";

alter table public.profiles
  add column if not exists auth_user_id uuid;

alter table public.profiles
  add column if not exists mobile text;

alter table public.profiles
  add column if not exists mobile_number text;

alter table public.profiles
  add column if not exists address text;

alter table public.profiles
  add column if not exists account_status text default 'PENDING';

alter table public.profiles
  add column if not exists kyc_status text default 'PENDING';

alter table public.profiles
  add column if not exists membership_status text default 'PENDING';

alter table public.profiles
  add column if not exists wallet_balance numeric default 0;

alter table public.profiles
  add column if not exists referral_code text;

alter table public.profiles
  add column if not exists referred_by text;

alter table public.wallets
  add column if not exists profile_id uuid;

alter table public.wallets
  add column if not exists balance numeric default 0;

alter table public.wallets
  add column if not exists updated_at timestamptz default now();

create index if not exists profiles_email_lower_idx on public.profiles (lower(email));
create index if not exists profiles_auth_user_id_idx on public.profiles (auth_user_id);
create index if not exists profiles_referral_code_idx on public.profiles (referral_code);
create index if not exists wallets_profile_id_idx on public.wallets (profile_id);

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;

drop policy if exists "profiles service admin all" on public.profiles;
create policy "profiles service admin all"
  on public.profiles
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "wallets service admin all" on public.wallets;
create policy "wallets service admin all"
  on public.wallets
  for all
  to service_role
  using (true)
  with check (true);

insert into public.wallets (profile_id, balance, updated_at)
select p.id, coalesce(p.wallet_balance, 0), now()
from public.profiles p
where not exists (
  select 1 from public.wallets w where w.profile_id = p.id
);

select
  'registration hardening complete' as status,
  (select count(*) from public.profiles where auth_user_id is null) as profiles_missing_auth_user_id,
  (select count(*) from public.profiles p where not exists (select 1 from public.wallets w where w.profile_id = p.id)) as profiles_missing_wallets;
