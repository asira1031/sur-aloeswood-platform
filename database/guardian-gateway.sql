-- Run once in Supabase project dvidrbhfzzhgwyempgtu only.
begin;

create table if not exists public.guardian_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  statement_kind text not null check (statement_kind in ('READ', 'WRITE')),
  sql_text text not null,
  succeeded boolean not null default false,
  affected_rows integer,
  error_message text,
  created_at timestamptz not null default now()
);
alter table public.guardian_audit_log enable row level security;

drop policy if exists "guardian audit admin read" on public.guardian_audit_log;
create policy "guardian audit admin read" on public.guardian_audit_log for select to authenticated using (
  exists (select 1 from public.profiles p where p.auth_user_id = auth.uid() and upper(p.role) in ('ADMIN','SUPER_ADMIN') and upper(p.account_status) = 'ACTIVE')
);
drop policy if exists "guardian audit admin insert" on public.guardian_audit_log;
create policy "guardian audit admin insert" on public.guardian_audit_log for insert to authenticated with check (
  actor_user_id = auth.uid() and exists (select 1 from public.profiles p where p.auth_user_id = auth.uid() and upper(p.role) in ('ADMIN','SUPER_ADMIN') and upper(p.account_status) = 'ACTIVE')
);
drop policy if exists "guardian audit admin update" on public.guardian_audit_log;
create policy "guardian audit admin update" on public.guardian_audit_log for update to authenticated using (
  actor_user_id = auth.uid()
) with check (actor_user_id = auth.uid());

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

  insert into public.guardian_audit_log(actor_user_id, statement_kind, sql_text) values (auth.uid(), v_kind, v_sql) returning id into v_audit_id;
  begin
    if v_kind = 'READ' then
      execute 'select coalesce(jsonb_agg(to_jsonb(gq)), ''[]''::jsonb) from (select * from (' || v_sql || ') guardian_inner limit 100) gq' into v_rows;
      v_count := jsonb_array_length(v_rows);
    else
      execute v_sql;
      get diagnostics v_count = row_count;
    end if;
    update public.guardian_audit_log set succeeded = true, affected_rows = v_count where id = v_audit_id;
  exception when others then
    update public.guardian_audit_log set error_message = sqlerrm where id = v_audit_id;
    return jsonb_build_object('ok', false, 'kind', v_kind, 'rowCount', 0, 'rows', '[]'::jsonb, 'auditId', v_audit_id, 'error', sqlerrm);
  end;
  return jsonb_build_object('ok', true, 'kind', v_kind, 'rowCount', v_count, 'rows', v_rows, 'auditId', v_audit_id);
end;
$$;

revoke all on function public.guardian_execute_sql(text, text) from public, anon;
grant execute on function public.guardian_execute_sql(text, text) to authenticated;
grant select, insert, update on public.guardian_audit_log to authenticated;

select jsonb_build_object('migration', 'guardian_gateway_sur_only', 'function', to_regprocedure('public.guardian_execute_sql(text,text)') is not null, 'audit_table', to_regclass('public.guardian_audit_log') is not null) as verification;
commit;
