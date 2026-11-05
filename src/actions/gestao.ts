"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAgentScope, resolveIncident } from "@/server/agent/service";
import { recordAudit, verifyAuditChain } from "@/server/audit";
import { requireApi } from "@/server/auth/session";
import { generateTotpSecret, hashSecret, randomToken, sealText } from "@/server/crypto";
import { getDb, type Tx } from "@/server/db/client";
import { kbDocuments, leads, readinessItems, syncConflicts, users, type Role } from "@/server/db/schema";
import { DomainError } from "@/server/errors";
import { verifyLedgerChain } from "@/server/ledger/post";
import { reviewDocument } from "@/server/kyc/service";
import { getSetting, setSetting } from "@/server/settings";
import { handleInbound } from "@/server/whatsapp";
import { isDemo } from "@/server/env";
import { run } from "./run";
import type { ActionState } from "./state";

const num = (form: FormData, key: string) => Number(form.get(key));

export async function reviewDocumentAction(documentId: string, _: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireApi("kyc.review");
    const outcome = form.get("outcome") === "aprovar" ? "aprovar" : "rejeitar";
    await reviewDocument(await getDb(), user, documentId, { outcome, reason: String(form.get("reason") ?? "") || null, note: String(form.get("note") ?? "") || null });
    return outcome === "aprovar" ? "Documento aprovado." : "Documento rejeitado com motivo.";
  });
}

export async function resolveIncidentAction(incidentId: string, _: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireApi(["admin", "agent"]);
    await resolveIncident(await getDb(), user, incidentId, String(form.get("resolution") ?? ""));
  });
}

export async function resolveConflictAction(conflictId: string, _: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireApi(["admin", "agent"]);
    const db = await getDb();
    const [conflict] = await db.select({ userId: syncConflicts.userId }).from(syncConflicts).where(eq(syncConflicts.id, conflictId)).limit(1);
    if (!conflict) throw new DomainError("conflito", "Registo não encontrado.");
    await assertAgentScope(db, user, conflict.userId);
    await db
      .update(syncConflicts)
      .set({ status: "resolvido", resolvedBy: user.id, resolvedAt: new Date(), resolution: String(form.get("resolution") ?? "Confirmado com o comerciante.") })
      .where(eq(syncConflicts.id, conflictId));
  });
}

export async function updateReadinessAction(itemId: string, _: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireApi("ops.manage");
    const status = z.enum(["por_iniciar", "em_curso", "validado", "bloqueado"]).parse(form.get("status"));
    const db = await getDb();
    await db.update(readinessItems).set({ status, owner: String(form.get("owner") ?? "") || null, updatedAt: new Date(), updatedBy: user.id }).where(eq(readinessItems.id, itemId));
  });
}

export async function saveAgentRatesAction(_: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireApi("settings.manage");
    const db = await getDb();
    await setSetting(db, "agentRates", { isExample: true, onboardingCents: num(form, "onboarding") * 100, kycCompleteCents: num(form, "kyc") * 100, activation30dCents: num(form, "activation") * 100 }, user.id);
    await db.transaction((tx) => recordAudit(tx as Tx, { actorId: user.id, actorRole: user.role, action: "definicoes.agentes", subjectType: "settings", subjectId: "agentRates" }));
    return "Guardado.";
  });
}

export async function saveTrustPolicyAction(_: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireApi("settings.manage");
    const db = await getDb();
    const current = await getSetting(db, "trustPolicy");
    const next = {
      ...current,
      version: String(form.get("version") ?? current.version),
      ring2: { activeDays14: num(form, "ring2") },
      ring3: { activeDays30: num(form, "ring3"), minKycLevel: num(form, "ring3Kyc") },
      ring4: { minMonths: num(form, "ring4Months"), activeDays90: num(form, "ring4Days"), minKycLevel: num(form, "ring4Kyc"), minSavingsMonths: num(form, "ring4Savings"), minXitiquePunctuality: num(form, "ring4Punctuality") / 100 },
    };
    await setSetting(db, "trustPolicy", next, user.id);
    await db.transaction((tx) => recordAudit(tx as Tx, { actorId: user.id, actorRole: user.role, action: "definicoes.aneis", subjectType: "settings", subjectId: "trustPolicy", data: { version: next.version } }));
    return "Regras dos anéis guardadas.";
  });
}

export async function saveOfflinePolicyAction(_: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireApi("settings.manage");
    const db = await getDb();
    const current = await getSetting(db, "offlinePolicy");
    await setSetting(db, "offlinePolicy", { ...current, maxOpCents: num(form, "maxOp") * 100, maxPendingCents: num(form, "maxPending") * 100, maxAgeDays: num(form, "maxAge") }, user.id);
    return "Regras offline guardadas.";
  });
}

