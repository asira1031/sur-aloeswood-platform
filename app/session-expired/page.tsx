import Link from "next/link";

export default function SessionExpiredPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#06170f] p-6 text-white">
      <div className="max-w-xl rounded-[2rem] border border-yellow-300/20 bg-yellow-400/10 p-8 text-center">
        <p className="text-sm font-black uppercase tracking-[0.3em] text-yellow-200">
          SUR Aloeswood
        </p>
        <h1 className="mt-4 text-5xl font-black">Session Expired</h1>
        <p className="mt-4 text-sm leading-7 text-white/70">
          Please login again to continue using the platform.
        </p>
        <Link href="/login" className="mt-6 inline-flex rounded-2xl bg-green-500 px-6 py-4 text-sm font-black text-green-950">
          Login Again
        </Link>
      </div>
    </main>
  );
}
