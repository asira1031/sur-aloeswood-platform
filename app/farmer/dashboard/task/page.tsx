export default function FarmerTasksPage() {
  return (
    <main className="min-h-screen bg-[#06170f] p-10 text-white">
      <p className="text-sm font-bold uppercase tracking-[0.3em] text-green-300">
        SUR ALOESWOOD GARDENER PORTAL
      </p>

      <h1 className="mt-4 text-5xl font-black">Assigned Tasks</h1>

      <p className="mt-4 max-w-3xl text-green-100/80">
        Tree care tasks, photo uploads, GPS updates, height and diameter logs,
        health reports, and completion tracking.
      </p>

      <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.06] p-8">
        <h2 className="text-2xl font-black">Task Queue</h2>

        <div className="mt-6 rounded-2xl border border-dashed border-white/15 bg-black/20 p-8 text-center text-sm font-semibold text-white/60">
          No assigned tasks yet. Tasks will appear here after admin assigns a
          gardener to a registered AG tree.
        </div>
      </section>
    </main>
  );
}