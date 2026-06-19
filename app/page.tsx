import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#ecfdf5] text-slate-900">
      <section className="relative min-h-screen">
        {/* FOREST BACKGROUND */}
<div className="absolute inset-0 overflow-hidden">
  <div className="absolute bottom-0 left-0 right-0 h-[300px] bg-gradient-to-t from-green-900 via-green-700 to-transparent" />

  {/* FAR TREES */}
  <div className="absolute bottom-20 left-0 flex w-full justify-around opacity-20">
    {Array.from({ length: 25 }).map((_, i) => (
      <div
        key={i}
        className="h-40 w-8 rounded-full bg-green-900"
        style={{
          transform: `scale(${0.6 + Math.random()})`,
        }}
      />
    ))}
  </div>

  {/* HILLS */}
  <div className="absolute bottom-0 left-[-10%] h-[300px] w-[60%] rounded-[100%] bg-green-800" />

  <div className="absolute bottom-0 right-[-10%] h-[350px] w-[70%] rounded-[100%] bg-green-700" />

  {/* SUN */}
  <div className="absolute right-24 top-24 h-40 w-40 rounded-full bg-yellow-300 opacity-70 blur-sm" />

  {/* FLOATING LEAVES */}
  <div className="absolute inset-0">
    {Array.from({ length: 20 }).map((_, i) => (
      <div
        key={i}
        className="absolute animate-bounce text-green-600"
        style={{
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animationDuration: `${4 + Math.random() * 6}s`,
        }}
      >
        🍃
      </div>
    ))}
  </div>
</div>
       {/* FOREST BACKGROUND */}
<div
  className="absolute inset-0 bg-cover bg-center"
  style={{
    backgroundImage: "url('/forest-bg.jpg')",
  }}
/>

{/* LIGHT OVERLAY */}
<div className="absolute inset-0 bg-gradient-to-r from-black/30 via-black/10 to-transparent" />

{/* DARK BOTTOM DEPTH */}
<div className="absolute inset-0 bg-gradient-to-t from-green-950/40 via-transparent to-transparent" />
        <nav className="relative z-20 flex items-center justify-between px-8 py-6 lg:px-16">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-green-600 to-blue-700 shadow-lg">
  <img
    src="/agarwood.png"
    alt="SUR Aloeswood"
    className="h-10 w-10 object-contain"
  />
</div>
            <div>
              <h1 className="text-2xl font-black tracking-wide text-blue-950">
                SUR ALOESWOOD
              </h1>
              <p className="text-sm font-semibold text-green-700">
                Fintech Co-Planter Platform
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Link
              href="/login"
              className="rounded-full border border-blue-700 bg-white/70 px-6 py-3 font-bold text-blue-800 shadow-sm backdrop-blur hover:bg-blue-50"
            >
              Login
            </Link>

            <Link
              href="/register"
              className="rounded-full bg-green-600 px-6 py-3 font-bold text-white shadow-lg shadow-green-500/20 hover:bg-green-700"
            >
              Register
            </Link>
          </div>
        </nav>

        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-14 px-8 py-16 lg:grid-cols-2 lg:px-16 lg:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-white/80 px-5 py-2 text-sm font-bold text-green-700 shadow-sm backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Since 2024 • Sustainable Agarwood Ownership
            </div>

            <h2 className="mt-8 text-5xl font-black leading-tight text-blue-950 lg:text-7xl">
              Grow Wealth Through
              <span className="block bg-gradient-to-r from-green-600 to-blue-700 bg-clip-text text-transparent">
                Digital Tree Ownership
              </span>
            </h2>

            <p className="mt-7 max-w-xl text-lg leading-8 text-slate-600">
              Invest, monitor, and manage Agarwood trees through a premium
              digital platform with QR Tree Passport, GPS tracking, farm
              reports, wallet, marketplace, and harvest monitoring.
            </p>

            <div className="mt-9 flex flex-wrap gap-4">
              <Link
                href="/register"
                className="rounded-2xl bg-green-600 px-8 py-4 text-lg font-black text-white shadow-xl shadow-green-500/25 hover:bg-green-700"
              >
                Become a Co-Planter
              </Link>

              <Link
                href="/login"
                className="rounded-2xl border border-blue-800 bg-white px-8 py-4 text-lg font-black text-blue-900 shadow-lg hover:bg-blue-50"
              >
                Investor Login
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
                <p className="text-2xl font-black text-yellow-600">70%</p>
                <p className="mt-1 text-sm text-slate-500">Harvest Share</p>
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
                    <p className="text-sm text-green-100">Current Value</p>
                    <p className="font-bold">₱7,500</p>
                  </div>
                  <div className="rounded-2xl bg-white/15 p-4">
                    <p className="text-sm text-green-100">Harvest</p>
                    <p className="font-bold">2032</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-3xl bg-green-50 p-5">
                  <p className="text-sm text-slate-500">Trees Registered</p>
                  <h4 className="mt-2 text-4xl font-black text-green-700">
                    12,450
                  </h4>
                </div>

                <div className="rounded-3xl bg-blue-50 p-5">
                  <p className="text-sm text-slate-500">Active Investors</p>
                  <h4 className="mt-2 text-4xl font-black text-blue-700">
                    2,140
                  </h4>
                </div>

                <div className="rounded-3xl bg-yellow-50 p-5">
                  <p className="text-sm text-slate-500">Managed Farms</p>
                  <h4 className="mt-2 text-4xl font-black text-yellow-600">
                    18
                  </h4>
                </div>

                <div className="rounded-3xl bg-purple-50 p-5">
                  <p className="text-sm text-slate-500">Harvest Cycle</p>
                  <h4 className="mt-2 text-4xl font-black text-purple-700">
                    5-7Y
                  </h4>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-8 pb-16 lg:px-16">
          <div className="grid gap-5 md:grid-cols-4">
            {[
              "Investor Dashboard",
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
                  Built for transparent agarwood ownership, monitoring, and
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