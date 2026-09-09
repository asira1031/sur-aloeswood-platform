import Link from "next/link";
export default function CaretakerSignup(){
 return <main className="mx-auto max-w-xl p-6"><h1 className="text-3xl font-bold">Become a caretaker</h1><p className="my-5">Use one account for Customer and Caretaker Mode. Create your account, submit your ID and selfie for verification, then apply for Caretaker Mode from Account.</p><div className="flex flex-wrap gap-3"><Link className="rounded-xl bg-emerald-900 px-5 py-3 text-white" href="/register">Create account</Link><Link className="rounded-xl border px-5 py-3" href="/investor/profile">I already have an account</Link></div></main>;
}
