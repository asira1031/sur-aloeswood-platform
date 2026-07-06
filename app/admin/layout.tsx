"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  return ["PENDING", "UNDER_REVIEW", "SUSPENDED", "BLOCKED", "REJECTED", "ARCHIVED"].includes(
    String(status || "PENDING").toUpperCase()
  );
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

      const localEmail = localStorage.getItem("sur_login_email");
      const localRole = normalizeRole(localStorage.getItem("sur_profile_role"));
      const localStatus = String(localStorage.getItem("sur_account_status") || "").toUpperCase();

      if (
        localEmail &&
        ["ADMIN", "SUPER_ADMIN", "STAFF"].includes(localRole) &&
        localStatus === "ACTIVE"
      ) {
        if (mounted) {
          setAllowed(true);
          setChecking(false);
        }
        return;
      }

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

  return <>{children}</>;
}