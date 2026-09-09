import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Legacy purchase approval is retired. Use Trees & Contracts to review SUR orders." }, { status: 410 });
}
