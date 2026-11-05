import "server-only";
import { createHmac } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { normalizePhone } from "@/lib/phone";
import { respond } from "./ai/conversation";
import { safeEqual } from "./crypto";
import type { Db, Tx } from "./db/client";
import { users, whatsappMessages } from "./db/schema";

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION ?? "v21.0";

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

/** Persist the reply with the business operation before delivery. Provider retries reuse that reply and cannot repeat the operation. */
export async function handleInbound(db: Db, input: { phone: string; body: string; providerId?: string | null; simulated?: boolean }) {
  const phone = normalizePhone(input.phone) ?? input.phone;
  const prepared = await db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`whatsapp:${phone}`}))`);
    const [user] = await tx.select({ id: users.id }).from(users).where(and(eq(users.phone, phone), eq(users.role, "merchant"), eq(users.status, "activo"))).limit(1);
    const replyId = input.providerId ? `reply:${input.providerId}` : null;
    if (replyId) {
      const [existing] = await tx.select().from(whatsappMessages).where(eq(whatsappMessages.providerId, replyId)).limit(1);
      if (existing) return { outgoing: existing, reply: null, duplicate: true };
    }
    await tx.insert(whatsappMessages).values({ direction: "entrada", phone, userId: user?.id ?? null, body: input.body.slice(0, 2000), providerId: input.providerId ?? null, simulated: input.simulated ?? false }).onConflictDoNothing();
    const reply = user ? await respond(tx as unknown as Db, { userId: user.id, channel: "whatsapp", text: input.body.slice(0, 2000) }) : null;
    const [outgoing] = await tx.insert(whatsappMessages).values({ direction: "saida", phone, userId: user?.id ?? null, body: reply?.text ?? UNKNOWN_NUMBER, providerId: replyId, status: input.simulated ? "registada" : "pendente", simulated: input.simulated ?? false }).returning();
    return { outgoing, reply, duplicate: false };
  });

  if (!input.simulated) {
    const sent = await db.transaction(async (rawTx) => {
      const tx = rawTx as Tx;
      const [outgoing] = await tx.select().from(whatsappMessages).where(eq(whatsappMessages.id, prepared.outgoing.id)).for("update");
      if (outgoing.status === "enviada") return true;
      const delivery = await deliver(phone, outgoing.body).catch(() => ({ status: "falhou" as const }));
      await tx.update(whatsappMessages).set({ status: delivery.status }).where(eq(whatsappMessages.id, outgoing.id));
      return delivery.status === "enviada";
    });
    if (!sent) throw new Error("Não foi possível entregar a resposta no WhatsApp.");
  }
  if (prepared.duplicate) return null;
  const reply = prepared.reply;
  return { text: prepared.outgoing.body, intent: reply?.intent ?? "SEM_CONTA", engine: reply?.engine ?? "regras", guardrails: reply?.guardrails ?? [], sources: reply?.sources ?? [] };
}
