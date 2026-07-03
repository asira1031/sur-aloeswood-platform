export default function FarmerDashboardPage() {
  const cards = [
    ["Assigned Trees", "0"],
    ["Today’s Tasks", "0"],
    ["Completed Tasks", "0"],
    ["Pending Updates", "0"],
    ["Photo Updates", "0"],
    ["GPS Updates", "0"],
  ];

  return (
    <main className="min-h-screen bg-[#06170f] p-10 text-white">
      <p className="text-sm font-bold uppercase tracking-[0.3em] text-green-300">
        SUR ALOESWOOD GARDENER PORTAL
      </p>

      <h1 className="mt-4 text-5xl font-black">Gardener Dashboard</h1>

      <p className="mt-4 max-w-3xl text-green-100/80">
        Monitor assigned trees, daily plantation tasks, GPS updates, photo
        reports, growth logs, and maintenance activities.
      </p>

      <section className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(([title, value]) => (
          <div
            key={title}
            className="rounded-3xl border border-white/10 bg-white/[0.06] p-6"
          >
            <p className="text-sm font-bold text-green-200/80">{title}</p>
            <p className="mt-3 text-4xl font-black">{value}</p>
          </div>
        ))}
      </section>
    </main>
  );
}