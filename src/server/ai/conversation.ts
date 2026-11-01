import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { interpret, parseWalletSms, type Interpretation } from "@/lib/interpret";
import { DOCUMENT_STATUS_LABELS, DOCUMENT_TYPES, EXPENSE_CATEGORIES, KYC_LEVEL_LABELS } from "@/lib/labels";
import { formatMT } from "@/lib/money";
import { randomCode } from "../crypto";
import type { Db, Tx } from "../db/client";
import { aiTurns, consents, customers, incidents, products, proposals, type Channel } from "../db/schema";
import { DomainError } from "../errors";
import { buildSnapshot, type MerchantSnapshot } from "../merchant/snapshot";
import { getSetting } from "../settings";
import { executeOp } from "../sync/execute";
import type { OpType } from "../sync/schemas";
import { answerWithClaude, classifyWithClaude, hasClaude } from "./claude";
import { searchKnowledge } from "./knowledge";

/*
 * One conversation engine behind WhatsApp and the in-app assistant. Guardrails from KB §17 and §33 live here as code:
 * figures come from the snapshot, money only moves after a confirmation, and anything sensitive goes to a person.
 */

export type Reply = {
  text: string;
  intent: string;
  engine: "regras" | "claude";
  confidence: number;
  escalated: boolean;
  proposalId?: string;
  sources?: string[];
  guardrails?: string[];
};

type RecordDraft = { type: OpType; payload: Record<string, unknown>; summary: string };

function money(cents: number) {
  return formatMT(cents);
}

async function draftRecord(db: Db, userId: string, parsed: Interpretation): Promise<RecordDraft | { missing: string }> {
  if (!parsed.amountCents) return { missing: "Quanto foi, em meticais?" };
  const amount = parsed.amountCents;
  const memo = parsed.item ?? null;

  switch (parsed.intent) {
    case "RECORD_SALE": {
      const product = await matchProduct(db, userId, parsed.item);
      const label = parsed.quantity && parsed.item ? `${parsed.quantity} ${parsed.item}` : (parsed.item ?? "Venda");
      return {
        type: "sale.record",
        payload: { amountCents: amount, productId: product?.id ?? null, quantity: product ? (parsed.quantity ?? 1) : (parsed.quantity ?? null), memo },
        summary: `Venda: ${label} por ${money(amount)}`,
      };
    }
    case "RECORD_FIADO_SALE": {
      const customer = await matchCustomer(db, userId, parsed.person);
      if (!customer) return { missing: parsed.person ? `Não encontrei ${parsed.person} nos teus clientes. Cria na app ou diz outro nome.` : "A quem vendeste a fiado?" };
      return {
        type: "sale.record",
        payload: { amountCents: amount, customerId: customer.id, memo },
        summary: `Venda a fiado para ${customer.name}: ${money(amount)}`,
      };
    }
    case "FIADO_REPAID": {
      const customer = await matchCustomer(db, userId, parsed.person);
      if (!customer) return { missing: parsed.person ? `Não encontrei ${parsed.person} nos teus clientes.` : "Quem te pagou?" };
      return { type: "fiado.repay", payload: { customerId: customer.id, amountCents: amount }, summary: `${customer.name} pagou ${money(amount)} do fiado` };
    }
    case "RECORD_EXPENSE": {
      const category = parsed.category ?? "outro";
      const label = EXPENSE_CATEGORIES.find((row) => row.key === category)?.label ?? "Despesa";
      return { type: "expense.record", payload: { amountCents: amount, category, memo }, summary: `Despesa (${label}): ${money(amount)}` };
    }
    case "RECORD_PURCHASE": {
      const product = await matchProduct(db, userId, parsed.item);
      if (!product) return { missing: parsed.item ? `Ainda não tens ${parsed.item} no stock. Cria o produto na app primeiro.` : "O que compraste?" };
      return {
        type: "stock.purchase",
        payload: { amountCents: amount, productId: product.id, quantity: parsed.quantity ?? 1 },
        summary: `Compra: ${parsed.quantity ?? 1} ${product.unit} de ${product.name} por ${money(amount)}`,
      };
    }
    case "TRANSFER_HOME":
      return { type: "pocket.transfer", payload: { from: "negocio", to: "casa", amountCents: amount }, summary: `Passar ${money(amount)} do Negócio para a Casa` };
    case "RECORD_SAVING":
      return { type: "savings.deposit", payload: { amountCents: amount }, summary: `Guardar ${money(amount)} na Poupança` };
    default:
      return { missing: "Não percebi bem. Podes dizer de outra forma?" };
  }
}

