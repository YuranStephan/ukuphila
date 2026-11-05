import { NextResponse } from "next/server";
import { getDb } from "@/server/db/client";
import { buildSnapshot } from "@/server/merchant/snapshot";
import { jsonError, merchantOr401 } from "../_auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await merchantOr401();
  if (user instanceof NextResponse) return user;
  try {
    const snapshot = await buildSnapshot(await getDb(), user.id);
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
