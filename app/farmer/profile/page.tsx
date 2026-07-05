"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { formatDate, pick, statusClass, type AnyRow } from "@/app/lib/farmer/reports";

export default function FarmerProfilePage() {
  const [email, setEmail] = useState("");
  const [gardener, setGardener] = useState<AnyRow | null>(null);
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [assignments, setAssignments] = useState<AnyRow[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function bootstrap() {
      const saved = localStorage.getItem("sur_login_email") || "";
      const { data } = await supabase.auth.getUser();
      const authEmail = data.user?.email?.toLowerCase().trim() || "";
      const preferredEmail = authEmail || saved;

      setEmail(preferredEmail);
      if (preferredEmail) {
        loadProfile(preferredEmail);
      } else {
        setMessage("Login first to load farmer profile.");
      }
    }

    bootstrap();
  }, []);

  async function loadProfile(targetEmail = email) {
    setLoading(true);
    setMessage("");

    const cleanEmail = targetEmail.toLowerCase().trim();

    if (!cleanEmail) {
      setMessage("Login first to load farmer profile.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("gardeners")
      .select("id, full_name, email, mobile, status, created_at")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    if (!data) {
      setMessage("Gardener profile not found.");
      setGardener(null);
      setLoading(false);
      return;
    }

    const { data: assignmentRows } = await supabase
      .from("gardener_assignments")
      .select("id, gardener_id, tree_id, status, assigned_at")
      .eq("gardener_id", data.id)
      .order("assigned_at", { ascending: false });

    setGardener(data);
    setFullName(data.full_name || "");
    setMobile(data.mobile || "");
    setStatus(data.status || "ACTIVE");
    setAssignments((assignmentRows || []) as AnyRow[]);
    localStorage.setItem("sur_login_email", cleanEmail);
    localStorage.setItem("sur_gardener_id", data.id);
    setLoading(false);
  }

  async function saveProfile() {
    if (!gardener?.id) {
      setMessage("Load profile first.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { error } = await supabase
      .from("gardeners")
      .update({
        full_name: fullName.trim(),
        mobile: mobile.trim(),
        status,
      })
      .eq("id", gardener.id);

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setMessage("Profile updated.");
    await loadProfile(email);
    setLoading(false);
  }

  const activeAssignments = assignments.filter((a) => ["ASSIGNED", "IN_PROGRESS"].includes(String(a.status || "").toUpperCase()));
  const completedAssignments = assignments.filter((a) => ["COMPLETED", "DONE"].includes(String(a.status || "").toUpperCase()));

  return (
    <main className="min-h-screen bg-[#04140d] text-white">
      <section className="border-b border-white/10 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-green-300">SUR ALOESWOOD FARMER</p>
              <h1 className="mt-4 text-4xl font-black md:text-6xl">Farmer Profile</h1>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/farmer/dashboard" className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black">Dashboard</Link>
              <Link href="/farmer/reports" className="rounded-2xl bg-green-500 px-5 py-3 text-sm font-black text-green-950">Reports</Link>
            </div>
          </div>

          {message && <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-4 text-sm font-bold text-yellow-100">{message}</div>}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-8 md:grid-cols-3 md:px-10">
        <Metric title="Status" value={gardener?.status || "Not loaded"} />
        <Metric title="Active Assignments" value={String(activeAssignments.length)} />
        <Metric title="Completed" value={String(completedAssignments.length)} />
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-16 md:px-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Profile Details</h2>

          {!gardener ? (
            <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-black/25 p-6 text-sm font-bold text-white/60">Load farmer profile.</div>
          ) : (
            <div className="mt-6 grid gap-3">
              <Info label="ID" value={gardener.id} />
              <Info label="Email" value={gardener.email || "-"} />
              <Info label="Created" value={formatDate(gardener.created_at)} />
              <Info label="Current Status" value={gardener.status || "-"} />
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Edit Profile</h2>

          <div className="mt-6 grid gap-4">
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
            <input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="Mobile" className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none" />
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none">
              <option>ACTIVE</option>
              <option>PENDING</option>
              <option>SUSPENDED</option>
              <option>INACTIVE</option>
            </select>
            <button onClick={saveProfile} disabled={loading || !gardener} className="w-full rounded-2xl bg-green-500 px-6 py-4 text-sm font-black text-green-950 disabled:bg-slate-500">Save Profile</button>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-5">
            <h3 className="text-xl font-black">Assignment Snapshot</h3>
            <div className="mt-4 space-y-2">
              {assignments.length === 0 ? (
                <p className="text-sm font-bold text-white/60">No assignments.</p>
              ) : assignments.slice(0, 8).map((assignment) => (
                <div key={assignment.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 p-3">
                  <span className="text-sm font-bold text-white/70">{assignment.tree_id}</span>
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(assignment.status)}`}>{assignment.status || "ASSIGNED"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl">
      <p className="text-xs font-black uppercase tracking-wide text-green-100/60">{title}</p>
      <p className="mt-3 truncate text-xl font-black text-green-300">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/25 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-white/45">{label}</p>
      <p className="mt-2 text-sm font-black text-white">{value}</p>
    </div>
  );
}
