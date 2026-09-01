-- SUR Aloeswood per-tree contract delivery, signature, and notarized-copy lifecycle.
-- Apply after 081-secure-contract-signing.sql. Safe to re-run.
begin;

alter table public.sur_contracts add column if not exists template_path text;
alter table public.sur_contracts add column if not exists template_sha256 text;
alter table public.sur_contracts add column if not exists identity_document_path text;
alter table public.sur_contracts add column if not exists sent_by uuid references public.profiles(id);
alter table public.sur_contracts add column if not exists sent_at timestamptz;
alter table public.sur_contracts add column if not exists notarization_status text not null default 'NOT_STARTED';
alter table public.sur_contracts add column if not exists notarized_copy_path text;
alter table public.sur_contracts add column if not exists notarized_copy_sha256 text;
alter table public.sur_contracts add column if not exists notarized_at timestamptz;
alter table public.sur_contracts add column if not exists notarized_by uuid references public.profiles(id);
alter table public.sur_contracts add column if not exists updated_at timestamptz not null default now();

alter table public.sur_contracts alter column status set default 'DRAFT';

update public.sur_contracts
set template_path = coalesce(template_path, '/legal/sur-tree-agreement-dummy-v1.pdf'),
    sent_at = coalesce(sent_at, created_at),
    notarization_status = case
      when notarized_copy_path is not null then 'COMPLETE'
      when status = 'CUSTOMER_SIGNED' then 'AWAITING_NOTARY'
      else coalesce(notarization_status, 'NOT_STARTED')
    end,
    updated_at = now()
where template_path is null or sent_at is null or notarization_status is null;

