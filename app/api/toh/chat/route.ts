import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { bearerToken, enforceRateLimit, normalizeRole } from "@/app/lib/security/server";
import { deterministicTohAnswer, TOH_MODEL, TOH_SYSTEM_INSTRUCTIONS } from "@/app/lib/toh/knowledge";

export async function POST(req: NextRequest) {
  const rateLimit = enforceRateLimit(req, "toh-chat", 20, 60 * 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "TOH request limit reached. Please try again later." },
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
  const question = String(body?.question || "").trim();
  if (!question || question.length > 4_000) {
    return NextResponse.json({ error: "Question must contain 1 to 4,000 characters." }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      assistant: "TOH",
      mode: "deterministic-evidence",
      modelConfigured: false,
      ...deterministicTohAnswer(question),
    });
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: TOH_MODEL,
      instructions: TOH_SYSTEM_INSTRUCTIONS,
      input: question,
      max_output_tokens: 1_500,
      store: false,
    });

    return NextResponse.json({
      assistant: "TOH",
      mode: "openai-read-only",
      model: TOH_MODEL,
      modelConfigured: true,
      classification: "AI_ASSISTED — VERIFY MATERIAL CLAIMS",
      answer: response.output_text || "TOH did not return an answer. No application data was changed.",
      evidence: ["Bounded application context only", "No tools or mutation authority exposed", "OpenAI response storage disabled"],
    });
  } catch {
    console.error("TOH OpenAI request failed without changing application data.");
    return NextResponse.json(
      { error: "TOH reasoning is temporarily unavailable. No application data was changed." },
      { status: 502 },
    );
  }
}
