import Image from "next/image";
import Link from "next/link";

export default function MayaPaymentQr({amount}:{amount:number}) {
 return <section aria-label="Maya payment QR" className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-center">
  <h3 className="text-sm font-bold text-amber-950">Scan to pay with Maya</h3>
  <p className="mt-2 text-sm text-amber-950">Please send the exact amount</p>
  <p className="mt-1 break-words text-3xl font-black text-amber-950">₱{amount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
  <div className="mx-auto mt-4 w-full max-w-[320px] rounded-xl border border-slate-200 bg-white p-4">
   <Image src="/sur-maya-payment-qr.png" alt="SUR payment QR supplied by the administrator" width={452} height={452} unoptimized className="h-auto w-full"/>
  </div>
  <div className="mt-4 flex flex-wrap justify-center gap-3">
   <a href="/sur-maya-payment-qr.png" download="SUR-Maya-QR.png" className="rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white">Save QR image</a>
   <a href="/sur-maya-payment-qr.png" target="_blank" rel="noreferrer" className="rounded-xl border border-amber-400 bg-white px-4 py-3 text-sm font-bold">Open full-size QR</a>
  </div>
  <p className="mt-4 text-sm leading-6 text-amber-950">On the same phone, save this QR and select it in your payment app if supported. Check the recipient and enter the exact amount before confirming. This QR does not automatically set the amount.</p>
  <p className="mt-2 text-sm leading-6 text-amber-950">If the recipient is unfamiliar, do not pay. <Link href="/investor/support" className="font-bold underline">Confirm with Agarwood Support</Link>. After payment, submit your receipt below for admin verification.</p>
 </section>;
}