async function matchProduct(db: Db, userId: string, item: string | undefined) {
  if (!item) return null;
  const all = await db.select({ id: products.id, name: products.name, unit: products.unit }).from(products).where(eq(products.userId, userId));
  const target = item.toLowerCase();
  return all.find((row) => row.name.toLowerCase() === target) ?? all.find((row) => target.includes(row.name.toLowerCase()) || row.name.toLowerCase().includes(target)) ?? null;
}

async function matchCustomer(db: Db, userId: string, person: string | undefined) {
  if (!person) return null;
  const all = await db.select({ id: customers.id, name: customers.name }).from(customers).where(eq(customers.userId, userId));
  const target = person.toLowerCase();
  return all.find((row) => row.name.toLowerCase().includes(target)) ?? null;
}

const HELP_TEXT = "Podes dizer, por exemplo:\n• Vendi 2 caixas por 1000\n• Gastei 150 de transporte\n• Quanto tenho?\n• Como foi hoje?\n• Quanto falta para o Xitique?\n• Quero falar com alguém";

function answerQuery(intent: string, snapshot: MerchantSnapshot): string {
  const { pockets } = snapshot;
  switch (intent) {
    case "CHECK_BALANCE":
      return `Negócio: ${money(pockets.negocio)}\nCasa: ${money(pockets.casa)}\nPoupança: ${money(pockets.poupanca)}\n\nEstes valores são o que registaste. Confere com o dinheiro que tens.`;
    case "DAILY_SUMMARY": {
      const today = snapshot.daily.find((row) => row.day === snapshot.today);
      if (!today || today.salesCents + today.expensesCents + today.purchasesCents === 0) return "Hoje ainda não registaste nada.";
      return `Hoje vendeste ${money(today.salesCents)}, gastaste ${money(today.expensesCents)} e compraste ${money(today.purchasesCents)} de stock.`;
    }
    case "DOCUMENT_STATUS": {
      const latest = snapshot.documents[0];
      if (!latest) return "Ainda não submeteste nenhum documento.";
      const status = DOCUMENT_STATUS_LABELS[latest.status] ?? latest.status;
      return `O teu ${DOCUMENT_TYPES[latest.type] ?? latest.type} está: ${status}.${latest.status === "rejeitado" ? " O teu agente pode ajudar a corrigir." : ""}`;
    }
    case "KYC_HELP": {
      const next = snapshot.trust.rings.find((ring) => !ring.done);
      return `Estás em: ${KYC_LEVEL_LABELS[snapshot.kyc.level]}.${next?.missing[0] ? `\nPróximo passo: ${next.missing[0]}` : ""}`;
    }
    case "XITIQUE_STATUS": {
      const group = snapshot.xitique[0];
      if (!group) return "Ainda não estás em nenhum Xitique. Podes criar um ou entrar com um código.";
      const due = group.nextDue ? `Falta pagares ${money(group.nextDue.amountCents)} até ${group.nextDue.dueDate}.` : "Estás em dia.";
      const round = group.currentRound ? `\nRonda ${group.currentRound.number}: recebe ${group.currentRound.isMine ? "tu" : group.currentRound.recipientName}.` : "";
      return `${group.name}: ${due}${round}`;
    }
    case "SAVINGS_STATUS": {
      const goal = snapshot.goals.find((row) => row.status === "activa");
      return `Na poupança tens ${money(pockets.poupanca)}.${goal ? `\nMeta "${goal.name}": ${money(goal.savedCents)} de ${money(goal.targetCents)}.` : ""}`;
    }
    case "STOCK_STATUS": {
      const low = snapshot.products.filter((row) => row.quantity <= row.lowStockAt);
      if (low.length === 0) return "O teu stock está bem. Nada a acabar.";
      return `A acabar:\n${low.slice(0, 6).map((row) => `• ${row.name}: ${row.quantity} ${row.unit}`).join("\n")}`;
    }
    case "FIADO_STATUS": {
      const owing = snapshot.customers.filter((row) => row.owedCents > 0);
      if (owing.length === 0) return "Ninguém te deve neste momento.";
      const total = owing.reduce((sum, row) => sum + row.owedCents, 0);
      return `Devem-te ${money(total)}:\n${owing.slice(0, 6).map((row) => `• ${row.name}: ${money(row.owedCents)}`).join("\n")}`;
    }
    default:
      return HELP_TEXT;
  }
}

