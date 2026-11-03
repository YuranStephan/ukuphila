"use server";

import { eq } from "drizzle-orm";
import { recordAudit } from "@/server/audit";
import { requireApi } from "@/server/auth/session";
import { randomCode } from "@/server/crypto";
import { getDb, type Tx } from "@/server/db/client";
import { riskAlerts, riskCaseNotes, riskCases } from "@/server/db/schema";
import { DomainError } from "@/server/errors";
import { runRiskRules } from "@/server/risk/rules";
import { run } from "./run";
import type { ActionState } from "./state";

export async function closeAlertAction(alertId: string, _: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireApi("risk.manage");
    const note = String(form.get("note") ?? "").trim();
    if (note.length < 5) throw new DomainError("alerta", "Explica porque fechas este alerta.");
    const db = await getDb();
    await db.transaction(async (rawTx) => {
      const tx = rawTx as Tx;
      await tx.update(riskAlerts).set({ status: "fechado", closureNote: note, closedBy: user.id, closedAt: new Date() }).where(eq(riskAlerts.id, alertId));
      await recordAudit(tx, { actorId: user.id, actorRole: user.role, action: "risco.alerta_fechado", subjectType: "risk_alert", subjectId: alertId, data: { note } });
    });
  });
}

export async function openCaseAction(alertId: string, _: ActionState) {
  return run(async () => {
    const user = await requireApi("risk.manage");
    const db = await getDb();
    await db.transaction(async (rawTx) => {
      const tx = rawTx as Tx;
      const [alert] = await tx.select().from(riskAlerts).where(eq(riskAlerts.id, alertId));
      if (!alert) throw new DomainError("alerta", "Alerta não encontrado.");
      if (alert.caseId) return;
      const kind = alert.rule.startsWith("credito") ? "credito" : alert.rule.startsWith("agente") ? "conduta" : "fraude";
      const [created] = await tx
        .insert(riskCases)
        .values({ code: `RC-${randomCode(5)}`, title: alert.title, kind, severity: alert.severity, ownerId: user.id, subjectUserId: alert.subjectUserId, summary: alert.detail, status: "em_investigacao" })
        .returning({ id: riskCases.id });
      await tx.update(riskAlerts).set({ status: "em_revisao", caseId: created.id }).where(eq(riskAlerts.id, alertId));
      await recordAudit(tx, { actorId: user.id, actorRole: user.role, action: "risco.caso_aberto", subjectType: "risk_case", subjectId: created.id, targetUserId: alert.subjectUserId });
    });
    return "Caso aberto.";
  });
}

export async function addCaseNoteAction(caseId: string, _: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireApi("risk.manage");
    const note = String(form.get("note") ?? "").trim();
    if (note.length < 3) throw new DomainError("caso", "Escreve a nota.");
    const db = await getDb();
    await db.insert(riskCaseNotes).values({ caseId, actorId: user.id, note });
  });
}

export async function closeCaseAction(caseId: string, _: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireApi("risk.manage");
    const conclusion = String(form.get("conclusion") ?? "").trim();
    if (conclusion.length < 10) throw new DomainError("caso", "Escreve a conclusão do caso.");
    const db = await getDb();
    await db.transaction(async (rawTx) => {
      const tx = rawTx as Tx;
      await tx.update(riskCases).set({ status: "fechado", conclusion, closedAt: new Date() }).where(eq(riskCases.id, caseId));
      await tx.update(riskAlerts).set({ status: "fechado", closureNote: conclusion, closedBy: user.id, closedAt: new Date() }).where(eq(riskAlerts.caseId, caseId));
      await recordAudit(tx, { actorId: user.id, actorRole: user.role, action: "risco.caso_fechado", subjectType: "risk_case", subjectId: caseId });
    });
  });
}

export async function runRulesAction(_: ActionState) {
  return run(async () => {
    await requireApi("risk.manage");
    const raised = await runRiskRules(await getDb());
    return `Regras corridas. ${raised} situações avaliadas.`;
  });
}
