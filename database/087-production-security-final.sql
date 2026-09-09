-- SUR Aloeswood final production security gate.
-- Authorized target ONLY: dvidrbhfzzhgwyempgtu.
-- Check the SQL Editor project reference before running; table names do NOT prove identity.
-- Run after earlier migrations. Do not reapply old permissive repair/demo scripts.
-- Reviewed against the owner's security_precheck on 2026-08-27.
begin;
set local lock_timeout = '5s';
-- Registration is server-owned. Authenticated admin policies and service-role
-- registration remain available. Remove ALL observed permissive alternatives;
-- adding a strict policy alone does not close another permissive policy.
drop policy if exists "profiles demo public insert" on public.profiles;
drop policy if exists "profiles anon register insert" on public.profiles;
drop policy if exists "profiles authenticated insert own" on public.profiles;
drop policy if exists "profiles authenticated insert own profile" on public.profiles;
drop policy if exists "profiles authenticated own insert" on public.profiles;
drop policy if exists "profiles insert own coplanter" on public.profiles;
drop policy if exists "profiles update own email auth or admin" on public.profiles;
drop policy if exists "sur farmer profiles readable for assignment" on public.profiles;
drop policy if exists "profiles select own email auth or admin" on public.profiles;
drop policy if exists "gardeners readable for app" on public.gardeners;
drop policy if exists "sur gardeners readable for app" on public.gardeners;
drop policy if exists "sur gardeners insert for app sync" on public.gardeners;
drop policy if exists "sur gardeners update for app sync" on public.gardeners;
drop policy if exists "gardeners update self or admin" on public.gardeners;
drop policy if exists "wallets authenticated insert own wallet" on public.wallets;
drop policy if exists "wallets authenticated own insert" on public.wallets;
drop policy if exists "wallets insert own or admin" on public.wallets;
drop policy if exists "wallets public signup insert" on public.wallets;
drop policy if exists "wallet tx insert own request or admin" on public.wallet_transactions;
drop policy if exists "support messages insert chat owner or admin" on public.support_messages;
drop policy if exists "support tickets update own or admin" on public.support_tickets;
drop policy if exists "support chats update own or admin" on public.support_chats;

-- Explicitly enable RLS on the tables covered by this repair.
alter table public.profiles enable row level security;
alter table public.gardeners enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.support_chats enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_tickets enable row level security;
alter table public.guardian_audit_log enable row level security;
-- Prevent profile owners from changing authorization and account-control fields.
create or replace function public.app_profile_sensitive_fields_unchanged(
  p_profile_id uuid,
  p_auth_user_id uuid,
  p_role text,
  p_account_status text,
  p_kyc_status text,
  p_membership_status text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles existing
    where existing.id = p_profile_id
      and existing.auth_user_id is not distinct from p_auth_user_id
      and existing.role is not distinct from p_role
      and existing.account_status is not distinct from p_account_status
      and existing.kyc_status is not distinct from p_kyc_status
      and existing.membership_status is not distinct from p_membership_status
  );
$$;

revoke all on function public.app_profile_sensitive_fields_unchanged(uuid, uuid, text, text, text, text) from public;
grant execute on function public.app_profile_sensitive_fields_unchanged(uuid, uuid, text, text, text, text) to authenticated;

drop policy if exists "profiles owner update" on public.profiles;
drop policy if exists "profiles owner update safe fields" on public.profiles;
create policy "profiles owner update safe fields"
  on public.profiles
  for update
  to authenticated
  using (auth_user_id = auth.uid())
  with check (
    auth_user_id = auth.uid()
    and public.app_profile_sensitive_fields_unchanged(
      id,
      auth_user_id,
      role,
      account_status,
      kyc_status,
      membership_status
    )
  );

-- Customers must never mutate balances or forge ledger rows.
drop policy if exists "wallets owner update" on public.wallets;
drop policy if exists "wallets owner insert" on public.wallets;
drop policy if exists "wallet tx owner insert" on public.wallet_transactions;

