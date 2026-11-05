import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setPin } from "@/server/auth/service";
import { acceptOffer, activePolicy, approvePolicy, buildSchedule, confirmDelivery, contractOutstanding, decideApplication, limitFor, markOverdue, proposePolicy, recordRepayment, submitApplication } from "@/server/credit/service";
import type { Db } from "@/server/db/client";
import { consents, creditApplications, creditContracts, creditDecisions, creditInstalments, creditPolicies, creditRepayments, journalEntries, notifications, products, riskAlerts, supplierProducts, users } from "@/server/db/schema";
import { balanceOf } from "@/server/ledger/operations";
import { trustFor } from "@/server/trust/facts";
import { acceptedCredit, creditFixture, creditParams, deliveredCredit, grantConsent, recommendedCredit, TEST_PIN } from "./fixtures";
import { makeStaff, testDb } from "./helpers";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => { ({ db, close } = await testDb()); });
afterAll(() => close());

describe("supplier credit", () => {
  it("refuses absent or revoked credit consent before creating an application", async () => {
    const f = await creditFixture(db);
    await expect(submitApplication(db, f.user, f.input)).rejects.toMatchObject({ code: "credito_consentimento" });
    await grantConsent(db, f.user.id, "historial_credito");
    await db.update(consents).set({ status: "revogado", revokedAt: new Date() }).where(eq(consents.userId, f.user.id));
    await expect(submitApplication(db, f.user, f.input)).rejects.toMatchObject({ code: "credito_consentimento" });
    expect(await db.select().from(creditApplications).where(eq(creditApplications.userId, f.user.id))).toHaveLength(0);
  });

  it("refuses ring below four with the actual missing-evidence reason", async () => {
    const f = await creditFixture(db, false);
    await grantConsent(db, f.user.id, "historial_credito");
    const trust = await trustFor(db, f.user.id);
    expect(trust.ring).toBeLessThan(4);
    expect(trust.rings[3].missing.length).toBeGreaterThan(0);
    await expect(submitApplication(db, f.user, f.input)).rejects.toMatchObject({ code: "credito_prontidao", message: trust.rings[3].missing[0] });
  });

  it.each([0, 1, 2, 3])("enforces the phase limit after %i settled contracts", async (settled) => {
    const f = await creditFixture(db);
    await grantConsent(db, f.user.id, "historial_credito");
    // Prior settlements are fixture history; separate tests cover the full settlement workflow.
    for (let index = 0; index < settled; index += 1) {
      const [application] = await db.insert(creditApplications).values({ code: `CX3-${randomUUID()}`, userId: f.user.id, supplierId: f.supplier.id, policyId: f.policy.id, requestedCents: 1, items: [], trustSnapshot: {}, status: "aceite" }).returning();
      await db.insert(creditContracts).values({ code: `CX3-${randomUUID()}`, applicationId: application.id, userId: f.user.id, supplierId: f.supplier.id, principalCents: 1, termDays: 12, termsSnapshot: {}, acceptedAt: new Date(), acceptedChannel: "app", deliveryCode: "123456", status: "liquidado", settledAt: new Date() });
    }
    const limit = settled === 0 ? 10_000 : settled === 1 ? 20_000 : 30_000;
    expect(limitFor(creditParams, settled)).toBe(limit);
    expect((await trustFor(db, f.user.id)).facts.supplierContractsSettled).toBe(settled);
    const input = { ...f.input, items: [{ supplierProductId: f.product.id, quantity: 1 }] };
    await db.update(supplierProducts).set({ priceCents: limit + 1 }).where(eq(supplierProducts.id, f.product.id));
    await expect(submitApplication(db, f.user, input)).rejects.toMatchObject({ code: "credito_limite" });
    await db.update(supplierProducts).set({ priceCents: limit }).where(eq(supplierProducts.id, f.product.id));
    const application = await submitApplication(db, f.user, input);
    expect(application.requestedCents).toBe(limit);
    expect(application.trustSnapshot).toMatchObject({ ring: 4, policyVersion: "cx3-test" });
    await expect(submitApplication(db, f.user, input)).rejects.toMatchObject({ code: "credito_aberto" });
  });

  it("requires a different approver even after the analyst changes role", async () => {
    const f = await recommendedCredit(db);
    await db.update(users).set({ role: "credit_approver" }).where(eq(users.id, f.analyst.id));
    const decision = { outcome: "aprova" as const, reasonCodes: ["historico_consistente"], note: "Independent evidence review completed." };
    await expect(decideApplication(db, { ...f.analyst, role: "credit_approver" }, f.application.id, decision)).rejects.toMatchObject({ code: "quatro_olhos" });
    expect((await db.select().from(creditApplications).where(eq(creditApplications.id, f.application.id)))[0].status).toBe("recomendado");
    await decideApplication(db, f.approver, f.application.id, decision);
    const decisions = await db.select().from(creditDecisions).where(eq(creditDecisions.applicationId, f.application.id));
    expect(decisions).toHaveLength(2);
    expect(decisions.find((row) => row.stage === "analise")?.actorId).toBe(f.analyst.id);
    expect(decisions.find((row) => row.stage === "aprovacao")?.actorId).toBe(f.approver.id);
  });

  it("requires the merchant PIN and freezes the approved terms on acceptance", async () => {
    const f = await recommendedCredit(db);
    await decideApplication(db, f.approver, f.application.id, { outcome: "aprova", reasonCodes: ["historico_consistente"], note: "Independent evidence review completed." });
    await expect(acceptOffer(db, f.user, f.application.id, TEST_PIN)).rejects.toMatchObject({ code: "sem_pin" });
    await setPin(db, f.user.id, TEST_PIN);
    await expect(acceptOffer(db, f.user, f.application.id, "0000")).rejects.toMatchObject({ code: "pin_errado" });
    expect(await db.select().from(creditContracts).where(eq(creditContracts.userId, f.user.id))).toHaveLength(0);
    const contract = await acceptOffer(db, f.user, f.application.id, TEST_PIN);
    expect(contract).toMatchObject({ status: "aguarda_entrega", principalCents: 6_003, feeCents: 75, termDays: 12, acceptedChannel: "app" });
    expect(contract.termsSnapshot).toMatchObject({ policyVersion: f.policy.version, graceDays: creditParams.graceDays });
    expect(contract.deliveryCode).toMatch(/^\d{6}$/);
    expect(await balanceOf(db, f.user.id, "divida_fornecedor")).toBe(0);
  });

  it.each([
    [10_003, 3, 12, [3_334, 3_334, 3_335]],
    [10_001, 1, 24, [10_001]],
    [10_001, 12, 24, [833, 833, 833, 833, 833, 833, 833, 833, 833, 833, 833, 838]],
  ] as const)("conserves every cent in a %i-cent schedule", (total, count, days, amounts) => {
    const schedule = buildSchedule(total, count, days, "2090-01-01");
    expect(schedule.map((row) => row.amountCents)).toEqual(amounts);
    expect(schedule.reduce((sum, row) => sum + row.amountCents, 0)).toBe(total);
    expect(schedule.map((row) => row.number)).toEqual(Array.from({ length: count }, (_, index) => index + 1));
    expect(schedule.every((row) => Number.isSafeInteger(row.amountCents) && row.amountCents > 0)).toBe(true);
    expect(schedule.at(-1)?.dueDate).toBe(days === 12 ? "2090-01-13" : "2090-01-25");
  });

  it("starts debt and stock only after the supplier owner presents the correct code", async () => {
    const f = await acceptedCredit(db);
    const other = await makeStaff(db, "supplier");
    await expect(confirmDelivery(db, other, f.contract.id, f.contract.deliveryCode)).rejects.toMatchObject({ code: "sem_permissao" });
    await expect(confirmDelivery(db, f.supplierUser, f.contract.id, "")).rejects.toMatchObject({ code: "contrato_codigo" });
    expect(await balanceOf(db, f.user.id, "divida_fornecedor")).toBe(0);
    expect(await db.select().from(creditInstalments).where(eq(creditInstalments.contractId, f.contract.id))).toHaveLength(0);
    expect(await db.select().from(products).where(eq(products.userId, f.user.id))).toHaveLength(0);
    await confirmDelivery(db, f.supplierUser, f.contract.id, ` ${f.contract.deliveryCode} `);
    expect(await balanceOf(db, f.user.id, "divida_fornecedor")).toBe(-6_078);
    expect(await balanceOf(db, f.user.id, "stock")).toBe(6_003);
    expect(await balanceOf(db, f.user.id, "despesas")).toBe(75);
    const instalments = await db.select().from(creditInstalments).where(eq(creditInstalments.contractId, f.contract.id));
    expect(instalments).toHaveLength(3);
    expect(instalments.reduce((sum, row) => sum + row.amountCents, 0)).toBe(6_078);
    expect((await db.select().from(products).where(eq(products.userId, f.user.id)))[0]).toMatchObject({ name: "CX3 Rice", quantity: 3, avgCostCents: 2_001 });
    await expect(confirmDelivery(db, f.supplierUser, f.contract.id, f.contract.deliveryCode)).rejects.toMatchObject({ code: "contrato_estado" });
    expect(await balanceOf(db, f.user.id, "stock")).toBe(6_003);
  });

  it("applies a reference only once, allocates oldest instalments and settles the balance", async () => {
    const f = await deliveredCredit(db);
    const before = await balanceOf(db, f.user.id, "negocio");
    const first = { amountCents: 2_500, method: "cash", reference: randomUUID() };
    await recordRepayment(db, f.analyst, f.contract.id, first);
    await recordRepayment(db, f.analyst, f.contract.id, first);
    expect(await contractOutstanding(db, f.contract.id)).toBe(3_578);
    expect(await balanceOf(db, f.user.id, "negocio")).toBe(before - 2_500);
    const partial = await db.select().from(creditInstalments).where(eq(creditInstalments.contractId, f.contract.id)).orderBy(asc(creditInstalments.number));
    expect(partial.map((row) => [row.paidCents, row.status])).toEqual([[2_026, "pago"], [474, "parcial"], [0, "por_pagar"]]);
    expect(await db.select().from(creditRepayments).where(eq(creditRepayments.contractId, f.contract.id))).toHaveLength(1);
    await recordRepayment(db, f.analyst, f.contract.id, { amountCents: 3_578, method: "cash", reference: randomUUID() });
    expect(await contractOutstanding(db, f.contract.id)).toBe(0);
    expect(await balanceOf(db, f.user.id, "divida_fornecedor")).toBe(0);
    expect(await balanceOf(db, f.user.id, "negocio")).toBe(before - 6_078);
    const [contract] = await db.select().from(creditContracts).where(eq(creditContracts.id, f.contract.id));
    expect(contract.status).toBe("liquidado");
    expect(contract.settledAt).toBeInstanceOf(Date);
    expect(await db.select().from(creditRepayments).where(eq(creditRepayments.contractId, f.contract.id))).toHaveLength(2);
    expect((await db.select().from(creditInstalments).where(eq(creditInstalments.contractId, f.contract.id))).every((row) => row.status === "pago")).toBe(true);
  });

  it("rejects invalid payments, overpayment and an actor without repayment permission", async () => {
    const f = await deliveredCredit(db);
    for (const amountCents of [0, -1, 1.5]) {
      await expect(recordRepayment(db, f.analyst, f.contract.id, { amountCents, method: "cash", reference: randomUUID() })).rejects.toMatchObject({ code: "valor" });
    }
    await expect(recordRepayment(db, f.approver, f.contract.id, { amountCents: 1, method: "cash", reference: randomUUID() })).rejects.toMatchObject({ code: "sem_permissao" });
    await expect(recordRepayment(db, f.analyst, f.contract.id, { amountCents: 6_079, method: "cash", reference: randomUUID() })).rejects.toMatchObject({ code: "contrato_valor" });
    expect(await contractOutstanding(db, f.contract.id)).toBe(6_078);
    expect(await db.select().from(creditRepayments).where(eq(creditRepayments.contractId, f.contract.id))).toHaveLength(0);
  });

  it("respects grace days, marks arrears, deduplicates alerts and reaches default", async () => {
    const f = await deliveredCredit(db);
    const instalments = await db.select().from(creditInstalments).where(eq(creditInstalments.contractId, f.contract.id)).orderBy(asc(creditInstalments.number));
    for (const [index, row] of instalments.entries()) {
      await db.update(creditInstalments).set({ dueDate: ["2090-01-03", "2090-01-09", "2090-01-15"][index] }).where(eq(creditInstalments.id, row.id));
    }
    const contract = async () => (await db.select().from(creditContracts).where(eq(creditContracts.id, f.contract.id)))[0];
    const alerts = () => db.select().from(riskAlerts).where(and(eq(riskAlerts.subjectUserId, f.user.id), eq(riskAlerts.rule, "credito_atraso")));
    await markOverdue(db, "2090-01-05");
    expect((await contract()).status).toBe("activo");
    expect(await alerts()).toHaveLength(0);
    await markOverdue(db, "2090-01-06");
    expect((await contract()).status).toBe("em_atraso");
    expect((await alerts())[0]).toMatchObject({ severity: "baixa", evidence: { contractId: f.contract.id, instalment: 1, late: 3 } });
    const notices = () => db.select().from(notifications).where(and(eq(notifications.userId, f.user.id), eq(notifications.title, "Prestação em atraso")));
    expect(await notices()).toHaveLength(1);
    await markOverdue(db, "2090-01-06");
    expect(await alerts()).toHaveLength(1);
    expect(await notices()).toHaveLength(1);
    await markOverdue(db, "2090-02-20");
    expect((await contract()).status).toBe("incumprimento");
    expect((await alerts()).some((row) => row.severity === "alta")).toBe(true);
    expect((await db.select().from(creditInstalments).where(eq(creditInstalments.contractId, f.contract.id))).every((row) => row.status === "em_atraso")).toBe(true);
  });
});