async function escalate(db: Db, userId: string, channel: Channel, text: string, reason: string) {
  const [existing] = await db
    .select({ code: incidents.code })
    .from(incidents)
    .where(and(eq(incidents.subjectUserId, userId), eq(incidents.status, "aberto"), eq(incidents.kind, "suporte")))
    .limit(1);
  if (existing) return existing.code;
  const code = `INC-${randomCode(5)}`;
  await db.insert(incidents).values({ code, kind: "suporte", severity: "media", title: reason, description: text.slice(0, 500), subjectUserId: userId, openedBy: userId, openedVia: channel });
  return code;
}

async function recentFailures(db: Db, userId: string) {
  const [row] = await db
    .select({ total: sql<string>`count(*)` })
    .from(aiTurns)
    .where(and(eq(aiTurns.userId, userId), eq(aiTurns.intent, "UNKNOWN"), gt(aiTurns.createdAt, new Date(Date.now() - 10 * 60_000))));
  return Number(row?.total ?? 0);
}

async function confirmProposal(db: Db, userId: string, channel: Channel): Promise<Reply> {
  const [proposal] = await db
    .select()
    .from(proposals)
    .where(and(eq(proposals.userId, userId), eq(proposals.status, "pendente"), gt(proposals.expiresAt, new Date())))
    .orderBy(desc(proposals.createdAt))
    .limit(1);
  if (!proposal) return { text: "Não tenho nada à espera de confirmação.", intent: "CONFIRM_YES", engine: "regras", confidence: 1, escalated: false };
  const opId = randomUUID();
  const draft = proposal.payload as { type: OpType; payload: Record<string, unknown> };
  const conflicts = await db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    const outcome = await executeOp(tx, { userId, actorId: userId, channel, opId, occurredAt: new Date() }, draft.type, draft.payload);
    await tx.update(proposals).set({ status: "confirmada", opId, decidedAt: new Date() }).where(eq(proposals.id, proposal.id));
    return outcome.conflicts;
  });
  const note = conflicts[0] ? `\nAtenção: ${conflicts[0].message}` : "";
  return { text: `Registado. ${proposal.summary}.${note}`, intent: "CONFIRM_YES", engine: "regras", confidence: 1, escalated: false, guardrails: ["confirmacao_explicita"] };
}

async function rejectProposal(db: Db, userId: string): Promise<Reply> {
  const updated = await db
    .update(proposals)
    .set({ status: "rejeitada", decidedAt: new Date() })
    .where(and(eq(proposals.userId, userId), eq(proposals.status, "pendente")))
    .returning({ id: proposals.id });
  return { text: updated.length ? "Cancelado. Não registei nada." : "Não tenho nada à espera de confirmação.", intent: "CONFIRM_NO", engine: "regras", confidence: 1, escalated: false };
}

async function hasAiConsent(db: Db, userId: string) {
  const [row] = await db
    .select({ id: consents.id })
    .from(consents)
    .where(and(eq(consents.userId, userId), eq(consents.purpose, "voz_ia"), eq(consents.status, "concedido")))
    .limit(1);
  return Boolean(row);
}

export async function respond(db: Db, input: { userId: string; channel: Channel; text: string }): Promise<Reply> {
  const startedAt = Date.now();
  const reply: Reply = await compose(db, input).catch((error: unknown) => {
    if (error instanceof DomainError) return { text: error.message, intent: "ERRO", engine: "regras", confidence: 1, escalated: false } satisfies Reply;
    throw error;
  });
  await db.insert(aiTurns).values({
    userId: input.userId,
    channel: input.channel,
    input: input.text.slice(0, 500),
    intent: reply.intent,
    confidence: reply.confidence,
    engine: reply.engine,
    response: reply.text.slice(0, 1000),
    escalated: reply.escalated,
    sources: reply.sources ?? null,
    guardrails: reply.guardrails ?? null,
    latencyMs: Date.now() - startedAt,
  });
  return reply;
}

