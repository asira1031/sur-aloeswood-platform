"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase/client";

export default function LogoutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await supabase.auth.signOut();
    [
      "sur_login_email",
      "sur_profile_id",
      "sur_profile_role",
      "sur_role",
      "sur_farmer_id",
      "sur_admin_id",
    ].forEach((key) => localStorage.removeItem(key));
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loading}
      className={
        className ||
        "w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-800 transition hover:bg-red-100 disabled:opacity-60"
      }
    >
      {loading ? "Logging out..." : "Logout"}
    </button>
  );
}
