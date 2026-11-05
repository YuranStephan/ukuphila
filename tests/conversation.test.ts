import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { formatMT } from "@/lib/money";
import { respond } from "@/server/ai/conversation";
import type { Db } from "@/server/db/client";
import { aiTurns, incidents, journalEntries, kbChunks, kbDocuments, proposals } from "@/server/db/schema";
import { balanceOf, recordExpense, recordSale, recordSavingsDeposit, recordTransfer } from "@/server/ledger/operations";
import { ctx, inTx, makeMerchant, testDb } from "./helpers";

// Exercise the deterministic engine and real retrieval without external model calls or API keys.
vi.mock("@/server/ai/claude", () => ({ hasClaude: () => false, answerWithClaude: vi.fn(), classifyWithClaude: vi.fn() }));

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => { ({ db, close } = await testDb()); });
afterAll(() => close());

describe("conversation guardrails", () => {
  it.each(["app", "whatsapp"] as const)("creates a proposal on %s and changes the ledger only after SIM", async (channel) => {
    const user = await makeMerchant(db);
    const draft = await respond(db, { userId: user.id, channel, text: "Vendi por 350 meticais" });
    expect(draft).toMatchObject({ intent: "RECORD_SALE", guardrails: ["proposta_sem_execucao"] });
    expect(draft.proposalId).toBeDefined();
    expect(await balanceOf(db, user.id, "negocio")).toBe(0);
    expect(await db.select().from(journalEntries).where(eq(journalEntries.userId, user.id))).toHaveLength(0);
    expect((await db.select().from(proposals).where(eq(proposals.id, draft.proposalId!)))[0].status).toBe("pendente");
    const accepted = await respond(db, { userId: user.id, channel, text: "sim" });
    expect(accepted.guardrails).toContain("confirmacao_explicita");
    expect(await balanceOf(db, user.id, "negocio")).toBe(35_000);
    const [entry] = await db.select().from(journalEntries).where(eq(journalEntries.userId, user.id));
    const [proposal] = await db.select().from(proposals).where(eq(proposals.id, draft.proposalId!));
    expect(proposal).toMatchObject({ status: "confirmada", opId: entry.opId });
    expect(entry).toMatchObject({ kind: "venda", amountCents: 35_000, channel });
    await respond(db, { userId: user.id, channel, text: "sim" });
    expect(await balanceOf(db, user.id, "negocio")).toBe(35_000);
    expect(await db.select().from(journalEntries).where(eq(journalEntries.userId, user.id))).toHaveLength(1);
  });

  it("NÃO cancels a proposal and a later SIM cannot execute it", async () => {
    const user = await makeMerchant(db);
    const draft = await respond(db, { userId: user.id, channel: "app", text: "Gastei 150 de transporte" });
    expect(draft.proposalId).toBeDefined();
    const cancelled = await respond(db, { userId: user.id, channel: "app", text: "não" });
    expect(cancelled).toMatchObject({ intent: "CONFIRM_NO", text: "Cancelado. Não registei nada." });
    expect((await db.select().from(proposals).where(eq(proposals.id, draft.proposalId!)))[0].status).toBe("rejeitada");
    await respond(db, { userId: user.id, channel: "app", text: "sim" });
    expect(await balanceOf(db, user.id, "negocio")).toBe(0);
    expect(await db.select().from(journalEntries).where(eq(journalEntries.userId, user.id))).toHaveLength(0);
  });

  it("cannot confirm another merchant's proposal or an expired one", async () => {
    const user = await makeMerchant(db);
    const other = await makeMerchant(db);
    const draft = await respond(db, { userId: user.id, channel: "app", text: "Vendi por 100 meticais" });
    await respond(db, { userId: other.id, channel: "app", text: "sim" });
    expect(await balanceOf(db, other.id, "negocio")).toBe(0);
    expect((await db.select().from(proposals).where(eq(proposals.id, draft.proposalId!)))[0].status).toBe("pendente");
    await db.update(proposals).set({ expiresAt: new Date(Date.now() - 1_000) }).where(eq(proposals.id, draft.proposalId!));
    await respond(db, { userId: user.id, channel: "app", text: "sim" });
    expect(await balanceOf(db, user.id, "negocio")).toBe(0);
  });

  it("answers balance and daily questions from ledger entries without executing pending drafts", async () => {
    const user = await makeMerchant(db);
    await inTx(db, (tx) => recordSale(tx, ctx(user.id), { amountCents: 50_000 }));
    await inTx(db, (tx) => recordExpense(tx, ctx(user.id), { amountCents: 3_000, category: "transporte" }));
    await inTx(db, (tx) => recordTransfer(tx, ctx(user.id), { from: "negocio", to: "casa", amountCents: 10_000 }));
    await inTx(db, (tx) => recordSavingsDeposit(tx, ctx(user.id), { amountCents: 5_000 }));
    await respond(db, { userId: user.id, channel: "app", text: "Vendi por 999 meticais" });
    const balance = await respond(db, { userId: user.id, channel: "app", text: "Quanto tenho?" });
    expect(balance.intent).toBe("CHECK_BALANCE");
    expect(balance.guardrails).toContain("dados_do_sistema_transaccional");
    expect(balance.text).toContain(`Negócio: ${formatMT(32_000)}`);
    expect(balance.text).toContain(`Casa: ${formatMT(10_000)}`);
    expect(balance.text).toContain(`Poupança: ${formatMT(5_000)}`);
    const daily = await respond(db, { userId: user.id, channel: "app", text: "Como foi hoje?" });
    expect(daily.intent).toBe("DAILY_SUMMARY");
    expect(daily.text).toContain(`vendeste ${formatMT(50_000)}`);
    expect(daily.text).toContain(`gastaste ${formatMT(3_000)}`);
    expect(await balanceOf(db, user.id, "negocio")).toBe(32_000);
    expect(await db.select().from(journalEntries).where(eq(journalEntries.userId, user.id))).toHaveLength(4);
  });

  it("opens one human-support incident and records the escalation", async () => {
    const user = await makeMerchant(db);
    const reply = await respond(db, { userId: user.id, channel: "whatsapp", text: "quero falar com alguém" });
    expect(reply).toMatchObject({ intent: "HUMAN_SUPPORT", escalated: true, guardrails: ["escalado_para_humano"] });
    const [incident] = await db.select().from(incidents).where(eq(incidents.subjectUserId, user.id));
    expect(incident).toMatchObject({ kind: "suporte", status: "aberto", openedBy: user.id, openedVia: "whatsapp" });
    expect(reply.text).toContain(incident.code);
    const repeated = await respond(db, { userId: user.id, channel: "app", text: "quero falar com alguém" });
    expect(repeated.text).toContain(incident.code);
    expect(await db.select().from(incidents).where(eq(incidents.subjectUserId, user.id))).toHaveLength(1);
    const turns = await db.select().from(aiTurns).where(eq(aiTurns.userId, user.id));
    expect(turns).toHaveLength(2);
    expect(turns.every((turn) => turn.escalated)).toBe(true);
  });

  it("admits missing knowledge and ignores drafts until they are approved", async () => {
    const user = await makeMerchant(db);
    const documentId = `cx3-${randomUUID()}`;
    const body = "O prazo CX3 para crédito é definido pela política aprovada.";
    await db.insert(kbDocuments).values({ id: documentId, title: "CX3 Crédito", domain: "credito", version: "cx3", status: "draft", source: "CX3 test fixture", authority: "test", entities: [], keywords: ["credito", "prazo"], body });
    await db.insert(kbChunks).values({ documentId, section: "Prazo", ordinal: 1, content: body });
    const reply = await respond(db, { userId: user.id, channel: "app", text: "Qual é o prazo do crédito?" });
    expect(reply.intent).toBe("CREDIT_INFO");
    expect(reply.text).toContain("Não tenho essa informação.");
    expect(reply.sources ?? []).toEqual([]);
    expect(reply.guardrails).toContain("so_conhecimento_aprovado");
    await db.update(kbDocuments).set({ status: "approved" }).where(eq(kbDocuments.id, documentId));
    const approved = await respond(db, { userId: user.id, channel: "app", text: "Qual é o prazo do crédito?" });
    expect(approved.text).toBe(body);
    expect(approved.sources).toEqual([documentId]);
    expect(await db.select().from(journalEntries).where(eq(journalEntries.userId, user.id))).toHaveLength(0);
    expect(await db.select().from(proposals).where(and(eq(proposals.userId, user.id), eq(proposals.status, "pendente")))).toHaveLength(0);
  });
});
