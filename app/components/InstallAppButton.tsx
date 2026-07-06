"use client";

import { useEffect, useState } from "react";

export default function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  async function install() {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();

    await deferredPrompt.userChoice;

    setDeferredPrompt(null);
    setCanInstall(false);
  }

  if (!canInstall) return null;

  return (
    <button
      onClick={install}
      className="rounded-full bg-green-600 px-6 py-3 font-bold text-white shadow-lg hover:bg-green-700 transition"
    >
      📲 Install SUR Aloeswood
    </button>
  );
}