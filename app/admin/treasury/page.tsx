"use client";

const money = (value: number) =>
  `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function AdminTreasuryPage() {
  const treasuryCards = [
    {
      title: "Platform Wallet",
      value: money(0),
    },
    {
      title: "Seedling Sales",
      value: money(0),
    },
    {
      title: "Maintenance Collections",
      value: money(0),
    },
    {
      title: "Recovery Fund Pool",
      value: money(0),
    },
    {
      title: "Referral Payouts",
      value: money(0),
    },
    {
      title: "Harvest Reserve",
      value: money(0),
    },
    {
      title: "Cash In",
      value: money(0),
    },
    {
      title: "Cash Out",
      value: money(0),
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 p-10 text-white">
      <p className="text-sm font-bold uppercase tracking-[0.3em] text-green-300">
        SUR ALOESWOOD ADMIN
      </p>

      <h1 className="mt-4 text-5xl font-black">
        Treasury Dashboard
      </h1>

      <p className="mt-4 max-w-3xl text-slate-300">
        Monitor platform collections, wallet balances, maintenance fees,
        recovery fund, referrals, and overall financial activity.
      </p>

      <section className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {treasuryCards.map((card) => (
          <div
            key={card.title}
            className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-lg"
          >
            <p className="text-sm font-bold text-slate-400">
              {card.title}
            </p>

            <p className="mt-3 text-3xl font-black text-green-300">
              {card.value}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.06] p-8">
        <h2 className="text-2xl font-black">
          Treasury Activity
        </h2>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="border-b border-white/10 text-sm uppercase tracking-wide text-slate-400">
              <tr>
                <th className="py-3">Date</th>
                <th>Reference</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td className="py-6 text-slate-500" colSpan={5}>
                  Treasury transactions will appear here after wallet,
                  marketplace, and harvest modules are connected.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10 rounded-3xl border border-green-500/20 bg-green-500/10 p-6">
        <h2 className="text-xl font-black text-green-300">
          Next Integration
        </h2>

        <ul className="mt-4 space-y-2 text-sm text-green-100">
          <li>• Cash In approvals</li>
          <li>• Cash Out approvals</li>
          <li>• Seedling sales posting</li>
          <li>• Recovery Fund computation</li>
          <li>• Referral payout ledger</li>
          <li>• Harvest revenue distribution</li>
        </ul>
      </section>
    </main>
  );
}