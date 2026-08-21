-- SUR Aloeswood signed-tree assignment and daily caretaker evidence
-- Apply after 081-secure-contract-signing.sql. Safe to re-run.
begin;

create table if not exists public.sur_tree_assignments (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null unique references public.sur_trees(id) on delete restrict,
  caretaker_profile_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'ASSIGNED' check (status in ('ASSIGNED','IN_PROGRESS','PAUSED','CLOSED')),
  task_title text not null default 'Daily tree care and evidence',
  admin_note text,
  assigned_by uuid not null references public.profiles(id),
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sur_tree_updates (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.sur_trees(id) on delete restrict,
  assignment_id uuid not null references public.sur_tree_assignments(id) on delete restrict,
  caretaker_profile_id uuid not null references public.profiles(id) on delete restrict,
  observed_on date not null default current_date,
  health_status text not null check (health_status in ('HEALTHY','NEEDS_ATTENTION','TREATMENT','DAMAGED','REPLACEMENT_REVIEW')),
  notes text not null,
  photo_path text not null,
  status text not null default 'PENDING_ADMIN_REVIEW' check (status in ('PENDING_ADMIN_REVIEW','APPROVED','REJECTED')),
  reviewed_by uuid references public.profiles(id),
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists sur_tree_assignments_caretaker_idx
  on public.sur_tree_assignments(caretaker_profile_id, status);
create index if not exists sur_tree_updates_tree_date_idx
  on public.sur_tree_updates(tree_id, observed_on desc, created_at desc);
create index if not exists sur_tree_updates_review_idx
  on public.sur_tree_updates(status, created_at desc);

alter table public.sur_tree_assignments enable row level security;
alter table public.sur_tree_updates enable row level security;

drop policy if exists "assignments admin read" on public.sur_tree_assignments;
create policy "assignments admin read"
  on public.sur_tree_assignments for select to authenticated
  using (public.app_is_admin());

drop policy if exists "assignments caretaker read" on public.sur_tree_assignments;
create policy "assignments caretaker read"
  on public.sur_tree_assignments for select to authenticated
  using (caretaker_profile_id = public.app_profile_id());

drop policy if exists "updates admin read" on public.sur_tree_updates;
create policy "updates admin read"
  on public.sur_tree_updates for select to authenticated
  using (public.app_is_admin());

drop policy if exists "updates caretaker read" on public.sur_tree_updates;
create policy "updates caretaker read"
  on public.sur_tree_updates for select to authenticated
  using (caretaker_profile_id = public.app_profile_id());

drop policy if exists "updates customer approved read" on public.sur_tree_updates;
create policy "updates customer approved read"
  on public.sur_tree_updates for select to authenticated
  using (
    status = 'APPROVED'
    and exists (
      select 1 from public.sur_trees t
      where t.id = public.sur_tree_updates.tree_id
        and t.profile_id = public.app_profile_id()
    )
  );

grant select on public.sur_tree_assignments to authenticated;
grant select on public.sur_tree_updates to authenticated;

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
    and upper(coalesce(p.role, '')) in ('FARMER','GARDENER','CARETAKER')
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
  if v_health not in ('HEALTHY','NEEDS_ATTENTION','TREATMENT','DAMAGED','REPLACEMENT_REVIEW') then
    raise exception 'Invalid health status';
  end if;
  if length(v_notes) < 3 or length(v_notes) > 1500 then raise exception 'A clear field note is required'; end if;
  if p_observed_on > current_date or p_observed_on < current_date - 2 then
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

create or replace function public.sur_admin_review_tree_update(
  p_update_id uuid,
  p_decision text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_update public.sur_tree_updates%rowtype;
  v_decision text := upper(trim(coalesce(p_decision, '')));
  v_note text := trim(coalesce(p_note, ''));
begin
  if not public.app_is_admin() then raise exception 'Active admin required'; end if;
  if v_decision not in ('APPROVED','REJECTED') then raise exception 'Decision must be APPROVED or REJECTED'; end if;
  if length(v_note) < 3 or length(v_note) > 500 then raise exception 'A clear review note is required'; end if;

  select * into v_update
  from public.sur_tree_updates
  where id = p_update_id
  for update;
  if v_update.id is null then raise exception 'Tree update not found'; end if;
  if v_update.status <> 'PENDING_ADMIN_REVIEW' then raise exception 'Tree update was already reviewed'; end if;

  update public.sur_tree_updates
  set status = v_decision,
      reviewed_by = public.app_profile_id(),
      review_note = v_note,
      reviewed_at = now()
  where id = v_update.id;

  if v_decision = 'APPROVED' then
    update public.sur_trees
    set status = case when planted_at is null then 'ACTIVE_ASSIGNED' else 'PLANTED_ACTIVE' end
    where id = v_update.tree_id;
  end if;

  insert into public.sur_operation_audit(
    actor_profile_id, action, resource_type, resource_id, old_value, new_value, reason,
    request_key
  ) values (
    public.app_profile_id(),
    'TREE_UPDATE_' || v_decision,
    'TREE_UPDATE',
    v_update.id::text,
    jsonb_build_object('status', v_update.status),
    jsonb_build_object('status', v_decision),
    v_note,
    'TREE-UPDATE-REVIEW:' || v_update.id::text
  );

  return jsonb_build_object('update_id', v_update.id, 'status', v_decision);
end;
$$;

revoke all on function public.sur_admin_assign_tree_caretaker(uuid,uuid,text,text) from public, anon;
revoke all on function public.sur_submit_daily_tree_update(uuid,text,text,text,date) from public, anon;
revoke all on function public.sur_admin_review_tree_update(uuid,text,text) from public, anon;
grant execute on function public.sur_admin_assign_tree_caretaker(uuid,uuid,text,text) to authenticated;
grant execute on function public.sur_submit_daily_tree_update(uuid,text,text,text,date) to authenticated;
grant execute on function public.sur_admin_review_tree_update(uuid,text,text) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values(
  'sur-tree-evidence',
  'sur-tree-evidence',
  false,
  15728640,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict(id) do update set
  public = false,
  file_size_limit = 15728640,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "sur evidence caretaker upload" on storage.objects;
create policy "sur evidence caretaker upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'sur-tree-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and upper(coalesce(p.role, '')) in ('FARMER','GARDENER','CARETAKER')
        and upper(coalesce(p.account_status, '')) = 'ACTIVE'
    )
  );

drop policy if exists "sur evidence caretaker cleanup" on storage.objects;
create policy "sur evidence caretaker cleanup"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'sur-tree-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not exists (
      select 1 from public.sur_tree_updates u
      where u.photo_path = name
    )
  );

drop policy if exists "sur evidence protected read" on storage.objects;
create policy "sur evidence protected read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'sur-tree-evidence'
    and (
      public.app_is_admin()
      or (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1
        from public.sur_tree_updates u
        join public.sur_trees t on t.id = u.tree_id
        where u.photo_path = name
          and u.status = 'APPROVED'
          and t.profile_id = public.app_profile_id()
      )
    )
  );

notify pgrst, 'reload schema';

commit;

select jsonb_build_object(
  'migration', '082-tree-care-operations',
  'assignments', to_regclass('public.sur_tree_assignments') is not null,
  'updates', to_regclass('public.sur_tree_updates') is not null,
  'submit_rpc', to_regprocedure('public.sur_submit_daily_tree_update(uuid,text,text,text,date)') is not null
) as verification;
