"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { parseAmountToCents } from "@/lib/money";
import { agentProfile, assertAssigned, createLease, logVisit, onboardMerchant, openIncident, recordOnBehalf, reportDeviceLost, setOnboardingStep } from "@/server/agent/service";
import { requireApi } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { DomainError, publicMessage } from "@/server/errors";
import { attest, submitDocument } from "@/server/kyc/service";
import { run } from "./run";
import type { ActionState } from "./state";

const onboarding = z.object({ phone: z.string().min(9), displayName: z.string().trim().min(2).max(60), businessName: z.string().trim().min(2).max(60), activity: z.string().trim().min(2).max(60), stall: z.string().trim().max(60).optional() });

export async function onboardAction(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = onboarding.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Preenche os dados do comerciante." };
  if (form.get("consent_base") !== "on") return { error: "Sem consentimento não se cria a conta." };
  let merchantId = "";
  try {
    const agent = await requireApi(["agent"]);
    const db = await getDb();
    const merchant = await onboardMerchant(db, agent, {
      ...parsed.data,
      category: parsed.data.activity,
      consentOptional: ["voz_ia", "historial_credito", "estudos"].filter((purpose) => form.get(purpose) === "on"),
    });
    merchantId = merchant.id;
  } catch (error) {
    return { error: publicMessage(error) };
  }
  redirect(`/agente/comerciantes/${merchantId}`);
}

export async function onboardingStepAction(merchantId: string, step: number) {
  const agent = await requireApi(["agent"]);
  await setOnboardingStep(await getDb(), agent, merchantId, step);
  const { revalidatePath } = await import("next/cache");
  revalidatePath(`/agente/comerciantes/${merchantId}`);
}

export async function attestAction(merchantId: string, _: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireApi(["agent"]);
    const db = await getDb();
    const agent = await agentProfile(db, user.id);
    await assertAssigned(db, agent.id, merchantId);
    const kind = z.enum(["rosto_confirmado", "banca_visitada", "conhece_pessoa", "morada_referida", "actividade_confirmada"]).parse(form.get("kind"));
    const source = kind === "morada_referida" ? "declarado" : "observado";
    await attest(db, { id: user.id, role: user.role, agentId: agent.id }, { userId: merchantId, kind, source, note: String(form.get("note") ?? "") || null });
    return "Registado.";
  });
}

export async function assistedRecordAction(merchantId: string, _: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireApi(["agent"]);
    const amountCents = parseAmountToCents(String(form.get("amount") ?? ""));
    if (!amountCents) throw new DomainError("valor", "Indica o valor.");
    const kind = String(form.get("kind"));
    const memo = String(form.get("memo") ?? "") || null;
    const db = await getDb();
    if (kind === "venda") await recordOnBehalf(db, user, merchantId, "sale.record", { amountCents, memo });
    else if (kind === "despesa") await recordOnBehalf(db, user, merchantId, "expense.record", { amountCents, category: "outro", memo });
    else throw new DomainError("registo", "Tipo de registo inválido.");
    return "Registado em nome do comerciante, com a tua identificação.";
  });
}

export async function logVisitAction(merchantId: string, _: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireApi(["agent"]);
    await logVisit(await getDb(), user, { merchantId, purpose: String(form.get("purpose") ?? "Acompanhamento"), outcome: String(form.get("outcome") ?? "Resolvido"), note: String(form.get("note") ?? "") || null });
    return "Visita registada.";
  });
}

export async function openIncidentAction(merchantId: string, _: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireApi(["agent"]);
    const db = await getDb();
    const agent = await agentProfile(db, user.id);
    await assertAssigned(db, agent.id, merchantId);
    const kind = z.enum(["suporte", "tecnico", "fraude", "documento", "dispositivo", "sync", "reclamacao"]).parse(form.get("kind"));
    const title = String(form.get("title") ?? "").trim();
    if (title.length < 4) throw new DomainError("incidente", "Descreve o problema.");
    const code = await openIncident(db, user, { kind, title, description: String(form.get("description") ?? title), subjectUserId: merchantId });
    return `Incidente ${code} aberto.`;
  });
}

export async function reportLostAction(deviceId: string, _: ActionState) {
  return run(async () => {
    const user = await requireApi(["agent", "admin"]);
    await reportDeviceLost(await getDb(), user, deviceId);
    return "Telefone bloqueado. A cópia local será apagada quando voltar à rede.";
  });
}

export async function createLeaseAction(merchantId: string, _: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireApi(["agent"]);
    const instalmentCents = parseAmountToCents(String(form.get("instalment") ?? ""));
    if (!instalmentCents) throw new DomainError("valor", "Indica o valor da prestação.");
    await createLease(await getDb(), user, { merchantId, modelId: String(form.get("modelId")), instalmentCents, instalments: Number(form.get("instalments")), serial: String(form.get("serial") ?? "") || null });
    return "Leasing criado.";
  });
}

export async function agentDocumentAction(merchantId: string, _: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireApi(["agent"]);
    const db = await getDb();
    const agent = await agentProfile(db, user.id);
    await assertAssigned(db, agent.id, merchantId);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new DomainError("documento", "Escolhe a fotografia.");
    await submitDocument(db, user, { userId: merchantId, type: String(form.get("type")), number: String(form.get("number") ?? "") || null, bytes: Buffer.from(await file.arrayBuffer()) });
    return "Documento submetido para revisão.";
  });
}