-- Notifications may only be created for the current profile or by Admin.
drop policy if exists "notifications authenticated insert" on public.notifications;
drop policy if exists "notifications owner insert" on public.notifications;
create policy "notifications owner insert" on public.notifications
  for insert to authenticated
  with check (profile_id = public.app_profile_id() or public.app_is_admin());

-- Caretaker applications must use the authenticated server endpoint.
drop policy if exists "gardeners public insert" on public.gardeners;
drop policy if exists "gardeners own update" on public.gardeners;

-- Sent support messages are records: owners can read and append, not edit/delete.
drop policy if exists "support chats owner select" on public.support_chats;
drop policy if exists "support chats owner insert" on public.support_chats;
drop policy if exists "support chats owner update queue" on public.support_chats;
drop policy if exists "support messages owner select" on public.support_messages;
drop policy if exists "support messages owner insert" on public.support_messages;
drop policy if exists "support tickets owner select" on public.support_tickets;
drop policy if exists "support tickets owner insert" on public.support_tickets;
drop policy if exists "support chats owner all" on public.support_chats;
drop policy if exists "support messages owner all" on public.support_messages;
drop policy if exists "support tickets owner all" on public.support_tickets;
create policy "support chats owner select" on public.support_chats for select to authenticated
  using (profile_id = public.app_profile_id());
create policy "support chats owner insert" on public.support_chats for insert to authenticated
  with check (profile_id = public.app_profile_id());
create policy "support chats owner update queue" on public.support_chats for update to authenticated
  using (profile_id = public.app_profile_id())
  with check (profile_id = public.app_profile_id() and status = 'ADMIN_QUEUE');
create policy "support messages owner select" on public.support_messages for select to authenticated
  using (exists(select 1 from public.support_chats c where c.id = chat_id and c.profile_id = public.app_profile_id()));
create policy "support messages owner insert" on public.support_messages for insert to authenticated
  with check (profile_id = public.app_profile_id() and sender_role = 'CUSTOMER'
    and exists(select 1 from public.support_chats c where c.id = chat_id and c.profile_id = public.app_profile_id()));
create policy "support tickets owner select" on public.support_tickets for select to authenticated
  using (profile_id = public.app_profile_id());
create policy "support tickets owner insert" on public.support_tickets for insert to authenticated
  with check (profile_id = public.app_profile_id());