create or replace function public.sur_admin_send_tree_contract(p_contract_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract public.sur_contracts%rowtype;
  v_profile public.profiles%rowtype;
  v_id_path text;
begin
  if not public.app_is_admin() then raise exception 'Active admin required'; end if;

  select * into v_contract from public.sur_contracts where id = p_contract_id for update;
  if v_contract.id is null then raise exception 'Contract not found'; end if;
  if v_contract.status not in ('DRAFT', 'PENDING', 'CUSTOMER_SIGNATURE_PENDING') then
    raise exception 'Contract is already beyond the sending step';
  end if;

  select * into v_profile from public.profiles where id = v_contract.profile_id;
  if v_profile.id is null then raise exception 'Customer profile not found'; end if;
  if upper(coalesce(v_profile.kyc_status, '')) not in ('APPROVED', 'VERIFIED') then
    raise exception 'Approved customer KYC is required before sending the contract';
  end if;

  v_id_path := coalesce(
    nullif(to_jsonb(v_profile)->>'kyc_id_url', ''),
    nullif(to_jsonb(v_profile)->>'kyc_document_url', ''),
    nullif(to_jsonb(v_profile)->>'valid_id_url', '')
  );
  if v_id_path is null then raise exception 'A verified ID file is required before sending the contract'; end if;
  if coalesce(trim(v_profile.full_name), '') = '' then raise exception 'Verified legal name is required'; end if;

  update public.sur_contracts
  set legal_name = trim(regexp_replace(v_profile.full_name, '\s+', ' ', 'g')),
      identity_document_path = v_id_path,
      template_path = coalesce(template_path, '/legal/sur-tree-agreement-dummy-v1.pdf'),
      status = 'CUSTOMER_SIGNATURE_PENDING',
      sent_by = public.app_profile_id(),
      sent_at = coalesce(sent_at, now()),
      updated_at = now()
  where id = v_contract.id;

  insert into public.sur_operation_audit(actor_profile_id,action,resource_type,resource_id,old_value,new_value,reason,request_key)
  values(public.app_profile_id(),'CONTRACT_SENT','TREE_CONTRACT',v_contract.id::text,
    jsonb_build_object('status',v_contract.status),
    jsonb_build_object('status','CUSTOMER_SIGNATURE_PENDING','version',v_contract.version,'identity_verified',true),
    'Admin sent the frozen per-tree contract to the verified customer.',
    'CONTRACT-SEND:'||v_contract.id::text)
  on conflict(request_key) do nothing;

  return jsonb_build_object('contract_id',v_contract.id,'status','CUSTOMER_SIGNATURE_PENDING','sent_at',now());
end;
$$;

create or replace function public.sur_sign_tree_contract(
  p_contract_id uuid,
  p_signature text,
  p_terms_accepted boolean,
  p_risk_accepted boolean,
  p_external_sale_accepted boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.app_profile_id();
  v_contract public.sur_contracts%rowtype;
  v_tree public.sur_trees%rowtype;
  v_signature text := trim(regexp_replace(coalesce(p_signature, ''), '\s+', ' ', 'g'));
  v_legal_name text;
begin
  if auth.uid() is null or v_profile_id is null then raise exception 'Authentication required'; end if;
  if not coalesce(p_terms_accepted,false) or not coalesce(p_risk_accepted,false) or not coalesce(p_external_sale_accepted,false) then
    raise exception 'All contract acknowledgements are required';
  end if;
  if length(v_signature) < 2 or length(v_signature) > 200 then raise exception 'Enter your complete legal name'; end if;

  select * into v_contract from public.sur_contracts c
  where c.id=p_contract_id and c.profile_id=v_profile_id for update;
  if v_contract.id is null then raise exception 'Contract not found or access denied'; end if;
  if v_contract.status <> 'CUSTOMER_SIGNATURE_PENDING' or v_contract.sent_at is null then
    raise exception 'This frozen contract has not been sent or is no longer awaiting your signature';
  end if;
  if v_contract.identity_document_path is null then raise exception 'Verified identity evidence is missing; contact support'; end if;

  select trim(regexp_replace(coalesce(p.full_name,''),'\s+',' ','g')) into v_legal_name
  from public.profiles p where p.id=v_profile_id and upper(coalesce(p.kyc_status,'')) in ('APPROVED','VERIFIED');
  if coalesce(v_legal_name,'')='' then raise exception 'Approved KYC is required before signing'; end if;
  if lower(v_signature)<>lower(v_legal_name) or lower(v_signature)<>lower(trim(regexp_replace(v_contract.legal_name,'\s+',' ','g'))) then
    raise exception 'Signature must exactly match your verified legal name';
  end if;

  select * into v_tree from public.sur_trees t
  where t.id=v_contract.tree_id and t.profile_id=v_profile_id for update;
  if v_tree.id is null then raise exception 'Tree record not found or access denied'; end if;

  update public.sur_contracts
  set status='CUSTOMER_SIGNED',customer_signature=v_signature,customer_signed_at=now(),
      notarization_status='AWAITING_NOTARY',updated_at=now()
  where id=v_contract.id;
  update public.sur_trees set status='ACTIVE_AWAITING_FARM_ASSIGNMENT',activated_at=coalesce(activated_at,now()) where id=v_tree.id;

  insert into public.sur_operation_audit(actor_profile_id,action,resource_type,resource_id,old_value,new_value,reason,request_key)
  values(v_profile_id,'CUSTOMER_CONTRACT_SIGNED','TREE_CONTRACT',v_contract.id::text,
    jsonb_build_object('status',v_contract.status),
    jsonb_build_object('status','CUSTOMER_SIGNED','tree_id',v_tree.tree_id,'version',v_contract.version,'notarization_status','AWAITING_NOTARY','acknowledgements',jsonb_build_object('terms',true,'risk',true,'external_sale',true)),
    'Authenticated customer signed the frozen version using the verified legal name.',
    'CONTRACT-SIGN:'||v_contract.id::text);

  return jsonb_build_object('contract_id',v_contract.id,'tree_id',v_tree.tree_id,'contract_status','CUSTOMER_SIGNED','notarization_status','AWAITING_NOTARY','tree_status','ACTIVE_AWAITING_FARM_ASSIGNMENT','signed_at',now());
end;
$$;

create or replace function public.sur_admin_finalize_notarized_contract(
  p_contract_id uuid,
  p_document_path text,
  p_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare v_contract public.sur_contracts%rowtype; v_path text:=trim(coalesce(p_document_path,'')); v_hash text:=lower(trim(coalesce(p_sha256,'')));
begin
  if not public.app_is_admin() then raise exception 'Active admin required'; end if;
  select * into v_contract from public.sur_contracts where id=p_contract_id for update;
  if v_contract.id is null then raise exception 'Contract not found'; end if;
  if v_contract.status <> 'CUSTOMER_SIGNED' or v_contract.customer_signed_at is null then raise exception 'Customer signature is required first'; end if;
  if v_path !~ ('^'||v_contract.id::text||'/[^/]+\.pdf$') then raise exception 'Invalid final contract path'; end if;
  if v_hash !~ '^[0-9a-f]{64}$' then raise exception 'A SHA-256 document hash is required'; end if;
  if not exists(select 1 from storage.objects where bucket_id='sur-contract-documents' and name=v_path) then raise exception 'Uploaded final PDF was not found'; end if;

  update public.sur_contracts
  set status='FINAL_NOTARIZED',notarization_status='COMPLETE',notarized_copy_path=v_path,
      farm_signed_copy_path=v_path,notarized_copy_sha256=v_hash,notarized_at=now(),
      notarized_by=public.app_profile_id(),updated_at=now()
  where id=v_contract.id;

  insert into public.sur_operation_audit(actor_profile_id,action,resource_type,resource_id,old_value,new_value,reason,request_key)
  values(public.app_profile_id(),'CONTRACT_NOTARIZED_COPY_FILED','TREE_CONTRACT',v_contract.id::text,
    jsonb_build_object('status',v_contract.status,'notarization_status',v_contract.notarization_status),
    jsonb_build_object('status','FINAL_NOTARIZED','notarization_status','COMPLETE','sha256',v_hash),
    'Admin verified and filed the returned notarized PDF as the final shared copy.',
    'CONTRACT-NOTARIZED:'||v_contract.id::text);
  return jsonb_build_object('contract_id',v_contract.id,'status','FINAL_NOTARIZED','sha256',v_hash);
end;
$$;

revoke all on function public.sur_admin_send_tree_contract(uuid) from public,anon;
revoke all on function public.sur_admin_finalize_notarized_contract(uuid,text,text) from public,anon;
grant execute on function public.sur_admin_send_tree_contract(uuid) to authenticated;
grant execute on function public.sur_admin_finalize_notarized_contract(uuid,text,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('sur-contract-documents','sur-contract-documents',false,20971520,array['application/pdf'])
on conflict(id) do update set public=false,file_size_limit=20971520,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "contract documents admin upload" on storage.objects;
create policy "contract documents admin upload" on storage.objects for insert to authenticated
with check(bucket_id='sur-contract-documents' and public.app_is_admin());
drop policy if exists "contract documents admin manage" on storage.objects;
create policy "contract documents admin manage" on storage.objects for all to authenticated
using(bucket_id='sur-contract-documents' and public.app_is_admin())
with check(bucket_id='sur-contract-documents' and public.app_is_admin());
drop policy if exists "contract final owner read" on storage.objects;
create policy "contract final owner read" on storage.objects for select to authenticated
using(bucket_id='sur-contract-documents' and exists(
  select 1 from public.sur_contracts c
  where c.notarized_copy_path=name and (c.profile_id=public.app_profile_id() or public.app_is_admin())
));

do $$ begin
  if to_regclass('public.sur_schema_migrations') is not null then
    insert into public.sur_schema_migrations(version,description)
    values('106-contract-notary-lifecycle','Frozen contract delivery, verified signing, notary tracking, and final shared copy')
    on conflict(version) do nothing;
  end if;
end $$;

notify pgrst, 'reload schema';
commit;

select jsonb_build_object(
  'migration','106-contract-notary-lifecycle',
  'send_rpc',to_regprocedure('public.sur_admin_send_tree_contract(uuid)') is not null,
  'sign_rpc',to_regprocedure('public.sur_sign_tree_contract(uuid,text,boolean,boolean,boolean)') is not null,
  'finalize_rpc',to_regprocedure('public.sur_admin_finalize_notarized_contract(uuid,text,text)') is not null,
  'bucket',exists(select 1 from storage.buckets where id='sur-contract-documents')
) as verification;
