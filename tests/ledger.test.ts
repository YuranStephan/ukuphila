import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { verifyAuditChain, recordAudit } from "@/server/audit";
import type { Db } from "@/server/db/client";
import { accounts, auditEvents, customers, journalEntries, postings, products } from "@/server/db/schema";
import { balanceOf, customerBalance, recordExpense, recordFiadoRepayment, recordSale, recordStockPurchase, recordTransfer, reverseEntry } from "@/server/ledger/operations";
import { postEntry, verifyLedgerChain } from "@/server/ledger/post";
import { ctx, inTx, makeMerchant, testDb } from "./helpers";

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await testDb());
});
afterAll(() => close());

describe("ledger de dupla entrada", () => {
  it("regista uma venda e actualiza o bolso Negócio", async () => {
    const user = await makeMerchant(db);
    await inTx(db, (tx) => recordSale(tx, ctx(user.id), { amountCents: 100_000 }));
    expect(await balanceOf(db, user.id, "negocio")).toBe(100_000);
    expect(await balanceOf(db, user.id, "receita")).toBe(-100_000);
  });

  it("a base de dados recusa um lançamento desequilibrado, mesmo sem passar pelo código", async () => {
    const user = await makeMerchant(db);
    await expect(
      inTx(db, async (tx) => {
        const entry = await postEntry(tx, {
          userId: user.id,
          kind: "venda",
          occurredAt: new Date(),
          channel: "app",
          recordedBy: user.id,
          amountCents: 500,
          lines: [
            { account: "negocio", amountCents: 500 },
            { account: "receita", amountCents: -500 },
          ],
        });
        const [account] = await tx.select().from(accounts).where(eq(accounts.userId, user.id)).limit(1);
        await tx.insert(postings).values({ entryId: entry.id, accountId: account.id, amountCents: 1 });
      }),
    ).rejects.toThrow();
  });

  it("não deixa alterar nem apagar movimentos ou postings", async () => {
    const user = await makeMerchant(db);
    await inTx(db, (tx) => recordSale(tx, ctx(user.id), { amountCents: 2_000 }));
    await expect(db.update(journalEntries).set({ amountCents: 1 }).where(eq(journalEntries.userId, user.id))).rejects.toThrow();
    await expect(db.delete(journalEntries).where(eq(journalEntries.userId, user.id))).rejects.toThrow();
    await expect(db.execute(sql`truncate table postings cascade`)).rejects.toThrow();
  });

  it("corrige por estorno: os totais anulam-se e a história fica visível", async () => {
    const user = await makeMerchant(db);
    const sale = await inTx(db, (tx) => recordSale(tx, ctx(user.id), { amountCents: 40_000 }));
    await inTx(db, (tx) => reverseEntry(tx, ctx(user.id), { entryId: sale.entryId as string, reason: "Valor errado" }));
    expect(await balanceOf(db, user.id, "negocio")).toBe(0);
    const rows = await db.select().from(journalEntries).where(eq(journalEntries.userId, user.id));
    expect(rows).toHaveLength(2);
    await expect(inTx(db, (tx) => reverseEntry(tx, ctx(user.id), { entryId: sale.entryId as string, reason: "De novo" }))).rejects.toThrow(/já foi corrigido/);
  });

  it("a cadeia de hashes verifica-se e aponta o primeiro elo", async () => {
    const user = await makeMerchant(db);
    for (const amount of [1_000, 2_000, 3_000]) await inTx(db, (tx) => recordSale(tx, ctx(user.id), { amountCents: amount }));
    const result = await verifyLedgerChain(db, user.id);
    expect(result).toMatchObject({ valid: true, checked: 3 });
  });

  it("calcula custo médio, stock e lucro quando há custo conhecido", async () => {
    const user = await makeMerchant(db);
    const productId = randomUUID();
    await db.insert(products).values({ id: productId, userId: user.id, name: "Tomate", unit: "caixa" });
    await inTx(db, (tx) => recordTransfer(tx, ctx(user.id), { from: "casa", to: "negocio", amountCents: 1 }).catch(() => null));
    await inTx(db, (tx) => recordStockPurchase(tx, ctx(user.id), { amountCents: 70_000, productId, quantity: 10 }));
    await inTx(db, (tx) => recordSale(tx, ctx(user.id), { amountCents: 25_000, productId, quantity: 2 }));
    const [product] = await db.select().from(products).where(eq(products.id, productId));
    expect(product.quantity).toBe(8);
    expect(product.avgCostCents).toBe(7_000);
    expect(await balanceOf(db, user.id, "custo_vendas")).toBe(14_000);
    expect(await balanceOf(db, user.id, "stock")).toBe(56_000);
  });

  it("guarda e sinaliza uma venda acima do stock em vez de a perder", async () => {
    const user = await makeMerchant(db);
    const productId = randomUUID();
    await db.insert(products).values({ id: productId, userId: user.id, name: "Cebola", unit: "saco", quantity: 1 });
    const outcome = await inTx(db, (tx) => recordSale(tx, ctx(user.id), { amountCents: 5_000, productId, quantity: 3 }));
    expect(outcome.conflicts[0].kind).toBe("stock_negativo");
    const [product] = await db.select().from(products).where(eq(products.id, productId));
    expect(product.quantity).toBe(0);
    const [entry] = await db.select().from(journalEntries).where(eq(journalEntries.userId, user.id));
    expect(entry.needsReview).toBe(true);
  });

  it("controla o fiado por cliente, ignorando movimentos estornados", async () => {
    const user = await makeMerchant(db);
    const customerId = randomUUID();
    await db.insert(customers).values({ id: customerId, userId: user.id, name: "Mana Rita" });
    await inTx(db, (tx) => recordSale(tx, ctx(user.id), { amountCents: 30_000, customerId }));
    const wrong = await inTx(db, (tx) => recordSale(tx, ctx(user.id), { amountCents: 10_000, customerId }));
    await inTx(db, (tx) => reverseEntry(tx, ctx(user.id), { entryId: wrong.entryId as string, reason: "Não era fiado" }));
    expect(await customerBalance(db, user.id, customerId)).toBe(30_000);
    const paid = await inTx(db, (tx) => recordFiadoRepayment(tx, ctx(user.id), { customerId, amountCents: 35_000 }));
    expect(paid.conflicts[0].kind).toBe("fiado_excesso");
    expect(await customerBalance(db, user.id, customerId)).toBe(-5_000);
  });

  it("um comerciante não toca nos produtos de outro", async () => {
    const owner = await makeMerchant(db);
    const intruder = await makeMerchant(db);
    const productId = randomUUID();
    await db.insert(products).values({ id: productId, userId: owner.id, name: "Arroz", unit: "saco" });
    await expect(inTx(db, (tx) => recordSale(tx, ctx(intruder.id), { amountCents: 100, productId, quantity: 1 }))).rejects.toThrow(/Produto não encontrado/);
  });

  it("assinala despesa que deixa o bolso abaixo de zero", async () => {
    const user = await makeMerchant(db);
    const outcome = await inTx(db, (tx) => recordExpense(tx, ctx(user.id), { amountCents: 1_000, category: "transporte" }));
    expect(outcome.conflicts[0].kind).toBe("saldo_negativo");
  });
});

describe("auditoria encadeada", () => {
  it("verifica a cadeia e recusa alterações", async () => {
    await inTx(db, (tx) => recordAudit(tx, { actorId: null, actorRole: "sistema", action: "teste.um", subjectType: "teste" }));
    await inTx(db, (tx) => recordAudit(tx, { actorId: null, actorRole: "sistema", action: "teste.dois", subjectType: "teste", data: { a: 1 } }));
    expect((await verifyAuditChain(db)).valid).toBe(true);
    await expect(db.delete(auditEvents)).rejects.toThrow();
  });
});
