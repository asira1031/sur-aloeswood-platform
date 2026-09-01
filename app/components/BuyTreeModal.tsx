"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import MayaPaymentQr from "@/app/components/MayaPaymentQr";
import { supabase } from "@/app/lib/supabase/client";
import { COPLANTER_PACKAGE_PRICE, MONTHLY_TREE_CARE_FEE, ONE_TIME_TREE_CARE_FEE, peso } from "@/app/lib/business/rules";

type Plan="SKIP"|"MONTHLY"|"ONE_TIME";
const prices:Record<Plan,number>={SKIP:0,MONTHLY:MONTHLY_TREE_CARE_FEE,ONE_TIME:ONE_TIME_TREE_CARE_FEE};
const names:Record<Plan,string>={SKIP:"Skip for now",MONTHLY:"Monthly care",ONE_TIME:"One-time care"};

export default function BuyTreeModal({open,onClose,onSubmitted}:{open:boolean;onClose:()=>void;onSubmitted?:()=>void}){
 const [step,setStep]=useState<1|2|3>(1),[quantity,setQuantity]=useState(1),[plan,setPlan]=useState<Plan>("SKIP");
 const [sender,setSender]=useState(""),[reference,setReference]=useState(""),[receipt,setReceipt]=useState<File|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[error,setError]=useState(false);
 const total=useMemo(()=>(COPLANTER_PACKAGE_PRICE+prices[plan])*quantity,[plan,quantity]);
 if(!open)return null;
 function reset(){setStep(1);setQuantity(1);setPlan("SKIP");setSender("");setReference("");setReceipt(null);setNotice("");setError(false);}
 function close(){if(!busy){reset();onClose();}}
 async function submit(){
  if(busy)return;setNotice("");setError(false);
  if(!receipt||!sender.trim()||!reference.trim()){setError(true);setNotice("Enter the Maya sender name and reference number, then attach the receipt.");return;}
  if(!["image/jpeg","image/png","image/webp","application/pdf"].includes(receipt.type)){setError(true);setNotice("Use a JPG, PNG, WebP or PDF receipt.");return;}
  if(receipt.size>10*1024*1024){setError(true);setNotice("Receipt must be 10 MB or smaller.");return;}
  const {data:{user}}=await supabase.auth.getUser();if(!user){setError(true);setNotice("Please sign in again before submitting payment.");return;}
  setBusy(true);
  try{
   const ext=receipt.name.split(".").pop()?.toLowerCase()||"bin",path=`${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
   const uploaded=await supabase.storage.from("sur-payment-proofs").upload(path,receipt,{upsert:false,contentType:receipt.type});if(uploaded.error)throw uploaded.error;
   const {error:rpcError}=await supabase.rpc("sur_submit_tree_order",{p_items:[{quantity,care_plan:plan}],p_sender_name:sender.trim(),p_reference:reference.trim(),p_payment_date:new Date().toISOString().slice(0,10),p_receipt_path:path,p_submitted_total:total});if(rpcError)throw rpcError;
   onSubmitted?.();reset();onClose();
  }catch(e){const text=e instanceof Error?e.message:"Unable to submit the order.";setError(true);setNotice(text.includes("schema cache")||text.includes("bucket")?"Checkout is temporarily unavailable. No payment record was submitted.":text);}finally{setBusy(false);}
 }
 const options:{id:Plan;name:string;price:string;text:string}[]=[
  {id:"SKIP",name:"Skip for now",price:"₱0",text:"Planting confirmation and QR identity only."},
  {id:"MONTHLY",name:"Monthly care",price:"₱200 per tree / month",text:"Monthly care coverage with compiled updates."},
  {id:"ONE_TIME",name:"One-time care",price:"₱5,000 per tree",text:"Discounted care coverage until the tree is sold."},
 ];
 return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#03150e]/75 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="buy-tree-title">
  <section className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] bg-white text-[#12231c] shadow-2xl sm:rounded-[2rem]">
   <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white/95 px-5 py-4 backdrop-blur sm:px-7"><div><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-700">Step {step} of 3</p><h2 id="buy-tree-title" className="mt-1 text-xl font-black">Buy an agarwood tree</h2></div><button onClick={close} className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-xl font-black" aria-label="Close checkout">×</button></div>
   <div className="grid grid-cols-3 gap-2 px-5 pt-5 sm:px-7">{[1,2,3].map(n=><div key={n} className={`h-2 rounded-full ${n<=step?"bg-emerald-700":"bg-slate-200"}`}/>)}</div>
   {step===1&&<div className="p-5 sm:p-7"><div className="overflow-hidden rounded-3xl bg-[#f1f3e9]"><Image src="/app-assets/agarwood-seedling-product-v1.png" alt="Young Aquilaria malaccensis agarwood seedling" width={1254} height={1254} priority className="aspect-square w-full object-cover"/></div><div className="mt-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-700">Agarwood seedling</p><h3 className="mt-1 text-2xl font-black italic">Aquilaria malaccensis</h3><p className="mt-2 text-xl font-black text-emerald-700">{peso(COPLANTER_PACKAGE_PRICE)} per tree</p></div><div className="flex items-center rounded-2xl border p-1"><button onClick={()=>setQuantity(v=>Math.max(1,v-1))} className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-xl font-black" aria-label="Decrease quantity">−</button><span className="min-w-14 text-center text-xl font-black">{quantity}</span><button onClick={()=>setQuantity(v=>Math.min(100,v+1))} className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-700 text-xl font-black text-white" aria-label="Increase quantity">+</button></div></div><button onClick={()=>setStep(2)} className="mt-6 w-full rounded-2xl bg-emerald-700 px-6 py-4 font-black text-white">Next: choose care</button></div>}
   {step===2&&<div className="p-5 sm:p-7"><h3 className="text-2xl font-black">Choose a care plan</h3><div className="mt-5 grid gap-3">{options.map(option=><button key={option.id} onClick={()=>setPlan(option.id)} className={`rounded-2xl border-2 p-4 text-left ${plan===option.id?"border-emerald-700 bg-emerald-50":"border-slate-200"}`}><div className="flex items-start justify-between gap-3"><div><p className="font-black">{option.name}</p><p className="mt-1 text-sm leading-6 text-slate-600">{option.text}</p></div><b className="shrink-0 text-emerald-700">{option.price}</b></div></button>)}</div><div className="mt-5 rounded-2xl bg-slate-50 p-4"><div className="flex justify-between gap-3 text-sm"><span>{quantity} tree{quantity>1?"s":""} · {names[plan]}</span><b>{peso(total)}</b></div><div className="mt-3 flex justify-between border-t pt-3 text-xl font-black"><span>Exact total</span><span>{peso(total)}</span></div></div><div className="mt-6 grid grid-cols-2 gap-3"><button onClick={()=>setStep(1)} className="rounded-2xl border px-5 py-4 font-black">Back</button><button onClick={()=>setStep(3)} className="rounded-2xl bg-emerald-700 px-5 py-4 font-black text-white">Next: pay</button></div></div>}
   {step===3&&<div className="p-5 sm:p-7"><MayaPaymentQr amount={total}/><div className="mt-5 space-y-3"><input value={sender} onChange={e=>setSender(e.target.value)} placeholder="Maya sender name" className="w-full rounded-2xl border px-4 py-3 text-base"/><input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Maya reference number" className="w-full rounded-2xl border px-4 py-3 text-base"/><label className="block text-xs font-bold text-slate-600">Exact amount<input value={total} readOnly className="mt-2 w-full rounded-2xl border bg-slate-50 px-4 py-3 text-base font-black"/></label><label className="block rounded-2xl border border-dashed p-4 text-sm font-black">Receipt image or PDF (max 10 MB)<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>setReceipt(e.target.files?.[0]||null)} className="mt-3 block w-full text-sm"/></label>{notice&&<p className={`rounded-2xl border p-4 text-sm font-bold ${error?"border-red-200 bg-red-50 text-red-800":"border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{notice}</p>}<button disabled={busy} onClick={submit} className="mobile-sticky-action w-full rounded-2xl bg-emerald-700 px-6 py-4 font-black text-white disabled:opacity-50">{busy?"Submitting…":"Submit for admin verification"}</button><button disabled={busy} onClick={()=>setStep(2)} className="mobile-primary-action w-full rounded-2xl border px-6 py-3 text-sm font-black">Back</button></div></div>}
  </section>
 </div>;
}
