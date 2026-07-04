export default function Loading() {
  return (
    <main className="min-h-screen bg-[#06170f] p-6 text-white lg:p-14">
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-8">
        <div className="h-5 w-48 animate-pulse rounded-full bg-green-300/20" />
        <div className="mt-6 h-12 w-3/4 animate-pulse rounded-full bg-white/10" />
        <div className="mt-5 h-4 w-full animate-pulse rounded-full bg-white/10" />
        <div className="mt-3 h-4 w-2/3 animate-pulse rounded-full bg-white/10" />
      </section>
      <section className="mt-8 grid gap-5 md:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6">
            <div className="h-4 w-24 animate-pulse rounded-full bg-white/10" />
            <div className="mt-4 h-8 w-32 animate-pulse rounded-full bg-green-300/20" />
          </div>
        ))}
      </section>
    </main>
  );
}
