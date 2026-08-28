  -- ONLY SUR dvidrbhfzzhgwyempgtu. Owner-bound KYC recovery.
  begin;
  create or replace function public.sur_resubmit_kyc(p_front text,p_back text,p_selfie text)
  returns void language plpgsql security definer set search_path=public
  as $$
  declare p public.profiles%rowtype; object_path text;
  begin
   if auth.uid() is null then raise exception 'Login required'; end if;
   select * into p from public.profiles where auth_user_id=auth.uid() for update;
   if not found then raise exception 'Profile not found'; end if;
   if upper(coalesce(p.kyc_status,''))='APPROVED' then raise exception 'KYC already approved'; end if;
   if upper(coalesce(p.account_status,'')) in ('SUSPENDED','BLOCKED','ARCHIVED') then raise exception 'Account unavailable'; end if;
   foreach object_path in array array[p_front,p_back,p_selfie] loop
    if object_path is null or split_part(object_path,'/',1)<>p.id::text
       or not exists(select 1 from storage.objects where bucket_id='kyc-docs' and name=object_path)
    then raise exception 'Upload all three documents to your private account folder'; end if;
   end loop;
   if p_front=p_back or p_front=p_selfie or p_back=p_selfie then raise exception 'Three separate documents required'; end if;
   update public.profiles set kyc_id_url=p_front,kyc_document_url=p_front,valid_id_url=p_front,
   kyc_extra_url=p_back,kyc_selfie_url=p_selfie,kyc_photo_url=p_selfie,selfie_url=p_selfie,
   kyc_status='PENDING',kyc_submitted_at=now(),kyc_updated_at=now() where id=p.id;
  end $$;
  revoke all on function public.sur_resubmit_kyc(text,text,text) from public,anon;
  grant execute on function public.sur_resubmit_kyc(text,text,text) to authenticated;
  commit;
  select jsonb_build_object('migration','096-kyc-resubmission','resubmit_rpc',
   to_regprocedure('public.sur_resubmit_kyc(text,text,text)') is not null) as verification;
