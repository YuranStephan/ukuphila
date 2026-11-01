"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { homeFor } from "@/server/auth/permissions";
import { checkTotp, createMerchant, mustEnrolTotp, needsTotp, requestOtp, verifyOtp, verifyStaffPassword } from "@/server/auth/service";
import { createSession, endSession } from "@/server/auth/session";
import { openText } from "@/server/crypto";
import { getDb, type Tx } from "@/server/db/client";
import { markets, users } from "@/server/db/schema";
import { DomainError, publicMessage } from "@/server/errors";
import { isDemo } from "@/server/env";
import { STAFF } from "@/server/seed/catalog";
import type { ActionState } from "./state";

export type OtpState = ActionState & { phone?: string; demoCode?: string };

function safeNext(next: FormDataEntryValue | null) {
  const value = typeof next === "string" ? next : "";
  return value.startsWith("/") && !value.startsWith("//") ? value : null;
}

export async function requestCodeAction(_: OtpState, form: FormData): Promise<OtpState> {
  try {
    const db = await getDb();
    const { phone, code, reveal } = await requestOtp(db, String(form.get("phone") ?? ""), "entrar");
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone)).limit(1);
    if (!user) return { error: "Ainda não tens conta com este número. Fala com um agente ou cria uma conta." };
    // A real installation delivers through WhatsApp or SMS; the code is only shown outside production or in the demo.
    return { ok: true, phone, demoCode: reveal ? code : undefined, message: reveal ? undefined : "Enviámos um código para o teu telefone." };
  } catch (error) {
    return { error: publicMessage(error) };
  }
}

export async function verifyCodeAction(_: OtpState, form: FormData): Promise<OtpState> {
  const phone = String(form.get("phone") ?? "");
  let destination = "/app";
  try {
    const db = await getDb();
    await verifyOtp(db, phone, String(form.get("code") ?? "").trim());
    const [user] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
    if (!user) throw new DomainError("conta", "Conta não encontrada.");
    if (user.status === "suspenso" || user.status === "encerrado") throw new DomainError("conta_suspensa", "Esta conta está suspensa. Fala com o teu agente.");
    await createSession(db, user.id, user.role);
    destination = safeNext(form.get("next")) ?? homeFor(user.role);
  } catch (error) {
    return { phone, error: publicMessage(error) };
  }
  redirect(destination);
}

export async function staffLoginAction(_: ActionState & { needsTotp?: boolean }, form: FormData): Promise<ActionState & { needsTotp?: boolean }> {
  let destination = "/gestao";
  try {
    const db = await getDb();
    const user = await verifyStaffPassword(db, String(form.get("email") ?? ""), String(form.get("password") ?? ""));
    if (needsTotp(user)) {
      const code = String(form.get("totp") ?? "").trim();
      if (!code) return { needsTotp: true };
      if (!checkTotp(user, code)) return { needsTotp: true, error: "Código errado." };
    }
    if (mustEnrolTotp(user)) throw new DomainError("mfa", "Esta função exige autenticação forte. Pede a configuração à equipa de gestão.");
    await createSession(db, user.id, user.role, { mfa: needsTotp(user) });
    destination = safeNext(form.get("next")) ?? homeFor(user.role);
  } catch (error) {
    return { error: publicMessage(error) };
  }
  redirect(destination);
}

const signup = z.object({
  phone: z.string().min(9),
  displayName: z.string().trim().min(2).max(60),
  businessName: z.string().trim().min(2).max(60),
  marketId: z.uuid(),
  activity: z.string().trim().min(2).max(60),
  consent: z.literal("on"),
});

export async function signupAction(_: OtpState, form: FormData): Promise<OtpState> {
  const parsed = signup.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Preenche os campos e aceita as condições para continuar." };
  try {
    const db = await getDb();
    const { phone, code, reveal } = await requestOtp(db, parsed.data.phone, "registo");
    const [market] = await db.select({ id: markets.id }).from(markets).where(eq(markets.id, parsed.data.marketId)).limit(1);
    if (!market) throw new DomainError("mercado", "Escolhe o teu mercado.");
    await db.transaction(async (rawTx) => {
      const tx = rawTx as Tx;
      await createMerchant(tx, { phone, displayName: parsed.data.displayName, businessName: parsed.data.businessName, marketId: market.id, activity: parsed.data.activity, category: parsed.data.activity }, { id: null, role: "merchant" });
    });
    return { ok: true, phone, demoCode: reveal ? code : undefined };
  } catch (error) {
    return { error: publicMessage(error) };
  }
}

export async function signOutAction() {
  await endSession();
  redirect("/");
}

const PERSONAS = {
  celeste: { phone: "+258841111001" },
  armando: { phone: "+258841111002" },
  rosa: { phone: "+258841111003" },
  agente: { phone: "+258840000001" },
  fornecedor: { phone: "+258841000101" },
  gestao: { email: STAFF[0].email },
  revisao: { email: STAFF[1].email },
  analise: { email: STAFF[2].email },
  aprovacao: { email: STAFF[3].email },
  risco: { email: STAFF[4].email },
  auditoria: { email: STAFF[5].email },
} as const;

/** Only in demo mode, and only for seeded people: it can never open a real account. */
export async function enterAsPersonaAction(persona: keyof typeof PERSONAS) {
  if (!isDemo()) throw new DomainError("sem_permissao", "Indisponível.");
  const db = await getDb();
  const target = PERSONAS[persona];
  const [user] = await db.select().from(users).where("phone" in target ? eq(users.phone, target.phone) : eq(users.email, target.email)).limit(1);
  if (!user?.isDemo) throw new DomainError("sem_permissao", "Indisponível.");
  await createSession(db, user.id, user.role, { mfa: true });
  redirect(homeFor(user.role));
}

export async function demoTotpPreview(sealed: string) {
  return openText(sealed).length > 0;
}
