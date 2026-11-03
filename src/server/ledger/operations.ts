import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { accounts, customers, journalEntries, postings, products, savingsGoals, stockMoves, syncConflicts, type AccountCode, type Channel } from "../db/schema";
import { rowsOf, type Executor, type Tx } from "../db/client";
import { DomainError } from "../errors";
import { postEntry } from "./post";

/*
 * Business operations in plain terms. Each one turns something a merchant did into balanced postings.
 * Asset-style sign: positive increases a pocket, negative decreases it.
 *
 *   venda               negocio +v   receita −v      (+ custo_vendas +c  stock −c when the cost is known)
 *   venda a fiado       fiado +v     receita −v
 *   fiado recebido      negocio +v   fiado −v
 *   despesa             despesas +v  bolso −v
 *   compra de stock     stock +v     bolso −v
 *   transferência       destino +v   origem −v
 *   poupança            poupanca +v  bolso −v
 */

export type OperationContext = {
  userId: string;
  actorId: string;
  channel: Channel;
  opId: string;
  occurredAt: Date;
};

type Outcome = { entryId?: string; conflicts: { kind: string; message: string }[] };

const SPENDABLE = new Set<string>(["negocio", "casa"]);

function spendablePocket(pocket: string | undefined | null, fallback: "negocio" | "casa" = "negocio") {
  const value = pocket ?? fallback;
  if (!SPENDABLE.has(value)) throw new DomainError("bolso", "Escolhe o bolso Negócio ou Casa.");
  return value as "negocio" | "casa";
}

