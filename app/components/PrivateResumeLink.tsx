"use client";
import { useState } from "react";
import { supabase } from "@/app/lib/supabase/client";

export default function PrivateResumeLink({ value }: { value: string }) {
 const [link,setLink]=useState<{value:string;url:string}|null>(null);
 const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
 async function prepare(){
  setBusy(true);setError("");setLink(null);
  try {
   let path=value;
   if (/^https?:/i.test(path)) {
    const url=new URL(path);
    if(url.origin!=="https://dvidrbhfzzhgwyempgtu.supabase.co") throw new Error("Unrecognized document location.");
    const match=url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign)\/farmer-resumes\/(.+)$/);
    if(!match) throw new Error("Unrecognized document path.");
    path=decodeURIComponent(match[1]);
   }
   if(!path || /[:\\]/.test(path) || path.split('/').some(part=>!part||part==='.'||part==='..')) throw new Error("Invalid document path.");
   const result=await supabase.storage.from("farmer-resumes").createSignedUrl(path,120);
   if(result.error||!result.data?.signedUrl) throw new Error("Unable to open private resume. Check your admin session and retry.");
   setLink({value,url:result.data.signedUrl});
  } catch(e){setError(e instanceof Error?e.message:"Unable to open document.")}
  finally{setBusy(false)}
 }
 return <div><button type="button" disabled={busy} onClick={()=>void prepare()} className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy?"Checking access…":"Prepare private resume"}</button>{link?.value===value&&<a href={link.url} target="_blank" rel="noreferrer" className="ml-3 underline">Open (2 minutes)</a>}{error&&<p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}</div>;
}
