"use client";
import { useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
export default function KycResubmission({ profileId, onSaved }: { profileId:string; onSaved:()=>Promise<void> }) {
 const [files,setFiles]=useState<(File|null)[]>([null,null,null]);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 async function submit(){
  if(busy)return;
  if(files.some(f=>!f||!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size===0||f.size>10*1024*1024)){setMessage('Choose three JPG, PNG or WebP images, up to 10 MB each.');return;}
  setBusy(true);setMessage('');
  try{
   const paths:string[]=[];
   for(const file of files){
    const ext=({ 'image/jpeg':'jpg','image/png':'png','image/webp':'webp'} as Record<string,string>)[file!.type];
    const path=`${profileId}/${crypto.randomUUID()}.${ext}`;
    const {error}=await supabase.storage.from('kyc-docs').upload(path,file!,{upsert:false,contentType:file!.type});
    if(error)throw new Error('Document upload failed. Retry or contact Support.');
    paths.push(path);
   }
   const {error}=await supabase.rpc('sur_resubmit_kyc',{p_front:paths[0],p_back:paths[1],p_selfie:paths[2]});
   if(error)throw new Error(error.code==='PGRST202'?'KYC resubmission is awaiting setup. Contact Support.':error.message);
   setMessage('Documents submitted for admin review.');await onSaved();
  }catch(error){setMessage(error instanceof Error?error.message:'Connection interrupted. Refresh KYC status before retrying.');}
  finally{setBusy(false);}
 }
 return <section className="mt-5 rounded-2xl bg-white p-5"><h2 className="text-xl font-bold">Submit KYC documents</h2><p className="mt-2 text-sm">Replace missing or rejected documents. Admin approval is still required.</p><div className="mt-4 grid gap-4">{['Valid ID — front','Valid ID — back','Selfie'].map((label,index)=><label key={label} className="grid gap-2">{label}<input disabled={busy} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setFiles(current=>current.map((f,i)=>i===index?e.target.files?.[0]||null:f))}/></label>)}<button disabled={busy} onClick={submit} className="rounded-xl bg-emerald-900 p-3 text-white">{busy?'Submitting…':'Submit for review'}</button>{message&&<p role="status">{message}</p>}</div></section>;
}
