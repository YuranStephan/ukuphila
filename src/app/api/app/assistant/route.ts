import { NextResponse } from "next/server";
import { z } from "zod";
import { respond } from "@/server/ai/conversation";
import { getDb } from "@/server/db/client";
import { jsonError, merchantOr401 } from "../_auth";

const body = z.object({ text: z.string().trim().min(1).max(500), voice: z.boolean().optional() });

export async function POST(request: Request) {
  const user = await merchantOr401(request);
  if (user instanceof NextResponse) return user;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Escreve uma mensagem." }, { status: 400 });
  try {
    const reply = await respond(await getDb(), { userId: user.id, channel: parsed.data.voice ? "voz" : "app", text: parsed.data.text });
    return NextResponse.json(reply);
  } catch (error) {
    return jsonError(error);
  }
}
