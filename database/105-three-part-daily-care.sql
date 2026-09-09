-- SUR Aloeswood: morning, afternoon, and evening caretaker reports
-- Apply after 104. Safe to re-run.
begin;

alter table public.sur_tree_updates
  add column if not exists care_period text,
  add column if not exists started_at time,
  add column if not exists task_done text;

update public.sur_tree_updates
set care_period = coalesce(care_period, 'MORNING'),
    started_at = coalesce(started_at, created_at::time),
    task_done = coalesce(nullif(trim(task_done), ''), notes)
where care_period is null or started_at is null or task_done is null;

alter table public.sur_tree_updates
  alter column care_period set default 'MORNING',
  alter column care_period set not null,
  alter column started_at set not null,
  alter column task_done set not null;

alter table public.sur_tree_updates drop constraint if exists sur_tree_updates_care_period_check;
alter table public.sur_tree_updates add constraint sur_tree_updates_care_period_check
  check (care_period in ('MORNING','AFTERNOON','EVENING'));

create index if not exists sur_tree_updates_daily_period_idx
  on public.sur_tree_updates(assignment_id, observed_on, care_period, status);

drop function if exists public.sur_submit_daily_tree_update(uuid,text,text,text,date);
create function public.sur_submit_daily_tree_update(
  p_tree_id uuid,
  p_health_status text,
  p_notes text,
  p_photo_path text,
  p_observed_on date,
  p_care_period text,
  p_started_at time,
  p_task_done text
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
  v_period text := upper(trim(coalesce(p_care_period, '')));
  v_task text := trim(coalesce(p_task_done, ''));
  v_notes text := trim(coalesce(p_notes, ''));
  v_photo text := trim(coalesce(p_photo_path, ''));
begin
  if auth.uid() is null or v_profile_id is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.profiles p join public.gardeners g on lower(trim(g.email)) = lower(trim(p.email)) where p.id = v_profile_id and upper(p.account_status) = 'ACTIVE' and upper(g.status) in ('ACTIVE','APPROVED')) then raise exception 'Active verified caretaker required'; end if;
  if v_period not in ('MORNING','AFTERNOON','EVENING') then raise exception 'Choose Morning, Afternoon, or Evening'; end if;
  if p_started_at is null then raise exception 'Start time is required'; end if;
  if length(v_task) < 3 or length(v_task) > 500 then raise exception 'Describe the completed task'; end if;
  if v_health not in ('HEALTHY','NEEDS_ATTENTION','TREATMENT','DAMAGED','REPLACEMENT_REVIEW') then raise exception 'Invalid health status'; end if;
  if length(v_notes) > 1500 then raise exception 'Notes are too long'; end if;
  if p_observed_on is null or p_observed_on > current_date or p_observed_on < current_date - 2 then raise exception 'Report date must be today or within the last two days'; end if;
  if v_photo = '' or v_photo not like auth.uid()::text || '/%' then raise exception 'Photo path must belong to the signed-in caretaker'; end if;

  select * into v_assignment from public.sur_tree_assignments a
  where a.tree_id=p_tree_id and a.caretaker_profile_id=v_profile_id and a.status in ('ASSIGNED','IN_PROGRESS')
  for update;
  if v_assignment.id is null then raise exception 'Active tree assignment not found'; end if;

  if exists(select 1 from public.sur_tree_updates u where u.assignment_id=v_assignment.id and u.observed_on=p_observed_on and u.care_period=v_period and u.status in ('PENDING_ADMIN_REVIEW','APPROVED')) then
    raise exception 'This care period is already pending or approved';
  end if;

  insert into public.sur_tree_updates(tree_id,assignment_id,caretaker_profile_id,observed_on,care_period,started_at,task_done,health_status,notes,photo_path)
  values(p_tree_id,v_assignment.id,v_profile_id,p_observed_on,v_period,p_started_at,v_task,v_health,v_notes,v_photo)
  returning id into v_update;

  update public.sur_tree_assignments set status='IN_PROGRESS',updated_at=now() where id=v_assignment.id;
  insert into public.sur_operation_audit(actor_profile_id,action,resource_type,resource_id,new_value,request_key)
  values(v_profile_id,'DAILY_TREE_UPDATE_SUBMITTED','TREE_UPDATE',v_update::text,jsonb_build_object('tree_id',p_tree_id,'observed_on',p_observed_on,'care_period',v_period,'started_at',p_started_at,'task_done',v_task),'TREE-UPDATE:'||v_update::text);
  return jsonb_build_object('update_id',v_update,'status','PENDING_ADMIN_REVIEW','care_period',v_period);
end;
$$;

revoke all on function public.sur_submit_daily_tree_update(uuid,text,text,text,date,text,time,text) from public, anon;
grant execute on function public.sur_submit_daily_tree_update(uuid,text,text,text,date,text,time,text) to authenticated;

commit;

select jsonb_build_object(
  'migration','105-three-part-daily-care',
  'care_period',exists(select 1 from information_schema.columns where table_schema='public' and table_name='sur_tree_updates' and column_name='care_period'),
  'started_at',exists(select 1 from information_schema.columns where table_schema='public' and table_name='sur_tree_updates' and column_name='started_at'),
  'task_done',exists(select 1 from information_schema.columns where table_schema='public' and table_name='sur_tree_updates' and column_name='task_done')
) as verification;
