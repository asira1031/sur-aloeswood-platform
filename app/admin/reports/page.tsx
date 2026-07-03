export default function AdminReportsPage() {
  const reports = [
    "Co-Planter Registration Report",
    "KYC Approval Report",
    "Seedling Sales Report",
    "Tree Registry Report",
    "Wallet Transaction Report",
    "Recovery Fund Report",
    "Referral Incentive Report",
    "Maintenance Collection Report",
    "Gardener Activity Report",
    "Support Ticket Report",
  ];

  return (
    <main className="min-h-screen bg-slate-950 p-10 text-white">
      <p className="text-sm font-bold uppercase tracking-[0.3em] text-green-300">
        SUR ALOESWOOD ADMIN
      </p>

      <h1 className="mt-4 text-5xl font-black">Reports</h1>

      <p className="mt-4 max-w-3xl text-slate-300">
        Operational, treasury, plantation, support, and compliance reports.
      </p>

      <section className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => (
          <div
            key={report}
            className="rounded-3xl border border-white/10 bg-white/[0.06] p-6"
          >
            <h2 className="text-xl font-black">{report}</h2>
            <p className="mt-3 text-sm text-slate-400">
              View, monitor, and export this report in the next phase.
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}