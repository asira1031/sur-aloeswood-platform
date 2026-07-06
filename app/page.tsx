import Link from "next/link";

const treeScales = [
  0.65, 0.82, 1.05, 0.74, 1.18, 0.92, 0.7, 1.12, 0.86, 1.01,
  0.78, 1.2, 0.9, 0.68, 1.08, 0.96, 0.8, 1.16, 0.72, 1,
  0.88, 1.1, 0.76, 0.94, 1.14,
];

const leaves = [
  { left: 8, top: 18, duration: 7 },
  { left: 18, top: 54, duration: 9 },
  { left: 29, top: 26, duration: 8 },
  { left: 41, top: 66, duration: 10 },
  { left: 52, top: 20, duration: 6 },
  { left: 63, top: 48, duration: 11 },
  { left: 74, top: 30, duration: 8 },
  { left: 86, top: 62, duration: 9 },
  { left: 93, top: 17, duration: 7 },
  { left: 12, top: 80, duration: 12 },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#ecfdf5] text-slate-900">
      <section className="relative min-h-screen">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute bottom-0 left-0 right-0 h-[300px] bg-gradient-to-t from-green-900 via-green-700 to-transparent" />

          <div className="absolute bottom-20 left-0 flex w-full justify-around opacity-20">
            {treeScales.map((scale, i) => (
              <div
                key={i}
                className="h-40 w-8 rounded-full bg-green-900"
                style={{ transform: `scale(${scale})` }}
              />
            ))}
          </div>

          <div className="absolute bottom-0 left-[-10%] h-[300px] w-[60%] rounded-[100%] bg-green-800" />
          <div className="absolute bottom-0 right-[-10%] h-[350px] w-[70%] rounded-[100%] bg-green-700" />
          <div className="absolute right-24 top-24 h-40 w-40 rounded-full bg-yellow-300 opacity-70 blur-sm" />

          <div className="absolute inset-0">
            {leaves.map((leaf, i) => (
              <div
                key={i}
                className="absolute animate-bounce text-green-600"
                style={{
                  left: `${leaf.left}%`,
                  top: `${leaf.top}%`,
                  animationDuration: `${leaf.duration}s`,
                }}
              >
                🍃
              </div>
            ))}
          </div>
        </div>

        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/forest-bg.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/15 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-green-950/50 via-transparent to-transparent" />

        <nav className="relative z-20 flex flex-wrap items-center justify-between gap-5 px-8 py-6 lg:px-16">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-green-600 to-blue-700 shadow-lg">
              <img
                src="/agarwood.png"
                alt="SUR Aloeswood"
                className="h-10 w-10 object-contain"
              />
            </div>

            <div>
              <h1 className="text-2xl font-black tracking-wide text-white">
                SUR ALOESWOOD
              </h1>
              <p className="text-sm font-semibold text-green-200">
                Co-Planter Management Platform
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/login" className="rounded-full border border-white/70 bg-white/90 px-5 py-3 text-sm font-black text-blue-900 shadow-sm backdrop-blur hover:bg-blue-50">
              Co-Planter Login
            </Link>
            <Link href="/admin/login" className="rounded-full bg-emerald-700 px-5 py-3 text-sm font-black text-white shadow-lg hover:bg-emerald-800">
              Admin Login
            </Link>
            <Link href="/gardener/login" className="rounded-full bg-amber-500 px-5 py-3 text-sm font-black text-white shadow-lg hover:bg-amber-600">
              Gardener Login
            </Link>
            <Link href="/register" className="rounded-full bg-green-600 px-5 py-3 text-sm font-black text-white shadow-lg hover:bg-green-700">
              Register
            </Link>
          </div>
        </nav>

        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-14 px-8 py-16 lg:grid-cols-2 lg:px-16 lg:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-white/80 px-5 py-2 text-sm font-bold text-green-700 shadow-sm backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Sustainable Agarwood Plantation Management
            </div>

            <h2 className="mt-8 text-5xl font-black leading-tight text-white drop-shadow-lg lg:text-7xl">
              Manage Your
              <span className="block bg-gradient-to-r from-green-300 to-blue-300 bg-clip-text text-transparent">
                Agarwood Co-Planting
              </span>
            </h2>

            <p className="mt-7 max-w-xl text-lg leading-8 text-white/85">
              Register, monitor, and manage Agarwood co-planting records through
              a premium digital platform with QR Tree Passport, GPS tracking,
              farm reports, wallet records, marketplace access, and harvest
              updates.
            </p>

            <div className="mt-9 flex flex-wrap gap-4">
              <Link href="/register" className="rounded-2xl bg-green-600 px-8 py-4 text-lg font-black text-white shadow-xl shadow-green-500/25 hover:bg-green-700">
                Become a Co-Planter
              </Link>
              <Link href="/login" className="rounded-2xl border border-white bg-white px-8 py-4 text-lg font-black text-blue-900 shadow-lg hover:bg-blue-50">
                Co-Planter Login
              </Link>
              <Link href="/admin/login" className="rounded-2xl bg-emerald-700 px-8 py-4 text-lg font-black text-white shadow-lg hover:bg-emerald-800">
                Admin Login
              </Link>
              <Link href="/gardener/login" className="rounded-2xl bg-amber-500 px-8 py-4 text-lg font-black text-white shadow-lg hover:bg-amber-600">
                Gardener Login
              </Link>
            </div>

            <div className="mt-10 grid max-w-xl grid-cols-3 gap-4">
              <div className="rounded-2xl border border-white bg-white/70 p-4 shadow-sm backdrop-blur">
                <p className="text-2xl font-black text-green-700">QR</p>
                <p className="mt-1 text-sm text-slate-500">Tree Passport</p>
              </div>
              <div className="rounded-2xl border border-white bg-white/70 p-4 shadow-sm backdrop-blur">
                <p className="text-2xl font-black text-blue-700">GPS</p>
                <p className="mt-1 text-sm text-slate-500">Farm Tracking</p>
              </div>
              <div className="rounded-2xl border border-white bg-white/70 p-4 shadow-sm backdrop-blur">
                <p className="text-2xl font-black text-yellow-600">Share</p>
                <p className="mt-1 text-sm text-slate-500">Harvest Terms</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 rounded-[3rem] bg-gradient-to-br from-green-300/40 via-blue-300/30 to-yellow-200/40 blur-2xl" />

            <div className="relative rounded-[2.5rem] border border-white bg-white/85 p-7 shadow-2xl backdrop-blur">
              <div className="mb-6 rounded-[2rem] bg-gradient-to-br from-green-700 via-green-600 to-blue-700 p-7 text-white">
                <p className="text-sm font-bold uppercase tracking-[0.25em] text-green-100">
                  Featured Tree Passport
                </p>

                <div className="mt-6 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-3xl font-black">AGR-2026-0001</h3>
                    <p className="mt-2 text-green-100">Batangas Plantation</p>
                  </div>

                  <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white text-4xl text-slate-900 shadow-xl">
                    ▦
                  </div>
                </div>

                <div className="mt-7 grid grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-white/15 p-4">
                    <p className="text-sm text-green-100">Owner</p>
                    <p className="font-bold">Juan Dela Cruz</p>
                  </div>
                  <div className="rounded-2xl bg-white/15 p-4">
                    <p className="text-sm text-green-100">Age</p>
                    <p className="font-bold">3 Months</p>
                  </div>
                  <div className="rounded-2xl bg-white/15 p-4">
                    <p className="text-sm text-green-100">Record Status</p>
                    <p className="font-bold">Monitored</p>
                  </div>
                  <div className="rounded-2xl bg-white/15 p-4">
                    <p className="text-sm text-green-100">Harvest</p>
                    <p className="font-bold">2032</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  ["Trees Registered", "Verified", "text-green-700", "bg-green-50"],
                  ["Active Co-Planters", "Managed", "text-blue-700", "bg-blue-50"],
                  ["Managed Farms", "Active", "text-yellow-600", "bg-yellow-50"],
                  ["Harvest Cycle", "Cycle", "text-purple-700", "bg-purple-50"],
                ].map(([label, value, color, bg]) => (
                  <div key={label} className={`rounded-3xl ${bg} p-5`}>
                    <p className="text-sm text-slate-500">{label}</p>
                    <h4 className={`mt-2 text-4xl font-black ${color}`}>
                      {value}
                    </h4>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-8 pb-16 lg:px-16">
          <div className="grid gap-5 md:grid-cols-4">
            {[
              "Co-Planter Dashboard",
              "QR Tree Passport",
              "GPS Farm Monitoring",
              "Digital Marketplace",
            ].map((item) => (
              <div
                key={item}
                className="rounded-3xl border border-white bg-white/75 p-6 shadow-sm backdrop-blur"
              >
                <div className="mb-4 h-2 w-16 rounded-full bg-gradient-to-r from-green-500 to-blue-500" />
                <h3 className="text-lg font-black text-blue-950">{item}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Built for transparent agarwood co-planting, monitoring, and
                  long-term harvest tracking.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}