async function compose(db: Db, input: { userId: string; channel: Channel; text: string }): Promise<Reply> {
  const { userId, channel, text } = input;
  const policy = await getSetting(db, "aiPolicy");
  let parsed: Interpretation = parseWalletSms(text) ?? interpret(text);
  let engine: Reply["engine"] = "regras";

  if (parsed.confidence < policy.confidenceFloor && hasClaude() && (await hasAiConsent(db, userId))) {
    const assisted = await classifyWithClaude(text);
    if (assisted && assisted.confidence >= policy.confidenceFloor) {
      parsed = assisted;
      engine = "claude";
    }
  }

  const base = { intent: parsed.intent as string, engine, confidence: parsed.confidence, escalated: false };

  if (parsed.intent === "CONFIRM_YES") return confirmProposal(db, userId, channel);
  if (parsed.intent === "CONFIRM_NO") return rejectProposal(db, userId);

  if (parsed.intent === "HUMAN_SUPPORT") {
    const code = await escalate(db, userId, channel, text, "Pedido para falar com uma pessoa");
    return { ...base, text: `Certo. O teu agente vai falar contigo. O teu pedido é ${code}.`, escalated: true, guardrails: ["escalado_para_humano"] };
  }
  if (parsed.intent === "GREETING") return { ...base, text: `Olá! Sou o assistente do Ukuphila.\n\n${HELP_TEXT}` };
  if (parsed.intent === "HELP") return { ...base, text: HELP_TEXT };

  if (parsed.intent.startsWith("RECORD_") || parsed.intent === "TRANSFER_HOME" || parsed.intent === "FIADO_REPAID") {
    const draft = await draftRecord(db, userId, parsed);
    if ("missing" in draft) return { ...base, text: draft.missing };
    const [proposal] = await db
      .insert(proposals)
      .values({
        userId,
        channel,
        sourceText: text.slice(0, 500),
        intent: parsed.intent,
        payload: { type: draft.type, payload: draft.payload },
        summary: draft.summary,
        expiresAt: new Date(Date.now() + policy.proposalTtlMinutes * 60_000),
      })
      .returning({ id: proposals.id });
    return { ...base, text: `${draft.summary}.\nConfirmas? Responde SIM ou NÃO.`, proposalId: proposal.id, guardrails: ["proposta_sem_execucao"] };
  }

  if (parsed.intent === "CREDIT_INFO" || parsed.intent === "KNOWLEDGE") {
    const chunks = await searchKnowledge(db, text);
    const guardrails = ["so_conhecimento_aprovado"];
    if (hasClaude() && (await hasAiConsent(db, userId))) {
      const answer = await answerWithClaude(text, chunks);
      if (answer?.sufficient) return { ...base, engine: "claude", text: answer.answer, sources: answer.sources, guardrails };
    }
    if (chunks[0]) {
      const excerpt = chunks[0].content.split("\n").filter(Boolean).slice(0, 3).join("\n");
      return { ...base, text: excerpt, sources: [chunks[0].documentId], guardrails };
    }
    return { ...base, text: "Não tenho essa informação. Posso pedir ao teu agente para te ajudar. Queres falar com alguém?", guardrails };
  }

  if (parsed.intent === "UNKNOWN") {
    if ((await recentFailures(db, userId)) >= policy.escalateAfterFailures) {
      const code = await escalate(db, userId, channel, text, "O assistente não conseguiu perceber");
      return { ...base, text: `Não estou a conseguir ajudar. Pedi ao teu agente para falar contigo. O teu pedido é ${code}.`, escalated: true, guardrails: ["escalado_para_humano"] };
    }
    return { ...base, text: parsed.amountCents ? `Vi ${money(parsed.amountCents)}. Foi uma venda, uma despesa ou uma compra?` : `Não percebi bem.\n\n${HELP_TEXT}` };
  }

  const snapshot = await buildSnapshot(db, userId);
  return { ...base, text: answerQuery(parsed.intent, snapshot), guardrails: ["dados_do_sistema_transaccional"] };
}