-- Guardian logs are append-only to app users. The function records execution.
create or replace function public.guardian_append_audit(p_kind text, p_sql text, p_ok boolean, p_count integer, p_error text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.app_is_admin() then raise exception 'Active admin required'; end if;
  insert into public.guardian_audit_log(actor_user_id, statement_kind, sql_text, succeeded, affected_rows, error_message)
  values(auth.uid(), p_kind, p_sql, p_ok, p_count, p_error) returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.guardian_append_audit(text,text,boolean,integer,text) from public, anon;
grant execute on function public.guardian_append_audit(text,text,boolean,integer,text) to authenticated;

create or replace function public.guardian_execute_sql(p_sql text, p_confirmation text default null)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_sql text := btrim(coalesce(p_sql, ''));
  v_kind text;
  v_rows jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_audit_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.auth_user_id = auth.uid() and upper(p.role) in ('ADMIN','SUPER_ADMIN') and upper(p.account_status) = 'ACTIVE'
  ) then raise exception 'Active SUR admin access is required.'; end if;
  if length(v_sql) = 0 or length(v_sql) > 12000 then raise exception 'SQL must contain 1 to 12,000 characters.'; end if;
  if right(v_sql, 1) = ';' then v_sql := btrim(left(v_sql, length(v_sql) - 1)); end if;
  if v_sql ~ ';|--|/\*|\*/|\$\$' then raise exception 'Multiple statements, comments, and dollar quoting are blocked.'; end if;
  if v_sql ~* '\m(auth|storage|vault|extensions|realtime|pg_catalog|information_schema)\s*\.' then raise exception 'Only the SUR public schema is allowed.'; end if;
  if v_sql ~* '\m(drop|truncate|alter|create|grant|revoke|comment|vacuum|analyze|reindex|cluster|copy|do|call|execute|prepare|deallocate|listen|notify|set|reset|show)\M' then raise exception 'Blocked SQL capability.'; end if;
  if v_sql ~* '\m(pg_|dblink|lo_|current_setting|set_config|http_|net\.)' or v_sql ~* '\mfor\s+(update|share)\M' then raise exception 'Blocked system or locking capability.'; end if;
  if v_sql ~* '\mreturning\M' then raise exception 'RETURNING is blocked; verify with a separate SELECT.'; end if;

  if v_sql ~* '^select\s' then v_kind := 'READ';
  elsif v_sql ~* '^(insert|update|delete)\s' then v_kind := 'WRITE';
  else raise exception 'Only SELECT, INSERT, UPDATE, or DELETE is allowed.'; end if;
  if v_kind = 'WRITE' and coalesce(p_confirmation, '') <> 'EXECUTE SUR WRITE' then raise exception 'Exact write confirmation is required.'; end if;

  begin
    if v_kind = 'READ' then
      execute 'select coalesce(jsonb_agg(to_jsonb(gq)), ''[]''::jsonb) from (select * from (' || v_sql || ') guardian_inner limit 100) gq' into v_rows;
      v_count := jsonb_array_length(v_rows);
    else
      execute v_sql;
      get diagnostics v_count = row_count;
    end if;
    v_audit_id := public.guardian_append_audit(v_kind, v_sql, true, v_count, null);
  exception when others then
    v_audit_id := public.guardian_append_audit(v_kind, v_sql, false, 0, sqlerrm);
    return jsonb_build_object('ok', false, 'kind', v_kind, 'rowCount', 0, 'rows', '[]'::jsonb, 'auditId', v_audit_id, 'error', sqlerrm);
  end;
  return jsonb_build_object('ok', true, 'kind', v_kind, 'rowCount', v_count, 'rows', v_rows, 'auditId', v_audit_id);
end;
$$;
drop policy if exists "guardian audit admin insert" on public.guardian_audit_log;
drop policy if exists "guardian audit admin update" on public.guardian_audit_log;
revoke insert, update, delete on public.guardian_audit_log from authenticated;

