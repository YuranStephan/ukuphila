import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { agentProfile, assertAssigned } from "../agent/service";
import { addDays, daysBetween, maputoDay } from "@/lib/dates";
import { formatMT } from "@/lib/money";
import { recordAudit } from "../audit";
import { checkPin } from "../auth/service";
import type { SessionUser } from "../auth/session";
import { can } from "../auth/permissions";
import { randomCode, randomDigits } from "../crypto";
import type { Db, Executor, Tx } from "../db/client";
import {
  consents,
  creditApplications,
  creditContracts,
  creditDecisions,
  creditInstalments,
  creditPolicies,
  creditRepayments,
  products,
  stockMoves,
  supplierProducts,
  suppliers,
  type CreditPolicyParams,
} from "../db/schema";
import { DomainError } from "../errors";
import { postEntry } from "../ledger/post";
import { notify } from "../notifications";
import { raiseAlert } from "../risk/alerts";
import { trustFor } from "../trust/facts";

/*
 * Supplier credit. Credit is a consequence of the relationship, never a right (KB §15, §28):
 *
 *   merchant submits → analyst recommends → a different person approves → merchant accepts with their PIN
 *   → supplier delivers against the merchant's code → instalments → settled
 *
 * Every number comes from an approved, versioned policy. Nothing automated approves anything.
 */

const OPEN_STATUSES = ["submetido", "em_analise", "recomendado", "aprovado"] as const;

export async function activePolicy(db: Executor) {
  const [policy] = await db.select().from(creditPolicies).where(eq(creditPolicies.status, "aprovada")).limit(1);
  return policy ?? null;
}

export function limitFor(params: CreditPolicyParams, settledContracts: number) {
  if (settledContracts >= 2) return params.maxAmountByRing.third;
  if (settledContracts === 1) return params.maxAmountByRing.second;
  return params.maxAmountByRing.base;
}

export async function submitApplication(db: Db, user: SessionUser, input: { supplierId: string; items: { supplierProductId: string; quantity: number }[] }) {
  if (input.items.length === 0) throw new DomainError("credito_itens", "Escolhe pelo menos um produto.");
  const [consent] = await db
    .select({ id: consents.id })
    .from(consents)
    .where(and(eq(consents.userId, user.id), eq(consents.purpose, "historial_credito"), eq(consents.status, "concedido")))
    .limit(1);
  if (!consent) throw new DomainError("credito_consentimento", "Primeiro autoriza o uso do teu historial para crédito, em Privacidade.");
  const policy = await activePolicy(db);
  if (!policy) throw new DomainError("credito_politica", "O crédito ainda não está disponível.");
  const trust = await trustFor(db, user.id);
  if (trust.ring < 4) throw new DomainError("credito_prontidao", trust.rings[3].missing[0] ?? "Ainda não chegaste a esta fase.");
  const [open] = await db
    .select({ id: creditApplications.id })
    .from(creditApplications)
    .where(and(eq(creditApplications.userId, user.id), inArray(creditApplications.status, [...OPEN_STATUSES])))
    .limit(1);
  if (open) throw new DomainError("credito_aberto", "Já tens um pedido em curso.");
  const [running] = await db
    .select({ id: creditContracts.id })
    .from(creditContracts)
    .where(and(eq(creditContracts.userId, user.id), inArray(creditContracts.status, ["aguarda_entrega", "activo", "em_atraso", "incumprimento"])))
    .limit(1);
  if (running) throw new DomainError("credito_aberto", "Termina primeiro o crédito que tens em curso.");
  const [supplier] = await db.select().from(suppliers).where(and(eq(suppliers.id, input.supplierId), eq(suppliers.status, "activo"))).limit(1);
  if (!supplier) throw new DomainError("credito_fornecedor", "Este fornecedor não está disponível.");
  const catalogue = await db
    .select()
    .from(supplierProducts)
    .where(and(eq(supplierProducts.supplierId, supplier.id), inArray(supplierProducts.id, input.items.map((item) => item.supplierProductId)), eq(supplierProducts.active, true)));
  const items = input.items.map((item) => {
    const product = catalogue.find((row) => row.id === item.supplierProductId);
    if (!product || item.quantity <= 0) throw new DomainError("credito_itens", "Um dos produtos já não está disponível.");
    return { name: product.name, unit: product.unit, quantity: item.quantity, priceCents: product.priceCents };
  });
  const requestedCents = items.reduce((sum, item) => sum + item.quantity * item.priceCents, 0);
  const limit = limitFor(policy.params, trust.facts.supplierContractsSettled);
  if (requestedCents > limit) throw new DomainError("credito_limite", `Nesta fase o pedido pode ir até ${formatMT(limit)}.`);
  return db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    const { facts: _facts, ...snapshot } = trust;
    const [application] = await tx
      .insert(creditApplications)
      .values({ code: `CR-${randomCode(6)}`, userId: user.id, supplierId: supplier.id, policyId: policy.id, requestedCents, items, trustSnapshot: snapshot })
      .returning();
    await recordAudit(tx, { actorId: user.id, actorRole: user.role, action: "credito.pedido", subjectType: "credit_application", subjectId: application.id, targetUserId: user.id, data: { requestedCents, policy: policy.version } });
    return application;
  });
}

