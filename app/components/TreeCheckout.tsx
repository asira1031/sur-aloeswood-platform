"use client";

import Link from "next/link";
import Image from "next/image";
import MayaPaymentQr from "@/app/components/MayaPaymentQr";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { COPLANTER_PACKAGE_PRICE, MONTHLY_TREE_CARE_FEE, ONE_TIME_TREE_CARE_FEE, peso } from "@/app/lib/business/rules";

type Plan = "SKIP" | "MONTHLY" | "ONE_TIME";
type CartLine = { id: string; quantity: number; care_plan: Plan };
type Order = { id:string; order_no:string; status:string; exact_total:number; created_at:string };
const planPrice:Record<Plan,number>={SKIP:0,MONTHLY:MONTHLY_TREE_CARE_FEE,ONE_TIME:ONE_TIME_TREE_CARE_FEE};
const planName:Record<Plan,string>={SKIP:"Skip care plan",MONTHLY:"Monthly care",ONE_TIME:"One-time care"};

export default function TreeCheckout(){
  const [cart,setCart]=useState<CartLine[]>([]); const [modalOpen,setModalOpen]=useState(false); const [step,setStep]=useState<1|2|3>(1);
  const [sender,setSender]=useState(""); const [reference,setReference]=useState("");
  const [amount,setAmount]=useState(""); const [receipt,setReceipt]=useState<File|null>(null); const [orders,setOrders]=useState<Order[]>([]);
  const [busy,setBusy]=useState(false); const [notice,setNotice]=useState(""); const [error,setError]=useState(false);
  const total=useMemo(()=>cart.reduce((sum,x)=>sum+(COPLANTER_PACKAGE_PRICE+planPrice[x.care_plan])*x.quantity,0),[cart]);

  useEffect(()=>{ void loadOrders(); },[]);
  async function loadOrders(){ const {data:{user}}=await supabase.auth.getUser(); if(!user)return;
    const {data,error:loadError}=await supabase.from("sur_tree_orders").select("id,order_no,status,exact_total,created_at").order("created_at",{ascending:false}).limit(30); if(loadError){setError(true);setNotice("Recent orders could not load. Please retry before resubmitting a payment.");return;} setOrders((data||[]) as Order[]); }
  function add(){setCart([{id:crypto.randomUUID(),quantity:1,care_plan:"SKIP"}]);setModalOpen(true);setStep(1);setNotice("");setError(false);}
  function update(id:string,patch:Partial<CartLine>){setCart(x=>x.map(v=>v.id===id?{...v,...patch}:v));}
  function closeModal(){if(busy)return;setModalOpen(false);setStep(1);setCart([]);setNotice("");setError(false);}
  async function submit(){
    if(busy)return;
    setNotice("");setError(false); if(!cart.length||!receipt||!sender.trim()||!reference.trim()||!amount){setError(true);setNotice("Complete the Maya payment form and attach the receipt.");return;}
    if(!["image/jpeg","image/png","image/webp","application/pdf"].includes(receipt.type)){setError(true);setNotice("Use a JPG, PNG, WebP or PDF receipt.");return;}
    if(cart.length!==1||!Number.isInteger(cart[0].quantity)||cart[0].quantity<1||cart[0].quantity>100){setError(true);setNotice("Choose a quantity from 1 to 100 trees.");return;}
    if(!Number.isFinite(Number(amount))||Number(amount)<=0){setError(true);setNotice("Enter a valid amount.");return;}
    if(Number(amount)!==total){setError(true);setNotice(`Please send the exact amount: ${peso(total)}.`);return;}
    if(receipt.size>10*1024*1024){setError(true);setNotice("Receipt must be 10 MB or smaller.");return;}
    const {data:{user}}=await supabase.auth.getUser(); if(!user){setError(true);setNotice("Please sign in before submitting payment.");return;}
    setBusy(true);
    try{
      const ext=receipt.name.split(".").pop()?.toLowerCase()||"bin"; const path=`${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const uploaded=await supabase.storage.from("sur-payment-proofs").upload(path,receipt,{upsert:false,contentType:receipt.type}); if(uploaded.error)throw uploaded.error;
      const {data,error:rpcError}=await supabase.rpc("sur_submit_tree_order",{p_items:cart.map(({quantity,care_plan})=>({quantity,care_plan})),p_sender_name:sender.trim(),p_reference:reference.trim(),p_payment_date:new Date().toISOString().slice(0,10),p_receipt_path:path,p_submitted_total:Number(amount)}); if(rpcError)throw rpcError;
      setNotice(`Order submitted: ${String((data as {status?:string})?.status||"PENDING_VERIFICATION").replaceAll("_"," ")}. Admin will verify the real Maya payment before tree allocation.`);
      setCart([]);setModalOpen(false);setStep(1);setSender("");setReference("");setAmount("");setReceipt(null);await loadOrders();
    }catch(e){const text=e instanceof Error?e.message:"Unable to submit the order.";setError(true);setNotice(text.includes("schema cache")||text.includes("bucket")?"Checkout is temporarily unavailable while Agarwood Support completes one-time setup. No payment record was submitted.":text);}finally{setBusy(false);}
  }

  return <main className="min-h-screen bg-[#f4f7f2] text-slate-950">
    <section className="relative overflow-hidden bg-[#072417] text-white"><div className="absolute inset-0 bg-[url('/forest-bg.jpg')] bg-cover bg-center opacity-20"/><div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-5 sm:py-10 md:px-8">
      <p className="text-xs font-black uppercase tracking-[.18em] text-emerald-300 sm:tracking-[.3em]">Buy a managed agarwood tree</p><h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight sm:text-4xl md:text-6xl">Choose one tree and care plan. Pay one exact Maya total.</h1>
      <p className="mt-5 max-w-3xl text-base leading-8 text-white/75">Tree ownership is ₱25,000 per tree. The farm handles allocation, planting, QR tagging and care operations after payment approval and customer contract signing.</p>
      <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap"><Link href="/investor/dashboard" className="mobile-primary-action inline-flex w-full items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black sm:w-auto">Dashboard</Link><Link href="/investor/support" className="mobile-primary-action inline-flex w-full items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black sm:w-auto">Need help?</Link></div>
    </div></section>
    <div className="mx-auto grid max-w-7xl gap-5 px-3 py-5 sm:px-5 sm:py-7 md:px-8 lg:grid-cols-[.8fr_1.2fr]">
      <Card title="Buy a tree"><Empty/><button onClick={add} className="mobile-primary-action mt-4 w-full rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white sm:w-auto">Choose one tree</button></Card>
      <Card title="Your recent orders">{orders.length===0?<p className="text-sm text-slate-500">No submitted orders yet.</p>:<div className="space-y-3">{orders.map(o=><div key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4"><div><p className="font-black">{o.order_no}</p><p className="mt-1 text-xs text-slate-500">{new Date(o.created_at).toLocaleString("en-PH")}</p></div><div className="text-right"><p className="font-black">{peso(o.exact_total)}</p><p className="mt-1 text-xs font-black text-amber-700">{o.status.replaceAll("_"," ")}</p></div></div>)}</div>}</Card>
    </div>

    {modalOpen&&cart[0]&&<div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#03150e]/75 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="tree-checkout-title">
      <section className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] bg-white shadow-2xl sm:rounded-[2rem]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white/95 px-5 py-4 backdrop-blur sm:px-7"><div><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-700">Step {step} of 3</p><h2 id="tree-checkout-title" className="mt-1 text-xl font-black">Buy an agarwood tree</h2></div><button onClick={closeModal} className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-xl font-black" aria-label="Close checkout">×</button></div>
        <div className="grid grid-cols-3 gap-2 px-5 pt-5 sm:px-7">{[1,2,3].map(n=><div key={n} className={`h-2 rounded-full ${n<=step?"bg-emerald-700":"bg-slate-200"}`}/>)}</div>

        {step===1&&<div className="p-5 sm:p-7"><div className="overflow-hidden rounded-3xl bg-[#f1f3e9]"><Image src="/app-assets/agarwood-seedling-product-v1.png" alt="Young Aquilaria malaccensis agarwood seedling" width={1254} height={1254} priority className="aspect-square w-full object-cover"/></div><div className="mt-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-700">Agarwood seedling</p><h3 className="mt-1 text-2xl font-black italic">Aquilaria malaccensis</h3><p className="mt-2 text-xl font-black text-emerald-700">{peso(COPLANTER_PACKAGE_PRICE)} per tree</p></div><div className="flex items-center rounded-2xl border p-1"><button onClick={()=>update(cart[0].id,{quantity:Math.max(1,cart[0].quantity-1)})} className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-xl font-black" aria-label="Decrease quantity">−</button><span className="min-w-14 text-center text-xl font-black">{cart[0].quantity}</span><button onClick={()=>update(cart[0].id,{quantity:Math.min(100,cart[0].quantity+1)})} className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-700 text-xl font-black text-white" aria-label="Increase quantity">+</button></div></div><button onClick={()=>setStep(2)} className="mt-6 w-full rounded-2xl bg-emerald-700 px-6 py-4 font-black text-white">Next: choose care</button></div>}

        {step===2&&<div className="p-5 sm:p-7"><h3 className="text-2xl font-black">Choose a care plan</h3><div className="mt-5 grid gap-3">{([{id:"SKIP",name:"Skip for now",price:"₱0",text:"Planting confirmation and QR identity only."},{id:"MONTHLY",name:"Monthly care",price:"₱200 per tree / month",text:"Monthly care coverage with compiled updates."},{id:"ONE_TIME",name:"One-time care",price:"₱5,000 per tree",text:"Discounted care coverage until the tree is sold."}] as {id:Plan;name:string;price:string;text:string}[]).map(option=><button key={option.id} onClick={()=>update(cart[0].id,{care_plan:option.id})} className={`rounded-2xl border-2 p-4 text-left ${cart[0].care_plan===option.id?"border-emerald-700 bg-emerald-50":"border-slate-200"}`}><div className="flex items-start justify-between gap-3"><div><p className="font-black">{option.name}</p><p className="mt-1 text-sm leading-6 text-slate-600">{option.text}</p></div><b className="shrink-0 text-emerald-700">{option.price}</b></div></button>)}</div><div className="mt-5 rounded-2xl bg-slate-50 p-4"><div className="flex justify-between gap-3 text-sm"><span>{cart[0].quantity} tree{cart[0].quantity>1?"s":""} · {planName[cart[0].care_plan]}</span><b>{peso(total)}</b></div><div className="mt-3 flex justify-between border-t pt-3 text-xl font-black"><span>Exact total</span><span>{peso(total)}</span></div></div><div className="mt-6 grid grid-cols-2 gap-3"><button onClick={()=>setStep(1)} className="rounded-2xl border px-5 py-4 font-black">Back</button><button onClick={()=>{setAmount(String(total));setStep(3);}} className="rounded-2xl bg-emerald-700 px-5 py-4 font-black text-white">Next: pay</button></div></div>}

        {step===3&&<div className="p-5 sm:p-7"><MayaPaymentQr amount={total}/><div className="mt-5 space-y-3"><input value={sender} onChange={e=>setSender(e.target.value)} placeholder="Maya sender name" className="w-full rounded-2xl border px-4 py-3 text-base"/><input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Maya reference number" className="w-full rounded-2xl border px-4 py-3 text-base"/><label className="block text-xs font-bold text-slate-600">Exact amount<input type="number" value={amount} readOnly className="mt-2 w-full rounded-2xl border bg-slate-50 px-4 py-3 text-base font-black"/></label><label className="block rounded-2xl border border-dashed p-4 text-sm font-black">Receipt image or PDF (max 10 MB)<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>setReceipt(e.target.files?.[0]||null)} className="mt-3 block w-full text-sm"/></label>{notice&&<p className={`rounded-2xl border p-4 text-sm font-bold ${error?"border-red-200 bg-red-50 text-red-800":"border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{notice}</p>}<button disabled={busy} onClick={submit} className="mobile-sticky-action w-full rounded-2xl bg-emerald-700 px-6 py-4 font-black text-white disabled:opacity-50">{busy?"Submitting…":"Submit for admin verification"}</button><button disabled={busy} onClick={()=>setStep(2)} className="mobile-primary-action w-full rounded-2xl border px-6 py-3 text-sm font-black">Back</button></div></div>}
      </section>
    </div>}
  </main>;
}

function Card({title,children}:{title:string;children:React.ReactNode}){return <section className="min-w-0 rounded-[1.75rem] border border-emerald-100 bg-white p-4 shadow-sm sm:p-5 md:p-6"><h2 className="mb-5 text-xl font-black sm:text-2xl">{title}</h2>{children}</section>}
function Empty(){return <div className="rounded-2xl border border-dashed p-6 text-center text-sm font-bold text-slate-500"><Image src="/app-assets/empty-marketplace-v1.png" alt="" width={160} height={160} className="mx-auto mb-3 h-28 w-28 object-contain sm:h-36 sm:w-36" />Your cart is empty. Add a tree to begin.</div>}
