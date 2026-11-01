import "server-only";
import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { normalizePhone } from "@/lib/phone";
import { respond } from "./ai/conversation";
import { safeEqual } from "./crypto";
import type { Db } from "./db/client";
import { users, whatsappMessages } from "./db/schema";

const GRAPH_VERSION = "v21.0";

export function verifyWebhookSignature(rawBody: string, header: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  return safeEqual(expected, header);
}

/** Sends only when the Cloud API is configured. Otherwise the reply stays in the log, which is what the simulator reads. */
async function deliver(phone: string, body: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const numberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !numberId) return { status: "registada" as const };
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${numberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: phone.replace("+", ""), type: "text", text: { body } }),
    signal: AbortSignal.timeout(8000),
  });
  return { status: response.ok ? ("enviada" as const) : ("falhou" as const) };
}

const UNKNOWN_NUMBER = "Olá! Este número ainda não tem conta Ukuphila. Fala com um agente no teu mercado para começares.";

/** Every inbound message, real or simulated, takes this path. A repeated provider id is ignored, so retries are harmless. */
export async function handleInbound(db: Db, input: { phone: string; body: string; providerId?: string | null; simulated?: boolean }) {
  const phone = normalizePhone(input.phone) ?? input.phone;
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone)).limit(1);
  const inserted = await db
    .insert(whatsappMessages)
    .values({ direction: "entrada", phone, userId: user?.id ?? null, body: input.body.slice(0, 2000), providerId: input.providerId ?? null, simulated: input.simulated ?? false })
    .onConflictDoNothing()
    .returning({ id: whatsappMessages.id });
  if (inserted.length === 0) return null;
  const reply = user ? await respond(db, { userId: user.id, channel: "whatsapp", text: input.body }) : null;
  const text = reply?.text ?? UNKNOWN_NUMBER;
  const delivery = input.simulated ? { status: "registada" as const } : await deliver(phone, text);
  await db.insert(whatsappMessages).values({ direction: "saida", phone, userId: user?.id ?? null, body: text, status: delivery.status, simulated: input.simulated ?? false });
  return { text, intent: reply?.intent ?? "SEM_CONTA", engine: reply?.engine ?? "regras", guardrails: reply?.guardrails ?? [], sources: reply?.sources ?? [] };
}
