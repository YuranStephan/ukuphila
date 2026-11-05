import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { applyBatch } from "@/server/sync/engine";
import { incomingOp } from "@/server/sync/schemas";
import { jsonError, merchantOr401 } from "../_auth";

const body = z.object({ deviceId: z.uuid(), ops: z.array(incomingOp).max(50) });

export async function POST(request: Request) {
  const user = await merchantOr401(request);
  if (user instanceof NextResponse) return user;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  try {
    const result = await applyBatch(await getDb(), user.id, parsed.data.deviceId, parsed.data.ops);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
