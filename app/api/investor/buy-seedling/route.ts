import { NextResponse } from "next/server";
export async function POST(){return NextResponse.json({error:"Wallet tree purchase is retired. Use the Maya QR checkout in Buy a Tree."},{status:410});}
