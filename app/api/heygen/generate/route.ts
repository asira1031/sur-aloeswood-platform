import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { script } = await req.json();

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