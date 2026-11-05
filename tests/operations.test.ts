import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { addDays, maputoDay } from "@/lib/dates";
import { assignMerchant } from "@/server/admin/people";
import { repaymentStats } from "@/server/analytics/programme";
import { assertAssigned } from "@/server/agent/service";
import { approvePolicy, markOverdue, proposePolicy, recordRepayment } from "@/server/credit/service";
import type { Db } from "@/server/db/client";
import { businesses, creditContracts, creditInstalments, creditPolicies, journalEntries, proposals, xitiqueContributions, xitiqueMembers, xitiqueRounds } from "@/server/db/schema";
import { handleInbound } from "@/server/whatsapp";
import { recordSale } from "@/server/ledger/operations";
import { addOfflineMember, confirmContribution, confirmPayout, createGroup, declareContribution, groupDetail, joinByCode, startGroup } from "@/server/xitique/service";
import { creditParams, deliveredCredit } from "./fixtures";
import { ctx, inTx, makeAgent, makeMarket, makeMerchant, makeStaff, testDb } from "./helpers";

vi.mock("@/server/ai/claude", () => ({ hasClaude: () => false, answerWithClaude: vi.fn(), classifyWithClaude: vi.fn() }));
let db: Db;
let close: () => Promise<void>;
beforeAll(async () => { ({ db, close } = await testDb()); });
afterAll(() => close());
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("percursos operacionais", () => {
  it("a gestão atribui o registo do site a um agente do mesmo mercado e pode transferi-lo", async () => {
    const market = await makeMarket(db);
    const first = await makeAgent(db, market.id);
    const second = await makeAgent(db, market.id);
    const otherMarket = await makeAgent(db, (await makeMarket(db)).id);
    const merchant = await makeMerchant(db, { marketId: market.id });
    const admin = await makeStaff(db, "admin");
    await expect(assignMerchant(db, first.user, merchant.id, first.agent.id)).rejects.toMatchObject({ code: "sem_permissao" });
    await expect(assignMerchant(db, admin, merchant.id, otherMarket.agent.id)).rejects.toMatchObject({ code: "agente" });
    await assignMerchant(db, admin, merchant.id, first.agent.id);
    await assertAssigned(db, first.agent.id, merchant.id);
    await assignMerchant(db, admin, merchant.id, second.agent.id);
    await expect(assertAssigned(db, first.agent.id, merchant.id)).rejects.toMatchObject({ code: "sem_permissao" });
    expect((await db.select().from(businesses).where(eq(businesses.ownerId, merchant.id)))[0].agentId).toBe(second.agent.id);
  });

  it("valida políticas mesmo quando o formulário é contornado", async () => {
    const analyst = await makeStaff(db, "credit_analyst");
    for (const params of [
      { ...creditParams, feePercentBasisPoints: Number.NaN },
      { ...creditParams, termOptionsDays: [0] },
      { ...creditParams, concentrationLimitPct: 101 },
      { ...creditParams, graceDays: creditParams.defaultAfterDays },
      { ...creditParams, maxAmountByRing: { base: -1, second: 2, third: 3 } },
    ]) await expect(proposePolicy(db, analyst, { version: randomUUID(), params })).rejects.toMatchObject({ code: "politica" });
  });

  it("a política nova não altera a tolerância nem o incumprimento de um contrato anterior", async () => {
    const f = await deliveredCredit(db);
    const instalments = await db.select().from(creditInstalments).where(eq(creditInstalments.contractId, f.contract.id));
    for (const row of instalments) await db.update(creditInstalments).set({ dueDate: "2090-01-03" }).where(eq(creditInstalments.id, row.id));
    const version = randomUUID();
    await proposePolicy(db, f.analyst, { version, params: { ...creditParams, graceDays: 10, defaultAfterDays: 120 } });
    const [policy] = await db.select().from(creditPolicies).where(eq(creditPolicies.version, version));
    await approvePolicy(db, f.approver, policy.id);
    await markOverdue(db, "2090-01-06");
    expect((await db.select().from(creditContracts).where(eq(creditContracts.id, f.contract.id)))[0].status).toBe("em_atraso");
    await markOverdue(db, "2090-02-20");
    expect((await db.select().from(creditContracts).where(eq(creditContracts.id, f.contract.id)))[0].status).toBe("incumprimento");
  });

  it("recusa reutilizar uma referência noutro valor ou contrato", async () => {
    const first = await deliveredCredit(db);
    const second = await deliveredCredit(db);
    const reference = randomUUID();
    await recordRepayment(db, first.analyst, first.contract.id, { amountCents: 100, reference, method: "M-Pesa" });
    await expect(recordRepayment(db, first.analyst, first.contract.id, { amountCents: 200, reference, method: "M-Pesa" })).rejects.toMatchObject({ code: "referencia_em_uso" });
    await expect(recordRepayment(db, second.analyst, second.contract.id, { amountCents: 100, reference, method: "M-Pesa" })).rejects.toMatchObject({ code: "referencia_em_uso" });
  });

  it("prestações futuras pagas antecipadamente não inflacionam a pontualidade", async () => {
    const f = await deliveredCredit(db);
    const rows = await db.select().from(creditInstalments).where(eq(creditInstalments.contractId, f.contract.id)).orderBy(asc(creditInstalments.number));
    const before = await repaymentStats(db);
    for (const [index, row] of rows.entries()) await db.update(creditInstalments).set({ dueDate: addDays(maputoDay(), index * 30), ...(index < 2 ? { status: "pago", paidCents: row.amountCents, paidAt: new Date() } : {}) }).where(eq(creditInstalments.id, row.id));
    const after = await repaymentStats(db);
    expect(after.due - before.due).toBe(1);
    expect(after.onTime - before.onTime).toBe(1);
  });

  it("uma falha de envio do WhatsApp repete só a resposta, preservando uma única operação", async () => {
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "test-token");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "test-number");
    const deliver = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 500 })).mockImplementation(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", deliver);
    const merchant = await makeMerchant(db);
    const input = { phone: merchant.phone!, body: "Vendi 350", providerId: randomUUID() };
    await expect(handleInbound(db, input)).rejects.toThrow(/entregar/);
    await handleInbound(db, input);
    expect(await db.select().from(proposals).where(eq(proposals.userId, merchant.id))).toHaveLength(1);
    const confirmation = { phone: merchant.phone!, body: "sim", providerId: randomUUID() };
    await handleInbound(db, confirmation);
    await handleInbound(db, confirmation);
    expect(await db.select().from(journalEntries).where(eq(journalEntries.userId, merchant.id))).toHaveLength(1);
    expect(deliver).toHaveBeenCalledTimes(3);
  });

  it("conclui a ronda de um membro sem telefone com confirmação e recibo, sem lançar dinheiro na conta do tesoureiro", async () => {
    const market = await makeMarket(db);
    const people = [];
    for (let index = 0; index < 3; index++) {
      const person = await makeMerchant(db, { marketId: market.id });
      await inTx(db, (tx) => recordSale(tx, ctx(person.id), { amountCents: 1000 }));
      people.push(person);
    }
    const group = await createGroup(db, people[0], { name: "Grupo operacional", contributionCents: 100, frequency: "semanal", payoutMode: "combinada", marketId: market.id });
    await joinByCode(db, people[1], group.code);
    await joinByCode(db, people[2], group.code);
    await addOfflineMember(db, people[0], group.id, { displayName: "Participante sem telefone" });
    const members = await db.select().from(xitiqueMembers).where(eq(xitiqueMembers.groupId, group.id));
    const offline = members.find((member) => !member.userId)!;
    await startGroup(db, people[0], group.id, { startsOn: "2090-01-01", order: [offline.id, ...members.filter((member) => member.id !== offline.id).map((member) => member.id)] });
    const [round] = await db.select().from(xitiqueRounds).where(eq(xitiqueRounds.groupId, group.id)).orderBy(asc(xitiqueRounds.number));
    await expect(confirmPayout(db, people[0], round.id, { receiptNote: "Entregue pessoalmente no mercado." })).rejects.toMatchObject({ code: "xitique_estado" });
    const contributions = await db.select().from(xitiqueContributions).where(eq(xitiqueContributions.roundId, round.id));
    for (const contribution of contributions) {
      const member = members.find((item) => item.id === contribution.memberId)!;
      const declarer = people.find((person) => person.id === member.userId) ?? people[0];
      await inTx(db, (tx) => declareContribution(tx, ctx(declarer.id), { contributionId: contribution.id }));
      const confirmer = declarer.id === people[0].id ? people[1] : people[0];
      const detail = await groupDetail(db, group.id, confirmer.id);
      expect(detail.rounds[0].contributions.find((item) => item.id === contribution.id)?.canConfirm).toBe(true);
      await confirmContribution(db, confirmer, contribution.id);
    }
    await expect(confirmPayout(db, people[1], round.id, { receiptNote: "Entregue pessoalmente no mercado." })).rejects.toMatchObject({ code: "xitique_acesso" });
    await confirmPayout(db, people[0], round.id, { receiptNote: "Entregue pessoalmente no mercado." });
    expect((await db.select().from(xitiqueRounds).where(eq(xitiqueRounds.id, round.id)))[0].status).toBe("paga");
    expect(await db.select().from(journalEntries).where(and(eq(journalEntries.refId, group.id), eq(journalEntries.kind, "xitique_recebimento")))).toHaveLength(0);
  });
});
