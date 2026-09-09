"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase/client";
import { clearSurSession, getRoleRoute, saveSurSession } from "@/app/lib/auth/session";
import AccountModeSwitcher from "@/app/components/AccountModeSwitcher";

export default function FarmerLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [verifiedPath, setVerifiedPath] = useState("");

  useEffect(() => {
    let mounted = true;

    async function verifyFarmerAccess() {
      if (pathname === "/farmer/register") {
        setAllowed(true);
        setChecking(false);
        return;
      }

      setChecking(true);
      setAllowed(false);

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        clearSurSession();
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id,email,full_name,role,account_status,kyc_status")
        .eq("auth_user_id", authData.user.id)
        .maybeSingle();

      if (profileError || !profile) {
        clearSurSession();
        router.replace("/unauthorized");
        return;
      }

      const status = String(profile.account_status || "PENDING").toUpperCase();

      const { data: caretakerAccess, error: caretakerError } = await supabase
        .from("gardeners")
        .select("id,status")
        .eq("auth_user_id", authData.user!.id)
        .maybeSingle();
      const caretakerStatus = String(caretakerAccess?.status || "PENDING").toUpperCase();

      if (caretakerError || !caretakerAccess) {
        saveSurSession(profile);
        router.replace(getRoleRoute(profile.role));
        return;
      }

      if (status !== "ACTIVE" || !["ACTIVE", "APPROVED"].includes(caretakerStatus)) {
        clearSurSession();
        router.replace("/unauthorized");
        return;
      }

      saveSurSession(profile);

      if (mounted) {
        setVerifiedPath(pathname);
        setAllowed(true);
        setChecking(false);
      }
    }

    void verifyFarmerAccess().catch(() => {
      if (mounted) {
        setAllowed(false);
        router.replace("/session-expired");
      }
    });

    return () => {
      mounted = false;
    };
  }, [pathname, router]);

  // This public entry point must render without waiting for an authenticated workspace effect.
  if (pathname === "/farmer/register") return <>{children}</>;

  if (checking || !allowed || verifiedPath !== pathname) {
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

  return <div className="sur-maximal-workspace"><AccountModeSwitcher mode="CARETAKER" />{children}</div>;
}
