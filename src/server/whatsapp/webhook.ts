import { z } from "zod";

const payload = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(z.object({ changes: z.array(z.object({ field: z.string(), value: z.object({
    metadata: z.object({ phone_number_id: z.string() }).optional(),
    messages: z.array(z.object({ id: z.string().min(1).max(300), from: z.string().min(1).max(30), type: z.string(), text: z.object({ body: z.string().max(2000) }).optional(), button: z.object({ text: z.string().max(2000) }).optional(), interactive: z.object({ button_reply: z.object({ title: z.string().max(2000) }).optional(), list_reply: z.object({ title: z.string().max(2000) }).optional() }).optional() })).max(100).optional(),
  }) })).max(100) })).max(100),
});

export function webhookTexts(input: unknown, numberId: string) {
  const parsed = payload.safeParse(input);
  if (!parsed.success) return null;
  const result: { phone: string; body: string; providerId: string }[] = [];
  for (const entry of parsed.data.entry) for (const change of entry.changes) {
    if (change.field !== "messages" || change.value.metadata?.phone_number_id !== numberId) continue;
    for (const message of change.value.messages ?? []) {
      const body = message.type === "text" ? message.text?.body : message.type === "button" ? message.button?.text : message.type === "interactive" ? message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title : undefined;
      if (body?.trim()) result.push({ phone: message.from, body: body.trim(), providerId: message.id });
    }
  }
  return result;
}