export async function saveOrganisationAction(_: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireApi("settings.manage");
    const db = await getDb();
    const current = await getSetting(db, "organisation");
    await setSetting(db, "organisation", { ...current, supportWhatsapp: String(form.get("supportWhatsapp") ?? ""), supportPhone: String(form.get("supportPhone") ?? ""), supportEmail: String(form.get("supportEmail") ?? ""), legalEntity: String(form.get("legalEntity") ?? "") }, user.id);
    return "Guardado.";
  });
}

export async function setKbStatusAction(documentId: string, status: "approved" | "draft") {
  const user = await requireApi("kb.approve");
  const db = await getDb();
  await db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    await tx.update(kbDocuments).set({ status, approvedBy: status === "approved" ? user.id : null, updatedAt: new Date() }).where(eq(kbDocuments.id, documentId));
    await recordAudit(tx, { actorId: user.id, actorRole: user.role, action: `conhecimento.${status}`, subjectType: "kb_document", subjectId: documentId });
  });
  revalidatePath("/gestao/conhecimento");
}

const ROLES: Role[] = ["kyc_reviewer", "credit_analyst", "credit_approver", "risk_analyst", "admin", "auditor"];

export async function createStaffAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireApi("team.manage");
    const role = String(form.get("role")) as Role;
    if (!ROLES.includes(role)) throw new DomainError("papel", "Função inválida.");
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const name = String(form.get("name") ?? "").trim();
    if (!email.includes("@") || name.length < 2) throw new DomainError("equipa", "Indica nome e email.");
    const password = randomToken(12);
    const db = await getDb();
    await db.transaction(async (rawTx) => {
      const tx = rawTx as Tx;
      const [created] = await tx.insert(users).values({ kind: "staff", role, email, displayName: name, passwordHash: await hashSecret(password), status: "activo" }).onConflictDoNothing().returning({ id: users.id });
      if (!created) throw new DomainError("equipa", "Já existe uma conta com este email.");
      await recordAudit(tx, { actorId: actor.id, actorRole: actor.role, action: "equipa.criada", subjectType: "user", subjectId: created.id, data: { role } });
    });
    return `Conta criada. Palavra-passe temporária, mostrada uma vez: ${password}`;
  });
}

export async function setUserStatusAction(userId: string, status: "activo" | "suspenso") {
  const actor = await requireApi("team.manage");
  if (actor.id === userId) throw new DomainError("equipa", "Não podes alterar a tua própria conta.");
  const db = await getDb();
  await db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    await tx.update(users).set({ status }).where(eq(users.id, userId));
    await recordAudit(tx, { actorId: actor.id, actorRole: actor.role, action: `conta.${status}`, subjectType: "user", subjectId: userId, targetUserId: userId });
  });
  revalidatePath("/gestao/equipa");
}

export type TotpEnrolment = ActionState & { secret?: string };

export async function startTotpAction(_: TotpEnrolment): Promise<TotpEnrolment> {
  const user = await requireApi(["admin", "kyc_reviewer", "credit_analyst", "credit_approver", "risk_analyst", "auditor"]);
  const secret = generateTotpSecret();
  const db = await getDb();
  await db.update(users).set({ totpSecret: sealText(secret), totpEnabledAt: new Date() }).where(eq(users.id, user.id));
  return { ok: true, secret, message: "Autenticação forte activa. Guarda esta chave na tua aplicação." };
}

export async function verifyAuditAction(_: ActionState): Promise<ActionState> {
  const user = await requireApi("audit.read");
  const result = await verifyAuditChain(await getDb());
  void user;
  return result.valid ? { ok: true, message: `Cadeia íntegra: ${result.checked} eventos verificados.` } : { error: `Cadeia quebrada no evento ${result.brokenAt}.` };
}

export async function verifyLedgerAction(userId: string, _: ActionState): Promise<ActionState> {
  await requireApi("ledger.read");
  const result = await verifyLedgerChain(await getDb(), userId);
  return result.valid ? { ok: true, message: `Registo íntegro: ${result.checked} movimentos verificados.` } : { error: `Cadeia quebrada no movimento ${result.brokenAtSeq}.` };
}

export async function markLeadAction(leadId: string, status: "contactado" | "fechado") {
  await requireApi("ops.manage");
  const db = await getDb();
  await db.update(leads).set({ status }).where(eq(leads.id, leadId));
  revalidatePath("/gestao/contactos");
}

export async function simulateWhatsappAction(phone: string, text: string) {
  await requireApi(["admin", "auditor"]);
  if (!isDemo()) throw new DomainError("simulador", "O simulador só existe no modo de demonstração.");
  const db = await getDb();
  const [target] = await db.select({ isDemo: users.isDemo }).from(users).where(and(eq(users.phone, phone), eq(users.isDemo, true))).limit(1);
  if (!target) throw new DomainError("simulador", "Só pessoas sintéticas podem ser simuladas.");
  return handleInbound(db, { phone, body: text, simulated: true });
}
