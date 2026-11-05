import { NextResponse } from "next/server";
import { safeEqual } from "@/server/crypto";
import { getDb } from "@/server/db/client";
import { handleInbound, verifyWebhookSignature } from "@/server/whatsapp";
import { webhookTexts } from "@/server/whatsapp/webhook";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!token) return new Response("Canal não configurado.", { status: 503 });
  const provided = params.get("hub.verify_token") ?? "";
  const challenge = params.get("hub.challenge");
  if (params.get("hub.mode") !== "subscribe" || !challenge || !safeEqual(provided, token)) return new Response("Verificação recusada.", { status: 403 });
  return new Response(challenge, { headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!process.env.WHATSAPP_APP_SECRET || !process.env.WHATSAPP_PHONE_NUMBER_ID || !process.env.WHATSAPP_ACCESS_TOKEN) return NextResponse.json({ error: "Canal não configurado." }, { status: 503 });
  if (Number(request.headers.get("content-length") ?? 0) > 1_048_576) return new Response(null, { status: 413 });
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 1_048_576) return new Response(null, { status: 413 });
  if (!verifyWebhookSignature(raw, request.headers.get("x-hub-signature-256"))) return new Response(null, { status: 401 });
  let input: unknown;
  try { input = JSON.parse(raw); } catch { return new Response(null, { status: 400 }); }
  const messages = webhookTexts(input, process.env.WHATSAPP_PHONE_NUMBER_ID);
  if (!messages) return new Response(null, { status: 400 });
  try {
    if (messages.length) {
      const db = await getDb();
      for (const message of messages) await handleInbound(db, message);
    }
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Não foi possível processar a mensagem." }, { status: 500 });
  }
}