export async function analyseApplication(
  db: Db,
  analyst: SessionUser,
  applicationId: string,
  input: { outcome: "recomenda" | "recusa"; reasonCodes: string[]; note: string; offeredCents?: number; termDays?: number; instalments?: number },
) {
  if (!can(analyst.role, "credit.analyse")) throw new DomainError("sem_permissao", "Não tens permissão para analisar crédito.");
  if (input.note.trim().length < 10) throw new DomainError("credito_nota", "Explica a decisão em pelo menos uma frase.");
  if (input.reasonCodes.length === 0) throw new DomainError("credito_motivo", "Indica pelo menos um motivo.");
  await db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    const [application] = await tx.select().from(creditApplications).where(eq(creditApplications.id, applicationId)).for("update");
    if (!application) throw new DomainError("credito", "Pedido não encontrado.");
    if (!["submetido", "em_analise"].includes(application.status)) throw new DomainError("credito_estado", "Este pedido já não está em análise.");
    const [policy] = await tx.select().from(creditPolicies).where(eq(creditPolicies.id, application.policyId)).limit(1);
    let offer = {};
    if (input.outcome === "recomenda") {
      const offeredCents = input.offeredCents ?? application.requestedCents;
      const termDays = input.termDays ?? policy.params.termOptionsDays[0];
      const instalments = input.instalments ?? 1;
      if (offeredCents <= 0 || offeredCents > application.requestedCents) throw new DomainError("credito_valor", "A proposta não pode ser maior do que o pedido.");
      if (!policy.params.termOptionsDays.includes(termDays)) throw new DomainError("credito_prazo", "Esse prazo não existe na política em vigor.");
      if (instalments < 1 || instalments > 12) throw new DomainError("credito_prestacoes", "Número de prestações inválido.");
      offer = {
        offeredCents,
        offeredTermDays: termDays,
        offeredInstalments: instalments,
        offeredFeeCents: Math.round((offeredCents * policy.params.feePercentBasisPoints) / 10_000),
      };
    }
    await tx
      .update(creditApplications)
      .set({ status: input.outcome === "recomenda" ? "recomendado" : "recusado", updatedAt: new Date(), ...offer })
      .where(eq(creditApplications.id, applicationId));
    await tx.insert(creditDecisions).values({ applicationId, stage: "analise", outcome: input.outcome, reasonCodes: input.reasonCodes, note: input.note, actorId: analyst.id });
    await recordAudit(tx, { actorId: analyst.id, actorRole: analyst.role, action: `credito.analise_${input.outcome}`, subjectType: "credit_application", subjectId: applicationId, targetUserId: application.userId, data: { reasonCodes: input.reasonCodes } });
    if (input.outcome === "recusa") await notify(tx, application.userId, { title: "O teu pedido não avançou", body: "Vê o que pode ajudar da próxima vez.", link: "/app/credito" });
  });
}

