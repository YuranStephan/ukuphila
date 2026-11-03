"use server";

import { requireApi } from "@/server/auth/session";
import { analyseApplication, approvePolicy, confirmDelivery, decideApplication, proposePolicy, recordRepayment } from "@/server/credit/service";
import { getDb } from "@/server/db/client";
import { parseAmountToCents } from "@/lib/money";
import { DomainError } from "@/server/errors";
import { run } from "./run";
import type { ActionState } from "./state";

const reasons = (form: FormData) => form.getAll("reason").map(String);

export async function analyseAction(applicationId: string, _: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireApi("credit.analyse");
    const outcome = form.get("outcome") === "recomenda" ? "recomenda" : "recusa";
    await analyseApplication(await getDb(), user, applicationId, {
      outcome,
      reasonCodes: reasons(form),
      note: String(form.get("note") ?? ""),
      offeredCents: parseAmountToCents(String(form.get("offered") ?? "")) ?? undefined,
      termDays: Number(form.get("termDays")) || undefined,
      instalments: Number(form.get("instalments")) || undefined,
    });
    return outcome === "recomenda" ? "Recomendado. Falta a aprovação de outra pessoa." : "Recusa registada com motivo.";
  });
}

export async function decideAction(applicationId: string, _: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireApi("credit.approve");
    const outcome = form.get("outcome") === "aprova" ? "aprova" : "recusa";
    await decideApplication(await getDb(), user, applicationId, { outcome, reasonCodes: reasons(form), note: String(form.get("note") ?? "") });
    return outcome === "aprova" ? "Aprovado. O comerciante vai ver a proposta." : "Recusa registada.";
  });
}

export async function repaymentAction(contractId: string, _: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireApi("credit.repayment.record");
    const amountCents = parseAmountToCents(String(form.get("amount") ?? ""));
    if (!amountCents) throw new DomainError("valor", "Indica o valor.");
    await recordRepayment(await getDb(), user, contractId, { amountCents, method: String(form.get("method") ?? "M-Pesa"), reference: String(form.get("reference") ?? "").trim() });
    return "Pagamento registado.";
  });
}

export async function confirmDeliveryAction(contractId: string, _: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireApi("supplier.portal");
    await confirmDelivery(await getDb(), user, contractId, String(form.get("code") ?? ""));
    return "Entrega confirmada. A dívida começou a contar a partir de hoje.";
  });
}

export async function proposePolicyAction(_: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireApi("credit.policy.propose");
    const value = (key: string) => Number(form.get(key));
    await proposePolicy(await getDb(), user, {
      version: String(form.get("version") ?? "").trim(),
      note: String(form.get("note") ?? "") || null,
      params: {
        isExample: true,
        maxAmountByRing: { base: value("base") * 100, second: value("second") * 100, third: value("third") * 100 },
        termOptionsDays: String(form.get("terms") ?? "").split(",").map((term) => Number(term.trim())).filter(Boolean),
        feePercentBasisPoints: value("fee") * 100,
        graceDays: value("grace"),
        defaultAfterDays: value("defaultAfter"),
        concentrationLimitPct: value("concentration"),
      },
    });
    return "Proposta criada. Outra pessoa tem de a aprovar.";
  });
}

export async function approvePolicyAction(policyId: string, _: ActionState) {
  return run(async () => {
    const user = await requireApi("credit.policy.approve");
    await approvePolicy(await getDb(), user, policyId);
    return "Política aprovada e em vigor para novos pedidos.";
  });
}