describe("credit policy governance", () => {
  it("requires four eyes in both service and database, then archives the previous policy", async () => {
    const analyst = await makeStaff(db, "credit_analyst");
    const approver = await makeStaff(db, "credit_approver");
    const firstVersion = `cx3-${randomUUID()}`;
    await proposePolicy(db, analyst, { version: firstVersion, params: creditParams });
    const [first] = await db.select().from(creditPolicies).where(eq(creditPolicies.version, firstVersion));
    await expect(approvePolicy(db, { ...analyst, role: "credit_approver" }, first.id)).rejects.toMatchObject({ code: "quatro_olhos" });
    await expect(db.update(creditPolicies).set({ approvedBy: analyst.id }).where(eq(creditPolicies.id, first.id))).rejects.toThrow();
    await approvePolicy(db, approver, first.id);
    expect((await activePolicy(db))?.id).toBe(first.id);
    await expect(db.insert(creditPolicies).values({ version: `cx3-${randomUUID()}`, params: creditParams, createdBy: analyst.id, approvedBy: approver.id, status: "aprovada" })).rejects.toThrow();
    const secondVersion = `cx3-${randomUUID()}`;
    await proposePolicy(db, analyst, { version: secondVersion, params: { ...creditParams, graceDays: 4 } });
    const [second] = await db.select().from(creditPolicies).where(eq(creditPolicies.version, secondVersion));
    await approvePolicy(db, approver, second.id);
    expect((await activePolicy(db))?.id).toBe(second.id);
    expect((await db.select().from(creditPolicies).where(eq(creditPolicies.id, first.id)))[0].status).toBe("arquivada");
    expect(await db.select().from(creditPolicies).where(eq(creditPolicies.status, "aprovada"))).toHaveLength(1);
  });
});

