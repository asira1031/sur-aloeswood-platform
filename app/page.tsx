import Link from "next/link";
import Image from "next/image";
import InstallAppButton from "@/app/components/InstallAppButton";

const steps = [
  ["01", "Choose your tree", "Purchase one agarwood tree and select the care coverage that works for you."],
  ["02", "We plant and tag it", "After payment approval, the farm plants your tree and gives it a unique QR Tree ID."],
  ["03", "Follow its care journey", "View verified care reports, contracts, certificates, and important tree updates in one account."],
];

const trustItems = [
  ["Unique Tree ID", "Every approved tree receives its own identity and physical QR tag."],
  ["Verified care records", "Caretaker submissions are reviewed and compiled into clear updates."],
  ["Contracts & certificates", "Your tree documents remain available in your private account."],
  ["Support when needed", "Send a support ticket with notes or a file and track its resolution."],
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f5ef] text-[#173329]">
      <header className="border-b border-[#173329]/10 bg-[#f7f5ef]/95">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
          <Link href="/" className="group flex min-w-0 items-center gap-3.5" aria-label="SUR Aloeswood home">
            <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-white shadow-[0_7px_20px_rgba(23,51,41,.12)] ring-1 ring-[#d9ad60]/30 transition duration-300 group-hover:-translate-y-0.5 sm:h-16 sm:w-16" aria-hidden="true">
              <Image src="/sur-logo.png" alt="" width={190} height={220} priority className="absolute left-1/2 top-[-1px] h-auto w-[75px] max-w-none -translate-x-1/2 sm:w-[86px]" />
            </span>
            <span>
              <span className="block whitespace-nowrap text-[15px] font-black tracking-[0.11em] sm:text-[17px]">SUR ALOESWOOD</span>
              <span className="block whitespace-nowrap text-[9px] font-bold tracking-[0.08em] text-[#6a786f] sm:text-[10px]">TREE OWNERSHIP & CARE</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/tree" className="hidden px-4 py-2 text-sm font-bold text-[#294c3e] sm:block">Verify a tree</Link>
            <Link href="/login" className="rounded-full border border-[#173329]/20 px-4 py-2.5 text-sm font-bold">Log in</Link>
            <Link href="/register" className="rounded-full bg-[#173329] px-4 py-2.5 text-sm font-bold text-white">Get started</Link>
          </div>
        </nav>
      </header>

      <section className="relative overflow-hidden border-b border-[#173329]/10">
        <div className="absolute inset-y-0 right-0 hidden w-[42%] bg-[#dce6d8] lg:block" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.08fr_.92fr] lg:px-12 lg:py-28">
          <div className="max-w-2xl">
            <p className="mb-6 inline-flex rounded-full border border-[#173329]/15 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#446455]">One tree. One identity. One clear record.</p>
            <h1 className="text-5xl font-black leading-[1.02] tracking-[-0.045em] text-[#122b22] sm:text-6xl lg:text-7xl">
              Own an agarwood tree. <span className="text-[#9a7137]">We handle the care.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#50645a]">Buy a tree, receive your contract, and follow its documented care journey from planting to its future sale—all through one private account.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="rounded-full bg-[#173329] px-7 py-4 text-center font-black text-white shadow-[0_10px_30px_rgba(23,51,41,.18)]">Buy your tree</Link>
              <Link href="#how-it-works" className="rounded-full border border-[#173329]/20 bg-white px-7 py-4 text-center font-black">See how it works</Link>
            </div>
            <p className="mt-5 text-sm font-semibold text-[#66786f]">Tree package from ₱25,000 • Care options shown before payment</p>
          </div>

          <div className="relative min-h-[440px] overflow-hidden rounded-[2.25rem] bg-[#173329] shadow-2xl lg:min-h-[560px]">
            <Image src="/sur-hero-tree-v1.png" alt="A young agarwood tree with its physical QR identification tag" fill priority className="object-cover" sizes="(max-width: 1024px) 100vw, 46vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#10271f]/85 via-transparent to-transparent" />
            <div className="absolute inset-x-5 bottom-5 rounded-3xl border border-white/20 bg-[#173329]/90 p-5 text-white backdrop-blur sm:inset-x-7 sm:bottom-7 sm:p-6">
              <div className="flex items-center gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#d9ad60] text-xl text-[#173329]">✓</span><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b9cbbf]">Physical + digital identity</p><h2 className="mt-1 text-xl font-black">Every approved tree gets its own QR tag.</h2></div></div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="max-w-2xl"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#9a7137]">How it works</p><h2 className="mt-4 text-4xl font-black tracking-[-0.035em] sm:text-5xl">Simple for the customer. Managed behind the scenes.</h2></div>
        <div className="mt-12 grid gap-px overflow-hidden rounded-[2rem] border border-[#173329]/10 bg-[#173329]/10 lg:grid-cols-3">
          {steps.map(([number, title, body]) => (
            <article key={number} className="bg-white p-7 sm:p-9"><p className="text-sm font-black text-[#9a7137]">{number}</p><h3 className="mt-8 text-2xl font-black">{title}</h3><p className="mt-4 leading-7 text-[#5d6e64]">{body}</p></article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:px-12 lg:pb-28">
        <div className="grid gap-5 lg:grid-cols-2">
          <article className="group relative min-h-[430px] overflow-hidden rounded-[2rem] bg-[#173329]">
            <Image src="/sur-care-update-v1.png" alt="A caretaker inspecting agarwood leaves and recording a care update" fill className="object-cover transition duration-700 group-hover:scale-[1.02]" sizes="(max-width: 1024px) 100vw, 50vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#10271f]/90 via-[#10271f]/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-7 text-white sm:p-9"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#e5c17c]">Verified care</p><h3 className="mt-3 text-3xl font-black">Real updates from the people caring for your tree.</h3><p className="mt-3 max-w-lg text-sm leading-6 text-white/80">Caretakers submit their work, then SUR organizes approved records for your account.</p></div>
          </article>
          <article className="group relative min-h-[430px] overflow-hidden rounded-[2rem] bg-[#6a4c2c]">
            <Image src="/sur-records-v1.png" alt="Organized tree ownership documents and digital records" fill className="object-cover transition duration-700 group-hover:scale-[1.02]" sizes="(max-width: 1024px) 100vw, 50vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#10271f]/90 via-transparent to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-7 text-white sm:p-9"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#e5c17c]">Your records</p><h3 className="mt-3 text-3xl font-black">Contracts and certificates, kept together.</h3><p className="mt-3 max-w-lg text-sm leading-6 text-white/80">Open your private account whenever you need to review or download your tree documents.</p></div>
          </article>
        </div>
      </section>

      <section className="bg-[#e8eee5]">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[.8fr_1.2fr] lg:px-12 lg:py-28">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#9a7137]">Built for trust</p><h2 className="mt-4 text-4xl font-black tracking-[-0.035em]">No confusing promises. Just a clear record of your tree.</h2><p className="mt-5 leading-7 text-[#5d6e64]">Agarwood is a long-term journey. SUR keeps the ownership, care, documents, and support history organized while the farm handles the physical work.</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            {trustItems.map(([title, body]) => (
              <article key={title} className="rounded-3xl bg-[#f7f5ef] p-6"><span className="mb-5 block h-2 w-10 rounded-full bg-[#d9ad60]" /><h3 className="text-lg font-black">{title}</h3><p className="mt-3 text-sm leading-6 text-[#5d6e64]">{body}</p></article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12">
        <div className="rounded-[2rem] bg-[#d9ad60] px-6 py-12 text-center text-[#173329] sm:px-12"><h2 className="text-3xl font-black tracking-[-0.03em] sm:text-4xl">Ready to begin your tree journey?</h2><p className="mx-auto mt-4 max-w-xl leading-7 text-[#294c3e]">Create an account, choose your tree, and review every detail before you pay.</p><Link href="/register" className="mt-7 inline-flex rounded-full bg-[#173329] px-7 py-4 font-black text-white">Create your account</Link></div>
      </section>

      <footer className="border-t border-[#173329]/10 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 text-sm text-[#5d6e64] sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12"><p>© 2026 SUR Aloeswood. Tree ownership and care records.</p><div className="flex flex-wrap items-center gap-5 font-bold"><Link href="/legalities">Legal library</Link><Link href="/tree">Verify tree</Link><Link href="/login">Customer login</Link><InstallAppButton /></div></div>
      </footer>
    </main>
  );
}
