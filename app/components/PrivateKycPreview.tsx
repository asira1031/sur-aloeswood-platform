"use client";
import { useState } from "react";
import { supabase } from "@/app/lib/supabase/client";

export default function PrivateKycPreview({ label, url }: { label: string; url: string }) {
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true); setError(""); setLink("");
    try {
      let path = url;
      if (/^https?:/i.test(path)) {
        const old = new URL(path);
        if (old.origin !== "https://dvidrbhfzzhgwyempgtu.supabase.co") throw new Error("Unrecognized document location.");
        const match = old.pathname.match(/^\/storage\/v1\/object\/(?:public|sign)\/kyc-docs\/(.+)$/);
        if (!match) throw new Error("Unrecognized document path.");
        path = decodeURIComponent(match[1]);
      }
      if (!path || path.startsWith("/") || path.split("/").some(part => part === "..")) throw new Error("Invalid document path.");
      const {data,error: failure} = await supabase.storage.from("kyc-docs").createSignedUrl(path, 120);
      if (failure || !data?.signedUrl) throw new Error("Document could not open. Check your admin session and retry.");
      setLink(data.signedUrl);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to open document."); }
    finally { setBusy(false); }
  }
  return <section className="rounded-2xl border bg-white p-5"><h3 className="font-bold">{label}</h3>
    <button disabled={busy} onClick={open} className="mt-3 rounded-xl bg-slate-950 px-4 py-3 text-white">{busy ? "Checking access…" : "Prepare private document"}</button>
    {link && <a href={link} target="_blank" rel="noreferrer" className="ml-3 underline">Open — valid for 2 minutes</a>}
    {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}
  </section>;
}