export async function decideApplication(db: Db, approver: SessionUser, applicationId: string, input: { outcome: "aprova" | "recusa"; reasonCodes: string[]; note: string }) {
  if (!can(approver.role, "credit.approve")) throw new DomainError("sem_permissao", "Não tens permissão para aprovar crédito.");
  if (input.note.trim().length < 10) throw new DomainError("credito_nota", "Explica a decisão em pelo menos uma frase.");
  await db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    const [application] = await tx.select().from(creditApplications).where(eq(creditApplications.id, applicationId)).for("update");
    if (!application) throw new DomainError("credito", "Pedido não encontrado.");
    if (application.status !== "recomendado") throw new DomainError("credito_estado", "Este pedido não está à espera de aprovação.");
    const [recommendation] = await tx
      .select({ actorId: creditDecisions.actorId })
      .from(creditDecisions)
      .where(and(eq(creditDecisions.applicationId, applicationId), eq(creditDecisions.stage, "analise")))
      .orderBy(desc(creditDecisions.createdAt))
      .limit(1);
    if (recommendation?.actorId === approver.id) throw new DomainError("quatro_olhos", "A aprovação tem de vir de outra pessoa.");
    await tx
      .update(creditApplications)
      .set({ status: input.outcome === "aprova" ? "aprovado" : "recusado", updatedAt: new Date() })
      .where(eq(creditApplications.id, applicationId));
    await tx.insert(creditDecisions).values({ applicationId, stage: "aprovacao", outcome: input.outcome, reasonCodes: input.reasonCodes, note: input.note, actorId: approver.id });
    await recordAudit(tx, { actorId: approver.id, actorRole: approver.role, action: `credito.decisao_${input.outcome}`, subjectType: "credit_application", subjectId: applicationId, targetUserId: application.userId });
    await notify(tx, application.userId, input.outcome === "aprova"
      ? { title: "Tens uma proposta do fornecedor", body: "Lê as condições com calma antes de aceitar.", link: "/app/credito" }
      : { title: "O teu pedido não avançou", body: "Vê o que pode ajudar da próxima vez.", link: "/app/credito" });
  });
}

export function buildSchedule(totalCents: number, instalments: number, termDays: number, startDay: string) {
  const base = Math.floor(totalCents / instalments);
  const remainder = totalCents - base * instalments;
  return Array.from({ length: instalments }, (_, index) => ({
    number: index + 1,
    dueDate: addDays(startDay, Math.round(((index + 1) * termDays) / instalments)),
    amountCents: base + (index === instalments - 1 ? remainder : 0),
  }));
}

/** The merchant's own PIN is the signature. Terms are frozen in the contract so a later policy cannot change them. */
export async function acceptOffer(db: Db, user: SessionUser, applicationId: string, pin: string) {
  await checkPin(db, user.id, pin);
  return db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    const [application] = await tx.select().from(creditApplications).where(and(eq(creditApplications.id, applicationId), eq(creditApplications.userId, user.id))).for("update");
    if (!application) throw new DomainError("credito", "Pedido não encontrado.");
    if (application.status !== "aprovado") throw new DomainError("credito_estado", "Esta proposta já não está disponível.");
    const principalCents = application.offeredCents as number;
    const feeCents = application.offeredFeeCents ?? 0;
    const termDays = application.offeredTermDays as number;
    const instalments = application.offeredInstalments as number;
    const [policy] = await tx.select().from(creditPolicies).where(eq(creditPolicies.id, application.policyId)).limit(1);
    const preview = buildSchedule(principalCents + feeCents, instalments, termDays, maputoDay());
    const [contract] = await tx
      .insert(creditContracts)
      .values({
        code: `CT-${randomCode(6)}`,
        applicationId,
        userId: user.id,
        supplierId: application.supplierId,
        principalCents,
        feeCents,
        termDays,
        termsSnapshot: { policyVersion: policy.version, isExample: policy.params.isExample, graceDays: policy.params.graceDays, defaultAfterDays: policy.params.defaultAfterDays, items: application.items, schedulePreview: preview },
        acceptedAt: new Date(),
        acceptedChannel: "app",
        deliveryCode: randomDigits(6),
      })
      .returning();
    await tx.update(creditApplications).set({ status: "aceite", updatedAt: new Date() }).where(eq(creditApplications.id, applicationId));
    await recordAudit(tx, { actorId: user.id, actorRole: user.role, action: "credito.aceite", subjectType: "credit_contract", subjectId: contract.id, targetUserId: user.id, data: { principalCents, feeCents, termDays, instalments } });
    return contract;
  });
}

export async function declineOffer(db: Db, user: SessionUser, applicationId: string) {
  const rows = await db
    .update(creditApplications)
    .set({ status: "desistido", updatedAt: new Date() })
    .where(and(eq(creditApplications.id, applicationId), eq(creditApplications.userId, user.id), eq(creditApplications.status, "aprovado")))
    .returning({ id: creditApplications.id });
  if (rows.length === 0) throw new DomainError("credito_estado", "Esta proposta já não está disponível.");
}

/**
 * Delivery is the moment debt starts. The supplier types the code only the merchant holds, so a supplier cannot start a
 * debt for stock that never arrived. Schedule dates count from delivery, not from acceptance.
 */