-- Dual-mode caretaker authorization and rejected-report resubmission.
create or replace function public.sur_admin_assign_tree_caretaker(
  p_tree_id uuid,
  p_caretaker_profile_id uuid,
  p_general_location text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tree public.sur_trees%rowtype;
  v_caretaker public.profiles%rowtype;
  v_assignment uuid;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_location text := nullif(trim(coalesce(p_general_location, '')), '');
begin
  if not public.app_is_admin() then raise exception 'Active admin required'; end if;

  select * into v_tree from public.sur_trees where id = p_tree_id for update;
  if v_tree.id is null then raise exception 'Tree not found'; end if;
  if v_tree.status = 'AWAITING_CUSTOMER_SIGNATURE' then
    raise exception 'Customer signature is required before farm assignment';
  end if;

  select * into v_caretaker
  from public.profiles p
  where p.id = p_caretaker_profile_id
    and exists(select 1 from public.gardeners g where lower(trim(g.email)) = lower(trim(p.email)) and upper(coalesce(g.status,'')) in ('ACTIVE','APPROVED'))
    and upper(coalesce(p.account_status, '')) = 'ACTIVE';
  if v_caretaker.id is null then raise exception 'Select an active farm or caretaker profile'; end if;

  insert into public.sur_tree_assignments(
    tree_id, caretaker_profile_id, status, admin_note, assigned_by
  ) values (
    v_tree.id, v_caretaker.id, 'ASSIGNED', v_note, public.app_profile_id()
  )
  on conflict (tree_id) do update set
    caretaker_profile_id = excluded.caretaker_profile_id,
    status = 'ASSIGNED',
    admin_note = excluded.admin_note,
    assigned_by = excluded.assigned_by,
    assigned_at = now(),
    updated_at = now()
  returning id into v_assignment;

  update public.sur_trees
  set caretaker_profile_id = v_caretaker.id,
      general_location = coalesce(v_location, general_location),
      status = 'ACTIVE_ASSIGNED'
  where id = v_tree.id;

  insert into public.sur_operation_audit(
    actor_profile_id, action, resource_type, resource_id, old_value, new_value, reason
  ) values (
    public.app_profile_id(),
    'TREE_CARETAKER_ASSIGNED',
    'TREE',
    v_tree.id::text,
    jsonb_build_object('caretaker_profile_id', v_tree.caretaker_profile_id, 'status', v_tree.status),
    jsonb_build_object('caretaker_profile_id', v_caretaker.id, 'status', 'ACTIVE_ASSIGNED'),
    v_note
  );

  return jsonb_build_object(
    'assignment_id', v_assignment,
    'tree_id', v_tree.tree_id,
    'caretaker_profile_id', v_caretaker.id,
    'status', 'ASSIGNED'
  );
end;
$$;

create or replace function public.sur_submit_daily_tree_update(
  p_tree_id uuid,
  p_health_status text,
  p_notes text,
  p_photo_path text,
  p_observed_on date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.app_profile_id();
  v_assignment public.sur_tree_assignments%rowtype;
  v_update uuid;
  v_health text := upper(trim(coalesce(p_health_status, '')));
  v_notes text := trim(coalesce(p_notes, ''));
  v_photo text := trim(coalesce(p_photo_path, ''));
begin
  if auth.uid() is null or v_profile_id is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.profiles p join public.gardeners g on lower(trim(g.email)) = lower(trim(p.email)) where p.id = v_profile_id and upper(p.account_status) = 'ACTIVE' and upper(g.status) in ('ACTIVE','APPROVED')) then raise exception 'Active verified caretaker required'; end if;
  if v_health not in ('HEALTHY','NEEDS_ATTENTION','TREATMENT','DAMAGED','REPLACEMENT_REVIEW') then
    raise exception 'Invalid health status';
  end if;
  if length(v_notes) < 3 or length(v_notes) > 1500 then raise exception 'A clear field note is required'; end if;
  if p_observed_on is null or p_observed_on > current_date or (p_observed_on < current_date - 2 and not exists(select 1 from public.sur_tree_updates u where u.tree_id = p_tree_id and u.caretaker_profile_id = v_profile_id and u.observed_on = p_observed_on and u.status = 'REJECTED')) then
    raise exception 'Observation date must be today or within the last two days';
  end if;
  if v_photo = '' or v_photo not like auth.uid()::text || '/%' then
    raise exception 'Photo path must belong to the signed-in caretaker';
  end if;

  select * into v_assignment
  from public.sur_tree_assignments a
  where a.tree_id = p_tree_id
    and a.caretaker_profile_id = v_profile_id
    and a.status in ('ASSIGNED','IN_PROGRESS')
  for update;
  if v_assignment.id is null then raise exception 'Active tree assignment not found'; end if;

  if exists (
    select 1 from public.sur_tree_updates u
    where u.assignment_id = v_assignment.id
      and u.observed_on = p_observed_on
      and u.status in ('PENDING_ADMIN_REVIEW','APPROVED')
  ) then
    raise exception 'An update for this tree and date is already pending or approved';
  end if;

  insert into public.sur_tree_updates(
    tree_id, assignment_id, caretaker_profile_id, observed_on,
    health_status, notes, photo_path
  ) values (
    p_tree_id, v_assignment.id, v_profile_id, p_observed_on,
    v_health, v_notes, v_photo
  ) returning id into v_update;

  update public.sur_tree_assignments
  set status = 'IN_PROGRESS', updated_at = now()
  where id = v_assignment.id;

  insert into public.sur_operation_audit(
    actor_profile_id, action, resource_type, resource_id, new_value, request_key
  ) values (
    v_profile_id,
    'DAILY_TREE_UPDATE_SUBMITTED',
    'TREE_UPDATE',
    v_update::text,
    jsonb_build_object('tree_id', p_tree_id, 'observed_on', p_observed_on, 'health_status', v_health),
    'TREE-UPDATE:' || v_update::text
  );

  return jsonb_build_object('update_id', v_update, 'status', 'PENDING_ADMIN_REVIEW');
end;
$$;
create table if not exists public.sur_api_rate_limits (
  bucket_key text primary key,
  request_count integer not null default 0,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.sur_api_rate_limits enable row level security;
revoke all on public.sur_api_rate_limits from public, anon, authenticated;

create or replace function public.sur_consume_api_rate_limit(
  p_bucket_key text, p_limit integer, p_window_seconds integer
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row public.sur_api_rate_limits%rowtype; v_now timestamptz := now();
begin
  if length(trim(coalesce(p_bucket_key,''))) < 3 or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate-limit request';
  end if;
  insert into public.sur_api_rate_limits(bucket_key,request_count,reset_at)
  values(p_bucket_key,1,v_now + make_interval(secs => p_window_seconds))
  on conflict(bucket_key) do update set
    request_count = case when sur_api_rate_limits.reset_at <= v_now then 1 else sur_api_rate_limits.request_count + 1 end,
    reset_at = case when sur_api_rate_limits.reset_at <= v_now then v_now + make_interval(secs => p_window_seconds) else sur_api_rate_limits.reset_at end,
    updated_at = v_now
  returning * into v_row;
  return jsonb_build_object('allowed',v_row.request_count <= p_limit,'count',v_row.request_count,'reset_at',v_row.reset_at);
end; $$;
revoke all on function public.sur_consume_api_rate_limit(text,integer,integer) from public, anon, authenticated;
grant execute on function public.sur_consume_api_rate_limit(text,integer,integer) to service_role;

notify pgrst, 'reload schema';
commit;

select jsonb_build_object(
  'migration','087-production-security-final',
  'observed_unsafe_policies_removed',not exists(
    select 1 from pg_policies
    where schemaname = 'public' and (tablename,policyname) in (
      ('profiles','profiles demo public insert'),
      ('profiles','profiles anon register insert'),
      ('profiles','profiles authenticated insert own'),
      ('profiles','profiles authenticated insert own profile'),
      ('profiles','profiles authenticated own insert'),
      ('profiles','profiles insert own coplanter'),
      ('profiles','profiles update own email auth or admin'),
      ('profiles','sur farmer profiles readable for assignment'),
      ('profiles','profiles select own email auth or admin'),
      ('gardeners','gardeners readable for app'),
      ('gardeners','sur gardeners readable for app'),
      ('gardeners','sur gardeners insert for app sync'),
      ('gardeners','sur gardeners update for app sync'),
      ('gardeners','gardeners update self or admin'),
      ('wallets','wallets authenticated insert own wallet'),
      ('wallets','wallets authenticated own insert'),
      ('wallets','wallets insert own or admin'),
      ('wallets','wallets public signup insert'),
      ('wallet_transactions','wallet tx insert own request or admin'),
      ('support_messages','support messages insert chat owner or admin'),
      ('support_tickets','support tickets update own or admin'),
      ('support_chats','support chats update own or admin')
    )
  ),
  'covered_tables_rls_enabled',(
    select count(*) = 8 and bool_and(c.relrowsecurity)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in (
      'profiles','gardeners','wallets','wallet_transactions',
      'support_chats','support_messages','support_tickets','guardian_audit_log'
    )
  ),
  'wallet_owner_update_removed',not exists(select 1 from pg_policies where schemaname='public' and tablename='wallets' and policyname='wallets owner update'),
  'wallet_tx_owner_insert_removed',not exists(select 1 from pg_policies where schemaname='public' and tablename='wallet_transactions' and policyname='wallet tx owner insert'),
  'guardian_append_only',not has_table_privilege('authenticated','public.guardian_audit_log','UPDATE'),
  'durable_rate_limit',to_regprocedure('public.sur_consume_api_rate_limit(text,integer,integer)') is not null
) as verification;
