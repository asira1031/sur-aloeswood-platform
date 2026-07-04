import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#06170f] p-6 text-white">
      <div className="max-w-xl rounded-[2rem] border border-red-300/20 bg-red-400/10 p-8 text-center">
        <p className="text-sm font-black uppercase tracking-[0.3em] text-red-200">
          SUR Aloeswood
        </p>
        <h1 className="mt-4 text-5xl font-black">Unauthorized</h1>
        <p className="mt-4 text-sm leading-7 text-white/70">
          You do not have access to this area. Please login using the correct account role.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/login" className="rounded-2xl bg-green-500 px-6 py-4 text-sm font-black text-green-950">
            Login
          </Link>
          <Link href="/investor/dashboard" className="rounded-2xl border border-white/10 bg-white/10 px-6 py-4 text-sm font-black">
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
