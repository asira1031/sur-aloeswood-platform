  -- SUR Aloeswood only: dvidrbhfzzhgwyempgtu
  -- Durable, append-only evidence for the no-code Admin Recovery Center.
  begin;

  create table if not exists public.sur_recovery_events (
    id uuid primary key default gen_random_uuid(),
    case_key text not null,
    case_type text not null,
    target_table text not null,
    target_id uuid,
    action text not null,
    outcome text not null check (outcome in ('VERIFIED_SUCCESS','VERIFIED_FAILURE','ESCALATED','OBSERVED')),
    actor_user_id uuid not null,
    detail text,
    before_state jsonb,
    after_state jsonb,
    idempotency_key text not null unique,
    created_at timestamptz not null default now()
  );

  create index if not exists sur_recovery_events_case_created_idx
    on public.sur_recovery_events(case_key, created_at desc);

  alter table public.sur_recovery_events enable row level security;
  drop policy if exists "sur recovery admin read" on public.sur_recovery_events;
  create policy "sur recovery admin read" on public.sur_recovery_events
  for select to authenticated using (public.app_is_admin());

  revoke all on public.sur_recovery_events from public, anon, authenticated;
  grant select on public.sur_recovery_events to authenticated;

  select jsonb_build_object(
    'migration','104-toh-recovery-center',
    'events_table',to_regclass('public.sur_recovery_events') is not null,
    'append_only',not has_table_privilege('authenticated','public.sur_recovery_events','INSERT,UPDATE,DELETE')
  ) as verification;

  commit;
