import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.HEYGEN_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { ok: false, message: "HEYGEN_API_KEY is missing" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "HeyGen API key is loaded safely on the server.",
  });
}