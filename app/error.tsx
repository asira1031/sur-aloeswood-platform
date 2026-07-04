"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#06170f] p-6 text-white">
      <div className="max-w-xl rounded-[2rem] border border-red-300/20 bg-red-400/10 p-8 text-center">
        <p className="text-sm font-black uppercase tracking-[0.3em] text-red-200">
          SUR Aloeswood
        </p>
        <h1 className="mt-4 text-4xl font-black">Something went wrong</h1>
        <p className="mt-4 text-sm leading-7 text-white/70">
          The page encountered an error. You can retry or return to the dashboard.
        </p>
        <p className="mt-4 rounded-2xl bg-black/25 p-4 text-xs text-white/50">
          {error.message}
        </p>
        <button
          onClick={reset}
          className="mt-6 rounded-2xl bg-green-500 px-6 py-4 text-sm font-black text-green-950"
        >
          Try Again
        </button>
      </div>
    </main>
  );
}
