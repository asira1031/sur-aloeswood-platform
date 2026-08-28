"use client";
import { useState } from "react";
import { supabase } from "@/app/lib/supabase/client";

export default function WithdrawalReceipt({ value }: { value: string }) {
  const [result, setResult] = useState<{ value: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function prepare() {
    if (busy) return;
    setBusy(true); setError(""); setResult(null);
    try {
      let path = value;
      if (path.startsWith("https://")) {
        const old = new URL(path);
        if (old.origin !== "https://dvidrbhfzzhgwyempgtu.supabase.co") throw new Error("Unrecognized receipt location.");
        const match = old.pathname.match(/^\/storage\/v1\/object\/(?:public|sign)\/withdrawal-proofs\/(.+)$/);
        if (!match) throw new Error("Unrecognized receipt location.");
        path = decodeURIComponent(match[1]);
      }
      if (!path || path.includes(":") || path.includes("\\") || path.split("/").some(p => !p || p === "." || p === "..")) throw new Error("Invalid receipt path.");
      const { data, error: failure } = await supabase.storage.from("withdrawal-proofs").createSignedUrl(path, 120);
      if (failure || !data?.signedUrl) throw new Error("Receipt unavailable. Refresh your session and try again.");
      setResult({ value, url: data.signedUrl });
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Receipt unavailable."); }
    finally { setBusy(false); }
  }
  return <div className="mt-3 text-sm"><button type="button" disabled={busy} onClick={prepare} className="font-bold text-emerald-800 underline">{busy ? "Checking access…" : "View payout receipt"}</button>
    {result?.value === value && <a className="ml-3 underline" href={result.url} target="_blank" rel="noreferrer">Open receipt (valid 2 minutes)</a>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </div>;
}