export async function confirmDelivery(db: Db, supplierUser: SessionUser, contractId: string, code: string) {
  await db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    const [contract] = await tx.select().from(creditContracts).where(eq(creditContracts.id, contractId)).for("update");
    if (!contract) throw new DomainError("contrato", "Contrato não encontrado.");
    const [supplier] = await tx.select().from(suppliers).where(eq(suppliers.id, contract.supplierId)).limit(1);
    if (supplier?.ownerId !== supplierUser.id) throw new DomainError("sem_permissao", "Este contrato é de outro fornecedor.");
    if (contract.status !== "aguarda_entrega") throw new DomainError("contrato_estado", "Esta entrega já foi confirmada.");
    if (contract.deliveryCode !== code.trim()) throw new DomainError("contrato_codigo", "Código errado. Pede o código ao comerciante.");
    const [application] = await tx.select().from(creditApplications).where(eq(creditApplications.id, contract.applicationId)).limit(1);
    const total = contract.principalCents + contract.feeCents;
    const lines = [
      { account: "stock" as const, amountCents: contract.principalCents },
      { account: "divida_fornecedor" as const, amountCents: -total },
    ];
    if (contract.feeCents > 0) lines.push({ account: "despesas" as never, amountCents: contract.feeCents });
    const entry = await postEntry(tx, {
      userId: contract.userId,
      kind: "credito_stock",
      occurredAt: new Date(),
      channel: "sistema",
      recordedBy: supplierUser.id,
      amountCents: total,
      refType: "credit_contract",
      refId: contract.id,
      memo: `Entrega ${contract.code}`,
      lines,
    });
    for (const item of application.items) {
      const [existing] = await tx.select().from(products).where(and(eq(products.userId, contract.userId), eq(products.name, item.name))).for("update");
      const product =
        existing ??
        (await tx
          .insert(products)
          .values({ userId: contract.userId, name: item.name, unit: item.unit, avgCostCents: item.priceCents })
          .returning()
          .then((rows) => rows[0]));
      const value = product.quantity * product.avgCostCents + item.quantity * item.priceCents;
      const quantity = product.quantity + item.quantity;
      await tx.update(products).set({ quantity, avgCostCents: Math.round(value / quantity) }).where(eq(products.id, product.id));
      await tx.insert(stockMoves).values({ userId: contract.userId, productId: product.id, entryId: entry.id, kind: "credito", quantity: item.quantity, unitCostCents: item.priceCents });
    }
    const schedule = buildSchedule(total, application.offeredInstalments as number, contract.termDays, maputoDay());
    await tx.insert(creditInstalments).values(schedule.map((row) => ({ contractId: contract.id, ...row })));
    await tx.update(creditContracts).set({ status: "activo", deliveredAt: new Date(), deliveryConfirmedBy: supplierUser.id }).where(eq(creditContracts.id, contract.id));
    await recordAudit(tx, { actorId: supplierUser.id, actorRole: supplierUser.role, action: "credito.entrega", subjectType: "credit_contract", subjectId: contract.id, targetUserId: contract.userId });
    await notify(tx, contract.userId, { title: "Entrega confirmada", body: `O stock já está no teu registo. Primeira prestação: ${schedule[0].dueDate}.`, link: "/app/credito" });
  });
}

