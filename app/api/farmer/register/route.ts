import { NextResponse } from "next/server";
export async function POST(){
 return NextResponse.json({error:"Use the shared signup, complete KYC, then apply for Caretaker Mode from Account.",signup:"/register"},{status:410});
}
