"use server";

import { requireApi } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { addCaseNote, closeAlert, closeCase, openCase } from "@/server/risk/cases";
import { runRiskRules } from "@/server/risk/rules";
import { run } from "./run";
import type { ActionState } from "./state";

export async function closeAlertAction(alertId: string, _: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireApi("risk.manage");
    await closeAlert(await getDb(), user, alertId, String(form.get("note") ?? ""));
    return "Alerta fechado com motivo.";
  });
}

export async function openCaseAction(alertId: string, _: ActionState) {
  return run(async () => {
    const user = await requireApi("risk.manage");
    await openCase(await getDb(), user, alertId);
    return "Caso aberto. Consulta-o em Casos.";
  });
}

export async function addCaseNoteAction(caseId: string, _: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireApi("risk.manage");
    await addCaseNote(await getDb(), user, caseId, String(form.get("note") ?? ""));
    return "Nota registada.";
  });
}

export async function closeCaseAction(caseId: string, _: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireApi("risk.manage");
    await closeCase(await getDb(), user, caseId, String(form.get("conclusion") ?? ""));
    return "Caso e alertas associados fechados.";
  });
}

export async function runRulesAction(_: ActionState) {
  return run(async () => {
    await requireApi("risk.manage");
    const raised = await runRiskRules(await getDb());
    return `Regras corridas. ${raised} situações avaliadas.`;
  });
}