/** A repayment reference is unique in the database: recording the same receipt twice changes nothing. */
export async function recordRepayment(db: Db, actor: SessionUser, contractId: string, input: { amountCents: number; method: string; reference: string }) {
  if (!can(actor.role, "credit.repayment.record")) throw new DomainError("sem_permissao", "Não tens permissão para registar pagamentos.");
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) throw new DomainError("valor", "Valor inválido.");
  await db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    const [contract] = await tx.select().from(creditContracts).where(eq(creditContracts.id, contractId)).for("update");
    if (!contract) throw new DomainError("contrato", "Contrato não encontrado.");
    if (actor.role === "agent") await assertAssigned(tx, (await agentProfile(tx, actor.id)).id, contract.userId);
    // A receipt already recorded is a no-op, even after the contract settled: retries must be harmless.
    const [duplicate] = await tx.select({ contractId: creditRepayments.contractId, amountCents: creditRepayments.amountCents }).from(creditRepayments).where(eq(creditRepayments.reference, input.reference)).limit(1);
    if (duplicate) {
      if (duplicate.contractId !== contractId || duplicate.amountCents !== input.amountCents) throw new DomainError("referencia_em_uso", "Esta referência já pertence a outro pagamento.");
      return;
    }
    if (!["activo", "em_atraso", "incumprimento"].includes(contract.status)) throw new DomainError("contrato_estado", "Este contrato não aceita pagamentos.");
    const instalments = await tx.select().from(creditInstalments).where(eq(creditInstalments.contractId, contractId)).orderBy(asc(creditInstalments.number));
    const outstanding = instalments.reduce((sum, row) => sum + row.amountCents - row.paidCents, 0);
    if (input.amountCents > outstanding) throw new DomainError("contrato_valor", `O valor em falta é ${formatMT(outstanding)}.`);
    const entry = await postEntry(tx, {
      userId: contract.userId,
      kind: "credito_pagamento",
      occurredAt: new Date(),
      channel: "agente",
      recordedBy: actor.id,
      amountCents: input.amountCents,
      refType: "credit_contract",
      refId: contract.id,
      memo: `${input.method} ${input.reference}`,
      lines: [
        { account: "divida_fornecedor", amountCents: input.amountCents },
        { account: "negocio", amountCents: -input.amountCents },
      ],
    });
    await tx.insert(creditRepayments).values({ contractId, amountCents: input.amountCents, method: input.method, reference: input.reference, recordedBy: actor.id, entryId: entry.id });
    let remaining = input.amountCents;
    for (const row of instalments) {
      if (remaining === 0) break;
      const open = row.amountCents - row.paidCents;
      if (open === 0) continue;
      const applied = Math.min(open, remaining);
      remaining -= applied;
      const paidCents = row.paidCents + applied;
      const paid = paidCents === row.amountCents;
      await tx
        .update(creditInstalments)
        .set({ paidCents, status: paid ? "pago" : row.status === "em_atraso" ? "em_atraso" : "parcial", paidAt: paid ? new Date() : row.paidAt })
        .where(eq(creditInstalments.id, row.id));
    }
    const left = outstanding - input.amountCents;
    const stillLate = await tx
      .select({ id: creditInstalments.id })
      .from(creditInstalments)
      .where(and(eq(creditInstalments.contractId, contractId), eq(creditInstalments.status, "em_atraso")))
      .limit(1);
    await tx
      .update(creditContracts)
      .set({ status: left === 0 ? "liquidado" : stillLate.length ? contract.status : "activo", settledAt: left === 0 ? new Date() : null })
      .where(eq(creditContracts.id, contractId));
    await recordAudit(tx, { actorId: actor.id, actorRole: actor.role, action: "credito.pagamento", subjectType: "credit_contract", subjectId: contractId, targetUserId: contract.userId, data: { amountCents: input.amountCents, reference: input.reference } });
    await notify(tx, contract.userId, { title: left === 0 ? "Crédito liquidado" : "Pagamento registado", body: left === 0 ? "Pagaste tudo. Isto fica no teu historial." : `Faltam ${formatMT(left)}.`, link: "/app/credito" });
  });
}

/** Daily job. Status moves on its own only in this direction; a human still decides what happens to the person. */
export async function markOverdue(db: Db, today = maputoDay()) {
  const policy = await activePolicy(db);
  const grace = policy?.params.graceDays ?? 0;
  const defaultAfter = policy?.params.defaultAfterDays ?? 90;
  const rows = await db
    .select({ instalment: creditInstalments, contract: creditContracts, acceptedPolicy: creditPolicies.params })
    .from(creditInstalments)
    .innerJoin(creditContracts, eq(creditContracts.id, creditInstalments.contractId))
    .innerJoin(creditApplications, eq(creditApplications.id, creditContracts.applicationId))
    .innerJoin(creditPolicies, eq(creditPolicies.id, creditApplications.policyId))
    .where(and(inArray(creditInstalments.status, ["por_pagar", "parcial", "em_atraso"]), inArray(creditContracts.status, ["activo", "em_atraso", "incumprimento"])));
  let changed = 0;
  for (const { instalment, contract, acceptedPolicy } of rows) {
    const terms = contract.termsSnapshot as { graceDays?: number; defaultAfterDays?: number };
    const contractGrace = terms.graceDays ?? acceptedPolicy.graceDays ?? grace;
    const contractDefaultAfter = terms.defaultAfterDays ?? acceptedPolicy.defaultAfterDays ?? defaultAfter;
    const late = daysBetween(instalment.dueDate, today);
    if (late <= contractGrace) continue;
    if (instalment.status !== "em_atraso") {
      await db.update(creditInstalments).set({ status: "em_atraso" }).where(eq(creditInstalments.id, instalment.id));
      await notify(db, contract.userId, { title: "Prestação em atraso", body: `Falta pagar ${formatMT(instalment.amountCents - instalment.paidCents)}. Fala com o teu agente se precisares de ajuda.`, link: "/app/credito" });
      changed += 1;
    }
    const status = late >= contractDefaultAfter ? "incumprimento" : "em_atraso";
    if (contract.status !== status && contract.status !== "incumprimento") {
      await db.update(creditContracts).set({ status }).where(eq(creditContracts.id, contract.id));
    }
    await raiseAlert(db, {
      rule: "credito_atraso",
      severity: late >= 30 ? "alta" : late >= 7 ? "media" : "baixa",
      title: `Contrato ${contract.code} em atraso`,
      detail: `Prestação ${instalment.number} com ${late} dias de atraso.`,
      subjectUserId: contract.userId,
      dedupeKey: `credito_atraso:${contract.id}:${late >= 30 ? "30" : late >= 7 ? "7" : "1"}`,
      evidence: { contractId: contract.id, instalment: instalment.number, late },
    });
  }
  return changed;
}

