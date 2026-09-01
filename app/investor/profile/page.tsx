"use client";

import Link from "next/link";
import KycResubmission from "@/app/components/KycResubmission";
import { useEffect, useState } from "react";
import { getAuthenticatedProfile } from "@/app/lib/auth/session";
import { supabase } from "@/app/lib/supabase/client";

type Profile = { id:string; full_name:string|null; email:string|null; mobile:string|null; mobile_number:string|null; address:string|null; account_status:string|null; kyc_status:string|null; created_at:string|null };

export default function AccountPage(){
 const [profile,setProfile]=useState<Profile|null>(null),[loading,setLoading]=useState(true),[password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[saving,setSaving]=useState(false),[notice,setNotice]=useState<{text:string;error:boolean}|null>(null);
 async function load(){setLoading(true);const current=await getAuthenticatedProfile();if(!current){setNotice({text:"Please sign in again.",error:true});setLoading(false);return}const {data,error}=await supabase.from("profiles").select("id,full_name,email,mobile,mobile_number,address,account_status,kyc_status,created_at").eq("id",current.id).single();if(error)setNotice({text:error.message,error:true});else setProfile(data as Profile);setLoading(false)}
 useEffect(()=>{const timer=window.setTimeout(()=>void load(),0);return()=>window.clearTimeout(timer)},[]);
 async function changePassword(){setNotice(null);if(password.length<8)return setNotice({text:"New password must be at least 8 characters.",error:true});if(password!==confirm)return setNotice({text:"Passwords do not match.",error:true});setSaving(true);const {error}=await supabase.auth.updateUser({password});setSaving(false);if(error)setNotice({text:error.message,error:true});else{setPassword("");setConfirm("");setNotice({text:"Password changed successfully.",error:false})}}
 return <main className="min-h-screen bg-[#f5f1e7] bg-cover bg-fixed bg-center px-4 py-5 text-[#102b23] sm:px-6 lg:py-8" style={{backgroundImage:"url('/sur-bg-app-light-v1.png')"}}><div className="mx-auto max-w-4xl">
  <header className="mb-5 flex items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.22em] text-[#08745b]">My profile</p><h1 className="mt-1 text-3xl font-black sm:text-4xl">Account</h1></div><Link href="/investor/my-trees" className="rounded-full border border-[#d8d2c3] bg-white px-4 py-2.5 text-sm font-black shadow-sm">← My Trees</Link></header>
  {notice&&<div className={`mb-5 rounded-2xl border px-4 py-3 text-sm font-bold ${notice.error?"border-red-200 bg-red-50 text-red-800":"border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{notice.text}</div>}
  <div className="grid gap-5 md:grid-cols-2">
   <section className="rounded-[2rem] border border-[#e1dccf] bg-white p-5 shadow-sm sm:p-7"><h2 className="text-2xl font-black">Account details</h2>{loading?<p className="mt-6 text-sm font-bold text-[#718078]">Loading…</p>:<div className="mt-5 grid gap-3"><Detail label="Full name" value={profile?.full_name}/><Detail label="Email" value={profile?.email}/><Detail label="Mobile number" value={profile?.mobile_number||profile?.mobile}/><Detail label="Address" value={profile?.address}/><div className="grid grid-cols-2 gap-3"><Detail label="Account" value={profile?.account_status}/><Detail label="KYC" value={profile?.kyc_status}/></div></div>}</section>
   <section className="rounded-[2rem] border border-[#e1dccf] bg-white p-5 shadow-sm sm:p-7"><h2 className="text-2xl font-black">Change password</h2><p className="mt-1 text-sm text-[#687973]">Use at least 8 characters.</p><div className="mt-5 grid gap-4"><Field label="New password" value={password} onChange={setPassword}/><Field label="Confirm new password" value={confirm} onChange={setConfirm}/><button onClick={()=>void changePassword()} disabled={saving} className="rounded-2xl bg-[#073d30] px-5 py-4 text-sm font-black text-white disabled:opacity-50">{saving?"Saving…":"Change password"}</button></div></section>
  </div>
 {profile&&String(profile.kyc_status||'').toUpperCase()!=='APPROVED'&&<KycResubmission profileId={profile.id} onSaved={load}/>}
 </div></main>
}
function Detail({label,value}:{label:string;value?:string|null}){return <div className="rounded-2xl bg-[#f7f5ee] p-4"><p className="text-[10px] font-black uppercase tracking-[.13em] text-[#718078]">{label}</p><p className="mt-2 break-words text-sm font-black">{value||"—"}</p></div>}
function Field({label,value,onChange}:{label:string;value:string;onChange:(value:string)=>void}){return <label className="grid gap-2 text-xs font-black uppercase tracking-[.11em] text-[#526962]"><span>{label}</span><input type="password" value={value} onChange={event=>onChange(event.target.value)} className="rounded-2xl border border-[#ded9cd] bg-[#faf9f5] px-4 py-4 text-sm font-bold normal-case tracking-normal outline-none focus:border-[#08745b]"/></label>}
