import { NextResponse } from "next/server";
import { DEFAULT_SUPPORT_WHATSAPP, whatsappUrl } from "@/lib/contact";
import { getDb } from "@/server/db/client";
import { getSetting } from "@/server/settings";

export async function GET() {
  let number = DEFAULT_SUPPORT_WHATSAPP;
  try {
    const organisation = await getSetting(await getDb(), "organisation");
    number = organisation.supportWhatsapp?.trim() || number;
  } catch {
    // The published contact remains available if the database is temporarily unreachable.
  }
  return NextResponse.json({ whatsappUrl: whatsappUrl(number) ?? whatsappUrl(DEFAULT_SUPPORT_WHATSAPP) }, { headers: { "Cache-Control": "no-store" } });
}
