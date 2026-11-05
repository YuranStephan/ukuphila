import { NextResponse } from "next/server";
import { endSession } from "@/server/auth/session";

/** The page that receives this redirect clears the device's local copy (see /app/sair). */
export async function POST(request: Request) {
  await endSession();
  return NextResponse.redirect(new URL("/sair", request.url), 303);
}
