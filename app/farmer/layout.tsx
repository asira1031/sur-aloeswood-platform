"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase/client";
import { clearSurSession, getRoleRoute, saveSurSession } from "@/app/lib/auth/session";

function normalizeRole(role?: string | null) {
  return String(role || "").toUpperCase().replace("CO_PLANTER", "COPLANTER");
}

export default function FarmerLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function verifyFarmerAccess() {
      if (pathname === "/farmer/register") {
        setAllowed(true);
        setChecking(false);
        return;
      }

      setChecking(true);

      const { data: authData, error: authError } = await supabase.auth.getUser();
      const email = authData.user?.email?.toLowerCase().trim();

      if (authError || !email) {
        clearSurSession();
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id,email,full_name,role,account_status,kyc_status")
        .eq("email", email)
        .maybeSingle();

      if (profileError || !profile) {
        clearSurSession();
        router.replace("/unauthorized");
        return;
      }

      const role = normalizeRole(profile.role);
      const status = String(profile.account_status || "PENDING").toUpperCase();

      if (!["FARMER", "GARDENER", "CARETAKER"].includes(role)) {
        saveSurSession(profile);
        router.replace(getRoleRoute(profile.role));
        return;
      }

      if (["PENDING", "UNDER_REVIEW", "SUSPENDED", "BLOCKED", "REJECTED"].includes(status)) {
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

    verifyFarmerAccess();

    return () => {
      mounted = false;
    };
  }, [pathname, router]);

  if (checking || !allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#06170f] p-6 text-white">
        <div className="rounded-[2rem] border border-white/10 bg-white/10 p-8 text-center shadow-2xl">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-green-200">SUR Aloeswood Farmer</p>
          <h1 className="mt-4 text-3xl font-black">Checking access</h1>
          <p className="mt-3 text-sm text-white/70">Verifying your farmer account before opening the workspace.</p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