export async function balanceOf(db: Executor, userId: string, code: AccountCode) {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${postings.amountCents}), 0)` })
    .from(postings)
    .innerJoin(accounts, eq(accounts.id, postings.accountId))
    .where(and(eq(accounts.userId, userId), eq(accounts.code, code)));
  return Number(row?.total ?? 0);
}

/** A record is never lost: a suspicious one is kept, flagged and sent to the merchant's "Por rever" list. */
async function flag(tx: Tx, ctx: OperationContext, outcome: Outcome) {
  for (const conflict of outcome.conflicts) {
    await tx.insert(syncConflicts).values({ userId: ctx.userId, opId: ctx.opId, kind: conflict.kind, message: conflict.message });
  }
}

async function ownedProduct(tx: Tx, userId: string, productId: string) {
  const [row] = await tx
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.userId, userId)))
    .for("update");
  if (!row) throw new DomainError("produto", "Produto não encontrado.");
  return row;
}

export async function recordSale(
  tx: Tx,
  ctx: OperationContext,
  input: { amountCents: number; productId?: string | null; quantity?: number | null; customerId?: string | null; memo?: string | null },
) {
  const conflicts: Outcome["conflicts"] = [];
  const product = input.productId ? await ownedProduct(tx, ctx.userId, input.productId) : null;
  const quantity = input.quantity ?? (product ? 1 : null);
  if (input.customerId) {
    const [customer] = await tx
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.id, input.customerId), eq(customers.userId, ctx.userId)));
    if (!customer) throw new DomainError("cliente", "Cliente não encontrado.");
  }
  const lines = [
    { account: (input.customerId ? "fiado" : "negocio") as AccountCode, amountCents: input.amountCents },
    { account: "receita" as AccountCode, amountCents: -input.amountCents },
  ];
  let costKnown = false;
  if (product && quantity && product.avgCostCents > 0) {
    const cost = product.avgCostCents * quantity;
    lines.push({ account: "custo_vendas", amountCents: cost }, { account: "stock", amountCents: -cost });
    costKnown = true;
  }
  if (product && quantity && product.quantity - quantity < 0) {
    conflicts.push({
      kind: "stock_negativo",
      message: `Vendeste ${quantity} ${product.unit} de ${product.name}, mas o stock registado era ${product.quantity}. A venda ficou guardada. Confirma o stock.`,
    });
  }
  const entry = await postEntry(tx, {
    userId: ctx.userId,
    kind: input.customerId ? "venda_fiado" : "venda",
    occurredAt: ctx.occurredAt,
    channel: ctx.channel,
    recordedBy: ctx.actorId,
    opId: ctx.opId,
    amountCents: input.amountCents,
    memo: input.memo,
    productId: product?.id,
    quantity,
    customerId: input.customerId,
    category: costKnown ? "custo_conhecido" : "custo_desconhecido",
    needsReview: conflicts.length > 0,
    reviewNote: conflicts[0]?.message,
    lines,
  });
  if (product && quantity) {
    await tx.update(products).set({ quantity: Math.max(0, product.quantity - quantity) }).where(eq(products.id, product.id));
    await tx.insert(stockMoves).values({ userId: ctx.userId, productId: product.id, entryId: entry.id, kind: "venda", quantity: -quantity, unitCostCents: product.avgCostCents });
  }
  await flag(tx, ctx, { conflicts });
  return { entryId: entry.id, conflicts };
}

export async function recordExpense(tx: Tx, ctx: OperationContext, input: { amountCents: number; category: string; pocket?: string | null; memo?: string | null }) {
  const pocket = spendablePocket(input.pocket);
  const available = await balanceOf(tx, ctx.userId, pocket);
  const conflicts: Outcome["conflicts"] =
    available - input.amountCents < 0
      ? [{ kind: "saldo_negativo", message: "Esta despesa deixou o bolso abaixo de zero. Falta registar alguma entrada?" }]
      : [];
  const entry = await postEntry(tx, {
    userId: ctx.userId,
    kind: "despesa",
    occurredAt: ctx.occurredAt,
    channel: ctx.channel,
    recordedBy: ctx.actorId,
    opId: ctx.opId,
    amountCents: input.amountCents,
    category: input.category,
    memo: input.memo,
    needsReview: conflicts.length > 0,
    reviewNote: conflicts[0]?.message,
    lines: [
      { account: "despesas", amountCents: input.amountCents },
      { account: pocket, amountCents: -input.amountCents },
    ],
  });
  await flag(tx, ctx, { conflicts });
  return { entryId: entry.id, conflicts };
}

export async function recordStockPurchase(tx: Tx, ctx: OperationContext, input: { amountCents: number; productId: string; quantity: number; pocket?: string | null; memo?: string | null }) {
  const pocket = spendablePocket(input.pocket);
  const product = await ownedProduct(tx, ctx.userId, input.productId);
  const available = await balanceOf(tx, ctx.userId, pocket);
  const conflicts: Outcome["conflicts"] =
    available - input.amountCents < 0
      ? [{ kind: "saldo_negativo", message: "Esta compra deixou o bolso abaixo de zero. Falta registar alguma entrada?" }]
      : [];
  const entry = await postEntry(tx, {
    userId: ctx.userId,
    kind: "compra_stock",
    occurredAt: ctx.occurredAt,
    channel: ctx.channel,
    recordedBy: ctx.actorId,
    opId: ctx.opId,
    amountCents: input.amountCents,
    productId: product.id,
    quantity: input.quantity,
    memo: input.memo,
    needsReview: conflicts.length > 0,
    reviewNote: conflicts[0]?.message,
    lines: [
      { account: "stock", amountCents: input.amountCents },
      { account: pocket, amountCents: -input.amountCents },
    ],
  });
  const previousValue = product.quantity * product.avgCostCents;
  const newQuantity = product.quantity + input.quantity;
  await tx
    .update(products)
    .set({ quantity: newQuantity, avgCostCents: Math.round((previousValue + input.amountCents) / newQuantity) })
    .where(eq(products.id, product.id));
  await tx.insert(stockMoves).values({
    userId: ctx.userId,
    productId: product.id,
    entryId: entry.id,
    kind: "compra",
    quantity: input.quantity,
    unitCostCents: Math.round(input.amountCents / input.quantity),
  });
  await flag(tx, ctx, { conflicts });
  return { entryId: entry.id, conflicts };
}

export async function recordTransfer(tx: Tx, ctx: OperationContext, input: { from: string; to: string; amountCents: number; memo?: string | null }) {
  const from = spendablePocket(input.from);
  const to = spendablePocket(input.to);
  if (from === to) throw new DomainError("bolso", "Escolhe dois bolsos diferentes.");
  const available = await balanceOf(tx, ctx.userId, from);
  const conflicts: Outcome["conflicts"] =
    available - input.amountCents < 0
      ? [{ kind: "saldo_negativo", message: "Esta transferência deixou o bolso abaixo de zero. Falta registar alguma entrada?" }]
      : [];
  const entry = await postEntry(tx, {
    userId: ctx.userId,
    kind: "transferencia",
    occurredAt: ctx.occurredAt,
    channel: ctx.channel,
    recordedBy: ctx.actorId,
    opId: ctx.opId,
    amountCents: input.amountCents,
    category: from === "negocio" ? "retirada_casa" : "reforco_negocio",
    memo: input.memo,
    needsReview: conflicts.length > 0,
    reviewNote: conflicts[0]?.message,
    lines: [
      { account: to, amountCents: input.amountCents },
      { account: from, amountCents: -input.amountCents },
    ],
  });
  await flag(tx, ctx, { conflicts });
  return { entryId: entry.id, conflicts };
}

export async function recordCapital(tx: Tx, ctx: OperationContext, input: { amountCents: number; pocket?: string | null; memo?: string | null }) {
  const pocket = spendablePocket(input.pocket);
  const entry = await postEntry(tx, {
    userId: ctx.userId,
    kind: "entrada_capital",
    occurredAt: ctx.occurredAt,
    channel: ctx.channel,
    recordedBy: ctx.actorId,
    opId: ctx.opId,
    amountCents: input.amountCents,
    memo: input.memo,
    lines: [
      { account: pocket, amountCents: input.amountCents },
      { account: "capital", amountCents: -input.amountCents },
    ],
  });
  return { entryId: entry.id, conflicts: [] };
}

/** What a customer still owes. Reversed movements are left out, so corrections cancel themselves. */
export async function customerBalance(db: Executor, userId: string, customerId: string) {
  const result = await db.execute(sql`
    select coalesce(sum(case e.kind when 'venda_fiado' then e.amount_cents when 'fiado_recebido' then -e.amount_cents else 0 end), 0) as total
    from ukuphila.journal_entries e
    where e.user_id = ${userId} and e.customer_id = ${customerId}
      and not exists (select 1 from ukuphila.journal_entries r where r.reverses_id = e.id)
  `);
  return Number(rowsOf<{ total: string }>(result)[0]?.total ?? 0);
}

export async function recordFiadoRepayment(tx: Tx, ctx: OperationContext, input: { customerId: string; amountCents: number; pocket?: string | null; memo?: string | null }) {
  const pocket = spendablePocket(input.pocket);
  const [customer] = await tx
    .select()
    .from(customers)
    .where(and(eq(customers.id, input.customerId), eq(customers.userId, ctx.userId)));
  if (!customer) throw new DomainError("cliente", "Cliente não encontrado.");
  const owed = await customerBalance(tx, ctx.userId, customer.id);
  const conflicts: Outcome["conflicts"] =
    input.amountCents > owed
      ? [{ kind: "fiado_excesso", message: `${customer.name} pagou mais do que o registado como dívida. Confirma o valor.` }]
      : [];
  const entry = await postEntry(tx, {
    userId: ctx.userId,
    kind: "fiado_recebido",
    occurredAt: ctx.occurredAt,
    channel: ctx.channel,
    recordedBy: ctx.actorId,
    opId: ctx.opId,
    amountCents: input.amountCents,
    customerId: customer.id,
    memo: input.memo,
    needsReview: conflicts.length > 0,
    reviewNote: conflicts[0]?.message,
    lines: [
      { account: pocket, amountCents: input.amountCents },
      { account: "fiado", amountCents: -input.amountCents },
    ],
  });
  await flag(tx, ctx, { conflicts });
  return { entryId: entry.id, conflicts };
}

export async function recordSavingsDeposit(tx: Tx, ctx: OperationContext, input: { amountCents: number; goalId?: string | null; pocket?: string | null; memo?: string | null }) {
  const pocket = spendablePocket(input.pocket);
  if (input.goalId) {
    const [goal] = await tx
      .select({ id: savingsGoals.id })
      .from(savingsGoals)
      .where(and(eq(savingsGoals.id, input.goalId), eq(savingsGoals.userId, ctx.userId)));
    if (!goal) throw new DomainError("meta", "Meta não encontrada.");
  }
  const available = await balanceOf(tx, ctx.userId, pocket);
  const conflicts: Outcome["conflicts"] =
    available - input.amountCents < 0
      ? [{ kind: "saldo_negativo", message: "Este depósito deixou o bolso abaixo de zero. Falta registar alguma entrada?" }]
      : [];
  const entry = await postEntry(tx, {
    userId: ctx.userId,
    kind: "poupanca_deposito",
    occurredAt: ctx.occurredAt,
    channel: ctx.channel,
    recordedBy: ctx.actorId,
    opId: ctx.opId,
    amountCents: input.amountCents,
    goalId: input.goalId,
    memo: input.memo,
    needsReview: conflicts.length > 0,
    reviewNote: conflicts[0]?.message,
    lines: [
      { account: "poupanca", amountCents: input.amountCents },
      { account: pocket, amountCents: -input.amountCents },
    ],
  });
  await flag(tx, ctx, { conflicts });
  return { entryId: entry.id, conflicts };
}

export async function recordSavingsWithdrawal(tx: Tx, ctx: OperationContext, input: { amountCents: number; goalId?: string | null; pocket?: string | null; memo?: string | null }) {
  const pocket = spendablePocket(input.pocket, "casa");
  const available = await balanceOf(tx, ctx.userId, "poupanca");
  const conflicts: Outcome["conflicts"] =
    available - input.amountCents < 0
      ? [{ kind: "saldo_negativo", message: "Este levantamento é maior do que a poupança registada. Confirma o valor." }]
      : [];
  const entry = await postEntry(tx, {
    userId: ctx.userId,
    kind: "poupanca_levantamento",
    occurredAt: ctx.occurredAt,
    channel: ctx.channel,
    recordedBy: ctx.actorId,
    opId: ctx.opId,
    amountCents: input.amountCents,
    goalId: input.goalId,
    memo: input.memo,
    needsReview: conflicts.length > 0,
    reviewNote: conflicts[0]?.message,
    lines: [
      { account: pocket, amountCents: input.amountCents },
      { account: "poupanca", amountCents: -input.amountCents },
    ],
  });
  await flag(tx, ctx, { conflicts });
  return { entryId: entry.id, conflicts };
}

/** A correction is a mirror entry dated like the original, so period totals net out and history stays visible. */
export async function reverseEntry(tx: Tx, ctx: OperationContext, input: { entryId: string; reason: string }) {
  const [original] = await tx
    .select()
    .from(journalEntries)
    .where(and(eq(journalEntries.id, input.entryId), eq(journalEntries.userId, ctx.userId)));
  if (!original) throw new DomainError("movimento", "Movimento não encontrado.");
  if (original.kind === "estorno") throw new DomainError("movimento", "Uma correcção não pode ser corrigida. Regista o movimento certo.");
  const [already] = await tx.select({ id: journalEntries.id }).from(journalEntries).where(eq(journalEntries.reversesId, original.id));
  if (already) throw new DomainError("movimento", "Este movimento já foi corrigido.");
  const lines = await tx
    .select({ code: accounts.code, amountCents: postings.amountCents })
    .from(postings)
    .innerJoin(accounts, eq(accounts.id, postings.accountId))
    .where(eq(postings.entryId, original.id));
  const entry = await postEntry(tx, {
    userId: ctx.userId,
    kind: "estorno",
    occurredAt: original.occurredAt,
    channel: ctx.channel,
    recordedBy: ctx.actorId,
    opId: ctx.opId,
    amountCents: original.amountCents,
    memo: input.reason,
    productId: original.productId,
    quantity: original.quantity,
    customerId: original.customerId,
    goalId: original.goalId,
    reversesId: original.id,
    lines: lines.map((line) => ({ account: line.code, amountCents: -line.amountCents })),
  });
  if (original.productId && original.quantity) {
    const direction = original.kind === "venda" || original.kind === "venda_fiado" ? 1 : original.kind === "compra_stock" || original.kind === "credito_stock" ? -1 : 0;
    if (direction !== 0) {
      await tx
        .update(products)
        .set({ quantity: sql`greatest(0, ${products.quantity} + ${direction * original.quantity})` })
        .where(eq(products.id, original.productId));
      await tx.insert(stockMoves).values({
        userId: ctx.userId,
        productId: original.productId,
        entryId: entry.id,
        kind: "estorno",
        quantity: direction * original.quantity,
      });
    }
  }
  return { entryId: entry.id, conflicts: [] };
}
