import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enforceDurableRateLimit } from "@/app/lib/security/server";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: NextRequest) {
  const rate = await enforceDurableRateLimit(request, "caretaker-apply", 3, 60 * 60);
  if (rate.unavailable) return NextResponse.json({ error: "Applications are temporarily unavailable. Please try again later." }, { status: 503, headers: { "Retry-After": "60" } });
  if (!rate.allowed) return NextResponse.json({ error: "Too many applications. Try again later." }, { status: 429 });
  if (url !== "https://dvidrbhfzzhgwyempgtu.supabase.co" || !anon || !service) return NextResponse.json({ error: "Caretaker application is not configured." }, { status: 500 });

  const authorization = request.headers.get("authorization") || "";
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData.user;
  if (userError || !user?.email) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const resumeUrl = String(body?.resumeUrl || "").trim();
  const mobile = String(body?.mobile || "").trim();
  if (!resumeUrl) return NextResponse.json({ error: "Caretaker experience/resume file is required." }, { status: 400 });
  if (typeof body?.resumeUrl !== "string" || resumeUrl.length > 2048 || mobile.length > 40) return NextResponse.json({ error: "Invalid application details." }, { status: 400 });
  if (!resumeUrl.startsWith(user.id + "/") || resumeUrl.split("/").some(part => !part || part === "." || part === "..") || /[:\\\\]/.test(resumeUrl)) {
    return NextResponse.json({ error: "Upload your private caretaker document through your account first." }, { status: 400 });
  }
  const stored = await userClient.storage.from("farmer-resumes").info(resumeUrl);
  if (stored.error || !stored.data) return NextResponse.json({ error: "Resume upload was not found or is not accessible." }, { status: 400 });

  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
  const email = user.email.toLowerCase().trim();
  const { data: profile, error: profileError } = await admin.from("profiles").select("id,full_name,email,mobile,mobile_number,account_status,kyc_status").eq("auth_user_id", user.id).maybeSingle();
  if (profileError || !profile) return NextResponse.json({ error: profileError?.message || "Account profile was not found." }, { status: 404 });
  if (["SUSPENDED", "BLOCKED", "REJECTED", "ARCHIVED"].includes(String(profile.account_status || "").toUpperCase())) return NextResponse.json({ error: "This account cannot apply for Caretaker Mode." }, { status: 403 });
  if (String(profile.kyc_status || "").toUpperCase() !== "APPROVED") return NextResponse.json({ error: "Complete customer KYC before applying for Caretaker Mode." }, { status: 409 });

  const payload = { full_name: profile.full_name || email, email, mobile: mobile || profile.mobile_number || profile.mobile || null, resume_url: resumeUrl, status: "PENDING" };
  const { data: existing, error: findError } = await admin.from("gardeners").select("id,status").eq("email", email).maybeSingle();
  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });
  if (["ACTIVE", "APPROVED"].includes(String(existing?.status || "").toUpperCase())) return NextResponse.json({ ok: true, status: "ACTIVE", message: "Caretaker Mode is already active." });

  const save = existing
    ? await admin.from("gardeners").update(payload).eq("id", existing.id).in("status", ["PENDING", "REJECTED"]).select("id")
    : await admin.from("gardeners").insert(payload).select("id");
  if (save.error) return NextResponse.json({ error: save.error.message }, { status: 500 });
  if (!save.data?.length) return NextResponse.json({ error: "Application status changed. Refresh before retrying." }, { status: 409 });
  return NextResponse.json({ ok: true, status: "PENDING", message: "Caretaker verification submitted for Admin review." });
}
