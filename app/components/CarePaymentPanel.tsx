"use client";
import MayaPaymentQr from "@/app/components/MayaPaymentQr";
import {useEffect,useState} from "react";
import {supabase} from "@/app/lib/supabase/client";
type Quote={account_tree_id:string;plan:string;starts_on:string;covered_until:string;paid_months:number;minimum_months:number;access:boolean;warning:boolean;pending:boolean};
type Payment={id:string;plan:string;months:number;exact_total:number;status:string;review_note:string|null;created_at:string};
const control="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-base";
export default function CarePaymentPanel({treeId}:{treeId:string}){
 const [quote,setQuote]=useState<Quote|null>(null),[history,setHistory]=useState<Payment[]>([]),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [plan,setPlan]=useState("MONTHLY"),[months,setMonths]=useState(1),[sender,setSender]=useState(""),[reference,setReference]=useState(""),[date,setDate]=useState(""),[receipt,setReceipt]=useState<File|null>(null),[busy,setBusy]=useState(false),[show,setShow]=useState(false);
 async function load(){
  const q=await supabase.rpc("sur_care_quote",{p_tree:treeId});
  if(q.error)throw new Error("Care payments are unavailable while setup is completed. Please contact support before sending payment.");
  const value=q.data as Quote;setQuote(value);setMonths(Math.max(1,value.minimum_months));setPlan(value.plan==="ONE_TIME"?"ONE_TIME":"MONTHLY");
  const h=await supabase.from("sur_care_payments").select("id,plan,months,exact_total,status,review_note,created_at").eq("account_tree_id",value.account_tree_id).order("created_at",{ascending:false});
  if(h.error)throw new Error("Payment history could not load. Refresh before submitting another receipt.");
  setHistory((h.data||[]) as Payment[]);
 }
 useEffect(()=>{let active=true;setQuote(null);setHistory([]);setError("");setShow(false);void load().catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[treeId]);
 const total=plan==="ONE_TIME"?5000:months*200;
 async function submit(){
  if(busy||!quote)return;setError("");setNotice("");
  if(!receipt||!sender.trim()||!reference.trim()||!date){setError("Complete the sender, reference, payment date, and receipt.");return}
  if(!["image/jpeg","image/png","image/webp","application/pdf"].includes(receipt.type)||receipt.size>10*1024*1024){setError("Use a JPG, PNG, WebP or PDF receipt up to 10 MB.");return}
  if(plan==="MONTHLY"&&(!Number.isInteger(months)||months<quote.minimum_months||months>120)){setError(`Choose ${quote.minimum_months}–120 months to bring coverage current.`);return}
  setBusy(true);
  try{
   const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Please sign in again.");
   const path=`${user.id}/${crypto.randomUUID()}`;
   const upload=await supabase.storage.from("sur-payment-proofs").upload(path,receipt,{upsert:false,contentType:receipt.type});if(upload.error)throw new Error(upload.error.message);
   const result=await supabase.rpc("sur_submit_care_payment",{p_tree:treeId,p_plan:plan,p_months:plan==="MONTHLY"?months:0,p_sender:sender.trim(),p_reference:reference.trim(),p_date:date,p_receipt:path,p_amount:total});
   if(result.error)throw new Error(result.error.message);
   setNotice("Receipt submitted. Coverage changes only after Admin verifies your Maya payment.");setShow(false);setReference("");setReceipt(null);await load();
  }catch(e){setError((e instanceof Error?e.message:"Connection interrupted.")+" Check payment history before retrying.")}
  finally{setBusy(false)}
 }
 return <section className="mt-5 rounded-2xl border border-emerald-200 bg-white p-5">
  <h2 className="text-xl font-bold">{quote?.plan==="ONE_TIME"?"One-Time Care":"Monthly Care"}</h2>
  {error&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  {notice&&<p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm">{notice}</p>}
  {!quote&&!error&&<p className="mt-3">Loading coverage…</p>}
  {quote&&<><p className="mt-2 text-sm">{quote.plan==="ONE_TIME"?"Care fully paid. No monthly payment required.":quote.plan==="SKIP"?"Planting record only. Choose monthly or discounted one-time care.":`Paid: ${quote.paid_months} months · Coverage through ${new Date(quote.covered_until+"T00:00:00").toLocaleDateString("en-PH")} (renewal date).`}</p>
  {quote.warning&&<p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{quote.access?"Your coverage ends within 7 days. You may pay in advance.":"Coverage has expired. Catch up on unpaid months to unlock regular updates."}</p>}
  {quote.pending?<p className="mt-3 font-bold text-amber-800">Payment awaiting admin verification.</p>:quote.plan!=="ONE_TIME"&&<button disabled={busy} onClick={()=>setShow(!show)} className="mt-4 rounded-xl bg-emerald-900 px-5 py-3 font-bold text-white">{show?"Close payment form":quote.plan==="SKIP"?"Choose Care Plan":"Pay Monthly Care"}</button>}
  {show&&!quote.pending&&<div className="mt-4 space-y-4">
   {quote.plan==="SKIP"&&<label className="block text-sm font-bold">Plan<select className={control} value={plan} onChange={e=>setPlan(e.target.value)} disabled={busy}><option value="MONTHLY">Monthly — ₱200 per month</option><option value="ONE_TIME">One-time — ₱5,000</option></select></label>}
   <p className="text-sm text-slate-600">Your approved plan cannot be switched. Monthly catch-up starts from original ownership, including unpaid months.</p>
   {plan==="MONTHLY"&&<label className="block text-sm font-bold">Months to pay (minimum {quote.minimum_months})<input className={control} type="number" min={quote.minimum_months} max={120} value={months} onChange={e=>setMonths(Number(e.target.value))} disabled={busy}/></label>}
   <MayaPaymentQr amount={total}/>
   <label className="block text-sm font-bold">Sender name<input className={control} value={sender} maxLength={150} onChange={e=>setSender(e.target.value)} disabled={busy}/></label>
   <label className="block text-sm font-bold">Maya reference<input className={control} value={reference} maxLength={120} onChange={e=>setReference(e.target.value)} disabled={busy}/></label>
   <label className="block text-sm font-bold">Payment date<input className={control} type="date" value={date} onChange={e=>setDate(e.target.value)} disabled={busy}/></label>
   <label className="block text-sm font-bold">Receipt (up to 10 MB)<input className={control} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>setReceipt(e.target.files?.[0]||null)} disabled={busy}/></label>
   <button disabled={busy} onClick={()=>void submit()} className="w-full rounded-xl bg-emerald-900 p-4 font-bold text-white disabled:opacity-50">{busy?"Submitting…":"Submit receipt for verification"}</button>
  </div>}</>}
  {history.length>0&&<details className="mt-5"><summary className="cursor-pointer font-bold">Care payment history ({history.length})</summary><div className="mt-3 space-y-3">{history.map(p=><div key={p.id} className="rounded-xl border p-3 text-sm"><b>₱{Number(p.exact_total).toLocaleString("en-PH")} · {p.status}</b><p>{p.plan==="MONTHLY"?`${p.months} months`:"One-time care"} · {new Date(p.created_at).toLocaleDateString("en-PH")}</p>{p.review_note&&<p className="mt-1">Admin: {p.review_note}</p>}</div>)}</div></details>}
 </section>;
}
