import "server-only";
import { and, eq, ne } from "drizzle-orm";
import type { z } from "zod";
import type { Tx } from "../db/client";
import { customers, products, savingsGoals, stockMoves } from "../db/schema";
import { DomainError } from "../errors";
import {
  recordCapital,
  recordExpense,
  recordFiadoRepayment,
  recordSale,
  recordSavingsDeposit,
  recordSavingsWithdrawal,
  recordStockPurchase,
  recordTransfer,
  reverseEntry,
  type OperationContext,
} from "../ledger/operations";
import { postEntry } from "../ledger/post";
import { declareContribution } from "../xitique/service";
import { opPayloads, type OpType } from "./schemas";

type Payload<T extends OpType> = z.infer<(typeof opPayloads)[T]>;
export type OpOutcome = { entryId?: string; conflicts: { kind: string; message: string }[] };

async function upsertProduct(tx: Tx, ctx: OperationContext, input: Payload<"product.upsert">): Promise<OpOutcome> {
  const [taken] = await tx
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.userId, ctx.userId), eq(products.name, input.name), ne(products.id, input.id)));
  // Two offline devices can create the same product; keep both rather than lose the later sales that reference this id.
  const name = taken ? `${input.name} (${input.id.slice(0, 4)})` : input.name;
  const values = {
    name,
    unit: input.unit,
    icon: input.icon ?? "caixa",
    salePriceCents: input.salePriceCents ?? null,
    lowStockAt: input.lowStockAt ?? 5,
    marketCategory: input.marketCategory ?? null,
  };
  const rows = await tx
    .insert(products)
    .values({ id: input.id, userId: ctx.userId, ...values })
    .onConflictDoUpdate({ target: products.id, set: values, where: eq(products.userId, ctx.userId) })
    .returning({ id: products.id });
  if (rows.length === 0) throw new DomainError("produto", "Produto não encontrado.");
  return { conflicts: [] };
}

async function upsertCustomer(tx: Tx, ctx: OperationContext, input: Payload<"customer.upsert">): Promise<OpOutcome> {
  const [taken] = await tx
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.userId, ctx.userId), eq(customers.name, input.name), ne(customers.id, input.id)));
  const name = taken ? `${input.name} (${input.id.slice(0, 4)})` : input.name;
  const values = { name, phone: input.phone ?? null, note: input.note ?? null };
  const rows = await tx
    .insert(customers)
    .values({ id: input.id, userId: ctx.userId, ...values })
    .onConflictDoUpdate({ target: customers.id, set: values, where: eq(customers.userId, ctx.userId) })
    .returning({ id: customers.id });
  if (rows.length === 0) throw new DomainError("cliente", "Cliente não encontrado.");
  return { conflicts: [] };
}

async function upsertGoal(tx: Tx, ctx: OperationContext, input: Payload<"savings.goal">): Promise<OpOutcome> {
  const values = { name: input.name, targetCents: input.targetCents, targetDate: input.targetDate ?? null };
  const rows = await tx
    .insert(savingsGoals)
    .values({ id: input.id, userId: ctx.userId, ...values })
    .onConflictDoUpdate({ target: savingsGoals.id, set: values, where: eq(savingsGoals.userId, ctx.userId) })
    .returning({ id: savingsGoals.id });
  if (rows.length === 0) throw new DomainError("meta", "Meta não encontrada.");
  return { conflicts: [] };
}

async function adjustStock(tx: Tx, ctx: OperationContext, input: Payload<"stock.adjust">): Promise<OpOutcome> {
  const [product] = await tx
    .select()
    .from(products)
    .where(and(eq(products.id, input.productId), eq(products.userId, ctx.userId)))
    .for("update");
  if (!product) throw new DomainError("produto", "Produto não encontrado.");
  const difference = input.quantity - product.quantity;
  if (difference === 0) return { conflicts: [] };
  const value = Math.abs(difference) * product.avgCostCents;
  let entryId: string | undefined;
  if (value > 0) {
    const entry = await postEntry(tx, {
      userId: ctx.userId,
      kind: "ajuste_stock",
      occurredAt: ctx.occurredAt,
      channel: ctx.channel,
      recordedBy: ctx.actorId,
      opId: ctx.opId,
      amountCents: value,
      productId: product.id,
      quantity: Math.abs(difference),
      memo: input.reason,
      lines: [
        { account: "stock", amountCents: difference > 0 ? value : -value },
        { account: "correccoes", amountCents: difference > 0 ? -value : value },
      ],
    });
    entryId = entry.id;
  }
  await tx.update(products).set({ quantity: input.quantity }).where(eq(products.id, product.id));
  await tx.insert(stockMoves).values({ userId: ctx.userId, productId: product.id, entryId, kind: difference < 0 ? "perda" : "ajuste", quantity: difference, note: input.reason });
  return { entryId, conflicts: [] };
}

/** The single dispatcher behind the app, WhatsApp, voice and agent-assisted records. */
export async function executeOp(tx: Tx, ctx: OperationContext, type: OpType, rawPayload: unknown): Promise<OpOutcome> {
  const parsed = opPayloads[type].safeParse(rawPayload);
  if (!parsed.success) throw new DomainError("dados_invalidos", "Faltam dados neste registo.");
  const payload = parsed.data as never;
  switch (type) {
    case "sale.record":
      return recordSale(tx, ctx, payload);
    case "expense.record":
      return recordExpense(tx, ctx, payload);
    case "stock.purchase":
      return recordStockPurchase(tx, ctx, payload);
    case "pocket.transfer":
      return recordTransfer(tx, ctx, payload);
    case "capital.in":
      return recordCapital(tx, ctx, payload);
    case "product.upsert":
      return upsertProduct(tx, ctx, payload);
    case "stock.adjust":
      return adjustStock(tx, ctx, payload);
    case "customer.upsert":
      return upsertCustomer(tx, ctx, payload);
    case "fiado.repay":
      return recordFiadoRepayment(tx, ctx, payload);
    case "savings.goal":
      return upsertGoal(tx, ctx, payload);
    case "savings.deposit":
      return recordSavingsDeposit(tx, ctx, payload);
    case "savings.withdraw":
      return recordSavingsWithdrawal(tx, ctx, payload);
    case "entry.reverse":
      return reverseEntry(tx, ctx, payload);
    case "xitique.declare":
      return declareContribution(tx, ctx, payload);
  }
}