describe("final repayment replay regression", () => {
  let f: Awaited<ReturnType<typeof deliveredCredit>>;
  let payment: { amountCents: number; method: string; reference: string };
  beforeAll(async () => {
    f = await deliveredCredit(db);
    payment = { amountCents: f.contract.principalCents + f.contract.feeCents, method: "cash", reference: randomUUID() };
    await recordRepayment(db, f.analyst, f.contract.id, payment);
    expect(await contractOutstanding(db, f.contract.id)).toBe(0);
    expect((await db.select().from(creditContracts).where(eq(creditContracts.id, f.contract.id)))[0].status).toBe("liquidado");
  });

  // CX3-02: the status guard currently runs before the duplicate-reference lookup.
  it("acknowledges a repeated final reference after the contract has settled", async () => {
    await expect(recordRepayment(db, f.analyst, f.contract.id, payment)).resolves.toBeUndefined();
  });

  it("keeps exactly one repayment and ledger entry after the repeated final reference", async () => {
    expect(await db.select().from(creditRepayments).where(eq(creditRepayments.reference, payment.reference))).toHaveLength(1);
    expect(await db.select().from(journalEntries).where(and(eq(journalEntries.refId, f.contract.id), eq(journalEntries.kind, "credito_pagamento")))).toHaveLength(1);
    expect(await contractOutstanding(db, f.contract.id)).toBe(0);
  });
});
