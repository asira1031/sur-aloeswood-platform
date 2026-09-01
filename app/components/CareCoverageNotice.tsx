"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {supabase} from "@/app/lib/supabase/client";
export default function CareCoverageNotice({treeId}:{treeId:string}){
 const [message,setMessage]=useState("");
 useEffect(()=>{let active=true;void supabase.rpc("sur_care_quote",{p_tree:treeId}).then(({data,error})=>{
  if(!active)return;
  if(error){setMessage("Care coverage could not be verified. Open Care Journal or contact support.");return}
  setMessage(data?.warning?(data.access?"Monthly Care ends within 7 days. You can pay in advance.":"Monthly Care has expired. Catch up to unlock regular care updates."):data?.plan==="SKIP"?"Your plan includes the confirmed planting record only.":"");
 });return()=>{active=false}},[treeId]);
 if(!message)return null;
 return <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">{message} <Link href="/investor/care-services" className="font-bold underline">Care Journal</Link></p>;
}
