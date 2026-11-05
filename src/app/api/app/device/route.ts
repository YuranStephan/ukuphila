import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { registerDevice } from "@/server/sync/engine";
import { jsonError, merchantOr401 } from "../_auth";

const body = z.object({ publicKey: z.string().min(40).max(2000), label: z.string().max(80) });

export async function POST(request: Request) {
  const user = await merchantOr401(request);
  if (user instanceof NextResponse) return user;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  try {
    const deviceId = await registerDevice(await getDb(), user.id, parsed.data);
    return NextResponse.json({ deviceId });
  } catch (error) {
    return jsonError(error);
  }
}
