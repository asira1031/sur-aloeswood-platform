export default function AdminSettingsPage() {
  const settings = [
    ["Tree Price", "₱14,000 per seedling"],
    ["Annual Maintenance", "₱1,500 per year"],
    ["Referral Incentive", "₱3,000"],
    ["Recovery Fund Allocation", "₱2,000"],
    ["Recovery Fund Max Benefit", "₱50,000"],
    ["Harvest Sharing", "70% Co-Planter / 30% Company"],
    ["Support", "24/7 ticketing"],
    ["Status", "Development configuration"],
  ];

  return (
    <main className="min-h-screen bg-slate-950 p-10 text-white">
      <p className="text-sm font-bold uppercase tracking-[0.3em] text-green-300">
        SUR ALOESWOOD ADMIN
      </p>

      <h1 className="mt-4 text-5xl font-black">Settings</h1>

      <p className="mt-4 max-w-3xl text-slate-300">
        Platform business rules, fees, program settings, and support
        configuration.
      </p>

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        {settings.map(([label, value]) => (
          <div
            key={label}
            className="rounded-3xl border border-white/10 bg-white/[0.06] p-6"
          >
            <p className="text-sm font-bold text-slate-400">{label}</p>
            <p className="mt-3 text-2xl font-black text-green-200">{value}</p>
          </div>
        ))}
      </section>
    </main>
  );
}