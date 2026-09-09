import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { bearerToken, enforceRateLimit, normalizeRole } from "@/app/lib/security/server";

export async function POST(req: NextRequest) {
  try {
    const rateLimit = enforceRateLimit(req, "heygen-generate", 5, 60 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Video generation limit reached. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const authHeader = bearerToken(req);
    if (!supabaseUrl || !anonKey || !authHeader) {
      return NextResponse.json({ error: "Admin login is required." }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user?.id) {
      return NextResponse.json({ error: "Admin login is required." }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role,account_status")
      .eq("auth_user_id", authData.user.id)
      .maybeSingle();
    if (
      !profile ||
      !["ADMIN", "SUPER_ADMIN"].includes(normalizeRole(profile.role)) ||
      String(profile.account_status || "").toUpperCase() !== "ACTIVE"
    ) {
      return NextResponse.json({ error: "Active admin access is required." }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const script = String(body?.script || "").trim();
    if (!script || script.length > 2_000) {
      return NextResponse.json({ error: "Script must contain 1 to 2,000 characters." }, { status: 400 });
    }

    if (!process.env.HEYGEN_API_KEY) {
      return NextResponse.json({ error: "Video generation is not configured." }, { status: 503 });
    }

    const response = await fetch(
      "https://api.heygen.com/v2/video/generate",
      {
        method: "POST",
        headers: {
          "X-Api-Key": process.env.HEYGEN_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "TDI Executive Introduction",
          input_text: script,

          avatar_id: "2bcc9ce5369a4524a7fd1898812c5631",

          voice_id: "5d8c378ba8c3434586081a52ac368738",
        }),
      }
    );

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "Video generation failed",
      },
      { status: 500 }
    );
  }
}
