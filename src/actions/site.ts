"use server";

import { z } from "zod";
import { hitLimit } from "@/server/auth/service";
import { getDb } from "@/server/db/client";
import { leads } from "@/server/db/schema";
import { publicMessage } from "@/server/errors";
import { headers } from "next/headers";
import { sha256 } from "@/server/crypto";
import type { ActionState } from "./state";

const lead = z.object({
  kind: z.enum(["comerciante", "agente", "fornecedor", "parceiro", "investidor"]),
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().max(120).optional(),
  organisation: z.string().trim().max(120).optional(),
  market: z.string().trim().max(80).optional(),
  message: z.string().trim().max(800).optional(),
});

export async function submitLeadAction(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = lead.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Diz-nos pelo menos o nome e como falar contigo." };
  if (!parsed.data.phone && !parsed.data.email) return { error: "Deixa um telefone ou um email para te respondermos." };
  try {
    const db = await getDb();
    const requestHeaders = await headers();
    await hitLimit(db, `lead:${sha256(requestHeaders.get("x-forwarded-for") ?? "local").slice(0, 24)}`, 6, 3600);
    await db.insert(leads).values(parsed.data);
    return { ok: true, message: "Recebemos o teu contacto. Obrigado." };
  } catch (error) {
    return { error: publicMessage(error) };
  }
}
