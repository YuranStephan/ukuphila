import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { recordAudit } from "../audit";
import { can } from "../auth/permissions";
import type { SessionUser } from "../auth/session";
import { randomCode } from "../crypto";
import type { Db, Tx } from "../db/client";
import { riskAlerts, riskCaseNotes, riskCases } from "../db/schema";
import { DomainError } from "../errors";

function assertManager(actor: SessionUser) {
  if (!can(actor.role, "risk.manage")) throw new DomainError("sem_permissao", "Não tens permissão para alterar casos de risco.");
}

function text(value: string, minimum: number, message: string) {
  const cleaned = value.trim();
  if (cleaned.length < minimum || cleaned.length > 4000) throw new DomainError("risco", message);
  return cleaned;
}

export async function closeAlert(db: Db, actor: SessionUser, alertId: string, input: string) {
  assertManager(actor);
  z.uuid().parse(alertId);
  const note = text(input, 5, "Explica porque fechas este alerta (5 a 4000 caracteres).");
  await db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    const [alert] = await tx.select().from(riskAlerts).where(eq(riskAlerts.id, alertId)).for("update");
    if (!alert) throw new DomainError("alerta", "Alerta não encontrado.");
    if (alert.status === "fechado") return;
    if (alert.caseId) throw new DomainError("caso", "Este alerta pertence a um caso. Regista a conclusão no caso.");
    await tx.update(riskAlerts).set({ status: "fechado", closureNote: note, closedBy: actor.id, closedAt: new Date() }).where(eq(riskAlerts.id, alertId));
    await recordAudit(tx, { actorId: actor.id, actorRole: actor.role, action: "risco.alerta_fechado", subjectType: "risk_alert", subjectId: alertId, data: { note } });
  });
}

export async function openCase(db: Db, actor: SessionUser, alertId: string) {
  assertManager(actor);
  z.uuid().parse(alertId);
  return db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    const [alert] = await tx.select().from(riskAlerts).where(eq(riskAlerts.id, alertId)).for("update");
    if (!alert) throw new DomainError("alerta", "Alerta não encontrado.");
    if (alert.status === "fechado") throw new DomainError("alerta", "Este alerta já foi fechado.");
    if (alert.caseId) return alert.caseId;
    const kind = alert.rule.startsWith("credito") ? "credito" : alert.rule.startsWith("agente") ? "conduta" : "dados";
    const [created] = await tx.insert(riskCases).values({ code: `RC-${randomCode(5)}`, title: alert.title, kind, severity: alert.severity, ownerId: actor.id, subjectUserId: alert.subjectUserId, summary: alert.detail, status: "em_investigacao" }).returning({ id: riskCases.id });
    await tx.update(riskAlerts).set({ status: "em_revisao", caseId: created.id }).where(eq(riskAlerts.id, alertId));
    await recordAudit(tx, { actorId: actor.id, actorRole: actor.role, action: "risco.caso_aberto", subjectType: "risk_case", subjectId: created.id, targetUserId: alert.subjectUserId });
    return created.id;
  });
}

export async function addCaseNote(db: Db, actor: SessionUser, caseId: string, input: string) {
  assertManager(actor);
  z.uuid().parse(caseId);
  const note = text(input, 3, "Escreve uma nota entre 3 e 4000 caracteres.");
  await db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    const [item] = await tx.select().from(riskCases).where(eq(riskCases.id, caseId)).for("update");
    if (!item || item.status === "fechado") throw new DomainError("caso", "Este caso não está aberto.");
    await tx.insert(riskCaseNotes).values({ caseId, actorId: actor.id, note });
    await recordAudit(tx, { actorId: actor.id, actorRole: actor.role, action: "risco.nota_registada", subjectType: "risk_case", subjectId: caseId });
  });
}

export async function closeCase(db: Db, actor: SessionUser, caseId: string, input: string) {
  assertManager(actor);
  z.uuid().parse(caseId);
  const conclusion = text(input, 10, "Escreve a conclusão do caso (10 a 4000 caracteres).");
  await db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    const [item] = await tx.select().from(riskCases).where(eq(riskCases.id, caseId)).for("update");
    if (!item) throw new DomainError("caso", "Caso não encontrado.");
    if (item.status === "fechado") return;
    const closedAt = new Date();
    await tx.update(riskCases).set({ status: "fechado", conclusion, closedAt }).where(eq(riskCases.id, caseId));
    await tx.update(riskAlerts).set({ status: "fechado", closureNote: conclusion, closedBy: actor.id, closedAt }).where(and(eq(riskAlerts.caseId, caseId), ne(riskAlerts.status, "fechado")));
    await recordAudit(tx, { actorId: actor.id, actorRole: actor.role, action: "risco.caso_fechado", subjectType: "risk_case", subjectId: caseId, data: { conclusion } });
  });
}
