import Link from "next/link";
import { launchChecklist, launchSummary, type LaunchStatus } from "@/app/lib/launch/checklist";

const statusStyles: Record<LaunchStatus, string> = {
  PASS: "border-emerald-200 bg-emerald-50 text-emerald-800",
  NEEDS_ENV: "border-amber-200 bg-amber-50 text-amber-800",
  NEEDS_SQL: "border-red-200 bg-red-50 text-red-800",
  NEEDS_UAT: "border-sky-200 bg-sky-50 text-sky-800",
};

const statusLabels: Record<LaunchStatus, string> = {
  PASS: "Ready",
  NEEDS_ENV: "Needs Env",
  NEEDS_SQL: "Needs SQL",
  NEEDS_UAT: "Needs UAT",
};

export default function LaunchPage() {
  const summary = launchSummary();
  const launchBlocked = summary.needsEnv + summary.needsSql + summary.needsUat > 0;

  return (
    <main className="min-h-screen bg-[#f3f7f1] text-slate-950">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-4 lg:px-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/20 p-6 shadow-sm lg:p-8">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/forest-bg.jpg')" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-green-950/92 via-green-900/72 to-green-950/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10" />

          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-emerald-200">SUR Aloeswood Production</p>
              <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight text-white lg:text-6xl">
                Launch Readiness
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/80 lg:text-base">
                Customer release checklist for auth, database safety, wallet flow, admin approval, farmer operations, support, legalities, and deployment.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/admin/dashboard" className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur hover:bg-white/20">
                Admin
              </Link>
              <Link href="/investor/dashboard" className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm hover:bg-white/90">
                Investor
              </Link>
            </div>
          </div>

          <div className="relative z-10 mt-8 grid gap-3 md:grid-cols-4">
            <HeroStat label="Ready" value={String(summary.pass)} />
            <HeroStat label="Env" value={String(summary.needsEnv)} />
            <HeroStat label="SQL" value={String(summary.needsSql)} />
            <HeroStat label="UAT" value={String(summary.needsUat)} />
          </div>
        </section>

        <section className={`mt-5 rounded-[2rem] border p-5 shadow-sm lg:p-6 ${launchBlocked ? "border-amber-100 bg-amber-50" : "border-emerald-100 bg-emerald-50"}`}>
          <p className={`text-sm font-black uppercase tracking-[0.2em] ${launchBlocked ? "text-amber-800" : "text-emerald-800"}`}>
            {launchBlocked ? "Not customer-live yet" : "Ready for customer release"}
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">
            {launchBlocked ? "Finish the blockers below before real customer onboarding." : "All launch checks are green."}
          </h2>
        </section>

        <section className="grid gap-4 py-5 lg:grid-cols-3">
          {launchChecklist.map((item) => (
            <article key={`${item.area}-${item.title}`} className="rounded-[1.5rem] border border-emerald-100 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">{item.area}</p>
                  <h3 className="mt-2 text-xl font-black text-slate-950">{item.title}</h3>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusStyles[item.status]}`}>
                  {statusLabels[item.status]}
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">{item.detail}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/16 p-4 backdrop-blur">
      <p className="text-xs font-black uppercase tracking-wide text-white/65">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}
