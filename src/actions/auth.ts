"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { homeFor } from "@/server/auth/permissions";
import { completeMfa, prepareMfa, type MfaChallenge } from "@/server/auth/mfa";
import { checkTotp, createMerchant, hitLimit, mustEnrolTotp, needsTotp, requestOtp, verifyOtp, verifyStaffPassword } from "@/server/auth/service";
import { normalizePhone } from "@/lib/phone";
import { createSession, endSession } from "@/server/auth/session";
import { openText } from "@/server/crypto";
import { getDb, type Tx } from "@/server/db/client";
import { consents, markets, users } from "@/server/db/schema";
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

export type StaffLoginState = ActionState & { needsTotp?: boolean; enrolment?: MfaChallenge };

export async function staffLoginAction(previous: StaffLoginState, form: FormData): Promise<StaffLoginState> {
  let destination = "/gestao";
  try {
    const db = await getDb();
    let user = await verifyStaffPassword(db, String(form.get("email") ?? ""), String(form.get("password") ?? ""));
    if (needsTotp(user)) {
      const code = String(form.get("totp") ?? "").trim();
      if (!code) return { needsTotp: true };
      if (!checkTotp(user, code)) return { needsTotp: true, error: "Código errado." };
    }
    if (mustEnrolTotp(user)) {
      const code = String(form.get("totp") ?? "").trim();
      if (!previous.enrolment?.token || !code) return { needsTotp: true, enrolment: prepareMfa(user) };
      user = await completeMfa(db, user, previous.enrolment.token, code);
    }
    await createSession(db, user.id, user.role, { mfa: needsTotp(user) });
    destination = safeNext(form.get("next")) ?? homeFor(user.role);
  } catch (error) {
    return { ...previous, error: publicMessage(error) };
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
    const phone = normalizePhone(parsed.data.phone);
    if (!phone) throw new DomainError("telefone", "Esse número não parece um telemóvel de Moçambique.");
    await hitLimit(db, `signup:${phone}`, 3, 3600);
    const [market] = await db.select({ id: markets.id, name: markets.name }).from(markets).where(eq(markets.id, parsed.data.marketId)).limit(1);
    if (!market) throw new DomainError("mercado", "Escolhe o teu mercado.");
    await db.transaction(async (rawTx) => {
      const tx = rawTx as Tx;
      const user = await createMerchant(tx, { phone, displayName: parsed.data.displayName, businessName: parsed.data.businessName, marketId: market.id, activity: parsed.data.activity, category: parsed.data.activity }, { id: null, role: "merchant" });
      await tx.insert(consents).values({ userId: user.id, purpose: "servico_base", policyVersion: "2026.11", channel: "site", capturedBy: user.id });
    });
    // Identity is confirmed in person: the agent checks the face, finishes the details and hands over the entry code.
    return { ok: true, phone, message: `Vai ao quiosque Ukuphila do mercado de ${market.name}. O agente confirma os teus dados e dá-te o código para entrares e criares o teu PIN.` };
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
