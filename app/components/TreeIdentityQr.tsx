"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function TreeIdentityQr({ code }: { code: string }) {
  const [image, setImage] = useState("");
  useEffect(() => {
    let active = true;
    const target = new URL(`/tree/${encodeURIComponent(code)}`, window.location.origin).href;
    QRCode.toDataURL(target, { width: 240, margin: 4, errorCorrectionLevel: "M" })
      .then(value => { if (active) setImage(value); })
      .catch(() => { if (active) setImage(""); });
    return () => { active = false; };
  }, [code]);
  return <a href={`/tree/${encodeURIComponent(code)}`} aria-label="Open tree verification" className="block rounded-xl border bg-white p-1">
    {image ? <Image unoptimized src={image} width={80} height={80} alt={`Verification QR for ${code}`} /> : <span className="block p-2 text-xs">Verify tree</span>}
  </a>;
}
