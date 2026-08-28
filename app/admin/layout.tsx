"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import LogoutButton from "@/app/components/LogoutButton";
import {
  clearSurSession,
  getAuthenticatedProfile,
  getRoleRoute,
  saveSurSession,
} from "@/app/lib/auth/session";

function normalizeRole(role?: string | null) {
  return String(role || "").toUpperCase().replace("CO_PLANTER", "COPLANTER");
}

function isBlocked(status?: string | null) {
  return String(status || "").toUpperCase() !== "ACTIVE";
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function verifyAdminAccess() {
      setChecking(true);

      const profile = await getAuthenticatedProfile();

      if (!profile) {
        clearSurSession();
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      const role = normalizeRole(profile.role);

      if (!["ADMIN", "SUPER_ADMIN", "STAFF"].includes(role)) {
        saveSurSession(profile);
        router.replace(getRoleRoute(profile.role));
        return;
      }

      if (isBlocked(profile.account_status)) {
        clearSurSession();
        router.replace("/unauthorized");
        return;
      }

      saveSurSession(profile);

      if (mounted) {
        setAllowed(true);
        setChecking(false);
      }
    }

    verifyAdminAccess();

    return () => {
      mounted = false;
    };
  }, [pathname, router]);

  if (checking || !allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#06170f] p-6 text-white">
        <div className="rounded-[2rem] border border-white/10 bg-white/10 p-8 text-center shadow-2xl">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-green-200">
            SUR Aloeswood Admin
          </p>
          <h1 className="mt-4 text-3xl font-black">Checking access</h1>
          <p className="mt-3 text-sm text-white/70">
            Verifying your admin account before opening the workspace.
          </p>
        </div>
      </main>
    );
  }

  const navigation = [
    { href: "/admin/dashboard", label: "Dashboard" },
    { href: "/admin/coplanters", label: "Accounts" },
    { href: "/admin/orders", label: "Trees & Contracts" },
    { href: "/admin/care-operations", label: "Care" },
    { href: "/admin/withdrawals", label: "Wallet" },
    { href: "/admin/support", label: "Support" },
    { href: "/admin/guardian", label: "TOH Guardian" },
  ];

  return (
    <div className="min-h-screen bg-[#f4f1e7]">
      <header className="sticky top-0 z-50 border-b border-[#d9d4c5] bg-[#fbfaf5]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/admin/dashboard" className="flex min-w-0 items-center gap-3">
            <Image src="/sur-logo.png" alt="SUR Aloeswood" width={48} height={48} className="h-11 w-11 shrink-0 rounded-full object-contain" />
            <div className="min-w-0">
              <p className="truncate text-sm font-black tracking-[.13em] text-[#073d2e] sm:text-base">SUR ALOESWOOD</p>
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#75847d]">Admin workspace</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <details className="relative lg:hidden">
              <summary className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-full border border-[#cdd9d2] bg-white text-xl font-black text-[#073d2e]">☰</summary>
              <nav className="absolute right-0 top-14 w-64 rounded-2xl border border-[#d9d4c5] bg-white p-2 shadow-2xl">
                {navigation.map((item) => <AdminLink key={item.href} {...item} active={pathname.startsWith(item.href)} mobile />)}
                <LogoutButton className="mt-1 w-full rounded-xl px-4 py-3 text-left text-sm font-black text-red-700 hover:bg-red-50" />
              </nav>
            </details>
            <LogoutButton className="hidden rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-black text-red-700 hover:bg-red-50 lg:block" />
          </div>
        </div>

        <nav className="mx-auto hidden max-w-[1440px] gap-1 overflow-x-auto px-6 pb-3 lg:flex lg:px-8">
          {navigation.map((item) => <AdminLink key={item.href} {...item} active={pathname.startsWith(item.href)} />)}
        </nav>
      </header>
      {children}
    </div>
  );
}

function AdminLink({ href, label, active, mobile = false }: { href: string; label: string; active: boolean; mobile?: boolean }) {
  return (
    <Link href={href} className={`${mobile ? "block rounded-xl px-4 py-3" : "whitespace-nowrap rounded-full px-4 py-2.5"} text-sm font-black transition ${active ? "bg-[#073d2e] text-white" : "text-[#53665d] hover:bg-[#e8eee9] hover:text-[#073d2e]"}`}>
      {label}
    </Link>
  );
}
