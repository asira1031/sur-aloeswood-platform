import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#06170f] p-6 text-white">
      <div className="max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 text-center">
        <p className="text-sm font-black uppercase tracking-[0.3em] text-green-300">
          SUR Aloeswood
        </p>
        <h1 className="mt-4 text-5xl font-black">Page Not Found</h1>
        <p className="mt-4 text-sm leading-7 text-white/70">
          The page you are looking for does not exist or may have been moved.
        </p>
        <Link
          href="/investor/dashboard"
          className="mt-6 inline-flex rounded-2xl bg-green-500 px-6 py-4 text-sm font-black text-green-950"
        >
          Back to Dashboard
        </Link>
      </div>
    </main>
  );
}