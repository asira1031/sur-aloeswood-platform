"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase/client";

export default function FarmerRegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const cleanEmail = email.toLowerCase().trim();
    const cleanName = fullName.trim();
    const cleanMobile = mobile.trim();

    if (!cleanName || !cleanEmail || !password || !resumeFile) {
      setMessage("Complete name, email, password, and resume photo.");
      return;
    }

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    if (!resumeFile.type.startsWith("image/")) {
      setMessage("Resume/CV must be an image file.");
      return;
    }

    setSubmitting(true);

    const safeFileName = resumeFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const filePath = `resumes/${Date.now()}-${cleanEmail}-${safeFileName}`;
    const { error: uploadError } = await supabase.storage
      .from("farmer-resumes")
      .upload(filePath, resumeFile, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      setSubmitting(false);
      setMessage(`${uploadError.message}. Please contact admin if upload is not ready yet.`);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("farmer-resumes").getPublicUrl(filePath);

    const response = await fetch("/api/farmer/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: cleanName,
        email: cleanEmail,
        mobile: cleanMobile,
        password,
        resumeUrl: publicUrlData.publicUrl,
      }),
    });

    const result = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      setMessage(result.error || "Unable to complete farmer registration.");
      return;
    }

    setMessage(result.message || "Farmer registration complete.");
    router.push("/login");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-green-950 text-white">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/forest-bg.jpg')" }} />
      <div className="absolute inset-0 bg-gradient-to-r from-green-950/88 via-green-950/58 to-blue-950/42" />

      <nav className="relative z-10 flex items-center justify-between px-6 py-5 lg:px-14">
        <Link href="/" className="flex items-center gap-3">
          <img src="/agarwood.png" alt="SUR Aloeswood" className="h-12 w-12 rounded-2xl object-cover shadow-lg" />
          <div>
            <h1 className="text-xl font-black tracking-wide">SUR ALOESWOOD</h1>
            <p className="text-xs font-bold text-green-200">Farmer Registration</p>
          </div>
        </Link>
        <Link href="/login" className="rounded-full bg-white px-5 py-3 text-sm font-black text-green-950 shadow-sm">
          Login
        </Link>
      </nav>

      <section className="relative z-10 mx-auto flex min-h-[78vh] max-w-6xl items-center px-6 py-8 lg:px-14">
        <div className="w-full max-w-2xl rounded-[2rem] border border-white/20 bg-white/95 p-7 text-slate-950 shadow-2xl backdrop-blur-xl lg:p-9">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-700">Secure Farmer Registration</p>
          <h2 className="mt-4 text-4xl font-black text-blue-950">Create Farmer Account</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Complete your farmer profile. After approval-ready registration, you can login from the main platform and open the Farmer app.
          </p>

          <form className="mt-7 grid gap-4" onSubmit={submitRegistration}>
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Full name" className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold outline-none focus:border-emerald-500" />
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold outline-none focus:border-emerald-500" />
            <input value={mobile} onChange={(event) => setMobile(event.target.value)} placeholder="Mobile number" className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold outline-none focus:border-emerald-500" />
            <div className="grid gap-4 sm:grid-cols-2">
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" autoComplete="new-password" className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold outline-none focus:border-emerald-500" />
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm password" autoComplete="new-password" className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold outline-none focus:border-emerald-500" />
            </div>

            <label className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/70 px-5 py-4">
              <span className="block text-sm font-black text-slate-950">Resume/CV photo</span>
              <span className="mt-1 block text-xs font-bold text-slate-500">Upload a clear image of your resume or biodata.</span>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setResumeFile(event.target.files?.[0] || null)}
                className="mt-3 block w-full text-sm font-bold text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-sm file:font-black file:text-white"
              />
              {resumeFile && <span className="mt-2 block text-xs font-black text-emerald-700">Selected: {resumeFile.name}</span>}
            </label>

            {message && (
              <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
                {message}
              </div>
            )}

            <button type="submit" disabled={submitting} className="rounded-2xl bg-emerald-600 px-6 py-4 text-lg font-black text-white shadow-xl hover:bg-emerald-700 disabled:bg-slate-400">
              {submitting ? "Submitting..." : "Create Farmer Account"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
