"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { COPLANTER_PACKAGE_PRICE, MONTHLY_TREE_CARE_FEE, ONE_TIME_TREE_CARE_FEE, peso } from "@/app/lib/business/rules";

type Plan = "SKIP" | "MONTHLY" | "ONE_TIME";
type CartLine = { id: string; quantity: number; care_plan: Plan };
type Order = { id:string; order_no:string; status:string; exact_total:number; created_at:string };
const planPrice:Record<Plan,number>={SKIP:0,MONTHLY:MONTHLY_TREE_CARE_FEE,ONE_TIME:ONE_TIME_TREE_CARE_FEE};
const planName:Record<Plan,string>={SKIP:"Skip care plan",MONTHLY:"Monthly care",ONE_TIME:"One-time care"};

export default function TreeCheckout(){
  const [cart,setCart]=useState<CartLine[]>([]); const [checkout,setCheckout]=useState(false);
  const [sender,setSender]=useState(""); const [reference,setReference]=useState(""); const [date,setDate]=useState("");
  const [amount,setAmount]=useState(""); const [receipt,setReceipt]=useState<File|null>(null); const [orders,setOrders]=useState<Order[]>([]);
  const [busy,setBusy]=useState(false); const [notice,setNotice]=useState(""); const [error,setError]=useState(false);
  const total=useMemo(()=>cart.reduce((sum,x)=>sum+(COPLANTER_PACKAGE_PRICE+planPrice[x.care_plan])*x.quantity,0),[cart]);

  useEffect(()=>{ void loadOrders(); },[]);
  async function loadOrders(){ const {data:{user}}=await supabase.auth.getUser(); if(!user)return;
    const {data}=await supabase.from("sur_tree_orders").select("id,order_no,status,exact_total,created_at").order("created_at",{ascending:false}).limit(30); setOrders((data||[]) as Order[]); }
  function add(){setCart(x=>[...x,{id:crypto.randomUUID(),quantity:1,care_plan:"SKIP"}]);setCheckout(false);setNotice("");}
  function update(id:string,patch:Partial<CartLine>){setCart(x=>x.map(v=>v.id===id?{...v,...patch}:v));}
  function remove(id:string){setCart(x=>x.filter(v=>v.id!==id));}
  function leaveCheckout(){setCheckout(false);setCart([]);setNotice("Cart cleared. Add a tree again when you are ready to pay.");setError(false);}
  async function submit(){
    setNotice("");setError(false); if(!cart.length||!receipt||!sender.trim()||!reference.trim()||!date||!amount){setError(true);setNotice("Complete the Maya payment form and attach the receipt.");return;}
    if(receipt.size>10*1024*1024){setError(true);setNotice("Receipt must be 10 MB or smaller.");return;}
    const {data:{user}}=await supabase.auth.getUser(); if(!user){setError(true);setNotice("Please sign in before submitting payment.");return;}
    setBusy(true);
    try{
      const ext=receipt.name.split(".").pop()?.toLowerCase()||"bin"; const path=`${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const uploaded=await supabase.storage.from("sur-payment-proofs").upload(path,receipt,{upsert:false,contentType:receipt.type}); if(uploaded.error)throw uploaded.error;
      const {data,error:rpcError}=await supabase.rpc("sur_submit_tree_order",{p_items:cart.map(({quantity,care_plan})=>({quantity,care_plan})),p_sender_name:sender.trim(),p_reference:reference.trim(),p_payment_date:date,p_receipt_path:path,p_submitted_total:Number(amount)}); if(rpcError)throw rpcError;
      setNotice(`Order submitted: ${String((data as {status?:string})?.status||"PENDING_VERIFICATION").replaceAll("_"," ")}. Admin will verify the real Maya payment before tree allocation.`);
      setCart([]);setCheckout(false);setSender("");setReference("");setDate("");setAmount("");setReceipt(null);await loadOrders();
    }catch(e){const text=e instanceof Error?e.message:"Unable to submit the order.";setError(true);setNotice(text.includes("schema cache")||text.includes("bucket")?"Checkout is temporarily unavailable while Agarwood Support completes one-time setup. No payment record was submitted.":text);}finally{setBusy(false);}
  }

  return <main className="min-h-screen bg-[#f4f7f2] text-slate-950">
    <section className="relative overflow-hidden bg-[#072417] text-white"><div className="absolute inset-0 bg-[url('/forest-bg.jpg')] bg-cover bg-center opacity-20"/><div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-5 sm:py-10 md:px-8">
      <p className="text-xs font-black uppercase tracking-[.18em] text-emerald-300 sm:tracking-[.3em]">Buy a managed agarwood tree</p><h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight sm:text-4xl md:text-6xl">Choose each tree and care plan. Pay one exact Maya total.</h1>
      <p className="mt-5 max-w-3xl text-base leading-8 text-white/75">Tree ownership is ₱25,000 per tree. The farm handles allocation, planting, QR tagging and care operations after payment approval and customer contract signing.</p>
      <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap"><Link href="/investor/dashboard" className="mobile-primary-action inline-flex w-full items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black sm:w-auto">Dashboard</Link><Link href="/investor/support" className="mobile-primary-action inline-flex w-full items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black sm:w-auto">Need help?</Link></div>
    </div></section>
    <div className="mx-auto grid max-w-7xl gap-5 px-3 py-5 sm:px-5 sm:py-7 md:px-8 xl:grid-cols-[1fr_.82fr]">
      <section className="min-w-0 space-y-5">
        <Card title="1. Understand what you are buying"><div className="grid gap-3 md:grid-cols-3"><PlanCard title="Tree" price="₱25,000" text="Full payment. One permanent Tree ID, QR record and contract per tree."/><PlanCard title="Monthly care" price="₱200/month" text="Care coverage and compiled updates. Catch-up starts from month one."/><PlanCard title="One-time care" price="₱5,000" text="Discounted care coverage until the tree is sold."/></div><p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">No guaranteed growth, sale date, buyer, market price or profit. Current gross estimate is ₱200,000–₱300,000 and may move up or down.</p></Card>
        <Card title="2. Your cart"><div className="space-y-3">{cart.length===0?<Empty/>:cart.map((line,i)=><div key={line.id} className="grid min-w-0 gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 md:grid-cols-[auto_1fr_1fr_auto] md:items-end"><div className="font-black">Tree {i+1}</div><label className="min-w-0 text-xs font-bold text-slate-600">Quantity<input type="number" min={1} value={line.quantity} onChange={e=>update(line.id,{quantity:Math.max(1,Number(e.target.value)||1)})} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-base"/></label><label className="min-w-0 text-xs font-bold text-slate-600">Care plan<select value={line.care_plan} onChange={e=>update(line.id,{care_plan:e.target.value as Plan})} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-base"><option value="SKIP">Skip — ₱0</option><option value="MONTHLY">Monthly — ₱200 now</option><option value="ONE_TIME">One-time — ₱5,000</option></select></label><button onClick={()=>remove(line.id)} className="mobile-primary-action w-full rounded-xl border border-red-200 px-4 py-3 text-sm font-black text-red-700 md:w-auto">Remove</button></div>)}</div><button onClick={add} className="mobile-primary-action mt-4 w-full rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white sm:w-auto">+ Add a tree</button></Card>
        <Card title="Your recent orders">{orders.length===0?<p className="text-sm text-slate-500">No submitted orders yet.</p>:<div className="space-y-3">{orders.map(o=><div key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4"><div><p className="font-black">{o.order_no}</p><p className="mt-1 text-xs text-slate-500">{new Date(o.created_at).toLocaleString("en-PH")}</p></div><div className="text-right"><p className="font-black">{peso(o.exact_total)}</p><p className="mt-1 text-xs font-black text-amber-700">{o.status.replaceAll("_"," ")}</p></div></div>)}</div>}</Card>
      </section>
      <aside className="min-w-0 space-y-5"><Card title="3. Exact checkout"><div className="space-y-3">{cart.map((x,i)=><div key={x.id} className="flex min-w-0 items-start justify-between gap-3 text-sm"><span className="min-w-0">Tree {i+1} × {x.quantity} — {planName[x.care_plan]}</span><b className="shrink-0">{peso((COPLANTER_PACKAGE_PRICE+planPrice[x.care_plan])*x.quantity)}</b></div>)}<div className="flex items-start justify-between gap-3 border-t pt-4 text-xl font-black"><span className="min-w-0">Exact total</span><span className="shrink-0">{peso(total)}</span></div></div>
        {!checkout?<button disabled={!cart.length} onClick={()=>{setCheckout(true);setAmount(String(total));}} className="mobile-primary-action mt-5 w-full rounded-2xl bg-amber-400 px-6 py-4 font-black text-amber-950 disabled:opacity-40">Pay</button>:<div className="mt-5 space-y-3"><div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-center"><p className="text-xs font-black uppercase text-amber-800">Please send the exact amount</p><p className="mt-2 break-words text-3xl font-black">{peso(total)}</p><p className="mt-2 text-sm font-bold text-amber-900">Use the official Maya QR configured by the admin.</p></div>
          <input value={sender} onChange={e=>setSender(e.target.value)} placeholder="Maya sender name" className="w-full rounded-2xl border px-4 py-3 text-base"/><input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Maya reference number" className="w-full rounded-2xl border px-4 py-3 text-base"/><label className="block text-xs font-bold text-slate-600">Payment date<input type="date" value={date} onChange={e=>setDate(e.target.value)} className="mt-2 w-full rounded-2xl border px-4 py-3 text-base"/></label><input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Amount sent" className="w-full rounded-2xl border px-4 py-3 text-base"/><label className="block rounded-2xl border border-dashed p-4 text-sm font-black">Receipt image or PDF (max 10 MB)<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>setReceipt(e.target.files?.[0]||null)} className="mt-3 block w-full text-sm"/></label>
          <button disabled={busy} onClick={submit} className="mobile-sticky-action w-full rounded-2xl bg-emerald-700 px-6 py-4 font-black text-white disabled:opacity-50">{busy?"Submitting…":"Submit for admin verification"}</button><button disabled={busy} onClick={leaveCheckout} className="mobile-primary-action w-full rounded-2xl border px-6 py-3 text-sm font-black">Back and clear cart</button></div>}
        {notice&&<p className={`mt-4 rounded-2xl border p-4 text-sm font-bold ${error?"border-red-200 bg-red-50 text-red-800":"border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{notice}</p>}
      </Card><Card title="What happens next"><ol className="space-y-3 text-sm leading-6 text-slate-700"><li><b>1.</b> Admin verifies your Maya receipt.</li><li><b>2.</b> One Tree ID and contract are created per tree.</li><li><b>3.</b> You sign each contract.</li><li><b>4.</b> Tree becomes active; farm handles planting, QR and caretaker setup.</li><li><b>5.</b> Approved evidence appears in My Agarwood.</li></ol></Card></aside>
    </div>
  </main>;
}

function Card({title,children}:{title:string;children:React.ReactNode}){return <section className="min-w-0 rounded-[1.75rem] border border-emerald-100 bg-white p-4 shadow-sm sm:p-5 md:p-6"><h2 className="mb-5 text-xl font-black sm:text-2xl">{title}</h2>{children}</section>}
function PlanCard({title,price,text}:{title:string;price:string;text:string}){return <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4"><p className="font-black">{title}</p><p className="mt-2 text-2xl font-black text-emerald-700">{price}</p><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></div>}
function Empty(){return <div className="rounded-2xl border border-dashed p-6 text-sm font-bold text-slate-500">Your cart is empty. Add a tree to begin.</div>}
