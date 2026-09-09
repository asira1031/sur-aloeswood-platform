"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { getAuthenticatedProfile } from "@/app/lib/auth/session";

export default function AccountModeSwitcher({ mode }: { mode: "CUSTOMER" | "CARETAKER" }) {
  const [caretakerStatus, setCaretakerStatus] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const profile = await getAuthenticatedProfile();
      if (!profile?.email) return;
      const { data } = await supabase.from("gardeners").select("status").eq("email", profile.email.toLowerCase()).maybeSingle();
      if (mounted) setCaretakerStatus(data?.status ? String(data.status).toUpperCase() : null);
    })();
    return () => { mounted = false; };
  }, []);

  if (!caretakerStatus) return null;
  const approved = caretakerStatus === "ACTIVE" || caretakerStatus === "APPROVED";

  return (
    <div className="border-b border-[#d9d4c5] bg-[#fbfaf5]/95 px-4 py-2 backdrop-blur">
      <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#718078]">Choose your workspace</p>
        <div className="flex rounded-full border border-[#cfdad3] bg-white p-1 shadow-sm">
          <Link href="/investor/my-trees" className={`rounded-full px-3 py-2 text-xs font-black sm:px-4 ${mode === "CUSTOMER" ? "bg-[#073d2e] text-white" : "text-[#52655c]"}`}>My Trees</Link>
          {approved ? (
            <Link href="/farmer/daily-care" className={`rounded-full px-3 py-2 text-xs font-black sm:px-4 ${mode === "CARETAKER" ? "bg-[#073d2e] text-white" : "text-[#52655c]"}`}>My Care Work</Link>
          ) : (
            <span title="Caretaker verification is pending" className="cursor-not-allowed rounded-full px-3 py-2 text-xs font-black text-amber-700">Care Work · Pending</span>
          )}
        </div>
      </div>
    </div>
  );
}