const policyInput = z.object({
  version: z.string().trim().min(1).max(60),
  note: z.string().trim().max(4000).nullish(),
  params: z.object({
    isExample: z.boolean(),
    maxAmountByRing: z.object({ base: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), second: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), third: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) }),
    termOptionsDays: z.array(z.number().int().positive().max(3650)).min(1).max(24),
    feePercentBasisPoints: z.number().int().min(0).max(10000),
    graceDays: z.number().int().min(0).max(365),
    defaultAfterDays: z.number().int().positive().max(3650),
    concentrationLimitPct: z.number().positive().max(100),
  }).refine((value) => value.defaultAfterDays > value.graceDays && value.maxAmountByRing.base <= value.maxAmountByRing.second && value.maxAmountByRing.second <= value.maxAmountByRing.third),
});

export async function proposePolicy(db: Db, actor: SessionUser, rawInput: { version: string; params: CreditPolicyParams; note?: string | null }) {
  if (!can(actor.role, "credit.policy.propose")) throw new DomainError("sem_permissao", "Não tens permissão para propor políticas.");
  const parsed = policyInput.safeParse(rawInput);
  if (!parsed.success) throw new DomainError("politica", "Revê a versão, os limites, os prazos e os custos da política.");
  const input = parsed.data;
  await db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    const [policy] = await tx.insert(creditPolicies).values({ version: input.version, params: input.params, note: input.note ?? null, createdBy: actor.id }).returning();
    await recordAudit(tx, { actorId: actor.id, actorRole: actor.role, action: "politica.proposta", subjectType: "credit_policy", subjectId: policy.id, data: { version: input.version } });
  });
}

/** Four eyes again, and the database refuses a self-approval even if this check were removed. */
export async function approvePolicy(db: Db, actor: SessionUser, policyId: string) {
  if (!can(actor.role, "credit.policy.approve")) throw new DomainError("sem_permissao", "Não tens permissão para aprovar políticas.");
  await db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    const [policy] = await tx.select().from(creditPolicies).where(eq(creditPolicies.id, policyId)).for("update");
    if (!policy || policy.status !== "rascunho") throw new DomainError("politica", "Esta política não está por aprovar.");
    if (policy.createdBy === actor.id) throw new DomainError("quatro_olhos", "A aprovação tem de vir de outra pessoa.");
    await tx.update(creditPolicies).set({ status: "arquivada" }).where(eq(creditPolicies.status, "aprovada"));
    await tx.update(creditPolicies).set({ status: "aprovada", approvedBy: actor.id, approvedAt: new Date() }).where(eq(creditPolicies.id, policyId));
    await recordAudit(tx, { actorId: actor.id, actorRole: actor.role, action: "politica.aprovada", subjectType: "credit_policy", subjectId: policyId, data: { version: policy.version } });
  });
}

export async function contractOutstanding(db: Executor, contractId: string) {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${creditInstalments.amountCents} - ${creditInstalments.paidCents}), 0)` })
    .from(creditInstalments)
    .where(eq(creditInstalments.contractId, contractId));
  return Number(row?.total ?? 0);
}
