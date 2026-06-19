import Link from "next/link";

export default function RegisterPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-green-950 text-white">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/forest-bg.jpg')" }}
      />

      <div className="absolute inset-0 bg-gradient-to-r from-green-950/80 via-green-950/45 to-blue-950/40" />

      <nav className="relative z-10 flex items-center justify-between px-8 py-6 lg:px-16">
        <Link href="/" className="flex items-center gap-4">
          <img
            src="/agarwood.png"
            alt="SUR Aloeswood"
            className="h-14 w-14 rounded-2xl object-cover shadow-lg"
          />
          <div>
            <h1 className="text-2xl font-black tracking-wide">
              SUR ALOESWOOD
            </h1>
            <p className="text-sm font-semibold text-green-200">
              Fintech Co-Planter Platform
            </p>
          </div>
        </Link>

        <Link
          href="/login"
          className="rounded-full border border-white/40 bg-white/15 px-6 py-3 font-bold text-white shadow-lg backdrop-blur hover:bg-white/25"
        >
          Login
        </Link>
      </nav>

      <section className="relative z-10 mx-auto grid min-h-[80vh] max-w-7xl items-center gap-12 px-8 lg:grid-cols-2 lg:px-16">
        <div>
          <p className="inline-flex rounded-full bg-white/15 px-5 py-2 text-sm font-bold text-green-100 backdrop-blur">
            Co-Planter Registration
          </p>

          <h2 className="mt-6 text-5xl font-black leading-tight lg:text-7xl">
            Start your
            <span className="block text-green-300">Agarwood journey.</span>
          </h2>

          <p className="mt-6 max-w-xl text-lg leading-8 text-green-50/90">
            Create your SUR Aloeswood account to access tree ownership,
            membership, wallet, marketplace, QR Tree Passport, and plantation
            monitoring.
          </p>
        </div>

        <div className="rounded-[2rem] border border-white/20 bg-white/90 p-8 text-slate-900 shadow-2xl backdrop-blur-xl">
          <h3 className="text-3xl font-black text-blue-950">
            Create Account
          </h3>
          <p className="mt-2 text-slate-500">
            Register as a SUR Aloeswood Co-Planter.
          </p>

          <form className="mt-8 space-y-4">
            <div>
              <label className="text-sm font-bold text-slate-700">
                Full Name
              </label>
              <input
                type="text"
                placeholder="Juan Dela Cruz"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 outline-none focus:border-green-600"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 outline-none focus:border-green-600"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                Mobile Number
              </label>
              <input
                type="text"
                placeholder="+63 900 000 0000"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 outline-none focus:border-green-600"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                Password
              </label>
              <input
                type="password"
                placeholder="Create password"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 outline-none focus:border-green-600"
              />
            </div>

            <button
              type="button"
              className="w-full rounded-2xl bg-green-600 px-6 py-4 text-lg font-black text-white shadow-xl hover:bg-green-700"
            >
              Create Co-Planter Account
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="font-bold text-green-700">
              Login here
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}