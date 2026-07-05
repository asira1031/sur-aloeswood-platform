"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

function makeReferralCode(fullName: string) {
  const base = fullName
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 4)
    .toUpperCase();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `${base || "SUR"}${random}`;
}

export default function RegisterPage() {
  const [step, setStep] = useState<"FORM" | "DONE">("FORM");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [referredBy, setReferredBy] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const referralCode = useMemo(() => makeReferralCode(fullName), [fullName]);
  const cleanEmail = email.toLowerCase().trim();

  function validateForm() {
    if (!fullName.trim() || !cleanEmail || !mobile.trim() || !address.trim()) {
      return "Please complete your personal information.";
    }
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (password !== confirmPassword) return "Passwords do not match.";
    return "";
  }

  async function createAccount() {
    setMessage("");
    const validation = validateForm();
    if (validation) {
      setMessage(validation);
      return;
    }

    setLoading(true);

    const response = await fetch("/api/register/coplanter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        email: cleanEmail,
        password,
        mobile,
        address,
        referredBy,
        referralCode,
      }),
    });

    const result = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok) {
      setMessage(result?.error || "Unable to create account.");
      return;
    }

    setStep("DONE");
    setMessage(`Your account is ready. Referral code: ${result?.referralCode || referralCode}.`);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#052016] text-white">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/forest-bg.jpg')" }} />
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/92 via-emerald-950/72 to-slate-950/55" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10" />

      <nav className="relative z-10 flex items-center justify-between px-5 py-5 lg:px-12">
        <Link href="/" className="flex items-center gap-3">
          <img src="/agarwood.png" alt="SUR Aloeswood" className="h-12 w-12 rounded-2xl object-cover shadow-lg" />
          <div>
            <h1 className="text-xl font-black tracking-wide">SUR ALOESWOOD</h1>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-100/80">Co-Planter Access</p>
          </div>
        </Link>

        <Link href="/login" className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur hover:bg-white/20">
          Login
        </Link>
      </nav>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-92px)] w-full max-w-7xl gap-8 px-5 pb-10 lg:grid-cols-[0.82fr_1.18fr] lg:px-12">
        <aside className="flex flex-col justify-center">
          <p className="w-fit rounded-full border border-white/20 bg-white/14 px-5 py-2 text-sm font-black text-emerald-100 backdrop-blur">
            Direct Registration
          </p>
          <h2 className="mt-6 max-w-xl text-5xl font-black leading-tight lg:text-7xl">
            Create once,
            <span className="block text-emerald-300">then login directly.</span>
          </h2>
          <p className="mt-6 max-w-xl text-base leading-8 text-white/78">
            No email OTP or confirmation step for now. The platform creates the login account and co-planter profile in one flow.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <StepPill active={step === "FORM"} label="1" text="Details" />
            <StepPill active={step === "DONE"} label="2" text="Ready" />
          </div>
        </aside>

        <section className="self-center rounded-[2rem] border border-white/20 bg-white/96 p-6 text-slate-950 shadow-2xl backdrop-blur-xl lg:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">Registration</p>
              <h3 className="mt-2 text-3xl font-black text-slate-950">Create Co-Planter Account</h3>
              <p className="mt-2 text-sm font-medium text-slate-500">Complete the account details, then login after creation.</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-800">
              {step === "FORM" ? "ACCOUNT DETAILS" : "ACCOUNT READY"}
            </span>
          </div>

          {step !== "DONE" ? (
            <form className="mt-7 space-y-5" onSubmit={(event) => event.preventDefault()}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Full Name" value={fullName} onChange={setFullName} placeholder="Juan Dela Cruz" />
                <Field label="Email" value={email} onChange={setEmail} placeholder="you@example.com" type="email" />
                <Field label="Password" value={password} onChange={setPassword} placeholder="Minimum 8 characters" type="password" />
                <Field label="Confirm Password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Repeat password" type="password" />
                <Field label="Mobile Number" value={mobile} onChange={setMobile} placeholder="09XXXXXXXXX" />
                <Field label="Referral Code" value={referredBy} onChange={setReferredBy} placeholder="Optional" />
              </div>

              <div>
                <label className="text-sm font-black text-slate-700">Complete Address</label>
                <textarea
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="House/Street, Barangay, City/Province"
                  className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold outline-none focus:border-emerald-500"
                />
              </div>

              {message && <Notice text={message} tone={message.toLowerCase().includes("ready") ? "good" : "warn"} />}

              <button type="button" onClick={createAccount} disabled={loading} className="w-full rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black text-white shadow-lg hover:bg-emerald-700 disabled:bg-slate-400">
                {loading ? "Creating Account..." : "Create Co-Planter Account"}
              </button>
            </form>
          ) : (
            <div className="mt-8 rounded-[1.5rem] border border-emerald-100 bg-emerald-50 p-6">
              <h4 className="text-2xl font-black text-emerald-950">Account Ready</h4>
              <p className="mt-3 text-sm font-bold leading-7 text-emerald-900">{message}</p>
              <Link href="/login" className="mt-6 inline-flex rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black text-white shadow-lg hover:bg-emerald-700">
                Continue to Login
              </Link>
            </div>
          )}

          <p className="mt-6 text-sm font-medium text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="font-black text-emerald-700">
              Login here
            </Link>
          </p>
        </section>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold outline-none focus:border-emerald-500"
      />
    </label>
  );
}

function StepPill({ active, label, text }: { active: boolean; label: string; text: string }) {
  return (
    <div className={`rounded-2xl border p-4 backdrop-blur ${active ? "border-emerald-300 bg-emerald-300/18" : "border-white/15 bg-white/10"}`}>
      <p className="text-xs font-black uppercase tracking-wide text-white/60">Step {label}</p>
      <p className="mt-1 text-lg font-black text-white">{text}</p>
    </div>
  );
}

function Notice({ text, tone }: { text: string; tone: "good" | "warn" }) {
  return (
    <div className={`rounded-2xl px-5 py-4 text-sm font-black ${tone === "good" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
      {text}
    </div>
  );
}
