export default function AdminSupportPage() {
  return (
    <main className="min-h-screen bg-slate-950 p-10 text-white">
      <p className="text-sm font-bold uppercase tracking-[0.3em] text-green-300">
        SUR ALOESWOOD ADMIN
      </p>

      <h1 className="mt-4 text-5xl font-black">
        Support Center
      </h1>

      <p className="mt-4 max-w-3xl text-slate-300">
        Customer support, technical assistance, payment concerns,
        plantation concerns, and complaint management.
      </p>

      <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.06] p-8">
        <h2 className="text-2xl font-black">
          Support Module
        </h2>

        <p className="mt-4 text-slate-400">
          Support ticket system will be connected after the Customer Support
          database and messaging engine are completed.
        </p>
      </div>
    </main>
  );
}